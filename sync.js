/* Holoul Maintenance — data kept on the phone + background upload.
 *
 * Everything the user enters is saved on the phone first (IndexedDB "outbox"),
 * then uploaded in the background whenever the network allows.
 * Used by the page (index.html) and by the service worker (sw.js), so on phones
 * that support it (Android) the upload also happens after the app is closed.
 */
(function (g) {
  'use strict';
  const API_URL = 'https://script.google.com/macros/s/AKfycby6cn2Os6fkkireTwP8QJqV-8E45gf5V6wovl_8fz28RL_vEG3Rg0nuuEKFv3kwdYWMCw/exec';
  const TIMEOUT = { read: 20000, login: 15000, sync: 45000, photo: 90000 };
  const BATCH = 40;                     // changes per upload request
  const LEGACY_RECHECK = 60 * 60 * 1000; // old server: try the new upload again after an hour

  /* ---------- IndexedDB: "outbox" (changes waiting) + "kv" (copies of pages, session) ---------- */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open('holoul', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; resolve(d); };
      r.onerror = () => { dbp = null; reject(r.error); };
    });
    return dbp;
  }
  /** Runs fn(store) inside one transaction; resolves with the result of the request fn returns. */
  async function run(name, mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(name, mode);
      let req;
      try { req = fn(t.objectStore(name)); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
      t.onerror = t.onabort = () => reject(t.error);
    });
  }

  const kv = {
    get: k => run('kv', 'readonly', s => s.get(k)),
    set: (k, v) => run('kv', 'readwrite', s => s.put(v, k)),
    del: k => run('kv', 'readwrite', s => s.delete(k))
  };

  let seqN = 0;
  const nextSeq = () => Date.now() * 1000 + (seqN = (seqN + 1) % 1000);
  const outbox = {
    async all() { const ops = (await run('outbox', 'readonly', s => s.getAll())) || []; return ops.sort((a, b) => a.seq - b.seq); },
    get: id => run('outbox', 'readonly', s => s.get(id)),
    /** Adds or replaces a change (same id = same reading, only the newest value is kept). */
    async put(op) { op.seq = nextSeq(); op.failed = ''; op.queuedAt = Date.now(); await run('outbox', 'readwrite', s => s.put(op)); changed(); return op; },
    async remove(id) { await run('outbox', 'readwrite', s => s.delete(id)); changed(); },
    async removeFailed(username) {
      const ops = await this.all();
      await run('outbox', 'readwrite', s => { ops.filter(o => o.failed && o.username === username).forEach(o => s.delete(o.id)); });
      changed();
    },
    /** After sending: delete it (or mark it failed) only if it was not edited meanwhile. */
    settle(id, seq, failed) {
      return run('outbox', 'readwrite', s => {
        const r = s.get(id);
        r.onsuccess = () => {
          const op = r.result;
          if (!op || op.seq !== seq) return;
          if (failed) { op.failed = failed; s.put(op); } else s.delete(id);
        };
      });
    }
  };

  /* ---------- events (page <-> service worker <-> other tabs) ---------- */
  const listeners = new Set();
  let bc = null;
  try { bc = new BroadcastChannel('holoul-sync'); bc.onmessage = e => emit(e.data, true); } catch (e) {}
  function emit(msg, remote) {
    listeners.forEach(fn => { try { fn(msg); } catch (e) {} });
    if (!remote && bc) { try { bc.postMessage(msg); } catch (e) {} }
  }
  const changed = () => emit({ type: 'outbox' });
  const on = fn => { listeners.add(fn); return () => listeners.delete(fn); };

  /* ---------- network ---------- */
  const netErr = m => Object.assign(new Error(m), { net: true });
  const authErr = () => Object.assign(new Error('Session expired — please sign in again'), { auth: true });

  /** POST with a time limit. Any network trouble -> error with .net = true. */
  async function post(body, ms) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), ms || TIMEOUT.read) : 0;
    let text;
    try {
      // text/plain avoids the CORS preflight that Apps Script can't answer
      const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined, cache: 'no-store' });
      text = await res.text();
    } catch (e) {
      throw netErr(e && e.name === 'AbortError' ? 'Timed out' : 'No connection');
    } finally { clearTimeout(timer); }
    try { return JSON.parse(text); } catch (e) { throw netErr('Server busy'); }
  }

  /* ---------- session ---------- */
  let memCred = null;   // PIN typed in this app session (page only, never stored)
  const setMemCred = (u, p) => { memCred = u && p ? { u: String(u), p: String(p) } : null; };

  async function saveSession(s, quiet) {
    if (s) await kv.set('session', s); else await kv.del('session');
    if (!quiet) emit({ type: 'session', session: s || null });
  }

  /** New token without bothering the user: uses the PIN typed this session or the saved auto sign-in. */
  async function relogin(username) {
    const lc = String(username || '').toLowerCase();
    const rem = await kv.get('remember');
    const cred = memCred && memCred.u.toLowerCase() === lc ? memCred : (rem && String(rem.u).toLowerCase() === lc ? rem : null);
    if (!cred) return null;
    const r = await post({ action: 'login', username: cred.u, pin: cred.p }, TIMEOUT.login);
    if (!r.ok) {
      if (cred === rem) await kv.del('remember');        // PIN changed or user deactivated
      if (cred === memCred) memCred = null;
      return null;
    }
    const s = { token: r.token, user: r.user, expires: r.expires || 0 };
    await saveSession(s);
    return s;
  }

  /** Sends one request with the current session; signs in again once if the token is too old. */
  async function send(session, body, ms) {
    let s = session;
    if (!s.token) { s = await relogin(s.user.username); if (!s) throw authErr(); }
    let res = await post(Object.assign({}, body, { token: s.token }), ms);
    if (res && res.auth) {
      s = await relogin(s.user.username);
      if (!s) throw authErr();
      res = await post(Object.assign({}, body, { token: s.token }), ms);
      if (res && res.auth) throw authErr();
    }
    return { res, session: s };
  }

  /** Read request for the page (getAll / getSheet / getChecklist). */
  async function api(action, data, ms) {
    const s = await kv.get('session');
    if (!s || !s.user) throw authErr();
    return (await send(s, Object.assign({ action }, data || {}), ms)).res;
  }

  /* ---------- sign in on this phone without network ---------- */
  async function hashPin(username, pin, salt) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + String(username).toLowerCase() + '|' + pin));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function rememberAuth(username, pin, user) {
    try {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
      await kv.set('auth:' + String(username).toLowerCase(), { salt, hash: await hashPin(username, pin, salt), user });
    } catch (e) {}
  }
  /** user = PIN matches the last online sign-in on this phone; false = wrong PIN; null = never signed in here. */
  async function offlineAuth(username, pin) {
    try {
      const rec = await kv.get('auth:' + String(username).toLowerCase());
      if (!rec) return null;
      return (await hashPin(username, pin, rec.salt)) === rec.hash ? rec.user : false;
    } catch (e) { return null; }
  }

  /* ---------- upload everything waiting ---------- */
  const state = { busy: false, offline: false, needLogin: false, lastSync: 0, lastError: '' };
  function setState(p) { Object.assign(state, p); emit({ type: 'state', state: Object.assign({}, state) }); }
  const TRANSIENT = /lock|timed? ?out|too many|try again|service|internal|unavailable|busy|quota|rate limit|exceeded/i;

  let running = null;
  function flush() {
    if (!running) running = withLock(flushNow).finally(() => { running = null; });
    return running;
  }
  function withLock(fn) {
    try { if (g.navigator && g.navigator.locks && g.navigator.locks.request) return g.navigator.locks.request('holoul-flush', fn); } catch (e) {}
    return fn();
  }

  async function flushNow() {
    let session = await kv.get('session');
    if (!session || !session.user) return { ok: true, idle: true };
    const me = session.user.username;
    const ops = (await outbox.all()).filter(o => !o.failed && o.username === me);
    if (!ops.length) { setState({ busy: false, offline: false }); return { ok: true }; }
    setState({ busy: true });
    const legacyAt = await kv.get('legacyApi');
    let legacy = !!legacyAt && Date.now() - legacyAt < LEGACY_RECHECK;
    let waiting = 0;
    try {
      let i = 0;
      while (i < ops.length) {
        const op = ops[i];
        if (op.action === 'uploadPhoto') {           // photos: one per request (large)
          const r = await send(session, { action: 'uploadPhoto', type: op.type, unit: op.unit, kind: op.kind, data: op.data, opId: op.id, date: op.date }, TIMEOUT.photo);
          session = r.session;
          await handle(op, r.res);
          i++;
          continue;
        }
        const batch = [];
        while (i < ops.length && ops[i].action !== 'uploadPhoto' && batch.length < BATCH) {
          const p = await prepare(ops[i++]);
          if (p) batch.push(p); else waiting++;
        }
        if (!batch.length) continue;
        if (!legacy) {
          const r = await send(session, { action: 'sync', ops: batch.map(p => p.payload) }, TIMEOUT.sync);
          session = r.session;
          if (r.res && r.res.ok === false && r.res.error === 'Unknown action') {
            legacy = true; await kv.set('legacyApi', Date.now());          // server not updated yet
          } else if (!r.res || !r.res.ok) {
            throw netErr((r.res && r.res.error) || 'Upload failed');
          } else {
            const byId = {};
            (r.res.results || []).forEach(x => { byId[x.id] = x; });
            for (const p of batch) await handle(p.op, byId[p.op.id] || { ok: false, error: 'No answer from server', retry: true });
            continue;
          }
        }
        for (const p of batch) {                     // older server: one request per change
          const body = Object.assign({}, p.payload); delete body.id;
          if (body.action === 'taskUpdate') body.id = body.task;
          const r = await send(session, body, TIMEOUT.read);
          session = r.session;
          await handle(p.op, r.res);
        }
      }
      setState({ busy: false, offline: false, needLogin: false, lastSync: Date.now(), lastError: '' });
      if (!legacy && legacyAt) await kv.del('legacyApi');
      return { ok: true, waiting };
    } catch (e) {
      setState({ busy: false, offline: !!e.net, needLogin: !!e.auth, lastError: e.message || '' });
      return { ok: false, offline: !!e.net, needLogin: !!e.auth, error: e.message || '' };
    }
  }

  /** What gets sent for one change. Daily checks get the Drive links of photos uploaded before them. */
  async function prepare(op) {
    const payload = { id: op.id, action: op.action, date: op.date };
    ['sheet', 'row', 'value', 'type', 'unit', 'task', 'status', 'note', 'photo', 'hours', 'signature', 'signedName', 'at'].forEach(k => { if (op[k] !== undefined) payload[k] = op[k]; });
    if (op.action === 'taskUpdate' && String(op.photo || '').indexOf('local:') === 0) {      // task photo taken on the phone
      const pid = String(op.photo).slice(6), url = await kv.get('photo:' + pid);
      if (url) payload.photo = url;
      else { const pending = await outbox.get(pid); if (pending && !pending.failed) return null; payload.photo = ''; }
    }
    if (op.action === 'submitCheck') {
      const data = JSON.parse(JSON.stringify(op.data || {}));
      const ans = data.answers || {};
      for (const k of Object.keys(ans)) {
        const ph = String(ans[k].photo || '');
        if (ph.indexOf('local:') !== 0) continue;
        const pid = ph.slice(6);
        const url = await kv.get('photo:' + pid);
        if (url) { ans[k].photo = url; continue; }
        const pending = await outbox.get(pid);
        if (pending && !pending.failed) return null;   // photo still waiting: send the check after it
        ans[k].photo = '';
      }
      payload.data = data;
    }
    return { op, payload };
  }

  async function handle(op, res) {
    const info = { id: op.id, action: op.action, sheet: op.sheet, row: op.row, date: op.date, type: op.type, unit: op.unit, kind: op.kind };
    if (res && res.ok) {
      if (op.action === 'uploadPhoto') await kv.set('photo:' + op.id, res.url);
      await outbox.settle(op.id, op.seq, '');
      emit({ type: 'done', op: info, res: { url: res.url, completed: res.completed, status: res.status, at: res.at, by: res.by, column: res.column } });
      return;
    }
    const err = (res && res.error) || 'Upload failed';
    if ((res && res.retry) || TRANSIENT.test(err)) throw netErr(err);   // server busy: try again later
    await outbox.settle(op.id, op.seq, err);
    emit({ type: 'failed', op: info, error: err });
  }

  async function stats(username) {
    const ops = await outbox.all();
    const mine = ops.filter(o => o.username === username);
    return {
      pending: mine.filter(o => !o.failed).length,
      failed: mine.filter(o => o.failed).map(o => ({ id: o.id, action: o.action, sheet: o.sheet, row: o.row, type: o.type, unit: o.unit, kind: o.kind, date: o.date, error: o.failed })),
      state: Object.assign({}, state)
    };
  }

  g.HoloulSync = { API_URL, TIMEOUT, kv, outbox, post, api, flush, on, emit, stats, saveSession, relogin, setMemCred,
                   rememberAuth, offlineAuth, state: () => Object.assign({}, state) };
})(typeof self !== 'undefined' ? self : this);
