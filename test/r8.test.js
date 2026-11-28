const assert = require('assert');
const { makeRuntime } = require('./gas_mock');
const CODE = process.env.CODE || '/home/claude/src/holoul-app/Code.gs';
let pass = 0, fail = 0; const failures = [];
function test(name, fn) { try { fn(); pass++; } catch (e) { fail++; failures.push(name + '\n     ' + String(e.message).split('\n').slice(0, 3).join('\n     ')); } }

function setup() {
  const rt = makeRuntime(CODE);
  const us = rt.addBook('1ohP2VDJitA_ZxiY3Sk6V22Z6yGHZjvgsBg58pMwac_4', 'Users').sheets[0]; us.setName('Users');
  [['User ID', 'Full Name', 'Username', 'PIN', 'Active', 'Role', 'Assigned Equipment', 'Create tasks', 'Edit equipment', 'Edit spare parts'],
   ['1', 'Sam Super', 'sup', '1111', 'Yes', 'Supervisor', '', '', '', ''], ['2', 'Tom Tech', 'tech1', '2222', 'Yes', 'Mech-Technician', '', 'No', 'No', 'No'],
   ['3', 'Eli Elec', 'tech2', '2223', 'Yes', 'Elec-Technician', '', 'No', 'No', 'No'], ['6', 'Sparky', 'sparky', '5555', 'Yes', 'Elec-Technician', '', 'No', 'No', 'Yes'],
   ['7', 'Opal Ops', 'ops', '6666', 'Yes', 'Operations Manager', '', '', '', '']].forEach(r => us.appendRow(r));
  const amp = rt.addBook('1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ', 'Readings').sheets[0]; amp.setName('Amp Rec');
  [['#', 'Cable', 'Motor A', 'Ref', ''], ['', '', '', '', ''], ['1', 'C-1', 'Shredder motor', '40', ''], ['2', 'C-2', 'Fan motor', '10', '']].forEach((r, i) => r.forEach((v, j) => amp.put(i + 1, j + 1, v)));
  const es = rt.addBook('1sI07XLIaK3yQ2f199dVGX0IvQuRdzMG7L6WYOnXC9k8', 'Equipment').sheets[0];
  es.appendRow(['Equipment Name', 'Equipment Number', 'Line', 'Location', 'Category', 'Record Status', 'Automation task']); es.appendRow(['Shredder', 'SH-1', 'L1', 'Hall A', 'Shredder', '', '']); es.appendRow(['Conveyor', 'BC-16', 'L1', 'Hall A', 'Conveyor', '', '']);
  const cb = rt.addBook('checks1', 'Checks'); rt.props.CHECKS_SS_ID = 'checks1'; cb.sheets[0].setName('Bobcat Checklist'); cb.insertSheet('Bobcat Log').appendRow(['Timestamp', 'Date', 'Unit', 'Hour Meter Reading']);
  const sp = rt.addBook('1XtqChR5bn9b0MwW4N3Q85oF8WAxLhIJYJkPhdn5vNzw', 'Inventory');
  const el = sp.sheets[0]; el.id = 816261843; el.setName('Inventory Elct-Spare parts');
  [['#', 'Part/Item No.', 'Brand', 'Description', '# Quantity'], ['1', 'E-100', 'ABB', 'Contactor 24V', '5'], ['2', 'E-200', 'Siemens', 'Relay', '0'], ['3', 'E-300', 'Omron', 'Sensor', '20']].forEach(r => el.appendRow(r));
  const me = sp.insertSheet('Mechanical'); me.id = 1717920569;
  [['Part No.', 'Part Name', 'Required Qty', 'Available Qty', 'Used Qty', 'Remaining Qty', 'Status', 'Machine'], ['M-7', 'Shredder blade', '5', '20', '2', '18', 'OK', 'Shredder'], ['M-8', 'Bearing', '10', '10', '0', '10', 'OK', 'Conveyor']].forEach(r => me.appendRow(r));
  const tok = {}; ['sup:1111', 'tech1:2222', 'tech2:2223', 'sparky:5555', 'ops:6666'].forEach(x => { const [u, pin] = x.split(':'); tok[u] = rt.call({ action: 'login', username: u, pin }).token; });
  const as = (u, b) => rt.call(Object.assign({ token: tok[u] }, b));
  return { rt, as, api: rt.api, call: b => rt.call(b) };
}
const wo = (S, extra, who) => S.as('sup', { action: 'taskCreate', task: Object.assign({ title: 'Fix', assignee: who || 'tech1' }, extra || {}) }).task.id;
const fin = (S, id, hours, who) => S.as(who || 'tech1', { action: 'taskUpdate', id, status: 'Done', note: 'ok', hours });
const startT = (S, id, who) => S.as(who || 'tech1', { action: 'taskUpdate', id, status: 'In progress' });
const usePart = (S, id, no, qty, kind) => S.as('sup', { action: 'partUse', part: { kind: kind || 'mechanical', no, qty, order: id } });

/* ---------- settings ---------- */
test('settings: only supervisors; rates validated; form is off by default', () => {
  const S = setup();
  const g = S.as('sup', { action: 'settings' }); assert(g.ok && g.publicForm === false && g.laborRate === 0 && g.downtimeRate === 0 && g.currency === 'SAR', JSON.stringify(g));
  assert.strictEqual(S.as('tech1', { action: 'settings' }).ok, false); assert.strictEqual(S.as('tech1', { action: 'settingsSave', settings: { laborRate: 5, publicForm: true } }).ok, false); const g2 = S.as('sup', { action: 'settings' }); assert(g2.laborRate === 0 && g2.publicForm === false, 'a technician changed a setting');
  const r = S.as('sup', { action: 'settingsSave', settings: { laborRate: '45,5', downtimeRate: 300, publicForm: true } });
  assert(r.ok && r.laborRate === 45.5 && r.downtimeRate === 300 && r.publicForm === true, JSON.stringify(r));
  assert.strictEqual(S.as('sup', { action: 'settingsSave', settings: { laborRate: -1 } }).ok, false); assert.strictEqual(S.as('sup', { action: 'settingsSave', settings: { laborRate: 'abc' } }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'settings' }).laborRate, 45.5);
});

/* ---------- cost per machine ---------- */
function costWorld() {
  const S = setup();
  S.as('sup', { action: 'settingsSave', settings: { laborRate: 50, downtimeRate: 200 } });
  S.as('sup', { action: 'partReceive', part: { kind: 'mechanical', no: 'M-7', qty: 10, cost: 100 } });          // blade 100 each
  const a = wo(S, { equipment: 'Shredder', equipmentNo: 'SH-1' }); startT(S, a); usePart(S, a, 'M-7', 2); fin(S, a, 3);   // parts 200 + labor 3h x 50
  const b = wo(S, { equipment: 'Conveyor', equipmentNo: 'BC-16' }); startT(S, b); fin(S, b, 1);                       // labor 50
  return { S, a, b };
}
test('cost: parts at stored price + labor hours x rate, per machine, biggest first', () => {
  const { S } = costWorld(); const r = S.as('sup', { action: 'costReport' }); assert(r.ok, JSON.stringify(r));
  const sh = r.rows.find(x => x.no === 'SH-1'), cv = r.rows.find(x => x.no === 'BC-16');
  assert.strictEqual(sh.parts, 200); assert.strictEqual(sh.labor, 150); assert.strictEqual(sh.hours, 3); assert.strictEqual(sh.total, 350);
  assert.strictEqual(cv.parts, 0); assert.strictEqual(cv.labor, 50); assert.strictEqual(cv.total, 50);
  assert.strictEqual(r.rows[0].no, 'SH-1'); assert.strictEqual(r.totals.total, 400); assert.strictEqual(r.totals.parts, 200); assert.strictEqual(r.totals.labor, 200);
});
test('cost: a returned part lowers the cost; unpriced parts are flagged', () => {
  const { S, a } = costWorld();
  S.as('sup', { action: 'partUse', part: { kind: 'mechanical', no: 'M-7', qty: 1, order: a, type: 'Returned' } });
  assert.strictEqual(S.as('sup', { action: 'costReport' }).rows.find(x => x.no === 'SH-1').parts, 100);
  const c = wo(S, { equipment: 'Conveyor', equipmentNo: 'BC-16' }); startT(S, c); usePart(S, c, 'M-8', 1);   // M-8 has no price
  const row = S.as('sup', { action: 'costReport' }).rows.find(x => x.no === 'BC-16'); assert.strictEqual(row.unpriced, 1); assert.strictEqual(row.parts, 0);
});
test('cost: downtime hours x downtime rate, an open stop counts up to now', () => {
  const { S } = costWorld();
  const d1 = S.as('sup', { action: 'downtimeStart', downtime: { no: 'SH-1', type: 'Unplanned', cause: 'Mechanical wear' } }); assert(d1.ok, JSON.stringify(d1)); S.rt.advance(90 * 60e3);
  const d2 = S.as('sup', { action: 'downtimeEnd', downtime: { no: 'SH-1' } }); assert(d2.ok, JSON.stringify(d2));
  S.as('sup', { action: 'downtimeStart', downtime: { no: 'BC-16', type: 'Unplanned', cause: 'Mechanical wear' } }); S.rt.advance(30 * 60e3);   // still open
  const r = S.as('sup', { action: 'costReport' }); assert(r.ok, JSON.stringify(r)); const sh = r.rows.find(x => x.no === 'SH-1'), cv = r.rows.find(x => x.no === 'BC-16');
  assert.strictEqual(sh.downHours, 1.5); assert.strictEqual(sh.downCost, 300); assert.strictEqual(sh.total, 650);
  assert.strictEqual(cv.downHours, 0.5); assert.strictEqual(cv.downCost, 100);
});
test('cost: a work order on two machines splits its cost; period filter; detail list for one machine', () => {
  const S = setup(); S.as('sup', { action: 'settingsSave', settings: { laborRate: 60 } });
  const id = wo(S, { equipment: 'Shredder', equipmentNo: 'SH-1', assets: [{ no: 'BC-16' }] }); startT(S, id); fin(S, id, 4);
  const r = S.as('sup', { action: 'costReport', no: 'SH-1' });
  assert.strictEqual(r.rows.find(x => x.no === 'SH-1').labor, 120); assert.strictEqual(r.rows.find(x => x.no === 'BC-16').labor, 120); assert.strictEqual(r.totals.labor, 240);
  const d = r.rows.find(x => x.no === 'SH-1').orders; assert(d.length === 1 && d[0].id === id && d[0].labor === 120 && d[0].hours === 2, JSON.stringify(d));
  assert.strictEqual(r.rows.find(x => x.no === 'BC-16').orders, undefined);
  const old = S.as('sup', { action: 'costReport', from: '2026-01-01', to: '2026-01-31' }); assert(old.ok && old.rows.length === 0 && old.totals.total === 0);
  assert.strictEqual(S.as('sup', { action: 'costReport', from: '2026-12-01', to: '2026-11-01' }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'costReport', from: '2020-01-01', to: '2026-11-01' }).ok, false);
});
test('cost: parts on a two-machine work order are split; parts taken before the period are left out', () => {
  const S = setup(); S.as('sup', { action: 'partReceive', part: { kind: 'mechanical', no: 'M-7', qty: 10, cost: 100 } });
  const id = wo(S, { equipment: 'Shredder', equipmentNo: 'SH-1', assets: [{ no: 'BC-16' }] }); startT(S, id); usePart(S, id, 'M-7', 2);
  let r = S.as('sup', { action: 'costReport' }); assert.strictEqual(r.rows.find(x => x.no === 'SH-1').parts, 100); assert.strictEqual(r.rows.find(x => x.no === 'BC-16').parts, 100); assert.strictEqual(r.totals.parts, 200);
  r = S.as('sup', { action: 'costReport', from: '2026-11-30', to: '2026-12-31' }); assert.strictEqual(r.totals.parts, 0);
  r = S.as('sup', { action: 'costReport', from: '2026-11-01', to: '2026-11-28' }); assert.strictEqual(r.totals.parts, 0);
  r = S.as('sup', { action: 'costReport', from: '2026-11-29', to: '2026-11-29' }); assert.strictEqual(r.totals.parts, 200);
});
test('cost: presets (30 days, month, year) are worked out on the server', () => {
  const { S } = costWorld();   // mock clock: Sunday 29 Nov 2026
  const r30 = S.as('sup', { action: 'costReport', period: '30' }); assert(r30.ok && r30.from === '2026-10-31' && r30.to === '2026-11-29' && r30.totals.total === 400, JSON.stringify([r30.from, r30.to, r30.totals]));
  const m = S.as('sup', { action: 'costReport', period: 'month' }); assert(m.from === '2026-11-01' && m.to === '2026-11-29' && m.totals.total === 400);
  const y = S.as('sup', { action: 'costReport', period: 'year' }); assert(y.from === '2026-01-01' && y.totals.total === 400);
  const d = S.as('sup', { action: 'costReport', period: '90', from: '2020-01-01' }); assert(d.from === '2026-09-01', d.from);   // a preset wins over stray dates
  S.rt.advance(40 * 864e5); const tk = S.call({ action: 'login', username: 'sup', pin: '1111' }).token; assert.strictEqual(S.call({ action: 'costReport', token: tk, period: '30' }).totals.total, 0);   // 40 days later the old work is outside 30 days
});
test('cost: money is for supervisors only', () => {
  const { S } = costWorld(); assert.strictEqual(S.as('tech1', { action: 'costReport' }).ok, false); assert.strictEqual(S.as('sparky', { action: 'costReport' }).ok, false); assert(S.as('ops', { action: 'costReport' }).ok);
});
test('cost: cancelled / not-done work orders do not count labor', () => {
  const S = setup(); S.as('sup', { action: 'settingsSave', settings: { laborRate: 50 } });
  const id = wo(S, { equipmentNo: 'SH-1', equipment: 'Shredder' }); assert.strictEqual(S.as('sup', { action: 'costReport' }).totals.labor, 0); assert(id);
});

/* ---------- public fault form ---------- */
const pub = (S, extra) => S.call(Object.assign({ action: 'publicReport', title: 'Belt is slipping', assetNo: 'BC-16', name: 'Ali', device: 'dev1' }, extra || {}));
test('public form: switched off by default — nothing is accepted and the machine name is not revealed', () => {
  const S = setup(); assert.strictEqual(pub(S).ok, false); assert(/switched off/.test(pub(S).error)); assert.strictEqual(S.call({ action: 'publicAsset', no: 'SH-1' }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'requestList' }).requests.length, 0);
});
test('public form: lookup shows only the machine name; report lands in the normal inbox as (public)', () => {
  const S = setup(); S.as('sup', { action: 'settingsSave', settings: { publicForm: true } });
  const a = S.call({ action: 'publicAsset', no: 'SH-1' }); assert(a.ok && a.asset.name === 'Shredder' && a.asset.no === 'SH-1' && Object.keys(a.asset).sort().join() === 'line,name,no', JSON.stringify(a));
  assert.strictEqual(S.call({ action: 'publicAsset', no: 'ZZ' }).ok, false);
  const r = pub(S, { details: 'Started this morning', urgency: 'High' }); assert(r.ok && /^R-/.test(r.id), JSON.stringify(r));
  const q = S.as('sup', { action: 'requestList' }).requests[0]; assert(q.by === '(public)' && q.name === 'Ali' && q.title === 'Belt is slipping' && q.asset === 'Conveyor' && q.assetNo === 'BC-16' && q.urgency === 'High' && q.status === 'Pending', JSON.stringify(q));
  assert.strictEqual(S.as('tech1', { action: 'requestList' }).requests.length, 0);
  const ap = S.as('sup', { action: 'requestDecide', id: r.id, decision: 'approve', assignee: 'tech1' }); assert(ap.ok && ap.order, JSON.stringify(ap));    // answering works, nobody to notify
});
test('public form: managers get a push; Urgent is not allowed; a typed machine works; blank/short input refused', () => {
  const S = setup(); S.as('sup', { action: 'settingsSave', settings: { publicForm: true } });
  S.api.tasksBook().getSheetByName('Push Devices').appendRow(['sup', 'https://push.example/sup', 'k', 'a', 'Android', '2026-11-01 08:00', '', '']);
  const r = pub(S, { urgency: 'Urgent', assetNo: '', asset: 'Old press' }); assert(r.ok, JSON.stringify(r));
  const q = S.as('sup', { action: 'requestList' }).requests[0]; assert.strictEqual(q.urgency, 'Normal'); assert.strictEqual(q.asset, 'Old press'); assert.strictEqual(q.assetNo, '');
  assert(S.as('sup', { action: 'pushInbox' }).messages.some(m => m.kind === 'request'));
  assert.strictEqual(pub(S, { title: '  ' }).ok, false); assert.strictEqual(pub(S, { title: 'abc' }).ok, false); assert.strictEqual(pub(S, { assetNo: '', asset: '' }).ok, false);
  assert.strictEqual(pub(S, { assetNo: 'NOPE', asset: '' }).ok, false);
});
test('public form: honeypot field stores nothing', () => {
  const S = setup(); S.as('sup', { action: 'settingsSave', settings: { publicForm: true } });
  const r = pub(S, { website: 'http://spam.example' }); assert(r.ok); assert.strictEqual(S.as('sup', { action: 'requestList' }).requests.length, 0);
});
test('public form: 3 an hour per phone, 4 an hour per machine', () => {
  const S = setup(); S.as('sup', { action: 'settingsSave', settings: { publicForm: true } });
  for (let i = 0; i < 3; i++) assert(pub(S, { title: 'Problem number ' + i }).ok);
  const r = pub(S, { title: 'Problem again' }); assert.strictEqual(r.ok, false); assert(/Too many/.test(r.error));
  assert(pub(S, { title: 'Other phone', device: 'dev2' }).ok);
  const m = pub(S, { title: 'Fifth on machine', device: 'dev3' }); assert.strictEqual(m.ok, false);
  S.rt.advance(61 * 60e3); S.rt.api.CacheService && 0;
});
test('public form: 20 an hour overall', () => {
  const S = setup(); S.as('sup', { action: 'settingsSave', settings: { publicForm: true } });
  for (let i = 0; i < 20; i++) { const r = pub(S, { title: 'Spread ' + i, assetNo: '', asset: 'Machine ' + i, device: 'dev' + i }); assert(r.ok, i + ' ' + JSON.stringify(r)); }
  const r = pub(S, { title: 'Twenty-first', assetNo: '', asset: 'Machine 99', device: 'dev99' }); assert.strictEqual(r.ok, false); assert(/Too many/.test(r.error));
});
test('public form: not more than 40 waiting', () => {
  const S = setup(); S.as('sup', { action: 'settingsSave', settings: { publicForm: true } });
  const sh = S.api.tasksBook().getSheetByName('Work Requests'); for (let i = 0; i < 40; i++) sh.appendRow(['R-9' + i, '2026-11-29 08:00', '(public)', 'x', 't' + i, '', '', 'm', 'Normal', '', 'Pending', '', '', '', '']);
  const r = pub(S, { device: 'fresh' }); assert.strictEqual(r.ok, false); assert(/full/.test(r.error), JSON.stringify(r));
});
test('public form: switching it off again stops it; a signed-in user cannot be impersonated by name', () => {
  const S = setup(); S.as('sup', { action: 'settingsSave', settings: { publicForm: true } }); assert(pub(S).ok);
  S.as('sup', { action: 'settingsSave', settings: { publicForm: false } }); assert.strictEqual(pub(S, { device: 'z' }).ok, false);
  S.as('sup', { action: 'settingsSave', settings: { publicForm: true } }); pub(S, { name: 'sup', device: 'y', title: 'Another problem' });
  assert.strictEqual(S.as('sup', { action: 'requestList' }).requests.every(r => r.by === '(public)'), true);
});

/* ---------- unusual readings ---------- */
function saveOn(S, d, v, row) {   // the app only takes readings up to 7 days back, so move the clock to that day
  const now = S.rt.now(); S.rt.setNow(Date.parse(d + 'T09:00:00Z'));
  const r = S.as('tech2', { action: 'saveReading', sheet: 'Amp Rec', row: row || 3, value: v, date: d }); S.rt.setNow(now); assert(r.ok, JSON.stringify(r));
}
function history(S, vals, row) {
  vals.forEach((v, i) => saveOn(S, '2026-11-' + String(10 + i).padStart(2, '0'), v, row));
}
test('readings: the sheet gives the last readings (low, high, middle) once there are 3 or more', () => {
  const S = setup(); history(S, [38, 40, 41, 39, 42]);
  const g = S.as('tech2', { action: 'getSheet', sheet: 'Amp Rec', date: '2026-11-29' }); const row = g.rows.find(r => r.row === 3);
  assert(row.usual && row.usual.lo === 38 && row.usual.hi === 42 && row.usual.med === 40 && row.usual.n === 5, JSON.stringify(row));
  assert.strictEqual(g.rows.find(r => r.row === 4).usual, undefined);                // no history on row 4
});
test('readings: fewer than 3 earlier values, text values and today itself are ignored; only the last 10 days count', () => {
  const S = setup(); history(S, [40, 41]); assert.strictEqual(S.as('tech2', { action: 'getSheet', sheet: 'Amp Rec', date: '2026-11-29' }).rows.find(r => r.row === 3).usual, undefined);
  history(S, [40, 41, 'n/a', 39]);
  let u = S.as('tech2', { action: 'getSheet', sheet: 'Amp Rec', date: '2026-11-29' }).rows.find(r => r.row === 3).usual; assert(u && u.n === 3, JSON.stringify(u));
  saveOn(S, '2026-11-29', 500);
  u = S.as('tech2', { action: 'getSheet', sheet: 'Amp Rec', date: '2026-11-29' }).rows.find(r => r.row === 3).usual; assert.strictEqual(u.hi < 100, true);
  const S2 = setup(); for (let i = 0; i < 14; i++) saveOn(S2, '2026-11-' + String(1 + i).padStart(2, '0'), i < 4 ? 900 : 40);
  u = S2.as('tech2', { action: 'getSheet', sheet: 'Amp Rec', date: '2026-11-29' }).rows.find(r => r.row === 3).usual; assert(u.n === 10 && u.hi === 40, JSON.stringify(u));
});
test('readings: a row with fewer than 3 numbers gets no usual range even if other rows do', () => {
  const S = setup(); history(S, [40, 41, 39], 3); saveOn(S, '2026-11-10', 9, 4); saveOn(S, '2026-11-11', 10, 4);
  const rows = S.as('tech2', { action: 'getSheet', sheet: 'Amp Rec', date: '2026-11-29' }).rows; assert(rows.find(r => r.row === 3).usual); assert.strictEqual(rows.find(r => r.row === 4).usual, undefined);
});
test('readings: the supervisor limit comes with the row', () => {
  const S = setup(); S.as('sup', { action: 'limitSave', limit: { page: 'Amp Rec', row: 3, label: 'Shredder motor', min: '5', max: '45', assignee: 'tech2' } });
  const rows = S.as('tech2', { action: 'getSheet', sheet: 'Amp Rec', date: '2026-11-29' }).rows;
  assert.deepStrictEqual(rows.find(r => r.row === 3).limit, { min: 5, max: 45 }); assert.strictEqual(rows.find(r => r.row === 4).limit, undefined);
});

/* ---------- housekeeping ---------- */
test('version is 20', () => { const S = setup(); assert.strictEqual(JSON.parse(S.rt.api.doGet({}).s).version, 20); });
test('public actions need no token, other actions still do', () => { const S = setup(); assert.strictEqual(S.call({ action: 'costReport' }).ok, false); assert.strictEqual(S.call({ action: 'settings' }).ok, false); });

console.log('r8: ' + pass + ' passed, ' + fail + ' failed'); failures.forEach(f => console.log('  FAIL ' + f)); process.exit(fail ? 1 : 0);
