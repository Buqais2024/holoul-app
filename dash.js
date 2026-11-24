/* Holoul Maintenance — dashboard (app v13).
 * Supervisor / Operations Manager: every section.
 * Technician / operator: only the sections their rights open (Equipment, Spare parts) and New task.
 * Uses helpers from index.html (t, esc, HS, session, showView, toast, loadImage, scaled, roleName, modName, ...). */
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
    .dhead{margin:6px 0 14px} .dhead h1{display:none}
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
    dEquip:'Equipment', dSpares:'Spare parts', eqAll:'All equipment', eqJobs:'Jobs', eqOpenCol:'Open', eqLastDone:'Last finished',
    eqNumber:'Number', eqLocation:'Location', eqHistTitle:'Maintenance history', eqHistEmpty:'No maintenance recorded on this equipment yet.',
    eqHistLoading:'Loading history…', eqHistErr:'History could not be loaded: {e}', eqStatDone:'Finished', eqStatOpen:'Still open', eqStatLast:'Last finished',
    hCreated:'Created', hJob:'Job', hStatus:'Status', hWho:'Assigned to', hFinished:'Finished', hNote:'Note',
    'ev.Created':'Created', 'ev.Started':'Started', 'ev.Done':'Done', 'ev.Cancelled':'Cancelled', 'ev.Reopened':'Reopened', 'ev.Edited':'Edited',
    spElect:'Electrical', spMech:'Mechanical', spSearch:'Search by part number, name or brand…', spLowOnly:'Low or out of stock only',
    spOutOnly:'Out of stock only', spParts:'{n} parts', spLowN:'{n} low stock', spOutN:'{n} out of stock', spEmpty:'No parts match your search',
    spLoading:'Loading spare parts…', spErr:'Spare parts could not be loaded: {e}', spOK:'OK', spLow:'Low stock',
    spPartNo:'Part no.', spItemNo:'Part / item no.', spName:'Part', spBrand:'Brand', spDesc:'Description', spQty:'Qty', spReq:'Required',
    spAvail:'Available', spUsed:'Used', spRem:'Remaining', spStatus:'Status', spMachine:'Machine',
    dSecAccount:'Account', dSecRights:'Extra rights', dRoleEq:'Equipment: {eq}', dAddEq:'Add equipment', dEditEq:'Edit equipment', dEqDel:'Delete', dEqRestore:'Restore', dEqDelSure:'Tap again to delete', dShowDel:'Show deleted', dDeleted:'Deleted',
    dEqfName:'Equipment name', dEqfLine:'Line / system', dEqfNo:'Number', dEqfLoc:'Location', dEqfCat:'Category',
    dEqfPhotoNew:'Main photo (required)', dEqfPhoto:'Main photo', dChoosePhoto:'Choose photo', dPhotoSel:'Photo selected', dKeepPhoto:'Keep the current photo',
    dSaveEq:'Save equipment', dSavePart:'Save part',
    dAutoTitle:'Automatic task', dAutoHint:'Creates this reading task for the technicians you choose, on the schedule you set. Only supervisors can change it.', dAutoReading:'Reading', dAutoNone:'No automatic task', dAutoBasis:'Repeat by', dAutoByPeriod:'Time period', dAutoByHours:'Running hours', dAutoPeriod:'How often', dAutoHours:'Every how many hours', dAutoWho:'Technicians (one or more)', dAutoLoading:'Loading technicians…', dAutoNoTechs:'No technicians found', dAutoNoHours:'Enter the running hours (1 or more)', dAutoNoWho:'Choose at least one technician', dAutoPW:'Weekly', dAutoPM:'Monthly', dAutoPQ:'Quarterly', dAutoPS:'Semi-annual', dAutoPY:'Yearly', dCancel:'Cancel', dNeedVal:'Fill in the required fields', dLoadEq:'Loading equipment…', dLoadSp:'Loading spare parts…',
    dPhotos:'Photos', dPhMain:'Main', dPhX1:'Detail 1', dPhX2:'Detail 2', dPhAdd:'Add photo', dPhReplace:'Replace', dPhNone:'No photo', dPhLoading:'Loading photos…',
    dPhErr:'Photos could not be loaded: {e}', dPhBusy:'Saving photo…', dPhDone:'Photo saved', dPhBad:'Choose an image file',
    dAddPart:'Add part', dEditPart:'Edit part', dPartNew:'New part', dSpfNo:'Part / item number', dSpfBrand:'Brand', dSpfDesc:'Description', dSpfQty:'Quantity',
    dSpfName:'Part name', dSpfReq:'Required qty', dSpfAvail:'Available qty', dSpfUsed:'Used qty', dSpfMachine:'Machine', dSpDel:'Delete part',
    dEmp:'Employees', dAddEmp:'Add employee', dEditEmp:'Edit employee', dNewEmp:'New employee', dEmpName:'Full name', dEmpUser:'Username', dEmpRole:'Role',
    dEmpEq:'Equipment (operators)', dEmpPin:'PIN (4 to 8 digits)', dEmpPinKeep:'New PIN (leave blank to keep the current one)', dEmpActive:'Active',
    dEmpPerms:'Extra rights', dPermTasks:'Create tasks', dPermEq:'Edit equipment', dPermSp:'Edit spare parts', dPermMgr:'Supervisors and operations managers always have all rights',
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
    dAutoTitle:'مهمة تلقائية', dAutoHint:'تُنشئ مهمة القراءة للفنيين الذين تختارهم حسب الجدول الذي تحدده. المشرف فقط يستطيع تغييرها.', dAutoReading:'القراءة', dAutoNone:'بدون مهمة تلقائية', dAutoBasis:'التكرار حسب', dAutoByPeriod:'مدة زمنية', dAutoByHours:'ساعات التشغيل', dAutoPeriod:'كم مرة', dAutoHours:'كل كم ساعة', dAutoWho:'الفنيون (واحد أو أكثر)', dAutoLoading:'جارٍ تحميل الفنيين…', dAutoNoTechs:'لا يوجد فنيون', dAutoNoHours:'أدخل ساعات التشغيل (1 أو أكثر)', dAutoNoWho:'اختر فنياً واحداً على الأقل', dAutoPW:'أسبوعياً', dAutoPM:'شهرياً', dAutoPQ:'ربع سنوياً', dAutoPS:'نصف سنوياً', dAutoPY:'سنوياً', dCancel:'إلغاء', dNeedVal:'املأ الحقول المطلوبة', dLoadEq:'جارٍ تحميل المعدات…', dLoadSp:'جارٍ تحميل قطع الغيار…',
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
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
  };
  const svg = (k, w) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
  const SECTIONS = ['overview', 'tasks', 'equipment', 'spares', 'team', 'monthly'];
  const TITLE = { overview: 'dOverview', tasks: 'dTasks', equipment: 'dEquip', spares: 'dSpares', team: 'dTeam', monthly: 'dMonthly' };

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
    (isMgr() && (s === 'overview' || s === 'tasks' || s === 'team' || s === 'monthly')));

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
  }

  function render() {
    const u = session && session.user;
    if (!u) return;
    const tasks = data ? data.tasks : [];
    const activeCount = tasks.filter(x => x.status === 'Open' || x.status === 'In progress').length;
    const vis = visible();
    const nav = vis.map(s => `<button type="button" data-sec="${s}" class="${s === section ? 'on' : ''}">${svg(s)}<span>${esc(t(TITLE[s]))}</span>${s === 'tasks' && activeCount ? `<span class="cnt">${activeCount}</span>` : ''}</button>`).join('');
    const pages = ['Amp Rec', 'Vibration Rec', 'Thermo Rec'].filter(p => (u.access || []).indexOf(p) >= 0)
      .map(p => `<button type="button" data-page="${esc(p)}">${svg('page')}<span>${esc(modName(p))}</span></button>`).join('');
    const updated = data ? t('dUpdated', { t: fmtStamp(data.generatedAt) }) : '';
    const needData = !data && isMgr() && section !== 'equipment' && section !== 'spares' && section !== 'team';
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
          <div class="dtabs">${vis.map(s => `<button type="button" data-sec="${s}" class="${s === section ? 'on' : ''}">${esc(t(TITLE[s]))}</button>`).join('')}</div>
          <header class="dhead">
            <div><h1>${esc(t(TITLE[section]))}</h1><small>${esc(longDate())}${updated ? ' · ' + esc(updated) : ''}</small></div>
            <div class="dtools">
              <button class="btn" type="button" id="dRefresh">${svg('refresh')}<span>${esc(t('dRefresh'))}</span></button>
              ${canTask() ? `<button class="btn pri" type="button" data-act="new">${svg('plus', 2.4)}<span>${esc(t('dNewTask'))}</span></button>` : ''}
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
    D.querySelectorAll('[data-act="app"]').forEach(b => b.onclick = () => showHome(true));
    D.querySelectorAll('[data-act="new"]').forEach(b => b.onclick = () => taskForm(null).catch(() => {}));
    $('dRefresh').onclick = refreshCurrent;
    D.querySelectorAll('[data-tid]').forEach(b => b.onclick = () => taskDetail(b.dataset.tid));
    D.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { section = b.dataset.go; render(); });
    D.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { month = b.dataset.month; render(); });
    const fw = $('dWho'); if (fw) fw.onchange = () => { who = fw.value; render(); };
    const fl = $('dLine'); if (fl) fl.onchange = () => { lineF = fl.value; render(); };
    const fq = $('dQ'); if (fq) { fq.oninput = () => { q = fq.value; renderBoardOnly(); }; }
    bindEquipment();
    bindSpares();
    bindTeam();
    D.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => addPhoto(b.dataset.ph));
    D.querySelectorAll('[data-img]').forEach(b => b.onclick = () => window.open(b.dataset.img, '_blank', 'noopener'));
  }
  function body() {
    if (visible().indexOf(section) < 0) return `<div class="dempty">${esc(t('noData'))}</div>`;
    if (section === 'tasks') return tasksView();
    if (section === 'team') return teamView();
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
  let spData = null, spLoading = false, spErr = '', spTab = 'electrical', spQ = '', spLow = false, spShowDel = false, spSel = null, spShown = [];
  let armKey = '';
  const eqKey = e => [e.no, e.name, e.line, e.loc].join('|');
  const isLowM = p => /low/i.test(p.status || '');
  const isOutE = p => p.qty !== '' && Number(p.qty) <= 0;
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
      rows += `<tr class="clickrow ${e.deleted ? 'off' : ''}" data-eqi="${i}"><td><b>${esc(e.name)}</b>${e.deleted ? `<span class="deltag">${esc(t('dDeleted'))}</span>` : ''}${e.cat ? `<small>${esc(e.cat)}</small>` : ''}</td>
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
    if (eqSel) return equipDetail();
    const eq = eqSource();
    const lines = [...new Set(eqAll.map(e => e.line).filter(Boolean))].sort();
    const locs = [...new Set(eqAll.map(e => e.loc).filter(Boolean))].sort();
    return `<div class="toolbar"><select id="eqLocF"><option value="">${esc(t('eqAllLoc'))}</option>${locs.map(l => `<option value="${esc(l)}" ${l === eqLocF ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select id="eqLineF"><option value="">${esc(t('eqAllLine'))}</option>${lines.map(l => `<option value="${esc(l)}" ${l === eqLineF ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <input id="eqQ" type="search" dir="auto" placeholder="${esc(t('eqSearch'))}" value="${esc(eqQ)}">
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
      <section class="dcard"><h4>${esc(t('dPhotos'))}</h4>${gallery(canEq())}</section>
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
      if (r && r.ok) { spData = r.spares; if (spSel) spSel = findSpare(spSel.kind, spSel.row); }
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
  function spTable() {
    spShown = spList();
    if (!spShown.length) return `<div class="dempty">${esc(t('spEmpty'))}</div>`;
    if (spTab === 'electrical') return `<table class="dtable"><thead><tr><th>${esc(t('spPartNo'))}</th><th>${esc(t('spBrand'))}</th><th>${esc(t('spDesc'))}</th><th class="num">${esc(t('spQty'))}</th></tr></thead><tbody>
      ${spShown.map((p, i) => `<tr class="clickrow ${p.deleted ? 'off' : ''}" data-spi="${i}"><td><span class="eqno">${esc(p.no)}</span>${p.deleted ? `<span class="deltag">${esc(t('dDeleted'))}</span>` : ''}</td><td>${esc(p.brand || '—')}</td><td>${esc(p.desc)}</td>
        <td class="num ${isOutE(p) ? 'late' : ''}">${esc(p.qty || '—')}</td></tr>`).join('')}</tbody></table>`;
    return `<table class="dtable"><thead><tr><th>${esc(t('spPartNo'))}</th><th>${esc(t('spName'))}</th><th class="num">${esc(t('spReq'))}</th><th class="num">${esc(t('spAvail'))}</th>
      <th class="num">${esc(t('spUsed'))}</th><th class="num">${esc(t('spRem'))}</th><th>${esc(t('spStatus'))}</th><th>${esc(t('spMachine'))}</th></tr></thead><tbody>
      ${spShown.map((p, i) => `<tr class="clickrow ${p.deleted ? 'off' : ''}" data-spi="${i}"><td><span class="eqno">${esc(p.no)}</span>${p.deleted ? `<span class="deltag">${esc(t('dDeleted'))}</span>` : ''}</td><td>${esc(p.name)}</td><td class="num">${esc(p.required || '—')}</td>
        <td class="num">${esc(p.available || '—')}</td><td class="num">${esc(p.used || '—')}</td><td class="num ${isLowM(p) ? 'late' : ''}">${esc(p.remaining || '—')}</td>
        <td>${p.status ? `<span class="spst ${isLowM(p) ? 'low' : 'ok'}">${esc(isLowM(p) ? t('spLow') : t('spOK'))}</span>` : '—'}</td>
        <td>${esc(p.machine || '—')}</td></tr>`).join('')}</tbody></table>`;
  }
  function bindSpares() {
    const D = $('dash');
    D.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { spTab = b.dataset.sp; render(); });
    D.querySelectorAll('[data-spi]').forEach(b => b.onclick = () => { spSel = Object.assign({}, spShown[+b.dataset.spi]); armKey = ''; phState = { id: '', photos: null, err: '' }; render(); window.scrollTo(0, 0); });
    D.querySelectorAll('[data-spact]').forEach(b => b.onclick = () => spAction(b.dataset.spact));
    const sa = D.querySelector('[data-act="addSp"]'); if (sa) sa.onclick = () => spForm(null);
    const sb = D.querySelector('[data-spback]'); if (sb) sb.onclick = () => { spSel = null; render(); window.scrollTo(0, 0); };
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
    const actions = canSp() ? `<div class="dact"><button type="button" class="ghostbtn" data-spact="edit">${esc(t('aEdit'))}</button>
      ${p.deleted ? `<button type="button" class="ghostbtn" data-spact="restore">${esc(t('dEqRestore'))}</button>`
        : `<button type="button" class="dangerbtn" data-spact="del">${esc(armed ? t('dEqDelSure') : t('dSpDel'))}</button>`}</div>` : '';
    return `<div class="eqback"><button class="btn" type="button" data-spback>${svg('back', 2.2)}<span>${esc(t('dSpares'))}</span></button></div>
      <section class="dcard eqhead"><div><h3>${esc(isM ? p.name : p.desc)}</h3>${p.deleted ? `<span class="deltag">${esc(t('dDeleted'))}</span>` : ''}
        <small>${esc(t(isM ? 'spMech' : 'spElect'))}${isM && p.machine ? ' · ' + esc(p.machine) : ''}</small></div>
        <div class="eqmeta"><span class="eqno">${esc(p.no)}</span></div>${actions}</section>
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
    const lines = [...new Set(eqActive().map(e => e.line).concat(data.tasks.map(x => x.line)).filter(Boolean))].sort();
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
    const pr = (x && x.priority) || 'Normal';
    const people = assignees().map(p => `<option value="${esc(p.username)}" ${x && p.username.toLowerCase() === x.assignee.toLowerCase() ? 'selected' : ''}>${esc(p.name)} — ${esc(roleName(p.role))}</option>`).join('');
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
        if (isMgr()) { upsert(r.task); section = section === 'overview' && !x ? 'tasks' : section; }
        render(); load();
      } catch (e) { $('fMsg').textContent = e.auth ? t('sessionExpired') : t('needOnline'); $('fGo').disabled = false; }
    };
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
    refresh: refreshCurrent,
    render: () => { if (!$('dash').classList.contains('hidden')) render(); },
    reset: () => {
      data = null; clearInterval(timer); section = 'overview'; who = ''; q = ''; pendingNew = false;
      eqSel = null; eqHistKey = ''; eqAll = null; eqErr = ''; eqShowDel = false; armKey = '';
      spData = null; spErr = ''; spSel = null; spShowDel = false;
      teamData = null; teamErr = ''; peopleList = null; phState = { id: '', photos: null, err: '' };
    }
  };
})();
