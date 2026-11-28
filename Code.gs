/**
 * Holoul Maintenance App — backend (Google Apps Script)
 * Standalone script. Reads users from "Holoul App - Users" and writes
 * readings into the "Instrument Reading" spreadsheet.
 *
 * After changing this code: Deploy > Manage deployments > (pencil) >
 * Version: New version > Deploy.  (Keeps the same Web app URL.)
 *
 * v6 (Nov 2026) — offline-first support:
 *  - "sync": many queued changes from a phone in one request
 *  - "getAll": every page a user can open, in one request (phone keeps a copy)
 *  - readings / checks carry the date they were taken, so data that uploads
 *    late still lands in the right day's column
 *  - safe to resend: Task Log and daily checks update their row, photos are not duplicated
 *  - sign-in lasts 7 days (signed token); inactive users are still blocked within minutes
 *  - every older call from the previous app version still works
 *
 * v7 (Nov 2026) — tasks + notifications + dashboard:
 *  - roles Supervisor / Operations Manager: dashboard, assign tasks to technicians
 *  - technicians Start / Done tasks (note + photo), also offline through "sync"
 *  - phone notifications (Web Push) when a task is assigned / done
 *  - run setupV7() once after updating (creates the Tasks sheet, asks for permission to send notifications)
 *
 * v8 (Nov 2026) — equipment list:
 *  - reads "Equipments and system in Holoul factory" (first tab) so supervisors pick the exact
 *    equipment when assigning a task; edit that sheet and the app follows (within 10 minutes)
 *  - tasks keep Equipment No, Line and Location
 *
 * v9 (Nov 2026) - dashboard: spare parts (electrical + mechanical) and equipment maintenance history
 *
 * v10 (Nov 2026) - employees and permissions from the app; add / edit / delete equipment and spare parts
 *   with photos; Users sheet columns M-O (Create tasks, Edit equipment, Edit spare parts)
 *
 * v11 (Nov 2026) - automatic reading tasks:
 *  - equipment sheet column "Automation task": the supervisor sets a reading (Amp / Vibration / Thermo),
 *    a period (weekly ... yearly) or running hours, and the technicians who do it
 *  - run installAutomationTrigger() once from the editor: a daily check at 06:00 creates the tasks
 *  - progress is kept in the "Automation Log" tab of the Maintenance Tasks sheet
 * v12 (Nov 2026) - repeating tasks (any task, supervisor only):
 *  - the new-task form can repeat the task every period or every N running hours, for one or more people
 *  - the first task is made when saved; later ones by the same daily run (automationCycle)
 *  - repeats are kept in the "Task Automation" tab; stop / resume without deleting tasks
 */

const SHEET_ID     = '1ohP2VDJitA_ZxiY3Sk6V22Z6yGHZjvgsBg58pMwac_4';   // Holoul App - Users
const READINGS_ID  = '1G4j3H4b95Ou12arlp9u9H9Qa_0iaeevcqu1yYINIORQ';   // Instrument Reading
const USERS_SHEET  = 'Users';
const LOG_SHEET    = 'Task Log';
const TZ           = 'Asia/Riyadh';
const SESSION_SECS = 6 * 60 * 60;   // old-style sessions (CacheService) from earlier app versions
const SESSION_DAYS = 7;             // new sign-ins
const MAX_BACK_DAYS = 7;            // oldest date a late upload may write to
const USERS_CACHE_SECS = 300;       // a deactivated user is blocked within 5 minutes
const EQUIPMENT_ID = '1sI07XLIaK3yQ2f199dVGX0IvQuRdzMG7L6WYOnXC9k8';   // Equipments and system in Holoul factory (Script Property EQUIPMENT_SS_ID overrides)
const EQUIPMENT_CACHE_SECS = 600;

let _book = null, _readings = null;
const book     = () => _book || (_book = SpreadsheetApp.openById(SHEET_ID));
const readings = () => _readings || (_readings = SpreadsheetApp.openById(READINGS_ID));

// Record pages and their layout in "Instrument Reading".
// Row 1 = date, row 2 = username, readings from DATA_ROW down, one column per day.
const RECORD_SHEETS = {
  // A #, B Cable ID, C Description, D Ref value, readings from E
  'Amp Rec':       { layout: 'list',      idCol: 2, descCol: 3, refCol: 4, firstDayCol: 5, dataRow: 3 },
  // A Machine, B Motor/Bearing, C F/B/L/R, D Horizontal/Vertical/Axial, readings from E
  // (row 2 "Checked by" was inserted by setupVibration so row 2 holds the username)
  'Vibration Rec': { layout: 'vibration', firstDayCol: 5, dataRow: 3, keyCols: 4 },
  // A Category, B Subcategory, C Component (Motor, Gearbox, ...). Row 1 date, row 2 checked by, readings from D3.
  // Generic: any rows added/renamed later in A–C show up automatically.
  'Thermo Rec':    { layout: 'grouped',   firstDayCol: 4, dataRow: 3, keyCols: 3 }
};

const MODULES = ['Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Forklift', 'Bobcat'];
const CHECK_TYPES = ['Forklift', 'Bobcat'];

/* Role names exactly as the Users sheet Role dropdown holds them. An operator's equipment
   comes from the role itself; the Assigned Equipment column is written to match. */
const TECH_ROLES = ['Mech-Technician', 'Elec-Technician'];
const ROLE_EQUIPMENT = { 'Forklift Operator': 'Forklift', 'Skid loader Operator': 'Bobcat' };
const MANAGER_ROLE_NAMES = ['Supervisor', 'Operations Manager'];
const roleEquipment = role => (Object.prototype.hasOwnProperty.call(ROLE_EQUIPMENT, role) ? ROLE_EQUIPMENT[role] : '');

function accessFor(role) {
  if (MANAGER_ROLE_NAMES.indexOf(role) >= 0) return ['Dashboard', 'Tasks', 'PM', 'Amp Rec', 'Vibration Rec', 'Thermo Rec'];
  if (TECH_ROLES.indexOf(role) >= 0) return ['Amp Rec', 'Vibration Rec', 'Thermo Rec'];
  if (roleEquipment(role)) return [roleEquipment(role)];
  return [];
}

/* ================= API ================= */

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) {}
  let out;
  try {
    switch (body.action) {
      case 'login':        out = login(body.username, body.pin); break;
      case 'getAll':       out = withUser(body, u => getAll(u)); break;
      case 'sync':         out = withUser(body, u => locked(() => syncOps(u, body.ops))); break;
      case 'getSheet':     out = withUser(body, u => getSheet(u, body.sheet, body.date)); break;
      case 'saveReading':  out = withUser(body, u => locked(() => saveReading(u, body.sheet, body.row, body.value, body.date))); break;
      case 'complete':     out = withUser(body, u => locked(() => completeTask(u, body.sheet, body.date))); break;
      case 'getChecklist': out = withUser(body, u => getChecklist(u, body.type, body.unit)); break;
      case 'uploadPhoto':  out = withUser(body, u => uploadPhoto(u, body.type, body.unit, body.kind, body.data, body.opId, body.date)); break;
      case 'submitCheck':  out = withUser(body, u => locked(() => submitCheck(u, body.type, body.unit, body.data, body.date))); break;
      case 'myTasks':      out = withUser(body, u => ({ ok: true, tasks: myTasks(u) })); break;
      case 'taskCreate':   out = withUser(body, u => locked(() => taskCreate(u, body.task))); break;
      case 'taskEdit':     out = withUser(body, u => locked(() => taskEdit(u, body.task))); break;
      case 'taskUpdate':   out = withUser(body, u => locked(() => taskUpdate(u, body))); break;
      case 'meterAdd':     out = withUser(body, u => locked(() => meterAdd(u, body.meter))); break;
      case 'meterList':    out = withUser(body, u => meterList(u, body.no)); break;
      case 'downtimeStart': out = withUser(body, u => locked(() => downtimeStart(u, body.downtime))); break;
      case 'downtimeEnd':  out = withUser(body, u => locked(() => downtimeEnd(u, body.downtime))); break;
      case 'downtimeList': out = withUser(body, u => downtimeList(u, body.no)); break;
      case 'assetCard':    out = withUser(body, u => assetCard(u, body.no)); break;
      case 'causes':       out = withUser(body, u => causesList(u)); break;
      case 'causesSave':   out = withUser(body, u => locked(() => causesSave(u, body.causes))); break;
      case 'assetsLookup': out = withUser(body, u => assetsLookup(u, body.q)); break;
      case 'requestCreate': out = withUser(body, u => locked(() => requestCreate(u, body.request))); break;
      case 'requestList':  out = withUser(body, u => requestList(u)); break;
      case 'requestDecide': out = withUser(body, u => locked(() => requestDecide(u, body))); break;
      case 'comments':     out = withUser(body, u => commentsList(u, body.id)); break;
      case 'commentAdd':   out = withUser(body, u => locked(() => commentAdd(u, body))); break;
      case 'taskSignature': out = withUser(body, u => taskSignature(u, body.id)); break;
      case 'procedures':   out = withUser(body, u => procedureList(u)); break;
      case 'procedureSave': out = withUser(body, u => locked(() => procedureSave(u, body.procedure))); break;
      case 'procedureRun': out = withUser(body, u => locked(() => procedureRun(u, body))); break;
      case 'procedureRuns': out = withUser(body, u => procedureRuns(u, body)); break;
      case 'procedureAudit': out = withUser(body, u => procedureAudit(u, body)); break;
      case 'poList':       out = withUser(body, u => poList(u)); break;
      case 'poCreate':     out = withUser(body, u => locked(() => poCreate(u, body.po))); break;
      case 'poDecide':     out = withUser(body, u => locked(() => poDecide(u, body))); break;
      case 'poOrder':      out = withUser(body, u => locked(() => poOrder(u, body))); break;
      case 'poReceive':    out = withUser(body, u => locked(() => poReceive(u, body))); break;
      case 'poCancel':     out = withUser(body, u => locked(() => poCancel(u, body))); break;
      case 'schedule':     out = withUser(body, u => schedule(u, body)); break;
      case 'scheduleMove': out = withUser(body, u => locked(() => scheduleMove(u, body))); break;
      case 'estimate':     out = withUser(body, u => estimate(u, body)); break;
      case 'availability': out = withUser(body, u => availabilityList(u)); break;
      case 'availabilitySave': out = withUser(body, u => locked(() => availabilitySave(u, body.availability))); break;
      case 'timeOffAdd':   out = withUser(body, u => locked(() => timeOffAdd(u, body.timeOff))); break;
      case 'timeOffDelete': out = withUser(body, u => locked(() => timeOffDelete(u, body))); break;
      case 'publicAsset':  out = publicAsset(body); break;              // no sign-in: only works while the supervisor has switched the form on
      case 'publicReport': out = locked(() => publicReport(body)); break;
      case 'settings':     out = withUser(body, u => settingsGet(u)); break;
      case 'settingsSave': out = withUser(body, u => locked(() => settingsSave(u, body.settings))); break;
      case 'costReport':   out = withUser(body, u => costReport(u, body)); break;
      case 'report':       out = withUser(body, u => report(u, body)); break;
      case 'reportEmail':  out = withUser(body, u => reportEmail(u, body)); break;
      case 'reportRecipients': out = withUser(body, u => reportRecipients(u)); break;
      case 'reportRecipientSave': out = withUser(body, u => locked(() => reportRecipientSave(u, body.email, body.active !== false))); break;
      case 'partInfo':     out = withUser(body, u => partInfo(u, body.kind, body.no)); break;
      case 'partUse':      out = withUser(body, u => locked(() => partUse(u, body.part))); break;
      case 'partReceive':  out = withUser(body, u => locked(() => partReceive(u, body.part))); break;
      case 'partCount':    out = withUser(body, u => locked(() => partCount(u, body.part))); break;
      case 'partDetails':  out = withUser(body, u => locked(() => partDetails(u, body.part))); break;
      case 'partsLookup':  out = withUser(body, u => partsLookup(u, body.q)); break;
      case 'taskParts':    out = withUser(body, u => taskParts(u, body.id)); break;
      case 'vendors':      out = withUser(body, u => vendorsList(u)); break;
      case 'vendorSave':   out = withUser(body, u => locked(() => vendorSave(u, body.vendor))); break;
      case 'limits':       out = withUser(body, u => limitsList(u)); break;
      case 'limitSave':    out = withUser(body, u => locked(() => limitSave(u, body.limit))); break;
      case 'pmCalendar':   out = withUser(body, u => pmCalendar(u, body.month)); break;
      case 'pmCompliance': out = withUser(body, u => pmCompliance(u, body.months)); break;
      case 'taskApprove':  out = withUser(body, u => locked(() => taskApprove(u, body))); break;
      case 'taskTemplates': out = withUser(body, u => taskTemplates(u)); break;
      case 'taskTemplateSave': out = withUser(body, u => locked(() => taskTemplateSave(u, body.template))); break;
      case 'taskRuleCreate': out = withUser(body, u => locked(() => taskRuleCreate(u, body.task, body.auto))); break;
      case 'taskRules':    out = withUser(body, u => taskRulesList(u)); break;
      case 'taskRuleStatus': out = withUser(body, u => locked(() => taskRuleStatus(u, body.id, !!body.active))); break;
      case 'dashboard':    out = withUser(body, u => dashboard(u)); break;
      case 'equipment':    out = withUser(body, u => { if (!canSeeEquipment(u)) throw new Error('You do not have access to equipment'); const all = !!body.all && canEditEquipment(u); return { ok: true, equipment: equipmentList(!!body.fresh || all, all), offline: offlineMap() }; }); break;
      case 'equipmentHistory': out = withUser(body, u => equipmentHistory(u, body.equipment || {})); break;
      case 'spares':       out = withUser(body, u => { if (!canSeeSpares(u)) throw new Error('You do not have access to spare parts'); const all = !!body.all && canEditSpares(u); return Object.assign({ ok: true, spares: sparesList(!!body.fresh || all, all) }, stockBundle()); }); break;
      case 'people':       out = withUser(body, u => { if (!canCreateTasks(u)) throw new Error('You do not have permission to create tasks'); return { ok: true, assignable: assignable() }; }); break;
      case 'employees':    out = withUser(body, u => employeesList(u)); break;
      case 'employeeSave': out = withUser(body, u => locked(() => employeeSave(u, body.employee))); break;
      case 'equipmentSave':   out = withUser(body, u => locked(() => equipmentSave(u, body.item))); break;
      case 'equipmentStatus': out = withUser(body, u => locked(() => equipmentStatus(u, body.row, body.status))); break;
      case 'spareSave':    out = withUser(body, u => locked(() => spareSave(u, body.item))); break;
      case 'spareStatus':  out = withUser(body, u => locked(() => spareStatus(u, body.kind, body.row, body.status))); break;
      case 'itemPhotos':   out = withUser(body, u => itemPhotos(u, body.kind, body.key)); break;
      case 'itemPhotoSave': out = withUser(body, u => locked(() => itemPhotoSave(u, body.kind, body.key, body.slot, body.data))); break;
      case 'pushSubscribe':   out = withUser(body, u => locked(() => pushSubscribe(u, body.sub, body.device))); break;
      case 'pushUnsubscribe': out = withUser(body, u => locked(() => pushUnsubscribe(u, body.endpoint))); break;
      case 'pushInbox':    out = withUser(body, u => pushInbox(u)); break;
      case 'pushTest':     out = withUser(body, u => locked(() => Object.assign({ ok: true }, notifyUser(u.username, { kind: 'test' })))); break;
      default:             out = { ok: false, error: 'Unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'Holoul Maintenance API', version: 20 }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** One writer at a time (all write actions go through here). */
function locked(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}

/* ---------- users + sign-in ---------- */

/** Users sheet as a list. Cached for a few minutes; `fresh` re-reads the sheet. */
function usersTable(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) { const hit = cache.get('users_v1'); if (hit) return JSON.parse(hit); }
  const rows = book().getSheetByName(USERS_SHEET).getDataRange().getDisplayValues();
  const h = rows[0], c = name => h.indexOf(name);
  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i], username = String(r[c('Username')]).trim();
    if (!username) continue;
    const yes = name => c(name) >= 0 && String(r[c(name)]).trim() === 'Yes';
    list.push({ id: r[c('User ID')], name: r[c('Full Name')], username: username,
                pin: String(r[c('PIN')]).trim(), active: r[c('Active')] === 'Yes',
                role: r[c('Role')], equipment: r[c('Assigned Equipment')],
                canTasks: yes(PERM_HEAD.tasks), canEquipment: yes(PERM_HEAD.equipment), canSpares: yes(PERM_HEAD.spares) });
  }
  try { cache.put('users_v1', JSON.stringify(list), USERS_CACHE_SECS); } catch (err) {}
  return list;
}

/** Extra rights per employee (Yes / No columns M–O in the Users sheet). Managers always have all of them. */
const PERM_HEAD = { tasks: 'Create tasks', equipment: 'Edit equipment', spares: 'Edit spare parts' };
function permsOf(u) {
  const m = MANAGER_ROLES.indexOf(u.role) >= 0;
  return { manager: m, tasks: m || !!u.canTasks, equipment: m || !!u.canEquipment, spares: m || !!u.canSpares };
}
const canCreateTasks = u => !!u && !!u.perms && u.perms.tasks;
const canSeeEquipment = u => !!u && !!u.perms && (u.perms.equipment || u.perms.manager);
const canSeeSpares = u => !!u && !!u.perms && (u.perms.spares || u.perms.manager);

function publicUser(u) {
  const perms = permsOf(u);
  return { id: u.id, name: u.name, username: u.username, role: u.role, equipment: u.equipment, access: accessFor(u.role, u.equipment),
           manager: perms.manager, perms: { manager: perms.manager, tasks: perms.tasks, equipment: perms.equipment, spares: perms.spares } };
}

/** Active user by username (fresh role / access), or null. */
function findUser(username) {
  username = String(username || '').trim().toLowerCase();
  const u = usersTable().filter(x => x.username.toLowerCase() === username)[0];
  return u && u.active ? publicUser(u) : null;
}

function login(username, pin) {
  username = String(username || '').trim().toLowerCase();
  pin = String(pin || '').trim();
  if (!username || !pin) return { ok: false, error: 'Enter username and PIN' };

  const u = usersTable(true).filter(x => x.username.toLowerCase() === username)[0];
  if (u && u.pin === pin) {
    if (!u.active) return { ok: false, error: 'Account is inactive — contact your supervisor' };
    const t = makeToken(u.username);
    return { ok: true, token: t.token, expires: t.expires, user: publicUser(u) };
  }
  Utilities.sleep(800); // slow down PIN guessing
  return { ok: false, error: 'Wrong username or PIN' };
}

/* Signed token: "v2.<payload>.<signature>". Nothing to store on the server. */
function tokenSecret() {
  const p = props();
  let s = p.getProperty('TOKEN_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('TOKEN_SECRET', s); }
  return s;
}
function signPart(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, tokenSecret())).replace(/=+$/, '');
}
function makeToken(username) {
  const expires = Date.now() + SESSION_DAYS * 864e5;
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({ u: username, exp: expires })).replace(/=+$/, '');
  return { token: 'v2.' + payload + '.' + signPart(payload), expires: expires };
}
function readToken(token) {
  token = String(token || '');
  if (token.indexOf('v2.') === 0) {
    const parts = token.split('.');
    if (parts.length !== 3 || signPart(parts[1]) !== parts[2]) return null;
    let p = null;
    try {
      let b = parts[1]; while (b.length % 4) b += '=';
      p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString());
    } catch (err) { return null; }
    if (!p || !p.u || !(p.exp > Date.now())) return null;
    return findUser(p.u);
  }
  // sessions created by the previous app version
  const raw = token && CacheService.getScriptCache().get('t_' + token);
  return raw ? JSON.parse(raw) : null;
}

function withUser(body, fn) {
  const user = readToken(body.token);
  if (!user) return { ok: false, auth: true, error: 'Session expired — please sign in again' };
  if (!user.perms) user.perms = permsOf(user);   // sessions from before v10
  return fn(user);
}

function checkSheet(user, sheetName) {
  if (!RECORD_SHEETS[sheetName]) throw new Error('This page is not set up yet');
  if (user.access.indexOf(sheetName) < 0) throw new Error('You do not have access to ' + sheetName);
  const sh = readings().getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet "' + sheetName + '" not found in Instrument Reading');
  return sh;
}

/* ---------- dates ---------- */

const todayIso = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
/** 'yyyy-MM-dd' -> Date at 12:00 Riyadh time (09:00 UTC), so formatting in TZ gives the same day. */
function isoToDate(iso) { const p = String(iso).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2], 9)); }

/** The working day of a reading. No date (older app) = today. Future = today. Too old = error. */
function workDate(s) {
  const today = todayIso();
  let iso = /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : today;
  if (iso > today) iso = today;                         // phone clock ahead
  const back = Math.round((isoToDate(today) - isoToDate(iso)) / 864e5);
  if (back > MAX_BACK_DAYS) throw new Error('Date ' + iso + ' is more than ' + MAX_BACK_DAYS + ' days old');
  return { iso: iso, date: isoToDate(iso), today: iso === today };
}

function dateKeys(d) {
  return {
    iso: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'),
    texts: ['dMMM', 'ddMMM', 'd MMM', 'dd MMM', 'd-MMM', 'dd-MMM', 'd/M/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd']
      .map(f => Utilities.formatDate(d, TZ, f).replace(/\s/g, '').toLowerCase())
  };
}

function isDay(v, keys) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd') === keys.iso;
  const s = String(v || '').replace(/\s/g, '').toLowerCase();
  return !!s && keys.texts.indexOf(s) >= 0;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** Reads a date header ("26Sep", "26 Sep", "26/9/2026", a real date ...). Headers without a year get the nearest past year. */
function headerDate(v) {
  if (v instanceof Date && !isNaN(v)) return isoToDate(Utilities.formatDate(v, TZ, 'yyyy-MM-dd'));
  const s = String(v || '').trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], 9));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], m[2] - 1, +m[1], 9));
  m = s.match(/^(\d{1,2})[\s\-]*([a-z]{3})/);
  if (m && MONTHS[m[2]] != null) {
    const today = isoToDate(todayIso());
    let d = new Date(Date.UTC(today.getUTCFullYear(), MONTHS[m[2]], +m[1], 9));
    if (d - today > 2 * 864e5) d = new Date(Date.UTC(today.getUTCFullYear() - 1, MONTHS[m[2]], +m[1], 9));
    return d;
  }
  return null;
}

/** Finds the column for day `d` (by the date in row 1). If there is none:
 *  - create = false: returns { isNew: true } (nothing written)
 *  - create = true : uses the first empty column that keeps the days in order
 *    (inserting a column before a later day if needed) and writes the date in row 1. */
function dayColumn(sh, cfg, create, d) {
  d = d || workDate();
  const lastCol = Math.max(sh.getLastColumn(), cfg.firstDayCol);
  const width = lastCol - cfg.firstDayCol + 1;
  const top = sh.getRange(1, cfg.firstDayCol, 1, width).getValues()[0];
  const keys = dateKeys(d.date);

  for (let i = 0; i < width; i++) if (isDay(top[i], keys)) return { col: cfg.firstDayCol + i, isNew: false };
  if (!create) return { col: null, isNew: true };

  // columns of earlier / later days
  let lastEarlier = cfg.firstDayCol - 1, firstLater = 0;
  for (let i = 0; i < width; i++) {
    const hd = headerDate(top[i]);
    if (!hd) continue;
    if (hd < d.date) lastEarlier = cfg.firstDayCol + i;
    else if (hd > d.date && !firstLater) firstLater = cfg.firstDayCol + i;
  }
  // first completely empty column after the earlier days (and before any later day)
  const lastRow = Math.max(sh.getLastRow(), cfg.dataRow);
  const body = sh.getRange(1, cfg.firstDayCol, lastRow, width).getValues();
  let col = 0;
  for (let i = 0; i < width; i++) {
    const c = cfg.firstDayCol + i;
    if (c <= lastEarlier) continue;
    if (firstLater && c >= firstLater) break;
    if (body.every(r => r[i] === '' || r[i] === null)) { col = c; break; }
  }
  if (!col) {
    if (firstLater) { sh.insertColumnBefore(firstLater); col = firstLater; }   // late upload for an earlier day
    else col = lastCol + 1;
  }
  if (col > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), col - sh.getMaxColumns());
  sh.getRange(1, col).setNumberFormat('@').setValue(Utilities.formatDate(d.date, TZ, 'dMMM'));  // e.g. 26Sep, same style as existing headers
  return { col: col, isNew: true };
}

/** Row 2: who filled the column (adds a second name if two people work the same day). */
function markChecker(sh, col, username) {
  const who = sh.getRange(2, col);
  const names = String(who.getValue() || '').split(',').map(s => s.trim()).filter(String);
  if (names.indexOf(username) < 0) { names.push(username); who.setValue(names.join(', ')); }
}

/* ---------- reading pages ---------- */

function getSheet(user, sheetName, date) {
  const sh = checkSheet(user, sheetName);
  const cfg = RECORD_SHEETS[sheetName];
  const d = workDate(date);
  const day = dayColumn(sh, cfg, false, d);
  const lastRow = sh.getLastRow();
  const n = lastRow - cfg.dataRow + 1;
  const base = {
    ok: true, sheet: sheetName, layout: cfg.layout, iso: d.iso,
    refHeader: cfg.refCol ? (sh.getRange(1, cfg.refCol).getDisplayValue() || 'Ref Value') : '',
    date: Utilities.formatDate(d.date, TZ, 'EEE d MMM yyyy'),
    column: day.isNew ? null : columnLetter(day.col),
    checkedBy: day.isNew ? '' : sh.getRange(2, day.col).getDisplayValue(),
    completed: completedOn(sheetName, d.iso)
  };
  if (n < 1) { base.rows = []; return base; }

  const vals = day.isNew ? [] : sh.getRange(cfg.dataRow, day.col, n, 1).getDisplayValues();
  const valueAt = i => vals[i] ? String(vals[i][0]).trim() : '';
  base.rows = cfg.layout === 'vibration' ? vibrationRows(sh, cfg, n, valueAt)
            : cfg.layout === 'grouped'   ? groupedRows(sh, cfg, n, valueAt)
            : listRows(sh, cfg, n, valueAt);
  attachUsual(sh, cfg, d, n, sheetName, base.rows);
  return base;
}

/** Release 8: for every reading row, what the last readings looked like and the supervisor's limit, so the phone can warn about an odd value while it is typed (also offline). */
function attachUsual(sh, cfg, d, n, sheetName, rows) {
  try {
    const limits = {};
    limitRows().filter(r => r['Page'] === sheetName && r['Active'] === 'Yes').forEach(r => { limits[Number(r['Row'])] = { min: r['Min'] === '' ? null : Number(r['Min']), max: r['Max'] === '' ? null : Number(r['Max']) }; });
    const lastCol = sh.getLastColumn();
    let use = [];
    if (lastCol >= cfg.firstDayCol) {
      const top = sh.getRange(1, cfg.firstDayCol, 1, lastCol - cfg.firstDayCol + 1).getValues()[0];
      const cols = [];
      top.forEach((v, i) => { const hd = headerDate(v); if (hd && hd < d.date) cols.push({ c: cfg.firstDayCol + i, hd: hd }); });
      cols.sort((a, b) => a.hd - b.hd);
      use = cols.slice(-10);
    }
    let block = null, c0 = 0;
    if (use.length >= 3) { c0 = use[0].c; block = sh.getRange(cfg.dataRow, c0, n, use[use.length - 1].c - c0 + 1).getValues(); }
    rows.forEach(r => {
      if (!r.row) return;
      if (limits[r.row]) r.limit = limits[r.row];
      if (!block) return;
      const line = block[r.row - cfg.dataRow];
      if (!line) return;
      const nums = use.map(u => line[u.c - c0]).filter(v => v !== '' && v !== null && !isNaN(Number(v))).map(Number).sort((a, b) => a - b);
      if (nums.length >= 3) r.usual = { lo: nums[0], hi: nums[nums.length - 1], med: nums[Math.floor(nums.length / 2)], n: nums.length };
    });
  } catch (err) { console.error('attachUsual: ' + err); }
}

/** Amp Rec style: one reading per row, section header rows in between. */
function listRows(sh, cfg, n, valueAt) {
  const left = sh.getRange(cfg.dataRow, 1, n, cfg.refCol).getDisplayValues();
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = left[i];
    const id = String(r[cfg.idCol - 1]).trim(), desc = String(r[cfg.descCol - 1]).trim();
    const first = String(r[0]).trim();
    if (!id && !desc) {                       // section header row, e.g. "S1000, Flipflop ..."
      if (first) rows.push({ section: first });
      continue;
    }
    rows.push({ row: cfg.dataRow + i, id: id, desc: desc, ref: String(r[cfg.refCol - 1]).trim(), value: valueAt(i) });
  }
  return rows;
}

/** Vibration style: A machine, B Motor/Bearing, C position, D direction.
 *  Merged cells only hold the value in their first row, so A–C are filled down. */
function vibrationRows(sh, cfg, n, valueAt) {
  const left = sh.getRange(cfg.dataRow, 1, n, cfg.keyCols).getDisplayValues();
  const POS = { F: 'Front', B: 'Back', L: 'Left', R: 'Right' };
  let machine = '', part = '', pos = '';
  const rows = [];
  for (let i = 0; i < n; i++) {
    const a = String(left[i][0]).trim(), b = String(left[i][1]).trim(), c = String(left[i][2]).trim(), d = String(left[i][3]).trim();
    if (a) { machine = a; part = ''; pos = ''; }
    if (b) { part = b; pos = ''; }
    if (c) pos = c;
    if (!d) continue;                         // blank line
    const dir = d.charAt(0).toUpperCase();    // H / V / A
    rows.push({
      row: cfg.dataRow + i, machine: machine, part: part,
      pos: pos.toUpperCase(), posName: POS[pos.toUpperCase()] || pos, dir: dir, dirName: d,
      value: valueAt(i)
    });
  }
  return rows;
}

/** Generic grouped layout (Thermo Rec): A category, B subcategory, C component.
 *  A and B are filled down (merged cells). A row with B but no C is a single reading. */
function groupedRows(sh, cfg, n, valueAt) {
  const left = sh.getRange(cfg.dataRow, 1, n, cfg.keyCols).getDisplayValues();
  let group = '', item = '';
  const rows = [];
  for (let i = 0; i < n; i++) {
    const a = String(left[i][0]).trim(), b = String(left[i][1]).trim(), c = String(left[i][2]).trim();
    if (a) { group = a; item = ''; }
    if (b) item = b;
    if (!b && !c) continue;                   // blank line
    if (!item) continue;                      // point without equipment name
    rows.push({ row: cfg.dataRow + i, group: group || 'Equipment', item: item, point: c || 'Reading', value: valueAt(i) });
  }
  return rows;
}

/** Writes one reading into the column of its day. `memo` skips repeat lookups inside one sync. */
function saveReading(user, sheetName, row, value, date, memo) {
  const sh = checkSheet(user, sheetName);
  const cfg = RECORD_SHEETS[sheetName];
  row = Number(row);
  if (!(row >= cfg.dataRow && row <= sh.getLastRow())) throw new Error('Invalid row');
  const d = workDate(date);
  const key = sheetName + '|' + d.iso;
  let col = memo && memo[key];
  if (!col) {
    col = dayColumn(sh, cfg, true, d).col;
    markChecker(sh, col, user.username);
    if (memo) memo[key] = col;
  }
  const v = String(value == null ? '' : value).trim();
  const num = Number(v.replace(',', '.'));
  sh.getRange(row, col).setValue(v === '' ? '' : (isNaN(num) ? v : num));
  let limitTask = '';
  if (v !== '' && !isNaN(num)) { try { limitTask = limitCheck(user, sheetName, row, num, d.iso); } catch (err) { console.error('limitCheck: ' + err); } }
  return { ok: true, row: row, value: v, column: columnLetter(col), date: d.iso, limitTask: limitTask };
}

function taskLog() {
  const ss = readings();
  return ss.getSheetByName(LOG_SHEET) || (function () {
    const s = ss.insertSheet(LOG_SHEET);
    s.appendRow(['Timestamp', 'Date', 'Sheet', 'User ID', 'Username', 'Full Name', 'Filled', 'Total', 'Column']);
    s.getRange('A1:I1').setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    s.setFrozenRows(1);
    return s;
  })();
}

/** "Complete task" for a day. Sending it again updates the same Task Log row. */
function completeTask(user, sheetName, date) {
  const d = workDate(date);
  SpreadsheetApp.flush();
  const data = getSheet(user, sheetName, d.iso);
  const items = data.rows.filter(r => !r.section);
  const filled = items.filter(r => r.value !== '').length;

  const log = taskLog();
  const now = new Date();
  const row = [Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm'), d.iso, sheetName, user.id, user.username,
               user.name, filled, items.length, data.column || ''];
  let target = 0;
  if (log.getLastRow() > 1) {
    const rows = log.getRange(2, 1, log.getLastRow() - 1, 5).getDisplayValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][1] === d.iso && rows[i][2] === sheetName && rows[i][4] === user.username) { target = i + 2; break; }
    }
  }
  if (!target) target = log.getLastRow() + 1;
  log.getRange(target, 1, 1, row.length).setValues([row]);
  log.getRange(target, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  return { ok: true, filled: filled, total: items.length, date: d.iso, completed: completedOn(sheetName, d.iso) };
}

function completedOn(sheetName, iso) {
  const log = readings().getSheetByName(LOG_SHEET);
  if (!log || log.getLastRow() < 2) return null;
  const rows = log.getRange(2, 1, log.getLastRow() - 1, 9).getDisplayValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][1] === iso && rows[i][2] === sheetName)
      return { by: rows[i][5] || rows[i][4], at: rows[i][0].slice(11, 16), filled: rows[i][6], total: rows[i][7] };
  }
  return null;
}

/* ---------- one request for everything a user can open ---------- */

function getAll(user) {
  const pages = {};
  user.access.forEach(name => {
    try {
      if (RECORD_SHEETS[name]) pages[name] = getSheet(user, name);
      else if (CHECK_TYPES.indexOf(name) >= 0) {
        const first = getChecklist(user, name);
        const units = {};
        units[first.unit] = first;
        first.units.forEach(u => { if (!units[u]) units[u] = getChecklist(user, name, u); });
        pages[name] = { ok: true, checklist: true, defaultUnit: first.unit, units: units };
      }
    } catch (err) {
      pages[name] = { ok: false, error: String(err.message || err) };
    }
  });
  let tasks = [], pushKey = '';
  try { tasks = myTasks(user); } catch (err) {}
  try { pushKey = vapidKeys().pub; } catch (err) {}
  return { ok: true, today: todayIso(), user: user, pages: pages, tasks: tasks, pushKey: pushKey };
}

/* ---------- many queued changes in one request ---------- */

/** ops: [{ id, action: 'saveReading'|'complete'|'submitCheck', ...fields, date }]
 *  Each op gets its own result, so one bad op does not block the others. */
function syncOps(user, ops) {
  if (!Array.isArray(ops)) throw new Error('No changes sent');
  const memo = {}, results = [];
  ops.slice(0, 200).forEach(op => {
    let r;
    try {
      switch (op && op.action) {
        case 'saveReading': r = saveReading(user, op.sheet, op.row, op.value, op.date, memo); break;
        case 'complete':    r = completeTask(user, op.sheet, op.date); break;
        case 'submitCheck': r = submitCheck(user, op.type, op.unit, op.data, op.date); break;
        case 'taskUpdate':  r = taskUpdate(user, Object.assign({}, op, { id: op.task })); break;   // op.id is the change id
        default:            r = { ok: false, error: 'Unknown change ' + (op && op.action) };
      }
    } catch (err) {
      r = { ok: false, error: String(err.message || err) };
    }
    r.id = op && op.id;
    results.push(r);
  });
  return { ok: true, results: results };
}

/* ================= Daily equipment checks (Bobcat, later Forklift) =================
 * Everything lives in Drive folder "Maintenance Data Storage":
 *   - spreadsheet "Equipment Daily Checks" with tabs
 *       Units              : Type | Unit No | Active          (e.g. Bobcat | BC1 | Yes)
 *       <Type> Checklist   : Section | Item | Input | Frequency | Photo | Active
 *                            Input = Check (tick OK / Fault) or Reading (number)
 *                            Frequency = Daily or Weekly, Photo = Required / Optional / No
 *       <Type> Log         : one row per unit per day (re-submitting the same day updates it)
 *   - folder "Photos/<Type>" with every photo the operators take
 * Edit the Checklist tab to add / rename / remove items — the app follows it. */

const props = () => PropertiesService.getScriptProperties();

let _checks = null;
function checksBook() {
  if (_checks) return _checks;
  const id = props().getProperty('CHECKS_SS_ID');
  if (!id) throw new Error('Daily checks are not set up yet');
  return (_checks = SpreadsheetApp.openById(id));
}

function checkAccess(user, type) {
  if (user.access.indexOf(type) < 0) throw new Error('You do not have access to ' + type);
}

function readChecklist(ss, type) {
  const sh = ss.getSheetByName(type + ' Checklist');
  if (!sh) throw new Error('No checklist for ' + type);
  const v = sh.getDataRange().getDisplayValues().slice(1);
  let section = '';
  const items = [];
  v.forEach(r => {
    const [sec, item, input, freq, photo, active] = r.map(x => String(x).trim());
    if (sec) section = sec;
    if (!item || /^no$/i.test(active)) return;
    items.push({
      section: section, item: item,
      input: /^read/i.test(input) ? 'reading' : 'check',
      weekly: /^week/i.test(freq),
      photo: /^req/i.test(photo) ? 'required' : /^opt/i.test(photo) ? 'optional' : 'no'
    });
  });
  return items;
}

function readUnits(ss, type) {
  const sh = ss.getSheetByName('Units');
  return sh.getDataRange().getDisplayValues().slice(1)
    .filter(r => String(r[0]).trim().toLowerCase() === type.toLowerCase() && !/^no$/i.test(String(r[2]).trim()) && String(r[1]).trim())
    .map(r => String(r[1]).trim());
}

function logSheet(ss, type) {
  return ss.getSheetByName(type + ' Log') || (function () {
    const s = ss.insertSheet(type + ' Log');
    s.appendRow(LOG_BASE);
    s.getRange(1, 1, 1, LOG_BASE.length).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    s.setFrozenRows(1);
    return s;
  })();
}
const LOG_BASE = ['Timestamp', 'Date', 'Unit', 'User ID', 'Username', 'Operator', 'Status', 'Faults'];

function getChecklist(user, type, unit) {
  checkAccess(user, type);
  const ss = checksBook();
  const items = readChecklist(ss, type);
  const units = readUnits(ss, type);
  if (!units.length) throw new Error('No ' + type + ' units listed in the Units tab');
  unit = units.indexOf(unit) >= 0 ? unit : units[0];

  const log = logSheet(ss, type);
  const data = log.getDataRange().getDisplayValues();
  const h = data[0], col = name => h.indexOf(name);
  const today = todayIso();

  let todayEntry = null;
  const last = {}, weeklyLast = {};
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (r[col('Unit')] !== unit) continue;
    const date = r[col('Date')];
    if (date === today) {
      todayEntry = { at: String(r[col('Timestamp')]).slice(11, 16), by: r[col('Operator')], status: r[col('Status')], values: {} };
      items.forEach(it => {
        const c = col(it.item); if (c >= 0) todayEntry.values[it.item] = r[c];
        const p = col(it.item + ' Photo'); if (p >= 0 && r[p]) todayEntry.values[it.item + ' Photo'] = r[p];
      });
      todayEntry.faults = r[col('Faults')];
      continue;
    }
    items.forEach(it => {
      const c = col(it.item); if (c < 0) return;
      const val = String(r[c]).trim();
      if (it.input === 'reading' && val !== '') last[it.item] = { value: val, date: date, by: r[col('Operator')] };
      if (it.weekly && val === '✓') weeklyLast[it.item] = date;
    });
  }
  return {
    ok: true, type: type, unit: unit, units: units, items: items,
    date: Utilities.formatDate(new Date(), TZ, 'EEE d MMM yyyy'), today: today,
    todayEntry: todayEntry, last: last, weeklyLast: weeklyLast
  };
}

/** Saves one photo to Drive. With an opId (new app) the same photo sent twice is stored once. */
function uploadPhoto(user, type, unit, kind, dataUrl, opId, date) {
  if (type !== 'Tasks') checkAccess(user, type);
  const m = String(dataUrl || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw new Error('Not an image');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Photo is too large');
  const safe = s => String(s || '').replace(/[^\w.-]+/g, '-').slice(0, 40);
  const root = DriveApp.getFolderById(props().getProperty('PHOTOS_FOLDER_ID'));
  const it = root.getFoldersByName(type);
  const folder = it.hasNext() ? it.next() : root.createFolder(type);
  let name;
  if (opId) {
    name = [safe(unit), workDate(date).iso, safe(kind), safe(user.username), safe(opId)].join('_') + '.jpg';
    const same = folder.getFilesByName(name);
    if (same.hasNext()) { const f = same.next(); return { ok: true, id: f.getId(), url: f.getUrl(), name: name, existed: true }; }
  } else {
    name = [safe(unit), Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HHmmss'), safe(kind), safe(user.username)].join('_') + '.jpg';
  }
  const file = folder.createFile(Utilities.newBlob(bytes, m[1], name));
  return { ok: true, id: file.getId(), url: file.getUrl(), name: name };
}

/** Daily check for one unit on one day. Sending the same day again updates that row. */
/** A failed check makes one task for the supervisor (re-sending the same check the same day updates it, never doubles it). */
function faultTaskFor(user, type, unit, iso, faults) {
  const title = ('Fault: ' + type + ' ' + unit + ' · ' + iso).slice(0, 140);
  const details = faults.join('\n').slice(0, 2000) + '\n(Found by ' + user.name + ')';
  const found = readTasks().filter(t => t['Title'] === title && t['Status'] !== 'Cancelled')[0];
  if (found) {
    if (found['Status'] === 'Open' || found['Status'] === 'In progress') { found['Details'] = details; found['Updated'] = nowText(); writeTask(found); }
    return found['ID'];
  }
  const boss = usersTable().filter(u => u.active && u.role === 'Supervisor')[0] || usersTable().filter(u => u.active && u.role === 'Operations Manager')[0];
  if (!boss) return '';
  const p = props(), seq = Number(p.getProperty('TASK_SEQ') || 0) + 1;
  p.setProperty('TASK_SEQ', String(seq));
  const now = nowText();
  const t = { 'ID': 'T-' + ('000' + seq).slice(-4), 'Created': now, 'Created By': user.username, 'Creator Name': user.name,
    'Assigned To': boss.username, 'Assignee Name': boss.name, 'Title': title, 'Details': details, 'Equipment': unit, 'Priority': 'High',
    'Due': Utilities.formatDate(new Date(Date.now() + 864e5), TZ, 'yyyy-MM-dd'), 'Link': TASK_LINKS.indexOf(type) >= 0 ? type : '', 'Status': 'Open',
    'Updated': now, 'Updated By': user.username, 'Category': 'Other' };
  writeTask(t);
  history(t['ID'], 'Created', user, 'Failed check ' + type + ' ' + unit);
  notifyUser(boss.username, { kind: 'assigned', id: t['ID'], title: title, equipment: unit, priority: 'High', by: user.name });
  return t['ID'];
}

function submitCheck(user, type, unit, data, date) {
  checkAccess(user, type);
  const d = workDate(date);
  const ss = checksBook();
  const items = readChecklist(ss, type);
  const units = readUnits(ss, type);
  if (units.indexOf(unit) < 0) throw new Error('Unknown unit ' + unit);
  data = data || {};
  const ans = data.answers || {};

  // validate on the server too
  const missing = [];
  items.forEach(it => {
    const a = ans[it.item] || {};
    if (it.input === 'reading') {
      if (String(a.value || '').trim() === '') missing.push(it.item);
      if (it.photo === 'required' && !a.photo) missing.push(it.item + ' photo');
    } else if (!it.weekly && !a.v) missing.push(it.item);
    if (a.v === 'fault' && !String(a.note || '').trim()) missing.push(it.item + ' (describe the fault)');
  });
  if (missing.length) return { ok: false, error: 'Please complete: ' + missing.join(', ') };

  const log = logSheet(ss, type);
  // make sure every checklist item has a column (items added later get new columns at the end)
  let header = log.getRange(1, 1, 1, Math.max(log.getLastColumn(), 1)).getValues()[0].map(String);
  const want = LOG_BASE.slice();
  items.forEach(it => { want.push(it.item); if (it.input === 'reading' && it.photo !== 'no') want.push(it.item + ' Photo'); });
  want.forEach(name => { if (header.indexOf(name) < 0) { header.push(name); log.getRange(1, header.length).setValue(name).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff'); } });

  const now = new Date();
  const faults = [];
  const row = new Array(header.length).fill('');
  const set = (name, val) => { const c = header.indexOf(name); if (c >= 0) row[c] = val; };
  items.forEach(it => {
    const a = ans[it.item] || {};
    if (it.input === 'reading') {
      const n = Number(String(a.value).replace(',', '.'));
      set(it.item, isNaN(n) ? a.value : n);
      if (a.photo) set(it.item + ' Photo', a.photo);
    } else {
      set(it.item, a.v === 'ok' ? '✓' : a.v === 'fault' ? '✗' : '');
      if (a.v === 'fault') faults.push(it.item + ': ' + String(a.note).trim() + (a.photo ? ' (photo: ' + a.photo + ')' : ''));
    }
  });
  set('Timestamp', Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm'));
  set('Date', d.iso); set('Unit', unit); set('User ID', user.id); set('Username', user.username); set('Operator', user.name);
  set('Status', faults.length ? 'Action required (' + faults.length + ')' : 'OK');
  set('Faults', faults.join('\n'));

  // one row per unit per day: update that day's row if it exists
  const data2 = log.getDataRange().getDisplayValues();
  const cD = header.indexOf('Date'), cU = header.indexOf('Unit');
  let target = 0;
  for (let i = data2.length - 1; i >= 1; i--) if (data2[i][cD] === d.iso && data2[i][cU] === unit) { target = i + 1; break; }
  if (!target) target = log.getLastRow() + 1;
  const rng = log.getRange(target, 1, 1, header.length);
  rng.setNumberFormat('@').setValues([row.map(String)]);
  log.getRange(target, 1, 1, header.length).setBackground(faults.length ? '#fdecea' : null);
  let faultTask = '';
  if (faults.length) { try { faultTask = faultTaskFor(user, type, unit, d.iso, faults); } catch (err) { console.error('faultTask: ' + err); } }
  return { ok: true, faultTask: faultTask, status: faults.length ? 'Action required (' + faults.length + ')' : 'OK', faults: faults.length,
           at: Utilities.formatDate(now, TZ, 'HH:mm'), by: user.name, date: d.iso };
}

function columnLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/* ================= One-time: Vibration Rec username row ================= */

/** Inserts a "Checked by" row under the dates (row 2) so it matches Amp Rec:
 *  row 1 = date, row 2 = username. Safe to run twice — it only inserts once. */
function setupVibration() {
  const sh = readings().getSheetByName('Vibration Rec');
  if (String(sh.getRange('D2').getDisplayValue()).trim() === 'Checked by') { Logger.log('Already set up'); return; }
  sh.insertRowBefore(2);
  sh.getRange('A2:D2').setValues([['', '', '', 'Checked by']]);
  sh.getRange('A2:' + columnLetter(sh.getMaxColumns()) + '2')
    .setBackground('#fff7e6').setFontStyle('italic').setFontColor('#7c5a10');
  sh.getRange('D2').setFontWeight('bold').setHorizontalAlignment('right');
  Logger.log('Inserted "Checked by" row 2. Readings now start at row 3.');
}

/* ================= One-time: Thermo Rec header rows ================= */

/** Makes Thermo Rec match the others: row 1 = labels + dates, row 2 = "Checked by",
 *  data from row 3, readings from column D. Safe to run twice. */
function setupThermo() {
  const sh = readings().getSheetByName('Thermo Rec');
  if (String(sh.getRange('C2').getDisplayValue()).trim() === 'Checked by') { Logger.log('Already set up'); return; }
  const top = sh.getRange(1, 1, 3, 3).getDisplayValues();
  const firstData = top.findIndex(r => r.some(v => String(v).trim() !== '')) + 1;   // 1-based, 0 = none in first 3
  if (firstData === 1) sh.insertRowsBefore(1, 2);
  else if (firstData === 2) sh.insertRowBefore(2);
  // firstData 3 (or later): rows 1–2 already free
  sh.getRange('A1:C1').setValues([['Category', 'Subcategory', 'Component']]).setFontWeight('bold');
  sh.getRange('C2').setValue('Checked by').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('A2:' + columnLetter(Math.max(sh.getMaxColumns(), 4)) + '2')
    .setBackground('#fff7e6').setFontStyle('italic').setFontColor('#7c5a10');
  Logger.log('Thermo Rec ready: dates in row 1 from column D, "Checked by" in row 2, data from row 3.');
}

/* ================= One-time: daily checks storage ================= */

/** Creates Drive folder "Maintenance Data Storage" (with a Photos folder) and the
 *  "Equipment Daily Checks" spreadsheet, pre-filled from form MS-FOR-08-03 (Bob Cat).
 *  Safe to run twice — it reuses what already exists. */
function setupDailyChecks() {
  const p = props();
  const findOrMake = (parent, name) => { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); };
  const root = findOrMake(DriveApp.getRootFolder(), 'Maintenance Data Storage');
  const photos = findOrMake(root, 'Photos');
  findOrMake(photos, 'Bobcat');
  p.setProperty('STORAGE_FOLDER_ID', root.getId());
  p.setProperty('PHOTOS_FOLDER_ID', photos.getId());

  let ss;
  try { ss = SpreadsheetApp.openById(p.getProperty('CHECKS_SS_ID')); } catch (e) { ss = null; }
  if (!ss) {
    ss = SpreadsheetApp.create('Equipment Daily Checks');
    DriveApp.getFileById(ss.getId()).moveTo(root);
    p.setProperty('CHECKS_SS_ID', ss.getId());
  }
  const head = (sh, n) => sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  const list = v => SpreadsheetApp.newDataValidation().requireValueInList(v, true).build();

  let units = ss.getSheetByName('Units');
  if (!units) {
    units = ss.getSheets()[0].getName() === 'Sheet1' ? ss.getSheets()[0].setName('Units') : ss.insertSheet('Units');
    units.getRange(1, 1, 2, 3).setValues([['Type', 'Unit No', 'Active'], ['Bobcat', 'BC1', 'Yes']]);
    head(units, 3); units.setFrozenRows(1);
    units.getRange('A2:A200').setDataValidation(list(['Bobcat', 'Forklift']));
    units.getRange('C2:C200').setDataValidation(list(['Yes', 'No']));
  }

  if (!ss.getSheetByName('Bobcat Checklist')) {
    const sh = ss.insertSheet('Bobcat Checklist');
    const rows = [['Section', 'Item', 'Input', 'Frequency', 'Photo', 'Active']];
    const add = (sec, items, extra) => items.forEach((it, i) => rows.push([i ? '' : sec, it, 'Check', 'Daily', 'Optional', 'Yes'].map((v, k) => extra && extra[k] !== undefined ? extra[k] : v)));
    rows.push(['Daily Checks', 'Hour Meter Reading', 'Reading', 'Daily', 'Required', 'Yes']);
    add('', ['Tyre Conditions', 'Engine Oil Seals', 'Transmission hydraulic leaks', 'Clean filters', 'Loose bolts', 'Cabin Cleanliness', 'Grease as required']);
    add('Operational Checks', ['Seat belt functional', 'System Gauges', 'Lights', 'Horn / reverse alarm', 'Braking system', 'Water levels']);
    add('Lubrication', ['Grease Points', 'Gear box oil', 'Battery terminals (greased / secured)', 'Hydraulic Oil']);
    add('Weekly Checks', ['Clean Belly Guards', 'Wash Down Bobcat'], { 3: 'Weekly' });
    sh.getRange(1, 1, rows.length, 6).setValues(rows);
    head(sh, 6); sh.setFrozenRows(1);
    sh.getRange('C2:C300').setDataValidation(list(['Check', 'Reading']));
    sh.getRange('D2:D300').setDataValidation(list(['Daily', 'Weekly']));
    sh.getRange('E2:E300').setDataValidation(list(['Required', 'Optional', 'No']));
    sh.getRange('F2:F300').setDataValidation(list(['Yes', 'No']));
    sh.getRange('A2:A300').setFontWeight('bold');
    [150, 260, 90, 90, 90, 70].forEach((w, i) => sh.setColumnWidth(i + 1, w));
    sh.getRange(1, 8).setValue('Form MS-FOR-08-03 (Bob Cat daily/weekly check). Check = tick OK or Fault; Reading = number. Add rows to add items; set Active = No to hide one.').setFontStyle('italic').setFontColor('#6b7280');
  }
  logSheet(ss, 'Bobcat');
  Logger.log('Folder: %s', root.getUrl());
  Logger.log('Sheet:  %s', ss.getUrl());
}

/* ================= One-time sheet setup (Users) ================= */

function setupSheet() {
  const ss = book();
  let sh = ss.getSheetByName(USERS_SHEET) || ss.getSheets()[0];
  sh.setName(USERS_SHEET);

  const last = 500;
  sh.getRange('A1:L1').setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2937')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.getRange('H1:L1').setBackground('#374151');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  sh.getRange('F2:F' + last).setNumberFormat('@');

  const list = v => SpreadsheetApp.newDataValidation().requireValueInList(v, true).setAllowInvalid(false).build();
  sh.getRange('C2:C' + last).setDataValidation(list(EMPLOYEE_ROLES));
  sh.getRange('D2:D' + last).setDataValidation(list(['Forklift', 'Bobcat']));
  sh.getRange('G2:G' + last).setDataValidation(list(['Yes', 'No']));

  sh.getRange('H2:L' + last).clearContent();
  const tech = '(G2:G="Yes")*((C2:C="Mech-Technician")+(C2:C="Elec-Technician")+(C2:C="Supervisor")+(C2:C="Operations Manager"))';
  const op = role => '(G2:G="Yes")*(C2:C="' + role + '")';
  const f = cond => '=ARRAYFORMULA(IF(B2:B="","",IF(' + cond + ',"Yes","No")))';
  sh.getRange('H2').setFormula(f(tech));
  sh.getRange('I2').setFormula(f(tech));
  sh.getRange('J2').setFormula(f(tech));
  sh.getRange('K2').setFormula(f(op('Forklift Operator')));
  sh.getRange('L2').setFormula(f(op('Skid loader Operator')));

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

  let am = ss.getSheetByName('Access Matrix') || ss.insertSheet('Access Matrix');
  am.clear();
  am.getRange(1, 1, 7, 8).setValues([
    ['Role', 'Assigned Equipment', 'Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Forklift', 'Bobcat', 'Dashboard + assign tasks'],
    ['Mech-Technician', '(leave blank)', 'Yes', 'Yes', 'Yes', 'No', 'No', 'No'],
    ['Elec-Technician', '(leave blank)', 'Yes', 'Yes', 'Yes', 'No', 'No', 'No'],
    ['Forklift Operator', 'Forklift', 'No', 'No', 'No', 'Yes', 'No', 'No'],
    ['Skid loader Operator', 'Bobcat', 'No', 'No', 'No', 'No', 'Yes', 'No'],
    ['Supervisor', '(leave blank)', 'Yes', 'Yes', 'Yes', 'No', 'No', 'Yes'],
    ['Operations Manager', '(leave blank)', 'Yes', 'Yes', 'Yes', 'No', 'No', 'Yes']
  ]);
  am.getRange('A1:H1').setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2937');
  am.getRange('A1:H6').setFontFamily('Arial').setHorizontalAlignment('center');
  am.setColumnWidth(1, 180); am.setColumnWidth(2, 150);
  am.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Yes')
      .setBackground('#d1fae5').setFontColor('#065f46').setBold(true).setRanges([am.getRange('C2:H6')]).build()
  ]);
  Logger.log('Users sheet is ready.');
}

/* ================= Tasks (work orders) =================
 * Spreadsheet "Maintenance Tasks" in Drive folder "Maintenance Data Storage":
 *   Tasks         : one row per task (supervisors create, technicians start / finish)
 *   Task History  : every change (who, when, what) — used for the monthly summary
 *   Push Devices  : phones that receive notifications (one row per phone / browser)
 * Created by setupV7() (or automatically the first time it is needed). */

const TASK_COLS = ['ID', 'Created', 'Created By', 'Creator Name', 'Assigned To', 'Assignee Name', 'Title', 'Details',
                   'Equipment', 'Priority', 'Due', 'Link', 'Status', 'Started', 'Done', 'Done Note', 'Done Photo', 'Updated', 'Updated By',
                   'Equipment No', 'Line', 'Location',
                   'Category', 'Need Note', 'Need Photo', 'Approval', 'Approval By', 'Hours', 'Reminded', 'Source',
                   'Assets', 'Need Signature', 'Signature', 'Signed Name', 'Procedure'];
const METER_TAB = 'Meter Readings';
const METER_COLS = ['Timestamp', 'Equipment No', 'Equipment', 'Reading', 'By', 'Note', 'Meter', 'Unit'];
const HOURS_METER = 'Running hours';   // the meter that drives hour-based repeats; blank Meter on old rows means this one
const PART_STOCK_TAB = 'Part Stock';
const PART_STOCK_COLS = ['Key', 'Kind', 'Part No', 'Unit Cost', 'Vendor ID', 'Min Qty', 'Bin', 'Alerted', 'Updated'];
const PART_LOG_TAB = 'Part Usage';
const PART_LOG_COLS = ['Timestamp', 'Key', 'Kind', 'Part No', 'Part Name', 'Type', 'Qty', 'Balance', 'Work Order', 'Unit Cost', 'By', 'Note'];
const PART_TYPES = ['Used', 'Returned', 'Received', 'Count'];
const VENDOR_TAB = 'Vendors';
const VENDOR_COLS = ['Vendor ID', 'Name', 'Phone', 'Email', 'Notes', 'Active'];
const REQ_TAB = 'Work Requests';
const REQ_COLS = ['Request ID', 'Created', 'By', 'Name', 'Title', 'Details', 'Asset No', 'Asset', 'Urgency', 'Photo', 'Status', 'Decided By', 'Decided', 'Decision Note', 'Work Order'];
const COMMENT_TAB = 'Task Comments';
const COMMENT_COLS = ['Comment ID', 'Timestamp', 'Task ID', 'By', 'Name', 'Text', 'Mentions', 'Audio'];
const REPORT_TAB = 'Report Emails';
const REPORT_COLS = ['Email', 'Active', 'Added By', 'Added', 'Last Sent'];
const DOWNTIME_TAB = 'Downtime';
const DOWNTIME_COLS = ['Downtime ID', 'Equipment No', 'Equipment', 'Type', 'Cause', 'Started', 'Ended', 'Minutes', 'Note', 'Work Order',
                       'Started By', 'Ended By', 'Status'];
const DOWNTIME_TYPES = ['Unplanned', 'Planned'];
const CAUSE_TAB = 'Failure Causes';
const CAUSE_COLS = ['Cause', 'Active'];
const DEFAULT_CAUSES = ['Mechanical wear', 'Electrical fault', 'Operator error', 'Lack of lubrication', 'Material jam', 'Power loss',
                        'Sensor fault', 'Planned maintenance', 'Other'];
const LIMIT_TAB = 'Reading Limits';
const LIMIT_COLS = ['Limit ID', 'Page', 'Row', 'Label', 'Min', 'Max', 'Assign To', 'Priority', 'Active', 'Created By', 'Updated', 'Open Task'];
const PM_SOURCES = ['Repeat', 'Meter', 'Limit'];
const TEMPLATE_TAB = 'Task Templates';
const TEMPLATE_COLS = ['Template ID', 'Name', 'Title', 'Details', 'Equipment', 'Equipment No', 'Line', 'Location', 'Priority', 'Category',
                       'Need Note', 'Need Photo', 'Approval', 'Created By', 'Updated', 'Active'];
const HISTORY_COLS = ['Timestamp', 'Task ID', 'Action', 'By', 'Note'];
const PUSH_COLS = ['Username', 'Endpoint', 'P256dh', 'Auth', 'Device', 'Added', 'Last OK', 'Last Error'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const CATEGORIES = ['', 'Mechanical', 'Electrical', 'Cleaning', 'Safety', 'Other'];
const TASK_LINKS = ['', 'Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Bobcat', 'Forklift'];
const MANAGER_ROLES = ['Supervisor', 'Operations Manager'];
const ASSIGNABLE_ROLES = TECH_ROLES.concat(Object.keys(ROLE_EQUIPMENT));

const isManager = u => !!u && MANAGER_ROLES.indexOf(u.role) >= 0;
const nowText = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
const lc = s => String(s || '').trim().toLowerCase();

let _tasks = null;
function tasksBook() {
  if (_tasks) return _tasks;
  const p = props();
  let id = p.getProperty('TASKS_SS_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Maintenance Tasks');
    try {
      const folderId = p.getProperty('STORAGE_FOLDER_ID');
      if (folderId) DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(folderId));
    } catch (err) {}
    p.setProperty('TASKS_SS_ID', ss.getId());
  }
  const tab = (name, cols, first) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = first && ss.getSheets()[0].getName() === 'Sheet1' ? ss.getSheets()[0].setName(name) : ss.insertSheet(name);
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), cols.length).setNumberFormat('@');   // keep dates as typed text
    } else {
      // columns added in a later version: write the missing headers at the end
      const have = sh.getRange(1, 1, 1, cols.length).getValues()[0];
      cols.forEach((c, i) => {
        if (String(have[i] || '').trim() === '') {
          sh.getRange(1, i + 1).setValue(c).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
          sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
        }
      });
    }
    return sh;
  };
  tab('Tasks', TASK_COLS, true); tab('Task History', HISTORY_COLS); tab('Push Devices', PUSH_COLS); tab(AUTO_LOG, AUTO_LOG_COLS);
  tab(RULE_TAB, RULE_COLS); tab(TEMPLATE_TAB, TEMPLATE_COLS); tab(METER_TAB, METER_COLS); tab(LIMIT_TAB, LIMIT_COLS);
  tab(DOWNTIME_TAB, DOWNTIME_COLS); tab(CAUSE_TAB, CAUSE_COLS);
  tab(REQ_TAB, REQ_COLS); tab(COMMENT_TAB, COMMENT_COLS);
  tab(REPORT_TAB, REPORT_COLS);
  tab(PROC_TAB, PROC_COLS); tab(RUN_TAB, RUN_COLS); tab(PO_TAB, PO_COLS); tab(AVAIL_TAB, AVAIL_COLS); tab(OFF_TAB, OFF_COLS);
  tab(PART_STOCK_TAB, PART_STOCK_COLS); tab(PART_LOG_TAB, PART_LOG_COLS); tab(VENDOR_TAB, VENDOR_COLS);
  return (_tasks = ss);
}

/** All rows of a tab as objects (+ _row = sheet row number). */
function rowsOf(sh, cols) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, cols.length).getDisplayValues().map((r, i) => {
    const o = { _row: i + 2 };
    cols.forEach((c, j) => { o[c] = r[j]; });
    return o;
  });
}
const readTasks = () => rowsOf(tasksBook().getSheetByName('Tasks'), TASK_COLS);

function taskOut(t) {
  return { id: t['ID'], created: t['Created'], createdBy: t['Created By'], creatorName: t['Creator Name'],
           assignee: t['Assigned To'], assigneeName: t['Assignee Name'], title: t['Title'], details: t['Details'],
           equipment: t['Equipment'], priority: t['Priority'] || 'Normal', due: t['Due'], link: t['Link'], status: t['Status'] || 'Open',
           started: t['Started'], done: t['Done'], doneNote: t['Done Note'], donePhoto: t['Done Photo'], updated: t['Updated'],
           equipmentNo: t['Equipment No'] || '', line: t['Line'] || '', location: t['Location'] || '',
           category: t['Category'] || '', needNote: t['Need Note'] === 'Yes', needPhoto: t['Need Photo'] === 'Yes',
           approval: t['Approval'] || '', approvalBy: t['Approval By'] || '', hours: t['Hours'] || '', source: t['Source'] || '',
           assets: parseAssets(t['Assets']), needSignature: t['Need Signature'] === 'Yes', signed: !!t['Signature'], procedure: t['Procedure'] || '' };
}
function writeTask(t) {
  const sh = tasksBook().getSheetByName('Tasks');
  const row = TASK_COLS.map(c => t[c] == null ? '' : String(t[c]));
  const r = t._row || sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  t._row = r;
}
function history(id, action, user, note) {
  tasksBook().getSheetByName('Task History').appendRow([nowText(), id, action, user.username, note || '']);
}
function assignable() {
  return usersTable().filter(u => u.active && ASSIGNABLE_ROLES.indexOf(u.role) >= 0)
    .map(u => ({ username: u.username, name: u.name, role: u.role, id: u.id }));
}
function findTask(id) {
  const t = readTasks().filter(x => x['ID'] === String(id || ''))[0];
  if (!t) throw new Error('Task not found');
  return t;
}
const PRIORITY_RANK = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
function sortTasks(list) {
  const st = { 'In progress': 0, 'Open': 1, 'Done': 2, 'Cancelled': 3 };
  return list.sort((a, b) => (st[a.status] - st[b.status]) || (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(b.created).localeCompare(String(a.created)));
}

/** Tasks for one person: everything open + finished in the last 7 days. */
function myTasks(user) {
  const since = Utilities.formatDate(new Date(Date.now() - 7 * 864e5), TZ, 'yyyy-MM-dd');
  return sortTasks(readTasks().filter(t => lc(t['Assigned To']) === lc(user.username) &&
    (t['Status'] === 'Open' || t['Status'] === 'In progress' || String(t['Updated']).slice(0, 10) >= since)).map(taskOut));
}

function cleanDate(s) { s = String(s || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
/** Time an action happened on the phone (may be earlier, when it was offline). */
function actionTime(at) {
  const d = at ? new Date(at) : new Date();
  const t = isNaN(d) || d.getTime() > Date.now() + 5 * 60e3 ? new Date() : d;
  return Utilities.formatDate(t, TZ, 'yyyy-MM-dd HH:mm');
}

const yes = v => (v === true || v === 'Yes' || v === 'true') ? 'Yes' : '';
/** Optional fields shared by create / edit / template (only the ones sent are touched). */
function applyTaskExtras(t, f, isNew) {
  if (f.category != null) t['Category'] = CATEGORIES.indexOf(f.category) >= 0 ? f.category : '';
  if (f.needNote != null) t['Need Note'] = yes(f.needNote);
  if (f.needPhoto != null) t['Need Photo'] = yes(f.needPhoto);
  if (f.needSignature != null && t['Status'] !== 'Done') t['Need Signature'] = yes(f.needSignature);
  if (f.assets != null && t['Status'] !== 'Done') t['Assets'] = cleanAssets(f.assets, t);
  if (f.procedure != null && t['Status'] !== 'Done') {
    const pid = clean(f.procedure, 20);
    if (pid && !procRows().some(r => r['Procedure ID'] === pid && r['Active'] !== 'No')) throw new Error('Procedure not found');
    t['Procedure'] = pid;
  }
  if (f.needApproval != null && (isNew || (t['Status'] !== 'Done' && t['Approval'] !== 'Pending'))) t['Approval'] = f.needApproval ? 'Required' : '';
}
/** Labor hours: 0–999, quarter-hour steps; '' when not given. */
function cleanHours(v) {
  if (v == null || String(v).trim() === '') return '';
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n) || n < 0 || n > 999) throw new Error('Hours must be between 0 and 999');
  return String(Math.round(n * 4) / 4);
}

function taskCreate(user, f) {
  if (!canCreateTasks(user)) throw new Error('You do not have permission to create tasks');
  return taskCreateCore(user, f);
}
function taskCreateCore(user, f) {
  f = f || {};
  const title = String(f.title || '').trim().slice(0, 140);
  if (!title) throw new Error('Enter a task title');
  const who = assignable().filter(u => lc(u.username) === lc(f.assignee))[0];
  if (!who) throw new Error('Choose who does the task');
  const p = props();
  const seq = Number(p.getProperty('TASK_SEQ') || 0) + 1;
  p.setProperty('TASK_SEQ', String(seq));
  const now = nowText();
  const t = {
    'ID': 'T-' + ('000' + seq).slice(-4), 'Created': now, 'Created By': user.username, 'Creator Name': user.name,
    'Assigned To': who.username, 'Assignee Name': who.name, 'Title': title, 'Details': String(f.details || '').slice(0, 2000),
    'Equipment': String(f.equipment || '').slice(0, 120), 'Priority': PRIORITIES.indexOf(f.priority) >= 0 ? f.priority : 'Normal',
    'Due': cleanDate(f.due), 'Link': TASK_LINKS.indexOf(f.link || '') >= 0 ? (f.link || '') : '', 'Status': 'Open',
    'Updated': now, 'Updated By': user.username,
    'Equipment No': String(f.equipmentNo || '').slice(0, 60), 'Line': String(f.line || '').slice(0, 60), 'Location': String(f.location || '').slice(0, 60),
    'Source': clean(f.source, 30)
  };
  applyTaskExtras(t, f, true);
  writeTask(t);
  history(t['ID'], 'Created', user, 'Assigned to ' + who.username);
  const sent = notifyUser(who.username, { kind: 'assigned', id: t['ID'], title: title, equipment: equipLabel(t), priority: t['Priority'], by: user.name });
  return { ok: true, task: taskOut(t), notified: sent, warning: offWarning(who.username, t['Due']) };
}

/** Supervisor changes: edit fields, reassign, cancel, reopen. */
function taskEdit(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can change tasks');
  f = f || {};
  const t = findTask(f.id);
  const notes = [];
  let notifyNew = null;
  if (f.title != null && String(f.title).trim()) t['Title'] = String(f.title).trim().slice(0, 140);
  if (f.details != null) t['Details'] = String(f.details).slice(0, 2000);
  if (f.equipment != null) t['Equipment'] = String(f.equipment).slice(0, 120);
  if (f.equipmentNo != null) t['Equipment No'] = String(f.equipmentNo).slice(0, 60);
  if (f.line != null) t['Line'] = String(f.line).slice(0, 60);
  if (f.location != null) t['Location'] = String(f.location).slice(0, 60);
  if (f.priority != null && PRIORITIES.indexOf(f.priority) >= 0) t['Priority'] = f.priority;
  if (f.due != null) t['Due'] = cleanDate(f.due);
  if (f.link != null && TASK_LINKS.indexOf(f.link) >= 0) t['Link'] = f.link;
  applyTaskExtras(t, f, false);
  if (f.assignee && lc(f.assignee) !== lc(t['Assigned To'])) {
    const who = assignable().filter(u => lc(u.username) === lc(f.assignee))[0];
    if (!who) throw new Error('Choose who does the task');
    notes.push('Reassigned ' + t['Assigned To'] + ' → ' + who.username);
    t['Assigned To'] = who.username; t['Assignee Name'] = who.name;
    if (t['Status'] === 'In progress') { t['Status'] = 'Open'; t['Started'] = ''; }
    notifyNew = who.username;
  }
  if (f.status === 'Cancelled' && t['Status'] !== 'Cancelled') { t['Status'] = 'Cancelled'; notes.push('Cancelled'); }
  if (f.status === 'Open' && (t['Status'] === 'Done' || t['Status'] === 'Cancelled')) {
    t['Status'] = 'Open'; t['Started'] = ''; t['Done'] = ''; notes.push('Reopened'); notifyNew = notifyNew || t['Assigned To'];
  }
  t['Updated'] = nowText(); t['Updated By'] = user.username;
  writeTask(t);
  history(t['ID'], notes.length ? notes.join('; ') : 'Edited', user, f.note || '');
  let sent = null;
  if (notifyNew) sent = notifyUser(notifyNew, { kind: 'assigned', id: t['ID'], title: t['Title'], equipment: equipLabel(t), priority: t['Priority'], by: user.name });
  return { ok: true, task: taskOut(t), notified: sent, warning: t['Status'] === 'Open' || t['Status'] === 'In progress' ? offWarning(t['Assigned To'], t['Due']) : '' };
}

/** Technician: Start / Done (with note + photo). Safe to send again. */
function taskUpdate(user, f) {
  f = f || {};
  const t = findTask(f.id);
  if (lc(t['Assigned To']) !== lc(user.username) && !isManager(user)) throw new Error('This task is assigned to someone else');
  if (t['Status'] === 'Cancelled') throw new Error('This task was cancelled');
  const at = actionTime(f.at);
  if (f.status === 'In progress') {
    if (t['Status'] === 'Open') { t['Status'] = 'In progress'; t['Started'] = at; history(t['ID'], 'Started', user, ''); }
  } else if (f.status === 'Done') {
    if (t['Status'] !== 'Done') {
      const note = String(f.note || '').trim();
      if (t['Need Note'] === 'Yes' && !note) throw new Error('Write what was done before finishing this task');
      if (t['Need Photo'] === 'Yes' && !f.photo) throw new Error('Add a photo before finishing this task');
      if (t['Procedure'] && !runRows().some(r => r['Task ID'] === t['ID'])) throw new Error('Complete the procedure before finishing this task');
      if (t['Need Signature'] === 'Yes' && !f.signature) throw new Error('Get a signature before finishing this task');
      const sig = cleanSignature(f.signature);
      const hrs = cleanHours(f.hours);
      t['Status'] = 'Done'; if (!t['Started']) t['Started'] = at; t['Done'] = at;
      t['Done Note'] = String(f.note || '').slice(0, 2000); t['Done Photo'] = String(f.photo || '');
      if (hrs !== '') t['Hours'] = hrs;
      if (sig) { t['Signature'] = sig; t['Signed Name'] = clean(f.signedName, 60); }
      if (t['Approval'] === 'Required') t['Approval'] = 'Pending';
      history(t['ID'], 'Done', user, t['Done Note'] + (hrs !== '' ? ' [' + hrs + ' h]' : ''));
      if (t['Created By'] && lc(t['Created By']) !== lc(user.username))
        notifyUser(t['Created By'], { kind: 'done', id: t['ID'], title: t['Title'], by: user.name });
    } else {
      if (f.note != null && String(f.note) !== t['Done Note']) t['Done Note'] = String(f.note).slice(0, 2000);
      if (f.photo) t['Done Photo'] = String(f.photo);
      if (f.hours != null && String(f.hours).trim() !== '') t['Hours'] = cleanHours(f.hours);
    }
  } else throw new Error('Unknown task status');
  t['Updated'] = nowText(); t['Updated By'] = user.username;
  writeTask(t);
  return { ok: true, task: taskOut(t) };
}

/** Supervisor signs off a finished task, or sends it back (reopens it with a reason). */
function taskApprove(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can approve tasks');
  f = f || {};
  const t = findTask(f.id);
  if (t['Status'] !== 'Done' || t['Approval'] !== 'Pending') throw new Error('This task is not waiting for approval');
  const note = String(f.note || '').trim().slice(0, 500);
  if (f.approve === false || f.approve === 'false') {
    if (!note) throw new Error('Write why the task is sent back');
    t['Status'] = 'Open'; t['Started'] = ''; t['Done'] = ''; t['Approval'] = 'Required'; t['Approval By'] = '';
    history(t['ID'], 'Sent back', user, note);
    notifyUser(t['Assigned To'], { kind: 'assigned', id: t['ID'], title: t['Title'], equipment: equipLabel(t), priority: t['Priority'], by: user.name });
  } else {
    t['Approval'] = 'Approved'; t['Approval By'] = user.username;
    history(t['ID'], 'Approved', user, note);
  }
  t['Updated'] = nowText(); t['Updated By'] = user.username;
  writeTask(t);
  return { ok: true, task: taskOut(t) };
}

/* ---------- task templates: a saved task a supervisor can reuse ---------- */
function templateOut(r) {
  return { id: r['Template ID'], name: r['Name'], title: r['Title'], details: r['Details'], equipment: r['Equipment'], equipmentNo: r['Equipment No'],
           line: r['Line'], location: r['Location'], priority: r['Priority'] || 'Normal', category: r['Category'],
           needNote: r['Need Note'] === 'Yes', needPhoto: r['Need Photo'] === 'Yes', needApproval: r['Approval'] === 'Required' };
}
function taskTemplates(user) {
  if (!canCreateTasks(user)) throw new Error('You do not have permission to create tasks');
  const list = rowsOf(tasksBook().getSheetByName(TEMPLATE_TAB), TEMPLATE_COLS).filter(r => r['Active'] !== 'No');
  return { ok: true, templates: list.map(templateOut).sort((a, b) => String(a.name).localeCompare(String(b.name))) };
}
function taskTemplateSave(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can save templates');
  f = f || {};
  const sh = tasksBook().getSheetByName(TEMPLATE_TAB);
  const rows = rowsOf(sh, TEMPLATE_COLS);
  if (f.remove) {
    const r = rows.filter(x => x['Template ID'] === String(f.id))[0];
    if (!r) throw new Error('Template not found');
    r['Active'] = 'No'; r['Updated'] = nowText();
    sh.getRange(r._row, 1, 1, TEMPLATE_COLS.length).setNumberFormat('@').setValues([TEMPLATE_COLS.map(c => String(r[c] == null ? '' : r[c]))]);
    return { ok: true };
  }
  const name = String(f.name || '').trim().slice(0, 60), title = String(f.title || '').trim().slice(0, 140);
  if (!name) throw new Error('Enter a template name');
  if (!title) throw new Error('Enter a task title');
  let r = f.id ? rows.filter(x => x['Template ID'] === String(f.id))[0] : null;
  if (f.id && !r) throw new Error('Template not found');
  if (!r) {
    const p = props(), seq = Number(p.getProperty('TPL_SEQ') || 0) + 1;
    p.setProperty('TPL_SEQ', String(seq));
    r = { 'Template ID': 'TP-' + ('00' + seq).slice(-3), 'Created By': user.username, 'Active': 'Yes' };
  }
  r['Name'] = name; r['Title'] = title; r['Details'] = String(f.details || '').slice(0, 2000);
  r['Equipment'] = String(f.equipment || '').slice(0, 120); r['Equipment No'] = String(f.equipmentNo || '').slice(0, 60);
  r['Line'] = String(f.line || '').slice(0, 60); r['Location'] = String(f.location || '').slice(0, 60);
  r['Priority'] = PRIORITIES.indexOf(f.priority) >= 0 ? f.priority : 'Normal';
  r['Category'] = CATEGORIES.indexOf(f.category) >= 0 ? f.category : '';
  r['Need Note'] = yes(f.needNote); r['Need Photo'] = yes(f.needPhoto); r['Approval'] = f.needApproval ? 'Required' : '';
  r['Updated'] = nowText();
  const row = TEMPLATE_COLS.map(c => String(r[c] == null ? '' : r[c]));
  const at = r._row || sh.getLastRow() + 1;
  sh.getRange(at, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  return { ok: true, template: templateOut(r) };
}

/* ---------- meter readings: running hours for any equipment (feeds hour-based repeats) ---------- */
const isHoursName = n => { const x = lc(n); return x === '' || x === lc(HOURS_METER); };
function meterOut(r) {
  return { at: r['Timestamp'], no: r['Equipment No'], equipment: r['Equipment'], reading: Number(r['Reading']), by: r['By'], note: r['Note'],
           meter: isHoursName(r['Meter']) ? HOURS_METER : r['Meter'], unit: isHoursName(r['Meter']) ? 'h' : (r['Unit'] || '') };
}
/** Latest reading of one named meter on an asset (null when none). */
function latestMeter(no, name) {
  let best = null, bestTs = '';
  rowsOf(tasksBook().getSheetByName(METER_TAB), METER_COLS).forEach(r => {
    if (String(r['Equipment No']).trim() !== no) return;
    if (lc(isHoursName(r['Meter']) ? HOURS_METER : r['Meter']) !== lc(name)) return;
    const v = Number(String(r['Reading']).replace(',', '.'));
    if (!isFinite(v) || String(r['Reading']).trim() === '') return;
    if (best === null || String(r['Timestamp']) >= bestTs) { best = v; bestTs = String(r['Timestamp']); }
  });
  return best;
}
function meterAdd(user, f) {
  if (!canSeeEquipment(user)) throw new Error('You do not have access to equipment');
  f = f || {};
  const no = String(f.no || '').trim();
  const eq = equipmentList(false).filter(e => e.no && e.no === no)[0];
  if (!eq) throw new Error('Choose equipment that has a number');
  const name = clean(f.name, 40) || HOURS_METER;
  const hours = isHoursName(name);
  const unit = hours ? 'h' : clean(f.unit, 12);
  const raw = String(f.reading == null ? '' : f.reading).trim().replace(',', '.');
  const n = Number(raw);
  if (raw === '' || !isFinite(n) || n < 0 || n > 10000000) throw new Error(hours ? 'Enter the meter reading in hours' : 'Enter the meter reading');
  const seen = {};
  rowsOf(tasksBook().getSheetByName(METER_TAB), METER_COLS).forEach(r => { if (String(r['Equipment No']).trim() === no) seen[lc(isHoursName(r['Meter']) ? HOURS_METER : r['Meter'])] = 1; });
  if (!seen[lc(hours ? HOURS_METER : name)] && Object.keys(seen).length >= 10) throw new Error('An asset can have at most 10 meters');
  const last = hours ? latestHourMeter(no) : latestMeter(no, name);
  // counters only go up; a lower value needs the "meter replaced" tick (hours meter only — pressure or temperature go down)
  if (hours && last !== null && n < last && !f.replaced) throw new Error('Lower than the last reading (' + last + '). Tick "meter replaced" if the meter was changed');
  const sh = tasksBook().getSheetByName(METER_TAB);
  const note = String(f.note || '').trim().slice(0, 200) || (hours && last !== null && n < last ? 'Meter replaced' : '');
  sh.getRange(sh.getLastRow() + 1, 1, 1, METER_COLS.length).setNumberFormat('@')
    .setValues([[nowText(), no, eq.name, String(n), user.username, note, hours ? '' : name, hours ? '' : unit]]);
  return { ok: true, last: n, previous: last, meter: hours ? HOURS_METER : name };
}
function meterList(user, no) {
  if (!canSeeEquipment(user)) throw new Error('You do not have access to equipment');
  no = String(no || '').trim();
  // reversed first: readings saved in the same minute keep the newest row on top
  const all = rowsOf(tasksBook().getSheetByName(METER_TAB), METER_COLS).filter(r => r['Equipment No'] === no).reverse().map(meterOut)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const meters = [], seen = {};
  all.forEach(r => { const k = lc(r.meter); if (seen[k]) return; seen[k] = 1; meters.push({ name: r.meter, unit: r.unit, latest: r.reading, at: r.at }); });
  return { ok: true, readings: all.slice(0, 40), meters: meters, latest: latestHourMeter(no) };
}

/* ---------- failure causes (the list people choose from when an asset goes offline) ---------- */
function causeRows() {
  const sh = tasksBook().getSheetByName(CAUSE_TAB);
  let rows = rowsOf(sh, CAUSE_COLS).filter(r => String(r['Cause']).trim() !== '');
  if (!rows.length) {   // first use: the starter list
    sh.getRange(2, 1, DEFAULT_CAUSES.length, 2).setNumberFormat('@').setValues(DEFAULT_CAUSES.map(c => [c, 'Yes']));
    rows = rowsOf(sh, CAUSE_COLS).filter(r => String(r['Cause']).trim() !== '');
  }
  return rows;
}
function causesList(user) {
  if (!user) throw new Error('Sign in again');
  const rows = causeRows();
  const out = { ok: true, causes: rows.filter(r => r['Active'] !== 'No').map(r => r['Cause']) };
  if (isManager(user)) out.all = rows.map(r => ({ name: r['Cause'], active: r['Active'] !== 'No' }));
  return out;
}
function causesSave(user, list) {
  if (!isManager(user)) throw new Error('Only a supervisor can change the failure causes');
  if (!Array.isArray(list)) throw new Error('Nothing to save');
  const seen = {}, out = [];
  list.forEach(c => {
    const name = clean(c && c.name, 60);
    if (!name || seen[lc(name)]) return;
    seen[lc(name)] = 1; out.push([name, c.active === false ? 'No' : 'Yes']);
  });
  if (!out.some(r => r[1] === 'Yes')) throw new Error('Keep at least one active failure cause');
  if (out.length > 40) throw new Error('At most 40 failure causes');
  const sh = tasksBook().getSheetByName(CAUSE_TAB);
  const n = Math.max(sh.getLastRow() - 1, out.length);
  const vals = []; for (let i = 0; i < n; i++) vals.push(out[i] || ['', '']);
  sh.getRange(2, 1, n, 2).setNumberFormat('@').setValues(vals);
  return { ok: true, causes: out.filter(r => r[1] === 'Yes').map(r => r[0]) };
}

/* ---------- downtime: an asset goes offline, then back online ---------- */
const stampMs = s => Date.parse(String(s).replace(' ', 'T') + ':00Z');
const minutesBetween = (a, b) => { const d = Math.round((stampMs(b) - stampMs(a)) / 60000); return isFinite(d) && d > 0 ? d : 0; };
function downtimeOut(r) {
  const open = r['Status'] === 'Offline';
  return { id: r['Downtime ID'], no: r['Equipment No'], equipment: r['Equipment'], type: r['Type'], cause: r['Cause'], started: r['Started'],
           ended: r['Ended'], minutes: open ? minutesBetween(r['Started'], nowText()) : (Number(r['Minutes']) || 0), note: r['Note'], order: r['Work Order'],
           startedBy: r['Started By'], endedBy: r['Ended By'], open: open };
}
const downtimeRows = () => rowsOf(tasksBook().getSheetByName(DOWNTIME_TAB), DOWNTIME_COLS).filter(r => r['Downtime ID']);
/** Assets that are offline right now: { "SH-1": { id, since, type, cause } }. */
function offlineMap() {
  const m = {};
  downtimeRows().forEach(r => { if (r['Status'] === 'Offline') m[r['Equipment No']] = { id: r['Downtime ID'], since: r['Started'], type: r['Type'], cause: r['Cause'] }; });
  return m;
}
const assetByNo = no => equipmentList(false).filter(e => e.no && e.no === String(no || '').trim())[0] || null;
/** Who may switch an asset offline / online: supervisors, people with the equipment right, and a technician holding an open work order on it. */
function canLogDowntime(user, eq) {
  if (isManager(user) || canSeeEquipment(user)) return true;
  return readTasks().some(t => lc(t['Assigned To']) === lc(user.username) && (t['Status'] === 'Open' || t['Status'] === 'In progress') &&
    taskTouches(taskOut(t), eq));
}
function downtimeStart(user, f) {
  f = f || {};
  const eq = assetByNo(f.no);
  if (!eq) throw new Error('Choose an asset that has a number');
  if (!canLogDowntime(user, eq)) throw new Error('You do not have permission to change the status of this asset');
  const type = DOWNTIME_TYPES.indexOf(f.type) >= 0 ? f.type : 'Unplanned';
  let cause = clean(f.cause, 60);
  if (type === 'Planned' && !cause) cause = 'Planned maintenance';
  if (!cause) throw new Error('Choose the cause');
  if (!causeRows().some(r => r['Active'] !== 'No' && lc(r['Cause']) === lc(cause))) throw new Error('Choose the cause from the list');
  if (offlineMap()[eq.no]) throw new Error('This asset is already offline');
  const order = clean(f.order, 30);
  if (order && !readTasks().some(t => t['ID'] === order)) throw new Error('Work order not found');
  const rows = downtimeRows();
  const next = rows.reduce((m, r) => Math.max(m, Number(String(r['Downtime ID']).replace(/\D/g, '')) || 0), 0) + 1;
  const id = 'D' + String(next).padStart(4, '0');
  const sh = tasksBook().getSheetByName(DOWNTIME_TAB);
  sh.getRange(sh.getLastRow() + 1, 1, 1, DOWNTIME_COLS.length).setNumberFormat('@')
    .setValues([[id, eq.no, eq.name, type, cause, nowText(), '', '', clean(f.note, 300), order, user.username, '', 'Offline']]);
  return { ok: true, id: id, since: nowText() };
}
function downtimeEnd(user, f) {
  f = f || {};
  const eq = assetByNo(f.no);
  if (!eq) throw new Error('Choose an asset that has a number');
  if (!canLogDowntime(user, eq)) throw new Error('You do not have permission to change the status of this asset');
  const row = downtimeRows().filter(r => r['Equipment No'] === eq.no && r['Status'] === 'Offline')[0];
  if (!row) throw new Error('This asset is not offline');
  const now = nowText(), mins = minutesBetween(row['Started'], now);
  const note = clean(f.note, 300), order = clean(f.order, 30) || row['Work Order'];
  if (order && order !== row['Work Order'] && !readTasks().some(t => t['ID'] === order)) throw new Error('Work order not found');
  const sh = tasksBook().getSheetByName(DOWNTIME_TAB), r = row._row, col = c => DOWNTIME_COLS.indexOf(c) + 1;
  sh.getRange(r, col('Ended')).setNumberFormat('@').setValue(now);
  sh.getRange(r, col('Minutes')).setNumberFormat('@').setValue(String(mins));
  sh.getRange(r, col('Status')).setNumberFormat('@').setValue('Online');
  sh.getRange(r, col('Ended By')).setNumberFormat('@').setValue(user.username);
  if (note) sh.getRange(r, col('Note')).setNumberFormat('@').setValue(row['Note'] ? (row['Note'] + ' → ' + note).slice(0, 300) : note);
  if (order) sh.getRange(r, col('Work Order')).setNumberFormat('@').setValue(order);
  return { ok: true, minutes: mins };
}
/** Downtime of one asset: the open entry, the last 50 entries, and a 90-day summary with the causes ranked by lost minutes. */
function downtimeList(user, no) {
  if (!canSeeEquipment(user)) throw new Error('You do not have access to equipment');
  no = String(no || '').trim();
  const all = downtimeRows().filter(r => r['Equipment No'] === no).reverse().map(downtimeOut)
    .sort((a, b) => String(b.started).localeCompare(String(a.started)));
  const cutoff = Utilities.formatDate(new Date(Date.now() - 90 * 864e5), TZ, 'yyyy-MM-dd');
  const recent = all.filter(d => String(d.started).slice(0, 10) >= cutoff);
  const by = {};
  recent.forEach(d => { const k = d.cause || '—'; by[k] = by[k] || { cause: k, minutes: 0, count: 0 }; by[k].minutes += d.minutes; by[k].count += 1; });
  const closedUnplanned = recent.filter(d => !d.open && d.type === 'Unplanned');
  return { ok: true, open: all.filter(d => d.open)[0] || null, entries: all.slice(0, 50),
    summary: { days: 90, count: recent.length,
      minutes: recent.reduce((a, d) => a + d.minutes, 0),
      unplanned: recent.filter(d => d.type === 'Unplanned').reduce((a, d) => a + d.minutes, 0),
      planned: recent.filter(d => d.type === 'Planned').reduce((a, d) => a + d.minutes, 0),
      avgRepair: closedUnplanned.length ? Math.round(closedUnplanned.reduce((a, d) => a + d.minutes, 0) / closedUnplanned.length) : 0,
      byCause: Object.keys(by).map(k => by[k]).sort((a, b) => b.minutes - a.minutes) } };
}
/** What anybody who scans an asset's QR code may see: its name, whether it is offline, and their own open work orders on it. */
function assetCard(user, no) {
  const eq = assetByNo(no);
  if (!eq) throw new Error('Asset not found');
  const mine = readTasks().filter(t => lc(t['Assigned To']) === lc(user.username) && (t['Status'] === 'Open' || t['Status'] === 'In progress') &&
    taskTouches(taskOut(t), eq))
    .map(t => ({ id: t['ID'], title: t['Title'], status: t['Status'], priority: t['Priority'] || 'Normal', due: t['Due'] }));
  const off = offlineMap()[eq.no] || null;
  return { ok: true, asset: { name: eq.name, no: eq.no, line: eq.line, loc: eq.loc, cat: eq.cat }, offline: off, orders: mine,
           canDowntime: canLogDowntime(user, eq), canOpen: !!(isManager(user) || canSeeEquipment(user)) };
}

/* ---------- condition-based triggers: a reading outside its limit makes one work order ---------- */
function limitOut(r) {
  return { id: r['Limit ID'], page: r['Page'], row: Number(r['Row']), label: r['Label'], min: r['Min'], max: r['Max'], assignee: r['Assign To'],
           priority: r['Priority'] || 'High', active: r['Active'] !== 'No', openTask: r['Open Task'] };
}
function limitRows() { return rowsOf(tasksBook().getSheetByName(LIMIT_TAB), LIMIT_COLS).filter(r => r['Active'] !== 'Deleted'); }
function limitsList(user) {
  if (!isManager(user)) throw new Error('Only a supervisor can see reading limits');
  return { ok: true, limits: limitRows().map(limitOut), assignable: assignable() };
}
function cleanLimit(v) {
  if (v == null || String(v).trim() === '') return '';
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n)) throw new Error('Limits must be numbers');
  return String(n);
}
function limitSave(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can set reading limits');
  f = f || {};
  const sh = tasksBook().getSheetByName(LIMIT_TAB);
  const rows = rowsOf(sh, LIMIT_COLS);
  const write = r => { const row = LIMIT_COLS.map(c => String(r[c] == null ? '' : r[c])); const at = r._row || sh.getLastRow() + 1; sh.getRange(at, 1, 1, row.length).setNumberFormat('@').setValues([row]); r._row = at; };
  if (f.remove) {
    const r = rows.filter(x => x['Limit ID'] === String(f.id) && x['Active'] !== 'Deleted')[0];
    if (!r) throw new Error('Limit not found');
    r['Active'] = 'Deleted'; r['Updated'] = nowText(); write(r);
    return { ok: true };
  }
  if (AUTO_READINGS.indexOf(f.page) < 0) throw new Error('Choose a reading page');
  const row = Number(f.row);
  if (!(row >= RECORD_SHEETS[f.page].dataRow) || !isFinite(row)) throw new Error('Choose a reading row');
  const min = cleanLimit(f.min), max = cleanLimit(f.max);
  if (min === '' && max === '') throw new Error('Enter a minimum, a maximum, or both');
  if (min !== '' && max !== '' && Number(min) > Number(max)) throw new Error('The minimum is higher than the maximum');
  const who = assignable().filter(u => lc(u.username) === lc(f.assignee))[0];
  if (!who) throw new Error('Choose who gets the work order');
  let r = f.id ? rows.filter(x => x['Limit ID'] === String(f.id) && x['Active'] !== 'Deleted')[0] : null;
  if (f.id && !r) throw new Error('Limit not found');
  if (!r) {
    const dup = rows.filter(x => x['Page'] === f.page && Number(x['Row']) === row && x['Active'] !== 'Deleted')[0];
    if (dup) throw new Error('This reading already has a limit — edit it instead');
    const p = props(), seq = Number(p.getProperty('LIMIT_SEQ') || 0) + 1;
    p.setProperty('LIMIT_SEQ', String(seq));
    r = { 'Limit ID': 'LM-' + ('00' + seq).slice(-3), 'Created By': user.username, 'Open Task': '' };
  }
  r['Page'] = f.page; r['Row'] = String(row); r['Label'] = String(f.label || '').slice(0, 120); r['Min'] = min; r['Max'] = max;
  r['Assign To'] = who.username; r['Priority'] = PRIORITIES.indexOf(f.priority) >= 0 ? f.priority : 'High';
  r['Active'] = f.active === false ? 'No' : 'Yes'; r['Updated'] = nowText();
  write(r);
  return { ok: true, limit: limitOut(r) };
}
/** Called after a reading is saved. Makes one work order when it is outside the limit; none while the last one is still open. */
function limitCheck(user, page, row, value, iso) {
  const sh = tasksBook().getSheetByName(LIMIT_TAB);
  if (sh.getLastRow() < 2) return '';
  const rows = rowsOf(sh, LIMIT_COLS);
  const lim = rows.filter(r => r['Page'] === page && Number(r['Row']) === Number(row) && r['Active'] === 'Yes')[0];
  if (!lim) return '';
  const hi = lim['Max'] !== '' && value > Number(lim['Max']), lo = lim['Min'] !== '' && value < Number(lim['Min']);
  if (!hi && !lo) return '';
  const byId = {};
  readTasks().forEach(t => { byId[t['ID']] = t; });
  const cur = byId[lim['Open Task']];
  if (cur && (cur['Status'] === 'Open' || cur['Status'] === 'In progress')) return cur['ID'];
  const users = usersTable();
  let who = users.filter(u => u.active && lc(u.username) === lc(lim['Assign To']))[0]
         || users.filter(u => u.active && u.role === 'Supervisor')[0];
  if (!who) return '';
  const p = props(), seq = Number(p.getProperty('TASK_SEQ') || 0) + 1;
  p.setProperty('TASK_SEQ', String(seq));
  const now = nowText(), label = lim['Label'] || ('row ' + row);
  const t = { 'ID': 'T-' + ('000' + seq).slice(-4), 'Created': now, 'Created By': 'automation', 'Creator Name': 'Automation',
    'Assigned To': who.username, 'Assignee Name': who.name, 'Title': (page + ': ' + label + ' = ' + value).slice(0, 140),
    'Details': 'Reading ' + value + ' is ' + (hi ? 'above the maximum ' + lim['Max'] : 'below the minimum ' + lim['Min']) + ' (' + iso + ', entered by ' + user.name + ').',
    'Equipment': label, 'Priority': PRIORITIES.indexOf(lim['Priority']) >= 0 ? lim['Priority'] : 'High', 'Due': Utilities.formatDate(new Date(Date.now() + 864e5), TZ, 'yyyy-MM-dd'),
    'Link': page, 'Status': 'Open', 'Updated': now, 'Updated By': 'automation', 'Source': 'Limit' };
  writeTask(t);
  history(t['ID'], 'Created', { username: 'automation' }, 'Limit ' + lim['Limit ID']);
  lim['Open Task'] = t['ID'];
  sh.getRange(lim._row, 1, 1, LIMIT_COLS.length).setNumberFormat('@').setValues([LIMIT_COLS.map(c => String(lim[c] == null ? '' : lim[c]))]);
  notifyUser(who.username, { kind: 'assigned', id: t['ID'], title: t['Title'], equipment: label, priority: t['Priority'], by: 'Automation' });
  return t['ID'];
}

/* ---------- preventive maintenance: calendar and compliance (work orders made by a repeat, a meter or a limit) ---------- */
const isPM = t => PM_SOURCES.indexOf(t['Source']) >= 0;
function pmCalendar(user, month) {
  if (!isManager(user)) throw new Error('Only a supervisor can see the PM calendar');
  const m = /^\d{4}-\d{2}$/.test(String(month || '')) ? month : todayIso().slice(0, 7);
  const today = todayIso();
  const tasks = readTasks().filter(t => isPM(t) && t['Due'] && t['Status'] !== 'Cancelled' &&
    (t['Due'].slice(0, 7) === m || ((t['Status'] === 'Open' || t['Status'] === 'In progress') && t['Due'] < today && m === today.slice(0, 7))))
    .map(t => Object.assign(taskOut(t), { overdue: (t['Status'] === 'Open' || t['Status'] === 'In progress') && t['Due'] < today }));
  // planned: period repeats that are not due yet
  const planned = [];
  rulesOf().filter(r => r.Active === 'Yes' && r.Repeat === 'Period' && r.Started).forEach(r => {
    const next = addPeriod(r.Started, autoPeriod(r.Period));
    if (next.slice(0, 7) === m && next >= today) planned.push({ date: next, title: r.Title, equipment: r.Equipment || '', assignees: String(r.Assignees || '').split(',').map(x => x.trim()).filter(Boolean) });
  });
  return { ok: true, month: m, today: today, tasks: tasks.sort((a, b) => String(a.due).localeCompare(String(b.due))), planned: planned };
}
function pmCompliance(user, months) {
  if (!isManager(user)) throw new Error('Only a supervisor can see the PM report');
  const n = Math.min(Math.max(Number(months) || 6, 1), 24);
  const today = todayIso();
  const [ty, tm] = today.split('-').map(Number);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(ty, tm - 1 - i, 1)); keys.push(d.toISOString().slice(0, 7)); }
  const tally = () => ({ due: 0, onTime: 0, late: 0, overdue: 0, pending: 0 });
  const per = {}, eq = {};
  keys.forEach(k => { per[k] = tally(); });
  readTasks().filter(t => isPM(t) && t['Due'] && t['Status'] !== 'Cancelled' && per[t['Due'].slice(0, 7)]).forEach(t => {
    const k = t['Due'].slice(0, 7), name = t['Equipment'] || '—', open = t['Status'] === 'Open' || t['Status'] === 'In progress';
    [per[k], eq[name] || (eq[name] = tally())].forEach(c => {
      if (open) { if (t['Due'] < today) { c.overdue++; c.due++; } else c.pending++; }
      else { c.due++; if (String(t['Done']).slice(0, 10) <= t['Due']) c.onTime++; else c.late++; }
    });
  });
  const pct = c => c.due ? Math.round(100 * c.onTime / c.due) : null;
  return { ok: true,
    months: keys.map(k => Object.assign({ month: k, pct: pct(per[k]) }, per[k])),
    equipment: Object.keys(eq).map(k => Object.assign({ name: k, pct: pct(eq[k]) }, eq[k])).sort((a, b) => (a.pct == null) - (b.pct == null) || a.pct - b.pct || b.due - a.due) };
}

/* ---------- due-date reminders (run by the daily automationCycle) ---------- */
/** One push per task per day to the person who has it: due today or overdue, not yet done. */
function remindDue(today) {
  let n = 0;
  readTasks().forEach(t => {
    if ((t['Status'] !== 'Open' && t['Status'] !== 'In progress') || !t['Due'] || t['Due'] > today || t['Reminded'] === today) return;
    t['Reminded'] = today;
    writeTask(t);
    notifyUser(t['Assigned To'], { kind: 'reminder', id: t['ID'], title: t['Title'], due: t['Due'], overdue: t['Due'] < today });
    n++;
  });
  return n;
}

/* ---------- equipment list ("Equipments and system in Holoul factory") ---------- */

/** "MPR120 (MPR)" — what a technician sees in the task / notification. */
function equipLabel(t) {
  const name = String(t['Equipment'] || ''), no = String(t['Equipment No'] || '');
  return no && no !== name ? name + ' (' + no + ')' : name;
}

/** Every equipment row: { name, no, line, loc, cat }. Columns are found by their header names.
 *  Rows without a name (e.g. AC units) are named from their type and numbered: "Split AC #3". */
function equipmentList(fresh, withDeleted) {
  const cache = CacheService.getScriptCache();
  if (!fresh && !withDeleted) { const hit = cache.get('equip_v1'); if (hit) return JSON.parse(hit); }
  const ss = SpreadsheetApp.openById(props().getProperty('EQUIPMENT_SS_ID') || EQUIPMENT_ID);
  const rows = ss.getSheets()[0].getDataRange().getDisplayValues();
  let hi = rows.findIndex(r => r.some(c => /equipment\s*name/i.test(String(c))));
  if (hi < 0) hi = 0;
  const h = rows[hi].map(c => String(c).trim().toLowerCase());
  const col = re => h.findIndex(c => re.test(c));
  const cName = col(/equipment\s*name|^name$/), cNo = col(/number|serial|^no\b|^pos/), cLine = col(/^line|system/),
        cLoc = col(/^location|^site/), cCat = col(/categor|type/);
  const cStatus = col(/^record\s*status$/), cAuto = col(/^automation\s*task$/);
  const seen = {}, list = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i], g = c => c >= 0 ? String(r[c] == null ? '' : r[c]).trim() : '';
    let name = g(cName), no = g(cNo);
    const line = g(cLine), loc = g(cLoc), cat = g(cCat);
    if (/^-+$/.test(no)) no = '';
    if (!name && !no && !line) continue;
    if (!name) {
      const base = line || cat || 'Equipment', k = base.toLowerCase();
      seen[k] = (seen[k] || 0) + 1;
      name = base + ' #' + seen[k];
    }
    // deleted rows keep their number (so names of unnamed rows do not shift); listed only for editors (withDeleted)
    const deleted = lc(g(cStatus)) === 'deleted';
    if (deleted && !withDeleted) continue;
    list.push({ name: name, no: no, line: line, loc: loc, cat: cat, row: i + 1, deleted: deleted, auto: g(cAuto) });
  }
  if (!withDeleted) { try { cache.put('equip_v1', JSON.stringify(list), EQUIPMENT_CACHE_SECS); } catch (err) {} }
  return list;
}

/* ---------- spare parts (Maintainance Inventory sheet) ---------- */

const SPARES_ID = '1XtqChR5bn9b0MwW4N3Q85oF8WAxLhIJYJkPhdn5vNzw';   // Maintainance Inventory (Script Property SPARES_SS_ID overrides)
const SPARES_ELECT_GID = 816261843;    // "Inventory Elct-Spare parts": # | Part/Item No. | Brand | Description | # Quantity
const SPARES_MECH_GID = 1717920569;    // mechanical tab: Part No. | Part Name | Required Qty | Available Qty | Used Qty | Remaining Qty | Status | Machine
const SPARES_CACHE_SECS = 600;

/** Both spare-part tabs (read by tab id, so renaming a tab does not break it). Cached 10 minutes. */
function sparesList(fresh, withDeleted) {
  const cache = CacheService.getScriptCache();
  if (!fresh && !withDeleted) { const hit = cache.get('spares_v1'); if (hit) return JSON.parse(hit); }
  const ss = SpreadsheetApp.openById(props().getProperty('SPARES_SS_ID') || SPARES_ID);
  const el = ss.getSheetById(SPARES_ELECT_GID), me = ss.getSheetById(SPARES_MECH_GID);
  if (!el || !me) throw new Error('Spare parts tabs not found in the inventory sheet');
  const electrical = [], mechanical = [];
  const ev = el.getDataRange().getDisplayValues();
  const eStat = recordStatusIndex(ev[0] || []);
  ev.slice(1).forEach((r, i) => {
    const no = String(r[1] || '').trim(), desc = String(r[3] || '').trim();
    if (!no && !desc) return;
    const deleted = eStat >= 0 && lc(r[eStat]) === 'deleted';
    if (deleted && !withDeleted) return;
    electrical.push({ row: i + 2, no: no, brand: String(r[2] || '').trim(), desc: desc, qty: String(r[4] || '').trim(), deleted: deleted });
  });
  const mv = me.getDataRange().getDisplayValues();
  const mStat = recordStatusIndex(mv[0] || []);
  mv.slice(1).forEach((r, i) => {
    const no = String(r[0] || '').trim(), name = String(r[1] || '').trim();
    if (!no && !name) return;
    const deleted = mStat >= 0 && lc(r[mStat]) === 'deleted';
    if (deleted && !withDeleted) return;
    mechanical.push({ row: i + 2, no: no, name: name, required: String(r[2] || '').trim(), available: String(r[3] || '').trim(),
      used: String(r[4] || '').trim(), remaining: String(r[5] || '').trim(), status: String(r[6] || '').trim(), machine: String(r[7] || '').trim(), deleted: deleted });
  });
  const out = { electrical: electrical, mechanical: mechanical };
  if (!withDeleted) { try { cache.put('spares_v1', JSON.stringify(out), SPARES_CACHE_SECS); } catch (err) {} }
  return out;
}

/* ---------- equipment maintenance history ---------- */

/** Does a task belong to this equipment row? Same number when both have one, otherwise same name;
 *  when both know the system (line), it must be the same system. */
function taskTouches(t, e) {
  return sameEquipment(t, e) || (t.assets || []).some(a => sameEquipment({ equipment: a.name, equipmentNo: a.no, line: '' }, e));
}
function sameEquipment(t, e) {
  if (e.line && t.line && lc(t.line) !== lc(e.line)) return false;
  if (e.no && t.equipmentNo) return lc(t.equipmentNo) === lc(e.no);
  return lc(t.equipment) === lc(e.name);
}

/** Every task ever recorded on this equipment (all statuses, all dates), with its event timeline. */
function equipmentHistory(user, e) {
  if (!canSeeEquipment(user)) throw new Error('You do not have access to equipment');
  const eq = { name: String(e.name || ''), no: String(e.no || ''), line: String(e.line || ''), loc: String(e.loc || '') };
  const tasks = readTasks().map(taskOut).filter(t => taskTouches(t, eq));
  const ids = {}; tasks.forEach(t => { ids[t.id] = true; t.events = []; });
  const byId = {}; tasks.forEach(t => { byId[t.id] = t; });
  rowsOf(tasksBook().getSheetByName('Task History'), HISTORY_COLS).forEach(h => {
    if (ids[h['Task ID']]) byId[h['Task ID']].events.push({ at: h['Timestamp'], action: h['Action'], by: h['By'], note: h['Note'] });
  });
  tasks.sort((a, b) => String(b.created).localeCompare(String(a.created)));
  return { ok: true, equipment: eq, tasks: tasks };
}

/** Adds job counts and the last finished date to each equipment row (for the Equipment list). */
function equipmentWithStats(list, allTasks) {
  return list.map(e => {
    const mine = allTasks.filter(t => taskTouches(t, e));
    const done = mine.filter(t => t.status === 'Done').map(t => String(t.done).slice(0, 10)).sort();
    return Object.assign({}, e, {
      jobs: mine.length,
      open: mine.filter(t => t.status === 'Open' || t.status === 'In progress').length,
      lastDone: done.length ? done[done.length - 1] : ''
    });
  });
}

/* ---------- dashboard (supervisor / operations manager) ---------- */

function dashboard(user) {
  if (!isManager(user)) throw new Error('Dashboard is for supervisors');
  const today = todayIso();
  const weekAgo = Utilities.formatDate(new Date(Date.now() - 6 * 864e5), TZ, 'yyyy-MM-dd');
  const month = today.slice(0, 7);

  const people = usersTable().filter(u => u.active).map(u => ({ username: u.username, name: u.name, role: u.role, id: u.id }));
  const nameOf = {}; people.forEach(p => { nameOf[lc(p.username)] = p.name; });

  // tasks: everything open + finished / cancelled in the last 60 days
  const since60 = Utilities.formatDate(new Date(Date.now() - 60 * 864e5), TZ, 'yyyy-MM-dd');
  const all = readTasks();
  const tasks = sortTasks(all.filter(t => t['Status'] === 'Open' || t['Status'] === 'In progress' || String(t['Updated']).slice(0, 10) >= since60).map(taskOut));

  // today's reading pages
  const readingsToday = Object.keys(RECORD_SHEETS).map(name => {
    try {
      const d = getSheet(user, name);
      const items = d.rows.filter(r => !r.section);
      return { sheet: name, total: items.length, filled: items.filter(r => r.value !== '').length, completed: d.completed, checkedBy: d.checkedBy || '' };
    } catch (err) { return { sheet: name, error: String(err.message || err) }; }
  });

  // daily checks today + recent faults
  const checks = [], faults = [], checkRows = [];
  let ss = null;
  try { ss = checksBook(); } catch (err) {}
  if (ss) CHECK_TYPES.forEach(type => {
    if (!ss.getSheetByName(type + ' Checklist')) return;
    const units = readUnits(ss, type);
    const log = ss.getSheetByName(type + ' Log');
    const data = log ? log.getDataRange().getDisplayValues() : [[]];
    const h = data[0], c = n => h.indexOf(n);
    const todayRows = {};
    for (let i = 1; i < data.length; i++) {
      const r = data[i], date = r[c('Date')];
      checkRows.push({ type: type, date: date, username: r[c('Username')], status: r[c('Status')] });
      if (date === today) todayRows[r[c('Unit')]] = r;
      if (/^action/i.test(r[c('Status')]) && date >= Utilities.formatDate(new Date(Date.now() - 13 * 864e5), TZ, 'yyyy-MM-dd'))
        faults.push({ type: type, date: date, unit: r[c('Unit')], by: r[c('Operator')], status: r[c('Status')], faults: r[c('Faults')] });
    }
    checks.push({ type: type, units: units.map(u => {
      const r = todayRows[u];
      return r ? { unit: u, status: r[c('Status')], by: r[c('Operator')], at: String(r[c('Timestamp')]).slice(11, 16), faults: r[c('Faults')] }
               : { unit: u, status: '' };
    }) });
  });
  faults.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // Task Log ("Complete task" on reading pages)
  const tl = readings().getSheetByName(LOG_SHEET);
  const logRows = tl && tl.getLastRow() > 1 ? tl.getRange(2, 1, tl.getLastRow() - 1, 9).getDisplayValues()
    .map(r => ({ date: r[1], sheet: r[2], username: r[4] })) : [];

  // workload per person
  const assignees = people.filter(p => ASSIGNABLE_ROLES.indexOf(p.role) >= 0);
  const workload = assignees.map(p => {
    const mine = all.filter(t => lc(t['Assigned To']) === lc(p.username));
    const open = mine.filter(t => t['Status'] === 'Open'), prog = mine.filter(t => t['Status'] === 'In progress');
    return {
      username: p.username, name: p.name, role: p.role,
      open: open.length, inProgress: prog.length,
      overdue: open.concat(prog).filter(t => t['Due'] && t['Due'] < today).length,
      doneWeek: mine.filter(t => t['Status'] === 'Done' && String(t['Done']).slice(0, 10) >= weekAgo).length,
      doneMonth: mine.filter(t => t['Status'] === 'Done' && String(t['Done']).slice(0, 7) === month).length
    };
  });

  // monthly summary: this month + the 11 before, overall and per person
  const months = [];
  const base = isoToDate(today.slice(0, 8) + '15');
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 15, 9));
    months.push(Utilities.formatDate(d, TZ, 'yyyy-MM'));
  }
  const summary = months.map(m => {
    const created = all.filter(t => String(t['Created']).slice(0, 7) === m);
    const done = all.filter(t => t['Status'] === 'Done' && String(t['Done']).slice(0, 7) === m);
    const withDue = done.filter(t => t['Due']);
    const onTime = withDue.filter(t => String(t['Done']).slice(0, 10) <= t['Due']).length;
    const hours = done.map(t => (parseStamp(t['Done']) - parseStamp(t['Created'])) / 36e5).filter(h => h >= 0 && isFinite(h));
    const rl = logRows.filter(r => String(r.date).slice(0, 7) === m);
    const ck = checkRows.filter(r => String(r.date).slice(0, 7) === m);
    const per = {};
    const bump = (u, k) => { u = lc(u); if (!u) return; per[u] = per[u] || { tasksAssigned: 0, tasksDone: 0, readings: 0, checks: 0 }; per[u][k]++; };
    created.forEach(t => bump(t['Assigned To'], 'tasksAssigned'));
    done.forEach(t => bump(t['Assigned To'], 'tasksDone'));
    rl.forEach(r => bump(r.username, 'readings'));
    ck.forEach(r => bump(r.username, 'checks'));
    return { month: m, created: created.length, done: done.length, dueTotal: withDue.length, onTime: onTime,
             avgHours: hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length * 10) / 10 : null,
             readings: rl.length, checks: ck.length, faults: ck.filter(r => /^action/i.test(r.status)).length, people: per };
  });

  let equipment = [], equipmentError = '';
  try { equipment = equipmentWithStats(equipmentList(), all.map(taskOut)); } catch (err) { equipmentError = String(err.message || err); }
  return { ok: true, today: today, generatedAt: nowText(), people: people, assignable: assignees, equipment: equipment, equipmentError: equipmentError,
           tasks: tasks, readings: readingsToday, checks: checks, faults: faults.slice(0, 40), workload: workload, months: summary,
           pendingRequests: requestRows().filter(r => r['Status'] === 'Pending').length,
           pendingPOs: poRows().filter(r => r['Status'] === 'Requested').length };
}
function parseStamp(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4] - 3, +m[5]) : NaN; }

/* ================= Notifications (Web Push, VAPID) =================
 * Phones subscribe in the app; the server sends an empty push (no message body),
 * the app's service worker then asks "pushInbox" what happened and shows the notification. */

const VAPID_SUB = 'mailto:mteam.hrc@gmail.com';

function pushSheet() { return tasksBook().getSheetByName('Push Devices'); }

function pushSubscribe(user, sub, device) {
  const endpoint = String(sub && sub.endpoint || '');
  if (!/^https:\/\//.test(endpoint)) throw new Error('Bad subscription');
  const keys = (sub && sub.keys) || {};
  const sh = pushSheet();
  const rows = rowsOf(sh, PUSH_COLS);
  const same = rows.filter(r => r['Endpoint'] === endpoint)[0];
  const row = [user.username, endpoint, String(keys.p256dh || ''), String(keys.auth || ''), String(device || '').slice(0, 120), nowText(), same ? same['Last OK'] : '', ''];
  sh.getRange(same ? same._row : sh.getLastRow() + 1, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  return { ok: true, devices: rows.filter(r => lc(r['Username']) === lc(user.username) && r['Endpoint'] !== endpoint).length + 1 };
}

function pushUnsubscribe(user, endpoint) {
  const sh = pushSheet();
  const r = rowsOf(sh, PUSH_COLS).filter(x => x['Endpoint'] === String(endpoint || '') && lc(x['Username']) === lc(user.username))[0];
  if (r) sh.deleteRow(r._row);
  return { ok: true };
}

/** Messages waiting for this user's phone (read by the service worker when a push arrives). */
function inboxAdd(username, msg) {
  const cache = CacheService.getScriptCache(), key = 'inbox_' + lc(username);
  let list = [];
  try { list = JSON.parse(cache.get(key) || '[]'); } catch (err) {}
  msg.at = Date.now();
  list.push(msg);
  cache.put(key, JSON.stringify(list.slice(-10)), 6 * 3600);
}
function pushInbox(user) {
  const cache = CacheService.getScriptCache(), key = 'inbox_' + lc(user.username);
  let list = [];
  try { list = JSON.parse(cache.get(key) || '[]'); } catch (err) {}
  cache.remove(key);
  const open = readTasks().filter(t => lc(t['Assigned To']) === lc(user.username) && (t['Status'] === 'Open' || t['Status'] === 'In progress')).length;
  return { ok: true, messages: list, openTasks: open };
}

/** Sends an (empty) push to every phone of `username`. Returns { devices, sent }. Never throws. */
function notifyUser(username, msg) {
  try {
    const sh = pushSheet();
    const subs = rowsOf(sh, PUSH_COLS).filter(r => lc(r['Username']) === lc(username));
    if (!subs.length) return { devices: 0, sent: 0 };        // no phone: they see it in the app
    inboxAdd(username, msg);
    const reqs = subs.map(s => ({
      url: s['Endpoint'], method: 'post', muteHttpExceptions: true, followRedirects: false,
      headers: { Authorization: vapidAuth(s['Endpoint']), TTL: '86400', Urgency: 'high' }
    }));
    const res = UrlFetchApp.fetchAll(reqs);
    let sent = 0;
    const gone = [];
    res.forEach((r, i) => {
      const code = r.getResponseCode(), row = subs[i]._row;
      if (code >= 200 && code < 300) { sent++; sh.getRange(row, 7, 1, 2).setValues([[nowText(), '']]); }
      else if (code === 404 || code === 410) gone.push(row);                       // phone unsubscribed / app removed
      else sh.getRange(row, 8).setValue(nowText() + ' HTTP ' + code + ' ' + String(r.getContentText()).slice(0, 120));
    });
    gone.sort((a, b) => b - a).forEach(row => sh.deleteRow(row));
    return { devices: subs.length - gone.length, sent: sent };
  } catch (err) {
    console.error('notifyUser ' + username + ': ' + err);
    return { devices: 0, sent: 0, error: String(err.message || err) };
  }
}

/** VAPID key pair (P-256), made once and kept in Script Properties. */
function vapidKeys() {
  const p = props();
  let pub = p.getProperty('VAPID_PUBLIC'), priv = p.getProperty('VAPID_PRIVATE');
  if (!pub || !priv) {
    const seed = EC.sha256(EC.str(Utilities.getUuid() + Utilities.getUuid() + Date.now() + Math.random()));
    const d = EC.mod(EC.big(seed), EC.n - BigInt(1)) + BigInt(1);
    priv = EC.b64(EC.bytes(d, 32));
    pub = EC.b64(EC.publicKey(d));
    p.setProperty('VAPID_PRIVATE', priv); p.setProperty('VAPID_PUBLIC', pub);
  }
  return { pub: pub, d: EC.big(EC.unb64(priv)) };
}

/** "Authorization: vapid t=<JWT>, k=<public key>" for a push service (token cached ~5 h). */
function vapidAuth(endpoint) {
  const aud = String(endpoint).match(/^https:\/\/[^\/]+/)[0];
  const keys = vapidKeys();
  const cache = CacheService.getScriptCache(), ck = 'vapid_' + aud;
  let jwt = cache.get(ck);
  if (!jwt) {
    const part = o => EC.b64(EC.str(JSON.stringify(o)));
    const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB });
    jwt = unsigned + '.' + EC.b64(EC.sign(EC.str(unsigned), keys.d));
    cache.put(ck, jwt, 5 * 3600);
  }
  return 'vapid t=' + jwt + ', k=' + keys.pub;
}

/* ---------- P-256 ECDSA (ES256) with deterministic nonce (RFC 6979) ----------
 * Apps Script has no elliptic-curve signing, so it is done here with BigInt. */
const EC = (function () {
  const B = s => BigInt(s);
  const p = B('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
  const n = B('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  const G = [B('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
             B('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')];
  const Z0 = B(0), ONE = B(1), TWO = B(2), THREE = B(3), FOUR = B(4), EIGHT = B(8);
  const mod = (x, m) => { const r = x % m; return r < Z0 ? r + m : r; };
  function pow(b, e, m) { let r = ONE; b = mod(b, m); while (e > Z0) { if (e & ONE) r = r * b % m; b = b * b % m; e >>= ONE; } return r; }
  const inv = (x, m) => pow(mod(x, m), m - TWO, m);
  // Jacobian coordinates [X, Y, Z]; Z = 0 is the point at infinity
  function dbl(P) {
    const X = P[0], Y = P[1], Z = P[2];
    if (Y === Z0 || Z === Z0) return [Z0, ONE, Z0];
    const delta = Z * Z % p, gamma = Y * Y % p, beta = X * gamma % p;
    const alpha = THREE * mod(X - delta, p) % p * ((X + delta) % p) % p;
    const X3 = mod(alpha * alpha - EIGHT * beta, p);
    const Z3 = mod((Y + Z) * (Y + Z) - gamma - delta, p);
    const Y3 = mod(alpha * mod(FOUR * beta - X3, p) - EIGHT * (gamma * gamma % p), p);
    return [X3, Y3, Z3];
  }
  function add(P, Q) {
    if (P[2] === Z0) return Q;
    if (Q[2] === Z0) return P;
    const Z1Z1 = P[2] * P[2] % p, Z2Z2 = Q[2] * Q[2] % p;
    const U1 = P[0] * Z2Z2 % p, U2 = Q[0] * Z1Z1 % p;
    const S1 = P[1] * Q[2] % p * Z2Z2 % p, S2 = Q[1] * P[2] % p * Z1Z1 % p;
    if (U1 === U2) return S1 === S2 ? dbl(P) : [Z0, ONE, Z0];
    const H = mod(U2 - U1, p), I = TWO * H % p * (TWO * H % p) % p, J = H * I % p;
    const r = TWO * mod(S2 - S1, p) % p, V = U1 * I % p;
    const X3 = mod(r * r - J - TWO * V, p);
    const Y3 = mod(r * mod(V - X3, p) - TWO * S1 * J, p);
    const Z3 = mod(((P[2] + Q[2]) * (P[2] + Q[2]) - Z1Z1 - Z2Z2) % p * H, p);
    return [X3, Y3, Z3];
  }
  function mul(k, A) {
    let R = [Z0, ONE, Z0];
    const Q = [A[0], A[1], ONE];
    const bits = k.toString(2);
    for (let i = 0; i < bits.length; i++) { R = dbl(R); if (bits[i] === '1') R = add(R, Q); }
    if (R[2] === Z0) throw new Error('point at infinity');
    const zi = inv(R[2], p), zi2 = zi * zi % p;
    return [R[0] * zi2 % p, R[1] * zi2 % p * zi % p];
  }
  // bytes are plain numbers 0..255 here; Apps Script's own byte arrays are signed (-128..127)
  const u8 = a => Array.prototype.map.call(a, x => x & 255);
  const s8 = a => a.map(x => x > 127 ? x - 256 : x);
  const big = a => { let x = Z0; for (let i = 0; i < a.length; i++) x = (x << EIGHT) + B(a[i]); return x; };
  const bytes = (x, len) => { const out = new Array(len).fill(0); for (let i = len - 1; i >= 0; i--) { out[i] = Number(x & B(255)); x >>= EIGHT; } return out; };
  const str = s => u8(Utilities.newBlob(String(s)).getBytes());
  const sha256 = a => u8(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s8(a)));
  const hmac = (key, data) => u8(Utilities.computeHmacSha256Signature(s8(data), s8(key)));
  const b64 = a => Utilities.base64EncodeWebSafe(s8(a)).replace(/=+$/, '');
  const unb64 = s => { s = String(s); while (s.length % 4) s += '='; return u8(Utilities.base64DecodeWebSafe(s)); };
  function publicKey(d) { const Q = mul(d, G); return [4].concat(bytes(Q[0], 32), bytes(Q[1], 32)); }
  /** 64-byte r||s signature of msg (bytes) with private key d (BigInt). */
  function sign(msg, d) {
    const h1 = sha256(msg), z = mod(big(h1), n);
    const x = bytes(d, 32), hz = bytes(z, 32);
    let V = new Array(32).fill(1), K = new Array(32).fill(0);
    K = hmac(K, V.concat([0], x, hz)); V = hmac(K, V);
    K = hmac(K, V.concat([1], x, hz)); V = hmac(K, V);
    for (let guard = 0; guard < 100; guard++) {
      V = hmac(K, V);
      const k = big(V);
      if (k > Z0 && k < n) {
        const r = mod(mul(k, G)[0], n);
        const s = mod(inv(k, n) * mod(z + r * d, n), n);
        if (r !== Z0 && s !== Z0) return bytes(r, 32).concat(bytes(s, 32));
      }
      K = hmac(K, V.concat([0])); V = hmac(K, V);
    }
    throw new Error('signing failed');
  }
  /** Checks a signature (used by the self-test). */
  function verify(msg, sig, pub) {
    const r = big(sig.slice(0, 32)), s = big(sig.slice(32)), z = mod(big(sha256(msg)), n);
    if (r <= Z0 || r >= n || s <= Z0 || s >= n) return false;
    const w = inv(s, n), Q = [big(pub.slice(1, 33)), big(pub.slice(33))];
    const A = mul(mod(z * w, n), G), Bp = mul(mod(r * w, n), Q);
    const S = add([A[0], A[1], ONE], [Bp[0], Bp[1], ONE]);
    const zi = inv(S[2], p);
    return mod(S[0] * zi % p * zi, p) % n === r;
  }
  return { n: n, mod: mod, big: big, bytes: bytes, str: str, sha256: sha256, b64: b64, unb64: unb64, publicKey: publicKey, sign: sign, verify: verify };
})();

/* ================= One-time: v7 setup (tasks, roles, notifications) =================
 * Run once from the editor (Run > setupV7). Google asks to allow "Connect to an external
 * service" — needed to send notifications. Safe to run again. */
function setupV7() {
  // 1. roles in the Users sheet (+ access formulas)
  setupSheet();
  // 2. tasks spreadsheet
  const ss = tasksBook();
  Logger.log('Tasks spreadsheet: %s', ss.getUrl());
  // 3. notification keys + self-test of the signature code
  const keys = vapidKeys();
  const msg = EC.str('holoul self-test ' + Date.now());
  const sig = EC.sign(msg, keys.d);
  if (!EC.verify(msg, sig, EC.unb64(keys.pub))) throw new Error('Signature self-test failed');
  // fixed test vector (same result as Node.js crypto)
  const tv = EC.sign(EC.str('holoul-test-vector'), EC.big(EC.sha256(EC.str('holoul-test-key'))));
  Logger.log('Test vector: %s', EC.b64(tv));
  Logger.log('Public key: %s', keys.pub);
  // 4. touches the network once so Google asks for the permission now
  UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  Logger.log('v7 ready.');
}

/* ================= v10: employees, equipment and spare parts from the app =================
 * Supervisors and Operations Managers can do everything here. Other employees get the
 * extra rights set on their row in the Users sheet (columns M–O, Yes / No):
 *   Create tasks  -> create tasks (Tasks tab)
 *   Edit equipment -> add / edit / delete equipment (+ its photos)
 *   Edit spare parts -> add / edit / delete spare parts (+ their photos)
 * Equipment and spare parts stay in their original sheets. Deleting is soft: the row gets
 * Record Status = Deleted (a column added at the end of the tab) and is hidden from the app.
 * Photos are kept in Drive: Photos/Equipment/<key> and Photos/Spares/<key> with
 * main.jpg (required for a new item), extra-1.jpg and extra-2.jpg (optional). */

const EMPLOYEE_ROLES = TECH_ROLES.concat(Object.keys(ROLE_EQUIPMENT), MANAGER_ROLE_NAMES);
const EMPLOYEE_EQUIPMENT = ['Forklift', 'Bobcat'];
const ITEM_FILES = { main: 'main.jpg', extra1: 'extra-1.jpg', extra2: 'extra-2.jpg' };
const USER_HEAD = { id: 'User ID', name: 'Full Name', role: 'Role', equipment: 'Assigned Equipment', user: 'Username', pin: 'PIN', active: 'Active' };
const PERM_KEYS = [['tasks', 'Create tasks'], ['equipment', 'Edit equipment'], ['spares', 'Edit spare parts']];
const EQUIP_SPEC = { loc: /^location/, line: /^line/, name: /equipment\s*name/, no: /number|serial/, cat: /categor/ };
const SPARE_E_SPEC = { no: /part|item/, brand: /brand/, desc: /description/, qty: /quantity/ };
const SPARE_M_SPEC = { no: /^part no/, name: /^part name/, required: /required/, available: /available/, used: /^used/, remaining: /remaining/, status: /^status$/, machine: /machine/ };

const clean = (s, max) => String(s == null ? '' : s).trim().slice(0, max || 200);
const colLetter = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const safeKey = s => clean(s, 80).replace(/[\\\/:*?"<>|#%{}~&\[\]]+/g, '-').replace(/\s+/g, ' ').replace(/^[-.\s]+|[-.\s]+$/g, '') || 'item';
const canEditEquipment = u => !!u && !!u.perms && !!u.perms.equipment;
const canEditSpares = u => !!u && !!u.perms && !!u.perms.spares;

/** A number from a cell ('' when empty). Text is refused. */
function numCell(v, label) {
  const s = clean(v, 20).replace(/,/g, '');
  if (s === '') return '';
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(label + ' must be a number');
  return Number(s);
}

/** Column numbers (1-based) found by header name. Record Status is added at the end when missing. */
function findCols(sh, spec, addStatus) {
  const last = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, last).getDisplayValues()[0].map(h => lc(h));
  const out = {};
  Object.keys(spec).forEach(k => {
    const i = head.findIndex(h => spec[k].test(h));
    if (i < 0) throw new Error('The sheet is missing the column for ' + k);
    out[k] = i + 1;
  });
  const r = head.indexOf('record status');
  if (r >= 0) out.rec = r + 1;
  else if (addStatus) {
    out.rec = last + 1;
    sh.getRange(1, out.rec).setValue('Record Status').setFontWeight('bold');
  }
  return out;
}

function checkRow(sh, row) {
  const r = Number(row);
  if (!(r >= 2) || r > sh.getLastRow()) throw new Error('Row not found — reload the list and try again');
  return r;
}

/* ---- photos (Drive) ---- */

/** Validates a data: image and returns its bytes. Throws before anything is written. */
function photoBlob(dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw new Error('Not an image');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Photo is too large (8 MB max)');
  return { bytes: bytes, mime: m[1] };
}

/** Folder for one item: Photos/Equipment/<key> or Photos/Spares/<key>. */
function itemFolder(kind, key, create) {
  const root = DriveApp.getFolderById(props().getProperty('PHOTOS_FOLDER_ID'));
  const typeName = kind === 'equipment' ? 'Equipment' : 'Spares';
  const ti = root.getFoldersByName(typeName);
  const type = ti.hasNext() ? ti.next() : (create ? root.createFolder(typeName) : null);
  if (!type) return null;
  const ki = type.getFoldersByName(key);
  if (ki.hasNext()) return ki.next();
  return create ? type.createFolder(key) : null;
}

/** The item's number changed: keep its photos by renaming the folder. */
function renameItemFolder(kind, oldKey, newKey) {
  const old = itemFolder(kind, oldKey, false);
  if (!old || itemFolder(kind, newKey, false)) return;
  old.setName(newKey);
}

/** Replaces one slot (main / extra1 / extra2) of an item's photos. */
function saveItemPhoto(kind, key, slot, photo) {
  const folder = itemFolder(kind, key, true);
  const name = ITEM_FILES[slot];
  const old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(Utilities.newBlob(photo.bytes, photo.mime, name));
}

function itemAccess(user, kind, write) {
  const ok = kind === 'equipment'
    ? (write ? canEditEquipment(user) : canSeeEquipment(user))
    : (write ? canEditSpares(user) : canSeeSpares(user));
  if (!ok) throw new Error('You do not have permission for this');
}

/** Photos of one item: { main, extra1, extra2 } with a small thumbnail each. */
function itemPhotos(user, kind, key) {
  if (kind !== 'equipment' && kind !== 'spare') throw new Error('Unknown item type');
  itemAccess(user, kind, false);
  const folder = itemFolder(kind, safeKey(key), false);
  const out = {};
  if (folder) Object.keys(ITEM_FILES).forEach(slot => {
    const it = folder.getFilesByName(ITEM_FILES[slot]);
    if (!it.hasNext()) return;
    const f = it.next();
    let thumb = '';
    try { const b = f.getThumbnail(); if (b) thumb = 'data:image/png;base64,' + Utilities.base64Encode(b.getBytes()); } catch (err) {}
    out[slot] = { id: f.getId(), url: f.getUrl(), thumb: thumb };
  });
  return { ok: true, photos: out };
}

function itemPhotoSave(user, kind, key, slot, dataUrl) {
  if (kind !== 'equipment' && kind !== 'spare') throw new Error('Unknown item type');
  if (!ITEM_FILES[slot]) throw new Error('Unknown photo slot');
  itemAccess(user, kind, true);
  const photo = photoBlob(dataUrl);
  saveItemPhoto(kind, safeKey(key), slot, photo);
  return { ok: true };
}

/* ---- employees (Users sheet) ---- */

/** Users sheet columns. Creates "Create tasks", "Edit equipment", "Edit spare parts" in M–O on first use,
 *  with Yes / No choices; blank flags are filled once (managers Yes, others No). */
function userCols(sh) {
  const last = Math.max(sh.getLastColumn(), 12);
  const head = sh.getRange(1, 1, 1, last).getDisplayValues()[0].map(h => lc(h));
  const cols = {};
  Object.keys(USER_HEAD).forEach(k => {
    const i = head.indexOf(lc(USER_HEAD[k]));
    if (i < 0) throw new Error('Users sheet is missing the column: ' + USER_HEAD[k]);
    cols[k] = i + 1;
  });
  PERM_KEYS.forEach(([k, label], j) => {
    const i = head.indexOf(lc(label));
    if (i >= 0) { cols['perm.' + k] = i + 1; return; }
    const c = 13 + j;   // M, N, O
    if (sh.getRange(1, c).getDisplayValue() !== '') throw new Error('Users sheet: column ' + colLetter(c) + ' is already used. Move it and try again.');
    sh.getRange(1, c).setValue(label).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff').setWrap(true);
    sh.setColumnWidth(c, 95);
    cols['perm.' + k] = c;
  });
  const n = 499;
  const roles = sh.getRange(2, cols.role, n, 1).getDisplayValues();
  const users = sh.getRange(2, cols.user, n, 1).getDisplayValues();
  PERM_KEYS.forEach(([k]) => {
    const rng = sh.getRange(2, cols['perm.' + k], n, 1);
    rng.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).setAllowInvalid(false).build());
    rng.setHorizontalAlignment('center');
    const cur = rng.getDisplayValues();
    let changed = false;
    const out = cur.map((r, i) => {
      if (String(r[0]).trim() !== '' || String(users[i][0]).trim() === '') return r;
      changed = true;
      return [MANAGER_ROLES.indexOf(String(roles[i][0]).trim()) >= 0 ? 'Yes' : 'No'];
    });
    if (changed) rng.setValues(out);
  });
  return cols;
}

function employeesList(user) {
  if (!isManager(user)) throw new Error('Only a supervisor can see the team list');
  userCols(book().getSheetByName(USERS_SHEET));
  CacheService.getScriptCache().remove('users_v1');
  const list = usersTable(true).map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role,
    equipment: u.equipment || '', active: !!u.active, perms: { tasks: !!u.canTasks, equipment: !!u.canEquipment, spares: !!u.canSpares } }));
  return { ok: true, roles: EMPLOYEE_ROLES, equipment: EMPLOYEE_EQUIPMENT, employees: list };
}

/** Adds or updates one employee. A blank PIN on an existing employee keeps the current PIN. */
function employeeSave(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can manage employees');
  f = f || {};
  const sh = book().getSheetByName(USERS_SHEET);
  const cols = userCols(sh);
  const name = clean(f.name, 80);
  if (!name) throw new Error('Enter the full name');
  const username = clean(f.username, 30);
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) throw new Error('Username: 3 to 30 letters, digits, dot, dash or underscore');
  const role = clean(f.role, 60);
  if (EMPLOYEE_ROLES.indexOf(role) < 0) throw new Error('Choose a valid role');
  const equipment = roleEquipment(role);
  const pin = clean(f.pin, 8);
  const isNew = !f.id;
  if ((isNew || pin !== '') && !/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4 to 8 digits');
  const active = f.active !== false;
  const perms = f.perms || {};

  const data = sh.getRange(1, 1, Math.max(sh.getLastRow(), 2), sh.getLastColumn()).getDisplayValues();
  let row = -1, prevNum = 0, dupRow = -1, freeRow = -1;
  for (let i = 1; i < data.length; i++) {
    const r = data[i], id = String(r[cols.id - 1]).trim(), un = lc(r[cols.user - 1]);
    prevNum = Math.max(prevNum, Number(id.replace(/\D/g, '')) || 0);
    if (!isNew && id === String(f.id)) row = i + 1;
    if (un && un === lc(username)) dupRow = i + 1;
    if (!un && freeRow < 0) freeRow = i + 1;
  }
  if (dupRow > 0 && dupRow !== row) throw new Error('This username is already used');
  if (!isNew && row < 0) throw new Error('Employee not found — reload the list');
  if (!isNew && lc(username) === lc(user.username) && (!active || role !== user.role)) throw new Error('You cannot deactivate yourself or change your own role');
  if (isNew) row = freeRow > 0 ? freeRow : data.length + 1;

  const put = (c, v) => {
    try { sh.getRange(row, c).setValue(v); }
    catch (err) {
      if (/data validation/i.test(String(err && err.message))) throw new Error('The Users sheet does not accept this value. Check the Role list in the sheet.');
      throw err;
    }
  };
  if (isNew) put(cols.id, 'U' + String(prevNum + 1).padStart(3, '0'));
  put(cols.name, name); put(cols.role, role); put(cols.equipment, equipment); put(cols.user, username);
  if (pin) { sh.getRange(row, cols.pin).setNumberFormat('@'); put(cols.pin, pin); }
  put(cols.active, active ? 'Yes' : 'No');
  put(cols['perm.tasks'], perms.tasks ? 'Yes' : 'No');
  put(cols['perm.equipment'], perms.equipment ? 'Yes' : 'No');
  put(cols['perm.spares'], perms.spares ? 'Yes' : 'No');
  CacheService.getScriptCache().remove('users_v1');
  return { ok: true, id: String(sh.getRange(row, cols.id).getDisplayValue()), row: row };
}

/* ---- equipment (original "Equipments and system in Holoul factory" sheet) ---- */

const equipSheet = () => SpreadsheetApp.openById(props().getProperty('EQUIPMENT_SS_ID') || EQUIPMENT_ID).getSheets()[0];
const equipmentKey = (no, name) => safeKey(no && !/^-+$/.test(no) ? no : name);

function equipmentSave(user, f) {
  if (!canEditEquipment(user)) throw new Error('You do not have permission to change equipment');
  f = f || {};
  const sh = equipSheet();
  const cols = findCols(sh, EQUIP_SPEC, true);
  const isNew = !f.row;
  const name = clean(f.name, 120), line = clean(f.line, 80), no = clean(f.no, 60).replace(/^-+$/, '');
  const loc = clean(f.location, 40), cat = clean(f.category, 80);
  if (!name) throw new Error('Enter the equipment name');
  if (!line) throw new Error('Choose the line / system');
  const photo = f.photo ? photoBlob(f.photo) : null;
  if (isNew && !photo) throw new Error('Add a main photo for the new equipment');
  // automation rule: only a supervisor sets it; undefined = leave as it is, null/empty = no automation
  if (f.auto !== undefined && !isManager(user)) throw new Error('Only a supervisor can set the automation task');
  const auto = f.auto === undefined ? undefined : autoFromForm(f.auto);
  const row = isNew ? sh.getLastRow() + 1 : checkRow(sh, f.row);
  let oldKey = '';
  if (!isNew) {
    const cur = sh.getRange(row, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    oldKey = equipmentKey(String(cur[cols.no - 1] || '').trim(), String(cur[cols.name - 1] || '').trim());
  }
  const newKey = equipmentKey(no, name);
  const put = (c, v) => sh.getRange(row, c).setValue(v);
  put(cols.loc, loc); put(cols.line, line); put(cols.name, name); put(cols.no, no); put(cols.cat, cat);
  if (isNew) put(cols.rec, 'Active');
  if (auto !== undefined) put(autoColumn(sh), auto);
  if (oldKey && oldKey !== newKey) renameItemFolder('equipment', oldKey, newKey);
  if (photo) saveItemPhoto('equipment', newKey, 'main', photo);
  CacheService.getScriptCache().remove('equip_v1');
  return { ok: true, row: row, key: newKey, auto: auto };
}

/** Soft delete (status Deleted) or restore (status Active). */
function equipmentStatus(user, row, status) {
  if (!canEditEquipment(user)) throw new Error('You do not have permission to change equipment');
  if (status !== 'Active' && status !== 'Deleted') throw new Error('Unknown status');
  const sh = equipSheet();
  const cols = findCols(sh, EQUIP_SPEC, true);
  sh.getRange(checkRow(sh, row), cols.rec).setValue(status);
  CacheService.getScriptCache().remove('equip_v1');
  return { ok: true };
}

/* ---- automation: reading tasks created on a schedule ----
 * Equipment sheet column "Automation task" holds one rule, written as:
 *   "Amp Rec | Monthly | AbuBakar, Zahid"      (every period: Weekly, Monthly, Quarterly, Semi-annual, Yearly)
 *   "Vibration Rec | 500 h | Hassan Zaga"       (every 500 running hours from the daily-check hour meter)
 * automationCycle() runs once a day (installAutomationTrigger) and creates one task per assignee when a rule is due.
 * Progress is kept in the "Automation Log" tab of the Maintenance Tasks book. Readings are still saved in the reading sheets. */

const AUTO_COL = 'Automation task';
const AUTO_LOG = 'Automation Log';
const AUTO_LOG_COLS = ['Key', 'Equipment', 'Equipment No', 'Reading', 'Rule', 'Started', 'Hours At Start', 'Open Tasks', 'Updated'];
const AUTO_READINGS = ['Amp Rec', 'Vibration Rec', 'Thermo Rec'];
const AUTO_PERIODS = [
  { label: 'Weekly', key: 'weekly', days: 7 }, { label: 'Monthly', key: 'monthly', months: 1 },
  { label: 'Quarterly', key: 'quarterly', months: 3 }, { label: 'Semi-annual', key: 'semiannual', months: 6 },
  { label: 'Yearly', key: 'yearly', months: 12 }
];
const autoPeriod = v => AUTO_PERIODS.filter(p => p.key === v || p.label === v)[0] || null;

/** Column number of "Automation task" on the equipment sheet. Adds the header at the end when missing. */
function autoColumn(sh) {
  const last = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, last).getDisplayValues()[0].map(h => lc(h));
  const i = head.indexOf(lc(AUTO_COL));
  if (i >= 0) return i + 1;
  sh.getRange(1, last + 1).setValue(AUTO_COL).setFontWeight('bold');
  return last + 1;
}

/** Validates the form values and returns the rule text ('' = no automation). Throws on anything unclear. */
function autoFromForm(a) {
  if (!a || !a.reading) return '';
  const reading = clean(a.reading, 20);
  if (AUTO_READINGS.indexOf(reading) < 0) throw new Error('Choose a valid reading for the automation task');
  const eligible = usersTable().filter(u => u.active && TECH_ROLES.indexOf(u.role) >= 0 && accessFor(u.role).indexOf(reading) >= 0);
  const people = [];
  [].concat(a.assignees || []).forEach(n => {
    const u = eligible.filter(x => lc(x.username) === lc(n))[0];
    if (!u) throw new Error('Choose technicians who record ' + reading);
    if (people.indexOf(u.username) < 0) people.push(u.username);
  });
  if (!people.length) throw new Error('Choose who does the task');
  let label;
  if (a.basis === 'hours') {
    const h = Math.round(Number(a.hours));
    if (!(h >= 1 && h <= 100000)) throw new Error('Enter the running hours between 1 and 100000');
    label = h + ' h';
  } else {
    const p = autoPeriod(a.period);
    if (!p) throw new Error('Choose how often the task repeats');
    label = p.label;
  }
  return reading + ' | ' + label + ' | ' + people.join(', ');
}

/** Reads a rule from the sheet. Null when empty or not understood (such rows are skipped, never guessed). */
function parseAuto(s) {
  const parts = String(s || '').split('|').map(x => x.trim());
  if (parts.length < 3 || AUTO_READINGS.indexOf(parts[0]) < 0) return null;
  const people = parts.slice(2).join('|').split(',').map(x => x.trim()).filter(Boolean);
  const h = parts[1].match(/^(\d+) h$/);
  if (h && Number(h[1]) >= 1) return { reading: parts[0], basis: 'hours', hours: Number(h[1]), label: parts[1], people: people };
  const p = autoPeriod(parts[1]);
  if (!p) return null;
  return { reading: parts[0], basis: 'period', period: p, label: p.label, people: people };
}

/** The day (yyyy-MM-dd) a period rule falls due again, counted from the day it last ran. */
function addPeriod(day, p) {
  const [y, m, d] = day.split('-').map(Number);
  if (p.days) return new Date(Date.UTC(y, m - 1, d + p.days)).toISOString().slice(0, 10);
  const mm = m - 1 + p.months;
  const last = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();   // 31 Jan + 1 month = 28/29 Feb, not 3 Mar
  return new Date(Date.UTC(y, mm, Math.min(d, last))).toISOString().slice(0, 10);
}

/** Latest hour-meter reading for a unit: the newest of the daily check logs ("Hour Meter Reading") and the
 *  manual "Meter Readings" tab. Null when none. */
function latestHourMeter(unit) {
  const u = String(unit || '').trim();
  if (!u) return null;
  let best = null, bestTs = '';
  const take = (ts, raw) => {
    const v = Number(String(raw).replace(',', '.'));
    if (String(raw).trim() === '' || !isFinite(v)) return;
    if (best === null || String(ts) >= bestTs) { best = v; bestTs = String(ts); }
  };
  let sheets = [];
  try { sheets = checksBook().getSheets(); } catch (err) { sheets = []; }   // daily checks not set up yet
  sheets.forEach(sh => {
    if (!/ Log$/.test(sh.getName())) return;
    const data = sh.getDataRange().getDisplayValues();
    if (data.length < 2) return;
    const h = data[0].map(String);
    const cU = h.indexOf('Unit'), cH = h.indexOf('Hour Meter Reading'), cT = h.indexOf('Timestamp');
    if (cU < 0 || cH < 0) return;
    for (let i = 1; i < data.length; i++) if (String(data[i][cU]).trim() === u) take(cT >= 0 ? data[i][cT] : '', data[i][cH]);
  });
  try {
    rowsOf(tasksBook().getSheetByName(METER_TAB), METER_COLS).forEach(r => { if (String(r['Equipment No']).trim() === u && isHoursName(r['Meter'])) take(r['Timestamp'], r['Reading']); });
  } catch (err) {}
  return best;
}

const autoLogSheet = () => tasksBook().getSheetByName(AUTO_LOG);
function autoLogSave(row) {
  const sh = autoLogSheet();
  const values = AUTO_LOG_COLS.map(c => row[c] == null ? '' : String(row[c]));
  const r = row._row || sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, values.length).setNumberFormat('@').setValues([values]);
  row._row = r;
}

/** One reading task for one assignee. Returns the task ID. */
function createAutoTask(eq, rule, who, today) {
  const p = props();
  const seq = Number(p.getProperty('TASK_SEQ') || 0) + 1;
  p.setProperty('TASK_SEQ', String(seq));
  const now = nowText();
  const t = {
    'ID': 'T-' + ('000' + seq).slice(-4), 'Created': now, 'Created By': 'automation', 'Creator Name': 'Automation',
    'Assigned To': who.username, 'Assignee Name': who.name,
    'Title': rule.reading + ' reading: ' + eq.name,
    'Details': 'Scheduled automatically (' + rule.label + '). Record the reading in the ' + rule.reading + ' sheet.',
    'Equipment': eq.name, 'Priority': 'Normal', 'Due': addPeriod(today, { days: 7 }), 'Link': rule.reading, 'Status': 'Open',
    'Updated': now, 'Updated By': 'automation',
    'Equipment No': eq.no || '', 'Line': eq.line || '', 'Location': eq.loc || '', 'Source': rule.basis === 'hours' ? 'Meter' : 'Repeat'
  };
  writeTask(t);
  history(t['ID'], 'Created', { username: 'automation' }, 'Scheduled: ' + rule.label);
  notifyUser(who.username, { kind: 'assigned', id: t['ID'], title: t['Title'], equipment: equipLabel(t), priority: 'Normal', by: 'Automation' });
  return t['ID'];
}

/** Creates every reading task that is due. Runs once a day from the trigger; safe to run by hand from the editor. */
function automationCycle() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) return { ok: false, busy: true };
  try {
    const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    const rules = equipmentList(true).filter(e => !e.deleted && parseAuto(e.auto));
    const users = usersTable(true);   // fresh: a deactivated technician gets no new task on the next run
    const byKey = {};
    rowsOf(autoLogSheet(), AUTO_LOG_COLS).forEach(l => { byKey[l.Key] = l; });
    const taskById = {};
    readTasks().forEach(t => { taskById[t['ID']] = t; });
    const created = [];
    const errors = [];
    rules.forEach(eq => { try {
      const rule = parseAuto(eq.auto);
      const key = equipmentKey(eq.no, eq.name) + '|' + rule.reading;
      const log = byKey[key] || { Key: key, Equipment: eq.name, 'Equipment No': eq.no, Reading: rule.reading, Rule: '', Started: '', 'Hours At Start': '', 'Open Tasks': '', Updated: '' };
      byKey[key] = log;
      // a changed rule starts again from now (tasks already open stay tracked)
      if (log.Rule !== eq.auto) { log.Rule = eq.auto; log.Started = ''; log['Hours At Start'] = ''; }
      log['Equipment No'] = eq.no; log.Equipment = eq.name;
      // open tasks of this rule: while any is still open, no new one is made
      const open = String(log['Open Tasks'] || '').split(',').map(s => s.trim())
        .filter(id => id && taskById[id] && (taskById[id]['Status'] === 'Open' || taskById[id]['Status'] === 'In progress'));
      log['Open Tasks'] = open.join(',');
      let due = false, hours = null;
      if (rule.basis === 'period') {
        due = !log.Started || today >= addPeriod(log.Started, rule.period);
      } else {
        hours = latestHourMeter(eq.no);
        if (hours !== null) {
          // first reading seen, or the meter went back (replaced): the count starts from this reading
          if (log['Hours At Start'] === '' || hours < Number(log['Hours At Start'])) { log['Hours At Start'] = hours; log.Started = today; }
          else due = hours - Number(log['Hours At Start']) >= rule.hours;
        }
      }
      if (due && !open.length) {
        const ids = [];
        rule.people.forEach(name => {
          const who = users.filter(u => u.active && lc(u.username) === lc(name))[0];
          if (who) ids.push(createAutoTask(eq, rule, who, today));
        });
        if (ids.length) {
          log['Open Tasks'] = ids.join(',');
          log.Started = today;
          if (rule.basis === 'hours') log['Hours At Start'] = hours;
          created.push.apply(created, ids);
        }
      }
      log.Updated = nowText();
      autoLogSave(log);
    } catch (err) { errors.push(eq.name + ': ' + err.message); } });   // one bad rule does not stop the others
    taskRulesRun(today, created, errors);   // repeating tasks (any task), same run
    let reminded = 0;
    try { reminded = remindDue(today); } catch (err) { errors.push('reminders: ' + err.message); }
    let weekly = 0;
    try { weekly = weeklyReports(today); } catch (err) { errors.push('weekly report: ' + err.message); }
    let lowStock = 0;
    try { lowStock = lowStockSweep().length; } catch (err) { errors.push('low stock: ' + err.message); }
    return { ok: !errors.length, rules: rules.length, created: created, errors: errors, reminded: reminded, lowStock: lowStock, weeklyReports: weekly };
  } finally { lock.releaseLock(); }
}

/** Installs the daily trigger (06:00, the script time zone) and removes older copies. Run once from the editor. */
function installAutomationTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'automationCycle') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('automationCycle').timeBased().everyDays(1).atHour(6).create();
  return { ok: true, note: 'automationCycle runs every day at 06:00 (script time zone)' };
}

/* ---- repeating tasks: any task can repeat by period or running hours (supervisor only) ----
 * Sheet "Task Automation" in the Maintenance Tasks book: one row per repeat. The first task(s) are made when
 * the repeat is saved; later ones by the same daily automationCycle as the reading tasks. While any task of a
 * repeat is still Open or In progress, no new one is made for it. Stop / resume never deletes tasks. */
const RULE_TAB = 'Task Automation';
const RULE_COLS = ['Rule ID', 'Created', 'Created By', 'Title', 'Details', 'Priority', 'Equipment', 'Equipment No', 'Line', 'Location',
                   'Link', 'Assignees', 'Repeat', 'Period', 'Hours', 'Due Days', 'Active', 'Started', 'Hours At Start', 'Open Tasks', 'Updated'];
const DEFAULT_DUE_DAYS = 7;

const ruleSheet = () => tasksBook().getSheetByName(RULE_TAB);
const rulesOf = () => rowsOf(ruleSheet(), RULE_COLS);

function ruleSave(r) {
  const values = RULE_COLS.map(c => r[c] == null ? '' : String(r[c]));
  const row = r._row || ruleSheet().getLastRow() + 1;
  ruleSheet().getRange(row, 1, 1, values.length).setNumberFormat('@').setValues([values]);
  r._row = row;
}
function nextRuleId() {
  const p = props();
  const seq = Number(p.getProperty('RULE_SEQ') || 0) + 1;
  p.setProperty('RULE_SEQ', String(seq));
  return 'R-' + ('000' + seq).slice(-4);
}
/** A due day `days` after `day`; 0 means the same day (addPeriod needs a non-zero step). */
const dueAfter = (day, days) => days ? addPeriod(day, { days: days }) : day;
/** Still-open tasks of a repeat, read from the Tasks sheet (taskById from readTasks()). */
const openRuleTasks = (r, taskById) => String(r['Open Tasks'] || '').split(',').map(s => s.trim())
  .filter(id => id && taskById[id] && (taskById[id]['Status'] === 'Open' || taskById[id]['Status'] === 'In progress'));
const repeatLabel = r => r.Repeat === 'Hours' ? r.Hours + ' h' : r.Period;

/** Checks the repeat settings and returns the fields stored on the rule. Throws when anything is unclear. */
function ruleSpec(f, a, today) {
  const out = {};
  if (a.basis === 'hours') {
    const h = Math.round(Number(a.hours));
    if (!(h >= 1 && h <= 100000)) throw new Error('Enter the running hours between 1 and 100000');
    if (!String(f.equipmentNo || '').trim()) throw new Error('Choose the equipment for hour-based repeats');
    out.Repeat = 'Hours'; out.Hours = String(h); out.Period = '';
  } else {
    const p = autoPeriod(a.period);
    if (!p) throw new Error('Choose how often the task repeats');
    out.Repeat = 'Period'; out.Period = p.label; out.Hours = '';
  }
  const people = [];
  [].concat(a.assignees || []).forEach(n => {
    const who = assignable().filter(u => lc(u.username) === lc(n))[0];
    if (!who) throw new Error('Choose who does the task');
    if (people.indexOf(who.username) < 0) people.push(who.username);
  });
  if (!people.length) throw new Error('Choose at least one person');
  const due = cleanDate(f.due);
  out['Due Days'] = String(due ? Math.max(0, Math.round((isoToDate(due) - isoToDate(today)) / 864e5)) : DEFAULT_DUE_DAYS);
  out.Assignees = people.join(', ');
  return out;
}

/** One task of a repeat for one person. by = the creator shown on the task. */
function ruleTask(r, who, by, due, note) {
  const p = props();
  const seq = Number(p.getProperty('TASK_SEQ') || 0) + 1;
  p.setProperty('TASK_SEQ', String(seq));
  const now = nowText();
  const t = {
    'ID': 'T-' + ('000' + seq).slice(-4), 'Created': now, 'Created By': by.username, 'Creator Name': by.name,
    'Assigned To': who.username, 'Assignee Name': who.name, 'Title': r.Title, 'Details': r.Details || '',
    'Equipment': r.Equipment || '', 'Priority': PRIORITIES.indexOf(r.Priority) >= 0 ? r.Priority : 'Normal',
    'Due': due, 'Link': TASK_LINKS.indexOf(r.Link || '') >= 0 ? (r.Link || '') : '', 'Status': 'Open',
    'Updated': now, 'Updated By': by.username,
    'Equipment No': r['Equipment No'] || '', 'Line': r.Line || '', 'Location': r.Location || '', 'Source': r.Repeat === 'Hours' ? 'Meter' : 'Repeat'
  };
  writeTask(t);
  history(t['ID'], 'Created', { username: by.username }, note + ' (' + r['Rule ID'] + ')');
  notifyUser(who.username, { kind: 'assigned', id: t['ID'], title: t['Title'], equipment: equipLabel(t), priority: t['Priority'], by: by.name });
  return t;
}

function ruleOut(r, users, openIds) {
  const names = String(r.Assignees || '').split(',').map(s => s.trim()).filter(Boolean).map(un => {
    const u = users.filter(x => lc(x.username) === lc(un))[0];
    return u ? u.name : un;
  });
  return { id: r['Rule ID'], title: r.Title, details: r.Details, priority: r.Priority, link: r.Link,
           equipment: r.Equipment, equipmentNo: r['Equipment No'], line: r.Line, location: r.Location,
           repeat: repeatLabel(r), repeatKind: r.Repeat, active: r.Active === 'Yes', started: r.Started,
           assignees: names, openCount: openIds ? openIds.length : 0, created: r.Created, createdBy: r['Created By'] };
}

/** Save a new repeat: validates, makes the first task for each person now, then stores the rule. */
function taskRuleCreate(user, f, a) {
  if (!isManager(user)) throw new Error('Only a supervisor can repeat a task');
  f = f || {}; a = a || {};
  const title = String(f.title || '').trim().slice(0, 140);
  if (!title) throw new Error('Enter a task title');
  const today = todayIso();
  const spec = ruleSpec(f, a, today);
  const r = {
    'Rule ID': nextRuleId(), 'Created': nowText(), 'Created By': user.username,
    'Title': title, 'Details': String(f.details || '').slice(0, 2000),
    'Priority': PRIORITIES.indexOf(f.priority) >= 0 ? f.priority : 'Normal',
    'Equipment': String(f.equipment || '').slice(0, 120), 'Equipment No': String(f.equipmentNo || '').slice(0, 60),
    'Line': String(f.line || '').slice(0, 60), 'Location': String(f.location || '').slice(0, 60),
    'Link': TASK_LINKS.indexOf(f.link || '') >= 0 ? (f.link || '') : '',
    'Repeat': spec.Repeat, 'Period': spec.Period, 'Hours': spec.Hours, 'Due Days': spec['Due Days'],
    'Assignees': spec.Assignees, 'Active': 'Yes', 'Started': today, 'Open Tasks': '', 'Updated': nowText()
  };
  const hNow = r.Repeat === 'Hours' ? latestHourMeter(r['Equipment No']) : null;
  r['Hours At Start'] = hNow === null ? '' : String(hNow);
  const due = cleanDate(f.due) || dueAfter(today, Number(r['Due Days']));
  const made = [];
  const users = assignable();
  spec.Assignees.split(', ').forEach(name => {
    const who = users.filter(u => lc(u.username) === lc(name))[0];
    if (who) made.push(ruleTask(r, who, { username: user.username, name: user.name }, due, 'Repeat set: ' + repeatLabel(r)));
  });
  r['Open Tasks'] = made.map(t => t['ID']).join(',');
  ruleSave(r);
  return { ok: true, rule: ruleOut(r, users, made.map(t => t['ID'])), tasks: made.map(taskOut) };
}

/** Supervisor list of repeats with open-task counts. */
function taskRulesList(user) {
  if (!isManager(user)) throw new Error('Only a supervisor can see repeating tasks');
  const users = usersTable(true);
  const byId = {};
  readTasks().forEach(t => { byId[t['ID']] = t; });
  return { ok: true, rules: rulesOf().map(r => ruleOut(r, users, openRuleTasks(r, byId))).reverse() };
}

/** Stop (active = false) or resume a repeat. Tasks already made are kept. Resuming counts from today. */
function taskRuleStatus(user, id, active) {
  if (!isManager(user)) throw new Error('Only a supervisor can stop or resume a repeat');
  const r = rulesOf().filter(x => x['Rule ID'] === String(id || ''))[0];
  if (!r) throw new Error('Repeat not found');
  if (active) {
    r.Active = 'Yes';
    r.Started = todayIso();
    const h = r.Repeat === 'Hours' ? latestHourMeter(r['Equipment No']) : null;
    r['Hours At Start'] = h === null ? '' : String(h);
  } else r.Active = 'No';
  r.Updated = nowText();
  ruleSave(r);
  const byId = {};
  readTasks().forEach(t => { byId[t['ID']] = t; });
  return { ok: true, rule: ruleOut(r, usersTable(true), openRuleTasks(r, byId)) };
}

/** Called by automationCycle: makes the due tasks of every active repeat. Errors are collected, not thrown. */
function taskRulesRun(today, created, errors) {
  const users = usersTable(true);
  const byId = {};
  readTasks().forEach(t => { byId[t['ID']] = t; });
  rulesOf().forEach(r => {
    if (r.Active !== 'Yes') return;
    try {
      const open = openRuleTasks(r, byId);
      r['Open Tasks'] = open.join(',');
      let due = false, hours = null;
      if (r.Repeat === 'Period') {
        due = !r.Started || today >= addPeriod(r.Started, autoPeriod(r.Period));
      } else {
        hours = latestHourMeter(r['Equipment No']);
        if (hours !== null) {
          if (r['Hours At Start'] === '' || hours < Number(r['Hours At Start'])) { r['Hours At Start'] = String(hours); r.Started = today; }
          else due = hours - Number(r['Hours At Start']) >= Number(r.Hours);
        }
      }
      if (due && !open.length) {
        const ids = [];
        String(r.Assignees || '').split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
          const who = users.filter(u => u.active && lc(u.username) === lc(name))[0];
          if (who) ids.push(ruleTask(r, who, { username: 'automation', name: 'Automation' },
                                     dueAfter(today, Number(r['Due Days'])), 'Repeat: ' + repeatLabel(r))['ID']);
        });
        if (ids.length) {
          r['Open Tasks'] = ids.join(',');
          r.Started = today;
          if (r.Repeat === 'Hours') r['Hours At Start'] = String(hours);
          created.push.apply(created, ids);
        }
      }
    } catch (err) { errors.push(r.Title + ': ' + err.message); }
    r.Updated = nowText();
    ruleSave(r);
  });
}

/* ---- spare parts (Maintainance Inventory: electrical and mechanical tabs) ---- */

const spareSheet = kind => {
  const ss = SpreadsheetApp.openById(props().getProperty('SPARES_SS_ID') || SPARES_ID);
  const sh = ss.getSheetById(kind === 'mechanical' ? SPARES_MECH_GID : SPARES_ELECT_GID);
  if (!sh) throw new Error('Spare parts tab not found in the inventory sheet');
  return sh;
};
const spareKey = (kind, no) => safeKey((kind === 'mechanical' ? 'M-' : 'E-') + String(no || '').trim());
const recordStatusIndex = head => head.map(h => lc(h)).indexOf('record status');

/** First electrical row with no part number, description and quantity (or the row after the last). */
function electricalSlot(sh, cols) {
  const last = sh.getLastRow();
  if (last >= 2) {
    const vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getDisplayValues();
    for (let i = 0; i < vals.length; i++) {
      const r = vals[i];
      if (!String(r[cols.no - 1]).trim() && !String(r[cols.desc - 1]).trim() && !String(r[cols.qty - 1]).trim()) return i + 2;
    }
  }
  return last + 1;
}

function spareSave(user, f) {
  if (!canEditSpares(user)) throw new Error('You do not have permission to change spare parts');
  f = f || {};
  const kind = f.kind === 'mechanical' ? 'mechanical' : 'electrical';
  const sh = spareSheet(kind);
  const isNew = !f.row;
  const no = clean(f.no, 60);
  if (!no) throw new Error('Enter the part number');
  const photo = f.photo ? photoBlob(f.photo) : null;
  if (isNew && !photo) throw new Error('Add a main photo for the new spare part');
  const res = kind === 'mechanical' ? saveMechanical(sh, f, no, isNew) : saveElectrical(sh, f, no, isNew);
  if (res.oldKey && res.oldKey !== res.key) renameItemFolder('spare', res.oldKey, res.key);
  if (photo) saveItemPhoto('spare', res.key, 'main', photo);
  CacheService.getScriptCache().remove('spares_v1');
  return { ok: true, row: res.row, key: res.key };
}

function saveElectrical(sh, f, no, isNew) {
  const cols = findCols(sh, SPARE_E_SPEC, true);
  const desc = clean(f.desc, 200), brand = clean(f.brand, 60);
  if (!desc) throw new Error('Enter the description');
  const qty = numCell(f.qty, 'Quantity');
  const row = isNew ? electricalSlot(sh, cols) : checkRow(sh, f.row);
  let oldKey = '';
  if (!isNew) oldKey = spareKey('electrical', sh.getRange(row, cols.no).getDisplayValue());
  const put = (c, v) => sh.getRange(row, c).setValue(v);
  put(cols.no, no); put(cols.brand, brand); put(cols.desc, desc); put(cols.qty, qty);
  if (isNew) {
    if (!String(sh.getRange(row, 1).getDisplayValue()).trim()) put(1, row - 1);   // the "#" column
    put(cols.rec, 'Active');
  }
  return { row: row, oldKey: oldKey, key: spareKey('electrical', no) };
}

function saveMechanical(sh, f, no, isNew) {
  const cols = findCols(sh, SPARE_M_SPEC, true);
  const name = clean(f.name, 200), machine = clean(f.machine, 80);
  if (!name) throw new Error('Enter the part name');
  const req = numCell(f.required, 'Required qty'), avail = numCell(f.available, 'Available qty'), used = numCell(f.used, 'Used qty');
  const row = isNew ? sh.getLastRow() + 1 : checkRow(sh, f.row);
  let oldKey = '';
  if (!isNew) oldKey = spareKey('mechanical', sh.getRange(row, cols.no).getDisplayValue());
  const put = (c, v) => sh.getRange(row, c).setValue(v);
  put(cols.no, no); put(cols.name, name); put(cols.required, req); put(cols.available, avail); put(cols.used, used); put(cols.machine, machine);
  if (isNew) {
    // same formulas as the rows above (Remaining = Available - Used, Status against Required)
    put(cols.remaining, '=' + colLetter(cols.available) + row + '-' + colLetter(cols.used) + row);
    put(cols.status, '=IF(' + colLetter(cols.remaining) + row + '<' + colLetter(cols.required) + row + ',"LOW STOCK","OK")');
    put(cols.rec, 'Active');
  }
  return { row: row, oldKey: oldKey, key: spareKey('mechanical', no) };
}

/* ================= v16: Parts Inventory — stock movements, prices, vendors, low-stock alerts =================
 * The original inventory sheet stays the place where the quantity lives (the app writes to it):
 *   electrical: Quantity.   mechanical: Used Qty goes up when a part is used, Available Qty goes up when stock is received,
 *   a count sets Available so that Available - Used = the counted amount (the sheet's own Remaining / Status formulas follow).
 * Extra facts (unit cost, vendor, minimum quantity, bin) are in the "Part Stock" tab, every movement in "Part Usage",
 * and suppliers in "Vendors" — all in the Maintenance Tasks book. A part is identified as "m:<no>" / "e:<no>". */
const partKey = (kind, no) => (kind === 'mechanical' ? 'm:' : 'e:') + String(no || '').trim();
const numOf = v => { const x = Number(String(v == null ? '' : v).replace(/,/g, '').trim()); return isFinite(x) ? x : 0; };
const round3 = x => Math.round(x * 1000) / 1000;
const canUseParts = u => !!u && (isManager(u) || canEditSpares(u));

/** Quantity from a form: a number above 0 (up to 3 decimals). */
function qtyOf(v, label) {
  const raw = String(v == null ? '' : v).trim().replace(',', '.');
  const n = Number(raw);
  if (raw === '' || !isFinite(n) || n <= 0 || n > 1000000) throw new Error((label || 'Quantity') + ' must be a number above 0');
  return round3(n);
}
function partFind(kind, no) {
  kind = kind === 'mechanical' ? 'mechanical' : 'electrical';
  no = String(no || '').trim();
  const list = sparesList(true, true)[kind].filter(x => x.no === no && !x.deleted);
  const p = list[0];
  if (!p) throw new Error('Part not found');
  const o = { kind: kind, no: no, row: p.row, key: partKey(kind, no) };
  if (kind === 'electrical') { o.name = p.desc; o.onHand = numOf(p.qty); }
  else {
    o.name = p.name; o.required = p.required === '' ? null : numOf(p.required);
    o.used = numOf(p.used); o.available = numOf(p.available);
    o.onHand = round3(o.available - o.used);
  }
  return o;
}
const stockRows = () => rowsOf(tasksBook().getSheetByName(PART_STOCK_TAB), PART_STOCK_COLS).filter(r => r['Key']);
function stockOut(r) {
  return r ? { cost: r['Unit Cost'] === '' ? null : numOf(r['Unit Cost']), vendorId: r['Vendor ID'], min: r['Min Qty'] === '' ? null : numOf(r['Min Qty']), bin: r['Bin'] } : { cost: null, vendorId: '', min: null, bin: '' };
}
/** Is this part low? Mechanical: remaining below the required quantity. Electrical: at or under its minimum (no minimum: only when none is left). */
function partIsLow(kind, onHand, required, min) {
  if (kind === 'mechanical') return required !== null && required !== undefined && required !== '' && onHand < numOf(required);
  return min !== null && min !== undefined && min !== '' ? onHand <= numOf(min) : onHand <= 0;
}
function onHandOf(kind, p) {
  if (kind === 'electrical') return numOf(p.qty);
  return round3(numOf(p.available) - numOf(p.used));
}
/** Everything the Parts list needs beyond the sheet: price, vendor, minimum, bin, and which parts are low. */
function stockBundle() {
  const by = {}; stockRows().forEach(r => { by[r['Key']] = stockOut(r); });
  const sp = sparesList(false, false), low = [];
  ['electrical', 'mechanical'].forEach(kind => sp[kind].forEach(p => {
    const st = by[partKey(kind, p.no)];
    if (partIsLow(kind, onHandOf(kind, p), kind === 'mechanical' ? p.required : null, st ? st.min : null)) low.push(partKey(kind, p.no));
  }));
  return { stock: by, low: low, vendors: vendorRows().filter(v => v['Active'] !== 'No').map(vendorOut) };
}
function stockUpsert(p, patch) {
  const sh = tasksBook().getSheetByName(PART_STOCK_TAB);
  const row = stockRows().filter(r => r['Key'] === p.key)[0];
  const vals = PART_STOCK_COLS.map(c => row ? row[c] : '');
  const set = (c, v) => { vals[PART_STOCK_COLS.indexOf(c)] = v == null ? '' : String(v); };
  if (!row) { set('Key', p.key); set('Kind', p.kind); set('Part No', p.no); }
  Object.keys(patch).forEach(k => set(k, patch[k]));
  set('Updated', nowText());
  const r = row ? row._row : sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, PART_STOCK_COLS.length).setNumberFormat('@').setValues([vals]);
}
/** Writes the new quantity to the inventory sheet. Returns the new on-hand figure. */
function applyStock(p, type, q) {
  const sh = spareSheet(p.kind);
  let next;
  if (p.kind === 'electrical') {
    const cols = findCols(sh, SPARE_E_SPEC, false);
    next = type === 'Used' ? p.onHand - q : type === 'Count' ? q : p.onHand + q;
    sh.getRange(p.row, cols.qty).setValue(round3(next));
  } else {
    const cols = findCols(sh, SPARE_M_SPEC, false);
    let used = p.used, avail = p.available;
    if (type === 'Used') used = used + q;
    else if (type === 'Returned') { if (q > used) avail = avail + (q - used); used = Math.max(0, used - q); }
    else if (type === 'Received') avail = avail + q;
    else avail = q + used;                                   // Count
    sh.getRange(p.row, cols.used).setValue(round3(used));
    sh.getRange(p.row, cols.available).setValue(round3(avail));
    next = avail - used;
  }
  CacheService.getScriptCache().remove('spares_v1');
  return round3(next);
}
function partLog(p, type, qty, balance, order, cost, user, note) {
  const sh = tasksBook().getSheetByName(PART_LOG_TAB);
  sh.getRange(sh.getLastRow() + 1, 1, 1, PART_LOG_COLS.length).setNumberFormat('@')
    .setValues([[nowText(), p.key, p.kind, p.no, p.name, type, String(qty), String(balance), order || '', cost == null ? '' : String(cost), user.username, clean(note, 200)]]);
}
/** Parts that have just become low are announced once to the supervisors; a part that recovered can be announced again later. */
function lowStockSweep() {
  const by = {}; stockRows().forEach(r => { by[r['Key']] = r; });
  const sp = sparesList(true, false), fresh = [];
  const sh = tasksBook().getSheetByName(PART_STOCK_TAB), aCol = PART_STOCK_COLS.indexOf('Alerted') + 1;
  ['electrical', 'mechanical'].forEach(kind => sp[kind].forEach(p => {
    const key = partKey(kind, p.no), r = by[key], st = stockOut(r);
    const low = partIsLow(kind, onHandOf(kind, p), kind === 'mechanical' ? p.required : null, st.min);
    const was = !!(r && r['Alerted'] === 'Yes');
    if (low && !was) {
      fresh.push({ key: key, name: kind === 'mechanical' ? p.name : p.desc, onHand: onHandOf(kind, p) });
      if (r) sh.getRange(r._row, aCol).setNumberFormat('@').setValue('Yes');
      else stockUpsert({ key: key, kind: kind, no: p.no }, { 'Alerted': 'Yes' });
    } else if (!low && was) sh.getRange(r._row, aCol).setNumberFormat('@').setValue('');
  }));
  if (fresh.length) {
    const msg = { kind: 'lowstock', n: fresh.length, title: fresh.slice(0, 4).map(f => f.name).join(' · '), key: fresh.length === 1 ? fresh[0].key : '' };
    usersTable(true).filter(u => u.active && MANAGER_ROLES.indexOf(u.role) >= 0).forEach(u => notifyUser(u.username, Object.assign({}, msg)));
  }
  return fresh;
}

/** May this person log parts on this work order? Supervisors, parts editors, and the technician it is assigned to. */
function canPartsOnOrder(user, task) {
  return canUseParts(user) || (lc(task['Assigned To']) === lc(user.username) && task['Status'] !== 'Cancelled');
}
function partUse(user, f) {
  f = f || {};
  const type = f.type === 'Returned' ? 'Returned' : 'Used';
  const order = clean(f.order, 30);
  let task = null;
  if (order) { task = readTasks().filter(t => t['ID'] === order)[0]; if (!task) throw new Error('Work order not found'); }
  if (task ? !canPartsOnOrder(user, task) : !canUseParts(user)) throw new Error('You do not have permission to log parts');
  const p = partFind(f.kind, f.no), q = qtyOf(f.qty);
  const st = stockOut(stockRows().filter(r => r['Key'] === p.key)[0]);
  if (type === 'Used' && q > p.onHand) throw new Error('Only ' + p.onHand + ' in stock — count the stock first if that is wrong');
  if (type === 'Returned') {
    if (!order) throw new Error('Choose the work order the part came back from');
    const net = partsOnOrder(order).filter(x => x.key === p.key).reduce((a, x) => a - x.qty, 0);
    if (q > net) throw new Error('Only ' + round3(net) + ' of this part was used on that work order');
  }
  const balance = applyStock(p, type, q);
  partLog(p, type, type === 'Used' ? -q : q, balance, order, st.cost, user, f.note);
  lowStockSweep();
  return { ok: true, balance: balance, name: p.name };
}
function partReceive(user, f) {
  if (!canUseParts(user)) throw new Error('You do not have permission to change spare parts');
  f = f || {};
  const p = partFind(f.kind, f.no), q = qtyOf(f.qty);
  const patch = {};
  if (f.cost !== undefined && String(f.cost).trim() !== '') patch['Unit Cost'] = cleanCost(f.cost);
  const st = stockOut(stockRows().filter(r => r['Key'] === p.key)[0]);
  const balance = applyStock(p, 'Received', q);
  if (Object.keys(patch).length) stockUpsert(p, patch);
  partLog(p, 'Received', q, balance, '', patch['Unit Cost'] !== undefined ? patch['Unit Cost'] : st.cost, user, f.note);
  lowStockSweep();
  return { ok: true, balance: balance };
}
function partCount(user, f) {
  if (!canUseParts(user)) throw new Error('You do not have permission to change spare parts');
  f = f || {};
  const p = partFind(f.kind, f.no);
  const raw = String(f.counted == null ? '' : f.counted).trim().replace(',', '.'), n = Number(raw);
  if (raw === '' || !isFinite(n) || n < 0 || n > 1000000) throw new Error('Counted quantity must be a number, 0 or more');
  const counted = round3(n), diff = round3(counted - p.onHand);
  const st = stockOut(stockRows().filter(r => r['Key'] === p.key)[0]);
  const balance = applyStock(p, 'Count', counted);
  partLog(p, 'Count', diff, balance, '', st.cost, user, f.note || 'Stock count');
  lowStockSweep();
  return { ok: true, balance: balance, difference: diff };
}
function cleanCost(v) {
  const n = Number(String(v).replace(',', '.').trim());
  if (!isFinite(n) || n < 0 || n > 10000000) throw new Error('Unit cost must be a number, 0 or more');
  return String(round3(n));
}
function partDetails(user, f) {
  if (!canUseParts(user)) throw new Error('You do not have permission to change spare parts');
  f = f || {};
  const p = partFind(f.kind, f.no), patch = {};
  if (f.cost !== undefined) patch['Unit Cost'] = String(f.cost).trim() === '' ? '' : cleanCost(f.cost);
  if (f.vendorId !== undefined) {
    const v = clean(f.vendorId, 20);
    if (v && !vendorRows().some(r => r['Vendor ID'] === v && r['Active'] !== 'No')) throw new Error('Vendor not found');
    patch['Vendor ID'] = v;
  }
  if (f.min !== undefined) {
    if (p.kind === 'mechanical') throw new Error('For mechanical parts the minimum is the Required qty');
    const raw = String(f.min).trim().replace(',', '.');
    if (raw !== '' && (!isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > 1000000)) throw new Error('Minimum must be a number, 0 or more');
    patch['Min Qty'] = raw === '' ? '' : String(round3(Number(raw)));
  }
  if (f.bin !== undefined) patch['Bin'] = clean(f.bin, 40);
  stockUpsert(p, patch);
  lowStockSweep();
  return { ok: true };
}
const moveOut = r => ({ at: r['Timestamp'], key: r['Key'], kind: r['Kind'], no: r['Part No'], name: r['Part Name'], type: r['Type'], qty: numOf(r['Qty']),
                        balance: numOf(r['Balance']), order: r['Work Order'], cost: r['Unit Cost'] === '' ? null : numOf(r['Unit Cost']), by: r['By'], note: r['Note'] });
const partsOnOrder = id => rowsOf(tasksBook().getSheetByName(PART_LOG_TAB), PART_LOG_COLS).filter(r => r['Work Order'] === id && (r['Type'] === 'Used' || r['Type'] === 'Returned')).map(moveOut);
function partInfo(user, kind, no) {
  if (!canSeeSpares(user)) throw new Error('You do not have access to spare parts');
  const p = partFind(kind, no);
  const st = stockOut(stockRows().filter(r => r['Key'] === p.key)[0]);
  const v = st.vendorId ? vendorRows().filter(r => r['Vendor ID'] === st.vendorId)[0] : null;
  const log = rowsOf(tasksBook().getSheetByName(PART_LOG_TAB), PART_LOG_COLS).filter(r => r['Key'] === p.key).reverse().map(moveOut)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const cutoff = Utilities.formatDate(new Date(Date.now() - 90 * 864e5), TZ, 'yyyy-MM-dd');
  const used90 = log.filter(m => m.type === 'Used' && String(m.at).slice(0, 10) >= cutoff).reduce((a, m) => a - m.qty, 0);
  const ret90 = log.filter(m => m.type === 'Returned' && String(m.at).slice(0, 10) >= cutoff).reduce((a, m) => a + m.qty, 0);
  return { ok: true, part: { key: p.key, kind: p.kind, no: p.no, name: p.name, onHand: p.onHand, required: p.required === undefined ? null : p.required },
    stock: st, vendor: v ? vendorOut(v) : null, low: partIsLow(p.kind, p.onHand, p.required, st.min),
    value: st.cost === null ? null : round3(st.cost * Math.max(0, p.onHand)), used90: round3(used90 - ret90), moves: log.slice(0, 40) };
}
/** Search for the "add a part" picker on a work order. Anyone who can log parts somewhere may search; price is shown to parts people only. */
function partsLookup(user, q) {
  const mine = canUseParts(user) || readTasks().some(t => lc(t['Assigned To']) === lc(user.username) && (t['Status'] === 'Open' || t['Status'] === 'In progress'));
  if (!mine) throw new Error('You do not have permission to log parts');
  const s = lc(q), sp = sparesList(false, false), out = [];
  ['mechanical', 'electrical'].forEach(kind => sp[kind].forEach(p => {
    const name = kind === 'mechanical' ? p.name : p.desc;
    if (s && [p.no, name, kind === 'mechanical' ? p.machine : p.brand].join(' ').toLowerCase().indexOf(s) < 0) return;
    out.push({ kind: kind, no: p.no, name: name, onHand: onHandOf(kind, p), sub: kind === 'mechanical' ? p.machine : p.brand });
  }));
  return { ok: true, parts: out.slice(0, 25), more: Math.max(0, out.length - 25) };
}
function taskParts(user, id) {
  const task = readTasks().filter(t => t['ID'] === String(id || ''))[0];
  if (!task) throw new Error('Task not found');
  if (!(canUseParts(user) || lc(task['Assigned To']) === lc(user.username) || lc(task['Created By']) === lc(user.username))) throw new Error('You do not have permission to see the parts of this work order');
  const money = canSeeSpares(user);
  const moves = partsOnOrder(task['ID']).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const net = {};
  moves.forEach(m => { const n = net[m.key] = net[m.key] || { key: m.key, kind: m.kind, no: m.no, name: m.name, qty: 0, cost: 0 }; n.qty += -m.qty; n.cost += -m.qty * (m.cost || 0); });
  const lines = Object.keys(net).map(k => net[k]).filter(n => n.qty !== 0);
  lines.forEach(n => { n.qty = round3(n.qty); n.cost = round3(n.cost); if (!money) delete n.cost; });
  moves.forEach(m => { if (!money) m.cost = null; });
  return { ok: true, lines: lines, moves: moves, total: money ? round3(lines.reduce((a, n) => a + n.cost, 0)) : null,
           canAdd: canPartsOnOrder(user, task) && task['Status'] !== 'Cancelled' };
}

/* ---- vendors ---- */
const vendorRows = () => rowsOf(tasksBook().getSheetByName(VENDOR_TAB), VENDOR_COLS).filter(r => r['Vendor ID']);
const vendorOut = r => ({ id: r['Vendor ID'], name: r['Name'], phone: r['Phone'], email: r['Email'], notes: r['Notes'], active: r['Active'] !== 'No' });
function vendorsList(user) {
  if (!canSeeSpares(user)) throw new Error('You do not have access to spare parts');
  return { ok: true, vendors: vendorRows().map(vendorOut), canEdit: canUseParts(user) };
}
function vendorSave(user, f) {
  if (!canUseParts(user)) throw new Error('You do not have permission to change spare parts');
  f = f || {};
  const name = clean(f.name, 80);
  if (!name) throw new Error('Enter the vendor name');
  const email = clean(f.email, 80);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');
  const rows = vendorRows();
  if (rows.some(r => lc(r['Name']) === lc(name) && r['Vendor ID'] !== f.id)) throw new Error('A vendor with this name already exists');
  const sh = tasksBook().getSheetByName(VENDOR_TAB);
  const old = f.id ? rows.filter(r => r['Vendor ID'] === f.id)[0] : null;
  if (f.id && !old) throw new Error('Vendor not found');
  const id = old ? old['Vendor ID'] : 'V' + String(rows.reduce((m, r) => Math.max(m, Number(String(r['Vendor ID']).replace(/\D/g, '')) || 0), 0) + 1).padStart(3, '0');
  const vals = [id, name, clean(f.phone, 30), email, clean(f.notes, 300), f.active === false ? 'No' : 'Yes'];
  sh.getRange(old ? old._row : sh.getLastRow() + 1, 1, 1, VENDOR_COLS.length).setNumberFormat('@').setValues([vals]);
  return { ok: true, id: id };
}

/* ================= v17: Reporting — work orders, workload, downtime (MTTR / MTBF), parts cost; CSV and email ================= */
const REPORT_MAX_DAYS = 366;
const isoDay = ms => Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd');
const addDays = (iso, n) => isoDay(isoToDate(iso).getTime() + n * 864e5);
const dayDiff = (a, b) => Math.round((isoToDate(b).getTime() - isoToDate(a).getTime()) / 864e5);
const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
/** from / to as yyyy-MM-dd, or a number of days ending today. Default: the last 30 days. */
function reportRange(f) {
  f = f || {};
  const today = todayIso();
  let from, to;
  if (f.from || f.to) {
    from = cleanDate(f.from); to = cleanDate(f.to || today);
    if (!from) throw new Error('Choose the start date');
    if (!to) throw new Error('Choose the end date');
  } else {
    const n = Math.max(1, Math.min(REPORT_MAX_DAYS, Number(f.days) || 30));
    to = today; from = addDays(today, -(n - 1));
  }
  if (from > to) throw new Error('The start date is after the end date');
  if (dayDiff(from, to) + 1 > REPORT_MAX_DAYS) throw new Error('Choose a period of at most one year');
  return { from: from, to: to, days: dayDiff(from, to) + 1 };
}
function report(user, f) {
  if (!isManager(user)) throw new Error('Reports are for supervisors');
  const rg = reportRange(f), today = todayIso();
  const inR = d => { d = String(d || '').slice(0, 10); return d >= rg.from && d <= rg.to; };
  const rangeStart = stampMs(rg.from + ' 00:00'), rangeEnd = Math.min(stampMs(rg.to + ' 23:59') + 60000, stampMs(nowText()));
  const periodMin = Math.max(1, Math.round((rangeEnd - rangeStart) / 60000));

  // ---- work orders
  const all = readTasks().filter(t => t['Status'] !== 'Cancelled' || inR(t['Created']));
  const created = all.filter(t => inR(t['Created']));
  const done = all.filter(t => t['Status'] === 'Done' && inR(t['Done']));
  const open = all.filter(t => t['Status'] === 'Open' || t['Status'] === 'In progress');
  const overdue = open.filter(t => t['Due'] && t['Due'] < today);
  const withDue = done.filter(t => t['Due']);
  const onTime = withDue.filter(t => String(t['Done']).slice(0, 10) <= t['Due']).length;
  const hoursToDone = done.map(t => (stampMs(t['Done']) - stampMs(t['Created'])) / 36e5).filter(h => isFinite(h) && h >= 0);
  const countBy = (list, k) => { const m = {}; list.forEach(t => { const v = t[k] || '—'; m[v] = (m[v] || 0) + 1; }); return m; };
  const byCat = {}; created.forEach(t => { const c = t['Category'] || '—'; (byCat[c] = byCat[c] || { created: 0, done: 0 }).created++; });
  done.forEach(t => { const c = t['Category'] || '—'; (byCat[c] = byCat[c] || { created: 0, done: 0 }).done++; });
  const workOrders = {
    created: created.length, done: done.length, open: open.length, overdue: overdue.length,
    onTimePct: withDue.length ? Math.round(onTime / withDue.length * 100) : null, avgHoursToDone: avg(hoursToDone),
    hoursLogged: Math.round(done.reduce((a, t) => a + (Number(t['Hours']) || 0), 0) * 100) / 100,
    byCategory: Object.keys(byCat).sort().map(k => ({ name: k, created: byCat[k].created, done: byCat[k].done })),
    byPriority: PRIORITIES.map(p => ({ name: p, created: created.filter(t => (t['Priority'] || 'Normal') === p).length, done: done.filter(t => (t['Priority'] || 'Normal') === p).length }))
  };

  // ---- workload (everyone with a work order in the period or still open)
  const names = {}; usersTable().forEach(u => { names[lc(u.username)] = u.name; });
  const who = {};
  const slot = t => { const k = lc(t['Assigned To']); return k ? (who[k] = who[k] || { username: t['Assigned To'], name: names[k] || t['Assignee Name'] || t['Assigned To'], open: 0, overdue: 0, done: 0, hours: 0, _h: [] }) : null; };
  open.forEach(t => { const w = slot(t); if (w) { w.open++; if (t['Due'] && t['Due'] < today) w.overdue++; } });
  done.forEach(t => { const w = slot(t); if (w) { w.done++; w.hours += Number(t['Hours']) || 0; const h = (stampMs(t['Done']) - stampMs(t['Created'])) / 36e5; if (isFinite(h) && h >= 0) w._h.push(h); } });
  const workload = Object.keys(who).map(k => { const w = who[k]; return { username: w.username, name: w.name, open: w.open, overdue: w.overdue, done: w.done, hours: Math.round(w.hours * 100) / 100, avgHoursToDone: avg(w._h) }; })
    .sort((a, b) => (b.open + b.done) - (a.open + a.done) || a.name.localeCompare(b.name));

  // ---- assets: downtime, MTTR, MTBF (unplanned stops only)
  const now = stampMs(nowText()), by = {};
  downtimeRows().forEach(r => {
    const a = stampMs(r['Started']), b = r['Status'] === 'Offline' ? now : stampMs(r['Ended']);
    if (!isFinite(a) || !isFinite(b)) return;
    const lo = Math.max(a, rangeStart), hi = Math.min(b, rangeEnd);
    if (hi <= lo && !inR(r['Started'])) return;
    const e = by[r['Equipment No']] = by[r['Equipment No']] || { no: r['Equipment No'], name: r['Equipment'], stops: 0, unplannedStops: 0, minutes: 0, unplannedMinutes: 0, plannedMinutes: 0, repair: [], causes: {} };
    const mins = Math.max(0, Math.round((hi - lo) / 60000));
    e.minutes += mins;
    if (r['Type'] === 'Planned') e.plannedMinutes += mins; else e.unplannedMinutes += mins;
    if (inR(r['Started'])) {
      e.stops++;
      if (r['Type'] !== 'Planned') {
        e.unplannedStops++;
        if (r['Status'] !== 'Offline') e.repair.push(Math.max(0, Math.round((b - a) / 60000)));
        const c = r['Cause'] || '—'; e.causes[c] = (e.causes[c] || 0) + mins;
      }
    }
  });
  const assets = Object.keys(by).map(k => {
    const e = by[k], up = Math.max(0, periodMin - e.minutes);
    return { no: e.no, name: e.name, stops: e.stops, unplannedStops: e.unplannedStops, minutes: e.minutes, unplannedMinutes: e.unplannedMinutes, plannedMinutes: e.plannedMinutes,
             mttrMin: e.repair.length ? Math.round(e.repair.reduce((x, y) => x + y, 0) / e.repair.length) : null,
             mtbfHours: e.unplannedStops ? Math.round(up / e.unplannedStops / 60 * 10) / 10 : null,
             availabilityPct: Math.round(Math.max(0, periodMin - e.minutes) / periodMin * 1000) / 10 };
  }).sort((a, b) => b.minutes - a.minutes);
  const allUnp = assets.reduce((x, a) => x + a.unplannedStops, 0), allRepair = [].concat.apply([], Object.keys(by).map(k => by[k].repair));
  const causeTot = {}; Object.keys(by).forEach(k => Object.keys(by[k].causes).forEach(c => { causeTot[c] = (causeTot[c] || 0) + by[k].causes[c]; }));
  const downtime = { stops: assets.reduce((x, a) => x + a.stops, 0), unplannedStops: allUnp, minutes: assets.reduce((x, a) => x + a.minutes, 0), unplannedMinutes: assets.reduce((x, a) => x + a.unplannedMinutes, 0),
    plannedMinutes: assets.reduce((x, a) => x + a.plannedMinutes, 0), mttrMin: allRepair.length ? Math.round(allRepair.reduce((x, y) => x + y, 0) / allRepair.length) : null,
    byCause: Object.keys(causeTot).map(c => ({ name: c, minutes: causeTot[c] })).sort((a, b) => b.minutes - a.minutes) };

  // ---- parts
  const parts = {}; let partsCost = 0;
  rowsOf(tasksBook().getSheetByName(PART_LOG_TAB), PART_LOG_COLS).forEach(r => {
    if ((r['Type'] !== 'Used' && r['Type'] !== 'Returned') || !inR(r['Timestamp'])) return;
    const q = -numOf(r['Qty']), c = q * numOf(r['Unit Cost']);
    partsCost += c;
    const e = parts[r['Key']] = parts[r['Key']] || { no: r['Part No'], name: r['Part Name'], qty: 0, cost: 0 };
    e.qty += q; e.cost += c;
  });
  const topParts = Object.keys(parts).map(k => ({ no: parts[k].no, name: parts[k].name, qty: round3(parts[k].qty), cost: round3(parts[k].cost) })).filter(x => x.qty !== 0).sort((a, b) => b.cost - a.cost || b.qty - a.qty).slice(0, 10);

  const out = { ok: true, range: rg, generated: nowText(), workOrders: workOrders, workload: workload, assets: assets, downtime: downtime, parts: { cost: round3(partsCost), top: topParts } };
  if (f && f.csv) out.csv = reportCsv(out);
  return out;
}
const csvCell = v => { const x = v == null ? '' : String(v); return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
const csvRow = a => a.map(csvCell).join(',');
function reportCsv(r) {
  const w = r.workOrders, d = r.downtime, L = [];
  L.push(csvRow(['Holoul maintenance report', r.range.from, r.range.to, 'Generated ' + r.generated]));
  L.push(''); L.push(csvRow(['WORK ORDERS'])); L.push(csvRow(['Created', 'Done', 'Open now', 'Overdue now', 'On time %', 'Avg hours to finish', 'Hours logged']));
  L.push(csvRow([w.created, w.done, w.open, w.overdue, w.onTimePct, w.avgHoursToDone, w.hoursLogged]));
  L.push(''); L.push(csvRow(['By category', 'Created', 'Done'])); w.byCategory.forEach(c => L.push(csvRow([c.name, c.created, c.done])));
  L.push(''); L.push(csvRow(['By priority', 'Created', 'Done'])); w.byPriority.forEach(c => L.push(csvRow([c.name, c.created, c.done])));
  L.push(''); L.push(csvRow(['WORKLOAD'])); L.push(csvRow(['Person', 'Open now', 'Overdue now', 'Done', 'Hours logged', 'Avg hours to finish']));
  r.workload.forEach(p => L.push(csvRow([p.name, p.open, p.overdue, p.done, p.hours, p.avgHoursToDone])));
  L.push(''); L.push(csvRow(['ASSETS']));
  L.push(csvRow(['Asset no', 'Asset', 'Stops', 'Unplanned stops', 'Downtime min', 'Unplanned min', 'Planned min', 'MTTR min', 'MTBF hours', 'Availability %']));
  r.assets.forEach(a => L.push(csvRow([a.no, a.name, a.stops, a.unplannedStops, a.minutes, a.unplannedMinutes, a.plannedMinutes, a.mttrMin, a.mtbfHours, a.availabilityPct])));
  L.push(''); L.push(csvRow(['Lost time by cause (unplanned)', 'Minutes'])); d.byCause.forEach(c => L.push(csvRow([c.name, c.minutes])));
  L.push(''); L.push(csvRow(['PARTS', 'Total cost', r.parts.cost])); L.push(csvRow(['Part no', 'Part', 'Net qty used', 'Cost'])); r.parts.top.forEach(p => L.push(csvRow([p.no, p.name, p.qty, p.cost])));
  return L.join('\n');
}
const reportEmailOk = e => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e);
const mins2 = m => m == null ? '—' : (m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min');
const htmlEsc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function reportHtml(r) {
  const w = r.workOrders, d = r.downtime;
  const tbl = (head, rows) => '<table style="border-collapse:collapse;margin:6px 0 16px;font-size:13px"><tr>' + head.map(h => '<th style="text-align:left;border-bottom:1px solid #ccc;padding:4px 10px">' + htmlEsc(h) + '</th>').join('') + '</tr>' +
    rows.map(x => '<tr>' + x.map(c => '<td style="padding:4px 10px;border-bottom:1px solid #eee">' + htmlEsc(c == null ? '—' : c) + '</td>').join('') + '</tr>').join('') + '</table>';
  return '<div style="font-family:Arial,sans-serif;color:#222"><h2 style="margin:0">Maintenance report</h2><p style="color:#666;margin:4px 0 16px">' + htmlEsc(r.range.from + ' to ' + r.range.to) + '</p>' +
    '<h3>Work orders</h3>' + tbl(['Created', 'Done', 'Open now', 'Overdue now', 'On time', 'Avg time to finish'], [[w.created, w.done, w.open, w.overdue, w.onTimePct == null ? '—' : w.onTimePct + '%', w.avgHoursToDone == null ? '—' : w.avgHoursToDone + ' h']]) +
    '<h3>Workload</h3>' + tbl(['Person', 'Open', 'Overdue', 'Done', 'Hours'], r.workload.map(p => [p.name, p.open, p.overdue, p.done, p.hours])) +
    '<h3>Downtime</h3><p style="font-size:13px">Stops: ' + d.stops + ' (unplanned ' + d.unplannedStops + ') · Total: ' + htmlEsc(mins2(d.minutes)) + ' · Average repair (MTTR): ' + htmlEsc(mins2(d.mttrMin)) + '</p>' +
    tbl(['Asset', 'Stops', 'Downtime', 'MTTR', 'MTBF', 'Availability'], r.assets.map(a => [a.name + ' (' + a.no + ')', a.stops, mins2(a.minutes), mins2(a.mttrMin), a.mtbfHours == null ? '—' : a.mtbfHours + ' h', a.availabilityPct + '%'])) +
    '<h3>Parts</h3><p style="font-size:13px">Cost of parts used: ' + htmlEsc(r.parts.cost) + '</p>' + tbl(['Part', 'Qty', 'Cost'], r.parts.top.map(p => [p.name + ' (' + p.no + ')', p.qty, p.cost])) +
    '<p style="color:#888;font-size:12px">Full detail is in the attached CSV file. Sent by the Holoul Maintenance app.</p></div>';
}
function sendReport(to, r, by) {
  MailApp.sendEmail({ to: to, subject: 'Holoul maintenance report ' + r.range.from + ' to ' + r.range.to, htmlBody: reportHtml(r), body: 'Maintenance report ' + r.range.from + ' to ' + r.range.to + ' — see the attached CSV.',
    attachments: [Utilities.newBlob(reportCsv(r), 'text/csv', 'holoul-report-' + r.range.from + '_' + r.range.to + '.csv')], name: 'Holoul Maintenance' });
}
function reportEmail(user, f) {
  if (!isManager(user)) throw new Error('Reports are for supervisors');
  const to = clean(f && f.email, 120).toLowerCase();
  if (!reportEmailOk(to)) throw new Error('Enter one valid email address');
  const r = report(user, f);
  sendReport(to, r, user.username);
  return { ok: true, sentTo: to };
}
const reportRows = () => rowsOf(tasksBook().getSheetByName(REPORT_TAB), REPORT_COLS).filter(r => r['Email']);
function reportRecipients(user) {
  if (!isManager(user)) throw new Error('Reports are for supervisors');
  return { ok: true, recipients: reportRows().map(r => ({ email: r['Email'], active: r['Active'] !== 'No', addedBy: r['Added By'], lastSent: r['Last Sent'] })) };
}
function reportRecipientSave(user, email, active) {
  if (!isManager(user)) throw new Error('Reports are for supervisors');
  email = clean(email, 120).toLowerCase();
  if (!reportEmailOk(email)) throw new Error('Enter one valid email address');
  const sh = tasksBook().getSheetByName(REPORT_TAB), old = reportRows().filter(r => r['Email'] === email)[0];
  if (!old && reportRows().length >= 10) throw new Error('At most 10 recipients');
  const vals = [email, active ? 'Yes' : 'No', old ? old['Added By'] : user.username, old ? old['Added'] : nowText(), old ? old['Last Sent'] : ''];
  sh.getRange(old ? old._row : sh.getLastRow() + 1, 1, 1, REPORT_COLS.length).setNumberFormat('@').setValues([vals]);
  return { ok: true };
}
/** Every Sunday (first working day) the last 7 days go to each active recipient, once. */
function weeklyReports(today) {
  if (isoToDate(today).getUTCDay() !== 0) return 0;
  const list = reportRows().filter(r => r['Active'] !== 'No' && r['Last Sent'] !== today);
  if (!list.length) return 0;
  const boss = { username: 'system', role: 'Supervisor' };
  const r = report(boss, { from: addDays(today, -7), to: addDays(today, -1) });
  const sh = tasksBook().getSheetByName(REPORT_TAB), col = REPORT_COLS.indexOf('Last Sent') + 1;
  let n = 0;
  list.forEach(x => { try { sendReport(x['Email'], r, 'system'); sh.getRange(x._row, col).setNumberFormat('@').setValue(today); n++; } catch (err) {} });
  return n;
}

/* ================= v18: Work requests, comments with @mentions, several assets, signatures, voice notes ================= */
function parseAssets(v) { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a.filter(x => x && x.no) : []; } catch (e) { return []; } }
/** Extra assets on a work order (besides the main one): up to 8, each looked up by number. */
function cleanAssets(list, t) {
  if (!Array.isArray(list)) throw new Error('Assets must be a list');
  const out = [], seen = {}; seen[lc(t['Equipment No'])] = true;
  list.forEach(x => {
    const no = clean(x && x.no, 60);
    if (!no || seen[lc(no)]) return;
    seen[lc(no)] = true;
    let found = null; try { found = assetByNo(no); } catch (e) {}
    out.push({ no: no, name: found ? found.name : clean(x.name, 120) || no });
  });
  if (out.length > 8) throw new Error('At most 8 extra assets');
  return out.length ? JSON.stringify(out) : '';
}
function cleanSignature(v) {
  if (v == null || v === '') return '';
  const x = String(v);
  if (!/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(x)) throw new Error('The signature is not a valid image');
  if (x.length > 45000) throw new Error('The signature is too large');
  return x;
}
function taskSignature(user, id) {
  const t = findTask(id);
  if (!(isManager(user) || lc(t['Assigned To']) === lc(user.username) || lc(t['Created By']) === lc(user.username))) throw new Error('You do not have permission to see this signature');
  if (!t['Signature']) return { ok: true, signature: '' };
  return { ok: true, signature: t['Signature'], name: t['Signed Name'] || '', at: t['Done'] };
}
function assetsLookup(user, q) {
  const s = lc(q), out = [];
  equipmentList(false).forEach(e => {
    if (!e.no) return;
    if (s && [e.no, e.name, e.line].join(' ').toLowerCase().indexOf(s) < 0) return;
    out.push({ no: e.no, name: e.name, line: e.line });
  });
  return { ok: true, assets: out.slice(0, 30), more: Math.max(0, out.length - 30) };
}

/* ---- work requests ---- */
const requestRows = () => rowsOf(tasksBook().getSheetByName(REQ_TAB), REQ_COLS).filter(r => r['Request ID']);
const requestOut = r => ({ id: r['Request ID'], created: r['Created'], by: r['By'], name: r['Name'], title: r['Title'], details: r['Details'], assetNo: r['Asset No'], asset: r['Asset'],
  urgency: r['Urgency'] || 'Normal', photo: r['Photo'], status: r['Status'], decidedBy: r['Decided By'], decided: r['Decided'], note: r['Decision Note'], order: r['Work Order'] });
function requestCreate(user, f) {
  f = f || {};
  const title = clean(f.title, 140);
  if (!title) throw new Error('Describe the problem in a few words');
  if (requestRows().filter(r => lc(r['By']) === lc(user.username) && r['Status'] === 'Pending').length >= 10) throw new Error('You already have 10 requests waiting — wait for the supervisor to answer');
  let asset = null; const no = clean(f.assetNo, 60);
  if (no) { try { asset = assetByNo(no); } catch (e) {} }
  const photo = String(f.photo || '').trim();
  if (photo && !/^https:\/\/[^\s]+$/.test(photo)) throw new Error('The photo link is not valid');
  const p = props(), seq = Number(p.getProperty('REQ_SEQ') || 0) + 1;
  p.setProperty('REQ_SEQ', String(seq));
  const id = 'R-' + ('000' + seq).slice(-4), now = nowText();
  const urgency = PRIORITIES.indexOf(f.urgency) >= 0 ? f.urgency : 'Normal';
  const vals = [id, now, user.username, user.name, title, clean(f.details, 1000), no, asset ? asset.name : clean(f.asset, 120), urgency, photo.slice(0, 300), 'Pending', '', '', '', ''];
  const sh = tasksBook().getSheetByName(REQ_TAB);
  sh.getRange(sh.getLastRow() + 1, 1, 1, REQ_COLS.length).setNumberFormat('@').setValues([vals]);
  usersTable().filter(u => u.active && MANAGER_ROLES.indexOf(u.role) >= 0 && lc(u.username) !== lc(user.username))
    .forEach(u => notifyUser(u.username, { kind: 'request', id: id, title: title, by: user.name, priority: urgency }));
  return { ok: true, id: id };
}
function requestList(user) {
  const mgr = isManager(user);
  const rows = requestRows().filter(r => mgr || lc(r['By']) === lc(user.username)).map(requestOut)
    .sort((a, b) => (a.status === 'Pending' ? 0 : 1) - (b.status === 'Pending' ? 0 : 1) || String(b.created).localeCompare(String(a.created)));
  return { ok: true, requests: rows.slice(0, 200), canDecide: mgr };
}
function requestDecide(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can answer requests');
  f = f || {};
  const r = requestRows().filter(x => x['Request ID'] === String(f.id || ''))[0];
  if (!r) throw new Error('Request not found');
  if (r['Status'] !== 'Pending') throw new Error('This request was already answered');
  const sh = tasksBook().getSheetByName(REQ_TAB), set = (c, v) => { r[c] = v; };
  let order = '';
  if (f.decision === 'approve') {
    const out = taskCreate(user, { title: r['Title'], assignee: f.assignee, priority: f.priority || r['Urgency'], due: f.due, category: f.category,
      details: ('Request ' + r['Request ID'] + ' from ' + r['Name'] + (r['Details'] ? ': ' + r['Details'] : '') + (r['Photo'] ? '\nPhoto: ' + r['Photo'] : '')).slice(0, 2000),
      equipment: r['Asset'], equipmentNo: r['Asset No'] });
    order = out.task.id; set('Status', 'Approved');
  } else if (f.decision === 'decline') {
    const note = clean(f.note, 300);
    if (!note) throw new Error('Write the reason for declining');
    set('Status', 'Declined'); set('Decision Note', note);
  } else throw new Error('Choose approve or decline');
  set('Decided By', user.username); set('Decided', nowText()); set('Work Order', order);
  sh.getRange(r._row, 1, 1, REQ_COLS.length).setNumberFormat('@').setValues([REQ_COLS.map(c => r[c] == null ? '' : String(r[c]))]);
  notifyUser(r['By'], { kind: 'requestDecision', id: r['Request ID'], title: r['Title'], status: r['Status'], order: order, by: user.name });
  return { ok: true, status: r['Status'], order: order };
}

/* ---- comments and @mentions ---- */
const commentRows = id => rowsOf(tasksBook().getSheetByName(COMMENT_TAB), COMMENT_COLS).filter(r => r['Task ID'] === id);
function canCommentOn(user, t) {
  return isManager(user) || lc(t['Assigned To']) === lc(user.username) || lc(t['Created By']) === lc(user.username) ||
    commentRows(t['ID']).some(r => String(r['Mentions']).split(',').map(lc).indexOf(lc(user.username)) >= 0);
}
const commentOut = r => ({ id: r['Comment ID'], at: r['Timestamp'], by: r['By'], name: r['Name'], text: r['Text'], mentions: String(r['Mentions'] || '').split(',').filter(Boolean), audio: r['Audio'] });
function commentsList(user, id) {
  const t = findTask(id);
  if (!canCommentOn(user, t)) throw new Error('You do not have permission to see the comments of this work order');
  const list = commentRows(t['ID']).map(commentOut).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return { ok: true, comments: list, people: usersTable().filter(u => u.active).map(u => ({ username: u.username, name: u.name })) };
}
function uploadVoice(user, taskId, dataUrl) {
  const m = String(dataUrl || '').match(/^data:audio\/([\w.+-]+)(?:;codecs=[\w.,+-]+)?;base64,([A-Za-z0-9+\/=]+)$/);
  if (!m) throw new Error('Not a voice note');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 3 * 1024 * 1024) throw new Error('The voice note is too long');
  const root = DriveApp.getFolderById(props().getProperty('PHOTOS_FOLDER_ID'));
  const it = root.getFoldersByName('Voice');
  const folder = it.hasNext() ? it.next() : root.createFolder('Voice');
  const ext = /mp4|aac/.test(m[1]) ? 'm4a' : /ogg/.test(m[1]) ? 'ogg' : /wav/.test(m[1]) ? 'wav' : /mpeg/.test(m[1]) ? 'mp3' : 'webm';
  const name = [String(taskId).replace(/[^\w.-]+/g, '-'), Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HHmmss'), String(user.username).replace(/[^\w.-]+/g, '-')].join('_') + '.' + ext;
  const file = folder.createFile(Utilities.newBlob(bytes, 'audio/' + m[1], name));
  return file.getUrl();
}
function commentAdd(user, f) {
  f = f || {};
  const t = findTask(f.id);
  if (!canCommentOn(user, t)) throw new Error('You do not have permission to comment on this work order');
  const text = clean(f.text, 1000), audio = f.audio ? uploadVoice(user, t['ID'], f.audio) : '';
  if (!text && !audio) throw new Error('Write a comment');
  if (commentRows(t['ID']).length >= 300) throw new Error('This work order has too many comments');
  const users = usersTable().filter(u => u.active), byName = {}; users.forEach(u => { byName[lc(u.username)] = u; });
  const ment = []; (text.match(/@[\w.-]+/g) || []).forEach(x => { const u = byName[lc(x.slice(1).replace(/[.-]+$/, ''))]; if (u && lc(u.username) !== lc(user.username) && ment.indexOf(u.username) < 0) ment.push(u.username); });
  const sh = tasksBook().getSheetByName(COMMENT_TAB), id = 'C' + String(sh.getLastRow()).padStart(4, '0');
  sh.getRange(sh.getLastRow() + 1, 1, 1, COMMENT_COLS.length).setNumberFormat('@').setValues([[id, nowText(), t['ID'], user.username, user.name, text, ment.join(','), audio]]);
  const notify = {}; ment.forEach(u => { notify[u] = 'mention'; });
  [t['Assigned To'], t['Created By']].forEach(u => { if (u && lc(u) !== lc(user.username) && !notify[u]) notify[u] = 'comment'; });
  Object.keys(notify).forEach(u => notifyUser(u, { kind: notify[u], id: t['ID'], title: t['Title'], by: user.name, text: text.slice(0, 80) }));
  return { ok: true, id: id, mentions: ment };
}

/* ================= Release 7: procedures, purchase orders, scheduling ================= */
const PROC_TAB = 'Procedures';
const PROC_COLS = ['Procedure ID', 'Name', 'Category', 'Steps', 'Active', 'Fail Assignee', 'Created By', 'Created', 'Updated'];
const RUN_TAB = 'Procedure Runs';
const RUN_COLS = ['Run ID', 'Procedure ID', 'Procedure', 'Task ID', 'Asset No', 'Asset', 'By', 'Name', 'Completed', 'Answers', 'Failed', 'Result', 'Failure Order'];
const PO_TAB = 'Purchase Orders';
const PO_COLS = ['PO ID', 'Created', 'By', 'Name', 'Vendor ID', 'Vendor', 'Lines', 'Total', 'Status', 'Note', 'Decided By', 'Decided', 'Decision Note', 'Ordered', 'Received'];
const AVAIL_TAB = 'Availability';
const AVAIL_COLS = ['User', 'Work Days', 'Hours Per Day', 'Updated'];
const OFF_TAB = 'Time Off';
const OFF_COLS = ['Off ID', 'User', 'Name', 'From', 'To', 'Type', 'Note', 'By', 'Created'];
const OFF_TYPES = ['Leave', 'Sick', 'Off shift', 'Training'];
const STEP_TYPES = ['passfail', 'check', 'number', 'text'];
const DEFAULT_WORK_DAYS = [0, 1, 2, 3, 4];   // Sunday to Thursday
const nextSeq = (key, prefix, pad) => {
  const p = props(), n = Number(p.getProperty(key) || 0) + 1;
  p.setProperty(key, String(n));
  return prefix + ('0000' + n).slice(-pad);
};
const putRow = (tab, cols, o) => {
  const sh = tasksBook().getSheetByName(tab), r = o._row || sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, cols.length).setNumberFormat('@').setValues([cols.map(c => o[c] == null ? '' : String(o[c]))]);
  o._row = r; return o;
};
const addDaysIso = (iso, n) => Utilities.formatDate(new Date(isoToDate(iso).getTime() + n * 864e5), TZ, 'yyyy-MM-dd');
const weekdayOf = iso => isoToDate(iso).getUTCDay();

/* ---- procedures (checklists with pass/fail, numbers and conditional steps) ---- */
const procRows = () => rowsOf(tasksBook().getSheetByName(PROC_TAB), PROC_COLS).filter(r => r['Procedure ID']);
function parseJson(s, fallback) { try { const v = JSON.parse(s || ''); return v == null ? fallback : v; } catch (e) { return fallback; } }
const procOut = r => ({ id: r['Procedure ID'], name: r['Name'], category: r['Category'], steps: parseJson(r['Steps'], []), active: r['Active'] !== 'No', failAssignee: r['Fail Assignee'], updated: r['Updated'] });
function cleanSteps(list) {
  if (!Array.isArray(list) || !list.length) throw new Error('Add at least one step');
  if (list.length > 40) throw new Error('A procedure can have up to 40 steps');
  return list.map((s, i) => {
    s = s || {};
    const text = clean(s.text, 200);
    if (!text) throw new Error('Step ' + (i + 1) + ' needs some text');
    const st = { id: 's' + (i + 1), text: text, type: STEP_TYPES.indexOf(s.type) >= 0 ? s.type : 'passfail', required: !(s.required === false || s.required === 'false') };
    if (st.type === 'number') {
      st.unit = clean(s.unit, 12);
      ['min', 'max'].forEach(k => {
        if (s[k] === undefined || s[k] === null || String(s[k]).trim() === '') return;
        const n = Number(String(s[k]).replace(',', '.'));
        if (!isFinite(n)) throw new Error('Step ' + (i + 1) + ': ' + k + ' must be a number');
        st[k] = n;
      });
      if (st.min !== undefined && st.max !== undefined && st.min > st.max) throw new Error('Step ' + (i + 1) + ': the minimum is above the maximum');
    }
    if (s.showIf && s.showIf.step) {
      const n = Number(String(s.showIf.step).replace(/^s/, ''));
      if (!(n >= 1 && n <= i) || !isFinite(n)) throw new Error('Step ' + (i + 1) + ': a condition must depend on an earlier step');
      if ((list[n - 1].type || 'passfail') !== 'passfail') throw new Error('Step ' + (i + 1) + ': a condition can depend only on a pass/fail step');
      st.showIf = { step: 's' + n, when: s.showIf.when === 'pass' ? 'pass' : 'fail' };
    }
    return st;
  });
}
/** Checks a run's answers against the steps (hidden steps are skipped) and lists what failed. */
function procEvaluate(steps, answers) {
  answers = answers && typeof answers === 'object' ? answers : {};
  const shown = {}, result = {}, out = {}, failed = [];
  steps.forEach(s => {
    if (s.showIf && !(shown[s.showIf.step] && result[s.showIf.step] === s.showIf.when)) { shown[s.id] = false; return; }
    shown[s.id] = true;
    const a = answers[s.id] && typeof answers[s.id] === 'object' ? answers[s.id] : {}, note = clean(a.note, 300);
    let v = a.v, res = 'pass';
    if (s.type === 'passfail') {
      if (v !== 'pass' && v !== 'fail') { if (s.required) throw new Error('Answer this step: ' + s.text); res = 'skip'; v = ''; }
      else if (v === 'fail') { if (!note) throw new Error('Write a note for the failed step: ' + s.text); res = 'fail'; failed.push({ id: s.id, text: s.text, why: note }); }
    } else if (s.type === 'check') {
      v = v === true || v === 'true';
      if (!v) { if (s.required) throw new Error('Tick this step: ' + s.text); res = 'skip'; }
    } else if (s.type === 'number') {
      const raw = String(v == null ? '' : v).trim().replace(',', '.');
      if (raw === '') { if (s.required) throw new Error('Enter a value: ' + s.text); res = 'skip'; v = ''; }
      else {
        const n = Number(raw);
        if (!isFinite(n)) throw new Error('Enter a number: ' + s.text);
        v = n;
        if ((s.min !== undefined && n < s.min) || (s.max !== undefined && n > s.max)) {
          res = 'fail'; failed.push({ id: s.id, text: s.text, why: n + (s.unit ? ' ' + s.unit : '') + ' is outside ' + (s.min !== undefined ? s.min : '…') + ' – ' + (s.max !== undefined ? s.max : '…') });
        }
      }
    } else {
      v = clean(v, 500);
      if (!v && s.required) throw new Error('Write an answer: ' + s.text);
      if (!v) res = 'skip';
    }
    result[s.id] = res; out[s.id] = { v: v, note: note };
  });
  return { answers: out, failed: failed, result: result, shown: shown };
}
function procedureList(user) {
  const mgr = isManager(user);
  return { ok: true, procedures: procRows().map(procOut).filter(p => mgr || p.active), canEdit: mgr };
}
function procedureSave(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can change procedures');
  f = f || {};
  const name = clean(f.name, 80);
  if (!name) throw new Error('Enter a procedure name');
  const steps = cleanSteps(f.steps);
  let fail = clean(f.failAssignee, 60);
  if (fail && !assignable().some(u => lc(u.username) === lc(fail))) throw new Error('Choose who gets the work order when a step fails');
  let r = f.id ? procRows().filter(x => x['Procedure ID'] === String(f.id))[0] : null;
  if (f.id && !r) throw new Error('Procedure not found');
  const now = nowText();
  if (!r) r = { 'Procedure ID': nextSeq('PROC_SEQ', 'P-', 3), 'Created By': user.username, 'Created': now };
  Object.assign(r, { 'Name': name, 'Category': CATEGORIES.indexOf(f.category) >= 0 ? f.category : '', 'Steps': JSON.stringify(steps), 'Active': f.active === false || f.active === 'false' ? 'No' : 'Yes', 'Fail Assignee': fail, 'Updated': now });
  putRow(PROC_TAB, PROC_COLS, r);
  return { ok: true, procedure: procOut(r) };
}
const runRows = () => rowsOf(tasksBook().getSheetByName(RUN_TAB), RUN_COLS).filter(r => r['Run ID']);
const runOut = r => ({ id: r['Run ID'], procedureId: r['Procedure ID'], procedure: r['Procedure'], taskId: r['Task ID'], assetNo: r['Asset No'], asset: r['Asset'], by: r['By'], name: r['Name'], at: r['Completed'], failed: Number(r['Failed'] || 0), result: r['Result'], order: r['Failure Order'] });
function procedureRun(user, f) {
  f = f || {};
  const pr = procRows().filter(r => r['Procedure ID'] === String(f.procedureId || ''))[0];
  if (!pr || pr['Active'] === 'No') throw new Error('Procedure not found');
  const steps = parseJson(pr['Steps'], []);
  let t = null;
  if (f.taskId) {
    t = findTask(f.taskId);
    if (lc(t['Assigned To']) !== lc(user.username) && !isManager(user)) throw new Error('This work order is assigned to someone else');
    if (t['Status'] === 'Done' || t['Status'] === 'Cancelled') throw new Error('This work order is finished');
    if (t['Procedure'] && t['Procedure'] !== pr['Procedure ID']) throw new Error('This work order uses another procedure');
    if (runRows().some(r => r['Task ID'] === t['ID'])) throw new Error('This procedure was already completed for this work order');
  }
  const no = clean(f.assetNo, 60) || (t ? t['Equipment No'] : '');
  let asset = null; if (no) { try { asset = assetByNo(no); } catch (e) {} }
  const ev = procEvaluate(steps, f.answers);
  const id = nextSeq('RUN_SEQ', 'RN-', 4), now = nowText();
  let order = '';
  if (ev.failed.length) {
    const pool = assignable();
    const pick = [pr['Fail Assignee'], t ? t['Assigned To'] : '', user.username].filter(Boolean).map(lc)
      .map(n => pool.filter(u => lc(u.username) === n)[0]).filter(Boolean)[0] || pool[0];
    if (pick) {
      const made = taskCreateCore(user, {
        title: ('Failed check: ' + pr['Name'] + (asset ? ' — ' + asset.name : '')).slice(0, 140), assignee: pick.username, priority: 'High', category: pr['Category'],
        details: ('Run ' + id + (t ? ' (work order ' + t['ID'] + ')' : '') + ' found ' + ev.failed.length + ' problem(s):\n' + ev.failed.map(x => '- ' + x.text + ': ' + x.why).join('\n')).slice(0, 2000),
        equipment: asset ? asset.name : (t ? t['Equipment'] : ''), equipmentNo: no, source: 'Procedure'
      }, false);
      order = made.task.id;
    }
  }
  putRow(RUN_TAB, RUN_COLS, { 'Run ID': id, 'Procedure ID': pr['Procedure ID'], 'Procedure': pr['Name'], 'Task ID': t ? t['ID'] : '', 'Asset No': no, 'Asset': asset ? asset.name : (t ? t['Equipment'] : ''),
    'By': user.username, 'Name': user.name, 'Completed': now, 'Answers': JSON.stringify(ev.answers), 'Failed': ev.failed.length, 'Result': ev.failed.length ? 'Failed' : 'Passed', 'Failure Order': order });
  if (ev.failed.length) usersTable().filter(u => u.active && isManager(u) && lc(u.username) !== lc(user.username))
    .forEach(u => notifyUser(u.username, { kind: 'procedureFail', id: id, title: pr['Name'], by: user.name, count: ev.failed.length }));
  return { ok: true, run: id, failed: ev.failed.length, order: order, problems: ev.failed };
}
function procedureRuns(user, f) {
  f = f || {};
  const mgr = isManager(user);
  let rows = runRows().filter(r => mgr || lc(r['By']) === lc(user.username));
  if (f.taskId) rows = rows.filter(r => r['Task ID'] === String(f.taskId));
  if (f.procedureId) rows = rows.filter(r => r['Procedure ID'] === String(f.procedureId));
  if (f.assetNo) rows = rows.filter(r => r['Asset No'] === String(f.assetNo));
  rows.sort((a, b) => String(b['Completed']).localeCompare(String(a['Completed'])));
  return { ok: true, runs: rows.slice(0, 100).map(runOut) };
}
/** Everything a printed audit sheet needs for one run: answers, the work order, its photo and signature. */
function procedureAudit(user, f) {
  const r = runRows().filter(x => x['Run ID'] === String((f || {}).id || ''))[0];
  if (!r) throw new Error('Run not found');
  if (!isManager(user) && lc(r['By']) !== lc(user.username)) throw new Error('You do not have permission to see this run');
  const pr = procRows().filter(x => x['Procedure ID'] === r['Procedure ID'])[0];
  const steps = pr ? parseJson(pr['Steps'], []) : [], answers = parseJson(r['Answers'], {});
  const rows = steps.filter(s => answers[s.id] !== undefined).map(s => {
    const a = answers[s.id], v = a.v;
    const res = s.type === 'passfail' ? (v === 'pass' || v === 'fail' ? v : 'skip') : s.type === 'check' ? (v ? 'pass' : 'skip')
      : s.type === 'number' ? (v === '' ? 'skip' : ((s.min !== undefined && v < s.min) || (s.max !== undefined && v > s.max) ? 'fail' : 'pass')) : (v ? 'pass' : 'skip');
    return { text: s.text, type: s.type, unit: s.unit || '', answer: s.type === 'check' ? (v ? 'Done' : '') : v, note: a.note || '', result: res };
  });
  let task = null;
  if (r['Task ID']) { try { const t = findTask(r['Task ID']); task = { id: t['ID'], title: t['Title'], status: t['Status'], done: t['Done'], photo: /^https:/.test(t['Done Photo']) ? t['Done Photo'] : '', signature: t['Signature'] || '', signedName: t['Signed Name'] || '', assignee: t['Assignee Name'] }; } catch (e) {} }
  return { ok: true, run: runOut(r), steps: rows, task: task };
}

/* ---- purchase orders ---- */
const poRows = () => rowsOf(tasksBook().getSheetByName(PO_TAB), PO_COLS).filter(r => r['PO ID']);
const poOut = r => ({ id: r['PO ID'], created: r['Created'], by: r['By'], name: r['Name'], vendorId: r['Vendor ID'], vendor: r['Vendor'], lines: parseJson(r['Lines'], []), total: numOf(r['Total']),
  status: r['Status'], note: r['Note'], decidedBy: r['Decided By'], decided: r['Decided'], decisionNote: r['Decision Note'], ordered: r['Ordered'], received: r['Received'] });
const poFind = id => { const r = poRows().filter(x => x['PO ID'] === String(id || ''))[0]; if (!r) throw new Error('Purchase order not found'); return r; };
const poTotal = lines => round3(lines.reduce((s, l) => s + l.qty * (l.cost || 0), 0));
const poSummary = lines => lines.length + ' part' + (lines.length === 1 ? '' : 's');
function poList(user) {
  if (!canUseParts(user)) throw new Error('You do not have permission to see purchase orders');
  const open = s => (s === 'Requested' ? 0 : s === 'Approved' ? 1 : s === 'Ordered' || s === 'Partly received' ? 2 : 3);
  const list = poRows().map(poOut).sort((a, b) => open(a.status) - open(b.status) || String(b.created).localeCompare(String(a.created)));
  return { ok: true, orders: list.slice(0, 200), canDecide: isManager(user) };
}
function poCreate(user, f) {
  if (!canUseParts(user)) throw new Error('You do not have permission to request parts');
  f = f || {};
  if (!Array.isArray(f.lines) || !f.lines.length) throw new Error('Add at least one part');
  if (f.lines.length > 30) throw new Error('A purchase order can have up to 30 parts');
  const seen = {}, st = {}; stockRows().forEach(r => { st[r['Key']] = stockOut(r); });
  const lines = f.lines.map(l => {
    l = l || {};
    const p = partFind(l.kind, l.no);
    if (seen[p.key]) throw new Error('Part ' + p.no + ' is listed twice');
    seen[p.key] = true;
    const known = st[p.key] && st[p.key].cost !== null ? st[p.key].cost : 0;
    return { kind: p.kind, no: p.no, name: p.name, qty: qtyOf(l.qty), cost: l.cost === undefined || String(l.cost).trim() === '' ? known : numOf(cleanCost(l.cost)), got: 0 };
  });
  let vendor = null;
  if (f.vendorId) { vendor = vendorRows().filter(v => v['Vendor ID'] === String(f.vendorId))[0]; if (!vendor) throw new Error('Supplier not found'); }
  const id = nextSeq('PO_SEQ', 'PO-', 4);
  const r = putRow(PO_TAB, PO_COLS, { 'PO ID': id, 'Created': nowText(), 'By': user.username, 'Name': user.name, 'Vendor ID': vendor ? vendor['Vendor ID'] : '', 'Vendor': vendor ? vendor['Name'] : '',
    'Lines': JSON.stringify(lines), 'Total': poTotal(lines), 'Status': 'Requested', 'Note': clean(f.note, 300) });
  usersTable().filter(u => u.active && isManager(u) && lc(u.username) !== lc(user.username))
    .forEach(u => notifyUser(u.username, { kind: 'po', id: id, title: poSummary(lines) + (r['Vendor'] ? ' · ' + r['Vendor'] : ''), by: user.name }));
  return { ok: true, id: id, order: poOut(r) };
}
function poDecide(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can approve purchase orders');
  f = f || {};
  const r = poFind(f.id);
  if (r['Status'] !== 'Requested') throw new Error('This purchase order was already answered');
  if (f.decision === 'approve') r['Status'] = 'Approved';
  else if (f.decision === 'reject') {
    const note = clean(f.note, 300);
    if (!note) throw new Error('Write the reason for rejecting');
    r['Status'] = 'Rejected'; r['Decision Note'] = note;
  } else throw new Error('Choose approve or reject');
  r['Decided By'] = user.username; r['Decided'] = nowText();
  putRow(PO_TAB, PO_COLS, r);
  notifyUser(r['By'], { kind: 'poDecision', id: r['PO ID'], title: poSummary(parseJson(r['Lines'], [])), status: r['Status'], by: user.name });
  return { ok: true, order: poOut(r) };
}
function poOrder(user, f) {
  if (!canUseParts(user)) throw new Error('You do not have permission to change purchase orders');
  const r = poFind((f || {}).id);
  if (r['Status'] !== 'Approved') throw new Error('Only an approved purchase order can be marked as ordered');
  r['Status'] = 'Ordered'; r['Ordered'] = nowText();
  putRow(PO_TAB, PO_COLS, r);
  return { ok: true, order: poOut(r) };
}
function poReceive(user, f) {
  if (!canUseParts(user)) throw new Error('You do not have permission to receive parts');
  f = f || {};
  const r = poFind(f.id);
  if (r['Status'] !== 'Ordered' && r['Status'] !== 'Partly received') throw new Error('This purchase order is not waiting for delivery');
  const lines = parseJson(r['Lines'], []);
  const take = Array.isArray(f.lines) && f.lines.length ? f.lines.map(x => ({ i: Number(x && x.index), q: qtyOf(x && x.qty, 'Received quantity') }))
    : lines.map((l, i) => ({ i: i, q: round3(l.qty - l.got) })).filter(x => x.q > 0);
  if (!take.length) throw new Error('Nothing left to receive');
  take.forEach(x => {
    const l = lines[x.i];
    if (!l) throw new Error('Line not found');
    if (x.q > round3(l.qty - l.got)) throw new Error(l.no + ': only ' + round3(l.qty - l.got) + ' still expected');
    partFind(l.kind, l.no);   // stop before anything changes if a part was deleted
  });
  take.forEach(x => { const l = lines[x.i]; partReceive(user, { kind: l.kind, no: l.no, qty: x.q, cost: l.cost, note: 'PO ' + r['PO ID'] }); l.got = round3(l.got + x.q); });
  const all = lines.every(l => l.got >= l.qty);
  r['Lines'] = JSON.stringify(lines); r['Status'] = all ? 'Received' : 'Partly received'; if (all) r['Received'] = nowText();
  putRow(PO_TAB, PO_COLS, r);
  return { ok: true, order: poOut(r) };
}
function poCancel(user, f) {
  const r = poFind((f || {}).id);
  const lines = parseJson(r['Lines'], []);
  if (['Received', 'Rejected', 'Cancelled'].indexOf(r['Status']) >= 0) throw new Error('This purchase order is already closed');
  if (lines.some(l => l.got > 0)) throw new Error('Some parts were already received — it cannot be cancelled');
  if (!(isManager(user) || (r['Status'] === 'Requested' && lc(r['By']) === lc(user.username)))) throw new Error('You do not have permission to cancel this purchase order');
  r['Status'] = 'Cancelled'; r['Decided By'] = user.username; r['Decided'] = nowText(); r['Decision Note'] = clean((f || {}).note, 300);
  putRow(PO_TAB, PO_COLS, r);
  return { ok: true, order: poOut(r) };
}

/* ---- scheduling: shifts, time off, workload, job time estimates ---- */
const availRows = () => rowsOf(tasksBook().getSheetByName(AVAIL_TAB), AVAIL_COLS).filter(r => r['User']);
const offRows = () => rowsOf(tasksBook().getSheetByName(OFF_TAB), OFF_COLS).filter(r => r['Off ID']);
function availOf(username, rows) {
  const r = (rows || availRows()).filter(x => lc(x['User']) === lc(username))[0];
  const days = r ? String(r['Work Days']).split(',').filter(s => s !== '').map(Number).filter(n => n >= 0 && n <= 6) : DEFAULT_WORK_DAYS;
  const h = r && r['Hours Per Day'] !== '' ? numOf(r['Hours Per Day']) : 8;
  return { days: days, hours: h };
}
/** 'work', or why the person is not available that day. */
function dayStatus(username, iso, av, offs) {
  const o = (offs || offRows()).filter(x => lc(x['User']) === lc(username) && x['From'] <= iso && x['To'] >= iso)[0];
  if (o) return { status: 'off', reason: o['Type'] };
  if ((av || availOf(username)).days.indexOf(weekdayOf(iso)) < 0) return { status: 'rest', reason: 'Day off' };
  return { status: 'work', reason: '' };
}
function offWarning(username, iso) {
  if (!iso) return '';
  const s = dayStatus(username, iso);
  return s.status === 'work' ? '' : (usersTable().filter(u => lc(u.username) === lc(username)).map(u => u.name)[0] || username) + ' is not working on ' + iso + ' (' + s.reason + ')';
}
function availabilitySave(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can change shifts');
  f = f || {};
  const who = assignable().filter(u => lc(u.username) === lc(f.username))[0];
  if (!who) throw new Error('Choose a person');
  const days = (Array.isArray(f.workDays) ? f.workDays : []).map(Number).filter((n, i, a) => n >= 0 && n <= 6 && a.indexOf(n) === i).sort();
  const hours = Number(f.hours);
  if (!isFinite(hours) || hours < 0 || hours > 24) throw new Error('Hours per day must be between 0 and 24');
  const old = availRows().filter(x => lc(x['User']) === lc(who.username))[0] || { 'User': who.username };
  Object.assign(old, { 'Work Days': days.join(','), 'Hours Per Day': String(hours), 'Updated': nowText() });
  putRow(AVAIL_TAB, AVAIL_COLS, old);
  return { ok: true };
}
function timeOffAdd(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can record time off');
  f = f || {};
  const who = assignable().filter(u => lc(u.username) === lc(f.username))[0];
  if (!who) throw new Error('Choose a person');
  const from = cleanDate(f.from), to = cleanDate(f.to || f.from);
  if (!from || !to) throw new Error('Choose the dates');
  if (to < from) throw new Error('The end date is before the start date');
  if (dayDiff(from, to) > 366) throw new Error('Time off can be up to a year');
  const id = nextSeq('OFF_SEQ', 'O-', 3);
  putRow(OFF_TAB, OFF_COLS, { 'Off ID': id, 'User': who.username, 'Name': who.name, 'From': from, 'To': to, 'Type': OFF_TYPES.indexOf(f.type) >= 0 ? f.type : 'Leave', 'Note': clean(f.note, 200), 'By': user.username, 'Created': nowText() });
  const clash = readTasks().filter(t => (t['Status'] === 'Open' || t['Status'] === 'In progress') && lc(t['Assigned To']) === lc(who.username) && t['Due'] >= from && t['Due'] <= to).map(t => t['ID']);
  return { ok: true, id: id, clashes: clash };
}
function timeOffDelete(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can record time off');
  const r = offRows().filter(x => x['Off ID'] === String((f || {}).id || ''))[0];
  if (!r) throw new Error('Time off not found');
  tasksBook().getSheetByName(OFF_TAB).deleteRow(r._row);
  return { ok: true };
}
function availabilityList(user) {
  if (!isManager(user)) throw new Error('Only a supervisor can see shifts');
  const av = availRows(), today = todayIso();
  return { ok: true,
    people: assignable().map(u => { const a = availOf(u.username, av); return { username: u.username, name: u.name, role: u.role, workDays: a.days, hours: a.hours }; }),
    timeOff: offRows().filter(r => r['To'] >= today).sort((a, b) => a['From'].localeCompare(b['From']))
      .map(r => ({ id: r['Off ID'], username: r['User'], name: r['Name'], from: r['From'], to: r['To'], type: r['Type'], note: r['Note'] })) };
}
/** Typical hours for a job like this one, from finished work orders: same machine and title, then machine, title, category. */
function estimateFor(t, done) {
  const hrs = r => Number(r['Hours']);
  const ok = r => r['Status'] === 'Done' && r['Hours'] !== '' && isFinite(hrs(r)) && hrs(r) > 0 && r['ID'] !== t['ID'];
  const pools = [
    ['same machine and job', r => t['Equipment No'] && r['Equipment No'] === t['Equipment No'] && lc(r['Title']) === lc(t['Title'])],
    ['same machine', r => t['Equipment No'] && r['Equipment No'] === t['Equipment No']],
    ['same job', r => t['Title'] && lc(r['Title']) === lc(t['Title'])],
    ['same category', r => t['Category'] && r['Category'] === t['Category']]
  ];
  for (let i = 0; i < pools.length; i++) {
    const m = done.filter(r => ok(r) && pools[i][1](r));
    if (m.length) return { hours: Math.round(m.reduce((s, r) => s + hrs(r), 0) / m.length * 4) / 4, n: m.length, basis: pools[i][0] };
  }
  return { hours: null, n: 0, basis: '' };
}
function estimate(user, f) {
  if (!isManager(user) && !canCreateTasks(user)) throw new Error('You do not have permission to create tasks');
  f = f || {};
  const e = estimateFor({ 'ID': '', 'Equipment No': clean(f.equipmentNo, 60), 'Title': clean(f.title, 140), 'Category': clean(f.category, 40) }, readTasks().filter(r => r['Status'] === 'Done'));
  return Object.assign({ ok: true }, e);
}
function weekStart(iso) { return addDaysIso(iso, -weekdayOf(iso)); }
function schedule(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can see the schedule');
  f = f || {};
  const today = todayIso(), from = cleanDate(f.from) || weekStart(today);
  const days = []; for (let i = 0; i < 7; i++) days.push(addDaysIso(from, i));
  const all = readTasks(), done = all.filter(t => t['Status'] === 'Done'), open = all.filter(t => t['Status'] === 'Open' || t['Status'] === 'In progress');
  const av = availRows(), offs = offRows();
  const est = {}; open.forEach(t => { est[t['ID']] = estimateFor(t, done); });
  const card = t => ({ id: t['ID'], title: t['Title'], priority: t['Priority'] || 'Normal', status: t['Status'], equipment: t['Equipment'], hours: est[t['ID']].hours, basis: est[t['ID']].basis, due: t['Due'], assignee: t['Assigned To'] });
  const people = assignable().map(u => {
    const a = availOf(u.username, av), mine = open.filter(t => lc(t['Assigned To']) === lc(u.username));
    const cells = days.map(d => {
      const s = dayStatus(u.username, d, a, offs), here = mine.filter(t => t['Due'] === d);
      return { date: d, status: s.status, reason: s.reason, capacity: s.status === 'work' ? a.hours : 0, load: round3(here.reduce((n, t) => n + (est[t['ID']].hours || 1), 0)), tasks: here.map(card) };
    });
    return { username: u.username, name: u.name, role: u.role, hours: a.hours, cells: cells,
      overdue: mine.filter(t => t['Due'] && t['Due'] < today).map(card), unscheduled: mine.filter(t => !t['Due']).map(card),
      later: mine.filter(t => t['Due'] > days[6]).length };
  });
  return { ok: true, from: from, days: days, today: today, people: people };
}
function scheduleMove(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can change the schedule');
  f = f || {};
  const t = findTask(f.id);
  if (t['Status'] !== 'Open' && t['Status'] !== 'In progress') throw new Error('Only open work orders can be moved');
  const due = f.due === '' ? '' : cleanDate(f.due);
  if (f.due !== '' && !due) throw new Error('Choose a date');
  const who = f.assignee || t['Assigned To'];
  if (due) {
    const s = dayStatus(who, due);
    if (s.status !== 'work' && !f.force) return { ok: false, conflict: true, reason: s.reason, error: offWarning(who, due) };
  }
  const out = taskEdit(user, { id: t['ID'], due: due, assignee: lc(who) !== lc(t['Assigned To']) ? who : undefined });
  return { ok: true, task: out.task, warning: due ? offWarning(who, due) : '' };
}

/* ===================== Release 8: cost per machine, public fault form, settings ===================== */
const SET_LABOR = 'COST_LABOR_RATE', SET_DOWN = 'COST_DOWN_RATE', SET_PUBLIC = 'PUBLIC_FORM';
const PUBLIC_BY = '(public)';
function settingsGet(user) {
  if (!isManager(user)) throw new Error('Only a supervisor can see the settings');
  const p = props();
  return { ok: true, laborRate: numOf(p.getProperty(SET_LABOR)), downtimeRate: numOf(p.getProperty(SET_DOWN)), publicForm: p.getProperty(SET_PUBLIC) === 'on',
           publicPending: requestRows().filter(r => r['By'] === PUBLIC_BY && r['Status'] === 'Pending').length, currency: 'SAR' };
}
function cleanRate(v) {
  if (v == null || String(v).trim() === '') return 0;
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n) || n < 0 || n > 100000) throw new Error('A rate must be a number from 0 to 100000');
  return Math.round(n * 100) / 100;
}
function settingsSave(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can change the settings');
  f = f || {};
  const p = props();
  if (f.laborRate !== undefined) p.setProperty(SET_LABOR, String(cleanRate(f.laborRate)));
  if (f.downtimeRate !== undefined) p.setProperty(SET_DOWN, String(cleanRate(f.downtimeRate)));
  if (f.publicForm !== undefined) p.setProperty(SET_PUBLIC, f.publicForm ? 'on' : 'off');
  return settingsGet(user);
}

/** Cost per machine for a period: spare parts used on its work orders (at the price stored when they were taken),
 *  labor hours x the hourly rate, and downtime hours x the downtime rate. Work orders that cover several machines share their cost equally. */
function costReport(user, f) {
  if (!isManager(user)) throw new Error('Only a supervisor can see maintenance cost');
  f = f || {};
  const today = todayIso();
  let to = cleanDate(f.to) || today, from = cleanDate(f.from);
  if (f.period) {                                         // presets are worked out here, so a phone in another time zone cannot shift the days
    to = today;
    from = f.period === 'month' ? today.slice(0, 8) + '01' : f.period === 'year' ? today.slice(0, 5) + '01-01'
         : addDaysIso(today, -(Math.max(1, Math.min(Number(f.period) || 90, 800)) - 1));
  }
  from = from || addDaysIso(to, -89);
  if (from > to) throw new Error('The start date is after the end date');
  if (addDaysIso(from, 800) < to) throw new Error('Choose a period of up to about 2 years');
  const p = props(), labor = numOf(p.getProperty(SET_LABOR)), downRate = numOf(p.getProperty(SET_DOWN));
  const tasks = readTasks(), byId = {};
  tasks.forEach(t => { byId[t['ID']] = t; });
  const rows = {}, bucket = (no, name) => {
    const k = no || ('n:' + lc(name || '')) ;
    return rows[k] || (rows[k] = { no: no || '', name: name || (no ? no : 'No machine'), parts: 0, labor: 0, hours: 0, downHours: 0, downCost: 0, orders: {}, unpriced: 0 });
  };
  const assetsOf = t => {
    const o = taskOut(t), list = [], seen = {};
    [{ no: o.equipmentNo, name: o.equipment }].concat((o.assets || []).map(a => ({ no: a.no, name: a.name }))).forEach(a => {
      const k = a.no || ('n:' + lc(a.name)); if ((a.no || a.name) && !seen[k]) { seen[k] = 1; list.push(a); }
    });
    return list.length ? list : [{ no: '', name: '' }];
  };
  const order = (b, t) => b.orders[t['ID']] || (b.orders[t['ID']] = { id: t['ID'], title: t['Title'], date: String(t['Done'] || t['Created'] || '').slice(0, 10), parts: 0, labor: 0, hours: 0 });
  rowsOf(tasksBook().getSheetByName(PART_LOG_TAB), PART_LOG_COLS).forEach(r => {
    if ((r['Type'] !== 'Used' && r['Type'] !== 'Returned') || !r['Work Order']) return;
    const d = String(r['Timestamp']).slice(0, 10); if (d < from || d > to) return;
    const t = byId[r['Work Order']]; if (!t) return;
    const qty = -numOf(r['Qty']), priced = r['Unit Cost'] !== '', amount = qty * numOf(r['Unit Cost']);
    const as = assetsOf(t);
    as.forEach(a => { const b = bucket(a.no, a.name); b.parts += amount / as.length; order(b, t).parts += amount / as.length; if (!priced && qty > 0) b.unpriced++; });
  });
  tasks.forEach(t => {
    if (t['Status'] !== 'Done') return;
    const h = numOf(t['Hours']); if (!(h > 0)) return;
    const d = String(t['Done'] || '').slice(0, 10); if (!d || d < from || d > to) return;
    const as = assetsOf(t);
    as.forEach(a => { const b = bucket(a.no, a.name); b.hours += h / as.length; b.labor += h * labor / as.length; const o = order(b, t); o.hours += h / as.length; o.labor += h * labor / as.length; });
  });
  const now = nowText();
  downtimeRows().forEach(r => {
    const d = String(r['Started']).slice(0, 10); if (d < from || d > to) return;
    const mins = r['Ended'] ? numOf(r['Minutes']) : minutesBetween(r['Started'], now);
    const b = bucket(r['Equipment No'], r['Equipment']);
    b.downHours += mins / 60; b.downCost += mins / 60 * downRate;
  });
  const list = Object.keys(rows).map(k => rows[k]).map(b => {
    const o = { no: b.no, name: b.name, parts: round2(b.parts), labor: round2(b.labor), hours: round2(b.hours), downHours: round2(b.downHours), downCost: round2(b.downCost),
                unpriced: b.unpriced, orderCount: Object.keys(b.orders).length };
    o.total = round2(o.parts + o.labor + o.downCost);
    if (f.no && b.no === String(f.no)) o.orders = Object.keys(b.orders).map(k => b.orders[k]).map(x => ({ id: x.id, title: x.title, date: x.date, parts: round2(x.parts), labor: round2(x.labor), hours: round2(x.hours) }))
      .sort((x, y) => String(y.date).localeCompare(String(x.date)));
    return o;
  }).filter(o => o.total > 0 || o.hours > 0 || o.downHours > 0 || o.orderCount > 0).sort((a, b) => b.total - a.total || b.downHours - a.downHours);
  const sum = k => round2(list.reduce((a, x) => a + x[k], 0));
  return { ok: true, from: from, to: to, laborRate: labor, downtimeRate: downRate, currency: 'SAR', rows: list,
           totals: { parts: sum('parts'), labor: sum('labor'), downCost: sum('downCost'), total: sum('total'), hours: sum('hours'), downHours: sum('downHours') } };
}
const round2 = x => Math.round(x * 100) / 100;

/* ---- public fault form (no account) ---- */
const publicOn = () => props().getProperty(SET_PUBLIC) === 'on';
function publicAsset(f) {
  if (!publicOn()) throw new Error('The fault form is switched off');
  const eq = assetByNo(clean(f && f.no, 60));
  if (!eq) throw new Error('Machine not found');
  return { ok: true, asset: { no: eq.no, name: eq.name, line: eq.line } };
}
/** Anyone with the link can send a fault. It lands in the normal request inbox, as "(public)". Spam protection: the supervisor must switch it on,
 *  a hidden field bots fill in, at most 20 a hour in total / 4 a hour per machine / 3 an hour per phone, and no more than 40 waiting. */
function publicReport(f) {
  if (!publicOn()) throw new Error('The fault form is switched off');
  f = f || {};
  if (String(f.website || '').trim()) return { ok: true, id: 'R-0000' };         // honeypot: look successful, store nothing
  const title = clean(f.title, 140);
  if (title.length < 4) throw new Error('Describe the problem in a few words');
  const no = clean(f.assetNo, 60);
  let asset = null; if (no) asset = assetByNo(no);
  const machine = asset ? asset.name : clean(f.asset, 80);
  if (machine.length < 2) throw new Error('Say which machine it is');
  const cache = CacheService.getScriptCache();
  const keys = [['pub_all', 20], ['pub_m_' + lc(asset ? asset.no : machine).slice(0, 60), 4]];
  const dev = clean(f.device, 40).replace(/[^A-Za-z0-9_-]/g, ''); if (dev) keys.push(['pub_d_' + dev, 3]);
  keys.forEach(k => { if (Number(cache.get(k[0]) || 0) >= k[1]) throw new Error('Too many reports right now. Please call the supervisor, or try again in an hour.'); });
  if (requestRows().filter(r => r['By'] === PUBLIC_BY && r['Status'] === 'Pending').length >= 40) throw new Error('The inbox is full. Please call the supervisor.');
  const pp = props(), seq = Number(pp.getProperty('REQ_SEQ') || 0) + 1;
  pp.setProperty('REQ_SEQ', String(seq));
  const id = 'R-' + ('000' + seq).slice(-4), name = clean(f.name, 60) || 'Not signed in';
  const urgency = PRIORITIES.indexOf(f.urgency) >= 0 && f.urgency !== 'Urgent' ? f.urgency : 'Normal';   // an open form cannot claim Urgent
  const vals = [id, nowText(), PUBLIC_BY, name, title, clean(f.details, 600), asset ? asset.no : '', machine, urgency, '', 'Pending', '', '', '', ''];
  const sh = tasksBook().getSheetByName(REQ_TAB);
  sh.getRange(sh.getLastRow() + 1, 1, 1, REQ_COLS.length).setNumberFormat('@').setValues([vals]);
  keys.forEach(k => cache.put(k[0], String(Number(cache.get(k[0]) || 0) + 1), 3600));
  usersTable().filter(u => u.active && MANAGER_ROLES.indexOf(u.role) >= 0)
    .forEach(u => notifyUser(u.username, { kind: 'request', id: id, title: title, by: name, priority: urgency }));
  return { ok: true, id: id };
}

function spareStatus(user, kind, row, status) {
  if (!canEditSpares(user)) throw new Error('You do not have permission to change spare parts');
  if (status !== 'Active' && status !== 'Deleted') throw new Error('Unknown status');
  const k = kind === 'mechanical' ? 'mechanical' : 'electrical';
  const sh = spareSheet(k);
  const cols = findCols(sh, k === 'mechanical' ? SPARE_M_SPEC : SPARE_E_SPEC, true);
  sh.getRange(checkRow(sh, row), cols.rec).setValue(status);
  CacheService.getScriptCache().remove('spares_v1');
  return { ok: true };
}

