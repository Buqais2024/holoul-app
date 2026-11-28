const { makeRuntime } = require('./gas_mock');
function buildWorld(codePath) {
  const rt = makeRuntime(codePath);
  const SHEET_ID = '1ohP2VDJitA_ZxiY3Sk6V22Z6yGHZjvgsBg58pMwac_4';
  const us = rt.addBook(SHEET_ID, 'Users').sheets[0]; us.setName('Users');
  [['User ID', 'Full Name', 'Username', 'PIN', 'Active', 'Role', 'Assigned Equipment', 'Create tasks', 'Edit equipment', 'Edit spare parts'],
   ['1', 'Sam Super', 'sup', '1111', 'Yes', 'Supervisor', '', '', '', ''],
   ['2', 'Tom Tech', 'tech1', '2222', 'Yes', 'Mech-Technician', '', 'No', 'No', 'No'],
   ['3', 'Eli Elec', 'tech2', '2223', 'Yes', 'Elec-Technician', '', 'No', 'No', 'No'],
   ['4', 'Sid Skid', 'skid', '3333', 'Yes', 'Skid loader Operator', 'Bobcat', 'No', 'No', 'No']].forEach(r => us.appendRow(r));
  const rd = rt.addBook('1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ', 'Readings'); const amp = rd.sheets[0]; amp.setName('Amp Rec');
  [['#', 'Cable', 'Motor A', 'Ref', ''], ['', '', '', '', ''], ['1', 'C-1', 'Shredder motor', '40', ''], ['2', 'C-2', 'Fan motor', '10', '']].forEach((r, i) => r.forEach((v, j) => amp.put(i + 1, j + 1, v)));
  const es = rt.addBook('1sI07XLIaK3yQ2f199dVGX0IvQuRdzMG7L6WYOnXC9k8', 'Equipment').sheets[0];
  [['Equipment Name', 'Equipment Number', 'Line', 'Location', 'Category', 'Record Status', 'Automation task'], ['Shredder', 'SH-1', 'L1', 'Hall A', 'Shredder', '', ''], ['Conveyor', 'BC-16', 'L1', 'Hall A', 'Conveyor', '', '']].forEach((r, i) => r.forEach((v, j) => es.put(i + 1, j + 1, v)));
  const cb = rt.addBook('checks1', 'Checks'); rt.props.CHECKS_SS_ID = 'checks1';
  const cl = cb.sheets[0]; cl.setName('Bobcat Checklist');
  [['Section', 'Item', 'Input', 'Frequency', 'Photo', 'Active'], ['Engine', 'Oil level', 'check', 'daily', 'no', 'Yes'], ['Engine', 'Brakes', 'check', 'daily', 'no', 'Yes']].forEach(r => cl.appendRow(r));
  const un = cb.insertSheet('Units'); [['Type', 'Unit', 'Active'], ['Bobcat', 'Bobcat 1', 'Yes']].forEach(r => un.appendRow(r));
  const sp = rt.addBook('1XtqChR5bn9b0MwW4N3Q85oF8WAxLhIJYJkPhdn5vNzw', 'Maintainance Inventory');
  const el = sp.sheets[0]; el.id = 816261843; el.setName('Inventory Elct-Spare parts');
  [['#', 'Part/Item No.', 'Brand', 'Description', '# Quantity'], ['1', 'E-100', 'ABB', 'Contactor 24V', '5']].forEach(r => el.appendRow(r));
  const me = sp.insertSheet('Mechanical'); me.id = 1717920569;
  [['Part No.', 'Part Name', 'Required Qty', 'Available Qty', 'Used Qty', 'Remaining Qty', 'Status', 'Machine'], ['M-7', 'Shredder blade', '10', '8', '2', '6', 'OK', 'Shredder']].forEach(r => me.appendRow(r));
  return rt;
}
module.exports = { buildWorld };
