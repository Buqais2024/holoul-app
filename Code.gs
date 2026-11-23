/**
 * Holoul Maintenance App — backend (Google Apps Script)
 * Standalone script. Reads users from "Holoul App - Users" and writes
 * readings into the "Instrument Reading" spreadsheet.
 *
 * After changing this code: Deploy > Manage deployments > (pencil) >
 * Version: New version > Deploy.  (Keeps the same Web app URL.)
 *
 * v6 (Nov 2026) — offline-first support:
 *  - "sync": many queued changes from a phone in one request
 *  - "getAll": every page a user can open, in one request (phone keeps a copy)
 *  - readings / checks carry the date they were taken, so data that uploads
 *    late still lands in the right day's column
 *  - safe to resend: Task Log and daily checks update their row, photos are not duplicated
 *  - sign-in lasts 7 days (signed token); inactive users are still blocked within minutes
 *  - every older call from the previous app version still works
 */

const SHEET_ID     = '1ohP2VDJitA_ZxiY3Sk6V22Z6yGHZjvgsBg58pMwac_4';   // Holoul App - Users
const READINGS_ID  = '1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ';   // Instrument Reading
const USERS_SHEET  = 'Users';
const LOG_SHEET    = 'Task Log';
const TZ           = 'Asia/Riyadh';
const SESSION_SECS = 6 * 60 * 60;   // old-style sessions (CacheService) from earlier app versions
const SESSION_DAYS = 7;             // new sign-ins
const MAX_BACK_DAYS = 7;            // oldest date a late upload may write to
const USERS_CACHE_SECS = 300;       // a deactivated user is blocked within 5 minutes

let _book = null, _readings = null;
const book     = () => _book || (_book = SpreadsheetApp.openById(SHEET_ID));
const readings = () => _readings || (_readings = SpreadsheetApp.openById(READINGS_ID));

// Record pages and their layout in "Instrument Reading".
// Row 1 = date, row 2 = username, readings from DATA_ROW down, one column per day.
const RECORD_SHEETS = {
  // A #, B Cable ID, C Description, D Ref value, readings from E
  'Amp Rec':       { layout: 'list',      idCol: 2, descCol: 3, refCol: 4, firstDayCol: 5, dataRow: 3 },
  // A Machine, B Motor/Bearing, C F/B/L/R, D Horizontal/Vertical/Axial, readings from E
  // (row 2 "Checked by" was inserted by setupVibration so row 2 holds the username)
  'Vibration Rec': { layout: 'vibration', firstDayCol: 5, dataRow: 3, keyCols: 4 },
  // A Category, B Subcategory, C Component (Motor, Gearbox, ...). Row 1 date, row 2 checked by, readings from D3.
  // Generic: any rows added/renamed later in A–C show up automatically.
  'Thermo Rec':    { layout: 'grouped',   firstDayCol: 4, dataRow: 3, keyCols: 3 }
};

const MODULES = ['Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Forklift', 'Bobcat'];
const CHECK_TYPES = ['Forklift', 'Bobcat'];

function accessFor(role, equipment) {
  if (role === 'Maintenance Technician') return ['Amp Rec', 'Vibration Rec', 'Thermo Rec'];
  if (role === 'Operator' && (equipment === 'Forklift' || equipment === 'Bobcat')) return [equipment];
  return [];
}

/* ================= API ================= */

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) {}
  let out;
  try {
    switch (body.action) {
      case 'login':        out = login(body.username, body.pin); break;
      case 'getAll':       out = withUser(body, u => getAll(u)); break;
      case 'sync':         out = withUser(body, u => locked(() => syncOps(u, body.ops))); break;
      case 'getSheet':     out = withUser(body, u => getSheet(u, body.sheet, body.date)); break;
      case 'saveReading':  out = withUser(body, u => locked(() => saveReading(u, body.sheet, body.row, body.value, body.date))); break;
      case 'complete':     out = withUser(body, u => locked(() => completeTask(u, body.sheet, body.date))); break;
      case 'getChecklist': out = withUser(body, u => getChecklist(u, body.type, body.unit)); break;
      case 'uploadPhoto':  out = withUser(body, u => uploadPhoto(u, body.type, body.unit, body.kind, body.data, body.opId, body.date)); break;
      case 'submitCheck':  out = withUser(body, u => locked(() => submitCheck(u, body.type, body.unit, body.data, body.date))); break;
      default:             out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'Holoul Maintenance API', version: 6 }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** One writer at a time (all write actions go through here). */
function locked(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}

/* ---------- users + sign-in ---------- */

/** Users sheet as a list. Cached for a few minutes; `fresh` re-reads the sheet. */
function usersTable(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) { const hit = cache.get('users_v1'); if (hit) return JSON.parse(hit); }
  const rows = book().getSheetByName(USERS_SHEET).getDataRange().getDisplayValues();
  const h = rows[0], c = name => h.indexOf(name);
  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i], username = String(r[c('Username')]).trim();
    if (!username) continue;
    list.push({ id: r[c('User ID')], name: r[c('Full Name')], username: username,
                pin: String(r[c('PIN')]).trim(), active: r[c('Active')] === 'Yes',
                role: r[c('Role')], equipment: r[c('Assigned Equipment')] });
  }
  try { cache.put('users_v1', JSON.stringify(list), USERS_CACHE_SECS); } catch (err) {}
  return list;
}

function publicUser(u) {
  return { id: u.id, name: u.name, username: u.username, role: u.role, equipment: u.equipment, access: accessFor(u.role, u.equipment) };
}

/** Active user by username (fresh role / access), or null. */
function findUser(username) {
  username = String(username || '').trim().toLowerCase();
  const u = usersTable().filter(x => x.username.toLowerCase() === username)[0];
  return u && u.active ? publicUser(u) : null;
}

function login(username, pin) {
  username = String(username || '').trim().toLowerCase();
  pin = String(pin || '').trim();
  if (!username || !pin) return { ok: false, error: 'Enter username and PIN' };

  const u = usersTable(true).filter(x => x.username.toLowerCase() === username)[0];
  if (u && u.pin === pin) {
    if (!u.active) return { ok: false, error: 'Account is inactive — contact your supervisor' };
    const t = makeToken(u.username);
    return { ok: true, token: t.token, expires: t.expires, user: publicUser(u) };
  }
  Utilities.sleep(800); // slow down PIN guessing
  return { ok: false, error: 'Wrong username or PIN' };
}

/* Signed token: "v2.<payload>.<signature>". Nothing to store on the server. */
function tokenSecret() {
  const p = props();
  let s = p.getProperty('TOKEN_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('TOKEN_SECRET', s); }
  return s;
}
function signPart(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, tokenSecret())).replace(/=+$/, '');
}
function makeToken(username) {
  const expires = Date.now() + SESSION_DAYS * 864e5;
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({ u: username, exp: expires })).replace(/=+$/, '');
  return { token: 'v2.' + payload + '.' + signPart(payload), expires: expires };
}
function readToken(token) {
  token = String(token || '');
  if (token.indexOf('v2.') === 0) {
    const parts = token.split('.');
    if (parts.length !== 3 || signPart(parts[1]) !== parts[2]) return null;
    let p = null;
    try {
      let b = parts[1]; while (b.length % 4) b += '=';
      p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString());
    } catch (err) { return null; }
    if (!p || !p.u || !(p.exp > Date.now())) return null;
    return findUser(p.u);
  }
  // sessions created by the previous app version
  const raw = token && CacheService.getScriptCache().get('t_' + token);
  return raw ? JSON.parse(raw) : null;
}

function withUser(body, fn) {
  const user = readToken(body.token);
  if (!user) return { ok: false, auth: true, error: 'Session expired — please sign in again' };
  return fn(user);
}

function checkSheet(user, sheetName) {
  if (!RECORD_SHEETS[sheetName]) throw new Error('This page is not set up yet');
  if (user.access.indexOf(sheetName) < 0) throw new Error('You do not have access to ' + sheetName);
  const sh = readings().getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet "' + sheetName + '" not found in Instrument Reading');
  return sh;
}

/* ---------- dates ---------- */

const todayIso = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
/** 'yyyy-MM-dd' -> Date at 12:00 Riyadh time (09:00 UTC), so formatting in TZ gives the same day. */
function isoToDate(iso) { const p = String(iso).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2], 9)); }

/** The working day of a reading. No date (older app) = today. Future = today. Too old = error. */
function workDate(s) {
  const today = todayIso();
  let iso = /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : today;
  if (iso > today) iso = today;                         // phone clock ahead
  const back = Math.round((isoToDate(today) - isoToDate(iso)) / 864e5);
  if (back > MAX_BACK_DAYS) throw new Error('Date ' + iso + ' is more than ' + MAX_BACK_DAYS + ' days old');
  return { iso: iso, date: isoToDate(iso), today: iso === today };
}

function dateKeys(d) {
  return {
    iso: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'),
    texts: ['dMMM', 'ddMMM', 'd MMM', 'dd MMM', 'd-MMM', 'dd-MMM', 'd/M/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd']
      .map(f => Utilities.formatDate(d, TZ, f).replace(/\s/g, '').toLowerCase())
  };
}

function isDay(v, keys) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd') === keys.iso;
  const s = String(v || '').replace(/\s/g, '').toLowerCase();
  return !!s && keys.texts.indexOf(s) >= 0;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** Reads a date header ("26Sep", "26 Sep", "26/9/2026", a real date ...). Headers without a year get the nearest past year. */
function headerDate(v) {
  if (v instanceof Date && !isNaN(v)) return isoToDate(Utilities.formatDate(v, TZ, 'yyyy-MM-dd'));
  const s = String(v || '').trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], 9));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], m[2] - 1, +m[1], 9));
  m = s.match(/^(\d{1,2})[\s\-]*([a-z]{3})/);
  if (m && MONTHS[m[2]] != null) {
    const today = isoToDate(todayIso());
    let d = new Date(Date.UTC(today.getUTCFullYear(), MONTHS[m[2]], +m[1], 9));
    if (d - today > 2 * 864e5) d = new Date(Date.UTC(today.getUTCFullYear() - 1, MONTHS[m[2]], +m[1], 9));
    return d;
  }
  return null;
}

/** Finds the column for day `d` (by the date in row 1). If there is none:
 *  - create = false: returns { isNew: true } (nothing written)
 *  - create = true : uses the first empty column that keeps the days in order
 *    (inserting a column before a later day if needed) and writes the date in row 1. */
function dayColumn(sh, cfg, create, d) {
  d = d || workDate();
  const lastCol = Math.max(sh.getLastColumn(), cfg.firstDayCol);
  const width = lastCol - cfg.firstDayCol + 1;
  const top = sh.getRange(1, cfg.firstDayCol, 1, width).getValues()[0];
  const keys = dateKeys(d.date);

  for (let i = 0; i < width; i++) if (isDay(top[i], keys)) return { col: cfg.firstDayCol + i, isNew: false };
  if (!create) return { col: null, isNew: true };

  // columns of earlier / later days
  let lastEarlier = cfg.firstDayCol - 1, firstLater = 0;
  for (let i = 0; i < width; i++) {
    const hd = headerDate(top[i]);
    if (!hd) continue;
    if (hd < d.date) lastEarlier = cfg.firstDayCol + i;
    else if (hd > d.date && !firstLater) firstLater = cfg.firstDayCol + i;
  }
  // first completely empty column after the earlier days (and before any later day)
  const lastRow = Math.max(sh.getLastRow(), cfg.dataRow);
  const body = sh.getRange(1, cfg.firstDayCol, lastRow, width).getValues();
  let col = 0;
  for (let i = 0; i < width; i++) {
    const c = cfg.firstDayCol + i;
    if (c <= lastEarlier) continue;
    if (firstLater && c >= firstLater) break;
    if (body.every(r => r[i] === '' || r[i] === null)) { col = c; break; }
  }
  if (!col) {
    if (firstLater) { sh.insertColumnBefore(firstLater); col = firstLater; }   // late upload for an earlier day
    else col = lastCol + 1;
  }
  if (col > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), col - sh.getMaxColumns());
  sh.getRange(1, col).setNumberFormat('@').setValue(Utilities.formatDate(d.date, TZ, 'dMMM'));  // e.g. 26Sep, same style as existing headers
  return { col: col, isNew: true };
}

/** Row 2: who filled the column (adds a second name if two people work the same day). */
function markChecker(sh, col, username) {
  const who = sh.getRange(2, col);
  const names = String(who.getValue() || '').split(',').map(s => s.trim()).filter(String);
  if (names.indexOf(username) < 0) { names.push(username); who.setValue(names.join(', ')); }
}

/* ---------- reading pages ---------- */

function getSheet(user, sheetName, date) {
  const sh = checkSheet(user, sheetName);
  const cfg = RECORD_SHEETS[sheetName];
  const d = workDate(date);
  const day = dayColumn(sh, cfg, false, d);
  const lastRow = sh.getLastRow();
  const n = lastRow - cfg.dataRow + 1;
  const base = {
    ok: true, sheet: sheetName, layout: cfg.layout, iso: d.iso,
    refHeader: cfg.refCol ? (sh.getRange(1, cfg.refCol).getDisplayValue() || 'Ref Value') : '',
    date: Utilities.formatDate(d.date, TZ, 'EEE d MMM yyyy'),
    column: day.isNew ? null : columnLetter(day.col),
    completed: completedOn(sheetName, d.iso)
  };
  if (n < 1) { base.rows = []; return base; }

  const vals = day.isNew ? [] : sh.getRange(cfg.dataRow, day.col, n, 1).getDisplayValues();
  const valueAt = i => vals[i] ? String(vals[i][0]).trim() : '';
  base.rows = cfg.layout === 'vibration' ? vibrationRows(sh, cfg, n, valueAt)
            : cfg.layout === 'grouped'   ? groupedRows(sh, cfg, n, valueAt)
            : listRows(sh, cfg, n, valueAt);
  return base;
}

/** Amp Rec style: one reading per row, section header rows in between. */
function listRows(sh, cfg, n, valueAt) {
  const left = sh.getRange(cfg.dataRow, 1, n, cfg.refCol).getDisplayValues();
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = left[i];
    const id = String(r[cfg.idCol - 1]).trim(), desc = String(r[cfg.descCol - 1]).trim();
    const first = String(r[0]).trim();
    if (!id && !desc) {                       // section header row, e.g. "S1000, Flipflop ..."
      if (first) rows.push({ section: first });
      continue;
    }
    rows.push({ row: cfg.dataRow + i, id: id, desc: desc, ref: String(r[cfg.refCol - 1]).trim(), value: valueAt(i) });
  }
  return rows;
}

/** Vibration style: A machine, B Motor/Bearing, C position, D direction.
 *  Merged cells only hold the value in their first row, so A–C are filled down. */
function vibrationRows(sh, cfg, n, valueAt) {
  const left = sh.getRange(cfg.dataRow, 1, n, cfg.keyCols).getDisplayValues();
  const POS = { F: 'Front', B: 'Back', L: 'Left', R: 'Right' };
  let machine = '', part = '', pos = '';
  const rows = [];
  for (let i = 0; i < n; i++) {
    const a = String(left[i][0]).trim(), b = String(left[i][1]).trim(), c = String(left[i][2]).trim(), d = String(left[i][3]).trim();
    if (a) { machine = a; part = ''; pos = ''; }
    if (b) { part = b; pos = ''; }
    if (c) pos = c;
    if (!d) continue;                         // blank line
    const dir = d.charAt(0).toUpperCase();    // H / V / A
    rows.push({
      row: cfg.dataRow + i, machine: machine, part: part,
      pos: pos.toUpperCase(), posName: POS[pos.toUpperCase()] || pos, dir: dir, dirName: d,
      value: valueAt(i)
    });
  }
  return rows;
}

/** Generic grouped layout (Thermo Rec): A category, B subcategory, C component.
 *  A and B are filled down (merged cells). A row with B but no C is a single reading. */
function groupedRows(sh, cfg, n, valueAt) {
  const left = sh.getRange(cfg.dataRow, 1, n, cfg.keyCols).getDisplayValues();
  let group = '', item = '';
  const rows = [];
  for (let i = 0; i < n; i++) {
    const a = String(left[i][0]).trim(), b = String(left[i][1]).trim(), c = String(left[i][2]).trim();
    if (a) { group = a; item = ''; }
    if (b) item = b;
    if (!b && !c) continue;                   // blank line
    if (!item) continue;                      // point without equipment name
    rows.push({ row: cfg.dataRow + i, group: group || 'Equipment', item: item, point: c || 'Reading', value: valueAt(i) });
  }
  return rows;
}

/** Writes one reading into the column of its day. `memo` skips repeat lookups inside one sync. */
function saveReading(user, sheetName, row, value, date, memo) {
  const sh = checkSheet(user, sheetName);
  const cfg = RECORD_SHEETS[sheetName];
  row = Number(row);
  if (!(row >= cfg.dataRow && row <= sh.getLastRow())) throw new Error('Invalid row');
  const d = workDate(date);
  const key = sheetName + '|' + d.iso;
  let col = memo && memo[key];
  if (!col) {
    col = dayColumn(sh, cfg, true, d).col;
    markChecker(sh, col, user.username);
    if (memo) memo[key] = col;
  }
  const v = String(value == null ? '' : value).trim();
  const num = Number(v.replace(',', '.'));
  sh.getRange(row, col).setValue(v === '' ? '' : (isNaN(num) ? v : num));
  return { ok: true, row: row, value: v, column: columnLetter(col), date: d.iso };
}

function taskLog() {
  const ss = readings();
  return ss.getSheetByName(LOG_SHEET) || (function () {
    const s = ss.insertSheet(LOG_SHEET);
    s.appendRow(['Timestamp', 'Date', 'Sheet', 'User ID', 'Username', 'Full Name', 'Filled', 'Total', 'Column']);
    s.getRange('A1:I1').setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    s.setFrozenRows(1);
    return s;
  })();
}

/** "Complete task" for a day. Sending it again updates the same Task Log row. */
function completeTask(user, sheetName, date) {
  const d = workDate(date);
  SpreadsheetApp.flush();
  const data = getSheet(user, sheetName, d.iso);
  const items = data.rows.filter(r => !r.section);
  const filled = items.filter(r => r.value !== '').length;

  const log = taskLog();
  const now = new Date();
  const row = [Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm'), d.iso, sheetName, user.id, user.username,
               user.name, filled, items.length, data.column || ''];
  let target = 0;
  if (log.getLastRow() > 1) {
    const rows = log.getRange(2, 1, log.getLastRow() - 1, 5).getDisplayValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][1] === d.iso && rows[i][2] === sheetName && rows[i][4] === user.username) { target = i + 2; break; }
    }
  }
  if (!target) target = log.getLastRow() + 1;
  log.getRange(target, 1, 1, row.length).setValues([row]);
  log.getRange(target, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  return { ok: true, filled: filled, total: items.length, date: d.iso, completed: completedOn(sheetName, d.iso) };
}

function completedOn(sheetName, iso) {
  const log = readings().getSheetByName(LOG_SHEET);
  if (!log || log.getLastRow() < 2) return null;
  const rows = log.getRange(2, 1, log.getLastRow() - 1, 9).getDisplayValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][1] === iso && rows[i][2] === sheetName)
      return { by: rows[i][5] || rows[i][4], at: rows[i][0].slice(11, 16), filled: rows[i][6], total: rows[i][7] };
  }
  return null;
}

/* ---------- one request for everything a user can open ---------- */

function getAll(user) {
  const pages = {};
  user.access.forEach(name => {
    try {
      if (RECORD_SHEETS[name]) pages[name] = getSheet(user, name);
      else if (CHECK_TYPES.indexOf(name) >= 0) {
        const first = getChecklist(user, name);
        const units = {};
        units[first.unit] = first;
        first.units.forEach(u => { if (!units[u]) units[u] = getChecklist(user, name, u); });
        pages[name] = { ok: true, checklist: true, defaultUnit: first.unit, units: units };
      }
    } catch (err) {
      pages[name] = { ok: false, error: String(err.message || err) };
    }
  });
  return { ok: true, today: todayIso(), user: user, pages: pages };
}

/* ---------- many queued changes in one request ---------- */

/** ops: [{ id, action: 'saveReading'|'complete'|'submitCheck', ...fields, date }]
 *  Each op gets its own result, so one bad op does not block the others. */
function syncOps(user, ops) {
  if (!Array.isArray(ops)) throw new Error('No changes sent');
  const memo = {}, results = [];
  ops.slice(0, 200).forEach(op => {
    let r;
    try {
      switch (op && op.action) {
        case 'saveReading': r = saveReading(user, op.sheet, op.row, op.value, op.date, memo); break;
        case 'complete':    r = completeTask(user, op.sheet, op.date); break;
        case 'submitCheck': r = submitCheck(user, op.type, op.unit, op.data, op.date); break;
        default:            r = { ok: false, error: 'Unknown change ' + (op && op.action) };
      }
    } catch (err) {
      r = { ok: false, error: String(err.message || err) };
    }
    r.id = op && op.id;
    results.push(r);
  });
  return { ok: true, results: results };
}

/* ================= Daily equipment checks (Bobcat, later Forklift) =================
 * Everything lives in Drive folder "Maintenance Data Storage":
 *   - spreadsheet "Equipment Daily Checks" with tabs
 *       Units              : Type | Unit No | Active          (e.g. Bobcat | BC1 | Yes)
 *       <Type> Checklist   : Section | Item | Input | Frequency | Photo | Active
 *                            Input = Check (tick OK / Fault) or Reading (number)
 *                            Frequency = Daily or Weekly, Photo = Required / Optional / No
 *       <Type> Log         : one row per unit per day (re-submitting the same day updates it)
 *   - folder "Photos/<Type>" with every photo the operators take
 * Edit the Checklist tab to add / rename / remove items — the app follows it. */

const props = () => PropertiesService.getScriptProperties();

let _checks = null;
function checksBook() {
  if (_checks) return _checks;
  const id = props().getProperty('CHECKS_SS_ID');
  if (!id) throw new Error('Daily checks are not set up yet');
  return (_checks = SpreadsheetApp.openById(id));
}

function checkAccess(user, type) {
  if (user.access.indexOf(type) < 0) throw new Error('You do not have access to ' + type);
}

function readChecklist(ss, type) {
  const sh = ss.getSheetByName(type + ' Checklist');
  if (!sh) throw new Error('No checklist for ' + type);
  const v = sh.getDataRange().getDisplayValues().slice(1);
  let section = '';
  const items = [];
  v.forEach(r => {
    const [sec, item, input, freq, photo, active] = r.map(x => String(x).trim());
    if (sec) section = sec;
    if (!item || /^no$/i.test(active)) return;
    items.push({
      section: section, item: item,
      input: /^read/i.test(input) ? 'reading' : 'check',
      weekly: /^week/i.test(freq),
      photo: /^req/i.test(photo) ? 'required' : /^opt/i.test(photo) ? 'optional' : 'no'
    });
  });
  return items;
}

function readUnits(ss, type) {
  const sh = ss.getSheetByName('Units');
  return sh.getDataRange().getDisplayValues().slice(1)
    .filter(r => String(r[0]).trim().toLowerCase() === type.toLowerCase() && !/^no$/i.test(String(r[2]).trim()) && String(r[1]).trim())
    .map(r => String(r[1]).trim());
}

function logSheet(ss, type) {
  return ss.getSheetByName(type + ' Log') || (function () {
    const s = ss.insertSheet(type + ' Log');
    s.appendRow(LOG_BASE);
    s.getRange(1, 1, 1, LOG_BASE.length).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    s.setFrozenRows(1);
    return s;
  })();
}
const LOG_BASE = ['Timestamp', 'Date', 'Unit', 'User ID', 'Username', 'Operator', 'Status', 'Faults'];

function getChecklist(user, type, unit) {
  checkAccess(user, type);
  const ss = checksBook();
  const items = readChecklist(ss, type);
  const units = readUnits(ss, type);
  if (!units.length) throw new Error('No ' + type + ' units listed in the Units tab');
  unit = units.indexOf(unit) >= 0 ? unit : units[0];

  const log = logSheet(ss, type);
  const data = log.getDataRange().getDisplayValues();
  const h = data[0], col = name => h.indexOf(name);
  const today = todayIso();

  let todayEntry = null;
  const last = {}, weeklyLast = {};
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (r[col('Unit')] !== unit) continue;
    const date = r[col('Date')];
    if (date === today) {
      todayEntry = { at: String(r[col('Timestamp')]).slice(11, 16), by: r[col('Operator')], status: r[col('Status')], values: {} };
      items.forEach(it => {
        const c = col(it.item); if (c >= 0) todayEntry.values[it.item] = r[c];
        const p = col(it.item + ' Photo'); if (p >= 0 && r[p]) todayEntry.values[it.item + ' Photo'] = r[p];
      });
      todayEntry.faults = r[col('Faults')];
      continue;
    }
    items.forEach(it => {
      const c = col(it.item); if (c < 0) return;
      const val = String(r[c]).trim();
      if (it.input === 'reading' && val !== '') last[it.item] = { value: val, date: date, by: r[col('Operator')] };
      if (it.weekly && val === '✓') weeklyLast[it.item] = date;
    });
  }
  return {
    ok: true, type: type, unit: unit, units: units, items: items,
    date: Utilities.formatDate(new Date(), TZ, 'EEE d MMM yyyy'), today: today,
    todayEntry: todayEntry, last: last, weeklyLast: weeklyLast
  };
}

/** Saves one photo to Drive. With an opId (new app) the same photo sent twice is stored once. */
function uploadPhoto(user, type, unit, kind, dataUrl, opId, date) {
  checkAccess(user, type);
  const m = String(dataUrl || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw new Error('Not an image');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Photo is too large');
  const safe = s => String(s || '').replace(/[^\w.-]+/g, '-').slice(0, 40);
  const root = DriveApp.getFolderById(props().getProperty('PHOTOS_FOLDER_ID'));
  const it = root.getFoldersByName(type);
  const folder = it.hasNext() ? it.next() : root.createFolder(type);
  let name;
  if (opId) {
    name = [safe(unit), workDate(date).iso, safe(kind), safe(user.username), safe(opId)].join('_') + '.jpg';
    const same = folder.getFilesByName(name);
    if (same.hasNext()) { const f = same.next(); return { ok: true, id: f.getId(), url: f.getUrl(), name: name, existed: true }; }
  } else {
    name = [safe(unit), Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HHmmss'), safe(kind), safe(user.username)].join('_') + '.jpg';
  }
  const file = folder.createFile(Utilities.newBlob(bytes, m[1], name));
  return { ok: true, id: file.getId(), url: file.getUrl(), name: name };
}

/** Daily check for one unit on one day. Sending the same day again updates that row. */
function submitCheck(user, type, unit, data, date) {
  checkAccess(user, type);
  const d = workDate(date);
  const ss = checksBook();
  const items = readChecklist(ss, type);
  const units = readUnits(ss, type);
  if (units.indexOf(unit) < 0) throw new Error('Unknown unit ' + unit);
  data = data || {};
  const ans = data.answers || {};

  // validate on the server too
  const missing = [];
  items.forEach(it => {
    const a = ans[it.item] || {};
    if (it.input === 'reading') {
      if (String(a.value || '').trim() === '') missing.push(it.item);
      if (it.photo === 'required' && !a.photo) missing.push(it.item + ' photo');
    } else if (!it.weekly && !a.v) missing.push(it.item);
    if (a.v === 'fault' && !String(a.note || '').trim()) missing.push(it.item + ' (describe the fault)');
  });
  if (missing.length) return { ok: false, error: 'Please complete: ' + missing.join(', ') };

  const log = logSheet(ss, type);
  // make sure every checklist item has a column (items added later get new columns at the end)
  let header = log.getRange(1, 1, 1, Math.max(log.getLastColumn(), 1)).getValues()[0].map(String);
  const want = LOG_BASE.slice();
  items.forEach(it => { want.push(it.item); if (it.input === 'reading' && it.photo !== 'no') want.push(it.item + ' Photo'); });
  want.forEach(name => { if (header.indexOf(name) < 0) { header.push(name); log.getRange(1, header.length).setValue(name).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff'); } });

  const now = new Date();
  const faults = [];
  const row = new Array(header.length).fill('');
  const set = (name, val) => { const c = header.indexOf(name); if (c >= 0) row[c] = val; };
  items.forEach(it => {
    const a = ans[it.item] || {};
    if (it.input === 'reading') {
      const n = Number(String(a.value).replace(',', '.'));
      set(it.item, isNaN(n) ? a.value : n);
      if (a.photo) set(it.item + ' Photo', a.photo);
    } else {
      set(it.item, a.v === 'ok' ? '✓' : a.v === 'fault' ? '✗' : '');
      if (a.v === 'fault') faults.push(it.item + ': ' + String(a.note).trim() + (a.photo ? ' (photo: ' + a.photo + ')' : ''));
    }
  });
  set('Timestamp', Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm'));
  set('Date', d.iso); set('Unit', unit); set('User ID', user.id); set('Username', user.username); set('Operator', user.name);
  set('Status', faults.length ? 'Action required (' + faults.length + ')' : 'OK');
  set('Faults', faults.join('\n'));

  // one row per unit per day: update that day's row if it exists
  const data2 = log.getDataRange().getDisplayValues();
  const cD = header.indexOf('Date'), cU = header.indexOf('Unit');
  let target = 0;
  for (let i = data2.length - 1; i >= 1; i--) if (data2[i][cD] === d.iso && data2[i][cU] === unit) { target = i + 1; break; }
  if (!target) target = log.getLastRow() + 1;
  const rng = log.getRange(target, 1, 1, header.length);
  rng.setNumberFormat('@').setValues([row.map(String)]);
  log.getRange(target, 1, 1, header.length).setBackground(faults.length ? '#fdecea' : null);
  return { ok: true, status: faults.length ? 'Action required (' + faults.length + ')' : 'OK', faults: faults.length,
           at: Utilities.formatDate(now, TZ, 'HH:mm'), by: user.name, date: d.iso };
}

function columnLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/* ================= One-time: Vibration Rec username row ================= */

/** Inserts a "Checked by" row under the dates (row 2) so it matches Amp Rec:
 *  row 1 = date, row 2 = username. Safe to run twice — it only inserts once. */
function setupVibration() {
  const sh = readings().getSheetByName('Vibration Rec');
  if (String(sh.getRange('D2').getDisplayValue()).trim() === 'Checked by') { Logger.log('Already set up'); return; }
  sh.insertRowBefore(2);
  sh.getRange('A2:D2').setValues([['', '', '', 'Checked by']]);
  sh.getRange('A2:' + columnLetter(sh.getMaxColumns()) + '2')
    .setBackground('#fff7e6').setFontStyle('italic').setFontColor('#7c5a10');
  sh.getRange('D2').setFontWeight('bold').setHorizontalAlignment('right');
  Logger.log('Inserted "Checked by" row 2. Readings now start at row 3.');
}

/* ================= One-time: Thermo Rec header rows ================= */

/** Makes Thermo Rec match the others: row 1 = labels + dates, row 2 = "Checked by",
 *  data from row 3, readings from column D. Safe to run twice. */
function setupThermo() {
  const sh = readings().getSheetByName('Thermo Rec');
  if (String(sh.getRange('C2').getDisplayValue()).trim() === 'Checked by') { Logger.log('Already set up'); return; }
  const top = sh.getRange(1, 1, 3, 3).getDisplayValues();
  const firstData = top.findIndex(r => r.some(v => String(v).trim() !== '')) + 1;   // 1-based, 0 = none in first 3
  if (firstData === 1) sh.insertRowsBefore(1, 2);
  else if (firstData === 2) sh.insertRowBefore(2);
  // firstData 3 (or later): rows 1–2 already free
  sh.getRange('A1:C1').setValues([['Category', 'Subcategory', 'Component']]).setFontWeight('bold');
  sh.getRange('C2').setValue('Checked by').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('A2:' + columnLetter(Math.max(sh.getMaxColumns(), 4)) + '2')
    .setBackground('#fff7e6').setFontStyle('italic').setFontColor('#7c5a10');
  Logger.log('Thermo Rec ready: dates in row 1 from column D, "Checked by" in row 2, data from row 3.');
}

/* ================= One-time: daily checks storage ================= */

/** Creates Drive folder "Maintenance Data Storage" (with a Photos folder) and the
 *  "Equipment Daily Checks" spreadsheet, pre-filled from form MS-FOR-08-03 (Bob Cat).
 *  Safe to run twice — it reuses what already exists. */
function setupDailyChecks() {
  const p = props();
  const findOrMake = (parent, name) => { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); };
  const root = findOrMake(DriveApp.getRootFolder(), 'Maintenance Data Storage');
  const photos = findOrMake(root, 'Photos');
  findOrMake(photos, 'Bobcat');
  p.setProperty('STORAGE_FOLDER_ID', root.getId());
  p.setProperty('PHOTOS_FOLDER_ID', photos.getId());

  let ss;
  try { ss = SpreadsheetApp.openById(p.getProperty('CHECKS_SS_ID')); } catch (e) { ss = null; }
  if (!ss) {
    ss = SpreadsheetApp.create('Equipment Daily Checks');
    DriveApp.getFileById(ss.getId()).moveTo(root);
    p.setProperty('CHECKS_SS_ID', ss.getId());
  }
  const head = (sh, n) => sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  const list = v => SpreadsheetApp.newDataValidation().requireValueInList(v, true).build();

  let units = ss.getSheetByName('Units');
  if (!units) {
    units = ss.getSheets()[0].getName() === 'Sheet1' ? ss.getSheets()[0].setName('Units') : ss.insertSheet('Units');
    units.getRange(1, 1, 2, 3).setValues([['Type', 'Unit No', 'Active'], ['Bobcat', 'BC1', 'Yes']]);
    head(units, 3); units.setFrozenRows(1);
    units.getRange('A2:A200').setDataValidation(list(['Bobcat', 'Forklift']));
    units.getRange('C2:C200').setDataValidation(list(['Yes', 'No']));
  }

  if (!ss.getSheetByName('Bobcat Checklist')) {
    const sh = ss.insertSheet('Bobcat Checklist');
    const rows = [['Section', 'Item', 'Input', 'Frequency', 'Photo', 'Active']];
    const add = (sec, items, extra) => items.forEach((it, i) => rows.push([i ? '' : sec, it, 'Check', 'Daily', 'Optional', 'Yes'].map((v, k) => extra && extra[k] !== undefined ? extra[k] : v)));
    rows.push(['Daily Checks', 'Hour Meter Reading', 'Reading', 'Daily', 'Required', 'Yes']);
    add('', ['Tyre Conditions', 'Engine Oil Seals', 'Transmission hydraulic leaks', 'Clean filters', 'Loose bolts', 'Cabin Cleanliness', 'Grease as required']);
    add('Operational Checks', ['Seat belt functional', 'System Gauges', 'Lights', 'Horn / reverse alarm', 'Braking system', 'Water levels']);
    add('Lubrication', ['Grease Points', 'Gear box oil', 'Battery terminals (greased / secured)', 'Hydraulic Oil']);
    add('Weekly Checks', ['Clean Belly Guards', 'Wash Down Bobcat'], { 3: 'Weekly' });
    sh.getRange(1, 1, rows.length, 6).setValues(rows);
    head(sh, 6); sh.setFrozenRows(1);
    sh.getRange('C2:C300').setDataValidation(list(['Check', 'Reading']));
    sh.getRange('D2:D300').setDataValidation(list(['Daily', 'Weekly']));
    sh.getRange('E2:E300').setDataValidation(list(['Required', 'Optional', 'No']));
    sh.getRange('F2:F300').setDataValidation(list(['Yes', 'No']));
    sh.getRange('A2:A300').setFontWeight('bold');
    [150, 260, 90, 90, 90, 70].forEach((w, i) => sh.setColumnWidth(i + 1, w));
    sh.getRange(1, 8).setValue('Form MS-FOR-08-03 (Bob Cat daily/weekly check). Check = tick OK or Fault; Reading = number. Add rows to add items; set Active = No to hide one.').setFontStyle('italic').setFontColor('#6b7280');
  }
  logSheet(ss, 'Bobcat');
  Logger.log('Folder: %s', root.getUrl());
  Logger.log('Sheet:  %s', ss.getUrl());
}

/* ================= One-time sheet setup (Users) ================= */

function setupSheet() {
  const ss = book();
  let sh = ss.getSheetByName(USERS_SHEET) || ss.getSheets()[0];
  sh.setName(USERS_SHEET);

  const last = 500;
  sh.getRange('A1:L1').setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2937')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.getRange('H1:L1').setBackground('#374151');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  sh.getRange('F2:F' + last).setNumberFormat('@');

  const list = v => SpreadsheetApp.newDataValidation().requireValueInList(v, true).setAllowInvalid(false).build();
  sh.getRange('C2:C' + last).setDataValidation(list(['Maintenance Technician', 'Operator']));
  sh.getRange('D2:D' + last).setDataValidation(list(['Forklift', 'Bobcat']));
  sh.getRange('G2:G' + last).setDataValidation(list(['Yes', 'No']));

  sh.getRange('H2:L' + last).clearContent();
  const tech = '(G2:G="Yes")*(C2:C="Maintenance Technician")';
  const op = eq => '(G2:G="Yes")*(C2:C="Operator")*(D2:D="' + eq + '")';
  const f = cond => '=ARRAYFORMULA(IF(B2:B="","",IF(' + cond + ',"Yes","No")))';
  sh.getRange('H2').setFormula(f(tech));
  sh.getRange('I2').setFormula(f(tech));
  sh.getRange('J2').setFormula(f(tech));
  sh.getRange('K2').setFormula(f(op('Forklift')));
  sh.getRange('L2').setFormula(f(op('Bobcat')));

  const acc = sh.getRange('H2:L' + last);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Yes')
      .setBackground('#d1fae5').setFontColor('#065f46').setBold(true).setRanges([acc]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('No')
      .setBackground('#f3f4f6').setFontColor('#9ca3af').setRanges([acc]).build()
  ]);
  sh.getRange('A1:L' + last).setFontFamily('Arial');
  [70, 180, 170, 140, 110, 60, 60, 80, 95, 85, 80, 80].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('A2:A' + last).setHorizontalAlignment('center');
  sh.getRange('C2:L' + last).setHorizontalAlignment('center');

  let am = ss.getSheetByName('Access Matrix') || ss.insertSheet('Access Matrix');
  am.clear();
  am.getRange(1, 1, 4, 7).setValues([
    ['Role', 'Assigned Equipment', 'Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Forklift', 'Bobcat'],
    ['Maintenance Technician', '(leave blank)', 'Yes', 'Yes', 'Yes', 'No', 'No'],
    ['Operator', 'Forklift', 'No', 'No', 'No', 'Yes', 'No'],
    ['Operator', 'Bobcat', 'No', 'No', 'No', 'No', 'Yes']
  ]);
  am.getRange('A1:G1').setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2937');
  am.getRange('A1:G4').setFontFamily('Arial').setHorizontalAlignment('center');
  am.setColumnWidth(1, 180); am.setColumnWidth(2, 150);
  am.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Yes')
      .setBackground('#d1fae5').setFontColor('#065f46').setBold(true).setRanges([am.getRange('C2:G4')]).build()
  ]);
  Logger.log('Users sheet is ready.');
}
