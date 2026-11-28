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
   ['3', 'Eli Elec', 'tech2', '2223', 'Yes', 'Elec-Technician', '', 'No', 'No', 'No'], ['6', 'Perm Pete', 'pete', '5555', 'Yes', 'Elec-Technician', '', 'No', 'Yes', 'No']].forEach(r => us.appendRow(r));
  const rd = rt.addBook('1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ', 'Readings'); rd.sheets[0].setName('Amp Rec');
  const eqb = rt.addBook('1sI07XLIaK3yQ2f199dVGX0IvQuRdzMG7L6WYOnXC9k8', 'Equipment'); const es = eqb.sheets[0];
  es.appendRow(['Equipment Name', 'Equipment Number', 'Line', 'Location', 'Category', 'Record Status', 'Automation task']);
  es.appendRow(['Shredder', 'SH-1', 'L1', 'Hall A', 'Shredder', '', '']); es.appendRow(['Conveyor', 'BC-16', 'L1', 'Hall A', 'Conveyor', '', '']);
  es.appendRow(['Fan', '', 'L2', 'Hall B', 'Fan', '', '']);
  const cb = rt.addBook('checks1', 'Checks'); rt.props.CHECKS_SS_ID = 'checks1'; cb.sheets[0].setName('Bobcat Checklist');
  cb.insertSheet('Bobcat Log').appendRow(['Timestamp', 'Date', 'Unit', 'Hour Meter Reading']);
  const tok = {}; [['sup', '1111'], ['tech1', '2222'], ['tech2', '2223'], ['pete', '5555']].forEach(([u, pin]) => { tok[u] = rt.call({ action: 'login', username: u, pin }).token; });
  const as = (u, b) => rt.call(Object.assign({ token: tok[u] }, b));
  return { rt, as, api: rt.api, tok, relogin: (u, pin) => { tok[u] = rt.call({ action: 'login', username: u, pin }).token; } };
}
const off = (S, u, no, extra) => S.as(u, { action: 'downtimeStart', downtime: Object.assign({ no, cause: 'Mechanical wear' }, extra || {}) });
const on = (S, u, no, extra) => S.as(u, { action: 'downtimeEnd', downtime: Object.assign({ no }, extra || {}) });

/* ---------- failure causes ---------- */
test('causes: starter list on first use, everyone sees active names, managers also see all', () => {
  const S = setup(); const r = S.as('tech1', { action: 'causes' });
  assert(r.ok && r.causes.length === 9 && r.causes.indexOf('Mechanical wear') >= 0 && r.all === undefined);
  assert.strictEqual(S.as('sup', { action: 'causes' }).all.length, 9);
});
test('causes: supervisor saves, can switch one off; duplicates and blanks dropped; needs one active', () => {
  const S = setup();
  const r = S.as('sup', { action: 'causesSave', causes: [{ name: 'Belt slip', active: true }, { name: 'belt slip', active: true }, { name: '  ', active: true }, { name: 'Old', active: false }] });
  assert(r.ok, JSON.stringify(r)); assert.deepStrictEqual(r.causes, ['Belt slip']);
  const l = S.as('sup', { action: 'causes' }); assert.deepStrictEqual(l.causes, ['Belt slip']); assert.strictEqual(l.all.length, 2);
  assert.strictEqual(S.as('sup', { action: 'causesSave', causes: [{ name: 'X', active: false }] }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'causesSave', causes: 'nope' }).ok, false);
});
test('causes: only a supervisor may save', () => {
  const S = setup(); assert.strictEqual(S.as('tech1', { action: 'causesSave', causes: [{ name: 'A' }] }).ok, false); assert.strictEqual(S.as('pete', { action: 'causesSave', causes: [{ name: 'A' }] }).ok, false);
});
test('causes: shorter list after a longer one leaves no stale rows', () => {
  const S = setup(); S.as('sup', { action: 'causes' });
  S.as('sup', { action: 'causesSave', causes: [{ name: 'A' }, { name: 'B' }] });
  const l = S.as('sup', { action: 'causes' }); assert.deepStrictEqual(l.causes, ['A', 'B']); assert.strictEqual(l.all.length, 2);
});

/* ---------- downtime ---------- */
test('downtime: offline then online records minutes and shows in the list', () => {
  const S = setup(); const a = off(S, 'sup', 'SH-1', { note: 'Belt snapped' }); assert(a.ok, JSON.stringify(a)); assert.strictEqual(a.id, 'D0001');
  S.rt.advance(90 * 60e3);
  let l = S.as('sup', { action: 'downtimeList', no: 'SH-1' }); assert(l.open && l.open.minutes === 90 && l.open.open === true);
  const b = on(S, 'sup', 'SH-1', { note: 'Belt replaced' }); assert(b.ok && b.minutes === 90, JSON.stringify(b));
  l = S.as('sup', { action: 'downtimeList', no: 'SH-1' });
  assert.strictEqual(l.open, null); assert.strictEqual(l.entries.length, 1); assert.strictEqual(l.entries[0].minutes, 90); assert.strictEqual(l.entries[0].open, false);
  assert(/Belt snapped/.test(l.entries[0].note) && /Belt replaced/.test(l.entries[0].note));
});
test('downtime: a second offline on the same asset is refused; back online when not offline is refused', () => {
  const S = setup(); assert.strictEqual(on(S, 'sup', 'SH-1').ok, false); off(S, 'sup', 'SH-1');
  const r = off(S, 'sup', 'SH-1'); assert.strictEqual(r.ok, false); assert(/already offline/.test(r.error));
  assert(off(S, 'sup', 'BC-16').ok);
});
test('downtime: IDs keep counting, also after earlier entries closed', () => {
  const S = setup(); off(S, 'sup', 'SH-1'); S.rt.advance(60e3); on(S, 'sup', 'SH-1'); assert.strictEqual(off(S, 'sup', 'SH-1').id, 'D0002'); assert.strictEqual(off(S, 'sup', 'BC-16').id, 'D0003');
});
test('downtime: needs a cause from the active list; planned defaults; inactive cause refused', () => {
  const S = setup();
  assert.strictEqual(S.as('sup', { action: 'downtimeStart', downtime: { no: 'SH-1' } }).ok, false);
  assert.strictEqual(off(S, 'sup', 'SH-1', { cause: 'Made up' }).ok, false);
  const p = S.as('sup', { action: 'downtimeStart', downtime: { no: 'SH-1', type: 'Planned' } }); assert(p.ok, JSON.stringify(p));
  assert.strictEqual(S.as('sup', { action: 'downtimeList', no: 'SH-1' }).open.cause, 'Planned maintenance');
  on(S, 'sup', 'SH-1'); S.as('sup', { action: 'causesSave', causes: [{ name: 'Mechanical wear', active: false }, { name: 'Other', active: true }] });
  assert.strictEqual(off(S, 'sup', 'SH-1').ok, false);
});
test('downtime: unknown or numberless asset refused', () => {
  const S = setup(); assert.strictEqual(off(S, 'sup', 'NOPE').ok, false); assert.strictEqual(off(S, 'sup', '').ok, false);
});
test('downtime: permissions — manager and equipment-right ok, plain technician refused, technician with an open work order on it ok', () => {
  const S = setup();
  assert.strictEqual(off(S, 'tech1', 'SH-1').ok, false); assert(off(S, 'pete', 'SH-1').ok); on(S, 'pete', 'SH-1');
  S.as('sup', { action: 'taskCreate', task: { title: 'Fix', assignee: 'tech1', equipment: 'Shredder', equipmentNo: 'SH-1', line: 'L1' } });
  assert(off(S, 'tech1', 'SH-1').ok); assert(on(S, 'tech1', 'SH-1').ok);
  assert.strictEqual(off(S, 'tech1', 'BC-16').ok, false);   // the work order is on another asset
  assert.strictEqual(off(S, 'tech2', 'SH-1').ok, false);   // somebody else's work order does not count
});
test('downtime: a finished work order no longer gives the right', () => {
  const S = setup(); const id = S.as('sup', { action: 'taskCreate', task: { title: 'Fix', assignee: 'tech1', equipment: 'Shredder', equipmentNo: 'SH-1', line: 'L1' } }).task.id;
  S.as('tech1', { action: 'taskUpdate', id, status: 'In progress' }); assert(S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'ok' }).ok); assert.strictEqual(off(S, 'tech1', 'SH-1').ok, false);
});
test('downtime: link to a work order — must exist; can be added when going online', () => {
  const S = setup(); const id = S.as('sup', { action: 'taskCreate', task: { title: 'Fix', assignee: 'tech1' } }).task.id;
  assert.strictEqual(off(S, 'sup', 'SH-1', { order: 'T-9999' }).ok, false);
  assert(off(S, 'sup', 'SH-1').ok); assert.strictEqual(on(S, 'sup', 'SH-1', { order: 'T-9999' }).ok, false);
  assert(on(S, 'sup', 'SH-1', { order: id }).ok); assert.strictEqual(S.as('sup', { action: 'downtimeList', no: 'SH-1' }).entries[0].order, id);
});
test('downtime summary: totals, planned vs unplanned, causes ranked by lost minutes, average repair', () => {
  const S = setup();
  off(S, 'sup', 'SH-1', { cause: 'Material jam' }); S.rt.advance(30 * 60e3); on(S, 'sup', 'SH-1'); S.rt.advance(60e3);
  off(S, 'sup', 'SH-1', { cause: 'Electrical fault' }); S.rt.advance(120 * 60e3); on(S, 'sup', 'SH-1'); S.rt.advance(60e3);
  S.as('sup', { action: 'downtimeStart', downtime: { no: 'SH-1', type: 'Planned' } }); S.rt.advance(60 * 60e3); on(S, 'sup', 'SH-1');
  const s = S.as('sup', { action: 'downtimeList', no: 'SH-1' }).summary;
  assert.strictEqual(s.count, 3); assert.strictEqual(s.unplanned, 150); assert.strictEqual(s.planned, 60); assert.strictEqual(s.minutes, 210); assert.strictEqual(s.avgRepair, 75);
  assert.deepStrictEqual(s.byCause.map(c => c.cause), ['Electrical fault', 'Planned maintenance', 'Material jam']);
});
test('downtime: entries older than 90 days stay in the list but not in the summary', () => {
  const S = setup(); off(S, 'sup', 'SH-1'); S.rt.advance(60 * 60e3); on(S, 'sup', 'SH-1'); S.rt.advance(100 * 864e5); S.relogin('sup', '1111');
  const l = S.as('sup', { action: 'downtimeList', no: 'SH-1' }); assert.strictEqual(l.entries.length, 1); assert.strictEqual(l.summary.count, 0);
});
test('downtime: only that asset’s entries are returned; list needs the equipment right', () => {
  const S = setup(); off(S, 'sup', 'SH-1'); off(S, 'sup', 'BC-16');
  assert.strictEqual(S.as('sup', { action: 'downtimeList', no: 'BC-16' }).entries.length, 1);
  assert.strictEqual(S.as('tech1', { action: 'downtimeList', no: 'SH-1' }).ok, false); assert(S.as('pete', { action: 'downtimeList', no: 'SH-1' }).ok);
});
test('equipment list also says which assets are offline now', () => {
  const S = setup(); off(S, 'sup', 'SH-1'); const r = S.as('sup', { action: 'equipment' });
  assert(r.offline['SH-1'] && r.offline['SH-1'].cause === 'Mechanical wear'); assert.strictEqual(r.offline['BC-16'], undefined);
  on(S, 'sup', 'SH-1'); assert.deepStrictEqual(S.as('sup', { action: 'equipment' }).offline, {});
});

/* ---------- asset card (QR scan, any employee) ---------- */
test('asset card: any employee sees name, state and their own open work orders; others’ work orders are hidden', () => {
  const S = setup(); S.as('sup', { action: 'taskCreate', task: { title: 'Mine', assignee: 'tech1', equipment: 'Shredder', equipmentNo: 'SH-1', line: 'L1' } });
  S.as('sup', { action: 'taskCreate', task: { title: 'Theirs', assignee: 'tech2', equipment: 'Shredder', equipmentNo: 'SH-1', line: 'L1' } });
  off(S, 'sup', 'SH-1');
  const r = S.as('tech1', { action: 'assetCard', no: 'SH-1' });
  assert(r.ok && r.asset.name === 'Shredder' && r.offline && r.orders.length === 1 && r.orders[0].title === 'Mine' && r.canDowntime === true && r.canOpen === false);
  const q = S.as('tech2', { action: 'assetCard', no: 'BC-16' }); assert(q.ok && q.canDowntime === false && q.offline === null && q.orders.length === 0);
  assert.strictEqual(S.as('sup', { action: 'assetCard', no: 'SH-1' }).canOpen, true);
  assert.strictEqual(S.as('tech1', { action: 'assetCard', no: 'NOPE' }).ok, false);
});
test('asset card: needs a sign-in', () => { const S = setup(); assert.strictEqual(S.rt.call({ action: 'assetCard', no: 'SH-1' }).ok, false); });

/* ---------- named meters ---------- */
test('meters: several named meters per asset; latest of each; hours meter unchanged', () => {
  const S = setup();
  assert(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '100' } }).ok);
  assert(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'Oil pressure', unit: 'PSI', reading: '42' } }).ok);
  S.rt.advance(60e3); assert(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'Oil pressure', unit: 'PSI', reading: '38.5' } }).ok);
  const l = S.as('sup', { action: 'meterList', no: 'SH-1' });
  const op = l.meters.filter(m => m.name === 'Oil pressure')[0], rh = l.meters.filter(m => m.name === 'Running hours')[0];
  assert.strictEqual(op.latest, 38.5); assert.strictEqual(op.unit, 'PSI'); assert.strictEqual(rh.latest, 100); assert.strictEqual(rh.unit, 'h'); assert.strictEqual(l.latest, 100);
});
test('meters: a pressure or temperature reading may go down; running hours may not (without the tick)', () => {
  const S = setup(); S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'Temp', unit: '°C', reading: '80' } });
  S.rt.advance(60e3); assert(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'Temp', unit: '°C', reading: '40' } }).ok);
  S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '500' } }); S.rt.advance(60e3);
  assert.strictEqual(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'Running hours', reading: '20' } }).ok, false);
});
test('meters: other meters never feed the hour-based repeat; only Running hours does', () => {
  const S = setup(); S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'Oil pressure', unit: 'PSI', reading: '9999' } });
  assert.strictEqual(S.api.latestHourMeter('SH-1'), null);
  S.rt.advance(60e3); S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '77' } }); assert.strictEqual(S.api.latestHourMeter('SH-1'), 77);
});
test('meters: old rows without Meter / Unit columns still read as running hours', () => {
  const S = setup(); const sh = S.api.tasksBook().getSheetByName('Meter Readings');
  sh.rows = [S.api.METER_COLS.slice(0, 6), ['2026-11-01 08:00', 'SH-1', 'Shredder', '250', 'sup', '']];
  const l = S.as('sup', { action: 'meterList', no: 'SH-1' }); assert.strictEqual(l.latest, 250); assert.strictEqual(l.meters[0].name, 'Running hours'); assert.strictEqual(l.readings[0].unit, 'h');
});
test('meters: two readings in the same minute — the newest one is the latest', () => {
  const S = setup(); S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'Temp', unit: 'C', reading: '80' } });
  S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'Temp', unit: 'C', reading: '60' } });
  const l = S.as('sup', { action: 'meterList', no: 'SH-1' }); assert.strictEqual(l.meters[0].latest, 60); assert.strictEqual(l.readings[0].reading, 60);
});
test('downtime: two stops in the same minute — the newest is listed first', () => {
  const S = setup(); off(S, 'sup', 'SH-1', { cause: 'Material jam' }); on(S, 'sup', 'SH-1'); off(S, 'sup', 'SH-1', { cause: 'Power loss' });
  const l = S.as('sup', { action: 'downtimeList', no: 'SH-1' }); assert.strictEqual(l.entries[0].cause, 'Power loss'); assert.strictEqual(l.open.cause, 'Power loss');
});
test('meters: at most 10 meters per asset; names are trimmed; unit cut to 12', () => {
  const S = setup(); for (let i = 1; i <= 10; i++) assert(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'M' + i, unit: 'u', reading: '1' } }).ok);
  assert.strictEqual(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: 'M11', unit: 'u', reading: '1' } }).ok, false);
  assert(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', name: ' m1 ', unit: 'u', reading: '2' } }).ok);   // an existing meter, any case
  assert(S.as('sup', { action: 'meterAdd', meter: { no: 'BC-16', name: 'x'.repeat(80), unit: 'y'.repeat(40), reading: '2' } }).ok);
  const m = S.as('sup', { action: 'meterList', no: 'BC-16' }).meters[0]; assert.strictEqual(m.name.length, 40); assert.strictEqual(m.unit.length, 12);
});
test('regression: the new tabs are created and an older book gets the new meter columns', () => {
  const S = setup(); const ss = S.api.tasksBook(); ['Downtime', 'Failure Causes'].forEach(n => assert(ss.getSheetByName(n), n));
  assert.strictEqual(JSON.stringify(ss.getSheetByName('Meter Readings').rows[0].slice(0, 8)), JSON.stringify(S.api.METER_COLS));
});
console.log(`\nassets: ${pass} passed, ${fail} failed`); if (fail) { failures.forEach(f => console.log('  FAIL ' + f)); process.exit(1); }
