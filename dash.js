/* Holoul Maintenance — dashboard for the Supervisor / Operations Manager.
 * Computer: sidebar + wide layout. Phone: same sections as tabs.
 * Uses helpers from index.html (t, esc, HS, session, showView, toast, ...). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);

  Object.assign(I18N.en, {
    dOverview:'Overview', dTasks:'Tasks', dTeam:'Team', dMonthly:'Monthly summary', dPages:'Reading pages',
    dUpdated:'Updated {t}', dRefresh:'Refresh', dNewTask:'New task', dBackApp:'App', dLoading:'Loading the dashboard…',
    kOpen:'Not started', kProg:'In progress', kOverdue:'Overdue', kDoneWeek:'Done this week', kReadings:'Reading pages done today',
    kChecks:'Daily checks today', kFaults:'{n} with faults', kOf:'of {n}',
    cReadings:"Today's readings", cChecks:'Daily checks today', cAttention:'Needs attention', cFaults:'Faults — last 14 days',
    completedByAt:'Completed by {by} at {at}', notCompleted:'Not completed yet', checkedBy:'Filled by {n}', noData:'Nothing here',
    chkOK:'OK', chkNot:'Not checked yet', fAll:'Everyone', fSearch:'Search tasks…',
    colOpen:'Not started', colProg:'In progress', colDone:'Done — last 14 days',
    tName:'Name', tRole:'Role', tOpen:'Not started', tProg:'In progress', tOver:'Overdue', tDoneW:'Done (week)', tDoneM:'Done (month)',
    tReadM:'Reading pages (month)', tChkM:'Checks (month)', tTotM:'Total (month)',
    mCreated:'Tasks created', mDone:'Tasks done', mOnTime:'Done on time', mAvg:'Average time to finish', mHours:'{n} h',
    mReadings:'Reading pages completed', mChecks:'Daily checks', mFaults:'Faults reported', mPerEmp:'Per employee — {m}',
    mAssigned:'Tasks assigned', mTotal:'Total achievements', mHistory:'Last 12 months', mMonth:'Month',
    fTitle:'Task', fTitlePh:'e.g. Replace the belt on conveyor BC-16', fAssignee:'Assign to', fPriority:'Priority', fDue:'Due date',
    fEquip:'Equipment', fEquipPh:'e.g. Conveyor BC-16', fLink:'Open a page (optional)', fNone:'None', fDetails:'Details',
    fCreate:'Assign task', fSave:'Save changes', fNewTitle:'New task', fEditTitle:'Edit task', fChoose:'Choose…',
    aEdit:'Edit', aReassign:'Reassign', aCancel:'Cancel task', aCancelSure:'Tap again to cancel this task', aReopen:'Reopen', aSave:'Save',
    assignedTo:'Assigned to', createdBy:'Created by', doneNoteLabel:'Note',
    sentOk:'Assigned to {n} — notification sent', sentNoPhone:'Assigned to {n} — their notifications are not on yet; they will see it in the app',
    saved:'Saved', needOnline:'Needs internet', dashLoadErr:'Could not refresh — showing the last saved copy', dashEmpty:'No data yet — connect to the internet',
    eqSearch:'Search by name or number — e.g. CV16, MPR120, Shutter', eqAllLoc:'All locations', eqAllLine:'All lines / systems', eqChange:'Change',
    eqFree:'Not in the list — will be saved as typed: {q}', eqMore:'{n} more — type to narrow the list', eqListErr:'Equipment list could not be read: {e}', fLineAll:'All lines'
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
  .dtop{display:none}
  .dhead{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
  .dhead h1{font-size:24px;line-height:1.2} .dhead small{color:var(--muted);font-size:13px;display:block;margin-top:4px}
  .dtools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .btn{height:40px;border-radius:11px;border:1px solid var(--line);background:var(--panel);color:var(--text);font-weight:600;font-size:14px;padding:0 14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:var(--shadow)}
  .btn svg{width:17px;height:17px;stroke:currentColor}
  .btn.pri{background:var(--brand);border-color:var(--brand);color:#fff}
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
  .tform .primary{margin-top:6px}
  .dangerbtn{height:44px;border-radius:12px;border:1px solid var(--bad-line);background:var(--bad-bg);color:var(--err);font-weight:700;cursor:pointer;width:100%}
  .dact{display:grid;grid-template-columns:1fr 1fr;gap:8px}
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
    .dhead{margin:6px 0 14px} .dhead h1{display:none}
    .dgrid,.board{grid-template-columns:1fr}
    .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
    .kpi b{font-size:24px}
  }
  @media (min-width:1024px){ .dtabs{display:none} }`;
  if (!$('dashStyle')) { const st = document.createElement('style'); st.id = 'dashStyle'; st.textContent = css; document.head.appendChild(st); }

  const ICON = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    tasks: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
    team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    monthly: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
  };
  const svg = (k, w) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
  const SECTIONS = ['overview', 'tasks', 'team', 'monthly'];
  const TITLE = { overview: 'dOverview', tasks: 'dTasks', team: 'dTeam', monthly: 'dMonthly' };

  let data = null, section = 'overview', loading = false, loadErr = false, timer = null, month = null, who = '', q = '', lineF = '';
  const key = () => `dash:${me()}`;
  const nameOf = u => { const p = data && data.people.find(x => x.username.toLowerCase() === String(u || '').toLowerCase()); return p ? p.name : u; };
  const monthName = m => { try { return new Date(m + '-15T12:00:00').toLocaleDateString(LANG === 'ar' ? 'ar-u-nu-latn-ca-gregory' : 'en-GB', { month: 'long', year: 'numeric' }); } catch (e) { return m; } };
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  async function open(sec) {
    if (SECTIONS.indexOf(sec) >= 0) section = sec;
    showView('dash');
    if (!data) { try { const c = await HS.kv.get(key()); if (c && c.data) data = c.data; } catch (e) {} }
    render();
    load();
    clearInterval(timer);
    timer = setInterval(() => { if (document.visibilityState === 'visible' && !$('dash').classList.contains('hidden')) load(); }, 120000);
  }
  async function load() {
    if (loading || !session) return;
    loading = true; spin(true);
    try {
      const r = await HS.api('dashboard', {}, 45000);
      if (r && r.ok) { data = r; loadErr = false; HS.kv.set(key(), { data: r, at: Date.now() }).catch(() => {}); }
      else { loadErr = true; if (r && r.error) toast(trErr(r.error)); }
    } catch (e) { loadErr = true; if (e.auth) { authLost = true; syncUI(); } }
    loading = false;
    if (!$('dash').classList.contains('hidden')) render();
  }
  function spin(on) { const b = $('dRefresh'); if (b) b.classList.toggle('spin', on); }

  function render() {
    const u = session && session.user;
    if (!u) return;
    const tasks = data ? data.tasks : [];
    const activeCount = tasks.filter(x => x.status === 'Open' || x.status === 'In progress').length;
    const nav = SECTIONS.map(s => `<button type="button" data-sec="${s}" class="${s === section ? 'on' : ''}">${svg(s)}<span>${esc(t(TITLE[s]))}</span>${s === 'tasks' && activeCount ? `<span class="cnt">${activeCount}</span>` : ''}</button>`).join('');
    const pages = ['Amp Rec', 'Vibration Rec', 'Thermo Rec'].filter(p => (u.access || []).indexOf(p) >= 0)
      .map(p => `<button type="button" data-page="${esc(p)}">${svg('page')}<span>${esc(modName(p))}</span></button>`).join('');
    const updated = data ? t('dUpdated', { t: fmtStamp(data.generatedAt) }) : '';
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
            <button class="iconbtn sm" type="button" data-act="settings" aria-label="${esc(t('settings'))}">${svg('gear')}</button>
          </div>
          <div class="dtabs">${SECTIONS.map(s => `<button type="button" data-sec="${s}" class="${s === section ? 'on' : ''}">${esc(t(TITLE[s]))}</button>`).join('')}</div>
          <header class="dhead">
            <div><h1>${esc(t(TITLE[section]))}</h1><small>${esc(longDate())}${updated ? ' · ' + esc(updated) : ''}</small></div>
            <div class="dtools">
              <button class="btn" type="button" id="dRefresh">${svg('refresh')}<span>${esc(t('dRefresh'))}</span></button>
              <button class="btn pri" type="button" data-act="new">${svg('plus', 2.4)}<span>${esc(t('dNewTask'))}</span></button>
            </div>
          </header>
          ${loadErr && data ? `<div class="dnote">${esc(t('dashLoadErr'))}</div>` : ''}
          <div id="dBody">${data ? body() : `<div class="dempty">${esc(loading ? t('dLoading') : t('dashEmpty'))}</div>`}</div>
        </main>
      </div>`;
    spin(loading);
    const D = $('dash');
    D.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { section = b.dataset.sec; render(); window.scrollTo(0, 0); });
    D.querySelectorAll('[data-page]').forEach(b => b.onclick = () => openRecord(b.dataset.page));
    D.querySelectorAll('[data-act="settings"]').forEach(b => b.onclick = openSettings);
    D.querySelectorAll('[data-act="app"]').forEach(b => b.onclick = () => showHome(true));
    D.querySelectorAll('[data-act="new"]').forEach(b => b.onclick = () => taskForm(null));
    $('dRefresh').onclick = load;
    D.querySelectorAll('[data-tid]').forEach(b => b.onclick = () => taskDetail(b.dataset.tid));
    D.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { section = b.dataset.go; render(); });
    D.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { month = b.dataset.month; render(); });
    const fw = $('dWho'); if (fw) fw.onchange = () => { who = fw.value; render(); };
    const fl = $('dLine'); if (fl) fl.onchange = () => { lineF = fl.value; render(); };
    const fq = $('dQ'); if (fq) { fq.oninput = () => { q = fq.value; renderBoardOnly(); }; }
  }
  function body() {
    if (section === 'tasks') return tasksView();
    if (section === 'team') return teamView();
    if (section === 'monthly') return monthlyView();
    return overview();
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
    if (x.donePhoto) meta.push(`<span>📷</span>`);
    return `<button type="button" class="tcard ${esc(x.priority)}" data-tid="${esc(x.id)}"><b>${esc(x.title)}</b><div class="mini">${meta.join('')}</div></button>`;
  }
  function filtered() {
    const s = q.trim().toLowerCase();
    return data.tasks.filter(x => x.status !== 'Cancelled' && (!who || x.assignee.toLowerCase() === who.toLowerCase()) &&
      (!lineF || (x.line || '') === lineF) &&
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
    const lines = [...new Set((data.equipment || []).map(e => e.line).concat(data.tasks.map(x => x.line)).filter(Boolean))].sort();
    const lineOpts = lines.map(l => `<option value="${esc(l)}" ${l === lineF ? 'selected' : ''}>${esc(l)}</option>`).join('');
    return `<div class="toolbar"><select id="dWho"><option value="">${esc(t('fAll'))}</option>${people}</select>
      ${lines.length ? `<select id="dLine"><option value="">${esc(t('fLineAll'))}</option>${lineOpts}</select>` : ''}
      <input id="dQ" type="search" dir="auto" placeholder="${esc(t('fSearch'))}" value="${esc(q)}"></div>
      <div class="board" id="dBoard">${boardHtml()}</div>`;
  }
  function renderBoardOnly() {
    const b = $('dBoard'); if (!b) return;
    b.innerHTML = boardHtml();
    b.querySelectorAll('[data-tid]').forEach(x => x.onclick = () => taskDetail(x.dataset.tid));
  }

  /* ---------- team ---------- */
  function teamView() {
    const m0 = (data.months[0] && data.months[0].people) || {};
    const rows = data.workload.map(w => {
      const c = m0[w.username.toLowerCase()] || {};
      const total = (c.tasksDone || 0) + (c.readings || 0) + (c.checks || 0);
      return `<tr><td><b>${esc(w.name)}</b></td><td>${esc(roleName(w.role))}</td><td class="num">${w.open}</td><td class="num">${w.inProgress}</td>
        <td class="num ${w.overdue ? 'late' : ''}">${w.overdue}</td><td class="num">${w.doneWeek}</td><td class="num">${w.doneMonth}</td>
        <td class="num">${c.readings || 0}</td><td class="num">${c.checks || 0}</td><td class="num"><b>${total}</b></td></tr>`;
    }).join('');
    return `<section class="dcard"><div class="tscroll"><table class="dtable"><thead><tr>
      <th>${esc(t('tName'))}</th><th>${esc(t('tRole'))}</th><th class="num">${esc(t('tOpen'))}</th><th class="num">${esc(t('tProg'))}</th><th class="num">${esc(t('tOver'))}</th>
      <th class="num">${esc(t('tDoneW'))}</th><th class="num">${esc(t('tDoneM'))}</th><th class="num">${esc(t('tReadM'))}</th><th class="num">${esc(t('tChkM'))}</th><th class="num">${esc(t('tTotM'))}</th>
      </tr></thead><tbody>${rows || `<tr><td colspan="10" class="dempty">${esc(t('noData'))}</td></tr>`}</tbody></table></div></section>`;
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
    const people = data.assignable.map(p => `<option value="${esc(p.username)}" ${p.username.toLowerCase() === x.assignee.toLowerCase() ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    let actions = '';
    if (x.status === 'Open' || x.status === 'In progress') actions = `
      <div class="reass"><select class="ffield" id="dReass">${people}</select><button type="button" class="btn" id="dReassBtn">${esc(t('aReassign'))}</button></div>
      <div class="dact"><button type="button" class="ghostbtn" id="dEdit">${esc(t('aEdit'))}</button><button type="button" class="dangerbtn" id="dCancel">${esc(t('aCancel'))}</button></div>`;
    else actions = `<div class="dact"><button type="button" class="ghostbtn" id="dEdit">${esc(t('aEdit'))}</button><button type="button" class="ghostbtn" id="dReopen">${esc(t('aReopen'))}</button></div>`;
    showModal(`<div class="tmeta"><span class="chip ${STATUS_CLASS(x.status)}">${esc(t('status.' + x.status))}</span><span class="chip prio ${esc(x.priority)}">${esc(t('prio.' + x.priority))}</span></div>
      <h2>${esc(x.title)}</h2>
      <dl class="tinfo">${info.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${b}</dd>`).join('')}</dl>
      ${x.details ? `<div class="tdesc">${esc(x.details)}</div>` : ''}
      ${x.doneNote ? `<dl class="tinfo"><dt>${esc(t('doneNoteLabel'))}</dt><dd></dd></dl><div class="tdesc">${esc(x.doneNote)}</div>` : ''}
      ${/^https?:/.test(x.donePhoto || '') ? `<p style="margin-bottom:12px"><a class="btn" href="${esc(x.donePhoto)}" target="_blank" rel="noopener">${svg('photo')}<span>${esc(t('openPhoto'))}</span></a></p>` : ''}
      <div class="tact">${actions}</div>`, x.id);
    const on = (i, fn) => { const el = $(i); if (el) el.onclick = fn; };
    on('dEdit', () => taskForm(x));
    on('dReassBtn', () => edit({ id: x.id, assignee: $('dReass').value }));
    on('dReopen', () => edit({ id: x.id, status: 'Open' }));
    on('dCancel', () => {
      if (!cancelArmed) { cancelArmed = true; $('dCancel').textContent = t('aCancelSure'); return; }
      edit({ id: x.id, status: 'Cancelled' });
    });
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
    const i = data.tasks.findIndex(k => k.id === task.id);
    if (i >= 0) data.tasks[i] = task; else data.tasks.unshift(task);
  }

  /* ---------- new / edit task form ---------- */
  function taskForm(x) {
    if (!data) { toast(t('needOnline')); return; }
    const pr = (x && x.priority) || 'Normal';
    const people = data.assignable.map(p => `<option value="${esc(p.username)}" ${x && p.username.toLowerCase() === x.assignee.toLowerCase() ? 'selected' : ''}>${esc(p.name)} — ${esc(roleName(p.role))}</option>`).join('');
    const links = ['', 'Amp Rec', 'Vibration Rec', 'Thermo Rec', 'Bobcat', 'Forklift'].map(l => `<option value="${esc(l)}" ${x && x.link === l ? 'selected' : ''}>${esc(l ? modName(l) : t('fNone'))}</option>`).join('');
    showModal(`<h2>${esc(t(x ? 'fEditTitle' : 'fNewTitle'))}</h2>
      <form class="tform" id="dForm" autocomplete="off">
        <label for="fTitle">${esc(t('fTitle'))} *</label>
        <input class="ffield" id="fTitle" dir="auto" maxlength="140" required placeholder="${esc(t('fTitlePh'))}" value="${esc(x ? x.title : '')}">
        <label for="fWho">${esc(t('fAssignee'))} *</label>
        <select class="ffield" id="fWho" required>${x ? '' : `<option value="">${esc(t('fChoose'))}</option>`}${people}</select>
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
        <div class="msg" id="fMsg"></div>
        <button class="primary" type="submit" id="fGo">${esc(t(x ? 'fSave' : 'fCreate'))}</button>
      </form>`, x ? x.id : '');
    let prio = pr;
    const getEquip = wirePicker(x);
    $('fPrio').querySelectorAll('button').forEach(b => b.onclick = () => { prio = b.dataset.p; $('fPrio').querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b)); });
    setTimeout(() => $('fTitle').focus(), 60);
    $('dForm').onsubmit = async ev => {
      ev.preventDefault();
      const f = Object.assign({ title: $('fTitle').value.trim(), assignee: $('fWho').value, priority: prio, due: $('fDue').value, link: $('fLink').value, details: $('fDet').value.trim() }, getEquip());
      if (!f.title || !f.assignee) { $('fMsg').textContent = !f.title ? t('fTitle') + ' *' : t('fAssignee') + ' *'; return; }
      $('fGo').disabled = true; $('fMsg').textContent = '';
      try {
        const r = x ? await HS.api('taskEdit', { task: Object.assign({ id: x.id }, f) }, 30000) : await HS.api('taskCreate', { task: f }, 30000);
        if (!r || !r.ok) { $('fMsg').textContent = trErr(r && r.error) || t('needOnline'); $('fGo').disabled = false; return; }
        hideModal();
        const n = r.task.assigneeName;
        toast(r.notified ? (r.notified.sent ? t('sentOk', { n }) : t('sentNoPhone', { n })) : t('saved'));
        upsert(r.task); section = section === 'overview' && !x ? 'tasks' : section; render(); load();
      } catch (e) { $('fMsg').textContent = e.auth ? t('sessionExpired') : t('needOnline'); $('fGo').disabled = false; }
    };
  }

  /* ---------- equipment picker (from "Equipments and system in Holoul factory") ---------- */
  function equipPicker(x) {
    const eq = data.equipment || [];
    const has = !!(x && x.equipment);
    const locs = [...new Set(eq.map(e => e.loc).filter(Boolean))];
    return `<div class="eqsel ${has ? '' : 'hidden'}" id="eqSel"><div class="eqtxt"><b id="eqSelName"></b><small id="eqSelMeta"></small></div>
        <button type="button" class="btn" id="eqChange">${esc(t('eqChange'))}</button></div>
      <div class="${has ? 'hidden' : ''}" id="eqFind">
        ${eq.length ? `<div class="row2"><select class="ffield" id="eqLoc"><option value="">${esc(t('eqAllLoc'))}</option>${locs.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('')}</select>
          <select class="ffield" id="eqLine"></select></div>` : ''}
        ${data.equipmentError ? `<div class="dnote">${esc(t('eqListErr', { e: data.equipmentError }))}</div>` : ''}
        <input class="ffield" id="fEq" dir="auto" autocomplete="off" placeholder="${esc(t(eq.length ? 'eqSearch' : 'fEquipPh'))}">
        <div class="eqlist" id="eqList" role="listbox"></div>
      </div>`;
  }
  /** Wires the picker; returns a function giving { equipment, equipmentNo, line, location } for the form. */
  function wirePicker(x) {
    const eq = data.equipment || [];
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

  window.HoloulDash = { open, refresh: load, render: () => { if (!$('dash').classList.contains('hidden')) render(); }, reset: () => { data = null; clearInterval(timer); section = 'overview'; who = ''; q = ''; } };
})();
