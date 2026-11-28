import sys, json, datetime
from bt_common import *
R={'pass':0,'fail':0,'f':[]}
def check(n,c,x=''):
    if c: R['pass']+=1
    else: R['fail']+=1; R['f'].append(n+(' :: '+str(x)[:400] if x else ''))
def call(tok,b): return json.loads(ctl('/ctl/call', json.dumps(dict(b,token=tok))))
def tok(u,p): return json.loads(ctl('/ctl/call', json.dumps({'action':'login','username':u,'pin':p})))['token']
def signin(pg,u,pin):
    pg.goto(BASE+'/'); pg.fill('#username',u); pg.fill('#pin',pin); pg.click('#btn')
def closed(pg): pg.wait_for_function("!document.getElementById('taskModal').classList.contains('open')", timeout=15000)
with sync_playwright() as p:
    ctl('/ctl/reset'); st=tok('sup','1111')
    wk=datetime.date.fromisoformat(call(st,{'action':'schedule'})['from']); assert (wk.weekday()+1)%7==0, 'mock clock must be a Sunday: %s'%wk
    D=lambda n: (wk+datetime.timedelta(days=n)).isoformat()
    # ---------- supervisor builds a procedure
    b,ctx,pg,errs1=newpage(p, mobile=False); signin(pg,'sup','1111'); pg.wait_for_selector('[data-sec=procedures]', timeout=20000)
    pg.click('[data-sec=procedures]'); pg.wait_for_selector('#prcNew'); pg.click('#prcNew'); pg.wait_for_selector('#pfF')
    pg.click('#pfF button[type=submit]'); check('name required', 'name' in pg.inner_text('#pfM').lower(), repr(pg.inner_text('#pfM')))
    pg.fill('#pfN','Shredder start-up'); pg.fill('[data-i="0"][data-f="text"]','Guard in place')
    pg.click('#pfAdd'); pg.fill('[data-i="1"][data-f="text"]','Describe the damage'); pg.select_option('[data-i="1"][data-f="type"]','text'); pg.select_option('[data-i="1"][data-f="cond"]','0:fail')
    pg.click('#pfAdd'); pg.fill('[data-i="2"][data-f="text"]','Motor temperature'); pg.select_option('[data-i="2"][data-f="type"]','number')
    pg.fill('[data-i="2"][data-f="min"]','20'); pg.fill('[data-i="2"][data-f="max"]','80'); pg.fill('[data-i="2"][data-f="unit"]','C')
    check('condition list only offers earlier pass/fail steps', pg.locator('[data-i="2"][data-f="cond"] option').count()==3, pg.locator('[data-i="2"][data-f="cond"] option').count())
    pg.click('#pfAdd'); pg.fill('[data-i="3"][data-f="text"]','Spare step'); pg.click('[data-del="3"]'); check('delete a step', pg.locator('[data-i][data-f=text]').count()==3)
    pg.click('#pfF button[type=submit]'); closed(pg)
    pl=call(st,{'action':'procedures'})['procedures']; s=pl[0]['steps'] if pl else []
    check('procedure saved with 3 steps, condition and limits', len(pl)==1 and len(s)==3 and s[1]['showIf']=={'step':'s1','when':'fail'} and (s[2]['min'],s[2]['max'],s[2]['unit'])==(20,80,'C'), pl)
    pg.wait_for_selector('text=Shredder start-up'); check('listed in the screen', pg.locator('.rprow:has-text("Shredder start-up")').count()==1)
    # move step 3 above step 2: condition on step 2 must drop? (up on step index 2 swaps with the conditional step)
    ctx.close(); b.close()
    # ---------- technician runs it from the home tile (conditional step + failure → work order)
    b,ctx,pg,errs2=newpage(p, mobile=True); login(pg,'tech2','2223'); pg.wait_for_selector('#tiles .tile', timeout=10000)
    pg.click('#tiles .tile:has-text("Run a procedure")'); pg.wait_for_selector('[data-pp="0"]'); pg.click('[data-pp="0"]'); pg.wait_for_selector('#rnF')
    check('follow-up step hidden at first', pg.locator('[data-txt="s2"]').count()==0)
    pg.click('[data-ans="s1:pass"]'); check('still hidden after Pass', pg.locator('[data-txt="s2"]').count()==0)
    pg.click('[data-ans="s1:fail"]'); pg.wait_for_selector('[data-txt="s2"]'); check('shown after Fail, with note box', pg.locator('[data-note="s1"]').count()==1)
    pg.fill('#rnA','shred'); pg.wait_for_selector('[data-pick="0"]'); pg.click('[data-pick="0"]'); check('asset chosen', 'Shredder' in pg.inner_text('#rnAs'))
    pg.click('#rnGo'); check('note required on fail', 'note' in pg.inner_text('#rnM').lower() or 'failed' in pg.inner_text('#rnM').lower(), pg.inner_text('#rnM'))
    pg.fill('[data-note="s1"]','Bolt missing'); pg.fill('[data-txt="s2"]','Guard hinge bent'); pg.fill('[data-num="s3"]','95'); pg.click('#rnGo')
    pg.wait_for_selector('#rnClose', timeout=15000); check('result says 2 problems and shows the new work order', '2 problem' in pg.inner_text('#taskBody') and 'T-' in pg.inner_text('#taskBody'), pg.inner_text('#taskBody')[:200])
    runs=call(st,{'action':'procedureRuns'})['runs']; tk=[t for t in json.loads(ctl('/ctl/tasks')) if t['Source']=='Procedure']
    check('run saved as Failed with the asset; work order created High', len(runs)==1 and runs[0]['result']=='Failed' and runs[0]['assetNo']=='SH-1' and len(tk)==1 and tk[0]['Priority']=='High', (runs,tk))
    ctx.close(); b.close()
    # ---------- work order that carries a procedure
    wo=call(st,{'action':'taskCreate','task':{'title':'Weekly start-up check','assignee':'tech1','equipment':'Shredder','equipmentNo':'SH-1','procedure':'P-001'}})['task']['id']
    b,ctx,pg,errs3=newpage(p, mobile=True); login(pg,'tech1','2222'); pg.wait_for_selector('[data-task="%s"]'%wo, timeout=10000); pg.click('[data-task="%s"]'%wo)
    pg.click('#taskStart'); pg.wait_for_selector('#taskDoneOpen'); check('procedure button on the sheet', pg.locator('#taskProc').count()==1)
    pg.click('#taskDoneOpen'); pg.wait_for_selector('#rnF', timeout=10000); check('Done is blocked until the procedure is done (form opened)', pg.locator('#taskNote').count()==0)
    pg.click('[data-ans="s1:pass"]'); pg.fill('[data-num="s3"]','50'); pg.click('#rnGo'); pg.wait_for_selector('#rnClose', timeout=15000); check('all passed', 'All checks passed' in pg.inner_text('#taskBody'))
    pg.click('#rnClose'); pg.wait_for_selector('#taskDoneOpen'); check('back on the task sheet, marked done', 'done' in pg.inner_text('#taskProc').lower(), pg.inner_text('#taskProc'))
    pg.click('#taskDoneOpen'); pg.wait_for_selector('#taskNote'); pg.fill('#taskNote','ok'); pg.click('#taskDoneOk'); closed(pg); pg.wait_for_timeout(2500)
    d=[x for x in json.loads(ctl('/ctl/tasks')) if x['ID']==wo][0]; check('work order finished', d['Status']=='Done', d['Status'])
    ctx.close(); b.close()
    # ---------- audit sheet + task detail link
    b,ctx,pg,errs4=newpage(p, mobile=False); pg.on('pageerror', lambda e: print('PAGEERR', e.stack)); pg.on('console', lambda m: print('STEP-LOG') if False else None); signin(pg,'sup','1111'); pg.wait_for_selector('[data-sec=procedures]', timeout=20000); pg.click('[data-sec=procedures]'); pg.wait_for_selector('[data-prct=runs]'); pg.click('[data-prct=runs]')
    pg.wait_for_selector('[data-prca]'); check('both runs listed, newest first', pg.locator('[data-prca]').count()==2); pg.locator('.rprow:has-text("Failed") [data-prca]').click(); pg.wait_for_selector('.audtbl')
    tx=pg.inner_text('#audBody'); check('audit shows steps, note, answer and result', 'Bolt missing' in tx and 'Guard hinge bent' in tx and '95' in tx and '✗' in tx, tx[:300])
    pg.evaluate("window.print=()=>{window.__printed=1}"); pg.click('#audPrint'); pg.wait_for_function("window.__printed===1", timeout=5000); check('print page filled', 'Bolt missing' in pg.evaluate("document.getElementById('printReport').innerText"))
    pg.click('#audBack')
    # task detail shows runs
    pg.click('[data-sec=tasks]'); pg.wait_for_timeout(500); pg.locator('[data-tid="%s"]'%wo).first.click(); pg.wait_for_selector('#dProc [data-aud]', timeout=10000); check('task detail lists its run with an Audit button', pg.locator('#dProc [data-aud]').count()==1)
    pg.evaluate("document.getElementById('taskModal').classList.remove('open')")
    # work order form: procedure select + estimate
    for h in (2,3):
        i=call(st,{'action':'taskCreate','task':{'title':'Grease bearings','assignee':'tech1','equipment':'Shredder','equipmentNo':'SH-1'}})['task']['id']; call(tok('tech1','2222'),{'action':'taskUpdate','id':i,'status':'Done','note':'x','hours':h})
    pg.click('[data-act=new]'); pg.wait_for_selector('#dForm'); check('procedure choice offered', pg.locator('#fProc option').count()==2)
    pg.fill('#fTitle','Grease bearings'); pg.fill('#fEq','shred'); pg.wait_for_selector('#eqList [data-eqi], #eqList .rprow, #eqList button', timeout=5000)
    pg.locator('#eqList [data-eqi], #eqList .rprow, #eqList button').first.click(); pg.wait_for_function("document.getElementById('fEst').textContent.includes('2.5')", timeout=8000); check('typical time hint shown', 'Typical time: 2.5 h' in pg.inner_text('#fEst'), pg.inner_text('#fEst'))
    pg.evaluate("document.getElementById('taskModal').classList.remove('open')")
    # ---------- purchasing
    pg.click('[data-sec=purchasing]'); pg.wait_for_selector('#poNew'); pg.click('#poNew'); pg.wait_for_selector('#pfm')
    pg.click('#pfm button[type=submit]'); check('PO needs a part', 'at least one' in pg.inner_text('#poM').lower(), pg.inner_text('#poM'))
    pg.fill('#poQ','E-100'); pg.wait_for_selector('[data-h="0"]'); pg.click('[data-h="0"]'); pg.fill('[data-q="0"]','3'); pg.fill('[data-c="0"]','20'); check('total updates', pg.inner_text('#poT').strip()=='60', pg.inner_text('#poT'))
    pg.fill('#poN','For shutdown'); pg.click('#pfm button[type=submit]'); closed(pg); pg.wait_for_selector('.rprow:has-text("PO-0001")')
    check('request listed as waiting approval', 'Waiting approval' in pg.inner_text('.rprow:has-text("PO-0001")'))
    pg.click('[data-poa="PO-0001"]'); pg.wait_for_selector('[data-poo="PO-0001"]'); pg.click('[data-poo="PO-0001"]'); pg.wait_for_selector('[data-pov="PO-0001"]')
    before=[x for x in call(st,{'action':'spares'})['spares']['electrical'] if x['no']=='E-100'][0]['qty']
    pg.click('[data-pov="PO-0001"]'); pg.wait_for_selector('#rvF'); pg.fill('[data-rv="0"]','2'); pg.click('#rvF button[type=submit]'); closed(pg); pg.wait_for_selector('.rprow:has-text("Partly received")')
    pg.click('[data-pov="PO-0001"]'); pg.wait_for_selector('#rvF'); check('remaining quantity offered', pg.input_value('[data-rv="0"]')=='1'); pg.click('#rvF button[type=submit]'); closed(pg)
    after=[x for x in call(st,{'action':'spares'})['spares']['electrical'] if x['no']=='E-100'][0]['qty']; check('stock raised by 3', int(after)-int(before)==3, (before,after))
    pg.click('[data-puf="1"]'); pg.wait_for_selector('.rprow:has-text("PO-0001")'); check('closed as Received', 'Received' in pg.inner_text('.rprow:has-text("PO-0001")'))
    # reject
    call(st,{'action':'poCreate','po':{'lines':[{'kind':'electrical','no':'E-100','qty':1}]}}); pg.click('#dRefresh'); pg.wait_for_selector('[data-por="PO-0002"]'); pg.click('[data-por="PO-0002"]'); pg.wait_for_selector('#prF')
    pg.click('#prF button[type=submit]'); check('reason needed', 'reason' in pg.inner_text('#prM').lower(), pg.inner_text('#prM')); pg.fill('#prN','Too expensive'); pg.click('#prF button[type=submit]'); closed(pg)
    check('rejected with reason', call(st,{'action':'poList'})['orders'][0]['status'] in ('Requested','Rejected') and [o for o in call(st,{'action':'poList'})['orders'] if o['id']=='PO-0002'][0]['decisionNote']=='Too expensive')
    # ---------- schedule
    a=call(st,{'action':'taskCreate','task':{'title':'Replace belt','assignee':'tech1','due':D(1),'equipment':'Shredder','equipmentNo':'SH-1'}})['task']['id']
    c=call(st,{'action':'taskCreate','task':{'title':'Oil change','assignee':'tech1','due':D(1)}})['task']['id']
    call(st,{'action':'taskCreate','task':{'title':'Floating job','assignee':'tech2'}})
    pg.click('[data-sec=schedule]'); pg.wait_for_selector('.sccell', timeout=15000)
    cell=lambda d,u: pg.locator('.sccell[data-scd="%s"][data-scu="%s"]'%(D(d),u))
    check('Sunday–Thursday working, Friday/Saturday rest', 'work' in (cell(0,'tech1').get_attribute('class')) and 'rest' in cell(5,'tech1').get_attribute('class'))
    check('task on its day with load/capacity', cell(1,'tech1').locator('.scchip').count()==2 and '/ 8 h' in cell(1,'tech1').inner_text(), cell(1,'tech1').inner_text())
    pg.locator('.scchip[data-sct="%s"]'%a).drag_to(cell(2,'tech1')); pg.wait_for_function("document.querySelector('.sccell[data-scd=\"%s\"][data-scu=\"tech1\"] .scchip[data-sct=\"%s\"]')"%(D(2),a), timeout=10000)
    check('drag to another day changes the due date', [t for t in json.loads(ctl('/ctl/tasks')) if t['ID']==a][0]['Due']==D(2))
    pg.locator('.scchip[data-sct="%s"]'%c).click(); cell(3,'tech2').click(); pg.wait_for_function("document.querySelector('.sccell[data-scd=\"%s\"][data-scu=\"tech2\"] .scchip[data-sct=\"%s\"]')"%(D(3),c), timeout=10000)
    t2=[t for t in json.loads(ctl('/ctl/tasks')) if t['ID']==c][0]; check('tap then tap moves day and person', (t2['Due'],t2['Assigned To'])==(D(3),'tech2'), t2['Due'])
    check('unscheduled work listed under backlog', 'Floating job' in pg.inner_text('.scback'))
    # time off then conflict
    pg.click('#scShifts'); pg.wait_for_selector('#toF'); pg.select_option('#toWho','tech2'); pg.fill('#toFrom',D(4)); pg.fill('#toTo',D(4)); pg.select_option('#toType','Sick'); pg.click('#toF button[type=submit]'); pg.wait_for_selector('[data-sto]')
    pg.fill('[data-shh="tech1"]','6'); pg.locator('[data-shd="tech1"][value="5"]').check(); pg.click('[data-shs="tech1"]'); pg.wait_for_timeout(800); pg.click('#shClose'); pg.wait_for_selector('.sccell', timeout=10000)
    check('time off shows on the board', 'off' in cell(4,'tech2').get_attribute('class') and 'Sick' in cell(4,'tech2').inner_text(), cell(4,'tech2').get_attribute('class'))
    check('Friday is now a working day for tech1 with 6 h', 'work' in cell(5,'tech1').get_attribute('class') and '/ 6 h' in cell(5,'tech1').inner_text(), cell(5,'tech1').inner_text())
    pg.locator('.scchip[data-sct="%s"]'%a).click(); cell(4,'tech2').click(); pg.wait_for_selector('#scForce'); check('conflict warning, nothing moved yet', 'not working' in pg.inner_text('#taskBody') and [t for t in json.loads(ctl('/ctl/tasks')) if t['ID']==a][0]['Due']==D(2), pg.inner_text('#taskBody'))
    pg.click('#scForce'); pg.wait_for_function("document.querySelector('.sccell[data-scd=\"%s\"][data-scu=\"tech2\"] .scchip[data-sct=\"%s\"]')"%(D(4),a), timeout=10000)
    t3=[t for t in json.loads(ctl('/ctl/tasks')) if t['ID']==a][0]; check('Move anyway moves it', (t3['Due'],t3['Assigned To'])==(D(4),'tech2'), t3)
    pg.click('[data-scn="7"]'); pg.wait_for_function("document.querySelector('.scrow.schead')&&!document.querySelector('.sccell[data-scd=\"%s\"]')"%D(1), timeout=10000); check('next week shows other days', pg.locator('.sccell[data-scd="%s"]'%D(8)).count()>0)
    allerr=errs1+errs2+errs3+errs4; check('no page errors', not allerr, allerr)
    ctx.close(); b.close()
print('bt_plan: %d passed, %d failed'%(R['pass'],R['fail']))
for f in R['f']: print('  FAIL',f)
sys.exit(1 if R['fail'] else 0)
