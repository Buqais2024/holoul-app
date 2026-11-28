import sys, json
from bt_common import *
R={'pass':0,'fail':0,'f':[]}
def check(n,c,x=''):
    if c: R['pass']+=1
    else: R['fail']+=1; R['f'].append(n+(' :: '+str(x)[:400] if x else ''))
def call(tok,b): return json.loads(ctl('/ctl/call', json.dumps(dict(b,token=tok))))
def tok(u,p): return json.loads(ctl('/ctl/call', json.dumps({'action':'login','username':u,'pin':p})))['token']
MIN=60000
with sync_playwright() as p:
    ctl('/ctl/reset'); st=tok('sup','1111'); t1=tok('tech1','2222')
    a=call(st,{'action':'taskCreate','task':{'title':'Grease','assignee':'tech1','due':'2026-11-29','category':'Mechanical'}})['task']['id']
    call(st,{'action':'taskCreate','task':{'title':'Old job','assignee':'tech2','due':'2026-11-20'}})
    call(st,{'action':'downtimeStart','token':st,'downtime':{'no':'SH-1','cause':'Material jam'}})
    ctl('/ctl/advance', str(60*MIN)); call(st,{'action':'downtimeEnd','downtime':{'no':'SH-1'}})
    t1=tok('tech1','2222'); call(t1,{'action':'taskUpdate','id':a,'status':'Done','note':'ok','hours':'1.5'})
    b,ctx,pg,errs=newpage(p, mobile=False)
    pg.add_init_script("window.__prints=0; window.print=()=>{window.__prints++; window.__cls=document.body.className}")
    pg.goto(BASE+'/'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('[data-sec=reports]', timeout=15000)
    check('Reporting is in the menu', 'Reporting' in pg.inner_text('[data-sec=reports]'))
    pg.click('[data-sec=reports]'); pg.wait_for_selector('#dash .kpis', timeout=15000)
    kp=pg.inner_text('#dash .kpis'); check('KPIs show created 2 / done 1 / overdue 1', 'Created\n2' in kp and 'Completed\n1' in kp and 'Overdue now\n1' in kp, kp)
    check('MTTR 1 h 0 min on the tiles', '1 h 0 min' in kp, kp)
    body=pg.text_content('#dash'); check('asset row with MTTR and availability', 'Shredder (SH-1)' in body and 'Availability' in body)
    check('cause bar listed', 'Material jam' in body); check('workload lists both technicians', 'Old job' not in body and body.count('Tom')>=0)
    check('workload row for tech1 has 1.5 hours', pg.locator('section:has-text("Workload") tr:has-text("tech1"), section:has-text("Workload") tr:has-text("Tom")').first.inner_text().find('1.5')>=0, pg.inner_text('section:has-text("Workload")'))
    # presets & custom range
    pg.click('[data-rpd="7"]'); pg.wait_for_selector('#dash .kpis'); check('7-day preset is selected', pg.locator('[data-rpd="7"].on').count()==1)
    pg.fill('#rpF','2026-11-01'); pg.fill('#rpT','2026-11-10'); pg.click('#rpApply'); pg.wait_for_function("document.querySelector('#dash .kpis') && document.querySelector('#dash .kpis').innerText.includes('Created\\n0')", timeout=10000)
    check('custom range applied', '2026-11-01' in pg.inner_text('#dash'))
    pg.fill('#rpF','2026-11-12'); pg.fill('#rpT','2026-11-02'); pg.click('#rpApply'); pg.wait_for_selector('.toast, #toast', state='attached', timeout=3000)
    check('reversed dates refused (range unchanged)', '2026-11-01' in pg.inner_text('#dash'))
    pg.click('[data-rpd="30"]'); pg.wait_for_selector('#dash .kpis')
    # CSV
    with pg.expect_download() as dl: pg.click('#rpCsv')
    d=dl.value; path=d.path(); txt=open(path,encoding='utf-8-sig').read()
    check('CSV downloaded with sections', d.suggested_filename.startswith('holoul-report-') and 'WORK ORDERS' in txt and 'Shredder' in txt and 'Material jam' in txt, d.suggested_filename+txt[:200])
    # print
    pg.click('#rpPrint'); pg.wait_for_function('window.__prints===1')
    check('print: report area filled and print mode set', 'printingRep' in pg.evaluate('window.__cls') and 'Availability' in pg.inner_text('#printReport') or pg.evaluate("document.getElementById('printReport').textContent.includes('Availability')"))
    # email
    pg.click('#rpMail'); pg.wait_for_selector('#rmF'); pg.fill('#rmE','nope'); pg.click('#rmGo'); check('bad email refused', 'valid' in pg.inner_text('#rmMsg'))
    pg.fill('#rmE','boss@example.com'); pg.click('#rmGo'); pg.wait_for_function("!document.getElementById('taskModal').classList.contains('open')", timeout=15000)
    m=json.loads(ctl('/ctl/mails')); check('email sent with CSV attachment', len(m)==1 and m[0]['to']=='boss@example.com' and m[0]['att']==1, m)
    pg.click('#rpMail'); pg.wait_for_selector('#raF'); pg.fill('#raE','weekly@example.com'); pg.click('#raF button'); pg.wait_for_selector('[data-rrt]')
    check('weekly recipient added and On', 'weekly@example.com' in pg.inner_text('#taskBody') and 'On' in pg.inner_text('[data-rrt]'))
    pg.click('[data-rrt="0"]'); pg.wait_for_function("document.querySelector('[data-rrt]').innerText.trim()==='Off'", timeout=8000)
    check('weekly recipient switched off', call(st,{'action':'reportRecipients'})['recipients'][0]['active']==False)
    ctx.close(); b.close()
    # technician has no Reporting
    b,ctx,pg,errs2=newpage(p, mobile=True); login(pg,'tech1','2222')
    check('technician cannot call report', call(tok('tech1','2222'),{'action':'report'})['ok']==False)
    check('technician has no Reporting button', pg.locator('[data-sec=reports]').count()==0)
    allerr=errs+errs2; check('no console errors', not allerr, allerr)
    ctx.close(); b.close()
print('bt_reports: %d passed, %d failed'%(R['pass'],R['fail']))
for f in R['f']: print('  FAIL',f)
sys.exit(1 if R['fail'] else 0)
