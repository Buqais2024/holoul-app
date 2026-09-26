/**
 * Holoul Maintenance App — backend (Google Apps Script)
 * Standalone script. Reads users from "Holoul App - Users" and writes
 * readings into the "Instrument Reading" spreadsheet.
 *
 * After changing this code: Deploy > Manage deployments > (pencil) >
 * Version: New version > Deploy.  (Keeps the same Web app URL.)
 */

const SHEET_ID     = '1ohP2VDJitA_ZxiY3Sk6V22Z6yGHZjvgsBg58pMwac_4';   // Holoul App - Users
const READINGS_ID  = '1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ';   // Instrument Reading
const USERS_SHEET  = 'Users';
const LOG_SHEET    = 'Task Log';
const TZ           = 'Asia/Riyadh';
const SESSION_SECS = 6 * 60 * 60;   // sign-in lasts 6 hours

const book     = () => SpreadsheetApp.openById(SHEET_ID);
const readings = () => SpreadsheetApp.openById(READINGS_ID);

// Record pages and their layout in "Instrument Reading".
// Row 1 = date, row 2 = username, readings from DATA_ROW down, one column per day.
const RECORD_SHEETS = {
  // A #, B Cable ID, C Description, D Ref value, readings from E
  'Amp Rec':       { layout: 'list',      idCol: 2, descCol: 3, refCol: 4, firstDayCol: 5, dataRow: 3 },
  // A Machine, B Motor/Bearing, C F/B/L/R, D Horizontal/Vertical/Axial, readings from E
  // (row 2 "Checked by" was inserted by setupVibration so row 2 holds the username)
  'Vibration Rec': { layout: 'vibration', firstDayCol: 5, dataRow: 3, keyCols: 4 }
  // 'Thermo Rec':  {...}  — next
};

const MODULES = ['Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Forklift', 'Bobcat'];

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
      case 'login':       out = login(body.username, body.pin); break;
      case 'getSheet':    out = withUser(body, u => getSheet(u, body.sheet)); break;
      case 'saveReading': out = withUser(body, u => saveReading(u, body.sheet, body.row, body.value)); break;
      case 'complete':    out = withUser(body, u => completeTask(u, body.sheet)); break;
      default:            out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'Holoul Maintenance API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- auth ---------- */

function login(username, pin) {
  username = String(username || '').trim().toLowerCase();
  pin = String(pin || '').trim();
  if (!username || !pin) return { ok: false, error: 'Enter username and PIN' };

  const rows = book().getSheetByName(USERS_SHEET).getDataRange().getDisplayValues();
  const h = rows[0], c = name => h.indexOf(name);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[c('Username')]).trim().toLowerCase() !== username) continue;
    if (String(r[c('PIN')]).trim() !== pin) break;
    if (r[c('Active')] !== 'Yes') return { ok: false, error: 'Account is inactive — contact your supervisor' };
    const role = r[c('Role')], equipment = r[c('Assigned Equipment')];
    const user = {
      id: r[c('User ID')], name: r[c('Full Name')], username: String(r[c('Username')]).trim(),
      role: role, equipment: equipment, access: accessFor(role, equipment)
    };
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put('t_' + token, JSON.stringify(user), SESSION_SECS);
    return { ok: true, token: token, user: user };
  }
  Utilities.sleep(800); // slow down PIN guessing
  return { ok: false, error: 'Wrong username or PIN' };
}

function withUser(body, fn) {
  const raw = body.token && CacheService.getScriptCache().get('t_' + body.token);
  if (!raw) return { ok: false, auth: true, error: 'Session expired — please sign in again' };
  return fn(JSON.parse(raw));
}

function checkSheet(user, sheetName) {
  if (!RECORD_SHEETS[sheetName]) throw new Error('This page is not set up yet');
  if (user.access.indexOf(sheetName) < 0) throw new Error('You do not have access to ' + sheetName);
  const sh = readings().getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet "' + sheetName + '" not found in Instrument Reading');
  return sh;
}

/* ---------- today's column ---------- */

function todayKeys() {
  const d = new Date();
  return {
    iso: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'),
    texts: ['dMMM', 'ddMMM', 'd MMM', 'dd MMM', 'd-MMM', 'dd-MMM', 'd/M/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd']
      .map(f => Utilities.formatDate(d, TZ, f).replace(/\s/g, '').toLowerCase())
  };
}

function isToday(v, keys) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd') === keys.iso;
  const s = String(v || '').replace(/\s/g, '').toLowerCase();
  return !!s && keys.texts.indexOf(s) >= 0;
}

/** Finds today's column (by the date in row 1). If none, returns the first
 *  empty column after the existing ones. `create` writes the date into row 1. */
function dayColumn(sh, cfg, create) {
  const lastCol = Math.max(sh.getLastColumn(), cfg.firstDayCol);
  const width = lastCol - cfg.firstDayCol + 1;
  const top = sh.getRange(1, cfg.firstDayCol, 2, width).getValues();
  const keys = todayKeys();

  for (let i = 0; i < width; i++) if (isToday(top[0][i], keys)) return { col: cfg.firstDayCol + i, isNew: false };

  // no column for today yet: first completely empty column
  const lastRow = Math.max(sh.getLastRow(), cfg.dataRow);
  const body = sh.getRange(1, cfg.firstDayCol, lastRow, width).getValues();
  let col = lastCol + 1;
  for (let i = 0; i < width; i++) {
    if (body.every(r => r[i] === '' || r[i] === null)) { col = cfg.firstDayCol + i; break; }
  }
  if (create) {
    sh.getRange(1, col).setNumberFormat('@').setValue(Utilities.formatDate(new Date(), TZ, 'dMMM'));  // e.g. 26Sep, same style as existing headers
  }
  return { col: col, isNew: true };
}

/* ---------- actions ---------- */

function getSheet(user, sheetName) {
  const sh = checkSheet(user, sheetName);
  const cfg = RECORD_SHEETS[sheetName];
  const day = dayColumn(sh, cfg, false);
  const lastRow = sh.getLastRow();
  const n = lastRow - cfg.dataRow + 1;
  if (n < 1) return { ok: true, rows: [] };

  const vals = day.isNew ? [] : sh.getRange(cfg.dataRow, day.col, n, 1).getDisplayValues();
  const valueAt = i => vals[i] ? String(vals[i][0]).trim() : '';
  const rows = cfg.layout === 'vibration' ? vibrationRows(sh, cfg, n, valueAt) : listRows(sh, cfg, n, valueAt);

  return {
    ok: true, sheet: sheetName, layout: cfg.layout,
    refHeader: cfg.refCol ? (sh.getRange(1, cfg.refCol).getDisplayValue() || 'Ref Value') : '',
    date: Utilities.formatDate(new Date(), TZ, 'EEE d MMM yyyy'),
    column: day.isNew ? null : columnLetter(day.col),
    completed: completedToday(sheetName),
    rows: rows
  };
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

function saveReading(user, sheetName, row, value) {
  const sh = checkSheet(user, sheetName);
  const cfg = RECORD_SHEETS[sheetName];
  row = Number(row);
  if (!(row >= cfg.dataRow && row <= sh.getLastRow())) throw new Error('Invalid row');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const day = dayColumn(sh, cfg, true);
    // row 2: who filled it (adds a second name if two people work the same day)
    const who = sh.getRange(2, day.col);
    const names = String(who.getValue() || '').split(',').map(s => s.trim()).filter(String);
    if (names.indexOf(user.username) < 0) { names.push(user.username); who.setValue(names.join(', ')); }

    const v = String(value == null ? '' : value).trim();
    const num = Number(v.replace(',', '.'));
    sh.getRange(row, day.col).setValue(v === '' ? '' : (isNaN(num) ? v : num));
    SpreadsheetApp.flush();
    return { ok: true, row: row, value: v, column: columnLetter(day.col) };
  } finally {
    lock.releaseLock();
  }
}

function completeTask(user, sheetName) {
  const data = getSheet(user, sheetName);
  const items = data.rows.filter(r => !r.section);
  const filled = items.filter(r => r.value !== '').length;

  const ss = readings();
  const log = ss.getSheetByName(LOG_SHEET) || (function () {
    const s = ss.insertSheet(LOG_SHEET);
    s.appendRow(['Timestamp', 'Date', 'Sheet', 'User ID', 'Username', 'Full Name', 'Filled', 'Total', 'Column']);
    s.getRange('A1:I1').setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    s.setFrozenRows(1);
    return s;
  })();
  const now = new Date();
  log.appendRow([now, Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), sheetName, user.id, user.username,
                 user.name, filled, items.length, data.column || '']);
  log.getRange(log.getLastRow(), 1).setNumberFormat('yyyy-mm-dd hh:mm');
  return { ok: true, filled: filled, total: items.length, completed: completedToday(sheetName) };
}

function completedToday(sheetName) {
  const log = readings().getSheetByName(LOG_SHEET);
  if (!log || log.getLastRow() < 2) return null;
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const rows = log.getRange(2, 1, log.getLastRow() - 1, 9).getDisplayValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][1] === today && rows[i][2] === sheetName)
      return { by: rows[i][5] || rows[i][4], at: rows[i][0].slice(11), filled: rows[i][6], total: rows[i][7] };
  }
  return null;
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
