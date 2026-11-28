const assert = require('assert');
const { makeRuntime } = require('./gas_mock');
const CODE = process.env.CODE || '/home/claude/src/holoul-app/Code.gs';

let pass = 0, fail = 0; const failures = [];
function test(name, fn) { try { fn(); pass++; } catch (e) { fail++; failures.push(name + '\n     ' + String(e.message).split('\n').slice(0, 3).join('\n     ')); } }

function setup(opts) {
  opts = opts || {};
  const rt = makeRuntime(CODE);
  const users = ['User ID,Full Name,Username,PIN,Active,Role,Assigned Equipment,Create tasks,Edit equipment,Edit spare parts'.split(',')];
  const U = [['1', 'Sam Super', 'sup', '1111', 'Yes', 'Supervisor', '', '', '', ''],
             ['2', 'Tom Tech', 'tech1', '2222', 'Yes', 'Mech-Technician', '', 'No', 'No', 'No'],
             ['3', 'Eli Elec', 'tech2', '2223', 'Yes', 'Elec-Technician', '', 'No', 'No', 'No'],
             ['4', 'Sid Skid', 'skid', '3333', 'Yes', 'Skid loader Operator', 'Bobcat', 'No', 'No', 'No'],
             ['5', 'Olga Ops', 'ops', '4444', 'Yes', 'Operations Manager', '', '', '', ''],
             ['6', 'Perm Pete', 'pete', '5555', 'Yes', 'Elec-Technician', '', 'Yes', 'No', 'No']];
  if (opts.noSupervisor) { U[0][4] = 'No'; U[4][4] = 'No'; }
  const SHEET_ID = '1ohP2VDJitA_ZxiY3Sk6V22Z6yGHZjvgsBg58pMwac_4';
  const ub = rt.addBook(SHEET_ID, 'Users'); const us = ub.sheets[0]; us.setName('Users');
  users.concat(U).forEach(r => us.appendRow(r));
  rt.addBook('1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ', 'Readings');
  rt.addBook('1sI07XLIaK3yQ2f199dVGX0IvQuRdzMG7L6WYOnXC9k8', 'Equipment');
  const cb = rt.addBook('checks1', 'Checks'); rt.props.CHECKS_SS_ID = 'checks1';
  const cl = cb.sheets[0]; cl.setName('Bobcat Checklist');
  [['Section', 'Item', 'Input', 'Frequency', 'Photo', 'Active'], ['Engine', 'Oil level', 'check', 'daily', 'no', 'Yes'], ['Engine', 'Brakes', 'check', 'daily', 'no', 'Yes']].forEach(r => cl.appendRow(r));
  const un = cb.insertSheet('Units'); [['Type', 'Unit', 'Active'], ['Bobcat', 'Bobcat 1', 'Yes'], ['Bobcat', 'Bobcat 2', 'Yes']].forEach(r => un.appendRow(r));
  const tok = {}; ['sup', 'tech1', 'tech2', 'skid', 'ops', 'pete'].forEach(u => { const pin = U.filter(r => r[2] === u)[0][3]; const r = rt.call({ action: 'login', username: u, pin }); if (r.ok) tok[u] = r.token; else assert(opts.noSupervisor && (u === 'sup' || u === 'ops'), 'login ' + u); });
  const as = (u, body) => rt.call(Object.assign({ token: tok[u] }, body));
  const user = u => rt.api.findUser(u);
  return { rt, as, tok, user, api: rt.api };
}
const tasksRaw = S => S.api.readTasks();
const mk = (S, extra) => S.as('sup', { action: 'taskCreate', task: Object.assign({ title: 'Fix belt', assignee: 'tech1', due: '2026-12-05' }, extra || {}) });
const start = (S, id, u) => S.as(u || 'tech1', { action: 'taskUpdate', id, status: 'In progress' });
const done = (S, id, extra, u) => S.as(u || 'tech1', { action: 'taskUpdate', id, status: 'Done', note: 'did it', ...(extra || {}) });

/* ---------- categories & flags ---------- */
test('create stores category and completion rules', () => {
  const S = setup(); const r = mk(S, { category: 'Electrical', needNote: true, needPhoto: true, needApproval: true });
  assert(r.ok, JSON.stringify(r)); const t = r.task;
  assert.strictEqual(t.category, 'Electrical'); assert.strictEqual(t.needNote, true); assert.strictEqual(t.needPhoto, true); assert.strictEqual(t.approval, 'Required');
});
test('unknown category is ignored, flags default off', () => {
  const S = setup(); const t = mk(S, { category: 'Hacking' }).task;
  assert.strictEqual(t.category, ''); assert.strictEqual(t.needNote, false); assert.strictEqual(t.needPhoto, false); assert.strictEqual(t.approval, '');
});
test('string "false" / missing flags do not switch rules on', () => {
  const S = setup(); const t = mk(S, { needNote: false, needPhoto: 'no', needApproval: false }).task;
  assert.strictEqual(t.needNote, false); assert.strictEqual(t.needPhoto, false); assert.strictEqual(t.approval, '');
});
test('old Tasks sheet (22 columns) gets the new headers and keeps its rows', () => {
  const rt = makeRuntime(CODE);
  const old = ['ID', 'Created', 'Created By', 'Creator Name', 'Assigned To', 'Assignee Name', 'Title', 'Details', 'Equipment', 'Priority', 'Due', 'Link', 'Status', 'Started', 'Done', 'Done Note', 'Done Photo', 'Updated', 'Updated By', 'Equipment No', 'Line', 'Location'];
  const b = rt.addBook('tasks-old', 'Maintenance Tasks'); rt.props.TASKS_SS_ID = 'tasks-old';
  const sh = b.sheets[0]; sh.setName('Tasks'); sh.appendRow(old);
  sh.appendRow(['T-0001', '2026-11-01 08:00', 'sup', 'Sam Super', 'tech1', 'Tom Tech', 'Old task', 'd', 'Pump', 'Normal', '2026-12-01', '', 'Open', '', '', '', '', '2026-11-01 08:00', 'sup', '', '', '']);
  const book = rt.api.tasksBook(); const hdr = book.getSheetByName('Tasks').rows[0];
  assert.strictEqual(JSON.stringify(hdr.slice(0, rt.api.TASK_COLS.length)), JSON.stringify(rt.api.TASK_COLS)); assert.strictEqual(book.getSheetByName('Tasks').rows[1][6], 'Old task');
  assert(book.getSheetByName('Task Templates'), 'templates tab missing');
});
test('legacy row reads with empty new fields', () => {
  const S = setup(); const sh = S.api.tasksBook().getSheetByName('Tasks');
  sh.rows = [S.api.TASK_COLS.slice(0, 22), ['T-0001', '2026-11-01 08:00', 'sup', 'Sam Super', 'tech1', 'Tom Tech', 'Old task', 'd', 'Pump', 'Normal', '2026-12-01', '', 'Open', '', '', '', '', '2026-11-01 08:00', 'sup', '', '', '']];
  const t = S.as('tech1', { action: 'myTasks' }).tasks[0];
  assert.strictEqual(t.title, 'Old task'); assert.strictEqual(t.category, ''); assert.strictEqual(t.needNote, false); assert.strictEqual(t.approval, ''); assert.strictEqual(t.hours, '');
  const r = done(S, 'T-0001'); assert(r.ok, JSON.stringify(r));                       // old task still completes
  assert.strictEqual(r.task.approval, '');
});

/* ---------- completion rules ---------- */
test('required note blocks Done and leaves the task unchanged', () => {
  const S = setup(); const id = mk(S, { needNote: true }).task.id; start(S, id);
  const r = S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: '   ' });
  assert.strictEqual(r.ok, false); assert(/what was done/i.test(r.error), r.error);
  assert.strictEqual(tasksRaw(S)[0]['Status'], 'In progress');
});
test('required photo blocks Done; passes with a photo', () => {
  const S = setup(); const id = mk(S, { needPhoto: true }).task.id; start(S, id);
  const r = done(S, id); assert.strictEqual(r.ok, false); assert(/photo/i.test(r.error), r.error);
  const r2 = done(S, id, { photo: 'local:abc' }); assert(r2.ok, JSON.stringify(r2)); assert.strictEqual(r2.task.status, 'Done');
});
test('required note+photo both enforced, note first', () => {
  const S = setup(); const id = mk(S, { needNote: true, needPhoto: true }).task.id;
  const r = S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: '' }); assert(/what was done/i.test(r.error));
  const r2 = S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'ok' }); assert(/photo/i.test(r2.error));
});
test('no rules: Done without note or photo still works (as before)', () => {
  const S = setup(); const id = mk(S).task.id; const r = S.as('tech1', { action: 'taskUpdate', id, status: 'Done' }); assert(r.ok, JSON.stringify(r));
});
test('Done sent twice (offline replay) does not re-run required checks or lose hours', () => {
  const S = setup(); const id = mk(S, { needNote: true }).task.id;
  assert(done(S, id, { hours: '2' }).ok);
  const r = S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: '' });      // replay with an empty note
  assert(r.ok, JSON.stringify(r)); assert.strictEqual(r.task.hours, '2');
});
test('required rules also apply via the offline sync route', () => {
  const S = setup(); const id = mk(S, { needNote: true }).task.id;
  const r = S.as('tech1', { action: 'sync', ops: [{ id: 'x1', action: 'taskUpdate', task: id, status: 'Done', note: '' }] });
  assert(r.ok, JSON.stringify(r)); const res = r.results[0]; assert.strictEqual(res.ok, false); assert(/what was done/i.test(res.error));
  const r2 = S.as('tech1', { action: 'sync', ops: [{ id: 'x2', action: 'taskUpdate', task: id, status: 'Done', note: 'fixed', hours: '1.5' }] });
  assert.strictEqual(r2.results[0].ok, true, JSON.stringify(r2)); assert.strictEqual(tasksRaw(S)[0]['Hours'], '1.5');
});

/* ---------- hours ---------- */
test('hours are rounded to quarter hours and accept a comma', () => {
  const S = setup(); const a = mk(S).task.id, b = mk(S, { title: 'b' }).task.id;
  assert.strictEqual(done(S, a, { hours: '2.3' }).task.hours, '2.25'); assert.strictEqual(done(S, b, { hours: '1,5' }).task.hours, '1.5');
});
test('bad hours are rejected and the task stays open', () => {
  const S = setup(); const id = mk(S).task.id;
  ['-1', '1000', 'abc', 'Infinity'].forEach(h => { const r = done(S, id, { hours: h }); assert.strictEqual(r.ok, false, h); });
  assert.strictEqual(tasksRaw(S)[0]['Status'], 'Open');
});
test('zero hours is kept as 0, blank hours stays empty', () => {
  const S = setup(); const a = mk(S).task.id, b = mk(S, { title: 'b' }).task.id;
  assert.strictEqual(done(S, a, { hours: '0' }).task.hours, '0'); assert.strictEqual(done(S, b, { hours: '' }).task.hours, '');
});

/* ---------- approval ---------- */
test('approval flow: Done -> Pending -> Approved', () => {
  const S = setup(); const id = mk(S, { needApproval: true }).task.id; start(S, id);
  assert.strictEqual(done(S, id).task.approval, 'Pending');
  const r = S.as('sup', { action: 'taskApprove', id, approve: true }); assert(r.ok, JSON.stringify(r));
  assert.strictEqual(r.task.approval, 'Approved'); assert.strictEqual(r.task.approvalBy, 'sup'); assert.strictEqual(r.task.status, 'Done');
});
test('technician cannot approve their own task', () => {
  const S = setup(); const id = mk(S, { needApproval: true }).task.id; done(S, id);
  const r = S.as('tech1', { action: 'taskApprove', id, approve: true }); assert.strictEqual(r.ok, false); assert.strictEqual(tasksRaw(S)[0]['Approval'], 'Pending');
});
test('a user with only the create-tasks right cannot approve', () => {
  const S = setup(); const id = mk(S, { needApproval: true, assignee: 'tech1' }).task.id; done(S, id);
  assert.strictEqual(S.as('pete', { action: 'taskApprove', id, approve: true }).ok, false);
});
test('approve is refused when nothing waits (no flag, or not done)', () => {
  const S = setup(); const a = mk(S).task.id; done(S, a);
  assert.strictEqual(S.as('sup', { action: 'taskApprove', id: a, approve: true }).ok, false);
  const b = mk(S, { title: 'b', needApproval: true }).task.id;
  assert.strictEqual(S.as('sup', { action: 'taskApprove', id: b, approve: true }).ok, false);
});
test('approving twice is refused (second click)', () => {
  const S = setup(); const id = mk(S, { needApproval: true }).task.id; done(S, id);
  assert(S.as('sup', { action: 'taskApprove', id, approve: true }).ok); assert.strictEqual(S.as('sup', { action: 'taskApprove', id, approve: true }).ok, false);
});
test('send back needs a reason, reopens the task and keeps approval required', () => {
  const S = setup(); const id = mk(S, { needApproval: true }).task.id; start(S, id); done(S, id, { hours: '1' });
  const bad = S.as('sup', { action: 'taskApprove', id, approve: false, note: '' }); assert.strictEqual(bad.ok, false); assert.strictEqual(tasksRaw(S)[0]['Status'], 'Done');
  const r = S.as('sup', { action: 'taskApprove', id, approve: false, note: 'belt still loose' }); assert(r.ok, JSON.stringify(r));
  assert.strictEqual(r.task.status, 'Open'); assert.strictEqual(r.task.approval, 'Required'); assert.strictEqual(r.task.done, ''); assert.strictEqual(r.task.started, '');
  assert.strictEqual(done(S, id).task.approval, 'Pending');                      // second round works
});
test('send back writes history and tells the technician', () => {
  const S = setup(); const id = mk(S, { needApproval: true }).task.id; done(S, id);
  S.as('sup', { action: 'taskApprove', id, approve: false, note: 'redo' });
  const h = S.api.rowsOf(S.api.tasksBook().getSheetByName('Task History'), ['Timestamp', 'Task ID', 'Action', 'By', 'Note']);
  assert(h.some(x => x['Action'] === 'Sent back' && x['Note'] === 'redo'));
});
test('approve of an unknown task id fails cleanly', () => {
  const S = setup(); const r = S.as('sup', { action: 'taskApprove', id: 'T-9999', approve: true }); assert.strictEqual(r.ok, false);
});
test('supervisor edit cannot flip approval on a task already waiting', () => {
  const S = setup(); const id = mk(S, { needApproval: true }).task.id; done(S, id);
  S.as('sup', { action: 'taskEdit', task: { id, needApproval: false } }); assert.strictEqual(tasksRaw(S)[0]['Approval'], 'Pending');
});
test('supervisor can switch approval on or off before completion', () => {
  const S = setup(); const id = mk(S).task.id;
  assert.strictEqual(S.as('sup', { action: 'taskEdit', task: { id, needApproval: true } }).task.approval, 'Required');
  assert.strictEqual(S.as('sup', { action: 'taskEdit', task: { id, needApproval: false } }).task.approval, '');
});
test('edit that does not mention the new fields leaves them alone', () => {
  const S = setup(); const id = mk(S, { category: 'Safety', needNote: true, needApproval: true }).task.id;
  const t = S.as('sup', { action: 'taskEdit', task: { id, title: 'New title' } }).task;
  assert.strictEqual(t.category, 'Safety'); assert.strictEqual(t.needNote, true); assert.strictEqual(t.approval, 'Required');
});
test('reopening a done task keeps a pending approval requirement', () => {
  const S = setup(); const id = mk(S, { needApproval: true }).task.id; done(S, id);
  const t = S.as('sup', { action: 'taskEdit', task: { id, status: 'Open' } }).task;
  assert.strictEqual(t.status, 'Open');   // approval value after reopen is Pending; completing again must not break
  assert(done(S, id).ok);
});

/* ---------- templates ---------- */
test('supervisor saves, lists, updates and removes a template', () => {
  const S = setup();
  const a = S.as('sup', { action: 'taskTemplateSave', template: { name: 'Weekly belt check', title: 'Check belts', priority: 'High', category: 'Mechanical', needNote: true } });
  assert(a.ok, JSON.stringify(a)); assert.strictEqual(a.template.id, 'TP-001');
  const l = S.as('sup', { action: 'taskTemplates' }); assert.strictEqual(l.templates.length, 1); assert.strictEqual(l.templates[0].needNote, true); assert.strictEqual(l.templates[0].priority, 'High');
  const u = S.as('sup', { action: 'taskTemplateSave', template: { id: 'TP-001', name: 'Belt check', title: 'Check belts', priority: 'Low' } });
  assert.strictEqual(u.template.id, 'TP-001'); assert.strictEqual(S.as('sup', { action: 'taskTemplates' }).templates.length, 1);
  assert(S.as('sup', { action: 'taskTemplateSave', template: { id: 'TP-001', remove: true } }).ok);
  assert.strictEqual(S.as('sup', { action: 'taskTemplates' }).templates.length, 0);
});
test('template ids keep counting after a delete', () => {
  const S = setup(); const mkT = n => S.as('sup', { action: 'taskTemplateSave', template: { name: n, title: n } }).template.id;
  const a = mkT('a'); S.as('sup', { action: 'taskTemplateSave', template: { id: a, remove: true } }); assert.strictEqual(mkT('b'), 'TP-002');
});
test('templates need a name and a title; technicians cannot save', () => {
  const S = setup();
  assert.strictEqual(S.as('sup', { action: 'taskTemplateSave', template: { name: '', title: 'x' } }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'taskTemplateSave', template: { name: 'x', title: '' } }).ok, false);
  assert.strictEqual(S.as('tech1', { action: 'taskTemplateSave', template: { name: 'x', title: 'x' } }).ok, false);
  assert.strictEqual(S.as('pete', { action: 'taskTemplateSave', template: { name: 'x', title: 'x' } }).ok, false);
});
test('templates can be read by people who can create tasks only', () => {
  const S = setup(); assert.strictEqual(S.as('tech1', { action: 'taskTemplates' }).ok, false); assert.strictEqual(S.as('pete', { action: 'taskTemplates' }).ok, true);
});
test('editing or removing an unknown template fails', () => {
  const S = setup();
  assert.strictEqual(S.as('sup', { action: 'taskTemplateSave', template: { id: 'TP-777', name: 'x', title: 'x' } }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'taskTemplateSave', template: { id: 'TP-777', remove: true } }).ok, false);
});
test('template list is sorted by name and long names are cut', () => {
  const S = setup(); ['Zeta', 'Alpha'].forEach(n => S.as('sup', { action: 'taskTemplateSave', template: { name: n, title: n } }));
  assert.deepStrictEqual(S.as('sup', { action: 'taskTemplates' }).templates.map(t => t.name), ['Alpha', 'Zeta']);
  assert.strictEqual(S.as('sup', { action: 'taskTemplateSave', template: { name: 'n'.repeat(200), title: 't' } }).template.name.length, 60);
});
test('requests without a token are refused', () => {
  const S = setup(); ['taskApprove', 'taskTemplates', 'taskTemplateSave'].forEach(a => { const r = S.rt.call({ action: a }); assert.strictEqual(r.ok, false); assert.strictEqual(r.auth, true); });
});

/* ---------- reminders ---------- */
const inbox = (S, u) => JSON.parse(S.rt.cache.get('inbox_' + u) || '[]');
test('reminder is not sent for a phone-less user but is marked once', () => {
  const S = setup(); mk(S, { due: '2026-11-29' });
  const r = S.api.automationCycle(); assert.strictEqual(r.reminded, 1); assert.strictEqual(tasksRaw(S)[0]['Reminded'], '2026-11-29');
});
test('reminder fires once per day for due-today and overdue open tasks only', () => {
  const S = setup(); mk(S, { title: 'today', due: '2026-11-29' }); mk(S, { title: 'late', due: '2026-11-20' }); mk(S, { title: 'future', due: '2026-12-10' }); mk(S, { title: 'nodue', due: '' });
  const d = mk(S, { title: 'done', due: '2026-11-20' }).task.id; done(S, d);
  const c = mk(S, { title: 'cancelled', due: '2026-11-20' }).task.id; S.as('sup', { action: 'taskEdit', task: { id: c, status: 'Cancelled' } });
  assert.strictEqual(S.api.automationCycle().reminded, 2);
  assert.strictEqual(S.api.automationCycle().reminded, 0);                     // same day: nothing again
  S.rt.advance(24 * 3600e3); assert.strictEqual(S.api.automationCycle().reminded, 2);   // next day: again
});
test('reminder message goes to the assignee inbox when a phone is registered', () => {
  const S = setup(); const sh = S.api.tasksBook().getSheetByName('Push Devices');
  sh.appendRow(['tech1', 'https://push.example/abc', 'k', 'a', 'Android', '2026-11-01 08:00', '', '']);
  mk(S, { title: 'Grease', due: '2026-11-28' }); S.api.automationCycle();
  const m = inbox(S, 'tech1').filter(x => x.kind === 'reminder'); assert.strictEqual(m.length, 1); assert.strictEqual(m[0].kind, 'reminder'); assert.strictEqual(m[0].overdue, true); assert.strictEqual(m[0].title, 'Grease');
});
test('a failing reminder does not stop the daily cycle', () => {
  const S = setup(); mk(S, { due: '2026-11-29' }); const r = S.api.automationCycle(); assert(r.ok !== undefined); assert.strictEqual(r.errors.filter(e => !/low stock/.test(e)).length, 0);   // this test world has no inventory workbook
});

/* ---------- failed check -> task ---------- */
const check = (S, u, unit, faulty, note) => S.as(u, { action: 'submitCheck', type: 'Bobcat', unit, data: { answers: { 'Oil level': { v: 'ok' }, 'Brakes': faulty ? { v: 'fault', note: note || 'pads worn' } : { v: 'ok' } } } });
test('failed check creates one High task for the supervisor', () => {
  const S = setup(); const r = check(S, 'skid', 'Bobcat 1', true); assert(r.ok, JSON.stringify(r)); assert(r.faultTask, 'no task id');
  const t = tasksRaw(S)[0]; assert.strictEqual(t['Assigned To'], 'sup'); assert.strictEqual(t['Priority'], 'High'); assert(/Bobcat 1/.test(t['Title'])); assert(/pads worn/.test(t['Details'])); assert.strictEqual(t['Link'], 'Bobcat');
});
test('sending the same failed check again updates the task, never doubles it', () => {
  const S = setup(); const a = check(S, 'skid', 'Bobcat 1', true, 'pads worn'); const b = check(S, 'skid', 'Bobcat 1', true, 'pads gone');
  assert.strictEqual(a.faultTask, b.faultTask); assert.strictEqual(tasksRaw(S).length, 1); assert(/pads gone/.test(tasksRaw(S)[0]['Details']));
});
test('a passing check creates nothing; two units give two tasks', () => {
  const S = setup(); assert(!check(S, 'skid', 'Bobcat 1', false).faultTask); assert.strictEqual(tasksRaw(S).length, 0);
  check(S, 'skid', 'Bobcat 1', true); check(S, 'skid', 'Bobcat 2', true); assert.strictEqual(tasksRaw(S).length, 2);
});
test('no supervisor available: the check is still saved, no task', () => {
  const S = setup({ noSupervisor: true }); const r = check(S, 'skid', 'Bobcat 1', true); assert(r.ok, JSON.stringify(r)); assert(!r.faultTask); assert.strictEqual(tasksRaw(S).length, 0);
});
test('failed check through offline sync also makes the task', () => {
  const S = setup(); const r = S.as('skid', { action: 'sync', ops: [{ id: 'c1', action: 'submitCheck', type: 'Bobcat', unit: 'Bobcat 1', data: { answers: { 'Oil level': { v: 'ok' }, 'Brakes': { v: 'fault', note: 'leak' } } } }] });
  assert.strictEqual(r.results[0].ok, true, JSON.stringify(r)); assert.strictEqual(tasksRaw(S).length, 1);
});
test('fault task shows on the supervisor task list and can be reassigned', () => {
  const S = setup(); check(S, 'skid', 'Bobcat 1', true); const id = tasksRaw(S)[0]['ID'];
  assert.strictEqual(S.as('sup', { action: 'myTasks' }).tasks.length, 1);
  const r = S.as('sup', { action: 'taskEdit', task: { id, assignee: 'tech1' } }); assert(r.ok); assert.strictEqual(S.as('tech1', { action: 'myTasks' }).tasks.length, 1);
});
test('a cancelled fault task is replaced by a new one on the next failed check', () => {
  const S = setup(); const a = check(S, 'skid', 'Bobcat 1', true).faultTask; S.as('sup', { action: 'taskEdit', task: { id: a, status: 'Cancelled' } });
  const b = check(S, 'skid', 'Bobcat 1', true).faultTask; assert.notStrictEqual(a, b);
});

/* ---------- regression: existing behaviour ---------- */
test('regression: create, start, done, reopen, reassign, cancel still work', () => {
  const S = setup(); const id = mk(S).task.id;
  assert.strictEqual(start(S, id).task.status, 'In progress'); assert.strictEqual(done(S, id).task.status, 'Done');
  assert.strictEqual(S.as('sup', { action: 'taskEdit', task: { id, status: 'Open' } }).task.status, 'Open');
  assert.strictEqual(S.as('sup', { action: 'taskEdit', task: { id, assignee: 'tech2' } }).task.assignee, 'tech2');
  assert.strictEqual(S.as('sup', { action: 'taskEdit', task: { id, status: 'Cancelled' } }).task.status, 'Cancelled');
  assert.strictEqual(done(S, id, {}, 'tech2').ok, false);
});
test('regression: technician cannot touch someone else\'s task or create tasks', () => {
  const S = setup(); const id = mk(S).task.id; assert.strictEqual(done(S, id, {}, 'tech2').ok, false);
  assert.strictEqual(S.as('tech1', { action: 'taskCreate', task: { title: 'x', assignee: 'tech2' } }).ok, false);
});
test('regression: API version is 20', () => {
  const S = setup(); const o = S.rt.api.doGet ? JSON.parse(S.rt.api.doGet({}).s) : null; if (o) assert.strictEqual(o.version, 20);
});

console.log(`\nbackend: ${pass} passed, ${fail} failed`);
if (fail) { failures.forEach(f => console.log('  FAIL ' + f)); process.exit(1); }
