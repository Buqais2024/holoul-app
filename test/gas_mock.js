// Minimal in-memory Google Apps Script runtime so Code.gs can run in Node for tests.
const vm = require('vm'), fs = require('fs'), crypto = require('crypto');

function makeRuntime(codePath, opts) {
  opts = opts || {};
  const noop = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : noop), apply: () => noop });
  let clock = opts.now || Date.parse('2026-11-29T09:00:00Z');       // Sunday 12:00 in Riyadh
  const store = {};                                                  // script properties
  const cacheData = {};
  const books = {};
  let idSeq = 0;

  class Range {
    constructor(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
    _get() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.cell(this.r + i, this.c + j)); out.push(row); } return out; }
    getDisplayValues() { return this._get(); }
    getValues() { return this._get(); }
    getValue() { return this._get()[0][0]; }
    getDisplayValue() { return this._get()[0][0]; }
    setValues(v) { for (let i = 0; i < v.length; i++) for (let j = 0; j < v[i].length; j++) this.sh.put(this.r + i, this.c + j, v[i][j]); return this; }
    setValue(v) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.put(this.r + i, this.c + j, v); return this; }
    setFormula(f) { return this.setValue(f); }
    getRow() { return this.r; } getColumn() { return this.c; }
    sort() { return this; }
  }
  ['setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor', 'setDataValidation', 'setHorizontalAlignment', 'setVerticalAlignment', 'setWrap',
   'setFontStyle', 'setFontFamily', 'setBold', 'setNumberFormats', 'setBackgrounds', 'clearContent', 'clear', 'merge', 'setFontSize']
    .forEach(m => { Range.prototype[m] = function () { return this; }; });

  class Sheet {
    constructor(ss, name, id) { this.ss = ss; this.name = name; this.rows = []; this.id = id; }
    cell(r, c) { const row = this.rows[r - 1]; const v = row && row[c - 1]; return v == null ? '' : String(v); }
    put(r, c, v) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v == null ? '' : v; }
    getRange(r, c, nr, nc) { return new Range(this, r, c || 1, nr || 1, nc || 1); }
    getLastRow() { let n = 0; this.rows.forEach((row, i) => { if (row.some(v => v !== '' && v != null)) n = i + 1; }); return n; }
    getLastColumn() { let n = 0; this.rows.forEach(row => row.forEach((v, j) => { if (v !== '' && v != null) n = Math.max(n, j + 1); })); return n; }
    getMaxRows() { return Math.max(this.rows.length, 1000); }
    getMaxColumns() { return Math.max(this.getLastColumn(), 26); }
    getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
    appendRow(vals) { const r = this.getLastRow() + 1; vals.forEach((v, j) => this.put(r, j + 1, v)); return this; }
    insertRowBefore(n) { this.rows.splice(n - 1, 0, []); return this; }
    deleteRow(n) { this.rows.splice(n - 1, 1); return this; }
    getName() { return this.name; } setName(n) { this.name = n; return this; }
    getSheetId() { return this.id; }
    setFrozenRows() { return this; } setColumnWidth() { return this; } setConditionalFormatRules() { return this; } setTabColor() { return this; }
    getConditionalFormatRules() { return []; } hideSheet() { return this; } getParent() { return this.ss; }
  }
  class Spreadsheet {
    constructor(id, name) { this.id = id; this.name = name; this.sheets = [new Sheet(this, 'Sheet1', ++idSeq)]; }
    getId() { return this.id; } getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; } getName() { return this.name; }
    getSheets() { return this.sheets; }
    getSheetByName(n) { return this.sheets.filter(s => s.name === n)[0] || null; }
    getSheetById(i) { return this.sheets.filter(s => s.id === i)[0] || null; }
    insertSheet(n) { const s = new Sheet(this, n || 'Sheet' + (this.sheets.length + 1), ++idSeq); this.sheets.push(s); return s; }
  }
  const openById = id => { if (!books[id]) throw new Error('No spreadsheet ' + id); return books[id]; };
  const addBook = (id, name) => (books[id] = new Spreadsheet(id, name || id));

  const cache = { get: k => (k in cacheData ? cacheData[k] : null), put: (k, v) => { cacheData[k] = String(v); }, remove: k => { delete cacheData[k]; } };
  const fmtTz = (d, pat) => {
    const t = new Date(d.getTime() + 3 * 3600e3), p = n => String(n).padStart(2, '0');
    const Y = t.getUTCFullYear(), M = p(t.getUTCMonth() + 1), D = p(t.getUTCDate()), h = p(t.getUTCHours()), m = p(t.getUTCMinutes()), s = p(t.getUTCSeconds());
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return pat.replace('yyyy', Y).replace('MMM', MON[t.getUTCMonth()]).replace('MM', M).replace('dd', D).replace('HH', h).replace('mm', m).replace('ss', s)
              .replace(/^dMMM$/, '');
  };
  const sent = [], mails = [];                                                    // push attempts recorded for tests
  const Utilities = {
    formatDate: (d, tz, pat) => (pat === 'dMMM' ? String(new Date(d.getTime() + 3 * 3600e3).getUTCDate()) + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][new Date(d.getTime() + 3 * 3600e3).getUTCMonth()] : fmtTz(d, pat)),
    base64EncodeWebSafe: b => Buffer.from(typeof b === 'string' ? b : Buffer.from(b)).toString('base64url') + '==',
    base64DecodeWebSafe: s => Array.from(Buffer.from(String(s).replace(/=+$/, ''), 'base64url')),
    base64Encode: b => Buffer.from(typeof b === 'string' ? b : Buffer.from(b)).toString('base64'),
    base64Decode: s => Array.from(Buffer.from(String(s), 'base64')),
    computeHmacSha256Signature: (v, key) => Array.from(crypto.createHmac('sha256', typeof key === 'string' ? key : Buffer.from(key)).update(typeof v === 'string' ? v : Buffer.from(v)).digest()),
    computeDigest: (alg, v) => Array.from(crypto.createHash('sha256').update(typeof v === 'string' ? v : Buffer.from(v)).digest()),
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    getUuid: () => crypto.randomUUID(),
    newBlob: (b, type, name) => ({ name: name || 'blob', getDataAsString: () => Buffer.from(b).toString('utf8'), getBytes: () => Array.from(Buffer.from(b)), setContentType() { return this; }, setName() { return this; } }),
    sleep: () => {}
  };
  const lockState = { held: false };
  const sandbox = {
    console, JSON, Math, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(clock); } static now() { return clock; } },
    Utilities, Buffer, URL, Object, Array, String, Number, Boolean, RegExp, Error, Set, Map, isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    CacheService: { getScriptCache: () => cache },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); }, deleteProperty: k => { delete store[k]; }, getProperties: () => Object.assign({}, store) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {}, hasLock: () => true }) },
    SpreadsheetApp: { openById, create: n => addBook('new-' + (++idSeq), n), flush: () => {}, newDataValidation: () => noop, newConditionalFormatRule: () => noop },
    DriveApp: (() => { const folder = { getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => folder, getFilesByName: () => ({ hasNext: () => false }),
      createFile: (b) => ({ getId: () => 'f1', getUrl: () => 'https://drive.example/file/' + (b && b.name || 'f') }) };
      return { getRootFolder: () => noop, getFolderById: () => folder, getFileById: () => noop }; })(),
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => noop, deleteTrigger: () => {} },
    ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    UrlFetchApp: { fetchAll: reqs => reqs.map(r => { sent.push(r.url); return { getResponseCode: () => 201, getContentText: () => '' }; }), fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }) },
    MailApp: { sendEmail: m => { mails.push(m); } },
    Logger: { log() {} }
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const src = fs.readFileSync(codePath, 'utf8')
    // top-level const/let are not visible on the context object; expose what tests need
    + '\n;globalThis.__api = { taskOut, reportCsv, doPost, doGet: typeof doGet === "function" ? doGet : null, taskCreate, taskEdit, taskUpdate, taskApprove, taskTemplates, taskTemplateSave, submitCheck, automationCycle, remindDue, readTasks, myTasks, tasksBook, usersTable, findUser, login, props, TASK_COLS, TEMPLATE_COLS, rowsOf, METER_COLS, latestHourMeter };';
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  const api = sandbox.__api;
  const call = (body) => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(body) } }).s);

  return {
    api, call, store, sent, mails, addBook, books, cache,
    setNow: ms => { clock = ms; }, advance: ms => { clock += ms; }, now: () => clock,
    props: store
  };
}
module.exports = { makeRuntime };
