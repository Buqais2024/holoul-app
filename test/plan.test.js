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
  es.appendRow(['Equipment Name', 'Equipment Number', 'Line', 'Location', 'Category', 'Record Status', 'Automation task']); es.appendRow(['Shredder', 'SH-1', 'L1', 'Hall A', 'Shredder', '', '']); es.appendRow(['Conveyor', 'BC-16', 'L1', 'Hall A', 'Conveyor', '', '']);
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
const inbox = (S, u) => S.as(u, { action: 'pushInbox' }).messages;
const phone = (S, u) => S.api.tasksBook().getSheetByName('Push Devices').appendRow([u, 'https://push.example/' + u, 'k', 'a', 'Android', '2026-11-01 08:00', '', '']);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const S1 = [{ text: 'Guard in place', type: 'passfail' }, { text: 'Describe the damage', type: 'text', showIf: { step: 1, when: 'fail' } }, { text: 'Motor temp', type: 'number', unit: 'C', min: 20, max: 80 }, { text: 'Area clean', type: 'check', required: false }];
const proc = (S, extra, u) => S.as(u || 'sup', { action: 'procedureSave', procedure: Object.assign({ name: 'Shredder start-up', steps: S1 }, extra || {}) });
const runp = (S, u, b) => S.as(u, Object.assign({ action: 'procedureRun', procedureId: 'P-001' }, b));
const ok1 = { s1: { v: 'pass' }, s3: { v: 55 } };

/* ---------- procedures ---------- */
test('procedure: supervisor saves; steps get numbered ids; technician cannot', () => {
  const S = setup(); const r = proc(S, { category: 'Mechanical', failAssignee: 'tech1' }); assert(r.ok && r.procedure.id === 'P-001', JSON.stringify(r));
  assert.deepStrictEqual(r.procedure.steps.map(s => s.id), ['s1', 's2', 's3', 's4']); assert.deepStrictEqual(r.procedure.steps[1].showIf, { step: 's1', when: 'fail' });
  assert.strictEqual(r.procedure.steps[2].min, 20); assert.strictEqual(r.procedure.steps[3].required, false); assert.strictEqual(proc(S, {}, 'tech1').ok, false);
});
test('procedure: bad input refused (no name, no steps, empty step, 41 steps, forward/non-passfail condition, min above max, unknown fail assignee)', () => {
  const S = setup(); const bad = e => assert.strictEqual(proc(S, e).ok, false, JSON.stringify(e).slice(0, 80));
  bad({ name: ' ' }); bad({ steps: [] }); bad({ steps: [{ text: '' }] }); bad({ steps: Array.from({ length: 41 }, (_, i) => ({ text: 'x' + i })) });
  bad({ steps: [{ text: 'a', showIf: { step: 1, when: 'fail' } }] }); bad({ steps: [{ text: 'a', type: 'text' }, { text: 'b', showIf: { step: 1, when: 'fail' } }] });
  bad({ steps: [{ text: 'a', type: 'number', min: 9, max: 1 }] }); bad({ failAssignee: 'ghost' });
});
test('procedure: edit keeps the ID; inactive ones are hidden from technicians but not supervisors', () => {
  const S = setup(); proc(S); const e = S.as('sup', { action: 'procedureSave', procedure: { id: 'P-001', name: 'Renamed', steps: [{ text: 'One' }], active: false } }); assert(e.ok && e.procedure.id === 'P-001');
  assert.strictEqual(S.as('tech1', { action: 'procedures' }).procedures.length, 0); const m = S.as('sup', { action: 'procedures' }); assert.strictEqual(m.procedures[0].name, 'Renamed'); assert.strictEqual(m.canEdit, true);
  assert.strictEqual(S.as('sup', { action: 'procedureSave', procedure: { id: 'P-999', name: 'x', steps: [{ text: 'a' }] } }).ok, false);
});
test('run: all pass → Passed, no work order; answers saved with the asset', () => {
  const S = setup(); proc(S); const r = runp(S, 'tech1', { assetNo: 'SH-1', answers: ok1 }); assert(r.ok && r.failed === 0 && r.order === '' && r.run === 'RN-0001', JSON.stringify(r));
  const l = S.as('sup', { action: 'procedureRuns' }).runs[0]; assert.deepStrictEqual([l.result, l.asset, l.name], ['Passed', 'Shredder', 'Tom Tech']);
});
test('run: required steps must be answered; fail needs a note; number must be numeric; optional may stay empty', () => {
  const S = setup(); proc(S); const bad = a => assert.strictEqual(runp(S, 'tech1', { answers: a }).ok, false, JSON.stringify(a));
  bad({}); bad({ s1: { v: 'pass' } }); bad({ s1: { v: 'fail' }, s3: { v: 50 } }); bad({ s1: { v: 'pass' }, s3: { v: 'abc' } }); bad({ s1: { v: 'maybe' }, s3: { v: 50 } });
  assert(runp(S, 'tech1', { answers: ok1 }).ok);
});
test('run: conditional step is hidden unless its trigger answer matches; its answer is then ignored', () => {
  const S = setup(); proc(S); const r = runp(S, 'tech1', { answers: { s1: { v: 'pass' }, s2: { v: 'ignored' }, s3: { v: 40 } } }); assert(r.ok);
  const a = S.as('sup', { action: 'procedureAudit', id: r.run }); assert.deepStrictEqual(a.steps.map(x => x.text), ['Guard in place', 'Motor temp', 'Area clean']); assert.deepStrictEqual(a.steps.map(x => x.result), ['pass', 'pass', 'skip']);
  assert.strictEqual(runp(S, 'tech1', { answers: { s1: { v: 'fail', note: 'bent' }, s3: { v: 40 } } }).ok, false);   // now the follow-up is required
  const f = runp(S, 'tech1', { answers: { s1: { v: 'fail', note: 'bent' }, s2: { v: 'Guard bent at the hinge' }, s3: { v: 40 } } }); assert(f.ok && f.failed === 1, JSON.stringify(f));
});
test('run: a failed step creates a High work order for the fail assignee with the problems listed; supervisors are told', () => {
  const S = setup(); phone(S, 'ops'); proc(S, { category: 'Mechanical', failAssignee: 'tech2' });
  const r = runp(S, 'tech1', { assetNo: 'SH-1', answers: { s1: { v: 'fail', note: 'Missing bolt' }, s2: { v: 'Bolt gone' }, s3: { v: 95 } } });
  assert(r.ok && r.failed === 2 && /^T-/.test(r.order), JSON.stringify(r));
  const t = S.api.readTasks().filter(x => x['ID'] === r.order)[0]; assert.deepStrictEqual([t['Assigned To'], t['Priority'], t['Source'], t['Equipment No'], t['Category']], ['tech2', 'High', 'Procedure', 'SH-1', 'Mechanical']);
  assert(/Guard in place: Missing bolt/.test(t['Details']) && /Motor temp: 95 C is outside 20 – 80/.test(t['Details']), t['Details']);
  assert.strictEqual(inbox(S, 'ops').filter(x => x.kind === 'procedureFail').length, 1); assert.strictEqual(S.as('sup', { action: 'procedureRuns' }).runs[0].order, r.order);
});
test('run: a technician without the create-task right can still trigger the work order', () => {
  const S = setup(); proc(S); const r = runp(S, 'tech2', { answers: { s1: { v: 'fail', note: 'x' }, s2: { v: 'y' }, s3: { v: 30 } } }); assert(r.ok && r.order, JSON.stringify(r));
  assert.strictEqual(S.api.readTasks().filter(x => x['ID'] === r.order)[0]['Created By'], 'tech2');
});
test('work order with a procedure: cannot finish until the procedure is done; done once only; others cannot run it', () => {
  const S = setup(); proc(S); const id = wo(S, 'tech1', { procedure: 'P-001', equipmentNo: 'SH-1', equipment: 'Shredder' }); assert.strictEqual(S.api.taskOut(S.api.readTasks().filter(x => x['ID'] === id)[0]).procedure, 'P-001');
  assert.strictEqual(S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'x' }).ok, false);
  assert.strictEqual(runp(S, 'tech2', { taskId: id, answers: ok1 }).ok, false);
  const r = runp(S, 'tech1', { taskId: id, answers: ok1 }); assert(r.ok, JSON.stringify(r)); assert.strictEqual(S.as('sup', { action: 'procedureRuns', taskId: id }).runs.length, 1);
  assert.strictEqual(runp(S, 'tech1', { taskId: id, answers: ok1 }).ok, false); assert(S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'x' }).ok);
  assert.strictEqual(runp(S, 'tech1', { taskId: id, answers: ok1 }).ok, false);
});
test('work order: unknown or inactive procedure cannot be attached; can be removed; other procedure refused at run time', () => {
  const S = setup(); proc(S); proc(S, { name: 'Other' });
  assert.strictEqual(S.as('sup', { action: 'taskCreate', task: { title: 'x', assignee: 'tech1', procedure: 'P-077' } }).ok, false);
  const id = wo(S, 'tech1', { procedure: 'P-001' }); assert.strictEqual(runp(S, 'tech1', { procedureId: 'P-002', taskId: id, answers: ok1 }).ok, false);
  S.as('sup', { action: 'taskEdit', task: { id, procedure: '' } }); assert.strictEqual(S.api.taskOut(S.api.readTasks().filter(x => x['ID'] === id)[0]).procedure, ''); assert(S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'x' }).ok);
});
test('audit: lists answers with results, the work order, its photo and signature; people only see their own runs', () => {
  const S = setup(); proc(S); const id = wo(S, 'tech1', { procedure: 'P-001', needSignature: true }); const r = runp(S, 'tech1', { taskId: id, answers: { s1: { v: 'fail', note: 'bent' }, s2: { v: 'Bent' }, s3: { v: 99 }, s4: { v: true } } });
  S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'x', photo: 'https://drive.example/p.jpg', signature: PNG, signedName: 'Khalid' });
  const a = S.as('sup', { action: 'procedureAudit', id: r.run }); assert(a.ok, JSON.stringify(a));
  assert.deepStrictEqual(a.steps.map(x => x.result), ['fail', 'pass', 'fail', 'pass']); assert.strictEqual(a.steps[0].note, 'bent'); assert.strictEqual(a.steps[3].answer, 'Done');
  assert.deepStrictEqual([a.task.photo, a.task.signature, a.task.signedName], ['https://drive.example/p.jpg', PNG, 'Khalid']);
  assert(S.as('tech1', { action: 'procedureAudit', id: r.run }).ok); assert.strictEqual(S.as('tech2', { action: 'procedureAudit', id: r.run }).ok, false);
  assert.strictEqual(S.as('tech2', { action: 'procedureRuns' }).runs.length, 0); assert.strictEqual(S.as('tech1', { action: 'procedureRuns' }).runs.length, 1);
});

/* ---------- purchase orders ---------- */
const po = (S, u, b) => S.as(u || 'sparky', { action: 'poCreate', po: Object.assign({ lines: [{ kind: 'electrical', no: 'E-200', qty: 4, cost: 12.5 }, { kind: 'mechanical', no: 'M-7', qty: 2, cost: 300 }] }, b || {}) });
test('po: people with spare-parts rights request; others cannot; total, status and lines are right', () => {
  const S = setup(); assert.strictEqual(po(S, 'tech1').ok, false); const r = po(S, 'sparky', { note: 'Urgent' }); assert(r.ok && r.id === 'PO-0001', JSON.stringify(r));
  assert.deepStrictEqual([r.order.status, r.order.total, r.order.lines.length, r.order.note], ['Requested', 650, 2, 'Urgent']); assert.strictEqual(r.order.lines[0].name, 'Relay');
  assert.strictEqual(S.as('tech1', { action: 'poList' }).ok, false);
});
test('po: unknown part, duplicate, zero quantity, no lines, unknown supplier refused; cost falls back to the stored unit cost', () => {
  const S = setup(); const bad = b => assert.strictEqual(po(S, 'sup', b).ok, false, JSON.stringify(b).slice(0, 80));
  bad({ lines: [] }); bad({ lines: [{ kind: 'electrical', no: 'NOPE', qty: 1 }] }); bad({ lines: [{ kind: 'electrical', no: 'E-100', qty: 0 }] });
  bad({ lines: [{ kind: 'electrical', no: 'E-100', qty: 1 }, { kind: 'electrical', no: 'E-100', qty: 2 }] }); bad({ vendorId: 'V999' });
  S.as('sup', { action: 'partDetails', part: { kind: 'electrical', no: 'E-100', cost: '45' } }); const r = po(S, 'sup', { lines: [{ kind: 'electrical', no: 'E-100', qty: 2 }] }); assert.strictEqual(r.order.total, 90);
});
test('po: supervisors are told of a request; approve / reject (reason needed) and the requester is told', () => {
  const S = setup(); phone(S, 'sup'); phone(S, 'sparky'); po(S, 'sparky'); assert.strictEqual(inbox(S, 'sup').filter(x => x.kind === 'po').length, 1);
  assert.strictEqual(S.as('sparky', { action: 'poDecide', id: 'PO-0001', decision: 'approve' }).ok, false); assert.strictEqual(S.as('sup', { action: 'poDecide', id: 'PO-0001', decision: 'reject' }).ok, false);
  assert(S.as('sup', { action: 'poDecide', id: 'PO-0001', decision: 'approve' }).ok); assert.strictEqual(inbox(S, 'sparky').filter(x => x.kind === 'poDecision')[0].status, 'Approved');
  assert.strictEqual(S.as('sup', { action: 'poDecide', id: 'PO-0001', decision: 'reject', note: 'late' }).ok, false);
  po(S, 'sparky'); const x = S.as('sup', { action: 'poDecide', id: 'PO-0002', decision: 'reject', note: 'Too expensive' }); assert(x.ok && x.order.status === 'Rejected' && x.order.decisionNote === 'Too expensive');
});
test('po: ordered only after approval; partial then full delivery adds stock and logs it', () => {
  const S = setup(); po(S, 'sparky'); assert.strictEqual(S.as('sparky', { action: 'poOrder', id: 'PO-0001' }).ok, false); S.as('sup', { action: 'poDecide', id: 'PO-0001', decision: 'approve' });
  assert.strictEqual(S.as('sparky', { action: 'poReceive', id: 'PO-0001' }).ok, false); const o = S.as('sparky', { action: 'poOrder', id: 'PO-0001' }); assert(o.ok && o.order.status === 'Ordered' && o.order.ordered);
  const p = S.as('sparky', { action: 'poReceive', id: 'PO-0001', lines: [{ index: 0, qty: 3 }] }); assert(p.ok && p.order.status === 'Partly received', JSON.stringify(p)); assert.strictEqual(p.order.lines[0].got, 3);
  assert.strictEqual(S.as('sparky', { action: 'poReceive', id: 'PO-0001', lines: [{ index: 0, qty: 2 }] }).ok, false);   // only 1 left
  const f = S.as('sparky', { action: 'poReceive', id: 'PO-0001' }); assert(f.ok && f.order.status === 'Received' && f.order.received, JSON.stringify(f));
  const rel = S.as('sup', { action: 'partInfo', kind: 'electrical', no: 'E-200' }); assert.strictEqual(JSON.stringify(rel).includes('"PO PO-0001"') || JSON.stringify(rel).includes('PO PO-0001'), true, JSON.stringify(rel).slice(0, 300));
  const stock = S.api.tasksBook().getSheetByName('Part Usage'); assert(stock.getLastRow() >= 3);
  assert.strictEqual(S.as('sparky', { action: 'poReceive', id: 'PO-0001' }).ok, false);
});
test('po: receiving raises the on-hand quantity of both kinds of part', () => {
  const S = setup(); po(S, 'sparky'); S.as('sup', { action: 'poDecide', id: 'PO-0001', decision: 'approve' }); S.as('sparky', { action: 'poOrder', id: 'PO-0001' });
  const before = S.as('sup', { action: 'spares' }).spares; const e0 = before.electrical.filter(x => x.no === 'E-200')[0].qty, m0 = before.mechanical.filter(x => x.no === 'M-7')[0]; S.as('sparky', { action: 'poReceive', id: 'PO-0001' });
  const after = S.as('sup', { action: 'spares' }).spares; assert.strictEqual(Number(after.electrical.filter(x => x.no === 'E-200')[0].qty), Number(e0) + 4);
  const m1 = after.mechanical.filter(x => x.no === 'M-7')[0]; assert.strictEqual(Number(m1.available) - Number(m1.used), Number(m0.available) - Number(m0.used) + 2);
});
test('po: a deleted part stops the whole delivery before any stock changes', () => {
  const S = setup(); po(S, 'sparky'); S.as('sup', { action: 'poDecide', id: 'PO-0001', decision: 'approve' }); S.as('sparky', { action: 'poOrder', id: 'PO-0001' });
  const lines = JSON.parse(S.api.tasksBook().getSheetByName('Purchase Orders').getRange(2, 7).getValue()); lines[1].no = 'GONE'; S.api.tasksBook().getSheetByName('Purchase Orders').getRange(2, 7).setValue(JSON.stringify(lines));
  const e0 = S.as('sup', { action: 'spares' }).spares.electrical.filter(x => x.no === 'E-200')[0].qty; assert.strictEqual(S.as('sparky', { action: 'poReceive', id: 'PO-0001' }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'spares' }).spares.electrical.filter(x => x.no === 'E-200')[0].qty, e0);
});
test('po: cancel — requester while Requested, supervisor any time before delivery, never after parts arrived', () => {
  const S = setup(); po(S, 'sparky'); assert.strictEqual(S.as('tech1', { action: 'poCancel', id: 'PO-0001' }).ok, false); assert(S.as('sparky', { action: 'poCancel', id: 'PO-0001' }).ok);
  assert.strictEqual(S.as('sup', { action: 'poCancel', id: 'PO-0001' }).ok, false);   // already closed
  po(S, 'sparky'); S.as('sup', { action: 'poDecide', id: 'PO-0002', decision: 'approve' }); assert.strictEqual(S.as('sparky', { action: 'poCancel', id: 'PO-0002' }).ok, false); S.as('sparky', { action: 'poOrder', id: 'PO-0002' });
  S.as('sparky', { action: 'poReceive', id: 'PO-0002', lines: [{ index: 0, qty: 1 }] }); const c = S.as('sup', { action: 'poCancel', id: 'PO-0002' }); assert.strictEqual(c.ok, false);
  po(S, 'sparky'); S.as('sup', { action: 'poDecide', id: 'PO-0003', decision: 'approve' }); assert(S.as('sup', { action: 'poCancel', id: 'PO-0003', note: 'changed plans' }).ok);
});
test('po: list shows open ones first; supplier name is stored', () => {
  const S = setup(); S.as('sup', { action: 'vendorSave', vendor: { name: 'ABB' } }); po(S, 'sup', { vendorId: 'V001' }); po(S, 'sup'); S.as('sup', { action: 'poDecide', id: 'PO-0002', decision: 'reject', note: 'x' });
  const l = S.as('sup', { action: 'poList' }); assert.deepStrictEqual(l.orders.map(o => o.id), ['PO-0001', 'PO-0002']); assert.strictEqual(l.orders[0].vendor, 'ABB'); assert.strictEqual(l.canDecide, true);
});

/* ---------- scheduling ---------- */
const WK = '2026-12-06';   // a Sunday
test('availability: default Sunday–Thursday, 8 hours; supervisor saves a pattern; bad input refused', () => {
  const S = setup(); const a = S.as('sup', { action: 'availability' }); const t = a.people.filter(x => x.username === 'tech1')[0]; assert.deepStrictEqual([t.workDays, t.hours], [[0, 1, 2, 3, 4], 8]);
  assert(S.as('sup', { action: 'availabilitySave', availability: { username: 'tech1', workDays: [6, 0, 1, 2, 3], hours: 6.5 } }).ok); const t2 = S.as('sup', { action: 'availability' }).people.filter(x => x.username === 'tech1')[0]; assert.deepStrictEqual([t2.workDays, t2.hours], [[0, 1, 2, 3, 6], 6.5]);
  assert.strictEqual(S.as('sup', { action: 'availabilitySave', availability: { username: 'tech1', workDays: [0], hours: 30 } }).ok, false); assert.strictEqual(S.as('sup', { action: 'availabilitySave', availability: { username: 'nobody', workDays: [0], hours: 8 } }).ok, false);
  assert.strictEqual(S.as('tech1', { action: 'availability' }).ok, false); assert.strictEqual(S.as('tech1', { action: 'availabilitySave', availability: { username: 'tech1', workDays: [0], hours: 8 } }).ok, false);
});
test('time off: add and delete; end before start refused; open tasks inside the dates are reported', () => {
  const S = setup(); wo(S, 'tech1', { due: '2026-12-08' }); const r = S.as('sup', { action: 'timeOffAdd', timeOff: { username: 'tech1', from: '2026-12-07', to: '2026-12-09', type: 'Sick', note: 'flu' } }); assert(r.ok && r.id === 'O-001' && r.clashes.length === 1, JSON.stringify(r));
  assert.strictEqual(S.as('sup', { action: 'timeOffAdd', timeOff: { username: 'tech1', from: '2026-12-09', to: '2026-12-07' } }).ok, false); assert.strictEqual(S.as('sup', { action: 'timeOffAdd', timeOff: { username: 'tech1' } }).ok, false);
  assert.strictEqual(S.as('tech1', { action: 'timeOffAdd', timeOff: { username: 'tech1', from: '2026-12-07' } }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'availability' }).timeOff[0].type, 'Sick'); assert(S.as('sup', { action: 'timeOffDelete', id: 'O-001' }).ok); assert.strictEqual(S.as('sup', { action: 'availability' }).timeOff.length, 0);
});
test('schedule: seven days; capacity 8 on working days, 0 on Fri/Sat and time off; tasks sit on their due day; supervisor only', () => {
  const S = setup(); S.as('sup', { action: 'timeOffAdd', timeOff: { username: 'tech1', from: '2026-12-09', to: '2026-12-09', type: 'Leave' } }); const a = wo(S, 'tech1', { due: '2026-12-08' });
  const r = S.as('sup', { action: 'schedule', from: WK }); assert(r.ok && r.days.length === 7 && r.days[0] === WK && r.days[6] === '2026-12-12', JSON.stringify(r).slice(0, 200));
  const p = r.people.filter(x => x.username === 'tech1')[0]; assert.deepStrictEqual(p.cells.map(c => c.capacity), [8, 8, 8, 0, 8, 0, 0]); assert.deepStrictEqual([p.cells[3].status, p.cells[3].reason, p.cells[5].status], ['off', 'Leave', 'rest']);
  assert.deepStrictEqual(p.cells[2].tasks.map(t => t.id), [a]); assert.strictEqual(p.cells[2].load, 1); assert.strictEqual(S.as('tech1', { action: 'schedule' }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'schedule' }).days.length, 7);
});
test('schedule: overdue and unscheduled work are listed per person; later work is counted; done and cancelled are left out', () => {
  const S = setup(); wo(S, 'tech2', { due: '2020-01-01' }); wo(S, 'tech2', {}); wo(S, 'tech2', { due: '2027-06-01' }); const d = wo(S, 'tech2', { due: '2026-12-07' }); S.as('tech2', { action: 'taskUpdate', id: d, status: 'Done', note: 'x' });
  const c = wo(S, 'tech2', { due: '2026-12-07' }); S.as('sup', { action: 'taskEdit', task: { id: c, status: 'Cancelled' } });
  const p = S.as('sup', { action: 'schedule', from: WK }).people.filter(x => x.username === 'tech2')[0]; assert.deepStrictEqual([p.overdue.length, p.unscheduled.length, p.later], [1, 1, 1]); assert.strictEqual(p.cells.reduce((n, x) => n + x.tasks.length, 0), 0);
});
test('estimate: average hours of finished jobs — same machine and job first, then machine, job, category; none when no history', () => {
  const S = setup(); const done = (extra, h) => { const id = wo(S, 'tech1', extra); S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'x', hours: h }); };
  assert.strictEqual(S.as('sup', { action: 'estimate', title: 'Grease', equipmentNo: 'SH-1' }).hours, null);
  done({ title: 'Grease', equipmentNo: 'SH-1' }, 2); done({ title: 'Grease', equipmentNo: 'SH-1' }, 3); done({ title: 'Other', equipmentNo: 'SH-1' }, 10); done({ title: 'Grease', equipmentNo: 'BC-16' }, 6); done({ title: 'Weld', category: 'Mechanical' }, 5);
  const e = S.as('sup', { action: 'estimate', title: 'Grease', equipmentNo: 'SH-1' }); assert.deepStrictEqual([e.hours, e.n, e.basis], [2.5, 2, 'same machine and job']);
  const m = S.as('sup', { action: 'estimate', title: 'New', equipmentNo: 'SH-1' }); assert.deepStrictEqual([m.hours, m.basis], [5, 'same machine']);   // (2+3+10)/3
  assert.strictEqual(S.as('sup', { action: 'estimate', title: 'Grease', equipmentNo: 'ZZ' }).basis, 'same job'); assert.strictEqual(S.as('sup', { action: 'estimate', title: 'Q', category: 'Mechanical' }).basis, 'same category');
  assert.strictEqual(S.as('tech1', { action: 'estimate', title: 'x' }).ok, false);
});
test('schedule: load uses the estimate (1 hour when there is none)', () => {
  const S = setup(); const id = wo(S, 'tech1', { title: 'Grease', equipmentNo: 'SH-1' }); S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'x', hours: 3 }); wo(S, 'tech1', { title: 'Grease', equipmentNo: 'SH-1', due: '2026-12-07' }); wo(S, 'tech1', { title: 'Unknown', due: '2026-12-07' });
  const c = S.as('sup', { action: 'schedule', from: WK }).people.filter(x => x.username === 'tech1')[0].cells[1]; assert.strictEqual(c.load, 4); assert.deepStrictEqual(c.tasks.map(t => t.hours).sort(), [3, null]);
});
test('move: change day and person; off day gives a conflict until forced; unschedule; finished work cannot move', () => {
  const S = setup(); S.as('sup', { action: 'timeOffAdd', timeOff: { username: 'tech2', from: '2026-12-08', to: '2026-12-08', type: 'Sick' } }); const id = wo(S, 'tech1', { due: '2026-12-06' });
  const m = S.as('sup', { action: 'scheduleMove', id, due: '2026-12-07' }); assert(m.ok && m.task.due === '2026-12-07' && m.warning === '', JSON.stringify(m));
  const c = S.as('sup', { action: 'scheduleMove', id, due: '2026-12-08', assignee: 'tech2' }); assert.deepStrictEqual([c.ok, c.conflict, c.reason], [false, true, 'Sick']); assert(/Eli Elec is not working on 2026-12-08/.test(c.error), c.error);
  assert.strictEqual(S.api.readTasks().filter(x => x['ID'] === id)[0]['Assigned To'], 'tech1');
  const f = S.as('sup', { action: 'scheduleMove', id, due: '2026-12-08', assignee: 'tech2', force: true }); assert(f.ok && f.task.assignee === 'tech2' && /not working/.test(f.warning));
  const fr = S.as('sup', { action: 'scheduleMove', id, due: '2026-12-11' }); assert.strictEqual(fr.ok, false); assert.strictEqual(fr.reason, 'Day off');
  const u = S.as('sup', { action: 'scheduleMove', id, due: '' }); assert(u.ok && u.task.due === ''); S.as('tech2', { action: 'taskUpdate', id, status: 'Done', note: 'x' });
  assert.strictEqual(S.as('sup', { action: 'scheduleMove', id, due: '2026-12-07' }).ok, false); assert.strictEqual(S.as('tech1', { action: 'scheduleMove', id, due: '2026-12-07' }).ok, false);
});
test('move: reassigning an in-progress job sends it back to Open', () => {
  const S = setup(); const id = wo(S, 'tech1', { due: '2026-12-07' }); S.as('tech1', { action: 'taskUpdate', id, status: 'In progress' }); const r = S.as('sup', { action: 'scheduleMove', id, assignee: 'tech2', due: '2026-12-07' }); assert(r.ok && r.task.status === 'Open' && r.task.assignee === 'tech2');
});
test('warning: creating or editing a work order for someone who is off that day says so, but still saves', () => {
  const S = setup(); S.as('sup', { action: 'timeOffAdd', timeOff: { username: 'tech1', from: '2026-12-07', to: '2026-12-07' } });
  const r = S.as('sup', { action: 'taskCreate', task: { title: 'x', assignee: 'tech1', due: '2026-12-07' } }); assert(r.ok && /Tom Tech is not working/.test(r.warning), JSON.stringify(r));
  const ok = S.as('sup', { action: 'taskCreate', task: { title: 'x', assignee: 'tech1', due: '2026-12-08' } }); assert.strictEqual(ok.warning, '');
  const e = S.as('sup', { action: 'taskEdit', task: { id: ok.task.id, due: '2026-12-11' } }); assert(e.ok && /Day off/.test(e.warning));
});
test('regression: API version 20; new tabs exist; existing work order output unchanged shape', () => {
  const S = setup(); assert.strictEqual(JSON.parse(S.api.doGet({}).s).version, 20); ['Procedures', 'Procedure Runs', 'Purchase Orders', 'Availability', 'Time Off'].forEach(n => assert(S.api.tasksBook().getSheetByName(n), n));
  const id = wo(S, 'tech1'); const t = S.api.taskOut(S.api.readTasks().filter(x => x['ID'] === id)[0]); assert.strictEqual(t.procedure, ''); assert.strictEqual(S.api.readTasks()[0]['Procedure'], '');
});
console.log(`\nplan: ${pass} passed, ${fail} failed`); if (fail) { failures.forEach(f => console.log('  FAIL ' + f)); process.exit(1); }
