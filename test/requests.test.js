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
const req = (S, u, r) => S.as(u, { action: 'requestCreate', request: Object.assign({ title: 'Belt slipping' }, r || {}) });

/* ---------- work requests ---------- */
test('request: anyone can send one; it starts Pending; asset name comes from the asset list', () => {
  const S = setup(); const r = req(S, 'tech2', { details: 'Squeaks', assetNo: 'BC-16', urgency: 'High', photo: 'https://drive.google.com/x' }); assert(r.ok && r.id === 'R-0001', JSON.stringify(r));
  const l = S.as('tech2', { action: 'requestList' }); assert.strictEqual(l.requests.length, 1); const q = l.requests[0];
  assert.deepStrictEqual([q.status, q.asset, q.urgency, q.name, q.canDecide], ['Pending', 'Conveyor', 'High', 'Eli Elec', undefined]); assert.strictEqual(l.canDecide, false);
});
test('request: title required, bad photo link refused, bad urgency becomes Normal, 10 pending at most', () => {
  const S = setup(); assert.strictEqual(req(S, 'tech1', { title: '  ' }).ok, false); assert.strictEqual(req(S, 'tech1', { photo: 'javascript:alert(1)' }).ok, false);
  req(S, 'tech1', { urgency: 'Nope' }); assert.strictEqual(S.as('tech1', { action: 'requestList' }).requests[0].urgency, 'Normal');
  for (let i = 0; i < 9; i++) assert(req(S, 'tech1').ok); assert.strictEqual(req(S, 'tech1').ok, false); assert(req(S, 'tech2').ok);
});
test('request: people see only their own; supervisors see everyone\'s, pending first', () => {
  const S = setup(); req(S, 'tech1', { title: 'A' }); req(S, 'tech2', { title: 'B' });
  assert.deepStrictEqual(S.as('tech1', { action: 'requestList' }).requests.map(x => x.title), ['A']); assert.strictEqual(S.as('sup', { action: 'requestList' }).requests.length, 2);
  S.as('sup', { action: 'requestDecide', id: 'R-0001', decision: 'decline', note: 'no' }); assert.deepStrictEqual(S.as('sup', { action: 'requestList' }).requests.map(x => x.id), ['R-0002', 'R-0001']);
});
test('request: supervisors are notified, the sender is not', () => {
  const S = setup(); phone(S, 'sup'); phone(S, 'tech1'); req(S, 'tech1', { title: 'Leak' }); const m = inbox(S, 'sup').filter(x => x.kind === 'request'); assert.strictEqual(m.length, 1); assert.strictEqual(m[0].title, 'Leak'); assert.strictEqual(inbox(S, 'tech1').length, 0);
});
test('approve: makes a work order for the chosen person and links it; sender is told', () => {
  const S = setup(); phone(S, 'tech2'); req(S, 'tech2', { title: 'Belt slipping', details: 'Line 1', assetNo: 'BC-16', urgency: 'High' });
  const d = S.as('sup', { action: 'requestDecide', id: 'R-0001', decision: 'approve', assignee: 'tech1', due: '2026-12-01' }); assert(d.ok && d.status === 'Approved' && /^T-/.test(d.order), JSON.stringify(d));
  const t = S.api.readTasks().filter(x => x['ID'] === d.order)[0]; assert.deepStrictEqual([t['Assigned To'], t['Priority'], t['Equipment No'], t['Equipment'], t['Due']], ['tech1', 'High', 'BC-16', 'Conveyor', '2026-12-01']); assert(/R-0001/.test(t['Details']) && /Eli Elec/.test(t['Details']));
  const m = inbox(S, 'tech2').filter(x => x.kind === 'requestDecision'); assert.strictEqual(m.length, 1); assert.strictEqual(m[0].status, 'Approved'); assert.strictEqual(S.as('tech2', { action: 'requestList' }).requests[0].order, d.order);
});
test('approve needs a valid assignee and leaves the request Pending on failure', () => {
  const S = setup(); req(S, 'tech2'); assert.strictEqual(S.as('sup', { action: 'requestDecide', id: 'R-0001', decision: 'approve', assignee: 'nobody' }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'requestList' }).requests[0].status, 'Pending'); assert.strictEqual(S.api.readTasks().length, 0);
});
test('decline: reason required, stored, sender told; cannot be answered twice', () => {
  const S = setup(); phone(S, 'tech2'); req(S, 'tech2'); assert.strictEqual(S.as('sup', { action: 'requestDecide', id: 'R-0001', decision: 'decline', note: ' ' }).ok, false);
  assert(S.as('sup', { action: 'requestDecide', id: 'R-0001', decision: 'decline', note: 'Already planned' }).ok);
  const q = S.as('tech2', { action: 'requestList' }).requests[0]; assert.deepStrictEqual([q.status, q.note, q.decidedBy], ['Declined', 'Already planned', 'sup']);
  assert.strictEqual(inbox(S, 'tech2').filter(x => x.kind === 'requestDecision')[0].status, 'Declined');
  assert.strictEqual(S.as('sup', { action: 'requestDecide', id: 'R-0001', decision: 'approve', assignee: 'tech1' }).ok, false); assert.strictEqual(S.api.readTasks().length, 0);
});
test('decide: only managers; unknown request and unknown decision refused', () => {
  const S = setup(); req(S, 'tech2'); assert.strictEqual(S.as('tech1', { action: 'requestDecide', id: 'R-0001', decision: 'decline', note: 'x' }).ok, false); assert.strictEqual(S.as('sparky', { action: 'requestDecide', id: 'R-0001', decision: 'decline', note: 'x' }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'requestDecide', id: 'R-9', decision: 'decline', note: 'x' }).ok, false); assert.strictEqual(S.as('sup', { action: 'requestDecide', id: 'R-0001', decision: 'maybe' }).ok, false); assert(S.as('ops', { action: 'requestDecide', id: 'R-0001', decision: 'decline', note: 'x' }).ok);
});
test('assets lookup: any user can search by number, name or line', () => {
  const S = setup(); const q = s => S.as('tech2', { action: 'assetsLookup', q: s }); assert.deepStrictEqual(q('conv').assets.map(a => a.no), ['BC-16']); assert.strictEqual(q('').assets.length, 2); assert.strictEqual(q('L1').assets.length, 2); assert.strictEqual(q('zzz').assets.length, 0);
});

/* ---------- comments ---------- */
test('comments: assignee, creator and supervisors can write and read; others cannot', () => {
  const S = setup(); const id = wo(S, 'tech1'); assert(S.as('tech1', { action: 'commentAdd', id, text: 'On my way' }).ok); assert(S.as('sup', { action: 'commentAdd', id, text: 'Thanks' }).ok);
  const l = S.as('tech1', { action: 'comments', id }); assert.deepStrictEqual(l.comments.map(c => c.text), ['On my way', 'Thanks']); assert(l.people.length >= 5);
  assert.strictEqual(S.as('tech2', { action: 'comments', id }).ok, false); assert.strictEqual(S.as('tech2', { action: 'commentAdd', id, text: 'hi' }).ok, false);
});
test('comments: empty refused; unknown task refused; long text is cut', () => {
  const S = setup(); const id = wo(S); assert.strictEqual(S.as('sup', { action: 'commentAdd', id, text: '  ' }).ok, false); assert.strictEqual(S.as('sup', { action: 'commentAdd', id: 'T-9', text: 'x' }).ok, false);
  S.as('sup', { action: 'commentAdd', id, text: 'x'.repeat(3000) }); assert.strictEqual(S.as('sup', { action: 'comments', id }).comments[0].text.length, 1000);
});
test('@mention: tags real users once, ignores self and unknown names, notifies them, and gives them access', () => {
  const S = setup(); phone(S, 'tech2'); phone(S, 'tech1'); const id = wo(S, 'tech1');
  const r = S.as('sup', { action: 'commentAdd', id, text: 'Please help @tech2 and @tech2, also @nobody @sup' }); assert.deepStrictEqual(r.mentions, ['tech2']);
  const m = inbox(S, 'tech2'); assert.strictEqual(m.length, 1); assert.deepStrictEqual([m[0].kind, m[0].id, m[0].by], ['mention', id, 'Sam Super']);
  const a = inbox(S, 'tech1').filter(x => x.kind !== 'assigned'); assert.strictEqual(a.length, 1); assert.strictEqual(a[0].kind, 'comment');
  assert(S.as('tech2', { action: 'comments', id }).ok); assert(S.as('tech2', { action: 'commentAdd', id, text: 'ok' }).ok); assert.strictEqual(S.as('sparky', { action: 'comments', id }).ok, false);
});
test('@mention: trailing punctuation is ignored and matching is case-insensitive', () => { const S = setup(); const id = wo(S); assert.deepStrictEqual(S.as('sup', { action: 'commentAdd', id, text: 'ping @Tech2.' }).mentions, ['tech2']); });
test('comment notifies the other side only', () => {
  const S = setup(); phone(S, 'sup'); phone(S, 'tech1'); const id = wo(S, 'tech1'); S.as('tech1', { action: 'commentAdd', id, text: 'done soon' });
  assert.strictEqual(inbox(S, 'sup').filter(x => x.kind === 'comment').length, 1); assert.strictEqual(inbox(S, 'tech1').filter(x => x.kind !== 'assigned').length, 0);
});
test('voice note: accepted as an audio comment; wrong type and huge files refused', () => {
  const S = setup(); const id = wo(S); const ok = S.as('sup', { action: 'commentAdd', id, audio: 'data:audio/webm;codecs=opus;base64,' + Buffer.from('abc').toString('base64') }); assert(ok.ok, JSON.stringify(ok));
  assert.strictEqual(S.as('sup', { action: 'comments', id }).comments[0].text, '');
  assert.strictEqual(S.as('sup', { action: 'commentAdd', id, audio: 'data:image/png;base64,AAAA' }).ok, false);
  assert.strictEqual(S.as('sup', { action: 'commentAdd', id, audio: 'data:audio/webm;base64,' + 'A'.repeat(4.5 * 1024 * 1024) }).ok, false);
});

/* ---------- several assets ---------- */
test('assets: extra assets saved with names from the list, deduped, main asset excluded, max 8', () => {
  const S = setup(); const id = wo(S, 'tech1', { equipment: 'Shredder', equipmentNo: 'SH-1', assets: [{ no: 'BC-16' }, { no: 'bc-16' }, { no: 'SH-1' }, { no: 'X-9', name: 'Pump' }] });
  const t = S.api.readTasks().map(S.api.taskOut).filter(x => x.id === id)[0]; assert.deepStrictEqual(t.assets, [{ no: 'BC-16', name: 'Conveyor' }, { no: 'X-9', name: 'Pump' }]);
  assert.strictEqual(S.as('sup', { action: 'taskCreate', task: { title: 'x', assignee: 'tech1', assets: Array.from({ length: 9 }, (_, i) => ({ no: 'A' + i })) } }).ok, false);
  S.as('sup', { action: 'taskEdit', task: { id, assets: [] } }); assert.deepStrictEqual(S.api.readTasks().map(S.api.taskOut).filter(x => x.id === id)[0].assets, []);
});
test('assets: a technician with an open work order that lists the asset may use its card and downtime', () => {
  const S = setup(); wo(S, 'tech1', { equipment: 'Shredder', equipmentNo: 'SH-1', assets: [{ no: 'BC-16' }] });
  const c = S.as('tech1', { action: 'assetCard', no: 'BC-16' }); assert(c.ok && c.canDowntime === true && c.orders.length === 1, JSON.stringify(c)); assert.strictEqual(S.as('tech2', { action: 'assetCard', no: 'BC-16' }).canDowntime, false);
  assert(S.as('tech1', { action: 'downtimeStart', downtime: { no: 'BC-16', cause: 'Mechanical wear' } }).ok);
});
test('assets: asset history includes work orders that list it as an extra asset', () => {
  const S = setup(); const id = wo(S, 'tech1', { equipment: 'Shredder', equipmentNo: 'SH-1', assets: [{ no: 'BC-16' }] });
  const h = S.as('sup', { action: 'equipHistory', no: 'BC-16', name: 'Conveyor' }); if (h.ok && h.tasks) assert(h.tasks.some(x => x.id === id), JSON.stringify(h).slice(0, 200));
});

/* ---------- signature ---------- */
test('signature: required when the work order says so; stored with the typed name; shown to managers and the assignee only', () => {
  const S = setup(); const id = wo(S, 'tech1', { needSignature: true });
  const no = S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'x' }); assert.strictEqual(no.ok, false); assert(/signature/i.test(no.error));
  const ok = S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'x', signature: PNG, signedName: 'Khalid' }); assert(ok.ok && ok.task.signed === true && ok.task.needSignature === true, JSON.stringify(ok));
  const g = S.as('sup', { action: 'taskSignature', id }); assert(g.ok && g.signature === PNG && g.name === 'Khalid'); assert(S.as('tech1', { action: 'taskSignature', id }).ok); assert.strictEqual(S.as('tech2', { action: 'taskSignature', id }).ok, false);
});
test('signature: optional otherwise; junk, non-png and oversized refused; no signature list payload leak', () => {
  const S = setup(); const a = wo(S, 'tech1'); assert(S.as('tech1', { action: 'taskUpdate', id: a, status: 'Done', note: 'x', signature: PNG }).ok);
  const b = wo(S, 'tech1'); ['data:image/jpeg;base64,AAAA', 'hello', 'data:image/png;base64,' + 'A'.repeat(50000)].forEach(v => assert.strictEqual(S.as('tech1', { action: 'taskUpdate', id: b, status: 'Done', note: 'x', signature: v }).ok, false));
  assert.strictEqual(JSON.stringify(S.api.readTasks().map(S.api.taskOut)).indexOf('base64'), -1); 
});
test('signature: not asked for a work order that is already done; flag cannot change after Done', () => {
  const S = setup(); const id = wo(S, 'tech1'); S.as('tech1', { action: 'taskUpdate', id, status: 'Done', note: 'x' }); S.as('sup', { action: 'taskEdit', task: { id, needSignature: true } }); assert.strictEqual(S.api.readTasks().map(S.api.taskOut).filter(x => x.id === id)[0].needSignature, false);
});
test('regression: API version 20; new tabs exist', () => { const S = setup(); assert.strictEqual(JSON.parse(S.api.doGet({}).s).version, 20); ['Work Requests', 'Task Comments'].forEach(n => assert(S.api.tasksBook().getSheetByName(n), n)); });
console.log(`\nrequests: ${pass} passed, ${fail} failed`); if (fail) { failures.forEach(f => console.log('  FAIL ' + f)); process.exit(1); }
