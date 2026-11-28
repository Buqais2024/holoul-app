import sys, json
from bt_common import *
R={'pass':0,'fail':0,'f':[]}
def check(n,c,x=''):
    if c: R['pass']+=1
    else: R['fail']+=1; R['f'].append(n+(' :: '+str(x)[:300] if x else ''))
def call(tok,b): return json.loads(ctl('/ctl/call', json.dumps(dict(b,token=tok))))
def tok(u,p): return json.loads(ctl('/ctl/call', json.dumps({'action':'login','username':u,'pin':p})))['token']
def tasks(): return json.loads(ctl('/ctl/tasks'))
def sup(pg):
    pg.goto(BASE+'/'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('[data-act=new]', timeout=10000)
with sync_playwright() as p:
    ctl('/ctl/reset'); st=tok('sup','1111'); tt=tok('tech1','2222')
    call(st,{'action':'taskRuleCreate','task':{'title':'Weekly lube','equipment':'Shredder','equipmentNo':'SH-1','due':'2026-11-30'},'auto':{'basis':'period','period':'Weekly','assignees':['tech1']}})
    b,ctx,pg,errs=newpage(p, mobile=False); sup(pg)
    # --- meter reading on the equipment page
    pg.click('[data-sec=equipment]'); pg.wait_for_selector('[data-eqi]'); pg.click('[data-eqi="0"]'); pg.wait_for_selector('#mtCard'); pg.wait_for_selector('[data-mtadd]')
    check('meter card shown', 'Meters' in pg.inner_text('#mtCard'))
    pg.click('[data-mtadd]'); pg.wait_for_selector('#mtF'); pg.fill('#mtV','1200'); pg.click('#mtGo'); pg.wait_for_timeout(1500)
    check('meter saved', call(st,{'action':'meterList','no':'SH-1'})['latest']==1200)
    check('card shows latest', '1200' in pg.inner_text('#mtCard'), pg.inner_text('#mtCard'))
    pg.click('[data-mtadd]'); pg.wait_for_selector('#mtF'); pg.fill('#mtV','50'); pg.click('#mtGo'); pg.wait_for_timeout(800)
    check('lower reading refused with a message', 'replaced' in pg.inner_text('#mtMsg').lower(), pg.inner_text('#mtMsg'))
    pg.evaluate("document.getElementById('taskModal').classList.remove('open')")
    # --- limits
    pg.click('[data-sec=tasks]'); pg.wait_for_selector('#dLimits'); pg.click('#dLimits'); pg.wait_for_selector('#lmNew'); pg.click('#lmNew'); pg.wait_for_selector('#lmF')
    pg.wait_for_selector('#lmRow option[value="3"]', state='attached', timeout=8000)
    pg.select_option('#lmRow','3'); pg.fill('#lmMax','45'); pg.select_option('#lmW','tech2'); pg.click('#lmGo'); pg.wait_for_selector('[data-lm]', timeout=8000)
    L=call(st,{'action':'limits'})['limits']; check('limit saved from UI', len(L)==1 and L[0]['max']=='45' and L[0]['row']==3 and L[0]['assignee']=='tech2', L)
    check('limit listed with label', 'Shredder motor' in pg.inner_text('#lmBody'), pg.inner_text('#lmBody'))
    r=call(tt,{'action':'saveReading','sheet':'Amp Rec','row':3,'value':'52'}); check('bad reading makes a work order', bool(r.get('limitTask')), r)
    pg.evaluation = None
    pg.evaluate("document.getElementById('taskModal').classList.remove('open')"); pg.click('[data-sec=overview]'); pg.click('[data-sec=tasks]'); pg.click('#dRefresh'); pg.wait_for_timeout(1500)
    check('limit work order on the board', pg.locator('.tcard', has_text='Shredder motor').count()==1, pg.inner_text('#dBoard')[:300])
    # delete limit
    pg.click('#dLimits'); pg.wait_for_selector('[data-lm]'); pg.click('[data-lm]'); pg.wait_for_selector('#lmDel'); pg.click('#lmDel'); pg.wait_for_selector('#lmNew'); 
    check('limit deleted', call(st,{'action':'limits'})['limits']==[])
    pg.evaluate("document.getElementById('taskModal').classList.remove('open')")
    # --- PM section
    pg.click('[data-sec=pm]'); pg.wait_for_selector('.pmgrid', timeout=8000)
    check('calendar shows repeat work order', pg.locator('.pmi', has_text='Weekly lube').count()>=1, pg.inner_text('.pmgrid')[:200])
    check('compliance table present', 'on-time' in pg.inner_text('#dBody').lower() and pg.locator('table.dtable').count()>=1)
    pg.click('[data-pm="1"]'); pg.wait_for_timeout(1200); check('month navigation works', pg.locator('.pmgrid').count()==1)
    pg.click('.pmi.plan, .pmi') if pg.locator('.pmi:not(.plan)').count() else None
    check('no JS errors (supervisor PM)', not errs, errs); b.close()
    # --- phone width
    b,ctx,pg,errs=newpage(p, mobile=True); pg.goto(BASE+'/'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('.tile', timeout=10000)
    pg.click('.tile:has-text("Preventive maintenance")'); pg.wait_for_selector('.pmgrid', timeout=10000); pg.wait_for_timeout(1000)
    check('phone: no horizontal overflow on PM page', pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+1"), pg.evaluate("document.documentElement.scrollWidth"))
    pg.screenshot(path='/tmp/pm_phone.png', full_page=False); b.close()
    # technicians do not get the PM section
    b,ctx,pg,errs=newpage(p, mobile=True); pg.goto(BASE+'/'); pg.fill('#username','tech1'); pg.fill('#pin','2222'); pg.click('#btn'); pg.wait_for_selector('#taskBox:not(.hidden)')
    check('technician has no PM entry', pg.locator('[data-sec=pm]').count()==0 and pg.locator('.tile:has-text("Preventive")').count()==0); b.close()
print(f"\nbrowser-pm: {R['pass']} passed, {R['fail']} failed")
for f in R['f']: print('  FAIL',f)
sys.exit(1 if R['fail'] else 0)
