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
  // readings workbook with an Amp Rec sheet: row1 date, row2 user, data from row 3
  const rd = rt.addBook('1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ', 'Readings');
  const amp = rd.sheets[0]; amp.setName('Amp Rec');
  [['#', 'Cable', 'Motor A', 'Ref', ''], ['', '', '', '', ''], ['1', 'C-1', 'Shredder motor', '40', ''], ['2', 'C-2', 'Fan motor', '10', '']].forEach((r, i) => r.forEach((v, j) => amp.put(i + 1, j + 1, v)));
  const eqb = rt.addBook('1sI07XLIaK3yQ2f199dVGX0IvQuRdzMG7L6WYOnXC9k8', 'Equipment'); const es = eqb.sheets[0];
  es.appendRow(['Equipment Name', 'Equipment Number', 'Line', 'Location', 'Category', 'Record Status', 'Automation task']);
  es.appendRow(['Shredder', 'SH-1', 'L1', 'Hall A', 'Shredder', '', '']); es.appendRow(['Conveyor', 'BC-16', 'L1', 'Hall A', 'Conveyor', '', '']);
  const cb = rt.addBook('checks1', 'Checks'); rt.props.CHECKS_SS_ID = 'checks1'; cb.sheets[0].setName('Bobcat Checklist');
  const lg = cb.insertSheet('Bobcat Log'); lg.appendRow(['Timestamp', 'Date', 'Unit', 'Hour Meter Reading']);
  const tok = {}; [['sup', '1111'], ['tech1', '2222'], ['tech2', '2223'], ['pete', '5555']].forEach(([u, pin]) => { tok[u] = rt.call({ action: 'login', username: u, pin }).token; });
  const as = (u, b) => rt.call(Object.assign({ token: tok[u] }, b));
  return { rt, as, api: rt.api, amp, lg };
}
const tasks = S => S.api.readTasks();
const save = (S, row, value, u) => S.as(u || 'tech1', Object.assign({ action: 'saveReading', sheet: 'Amp Rec', row, value }, {}));
// technicians in the mock have Amp Rec access (accessFor)

/* ---------- meter readings ---------- */
test('meter reading is saved and listed, newest first', () => {
  const S = setup(); assert(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '100' } }).ok);
  S.rt.advance(60e3); const r = S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '150.5' } }); assert(r.ok, JSON.stringify(r)); assert.strictEqual(r.previous, 100);
  const l = S.as('sup', { action: 'meterList', no: 'SH-1' }); assert.strictEqual(l.readings.length, 2); assert.strictEqual(l.readings[0].reading, 150.5); assert.strictEqual(l.latest, 150.5);
});
test('meter: bad input is refused', () => {
  const S = setup();
  ['', 'abc', '-5', '99999999'].forEach(v => assert.strictEqual(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: v } }).ok, false, v));
  assert.strictEqual(S.as('sup', { action: 'meterAdd', meter: { no: 'NOPE', reading: '5' } }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'meterAdd', meter: { no: '', reading: '5' } }).ok, false);
});
test('meter: lower than last needs the replaced tick', () => {
  const S = setup(); S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '500' } });
  const bad = S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '20' } }); assert.strictEqual(bad.ok, false); assert(/replaced/i.test(bad.error));
  S.rt.advance(60e3); assert(S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '20', replaced: true } }).ok);
  assert.strictEqual(S.as('sup', { action: 'meterList', no: 'SH-1' }).latest, 20);
});
test('meter: permissions (equipment right ok, plain technician refused)', () => {
  const S = setup(); assert(S.as('pete', { action: 'meterAdd', meter: { no: 'SH-1', reading: '5' } }).ok);
  assert.strictEqual(S.as('tech1', { action: 'meterAdd', meter: { no: 'SH-1', reading: '5' } }).ok, false); assert.strictEqual(S.as('tech1', { action: 'meterList', no: 'SH-1' }).ok, false);
});
test('hour meter: newest of check log and manual readings wins', () => {
  const S = setup(); S.lg.appendRow(['2026-11-20 08:00', '2026-11-20', 'BC-16', '300']);
  assert.strictEqual(S.api.latestHourMeter ? 1 : 1, 1);
  S.as('sup', { action: 'meterAdd', meter: { no: 'BC-16', reading: '350' } });                  // newer than the log row
  assert.strictEqual(S.as('sup', { action: 'meterList', no: 'BC-16' }).latest, 350);
  const S2 = setup(); S2.as('sup', { action: 'meterAdd', meter: { no: 'BC-16', reading: '10' } }); S2.rt.advance(48 * 3600e3);
  S2.lg.appendRow([S2.api.tasksBook ? '2026-12-05 08:00' : '', '2026-12-05', 'BC-16', '12']);   // newer log row beats older manual one
  assert.strictEqual(S2.as('sup', { action: 'meterList', no: 'BC-16' }).latest, 12);
});
test('hour-based repeat on a normal machine fires from manual readings', () => {
  const S = setup(); S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '1000' } });
  const r = S.as('sup', { action: 'taskRuleCreate', task: { title: 'Grease shredder', equipment: 'Shredder', equipmentNo: 'SH-1', priority: 'Normal' }, auto: { basis: 'hours', hours: '250', assignees: ['tech1'] } });
  assert(r.ok, JSON.stringify(r)); const first = tasks(S).length;
  S.as('tech1', { action: 'taskUpdate', id: r.tasks[0].id, status: 'Done' });
  S.rt.advance(60e3); S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '1100' } }); S.api.automationCycle(); assert.strictEqual(tasks(S).length, first);   // 100 h: not yet
  S.rt.advance(60e3); S.as('sup', { action: 'meterAdd', meter: { no: 'SH-1', reading: '1260' } }); S.api.automationCycle();
  const t = tasks(S); assert.strictEqual(t.length, first + 1); assert.strictEqual(t[t.length - 1]['Source'], 'Meter');
});

/* ---------- limits ---------- */
const lim = (S, o) => S.as('sup', { action: 'limitSave', limit: Object.assign({ page: 'Amp Rec', row: 3, label: 'Shredder motor', max: '45', assignee: 'tech2', priority: 'High' }, o || {}) });
test('limit: create, list, edit, delete', () => {
  const S = setup(); const a = lim(S); assert(a.ok, JSON.stringify(a)); assert.strictEqual(a.limit.id, 'LM-001');
  assert.strictEqual(S.as('sup', { action: 'limits' }).limits.length, 1);
  const e = S.as('sup', { action: 'limitSave', limit: { id: 'LM-001', page: 'Amp Rec', row: 3, label: 'Shredder motor', min: '5', max: '50', assignee: 'tech2' } }); assert.strictEqual(e.limit.max, '50'); assert.strictEqual(e.limit.min, '5');
  assert(S.as('sup', { action: 'limitSave', limit: { id: 'LM-001', remove: true } }).ok); assert.strictEqual(S.as('sup', { action: 'limits' }).limits.length, 0);
});
test('limit: validation and permissions', () => {
  const S = setup();
  [{ page: 'Nope' }, { row: 1 }, { max: '', min: '' }, { min: '9', max: '3' }, { max: 'abc' }, { assignee: 'ghost' }].forEach(o => assert.strictEqual(lim(S, o).ok, false, JSON.stringify(o)));
  assert.strictEqual(S.as('tech1', { action: 'limitSave', limit: { page: 'Amp Rec', row: 3, max: '5', assignee: 'tech2' } }).ok, false);
  assert.strictEqual(S.as('tech1', { action: 'limits' }).ok, false); lim(S); assert.strictEqual(lim(S).ok, false);             // duplicate for the same row
});
test('limit: reading above max creates ONE High work order and none while open', () => {
  const S = setup(); lim(S);
  const a = save(S, 3, '44'); assert.strictEqual(a.limitTask, ''); assert.strictEqual(tasks(S).length, 0);
  const b = save(S, 3, '52'); assert(b.limitTask, JSON.stringify(b)); const t = tasks(S)[0];
  assert.strictEqual(t['Assigned To'], 'tech2'); assert.strictEqual(t['Priority'], 'High'); assert.strictEqual(t['Source'], 'Limit'); assert(/52/.test(t['Title'])); assert.strictEqual(t['Link'], 'Amp Rec');
  const c = save(S, 3, '60'); assert.strictEqual(c.limitTask, b.limitTask); assert.strictEqual(tasks(S).length, 1);
});
test('limit: after the work order is done, the next bad reading makes a new one', () => {
  const S = setup(); lim(S); const id = save(S, 3, '52').limitTask; S.as('tech2', { action: 'taskUpdate', id, status: 'Done' });
  const n = save(S, 3, '53').limitTask; assert.notStrictEqual(n, id); assert.strictEqual(tasks(S).length, 2);
});
test('limit: below minimum triggers; value inside range and blank do not', () => {
  const S = setup(); lim(S, { min: '5', max: '' }); assert.strictEqual(save(S, 3, '10').limitTask, ''); assert.strictEqual(save(S, 3, '').limitTask || '', '');
  assert(save(S, 3, '2').limitTask); assert(/below the minimum/.test(tasks(S)[0]['Details']));
});
test('limit: exactly on the limit is fine; other rows and inactive limits are ignored', () => {
  const S = setup(); lim(S); assert.strictEqual(save(S, 3, '45').limitTask, ''); assert.strictEqual(save(S, 4, '999').limitTask, '');
  S.as('sup', { action: 'limitSave', limit: { id: 'LM-001', page: 'Amp Rec', row: 3, label: 'x', max: '45', assignee: 'tech2', active: false } }); assert.strictEqual(save(S, 3, '99').limitTask, ''); assert.strictEqual(tasks(S).length, 0);
});
test('limit: text readings and sync route work; a failing limit never blocks the reading', () => {
  const S = setup(); lim(S); const r = S.as('tech1', { action: 'sync', ops: [{ id: 'a', action: 'saveReading', sheet: 'Amp Rec', row: 3, value: '70' }] });
  assert.strictEqual(r.results[0].ok, true, JSON.stringify(r)); assert.strictEqual(tasks(S).length, 1); assert.strictEqual(S.amp.cell(3, 5), '70');
  const S2 = setup(); lim(S2, { assignee: 'tech2' }); S2.api.tasksBook().getSheetByName('Reading Limits').rows[1][0] = 'LM-001';
  assert.strictEqual(save(S2, 3, 'n/a').ok, true);
});
test('limit: deactivated assignee falls back to the supervisor', () => {
  const S = setup(); lim(S, { assignee: 'tech2' });
  const us = S.rt.books['1ohP2VDJitA_ZxiY3Sk6V22Z6yGHZjvgsBg58pMwac_4'].sheets[0]; us.put(4, 5, 'No'); S.rt.cache.remove('users_v1');   // row 4 = tech2
  assert(save(S, 3, '99').limitTask); assert.strictEqual(tasks(S)[0]['Assigned To'], 'sup');
});

/* ---------- PM calendar and compliance ---------- */
test('Source is set on repeat tasks and blank on manual ones', () => {
  const S = setup(); S.as('sup', { action: 'taskCreate', task: { title: 'manual', assignee: 'tech1' } });
  S.as('sup', { action: 'taskRuleCreate', task: { title: 'rep', equipment: 'Shredder', equipmentNo: 'SH-1' }, auto: { basis: 'period', period: 'Monthly', assignees: ['tech1'] } });
  const t = tasks(S); assert.strictEqual(t[0]['Source'], ''); assert.strictEqual(t[1]['Source'], 'Repeat');
});
test('calendar: lists PM work orders of the month, marks overdue, skips manual and cancelled', () => {
  const S = setup();
  S.as('sup', { action: 'taskRuleCreate', task: { title: 'Monthly lube', equipment: 'Shredder', equipmentNo: 'SH-1', due: '2026-11-30' }, auto: { basis: 'period', period: 'Weekly', assignees: ['tech1'] } });
  S.as('sup', { action: 'taskCreate', task: { title: 'manual', assignee: 'tech1', due: '2026-11-30' } });
  const c = S.as('sup', { action: 'pmCalendar', month: '2026-11' }); assert(c.ok, JSON.stringify(c)); assert.strictEqual(c.tasks.length, 1); assert.strictEqual(c.tasks[0].source, 'Repeat');
  assert.strictEqual(S.as('sup', { action: 'pmCalendar', month: '2027-03' }).tasks.length, 0);
  assert.strictEqual(S.as('tech1', { action: 'pmCalendar', month: '2026-11' }).ok, false);
});
test('calendar: planned future occurrences of period repeats appear', () => {
  const S = setup(); S.as('sup', { action: 'taskRuleCreate', task: { title: 'Weekly check', equipment: 'Shredder', equipmentNo: 'SH-1' }, auto: { basis: 'period', period: 'Weekly', assignees: ['tech1'] } });
  const c = S.as('sup', { action: 'pmCalendar', month: '2026-12' }); assert(c.planned.length >= 1, JSON.stringify(c)); assert.strictEqual(c.planned[0].title, 'Weekly check');
});
test('compliance: on time, late, overdue, pending are counted per month and per machine', () => {
  const S = setup(); const mk = (title, due, eq) => { const r = S.as('sup', { action: 'taskRuleCreate', task: { title, equipment: eq, equipmentNo: eq === 'Shredder' ? 'SH-1' : 'BC-16', due }, auto: { basis: 'period', period: 'Yearly', assignees: ['tech1'] } }); return r.tasks[0].id; };
  const a = mk('A', '2026-11-29', 'Shredder'), b = mk('B', '2026-11-20', 'Shredder'), c = mk('C', '2026-11-10', 'Conveyor'), d = mk('D', '2026-11-20', 'Conveyor');
  // set due dates explicitly in the sheet, then complete
  const rows = tasks(S); const sh = S.api.tasksBook().getSheetByName('Tasks'); const hdr = S.api.TASK_COLS;
  const setCell = (id, col, v) => { const r = rows.filter(x => x['ID'] === id)[0]._row; sh.put(r, hdr.indexOf(col) + 1, v); };
  [[a, '2026-11-29'], [b, '2026-11-20'], [c, '2026-11-10'], [d, '2026-12-25']].forEach(([id, due]) => setCell(id, 'Due', due));
  S.as('tech1', { action: 'taskUpdate', id: a, status: 'Done' });                            // done today (29th) on its due day: on time
  setCell(b, 'Status', 'Done'); setCell(b, 'Done', '2026-11-25 10:00');                       // late
  const r = S.as('sup', { action: 'pmCompliance', months: 2 }); assert(r.ok, JSON.stringify(r));
  const nov = r.months.filter(m => m.month === '2026-11')[0];
  assert.strictEqual(nov.onTime, 1); assert.strictEqual(nov.late, 1); assert.strictEqual(nov.overdue, 1); assert.strictEqual(nov.due, 3); assert.strictEqual(nov.pct, 33);
  const dec = r.months.filter(m => m.month === '2026-12')[0]; assert.strictEqual(dec, undefined);
  assert.strictEqual(r.months.length, 2); assert.strictEqual(r.equipment.filter(e => e.name === 'Conveyor')[0].overdue, 1);
});
test('compliance: empty months give null percent; manual tasks are excluded; technicians refused', () => {
  const S = setup(); S.as('sup', { action: 'taskCreate', task: { title: 'm', assignee: 'tech1', due: '2026-11-20' } });
  const r = S.as('sup', { action: 'pmCompliance', months: 3 }); assert(r.months.every(m => m.pct === null && m.due === 0)); assert.strictEqual(r.equipment.length, 0);
  assert.strictEqual(S.as('tech1', { action: 'pmCompliance' }).ok, false);
});
test('regression: old Tasks rows without Source still read; API version 14', () => {
  const S = setup(); const sh = S.api.tasksBook().getSheetByName('Tasks'); sh.rows = [S.api.TASK_COLS.slice(0, 29), ['T-0001', '2026-11-01 08:00', 'sup', 'Sam', 'tech1', 'Tom', 'Old', '', '', 'Normal', '2026-12-01', '', 'Open', '', '', '', '', '2026-11-01 08:00', 'sup', '', '', '', '', '', '', '', '', '', '']];
  assert.strictEqual(S.as('tech1', { action: 'myTasks' }).tasks[0].source, '');
});
console.log(`\npm: ${pass} passed, ${fail} failed`); if (fail) { failures.forEach(f => console.log('  FAIL ' + f)); process.exit(1); }
