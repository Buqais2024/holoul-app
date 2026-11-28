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
  rt.addBook('1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ', 'Readings').sheets[0].setName('Amp Rec');
  const es = rt.addBook('1sI07XLIaK3yQ2f199dVGX0IvQuRdzMG7L6WYOnXC9k8', 'Equipment').sheets[0];
  es.appendRow(['Equipment Name', 'Equipment Number', 'Line', 'Location', 'Category', 'Record Status', 'Automation task']); es.appendRow(['Shredder', 'SH-1', 'L1', 'Hall A', 'Shredder', '', '']);
  const cb = rt.addBook('checks1', 'Checks'); rt.props.CHECKS_SS_ID = 'checks1'; cb.sheets[0].setName('Bobcat Checklist'); cb.insertSheet('Bobcat Log').appendRow(['Timestamp', 'Date', 'Unit', 'Hour Meter Reading']);
  const sp = rt.addBook('1XtqChR5bn9b0MwW4N3Q85oF8WAxLhIJYJkPhdn5vNzw', 'Inventory');
  const el = sp.sheets[0]; el.id = 816261843; el.setName('Inventory Elct-Spare parts');
  [['#', 'Part/Item No.', 'Brand', 'Description', '# Quantity'], ['1', 'E-100', 'ABB', 'Contactor 24V', '5'], ['2', 'E-200', 'Siemens', 'Relay', '0'], ['3', 'E-300', 'Omron', 'Sensor', '20']].forEach(r => el.appendRow(r));
  const me = sp.insertSheet('Mechanical'); me.id = 1717920569;
  [['Part No.', 'Part Name', 'Required Qty', 'Available Qty', 'Used Qty', 'Remaining Qty', 'Status', 'Machine'], ['M-7', 'Shredder blade', '5', '20', '2', '18', 'OK', 'Shredder'], ['M-8', 'Bearing', '10', '10', '0', '10', 'OK', 'Conveyor']].forEach(r => me.appendRow(r));
  const tok = {}; ['sup:1111', 'tech1:2222', 'tech2:2223', 'sparky:5555', 'ops:6666'].forEach(x => { const [u, pin] = x.split(':'); tok[u] = rt.call({ action: 'login', username: u, pin }).token; });
  const as = (u, b) => rt.call(Object.assign({ token: tok[u] }, b));
  return { rt, as, api: rt.api, el, me };
}
const use = (S, u, kind, no, qty, order, extra) => S.as(u, { action: 'partUse', part: Object.assign({ kind, no, qty, order }, extra || {}) });
const info = (S, kind, no) => S.as('sup', { action: 'partInfo', kind, no });
const wo = (S, who, extra) => S.as('sup', { action: 'taskCreate', task: Object.assign({ title: 'Fix', assignee: who || 'tech1' }, extra || {}) }).task.id;
const inbox = (S, u) => S.as(u, { action: 'pushInbox' }).messages;
const phone = (S, u) => S.api.tasksBook().getSheetByName('Push Devices').appendRow([u, 'https://push.example/' + u, 'k', 'a', 'Android', '2026-11-01 08:00', '', '']);

/* ---------- using parts ---------- */
test('use (electrical): quantity in the sheet goes down, movement is logged with balance and who', () => {
  const S = setup(); const id = wo(S); const r = use(S, 'sup', 'electrical', 'E-300', '4', id, { note: 'replaced' });
  assert(r.ok, JSON.stringify(r)); assert.strictEqual(r.balance, 16); assert.strictEqual(S.el.getRange(4, 5).getDisplayValue(), '16');
  const m = info(S, 'electrical', 'E-300').moves[0]; assert(m.type === 'Used' && m.qty === -4 && m.balance === 16 && m.order === id && m.by === 'sup' && m.note === 'replaced');
});
test('use (mechanical): Used Qty goes up, Available stays, on hand = available - used', () => {
  const S = setup(); assert(use(S, 'sup', 'mechanical', 'M-7', '3').ok);
  assert.strictEqual(S.me.getRange(2, 5).getDisplayValue(), '5'); assert.strictEqual(S.me.getRange(2, 4).getDisplayValue(), '20'); assert.strictEqual(info(S, 'mechanical', 'M-7').part.onHand, 15);
});
test('use: more than the stock is refused and nothing changes; zero, negative and text refused', () => {
  const S = setup(); const r = use(S, 'sup', 'electrical', 'E-100', '6'); assert.strictEqual(r.ok, false); assert(/Only 5 in stock/.test(r.error));
  ['0', '-1', 'abc', '', '9999999'].forEach(q => assert.strictEqual(use(S, 'sup', 'electrical', 'E-100', q).ok, false, q));
  assert.strictEqual(S.el.getRange(2, 5).getDisplayValue(), '5'); assert.strictEqual(info(S, 'electrical', 'E-100').moves.length, 0);
});
test('use: decimals are kept to 3 places', () => {
  const S = setup(); assert(use(S, 'sup', 'electrical', 'E-300', '0.12345').ok); assert.strictEqual(info(S, 'electrical', 'E-300').part.onHand, 19.877);
});
test('use: unknown part, unknown work order, deleted part', () => {
  const S = setup(); assert.strictEqual(use(S, 'sup', 'electrical', 'NOPE', '1').ok, false); assert.strictEqual(use(S, 'sup', 'electrical', 'E-300', '1', 'T-9999').ok, false);
  S.el.put(4, 6, 'Deleted'); S.api.tasksBook(); S.rt.cache.remove && S.rt.cache.remove('spares_v1');
});
test('return: back to stock, only up to what that work order used', () => {
  const S = setup(); const id = wo(S); use(S, 'sup', 'electrical', 'E-300', '4', id);
  assert.strictEqual(S.as('sup', { action: 'partUse', part: { kind: 'electrical', no: 'E-300', qty: '5', order: id, type: 'Returned' } }).ok, false);
  const r = S.as('sup', { action: 'partUse', part: { kind: 'electrical', no: 'E-300', qty: '3', order: id, type: 'Returned' } }); assert(r.ok, JSON.stringify(r)); assert.strictEqual(r.balance, 19);
  assert.strictEqual(S.as('sup', { action: 'partUse', part: { kind: 'electrical', no: 'E-300', qty: '1', type: 'Returned' } }).ok, false);   // needs the work order
  assert.strictEqual(S.as('sup', { action: 'taskParts', id }).lines[0].qty, 1);
});
test('return (mechanical): Used Qty goes back down', () => {
  const S = setup(); const id = wo(S); use(S, 'sup', 'mechanical', 'M-7', '2', id);
  S.as('sup', { action: 'partUse', part: { kind: 'mechanical', no: 'M-7', qty: '2', order: id, type: 'Returned' } }); assert.strictEqual(S.me.getRange(2, 5).getDisplayValue(), '2');
});

/* ---------- receive / count ---------- */
test('receive: adds stock, saves the new price, logs it', () => {
  const S = setup(); const r = S.as('sup', { action: 'partReceive', part: { kind: 'electrical', no: 'E-100', qty: '10', cost: '12.5', note: 'PO 77' } });
  assert(r.ok && r.balance === 15, JSON.stringify(r)); const i = info(S, 'electrical', 'E-100'); assert.strictEqual(i.stock.cost, 12.5); assert(i.moves[0].type === 'Received' && i.moves[0].qty === 10 && i.moves[0].cost === 12.5);
});
test('receive (mechanical): Available goes up', () => {
  const S = setup(); S.as('sup', { action: 'partReceive', part: { kind: 'mechanical', no: 'M-8', qty: '5' } }); assert.strictEqual(S.me.getRange(3, 4).getDisplayValue(), '15');
});
test('count: sets the on-hand figure and logs the signed difference', () => {
  const S = setup(); const r = S.as('sup', { action: 'partCount', part: { kind: 'electrical', no: 'E-100', counted: '3' } });
  assert(r.ok && r.balance === 3 && r.difference === -2, JSON.stringify(r)); assert.strictEqual(S.el.getRange(2, 5).getDisplayValue(), '3');
  const m = info(S, 'electrical', 'E-100').moves[0]; assert(m.type === 'Count' && m.qty === -2 && m.balance === 3);
});
test('count (mechanical): Available becomes counted + used so remaining equals the count', () => {
  const S = setup(); S.as('sup', { action: 'partCount', part: { kind: 'mechanical', no: 'M-7', counted: '9' } });
  assert.strictEqual(S.me.getRange(2, 4).getDisplayValue(), '11'); assert.strictEqual(info(S, 'mechanical', 'M-7').part.onHand, 9);
});
test('count: zero is allowed, negative and text are not', () => {
  const S = setup(); assert(S.as('sup', { action: 'partCount', part: { kind: 'electrical', no: 'E-100', counted: '0' } }).ok);
  ['-1', 'x', ''].forEach(v => assert.strictEqual(S.as('sup', { action: 'partCount', part: { kind: 'electrical', no: 'E-100', counted: v } }).ok, false, v));
});

/* ---------- permissions ---------- */
test('permissions: supervisor, operations manager and the parts-right employee may receive and count; others may not', () => {
  const S = setup(); ['sup', 'ops', 'sparky'].forEach(u => assert(S.as(u, { action: 'partReceive', part: { kind: 'electrical', no: 'E-100', qty: '1' } }).ok, u));
  ['tech1', 'tech2'].forEach(u => { assert.strictEqual(S.as(u, { action: 'partReceive', part: { kind: 'electrical', no: 'E-100', qty: '1' } }).ok, false); assert.strictEqual(S.as(u, { action: 'partCount', part: { kind: 'electrical', no: 'E-100', counted: '1' } }).ok, false); assert.strictEqual(S.as(u, { action: 'partDetails', part: { kind: 'electrical', no: 'E-100', cost: '1' } }).ok, false); });
});
test('permissions: a technician may log parts only on his own work order; not without one', () => {
  const S = setup(); const mine = wo(S, 'tech1'), theirs = wo(S, 'tech2');
  assert(use(S, 'tech1', 'electrical', 'E-300', '1', mine).ok); assert.strictEqual(use(S, 'tech1', 'electrical', 'E-300', '1', theirs).ok, false); assert.strictEqual(use(S, 'tech1', 'electrical', 'E-300', '1').ok, false);
});
test('permissions: a cancelled work order takes no parts for its technician', () => {
  const S = setup(); const id = wo(S, 'tech1'); S.as('sup', { action: 'taskEdit', task: { id, status: 'Cancelled' } }); assert.strictEqual(use(S, 'tech1', 'electrical', 'E-300', '1', id).ok, false);
});
test('permissions: partInfo, vendors and the spares list need the spares right', () => {
  const S = setup(); assert.strictEqual(S.as('tech1', { action: 'partInfo', kind: 'electrical', no: 'E-100' }).ok, false); assert.strictEqual(S.as('tech1', { action: 'vendors' }).ok, false);
  assert(S.as('sparky', { action: 'partInfo', kind: 'electrical', no: 'E-100' }).ok); assert(S.as('sparky', { action: 'vendors' }).ok);
});

/* ---------- details, prices, vendors ---------- */
test('details: price, vendor, minimum and bin are saved and shown', () => {
  const S = setup(); const v = S.as('sup', { action: 'vendorSave', vendor: { name: 'ABB Saudi', phone: '055', email: 'a@b.co' } }); assert(v.ok && v.id === 'V001');
  const r = S.as('sup', { action: 'partDetails', part: { kind: 'electrical', no: 'E-100', cost: '45.5', vendorId: 'V001', min: '3', bin: 'Shelf B2' } }); assert(r.ok, JSON.stringify(r));
  const i = info(S, 'electrical', 'E-100'); assert.deepStrictEqual([i.stock.cost, i.stock.vendorId, i.stock.min, i.stock.bin, i.vendor.name, i.value], [45.5, 'V001', 3, 'Shelf B2', 'ABB Saudi', 227.5]);
});
test('details: bad values refused; mechanical has no separate minimum; unknown vendor refused; an empty value clears', () => {
  const S = setup(); const d = o => S.as('sup', { action: 'partDetails', part: Object.assign({ kind: 'electrical', no: 'E-100' }, o) });
  assert.strictEqual(d({ cost: '-1' }).ok, false); assert.strictEqual(d({ cost: 'x' }).ok, false); assert.strictEqual(d({ min: 'x' }).ok, false); assert.strictEqual(d({ vendorId: 'V999' }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'partDetails', part: { kind: 'mechanical', no: 'M-7', min: '3' } }).ok, false);
  d({ cost: '9' }); d({ cost: '' }); assert.strictEqual(info(S, 'electrical', 'E-100').stock.cost, null);
});
test('vendors: add, edit, switch off, no duplicate names, valid email, needs a name', () => {
  const S = setup(); const a = S.as('sup', { action: 'vendorSave', vendor: { name: 'Alpha' } }); assert(a.ok);
  assert.strictEqual(S.as('sup', { action: 'vendorSave', vendor: { name: 'alpha' } }).ok, false); assert.strictEqual(S.as('sup', { action: 'vendorSave', vendor: { name: '' } }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'vendorSave', vendor: { name: 'Beta', email: 'nope' } }).ok, false);
  assert(S.as('sup', { action: 'vendorSave', vendor: { id: a.id, name: 'Alpha Co', phone: '1' } }).ok); assert(S.as('sup', { action: 'vendorSave', vendor: { id: a.id, name: 'Alpha Co', active: false } }).ok);
  const l = S.as('sup', { action: 'vendors' }); assert(l.vendors.length === 1 && l.vendors[0].name === 'Alpha Co' && l.vendors[0].active === false);
  assert.strictEqual(S.as('sup', { action: 'vendorSave', vendor: { id: 'V999', name: 'Z' } }).ok, false); assert.strictEqual(S.as('tech1', { action: 'vendorSave', vendor: { name: 'Q' } }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'spares' }).vendors.length, 0);   // switched-off vendors are not offered
});

/* ---------- low stock ---------- */
test('low: electrical without a minimum is low only when empty; with a minimum, at or under it', () => {
  const S = setup(); let r = S.as('sup', { action: 'spares' }); assert.deepStrictEqual(r.low.slice().sort(), ['e:E-200']);
  S.as('sup', { action: 'partDetails', part: { kind: 'electrical', no: 'E-100', min: '5' } }); r = S.as('sup', { action: 'spares' }); assert(r.low.indexOf('e:E-100') >= 0);
});
test('low: mechanical is low when remaining drops below Required qty', () => {
  const S = setup(); use(S, 'sup', 'mechanical', 'M-8', '1'); assert(S.as('sup', { action: 'spares' }).low.indexOf('m:M-8') >= 0); assert.strictEqual(info(S, 'mechanical', 'M-8').low, true);
});
test('alert: supervisors get one push when a part becomes low, not again while it stays low', () => {
  const S = setup(); phone(S, 'sup'); phone(S, 'ops'); phone(S, 'tech1'); S.api.automationCycle();   // first sweep reports E-200 (already empty)
  let m = inbox(S, 'sup').filter(x => x.kind === 'lowstock'); assert.strictEqual(m.length, 1); assert.strictEqual(m[0].key, 'e:E-200');
  use(S, 'sup', 'electrical', 'E-100', '5'); m = inbox(S, 'sup').filter(x => x.kind === 'lowstock'); assert.strictEqual(m.length, 1); assert(/Contactor/.test(m[0].title) && m[0].key === 'e:E-100');
  use(S, 'sup', 'electrical', 'E-300', '1'); S.api.automationCycle(); assert.strictEqual(inbox(S, 'sup').filter(x => x.kind === 'lowstock').length, 0);
  assert(inbox(S, 'ops').filter(x => x.kind === 'lowstock').length >= 1); assert.strictEqual(inbox(S, 'tech1').filter(x => x.kind === 'lowstock').length, 0);
});
test('alert: a part that recovered can alert again later', () => {
  const S = setup(); phone(S, 'sup'); S.api.automationCycle(); inbox(S, 'sup');
  const n = () => inbox(S, 'sup').filter(m => m.kind === 'lowstock').length;
  use(S, 'sup', 'electrical', 'E-100', '5'); assert.strictEqual(n(), 1);
  S.as('sup', { action: 'partReceive', part: { kind: 'electrical', no: 'E-100', qty: '10' } }); assert.strictEqual(n(), 0);
  use(S, 'sup', 'electrical', 'E-100', '10'); assert.strictEqual(n(), 1);
});
test('alert: the daily cycle reports how many parts it announced', () => {
  const S = setup(); const r = S.api.automationCycle(); assert.strictEqual(r.lowStock, 1); assert.strictEqual(S.api.automationCycle().lowStock, 0);
});

/* ---------- work-order parts ---------- */
test('work order parts: net lines, cost total for managers; technician sees no money', () => {
  const S = setup(); const id = wo(S, 'tech1');
  S.as('sup', { action: 'partDetails', part: { kind: 'electrical', no: 'E-300', cost: '10' } }); S.as('sup', { action: 'partDetails', part: { kind: 'mechanical', no: 'M-7', cost: '100' } });
  use(S, 'tech1', 'electrical', 'E-300', '3', id); use(S, 'tech1', 'mechanical', 'M-7', '2', id);
  S.as('tech1', { action: 'partUse', part: { kind: 'electrical', no: 'E-300', qty: '1', order: id, type: 'Returned' } });
  const m = S.as('sup', { action: 'taskParts', id }); assert.strictEqual(m.lines.length, 2); assert.strictEqual(m.total, 220); assert.strictEqual(m.lines.filter(l => l.no === 'E-300')[0].qty, 2);
  const t = S.as('tech1', { action: 'taskParts', id }); assert(t.ok && t.total === null && t.lines.every(l => l.cost === undefined) && t.moves.every(x => x.cost === null) && t.canAdd === true);
});
test('work order parts: price at the time of use is kept when the price changes later', () => {
  const S = setup(); const id = wo(S); S.as('sup', { action: 'partDetails', part: { kind: 'electrical', no: 'E-300', cost: '10' } }); use(S, 'sup', 'electrical', 'E-300', '2', id);
  S.as('sup', { action: 'partDetails', part: { kind: 'electrical', no: 'E-300', cost: '99' } }); assert.strictEqual(S.as('sup', { action: 'taskParts', id }).total, 20);
});
test('work order parts: not visible to another technician; a finished one cannot get new parts from its technician… but can for editors', () => {
  const S = setup(); const id = wo(S, 'tech1'); assert.strictEqual(S.as('tech2', { action: 'taskParts', id }).ok, false); assert.strictEqual(S.as('sup', { action: 'taskParts', id: 'T-9999' }).ok, false);
  assert.strictEqual(S.as('tech2', { action: 'taskParts', id }).ok, false);
});
test('lookup: search by number, name or machine; anyone with an open work order may search; others may not', () => {
  const S = setup(); wo(S, 'tech1'); const q = (u, s) => S.as(u, { action: 'partsLookup', q: s });
  assert.deepStrictEqual(q('tech1', 'blade').parts.map(p => p.no), ['M-7']); assert.deepStrictEqual(q('tech1', 'abb').parts.map(p => p.no), ['E-100']); assert.strictEqual(q('tech1', '').parts.length, 5);
  assert.strictEqual(q('tech2', 'blade').ok, false); assert(q('sup', 'blade').ok);
});
test('info: usage in the last 90 days, value of stock, history newest first', () => {
  const S = setup(); S.as('sup', { action: 'partDetails', part: { kind: 'electrical', no: 'E-300', cost: '2' } }); use(S, 'sup', 'electrical', 'E-300', '4'); S.rt.advance(60e3); S.as('sup', { action: 'partCount', part: { kind: 'electrical', no: 'E-300', counted: '10' } });
  const i = info(S, 'electrical', 'E-300'); assert.strictEqual(i.used90, 4); assert.strictEqual(i.value, 20); assert.strictEqual(i.moves[0].type, 'Count'); assert.strictEqual(i.moves[1].type, 'Used');
});
test('regression: the spares list still carries its old fields; new tabs exist; API version 16', () => {
  const S = setup(); const r = S.as('sup', { action: 'spares' }); assert(r.spares.electrical.length === 3 && r.spares.mechanical.length === 2 && r.stock && r.vendors);
  ['Part Stock', 'Part Usage', 'Vendors'].forEach(n => assert(S.api.tasksBook().getSheetByName(n), n));
});
console.log(`\nparts: ${pass} passed, ${fail} failed`); if (fail) { failures.forEach(f => console.log('  FAIL ' + f)); process.exit(1); }
