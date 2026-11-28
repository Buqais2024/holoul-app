/* Holoul Maintenance — dashboard (app v13).
 * Supervisor / Operations Manager: every section.
 * Technician / operator: only the sections their rights open (Equipment, Spare parts) and New task.
 * Uses helpers from index.html (t, esc, HS, session, showView, toast, loadImage, scaled, roleName, modName, ...). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);

  Object.assign(I18N.en, {
    dOverview: 'Overview', dTasks: 'Work orders', dTeam: 'Team', dMonthly: 'Monthly summary', dPages: 'Reading pages',
    dUpdated: 'Updated {t}', dRefresh: 'Refresh', dNewTask: 'New work order', dBackApp: 'App', dLoading: 'Loading the dashboard…',
    kOpen: 'Not started', kProg: 'In progress', kOverdue: 'Overdue', kDoneWeek: 'Done this week', kReadings: 'Reading pages done today',
    kChecks: 'Daily checks today', kFaults: '{n} with faults', kOf: 'of {n}',
    cReadings:"Today's readings", cChecks: 'Daily checks today', cAttention: 'Needs attention', cFaults: 'Faults — last 14 days',
    completedByAt: 'Completed by {by} at {at}', notCompleted: 'Not completed yet', checkedBy: 'Filled by {n}', noData: 'Nothing here',
    chkOK: 'OK', chkNot: 'Not checked yet', fAll: 'Everyone', fSearch: 'Search work orders…',
    colOpen: 'Not started', colProg: 'In progress', colDone: 'Done — last 14 days',
    tName: 'Name', tRole: 'Role', tOpen: 'Not started', tProg: 'In progress', tOver: 'Overdue', tDoneW: 'Done (week)', tDoneM: 'Done (month)',
    tReadM: 'Reading pages (month)', tChkM: 'Checks (month)', tTotM: 'Total (month)',
    mCreated: 'Work orders created', mDone: 'Work orders done', mOnTime: 'Done on time', mAvg: 'Average time to finish', mHours: '{n} h',
    mReadings: 'Reading pages completed', mChecks: 'Daily checks', mFaults: 'Faults reported', mPerEmp: 'Per employee — {m}',
    mAssigned: 'Work orders assigned', mTotal: 'Total achievements', mHistory: 'Last 12 months', mMonth: 'Month',
    fTitle: 'Work order', fTitlePh: 'e.g. Replace the belt on conveyor BC-16', fAssignee: 'Assign to', fPriority: 'Priority', fDue: 'Due date',
    fEquip: 'Asset', fEquipPh: 'e.g. Conveyor BC-16', fLink: 'Open a page (optional)', fNone: 'None', fDetails: 'Details',
    fCreate: 'Assign work order', fSave: 'Save changes', fNewTitle: 'New work order', fEditTitle: 'Edit work order', fChoose: 'Choose…',
    aEdit: 'Edit', aReassign: 'Reassign', aCancel: 'Cancel work order', aCancelSure: 'Tap again to cancel this work order', aReopen: 'Reopen', aSave: 'Save',
    assignedTo: 'Assigned to', createdBy: 'Created by', doneNoteLabel: 'Note',
    sentOk: 'Assigned to {n} — notification sent', sentNoPhone: 'Assigned to {n} — their notifications are not on yet; they will see it in the app',
    saved: 'Saved', needOnline: 'Needs internet', dashLoadErr: 'Could not refresh — showing the last saved copy', dashEmpty: 'No data yet — connect to the internet',
    eqSearch: 'Search by name or number — e.g. CV16, MPR120, Shutter', eqAllLoc: 'All locations', eqAllLine: 'All lines / systems', eqChange: 'Change',
    eqFree: 'Not in the list — will be saved as typed: {q}', eqMore: '{n} more — type to narrow the list', eqListErr: 'Asset list could not be read: {e}', fLineAll: 'All lines'
  });
  Object.assign(I18N.ar, {
    dOverview:'نظرة عامة', dTasks:'المهام', dTeam:'الفريق', dMonthly:'الملخص الشهري', dPages:'صفحات القراءات',
    dUpdated:'آخر تحديث {t}', dRefresh:'تحديث', dNewTask:'مهمة جديدة', dBackApp:'التطبيق', dLoading:'جارٍ تحميل لوحة التحكم…',
    kOpen:'لم تبدأ', kProg:'قيد التنفيذ', kOverdue:'متأخرة', kDoneWeek:'أُنجزت هذا الأسبوع', kReadings:'صفحات القراءات المكتملة اليوم',
    kChecks:'الفحوصات اليومية اليوم', kFaults:'{n} فيها أعطال', kOf:'من {n}',
    cReadings:'قراءات اليوم', cChecks:'الفحوصات اليومية اليوم', cAttention:'تحتاج متابعة', cFaults:'الأعطال — آخر 14 يوم',
    completedByAt:'أُنجزت بواسطة {by} الساعة {at}', notCompleted:'لم تُنجز بعد', checkedBy:'عبّأها {n}', noData:'لا يوجد',
    chkOK:'سليم', chkNot:'لم يُفحص بعد', fAll:'الجميع', fSearch:'بحث في المهام…',
    colOpen:'لم تبدأ', colProg:'قيد التنفيذ', colDone:'منجزة — آخر 14 يوم',
    tName:'الاسم', tRole:'الوظيفة', tOpen:'لم تبدأ', tProg:'قيد التنفيذ', tOver:'متأخرة', tDoneW:'منجزة (أسبوع)', tDoneM:'منجزة (شهر)',
    tReadM:'صفحات قراءات (شهر)', tChkM:'فحوصات (شهر)', tTotM:'المجموع (شهر)',
    mCreated:'مهام أُنشئت', mDone:'مهام أُنجزت', mOnTime:'أُنجزت في الموعد', mAvg:'متوسط وقت الإنجاز', mHours:'{n} ساعة',
    mReadings:'صفحات قراءات مكتملة', mChecks:'فحوصات يومية', mFaults:'أعطال مُبلّغ عنها', mPerEmp:'لكل موظف — {m}',
    mAssigned:'مهام مُسندة', mTotal:'مجموع الإنجازات', mHistory:'آخر 12 شهر', mMonth:'الشهر',
    fTitle:'المهمة', fTitlePh:'مثال: تغيير سير الناقل BC-16', fAssignee:'إسناد إلى', fPriority:'الأولوية', fDue:'تاريخ الاستحقاق',
    fEquip:'المعدة', fEquipPh:'مثال: الناقل BC-16', fLink:'ربط بصفحة (اختياري)', fNone:'بدون', fDetails:'التفاصيل',
    fCreate:'إسناد المهمة', fSave:'حفظ التعديلات', fNewTitle:'مهمة جديدة', fEditTitle:'تعديل المهمة', fChoose:'اختر…',
    aEdit:'تعديل', aReassign:'إعادة إسناد', aCancel:'إلغاء المهمة', aCancelSure:'اضغط مرة أخرى لإلغاء المهمة', aReopen:'إعادة فتح', aSave:'حفظ',
    assignedTo:'مُسندة إلى', createdBy:'أنشأها', doneNoteLabel:'ملاحظة',
    sentOk:'أُسندت إلى {n} — تم إرسال الإشعار', sentNoPhone:'أُسندت إلى {n} — الإشعارات غير مفعّلة لديه بعد، وسيراها في التطبيق',
    saved:'تم الحفظ', needOnline:'يحتاج اتصال بالإنترنت', dashLoadErr:'تعذّر التحديث — تُعرض آخر نسخة محفوظة', dashEmpty:'لا توجد بيانات بعد — اتصل بالإنترنت',
    eqSearch:'ابحث بالاسم أو الرقم — مثال CV16 أو MPR120 أو Shutter', eqAllLoc:'كل المواقع', eqAllLine:'كل الخطوط / الأنظمة', eqChange:'تغيير',
    eqFree:'غير موجودة في القائمة — ستُحفظ كما كُتبت: {q}', eqMore:'{n} أخرى — اكتب لتضييق القائمة', eqListErr:'تعذّرت قراءة قائمة المعدات: {e}', fLineAll:'كل الخطوط'
  });

  Object.assign(I18N.en, {
    mtTitle: 'Meters', mtHoursName: 'Running hours', mtNew: 'New meter…', mtPick: 'Meter', mtNameNew: 'Meter name', mtUnitLbl: 'Unit', mtUnitPh: 'e.g. PSI, °C, bar',
    mtReading: 'Reading', mtLatestOf: 'Latest', mtNeedName: 'Enter the meter name',
    dtTitle: 'Downtime', dtOnline: 'Online', dtOffline: 'Offline', dtSince: 'since {t}', dtRunning: '{m} so far', dtGoOffline: 'Mark offline', dtGoOnline: 'Back online',
    dtType: 'Type', dtUnplanned: 'Unplanned', dtPlanned: 'Planned', dtCause: 'Cause', dtNote: 'Note', dtOrder: 'Work order (optional)', dtNoOrder: 'None',
    dtNoteOn: 'What was done? (optional)', dtNone: 'No downtime recorded on this asset.', dtHist: 'Downtime history', dtStarted: 'Went offline', dtEnded: 'Back online',
    dtLength: 'Length', dtStill: 'still offline', dtSum: 'Last 90 days', dtSumCount: 'Stops', dtSumTotal: 'Total downtime', dtSumUnp: 'Unplanned', dtSumAvg: 'Average repair',
    dtByCause: 'Lost time by cause', dtChooseCause: 'Choose the cause', dtSavedOff: 'Marked offline', dtSavedOn: 'Back online — {m}', dtNoNo: 'Add a number to this asset to use QR labels, downtime and meters.',
    dtOffTag: 'Offline',
    causeTitle: 'Failure causes', causeHint: 'The list people choose from when an asset goes offline. Switching a cause off hides it from the list but keeps old records.',
    causeAdd: 'Add cause', causeSave: 'Save causes', causeActive: 'Active', causeBtn: 'Failure causes',
    qrTitle: 'QR label', qrBtn: 'QR label', qrPrint: 'Print', qrCopy: 'Copy link', qrCopied: 'Link copied', qrPrintAll: 'Print QR labels',
    qrHint: 'Stick this on the asset. Scanning it with the phone camera opens the asset in the app.', qrPartHint: 'Stick this on the shelf or bin. Scanning it with the phone camera opens the part in the app.',
    qrNone: 'Nothing to print — only assets with a number get a label.', qrNonePart: 'Nothing to print — no parts in this list.',
    scanBtn: 'Scan QR', scanTitle: 'Scan a QR code', scanHint: 'Point the camera at the label.', scanNone: 'This browser cannot scan inside the app. Scan the label with the phone camera app and it opens here, or type the asset number below.',
    scanType: 'Asset number', scanOpen: 'Open', scanDenied: 'The camera is not allowed. Type the number instead.', scanNotFound: 'Asset not found', scanPartNF: 'Part not found', scanNoAccess: 'You do not have access to this page',
    cardOrders: 'Your open work orders on this asset', cardNoOrders: 'You have no open work orders on this asset.', cardOpenFull: 'Open asset page'
  });

  Object.assign(I18N.en, {
    pOnHand: 'On hand', pUnitCost: 'Unit cost', pValue: 'Stock value', pVendor: 'Vendor', pMin: 'Minimum qty', pBin: 'Bin / shelf', pUsed90: 'Used, last 90 days',
    pLowTag: 'Low stock', pStockTitle: 'Stock', pReceive: 'Receive stock', pCount: 'Count stock', pDetails: 'Edit details', pVendors: 'Vendors', pNoVendor: 'No vendor',
    pQty: 'Quantity', pCost: 'Unit cost (optional)', pNote: 'Note (optional)', pCounted: 'Counted quantity', pCountHint: 'Type what is really on the shelf. The app records the difference.',
    pMinHint: 'Low-stock alert at or under this quantity. Empty = only when none is left.', pMinMech: 'Mechanical parts are low when Remaining drops below Required qty.',
    pMoves: 'Stock history', pNoMoves: 'No stock movements yet.', pMvUsed: 'Used', pMvReturned: 'Returned', pMvReceived: 'Received', pMvCount: 'Counted',
    pSavedMove: 'Saved — {n} in stock', pSavedCount: 'Counted — {n} in stock ({d})', pNeedQty: 'Enter a quantity above 0', pNeedCount: 'Enter the counted quantity',
    pVTitle: 'Vendors', pVAdd: 'Add vendor', pVName: 'Name', pVPhone: 'Phone', pVEmail: 'Email', pVNotes: 'Notes', pVActive: 'Active', pVNone: 'No vendors yet.', pVSave: 'Save vendor', pVNeedName: 'Enter the vendor name',
    pLoading: 'Loading…', pCostCol: 'Cost',
    woPartsBtn: 'Parts used', woPartsTitle: 'Parts used', woPartsNone: 'No parts logged on this work order.', woPartsAdd: 'Add part', woPartsTotal: 'Parts cost', woReturn: 'Return',
    woPick: 'Choose a part', woSearch: 'Search by number or name…', woPickNone: 'No parts found.', woPickMore: 'Showing the first 25 — type more to narrow down.',
    woUse: 'Use this part', woReturnTitle: 'Return a part', woInStock: '{n} in stock', woLogged: 'Logged', woReturned: 'Returned to stock', woClose: 'Done'
  });

  Object.assign(I18N.en, {
    rpTitle: 'Reporting', rpLast: 'Last {n} days', rpFrom: 'From', rpTo: 'To', rpApply: 'Apply', rpCsv: 'Download CSV', rpPrint: 'Print / Save as PDF', rpEmail: 'Email report',
    rpCreated: 'Created', rpDone: 'Completed', rpOpen: 'Open now', rpOverdue: 'Overdue now', rpOnTime: 'Finished on time', rpAvgDone: 'Average time to finish', rpHours: 'Hours logged', rpPartsCost: 'Parts cost',
    rpWork: 'Work orders', rpByCat: 'By category', rpByPrio: 'By priority', rpWorkload: 'Workload', rpPerson: 'Person', rpAssets: 'Assets — downtime', rpAsset: 'Asset', rpStops: 'Stops', rpDown: 'Downtime',
    rpMttr: 'MTTR', rpMtbf: 'MTBF', rpAvail: 'Availability', rpMttrHint: 'MTTR = average repair time. MTBF = average running time between unplanned stops. Planned stops count as downtime but not as failures.',
    rpCauses: 'Lost time by cause (unplanned)', rpParts: 'Parts used', rpPart: 'Part', rpQty: 'Qty', rpCost: 'Cost', rpNoAssets: 'No downtime in this period.', rpNoPeople: 'No work orders in this period.',
    rpNoParts: 'No parts used in this period.', rpGenerated: 'Generated {t}', rpLoading: 'Building the report…', rpErr: 'Could not build the report', rpDateBad: 'Choose both dates, start before end',
    rpMailTitle: 'Email report', rpMailTo: 'Send this report to', rpMailSend: 'Send now', rpMailSent: 'Report sent to {e}', rpMailBad: 'Enter one valid email address',
    rpWeekly: 'Weekly email', rpWeeklyHint: 'Every Sunday morning these addresses get the report for the previous 7 days.', rpWeeklyAdd: 'Add address', rpWeeklyNone: 'No weekly recipients yet.',
    rpWeeklyLast: 'last sent {d}', rpOn: 'On', rpOff: 'Off', rpMin: '{n} min', rpHrMin: '{h} h {m} min', rpCat: 'Category', rpPrio: 'Priority', rpOpenN: 'Open', rpDoneN: 'Done'
  });

  Object.assign(I18N.en, {
    rqTitle: 'Work requests', rqTile: 'Report a problem', rqTileSub: 'Send a request to maintenance', rqNew: 'Report a problem', rqWhat: 'What is wrong?', rqWhatPh: 'e.g. Conveyor belt is slipping',
    rqDetails: 'More details (optional)', rqAsset: 'Asset (optional)', rqAssetPh: 'Search by number or name…', rqUrgency: 'How urgent?', rqPhoto: 'Add a photo', rqPhotoOn: 'Photo added', rqSend: 'Send request',
    rqSent: 'Request sent — {id}', rqMine: 'Your requests', rqNone: 'No requests yet.', rqPending: 'Waiting', rqApproved: 'Approved', rqDeclined: 'Declined', rqOrder: 'Work order {id}',
    rqPendingTab: 'Waiting', rqAll: 'All', rqBy: 'From {n}', rqApprove: 'Approve', rqDecline: 'Decline', rqApproveTitle: 'Approve and create a work order', rqCreateOrder: 'Create work order',
    rqDeclineTitle: 'Decline request', rqReason: 'Reason (the sender will see it)', rqNeedReason: 'Write the reason', rqNeedWho: 'Choose who does the work', rqDecidedOk: 'Work order {id} created', rqDeclinedOk: 'Request declined',
    rqPhotoLink: 'Open photo', rqNoAsset: 'No asset chosen', rqNoPeople: 'Nobody to assign to.',
    cmTitle: 'Comments', cmBtn: 'Comments', cmNone: 'No comments yet.', cmPh: 'Write a comment… use @name to tag someone', cmSend: 'Send', cmTag: 'Tag', cmVoice: 'Voice note', cmStop: 'Stop', cmRec: 'Recording…', cmVoiceReady: 'Voice note ready — send it',
    cmMic: 'The microphone is not available or not allowed.', cmPlay: 'Play voice note', cmTooLong: 'Voice notes are limited to 60 seconds', cmNeed: 'Write a comment or record a voice note',
    asExtra: 'Other assets on this work order', asExtraHint: 'Add more assets if the work covers more than one.', asSearch: 'Search to add an asset…', asRemove: 'Remove', asNone: 'No assets found.',
    sgNeed: 'Require a signature when finished', sgTitle: 'Signature', sgHint: 'Sign with your finger or mouse', sgName: 'Printed name (optional)', sgClear: 'Clear', sgOk: 'Use signature', sgEmpty: 'Draw your signature first', sgBtn: 'Add signature', sgDone: 'Signed',
    mkTitle: 'Mark up photo', mkHint: 'Draw on the photo to point at the problem, or use it as it is.', mkUndo: 'Undo', mkClear: 'Clear', mkUse: 'Use photo'
  });

  Object.assign(I18N.en, {
    schTitle: 'Schedule', schPrev: '← Previous week', schThis: 'This week', schNext: 'Next week →', schShifts: 'Shifts and time off', schHint: 'Drag a work order to another day or person, or tap it and then tap a day. Hours are estimates from past jobs (1 h when there is no history).',
    schOverdue: 'Overdue', schUnsched: 'No date', schBacklog: 'Overdue and unscheduled', schConflict: 'This person is not working that day', schAnyway: 'Move anyway', schMoved: 'Work order moved',
    schShiftsHint: 'Choose each person’s working days and hours per day. Time off keeps work from being planned on those days.', schHours: 'Hours per day', schOff: 'Time off', schNoOff: 'No time off planned.', schNote: 'Note (optional)', schAddOff: 'Add time off', schClash: '{n} open work order(s) fall in those dates — move them on the Schedule.',
    prcTitle: 'Procedures', prcList: 'Procedures', prcRuns: 'Completed', prcAudit: 'Audit sheet', prcNoRuns: 'No procedures completed yet.', prcNew: 'New procedure', prcEdit: 'Edit procedure', prcOff: 'Off', prcSteps: '{n} steps', prcRun: 'Run', prcNone: 'No procedures yet.', prcEditBtn: 'Edit', prcCat: 'Category',
    prcName: 'Name', prcFailWho: 'Who gets the work order when a step fails', prcFailAny: 'The person doing the work', prcActive: 'In use', prcStepsT: 'Steps', prcStepPh: 'What must be checked?',
    'prcType.passfail': 'Pass / fail', 'prcType.check': 'Tick box', 'prcType.number': 'Number', 'prcType.text': 'Text', prcReq: 'Required', prcMin: 'Min', prcMax: 'Max', prcUnit: 'Unit', prcAlways: 'Always show this step',
    prcIfFail: 'Only if step {n} fails', prcIfPass: 'Only if step {n} passes', prcAddStep: 'Add a step', prcAsset: 'Machine', prcPass: 'Pass', prcFail: 'Fail', prcNote: 'What is wrong? (required)', prcDone: 'Done', prcSubmit: 'Submit procedure',
    prcProblems: '{n} problem(s) found', prcAllGood: 'All checks passed', prcOrderMade: 'A work order {id} was created for the problems.', prcPick: 'Run a procedure', prcAnswer: 'Answer', prcPassed: 'Passed', prcFailed: 'Failed',
    poTitle: 'Purchasing', poOpen: 'Open', poNew: 'New purchase request', poNone: 'No purchase orders.', 'poSt.Requested': 'Waiting approval', 'poSt.Approved': 'Approved', 'poSt.Rejected': 'Rejected', 'poSt.Ordered': 'Ordered', 'poSt.Partly received': 'Partly received', 'poSt.Received': 'Received', 'poSt.Cancelled': 'Cancelled',
    poGot: 'received', poTotal: 'Total', poReject: 'Reject', poMarkOrdered: 'Mark as ordered', poReceive: 'Receive delivery', poCancel: 'Cancel', poLeft: '{n} still expected', poNothing: 'Enter a quantity to receive', poReceived: 'Stock updated',
    poVendor: 'Supplier', poAddPart: 'Add a part', poAddLow: 'Add all low-stock parts', poOnHand: '{n} on hand', poQty: 'Quantity', poCost: 'Unit cost', poNote: 'Note (optional)', poSend: 'Send request', poNeedLine: 'Add at least one part', poSent: 'Purchase request {id} sent',
    tProc: 'Procedure to complete (optional)', tProcNone: 'None', tEst: 'Typical time: {h} h (average of {n} similar job(s): {b})'
  });

  const css = `
  #dash{min-height:100vh;background:var(--bg);color:var(--text)}
  .dsh{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:100vh}
  .dside{position:sticky;top:0;height:100vh;background:var(--head);border-inline-end:1px solid var(--line);display:flex;flex-direction:column;padding:18px 14px;gap:20px}
  .dside .lockup .mk{height:34px} .dside .lockup .wm{font-size:18px}
  .dnav{display:flex;flex-direction:column;gap:3px}
  .dnav button{display:flex;align-items:center;gap:11px;height:42px;border:0;background:none;border-radius:11px;padding:0 12px;color:var(--text);font-weight:600;font-size:14px;cursor:pointer;text-align:start;width:100%}
  .dnav button svg{width:19px;height:19px;stroke:var(--muted);flex:none}
  .dnav button:hover{background:var(--panel2)}
  .dnav button.on{background:var(--accent-soft);color:var(--accent)} .dnav button.on svg{stroke:var(--accent)}
  .dnav small{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);padding:14px 12px 4px;font-weight:700}
  .dnav .cnt{margin-inline-start:auto;font-size:11px;background:var(--brand);color:#fff;border-radius:999px;padding:1px 7px}
  .dme{margin-top:auto;display:flex;align-items:center;gap:10px;border-top:1px solid var(--line);padding-top:14px}
  .dme .nm{flex:1;min-width:0;font-size:13px} .dme .nm b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .dme .nm small{color:var(--muted)}
  .dmain{min-width:0;padding:24px 30px 48px}
  .dtop{display:none} .dhead .hupd{font-size:11px;color:var(--muted)}
  .dhead{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
  .dhead h1{font-size:24px;line-height:1.2} .dhead small{color:var(--muted);font-size:13px;display:block;margin-top:4px}
  .dtools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .btn{height:40px;border-radius:11px;border:1px solid var(--line);background:var(--panel);color:var(--text);font-weight:600;font-size:14px;padding:0 14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:var(--shadow)}
  .btn svg{width:17px;height:17px;stroke:currentColor}
  .btn.pri{background:var(--brand);border-color:var(--brand);color:#fff}
  .btn:disabled{opacity:.55;cursor:default}
  .btn.spin svg{animation:dspin 1s linear infinite} @keyframes dspin{to{transform:rotate(360deg)}}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin-bottom:18px}
  .kpi{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:var(--shadow);text-align:start;color:var(--text)}
  button.kpi{cursor:pointer}
  .kpi small{color:var(--muted);font-size:12px;font-weight:600;display:block}
  .kpi b{display:block;font-size:28px;margin-top:6px;font-variant-numeric:tabular-nums;line-height:1.1}
  .kpi span{font-size:12px;color:var(--muted)}
  .kpi.bad b{color:var(--err)} .kpi.good b{color:var(--ok)} .kpi.acc b{color:var(--accent)}
  .dgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
  .dcard{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:var(--shadow);min-width:0}
  .dcard h4{font-size:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .dcard h4 span{font-size:12px;color:var(--muted);font-weight:500}
  .rl{padding:10px 0;border-top:1px solid var(--line)} .rl:first-of-type{border-top:0}
  .rl .rt{display:flex;justify-content:space-between;gap:10px;font-size:14px;align-items:center}
  .rl .rt b{font-weight:600}
  .hb{height:7px;border-radius:7px;background:var(--panel2);border:1px solid var(--line);overflow:hidden;margin:7px 0 5px}
  .hb i{display:block;height:100%;background:var(--brand);border-radius:7px} .hb.full i{background:var(--ok)}
  .mini{font-size:12px;color:var(--muted);line-height:1.45}
  .mini a{color:var(--accent)}
  .rprow{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)}
  .rprow small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
  .rprow.off>div>b{color:var(--muted)}
  .st{font-size:11px;font-weight:700;border-radius:999px;padding:3px 9px;white-space:nowrap}
  .st.ok{background:var(--ok-bg);color:var(--ok-text)} .st.bad{background:var(--bad-bg);color:var(--bad-text)} .st.none{background:var(--panel2);color:var(--muted);border:1px solid var(--line)}
  .fault{white-space:pre-wrap;font-size:13px;line-height:1.45;margin-top:4px}
  .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
  .toolbar select,.toolbar input{height:40px;border-radius:11px;border:1px solid var(--line);background:var(--panel);color:var(--text);padding:0 12px;font:inherit;font-size:14px;min-width:0}
  .toolbar input{flex:1;min-width:180px}
  .board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}
  .bcol{background:var(--panel2);border:1px solid var(--line);border-radius:16px;padding:10px;min-height:140px}
  .bcol h5{font-size:13px;display:flex;justify-content:space-between;padding:4px 6px 10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  .tcard{display:block;width:100%;text-align:start;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px 10px 16px;margin-bottom:8px;cursor:pointer;color:var(--text);position:relative;overflow:hidden;box-shadow:var(--shadow);font:inherit}
  .tcard::before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:4px;background:var(--line)}
  .tcard.High::before{background:var(--edit)} .tcard.Urgent::before{background:var(--err)} .tcard.Low::before{background:var(--muted);opacity:.4}
  .tcard b{display:block;font-size:14px;line-height:1.35}
  .tcard .mini{margin-top:5px;display:flex;flex-wrap:wrap;gap:3px 10px}
  .tscroll{overflow-x:auto}
  .dtable{width:100%;border-collapse:collapse;font-size:13px}
  .dtable th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);text-align:start;padding:8px;border-bottom:1px solid var(--line);font-weight:700;white-space:nowrap}
  .dtable td{padding:10px 8px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums;vertical-align:middle}
  .dtable .num{text-align:center}
  .dtable td.late{color:var(--err);font-weight:700}
  .dtable tr:last-child td{border-bottom:0}
  .dtable td:first-child,.dtable .btn{white-space:nowrap}
  .kpi span.ltr{display:inline-block}
  .barcell{display:flex;align-items:center;gap:8px;min-width:140px}
  .barcell .hb{flex:1;margin:0}
  .msel{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px}
  .msel button{flex:none;height:36px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--text);padding:0 14px;font:inherit;font-size:13px;cursor:pointer}
  .msel button.on{background:var(--brand);border-color:var(--brand);color:#fff}
  .dempty{color:var(--muted);font-size:14px;padding:30px 0;text-align:center}
  .dnote{font-size:12px;color:var(--edit);margin-bottom:12px}
  .ffield{width:100%;height:46px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font:inherit;font-size:15px;padding:0 12px;margin-bottom:12px;outline:none}
  .ffield:focus{border-color:var(--brand)}
  textarea.ffield{height:auto;min-height:90px;padding:10px 12px;resize:vertical}
  input[type=date].ffield{direction:ltr}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .segctl.four{grid-template-columns:repeat(4,1fr);margin-bottom:12px}
  .segctl.four button{height:40px;font-size:13px}
  .tform label{margin-bottom:6px}
  .offtag{display:inline-block;margin-inline-start:8px;font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;background:var(--bad-bg);color:var(--bad-text);vertical-align:middle}
  .stbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between}
  .stbar .big{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700;flex-wrap:wrap}
  .stbar .big small{font-weight:500;color:var(--muted);font-size:13px}
  .stbar .dotx{width:12px;height:12px;border-radius:50%;background:var(--ok);flex:none}
  .stbar.off{border-color:color-mix(in srgb,var(--err) 45%,var(--line))} .stbar.off .dotx{background:var(--err)}
  .stbar .btns{display:flex;gap:8px;flex-wrap:wrap}
  .qrbox{display:grid;justify-items:center;gap:8px;text-align:center}
  .qrbox svg{width:min(260px,70vw);height:auto;border:1px solid var(--line);border-radius:12px}
  .qrbox .url{font-size:11px;color:var(--muted);word-break:break-all;direction:ltr}
  .causerow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin-bottom:8px}
  .causerow .ffield{margin:0}
  .scanv{width:100%;border-radius:12px;background:#000;max-height:50vh}
  .dovl{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:14px}
  .dovl>div{background:var(--panel);color:var(--text);border-radius:16px;padding:16px;width:min(560px,100%);max-height:100%;overflow:auto}
  .mention{color:var(--brand)}
  .scgrid{overflow-x:auto}.scrow{display:grid;grid-template-columns:150px repeat(7,minmax(120px,1fr));gap:4px;margin-bottom:4px;min-width:1000px}
  .schead>div{font-weight:700;font-size:12px;text-align:center;padding:4px}.schead .today{color:var(--brand)}
  .scwho{padding:6px;display:flex;flex-direction:column}.scwho small,.sccell small{color:var(--muted);font-size:11px}
  .sccell{min-height:64px;border:1px dashed var(--line);border-radius:10px;padding:4px;display:flex;flex-direction:column;gap:4px;cursor:pointer}
  .sccell.rest{background:rgba(127,127,127,.12)}.sccell.off{background:rgba(239,68,68,.12)}.sccell.hot{outline:2px solid var(--brand);background:rgba(59,130,246,.12)}
  .sccell .over{color:#ef4444;font-weight:700}.offtag{font-style:italic}
  .scchip{background:var(--panel2,rgba(127,127,127,.18));border-left:4px solid #3b82f6;border-radius:8px;padding:4px 6px;font-size:12px;cursor:grab;display:flex;flex-direction:column}
  .scchip.High{border-left-color:#f59e0b}.scchip.Urgent{border-left-color:#ef4444}.scchip.Low{border-left-color:#9ca3af}.scchip.sel{outline:2px solid var(--brand)}
  .scchip b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.scback{padding:8px 0;border-bottom:1px solid var(--line)}.scback>div{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px}
  .shdays{display:flex;flex-wrap:wrap;gap:6px}.pstep{border:1px solid var(--line);border-radius:10px;padding:8px;margin:8px 0}.pstop{display:flex;gap:6px;align-items:center}.psopt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}
  .ffield.sm{width:80px}.rstep{padding:8px 0;border-bottom:1px solid var(--line)}.segctl button.ok.on{background:#16a34a;color:#fff}.segctl button.bad.on{background:#dc2626;color:#fff}
  .audtbl{width:100%;border-collapse:collapse}.audtbl th,.audtbl td{border-bottom:1px solid var(--line);padding:4px 6px;text-align:start}.audtbl tr.fail td{color:#dc2626}
  .cbar{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:10px;align-items:center;font-size:13px;padding:4px 0}
  .cbar .hb{margin:5px 0 0}
  .cbar>span{text-align:end;color:var(--muted);font-variant-numeric:tabular-nums}
  .tform .primary{margin-top:6px}
  .dangerbtn{height:44px;border-radius:12px;border:1px solid var(--bad-line);background:var(--bad-bg);color:var(--err);font-weight:700;cursor:pointer;width:100%}
  .dact{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
  .reass{display:flex;gap:8px} .reass select{flex:1;margin:0}
  .eqlist{max-height:250px;overflow-y:auto;border:1px solid var(--line);border-radius:12px;margin:-4px 0 12px;background:var(--panel)}
  .eqlist:empty{display:none}
  .eqgrp{position:sticky;top:0;background:var(--panel2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);padding:6px 12px;border-bottom:1px solid var(--line)}
  .eqitem{display:flex;align-items:baseline;gap:8px;width:100%;text-align:start;border:0;border-bottom:1px solid var(--line);background:none;color:var(--text);padding:9px 12px;cursor:pointer;font:inherit;flex-wrap:wrap}
  .eqitem:last-child{border-bottom:0}
  .eqitem:hover,.eqitem:focus,.eqitem.first{background:var(--accent-soft);outline:none}
  .eqitem b{font-size:14px;font-weight:600}
  .eqno{font-size:12px;font-weight:700;color:var(--accent);direction:ltr;unicode-bidi:isolate}
  .eqitem small{flex-basis:100%;font-size:11px;color:var(--muted)}
  .eqnote{font-size:12px;color:var(--muted);padding:8px 12px}
  .eqsel{display:flex;align-items:center;gap:10px;border:1px solid var(--accent);background:var(--accent-soft);border-radius:12px;padding:10px 12px;margin-bottom:12px}
  .eqsel .eqtxt{flex:1;min-width:0} .eqsel b{display:block;font-size:15px} .eqsel small{display:block;font-size:12px;color:var(--muted);margin-top:2px}
  .eqsel .btn{box-shadow:none}
  @media (max-width:1023px){
    .dsh{grid-template-columns:1fr}
    .dside{display:none}
    .dmain{padding:0 16px 40px}
    .dtop{display:flex;align-items:center;gap:10px;position:sticky;top:env(safe-area-inset-top,0px);z-index:6;background:var(--bg);padding:12px 0 8px}
    .dtop h2{flex:1;font-size:18px}
    .dtabs{display:flex;gap:6px;overflow-x:auto;padding:4px 0 12px;position:sticky;top:calc(env(safe-area-inset-top,0px) + 58px);z-index:5;background:var(--bg)}
    .dtabs button{flex:none;height:36px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--text);padding:0 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
    .dtabs button.on{background:var(--brand);border-color:var(--brand);color:#fff}
    .dhead{margin:6px 0 14px} .dhead h1{display:none} .dhead .avbtn{display:none} .dhead .dtools{margin-inline-start:auto}
    .dgrid,.board{grid-template-columns:1fr}
    .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
    .kpi b{font-size:24px}
  }
  @media (min-width:1024px){ .dtabs{display:none} }
  .dtable tr.grp td{background:var(--panel2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);padding:6px 8px}
  .dtable small{display:block;font-size:11px;color:var(--muted);font-weight:500;margin-top:2px}
  .clickrow{cursor:pointer} .clickrow:hover td{background:var(--accent-soft)}
  .dtable tr.off td{color:var(--muted)}
  .deltag{display:inline-block;font-size:11px;font-weight:700;background:var(--bad-bg);color:var(--bad-text);border-radius:999px;padding:2px 8px;margin-inline-start:6px;vertical-align:middle}
  .eqno{font-weight:700;color:var(--accent);direction:ltr;unicode-bidi:isolate;white-space:nowrap}
  .eqback{margin-bottom:12px}
  .eqhead{margin-bottom:14px} .eqhead h3{font-size:18px;margin:0}
  .eqmeta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;font-size:13px;color:var(--muted)}
  .evrow td{background:var(--panel2)} .evlist{display:grid;gap:6px;font-size:12px;padding:4px 0}
  .spseg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:14px;background:var(--panel2);border:1px solid var(--line);margin-bottom:12px;max-width:460px}
  .spseg button{height:40px;border:0;border-radius:11px;background:transparent;color:var(--muted);font:inherit;font-weight:700;cursor:pointer;display:flex;gap:8px;align-items:center;justify-content:center}
  .spseg button.on{background:var(--panel);color:var(--text);box-shadow:var(--shadow)}
  .spseg span{font-size:11px;background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:1px 7px}
  .chk{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--muted);white-space:nowrap;margin-inline-start:4px}
  .spsum{margin:-2px 2px 10px}
  .toolbar .chk input[type=checkbox],.chkrow input[type=checkbox]{width:18px;height:18px;margin:0;padding:0;flex:none;accent-color:var(--brand)}
  .spst{font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px;white-space:nowrap;color:var(--ok-text);background:var(--ok-bg)}
  .spst.low{color:var(--err);background:color-mix(in srgb,var(--err) 12%,transparent)}
  .chkrow{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:14px;font-weight:600;cursor:pointer}
  .chkrow small{display:block;color:var(--muted);font-weight:500;font-size:12px}
  .chkrow:has(input:disabled){opacity:.6;cursor:default}
  .fnote{font-size:12px;color:var(--muted);margin:6px 0 12px;line-height:1.45}
  .phrow{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
  .phrow .mini{flex:1;min-width:120px}
  .gal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .gslot{position:relative;aspect-ratio:4/3;border-radius:12px;border:1px dashed var(--line);background:var(--panel2);overflow:hidden;display:grid;place-items:center;color:var(--muted);font-size:12px;text-align:center;padding:6px}
  .gslot.main{border-style:solid}
  .gslot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;cursor:zoom-in}
  .gslot .cap{position:absolute;inset-inline-start:6px;top:6px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;border-radius:999px;padding:2px 8px;pointer-events:none}
  .gslot .btn{position:absolute;bottom:6px;inset-inline-end:6px;height:30px;font-size:12px;padding:0 10px;box-shadow:none}`;
  if (!$('dashStyle')) { const st = document.createElement('style'); st.id = 'dashStyle'; st.textContent = css; document.head.appendChild(st); }

  Object.assign(I18N.en, {
    dEquip:'Assets', dSpares:'Parts Inventory', eqAll:'All assets', eqJobs:'Jobs', eqOpenCol:'Open', eqLastDone:'Last finished',
    eqNumber:'Number', eqLocation:'Location', eqHistTitle:'Maintenance history', eqHistEmpty:'No maintenance recorded on this asset yet.',
    eqHistLoading:'Loading history…', eqHistErr:'History could not be loaded: {e}', eqStatDone:'Finished', eqStatOpen:'Still open', eqStatLast:'Last finished',
    hCreated:'Created', hJob:'Job', hStatus:'Status', hWho:'Assigned to', hFinished:'Finished', hNote:'Note',
    'ev.Created':'Created', 'ev.Started':'Started', 'ev.Done':'Done', 'ev.Cancelled':'Cancelled', 'ev.Reopened':'Reopened', 'ev.Edited':'Edited',
    spElect:'Electrical', spMech:'Mechanical', spSearch:'Search by part number, name or brand…', spLowOnly:'Low or out of stock only',
    spOutOnly:'Out of stock only', spParts:'{n} parts', spLowN:'{n} low stock', spOutN:'{n} out of stock', spEmpty:'No parts match your search',
    spLoading:'Loading parts…', spErr:'Parts could not be loaded: {e}', spOK:'OK', spLow:'Low stock',
    spPartNo:'Part no.', spItemNo:'Part / item no.', spName:'Part', spBrand:'Brand', spDesc:'Description', spQty:'Qty', spReq:'Required',
    spAvail:'Available', spUsed:'Used', spRem:'Remaining', spStatus:'Status', spMachine:'Machine',
    dSecAccount:'Account', dSecRights:'Extra rights', dRoleEq:'Equipment: {eq}', dAddEq:'Add asset', dEditEq:'Edit asset', dEqDel:'Delete', dEqRestore:'Restore', dEqDelSure:'Tap again to delete', dShowDel:'Show deleted', dDeleted:'Deleted',
    dEqfName:'Asset name', dEqfLine:'Line / system', dEqfNo:'Number', dEqfLoc:'Location', dEqfCat:'Category',
    dEqfPhotoNew:'Main photo (required)', dEqfPhoto:'Main photo', dChoosePhoto:'Choose photo', dPhotoSel:'Photo selected', dKeepPhoto:'Keep the current photo',
    dSaveEq:'Save asset', dSavePart:'Save part',
    dAutoTitle:'Automatic task', dAutoHint:'Creates this reading task for the technicians you choose, on the schedule you set. Only supervisors can change it.', dAutoReading:'Reading', dAutoNone:'No automatic task', dAutoBasis:'Repeat by', dAutoByPeriod:'Time period', dAutoByHours:'Running hours', dAutoPeriod:'How often', dAutoHours:'Every how many hours', dAutoWho:'Technicians (one or more)', dAutoLoading:'Loading technicians…', dAutoNoTechs:'No technicians found', dAutoNoHours:'Enter the running hours (1 or more)', dAutoNoWho:'Choose at least one technician', dAutoPW:'Weekly', dAutoPM:'Monthly', dAutoPQ:'Quarterly', dAutoPS:'Semi-annual', dAutoPY:'Yearly', dCancel:'Cancel',
    pmTitle:'Preventive maintenance', pmPrev:'Previous month', pmNext:'Next month', pmPlanned:'Planned', pmOverdue:'Overdue', pmNone:'No preventive work orders this month',
    pmCompTitle:'Compliance', pmDue:'Due', pmOnTime:'On time', pmLate:'Late', pmOver:'Overdue', pmPending:'Not due yet', pmPct:'On-time %', pmByEq:'By asset (last 6 months)', pmMonth:'Month',
    pmLoading:'Loading…', pmDays:'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
    mtTitle:'Meters', mtLatest:'Latest reading', mtAdd:'Add reading', mtHours:'Meter reading (hours)', mtReplaced:'Meter was replaced (reading is lower than before)', mtNote:'Note (optional)',
    mtNone:'No readings yet', mtSaved:'Reading saved', mtHist:'Recent readings', mtSave:'Save reading',
    lmTitle:'Reading limits', lmHint:'When a saved reading is above the maximum or below the minimum, one work order is created for the person you choose. No new one is made while it is still open.',
    lmAdd:'Add limit', lmPage:'Reading page', lmRow:'Reading', lmMin:'Minimum', lmMax:'Maximum', lmWho:'Give the work order to', lmPrio:'Priority', lmSave:'Save limit', lmDel:'Delete limit',
    lmEmpty:'No limits yet', lmOff:'Off', lmChoose:'Choose…', lmLoading:'Loading readings…', lmSaved:'Limit saved', lmDeleted:'Limit deleted', lmActive:'Active',
    cat:{ '':'—', Mechanical:'Mechanical', Electrical:'Electrical', Cleaning:'Cleaning', Safety:'Safety', Other:'Other' },
    tCategory:'Category', tNeedNote:'Require a note when finished', tNeedPhoto:'Require a photo when finished', tNeedApproval:'Supervisor approves when finished',
    tTemplate:'Template', tNoTemplate:'— none —', tSaveTpl:'Save as template', tTplName:'Template name', tTplSaved:'Template saved', tTplDeleted:'Template deleted',
    tDelTpl:'Delete template', fCatAll:'All categories', tAwait:'Waiting for approval', tApprove:'Approve', tSendBack:'Send back', tReason:'Why is it sent back?',
    tApproved:'Approved', tSentBack:'Sent back', tHours:'Hours worked', tApprovedBy:'Approved by', tCatLabel:'Category',
    aTitle:'Repeat this task', aHint:'The first task is made now for each person you choose. Later tasks are made by the daily run, on the schedule you set.', aRepeat:'Repeat', aNone:'Do not repeat', aWho:'Send to (one or more)', aHoursHint:'Hours come from the asset\'s Running hours meter (manual readings on the asset page, or the daily checks).', aNeedWho:'Choose at least one person', aNeedEq:'Choose the asset for hour-based repeats', aNeedHours:'Enter the running hours (1 or more)', aSaved:'Repeat set. {n} task(s) made now.', aList:'Repeating tasks', aEmpty:'No repeating tasks yet.', aStop:'Stop', aResume:'Resume', aTo:'To', aLast:'Since', aOpen:'Open now', dNeedVal:'Fill in the required fields', dLoadEq:'Loading assets…', dLoadSp:'Loading parts…',
    dPhotos:'Photos', dPhMain:'Main', dPhX1:'Detail 1', dPhX2:'Detail 2', dPhAdd:'Add photo', dPhReplace:'Replace', dPhNone:'No photo', dPhLoading:'Loading photos…',
    dPhErr:'Photos could not be loaded: {e}', dPhBusy:'Saving photo…', dPhDone:'Photo saved', dPhBad:'Choose an image file',
    dAddPart:'Add part', dEditPart:'Edit part', dPartNew:'New part', dSpfNo:'Part / item number', dSpfBrand:'Brand', dSpfDesc:'Description', dSpfQty:'Quantity',
    dSpfName:'Part name', dSpfReq:'Required qty', dSpfAvail:'Available qty', dSpfUsed:'Used qty', dSpfMachine:'Machine', dSpDel:'Delete part',
    dEmp:'Employees', dAddEmp:'Add employee', dEditEmp:'Edit employee', dNewEmp:'New employee', dEmpName:'Full name', dEmpUser:'Username', dEmpRole:'Role',
    dEmpEq:'Equipment (operators)', dEmpPin:'PIN (4 to 8 digits)', dEmpPinKeep:'New PIN (leave blank to keep the current one)', dEmpActive:'Active',
    dEmpPerms:'Extra rights', dPermTasks:'Create tasks', dPermEq:'Edit assets', dPermSp:'Edit parts', dPermMgr:'Supervisors and operations managers always have all rights',
    dEmpSave:'Save employee', dSelfNote:'You cannot deactivate yourself or change your own role', dRights:'Rights', dAllRights:'All rights',
    dActive:'Active', dInactive:'Inactive', dNoRights:'—', dLoadTeam:'Loading the team…', dPerf:'Performance'
  });
  Object.assign(I18N.ar, {
    dEquip:'المعدات', dSpares:'قطع الغيار', eqAll:'كل المعدات', eqJobs:'الأعمال', eqOpenCol:'مفتوحة', eqLastDone:'آخر إنجاز',
    eqNumber:'الرقم', eqLocation:'الموقع', eqHistTitle:'سجل الصيانة', eqHistEmpty:'لا توجد عمليات صيانة مسجلة على هذه المعدة بعد.',
    eqHistLoading:'جارٍ تحميل السجل…', eqHistErr:'تعذّر تحميل السجل: {e}', eqStatDone:'منجزة', eqStatOpen:'ما زالت مفتوحة', eqStatLast:'آخر إنجاز',
    hCreated:'تاريخ الإنشاء', hJob:'العمل', hStatus:'الحالة', hWho:'المكلّف', hFinished:'الإنجاز', hNote:'ملاحظة',
    'ev.Created':'أُنشئت', 'ev.Started':'بدأت', 'ev.Done':'أُنجزت', 'ev.Cancelled':'أُلغيت', 'ev.Reopened':'أُعيد فتحها', 'ev.Edited':'تعديل',
    spElect:'كهربائية', spMech:'ميكانيكية', spSearch:'ابحث برقم القطعة أو الاسم أو الماركة…', spLowOnly:'المنخفض أو المنتهي فقط',
    spOutOnly:'المنتهي فقط', spParts:'{n} قطعة', spLowN:'{n} منخفضة', spOutN:'{n} منتهية', spEmpty:'لا توجد قطع مطابقة للبحث',
    spLoading:'جارٍ تحميل قطع الغيار…', spErr:'تعذّر تحميل قطع الغيار: {e}', spOK:'متوفرة', spLow:'منخفضة',
    spPartNo:'رقم القطعة', spItemNo:'رقم القطعة / الصنف', spName:'القطعة', spBrand:'الماركة', spDesc:'الوصف', spQty:'الكمية', spReq:'المطلوب',
    spAvail:'المتوفر', spUsed:'المستخدم', spRem:'المتبقي', spStatus:'الحالة', spMachine:'الماكينة',
    dSecAccount:'الحساب', dSecRights:'صلاحيات إضافية', dRoleEq:'المعدة: {eq}', dAddEq:'إضافة معدة', dEditEq:'تعديل المعدة', dEqDel:'حذف', dEqRestore:'استرجاع', dEqDelSure:'اضغط مرة أخرى للحذف', dShowDel:'عرض المحذوف', dDeleted:'محذوف',
    dEqfName:'اسم المعدة', dEqfLine:'الخط / النظام', dEqfNo:'الرقم', dEqfLoc:'الموقع', dEqfCat:'التصنيف',
    dEqfPhotoNew:'الصورة الرئيسية (مطلوبة)', dEqfPhoto:'الصورة الرئيسية', dChoosePhoto:'اختر صورة', dPhotoSel:'تم اختيار الصورة', dKeepPhoto:'الإبقاء على الصورة الحالية',
    dSaveEq:'حفظ المعدة', dSavePart:'حفظ القطعة',
    dAutoTitle:'مهمة تلقائية', dAutoHint:'تُنشئ مهمة القراءة للفنيين الذين تختارهم حسب الجدول الذي تحدده. المشرف فقط يستطيع تغييرها.', dAutoReading:'القراءة', dAutoNone:'بدون مهمة تلقائية', dAutoBasis:'التكرار حسب', dAutoByPeriod:'مدة زمنية', dAutoByHours:'ساعات التشغيل', dAutoPeriod:'كم مرة', dAutoHours:'كل كم ساعة', dAutoWho:'الفنيون (واحد أو أكثر)', dAutoLoading:'جارٍ تحميل الفنيين…', dAutoNoTechs:'لا يوجد فنيون', dAutoNoHours:'أدخل ساعات التشغيل (1 أو أكثر)', dAutoNoWho:'اختر فنياً واحداً على الأقل', dAutoPW:'أسبوعياً', dAutoPM:'شهرياً', dAutoPQ:'ربع سنوياً', dAutoPS:'نصف سنوياً', dAutoPY:'سنوياً', dCancel:'إلغاء',
    cat:{ '':'—', Mechanical:'ميكانيكية', Electrical:'كهربائية', Cleaning:'نظافة', Safety:'سلامة', Other:'أخرى' },
    tCategory:'الفئة', tNeedNote:'اشتراط كتابة ملاحظة عند الإنجاز', tNeedPhoto:'اشتراط صورة عند الإنجاز', tNeedApproval:'يعتمد المشرف بعد الإنجاز',
    tTemplate:'قالب', tNoTemplate:'— بدون —', tSaveTpl:'حفظ كقالب', tTplName:'اسم القالب', tTplSaved:'تم حفظ القالب', tTplDeleted:'تم حذف القالب',
    tDelTpl:'حذف القالب', fCatAll:'كل الفئات', tAwait:'بانتظار الاعتماد', tApprove:'اعتماد', tSendBack:'إعادة', tReason:'سبب الإعادة؟',
    tApproved:'تم الاعتماد', tSentBack:'تمت الإعادة', tHours:'ساعات العمل', tApprovedBy:'اعتمدها', tCatLabel:'الفئة',
    aTitle:'تكرار هذه المهمة', aHint:'تُنشأ المهمة الأولى الآن لكل شخص تختاره، والمهام التالية تُنشأ تلقائياً حسب الجدول الذي تحدده.', aRepeat:'التكرار', aNone:'بدون تكرار', aWho:'أرسل إلى (واحد أو أكثر)', aHoursHint:'الساعات تأتي من عداد ساعات المعدة في الفحوصات اليومية (بوبكات فقط حالياً).', aNeedWho:'اختر شخصاً واحداً على الأقل', aNeedEq:'اختر المعدة للتكرار حسب ساعات التشغيل', aNeedHours:'أدخل ساعات التشغيل (1 أو أكثر)', aSaved:'تم ضبط التكرار. أُنشئت {n} مهمة الآن.', aList:'المهام المتكررة', aEmpty:'لا توجد مهام متكررة بعد.', aStop:'إيقاف', aResume:'استئناف', aTo:'إلى', aLast:'منذ', aOpen:'مفتوحة الآن', dNeedVal:'املأ الحقول المطلوبة', dLoadEq:'جارٍ تحميل المعدات…', dLoadSp:'جارٍ تحميل قطع الغيار…',
    dPhotos:'الصور', dPhMain:'رئيسية', dPhX1:'تفصيل 1', dPhX2:'تفصيل 2', dPhAdd:'إضافة صورة', dPhReplace:'استبدال', dPhNone:'لا توجد صورة', dPhLoading:'جارٍ تحميل الصور…',
    dPhErr:'تعذّر تحميل الصور: {e}', dPhBusy:'جارٍ حفظ الصورة…', dPhDone:'تم حفظ الصورة', dPhBad:'اختر ملف صورة',
    dAddPart:'إضافة قطعة', dEditPart:'تعديل القطعة', dPartNew:'قطعة جديدة', dSpfNo:'رقم القطعة / الصنف', dSpfBrand:'الماركة', dSpfDesc:'الوصف', dSpfQty:'الكمية',
    dSpfName:'اسم القطعة', dSpfReq:'الكمية المطلوبة', dSpfAvail:'الكمية المتوفرة', dSpfUsed:'الكمية المستخدمة', dSpfMachine:'الماكينة', dSpDel:'حذف القطعة',
    dEmp:'الموظفون', dAddEmp:'إضافة موظف', dEditEmp:'تعديل الموظف', dNewEmp:'موظف جديد', dEmpName:'الاسم الكامل', dEmpUser:'اسم المستخدم', dEmpRole:'الوظيفة',
    dEmpEq:'المعدة (للمشغلين)', dEmpPin:'الرمز السري (4 إلى 8 أرقام)', dEmpPinKeep:'رمز سري جديد (اتركه فارغاً للإبقاء على الحالي)', dEmpActive:'نشط',
    dEmpPerms:'صلاحيات إضافية', dPermTasks:'إنشاء المهام', dPermEq:'تعديل المعدات', dPermSp:'تعديل قطع الغيار', dPermMgr:'المشرف والمدير العام لديهم كل الصلاحيات دائماً',
    dEmpSave:'حفظ الموظف', dSelfNote:'لا يمكنك تعطيل حسابك أو تغيير وظيفتك', dRights:'الصلاحيات', dAllRights:'كل الصلاحيات',
    dActive:'نشط', dInactive:'موقوف', dNoRights:'—', dLoadTeam:'جارٍ تحميل الفريق…', dPerf:'الأداء'
  });

  const ICON = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    requests: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v4M12 16h.01"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    pm: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    tasks: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
    team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    monthly: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    equipment: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    spares: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>',
    schedule: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    costs: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5M12 6v1.5M12 16.5V18"/>',
    procedures: '<path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="2"/>',
    purchasing: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
  };
  const svg = (k, w) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
  const NEW_ON = ['overview', 'tasks', 'schedule'];
  const SECTIONS = ['overview', 'tasks', 'schedule', 'requests', 'procedures', 'pm', 'equipment', 'spares', 'purchasing', 'reports', 'costs', 'team', 'monthly'];
  const TITLE = { overview: 'dOverview', tasks: 'dTasks', equipment: 'dEquip', spares: 'dSpares', team: 'dTeam', monthly: 'dMonthly', pm: 'pmTitle', reports: 'rpTitle', requests: 'rqTitle', schedule: 'schTitle', procedures: 'prcTitle', purchasing: 'poTitle', costs: 'coTitle' };

  let data = null, section = 'overview', loading = false, loadErr = false, timer = null, month = null, who = '', q = '', lineF = '';
  let pendingNew = false;
  const key = () => `dash:${me()}`;
  const nameOf = u => { const p = data && data.people.find(x => x.username.toLowerCase() === String(u || '').toLowerCase()); return p ? p.name : u; };
  const monthName = m => { try { return new Date(m + '-15T12:00:00').toLocaleDateString(LANG === 'ar' ? 'ar-u-nu-latn-ca-gregory' : 'en-GB', { month: 'long', year: 'numeric' }); } catch (e) { return m; } };
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  /* ---------- who may see what ---------- */
  const isMgr = () => isManagerUser();
  const perm = k => isMgr() || !!(session && session.user && session.user.perms && session.user.perms[k]);
  const canEq = () => perm('equipment');
  const canSp = () => perm('spares');
  const canTask = () => perm('tasks');
  const isMgrRole = r => /^(Supervisor|Operations Manager)$/.test(r);
  /** Sections this user may open, in menu order. */
  const visible = () => SECTIONS.filter(s => (s === 'equipment' && canEq()) || (s === 'spares' && canSp()) ||
    (s === 'purchasing' && canSp()) || (isMgr() && (s === 'overview' || s === 'tasks' || s === 'schedule' || s === 'procedures' || s === 'requests' || s === 'pm' || s === 'reports' || s === 'costs' || s === 'team' || s === 'monthly')));

  async function open(sec) {
    if (sec === 'newtask') pendingNew = true;
    else if (SECTIONS.indexOf(sec) >= 0) section = sec;
    if (visible().indexOf(section) < 0) section = visible()[0] || 'overview';
    showView('dash');
    if (!data && isMgr()) { try { const c = await HS.kv.get(key()); if (c && c.data) data = c.data; } catch (e) {} }
    render();
    load();
    clearInterval(timer);
    timer = setInterval(() => { if (document.visibilityState === 'visible' && !$('dash').classList.contains('hidden')) load(); }, 120000);
    if (pendingNew) { pendingNew = false; taskForm(null).catch(() => {}); }
  }
  async function load() {
    if (loading || !session || !isMgr()) return;
    loading = true; spin(true);
    try {
      const r = await HS.api('dashboard', {}, 45000);
      if (r && r.ok) { data = r; loadErr = false; mergeStats(); HS.kv.set(key(), { data: r, at: Date.now() }).catch(() => {}); }
      else { loadErr = true; if (r && r.error) toast(trErr(r.error)); }
    } catch (e) { loadErr = true; if (e.auth) { authLost = true; syncUI(); } }
    loading = false;
    if (!$('dash').classList.contains('hidden')) render();
  }
  function spin(on) { const b = $('dRefresh'); if (b) b.classList.toggle('spin', on); }
  function refreshCurrent() {
    if (isMgr()) load();
    if (section === 'equipment') { loadEquip(true); if (eqSel) { eqHistKey = ''; ensureHist(eqSel); } }
    if (section === 'spares') loadSpares(true);
    if (section === 'team') loadTeam(true);
    if (section === 'reports') { rpData = null; rpErr = ''; }
    if (section === 'requests') { rqData = null; rqErr = ''; }
    if (section === 'schedule') { scData = null; scErr = ''; }
    if (section === 'procedures') { prcData = null; prcErr = ''; }
    if (section === 'purchasing') { puData = null; puErr = ''; }
    if (section === 'costs') { coData = null; coErr = ''; }
    if (section === 'pm') { pmCal = null; pmComp = null; if (eqSel) mtKey = ''; }
  }

  function render() {
    const u = session && session.user;
    if (!u) return;
    const tasks = data ? data.tasks : [];
    const activeCount = tasks.filter(x => x.status === 'Open' || x.status === 'In progress').length;
    const vis = visible();
    const nav = vis.map(s => `<button type="button" data-sec="${s}" class="${s === section ? 'on' : ''}">${svg(s)}<span>${esc(t(TITLE[s]))}</span>${s === 'tasks' && activeCount ? `<span class="cnt">${activeCount}</span>` : ''}${s === 'requests' && data && data.pendingRequests ? `<span class="cnt">${data.pendingRequests}</span>` : ''}${s === 'purchasing' && data && data.pendingPOs ? `<span class="cnt">${data.pendingPOs}</span>` : ''}</button>`).join('');
    const pages = ['Amp Rec', 'Vibration Rec', 'Thermo Rec'].filter(p => (u.access || []).indexOf(p) >= 0)
      .map(p => `<button type="button" data-page="${esc(p)}">${svg('page')}<span>${esc(modName(p))}</span></button>`).join('');
    const updTxt = data ? t('dUpdated', { t: fmtStamp(data.generatedAt) }) : '';
    const ini = String(u.name || u.username || '?').trim().charAt(0).toUpperCase();
    const needData = !data && isMgr() && section !== 'equipment' && section !== 'spares' && section !== 'team' && section !== 'pm' && section !== 'reports' && section !== 'schedule' && section !== 'procedures' && section !== 'purchasing' && section !== 'costs';
    $('dash').innerHTML = `
      <div class="dsh">
        <aside class="dside">
          <div class="lockup"><svg class="mk" viewBox="0 0 34 63" aria-hidden="true"><use href="#mk" width="34" height="63"/></svg><div><b class="wm">Holoul</b><small>${esc(t('brandSub'))}</small></div></div>
          <nav class="dnav">${nav}${pages ? `<small>${esc(t('dPages'))}</small>${pages}` : ''}</nav>
          <div class="dme"><div class="avatar">${esc(String(u.name || '?').charAt(0).toUpperCase())}</div>
            <div class="nm"><b>${esc(u.name)}</b><small>${esc(roleName(u.role))}</small></div>
            <button class="iconbtn sm" type="button" data-act="settings" aria-label="${esc(t('settings'))}">${svg('gear')}</button></div>
        </aside>
        <main class="dmain">
          <div class="dtop">
            <button class="back" type="button" data-act="app" aria-label="${esc(t('dBackApp'))}">${svg('back', 2.2)}</button>
            <h2>${esc(t(TITLE[section]))}</h2>
            <button class="iconbtn sm avbtn dtopav" type="button" data-act="profile" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(t('profile'))}"><span>${esc(ini)}</span></button>
            <button class="iconbtn sm" type="button" data-act="settings" aria-label="${esc(t('settings'))}">${svg('gear')}</button>
          </div>
          <div class="dtabs">${vis.map(s => `<button type="button" data-sec="${s}" class="${s === section ? 'on' : ''}">${esc(t(TITLE[s]))}</button>`).join('')}</div>
          <header class="dhead">
            <div><h1>${esc(t(TITLE[section]))}</h1><small>${esc(longDate())}</small></div>
            <div class="dtools">
              ${canTask() && NEW_ON.indexOf(section) >= 0 ? `<button class="btn pri" type="button" data-act="new">${svg('plus', 2.4)}<span>${esc(t('dNewTask'))}</span></button>` : ''}
              ${updTxt ? `<span class="hupd">${esc(updTxt)}</span>` : ''}
              <button class="iconbtn sm" type="button" id="dRefresh" aria-label="${esc(t('dRefresh'))}" title="${esc(t('dRefresh'))}">${svg('refresh')}</button>
              <button class="iconbtn sm avbtn" type="button" data-act="profile" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(t('profile'))}"><span>${esc(ini)}</span></button>
            </div>
          </header>
          ${loadErr && data ? `<div class="dnote">${esc(t('dashLoadErr'))}</div>` : ''}
          <div id="dBody">${needData ? `<div class="dempty">${esc(loading ? t('dLoading') : t('dashEmpty'))}</div>` : body()}</div>
        </main>
      </div>`;
    spin(loading);
    const D = $('dash');
    D.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { section = b.dataset.sec; render(); window.scrollTo(0, 0); });
    D.querySelectorAll('[data-page]').forEach(b => b.onclick = () => openRecord(b.dataset.page));
    D.querySelectorAll('[data-act="settings"]').forEach(b => b.onclick = openSettings);
    D.querySelectorAll('[data-act="profile"]').forEach(b => b.onclick = () => window.toggleProfile(b, { updated: updTxt ? updTxt.replace(/^\S+\s/, '') : '' }));
    D.querySelectorAll('[data-act="app"]').forEach(b => b.onclick = () => showHome(true));
    D.querySelectorAll('[data-act="new"]').forEach(b => b.onclick = () => taskForm(null).catch(() => {}));
    $('dRefresh').onclick = refreshCurrent;
    const dRules = $('dRules'); if (dRules) dRules.onclick = openRepeats;
    const dLim = $('dLimits'); if (dLim) dLim.onclick = openLimits;
    D.querySelectorAll('[data-tid]').forEach(b => b.onclick = () => taskDetail(b.dataset.tid));
    D.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { section = b.dataset.go; render(); });
    D.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { month = b.dataset.month; render(); });
    const fw = $('dWho'); if (fw) fw.onchange = () => { who = fw.value; render(); };
    const fl = $('dLine'); if (fl) fl.onchange = () => { lineF = fl.value; render(); };
    const fc = $('dCat'); if (fc) fc.onchange = () => { catF = fc.value; render(); };
    const fq = $('dQ'); if (fq) { fq.oninput = () => { q = fq.value; renderBoardOnly(); }; }
    bindEquipment();
    bindPm();
    bindSpares();
    bindTeam();
    bindReport();
    bindRequests();
    bindSchedule();
    bindProcedures();
    bindPurchasing();
    bindCosts();
    D.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => addPhoto(b.dataset.ph));
    D.querySelectorAll('[data-img]').forEach(b => b.onclick = () => window.open(b.dataset.img, '_blank', 'noopener'));
  }
  function body() {
    if (visible().indexOf(section) < 0) return `<div class="dempty">${esc(t('noData'))}</div>`;
    if (section === 'tasks') return tasksView();
    if (section === 'pm') return pmView();
    if (section === 'team') return teamView();
    if (section === 'reports') return reportView();
    if (section === 'requests') return requestsView();
    if (section === 'schedule') return scheduleView();
    if (section === 'procedures') return proceduresView();
    if (section === 'purchasing') return purchasingView();
    if (section === 'costs') return costsView();
    if (section === 'monthly') return monthlyView();
    if (section === 'equipment') return equipmentView();
    if (section === 'spares') return sparesView();
    return overview();
  }

  /* ---------- shared: photos (Drive, one main + up to two details) ---------- */
  const filePick = document.createElement('input');
  filePick.type = 'file'; filePick.accept = 'image/*'; filePick.className = 'hidden'; filePick.id = 'dashPick';
  document.body.appendChild(filePick);
  function pickFile() {
    return new Promise(res => { filePick.value = ''; filePick.onchange = () => res(filePick.files[0] || null); filePick.click(); });
  }
  async function photoFrom(file) { const img = await loadImage(file); return scaled(img, 1600, 0.82); }

  let phState = { id: '', photos: null, err: '' };
  const eqPhotoKey = e => (e.no && !/^-+$/.test(e.no)) ? e.no : e.name;
  const spPhotoKey = p => (p.kind === 'mechanical' ? 'M-' : 'E-') + String(p.no || '').trim();
  function ensurePhotos(kind, key) {
    const id = kind + '|' + key;
    if (phState.id === id) return;
    phState = { id: id, photos: null, err: '' };
    HS.api('itemPhotos', { kind: kind, key: key }, 45000).then(r => {
      if (phState.id !== id) return;
      if (r && r.ok) phState.photos = r.photos || {}; else phState.err = r && r.error ? trErr(r.error) : '';
    }).catch(err => {
      if (phState.id === id) phState.err = err.message || String(err);
      if (err.auth) { authLost = true; syncUI(); }
    }).finally(() => { if (!$('dash').classList.contains('hidden')) render(); });
  }
  function gallery(canEdit) {
    if (phState.photos === null) return `<div class="dempty">${esc(phState.err ? t('dPhErr', { e: phState.err }) : t('dPhLoading'))}</div>`;
    const ph = phState.photos;
    const slots = [['main', 'dPhMain'], ['extra1', 'dPhX1'], ['extra2', 'dPhX2']];
    return `<div class="gal">${slots.map(([slot, lab]) => {
      const p = ph[slot];
      const img = p && p.thumb ? `<img src="${p.thumb}" alt="" data-img="${esc(p.url || p.thumb)}">` : `<span>${esc(t('dPhNone'))}</span>`;
      const btn = canEdit ? `<button type="button" class="btn" data-ph="${slot}">${esc(t(p ? 'dPhReplace' : 'dPhAdd'))}</button>` : '';
      return `<div class="gslot ${slot === 'main' ? 'main' : ''}">${img}<span class="cap">${esc(t(lab))}</span>${btn}</div>`;
    }).join('')}</div>`;
  }
  async function addPhoto(slot) {
    const i = phState.id.indexOf('|');
    if (i < 0) return;
    const kind = phState.id.slice(0, i), key = phState.id.slice(i + 1);
    const f = await pickFile();
    if (!f) return;
    toast(t('dPhBusy'));
    try {
      const data = await photoFrom(f);
      const r = await HS.api('itemPhotoSave', { kind: kind, key: key, slot: slot, data: data }, 90000);
      if (!r || !r.ok) { toast(trErr(r && r.error) || t('needOnline')); return; }
      toast(t('dPhDone'));
      phState = { id: '', photos: null, err: '' };
      ensurePhotos(kind, key);
    } catch (err) {
      toast(err.auth ? t('sessionExpired') : (/image/i.test(err.message || '') ? t('dPhBad') : t('needOnline')));
    }
  }

  /* ---------- equipment: systems -> equipment -> details, photos, history ---------- */
  let eqQ = '', eqLineF = '', eqLocF = '', eqSel = null, eqShown = [], eqHist = null, eqHistKey = '', eqHistErr = '', eqOpen = {};
  let eqAll = null, eqErr = '', eqLoading = false, eqShowDel = false;
  let spStock = {}, spLowKeys = [], spVendors = [], pinfo = null, pinfoKey = '';
  let spData = null, spLoading = false, spErr = '', spTab = 'electrical', spQ = '', spLow = false, spShowDel = false, spSel = null, spShown = [];
  let armKey = '';
  let eqOffline = {}, pendingAsset = '', pendingPart = null;
  const eqKey = e => [e.no, e.name, e.line, e.loc].join('|');
  const isLowM = p => /low/i.test(p.status || '') || spLowKeys.indexOf('m:' + p.no) >= 0;
  const isOutE = p => (p.qty !== '' && Number(p.qty) <= 0) || spLowKeys.indexOf('e:' + p.no) >= 0;
  const evLabel = a => ['Created', 'Started', 'Done', 'Cancelled', 'Reopened', 'Edited'].indexOf(a) >= 0 ? t('ev.' + a) : a;
  /** Active equipment (for pickers). */
  const eqActive = () => (eqAll || (data && data.equipment) || []).filter(e => !e.deleted);
  const eqSource = () => eqShowDel ? (eqAll || (data && data.equipment) || []) : eqActive();

  /** Job counts come from the dashboard (managers only); copy them onto the equipment list by name / number / system / location. */
  function mergeStats() {
    if (!eqAll || !data || !data.equipment) return;
    const st = {};
    data.equipment.forEach(x => { st[eqKey(x)] = x; });
    eqAll.forEach(e => { const s = st[eqKey(e)]; if (s) { e.jobs = s.jobs; e.open = s.open; e.lastDone = s.lastDone; } });
  }
  function loadEquip(force) {
    if (eqLoading) return Promise.resolve();
    eqLoading = true; eqErr = '';
    return HS.api('equipment', { all: canEq(), fresh: !!force }, 45000).then(r => {
      if (r && r.ok) {
        eqAll = r.equipment || [];
        eqOffline = r.offline || {};
        mergeStats();
        if (eqSel) eqSel = eqAll.find(x => x.row === eqSel.row) || null;
      } else eqErr = r && r.error ? trErr(r.error) : '';
    }).catch(err => {
      eqErr = err.message || String(err);
      if (err.auth) { authLost = true; syncUI(); }
    }).finally(() => { eqLoading = false; if (!$('dash').classList.contains('hidden')) render(); });
  }
  function eqFiltered() {
    const s = eqQ.trim().toLowerCase();
    return eqSource().filter(e => (!eqLineF || e.line === eqLineF) && (!eqLocF || e.loc === eqLocF) &&
      (!s || [e.name, e.no, e.line, e.loc, e.cat].join(' ').toLowerCase().indexOf(s) >= 0))
      .sort((a, b) => String(a.line).localeCompare(String(b.line)) || String(a.loc).localeCompare(String(b.loc)));
  }
  function eqRows() {
    eqShown = eqFiltered();
    if (!eqShown.length) return `<tr><td colspan="6" class="dempty">${esc(t('noData'))}</td></tr>`;
    let rows = '', grp = null;
    eqShown.forEach((e, i) => {
      const g = (e.line || '—') + (e.loc ? ' · ' + e.loc : '');
      if (g !== grp) { grp = g; rows += `<tr class="grp"><td colspan="6">${esc(g)}</td></tr>`; }
      rows += `<tr class="clickrow ${e.deleted ? 'off' : ''}" data-eqi="${i}"><td><b>${esc(e.name)}</b>${e.deleted ? `<span class="deltag">${esc(t('dDeleted'))}</span>` : ''}${e.no && eqOffline[e.no] ? `<span class="offtag">${esc(t('dtOffTag'))}</span>` : ''}${e.cat ? `<small>${esc(e.cat)}</small>` : ''}</td>
        <td>${e.no ? `<span class="eqno">${esc(e.no)}</span>` : '—'}</td><td>${esc(e.loc || '—')}</td>
        <td class="num">${e.jobs || 0}</td><td class="num">${e.open ? `<b>${e.open}</b>` : 0}</td>
        <td>${e.lastDone ? esc(shortDate(e.lastDone)) : '—'}</td></tr>`;
    });
    return rows;
  }
  function bindEquipment() {
    const D = $('dash');
    D.querySelectorAll('[data-eqi]').forEach(b => b.onclick = () => { eqSel = eqShown[+b.dataset.eqi]; eqHistKey = ''; eqOpen = {}; armKey = ''; phState = { id: '', photos: null, err: '' }; render(); window.scrollTo(0, 0); });
    D.querySelectorAll('[data-eqo]').forEach(b => b.onclick = () => { eqOpen[b.dataset.eqo] = !eqOpen[b.dataset.eqo]; render(); });
    const eb = D.querySelector('[data-eqback]'); if (eb) eb.onclick = () => { eqSel = null; render(); window.scrollTo(0, 0); };
    D.querySelectorAll('[data-eqact]').forEach(b => b.onclick = () => eqAction(b.dataset.eqact));
    const mb = D.querySelector('[data-mtadd]'); if (mb) mb.onclick = () => meterForm(eqSel);
    const qb = D.querySelector('[data-qr]'); if (qb) qb.onclick = () => qrModal({ title: eqSel.name, sub: [eqSel.no, eqSel.line, eqSel.loc].filter(Boolean).join(' · '), url: assetUrl(eqSel.no), hint: t('qrHint') });
    const qf = D.querySelector('[data-qrf]'); if (qf) qf.onclick = () => qrModal({ title: eqSel.name, sub: t('qrFaultSub') + ' · ' + eqSel.no, url: faultUrl(eqSel.no), hint: t('qrFaultHint') });
    const db = D.querySelector('[data-dtgo]'); if (db) db.onclick = () => {
      const off = dtData && dtData.open;
      const orders = (eqHist || []).filter(x => off ? x.status !== 'Cancelled' : (x.status === 'Open' || x.status === 'In progress')).slice(0, 25).map(x => ({ id: x.id, title: x.title }));
      downtimeForm({ no: eqSel.no, name: eqSel.name }, off ? 'end' : 'start', orders, () => { dtKey = ''; loadEquip(true); });
    };
    const sq = D.querySelector('[data-act="scanQr"]'); if (sq) sq.onclick = () => scanForm();
    const pf = D.querySelector('[data-act="printFault"]'); if (pf) pf.onclick = () => {
      const items = eqShown.filter(e => e.no && !e.deleted).map(e => ({ title: e.name, sub: t('qrFaultSub') + ' · ' + e.no, url: faultUrl(e.no) }));
      if (!items.length) { toast(t('qrNone')); return; }
      printLabels(items);
    };
    const pe = D.querySelector('[data-act="printEq"]'); if (pe) pe.onclick = () => {
      const items = eqShown.filter(e => e.no && !e.deleted).map(e => ({ title: e.name, sub: [e.no, e.line, e.loc].filter(Boolean).join(' · '), url: assetUrl(e.no) }));
      if (!items.length) { toast(t('qrNone')); return; }
      printLabels(items);
    };
    const cb = D.querySelector('[data-act="causes"]'); if (cb) cb.onclick = () => causesForm();
    const ab = D.querySelector('[data-act="addEq"]'); if (ab) ab.onclick = () => eqForm(null);
    const ef = $('eqQ'); if (ef) ef.oninput = () => { eqQ = ef.value; $('eqTbody').innerHTML = eqRows(); bindEquipment(); };
    const elf = $('eqLineF'); if (elf) elf.onchange = () => { eqLineF = elf.value; render(); };
    const elc = $('eqLocF'); if (elc) elc.onchange = () => { eqLocF = elc.value; render(); };
    const dl = $('eqDel'); if (dl) dl.onchange = () => { eqShowDel = dl.checked; render(); };
  }
  function equipmentView() {
    if (eqAll === null) {
      if (!eqLoading && !eqErr) loadEquip(false);
      return eqErr ? `<div class="dnote">${esc(t('eqListErr', { e: eqErr }))}</div>` : `<div class="dempty">${esc(t('dLoadEq'))}</div>`;
    }
    applyPendingAsset();
    if (eqSel) return equipDetail();
    const eq = eqSource();
    const lines = [...new Set(eqAll.map(e => e.line).filter(Boolean))].sort();
    const locs = [...new Set(eqAll.map(e => e.loc).filter(Boolean))].sort();
    return `<div class="toolbar"><select id="eqLocF"><option value="">${esc(t('eqAllLoc'))}</option>${locs.map(l => `<option value="${esc(l)}" ${l === eqLocF ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select id="eqLineF"><option value="">${esc(t('eqAllLine'))}</option>${lines.map(l => `<option value="${esc(l)}" ${l === eqLineF ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <input id="eqQ" type="search" dir="auto" placeholder="${esc(t('eqSearch'))}" value="${esc(eqQ)}">
      <button type="button" class="btn" data-act="scanQr">${esc(t('scanBtn'))}</button>
      <button type="button" class="btn" data-act="printEq">${esc(t('qrPrintAll'))}</button>
      ${isMgr() ? `<button type="button" class="btn" data-act="printFault">${esc(t('qrFaultAll'))}</button>` : ''}
      ${isMgr() ? `<button type="button" class="btn" data-act="causes">${esc(t('causeBtn'))}</button>` : ''}
      <label class="chk"><input type="checkbox" id="eqDel" ${eqShowDel ? 'checked' : ''}> ${esc(t('dShowDel'))}</label>
      ${canEq() ? `<button type="button" class="btn pri" data-act="addEq">${svg('plus', 2.4)}<span>${esc(t('dAddEq'))}</span></button>` : ''}</div>
      <section class="dcard"><div class="tscroll"><table class="dtable"><thead><tr>
        <th>${esc(t('dEquip'))}</th><th>${esc(t('eqNumber'))}</th><th>${esc(t('eqLocation'))}</th><th class="num">${esc(t('eqJobs'))}</th><th class="num">${esc(t('eqOpenCol'))}</th><th>${esc(t('eqLastDone'))}</th>
      </tr></thead><tbody id="eqTbody">${eq.length ? eqRows() : `<tr><td colspan="6" class="dempty">${esc(t('noData'))}</td></tr>`}</tbody></table></div></section>`;
  }
  /** Loads the full history of one equipment row (all dates, all statuses) once per selection. */
  function ensureHist(e) {
    const k = eqKey(e);
    if (eqHistKey === k) return;
    eqHistKey = k; eqHist = null; eqHistErr = '';
    HS.api('equipmentHistory', { equipment: { name: e.name, no: e.no, line: e.line, loc: e.loc } }, 45000).then(r => {
      if (eqHistKey !== k) return;
      if (r && r.ok) eqHist = r.tasks; else eqHistErr = r && r.error ? trErr(r.error) : '';
    }).catch(err => {
      if (eqHistKey === k) eqHistErr = err.message || String(err);
      if (err.auth) { authLost = true; syncUI(); }
    }).finally(() => { if (!$('dash').classList.contains('hidden')) render(); });
  }
  function equipDetail() {
    const e = eqSel;
    if (e && e.auto && !autoPeople) ensureAutoPeople(() => { if (eqSel) render(); });   // names for the rule label
    ensureHist(e);
    ensureMeter(e);
    ensureDowntime(e);
    ensurePhotos('equipment', eqPhotoKey(e));
    const tasks = eqHist || [];
    const done = tasks.filter(x => x.status === 'Done');
    const open = tasks.filter(x => x.status === 'Open' || x.status === 'In progress');
    const last = done.map(x => String(x.done).slice(0, 10)).sort().pop();
    const rows = tasks.map(x => {
      const photo = /^https?:/.test(x.donePhoto || '') ? ` <a href="${esc(x.donePhoto)}" target="_blank" rel="noopener">${esc(t('openPhoto'))}</a>` : '';
      const where = [x.line, x.location].filter(Boolean).join(' · ');
      const ev = eqOpen[x.id] ? `<tr class="evrow"><td colspan="6"><div class="evlist">${(x.events || []).map(v =>
        `<div><b>${esc(fmtStamp(v.at))}</b> · ${esc(evLabel(v.action))}${v.by ? ' · ' + esc(nameOf(v.by)) : ''}${v.note ? ` <span class="mini">— ${esc(v.note)}</span>` : ''}</div>`).join('') || '<span class="mini">—</span>'}</div></td></tr>` : '';
      return `<tr class="clickrow" data-eqo="${esc(x.id)}"><td>${esc(fmtStamp(x.created))}</td>
        <td><b>${esc(x.title)}</b><small>${esc(x.id)}${where ? ' · ' + esc(where) : ''}</small></td>
        <td><span class="chip ${STATUS_CLASS(x.status)}">${esc(t('status.' + x.status))}</span></td>
        <td>${esc(x.assigneeName || nameOf(x.assignee))}</td>
        <td>${x.done ? esc(fmtStamp(x.done)) : x.started ? esc(fmtStamp(x.started)) : '—'}</td>
        <td>${x.doneNote ? esc(x.doneNote) : '—'}${photo}</td></tr>${ev}`;
    }).join('');
    const histBody = eqHist === null
      ? `<div class="dempty">${esc(eqHistErr ? t('eqHistErr', { e: eqHistErr }) : t('eqHistLoading'))}</div>`
      : tasks.length
        ? `<div class="tscroll"><table class="dtable"><thead><tr><th>${esc(t('hCreated'))}</th><th>${esc(t('hJob'))}</th><th>${esc(t('hStatus'))}</th><th>${esc(t('hWho'))}</th><th>${esc(t('hFinished'))}</th><th>${esc(t('hNote'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<div class="dempty">${esc(t('eqHistEmpty'))}</div>`;
    const armed = armKey === 'eq|' + eqKey(e);
    const actions = canEq() ? `<div class="dact"><button type="button" class="ghostbtn" data-eqact="edit">${esc(t('aEdit'))}</button>
      ${e.deleted ? `<button type="button" class="ghostbtn" data-eqact="restore">${esc(t('dEqRestore'))}</button>`
        : `<button type="button" class="dangerbtn" data-eqact="del">${esc(armed ? t('dEqDelSure') : t('dEqDel'))}</button>`}</div>` : '';
    return `<div class="eqback"><button class="btn" type="button" data-eqback>${svg('back', 2.2)}<span>${esc(t('eqAll'))}</span></button></div>
      <section class="dcard eqhead"><div><h3>${esc(e.name)}</h3>${e.deleted ? `<span class="deltag">${esc(t('dDeleted'))}</span>` : ''}${e.cat ? `<small>${esc(e.cat)}</small>` : ''}</div>
        <div class="eqmeta"><span class="chip">${esc(e.line || '—')}</span><span>${esc(e.loc || '')}</span>${e.no ? `<span class="eqno">${esc(e.no)}</span>` : ''}${autoLabel(e) ? `<span class="chip">${esc(autoLabel(e))}</span>` : ''}</div>${actions}</section>
      ${statusCard(e)}
      <section class="dcard"><h4>${esc(t('dPhotos'))}</h4>${gallery(canEq())}</section>
      ${meterCard(e)}
      ${downtimeCard(e)}
      <div class="kpis">
        <div class="kpi"><small>${esc(t('eqJobs'))}</small><b>${eqHist ? tasks.length : '…'}</b></div>
        <div class="kpi"><small>${esc(t('eqStatDone'))}</small><b>${eqHist ? done.length : '…'}</b></div>
        <div class="kpi"><small>${esc(t('eqStatOpen'))}</small><b>${eqHist ? open.length : '…'}</b></div>
        <div class="kpi"><small>${esc(t('eqStatLast'))}</small><b>${last ? esc(shortDate(last)) : '—'}</b></div>
      </div>
      <section class="dcard"><h4>${esc(t('eqHistTitle'))}<span>${eqHist ? tasks.length : ''}</span></h4>${histBody}</section>`;
  }
  function eqAction(a) {
    if (!eqSel) return;
    if (a === 'edit') return eqForm(eqSel);
    if (a === 'del') {
      const k = 'eq|' + eqKey(eqSel);
      if (armKey !== k) { armKey = k; render(); return; }
      return setEqStatus(eqSel, 'Deleted');
    }
    if (a === 'restore') return setEqStatus(eqSel, 'Active');
  }
  async function setEqStatus(e, status) {
    try {
      const r = await HS.api('equipmentStatus', { row: e.row, status: status }, 45000);
      if (!r || !r.ok) { toast(trErr(r && r.error) || t('needOnline')); return; }
      armKey = ''; toast(t('saved'));
      await loadEquip(true);
    } catch (err) { toast(err.auth ? t('sessionExpired') : t('needOnline')); }
  }

  /** Form for a new equipment (main photo required) or an existing one (photo optional). */
  function eqForm(e) {
    const isNew = !e;
    const mgr = isMgr();   // only supervisors and operations managers see the automatic task section
    let photo = null;
    const all = eqAll || [];
    const uniq = f => [...new Set(all.map(f).filter(Boolean))].sort();
    const opts = arr => arr.map(v => `<option value="${esc(v)}"></option>`).join('');
    showModal(`<h2>${esc(t(isNew ? 'dAddEq' : 'dEditEq'))}</h2>
      <form class="tform" id="eqF" autocomplete="off">
        ${fld('eqN', 'dEqfName', e ? e.name : '', { max: 120 })}
        ${fld('eqL', 'dEqfLine', e ? e.line : '', { max: 80, list: 'eqLinesL' })}<datalist id="eqLinesL">${opts(uniq(x => x.line))}</datalist>
        <div class="row2"><div>${fld('eqNo', 'dEqfNo', e ? e.no : '', { max: 60, ltr: true })}</div>
          <div>${fld('eqLo', 'dEqfLoc', e ? e.loc : '', { max: 40, list: 'eqLocsL' })}<datalist id="eqLocsL">${opts(uniq(x => x.loc))}</datalist></div></div>
        ${fld('eqC', 'dEqfCat', e ? e.cat : '', { max: 80, list: 'eqCatsL' })}<datalist id="eqCatsL">${opts(uniq(x => x.cat))}</datalist>
        ${photoRow('eqPh', isNew)}
        ${mgr ? autoBlock(e) : ''}
        <div class="msg" id="eqMsg"></div>
        <button class="primary" type="submit" id="eqGo">${esc(t('dSaveEq'))}</button>
      </form>`, '');
    if (mgr) bindAuto(e);
    $('eqPh').onclick = async () => {
      const f = await pickFile(); if (!f) return;
      try { photo = await photoFrom(f); $('eqPhName').textContent = t('dPhotoSel'); } catch (err) { $('eqMsg').textContent = t('dPhBad'); }
    };
    $('eqF').onsubmit = async ev => {
      ev.preventDefault();
      const item = { name: $('eqN').value.trim(), line: $('eqL').value.trim(), no: $('eqNo').value.trim(), location: $('eqLo').value.trim(), category: $('eqC').value.trim() };
      if (!item.name || !item.line) { $('eqMsg').textContent = t('dNeedVal'); return; }
      if (mgr) {
        item.auto = autoPayload();   // reading '' clears the automatic task
        if (item.auto.reading && item.auto.basis === 'hours' && !(Number(item.auto.hours) >= 1)) { $('eqMsg').textContent = t('dAutoNoHours'); return; }
        if (item.auto.reading && !item.auto.assignees.length) { $('eqMsg').textContent = t('dAutoNoWho'); return; }
      }
      if (!isNew) item.row = e.row;
      if (photo) item.photo = photo;
      $('eqGo').disabled = true; $('eqMsg').textContent = '';
      try {
        const r = await HS.api('equipmentSave', { item: item }, 90000);
        if (!r || !r.ok) { $('eqMsg').textContent = trErr(r && r.error) || t('needOnline'); $('eqGo').disabled = false; return; }
        hideModal(); toast(t('saved'));
        if (isNew) { eqSel = null; eqQ = ''; }
        phState = { id: '', photos: null, err: '' };
        eqHistKey = '';
        await loadEquip(true);
      } catch (err) { $('eqMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('eqGo').disabled = false; }
    };
  }

  /* ---------- automatic reading tasks (the supervisor sets them on an equipment) ---------- */
  const AUTO_READINGS = ['Amp Rec', 'Vibration Rec', 'Thermo Rec'];
  const AUTO_PERIODS = [['Weekly', 'dAutoPW'], ['Monthly', 'dAutoPM'], ['Quarterly', 'dAutoPQ'], ['Semi-annual', 'dAutoPS'], ['Yearly', 'dAutoPY']];
  /** Reads the rule text from the equipment sheet, e.g. "Amp Rec | Monthly | tech1" or "Amp Rec | 500 h | tech1". */
  function autoRule(s) {
    const out = { reading: '', basis: 'period', period: 'Monthly', hours: '', assignees: [] };
    const p = String(s || '').split('|').map(x => x.trim());
    if (p.length < 3 || AUTO_READINGS.indexOf(p[0]) < 0) return out;
    out.reading = p[0];
    const h = p[1].match(/^(\d+) h$/);
    if (h) { out.basis = 'hours'; out.hours = h[1]; } else out.period = p[1];
    out.assignees = p.slice(2).join('|').split(',').map(x => x.trim()).filter(Boolean);
    return out;
  }
  let autoPeople = null, autoPeopleBusy = false;   // everyone who can be assigned (from the "people" call)
  function ensureAutoPeople(then) {
    if (autoPeople || autoPeopleBusy) return;
    autoPeopleBusy = true;
    HS.api('people', {}, 45000).then(r => { if (r && r.ok) autoPeople = r.assignable || []; }).catch(() => {})
      .finally(() => { autoPeopleBusy = false; if (autoPeople && then) then(); });
  }
  const autoName = u => { const p = (autoPeople || []).filter(x => String(x.username).toLowerCase() === String(u).toLowerCase())[0]; return p ? p.name : u; };
  /** Short text for the equipment page, e.g. "Amp Rec · Monthly · Tech One". Empty when no rule. */
  function autoLabel(e) {
    const r = autoRule(e && e.auto);
    if (!r.reading) return '';
    const per = AUTO_PERIODS.filter(p => p[0] === r.period)[0];
    const when = r.basis === 'hours' ? r.hours + ' h' : (per ? t(per[1]) : r.period);
    return [modName(r.reading), when, r.assignees.map(autoName).join(', ')].filter(Boolean).join(' · ');
  }
  function autoBlock(e) {
    const cur = autoRule(e && e.auto);
    const opt = (v, label, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(label)}</option>`;
    return `<div class="fgroup" id="eqAuto"><h4>${esc(t('dAutoTitle'))}</h4>
      <p class="hint" style="margin:0 0 10px">${esc(t('dAutoHint'))}</p>
      <label for="eqAR">${esc(t('dAutoReading'))}</label>
      <select class="ffield" id="eqAR">${opt('', t('dAutoNone'), cur.reading)}${AUTO_READINGS.map(r => opt(r, modName(r), cur.reading)).join('')}</select>
      <label for="eqAB">${esc(t('dAutoBasis'))}</label>
      <select class="ffield" id="eqAB">${opt('period', t('dAutoByPeriod'), cur.basis)}${opt('hours', t('dAutoByHours'), cur.basis)}</select>
      <div id="eqAPw"${cur.basis === 'hours' ? ' hidden' : ''}><label for="eqAP">${esc(t('dAutoPeriod'))}</label>
        <select class="ffield" id="eqAP">${AUTO_PERIODS.map(p => opt(p[0], t(p[1]), cur.period)).join('')}</select></div>
      <div id="eqAHw"${cur.basis === 'hours' ? '' : ' hidden'}><label for="eqAH">${esc(t('dAutoHours'))}</label>
        <input class="ffield" id="eqAH" type="number" inputmode="numeric" min="1" max="100000" step="1" value="${esc(cur.hours)}"></div>
      <label>${esc(t('dAutoWho'))}</label>
      <div id="eqAW"><span class="mini">${esc(t('dAutoLoading'))}</span></div>
    </div>`;
  }
  function bindAuto(e) {
    const cur = autoRule(e && e.auto);
    const basis = $('eqAB');
    basis.onchange = () => { $('eqAPw').hidden = basis.value === 'hours'; $('eqAHw').hidden = basis.value !== 'hours'; };
    HS.api('people', {}, 45000).then(r => {
      if (r && r.ok) autoPeople = r.assignable || [];
      const box = $('eqAW'); if (!box) return;
      const techs = (r && r.ok ? r.assignable || [] : []).filter(p => /^(Mech|Elec)-Technician$/.test(p.role));
      box.innerHTML = techs.length
        ? techs.map(p => `<label class="chkrow"><input type="checkbox" value="${esc(p.username)}"${cur.assignees.some(a => a.toLowerCase() === String(p.username).toLowerCase()) ? ' checked' : ''}><span>${esc(p.name)}<small>${esc(roleName(p.role))}</small></span></label>`).join('')
        : `<span class="mini">${esc(t('dAutoNoTechs'))}</span>`;
    }).catch(() => { const box = $('eqAW'); if (box) box.innerHTML = `<span class="mini">${esc(t('needOnline'))}</span>`; });
  }
  function autoPayload() {
    return { reading: $('eqAR').value, basis: $('eqAB').value, period: $('eqAP').value, hours: $('eqAH').value,
      assignees: [...document.querySelectorAll('#eqAW input:checked')].map(i => i.value) };
  }

  /* ---------- spare parts (Maintainance Inventory: electrical and mechanical tabs) ---------- */
  function loadSpares(force) {
    if (spLoading) return;
    spLoading = true; spErr = '';
    HS.api('spares', { fresh: !!force, all: canSp() }, 45000).then(r => {
      if (r && r.ok) { spData = r.spares; spStock = r.stock || {}; spLowKeys = r.low || []; spVendors = r.vendors || []; if (spSel) spSel = findSpare(spSel.kind, spSel.row); }
      else spErr = r && r.error ? trErr(r.error) : '';
    }).catch(err => {
      spErr = err.message || String(err);
      if (err.auth) { authLost = true; syncUI(); }
    }).finally(() => { spLoading = false; if (!$('dash').classList.contains('hidden')) render(); });
  }
  function findSpare(kind, row) {
    const list = kind === 'mechanical' ? spData.mechanical : spData.electrical;
    const p = list.find(x => x.row === row);
    return p ? Object.assign({ kind: kind }, p) : null;
  }
  function spList() {
    const s = spQ.trim().toLowerCase();
    if (spTab === 'electrical')
      return spData.electrical.filter(p => (spShowDel || !p.deleted) && (!s || [p.no, p.brand, p.desc].join(' ').toLowerCase().indexOf(s) >= 0) && (!spLow || isOutE(p)))
        .map(p => Object.assign({ kind: 'electrical' }, p));
    return spData.mechanical.filter(p => (spShowDel || !p.deleted) && (!s || [p.no, p.name, p.machine].join(' ').toLowerCase().indexOf(s) >= 0) && (!spLow || isLowM(p)))
      .map(p => Object.assign({ kind: 'mechanical' }, p));
  }
  const pkey = p => (p.kind === 'mechanical' ? 'm:' : 'e:') + p.no;
  const costOf = p => { const st = spStock[pkey(p)]; return st && st.cost != null ? String(st.cost) : '—'; };
  function spTable() {
    spShown = spList();
    if (!spShown.length) return `<div class="dempty">${esc(t('spEmpty'))}</div>`;
    if (spTab === 'electrical') return `<table class="dtable"><thead><tr><th>${esc(t('spPartNo'))}</th><th>${esc(t('spBrand'))}</th><th>${esc(t('spDesc'))}</th><th class="num">${esc(t('spQty'))}</th><th class="num">${esc(t('pCostCol'))}</th></tr></thead><tbody>
      ${spShown.map((p, i) => `<tr class="clickrow ${p.deleted ? 'off' : ''}" data-spi="${i}"><td><span class="eqno">${esc(p.no)}</span>${p.deleted ? `<span class="deltag">${esc(t('dDeleted'))}</span>` : ''}</td><td>${esc(p.brand || '—')}</td><td>${esc(p.desc)}</td>
        <td class="num ${isOutE(p) ? 'late' : ''}">${esc(p.qty || '—')}</td><td class="num">${esc(costOf(p))}</td></tr>`).join('')}</tbody></table>`;
    return `<table class="dtable"><thead><tr><th>${esc(t('spPartNo'))}</th><th>${esc(t('spName'))}</th><th class="num">${esc(t('spReq'))}</th><th class="num">${esc(t('spAvail'))}</th>
      <th class="num">${esc(t('spUsed'))}</th><th class="num">${esc(t('spRem'))}</th><th>${esc(t('spStatus'))}</th><th>${esc(t('spMachine'))}</th><th class="num">${esc(t('pCostCol'))}</th></tr></thead><tbody>
      ${spShown.map((p, i) => `<tr class="clickrow ${p.deleted ? 'off' : ''}" data-spi="${i}"><td><span class="eqno">${esc(p.no)}</span>${p.deleted ? `<span class="deltag">${esc(t('dDeleted'))}</span>` : ''}</td><td>${esc(p.name)}</td><td class="num">${esc(p.required || '—')}</td>
        <td class="num">${esc(p.available || '—')}</td><td class="num">${esc(p.used || '—')}</td><td class="num ${isLowM(p) ? 'late' : ''}">${esc(p.remaining || '—')}</td>
        <td>${p.status ? `<span class="spst ${isLowM(p) ? 'low' : 'ok'}">${esc(isLowM(p) ? t('spLow') : t('spOK'))}</span>` : '—'}</td>
        <td>${esc(p.machine || '—')}</td><td class="num">${esc(costOf(p))}</td></tr>`).join('')}</tbody></table>`;
  }
  function bindSpares() {
    const D = $('dash');
    D.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { spTab = b.dataset.sp; render(); });
    D.querySelectorAll('[data-spi]').forEach(b => b.onclick = () => { spSel = Object.assign({}, spShown[+b.dataset.spi]); armKey = ''; phState = { id: '', photos: null, err: '' }; render(); window.scrollTo(0, 0); });
    D.querySelectorAll('[data-spact]').forEach(b => b.onclick = () => spAction(b.dataset.spact));
    const sa = D.querySelector('[data-act="addSp"]'); if (sa) sa.onclick = () => spForm(null);
    const sqr = D.querySelector('[data-spqr]'); if (sqr) sqr.onclick = () => qrModal(partItem(spSel));
    const psp = D.querySelector('[data-act="printSp"]'); if (psp) psp.onclick = () => {
      const items = spShown.filter(x => x.no && !x.deleted).map(partItem);
      if (!items.length) { toast(t('qrNonePart')); return; }
      printLabels(items);
    };
    const vb = D.querySelector('[data-act="vendors"]'); if (vb) vb.onclick = () => vendorsModal();
    const sb = D.querySelector('[data-spback]'); if (sb) sb.onclick = () => { spSel = null; pinfoKey = ''; render(); window.scrollTo(0, 0); };
    bindStock();
    const sq = $('spQ'); if (sq) sq.oninput = () => { spQ = sq.value; $('spBody').innerHTML = spTable(); bindSpares(); };
    const sl = $('spLow'); if (sl) sl.onchange = () => { spLow = sl.checked; $('spBody').innerHTML = spTable(); bindSpares(); };
    const sd = $('spDel'); if (sd) sd.onchange = () => { spShowDel = sd.checked; render(); };
  }
  function sparesView() {
    if (!spData) {
      if (spErr) return `<div class="dnote">${esc(t('spErr', { e: spErr }))}</div>`;
      if (!spLoading) loadSpares(false);
      return `<div class="dempty">${esc(t('dLoadSp'))}</div>`;
    }
    applyPendingPart();
    if (spSel) return spDetail();
    const E = spData.electrical.filter(p => !p.deleted), M = spData.mechanical.filter(p => !p.deleted);
    const outE = E.filter(isOutE).length, lowM = M.filter(isLowM).length;
    const summary = spTab === 'electrical' ? `${t('spParts', { n: E.length })} · ${t('spOutN', { n: outE })}` : `${t('spParts', { n: M.length })} · ${t('spLowN', { n: lowM })}`;
    return `<div class="spseg">
        <button type="button" data-sp="electrical" class="${spTab === 'electrical' ? 'on' : ''}">${esc(t('spElect'))}<span>${E.length}</span></button>
        <button type="button" data-sp="mechanical" class="${spTab === 'mechanical' ? 'on' : ''}">${esc(t('spMech'))}<span>${M.length}</span></button></div>
      <div class="toolbar"><input id="spQ" type="search" dir="auto" placeholder="${esc(t('spSearch'))}" value="${esc(spQ)}">
        <label class="chk"><input type="checkbox" id="spLow" ${spLow ? 'checked' : ''}> ${esc(t(spTab === 'electrical' ? 'spOutOnly' : 'spLowOnly'))}</label>
        <label class="chk"><input type="checkbox" id="spDel" ${spShowDel ? 'checked' : ''}> ${esc(t('dShowDel'))}</label>
        <button type="button" class="btn" data-act="printSp">${esc(t('qrPrintAll'))}</button>
        <button type="button" class="btn" data-act="vendors">${esc(t('pVendors'))}</button>
        ${canSp() ? `<button type="button" class="btn pri" data-act="addSp">${svg('plus', 2.4)}<span>${esc(t('dAddPart'))}</span></button>` : ''}</div>
      <div class="mini spsum">${esc(summary)}</div>
      <section class="dcard"><div class="tscroll" id="spBody">${spTable()}</div></section>`;
  }
  function spDetail() {
    const p = spSel;
    ensurePhotos('spare', spPhotoKey(p));
    const isM = p.kind === 'mechanical';
    const info = isM
      ? [[t('spPartNo'), p.no], [t('spName'), p.name], [t('spReq'), p.required], [t('spAvail'), p.available], [t('spUsed'), p.used], [t('spRem'), p.remaining], [t('spStatus'), p.status], [t('spMachine'), p.machine]]
      : [[t('spPartNo'), p.no], [t('spBrand'), p.brand], [t('spDesc'), p.desc], [t('spQty'), p.qty]];
    const armed = armKey === 'sp|' + p.kind + '|' + p.row;
    loadPartInfo(p);
    const actions = canSp() ? `<div class="dact"><button type="button" class="ghostbtn" data-spact="edit">${esc(t('aEdit'))}</button>
      ${p.deleted ? `<button type="button" class="ghostbtn" data-spact="restore">${esc(t('dEqRestore'))}</button>`
        : `<button type="button" class="dangerbtn" data-spact="del">${esc(armed ? t('dEqDelSure') : t('dSpDel'))}</button>`}</div>` : '';
    return `<div class="eqback"><button class="btn" type="button" data-spback>${svg('back', 2.2)}<span>${esc(t('dSpares'))}</span></button></div>
      <section class="dcard eqhead"><div><h3>${esc(isM ? p.name : p.desc)}</h3>${p.deleted ? `<span class="deltag">${esc(t('dDeleted'))}</span>` : ''}
        <small>${esc(t(isM ? 'spMech' : 'spElect'))}${isM && p.machine ? ' · ' + esc(p.machine) : ''}</small></div>
        <div class="eqmeta"><span class="eqno">${esc(p.no)}</span><button type="button" class="btn" data-spqr>${esc(t('qrBtn'))}</button></div>${actions}</section>
      <section class="dcard" id="pstCard">${stockInner(p)}</section>
      <section class="dcard"><h4>${esc(t('dPhotos'))}</h4>${gallery(canSp())}</section>
      <section class="dcard"><dl class="tinfo">${info.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b === undefined || b === '' ? '—' : b)}</dd>`).join('')}</dl></section>`;
  }
  function spAction(a) {
    if (!spSel) return;
    if (a === 'edit') return spForm(spSel);
    if (a === 'del') {
      const k = 'sp|' + spSel.kind + '|' + spSel.row;
      if (armKey !== k) { armKey = k; render(); return; }
      return setSpStatus(spSel, 'Deleted');
    }
    if (a === 'restore') return setSpStatus(spSel, 'Active');
  }
  async function setSpStatus(p, status) {
    try {
      const r = await HS.api('spareStatus', { kind: p.kind, row: p.row, status: status }, 45000);
      if (!r || !r.ok) { toast(trErr(r && r.error) || t('needOnline')); return; }
      armKey = ''; toast(t('saved'));
      loadSpares(true);
    } catch (err) { toast(err.auth ? t('sessionExpired') : t('needOnline')); }
  }
  /** Form for an electrical or mechanical spare part. A new part needs its main photo. */
  function spForm(p) {
    const isNew = !p;
    const kind = isNew ? spTab : p.kind;
    const isM = kind === 'mechanical';
    let photo = null;
    const v = k => p && p[k] != null ? p[k] : '';
    const fields = isM
      ? `${fld('sNo', 'dSpfNo', v('no'), { max: 60, ltr: true })}${fld('sName', 'dSpfName', v('name'), { max: 200 })}
         <div class="row2"><div>${fld('sReq', 'dSpfReq', v('required'), { max: 20, ltr: true, num: true })}</div><div>${fld('sAv', 'dSpfAvail', v('available'), { max: 20, ltr: true, num: true })}</div></div>
         <div class="row2"><div>${fld('sUsed', 'dSpfUsed', v('used'), { max: 20, ltr: true, num: true })}</div><div>${fld('sMach', 'dSpfMachine', v('machine'), { max: 80 })}</div></div>`
      : `${fld('sNo', 'dSpfNo', v('no'), { max: 60, ltr: true })}${fld('sBrand', 'dSpfBrand', v('brand'), { max: 60 })}${fld('sDesc', 'dSpfDesc', v('desc'), { max: 200 })}${fld('sQty', 'dSpfQty', v('qty'), { max: 20, ltr: true, num: true })}`;
    showModal(`<h2>${esc(t(isNew ? 'dAddPart' : 'dEditPart'))}</h2>
      <form class="tform" id="spF" autocomplete="off">${fields}${photoRow('sPh', isNew)}
        <div class="msg" id="sMsg"></div>
        <button class="primary" type="submit" id="sGo">${esc(t('dSavePart'))}</button>
      </form>`, '');
    $('sPh').onclick = async () => {
      const f = await pickFile(); if (!f) return;
      try { photo = await photoFrom(f); $('sPhName').textContent = t('dPhotoSel'); } catch (err) { $('sMsg').textContent = t('dPhBad'); }
    };
    $('spF').onsubmit = async ev => {
      ev.preventDefault();
      const item = isM
        ? { kind: kind, no: $('sNo').value.trim(), name: $('sName').value.trim(), required: $('sReq').value.trim(), available: $('sAv').value.trim(), used: $('sUsed').value.trim(), machine: $('sMach').value.trim() }
        : { kind: kind, no: $('sNo').value.trim(), brand: $('sBrand').value.trim(), desc: $('sDesc').value.trim(), qty: $('sQty').value.trim() };
      if (!item.no || (isM ? (!item.name || item.required === '' || item.available === '') : (!item.desc || item.qty === ''))) { $('sMsg').textContent = t('dNeedVal'); return; }
      if (!isNew) item.row = p.row;
      if (photo) item.photo = photo;
      $('sGo').disabled = true; $('sMsg').textContent = '';
      try {
        const r = await HS.api('spareSave', { item: item }, 90000);
        if (!r || !r.ok) { $('sMsg').textContent = trErr(r && r.error) || t('needOnline'); $('sGo').disabled = false; return; }
        hideModal(); toast(t('saved'));
        phState = { id: '', photos: null, err: '' };
        if (isNew) spSel = null;
        await loadSpares(true);
      } catch (err) { $('sMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('sGo').disabled = false; }
    };
  }

  /* ---------- Release 4: stock card, receive / count / details, vendors ---------- */
  const mvName = { Used: 'pMvUsed', Returned: 'pMvReturned', Received: 'pMvReceived', Count: 'pMvCount' };
  const num = v => (v == null || v === '' ? '—' : String(v));
  function paintStock() { const el = $('pstCard'); if (el && spSel) { el.innerHTML = stockInner(spSel); bindStock(); } }
  function loadPartInfo(p) {
    const key = pkey(p);
    if (pinfoKey === key) return;
    pinfoKey = key; pinfo = null;
    HS.api('partInfo', { kind: p.kind, no: p.no }, 30000).then(r => {
      if (pinfoKey !== key) return;
      pinfo = r && r.ok ? r : { err: trErr(r && r.error) || t('needOnline') }; paintStock();
    }).catch(() => { if (pinfoKey === key) { pinfo = { err: t('needOnline') }; paintStock(); } });
  }
  function stockInner(p) {
    if (!pinfo) return `<h4>${esc(t('pStockTitle'))}</h4><div class="dempty">${esc(t('pLoading'))}</div>`;
    if (pinfo.err) return `<h4>${esc(t('pStockTitle'))}</h4><div class="dnote">${esc(pinfo.err)}</div>`;
    const i = pinfo, st = i.stock, isM = p.kind === 'mechanical';
    const tile = (lab, val, cls) => `<div class="kpi"><small>${esc(lab)}</small><b class="${cls || ''}">${esc(val)}</b></div>`;
    const acts = canSp() ? `<div class="dact"><button type="button" class="btn pri" data-pst="receive">${esc(t('pReceive'))}</button><button type="button" class="btn" data-pst="count">${esc(t('pCount'))}</button><button type="button" class="ghostbtn" data-pst="details">${esc(t('pDetails'))}</button></div>` : '';
    const moves = i.moves.length ? i.moves.map(m => `<div class="rprow"><div><b>${esc(t(mvName[m.type] || 'pMvUsed'))} ${m.qty > 0 ? '+' : ''}${esc(m.qty)}</b>
        <small>${esc(fmtStamp(m.at))} · ${esc(nameOf(m.by))}${m.order ? ' · ' + esc(m.order) : ''}${m.note ? ' · ' + esc(m.note) : ''}</small></div><span class="mini">→ ${esc(m.balance)}</span></div>`).join('')
      : `<div class="dempty">${esc(t('pNoMoves'))}</div>`;
    return `<h4>${esc(t('pStockTitle'))} ${i.low ? `<span class="offtag">${esc(t('pLowTag'))}</span>` : ''}</h4>
      <div class="kpis">${tile(t('pOnHand'), i.part.onHand, i.low ? 'late' : '')}${tile(t('pUnitCost'), num(st.cost))}${tile(t('pValue'), num(i.value))}${tile(t('pUsed90'), i.used90)}</div>
      <dl class="tinfo"><dt>${esc(t('pVendor'))}</dt><dd>${esc(i.vendor ? i.vendor.name + (i.vendor.phone ? ' · ' + i.vendor.phone : '') : t('pNoVendor'))}</dd>
        ${isM ? '' : `<dt>${esc(t('pMin'))}</dt><dd>${esc(num(st.min))}</dd>`}<dt>${esc(t('pBin'))}</dt><dd>${esc(st.bin || '—')}</dd></dl>
      ${acts}<h4 style="margin-top:14px">${esc(t('pMoves'))}</h4>${moves}`;
  }
  function bindStock() {
    document.querySelectorAll('[data-pst]').forEach(b => b.onclick = () => {
      if (!spSel) return;
      const a = b.dataset.pst;
      if (a === 'receive') stockForm('receive'); else if (a === 'count') stockForm('count'); else detailsForm();
    });
  }
  function afterStock() { pinfoKey = ''; loadSpares(true); }
  function stockForm(mode) {
    const p = spSel, rcv = mode === 'receive';
    showModal(`<h2>${esc(t(rcv ? 'pReceive' : 'pCount'))}</h2><p class="mini">${esc(p.no)} · ${esc(p.kind === 'mechanical' ? p.name : p.desc)}</p>
      <form class="tform" id="stF" autocomplete="off">
        ${rcv ? fld('stQ', 'pQty', '', { max: 12, ltr: true, num: true }) + fld('stC', 'pCost', '', { max: 12, ltr: true, num: true })
              : `<p class="mini">${esc(t('pCountHint'))}</p>` + fld('stQ', 'pCounted', '', { max: 12, ltr: true, num: true })}
        ${fld('stN', 'pNote', '', { max: 200 })}<div class="msg" id="stMsg"></div>
        <button class="primary" type="submit" id="stGo">${esc(t('dSavePart'))}</button></form>`, '');
    $('stF').onsubmit = async ev => {
      ev.preventDefault();
      const q = $('stQ').value.trim();
      if (!q || (rcv && !(Number(q.replace(',', '.')) > 0))) { $('stMsg').textContent = t(rcv ? 'pNeedQty' : 'pNeedCount'); return; }
      $('stGo').disabled = true; $('stMsg').textContent = '';
      try {
        const r = rcv ? await HS.api('partReceive', { part: { kind: p.kind, no: p.no, qty: q, cost: $('stC').value.trim(), note: $('stN').value.trim() } }, 45000)
                      : await HS.api('partCount', { part: { kind: p.kind, no: p.no, counted: q, note: $('stN').value.trim() } }, 45000);
        if (!r || !r.ok) { $('stMsg').textContent = trErr(r && r.error) || t('needOnline'); $('stGo').disabled = false; return; }
        hideModal(); toast(rcv ? t('pSavedMove', { n: r.balance }) : t('pSavedCount', { n: r.balance, d: (r.difference > 0 ? '+' : '') + r.difference })); afterStock();
      } catch (err) { $('stMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('stGo').disabled = false; }
    };
  }
  function detailsForm() {
    const p = spSel, st = (pinfo && pinfo.stock) || {}, isM = p.kind === 'mechanical';
    const vend = `<option value="">${esc(t('pNoVendor'))}</option>` + spVendors.map(v => `<option value="${esc(v.id)}" ${v.id === st.vendorId ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    showModal(`<h2>${esc(t('pDetails'))}</h2><p class="mini">${esc(p.no)} · ${esc(isM ? p.name : p.desc)}</p>
      <form class="tform" id="pdF" autocomplete="off">
        ${fld('pdC', 'pUnitCost', st.cost == null ? '' : st.cost, { max: 12, ltr: true, num: true })}
        <label for="pdV">${esc(t('pVendor'))}</label><select class="ffield" id="pdV">${vend}</select>
        ${isM ? `<p class="mini">${esc(t('pMinMech'))}</p>` : fld('pdM', 'pMin', st.min == null ? '' : st.min, { max: 12, ltr: true, num: true }) + `<p class="mini">${esc(t('pMinHint'))}</p>`}
        ${fld('pdB', 'pBin', st.bin || '', { max: 40 })}<div class="msg" id="pdMsg"></div>
        <button class="primary" type="submit" id="pdGo">${esc(t('dSavePart'))}</button></form>`, '');
    $('pdF').onsubmit = async ev => {
      ev.preventDefault();
      const part = { kind: p.kind, no: p.no, cost: $('pdC').value.trim(), vendorId: $('pdV').value, bin: $('pdB').value.trim() };
      if (!isM) part.min = $('pdM').value.trim();
      $('pdGo').disabled = true; $('pdMsg').textContent = '';
      try {
        const r = await HS.api('partDetails', { part: part }, 45000);
        if (!r || !r.ok) { $('pdMsg').textContent = trErr(r && r.error) || t('needOnline'); $('pdGo').disabled = false; return; }
        hideModal(); toast(t('saved')); afterStock();
      } catch (err) { $('pdMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('pdGo').disabled = false; }
    };
  }
  async function vendorsModal() {
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, '');
    let r;
    try { r = await HS.api('vendors', {}, 30000); } catch (err) { hideModal(); toast(err.auth ? t('sessionExpired') : t('needOnline')); return; }
    if (!r || !r.ok) { hideModal(); toast(trErr(r && r.error) || t('needOnline')); return; }
    spVendors = r.vendors.filter(v => v.active);
    showModal(`<h2>${esc(t('pVTitle'))}</h2>
      ${r.vendors.length ? r.vendors.map((v, i) => `<div class="rprow"><div><b>${esc(v.name)}</b>${v.active ? '' : ` <span class="deltag">${esc(t('dDeleted'))}</span>`}
        <small>${esc([v.phone, v.email].filter(Boolean).join(' · '))}${v.notes ? ' — ' + esc(v.notes) : ''}</small></div>${r.canEdit ? `<button type="button" class="btn" data-ved="${i}">${esc(t('aEdit'))}</button>` : ''}</div>`).join('')
        : `<div class="dempty">${esc(t('pVNone'))}</div>`}
      ${r.canEdit ? `<div class="dact"><button type="button" class="btn pri" id="vAdd">${esc(t('pVAdd'))}</button></div>` : ''}`, '');
    document.querySelectorAll('[data-ved]').forEach(b => b.onclick = () => vendorForm(r.vendors[+b.dataset.ved]));
    const a = $('vAdd'); if (a) a.onclick = () => vendorForm(null);
  }
  function vendorForm(v) {
    showModal(`<h2>${esc(t(v ? 'aEdit' : 'pVAdd'))}</h2><form class="tform" id="vF" autocomplete="off">
      ${fld('vN', 'pVName', v ? v.name : '', { max: 80 })}${fld('vP', 'pVPhone', v ? v.phone : '', { max: 30, ltr: true })}${fld('vE', 'pVEmail', v ? v.email : '', { max: 80, ltr: true })}${fld('vT', 'pVNotes', v ? v.notes : '', { max: 300 })}
      ${v ? `<label class="chkrow"><input type="checkbox" id="vA" ${v.active ? 'checked' : ''}> ${esc(t('pVActive'))}</label>` : ''}<div class="msg" id="vMsg"></div>
      <button class="primary" type="submit" id="vGo">${esc(t('pVSave'))}</button></form>`, '');
    $('vF').onsubmit = async ev => {
      ev.preventDefault();
      const f = { name: $('vN').value.trim(), phone: $('vP').value.trim(), email: $('vE').value.trim(), notes: $('vT').value.trim() };
      if (!f.name) { $('vMsg').textContent = t('pVNeedName'); return; }
      if (v) { f.id = v.id; f.active = $('vA').checked; }
      $('vGo').disabled = true; $('vMsg').textContent = '';
      try {
        const r = await HS.api('vendorSave', { vendor: f }, 30000);
        if (!r || !r.ok) { $('vMsg').textContent = trErr(r && r.error) || t('needOnline'); $('vGo').disabled = false; return; }
        toast(t('saved')); vendorsModal(); if (spData) loadSpares(true);
      } catch (err) { $('vMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('vGo').disabled = false; }
    };
  }

  /* ---------- Release 4: parts used on a work order (managers and the assigned technician) ---------- */
  async function taskPartsModal(id, back) {
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, id);
    let r;
    try { r = await HS.api('taskParts', { id: id }, 30000); } catch (err) { hideModal(); toast(err.auth ? t('sessionExpired') : t('needOnline')); return; }
    if (!r || !r.ok) { hideModal(); toast(trErr(r && r.error) || t('needOnline')); return; }
    const money = r.total !== null;
    const lines = r.lines.length ? r.lines.map((l, i) => `<div class="rprow"><div><b>${esc(l.name)}</b><small>${esc(l.no)} · × ${esc(l.qty)}${money ? ' · ' + esc(l.cost) : ''}</small></div>
        ${r.canAdd ? `<button type="button" class="btn" data-wret="${i}">${esc(t('woReturn'))}</button>` : ''}</div>`).join('')
      : `<div class="dempty">${esc(t('woPartsNone'))}</div>`;
    showModal(`<h2>${esc(t('woPartsTitle'))}</h2>${lines}
      ${money && r.lines.length ? `<p class="mini" style="margin-top:8px"><b>${esc(t('woPartsTotal'))}: ${esc(r.total)}</b></p>` : ''}
      <div class="dact">${r.canAdd ? `<button type="button" class="btn pri" id="wAdd">${esc(t('woPartsAdd'))}</button>` : ''}<button type="button" class="ghostbtn" id="wBack">${esc(t('woClose'))}</button></div>`, id);
    const again = () => taskPartsModal(id, back);
    document.querySelectorAll('[data-wret]').forEach(b => b.onclick = () => partQtyForm(id, r.lines[+b.dataset.wret], 'Returned', again));
    const a = $('wAdd'); if (a) a.onclick = () => partPicker(id, again);
    $('wBack').onclick = back || hideModal;
  }
  function partPicker(id, again) {
    showModal(`<h2>${esc(t('woPick'))}</h2><input id="ppQ" class="ffield" type="search" dir="auto" placeholder="${esc(t('woSearch'))}" autocomplete="off"><div id="ppList"></div>
      <div class="dact"><button type="button" class="ghostbtn" id="ppBack">${svg('back', 2.2)}</button></div>`, id);
    let timer = null, seq = 0;
    const run = async () => {
      const my = ++seq;
      try {
        const r = await HS.api('partsLookup', { q: $('ppQ').value }, 20000);
        if (my !== seq || !$('ppList')) return;
        if (!r || !r.ok) { $('ppList').innerHTML = `<div class="dnote">${esc(trErr(r && r.error) || t('needOnline'))}</div>`; return; }
        $('ppList').innerHTML = (r.parts.length ? r.parts.map((p, i) => `<div class="rprow clickrow" data-ppi="${i}"><div><b>${esc(p.name)}</b><small>${esc(p.no)}${p.sub ? ' · ' + esc(p.sub) : ''} · ${esc(t('woInStock', { n: p.onHand }))}</small></div></div>`).join('')
          : `<div class="dempty">${esc(t('woPickNone'))}</div>`) + (r.more ? `<p class="mini">${esc(t('woPickMore'))}</p>` : '');
        $('ppList').querySelectorAll('[data-ppi]').forEach(b => b.onclick = () => partQtyForm(id, r.parts[+b.dataset.ppi], 'Used', again));
      } catch (err) { if ($('ppList')) $('ppList').innerHTML = `<div class="dnote">${esc(t('needOnline'))}</div>`; }
    };
    $('ppQ').oninput = () => { clearTimeout(timer); timer = setTimeout(run, 250); };
    $('ppBack').onclick = again;
    run();
  }
  function partQtyForm(id, part, type, again) {
    const ret = type === 'Returned';
    showModal(`<h2>${esc(t(ret ? 'woReturnTitle' : 'woUse'))}</h2><p class="mini">${esc(part.no)} · ${esc(part.name)}${part.onHand != null ? ' · ' + esc(t('woInStock', { n: part.onHand })) : ''}</p>
      <form class="tform" id="pqF" autocomplete="off">${fld('pqQ', 'pQty', ret ? part.qty : '', { max: 12, ltr: true, num: true })}${fld('pqN', 'pNote', '', { max: 200 })}
      <div class="msg" id="pqMsg"></div><button class="primary" type="submit" id="pqGo">${esc(t('dSavePart'))}</button></form>`, id);
    $('pqF').onsubmit = async ev => {
      ev.preventDefault();
      const q = $('pqQ').value.trim();
      if (!(Number(q.replace(',', '.')) > 0)) { $('pqMsg').textContent = t('pNeedQty'); return; }
      $('pqGo').disabled = true; $('pqMsg').textContent = '';
      try {
        const r = await HS.api('partUse', { part: { kind: part.kind, no: part.no, qty: q, order: id, type: type, note: $('pqN').value.trim() } }, 45000);
        if (!r || !r.ok) { $('pqMsg').textContent = trErr(r && r.error) || t('needOnline'); $('pqGo').disabled = false; return; }
        toast(t(ret ? 'woReturned' : 'woLogged')); if (spData) afterStock(); again();
      } catch (err) { $('pqMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('pqGo').disabled = false; }
    };
  }

  /* ---------- Release 5: Reporting ---------- */
  let rpData = null, rpLoading = false, rpErr = '', rpQuery = { days: 30 };
  const fmtMin = m => m == null ? '—' : (m >= 60 ? t('rpHrMin', { h: Math.floor(m / 60), m: m % 60 }) : t('rpMin', { n: m }));
  function loadReport() {
    if (rpLoading) return;
    rpLoading = true; rpErr = '';
    HS.api('report', Object.assign({ csv: true }, rpQuery), 60000).then(r => {
      if (r && r.ok) rpData = r; else rpErr = trErr(r && r.error) || t('rpErr');
    }).catch(err => { rpErr = err.auth ? t('sessionExpired') : t('needOnline'); if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { rpLoading = false; if (!$('dash').classList.contains('hidden') && section === 'reports') render(); });
  }
  /** The report's tables. Used on screen and in the print / PDF copy. */
  function reportBody(r) {
    const w = r.workOrders, d = r.downtime, cmax = Math.max(1, ...d.byCause.map(c => c.minutes));
    const kpi = (lab, v, cls) => `<div class="kpi"><small>${esc(lab)}</small><b class="${cls || ''}">${esc(v)}</b></div>`;
    const tbl = (head, rows, empty) => rows.length ? `<div class="tscroll"><table class="dtable"><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(x => `<tr>${x.map((c, i) => `<td${i ? ' class="num"' : ''}>${esc(c == null ? '—' : c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="dempty">${esc(empty)}</div>`;
    return `<div class="kpis">${kpi(t('rpCreated'), w.created)}${kpi(t('rpDone'), w.done)}${kpi(t('rpOpen'), w.open)}${kpi(t('rpOverdue'), w.overdue, w.overdue ? 'late' : '')}
        ${kpi(t('rpOnTime'), w.onTimePct == null ? '—' : w.onTimePct + '%')}${kpi(t('rpAvgDone'), w.avgHoursToDone == null ? '—' : w.avgHoursToDone + ' h')}${kpi(t('rpHours'), w.hoursLogged)}
        ${kpi(t('rpMttr'), fmtMin(d.mttrMin))}${kpi(t('rpDown'), fmtMin(d.minutes))}${kpi(t('rpPartsCost'), r.parts.cost)}</div>
      <section class="dcard"><h4>${esc(t('rpWorkload'))}</h4>${tbl([t('rpPerson'), t('rpOpenN'), t('rpOverdue'), t('rpDoneN'), t('rpHours'), t('rpAvgDone')], r.workload.map(p => [p.name, p.open, p.overdue, p.done, p.hours, p.avgHoursToDone == null ? '—' : p.avgHoursToDone + ' h']), t('rpNoPeople'))}</section>
      <section class="dcard"><h4>${esc(t('rpAssets'))}</h4>${tbl([t('rpAsset'), t('rpStops'), t('rpDown'), t('rpMttr'), t('rpMtbf'), t('rpAvail')], r.assets.map(a => [a.name + ' (' + a.no + ')', a.stops, fmtMin(a.minutes), fmtMin(a.mttrMin), a.mtbfHours == null ? '—' : a.mtbfHours + ' h', a.availabilityPct + '%']), t('rpNoAssets'))}
        <p class="hint">${esc(t('rpMttrHint'))}</p>
        ${d.byCause.length ? `<h4 style="margin-top:14px">${esc(t('rpCauses'))}</h4>${d.byCause.map(c => `<div class="cbar"><div>${esc(c.name)}<div class="hb"><i style="width:${pct(c.minutes, cmax)}%"></i></div></div><span>${esc(fmtMin(c.minutes))}</span></div>`).join('')}` : ''}</section>
      <section class="dcard"><h4>${esc(t('rpWork'))}</h4>${tbl([t('rpCat'), t('rpCreated'), t('rpDone')], w.byCategory.map(c => [c.name, c.created, c.done]), t('rpNoPeople'))}
        <div style="height:10px"></div>${tbl([t('rpPrio'), t('rpCreated'), t('rpDone')], w.byPriority.map(c => [t('prio.' + c.name), c.created, c.done]), t('rpNoPeople'))}</section>
      <section class="dcard"><h4>${esc(t('rpParts'))} — ${esc(t('rpCost'))} ${esc(r.parts.cost)}</h4>${tbl([t('rpPart'), t('rpQty'), t('rpCost')], r.parts.top.map(x => [x.name + ' (' + x.no + ')', x.qty, x.cost]), t('rpNoParts'))}</section>`;
  }
  function reportView() {
    if (!rpData && !rpLoading && !rpErr) loadReport();
    const presets = [7, 30, 90].map(n => `<button type="button" data-rpd="${n}" class="${rpQuery.days === n ? 'on' : ''}">${esc(t('rpLast', { n: n }))}</button>`).join('');
    const bar = `<div class="toolbar"><div class="spseg" style="margin:0">${presets}</div>
      <label class="mini">${esc(t('rpFrom'))} <input type="date" id="rpF" class="ffield" style="width:auto" value="${esc(rpData ? rpData.range.from : '')}"></label>
      <label class="mini">${esc(t('rpTo'))} <input type="date" id="rpT" class="ffield" style="width:auto" value="${esc(rpData ? rpData.range.to : '')}"></label>
      <button type="button" class="btn" id="rpApply">${esc(t('rpApply'))}</button></div>
      <div class="dact" style="margin:0 0 14px"><button type="button" class="btn" id="rpCsv" ${rpData ? '' : 'disabled'}>${esc(t('rpCsv'))}</button><button type="button" class="btn" id="rpPrint" ${rpData ? '' : 'disabled'}>${esc(t('rpPrint'))}</button>
        <button type="button" class="btn pri" id="rpMail" ${rpData ? '' : 'disabled'}>${esc(t('rpEmail'))}</button></div>`;
    if (rpErr) return bar + `<div class="dnote">${esc(rpErr)}</div>`;
    if (!rpData) return bar + `<div class="dempty">${esc(t('rpLoading'))}</div>`;
    return bar + `<p class="mini">${esc(rpData.range.from)} → ${esc(rpData.range.to)} · ${esc(t('rpGenerated', { t: fmtStamp(rpData.generated) }))}</p>` + reportBody(rpData);
  }
  function bindReport() {
    document.querySelectorAll('[data-rpd]').forEach(b => b.onclick = () => { rpQuery = { days: +b.dataset.rpd }; rpData = null; rpErr = ''; render(); });
    const ap = $('rpApply'); if (ap) ap.onclick = () => {
      const f = $('rpF').value, to = $('rpT').value;
      if (!f || !to || f > to) { toast(t('rpDateBad')); return; }
      rpQuery = { from: f, to: to }; rpData = null; rpErr = ''; render();
    };
    const c = $('rpCsv'); if (c) c.onclick = () => {
      const blob = new Blob(['﻿' + rpData.csv], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'holoul-report-' + rpData.range.from + '_' + rpData.range.to + '.csv';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    };
    const pr = $('rpPrint'); if (pr) pr.onclick = () => printReport();
    const ml = $('rpMail'); if (ml) ml.onclick = () => mailForm();
  }
  function printReport() {
    let box = $('printReport');
    if (!box) { box = document.createElement('div'); box.id = 'printReport'; document.body.appendChild(box); }
    box.innerHTML = `<h2>Holoul — ${esc(t('rpTitle'))}</h2><p>${esc(rpData.range.from)} → ${esc(rpData.range.to)} · ${esc(t('rpGenerated', { t: fmtStamp(rpData.generated) }))}</p>${reportBody(rpData)}`;
    document.body.classList.add('printingRep');
    const end = () => { document.body.classList.remove('printingRep'); window.removeEventListener('afterprint', end); };
    window.addEventListener('afterprint', end);
    setTimeout(end, 120000);
    setTimeout(() => window.print(), 60);
  }
  async function mailForm() {
    let saved = ''; try { saved = localStorage.getItem('holoul_rep_mail') || ''; } catch (e) {}
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, '');
    let rc = []; try { const r = await HS.api('reportRecipients', {}, 30000); if (r && r.ok) rc = r.recipients; } catch (err) { hideModal(); toast(err.auth ? t('sessionExpired') : t('needOnline')); return; }
    showModal(`<h2>${esc(t('rpMailTitle'))}</h2><p class="mini">${esc(rpData.range.from)} → ${esc(rpData.range.to)}</p>
      <form class="tform" id="rmF" autocomplete="off"><label for="rmE">${esc(t('rpMailTo'))}</label><input class="ffield" id="rmE" type="text" inputmode="email" dir="ltr" maxlength="120" value="${esc(saved)}">
      <div class="msg" id="rmMsg"></div><button class="primary" type="submit" id="rmGo">${esc(t('rpMailSend'))}</button></form>
      <h4 style="margin-top:18px">${esc(t('rpWeekly'))}</h4><p class="hint">${esc(t('rpWeeklyHint'))}</p>
      ${rc.length ? rc.map((x, i) => `<div class="rprow"><div><b dir="ltr">${esc(x.email)}</b><small>${esc(x.lastSent ? t('rpWeeklyLast', { d: x.lastSent }) : '')}</small></div><button type="button" class="btn ${x.active ? 'pri' : ''}" data-rrt="${i}">${esc(t(x.active ? 'rpOn' : 'rpOff'))}</button></div>`).join('') : `<div class="dempty">${esc(t('rpWeeklyNone'))}</div>`}
      <form class="tform" id="raF" autocomplete="off" style="margin-top:8px"><input class="ffield" id="raE" type="text" inputmode="email" dir="ltr" maxlength="120" placeholder="name@company.com"><div class="msg" id="raMsg"></div>
      <button class="btn" type="submit">${esc(t('rpWeeklyAdd'))}</button></form>`, '');
    const bad = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
    $('rmF').onsubmit = async ev => {
      ev.preventDefault();
      const e = $('rmE').value.trim();
      if (!bad.test(e)) { $('rmMsg').textContent = t('rpMailBad'); return; }
      $('rmGo').disabled = true; $('rmMsg').textContent = '';
      try {
        const r = await HS.api('reportEmail', Object.assign({ email: e }, rpQuery), 90000);
        if (!r || !r.ok) { $('rmMsg').textContent = trErr(r && r.error) || t('needOnline'); $('rmGo').disabled = false; return; }
        try { localStorage.setItem('holoul_rep_mail', e); } catch (x) {}
        hideModal(); toast(t('rpMailSent', { e: r.sentTo }));
      } catch (err) { $('rmMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('rmGo').disabled = false; }
    };
    const save = async (email, active, msg) => {
      try {
        const r = await HS.api('reportRecipientSave', { email: email, active: active }, 30000);
        if (!r || !r.ok) { msg.textContent = trErr(r && r.error) || t('needOnline'); return; }
        mailForm();
      } catch (err) { msg.textContent = err.auth ? t('sessionExpired') : t('needOnline'); }
    };
    $('raF').onsubmit = ev => { ev.preventDefault(); const e = $('raE').value.trim(); if (!bad.test(e)) { $('raMsg').textContent = t('rpMailBad'); return; } save(e, true, $('raMsg')); };
    document.querySelectorAll('[data-rrt]').forEach(b => b.onclick = () => { const x = rc[+b.dataset.rrt]; save(x.email, !x.active, $('raMsg')); });
  }

  /* ---------- Release 6: photo markup, signature pad ---------- */
  /** A small window on top of whatever is open (a form keeps its state underneath). */
  function overlay(html) {
    const el = document.createElement('div'); el.className = 'dovl'; el.innerHTML = `<div role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(el);
    return { el: el, q: id => el.querySelector('#' + id), close: () => el.remove() };
  }
  /** Lets the person draw on a photo. Always resolves with a data URL (the original if they skip). */
  function markup(dataUrl) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const w = Math.min(img.naturalWidth, 1600), h = Math.round(img.naturalHeight * w / img.naturalWidth);
        const o = overlay(`<h3>${esc(t('mkTitle'))}</h3><p class="hint">${esc(t('mkHint'))}</p><canvas id="mkC" width="${w}" height="${h}" style="width:100%;touch-action:none;border-radius:10px;background:#000"></canvas>
          <div class="dact"><button type="button" class="btn" id="mkUndo">${esc(t('mkUndo'))}</button><button type="button" class="btn" id="mkClear">${esc(t('mkClear'))}</button><button type="button" class="btn pri" id="mkOk">${esc(t('mkUse'))}</button></div>`);
        const c = o.q('mkC'), g = c.getContext('2d'); let strokes = [], cur = null;
        const paint = () => { g.drawImage(img, 0, 0, w, h); g.strokeStyle = '#ef4444'; g.lineWidth = Math.max(4, w / 160); g.lineCap = g.lineJoin = 'round';
          strokes.concat(cur ? [cur] : []).forEach(st => { g.beginPath(); st.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); if (st.length === 1) g.lineTo(st[0][0] + .1, st[0][1]); g.stroke(); }); };
        const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * w / r.width, (e.clientY - r.top) * h / r.height]; };
        c.onpointerdown = e => { c.setPointerCapture(e.pointerId); cur = [pt(e)]; paint(); };
        c.onpointermove = e => { if (cur) { cur.push(pt(e)); paint(); } };
        c.onpointerup = c.onpointercancel = () => { if (cur) { strokes.push(cur); cur = null; paint(); } };
        o.q('mkUndo').onclick = () => { strokes.pop(); paint(); }; o.q('mkClear').onclick = () => { strokes = []; paint(); };
        o.q('mkOk').onclick = () => { const out = strokes.length ? c.toDataURL('image/jpeg', 0.82) : dataUrl; o.close(); res(out); };
        paint();
      };
      img.onerror = () => res(dataUrl);
      img.src = dataUrl;
    });
  }
  /** Signature pad. Resolves { data, name } or null when cancelled. */
  function signature() {
    return new Promise(res => {
      const o = overlay(`<h3>${esc(t('sgTitle'))}</h3><p class="hint">${esc(t('sgHint'))}</p><canvas id="sgC" width="360" height="140" style="width:100%;max-width:420px;touch-action:none;background:#fff;border:1px solid var(--line);border-radius:10px;display:block"></canvas>
        <label for="sgN">${esc(t('sgName'))}</label><input class="ffield" id="sgN" dir="auto" maxlength="60"><div class="msg" id="sgMsg"></div>
        <div class="dact"><button type="button" class="ghostbtn" id="sgCancel">${svg('back', 2.2)}</button><button type="button" class="btn" id="sgClr">${esc(t('sgClear'))}</button><button type="button" class="btn pri" id="sgOk">${esc(t('sgOk'))}</button></div>`);
      const c = o.q('sgC'), g = c.getContext('2d'); let inked = false, last = null;
      g.fillStyle = '#fff'; g.fillRect(0, 0, 360, 140); g.strokeStyle = '#111'; g.lineWidth = 2.5; g.lineCap = g.lineJoin = 'round';
      const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * 360 / r.width, (e.clientY - r.top) * 140 / r.height]; };
      c.onpointerdown = e => { c.setPointerCapture(e.pointerId); last = pt(e); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(last[0] + .1, last[1]); g.stroke(); inked = true; };
      c.onpointermove = e => { if (!last) return; const q = pt(e); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(q[0], q[1]); g.stroke(); last = q; };
      c.onpointerup = c.onpointercancel = () => { last = null; };
      o.q('sgClr').onclick = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, 360, 140); inked = false; };
      o.q('sgCancel').onclick = () => { o.close(); res(null); };
      o.q('sgOk').onclick = () => { if (!inked) { o.q('sgMsg').textContent = t('sgEmpty'); return; } const out = { data: c.toDataURL('image/png'), name: o.q('sgN').value.trim() }; o.close(); res(out); };
    });
  }

  /* ---------- Release 6: comments with @mentions and voice notes ---------- */
  async function commentsModal(id, back) {
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, id);
    let r;
    try { r = await HS.api('comments', { id: id }, 30000); } catch (err) { hideModal(); toast(err.auth ? t('sessionExpired') : t('needOnline')); return; }
    if (!r || !r.ok) { hideModal(); toast(trErr(r && r.error) || t('needOnline')); return; }
    const me_ = session && session.user ? session.user.username.toLowerCase() : '';
    const tag = txt => esc(txt).replace(/@[\w.-]+/g, m => `<b class="mention">${m}</b>`);
    const list = r.comments.length ? r.comments.map(c => `<div class="rprow"><div><b>${esc(c.name)}</b> <small>${esc(fmtStamp(c.at))}</small>
        ${c.text ? `<div class="tdesc" style="margin:4px 0 0">${tag(c.text)}</div>` : ''}${c.audio ? `<div><a class="btn" href="${esc(c.audio)}" target="_blank" rel="noopener">${esc(t('cmPlay'))}</a></div>` : ''}</div></div>`).join('')
      : `<div class="dempty">${esc(t('cmNone'))}</div>`;
    const chips = r.people.filter(p => p.username.toLowerCase() !== me_).map(p => `<button type="button" class="chip" data-cmtag="${esc(p.username)}">@${esc(p.username)}</button>`).join(' ');
    showModal(`<h2>${esc(t('cmTitle'))}</h2><div id="cmList">${list}</div>
      <form class="tform" id="cmF" autocomplete="off"><textarea class="ffield" id="cmT" dir="auto" maxlength="1000" placeholder="${esc(t('cmPh'))}"></textarea>
        <div class="mini" style="margin:6px 0">${esc(t('cmTag'))}: ${chips}</div>
        <div class="mini" id="cmRec"></div><div class="msg" id="cmMsg"></div>
        <div class="dact"><button type="button" class="btn" id="cmVoice">${esc(t('cmVoice'))}</button><button class="primary" type="submit" id="cmGo">${esc(t('cmSend'))}</button>${back ? `<button type="button" class="ghostbtn" id="cmBack">${svg('back', 2.2)}</button>` : `<button type="button" class="ghostbtn" id="cmBack">${esc(t('woClose'))}</button>`}</div></form>`, id);
    const box = $('cmList'); box.scrollTop = box.scrollHeight;
    document.querySelectorAll('[data-cmtag]').forEach(b => b.onclick = () => { const ta = $('cmT'); ta.value = (ta.value + (ta.value && !/\s$/.test(ta.value) ? ' ' : '') + '@' + b.dataset.cmtag + ' '); ta.focus(); });
    $('cmBack').onclick = back || hideModal;
    let audio = '', mr = null, stream = null, timer = null;
    const stopRec = () => { clearTimeout(timer); if (mr && mr.state !== 'inactive') mr.stop(); };
    $('cmVoice').onclick = async () => {
      if (mr && mr.state === 'recording') { stopRec(); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = []; mr = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
        mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        mr.onstop = () => {
          stream.getTracks().forEach(x => x.stop()); $('cmVoice') && ($('cmVoice').textContent = t('cmVoice'));
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), fr = new FileReader();
          fr.onload = () => { audio = String(fr.result); if ($('cmRec')) $('cmRec').textContent = t('cmVoiceReady'); };
          fr.readAsDataURL(blob);
        };
        mr.start(); $('cmVoice').textContent = t('cmStop'); $('cmRec').textContent = t('cmRec'); audio = '';
        timer = setTimeout(stopRec, 60000);
      } catch (err) { $('cmMsg').textContent = t('cmMic'); }
    };
    $('cmF').onsubmit = async ev => {
      ev.preventDefault();
      if (mr && mr.state === 'recording') { $('cmMsg').textContent = t('cmRec'); return; }
      const text = $('cmT').value.trim();
      if (!text && !audio) { $('cmMsg').textContent = t('cmNeed'); return; }
      $('cmGo').disabled = true; $('cmMsg').textContent = '';
      try {
        const out = await HS.api('commentAdd', { id: id, text: text, audio: audio }, 90000);
        if (!out || !out.ok) { $('cmMsg').textContent = trErr(out && out.error) || t('needOnline'); $('cmGo').disabled = false; return; }
        commentsModal(id, back);
      } catch (err) { $('cmMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('cmGo').disabled = false; }
    };
  }

  /* ---------- Release 6: work requests ---------- */
  let rqData = null, rqLoading = false, rqErr = '', rqAll = false;
  const rqStatusKey = s => ({ Pending: 'rqPending', Approved: 'rqApproved', Declined: 'rqDeclined' }[s] || 'rqPending');
  function loadRequests() {
    if (rqLoading) return;
    rqLoading = true; rqErr = '';
    HS.api('requestList', {}, 30000).then(r => { if (r && r.ok) rqData = r; else rqErr = trErr(r && r.error) || t('needOnline'); })
      .catch(err => { rqErr = err.auth ? t('sessionExpired') : t('needOnline'); if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { rqLoading = false; if (!$('dash').classList.contains('hidden') && section === 'requests') render(); });
  }
  const rqCard = (q, mgr) => `<div class="rprow" style="align-items:flex-start"><div><b>${esc(q.title)}</b> <span class="chip prio ${esc(q.urgency)}">${esc(t('prio.' + q.urgency))}</span>
      <small>${esc(q.id)} · ${esc(t('rqBy', { n: q.name }))}${q.by === '(public)' ? ' <span class="chip">' + esc(t('rqPublic')) + '</span>' : ''} · ${esc(fmtStamp(q.created))}${q.asset ? ' · ' + esc(q.asset) + (q.assetNo ? ' (' + esc(q.assetNo) + ')' : '') : ''}</small>
      ${q.details ? `<div class="tdesc" style="margin:4px 0">${esc(q.details)}</div>` : ''}${/^https:/.test(q.photo || '') ? `<a class="btn" href="${esc(q.photo)}" target="_blank" rel="noopener">${svg('photo')}<span>${esc(t('rqPhotoLink'))}</span></a>` : ''}
      <div class="mini"><span class="chip">${esc(t(rqStatusKey(q.status)))}</span>${q.order ? ' ' + esc(t('rqOrder', { id: q.order })) : ''}${q.note ? ' — ' + esc(q.note) : ''}</div></div>
      ${mgr && q.status === 'Pending' ? `<div class="dact" style="flex-direction:column"><button type="button" class="btn pri" data-rqa="${esc(q.id)}">${esc(t('rqApprove'))}</button><button type="button" class="ghostbtn" data-rqd="${esc(q.id)}">${esc(t('rqDecline'))}</button></div>` : ''}</div>`;
  function requestsView() {
    if (!rqData && !rqLoading && !rqErr) loadRequests();
    if (rqErr) return `<div class="dnote">${esc(rqErr)}</div>`;
    if (!rqData) return `<div class="dempty">${esc(t('pLoading'))}</div>`;
    const list = rqData.requests.filter(q => rqAll || q.status === 'Pending');
    return `<div class="toolbar"><button type="button" class="btn" id="rqSet">${esc(t('rqSettings'))}</button></div><div class="spseg"><button type="button" data-rqf="0" class="${rqAll ? '' : 'on'}">${esc(t('rqPendingTab'))}</button><button type="button" data-rqf="1" class="${rqAll ? 'on' : ''}">${esc(t('rqAll'))}</button></div>
      <section class="dcard">${list.length ? list.map(q => rqCard(q, true)).join('') : `<div class="dempty">${esc(t('rqNone'))}</div>`}</section>`;
  }
  function bindRequests() {
    const rs = $('rqSet'); if (rs) rs.onclick = () => settingsModal();
    document.querySelectorAll('[data-rqf]').forEach(b => b.onclick = () => { rqAll = b.dataset.rqf === '1'; render(); });
    document.querySelectorAll('[data-rqa]').forEach(b => b.onclick = () => approveForm(rqData.requests.find(q => q.id === b.dataset.rqa)));
    document.querySelectorAll('[data-rqd]').forEach(b => b.onclick = () => declineForm(rqData.requests.find(q => q.id === b.dataset.rqd)));
  }
  function decided() { rqData = null; if (data) data.pendingRequests = Math.max(0, (data.pendingRequests || 1) - 1); render(); load(); }
  function approveForm(q) {
    const people = (data ? data.assignable : []).map(p => `<option value="${esc(p.username)}">${esc(p.name)} — ${esc(roleName(p.role))}</option>`).join('');
    showModal(`<h2>${esc(t('rqApproveTitle'))}</h2><p class="mini">${esc(q.id)} · ${esc(q.title)}</p>
      <form class="tform" id="rqF" autocomplete="off"><label for="rqW">${esc(t('fAssignee'))} *</label><select class="ffield" id="rqW"><option value="">${esc(t('fChoose'))}</option>${people}</select>
        <label>${esc(t('fPriority'))}</label><select class="ffield" id="rqP">${['Low', 'Normal', 'High', 'Urgent'].map(p => `<option value="${p}" ${p === q.urgency ? 'selected' : ''}>${esc(t('prio.' + p))}</option>`).join('')}</select>
        <label for="rqD">${esc(t('fDue'))}</label><input class="ffield" id="rqD" type="date" value="${esc(todayISO())}">
        <div class="msg" id="rqM"></div><button class="primary" type="submit" id="rqGo">${esc(t('rqCreateOrder'))}</button></form>`, q.id);
    $('rqF').onsubmit = async ev => {
      ev.preventDefault();
      if (!$('rqW').value) { $('rqM').textContent = t('rqNeedWho'); return; }
      $('rqGo').disabled = true;
      try {
        const r = await HS.api('requestDecide', { id: q.id, decision: 'approve', assignee: $('rqW').value, priority: $('rqP').value, due: $('rqD').value }, 45000);
        if (!r || !r.ok) { $('rqM').textContent = trErr(r && r.error) || t('needOnline'); $('rqGo').disabled = false; return; }
        hideModal(); toast(t('rqDecidedOk', { id: r.order })); decided();
      } catch (err) { $('rqM').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('rqGo').disabled = false; }
    };
  }
  function declineForm(q) {
    showModal(`<h2>${esc(t('rqDeclineTitle'))}</h2><p class="mini">${esc(q.id)} · ${esc(q.title)}</p>
      <form class="tform" id="rqF" autocomplete="off"><label for="rqN">${esc(t('rqReason'))}</label><textarea class="ffield" id="rqN" dir="auto" maxlength="300"></textarea>
        <div class="msg" id="rqM"></div><button class="primary" type="submit" id="rqGo">${esc(t('rqDecline'))}</button></form>`, q.id);
    $('rqF').onsubmit = async ev => {
      ev.preventDefault();
      const note = $('rqN').value.trim();
      if (!note) { $('rqM').textContent = t('rqNeedReason'); return; }
      $('rqGo').disabled = true;
      try {
        const r = await HS.api('requestDecide', { id: q.id, decision: 'decline', note: note }, 30000);
        if (!r || !r.ok) { $('rqM').textContent = trErr(r && r.error) || t('needOnline'); $('rqGo').disabled = false; return; }
        hideModal(); toast(t('rqDeclinedOk')); decided();
      } catch (err) { $('rqM').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('rqGo').disabled = false; }
    };
  }
  /** "Report a problem" — for everyone. Shows the person's own earlier requests under the form. */
  async function requestForm(pre) {
    let mine = [];
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, '');
    try { const r = await HS.api('requestList', {}, 30000); if (r && r.ok) mine = r.requests; } catch (err) { hideModal(); toast(err.auth ? t('sessionExpired') : t('needOnline')); return; }
    let asset = pre && pre.no ? { no: pre.no, name: pre.name || pre.no } : null, photoUrl = '', urg = 'Normal', timer = null, seq = 0;
    showModal(`<h2>${esc(t('rqNew'))}</h2><form class="tform" id="rqF" autocomplete="off">
      <label for="rqT">${esc(t('rqWhat'))} *</label><input class="ffield" id="rqT" dir="auto" maxlength="140" placeholder="${esc(t('rqWhatPh'))}">
      <label for="rqX">${esc(t('rqDetails'))}</label><textarea class="ffield" id="rqX" dir="auto" maxlength="1000"></textarea>
      <label for="rqA">${esc(t('rqAsset'))}</label><div id="rqAs" class="mini">${asset ? '<b>' + esc(asset.name) + '</b> (' + esc(asset.no) + ')' : esc(t('rqNoAsset'))}</div><input class="ffield" id="rqA" type="search" dir="auto" placeholder="${esc(t('rqAssetPh'))}"><div id="rqAR"></div>
      <label>${esc(t('rqUrgency'))}</label><div class="segctl four" id="rqU">${['Low', 'Normal', 'High', 'Urgent'].map(p => `<button type="button" data-p="${p}" class="${p === 'Normal' ? 'on' : ''}">${esc(t('prio.' + p))}</button>`).join('')}</div>
      <div class="phrow"><button type="button" class="btn" id="rqPh">${svg('photo')}<span>${esc(t('rqPhoto'))}</span></button><span class="mini" id="rqPhN"></span></div>
      <div class="msg" id="rqM"></div><button class="primary" type="submit" id="rqGo">${esc(t('rqSend'))}</button></form>
      <h4 style="margin-top:18px">${esc(t('rqMine'))}</h4>${mine.length ? mine.slice(0, 20).map(q => rqCard(q, false)).join('') : `<div class="dempty">${esc(t('rqNone'))}</div>`}`, '');
    if (window.attachDictation) window.attachDictation($('rqX'));
    $('rqU').querySelectorAll('button').forEach(b => b.onclick = () => { urg = b.dataset.p; $('rqU').querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b)); });
    const run = async () => {
      const my = ++seq, q = $('rqA').value.trim();
      if (!q) { $('rqAR').innerHTML = ''; return; }
      try {
        const r = await HS.api('assetsLookup', { q: q }, 20000);
        if (my !== seq || !$('rqAR')) return;
        const rows = r && r.ok ? r.assets : [];
        $('rqAR').innerHTML = rows.length ? rows.map((a, i) => `<div class="rprow clickrow" data-rqi="${i}"><div><b>${esc(a.name)}</b><small>${esc(a.no)}${a.line ? ' · ' + esc(a.line) : ''}</small></div></div>`).join('') : `<div class="dempty">${esc(t('asNone'))}</div>`;
        $('rqAR').querySelectorAll('[data-rqi]').forEach(b => b.onclick = () => { asset = rows[+b.dataset.rqi]; $('rqAs').innerHTML = `<b>${esc(asset.name)}</b> (${esc(asset.no)})`; $('rqA').value = ''; $('rqAR').innerHTML = ''; });
      } catch (err) { if ($('rqAR')) $('rqAR').innerHTML = `<div class="dnote">${esc(t('needOnline'))}</div>`; }
    };
    $('rqA').oninput = () => { clearTimeout(timer); timer = setTimeout(run, 250); };
    let photo = null;
    $('rqPh').onclick = async () => {
      const f = await pickFile(); if (!f) return;
      try { const raw = await photoFrom(f); photo = await markup(raw); photoUrl = ''; $('rqPhN').textContent = t('rqPhotoOn'); } catch (err) { $('rqM') && ($('rqM').textContent = t('dPhBad')); }
    };
    $('rqF').onsubmit = async ev => {
      ev.preventDefault();
      const title = $('rqT').value.trim();
      if (!title) { $('rqM').textContent = t('rqWhat') + ' *'; return; }
      $('rqGo').disabled = true; $('rqM').textContent = '';
      try {
        if (photo && !photoUrl) {
          const up = await HS.api('uploadPhoto', { type: 'Tasks', unit: 'request', kind: 'req', data: photo }, 90000);
          if (!up || !up.ok) { $('rqM').textContent = trErr(up && up.error) || t('needOnline'); $('rqGo').disabled = false; return; }
          photoUrl = up.url;
        }
        const r = await HS.api('requestCreate', { request: { title: title, details: $('rqX').value.trim(), assetNo: asset ? asset.no : '', asset: asset ? asset.name : '', urgency: urg, photo: photoUrl } }, 45000);
        if (!r || !r.ok) { $('rqM').textContent = trErr(r && r.error) || t('needOnline'); $('rqGo').disabled = false; return; }
        hideModal(); toast(t('rqSent', { id: r.id }));
      } catch (err) { $('rqM').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('rqGo').disabled = false; }
    };
  }

  /* ================= Release 8: costs per machine, settings ================= */
  Object.assign(I18N.en, {
    coTitle: 'Costs', coCur: 'SAR', coP30: 'Last 30 days', coP90: 'Last 90 days', coPMonth: 'This month', coPYear: 'This year', coPCustom: 'Choose dates',
    coRates: 'Rates and settings', coTotal: 'Total', coParts: 'Parts', coLabor: 'Labor', coDown: 'Downtime', coMachine: 'Machine', coNone: 'No cost or downtime recorded in this period.',
    coHintRates: 'Labor and downtime are shown as hours only. Set the hourly rates (Rates and settings) to turn them into money.',
    coUnpriced: '{n} part(s) taken without a price', coDetailTitle: 'Work orders on {n}', coNoOrders: 'No work orders with cost in this period.', coHoursShort: '{h} h',
    coFrom: 'From', coTo: 'To', coNote: 'Parts use the price saved when they were taken. A work order on several machines shares its cost equally.',
    stTitle: 'Settings', stLabor: 'Labor cost per hour (SAR)', stDown: 'Downtime cost per hour (SAR)', stPublic: 'Allow the open fault form (no account needed)',
    stPublicHint: 'When on, anyone who scans a machine’s fault QR can send a problem to the request inbox. Limits: 3 reports an hour per phone, 4 per machine, 20 in total, 40 waiting. Switch it off any time.',
    stPending: 'Reports from the open form waiting now: {n}',
    rqPublic: 'No account', rqSettings: 'Fault form settings',
    qrFaultBtn: 'Fault QR', qrFaultAll: 'Print fault QR labels', qrFaultSub: 'Scan to report a fault',
    qrFaultHint: 'Stick this on the machine. While the open fault form is switched on (Requests → Fault form settings), anyone can scan it and report a problem without an account.'
  });
  let coData = null, coLoading = false, coErr = '', coPer = '90', coFrom = '', coTo = '';
  const money = x => Number(x || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ' + t('coCur');
  function coRange() {
    if (coPer === 'custom') { const to = coTo || todayISO(); return { from: coFrom || addDays(to, -89), to: to }; }
    return { period: coPer };
  }
  function loadCosts() {
    if (coLoading) return;
    coLoading = true; coErr = '';
    HS.api('costReport', coRange(), 30000).then(r => { if (r && r.ok) coData = r; else coErr = apiErr(r); })
      .catch(err => { coErr = apiErr(null, err); if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { coLoading = false; if (section === 'costs' && !$('dash').classList.contains('hidden')) render(); });
  }
  function costsView() {
    if (!coData && !coLoading && !coErr) loadCosts();
    const per = [['30', 'coP30'], ['90', 'coP90'], ['month', 'coPMonth'], ['year', 'coPYear'], ['custom', 'coPCustom']];
    const r = coData && coPer === 'custom' ? { from: coData.from, to: coData.to } : coRange();
    const bar = `<div class="toolbar"><select id="coPer">${per.map(p => `<option value="${p[0]}" ${p[0] === coPer ? 'selected' : ''}>${esc(t(p[1]))}</option>`).join('')}</select>
      ${coPer === 'custom' ? `<label class="chk">${esc(t('coFrom'))} <input type="date" id="coFrom" value="${esc(r.from)}"></label><label class="chk">${esc(t('coTo'))} <input type="date" id="coTo" value="${esc(r.to)}"></label>` : ''}
      <button type="button" class="btn" id="coRates">${esc(t('coRates'))}</button></div>`;
    if (coErr) return bar + `<div class="dnote">${esc(coErr)}</div>`;
    if (!coData) return bar + `<div class="dempty">${esc(t('pLoading'))}</div>`;
    const T = coData.totals, noRates = !coData.laborRate && !coData.downtimeRate;
    const kpi = (k, v) => `<div class="kpi"><small>${esc(t(k))}</small><b>${esc(v)}</b></div>`;
    const rows = coData.rows.map(x => `<tr class="${x.no ? 'clickrow' : ''}" ${x.no ? `data-cod="${esc(x.no)}"` : ''}>
      <td><b>${esc(x.name)}</b>${x.no ? `<small> ${esc(x.no)}</small>` : ''}${x.unpriced ? `<div class="mini">${esc(t('coUnpriced', { n: x.unpriced }))}</div>` : ''}</td>
      <td>${esc(money(x.parts))}</td><td>${esc(money(x.labor))}<small> · ${esc(t('coHoursShort', { h: x.hours }))}</small></td>
      <td>${esc(t('coHoursShort', { h: x.downHours }))}${x.downCost ? `<small> · ${esc(money(x.downCost))}</small>` : ''}</td><td><b>${esc(money(x.total))}</b></td></tr>`).join('');
    return bar + `<section class="dcard"><div class="kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">${kpi('coTotal', money(T.total))}${kpi('coParts', money(T.parts))}${kpi('coLabor', money(T.labor) + ' · ' + t('coHoursShort', { h: T.hours }))}${kpi('coDown', t('coHoursShort', { h: T.downHours }) + (T.downCost ? ' · ' + money(T.downCost) : ''))}</div>
      ${noRates ? `<p class="hint">${esc(t('coHintRates'))}</p>` : ''}</section>
      <section class="dcard">${coData.rows.length ? `<div class="tscroll"><table class="audtbl"><thead><tr><th>${esc(t('coMachine'))}</th><th>${esc(t('coParts'))}</th><th>${esc(t('coLabor'))}</th><th>${esc(t('coDown'))}</th><th>${esc(t('coTotal'))}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="mini">${esc(t('coNote'))}</p>` : `<div class="dempty">${esc(t('coNone'))}</div>`}</section>`;
  }
  function bindCosts() {
    const per = $('coPer'); if (per) per.onchange = () => { coPer = per.value; coData = null; coErr = ''; render(); };
    const f = $('coFrom'), to = $('coTo');
    if (f) f.onchange = () => { coFrom = f.value; coData = null; coErr = ''; render(); };
    if (to) to.onchange = () => { coTo = to.value; coData = null; coErr = ''; render(); };
    const rt = $('coRates'); if (rt) rt.onclick = () => settingsModal();
    document.querySelectorAll('[data-cod]').forEach(b => b.onclick = () => costDetail(b.dataset.cod));
  }
  async function costDetail(no) {
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, '');
    let row = null;
    try { const r = await HS.api('costReport', Object.assign({ no: no }, coRange()), 30000); if (r && r.ok) row = r.rows.filter(x => x.no === no)[0] || null; else { hideModal(); toast(apiErr(r)); return; } }
    catch (err) { hideModal(); toast(apiErr(null, err)); return; }
    const list = row && row.orders || [];
    showModal(`<h2>${esc(t('coDetailTitle', { n: row ? row.name : no }))}</h2>${list.length ? `<table class="audtbl"><thead><tr><th>${esc(t('dTasks'))}</th><th>${esc(t('coParts'))}</th><th>${esc(t('coLabor'))}</th></tr></thead><tbody>${list.map(o => `<tr><td><b>${esc(o.id)}</b> <small>${esc(o.date)}</small><div>${esc(o.title)}</div></td><td>${esc(money(o.parts))}</td><td>${esc(money(o.labor))}<small> · ${esc(t('coHoursShort', { h: o.hours }))}</small></td></tr>`).join('')}</tbody></table>` : `<div class="dempty">${esc(t('coNoOrders'))}</div>`}
      <div class="dact"><button type="button" class="btn" id="coDetClose">${esc(t('woClose'))}</button></div>`, '');
    $('coDetClose').onclick = hideModal;
  }
  async function settingsModal() {
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, '');
    let r;
    try { r = await HS.api('settings', {}, 20000); } catch (err) { hideModal(); toast(apiErr(null, err)); return; }
    if (!r || !r.ok) { hideModal(); toast(apiErr(r)); return; }
    showModal(`<h2>${esc(t('stTitle'))}</h2><form class="tform" id="stF" autocomplete="off">
      <label for="stL">${esc(t('stLabor'))}</label><input class="ffield" id="stL" inputmode="decimal" dir="ltr" maxlength="9" value="${r.laborRate || ''}">
      <label for="stD">${esc(t('stDown'))}</label><input class="ffield" id="stD" inputmode="decimal" dir="ltr" maxlength="9" value="${r.downtimeRate || ''}">
      <label class="chkrow"><input type="checkbox" id="stP" ${r.publicForm ? 'checked' : ''}><span>${esc(t('stPublic'))}</span></label>
      <p class="hint">${esc(t('stPublicHint'))}</p><p class="mini">${esc(t('stPending', { n: r.publicPending }))}</p>
      <div class="msg" id="stM"></div><button class="primary" type="submit">${esc(t('fSave'))}</button></form>`, '');
    $('stF').onsubmit = async ev => {
      ev.preventDefault();
      try {
        const x = await HS.api('settingsSave', { settings: { laborRate: $('stL').value.trim(), downtimeRate: $('stD').value.trim(), publicForm: $('stP').checked } }, 30000);
        if (!x || !x.ok) { $('stM').textContent = trErr(x && x.error) || t('needOnline'); return; }
        hideModal(); toast(t('saved')); coData = null; coErr = ''; render();
      } catch (err) { $('stM').textContent = apiErr(null, err); }
    };
  }

  /* ================= Release 7: schedule, procedures, purchasing ================= */
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayLabel = iso => { try { return new Date(iso + 'T12:00:00').toLocaleDateString(LANG === 'ar' ? 'ar-u-nu-latn-ca-gregory' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return iso; } };
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const apiErr = (r, err) => err ? (err.auth ? t('sessionExpired') : t('needOnline')) : (trErr(r && r.error) || t('needOnline'));
  /** Prints any HTML on its own page (uses the same print rules as reports). */
  function printBox(html) {
    let box = $('printReport');
    if (!box) { box = document.createElement('div'); box.id = 'printReport'; document.body.appendChild(box); }
    box.innerHTML = html;
    document.body.classList.add('printingRep');
    const end = () => { document.body.classList.remove('printingRep'); window.removeEventListener('afterprint', end); };
    window.addEventListener('afterprint', end);
    setTimeout(end, 120000);
    setTimeout(() => window.print(), 60);
  }
  /** Small asset search used by the procedure run form. */
  function wireAssetSearch(inputId, resId, onPick) {
    let timer = null, seq = 0;
    const run = async () => {
      const my = ++seq, q = $(inputId).value.trim();
      if (!q) { $(resId).innerHTML = ''; return; }
      try {
        const r = await HS.api('assetsLookup', { q: q }, 20000);
        if (my !== seq || !$(resId)) return;
        const rows = r && r.ok ? r.assets : [];
        $(resId).innerHTML = rows.length ? rows.map((a, i) => `<div class="rprow clickrow" data-pick="${i}"><div><b>${esc(a.name)}</b><small>${esc(a.no)}${a.line ? ' · ' + esc(a.line) : ''}</small></div></div>`).join('') : `<div class="dempty">${esc(t('asNone'))}</div>`;
        $(resId).querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { onPick(rows[+b.dataset.pick]); $(inputId).value = ''; $(resId).innerHTML = ''; });
      } catch (err) { if ($(resId)) $(resId).innerHTML = `<div class="dnote">${esc(t('needOnline'))}</div>`; }
    };
    $(inputId).oninput = () => { clearTimeout(timer); timer = setTimeout(run, 250); };
  }

  /* ---------- schedule (drag and drop board, shifts and time off) ---------- */
  let scData = null, scLoading = false, scErr = '', scFrom = '', scSel = '';
  function loadSchedule() {
    if (scLoading) return;
    scLoading = true; scErr = '';
    HS.api('schedule', { from: scFrom }, 30000).then(r => { if (r && r.ok) { scData = r; scFrom = r.from; } else scErr = apiErr(r); })
      .catch(err => { scErr = apiErr(null, err); if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { scLoading = false; if (section === 'schedule' && !$('dash').classList.contains('hidden')) render(); });
  }
  const scChip = x => `<div class="scchip prio ${esc(x.priority)} ${scSel === x.id ? 'sel' : ''}" draggable="true" data-sct="${esc(x.id)}" title="${esc(x.id + ' · ' + x.title)}"><b>${esc(x.title)}</b><small>${esc(x.id)}${x.hours ? ' · ' + esc(x.hours) + ' h' : ''}</small></div>`;
  function scheduleView() {
    if (!scData) {
      if (scErr) return `<div class="dnote">${esc(scErr)}</div>`;
      if (!scLoading) loadSchedule();
      return `<div class="dempty">${esc(t('pLoading'))}</div>`;
    }
    const d = scData;
    const head = `<div class="dtools" style="margin-bottom:10px"><button type="button" class="btn" data-scn="-7">${esc(t('schPrev'))}</button><button type="button" class="btn" data-scn="0">${esc(t('schThis'))}</button><button type="button" class="btn" data-scn="7">${esc(t('schNext'))}</button>
      <b style="margin:0 8px">${esc(dayLabel(d.days[0]))} – ${esc(dayLabel(d.days[6]))}</b><button type="button" class="btn" id="scShifts">${esc(t('schShifts'))}</button></div><p class="hint">${esc(t('schHint'))}</p>`;
    const cols = `<div class="scrow schead"><div></div>${d.days.map(x => `<div class="${x === d.today ? 'today' : ''}">${esc(dayLabel(x))}</div>`).join('')}</div>`;
    const rows = d.people.map(p => `<div class="scrow"><div class="scwho"><b>${esc(p.name)}</b><small>${esc(roleName(p.role))} · ${esc(p.hours)} h</small></div>${p.cells.map(c => {
      const over = c.capacity > 0 && c.load > c.capacity;
      const note = c.status === 'work' ? `<small class="${over ? 'over' : ''}">${esc(c.load)} / ${esc(c.capacity)} h</small>` : `<small class="offtag">${esc(c.reason)}</small>`;
      return `<div class="sccell ${esc(c.status)}" data-scd="${esc(c.date)}" data-scu="${esc(p.username)}">${note}${c.tasks.map(scChip).join('')}</div>`;
    }).join('')}</div>`).join('');
    const back = d.people.filter(p => p.overdue.length || p.unscheduled.length).map(p => `<div class="scback"><b>${esc(p.name)}</b>
      ${p.overdue.length ? `<div><small>${esc(t('schOverdue'))}</small>${p.overdue.map(scChip).join('')}</div>` : ''}${p.unscheduled.length ? `<div><small>${esc(t('schUnsched'))}</small>${p.unscheduled.map(scChip).join('')}</div>` : ''}</div>`).join('');
    return head + `<section class="dcard"><div class="scgrid">${cols}${rows}</div></section>` + (back ? `<h4 style="margin:14px 0 6px">${esc(t('schBacklog'))}</h4><section class="dcard">${back}</section>` : '');
  }
  async function scMove(id, date, user, force) {
    try {
      const r = await HS.api('scheduleMove', { id: id, due: date, assignee: user, force: !!force }, 30000);
      if (r && r.conflict) {
        showModal(`<h2>${esc(t('schConflict'))}</h2><p>${esc(r.error)}</p><div class="dact"><button type="button" class="btn pri" id="scForce">${esc(t('schAnyway'))}</button><button type="button" class="ghostbtn" id="scNo">${esc(t('woClose'))}</button></div>`, id);
        $('scNo').onclick = hideModal; $('scForce').onclick = () => { hideModal(); scMove(id, date, user, true); };
        return;
      }
      if (!r || !r.ok) { toast(trErr(r && r.error) || t('needOnline')); return; }
      scSel = ''; scData = null; toast(r.warning ? r.warning : t('schMoved')); render(); load();
    } catch (err) { toast(apiErr(null, err)); }
  }
  function bindSchedule() {
    document.querySelectorAll('[data-scn]').forEach(b => b.onclick = () => { const n = Number(b.dataset.scn); scFrom = n === 0 ? '' : addDays(scFrom, n); scData = null; scSel = ''; render(); });
    const sh = $('scShifts'); if (sh) sh.onclick = () => shiftsModal();
    document.querySelectorAll('[data-sct]').forEach(c => {
      c.ondragstart = e => { e.dataTransfer.setData('text/plain', c.dataset.sct); e.dataTransfer.effectAllowed = 'move'; scSel = c.dataset.sct; };
      c.onclick = e => { e.stopPropagation(); scSel = scSel === c.dataset.sct ? '' : c.dataset.sct; document.querySelectorAll('[data-sct]').forEach(o => o.classList.toggle('sel', o.dataset.sct === scSel)); };
    });
    document.querySelectorAll('[data-scd]').forEach(cell => {
      cell.ondragover = e => { e.preventDefault(); cell.classList.add('hot'); };
      cell.ondragleave = () => cell.classList.remove('hot');
      cell.ondrop = e => { e.preventDefault(); cell.classList.remove('hot'); const id = e.dataTransfer.getData('text/plain') || scSel; if (id) scMove(id, cell.dataset.scd, cell.dataset.scu); };
      cell.onclick = () => { if (scSel) scMove(scSel, cell.dataset.scd, cell.dataset.scu); };
    });
  }
  async function shiftsModal() {
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, '');
    let r;
    try { r = await HS.api('availability', {}, 30000); } catch (err) { hideModal(); toast(apiErr(null, err)); return; }
    if (!r || !r.ok) { hideModal(); toast(apiErr(r)); return; }
    const people = r.people;
    showModal(`<h2>${esc(t('schShifts'))}</h2><p class="hint">${esc(t('schShiftsHint'))}</p>
      ${people.map(p => `<div class="rprow" style="flex-wrap:wrap"><div style="min-width:140px"><b>${esc(p.name)}</b></div>
        <div class="shdays">${WD.map((w, i) => `<label class="chk"><input type="checkbox" data-shd="${esc(p.username)}" value="${i}" ${p.workDays.indexOf(i) >= 0 ? 'checked' : ''}> ${w}</label>`).join('')}</div>
        <input class="ffield" style="width:70px" type="text" inputmode="decimal" data-shh="${esc(p.username)}" value="${esc(p.hours)}" aria-label="${esc(t('schHours'))}"><button type="button" class="btn" data-shs="${esc(p.username)}">${esc(t('fSave'))}</button></div>`).join('')}
      <h4 style="margin-top:16px">${esc(t('schOff'))}</h4>
      ${r.timeOff.length ? r.timeOff.map(o => `<div class="rprow"><div><b>${esc(o.name)}</b> <span class="chip">${esc(o.type)}</span><small>${esc(o.from)} → ${esc(o.to)}${o.note ? ' · ' + esc(o.note) : ''}</small></div><button type="button" class="ghostbtn" data-sto="${esc(o.id)}">${esc(t('asRemove'))}</button></div>`).join('') : `<div class="dempty">${esc(t('schNoOff'))}</div>`}
      <form class="tform" id="toF" autocomplete="off"><select class="ffield" id="toWho">${people.map(p => `<option value="${esc(p.username)}">${esc(p.name)}</option>`).join('')}</select>
        <div class="two"><input class="ffield" id="toFrom" type="date" value="${esc(todayISO())}"><input class="ffield" id="toTo" type="date" value="${esc(todayISO())}"></div>
        <select class="ffield" id="toType">${['Leave', 'Sick', 'Off shift', 'Training'].map(x => `<option value="${x}">${esc(x)}</option>`).join('')}</select>
        <input class="ffield" id="toNote" dir="auto" maxlength="200" placeholder="${esc(t('schNote'))}"><div class="msg" id="toMsg"></div><button class="primary" type="submit">${esc(t('schAddOff'))}</button></form>
      <div class="dact"><button type="button" class="ghostbtn" id="shClose">${esc(t('woClose'))}</button></div>`, '');
    const done = () => { scData = null; render(); };
    $('shClose').onclick = () => { hideModal(); done(); };
    document.querySelectorAll('[data-shs]').forEach(b => b.onclick = async () => {
      const u = b.dataset.shs, days = [...document.querySelectorAll('[data-shd="' + u + '"]')].filter(x => x.checked).map(x => Number(x.value)), hours = document.querySelector('[data-shh="' + u + '"]').value.replace(',', '.');
      try { const o = await HS.api('availabilitySave', { availability: { username: u, workDays: days, hours: hours } }, 30000); toast(o && o.ok ? t('saved') : trErr(o && o.error)); } catch (err) { toast(apiErr(null, err)); }
    });
    document.querySelectorAll('[data-sto]').forEach(b => b.onclick = async () => { try { const o = await HS.api('timeOffDelete', { id: b.dataset.sto }, 30000); if (o && o.ok) shiftsModal(); else toast(trErr(o && o.error)); } catch (err) { toast(apiErr(null, err)); } });
    $('toF').onsubmit = async ev => {
      ev.preventDefault();
      try {
        const o = await HS.api('timeOffAdd', { timeOff: { username: $('toWho').value, from: $('toFrom').value, to: $('toTo').value, type: $('toType').value, note: $('toNote').value } }, 30000);
        if (!o || !o.ok) { $('toMsg').textContent = trErr(o && o.error) || t('needOnline'); return; }
        if (o.clashes && o.clashes.length) toast(t('schClash', { n: o.clashes.length }));
        shiftsModal();
      } catch (err) { $('toMsg').textContent = apiErr(null, err); }
    };
  }

  /* ---------- procedures: builder, run form, audit sheet ---------- */
  let prcData = null, prcRuns = null, prcLoading = false, prcErr = '', prcTab = 'list';
  function loadProcedures() {
    if (prcLoading) return;
    prcLoading = true; prcErr = '';
    Promise.all([HS.api('procedures', {}, 30000), HS.api('procedureRuns', {}, 30000)]).then(([a, b]) => {
      if (a && a.ok && b && b.ok) { prcData = a.procedures; prcRuns = b.runs; } else prcErr = apiErr(a && a.ok ? b : a);
    }).catch(err => { prcErr = apiErr(null, err); if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { prcLoading = false; if (section === 'procedures' && !$('dash').classList.contains('hidden')) render(); });
  }
  const resChip = r => `<span class="chip ${r === 'Failed' ? 'prio Urgent' : 'ok'}">${esc(r === 'Failed' ? t('prcFailed') : t('prcPassed'))}</span>`;
  function proceduresView() {
    if (!prcData) {
      if (prcErr) return `<div class="dnote">${esc(prcErr)}</div>`;
      if (!prcLoading) loadProcedures();
      return `<div class="dempty">${esc(t('pLoading'))}</div>`;
    }
    const seg = `<div class="spseg"><button type="button" data-prct="list" class="${prcTab === 'list' ? 'on' : ''}">${esc(t('prcList'))}<span>${prcData.length}</span></button><button type="button" data-prct="runs" class="${prcTab === 'runs' ? 'on' : ''}">${esc(t('prcRuns'))}<span>${prcRuns.length}</span></button></div>`;
    if (prcTab === 'runs') return seg + `<section class="dcard">${prcRuns.length ? prcRuns.map(r => `<div class="rprow"><div><b>${esc(r.procedure)}</b> ${resChip(r.result)}<small>${esc(r.id)} · ${esc(fmtStamp(r.at))} · ${esc(r.name)}${r.asset ? ' · ' + esc(r.asset) : ''}${r.taskId ? ' · ' + esc(r.taskId) : ''}${r.order ? ' · ' + esc(t('rqOrder', { id: r.order })) : ''}</small></div><button type="button" class="btn" data-prca="${esc(r.id)}">${esc(t('prcAudit'))}</button></div>`).join('') : `<div class="dempty">${esc(t('prcNoRuns'))}</div>`}</section>`;
    return seg + `<div class="toolbar"><button type="button" class="btn pri" id="prcNew">${svg('plus', 2.4)}<span>${esc(t('prcNew'))}</span></button></div>
      <section class="dcard">${prcData.length ? prcData.map(p => `<div class="rprow"><div><b>${esc(p.name)}</b> ${p.active ? '' : `<span class="chip">${esc(t('prcOff'))}</span>`}<small>${esc(t('prcSteps', { n: p.steps.length }))}${p.category ? ' · ' + esc(p.category) : ''}</small></div>
        <div class="dact"><button type="button" class="btn" data-prcr="${esc(p.id)}">${esc(t('prcRun'))}</button><button type="button" class="ghostbtn" data-prce="${esc(p.id)}">${esc(t('prcEditBtn'))}</button></div></div>`).join('') : `<div class="dempty">${esc(t('prcNone'))}</div>`}</section>`;
  }
  function bindProcedures() {
    document.querySelectorAll('[data-prct]').forEach(b => b.onclick = () => { prcTab = b.dataset.prct; render(); });
    const n = $('prcNew'); if (n) n.onclick = () => procForm(null);
    document.querySelectorAll('[data-prce]').forEach(b => b.onclick = () => procForm(prcData.find(p => p.id === b.dataset.prce)));
    document.querySelectorAll('[data-prcr]').forEach(b => b.onclick = () => runProcedure({ procedure: prcData.find(p => p.id === b.dataset.prcr), onDone: () => { prcData = null; render(); } }));
    document.querySelectorAll('[data-prca]').forEach(b => b.onclick = () => auditView(b.dataset.prca, null));
  }
  async function procForm(p) {
    const people = data ? data.assignable || [] : [];
    const st = (p ? p.steps : [{ text: '', type: 'passfail', required: true }]).map(s => Object.assign({}, s));
    st.forEach(s => { if (s.showIf) { const j = Number(String(s.showIf.step).replace(/^s/, '')) - 1; s.cond = st[j] ? { ref: st[j], when: s.showIf.when } : null; } delete s.showIf; delete s.id; });
    const m = { name: p ? p.name : '', category: p ? p.category : '', fail: p ? p.failAssignee : '', active: p ? p.active : true };
    const paint = () => {
      showModal(`<h2>${esc(t(p ? 'prcEdit' : 'prcNew'))}</h2><form class="tform" id="pfF" autocomplete="off">
        <label for="pfN">${esc(t('prcName'))} *</label><input class="ffield" id="pfN" dir="auto" maxlength="80" value="${esc(m.name)}">
        <label for="pfC">${esc(t('prcCat'))}</label><select class="ffield" id="pfC"><option value="">—</option>${['Mechanical', 'Electrical', 'Cleaning', 'Safety', 'Other'].map(c => `<option ${m.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <label for="pfW">${esc(t('prcFailWho'))}</label><select class="ffield" id="pfW"><option value="">${esc(t('prcFailAny'))}</option>${people.map(x => `<option value="${esc(x.username)}" ${m.fail === x.username ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <label class="chkrow"><input type="checkbox" id="pfA" ${m.active ? 'checked' : ''}><span>${esc(t('prcActive'))}</span></label>
        <h4>${esc(t('prcStepsT'))}</h4>
        ${st.map((s, i) => `<div class="pstep"><div class="pstop"><b>${i + 1}</b><input class="ffield" data-i="${i}" data-f="text" dir="auto" maxlength="200" value="${esc(s.text)}" placeholder="${esc(t('prcStepPh'))}">
          <button type="button" class="ghostbtn" data-up="${i}" aria-label="up">↑</button><button type="button" class="ghostbtn" data-dn="${i}" aria-label="down">↓</button><button type="button" class="ghostbtn" data-del="${i}" aria-label="${esc(t('asRemove'))}">×</button></div>
          <div class="psopt"><select class="ffield" data-i="${i}" data-f="type">${['passfail', 'check', 'number', 'text'].map(k => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${esc(t('prcType.' + k))}</option>`).join('')}</select>
          <label class="chk"><input type="checkbox" data-i="${i}" data-f="required" ${s.required !== false ? 'checked' : ''}> ${esc(t('prcReq'))}</label>
          ${s.type === 'number' ? `<input class="ffield sm" data-i="${i}" data-f="min" inputmode="decimal" placeholder="${esc(t('prcMin'))}" value="${s.min === undefined ? '' : esc(s.min)}"><input class="ffield sm" data-i="${i}" data-f="max" inputmode="decimal" placeholder="${esc(t('prcMax'))}" value="${s.max === undefined ? '' : esc(s.max)}"><input class="ffield sm" data-i="${i}" data-f="unit" placeholder="${esc(t('prcUnit'))}" value="${esc(s.unit || '')}">` : ''}</div>
          ${i > 0 ? `<select class="ffield" data-i="${i}" data-f="cond"><option value="">${esc(t('prcAlways'))}</option>${st.slice(0, i).map((e, j) => e.type === 'passfail' ? ['fail', 'pass'].map(w => `<option value="${j}:${w}" ${s.cond && s.cond.ref === e && s.cond.when === w ? 'selected' : ''}>${esc(t(w === 'fail' ? 'prcIfFail' : 'prcIfPass', { n: j + 1 }))}</option>`).join('') : '').join('')}</select>` : ''}</div>`).join('')}
        <button type="button" class="btn" id="pfAdd">${svg('plus', 2.4)}<span>${esc(t('prcAddStep'))}</span></button>
        <div class="msg" id="pfM"></div><button class="primary" type="submit">${esc(t('fSave'))}</button></form>`, p ? p.id : '');
      const grab = () => { m.name = $('pfN').value; m.category = $('pfC').value; m.fail = $('pfW').value; m.active = $('pfA').checked; };
      document.querySelectorAll('[data-f]').forEach(el => {
        const i = +el.dataset.i, f = el.dataset.f;
        const h = ev => {
          if (f === 'required') st[i].required = el.checked;
          else if (f === 'cond') { if (!el.value) st[i].cond = null; else { const [j, w] = el.value.split(':'); st[i].cond = { ref: st[+j], when: w }; } }
          else st[i][f] = el.value;
          if (f === 'type' && ev.type === 'change') { grab(); paint(); }
        };
        el.onchange = h; el.oninput = h;
      });
      const fix = () => st.forEach((s, i) => { if (s.cond && st.indexOf(s.cond.ref) >= i || (s.cond && s.cond.ref.type !== 'passfail')) s.cond = null; });
      document.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { grab(); const i = +b.dataset.up; if (i > 0) { [st[i - 1], st[i]] = [st[i], st[i - 1]]; fix(); paint(); } });
      document.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { grab(); const i = +b.dataset.dn; if (i < st.length - 1) { [st[i + 1], st[i]] = [st[i], st[i + 1]]; fix(); paint(); } });
      document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { grab(); const i = +b.dataset.del; st.forEach(s => { if (s.cond && s.cond.ref === st[i]) s.cond = null; }); st.splice(i, 1); if (!st.length) st.push({ text: '', type: 'passfail', required: true }); paint(); });
      $('pfAdd').onclick = () => { grab(); st.push({ text: '', type: 'passfail', required: true }); paint(); };
      $('pfF').onsubmit = async ev => {
        ev.preventDefault(); grab();
        const steps = st.map(s => { const o = { text: s.text, type: s.type, required: s.required !== false }; if (s.type === 'number') { o.min = s.min; o.max = s.max; o.unit = s.unit; } if (s.cond && st.indexOf(s.cond.ref) >= 0) o.showIf = { step: st.indexOf(s.cond.ref) + 1, when: s.cond.when }; return o; });
        try {
          const r = await HS.api('procedureSave', { procedure: { id: p ? p.id : undefined, name: m.name, category: m.category, failAssignee: m.fail, active: m.active, steps: steps } }, 30000);
          if (!r || !r.ok) { $('pfM').textContent = trErr(r && r.error) || t('needOnline'); return; }
          hideModal(); toast(t('saved')); prcData = null; render();
        } catch (err) { $('pfM').textContent = apiErr(null, err); }
      };
    };
    paint();
  }
  /** The checklist form. opts: { procedure, taskId, assetNo, asset, onDone }. Hidden steps appear only when their condition is met. */
  function runProcedure(opts) {
    const pr = opts.procedure, steps = pr.steps, ans = {};
    let asset = opts.assetNo ? { no: opts.assetNo, name: opts.asset || opts.assetNo } : null;
    const result = s => { const a = ans[s.id] || {}; return s.type === 'passfail' ? a.v : ''; };
    const shown = s => !s.showIf || (shown2(steps.find(x => x.id === s.showIf.step)) && result(steps.find(x => x.id === s.showIf.step)) === s.showIf.when);
    const shown2 = s => !!s && shown(s);
    const paint = () => {
      const keep = document.activeElement && document.activeElement.id;
      showModal(`<h2>${esc(pr.name)}</h2>${opts.taskId ? `<p class="mini">${esc(opts.taskId)}</p>` : ''}
        <form class="tform" id="rnF" autocomplete="off">
        ${opts.taskId ? '' : `<div class="mini">${esc(t('prcAsset'))}: <b id="rnAs">${asset ? esc(asset.name + ' (' + asset.no + ')') : esc(t('rqNoAsset'))}</b></div><input class="ffield" id="rnA" type="search" dir="auto" placeholder="${esc(t('rqAssetPh'))}"><div id="rnAR"></div>`}
        ${steps.map((s, i) => { if (!shown(s)) return ''; const a = ans[s.id] || {}; return `<div class="rstep" data-step="${esc(s.id)}"><div><b>${esc(s.text)}</b>${s.required ? ' *' : ''}</div>
          ${s.type === 'passfail' ? `<div class="segctl"><button type="button" data-ans="${esc(s.id)}:pass" class="${a.v === 'pass' ? 'on ok' : ''}">${esc(t('prcPass'))}</button><button type="button" data-ans="${esc(s.id)}:fail" class="${a.v === 'fail' ? 'on bad' : ''}">${esc(t('prcFail'))}</button></div>${a.v === 'fail' ? `<input class="ffield" data-note="${esc(s.id)}" dir="auto" maxlength="300" placeholder="${esc(t('prcNote'))}" value="${esc(a.note || '')}">` : ''}`
          : s.type === 'check' ? `<label class="chk"><input type="checkbox" data-chk="${esc(s.id)}" ${a.v ? 'checked' : ''}> ${esc(t('prcDone'))}</label>`
          : s.type === 'number' ? `<div class="mini">${s.min !== undefined || s.max !== undefined ? esc((s.min !== undefined ? s.min : '…') + ' – ' + (s.max !== undefined ? s.max : '…') + (s.unit ? ' ' + s.unit : '')) : esc(s.unit || '')}</div><input class="ffield" data-num="${esc(s.id)}" type="text" inputmode="decimal" value="${a.v === undefined ? '' : esc(a.v)}">`
          : `<input class="ffield" data-txt="${esc(s.id)}" dir="auto" maxlength="500" value="${esc(a.v || '')}">`}</div>`; }).join('')}
        <div class="msg" id="rnM"></div><button class="primary" type="submit" id="rnGo">${esc(t('prcSubmit'))}</button><button type="button" class="ghostbtn" id="rnCancel">${esc(t('woClose'))}</button></form>`, opts.taskId || '');
      $('rnCancel').onclick = opts.back || hideModal;
      document.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => { const [id, v] = b.dataset.ans.split(':'); ans[id] = Object.assign(ans[id] || {}, { v: v }); paint(); });
      document.querySelectorAll('[data-note]').forEach(el => el.oninput = () => { ans[el.dataset.note].note = el.value; });
      document.querySelectorAll('[data-chk]').forEach(el => el.onchange = () => { ans[el.dataset.chk] = { v: el.checked }; });
      document.querySelectorAll('[data-num]').forEach(el => el.oninput = () => { ans[el.dataset.num] = { v: el.value }; });
      document.querySelectorAll('[data-txt]').forEach(el => el.oninput = () => { ans[el.dataset.txt] = { v: el.value }; });
      if ($('rnA')) wireAssetSearch('rnA', 'rnAR', a => { asset = a; $('rnAs').textContent = a.name + ' (' + a.no + ')'; });
      $('rnF').onsubmit = async ev => {
        ev.preventDefault(); $('rnGo').disabled = true; $('rnM').textContent = '';
        const send = {}; steps.forEach(s => { if (shown(s) && ans[s.id]) send[s.id] = ans[s.id]; });
        try {
          const r = await HS.api('procedureRun', { procedureId: pr.id, taskId: opts.taskId || '', assetNo: asset ? asset.no : '', answers: send }, 45000);
          if (!r || !r.ok) { $('rnM').textContent = trErr(r && r.error) || t('needOnline'); $('rnGo').disabled = false; return; }
          showModal(`<h2>${esc(pr.name)}</h2><p><b>${esc(r.failed ? t('prcProblems', { n: r.failed }) : t('prcAllGood'))}</b></p>${r.order ? `<p>${esc(t('prcOrderMade', { id: r.order }))}</p>` : ''}
            ${r.problems.map(x => `<div class="rprow"><div><b>${esc(x.text)}</b><small>${esc(x.why)}</small></div></div>`).join('')}<div class="dact"><button type="button" class="btn pri" id="rnClose">${esc(t('woClose'))}</button></div>`, opts.taskId || '');
          $('rnClose').onclick = () => { if (opts.onDone) opts.onDone(r); if (opts.back) opts.back(); else hideModal(); };
        } catch (err) { $('rnM').textContent = apiErr(null, err); $('rnGo').disabled = false; }
      };
      if (keep && $(keep)) $(keep).focus();
    };
    paint();
  }
  /** From a work order: run its procedure; `back` returns to the task sheet. */
  async function runForTask(procId, task, onDone, back) {
    let list = null;
    try { const r = await HS.api('procedures', {}, 30000); if (r && r.ok) list = r.procedures; } catch (err) {}
    const p = list && list.find(x => x.id === procId);
    if (!p) { toast(t('needOnline')); if (back) back(); return; }
    runProcedure({ procedure: p, taskId: task.id, assetNo: task.equipmentNo, asset: task.equipment, onDone: onDone, back: back });
  }
  /** Technician / anyone: choose a procedure, then run it. */
  async function procedurePicker() {
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, '');
    let list = [];
    try { const r = await HS.api('procedures', {}, 30000); if (r && r.ok) list = r.procedures.filter(p => p.active); else { hideModal(); toast(apiErr(r)); return; } } catch (err) { hideModal(); toast(apiErr(null, err)); return; }
    showModal(`<h2>${esc(t('prcPick'))}</h2>${list.length ? list.map((p, i) => `<div class="rprow clickrow" data-pp="${i}"><div><b>${esc(p.name)}</b><small>${esc(t('prcSteps', { n: p.steps.length }))}</small></div></div>`).join('') : `<div class="dempty">${esc(t('prcNone'))}</div>`}
      <div class="dact"><button type="button" class="ghostbtn" id="ppClose">${esc(t('woClose'))}</button></div>`, '');
    $('ppClose').onclick = hideModal;
    document.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => runProcedure({ procedure: list[+b.dataset.pp] }));
  }
  async function auditView(id, back) {
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, '');
    let r; try { r = await HS.api('procedureAudit', { id: id }, 30000); } catch (err) { hideModal(); toast(apiErr(null, err)); return; }
    if (!r || !r.ok) { hideModal(); toast(apiErr(r)); return; }
    const x = r.run, tk = r.task;
    const body = `<h2>Holoul — ${esc(x.procedure)}</h2><p>${esc(x.id)} · ${esc(fmtStamp(x.at))} · ${esc(x.name)}${x.asset ? ' · ' + esc(x.asset) + (x.assetNo ? ' (' + esc(x.assetNo) + ')' : '') : ''} · ${esc(x.result === 'Failed' ? t('prcFailed') : t('prcPassed'))}</p>
      <table class="audtbl"><thead><tr><th>#</th><th>${esc(t('prcStepsT'))}</th><th>${esc(t('prcAnswer'))}</th><th></th></tr></thead><tbody>${r.steps.map((s, i) => `<tr class="${esc(s.result)}"><td>${i + 1}</td><td>${esc(s.text)}${s.note ? `<br><i>${esc(s.note)}</i>` : ''}</td><td>${s.type === 'passfail' ? esc(s.answer === 'pass' ? t('prcPass') : s.answer === 'fail' ? t('prcFail') : '') : esc(String(s.answer === undefined ? '' : s.answer) + (s.unit && s.answer !== '' ? ' ' + s.unit : ''))}</td><td>${esc(s.result === 'fail' ? '✗' : s.result === 'pass' ? '✓' : '–')}</td></tr>`).join('')}</tbody></table>
      ${tk ? `<p><b>${esc(tk.id)}</b> · ${esc(tk.title)} · ${esc(tk.status)}${tk.done ? ' · ' + esc(fmtStamp(tk.done)) : ''}</p>${tk.photo ? `<p><a href="${esc(tk.photo)}" target="_blank" rel="noopener">${esc(t('rqPhotoLink'))}</a></p>` : ''}${tk.signature ? `<p>${esc(t('sgTitle'))}: <img alt="" src="${esc(tk.signature)}" style="height:60px;background:#fff;border:1px solid #ccc">${tk.signedName ? ' ' + esc(tk.signedName) : ''}</p>` : ''}` : ''}`;
    showModal(`<div id="audBody">${body}</div><div class="dact"><button type="button" class="btn pri" id="audPrint">${esc(t('rpPrint'))}</button><button type="button" class="ghostbtn" id="audBack">${esc(t('woClose'))}</button></div>`, x.id);
    $('audPrint').onclick = () => printBox(body); $('audBack').onclick = back || hideModal;
  }

  /* ---------- purchasing ---------- */
  let puData = null, puLoading = false, puErr = '', puAll = false;
  function loadPurchasing() {
    if (puLoading) return;
    puLoading = true; puErr = '';
    HS.api('poList', {}, 30000).then(r => { if (r && r.ok) puData = r; else puErr = apiErr(r); })
      .catch(err => { puErr = apiErr(null, err); if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { puLoading = false; if (section === 'purchasing' && !$('dash').classList.contains('hidden')) render(); });
  }
  const poChip = s => `<span class="chip ${/Requested/.test(s) ? 'prio Normal' : /Rejected|Cancelled/.test(s) ? 'prio Urgent' : /Received/.test(s) ? 'ok' : 'prio High'}">${esc(t('poSt.' + s))}</span>`;
  const poCard = o => {
    const mgr = isMgr(), mine = o.by === me();
    const open = ['Received', 'Rejected', 'Cancelled'].indexOf(o.status) < 0;
    return `<div class="rprow" style="align-items:flex-start"><div><b>${esc(o.id)}</b> ${poChip(o.status)} <small>${esc(o.name)} · ${esc(fmtStamp(o.created))}${o.vendor ? ' · ' + esc(o.vendor) : ''}</small>
      <div class="tdesc" style="margin:4px 0">${o.lines.map(l => `${esc(l.no)} ${esc(l.name || '')} × ${esc(l.qty)}${l.got ? ' (' + esc(l.got) + ' ' + esc(t('poGot')) + ')' : ''}`).join(' · ')}</div>
      <div class="mini">${esc(t('poTotal'))}: <b>${esc(o.total)}</b>${o.note ? ' — ' + esc(o.note) : ''}${o.decisionNote ? ' — ' + esc(o.decisionNote) : ''}</div></div>
      <div class="dact" style="flex-direction:column">
        ${mgr && o.status === 'Requested' ? `<button type="button" class="btn pri" data-poa="${esc(o.id)}">${esc(t('rqApprove'))}</button><button type="button" class="ghostbtn" data-por="${esc(o.id)}">${esc(t('poReject'))}</button>` : ''}
        ${o.status === 'Approved' ? `<button type="button" class="btn pri" data-poo="${esc(o.id)}">${esc(t('poMarkOrdered'))}</button>` : ''}
        ${o.status === 'Ordered' || o.status === 'Partly received' ? `<button type="button" class="btn pri" data-pov="${esc(o.id)}">${esc(t('poReceive'))}</button>` : ''}
        ${open && (mgr || (o.status === 'Requested' && mine)) && !o.lines.some(l => l.got > 0) ? `<button type="button" class="ghostbtn" data-poc="${esc(o.id)}">${esc(t('poCancel'))}</button>` : ''}</div></div>`;
  };
  function purchasingView() {
    if (!puData) {
      if (puErr) return `<div class="dnote">${esc(puErr)}</div>`;
      if (!puLoading) loadPurchasing();
      return `<div class="dempty">${esc(t('pLoading'))}</div>`;
    }
    const list = puData.orders.filter(o => puAll || ['Requested', 'Approved', 'Ordered', 'Partly received'].indexOf(o.status) >= 0);
    return `<div class="spseg"><button type="button" data-puf="0" class="${puAll ? '' : 'on'}">${esc(t('poOpen'))}</button><button type="button" data-puf="1" class="${puAll ? 'on' : ''}">${esc(t('rqAll'))}</button></div>
      <div class="toolbar"><button type="button" class="btn pri" id="poNew">${svg('plus', 2.4)}<span>${esc(t('poNew'))}</span></button></div>
      <section class="dcard">${list.length ? list.map(poCard).join('') : `<div class="dempty">${esc(t('poNone'))}</div>`}</section>`;
  }
  async function poAct(action, body, msg) {
    try {
      const r = await HS.api(action, body, 45000);
      if (!r || !r.ok) { toast(trErr(r && r.error) || t('needOnline')); return false; }
      toast(msg || t('saved')); puData = null; if (data) data.pendingPOs = Math.max(0, (data.pendingPOs || 1) - 1); spData = null; render(); return true;
    } catch (err) { toast(apiErr(null, err)); return false; }
  }
  function bindPurchasing() {
    document.querySelectorAll('[data-puf]').forEach(b => b.onclick = () => { puAll = b.dataset.puf === '1'; render(); });
    const n = $('poNew'); if (n) n.onclick = () => poForm();
    const find = id => puData.orders.find(o => o.id === id);
    document.querySelectorAll('[data-poa]').forEach(b => b.onclick = () => poAct('poDecide', { id: b.dataset.poa, decision: 'approve' }));
    document.querySelectorAll('[data-poo]').forEach(b => b.onclick = () => poAct('poOrder', { id: b.dataset.poo }));
    document.querySelectorAll('[data-poc]').forEach(b => b.onclick = () => poAct('poCancel', { id: b.dataset.poc }));
    document.querySelectorAll('[data-por]').forEach(b => b.onclick = () => {
      const id = b.dataset.por;
      showModal(`<h2>${esc(t('poReject'))}</h2><p class="mini">${esc(id)}</p><form class="tform" id="prF"><label for="prN">${esc(t('rqReason'))}</label><textarea class="ffield" id="prN" dir="auto" maxlength="300"></textarea><div class="msg" id="prM"></div><button class="primary" type="submit">${esc(t('poReject'))}</button></form>`, id);
      $('prF').onsubmit = async ev => { ev.preventDefault(); const note = $('prN').value.trim(); if (!note) { $('prM').textContent = t('rqNeedReason'); return; } if (await poAct('poDecide', { id: id, decision: 'reject', note: note })) hideModal(); };
    });
    document.querySelectorAll('[data-pov]').forEach(b => b.onclick = () => {
      const o = find(b.dataset.pov);
      showModal(`<h2>${esc(t('poReceive'))}</h2><p class="mini">${esc(o.id)}</p><form class="tform" id="rvF">${o.lines.map((l, i) => { const left = Math.round((l.qty - l.got) * 1000) / 1000; return `<div class="rprow"><div><b>${esc(l.no)}</b> ${esc(l.name || '')}<small>${esc(t('poLeft', { n: left }))}</small></div><input class="ffield sm" data-rv="${i}" type="text" inputmode="decimal" value="${left}" ${left <= 0 ? 'disabled' : ''}></div>`; }).join('')}
        <div class="msg" id="rvM"></div><button class="primary" type="submit">${esc(t('poReceive'))}</button></form>`, o.id);
      $('rvF').onsubmit = async ev => {
        ev.preventDefault();
        const lines = [...document.querySelectorAll('[data-rv]')].filter(e => !e.disabled && Number(e.value.replace(',', '.')) > 0).map(e => ({ index: +e.dataset.rv, qty: e.value.replace(',', '.') }));
        if (!lines.length) { $('rvM').textContent = t('poNothing'); return; }
        if (await poAct('poReceive', { id: o.id, lines: lines }, t('poReceived'))) hideModal(); else $('rvM').textContent = '';
      };
    });
  }
  async function poForm() {
    showModal(`<div class="dempty">${esc(t('pLoading'))}</div>`, '');
    let sp; try { sp = await HS.api('spares', { all: true }, 45000); } catch (err) { hideModal(); toast(apiErr(null, err)); return; }
    if (!sp || !sp.ok) { hideModal(); toast(apiErr(sp)); return; }
    const stock = sp.stock || {}, low = sp.low || [], vendors = (sp.vendors || []).filter(v => v.active !== false);
    const parts = sp.spares.electrical.filter(p => !p.deleted).map(p => ({ kind: 'electrical', no: p.no, name: p.desc || p.brand || '', onHand: Number(p.qty) || 0, key: 'e:' + p.no }))
      .concat(sp.spares.mechanical.filter(p => !p.deleted).map(p => ({ kind: 'mechanical', no: p.no, name: p.name, onHand: (Number(p.available) || 0) - (Number(p.used) || 0), required: Number(p.required) || 0, key: 'm:' + p.no })));
    const lines = [];
    const costOf = p => { const s = stock[p.key]; return s && s.cost !== null && s.cost !== undefined ? s.cost : ''; };
    const add = (p, qty) => { if (!lines.some(l => l.p.key === p.key)) lines.push({ p: p, qty: qty || 1, cost: costOf(p) }); };
    const total = () => Math.round(lines.reduce((n, l) => n + (Number(String(l.qty).replace(',', '.')) || 0) * (Number(String(l.cost).replace(',', '.')) || 0), 0) * 1000) / 1000;
    const paint = () => {
      showModal(`<h2>${esc(t('poNew'))}</h2><form class="tform" id="pfm" autocomplete="off">
        <label for="poV">${esc(t('poVendor'))}</label><select class="ffield" id="poV"><option value="">—</option>${vendors.map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('')}</select>
        <label for="poQ">${esc(t('poAddPart'))}</label><input class="ffield" id="poQ" type="search" dir="auto" placeholder="${esc(t('spSearch'))}"><div id="poR"></div>
        <button type="button" class="btn" id="poLow">${esc(t('poAddLow'))}</button>
        <div id="poL">${lines.map((l, i) => `<div class="rprow"><div><b>${esc(l.p.no)}</b> ${esc(l.p.name)}<small>${esc(t('poOnHand', { n: l.p.onHand }))}</small></div><input class="ffield sm" data-q="${i}" inputmode="decimal" value="${esc(l.qty)}" aria-label="${esc(t('poQty'))}"><input class="ffield sm" data-c="${i}" inputmode="decimal" placeholder="${esc(t('poCost'))}" value="${esc(l.cost)}"><button type="button" class="ghostbtn" data-x="${i}">×</button></div>`).join('')}</div>
        <div class="mini">${esc(t('poTotal'))}: <b id="poT">${total()}</b></div>
        <label for="poN">${esc(t('poNote'))}</label><input class="ffield" id="poN" dir="auto" maxlength="300"><div class="msg" id="poM"></div><button class="primary" type="submit">${esc(t('poSend'))}</button></form>`, '');
      const save = () => { lines.forEach((l, i) => { const q = document.querySelector('[data-q="' + i + '"]'), c = document.querySelector('[data-c="' + i + '"]'); if (q) { l.qty = q.value; l.cost = c.value; } }); };
      document.querySelectorAll('[data-q],[data-c]').forEach(e => e.oninput = () => { save(); $('poT').textContent = total(); });
      document.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { save(); lines.splice(+b.dataset.x, 1); keep(); });
      const keepV = { v: '', n: '' };
      const keep = () => { keepV.v = $('poV') ? $('poV').value : keepV.v; keepV.n = $('poN') ? $('poN').value : keepV.n; paint(); $('poV').value = keepV.v; $('poN').value = keepV.n; };
      $('poQ').oninput = () => {
        const s = $('poQ').value.trim().toLowerCase();
        const hit = s ? parts.filter(p => (p.no + ' ' + p.name).toLowerCase().indexOf(s) >= 0 && !lines.some(l => l.p.key === p.key)).slice(0, 8) : [];
        $('poR').innerHTML = hit.map((p, i) => `<div class="rprow clickrow" data-h="${i}"><div><b>${esc(p.no)}</b> ${esc(p.name)}<small>${esc(t('poOnHand', { n: p.onHand }))}</small></div></div>`).join('');
        $('poR').querySelectorAll('[data-h]').forEach(b => b.onclick = () => { save(); add(hit[+b.dataset.h]); keep(); });
      };
      $('poLow').onclick = () => {
        save();
        low.forEach(k => { const p = parts.find(x => x.key === k); if (!p) return; const s = stock[k] || {}; const target = p.kind === 'mechanical' ? p.required : (s.min || 0); add(p, Math.max(Math.ceil(target - p.onHand), 1)); });
        keep();
      };
      $('pfm').onsubmit = async ev => {
        ev.preventDefault(); save();
        if (!lines.length) { $('poM').textContent = t('poNeedLine'); return; }
        try {
          const r = await HS.api('poCreate', { po: { vendorId: $('poV').value, note: $('poN').value, lines: lines.map(l => ({ kind: l.p.kind, no: l.p.no, qty: l.qty, cost: l.cost })) } }, 45000);
          if (!r || !r.ok) { $('poM').textContent = trErr(r && r.error) || t('needOnline'); return; }
          hideModal(); toast(t('poSent', { id: r.id })); puData = null; render();
        } catch (err) { $('poM').textContent = apiErr(null, err); }
      };
    };
    paint();
  }

  /* ---------- team: employees and their rights (supervisor / operations manager) ---------- */
  let teamData = null, teamErr = '', teamLoading = false;
  function loadTeam(force) {
    if (teamLoading) return;
    teamLoading = true; teamErr = '';
    HS.api('employees', { fresh: !!force }, 45000).then(r => {
      if (r && r.ok) teamData = r; else teamErr = r && r.error ? trErr(r.error) : '';
    }).catch(err => {
      teamErr = err.message || String(err);
      if (err.auth) { authLost = true; syncUI(); }
    }).finally(() => { teamLoading = false; if (!$('dash').classList.contains('hidden')) render(); });
  }
  function rightsText(p) {
    if (p.perms && p.perms.manager) return `<span class="chip">${esc(t('dAllRights'))}</span>`;
    const r = [];
    if (p.perms && p.perms.tasks) r.push(t('dPermTasks'));
    if (p.perms && p.perms.equipment) r.push(t('dPermEq'));
    if (p.perms && p.perms.spares) r.push(t('dPermSp'));
    return r.length ? esc(r.join(' · ')) : esc(t('dNoRights'));
  }
  function teamView() {
    let emp;
    if (!teamData) {
      if (!teamLoading && !teamErr) loadTeam(false);
      emp = teamErr ? `<div class="dnote">${esc(teamErr)}</div>` : `<div class="dempty">${esc(t('dLoadTeam'))}</div>`;
    } else {
      const list = teamData.employees || [];
      emp = `<div class="tscroll"><table class="dtable"><thead><tr>
        <th>${esc(t('tName'))}</th><th>${esc(t('dEmpUser'))}</th><th>${esc(t('dEmpRole'))}</th><th>${esc(t('dRights'))}</th><th>${esc(t('dEmpActive'))}</th>
        </tr></thead><tbody>${list.map((p, i) => `<tr class="clickrow ${p.active ? '' : 'off'}" data-emp="${i}">
          <td><b>${esc(p.name)}</b></td><td><span class="eqno">${esc(p.username)}</span></td>
          <td>${esc(roleName(p.role))}${p.equipment ? ' · ' + esc(modName(p.equipment)) : ''}</td>
          <td>${rightsText(p)}</td>
          <td><span class="st ${p.active ? 'ok' : 'none'}">${esc(t(p.active ? 'dActive' : 'dInactive'))}</span></td></tr>`).join('') || `<tr><td colspan="5" class="dempty">${esc(t('noData'))}</td></tr>`}</tbody></table></div>`;
    }
    const perf = data ? performanceView() : `<div class="dempty">${esc(t('dLoading'))}</div>`;
    return `<div class="toolbar" style="justify-content:space-between"><span class="mini">${esc(t('dEmp'))}</span>
        <button type="button" class="btn pri" data-act="addEmp">${svg('plus', 2.4)}<span>${esc(t('dAddEmp'))}</span></button></div>
      <section class="dcard" style="margin-bottom:16px">${emp}</section>
      <section class="dcard"><h4>${esc(t('dPerf'))}</h4>${perf}</section>`;
  }
  function bindTeam() {
    const D = $('dash');
    D.querySelectorAll('[data-emp]').forEach(b => b.onclick = () => teamForm(teamData.employees[+b.dataset.emp]));
    const a = D.querySelector('[data-act="addEmp"]'); if (a) a.onclick = () => teamForm(null);
  }
  /** Employee form. Managers always have all rights; the own account cannot be deactivated or re-roled. */
  // operators get the equipment that goes with their role (same mapping as the backend)
  const OPERATOR_EQUIP = { 'Forklift Operator': 'Forklift', 'Skid loader Operator': 'Bobcat' };
  const eqOf = r => (Object.prototype.hasOwnProperty.call(OPERATOR_EQUIP, r) ? OPERATOR_EQUIP[r] : '');
  function teamForm(p) {
    if (!teamData) return;
    const isNew = !p;
    const self = !!p && p.username.toLowerCase() === String(session.user.username || '').toLowerCase();
    const roles = teamData.roles || [];
    const perms = (p && p.perms) || {};
    const role0 = p ? p.role : roles[0];
    const chk = (id, lab, on, dis) => `<label class="chkrow"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}><span>${esc(t(lab))}</span></label>`;
    const eqHint = r => (eqOf(r) ? t('dRoleEq', { eq: modName(eqOf(r)) }) : '');
    showModal(`<h2>${esc(t(isNew ? 'dNewEmp' : 'dEditEmp'))}</h2>
      <form class="tform" id="empF" autocomplete="off">
        <div class="fgroup"><h4>${esc(t('dSecAccount'))}</h4>
          ${fld('eN', 'dEmpName', p ? p.name : '', { max: 80 })}
          ${fld('eU', 'dEmpUser', p ? p.username : '', { max: 30, ltr: true })}
          <label for="eR">${esc(t('dEmpRole'))}</label>
          <select class="ffield" id="eR" ${self ? 'disabled' : ''}>${roles.map(r => `<option value="${esc(r)}" ${r === role0 ? 'selected' : ''}>${esc(roleName(r))}</option>`).join('')}</select>
          <p class="fnote" id="eEqHint">${esc(eqHint(role0))}</p>
          <label for="eP">${esc(t(isNew ? 'dEmpPin' : 'dEmpPinKeep'))}</label>
          <input class="ffield" id="eP" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" dir="ltr">
          ${chk('eA', 'dEmpActive', !p || p.active, self)}
        </div>
        <div class="fgroup"><h4>${esc(t('dSecRights'))}</h4>
          ${chk('pT', 'dPermTasks', perms.tasks, isMgrRole(role0))}
          ${chk('pE', 'dPermEq', perms.equipment, isMgrRole(role0))}
          ${chk('pS', 'dPermSp', perms.spares, isMgrRole(role0))}
          <p class="fnote">${esc(self ? t('dSelfNote') : t('dPermMgr'))}</p>
        </div>
        <div class="mfoot">
          <div class="msg alert" id="eMsg"></div>
          <button class="primary" type="submit" id="eGo">${esc(t('dEmpSave'))}</button>
        </div>
      </form>`, '');
    const rs = $('eR');
    rs.onchange = () => {
      const m = isMgrRole(rs.value);
      $('eEqHint').textContent = eqHint(rs.value);
      [['pT', 'tasks'], ['pE', 'equipment'], ['pS', 'spares']].forEach(([id, k]) => {
        const c = $(id); c.disabled = m;
        c.checked = m ? true : !!perms[k];
      });
    };
    $('empF').onsubmit = async ev => {
      ev.preventDefault();
      const emp = { name: $('eN').value.trim(), username: $('eU').value.trim(), role: rs.value,
        pin: $('eP').value.trim(), active: $('eA').checked,
        perms: { tasks: $('pT').checked, equipment: $('pE').checked, spares: $('pS').checked } };
      if (p) emp.id = p.id;
      $('eGo').disabled = true; $('eMsg').textContent = '';
      try {
        const r = await HS.api('employeeSave', { employee: emp }, 45000);
        if (!r || !r.ok) { $('eMsg').textContent = trErr(r && r.error) || t('needOnline'); $('eGo').disabled = false; return; }
        hideModal(); toast(t('saved'));
        loadTeam(true);
      } catch (err) { $('eMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('eGo').disabled = false; }
    };
  }
  function fld(id, lab, val, o) {
    o = o || {};
    return `<label for="${id}">${esc(t(lab))}</label><input class="ffield" id="${id}" dir="${o.ltr ? 'ltr' : 'auto'}" maxlength="${o.max || 120}" value="${esc(val == null ? '' : val)}"${o.num ? ' inputmode="decimal"' : ''}${o.list ? ` list="${o.list}"` : ''} autocomplete="off">`;
  }
  function photoRow(id, required) {
    return `<label>${esc(t(required ? 'dEqfPhotoNew' : 'dEqfPhoto'))}</label>
      <div class="phrow"><button type="button" class="btn" id="${id}">${svg('photo')}<span>${esc(t('dChoosePhoto'))}</span></button>
      <span class="mini" id="${id}Name">${esc(required ? '' : t('dKeepPhoto'))}</span></div>`;
  }

  /* ---------- overview ---------- */
  function overview() {
    const tk = data.tasks, today = data.today;
    const open = tk.filter(x => x.status === 'Open'), prog = tk.filter(x => x.status === 'In progress');
    const late = open.concat(prog).filter(x => x.due && x.due < today);
    const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const doneWeek = tk.filter(x => x.status === 'Done' && String(x.done).slice(0, 10) >= weekAgo);
    const rd = data.readings.filter(r => !r.error), rdDone = rd.filter(r => r.completed).length;
    const units = [].concat(...data.checks.map(c => c.units.map(u => Object.assign({ type: c.type }, u))));
    const checked = units.filter(u => u.status).length, faulty = units.filter(u => /^action/i.test(u.status)).length;
    const kpis = `<div class="kpis">
      <button type="button" class="kpi acc" data-go="tasks"><small>${esc(t('kOpen'))}</small><b>${open.length}</b></button>
      <button type="button" class="kpi" data-go="tasks"><small>${esc(t('kProg'))}</small><b>${prog.length}</b></button>
      <button type="button" class="kpi ${late.length ? 'bad' : ''}" data-go="tasks"><small>${esc(t('kOverdue'))}</small><b>${late.length}</b></button>
      <button type="button" class="kpi good" data-go="team"><small>${esc(t('kDoneWeek'))}</small><b>${doneWeek.length}</b></button>
      <div class="kpi ${rdDone === rd.length && rd.length ? 'good' : ''}"><small>${esc(t('kReadings'))}</small><b>${rdDone}</b><span>${esc(t('kOf', { n: rd.length }))}</span></div>
      <div class="kpi ${faulty ? 'bad' : ''}"><small>${esc(t('kChecks'))}</small><b>${checked}</b><span>${esc(t('kOf', { n: units.length }))}${faulty ? ' · ' + esc(t('kFaults', { n: faulty })) : ''}</span></div>
    </div>`;
    const readings = data.readings.map(r => {
      if (r.error) return `<div class="rl"><div class="rt"><b>${esc(modName(r.sheet))}</b><span class="mini">${esc(trErr(r.error))}</span></div></div>`;
      const p = pct(r.filled, r.total);
      return `<div class="rl"><div class="rt"><b>${esc(modName(r.sheet))}</b><span class="mini ltr">${r.filled} / ${r.total}</span></div>
        <div class="hb ${p === 100 ? 'full' : ''}"><i style="width:${p}%"></i></div>
        <div class="mini">${r.completed ? esc(t('completedByAt', { by: r.completed.by, at: r.completed.at })) : esc(t('notCompleted'))}${r.checkedBy ? ' · ' + esc(t('checkedBy', { n: r.checkedBy })) : ''}</div></div>`;
    }).join('');
    const checks = units.length ? units.map(u => {
      const cls = !u.status ? 'none' : /^action/i.test(u.status) ? 'bad' : 'ok';
      return `<div class="rl"><div class="rt"><b>${esc(modName(u.type))} · ${esc(u.unit)}</b><span class="st ${cls}">${esc(u.status ? trStatus(u.status) : t('chkNot'))}</span></div>
        ${u.status ? `<div class="mini">${esc(u.by || '')}${u.at ? ' · ' + esc(u.at) : ''}</div>` : ''}${u.faults ? `<div class="fault">${linkify(u.faults)}</div>` : ''}</div>`;
    }).join('') : `<div class="dempty">${esc(t('noData'))}</div>`;
    const attention = late.concat(open.concat(prog).filter(x => x.priority === 'Urgent' && late.indexOf(x) < 0));
    const att = attention.length ? attention.slice(0, 8).map(card).join('') : `<div class="dempty">${esc(t('noData'))}</div>`;
    const faults = data.faults.length ? data.faults.slice(0, 10).map(f => `<div class="rl"><div class="rt"><b>${esc(modName(f.type))} · ${esc(f.unit)}</b><span class="mini">${esc(shortDate(f.date))}</span></div>
        <div class="mini">${esc(f.by || '')}</div><div class="fault">${linkify(f.faults)}</div></div>`).join('') : `<div class="dempty">${esc(t('noData'))}</div>`;
    return kpis + `<div class="dgrid">
      <section class="dcard"><h4>${esc(t('cReadings'))}<span>${esc(shortDate(today))}</span></h4>${readings}</section>
      <section class="dcard"><h4>${esc(t('cChecks'))}</h4>${checks}</section>
      <section class="dcard"><h4>${esc(t('cAttention'))}<span>${attention.length}</span></h4>${att}</section>
      <section class="dcard"><h4>${esc(t('cFaults'))}<span>${data.faults.length}</span></h4>${faults}</section>
    </div>`;
  }
  function linkify(s) {
    return esc(s).replace(/(https?:\/\/[^\s)]+)/g, u => `<a href="${u}" target="_blank" rel="noopener">${esc(t('openPhoto'))}</a>`);
  }

  /* ---------- tasks board ---------- */
  function card(x) {
    const late = isLate(x);
    const meta = [];
    meta.push(`<span>${esc(x.assigneeName || nameOf(x.assignee))}</span>`);
    if (x.equipment) meta.push(`<span>${esc(eqLabel(x))}</span>`);
    if (x.status === 'Done') meta.push(`<span>${esc(t('doneAt', { d: fmtStamp(x.done) }))}</span>`);
    else if (x.due) meta.push(`<span class="${late ? 'late' : ''}">${esc(late ? t('overdue') + ' · ' + shortDate(x.due) : dueText(x.due))}</span>`);
    if (x.link) meta.push(`<span title="${esc(modName(x.link))}">↗ ${esc(modName(x.link))}</span>`);
    if (x.category) meta.push(`<span>${esc(t('cat')[x.category] || x.category)}</span>`);
    if (x.approval === 'Pending') meta.push(`<span class="late" data-await="1">⏳ ${esc(t('tAwait'))}</span>`);
    if (x.donePhoto) meta.push(`<span>📷</span>`);
    return `<button type="button" class="tcard ${esc(x.priority)}" data-tid="${esc(x.id)}"><b>${esc(x.title)}</b><div class="mini">${meta.join('')}</div></button>`;
  }
  let catF = '';
  function filtered() {
    const s = q.trim().toLowerCase();
    return data.tasks.filter(x => x.status !== 'Cancelled' && (!who || x.assignee.toLowerCase() === who.toLowerCase()) &&
      (!lineF || (x.line || '') === lineF) && (!catF || (x.category || '') === catF) &&
      (!s || [x.title, x.details, x.equipment, x.equipmentNo, x.line, x.location, x.assigneeName, x.id].join(' ').toLowerCase().indexOf(s) >= 0));
  }
  function boardHtml() {
    const list = filtered();
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const cols = [['colOpen', list.filter(x => x.status === 'Open')], ['colProg', list.filter(x => x.status === 'In progress')],
                  ['colDone', list.filter(x => x.status === 'Done' && String(x.done).slice(0, 10) >= since)]];
    return cols.map(([k, l]) => `<div class="bcol"><h5>${esc(t(k))}<span>${l.length}</span></h5>${l.map(card).join('') || `<div class="dempty">—</div>`}</div>`).join('');
  }
  function tasksView() {
    const people = data.assignable.map(p => `<option value="${esc(p.username)}" ${p.username === who ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const lines = [...new Set(eqActive().map(e => e.line).concat(data.tasks.map(x => x.line)).filter(Boolean))].sort();
    const lineOpts = lines.map(l => `<option value="${esc(l)}" ${l === lineF ? 'selected' : ''}>${esc(l)}</option>`).join('');
    return `<div class="toolbar"><select id="dWho"><option value="">${esc(t('fAll'))}</option>${people}</select>
      ${lines.length ? `<select id="dLine"><option value="">${esc(t('fLineAll'))}</option>${lineOpts}</select>` : ''}
      <select id="dCat"><option value="">${esc(t('fCatAll'))}</option>${Object.keys(t('cat')).filter(Boolean).map(c => `<option value="${c}" ${c === catF ? 'selected' : ''}>${esc(t('cat')[c])}</option>`).join('')}</select>
      <input id="dQ" type="search" dir="auto" placeholder="${esc(t('fSearch'))}" value="${esc(q)}">
      <button class="btn" type="button" id="dRules">${esc(t('aList'))}</button>
      <button class="btn" type="button" id="dLimits">${esc(t('lmTitle'))}</button></div>
      <div class="board" id="dBoard">${boardHtml()}</div>`;
  }
  function renderBoardOnly() {
    const b = $('dBoard'); if (!b) return;
    b.innerHTML = boardHtml();
    b.querySelectorAll('[data-tid]').forEach(x => x.onclick = () => taskDetail(x.dataset.tid));
  }

  /* ---------- performance (monthly figures per person) ---------- */
  function performanceView() {
    const m0 = (data.months[0] && data.months[0].people) || {};
    const rows = data.workload.map(w => {
      const c = m0[w.username.toLowerCase()] || {};
      const total = (c.tasksDone || 0) + (c.readings || 0) + (c.checks || 0);
      return `<tr><td><b>${esc(w.name)}</b></td><td>${esc(roleName(w.role))}</td><td class="num">${w.open}</td><td class="num">${w.inProgress}</td>
        <td class="num ${w.overdue ? 'late' : ''}">${w.overdue}</td><td class="num">${w.doneWeek}</td><td class="num">${w.doneMonth}</td>
        <td class="num">${c.readings || 0}</td><td class="num">${c.checks || 0}</td><td class="num"><b>${total}</b></td></tr>`;
    }).join('');
    return `<div class="tscroll"><table class="dtable"><thead><tr>
      <th>${esc(t('tName'))}</th><th>${esc(t('tRole'))}</th><th class="num">${esc(t('tOpen'))}</th><th class="num">${esc(t('tProg'))}</th><th class="num">${esc(t('tOver'))}</th>
      <th class="num">${esc(t('tDoneW'))}</th><th class="num">${esc(t('tDoneM'))}</th><th class="num">${esc(t('tReadM'))}</th><th class="num">${esc(t('tChkM'))}</th><th class="num">${esc(t('tTotM'))}</th>
      </tr></thead><tbody>${rows || `<tr><td colspan="10" class="dempty">${esc(t('noData'))}</td></tr>`}</tbody></table></div>`;
  }

  /* ---------- monthly summary ---------- */
  function monthlyView() {
    const months = data.months;
    if (!month || !months.find(m => m.month === month)) month = months[0].month;
    const m = months.find(x => x.month === month);
    const sel = months.map(x => `<button type="button" data-month="${x.month}" class="${x.month === month ? 'on' : ''}">${esc(monthName(x.month))}</button>`).join('');
    const kpis = `<div class="kpis">
      <div class="kpi"><small>${esc(t('mCreated'))}</small><b>${m.created}</b></div>
      <div class="kpi good"><small>${esc(t('mDone'))}</small><b>${m.done}</b></div>
      <div class="kpi"><small>${esc(t('mOnTime'))}</small><b>${m.dueTotal ? pct(m.onTime, m.dueTotal) + '%' : '—'}</b><span class="ltr">${m.onTime} / ${m.dueTotal}</span></div>
      <div class="kpi"><small>${esc(t('mAvg'))}</small><b>${m.avgHours == null ? '—' : esc(t('mHours', { n: m.avgHours }))}</b></div>
      <div class="kpi"><small>${esc(t('mReadings'))}</small><b>${m.readings}</b></div>
      <div class="kpi"><small>${esc(t('mChecks'))}</small><b>${m.checks}</b></div>
      <div class="kpi ${m.faults ? 'bad' : ''}"><small>${esc(t('mFaults'))}</small><b>${m.faults}</b></div></div>`;
    const people = Object.keys(m.people).map(u => Object.assign({ username: u, name: nameOf(u) }, m.people[u]))
      .map(p => Object.assign(p, { total: p.tasksDone + p.readings + p.checks })).sort((a, b) => b.total - a.total);
    const max = Math.max(1, ...people.map(p => p.total));
    const prow = people.map(p => `<tr><td><b>${esc(p.name)}</b></td><td class="num">${p.tasksAssigned}</td><td class="num">${p.tasksDone}</td>
      <td class="num">${p.readings}</td><td class="num">${p.checks}</td>
      <td><div class="barcell"><div class="hb"><i style="width:${pct(p.total, max)}%"></i></div><b>${p.total}</b></div></td></tr>`).join('');
    const hmax = Math.max(1, ...months.map(x => x.done + x.readings + x.checks));
    const hist = months.map(x => `<tr><td><button type="button" class="btn" style="height:30px;box-shadow:none" data-month="${x.month}">${esc(monthName(x.month))}</button></td>
      <td class="num">${x.created}</td><td class="num">${x.done}</td><td class="num">${x.dueTotal ? pct(x.onTime, x.dueTotal) + '%' : '—'}</td>
      <td class="num">${x.readings}</td><td class="num">${x.checks}</td><td class="num">${x.faults}</td>
      <td><div class="barcell"><div class="hb"><i style="width:${pct(x.done + x.readings + x.checks, hmax)}%"></i></div></div></td></tr>`).join('');
    return `<div class="msel">${sel}</div>${kpis}
      <div class="dgrid">
        <section class="dcard"><h4>${esc(t('mPerEmp', { m: monthName(month) }))}</h4><div class="tscroll"><table class="dtable"><thead><tr>
          <th>${esc(t('tName'))}</th><th class="num">${esc(t('mAssigned'))}</th><th class="num">${esc(t('mDone'))}</th><th class="num">${esc(t('mReadings'))}</th><th class="num">${esc(t('mChecks'))}</th><th>${esc(t('mTotal'))}</th>
          </tr></thead><tbody>${prow || `<tr><td colspan="6" class="dempty">${esc(t('noData'))}</td></tr>`}</tbody></table></div></section>
        <section class="dcard"><h4>${esc(t('mHistory'))}</h4><div class="tscroll"><table class="dtable"><thead><tr>
          <th>${esc(t('mMonth'))}</th><th class="num">${esc(t('mCreated'))}</th><th class="num">${esc(t('mDone'))}</th><th class="num">${esc(t('mOnTime'))}</th>
          <th class="num">${esc(t('mReadings'))}</th><th class="num">${esc(t('mChecks'))}</th><th class="num">${esc(t('mFaults'))}</th><th></th>
          </tr></thead><tbody>${hist}</tbody></table></div></section>
      </div>`;
  }

  /* ---------- task details + actions (supervisor) ---------- */
  let cancelArmed = false;
  function showModal(html, label) {
    $('taskId').textContent = label || '';
    $('taskBody').innerHTML = html;
    $('taskModal').classList.add('open'); $('taskModal').setAttribute('aria-hidden', 'false');
  }
  function hideModal() { $('taskModal').classList.remove('open'); $('taskModal').setAttribute('aria-hidden', 'true'); }
  function taskDetail(id) {
    const x = data.tasks.find(k => k.id === id);
    if (!x) return;
    cancelArmed = false;
    const info = [[t('assignedTo'), esc(x.assigneeName || nameOf(x.assignee))]];
    if (x.equipment) info.push([t('equipment'), esc(eqLabel(x))]);
    if (x.line || x.location) info.push([t('line'), esc([x.line, x.location].filter(Boolean).join(' · '))]);
    if (x.due) info.push([t('due'), isLate(x) ? `<span class="late">${esc(shortDate(x.due))} · ${esc(t('overdue'))}</span>` : esc(shortDate(x.due))]);
    if (x.link) info.push([t('fLink'), esc(modName(x.link))]);
    info.push([t('createdBy'), esc(x.creatorName || x.createdBy) + ' · ' + esc(fmtStamp(x.created))]);
    if (x.started) info.push([t('startedLabel'), esc(fmtStamp(x.started))]);
    if (x.done) info.push([t('doneLabel'), esc(fmtStamp(x.done))]);
    if (x.category) info.push([t('tCatLabel'), esc(t('cat')[x.category] || x.category)]);
    if (x.hours) info.push([t('tHours'), esc(x.hours) + ' h']);
    if (x.approval === 'Approved') info.push([t('tApproved'), esc(nameOf(x.approvalBy) || x.approvalBy || '✓')]);
    const people = data.assignable.map(p => `<option value="${esc(p.username)}" ${p.username.toLowerCase() === x.assignee.toLowerCase() ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    let actions = '';
    if (x.status === 'Open' || x.status === 'In progress') actions = `
      <div class="reass"><select class="ffield" id="dReass">${people}</select><button type="button" class="btn" id="dReassBtn">${esc(t('aReassign'))}</button></div>
      <div class="dact"><button type="button" class="ghostbtn" id="dEdit">${esc(t('aEdit'))}</button><button type="button" class="dangerbtn" id="dCancel">${esc(t('aCancel'))}</button></div>`;
    else if (x.status === 'Done' && x.approval === 'Pending') actions = `<div class="tdesc">${esc(t('tAwait'))}</div>
      <input class="ffield" id="dApNote" dir="auto" placeholder="${esc(t('tReason'))}">
      <div class="msg" id="dApMsg" role="alert"></div>
      <div class="dact"><button type="button" class="primary green" id="dApprove">${esc(t('tApprove'))}</button><button type="button" class="dangerbtn" id="dSendBack">${esc(t('tSendBack'))}</button></div>`;
    else actions = `<div class="dact"><button type="button" class="ghostbtn" id="dEdit">${esc(t('aEdit'))}</button><button type="button" class="ghostbtn" id="dReopen">${esc(t('aReopen'))}</button></div>`;
    showModal(`<div class="tmeta"><span class="chip ${STATUS_CLASS(x.status)}">${esc(t('status.' + x.status))}</span><span class="chip prio ${esc(x.priority)}">${esc(t('prio.' + x.priority))}</span></div>
      <h2>${esc(x.title)}</h2>
      <dl class="tinfo">${info.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${b}</dd>`).join('')}</dl>
      ${x.details ? `<div class="tdesc">${esc(x.details)}</div>` : ''}
      ${x.doneNote ? `<dl class="tinfo"><dt>${esc(t('doneNoteLabel'))}</dt><dd></dd></dl><div class="tdesc">${esc(x.doneNote)}</div>` : ''}
      ${/^https?:/.test(x.donePhoto || '') ? `<p style="margin-bottom:12px"><a class="btn" href="${esc(x.donePhoto)}" target="_blank" rel="noopener">${svg('photo')}<span>${esc(t('openPhoto'))}</span></a></p>` : ''}
      ${x.signed ? `<p class="mini"><b>${esc(t('sgDone'))}</b></p><div id="dSig"></div>` : ''}${x.procedure ? `<div id="dProc"><small>${esc(t('prcTitle'))}: ${esc(x.procedure)}</small></div>` : ''}
      <div class="tact"><div class="dact"><button type="button" class="ghostbtn" id="dParts">${esc(t('woPartsBtn'))}</button><button type="button" class="ghostbtn" id="dComments">${esc(t('cmBtn'))}</button></div>${actions}</div>`, x.id);
    const on = (i, fn) => { const el = $(i); if (el) el.onclick = fn; };
    on('dParts', () => taskPartsModal(x.id, () => taskDetail(x.id)));
    on('dComments', () => commentsModal(x.id, () => taskDetail(x.id)));
    if (x.procedure) HS.api('procedureRuns', { taskId: x.id }, 20000).then(r => { const b = $('dProc'); if (!b || !r || !r.ok) return; b.innerHTML += r.runs.map(q => `<div class="rprow"><div>${resChip(q.result)} <small>${esc(q.id)} · ${esc(fmtStamp(q.at))}</small></div><button type="button" class="btn" data-aud="${esc(q.id)}">${esc(t('prcAudit'))}</button></div>`).join('') || `<div class="mini">${esc(t('prcNoRuns'))}</div>`; b.querySelectorAll('[data-aud]').forEach(z => z.onclick = () => auditView(z.dataset.aud, () => taskDetail(x.id))); }).catch(() => {});
    if (x.signed) HS.api('taskSignature', { id: x.id }, 20000).then(r => { const b = $('dSig'); if (b && r && r.ok && r.signature) b.innerHTML = `<img alt="" src="${esc(r.signature)}" style="max-width:100%;background:#fff;border:1px solid var(--line);border-radius:10px">${r.name ? `<small>${esc(r.name)}</small>` : ''}`; }).catch(() => {});
    on('dEdit', () => taskForm(x));
    on('dApprove', () => approve(x.id, true, ''));
    on('dSendBack', () => { const n = $('dApNote').value.trim(); if (!n) { $('dApMsg').textContent = t('tReason'); return; } approve(x.id, false, n); });
    on('dReassBtn', () => edit({ id: x.id, assignee: $('dReass').value }));
    on('dReopen', () => edit({ id: x.id, status: 'Open' }));
    on('dCancel', () => {
      if (!cancelArmed) { cancelArmed = true; $('dCancel').textContent = t('aCancelSure'); return; }
      edit({ id: x.id, status: 'Cancelled' });
    });
  }
  async function approve(id, ok, note) {
    try {
      const r = await HS.api('taskApprove', { id: id, approve: ok, note: note }, 30000);
      if (!r || !r.ok) { toast(trErr(r && r.error) || t('needOnline')); return; }
      hideModal(); toast(t(ok ? 'tApproved' : 'tSentBack'));
      upsert(r.task); render(); load();
    } catch (e) { toast(e.auth ? t('sessionExpired') : t('needOnline')); }
  }
  async function edit(f) {
    try {
      const r = await HS.api('taskEdit', { task: f }, 30000);
      if (!r || !r.ok) { toast(trErr(r && r.error) || t('needOnline')); return; }
      hideModal();
      toast(r.notified ? (r.notified.sent ? t('sentOk', { n: r.task.assigneeName }) : t('sentNoPhone', { n: r.task.assigneeName })) : t('saved'));
      upsert(r.task); render(); load();
    } catch (e) { toast(e.auth ? t('sessionExpired') : t('needOnline')); }
  }
  function upsert(task) {
    if (!data) return;
    const i = data.tasks.findIndex(k => k.id === task.id);
    if (i >= 0) data.tasks[i] = task; else data.tasks.unshift(task);
  }

  /* ---------- new / edit task form ---------- */
  let peopleList = null, peopleLoading = false;
  /** Technicians and operators to assign to. Managers get them with the dashboard; others ask the server. */
  function assignees() { return isMgr() ? (data ? data.assignable : []) : (peopleList || []); }
  function ensurePeople() {
    if (isMgr() || peopleList || peopleLoading) return Promise.resolve();
    peopleLoading = true;
    return HS.api('people', {}, 45000).then(r => { if (r && r.ok) peopleList = r.assignable || []; })
      .catch(err => { if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { peopleLoading = false; });
  }
  async function taskForm(x) {
    if (isMgr() && !data) { toast(t('needOnline')); return; }
    if (!isMgr()) {
      await ensurePeople();
      if (!peopleList) { toast(t('needOnline')); return; }
      if (perm('equipment') && eqAll === null && !eqLoading) await loadEquip(false);
    }
    let procList = [];
    if (isMgr()) { try { const pr0 = await HS.api('procedures', {}, 15000); if (pr0 && pr0.ok) procList = pr0.procedures.filter(p => p.active || (x && x.procedure === p.id)); } catch (e) {} }
    const pr = (x && x.priority) || 'Normal';
    const people = assignees().map(p => `<option value="${esc(p.username)}" ${x && p.username.toLowerCase() === x.assignee.toLowerCase() ? 'selected' : ''}>${esc(p.name)} — ${esc(roleName(p.role))}</option>`).join('');
    const links = ['', 'Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Bobcat', 'Forklift'].map(l => `<option value="${esc(l)}" ${x && x.link === l ? 'selected' : ''}>${esc(l ? modName(l) : t('fNone'))}</option>`).join('');
    showModal(`<h2>${esc(t(x ? 'fEditTitle' : 'fNewTitle'))}</h2>
      <form class="tform" id="dForm" autocomplete="off">
        <label for="fTitle">${esc(t('fTitle'))} *</label>
        <input class="ffield" id="fTitle" dir="auto" maxlength="140" required placeholder="${esc(t('fTitlePh'))}" value="${esc(x ? x.title : '')}">
        <div id="fWhoW"><label for="fWho">${esc(t('fAssignee'))} *</label>
        <select class="ffield" id="fWho" required>${x ? '' : `<option value="">${esc(t('fChoose'))}</option>`}${people}</select></div>
        <label>${esc(t('fPriority'))}</label>
        <div class="segctl four" id="fPrio">${['Low', 'Normal', 'High', 'Urgent'].map(p => `<button type="button" data-p="${p}" class="${p === pr ? 'on' : ''}">${esc(t('prio.' + p))}</button>`).join('')}</div>
        <label for="fEq">${esc(t('fEquip'))}</label>
        ${equipPicker(x)}
        <div class="row2">
          <div><label for="fDue">${esc(t('fDue'))}</label><input class="ffield" id="fDue" type="date" value="${esc(x ? x.due : todayISO())}"></div>
          <div><label for="fLink">${esc(t('fLink'))}</label><select class="ffield" id="fLink">${links}</select></div>
        </div>
        <label for="fDet">${esc(t('fDetails'))}</label>
        <textarea class="ffield" id="fDet" dir="auto">${esc(x ? x.details : '')}</textarea>
        <label for="fCat">${esc(t('tCategory'))}</label>
        <select class="ffield" id="fCat">${Object.keys(t('cat')).map(c => `<option value="${c}" ${x && x.category === c ? 'selected' : ''}>${esc(t('cat')[c])}</option>`).join('')}</select>
        <label class="chkrow"><input type="checkbox" id="fNeedNote" ${x && x.needNote ? 'checked' : ''}><span>${esc(t('tNeedNote'))}</span></label>
        <label class="chkrow"><input type="checkbox" id="fNeedPhoto" ${x && x.needPhoto ? 'checked' : ''}><span>${esc(t('tNeedPhoto'))}</span></label>
        <label class="chkrow"><input type="checkbox" id="fNeedSig" ${x && x.needSignature ? 'checked' : ''} ${x && x.status === 'Done' ? 'disabled' : ''}><span>${esc(t('sgNeed'))}</span></label>
        <div class="fgroup"><label for="fAsQ">${esc(t('asExtra'))}</label><p class="hint">${esc(t('asExtraHint'))}</p><div id="fAsChips"></div>
          <input class="ffield" id="fAsQ" type="search" dir="auto" placeholder="${esc(t('asSearch'))}" autocomplete="off"><div id="fAsRes"></div></div>
        <div class="fgroup"><label for="fProc">${esc(t('tProc'))}</label><select class="ffield" id="fProc" ${x && x.status === 'Done' ? 'disabled' : ''}><option value="">${esc(t('tProcNone'))}</option>${procList.map(p => `<option value="${esc(p.id)}" ${x && x.procedure === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="hint" id="fEst"></div>
        <label class="chkrow"><input type="checkbox" id="fNeedAp" ${x && (x.approval === 'Required' || x.approval === 'Pending' || x.approval === 'Approved') ? 'checked' : ''} ${x && x.status === 'Done' ? 'disabled' : ''}><span>${esc(t('tNeedApproval'))}</span></label>
        ${isMgr() ? `<div class="fgroup" id="fTplBox"><label for="fTpl">${esc(t('tTemplate'))}</label>
          <select class="ffield" id="fTpl"><option value="">${esc(t('tNoTemplate'))}</option></select>
          <div class="dact"><button type="button" class="ghostbtn" id="fTplSave">${esc(t('tSaveTpl'))}</button><button type="button" class="ghostbtn" id="fTplDel" hidden>${esc(t('tDelTpl'))}</button></div></div>` : ''}
        ${!x && isMgr() ? taskRepeatBlock() : ''}
        <div class="msg" id="fMsg"></div>
        <button class="primary" type="submit" id="fGo">${esc(t(x ? 'fSave' : 'fCreate'))}</button>
      </form>`, x ? x.id : '');
    let prio = pr;
    const getEquip = wirePicker(x);
    const getAssets = wireAssets(x ? x.assets || [] : []);
    let estKey = '', estTimer = null;
    const showEst = () => {
      if (!$('fEst') || !$('fTitle') || !$('fCat')) return;   // form was closed meanwhile
      const eq = getEquip(), title = $('fTitle').value.trim(), cat = $('fCat').value, k = [title, eq.equipmentNo, cat].join('|');
      if (!$('fEst') || k === estKey || (!title && !eq.equipmentNo && !cat)) return;
      estKey = k;
      HS.api('estimate', { title: title, equipmentNo: eq.equipmentNo, category: cat }, 15000).then(r => { if ($('fEst')) $('fEst').textContent = r && r.ok && r.hours ? t('tEst', { h: r.hours, n: r.n, b: r.basis }) : ''; }).catch(() => {});
    };
    $('dForm').addEventListener('input', () => { clearTimeout(estTimer); estTimer = setTimeout(showEst, 500); });
    $('dForm').addEventListener('click', () => { clearTimeout(estTimer); estTimer = setTimeout(showEst, 600); });
    setTimeout(showEst, 300);
    $('fPrio').querySelectorAll('button').forEach(b => b.onclick = () => { prio = b.dataset.p; $('fPrio').querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b)); });
    if (!x && isMgr()) bindTaskRepeat();
    const extras = () => ({ category: $('fCat').value, needNote: $('fNeedNote').checked, needPhoto: $('fNeedPhoto').checked, needApproval: $('fNeedAp').checked });
    if (isMgr()) bindTemplates(extras, () => prio, p => { prio = p; $('fPrio').querySelectorAll('button').forEach(o => o.classList.toggle('on', o.dataset.p === p)); });
    setTimeout(() => $('fTitle').focus(), 60);
    $('dForm').onsubmit = async ev => {
      ev.preventDefault();
      const f = Object.assign({ title: $('fTitle').value.trim(), assignee: $('fWho').value, priority: prio, due: $('fDue').value, link: $('fLink').value, details: $('fDet').value.trim() }, extras(), getEquip(), { needSignature: $('fNeedSig').checked, assets: getAssets(), procedure: $('fProc').value });
      const rep = !x && isMgr() ? repeatPayload() : null;   // null = a single task, as before
      if (!f.title) { $('fMsg').textContent = t('fTitle') + ' *'; return; }
      if (rep && !rep.assignees.length) { $('fMsg').textContent = t('aNeedWho'); return; }
      if (rep && rep.basis === 'hours' && !f.equipmentNo) { $('fMsg').textContent = t('aNeedEq'); return; }
      if (rep && rep.basis === 'hours' && !(Number(rep.hours) >= 1)) { $('fMsg').textContent = t('aNeedHours'); return; }
      if (!rep && !f.assignee) { $('fMsg').textContent = t('fAssignee') + ' *'; return; }
      $('fGo').disabled = true; $('fMsg').textContent = '';
      try {
        if (rep) {
          const rr = await HS.api('taskRuleCreate', { task: f, auto: rep }, 30000);
          if (!rr || !rr.ok) { $('fMsg').textContent = trErr(rr && rr.error) || t('needOnline'); $('fGo').disabled = false; return; }
          hideModal();
          toast(t('aSaved', { n: rr.tasks.length }));
          rr.tasks.forEach(upsert);
          section = section === 'overview' ? 'tasks' : section;
          render(); load();
          return;
        }
        const r = x ? await HS.api('taskEdit', { task: Object.assign({ id: x.id }, f) }, 30000) : await HS.api('taskCreate', { task: f }, 30000);
        if (!r || !r.ok) { $('fMsg').textContent = trErr(r && r.error) || t('needOnline'); $('fGo').disabled = false; return; }
        hideModal();
        const n = r.task.assigneeName;
        toast(r.notified ? (r.notified.sent ? t('sentOk', { n }) : t('sentNoPhone', { n })) : t('saved'));
        if (r.warning) setTimeout(() => toast(r.warning), 2200);
        if (isMgr()) { upsert(r.task); section = section === 'overview' && !x ? 'tasks' : section; }
        render(); load();
      } catch (e) { $('fMsg').textContent = e.auth ? t('sessionExpired') : t('needOnline'); $('fGo').disabled = false; }
    };
  }

  /** Extra-asset chips + search inside the work order form. Returns a function that gives the chosen list. */
  function wireAssets(initial) {
    let list = initial.map(a => ({ no: a.no, name: a.name })), timer = null, seq = 0;
    const paint = () => { $('fAsChips').innerHTML = list.map((a, i) => `<span class="chip" style="margin:0 6px 6px 0">${esc(a.name)} (${esc(a.no)}) <button type="button" class="ghostbtn" data-asx="${i}" aria-label="${esc(t('asRemove'))}" style="padding:0 6px">×</button></span>`).join('');
      $('fAsChips').querySelectorAll('[data-asx]').forEach(b => b.onclick = () => { list.splice(+b.dataset.asx, 1); paint(); }); };
    paint();
    const run = async () => {
      const my = ++seq, q = $('fAsQ').value.trim();
      if (!q) { $('fAsRes').innerHTML = ''; return; }
      try {
        const r = await HS.api('assetsLookup', { q: q }, 20000);
        if (my !== seq || !$('fAsRes')) return;
        const rows = (r && r.ok ? r.assets : []).filter(a => !list.some(x => x.no === a.no));
        $('fAsRes').innerHTML = rows.length ? rows.map((a, i) => `<div class="rprow clickrow" data-asi="${i}"><div><b>${esc(a.name)}</b><small>${esc(a.no)}${a.line ? ' · ' + esc(a.line) : ''}</small></div></div>`).join('') : `<div class="dempty">${esc(t('asNone'))}</div>`;
        $('fAsRes').querySelectorAll('[data-asi]').forEach(b => b.onclick = () => { list.push({ no: rows[+b.dataset.asi].no, name: rows[+b.dataset.asi].name }); $('fAsQ').value = ''; $('fAsRes').innerHTML = ''; paint(); });
      } catch (err) { if ($('fAsRes')) $('fAsRes').innerHTML = `<div class="dnote">${esc(t('needOnline'))}</div>`; }
    };
    $('fAsQ').oninput = () => { clearTimeout(timer); timer = setTimeout(run, 250); };
    return () => list.slice();
  }

  /* ---------- task templates (supervisor): pick one to fill the form, or save the form as one ---------- */
  function bindTemplates(extras, getPrio, setPrio) {
    let list = [];
    const sel = $('fTpl'), del = $('fTplDel');
    HS.api('taskTemplates', {}, 20000).then(r => {
      if (!r || !r.ok || !$('fTpl')) return;
      list = r.templates;
      sel.innerHTML = `<option value="">${esc(t('tNoTemplate'))}</option>` + list.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    }).catch(() => {});
    sel.onchange = () => {
      const p = list.filter(q => q.id === sel.value)[0];
      del.hidden = !p;
      if (!p) return;
      $('fTitle').value = p.title; $('fDet').value = p.details || ''; setPrio(p.priority);
      $('fCat').value = p.category || ''; $('fNeedNote').checked = p.needNote; $('fNeedPhoto').checked = p.needPhoto; $('fNeedAp').checked = p.needApproval;
    };
    $('fTplSave').onclick = async () => {
      const title = $('fTitle').value.trim();
      if (!title) { $('fMsg').textContent = t('fTitle') + ' *'; return; }
      const name = (window.prompt ? window.prompt(t('tTplName'), (list.filter(q => q.id === sel.value)[0] || {}).name || title) : title) || '';
      if (!name.trim()) return;
      try {
        const cur = list.filter(q => q.id === sel.value && q.name === name.trim())[0];
        const r = await HS.api('taskTemplateSave', { template: Object.assign({ id: cur ? cur.id : '', name: name.trim(), title, details: $('fDet').value.trim(), priority: getPrio() }, extras()) }, 30000);
        if (!r || !r.ok) { $('fMsg').textContent = trErr(r && r.error) || t('needOnline'); return; }
        list = list.filter(q => q.id !== r.template.id).concat(r.template);
        sel.innerHTML = `<option value="">${esc(t('tNoTemplate'))}</option>` + list.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
        sel.value = r.template.id; del.hidden = false; toast(t('tTplSaved'));
      } catch (e) { $('fMsg').textContent = e.auth ? t('sessionExpired') : t('needOnline'); }
    };
    del.onclick = async () => {
      if (!sel.value) return;
      try {
        const r = await HS.api('taskTemplateSave', { template: { id: sel.value, remove: true } }, 30000);
        if (!r || !r.ok) { $('fMsg').textContent = trErr(r && r.error) || t('needOnline'); return; }
        list = list.filter(q => q.id !== sel.value);
        sel.innerHTML = `<option value="">${esc(t('tNoTemplate'))}</option>` + list.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
        del.hidden = true; toast(t('tTplDeleted'));
      } catch (e) { $('fMsg').textContent = e.auth ? t('sessionExpired') : t('needOnline'); }
    };
  }


  /* ---------- meters (asset page): Running hours drives hour-based repeats; any other meter is a plain record ---------- */
  let mtKey = '', mtData = null, mtErr = '';
  function ensureMeter(e) {
    if (!e || !e.no || !canEq()) return;
    const k = eqKey(e);
    if (mtKey === k) return;
    mtKey = k; mtData = null; mtErr = '';
    HS.api('meterList', { no: e.no }, 30000).then(r => {
      if (mtKey !== k) return;
      if (r && r.ok) mtData = r; else mtErr = trErr(r && r.error);
    }).catch(err => { if (mtKey === k) mtErr = err.message || ''; if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { if (!$('dash').classList.contains('hidden') && eqSel && eqKey(eqSel) === k) render(); });
  }
  const mtUnit = r => r.unit ? ' ' + r.unit : '';
  function meterCard(e) {
    if (!e.no || !canEq()) return '';
    const list = mtData ? mtData.readings : [], meters = mtData ? mtData.meters : [];
    const rows = list.slice(0, 6).map(r => `<tr><td>${esc(fmtStamp(r.at))}</td><td>${esc(r.meter === 'Running hours' ? t('mtHoursName') : r.meter)}</td><td class="num">${esc(r.reading)}${esc(mtUnit(r))}</td><td>${esc(nameOf(r.by))}</td><td>${esc(r.note || '')}</td></tr>`).join('');
    const tiles = meters.map(m => `<div class="kpi"><small>${esc(m.name === 'Running hours' ? t('mtHoursName') : m.name)}</small><b>${esc(m.latest)}<span class="ltr">${esc(mtUnit(m))}</span></b><span>${esc(fmtStamp(m.at))}</span></div>`).join('');
    return `<section class="dcard" id="mtCard"><h4>${esc(t('mtTitle'))}<span>${mtData && mtData.latest != null ? esc(t('mtHoursName')) + ' ' + esc(mtData.latest) + ' h' : ''}</span></h4>
      ${mtData === null ? `<div class="dempty">${esc(mtErr || t('pmLoading'))}</div>`
        : list.length ? `${tiles ? `<div class="kpis">${tiles}</div>` : ''}<div class="tscroll"><table class="dtable"><thead><tr><th>${esc(t('mtHist'))}</th><th>${esc(t('mtPick'))}</th><th class="num">${esc(t('mtReading'))}</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<div class="dempty">${esc(t('mtNone'))}</div>`}
      <div class="dact"><button type="button" class="btn pri" data-mtadd>${esc(t('mtAdd'))}</button></div></section>`;
  }
  function meterForm(e) {
    const known = [];
    ((mtData && mtData.meters) || []).forEach(m => { if (m.name !== 'Running hours') known.push(m); });
    const opts = [`<option value="Running hours">${esc(t('mtHoursName'))}</option>`].concat(known.map(m => `<option value="${esc(m.name)}" data-u="${esc(m.unit)}">${esc(m.name)}${m.unit ? ' (' + esc(m.unit) + ')' : ''}</option>`),
      [`<option value="__new">${esc(t('mtNew'))}</option>`]).join('');
    showModal(`<h2>${esc(t('mtTitle'))} · ${esc(e.name)}</h2>
      <form class="tform" id="mtF" autocomplete="off">
        <label for="mtS">${esc(t('mtPick'))}</label><select class="ffield" id="mtS">${opts}</select>
        <div id="mtNew" hidden><div class="row2"><div><label for="mtNm">${esc(t('mtNameNew'))} *</label><input class="ffield" id="mtNm" dir="auto" maxlength="40"></div>
          <div><label for="mtUn">${esc(t('mtUnitLbl'))}</label><input class="ffield" id="mtUn" dir="auto" maxlength="12" placeholder="${esc(t('mtUnitPh'))}"></div></div></div>
        <label for="mtV" id="mtVL">${esc(t('mtHours'))} *</label>
        <input class="ffield" id="mtV" type="number" inputmode="decimal" min="0" step="any" required dir="ltr">
        <div id="mtRW"><label class="chkrow"><input type="checkbox" id="mtR"><span>${esc(t('mtReplaced'))}</span></label></div>
        <label for="mtN">${esc(t('mtNote'))}</label><input class="ffield" id="mtN" dir="auto" maxlength="200">
        <div class="msg" id="mtMsg" role="alert"></div>
        <button class="primary" type="submit" id="mtGo">${esc(t('mtSave'))}</button>
      </form>`, '');
    setTimeout(() => $('mtV').focus(), 60);
    const sel = $('mtS');
    const sync = () => {
      const hours = sel.value === 'Running hours', isNew = sel.value === '__new';
      $('mtNew').hidden = !isNew; $('mtRW').hidden = !hours;
      $('mtVL').textContent = (hours ? t('mtHours') : t('mtReading')) + ' *';
      if (!hours && !isNew) { const o = sel.options[sel.selectedIndex]; $('mtVL').textContent = t('mtReading') + (o.dataset.u ? ' (' + o.dataset.u + ')' : '') + ' *'; }
    };
    sel.onchange = sync; sync();
    $('mtF').onsubmit = async ev => {
      ev.preventDefault(); $('mtMsg').textContent = '';
      let name = sel.value, unit = '';
      if (name === '__new') { name = $('mtNm').value.trim(); unit = $('mtUn').value.trim(); if (!name) { $('mtMsg').textContent = t('mtNeedName'); return; } }
      else if (name !== 'Running hours') unit = sel.options[sel.selectedIndex].dataset.u || '';
      $('mtGo').disabled = true;
      try {
        const r = await HS.api('meterAdd', { meter: { no: e.no, name: name, unit: unit, reading: $('mtV').value, replaced: $('mtR').checked, note: $('mtN').value.trim() } }, 30000);
        if (!r || !r.ok) { $('mtMsg').textContent = trErr(r && r.error) || t('needOnline'); $('mtGo').disabled = false; return; }
        hideModal(); toast(t('mtSaved')); mtKey = ''; render();
      } catch (err) { $('mtMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('mtGo').disabled = false; }
    };
  }

  /* ---------- downtime: an asset goes offline and comes back online ---------- */
  let dtKey = '', dtData = null, dtErr = '';
  function ensureDowntime(e) {
    if (!e || !e.no || !canEq()) return;
    const k = eqKey(e);
    if (dtKey === k) return;
    dtKey = k; dtData = null; dtErr = '';
    HS.api('downtimeList', { no: e.no }, 30000).then(r => {
      if (dtKey !== k) return;
      if (r && r.ok) dtData = r; else dtErr = trErr(r && r.error);
    }).catch(err => { if (dtKey === k) dtErr = err.message || ''; if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { if (!$('dash').classList.contains('hidden') && eqSel && eqKey(eqSel) === k) render(); });
  }
  const minsText = m => { m = Math.max(0, Math.round(Number(m) || 0)); return m < 60 ? t('dtMin', { n: m }) : t('dtHrs', { h: Math.floor(m / 60), m: m % 60 }); };
  const dtLabel = d => d.type === 'Planned' ? t('dtPlanned') : t('dtUnplanned');
  I18N.en.dtMin = '{n} min'; I18N.en.dtHrs = '{h} h {m} min';
  function statusCard(e) {
    if (!e.no) return `<section class="dcard"><p class="hint" style="margin:0">${esc(t('dtNoNo'))}</p></section>`;
    const open = dtData && dtData.open, ready = dtData !== null;
    const state = !ready ? '' : open
      ? `<span>${esc(t('dtOffline'))}</span><small>${esc(t('dtSince', { t: fmtStamp(open.started) }))} · ${esc(dtLabel(open))} · ${esc(open.cause)} · ${esc(minsText(open.minutes))}</small>`
      : `<span>${esc(t('dtOnline'))}</span>`;
    return `<section class="dcard stbar ${open ? 'off' : ''}"><div class="big"><i class="dotx"></i>${ready ? state : `<span>${esc(dtErr || t('pmLoading'))}</span>`}</div>
      <div class="btns"><button type="button" class="btn" data-qr>${esc(t('qrBtn'))}</button>${isMgr() ? `<button type="button" class="btn" data-qrf>${esc(t('qrFaultBtn'))}</button>` : ''}
      ${ready ? `<button type="button" class="btn ${open ? 'pri' : ''}" data-dtgo>${esc(t(open ? 'dtGoOnline' : 'dtGoOffline'))}</button>` : ''}</div></section>`;
  }
  function downtimeCard(e) {
    if (!e.no || !canEq()) return '';
    if (dtData === null) return `<section class="dcard"><h4>${esc(t('dtTitle'))}</h4><div class="dempty">${esc(dtErr || t('pmLoading'))}</div></section>`;
    const s = dtData.summary, list = dtData.entries;
    if (!list.length) return `<section class="dcard"><h4>${esc(t('dtTitle'))}</h4><div class="dempty">${esc(t('dtNone'))}</div></section>`;
    const top = s.byCause.length ? s.byCause[0].minutes || 1 : 1;
    const bars = s.byCause.map(c => `<div class="cbar"><div>${esc(c.cause)}<div class="hb"><i style="width:${Math.max(3, Math.round(c.minutes / top * 100))}%"></i></div></div><span>${esc(minsText(c.minutes))} · ${c.count}×</span></div>`).join('');
    const rows = list.slice(0, 8).map(d => `<tr><td>${esc(fmtStamp(d.started))}</td><td>${d.open ? `<b>${esc(t('dtStill'))}</b>` : esc(fmtStamp(d.ended))}</td><td class="num">${esc(minsText(d.minutes))}</td>
      <td>${esc(dtLabel(d))}</td><td>${esc(d.cause)}${d.note ? `<small>${esc(d.note)}</small>` : ''}</td><td>${esc(d.order || '—')}</td></tr>`).join('');
    return `<section class="dcard"><h4>${esc(t('dtTitle'))}<span>${esc(t('dtSum'))}</span></h4>
      <div class="kpis"><div class="kpi"><small>${esc(t('dtSumCount'))}</small><b>${s.count}</b></div><div class="kpi"><small>${esc(t('dtSumTotal'))}</small><b style="font-size:20px">${esc(minsText(s.minutes))}</b></div>
        <div class="kpi"><small>${esc(t('dtSumUnp'))}</small><b style="font-size:20px">${esc(minsText(s.unplanned))}</b></div><div class="kpi"><small>${esc(t('dtSumAvg'))}</small><b style="font-size:20px">${s.avgRepair ? esc(minsText(s.avgRepair)) : '—'}</b></div></div>
      ${bars ? `<h4 style="margin-top:6px">${esc(t('dtByCause'))}</h4>${bars}` : ''}
      <h4 style="margin-top:14px">${esc(t('dtHist'))}</h4><div class="tscroll"><table class="dtable"><thead><tr><th>${esc(t('dtStarted'))}</th><th>${esc(t('dtEnded'))}</th><th class="num">${esc(t('dtLength'))}</th><th>${esc(t('dtType'))}</th><th>${esc(t('dtCause'))}</th><th>${esc(t('hJob'))}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  /** Form to mark an asset offline (start) or back online (end). `orders` are the work orders that can be linked. */
  async function downtimeForm(asset, mode, orders, after) {
    let causes = [];
    if (mode === 'start') {
      try { const r = await HS.api('causes', {}, 30000); causes = (r && r.ok && r.causes) || []; }
      catch (err) { toast(err.auth ? t('sessionExpired') : t('needOnline')); return; }
    }
    showModal(`<h2>${esc(t(mode === 'start' ? 'dtGoOffline' : 'dtGoOnline'))} · ${esc(asset.name)}</h2>
      <form class="tform" id="dtF" autocomplete="off">
        ${mode === 'start' ? `<label>${esc(t('dtType'))}</label>
          <div class="segctl" id="dtT"><button type="button" data-v="Unplanned" class="on">${esc(t('dtUnplanned'))}</button><button type="button" data-v="Planned">${esc(t('dtPlanned'))}</button></div>
          <label for="dtC" style="margin-top:12px">${esc(t('dtCause'))} *</label>
          <select class="ffield" id="dtC"><option value="">${esc(t('fChoose'))}</option>${causes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>` : ''}
        <label for="dtN">${esc(t(mode === 'start' ? 'dtNote' : 'dtNoteOn'))}</label><textarea class="ffield" id="dtN" dir="auto" maxlength="300"></textarea>
        <label for="dtO">${esc(t('dtOrder'))}</label>
        <select class="ffield" id="dtO"><option value="">${esc(t('dtNoOrder'))}</option>${(orders || []).map(o => `<option value="${esc(o.id)}">${esc(o.id + ' · ' + o.title)}</option>`).join('')}</select>
        <div class="msg" id="dtMsg" role="alert"></div>
        <button class="primary" type="submit" id="dtGo">${esc(t(mode === 'start' ? 'dtGoOffline' : 'dtGoOnline'))}</button>
      </form>`, '');
    let type = 'Unplanned';
    const seg = $('dtT');
    if (seg) seg.querySelectorAll('button').forEach(b => b.onclick = () => { type = b.dataset.v; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
    $('dtF').onsubmit = async ev => {
      ev.preventDefault(); $('dtMsg').textContent = '';
      const cause = mode === 'start' ? $('dtC').value : '';
      if (mode === 'start' && type === 'Unplanned' && !cause) { $('dtMsg').textContent = t('dtChooseCause'); return; }
      $('dtGo').disabled = true;
      try {
        const r = await HS.api(mode === 'start' ? 'downtimeStart' : 'downtimeEnd', { downtime: { no: asset.no, type: type, cause: cause, note: $('dtN').value.trim(), order: $('dtO').value } }, 30000);
        if (!r || !r.ok) { $('dtMsg').textContent = trErr(r && r.error) || t('needOnline'); $('dtGo').disabled = false; return; }
        hideModal(); toast(mode === 'start' ? t('dtSavedOff') : t('dtSavedOn', { m: minsText(r.minutes) }));
        if (after) after();
      } catch (err) { $('dtMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('dtGo').disabled = false; }
    };
  }
  /** Supervisor: the list of causes people choose from. */
  async function causesForm() {
    showModal(`<h2>${esc(t('causeTitle'))}</h2><p class="hint">${esc(t('causeHint'))}</p><div id="cuBody"><div class="dempty">${esc(t('pmLoading'))}</div></div>`, '');
    let r;
    try { r = await HS.api('causes', {}, 30000); } catch (err) { hideModal(); toast(err.auth ? t('sessionExpired') : t('needOnline')); return; }
    if (!r || !r.ok) { hideModal(); toast(trErr(r && r.error) || t('needOnline')); return; }
    const rows = (r.all || []).map(x => ({ name: x.name, active: x.active }));
    const draw = () => {
      const box = $('cuBody'); if (!box) return;
      box.innerHTML = rows.map((x, i) => `<div class="causerow"><input class="ffield" data-cn="${i}" value="${esc(x.name)}" maxlength="60" dir="auto" aria-label="${esc(t('dtCause'))}">
        <label class="chk"><input type="checkbox" data-ca="${i}" ${x.active ? 'checked' : ''}> ${esc(t('causeActive'))}</label></div>`).join('')
        + `<div class="msg" id="cuMsg" role="alert"></div><div class="dact"><button type="button" class="btn" id="cuAdd">${esc(t('causeAdd'))}</button><button type="button" class="btn pri" id="cuSave">${esc(t('causeSave'))}</button></div>`;
      box.querySelectorAll('[data-cn]').forEach(i => i.oninput = () => { rows[+i.dataset.cn].name = i.value; });
      box.querySelectorAll('[data-ca]').forEach(i => i.onchange = () => { rows[+i.dataset.ca].active = i.checked; });
      $('cuAdd').onclick = () => { rows.push({ name: '', active: true }); draw(); const f = box.querySelectorAll('[data-cn]'); f[f.length - 1].focus(); };
      $('cuSave').onclick = async () => {
        $('cuSave').disabled = true; $('cuMsg').textContent = '';
        try {
          const rr = await HS.api('causesSave', { causes: rows }, 30000);
          if (!rr || !rr.ok) { $('cuMsg').textContent = trErr(rr && rr.error) || t('needOnline'); $('cuSave').disabled = false; return; }
          hideModal(); toast(t('saved'));
        } catch (err) { $('cuMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('cuSave').disabled = false; }
      };
    };
    draw();
  }

  /* ---------- QR labels, scanning and links (#asset=NO, #part=m:NO) ---------- */
  let qrReady = null;
  function loadQr() {
    if (window.HoloulQR) return Promise.resolve();
    if (!qrReady) qrReady = new Promise((res, rej) => {
      const sc = document.createElement('script'); sc.src = 'qr.js?v=19';
      sc.onload = res; sc.onerror = () => { qrReady = null; rej(new Error('qr')); };
      document.head.appendChild(sc);
    });
    return qrReady;
  }
  const baseUrl = () => location.origin + location.pathname;
  const assetUrl = no => baseUrl() + '#asset=' + encodeURIComponent(no);
  const faultUrl = no => baseUrl() + '#report=' + encodeURIComponent(no);
  const partUrl = p => baseUrl() + '#part=' + (p.kind === 'mechanical' ? 'm' : 'e') + ':' + encodeURIComponent(p.no);
  const partItem = p => ({ title: p.kind === 'mechanical' ? (p.name || p.no) : (p.desc || p.no), sub: [p.no, p.kind === 'mechanical' ? p.machine : p.brand].filter(Boolean).join(' · '), url: partUrl(p), hint: t('qrPartHint') });
  async function qrModal(item) {
    if (!item.url || /#asset=$/.test(item.url)) { toast(t('qrNone')); return; }
    try { await loadQr(); } catch (err) { toast(t('needOnline')); return; }
    showModal(`<h2>${esc(t('qrTitle'))}</h2><div class="qrbox" id="qrBox">${window.HoloulQR.svg(item.url, 260)}<b>${esc(item.title)}</b><span class="mini">${esc(item.sub)}</span>
      <span class="url">${esc(item.url)}</span><p class="hint">${esc(item.hint || '')}</p></div>
      <div class="dact"><button type="button" class="btn" id="qrCopy">${esc(t('qrCopy'))}</button><button type="button" class="btn pri" id="qrPrint">${esc(t('qrPrint'))}</button></div>`, '');
    $('qrPrint').onclick = () => printLabels([item]);
    $('qrCopy').onclick = () => { try { navigator.clipboard.writeText(item.url).then(() => toast(t('qrCopied')), () => {}); } catch (err) {} };
  }
  /** Prints labels on the page itself: the print style shows only #printLabels. */
  function printLabels(items) {
    loadQr().then(() => {
      let box = $('printLabels');
      if (!box) { box = document.createElement('div'); box.id = 'printLabels'; document.body.appendChild(box); }
      box.innerHTML = items.map(i => `<div class="plabel">${window.HoloulQR.svg(i.url, 200)}<b>${esc(i.title)}</b><small>${esc(i.sub)}</small></div>`).join('');
      document.body.classList.add('printing');
      const end = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', end); };
      window.addEventListener('afterprint', end);
      setTimeout(end, 120000);
      setTimeout(() => window.print(), 60);
    }).catch(() => toast(t('needOnline')));
  }
  function scanForm() {
    const cam = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    showModal(`<h2>${esc(t('scanTitle'))}</h2>
      ${cam ? `<video class="scanv" id="scV" playsinline muted></video><p class="hint">${esc(t('scanHint'))}</p>` : `<p class="hint">${esc(t('scanNone'))}</p>`}
      <label for="scN">${esc(t('scanType'))}</label><input class="ffield" id="scN" dir="ltr" maxlength="60" autocomplete="off">
      <div class="msg" id="scMsg" role="alert"></div><button class="primary" type="button" id="scGo">${esc(t('scanOpen'))}</button>`, '');
    let stream = null, stop = false;
    const done = () => { stop = true; if (stream) stream.getTracks().forEach(x => x.stop()); };
    const mo = new MutationObserver(() => { if (!$('taskModal').classList.contains('open')) { done(); mo.disconnect(); } });
    mo.observe($('taskModal'), { attributes: true, attributeFilter: ['class'] });
    const go = () => { const v = $('scN').value.trim(); if (!v) return; done(); hideModal(); openAsset(v); };
    $('scGo').onclick = go;
    $('scN').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } };
    if (!cam) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
      if (stop) { s.getTracks().forEach(x => x.stop()); return; }
      stream = s; const v = $('scV'); v.srcObject = s; v.play().catch(() => {});
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (stop) return;
        try {
          const c = await det.detect(v);
          if (c.length) { const raw = String(c[0].rawValue || ''), i = raw.indexOf('#'); if (i >= 0 && /^#(asset|part|report)=/.test(raw.slice(i))) { done(); hideModal(); link(raw.slice(i)); return; } }
        } catch (err) {}
        setTimeout(tick, 300);
      };
      tick();
    }).catch(() => { const m = $('scMsg'); if (m) m.textContent = t('scanDenied'); });
  }
  /** Opens what a QR code points to. Anybody signed in can see an asset card; the full pages need the matching right. */
  function link(h) {
    const m = String(h || '').match(/^#(asset|part|report)=(.+)$/);
    if (!m) return Promise.resolve(false);
    let val = m[2]; try { val = decodeURIComponent(val); } catch (err) {}
    return m[1] === 'asset' ? openAsset(val) : m[1] === 'report' ? openFault(val) : openPart(val);
  }
  /** A fault QR scanned by someone who is signed in: the request form, with the machine already filled in. */
  async function openFault(no) {
    let a = null;
    try { const r = await HS.api('assetsLookup', { q: no }, 20000); if (r && r.ok) a = (r.assets || []).filter(x => String(x.no).toLowerCase() === String(no).toLowerCase())[0] || null; } catch (err) {}
    return requestForm({ no: a ? a.no : no, name: a ? a.name : no });
  }
  async function openAsset(no) {
    if (!canEq()) return assetCardModal(no);
    pendingAsset = no; eqSel = null; eqQ = ''; eqLineF = ''; eqLocF = '';
    await open('equipment');
  }
  function applyPendingAsset() {
    if (!pendingAsset || !eqAll) return;
    const no = pendingAsset; pendingAsset = '';
    const e = eqAll.find(x => x.no === no && !x.deleted) || eqAll.find(x => x.no === no);
    if (!e) { toast(t('scanNotFound')); return; }
    eqSel = e; eqHistKey = ''; eqOpen = {}; armKey = ''; phState = { id: '', photos: null, err: '' }; mtKey = ''; dtKey = '';
  }
  async function openPart(val) {
    if (!canSp()) { toast(t('scanNoAccess')); return; }
    if (val === 'low') { pendingPart = null; spSel = null; spQ = ''; spLow = true; await open('spares'); return; }
    const m = val.match(/^([me]):(.+)$/);
    if (!m) { toast(t('scanPartNF')); return; }
    pendingPart = { kind: m[1] === 'm' ? 'mechanical' : 'electrical', no: m[2] }; spSel = null; spQ = '';
    await open('spares');
  }
  function applyPendingPart() {
    if (!pendingPart || !spData) return;
    const want = pendingPart; pendingPart = null;
    const p = (spData[want.kind] || []).find(x => x.no === want.no && !x.deleted) || (spData[want.kind] || []).find(x => x.no === want.no);
    if (!p) { toast(t('scanPartNF')); return; }
    spTab = want.kind; spSel = Object.assign({ kind: want.kind }, p); armKey = ''; phState = { id: '', photos: null, err: '' };
  }
  /** What anybody who scans an asset sees: its state, their own open work orders on it, and the offline / online button when they may use it. */
  async function assetCardModal(no) {
    showModal(`<div class="dempty">${esc(t('pmLoading'))}</div>`, '');
    let r;
    try { r = await HS.api('assetCard', { no: no }, 30000); } catch (err) { hideModal(); toast(err.auth ? t('sessionExpired') : t('needOnline')); return; }
    if (!r || !r.ok) { hideModal(); toast(/not found/i.test(r && r.error || '') ? t('scanNotFound') : (trErr(r && r.error) || t('needOnline'))); return; }
    const a = r.asset, off = r.offline;
    showModal(`<h2>${esc(a.name)}</h2>
      <p class="mini">${esc([a.no, a.line, a.loc].filter(Boolean).join(' · '))}</p>
      <div class="stbar ${off ? 'off' : ''}" style="margin:10px 0 14px"><div class="big"><i class="dotx"></i><span>${esc(t(off ? 'dtOffline' : 'dtOnline'))}</span>${off ? `<small>${esc(t('dtSince', { t: fmtStamp(off.since) }))} · ${esc(off.cause)}</small>` : ''}</div></div>
      <h4 style="margin-bottom:6px">${esc(t('cardOrders'))}</h4>
      ${r.orders.length ? r.orders.map(o => `<div class="rprow"><div><b>${esc(o.title)}</b><small>${esc(o.id)} · ${esc(t('status.' + o.status))}${o.due ? ' · ' + esc(shortDate(o.due)) : ''}</small></div></div>`).join('') : `<div class="mini">${esc(t('cardNoOrders'))}</div>`}
      <div class="dact">${r.canDowntime ? `<button type="button" class="btn ${off ? 'pri' : ''}" id="acDt">${esc(t(off ? 'dtGoOnline' : 'dtGoOffline'))}</button>` : ''}
      ${r.canOpen ? `<button type="button" class="btn" id="acOpen">${esc(t('cardOpenFull'))}</button>` : ''}</div>`, '');
    const dt = $('acDt');
    if (dt) dt.onclick = () => downtimeForm({ no: a.no, name: a.name }, off ? 'end' : 'start', r.orders.map(o => ({ id: o.id, title: o.title })), () => assetCardModal(no));
    const op = $('acOpen'); if (op) op.onclick = () => { hideModal(); openAsset(no); };
  }

  /* ---------- reading limits (supervisor): a reading outside its limit creates a work order ---------- */
  function openLimits() {
    showModal(`<h2>${esc(t('lmTitle'))}</h2><p class="hint">${esc(t('lmHint'))}</p><div id="lmBody"><div class="dempty">${esc(t('dLoading'))}</div></div>`, '');
    loadLimits();
  }
  function loadLimits() {
    HS.api('limits', {}, 30000).then(r => {
      const box = $('lmBody'); if (!box) return;
      if (!r || !r.ok) { box.innerHTML = `<div class="msg">${esc(trErr(r && r.error) || t('needOnline'))}</div>`; return; }
      const rows = r.limits.map(l => `<div class="rprow${l.active ? '' : ' off'}"><div><b>${esc(modName(l.page))} · ${esc(l.label || '#' + l.row)}</b>
        <small>${l.min !== '' ? esc(t('lmMin')) + ' ' + esc(l.min) + '  ' : ''}${l.max !== '' ? esc(t('lmMax')) + ' ' + esc(l.max) : ''} · ${esc(nameOf(l.assignee))}${l.active ? '' : ' · ' + esc(t('lmOff'))}</small></div>
        <button class="btn" type="button" data-lm="${esc(l.id)}">${esc(t('aEdit'))}</button></div>`).join('');
      box.innerHTML = (rows || `<div class="dempty">${esc(t('lmEmpty'))}</div>`) + `<div class="dact"><button type="button" class="btn pri" id="lmNew">${esc(t('lmAdd'))}</button></div>`;
      $('lmNew').onclick = () => limitForm(null, r);
      box.querySelectorAll('[data-lm]').forEach(b => b.onclick = () => limitForm(r.limits.filter(l => l.id === b.dataset.lm)[0], r));
    }).catch(err => { const box = $('lmBody'); if (box) box.innerHTML = `<div class="msg">${esc(err && err.auth ? t('sessionExpired') : t('needOnline'))}</div>`; });
  }
  function limitForm(l, ctx) {
    const pages = ['Amp Rec', 'Vibration Rec', 'Thermo Rec'];
    const people = ctx.assignable.map(p => `<option value="${esc(p.username)}" ${l && p.username === l.assignee ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    showModal(`<h2>${esc(t(l ? 'aEdit' : 'lmAdd'))} · ${esc(t('lmTitle'))}</h2>
      <form class="tform" id="lmF" autocomplete="off">
        <label for="lmP">${esc(t('lmPage'))}</label>
        <select class="ffield" id="lmP" ${l ? 'disabled' : ''}>${pages.map(p => `<option value="${esc(p)}" ${l && l.page === p ? 'selected' : ''}>${esc(modName(p))}</option>`).join('')}</select>
        <label for="lmR">${esc(t('lmRow'))}</label>
        <select class="ffield" id="lmRow" ${l ? 'disabled' : ''}><option value="">${esc(t('lmLoading'))}</option></select>
        <div class="row2"><div><label for="lmMin">${esc(t('lmMin'))}</label><input class="ffield" id="lmMin" type="number" inputmode="decimal" step="any" dir="ltr" value="${esc(l ? l.min : '')}"></div>
          <div><label for="lmMax">${esc(t('lmMax'))}</label><input class="ffield" id="lmMax" type="number" inputmode="decimal" step="any" dir="ltr" value="${esc(l ? l.max : '')}"></div></div>
        <label for="lmW">${esc(t('lmWho'))}</label><select class="ffield" id="lmW">${people}</select>
        <label>${esc(t('lmPrio'))}</label>
        <select class="ffield" id="lmPr">${['Low', 'Normal', 'High', 'Urgent'].map(p => `<option value="${p}" ${(l ? l.priority : 'High') === p ? 'selected' : ''}>${esc(t('prio.' + p))}</option>`).join('')}</select>
        <label class="chkrow"><input type="checkbox" id="lmA" ${!l || l.active ? 'checked' : ''}><span>${esc(t('lmActive'))}</span></label>
        <div class="msg" id="lmMsg" role="alert"></div>
        <button class="primary" type="submit" id="lmGo">${esc(t('lmSave'))}</button>
        ${l ? `<button class="dangerbtn" type="button" id="lmDel">${esc(t('lmDel'))}</button>` : ''}
      </form>`, '');
    let rowLabels = {};
    const loadRows = () => {
      const page = $('lmP').value, sel = $('lmRow');
      sel.innerHTML = `<option value="">${esc(t('lmLoading'))}</option>`;
      HS.api('getSheet', { sheet: page }, 30000).then(r => {
        if (!$('lmRow') || $('lmP').value !== page) return;
        rowLabels = {};
        const items = (r && r.rows || []).filter(x => !x.section);
        items.forEach(x => { rowLabels[x.row] = [x.id, x.desc, x.machine, x.part, x.position, x.name].filter(Boolean).join(' · ') || ('#' + x.row); });
        sel.innerHTML = `<option value="">${esc(t('lmChoose'))}</option>` + items.map(x => `<option value="${x.row}" ${l && l.row === x.row ? 'selected' : ''}>${esc(rowLabels[x.row])}</option>`).join('');
        if (l && !rowLabels[l.row]) sel.innerHTML += `<option value="${l.row}" selected>${esc(l.label || '#' + l.row)}</option>`;
      }).catch(() => { if ($('lmRow')) $('lmRow').innerHTML = `<option value="">${esc(t('needOnline'))}</option>`; });
    };
    $('lmP').onchange = loadRows; loadRows();
    const back = () => { openLimits(); };
    $('lmF').onsubmit = async ev => {
      ev.preventDefault(); $('lmGo').disabled = true; $('lmMsg').textContent = '';
      const row = l ? l.row : Number($('lmRow').value);
      try {
        const r = await HS.api('limitSave', { limit: { id: l ? l.id : '', page: l ? l.page : $('lmP').value, row: row, label: rowLabels[row] || (l && l.label) || '', min: $('lmMin').value, max: $('lmMax').value,
          assignee: $('lmW').value, priority: $('lmPr').value, active: $('lmA').checked } }, 30000);
        if (!r || !r.ok) { $('lmMsg').textContent = trErr(r && r.error) || t('needOnline'); $('lmGo').disabled = false; return; }
        toast(t('lmSaved')); back();
      } catch (err) { $('lmMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); $('lmGo').disabled = false; }
    };
    const del = $('lmDel');
    if (del) del.onclick = async () => {
      try { const r = await HS.api('limitSave', { limit: { id: l.id, remove: true } }, 30000); if (!r || !r.ok) { $('lmMsg').textContent = trErr(r && r.error) || t('needOnline'); return; } toast(t('lmDeleted')); back(); }
      catch (err) { $('lmMsg').textContent = err.auth ? t('sessionExpired') : t('needOnline'); }
    };
  }

  /* ---------- preventive maintenance: calendar + compliance ---------- */
  let pmMonth = null, pmCal = null, pmComp = null, pmErr = '', pmLoadKey = '';
  const thisMonth = () => new Date().toISOString().slice(0, 7);
  const shiftMonth = (m, d) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + d, 1)).toISOString().slice(0, 7); };
  function loadPm() {
    const m = pmMonth || (pmMonth = thisMonth()), k = m + '|' + Date.now();
    if (pmLoadKey && pmLoadKey.indexOf(m + '|') === 0) return;
    pmLoadKey = k; pmErr = '';
    Promise.all([HS.api('pmCalendar', { month: m }, 30000), HS.api('pmCompliance', { months: 6 }, 30000)]).then(([c, p]) => {
      if (pmMonth !== m) return;
      if (c && c.ok) pmCal = c; else pmErr = trErr(c && c.error);
      if (p && p.ok) pmComp = p; else if (!pmErr) pmErr = trErr(p && p.error);
    }).catch(err => { pmErr = err.auth ? t('sessionExpired') : t('needOnline'); if (err.auth) { authLost = true; syncUI(); } })
      .finally(() => { pmLoadKey = ''; if (section === 'pm' && !$('dash').classList.contains('hidden')) render(); });
  }
  function pmView() {
    if (!pmMonth) pmMonth = thisMonth();
    if (!pmCal && !pmErr) loadPm();
    const head = `<div class="msel"><button type="button" class="btn" data-pm="-1" aria-label="${esc(t('pmPrev'))}">${svg('back', 2.2)}</button>
      <button type="button" class="on" disabled>${esc(monthName(pmMonth))}</button><button type="button" class="btn" data-pm="1" aria-label="${esc(t('pmNext'))}" style="transform:scaleX(-1)">${svg('back', 2.2)}</button></div>`;
    if (pmErr) return head + `<div class="dempty">${esc(pmErr)}</div>`;
    if (!pmCal) return head + `<div class="dempty">${esc(t('pmLoading'))}</div>`;
    const [y, mo] = pmMonth.split('-').map(Number), first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay(), days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const byDay = {};
    pmCal.tasks.forEach(x => { (byDay[x.overdue && x.due.slice(0, 7) !== pmMonth ? pmCal.today : x.due] = byDay[x.overdue && x.due.slice(0, 7) !== pmMonth ? pmCal.today : x.due] || []).push(x); });
    pmCal.planned.forEach(x => { (byDay[x.date] = byDay[x.date] || []).push({ planned: true, title: x.title, equipment: x.equipment }); });
    const names = t('pmDays').split(',');
    let cells = names.map(n => `<div class="pmh">${esc(n)}</div>`).join('') + '<div class="pmc empty"></div>'.repeat(first);
    for (let d = 1; d <= days; d++) {
      const iso = pmMonth + '-' + String(d).padStart(2, '0'), items = byDay[iso] || [];
      cells += `<div class="pmc${iso === pmCal.today ? ' today' : ''}"><b>${d}</b>${items.map(x => x.planned
        ? `<div class="pmi plan" title="${esc(x.title)}">${esc(t('pmPlanned'))}: ${esc(x.title)}</div>`
        : `<button type="button" class="pmi ${x.status === 'Done' ? 'done' : x.overdue ? 'over' : ''}" data-tid="${esc(x.id)}" title="${esc(x.title)}">${esc(x.title)}</button>`).join('')}</div>`;
    }
    const cal = `<section class="dcard"><h4>${esc(t('pmTitle'))}<span>${pmCal.tasks.length}</span></h4>${pmCal.tasks.length || pmCal.planned.length ? '' : `<div class="dempty">${esc(t('pmNone'))}</div>`}<div class="pmgrid">${cells}</div></section>`;
    let comp = `<div class="dempty">${esc(t('pmLoading'))}</div>`;
    if (pmComp) {
      const row = (label, c) => `<tr><td><b>${esc(label)}</b></td><td class="num">${c.due}</td><td class="num">${c.onTime}</td><td class="num">${c.late}</td><td class="num">${c.overdue}</td><td class="num">${c.pending}</td><td class="num"><b>${c.pct == null ? '—' : c.pct + '%'}</b></td></tr>`;
      const th = (first) => `<thead><tr><th>${esc(first)}</th><th class="num">${esc(t('pmDue'))}</th><th class="num">${esc(t('pmOnTime'))}</th><th class="num">${esc(t('pmLate'))}</th><th class="num">${esc(t('pmOver'))}</th><th class="num">${esc(t('pmPending'))}</th><th class="num">${esc(t('pmPct'))}</th></tr></thead>`;
      comp = `<div class="tscroll"><table class="dtable">${th(t('pmMonth'))}<tbody>${pmComp.months.map(m => row(monthName(m.month), m)).join('')}</tbody></table></div>
        <h4 style="margin-top:14px">${esc(t('pmByEq'))}</h4>
        ${pmComp.equipment.length ? `<div class="tscroll"><table class="dtable">${th(t('dEqfName'))}<tbody>${pmComp.equipment.map(e => row(e.name, e)).join('')}</tbody></table></div>` : `<div class="dempty">${esc(t('noData'))}</div>`}`;
    }
    return head + cal + `<section class="dcard"><h4>${esc(t('pmCompTitle'))}</h4>${comp}</section>`;
  }
  function bindPm() {
    $('dash').querySelectorAll('[data-pm]').forEach(b => b.onclick = () => { pmMonth = shiftMonth(pmMonth || thisMonth(), Number(b.dataset.pm)); pmCal = null; render(); });
  }

  /* ---------- repeating tasks: the repeat section of the new-task form (supervisor only) ---------- */
  function taskRepeatBlock() {
    const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
    return `<div class="fgroup" id="tRep"><h4>${esc(t('aTitle'))}</h4>
      <p class="hint" style="margin:0 0 10px">${esc(t('aHint'))}</p>
      <label for="tAB">${esc(t('aRepeat'))}</label>
      <select class="ffield" id="tAB">${opt('', t('aNone'), true)}${opt('period', t('dAutoByPeriod'))}${opt('hours', t('dAutoByHours'))}</select>
      <div id="tAPw" hidden><label for="tAP">${esc(t('dAutoPeriod'))}</label>
        <select class="ffield" id="tAP">${AUTO_PERIODS.map(p => opt(p[0], t(p[1]), p[0] === 'Monthly')).join('')}</select></div>
      <div id="tAHw" hidden><label for="tAH">${esc(t('dAutoHours'))}</label>
        <input class="ffield" id="tAH" type="number" inputmode="numeric" min="1" max="100000" step="1">
        <p class="hint">${esc(t('aHoursHint'))}</p></div>
      <div id="tAWw" hidden><label>${esc(t('aWho'))}</label><div id="tAW"></div></div>
    </div>`;
  }
  /** Shows the people as a check list (one or more), and hides the single "Assign to" field while a repeat is set. */
  function bindTaskRepeat() {
    const basis = $('tAB'), single = $('fWhoW'), who = $('fWho');
    const people = assignees();
    $('tAW').innerHTML = people.length
      ? people.map(p => `<label class="chkrow"><input type="checkbox" value="${esc(p.username)}"><span>${esc(p.name)}<small>${esc(roleName(p.role))}</small></span></label>`).join('')
      : `<span class="mini">${esc(t('dAutoNoTechs'))}</span>`;
    basis.onchange = () => {
      const on = basis.value !== '';
      $('tAPw').hidden = basis.value !== 'period';
      $('tAHw').hidden = basis.value !== 'hours';
      $('tAWw').hidden = !on;
      single.hidden = on;
      who.required = !on;   // a hidden required field would block the form without a message
      if (on && who.value && !document.querySelector('#tAW input:checked')) {
        const cb = [...document.querySelectorAll('#tAW input')].filter(i => i.value === who.value)[0];
        if (cb) cb.checked = true;
      }
    };
  }
  function repeatPayload() {
    const basis = $('tAB') ? $('tAB').value : '';
    if (!basis) return null;
    return { basis: basis, period: $('tAP').value, hours: $('tAH').value,
             assignees: [...document.querySelectorAll('#tAW input:checked')].map(i => i.value) };
  }
  /** Text for a repeat, e.g. "شهرياً" or "500 h". */
  function repeatText(x) {
    if (x.repeatKind === 'Hours') return x.repeat;
    const p = AUTO_PERIODS.filter(q => q[0] === x.repeat)[0];
    return p ? t(p[1]) : x.repeat;
  }
  function repeatRow(x) {
    const eq = x.equipment ? esc(x.equipment + (x.equipmentNo && x.equipmentNo !== x.equipment ? ' (' + x.equipmentNo + ')' : '')) : '';
    return `<div class="rprow${x.active ? '' : ' off'}">
      <div><b>${esc(x.title)}</b>${eq ? `<small>${eq}</small>` : ''}
        <small>${esc(t('aTo'))}: ${esc(x.assignees.join(', ') || '—')}</small>
        <small>${esc(repeatText(x))} · ${esc(t('aLast'))}: ${esc(x.started || '—')} · ${esc(t('aOpen'))}: ${x.openCount}</small></div>
      <button class="btn" type="button" data-rule="${esc(x.id)}" data-on="${x.active ? '0' : '1'}">${esc(t(x.active ? 'aStop' : 'aResume'))}</button>
    </div>`;
  }
  function openRepeats() {
    showModal(`<h2>${esc(t('aList'))}</h2><div id="rpBody"><div class="dempty">${esc(t('dLoading'))}</div></div>`, '');
    loadRepeats();
  }
  function loadRepeats() {
    HS.api('taskRules', {}, 30000).then(r => {
      const box = $('rpBody'); if (!box) return;
      if (!r || !r.ok) { box.innerHTML = `<div class="msg">${esc(trErr(r && r.error) || t('needOnline'))}</div>`; return; }
      box.innerHTML = r.rules.length ? r.rules.map(repeatRow).join('') : `<div class="dempty">${esc(t('aEmpty'))}</div>`;
      box.querySelectorAll('[data-rule]').forEach(b => b.onclick = () => setRepeat(b.dataset.rule, b.dataset.on === '1'));
    }).catch(err => {
      const box = $('rpBody'); if (box) box.innerHTML = `<div class="msg">${esc(err && err.auth ? t('sessionExpired') : t('needOnline'))}</div>`;
    });
  }
  function setRepeat(id, on) {
    HS.api('taskRuleStatus', { id: id, active: on }, 30000).then(r => {
      if (!r || !r.ok) { toast(trErr(r && r.error) || t('needOnline')); return; }
      loadRepeats();
    }).catch(() => toast(t('needOnline')));
  }

  /* ---------- equipment picker (from "Equipments and system in Holoul factory") ---------- */
  function equipPicker(x) {
    const eq = eqActive();
    const has = !!(x && x.equipment);
    const locs = [...new Set(eq.map(e => e.loc).filter(Boolean))];
    return `<div class="eqsel ${has ? '' : 'hidden'}" id="eqSel"><div class="eqtxt"><b id="eqSelName"></b><small id="eqSelMeta"></small></div>
        <button type="button" class="btn" id="eqChange">${esc(t('eqChange'))}</button></div>
      <div class="${has ? 'hidden' : ''}" id="eqFind">
        ${eq.length ? `<div class="row2"><select class="ffield" id="eqLoc"><option value="">${esc(t('eqAllLoc'))}</option>${locs.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('')}</select>
          <select class="ffield" id="eqLine"></select></div>` : ''}
        ${eqErr ? `<div class="dnote">${esc(t('eqListErr', { e: eqErr }))}</div>` : ''}
        <input class="ffield" id="fEq" dir="auto" autocomplete="off" placeholder="${esc(t(eq.length ? 'eqSearch' : 'fEquipPh'))}">
        <div class="eqlist" id="eqList" role="listbox"></div>
      </div>`;
  }
  /** Wires the picker; returns a function giving { equipment, equipmentNo, line, location } for the form. */
  function wirePicker(x) {
    const eq = eqActive();
    let pick = x && x.equipment ? { name: x.equipment, no: x.equipmentNo || '', line: x.line || '', loc: x.location || '' } : null;
    const meta = e => [e.no, e.line, e.loc, e.cat].filter(Boolean).join(' · ');
    const showPick = () => {
      $('eqSel').classList.toggle('hidden', !pick); $('eqFind').classList.toggle('hidden', !!pick);
      if (pick) { $('eqSelName').textContent = pick.name; $('eqSelMeta').textContent = meta(pick); }
    };
    const fillLines = () => {
      if (!$('eqLine')) return;
      const loc = $('eqLoc').value, cur = $('eqLine').value;
      const lines = [...new Set(eq.filter(e => !loc || e.loc === loc).map(e => e.line).filter(Boolean))];
      $('eqLine').innerHTML = `<option value="">${esc(t('eqAllLine'))}</option>` + lines.map(l => `<option value="${esc(l)}" ${l === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
    };
    let shown = [];
    const list = () => {
      const qq = $('fEq').value.trim().toLowerCase();
      const loc = $('eqLoc') ? $('eqLoc').value : '', line = $('eqLine') ? $('eqLine').value : '';
      const words = qq.split(/\s+/).filter(Boolean);
      shown = eq.filter(e => (!loc || e.loc === loc) && (!line || e.line === line) &&
        words.every(w => [e.name, e.no, e.line, e.loc, e.cat].join(' ').toLowerCase().indexOf(w) >= 0));
      if (!eq.length) { $('eqList').innerHTML = ''; return; }
      const max = 60;
      let html = '', grp = null;
      shown.slice(0, max).forEach((e, i) => {
        const g = e.line + (e.loc ? ' · ' + e.loc : '');
        if (g !== grp) { grp = g; html += `<div class="eqgrp">${esc(g)}</div>`; }
        html += `<button type="button" class="eqitem${i === 0 && qq ? ' first' : ''}" data-i="${i}" role="option"><b>${esc(e.name)}</b>${e.no && e.no !== e.name ? `<span class="eqno">${esc(e.no)}</span>` : ''}${e.cat ? `<small>${esc(e.cat)}</small>` : ''}</button>`;
      });
      if (shown.length > max) html += `<div class="eqnote">${esc(t('eqMore', { n: shown.length - max }))}</div>`;
      if (!shown.length && qq) html = `<div class="eqnote">${esc(t('eqFree', { q: $('fEq').value.trim() }))}</div>`;
      $('eqList').innerHTML = html;
      $('eqList').querySelectorAll('[data-i]').forEach(b => b.onclick = () => choose(shown[+b.dataset.i]));
    };
    const choose = e => { pick = e; showPick(); };
    $('eqChange').onclick = () => { pick = null; showPick(); list(); setTimeout(() => $('fEq').focus(), 30); };
    if ($('eqLoc')) { $('eqLoc').onchange = () => { fillLines(); list(); }; $('eqLine').onchange = list; fillLines(); }
    $('fEq').oninput = list;
    $('fEq').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); if (shown.length && $('fEq').value.trim()) choose(shown[0]); } };
    showPick(); list();
    return () => pick ? { equipment: pick.name, equipmentNo: pick.no || '', line: pick.line || '', location: pick.loc || '' }
                      : { equipment: $('fEq').value.trim(), equipmentNo: '', line: '', location: '' };
  }

  window.HoloulDash = {
    open,
    link,
    taskParts: (id, back) => taskPartsModal(id, back || null),
    comments: (id, back) => commentsModal(id, back || null),
    requestForm: requestForm,
    markup: markup,
    signature: signature,
    procedurePicker: procedurePicker,
    runForTask: runForTask,
    runProcedure: runProcedure,
    audit: auditView,
    refresh: refreshCurrent,
    render: () => { if (!$('dash').classList.contains('hidden')) render(); },
    reset: () => {
      data = null; clearInterval(timer); section = 'overview'; who = ''; q = ''; pendingNew = false;
      eqSel = null; eqHistKey = ''; eqAll = null; eqErr = ''; eqShowDel = false; armKey = '';
      rpData = null; rpErr = ''; rqData = null; rqErr = ''; scData = null; scErr = ''; scFrom = ''; scSel = ''; coData = null; coErr = ''; prcData = null; prcRuns = null; prcErr = ''; puData = null; puErr = ''; spData = null; spErr = ''; spSel = null; spStock = {}; spLowKeys = []; spVendors = []; pinfo = null; pinfoKey = ''; spShowDel = false; eqOffline = {}; dtData = null; dtKey = ''; pendingAsset = ''; pendingPart = null;
      teamData = null; teamErr = ''; peopleList = null; phState = { id: '', photos: null, err: '' };
    }
  };
})();
