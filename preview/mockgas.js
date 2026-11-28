// Browser version of the test backend: runs the real Code.gs in the page with fake Google services and dummy data.
(function () {
  const enc = s => new TextEncoder().encode(s);
  const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  function sha256(bytes) {
    const l = bytes.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(n - 4, (l * 8) >>> 0); dv.setUint32(n - 8, Math.floor(l * 8 / 4294967296));
    let h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]); const w = new Uint32Array(64);
    const R = (x, c) => (x >>> c) | (x << (32 - c));
    for (let i = 0; i < n; i += 64) {
      for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
      for (let j = 16; j < 64; j++) { const a = R(w[j-15],7)^R(w[j-15],18)^(w[j-15]>>>3), b = R(w[j-2],17)^R(w[j-2],19)^(w[j-2]>>>10); w[j] = (w[j-16] + a + w[j-7] + b) >>> 0; }
      let [a,b,c,d,e,f,g,hh] = h;
      for (let j = 0; j < 64; j++) { const s1 = R(e,6)^R(e,11)^R(e,25), ch = (e&f)^(~e&g), t1 = (hh+s1+ch+K[j]+w[j])>>>0, s0 = R(a,2)^R(a,13)^R(a,22), mj = (a&b)^(a&c)^(b&c), t2 = (s0+mj)>>>0; hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0; }
      h = h.map((v, k) => (v + [a,b,c,d,e,f,g,hh][k]) >>> 0);
    }
    const out = new Uint8Array(32); h.forEach((v, k) => new DataView(out.buffer).setUint32(k * 4, v)); return out;
  }
  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key); const k = new Uint8Array(64); k.set(key);
    const ip = k.map(b => b ^ 0x36), op = k.map(b => b ^ 0x5c);
    const inner = sha256(Uint8Array.from([...ip, ...msg])); return sha256(Uint8Array.from([...op, ...inner]));
  }
  const toBytes = v => typeof v === 'string' ? enc(v) : Uint8Array.from(v);
  const b64 = a => btoa(String.fromCharCode(...a)), unb64 = s => Array.from(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
  const web = s => s.replace(/\+/g, '-').replace(/\//g, '_'), unweb = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return s; };

  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
    _get() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.cell(this.r + i, this.c + j)); o.push(row); } return o; }
    getDisplayValues() { return this._get(); } getValues() { return this._get(); } getValue() { return this._get()[0][0]; } getDisplayValue() { return this._get()[0][0]; }
    setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.put(this.r + i, this.c + j, x))); return this; }
    setValue(v) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.put(this.r + i, this.c + j, v); return this; }
    setFormula(f) { return this.setValue(f); } getRow() { return this.r; } getColumn() { return this.c; } sort() { return this; }
  }
  ['setNumberFormat','setFontWeight','setBackground','setFontColor','setDataValidation','setHorizontalAlignment','setVerticalAlignment','setWrap','setFontStyle','setFontFamily','setBold','clearContent','clear','merge','setFontSize'].forEach(m => { Range.prototype[m] = function () { return this; }; });
  class Sheet {
    constructor(ss, name, id) { this.ss = ss; this.name = name; this.rows = []; this.id = id; }
    cell(r, c) { const row = this.rows[r - 1]; const v = row && row[c - 1]; return v == null ? '' : String(v); }
    put(r, c, v) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v == null ? '' : v; }
    getRange(r, c, nr, nc) { return new Range(this, r, c || 1, nr || 1, nc || 1); }
    getLastRow() { let n = 0; this.rows.forEach((row, i) => { if (row.some(v => v !== '' && v != null)) n = i + 1; }); return n; }
    getLastColumn() { let n = 0; this.rows.forEach(row => row.forEach((v, j) => { if (v !== '' && v != null) n = Math.max(n, j + 1); })); return n; }
    getMaxRows() { return Math.max(this.rows.length, 1000); } getMaxColumns() { return Math.max(this.getLastColumn(), 26); }
    getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
    appendRow(vals) { const r = this.getLastRow() + 1; vals.forEach((v, j) => this.put(r, j + 1, v)); return this; }
    insertRowBefore(n) { this.rows.splice(n - 1, 0, []); return this; } deleteRow(n) { this.rows.splice(n - 1, 1); return this; }
    getName() { return this.name; } setName(n) { this.name = n; return this; } getSheetId() { return this.id; }
    setFrozenRows() { return this; } setColumnWidth() { return this; } setConditionalFormatRules() { return this; } getConditionalFormatRules() { return []; } hideSheet() { return this; } getParent() { return this.ss; }
  }
  let idSeq = 0; const books = {};
  class SS { constructor(id, name) { this.id = id; this.name = name; this.sheets = [new Sheet(this, 'Sheet1', ++idSeq)]; }
    getId() { return this.id; } getUrl() { return 'x'; } getName() { return this.name; } getSheets() { return this.sheets; }
    getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; } getSheetById(i) { return this.sheets.find(s => s.id === i) || null; }
    insertSheet(n) { const s = new Sheet(this, n || 'Sheet' + (this.sheets.length + 1), ++idSeq); this.sheets.push(s); return s; } }
  const addBook = (id, name) => (books[id] = new SS(id, name));
  const noop = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : noop), apply: () => noop });
  const store = { TOKEN_SECRET: 'preview-secret-not-real' }, cacheData = {};
  const pad = n => String(n).padStart(2, '0'), MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmt = (d, pat) => { const t = new Date(d.getTime() + 3 * 3600e3); if (pat === 'dMMM') return t.getUTCDate() + MON[t.getUTCMonth()];
    return pat.replace('yyyy', t.getUTCFullYear()).replace('MM', pad(t.getUTCMonth() + 1)).replace('dd', pad(t.getUTCDate())).replace('HH', pad(t.getUTCHours())).replace('mm', pad(t.getUTCMinutes())).replace('ss', pad(t.getUTCSeconds())); };
  const sandbox = {
    console, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Error, Set, Map, isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, URL,
    Utilities: { formatDate: (d, tz, pat) => fmt(d, pat), getUuid: () => crypto.randomUUID(), sleep() {}, DigestAlgorithm: { SHA_256: 1 },
      computeDigest: (a, v) => Array.from(sha256(toBytes(v))), computeHmacSha256Signature: (v, k) => Array.from(hmac(toBytes(k), toBytes(v))),
      base64Encode: v => b64(toBytes(v)), base64Decode: s => unb64(s), base64EncodeWebSafe: v => web(b64(toBytes(v))), base64DecodeWebSafe: s => unb64(unweb(s)),
      newBlob: (b, type, name) => ({ name: name || 'blob', getDataAsString: () => new TextDecoder().decode(Uint8Array.from(b)), getBytes: () => Array.from(b), setContentType() { return this; }, setName() { return this; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cacheData ? cacheData[k] : null), put: (k, v) => { cacheData[k] = String(v); }, remove: k => { delete cacheData[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); }, deleteProperty: k => { delete store[k]; }, getProperties: () => ({ ...store }) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { openById: id => { if (!books[id]) throw new Error('No spreadsheet ' + id); return books[id]; }, create: n => addBook('new-' + (++idSeq), n), flush() {}, newDataValidation: () => noop, newConditionalFormatRule: () => noop },
    DriveApp: (() => { const folder = { getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => folder, getFilesByName: () => ({ hasNext: () => false }), createFile: b => ({ getId: () => 'f1', getUrl: () => 'https://drive.example/file/' + (b && b.name || 'f'), setSharing() { return this; } }) }; return { getRootFolder: () => noop, getFolderById: () => folder, getFileById: () => noop }; })(), ScriptApp: { getProjectTriggers: () => [], newTrigger: () => noop, deleteTrigger() {} },
    ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    MailApp: { sendEmail: m => { (window.__mails = window.__mails || []).push(m.to); } },
    UrlFetchApp: { fetchAll: r => r.map(() => ({ getResponseCode: () => 201, getContentText: () => '' })), fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }) }, Logger: { log() {} }
  };
  async function boot() {
    const src = await (await fetch('Code.txt')).text();
    const us = addBook('1ohP2VDJitA_ZxiY3Sk6V22Z6yGHZjvgsBg58pMwac_4', 'Users').sheets[0]; us.setName('Users');
    [['User ID','Full Name','Username','PIN','Active','Role','Assigned Equipment','Create tasks','Edit equipment','Edit spare parts'],
     ['1','Sam Supervisor','sup','1111','Yes','Supervisor','','','',''],['2','Tom Mechanic','tech1','2222','Yes','Mech-Technician','','No','No','No'],
     ['3','Eli Electrician','tech2','2223','Yes','Elec-Technician','','No','No','No'],['4','Sid Skid Operator','skid','3333','Yes','Skid loader Operator','Bobcat','No','No','No']].forEach(r => us.appendRow(r));
    const amp = addBook('1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ', 'Readings').sheets[0]; amp.setName('Amp Rec');
    [['#','Cable','Motor A','Ref',''],['','','','',''],['1','C-1','Shredder motor','40',''],['2','C-2','Fan motor','10','']].forEach((r, i) => r.forEach((v, j) => amp.put(i + 1, j + 1, v)));
    const es = addBook('1sI07XLIaK3yQ2f199dVGX0IvQuRdzMG7L6WYOnXC9k8', 'Equipment').sheets[0];
    [['Equipment Name','Equipment Number','Line','Location','Category','Record Status','Automation task'],['Shredder','SH-1','Line 1','Hall A','Shredder','',''],['Conveyor','BC-16','Line 1','Hall A','Conveyor','','']].forEach((r, i) => r.forEach((v, j) => es.put(i + 1, j + 1, v)));
    const cb = addBook('checks1', 'Checks'); store.CHECKS_SS_ID = 'checks1'; const cl = cb.sheets[0]; cl.setName('Bobcat Checklist');
    [['Section','Item','Input','Frequency','Photo','Active'],['Engine','Oil level','check','daily','no','Yes'],['Engine','Brakes','check','daily','no','Yes']].forEach(r => cl.appendRow(r));
    cb.insertSheet('Units'); [['Type','Unit','Active'],['Bobcat','Bobcat 1','Yes']].forEach(r => cb.getSheetByName('Units').appendRow(r));
    const sp = addBook('1XtqChR5bn9b0MwW4N3Q85oF8WAxLhIJYJkPhdn5vNzw', 'Maintainance Inventory');
    const el = sp.sheets[0]; el.id = 816261843; el.setName('Inventory Elct-Spare parts');
    [['#','Part/Item No.','Brand','Description','# Quantity'],['1','E-100','ABB','Contactor 24V','5'],['2','E-200','Siemens','Overload relay','0'],['3','E-300','Omron','Proximity sensor','20']].forEach(r => el.appendRow(r));
    const me = sp.insertSheet('Mechanical'); me.id = 1717920569;
    [['Part No.','Part Name','Required Qty','Available Qty','Used Qty','Remaining Qty','Status','Machine'],['M-7','Shredder blade','10','8','2','6','OK','Shredder'],['M-8','Conveyor bearing','4','12','1','11','OK','Conveyor']].forEach(r => me.appendRow(r));
    const keys = Object.keys(sandbox);
    const fn = new Function(...keys, src + '\n;return { doPost, taskCreate, automationCycle, tasksBook };');
    const api = fn(...keys.map(k => sandbox[k]));
    const call = body => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(body) } }).s);
    const t = call({ action: 'login', username: 'sup', pin: '1111' }).token, as = b => call({ ...b, token: t });
    as({ action: 'taskCreate', task: { title: 'Replace conveyor belt (needs note + approval)', assignee: 'tech1', due: new Date(Date.now() + 864e5).toISOString().slice(0, 10), priority: 'High', category: 'Mechanical', needNote: true, needApproval: true, details: 'Line 2 - belt is worn' } });
    as({ action: 'taskCreate', task: { title: 'Take photo of pump (photo required)', assignee: 'tech1', due: new Date(Date.now() - 864e5).toISOString().slice(0, 10), category: 'Electrical', needPhoto: true } });
    as({ action: 'taskRuleCreate', task: { title: 'Weekly lubrication', equipment: 'Shredder', equipmentNo: 'SH-1', due: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), category: 'Mechanical' }, auto: { basis: 'period', period: 'Weekly', assignees: ['tech1'] } });
    as({ action: 'taskRuleCreate', task: { title: 'Belt inspection', equipment: 'Conveyor', equipmentNo: 'BC-16', due: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10) }, auto: { basis: 'period', period: 'Monthly', assignees: ['tech2'] } });
    as({ action: 'meterAdd', meter: { no: 'SH-1', reading: '1200', note: 'Starting value' } });
    as({ action: 'limitSave', limit: { page: 'Amp Rec', row: 3, label: 'C-1 · Shredder motor', max: '45', assignee: 'tech2', priority: 'High' } });
    as({ action: 'taskTemplateSave', template: { name: 'Weekly grease round', title: 'Grease all bearings', category: 'Mechanical', needNote: true, priority: 'Normal' } });
    as({ action: 'meterAdd', meter: { no: 'SH-1', name: 'Oil pressure', unit: 'PSI', reading: '42' } });
    as({ action: 'taskCreate', task: { title: 'Clear the feed jam (tech1 can scan SH-1)', assignee: 'tech1', equipment: 'Shredder', equipmentNo: 'SH-1', line: 'Line 1', due: new Date(Date.now() + 864e5).toISOString().slice(0, 10) } });
    // Parts Inventory: a vendor, prices, and a few stock movements
    as({ action: 'vendorSave', vendor: { name: 'ABB Saudi Arabia', phone: '+966 12 000 0000', email: 'sales@abb.example', notes: 'Contactors and relays' } });
    as({ action: 'vendorSave', vendor: { name: 'Jeddah Bearings Co.', phone: '+966 12 111 1111' } });
    as({ action: 'partDetails', part: { kind: 'electrical', no: 'E-100', cost: '45', vendorId: 'V001', min: '3', bin: 'Shelf B2' } });
    as({ action: 'partDetails', part: { kind: 'electrical', no: 'E-300', cost: '12.5', min: '5', bin: 'Shelf C1' } });
    as({ action: 'partDetails', part: { kind: 'mechanical', no: 'M-7', cost: '320', vendorId: 'V002' } });
    as({ action: 'partReceive', part: { kind: 'electrical', no: 'E-300', qty: '10', cost: '12.5', note: 'PO 1042' } });
    as({ action: 'partUse', part: { kind: 'electrical', no: 'E-100', qty: '2', note: 'Shredder contactor' } });
    // finished work orders so the Reporting page has numbers
    const tt = call({ action: 'login', username: 'tech1', pin: '2222' }).token;
    ['Grease the shredder bearings', 'Replace belt guard', 'Check hydraulic hoses'].forEach((ti, i) => {
      const id = as({ action: 'taskCreate', task: { title: ti, assignee: 'tech1', equipment: 'Shredder', equipmentNo: 'SH-1', category: i === 1 ? 'Electrical' : 'Mechanical', due: new Date(Date.now() + 864e5).toISOString().slice(0, 10) } }).task.id;
      call({ action: 'taskUpdate', token: tt, id: id, status: 'Done', note: 'Done', hours: String(1 + i * 0.5) });
    });
    // a little downtime history on the Shredder, and the Conveyor offline right now
    const dsh = api.tasksBook().getSheetByName('Downtime'), fmt = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
    const D = (n, no, name, type, cause, a, b, note) => dsh.appendRow([n, no, name, type, cause, fmt(a), b ? fmt(b) : '', b ? String(Math.round((b - a) / 60000)) : '', note, '', 'sup', b ? 'sup' : '', b ? 'Online' : 'Offline']);
    const H = 36e5, now = Date.now();
    D('D0001', 'SH-1', 'Shredder', 'Unplanned', 'Material jam', now - 20 * 24 * H, now - 20 * 24 * H + 50 * 6e4, 'Jam at the feed');
    D('D0002', 'SH-1', 'Shredder', 'Unplanned', 'Electrical fault', now - 9 * 24 * H, now - 9 * 24 * H + 140 * 6e4, 'Contactor burnt');
    D('D0003', 'SH-1', 'Shredder', 'Planned', 'Planned maintenance', now - 3 * 24 * H, now - 3 * 24 * H + 60 * 6e4, 'Blade change');
    D('D0004', 'BC-16', 'Conveyor', 'Unplanned', 'Mechanical wear', now - 2 * H, null, 'Belt slipping');
    // Release 6: a signature-required work order with an extra asset, a comment, and two open requests
    const wo6 = as({ action: 'taskCreate', task: { title: 'Replace drive belt (signature required)', assignee: 'tech1', equipment: 'Shredder', equipmentNo: 'SH-1', needSignature: true, assets: [{ no: 'BC-16' }], due: new Date(Date.now() + 864e5).toISOString().slice(0, 10) } }).task.id;
    call({ action: 'commentAdd', token: call({ action: 'login', username: 'sup', pin: '1111' }).token, id: wo6, text: 'Please sign when finished @tech1' });
    call({ action: 'requestCreate', token: tt, request: { title: 'Conveyor belt is slipping', details: 'Started this morning', assetNo: 'BC-16', asset: 'Conveyor', urgency: 'High' } });
    call({ action: 'requestCreate', token: tt, request: { title: 'Light is out in hall A', urgency: 'Low' } });
    // Release 7: a procedure (with a conditional step), a run attached to a work order, purchase orders, time off and scheduled jobs
    try {
    const pr = as({ action: 'procedureSave', procedure: { name: 'Shredder start-up check', category: 'Mechanical', steps: [{ text: 'Guard in place and bolts tight', type: 'passfail', required: true }, { text: 'Describe the damage', type: 'text', required: true, showIf: { step: 0, when: 'fail' } }, { text: 'Motor temperature', type: 'number', min: 20, max: 80, unit: 'C', required: true }] } });
    const woP = as({ action: 'taskCreate', task: { title: 'Weekly shredder start-up (procedure)', assignee: 'tech1', equipment: 'Shredder', equipmentNo: 'SH-1', procedure: pr.id || (pr.procedure && pr.procedure.id) || 'P-001', due: new Date(Date.now() + 864e5).toISOString().slice(0, 10) } });
    const po1 = as({ action: 'poCreate', po: { note: 'Stock up before shutdown', lines: [{ kind: 'mechanical', no: 'M-7', qty: 4, cost: 120 }, { kind: 'mechanical', no: 'M-8', qty: 6, cost: 35 }] } });
    as({ action: 'poDecide', id: po1.id, decision: 'approve' }); as({ action: 'poOrder', id: po1.id });
    as({ action: 'poCreate', po: { note: 'Needed for next week', lines: [{ kind: 'mechanical', no: 'M-7', qty: 2, cost: 120 }] } });
    const d = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    as({ action: 'timeOffAdd', timeOff: { username: 'tech2', from: d(2), to: d(3), type: 'Leave', note: 'Family' } });
    as({ action: 'taskCreate', task: { title: 'Grease conveyor bearings', assignee: 'tech2', due: d(1), equipment: 'Conveyor', equipmentNo: 'BC-16' } });
    as({ action: 'taskCreate', task: { title: 'Unscheduled: check lighting', assignee: 'tech2' } });
    } catch (e) { console.warn('R7 seed skipped', e); }
    // Release 8: cost rates, parts with a price used on a finished job, downtime, the open fault form with one public report
    try {
      as({ action: 'settingsSave', settings: { laborRate: 45, downtimeRate: 300, publicForm: true } });
      as({ action: 'partReceive', part: { kind: 'mechanical', no: 'M-7', qty: 10, cost: 120 } });
      const wc = as({ action: 'taskCreate', task: { title: 'Replace shredder blades', assignee: 'tech1', equipment: 'Shredder', equipmentNo: 'SH-1' } }).task.id;
      as({ action: 'taskUpdate', id: wc, status: 'In progress' });
      as({ action: 'partUse', part: { kind: 'mechanical', no: 'M-7', qty: 2, order: wc } });
      as({ action: 'taskUpdate', id: wc, status: 'Done', note: 'Blades changed', hours: 3 });
      call({ action: 'publicReport', title: 'Guard is loose on the shredder', details: 'Rattles when running', assetNo: 'SH-1', name: 'Ali (production)', device: 'preview1' });
    } catch (e) { console.warn('R8 seed skipped', e); }
    window.__previewCall = call; window.__previewCycle = api.automationCycle;
  }
  const ready = boot();
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts) => {
    if (String(url).indexOf('script.google.com') < 0) return realFetch(url, opts);
    await ready; await new Promise(r => setTimeout(r, 150));
    const out = JSON.stringify(window.__previewCall(JSON.parse(opts.body)));
    return new Response(out, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  };
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {});   // no service worker in the preview
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;pointer-events:none;opacity:.9;background:#7c2d12;color:#fff;font:12px/1.4 system-ui;padding:6px 10px;text-align:center';
    b.textContent = 'PREVIEW with test data only. Supervisor: sup / 1111 · Technician: tech1 / 2222. Try: Work requests (tech1: Report a problem tile; sup: approve/decline), Comments, signature + photo markup on a work order, Reporting, Parts, Assets. Reload resets everything.';
    document.body.appendChild(b);
  });
})();
