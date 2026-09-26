/**
 * Holoul Maintenance App — backend (Google Apps Script)
 * Standalone script linked to the "Holoul App - Users" spreadsheet by ID.
 *
 * 1. Run setupSheet() once  -> formats the Users tab, adds dropdowns,
 *    auto access columns and an Access Matrix tab.
 * 2. Deploy > New deployment > Web app
 *      Execute as: Me   |   Who has access: Anyone
 *    Copy the Web app URL into API_URL in index.html.
 */

const SHEET_ID = '1ohP2VDJitA_ZxiY3Sk6V22Z6yGHZjvgsBg58pMwac_4';
const USERS_SHEET = 'Users';
const book = () => SpreadsheetApp.openById(SHEET_ID);

// Which record pages each role can open. Change here to change the whole app.
const MODULES = ['Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Forklift', 'Bobcat'];

function accessFor(role, equipment) {
  if (role === 'Maintenance Technician') return ['Amp Rec', 'Vibration Rec', 'Thermo Rec'];
  if (role === 'Operator' && (equipment === 'Forklift' || equipment === 'Bobcat')) return [equipment];
  return [];
}

/* ---------------- API ---------------- */

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) {}
  let out;
  if (body.action === 'login') out = login(body.username, body.pin);
  else out = { ok: false, error: 'Unknown action' };
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'Holoul Maintenance API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function login(username, pin) {
  username = String(username || '').trim().toLowerCase();
  pin = String(pin || '').trim();
  if (!username || !pin) return { ok: false, error: 'Enter username and PIN' };

  const rows = book().getSheetByName(USERS_SHEET).getDataRange().getDisplayValues();
  const h = rows[0];
  const c = name => h.indexOf(name);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[c('Username')]).trim().toLowerCase() !== username) continue;
    if (String(r[c('PIN')]).trim() !== pin) break;
    if (r[c('Active')] !== 'Yes') return { ok: false, error: 'Account is inactive — contact your supervisor' };
    const role = r[c('Role')], equipment = r[c('Assigned Equipment')];
    return {
      ok: true,
      user: {
        id: r[c('User ID')],
        name: r[c('Full Name')],
        role: role,
        equipment: equipment,
        access: accessFor(role, equipment)
      }
    };
  }
  Utilities.sleep(800); // slow down PIN guessing
  return { ok: false, error: 'Wrong username or PIN' };
}

/* ---------------- One-time sheet setup ---------------- */

function setupSheet() {
  const ss = book();
  let sh = ss.getSheetByName(USERS_SHEET) || ss.getSheets()[0];
  sh.setName(USERS_SHEET);

  const last = 500;
  // Header style
  sh.getRange('A1:L1').setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2937')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.getRange('H1:L1').setBackground('#374151');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  sh.getRange('F2:F' + last).setNumberFormat('@'); // PIN kept as text (keeps leading zeros)

  // Dropdowns
  const list = v => SpreadsheetApp.newDataValidation().requireValueInList(v, true).setAllowInvalid(false).build();
  sh.getRange('C2:C' + last).setDataValidation(list(['Maintenance Technician', 'Operator']));
  sh.getRange('D2:D' + last).setDataValidation(list(['Forklift', 'Bobcat']));
  sh.getRange('G2:G' + last).setDataValidation(list(['Yes', 'No']));

  // Access columns (auto — do not type in them)
  sh.getRange('H2:L' + last).clearContent();
  const tech = '(G2:G="Yes")*(C2:C="Maintenance Technician")';
  const op = eq => '(G2:G="Yes")*(C2:C="Operator")*(D2:D="' + eq + '")';
  const f = cond => '=ARRAYFORMULA(IF(B2:B="","",IF(' + cond + ',"Yes","No")))';
  sh.getRange('H2').setFormula(f(tech));
  sh.getRange('I2').setFormula(f(tech));
  sh.getRange('J2').setFormula(f(tech));
  sh.getRange('K2').setFormula(f(op('Forklift')));
  sh.getRange('L2').setFormula(f(op('Bobcat')));

  // Green = has access
  const acc = sh.getRange('H2:L' + last);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Yes')
      .setBackground('#d1fae5').setFontColor('#065f46').setBold(true).setRanges([acc]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('No')
      .setBackground('#f3f4f6').setFontColor('#9ca3af').setRanges([acc]).build()
  ]);
  sh.getRange('A1:L' + last).setFontFamily('Arial');
  [70, 180, 170, 140, 110, 60, 60, 80, 95, 85, 80, 80].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('A2:A' + last).setHorizontalAlignment('center');
  sh.getRange('C2:L' + last).setHorizontalAlignment('center');

  // Access Matrix tab (reference for supervisors)
  let am = ss.getSheetByName('Access Matrix') || ss.insertSheet('Access Matrix');
  am.clear();
  am.getRange(1, 1, 4, 7).setValues([
    ['Role', 'Assigned Equipment', 'Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Forklift', 'Bobcat'],
    ['Maintenance Technician', '(leave blank)', 'Yes', 'Yes', 'Yes', 'No', 'No'],
    ['Operator', 'Forklift', 'No', 'No', 'No', 'Yes', 'No'],
    ['Operator', 'Bobcat', 'No', 'No', 'No', 'No', 'Yes']
  ]);
  am.getRange('A1:G1').setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2937');
  am.getRange('A1:G4').setFontFamily('Arial').setHorizontalAlignment('center');
  am.setColumnWidth(1, 180); am.setColumnWidth(2, 150);
  am.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Yes')
      .setBackground('#d1fae5').setFontColor('#065f46').setBold(true).setRanges([am.getRange('C2:G4')]).build()
  ]);

  Logger.log('Users sheet is ready.');
}
