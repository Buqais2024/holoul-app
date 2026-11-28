import sys, json, re
from bt_common import *
R={'pass':0,'fail':0,'f':[]}
def check(name, cond, extra=''):
    if cond: R['pass']+=1
    else: R['fail']+=1; R['f'].append(name+(' :: '+str(extra) if extra else ''))
def call(tok, body): return json.loads(ctl('/ctl/call', json.dumps(dict(body, token=tok))))
def tok(u,pin): return json.loads(ctl('/ctl/call', json.dumps({'action':'login','username':u,'pin':pin})))['token']
def tasks(): return json.loads(ctl('/ctl/tasks'))
def sup_login(pg, lang='en'):
    pg.goto(BASE+'/'); pg.evaluate("l=>localStorage.setItem('holoul_lang',l)", lang); pg.goto(BASE+'/')
    pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('[data-act=new]', timeout=10000)
def tech_login(pg, u='tech1', pin='2222', lang='en'):
    pg.goto(BASE+'/'); pg.evaluate("l=>localStorage.setItem('holoul_lang',l)", lang); pg.goto(BASE+'/')
    pg.fill('#username',u); pg.fill('#pin',pin); pg.click('#btn'); pg.wait_for_selector('#taskBox:not(.hidden)', timeout=10000)

with sync_playwright() as p:
    # ---------- supervisor: new task form with the new fields ----------
    ctl('/ctl/reset'); b,ctx,pg,errs=newpage(p, mobile=False); sup_login(pg)
    pg.click('[data-act=new]'); pg.wait_for_selector('#dForm')
    check('form has category', pg.locator('#fCat').count()==1)
    check('form has 3 rule boxes', pg.locator('#fNeedNote,#fNeedPhoto,#fNeedAp').count()==3)
    check('form has template picker', pg.locator('#fTpl').count()==1)
    check('category options', pg.eval_on_selector_all('#fCat option','o=>o.map(x=>x.value)')==['','Mechanical','Electrical','Cleaning','Safety','Other'])
    pg.fill('#fTitle','Replace belt'); pg.select_option('#fWho','tech1'); pg.select_option('#fCat','Electrical')
    pg.check('#fNeedNote'); pg.check('#fNeedAp'); pg.click('#fGo'); pg.wait_for_timeout(1500)
    t=tasks(); check('task saved with flags', len(t)==1 and t[0]['Category']=='Electrical' and t[0]['Need Note']=='Yes' and t[0]['Approval']=='Required' and t[0]['Need Photo']=='', t[:1])
    pg.click('[data-sec=tasks]'); pg.wait_for_selector('.tcard')
    check('card shows category', 'Electrical' in pg.inner_text('.tcard'), pg.inner_text('.tcard'))
    # ---------- templates ----------
    pg.click('[data-act=new]'); pg.wait_for_selector('#dForm'); pg.fill('#fTitle','Weekly grease'); pg.fill('#fDet','Grease all bearings'); pg.select_option('#fCat','Mechanical'); pg.check('#fNeedPhoto')
    pg.once('dialog', lambda d: d.accept('Grease round')); pg.click('#fTplSave'); pg.wait_for_timeout(1200)
    check('template appears in picker', 'Grease round' in pg.inner_text('#fTpl'))
    check('template stored', json.loads(ctl('/ctl/call', json.dumps({'action':'taskTemplates','token':tok('sup','1111')})))['templates'][0]['needPhoto'] is True)
    pg.keyboard.press('Escape'); pg.evaluate("document.getElementById('taskModal').classList.remove('open')")
    pg.click('[data-act=new]'); pg.wait_for_selector('#fTpl option:nth-child(2)', state='attached', timeout=5000)
    pg.select_option('#fTpl', label='Grease round')
    check('template fills form', pg.input_value('#fTitle')=='Weekly grease' and pg.input_value('#fDet')=='Grease all bearings' and pg.input_value('#fCat')=='Mechanical' and pg.is_checked('#fNeedPhoto') and not pg.is_checked('#fNeedNote'))
    pg.click('#fTplDel'); pg.wait_for_timeout(1000)
    check('template deleted', json.loads(ctl('/ctl/call', json.dumps({'action':'taskTemplates','token':tok('sup','1111')})))['templates']==[])
    check('no JS errors (supervisor form)', not errs, errs); b.close()

    # ---------- technician flow with required note + hours + approval ----------
    ctl('/ctl/reset'); st=tok('sup','1111')
    call(st, {'action':'taskCreate','task':{'title':'Replace belt','assignee':'tech1','due':'2026-12-05','category':'Mechanical','needNote':True,'needApproval':True}})
    call(st, {'action':'taskCreate','task':{'title':'Photo job','assignee':'tech1','due':'2026-12-06','needPhoto':True}})
    b,ctx,pg,errs=newpage(p, mobile=True); tech_login(pg)
    pg.click('[data-task="T-0001"]'); pg.wait_for_selector('#taskStart'); 
    check('category shown to tech', 'Mechanical' in pg.inner_text('#taskBody'))
    pg.click('#taskStart'); pg.wait_for_selector('#taskDoneOpen'); pg.click('#taskDoneOpen'); pg.wait_for_selector('#taskNote')
    check('required placeholder', 'required' in (pg.get_attribute('#taskNote','placeholder') or ''), pg.get_attribute('#taskNote','placeholder'))
    pg.click('#taskDoneOk'); pg.wait_for_timeout(300)
    check('blocked without note, message shown', pg.inner_text('#taskMsg').strip()!='' and pg.locator('#taskDoneOk').count()==1, pg.inner_text('#taskMsg'))
    check('no done op queued', [x for x in tasks() if x['ID']=='T-0001'][0]['Status']=='In progress')
    pg.fill('#taskNote','Replaced and tensioned'); pg.fill('#taskHours','2.3'); pg.click('#taskDoneOk'); pg.wait_for_timeout(2500)
    r=[x for x in tasks() if x['ID']=='T-0001'][0]
    check('done saved with hours + pending approval', r['Status']=='Done' and r['Hours']=='2.25' and r['Approval']=='Pending' and r['Done Note']=='Replaced and tensioned', r)
    pg.click('#doneToggle'); pg.click('[data-task="T-0001"]'); pg.wait_for_selector('#taskAwait')
    check('tech sees waiting for approval', 'approval' in pg.inner_text('#taskAwait').lower())
    check('no horizontal overflow on phone', pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+1"))
    # photo-required job: blocked without photo
    pg.evaluate("document.getElementById('taskClose').click()"); pg.click('[data-task="T-0002"]'); pg.click('#taskStart'); pg.wait_for_selector('#taskDoneOpen'); pg.click('#taskDoneOpen'); pg.wait_for_selector('#taskNote')
    check('photo required label', 'required' in pg.inner_text('#taskPhoto'), pg.inner_text('#taskPhoto'))
    pg.fill('#taskNote','x'); pg.click('#taskDoneOk'); pg.wait_for_timeout(300)
    check('blocked without photo', 'photo' in pg.inner_text('#taskMsg').lower() and [x for x in tasks() if x['ID']=='T-0002'][0]['Status']=='In progress', pg.inner_text('#taskMsg'))
    check('no JS errors (technician)', not errs, errs); b.close()

    # ---------- supervisor approves / sends back ----------
    b,ctx,pg,errs=newpage(p, mobile=False); sup_login(pg); pg.click('[data-sec=tasks]'); pg.wait_for_selector('.tcard')
    check('card flags waiting approval', pg.locator('[data-await]').count()==1)
    pg.click('.tcard[data-tid="T-0001"]'); pg.wait_for_selector('#dApprove')
    check('detail shows hours and category', '2.25' in pg.inner_text('#taskBody') and 'Mechanical' in pg.inner_text('#taskBody'))
    pg.click('#dSendBack'); pg.wait_for_timeout(200)
    check('send back needs a reason', [x for x in tasks() if x['ID']=='T-0001'][0]['Status']=='Done' and pg.locator('#dApMsg').inner_text().strip()!='')
    pg.fill('#dApNote','Belt still loose'); pg.click('#dSendBack'); pg.wait_for_timeout(2000)
    r=[x for x in tasks() if x['ID']=='T-0001'][0]; check('sent back', r['Status']=='Open' and r['Approval']=='Required', r)
    # tech finishes again, supervisor approves
    ttok=tok('tech1','2222'); call(ttok,{'action':'taskUpdate','id':'T-0001','status':'Done','note':'tightened'})
    pg.click('[data-sec=overview]'); pg.click('[data-sec=tasks]'); pg.reload(); pg.wait_for_selector('[data-act=new]'); pg.click('[data-sec=tasks]'); pg.wait_for_selector('.tcard[data-tid="T-0001"]')
    pg.click('.tcard[data-tid="T-0001"]'); pg.wait_for_selector('#dApprove'); pg.click('#dApprove'); pg.wait_for_timeout(2000)
    r=[x for x in tasks() if x['ID']=='T-0001'][0]; check('approved', r['Approval']=='Approved' and r['Approval By']=='sup', r)
    # category filter
    pg.reload(); pg.wait_for_selector('[data-act=new]'); pg.click('[data-sec=tasks]'); pg.wait_for_selector('#dCat')
    pg.select_option('#dCat','Mechanical'); pg.wait_for_timeout(300); check('filter keeps matching', pg.locator('.tcard[data-tid="T-0001"]').count()==1 and pg.locator('.tcard[data-tid="T-0002"]').count()==0)
    pg.select_option('#dCat','Electrical'); pg.wait_for_timeout(300); check('filter hides others', pg.locator('.tcard').count()==0)
    check('no JS errors (approval)', not errs, errs); b.close()

    # ---------- Arabic ----------
    ctl('/ctl/reset'); st=tok('sup','1111')
    call(st, {'action':'taskCreate','task':{'title':'تغيير السير','assignee':'tech1','needNote':True,'needApproval':True,'category':'Safety'}})
    b,ctx,pg,errs=newpage(p, mobile=False, lang='ar'); sup_login(pg,'ar'); pg.click('[data-act=new]'); pg.wait_for_selector('#dForm')
    txt=pg.inner_text('#dForm'); check('arabic form labels', 'الفئة' in txt and 'اشتراط' in txt and 'قالب' in txt, txt[:300])
    check('arabic category names', 'ميكانيكية' in pg.inner_text('#fCat'))
    check('no JS errors (arabic supervisor)', not errs, errs); b.close()
    b,ctx,pg,errs=newpage(p, mobile=True, lang='ar'); tech_login(pg, lang='ar'); pg.click('[data-task="T-0001"]'); pg.click('#taskStart'); pg.wait_for_selector('#taskDoneOpen'); pg.click('#taskDoneOpen'); pg.wait_for_selector('#taskNote')
    check('arabic required placeholder', 'مطلوب' in (pg.get_attribute('#taskNote','placeholder') or ''))
    pg.click('#taskDoneOk'); pg.wait_for_timeout(300); check('arabic block message', 'اكتب' in pg.inner_text('#taskMsg'), pg.inner_text('#taskMsg'))
    pg.screenshot(path='/tmp/tech_ar.png')
    check('arabic page direction rtl', pg.evaluate("getComputedStyle(document.body).direction")=='rtl')
    check('no JS errors (arabic tech)', not errs, errs); b.close()

print(f"\nbrowser: {R['pass']} passed, {R['fail']} failed")
for f in R['f']: print('  FAIL', f)
sys.exit(1 if R['fail'] else 0)
