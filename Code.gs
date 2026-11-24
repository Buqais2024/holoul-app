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
 *
 * v7 (Nov 2026) — tasks + notifications + dashboard:
 *  - roles Supervisor / Operations Manager: dashboard, assign tasks to technicians
 *  - technicians Start / Done tasks (note + photo), also offline through "sync"
 *  - phone notifications (Web Push) when a task is assigned / done
 *  - run setupV7() once after updating (creates the Tasks sheet, asks for permission to send notifications)
 *
 * v8 (Nov 2026) — equipment list:
 *  - reads "Equipments and system in Holoul factory" (first tab) so supervisors pick the exact
 *    equipment when assigning a task; edit that sheet and the app follows (within 10 minutes)
 *  - tasks keep Equipment No, Line and Location
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
const EQUIPMENT_ID = '1sI07XLIaK3yQ2f199dVGX0IvQuRdzMG7L6WYOnXC9k8';   // Equipments and system in Holoul factory (Script Property EQUIPMENT_SS_ID overrides)
const EQUIPMENT_CACHE_SECS = 600;

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
  if (role === 'Supervisor' || role === 'Operations Manager') return ['Dashboard', 'Tasks', 'Amp Rec', 'Vibration Rec', 'Thermo Rec'];
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
      case 'myTasks':      out = withUser(body, u => ({ ok: true, tasks: myTasks(u) })); break;
      case 'taskCreate':   out = withUser(body, u => locked(() => taskCreate(u, body.task))); break;
      case 'taskEdit':     out = withUser(body, u => locked(() => taskEdit(u, body.task))); break;
      case 'taskUpdate':   out = withUser(body, u => locked(() => taskUpdate(u, body))); break;
      case 'dashboard':    out = withUser(body, u => dashboard(u)); break;
      case 'equipment':    out = withUser(body, u => { if (!isManager(u)) throw new Error('Dashboard is for supervisors'); return { ok: true, equipment: equipmentList(!!body.fresh) }; }); break;
      case 'pushSubscribe':   out = withUser(body, u => locked(() => pushSubscribe(u, body.sub, body.device))); break;
      case 'pushUnsubscribe': out = withUser(body, u => locked(() => pushUnsubscribe(u, body.endpoint))); break;
      case 'pushInbox':    out = withUser(body, u => pushInbox(u)); break;
      case 'pushTest':     out = withUser(body, u => locked(() => Object.assign({ ok: true }, notifyUser(u.username, { kind: 'test' })))); break;
      default:             out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'Holoul Maintenance API', version: 8 }))
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
  return { id: u.id, name: u.name, username: u.username, role: u.role, equipment: u.equipment, access: accessFor(u.role, u.equipment),
           manager: MANAGER_ROLES.indexOf(u.role) >= 0 };
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
    checkedBy: day.isNew ? '' : sh.getRange(2, day.col).getDisplayValue(),
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
  let tasks = [], pushKey = '';
  try { tasks = myTasks(user); } catch (err) {}
  try { pushKey = vapidKeys().pub; } catch (err) {}
  return { ok: true, today: todayIso(), user: user, pages: pages, tasks: tasks, pushKey: pushKey };
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
        case 'taskUpdate':  r = taskUpdate(user, Object.assign({}, op, { id: op.task })); break;   // op.id is the change id
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
  if (type !== 'Tasks') checkAccess(user, type);
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
  sh.getRange('C2:C' + last).setDataValidation(list(['Maintenance Technician', 'Operator', 'Supervisor', 'Operations Manager']));
  sh.getRange('D2:D' + last).setDataValidation(list(['Forklift', 'Bobcat']));
  sh.getRange('G2:G' + last).setDataValidation(list(['Yes', 'No']));

  sh.getRange('H2:L' + last).clearContent();
  const tech = '(G2:G="Yes")*((C2:C="Maintenance Technician")+(C2:C="Supervisor")+(C2:C="Operations Manager"))';
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
  am.getRange(1, 1, 6, 8).setValues([
    ['Role', 'Assigned Equipment', 'Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Forklift', 'Bobcat', 'Dashboard + assign tasks'],
    ['Maintenance Technician', '(leave blank)', 'Yes', 'Yes', 'Yes', 'No', 'No', 'No'],
    ['Operator', 'Forklift', 'No', 'No', 'No', 'Yes', 'No', 'No'],
    ['Operator', 'Bobcat', 'No', 'No', 'No', 'No', 'Yes', 'No'],
    ['Supervisor', '(leave blank)', 'Yes', 'Yes', 'Yes', 'No', 'No', 'Yes'],
    ['Operations Manager', '(leave blank)', 'Yes', 'Yes', 'Yes', 'No', 'No', 'Yes']
  ]);
  am.getRange('A1:H1').setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2937');
  am.getRange('A1:H6').setFontFamily('Arial').setHorizontalAlignment('center');
  am.setColumnWidth(1, 180); am.setColumnWidth(2, 150);
  am.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Yes')
      .setBackground('#d1fae5').setFontColor('#065f46').setBold(true).setRanges([am.getRange('C2:H6')]).build()
  ]);
  Logger.log('Users sheet is ready.');
}

/* ================= Tasks (work orders) =================
 * Spreadsheet "Maintenance Tasks" in Drive folder "Maintenance Data Storage":
 *   Tasks         : one row per task (supervisors create, technicians start / finish)
 *   Task History  : every change (who, when, what) — used for the monthly summary
 *   Push Devices  : phones that receive notifications (one row per phone / browser)
 * Created by setupV7() (or automatically the first time it is needed). */

const TASK_COLS = ['ID', 'Created', 'Created By', 'Creator Name', 'Assigned To', 'Assignee Name', 'Title', 'Details',
                   'Equipment', 'Priority', 'Due', 'Link', 'Status', 'Started', 'Done', 'Done Note', 'Done Photo', 'Updated', 'Updated By',
                   'Equipment No', 'Line', 'Location'];
const HISTORY_COLS = ['Timestamp', 'Task ID', 'Action', 'By', 'Note'];
const PUSH_COLS = ['Username', 'Endpoint', 'P256dh', 'Auth', 'Device', 'Added', 'Last OK', 'Last Error'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const TASK_LINKS = ['', 'Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Bobcat', 'Forklift'];
const MANAGER_ROLES = ['Supervisor', 'Operations Manager'];
const ASSIGNABLE_ROLES = ['Maintenance Technician', 'Operator'];

const isManager = u => !!u && MANAGER_ROLES.indexOf(u.role) >= 0;
const nowText = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
const lc = s => String(s || '').trim().toLowerCase();

let _tasks = null;
function tasksBook() {
  if (_tasks) return _tasks;
  const p = props();
  let id = p.getProperty('TASKS_SS_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Maintenance Tasks');
    try {
      const folderId = p.getProperty('STORAGE_FOLDER_ID');
      if (folderId) DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(folderId));
    } catch (err) {}
    p.setProperty('TASKS_SS_ID', ss.getId());
  }
  const tab = (name, cols, first) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = first && ss.getSheets()[0].getName() === 'Sheet1' ? ss.getSheets()[0].setName(name) : ss.insertSheet(name);
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), cols.length).setNumberFormat('@');   // keep dates as typed text
    } else {
      // columns added in a later version: write the missing headers at the end
      const have = sh.getRange(1, 1, 1, cols.length).getValues()[0];
      cols.forEach((c, i) => {
        if (String(have[i] || '').trim() === '') {
          sh.getRange(1, i + 1).setValue(c).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
          sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
        }
      });
    }
    return sh;
  };
  tab('Tasks', TASK_COLS, true); tab('Task History', HISTORY_COLS); tab('Push Devices', PUSH_COLS);
  return (_tasks = ss);
}

/** All rows of a tab as objects (+ _row = sheet row number). */
function rowsOf(sh, cols) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, cols.length).getDisplayValues().map((r, i) => {
    const o = { _row: i + 2 };
    cols.forEach((c, j) => { o[c] = r[j]; });
    return o;
  });
}
const readTasks = () => rowsOf(tasksBook().getSheetByName('Tasks'), TASK_COLS);

function taskOut(t) {
  return { id: t['ID'], created: t['Created'], createdBy: t['Created By'], creatorName: t['Creator Name'],
           assignee: t['Assigned To'], assigneeName: t['Assignee Name'], title: t['Title'], details: t['Details'],
           equipment: t['Equipment'], priority: t['Priority'] || 'Normal', due: t['Due'], link: t['Link'], status: t['Status'] || 'Open',
           started: t['Started'], done: t['Done'], doneNote: t['Done Note'], donePhoto: t['Done Photo'], updated: t['Updated'],
           equipmentNo: t['Equipment No'] || '', line: t['Line'] || '', location: t['Location'] || '' };
}
function writeTask(t) {
  const sh = tasksBook().getSheetByName('Tasks');
  const row = TASK_COLS.map(c => t[c] == null ? '' : String(t[c]));
  const r = t._row || sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  t._row = r;
}
function history(id, action, user, note) {
  tasksBook().getSheetByName('Task History').appendRow([nowText(), id, action, user.username, note || '']);
}
function assignable() {
  return usersTable().filter(u => u.active && ASSIGNABLE_ROLES.indexOf(u.role) >= 0)
    .map(u => ({ username: u.username, name: u.name, role: u.role, id: u.id }));
}
function findTask(id) {
  const t = readTasks().filter(x => x['ID'] === String(id || ''))[0];
  if (!t) throw new Error('Task not found');
  return t;
}
const PRIORITY_RANK = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
function sortTasks(list) {
  const st = { 'In progress': 0, 'Open': 1, 'Done': 2, 'Cancelled': 3 };
  return list.sort((a, b) => (st[a.status] - st[b.status]) || (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(b.created).localeCompare(String(a.created)));
}

/** Tasks for one person: everything open + finished in the last 7 days. */
function myTasks(user) {
  const since = Utilities.formatDate(new Date(Date.now() - 7 * 864e5), TZ, 'yyyy-MM-dd');
  return sortTasks(readTasks().filter(t => lc(t['Assigned To']) === lc(user.username) &&
    (t['Status'] === 'Open' || t['Status'] === 'In progress' || String(t['Updated']).slice(0, 10) >= since)).map(taskOut));
}

function cleanDate(s) { s = String(s || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
/** Time an action happened on the phone (may be earlier, when it was offline). */
function actionTime(at) {
  const d = at ? new Date(at) : new Date();
  const t = isNaN(d) || d.getTime() > Date.now() + 5 * 60e3 ? new Date() : d;
  return Utilities.formatDate(t, TZ, 'yyyy-MM-dd HH:mm');
}

function taskCreate(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can assign tasks');
  f = f || {};
  const title = String(f.title || '').trim().slice(0, 140);
  if (!title) throw new Error('Enter a task title');
  const who = assignable().filter(u => lc(u.username) === lc(f.assignee))[0];
  if (!who) throw new Error('Choose who does the task');
  const p = props();
  const seq = Number(p.getProperty('TASK_SEQ') || 0) + 1;
  p.setProperty('TASK_SEQ', String(seq));
  const now = nowText();
  const t = {
    'ID': 'T-' + ('000' + seq).slice(-4), 'Created': now, 'Created By': user.username, 'Creator Name': user.name,
    'Assigned To': who.username, 'Assignee Name': who.name, 'Title': title, 'Details': String(f.details || '').slice(0, 2000),
    'Equipment': String(f.equipment || '').slice(0, 120), 'Priority': PRIORITIES.indexOf(f.priority) >= 0 ? f.priority : 'Normal',
    'Due': cleanDate(f.due), 'Link': TASK_LINKS.indexOf(f.link || '') >= 0 ? (f.link || '') : '', 'Status': 'Open',
    'Updated': now, 'Updated By': user.username,
    'Equipment No': String(f.equipmentNo || '').slice(0, 60), 'Line': String(f.line || '').slice(0, 60), 'Location': String(f.location || '').slice(0, 60)
  };
  writeTask(t);
  history(t['ID'], 'Created', user, 'Assigned to ' + who.username);
  const sent = notifyUser(who.username, { kind: 'assigned', id: t['ID'], title: title, equipment: equipLabel(t), priority: t['Priority'], by: user.name });
  return { ok: true, task: taskOut(t), notified: sent };
}

/** Supervisor changes: edit fields, reassign, cancel, reopen. */
function taskEdit(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can change tasks');
  f = f || {};
  const t = findTask(f.id);
  const notes = [];
  let notifyNew = null;
  if (f.title != null && String(f.title).trim()) t['Title'] = String(f.title).trim().slice(0, 140);
  if (f.details != null) t['Details'] = String(f.details).slice(0, 2000);
  if (f.equipment != null) t['Equipment'] = String(f.equipment).slice(0, 120);
  if (f.equipmentNo != null) t['Equipment No'] = String(f.equipmentNo).slice(0, 60);
  if (f.line != null) t['Line'] = String(f.line).slice(0, 60);
  if (f.location != null) t['Location'] = String(f.location).slice(0, 60);
  if (f.priority != null && PRIORITIES.indexOf(f.priority) >= 0) t['Priority'] = f.priority;
  if (f.due != null) t['Due'] = cleanDate(f.due);
  if (f.link != null && TASK_LINKS.indexOf(f.link) >= 0) t['Link'] = f.link;
  if (f.assignee && lc(f.assignee) !== lc(t['Assigned To'])) {
    const who = assignable().filter(u => lc(u.username) === lc(f.assignee))[0];
    if (!who) throw new Error('Choose who does the task');
    notes.push('Reassigned ' + t['Assigned To'] + ' → ' + who.username);
    t['Assigned To'] = who.username; t['Assignee Name'] = who.name;
    if (t['Status'] === 'In progress') { t['Status'] = 'Open'; t['Started'] = ''; }
    notifyNew = who.username;
  }
  if (f.status === 'Cancelled' && t['Status'] !== 'Cancelled') { t['Status'] = 'Cancelled'; notes.push('Cancelled'); }
  if (f.status === 'Open' && (t['Status'] === 'Done' || t['Status'] === 'Cancelled')) {
    t['Status'] = 'Open'; t['Started'] = ''; t['Done'] = ''; notes.push('Reopened'); notifyNew = notifyNew || t['Assigned To'];
  }
  t['Updated'] = nowText(); t['Updated By'] = user.username;
  writeTask(t);
  history(t['ID'], notes.length ? notes.join('; ') : 'Edited', user, f.note || '');
  let sent = null;
  if (notifyNew) sent = notifyUser(notifyNew, { kind: 'assigned', id: t['ID'], title: t['Title'], equipment: equipLabel(t), priority: t['Priority'], by: user.name });
  return { ok: true, task: taskOut(t), notified: sent };
}

/** Technician: Start / Done (with note + photo). Safe to send again. */
function taskUpdate(user, f) {
  f = f || {};
  const t = findTask(f.id);
  if (lc(t['Assigned To']) !== lc(user.username) && !isManager(user)) throw new Error('This task is assigned to someone else');
  if (t['Status'] === 'Cancelled') throw new Error('This task was cancelled');
  const at = actionTime(f.at);
  if (f.status === 'In progress') {
    if (t['Status'] === 'Open') { t['Status'] = 'In progress'; t['Started'] = at; history(t['ID'], 'Started', user, ''); }
  } else if (f.status === 'Done') {
    if (t['Status'] !== 'Done') {
      t['Status'] = 'Done'; if (!t['Started']) t['Started'] = at; t['Done'] = at;
      t['Done Note'] = String(f.note || '').slice(0, 2000); t['Done Photo'] = String(f.photo || '');
      history(t['ID'], 'Done', user, t['Done Note']);
      if (t['Created By'] && lc(t['Created By']) !== lc(user.username))
        notifyUser(t['Created By'], { kind: 'done', id: t['ID'], title: t['Title'], by: user.name });
    } else {
      if (f.note != null && String(f.note) !== t['Done Note']) t['Done Note'] = String(f.note).slice(0, 2000);
      if (f.photo) t['Done Photo'] = String(f.photo);
    }
  } else throw new Error('Unknown task status');
  t['Updated'] = nowText(); t['Updated By'] = user.username;
  writeTask(t);
  return { ok: true, task: taskOut(t) };
}

/* ---------- equipment list ("Equipments and system in Holoul factory") ---------- */

/** "MPR120 (MPR)" — what a technician sees in the task / notification. */
function equipLabel(t) {
  const name = String(t['Equipment'] || ''), no = String(t['Equipment No'] || '');
  return no && no !== name ? name + ' (' + no + ')' : name;
}

/** Every equipment row: { name, no, line, loc, cat }. Columns are found by their header names.
 *  Rows without a name (e.g. AC units) are named from their type and numbered: "Split AC #3". */
function equipmentList(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) { const hit = cache.get('equip_v1'); if (hit) return JSON.parse(hit); }
  const ss = SpreadsheetApp.openById(props().getProperty('EQUIPMENT_SS_ID') || EQUIPMENT_ID);
  const rows = ss.getSheets()[0].getDataRange().getDisplayValues();
  let hi = rows.findIndex(r => r.some(c => /equipment\s*name/i.test(String(c))));
  if (hi < 0) hi = 0;
  const h = rows[hi].map(c => String(c).trim().toLowerCase());
  const col = re => h.findIndex(c => re.test(c));
  const cName = col(/equipment\s*name|^name$/), cNo = col(/number|serial|^no\b|^pos/), cLine = col(/^line|system/),
        cLoc = col(/^location|^site/), cCat = col(/categor|type/);
  const seen = {}, list = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i], g = c => c >= 0 ? String(r[c] == null ? '' : r[c]).trim() : '';
    let name = g(cName), no = g(cNo);
    const line = g(cLine), loc = g(cLoc), cat = g(cCat);
    if (/^-+$/.test(no)) no = '';
    if (!name && !no && !line) continue;
    if (!name) {
      const base = line || cat || 'Equipment', k = base.toLowerCase();
      seen[k] = (seen[k] || 0) + 1;
      name = base + ' #' + seen[k];
    }
    list.push({ name: name, no: no, line: line, loc: loc, cat: cat });
  }
  try { cache.put('equip_v1', JSON.stringify(list), EQUIPMENT_CACHE_SECS); } catch (err) {}
  return list;
}

/* ---------- dashboard (supervisor / operations manager) ---------- */

function dashboard(user) {
  if (!isManager(user)) throw new Error('Dashboard is for supervisors');
  const today = todayIso();
  const weekAgo = Utilities.formatDate(new Date(Date.now() - 6 * 864e5), TZ, 'yyyy-MM-dd');
  const month = today.slice(0, 7);

  const people = usersTable().filter(u => u.active).map(u => ({ username: u.username, name: u.name, role: u.role, id: u.id }));
  const nameOf = {}; people.forEach(p => { nameOf[lc(p.username)] = p.name; });

  // tasks: everything open + finished / cancelled in the last 60 days
  const since60 = Utilities.formatDate(new Date(Date.now() - 60 * 864e5), TZ, 'yyyy-MM-dd');
  const all = readTasks();
  const tasks = sortTasks(all.filter(t => t['Status'] === 'Open' || t['Status'] === 'In progress' || String(t['Updated']).slice(0, 10) >= since60).map(taskOut));

  // today's reading pages
  const readingsToday = Object.keys(RECORD_SHEETS).map(name => {
    try {
      const d = getSheet(user, name);
      const items = d.rows.filter(r => !r.section);
      return { sheet: name, total: items.length, filled: items.filter(r => r.value !== '').length, completed: d.completed, checkedBy: d.checkedBy || '' };
    } catch (err) { return { sheet: name, error: String(err.message || err) }; }
  });

  // daily checks today + recent faults
  const checks = [], faults = [], checkRows = [];
  let ss = null;
  try { ss = checksBook(); } catch (err) {}
  if (ss) CHECK_TYPES.forEach(type => {
    if (!ss.getSheetByName(type + ' Checklist')) return;
    const units = readUnits(ss, type);
    const log = ss.getSheetByName(type + ' Log');
    const data = log ? log.getDataRange().getDisplayValues() : [[]];
    const h = data[0], c = n => h.indexOf(n);
    const todayRows = {};
    for (let i = 1; i < data.length; i++) {
      const r = data[i], date = r[c('Date')];
      checkRows.push({ type: type, date: date, username: r[c('Username')], status: r[c('Status')] });
      if (date === today) todayRows[r[c('Unit')]] = r;
      if (/^action/i.test(r[c('Status')]) && date >= Utilities.formatDate(new Date(Date.now() - 13 * 864e5), TZ, 'yyyy-MM-dd'))
        faults.push({ type: type, date: date, unit: r[c('Unit')], by: r[c('Operator')], status: r[c('Status')], faults: r[c('Faults')] });
    }
    checks.push({ type: type, units: units.map(u => {
      const r = todayRows[u];
      return r ? { unit: u, status: r[c('Status')], by: r[c('Operator')], at: String(r[c('Timestamp')]).slice(11, 16), faults: r[c('Faults')] }
               : { unit: u, status: '' };
    }) });
  });
  faults.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // Task Log ("Complete task" on reading pages)
  const tl = readings().getSheetByName(LOG_SHEET);
  const logRows = tl && tl.getLastRow() > 1 ? tl.getRange(2, 1, tl.getLastRow() - 1, 9).getDisplayValues()
    .map(r => ({ date: r[1], sheet: r[2], username: r[4] })) : [];

  // workload per person
  const assignees = people.filter(p => ASSIGNABLE_ROLES.indexOf(p.role) >= 0);
  const workload = assignees.map(p => {
    const mine = all.filter(t => lc(t['Assigned To']) === lc(p.username));
    const open = mine.filter(t => t['Status'] === 'Open'), prog = mine.filter(t => t['Status'] === 'In progress');
    return {
      username: p.username, name: p.name, role: p.role,
      open: open.length, inProgress: prog.length,
      overdue: open.concat(prog).filter(t => t['Due'] && t['Due'] < today).length,
      doneWeek: mine.filter(t => t['Status'] === 'Done' && String(t['Done']).slice(0, 10) >= weekAgo).length,
      doneMonth: mine.filter(t => t['Status'] === 'Done' && String(t['Done']).slice(0, 7) === month).length
    };
  });

  // monthly summary: this month + the 11 before, overall and per person
  const months = [];
  const base = isoToDate(today.slice(0, 8) + '15');
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 15, 9));
    months.push(Utilities.formatDate(d, TZ, 'yyyy-MM'));
  }
  const summary = months.map(m => {
    const created = all.filter(t => String(t['Created']).slice(0, 7) === m);
    const done = all.filter(t => t['Status'] === 'Done' && String(t['Done']).slice(0, 7) === m);
    const withDue = done.filter(t => t['Due']);
    const onTime = withDue.filter(t => String(t['Done']).slice(0, 10) <= t['Due']).length;
    const hours = done.map(t => (parseStamp(t['Done']) - parseStamp(t['Created'])) / 36e5).filter(h => h >= 0 && isFinite(h));
    const rl = logRows.filter(r => String(r.date).slice(0, 7) === m);
    const ck = checkRows.filter(r => String(r.date).slice(0, 7) === m);
    const per = {};
    const bump = (u, k) => { u = lc(u); if (!u) return; per[u] = per[u] || { tasksAssigned: 0, tasksDone: 0, readings: 0, checks: 0 }; per[u][k]++; };
    created.forEach(t => bump(t['Assigned To'], 'tasksAssigned'));
    done.forEach(t => bump(t['Assigned To'], 'tasksDone'));
    rl.forEach(r => bump(r.username, 'readings'));
    ck.forEach(r => bump(r.username, 'checks'));
    return { month: m, created: created.length, done: done.length, dueTotal: withDue.length, onTime: onTime,
             avgHours: hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length * 10) / 10 : null,
             readings: rl.length, checks: ck.length, faults: ck.filter(r => /^action/i.test(r.status)).length, people: per };
  });

  let equipment = [], equipmentError = '';
  try { equipment = equipmentList(); } catch (err) { equipmentError = String(err.message || err); }
  return { ok: true, today: today, generatedAt: nowText(), people: people, assignable: assignees, equipment: equipment, equipmentError: equipmentError,
           tasks: tasks, readings: readingsToday, checks: checks, faults: faults.slice(0, 40), workload: workload, months: summary };
}
function parseStamp(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4] - 3, +m[5]) : NaN; }

/* ================= Notifications (Web Push, VAPID) =================
 * Phones subscribe in the app; the server sends an empty push (no message body),
 * the app's service worker then asks "pushInbox" what happened and shows the notification. */

const VAPID_SUB = 'mailto:mteam.hrc@gmail.com';

function pushSheet() { return tasksBook().getSheetByName('Push Devices'); }

function pushSubscribe(user, sub, device) {
  const endpoint = String(sub && sub.endpoint || '');
  if (!/^https:\/\//.test(endpoint)) throw new Error('Bad subscription');
  const keys = (sub && sub.keys) || {};
  const sh = pushSheet();
  const rows = rowsOf(sh, PUSH_COLS);
  const same = rows.filter(r => r['Endpoint'] === endpoint)[0];
  const row = [user.username, endpoint, String(keys.p256dh || ''), String(keys.auth || ''), String(device || '').slice(0, 120), nowText(), same ? same['Last OK'] : '', ''];
  sh.getRange(same ? same._row : sh.getLastRow() + 1, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  return { ok: true, devices: rows.filter(r => lc(r['Username']) === lc(user.username) && r['Endpoint'] !== endpoint).length + 1 };
}

function pushUnsubscribe(user, endpoint) {
  const sh = pushSheet();
  const r = rowsOf(sh, PUSH_COLS).filter(x => x['Endpoint'] === String(endpoint || '') && lc(x['Username']) === lc(user.username))[0];
  if (r) sh.deleteRow(r._row);
  return { ok: true };
}

/** Messages waiting for this user's phone (read by the service worker when a push arrives). */
function inboxAdd(username, msg) {
  const cache = CacheService.getScriptCache(), key = 'inbox_' + lc(username);
  let list = [];
  try { list = JSON.parse(cache.get(key) || '[]'); } catch (err) {}
  msg.at = Date.now();
  list.push(msg);
  cache.put(key, JSON.stringify(list.slice(-10)), 6 * 3600);
}
function pushInbox(user) {
  const cache = CacheService.getScriptCache(), key = 'inbox_' + lc(user.username);
  let list = [];
  try { list = JSON.parse(cache.get(key) || '[]'); } catch (err) {}
  cache.remove(key);
  const open = readTasks().filter(t => lc(t['Assigned To']) === lc(user.username) && (t['Status'] === 'Open' || t['Status'] === 'In progress')).length;
  return { ok: true, messages: list, openTasks: open };
}

/** Sends an (empty) push to every phone of `username`. Returns { devices, sent }. Never throws. */
function notifyUser(username, msg) {
  try {
    const sh = pushSheet();
    const subs = rowsOf(sh, PUSH_COLS).filter(r => lc(r['Username']) === lc(username));
    if (!subs.length) return { devices: 0, sent: 0 };        // no phone: they see it in the app
    inboxAdd(username, msg);
    const reqs = subs.map(s => ({
      url: s['Endpoint'], method: 'post', muteHttpExceptions: true, followRedirects: false,
      headers: { Authorization: vapidAuth(s['Endpoint']), TTL: '86400', Urgency: 'high' }
    }));
    const res = UrlFetchApp.fetchAll(reqs);
    let sent = 0;
    const gone = [];
    res.forEach((r, i) => {
      const code = r.getResponseCode(), row = subs[i]._row;
      if (code >= 200 && code < 300) { sent++; sh.getRange(row, 7, 1, 2).setValues([[nowText(), '']]); }
      else if (code === 404 || code === 410) gone.push(row);                       // phone unsubscribed / app removed
      else sh.getRange(row, 8).setValue(nowText() + ' HTTP ' + code + ' ' + String(r.getContentText()).slice(0, 120));
    });
    gone.sort((a, b) => b - a).forEach(row => sh.deleteRow(row));
    return { devices: subs.length - gone.length, sent: sent };
  } catch (err) {
    console.error('notifyUser ' + username + ': ' + err);
    return { devices: 0, sent: 0, error: String(err.message || err) };
  }
}

/** VAPID key pair (P-256), made once and kept in Script Properties. */
function vapidKeys() {
  const p = props();
  let pub = p.getProperty('VAPID_PUBLIC'), priv = p.getProperty('VAPID_PRIVATE');
  if (!pub || !priv) {
    const seed = EC.sha256(EC.str(Utilities.getUuid() + Utilities.getUuid() + Date.now() + Math.random()));
    const d = EC.mod(EC.big(seed), EC.n - BigInt(1)) + BigInt(1);
    priv = EC.b64(EC.bytes(d, 32));
    pub = EC.b64(EC.publicKey(d));
    p.setProperty('VAPID_PRIVATE', priv); p.setProperty('VAPID_PUBLIC', pub);
  }
  return { pub: pub, d: EC.big(EC.unb64(priv)) };
}

/** "Authorization: vapid t=<JWT>, k=<public key>" for a push service (token cached ~5 h). */
function vapidAuth(endpoint) {
  const aud = String(endpoint).match(/^https:\/\/[^\/]+/)[0];
  const keys = vapidKeys();
  const cache = CacheService.getScriptCache(), ck = 'vapid_' + aud;
  let jwt = cache.get(ck);
  if (!jwt) {
    const part = o => EC.b64(EC.str(JSON.stringify(o)));
    const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB });
    jwt = unsigned + '.' + EC.b64(EC.sign(EC.str(unsigned), keys.d));
    cache.put(ck, jwt, 5 * 3600);
  }
  return 'vapid t=' + jwt + ', k=' + keys.pub;
}

/* ---------- P-256 ECDSA (ES256) with deterministic nonce (RFC 6979) ----------
 * Apps Script has no elliptic-curve signing, so it is done here with BigInt. */
const EC = (function () {
  const B = s => BigInt(s);
  const p = B('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
  const n = B('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  const G = [B('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
             B('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')];
  const Z0 = B(0), ONE = B(1), TWO = B(2), THREE = B(3), FOUR = B(4), EIGHT = B(8);
  const mod = (x, m) => { const r = x % m; return r < Z0 ? r + m : r; };
  function pow(b, e, m) { let r = ONE; b = mod(b, m); while (e > Z0) { if (e & ONE) r = r * b % m; b = b * b % m; e >>= ONE; } return r; }
  const inv = (x, m) => pow(mod(x, m), m - TWO, m);
  // Jacobian coordinates [X, Y, Z]; Z = 0 is the point at infinity
  function dbl(P) {
    const X = P[0], Y = P[1], Z = P[2];
    if (Y === Z0 || Z === Z0) return [Z0, ONE, Z0];
    const delta = Z * Z % p, gamma = Y * Y % p, beta = X * gamma % p;
    const alpha = THREE * mod(X - delta, p) % p * ((X + delta) % p) % p;
    const X3 = mod(alpha * alpha - EIGHT * beta, p);
    const Z3 = mod((Y + Z) * (Y + Z) - gamma - delta, p);
    const Y3 = mod(alpha * mod(FOUR * beta - X3, p) - EIGHT * (gamma * gamma % p), p);
    return [X3, Y3, Z3];
  }
  function add(P, Q) {
    if (P[2] === Z0) return Q;
    if (Q[2] === Z0) return P;
    const Z1Z1 = P[2] * P[2] % p, Z2Z2 = Q[2] * Q[2] % p;
    const U1 = P[0] * Z2Z2 % p, U2 = Q[0] * Z1Z1 % p;
    const S1 = P[1] * Q[2] % p * Z2Z2 % p, S2 = Q[1] * P[2] % p * Z1Z1 % p;
    if (U1 === U2) return S1 === S2 ? dbl(P) : [Z0, ONE, Z0];
    const H = mod(U2 - U1, p), I = TWO * H % p * (TWO * H % p) % p, J = H * I % p;
    const r = TWO * mod(S2 - S1, p) % p, V = U1 * I % p;
    const X3 = mod(r * r - J - TWO * V, p);
    const Y3 = mod(r * mod(V - X3, p) - TWO * S1 * J, p);
    const Z3 = mod(((P[2] + Q[2]) * (P[2] + Q[2]) - Z1Z1 - Z2Z2) % p * H, p);
    return [X3, Y3, Z3];
  }
  function mul(k, A) {
    let R = [Z0, ONE, Z0];
    const Q = [A[0], A[1], ONE];
    const bits = k.toString(2);
    for (let i = 0; i < bits.length; i++) { R = dbl(R); if (bits[i] === '1') R = add(R, Q); }
    if (R[2] === Z0) throw new Error('point at infinity');
    const zi = inv(R[2], p), zi2 = zi * zi % p;
    return [R[0] * zi2 % p, R[1] * zi2 % p * zi % p];
  }
  // bytes are plain numbers 0..255 here; Apps Script's own byte arrays are signed (-128..127)
  const u8 = a => Array.prototype.map.call(a, x => x & 255);
  const s8 = a => a.map(x => x > 127 ? x - 256 : x);
  const big = a => { let x = Z0; for (let i = 0; i < a.length; i++) x = (x << EIGHT) + B(a[i]); return x; };
  const bytes = (x, len) => { const out = new Array(len).fill(0); for (let i = len - 1; i >= 0; i--) { out[i] = Number(x & B(255)); x >>= EIGHT; } return out; };
  const str = s => u8(Utilities.newBlob(String(s)).getBytes());
  const sha256 = a => u8(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s8(a)));
  const hmac = (key, data) => u8(Utilities.computeHmacSha256Signature(s8(data), s8(key)));
  const b64 = a => Utilities.base64EncodeWebSafe(s8(a)).replace(/=+$/, '');
  const unb64 = s => { s = String(s); while (s.length % 4) s += '='; return u8(Utilities.base64DecodeWebSafe(s)); };
  function publicKey(d) { const Q = mul(d, G); return [4].concat(bytes(Q[0], 32), bytes(Q[1], 32)); }
  /** 64-byte r||s signature of msg (bytes) with private key d (BigInt). */
  function sign(msg, d) {
    const h1 = sha256(msg), z = mod(big(h1), n);
    const x = bytes(d, 32), hz = bytes(z, 32);
    let V = new Array(32).fill(1), K = new Array(32).fill(0);
    K = hmac(K, V.concat([0], x, hz)); V = hmac(K, V);
    K = hmac(K, V.concat([1], x, hz)); V = hmac(K, V);
    for (let guard = 0; guard < 100; guard++) {
      V = hmac(K, V);
      const k = big(V);
      if (k > Z0 && k < n) {
        const r = mod(mul(k, G)[0], n);
        const s = mod(inv(k, n) * mod(z + r * d, n), n);
        if (r !== Z0 && s !== Z0) return bytes(r, 32).concat(bytes(s, 32));
      }
      K = hmac(K, V.concat([0])); V = hmac(K, V);
    }
    throw new Error('signing failed');
  }
  /** Checks a signature (used by the self-test). */
  function verify(msg, sig, pub) {
    const r = big(sig.slice(0, 32)), s = big(sig.slice(32)), z = mod(big(sha256(msg)), n);
    if (r <= Z0 || r >= n || s <= Z0 || s >= n) return false;
    const w = inv(s, n), Q = [big(pub.slice(1, 33)), big(pub.slice(33))];
    const A = mul(mod(z * w, n), G), Bp = mul(mod(r * w, n), Q);
    const S = add([A[0], A[1], ONE], [Bp[0], Bp[1], ONE]);
    const zi = inv(S[2], p);
    return mod(S[0] * zi % p * zi, p) % n === r;
  }
  return { n: n, mod: mod, big: big, bytes: bytes, str: str, sha256: sha256, b64: b64, unb64: unb64, publicKey: publicKey, sign: sign, verify: verify };
})();

/* ================= One-time: v7 setup (tasks, roles, notifications) =================
 * Run once from the editor (Run > setupV7). Google asks to allow "Connect to an external
 * service" — needed to send notifications. Safe to run again. */
function setupV7() {
  // 1. roles in the Users sheet (+ access formulas)
  setupSheet();
  // 2. tasks spreadsheet
  const ss = tasksBook();
  Logger.log('Tasks spreadsheet: %s', ss.getUrl());
  // 3. notification keys + self-test of the signature code
  const keys = vapidKeys();
  const msg = EC.str('holoul self-test ' + Date.now());
  const sig = EC.sign(msg, keys.d);
  if (!EC.verify(msg, sig, EC.unb64(keys.pub))) throw new Error('Signature self-test failed');
  // fixed test vector (same result as Node.js crypto)
  const tv = EC.sign(EC.str('holoul-test-vector'), EC.big(EC.sha256(EC.str('holoul-test-key'))));
  Logger.log('Test vector: %s', EC.b64(tv));
  Logger.log('Public key: %s', keys.pub);
  // 4. touches the network once so Google asks for the permission now
  UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  Logger.log('v7 ready.');
}
