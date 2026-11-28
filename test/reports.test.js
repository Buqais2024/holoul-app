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

const wo = (S, who, extra) => S.as('sup', { action: 'taskCreate', task: Object.assign({ title: 'Fix', assignee: who || 'tech1' }, extra || {}) }).task.id;
const off = (S, no, extra) => S.as('sup', { action: 'downtimeStart', downtime: Object.assign({ no, cause: 'Mechanical wear' }, extra || {}) });
const on = (S, no) => S.as('sup', { action: 'downtimeEnd', downtime: { no } });
const rep = (S, b, u) => S.as(u || 'sup', Object.assign({ action: 'report' }, b || {}));
const min = n => n * 60e3;

test('report: work-order counts, on-time %, average time to finish, hours', () => {
  const S = setup(); const a = wo(S, 'tech1', { due: '2026-11-29' }), b = wo(S, 'tech1', { due: '2026-11-20' }), c = wo(S, 'tech2');
  S.rt.advance(min(120)); S.as('tech1', { action: 'taskUpdate', id: a, status: 'Done', note: 'x', hours: '1.5' });
  const r = rep(S, { days: 7 }); assert(r.ok, JSON.stringify(r)); const w = r.workOrders;
  assert.deepStrictEqual([w.created, w.done, w.open, w.overdue], [3, 1, 2, 1]); assert.strictEqual(w.onTimePct, 100); assert.strictEqual(w.avgHoursToDone, 2); assert.strictEqual(w.hoursLogged, 1.5);
  const t1 = r.workload.filter(p => p.username === 'tech1')[0]; assert.deepStrictEqual([t1.open, t1.overdue, t1.done, t1.hours], [1, 1, 1, 1.5]); assert.strictEqual(r.workload.filter(p => p.username === 'tech2')[0].open, 1);
});
test('report: a late finish lowers on-time %; work done outside the range is not counted', () => {
  const S = setup(); const a = wo(S, 'tech1', { due: '2026-11-29' }); S.rt.advance(36 * 36e5); S.as('tech1', { action: 'taskUpdate', id: a, status: 'Done', note: 'x' });
  assert.strictEqual(rep(S, { days: 7 }).workOrders.onTimePct, 0);
  const r = rep(S, { from: '2026-11-01', to: '2026-11-20' }); assert.deepStrictEqual([r.workOrders.created, r.workOrders.done], [0, 0]);
});
test('report: by category and priority', () => {
  const S = setup(); wo(S, 'tech1', { category: 'Electrical', priority: 'High' }); wo(S, 'tech1', { category: 'Electrical' }); wo(S, 'tech1', { category: 'Safety' });
  const w = rep(S, {}).workOrders; assert.deepStrictEqual(w.byCategory.filter(c => c.name === 'Electrical')[0], { name: 'Electrical', created: 2, done: 0 }); assert.strictEqual(w.byPriority.filter(c => c.name === 'High')[0].created, 1);
});
test('report: MTTR, MTBF, availability from unplanned stops; planned ones only count as downtime', () => {
  const S = setup(); off(S, 'SH-1'); S.rt.advance(min(60)); on(S, 'SH-1'); S.rt.advance(min(600)); off(S, 'SH-1'); S.rt.advance(min(120)); on(S, 'SH-1');
  S.rt.advance(min(30)); off(S, 'SH-1', { type: 'Planned', cause: undefined }); S.rt.advance(min(30)); on(S, 'SH-1');
  const r = rep(S, { days: 2 }); const a = r.assets[0];
  assert.deepStrictEqual([a.no, a.stops, a.unplannedStops, a.minutes, a.unplannedMinutes, a.plannedMinutes, a.mttrMin], ['SH-1', 3, 2, 210, 180, 30, 90], JSON.stringify(a));
  assert.strictEqual(a.mtbfHours, Math.round((1560 - 210) / 2 / 60 * 10) / 10); assert.strictEqual(a.availabilityPct, Math.round((1560 - 210) / 1560 * 1000) / 10);
  assert.strictEqual(r.downtime.mttrMin, 90); assert.deepStrictEqual(r.downtime.byCause, [{ name: 'Mechanical wear', minutes: 180 }]);
});
test('report: a stop that is still open counts up to now but has no MTTR yet', () => {
  const S = setup(); off(S, 'SH-1'); S.rt.advance(min(45)); const a = rep(S, { days: 1 }).assets[0]; assert.strictEqual(a.minutes, 45); assert.strictEqual(a.mttrMin, null); assert.strictEqual(a.unplannedStops, 1);
});
test('report: downtime is clipped to the chosen period', () => {
  const S = setup(); off(S, 'SH-1'); S.rt.advance(min(120)); on(S, 'SH-1'); S.rt.advance(36e5 * 48);
  assert.strictEqual(rep(S, { days: 1 }).assets.length, 0); assert.strictEqual(rep(S, { days: 5 }).assets[0].minutes, 120);
});
test('report: no downtime gives empty assets and null MTTR', () => { const S = setup(); const r = rep(S, {}); assert.deepStrictEqual(r.assets, []); assert.strictEqual(r.downtime.mttrMin, null); assert.strictEqual(r.workOrders.onTimePct, null); });
test('report: parts cost is net of returns and lists the top parts', () => {
  const S = setup(); const id = wo(S);
  S.as('sup', { action: 'partDetails', part: { kind: 'electrical', no: 'E-300', cost: '10' } }); S.as('sup', { action: 'partDetails', part: { kind: 'mechanical', no: 'M-7', cost: '100' } });
  S.as('sup', { action: 'partUse', part: { kind: 'electrical', no: 'E-300', qty: '5', order: id } }); S.as('sup', { action: 'partUse', part: { kind: 'mechanical', no: 'M-7', qty: '1', order: id } });
  S.as('sup', { action: 'partUse', part: { kind: 'electrical', no: 'E-300', qty: '2', order: id, type: 'Returned' } });
  S.as('sup', { action: 'partReceive', part: { kind: 'electrical', no: 'E-300', qty: '9' } });
  const p = rep(S, {}).parts; assert.strictEqual(p.cost, 130); assert.deepStrictEqual(p.top.map(x => [x.no, x.qty, x.cost]), [['M-7', 1, 100], ['E-300', 3, 30]]);
});
test('report: range rules and permissions', () => {
  const S = setup(); assert.strictEqual(rep(S, { from: '2026-11-20', to: '2026-11-10' }).ok, false); assert.strictEqual(rep(S, { from: '2024-01-01', to: '2026-11-01' }).ok, false);
  assert.strictEqual(rep(S, { from: 'bad', to: '2026-11-01' }).ok, false); assert.strictEqual(rep(S, { days: 7 }, 'tech1').ok, false); assert.strictEqual(rep(S, { days: 7 }, 'sparky').ok, false);
  assert.strictEqual(rep(S, { days: 7 }, 'ops').ok, true); assert.strictEqual(rep(S, { days: 5000 }).range.days, 366); assert.strictEqual(rep(S, { days: 7 }).range.days, 7);
});
test('csv: has every section, quotes commas and quotes', () => {
  const S = setup(); wo(S, 'tech1', { category: 'Safety' }); S.as('sup', { action: 'vendorSave', vendor: { name: 'x' } });
  S.as('sup', { action: 'partUse', part: { kind: 'electrical', no: 'E-300', qty: '1', order: wo(S) } });
  const c = rep(S, { csv: true }).csv; ['WORK ORDERS', 'WORKLOAD', 'ASSETS', 'PARTS', 'By category', 'Lost time by cause'].forEach(k => assert(c.indexOf(k) >= 0, k));
  const q = S.api.reportCsv({ range: { from: 'a', to: 'b' }, generated: 'g', workOrders: { byCategory: [{ name: 'A,"B"', created: 1, done: 0 }], byPriority: [] }, workload: [], assets: [], downtime: { byCause: [] }, parts: { cost: 0, top: [] } });
  assert(q.indexOf('"A,""B"""') >= 0, q);
});
test('email: sends html + csv to one valid address; refuses bad ones and non-managers', () => {
  const S = setup(); const r = S.as('sup', { action: 'reportEmail', email: 'Boss@Example.com', days: 7 }); assert(r.ok && r.sentTo === 'boss@example.com', JSON.stringify(r));
  const m = S.rt.mails[0]; assert.strictEqual(m.to, 'boss@example.com'); assert(/Maintenance report/.test(m.htmlBody) && m.attachments.length === 1 && /WORK ORDERS/.test(m.attachments[0].getDataAsString()));
  ['nope', 'a@b.co,c@d.co', ''].forEach(e => assert.strictEqual(S.as('sup', { action: 'reportEmail', email: e }).ok, false, e)); assert.strictEqual(S.as('tech1', { action: 'reportEmail', email: 'a@b.co' }).ok, false);
  assert.strictEqual(S.rt.mails.length, 1);
});
test('weekly: Sunday sends the last 7 days once to active recipients only', () => {
  const S = setup(); S.as('sup', { action: 'reportRecipientSave', email: 'a@b.co' }); S.as('sup', { action: 'reportRecipientSave', email: 'off@b.co', active: false });
  const r = S.api.automationCycle(); assert.strictEqual(r.weeklyReports, 1); assert.strictEqual(S.rt.mails.length, 1); assert.strictEqual(S.rt.mails[0].to, 'a@b.co');
  assert(/2026-11-22 to 2026-11-28/.test(S.rt.mails[0].subject), S.rt.mails[0].subject);
  assert.strictEqual(S.api.automationCycle().weeklyReports, 0); assert.strictEqual(S.rt.mails.length, 1);
  assert.strictEqual(S.as('sup', { action: 'reportRecipients' }).recipients.filter(x => x.email === 'a@b.co')[0].lastSent, '2026-11-29');
});
test('weekly: not sent on other days', () => { const S = setup(); S.as('sup', { action: 'reportRecipientSave', email: 'a@b.co' }); S.rt.advance(36e5 * 24); S.api.automationCycle(); assert.strictEqual(S.rt.mails.length, 0); });
test('recipients: validation, update, limit, permissions', () => {
  const S = setup(); assert.strictEqual(S.as('sup', { action: 'reportRecipientSave', email: 'bad' }).ok, false); assert.strictEqual(S.as('tech1', { action: 'reportRecipientSave', email: 'a@b.co' }).ok, false); assert.strictEqual(S.as('tech1', { action: 'reportRecipients' }).ok, false);
  S.as('sup', { action: 'reportRecipientSave', email: 'A@b.co' }); S.as('sup', { action: 'reportRecipientSave', email: 'a@b.co', active: false });
  const l = S.as('sup', { action: 'reportRecipients' }).recipients; assert.strictEqual(l.length, 1); assert.strictEqual(l[0].active, false);
  for (let i = 0; i < 9; i++) assert(S.as('sup', { action: 'reportRecipientSave', email: 'u' + i + '@b.co' }).ok); assert.strictEqual(S.as('sup', { action: 'reportRecipientSave', email: 'z@b.co' }).ok, false);
});
test('a failing mail does not stop the cycle or mark the recipient sent', () => {
  const S = setup(); S.as('sup', { action: 'reportRecipientSave', email: 'a@b.co' }); S.rt.mails.push = () => { throw new Error('quota'); };
  const r = S.api.automationCycle(); assert.strictEqual(r.weeklyReports, 0); assert.strictEqual(S.as('sup', { action: 'reportRecipients' }).recipients[0].lastSent, '');
});
test('regression: API version 20', () => { const S = setup(); assert.strictEqual(JSON.parse(S.api.doGet({}).s).version, 20); });
console.log(`\nreports: ${pass} passed, ${fail} failed`); if (fail) { failures.forEach(f => console.log('  FAIL ' + f)); process.exit(1); }
