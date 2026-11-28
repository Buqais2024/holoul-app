import sys, json
from bt_common import *
R={'pass':0,'fail':0,'f':[]}
def check(n,c,x=''):
    if c: R['pass']+=1
    else: R['fail']+=1; R['f'].append(n+(' :: '+str(x)[:300] if x else ''))
def call(tok,b): return json.loads(ctl('/ctl/call', json.dumps(dict(b,token=tok))))
def tok(u,p): return json.loads(ctl('/ctl/call', json.dumps({'action':'login','username':u,'pin':p})))['token']
def signin(pg,u,pin,url='/'):
    pg.goto(BASE+url); pg.fill('#username',u); pg.fill('#pin',pin); pg.click('#btn')
with sync_playwright() as p:
    ctl('/ctl/reset'); st=tok('sup','1111')
    b,ctx,pg,errs=newpage(p, mobile=False); signin(pg,'sup','1111','/#part=e:E-100')
    pg.wait_for_selector('#pstCard .kpi', timeout=15000)
    check('stock card shows on hand 5', '5' in pg.inner_text('#pstCard .kpi'), pg.inner_text('#pstCard'))
    # vendor
    pg.click('[data-spback]'); pg.wait_for_selector('[data-act=vendors]'); pg.click('[data-act=vendors]'); pg.wait_for_selector('#vAdd')
    pg.click('#vAdd'); pg.fill('#vN','ABB Saudi'); pg.fill('#vP','055123'); pg.click('#vGo'); pg.wait_for_selector('text=ABB Saudi')
    check('vendor saved', call(st,{'action':'vendors'})['vendors'][0]['name']=='ABB Saudi')
    pg.evaluate("document.getElementById('taskModal').classList.remove('open')")
    pg.fill('#spQ','E-100'); pg.click('[data-spi="0"]'); pg.wait_for_selector('[data-pst=receive]')
    # receive
    pg.click('[data-pst=receive]'); pg.fill('#stQ','10'); pg.fill('#stC','20'); pg.fill('#stN','PO 5'); pg.click('#stGo')
    pg.wait_for_function("document.querySelector('#pstCard .kpi b') && document.querySelector('#pstCard .kpi b').textContent.trim()=='15'", timeout=10000)
    check('receive: on hand 15', True); i=call(st,{'action':'partInfo','kind':'electrical','no':'E-100'})
    check('receive: cost saved + logged', i['stock']['cost']==20 and i['moves'][0]['type']=='Received', i)
    # count
    pg.click('[data-pst=count]'); pg.click('#stGo'); check('count: empty refused', 'count' in pg.inner_text('#stMsg').lower(), pg.inner_text('#stMsg'))
    pg.fill('#stQ','12'); pg.click('#stGo')
    pg.wait_for_function("(document.querySelector('#pstCard .kpi b')||{textContent:''}).textContent.trim()=='12'", timeout=10000)
    check('count: on hand 12', call(st,{'action':'partInfo','kind':'electrical','no':'E-100'})['part']['onHand']==12)
    # details: vendor + minimum -> low
    pg.click('[data-pst=details]'); pg.select_option('#pdV', label='ABB Saudi'); pg.fill('#pdM','12'); pg.fill('#pdB','Shelf B2'); pg.click('#pdGo')
    pg.wait_for_selector('#pstCard .offtag', timeout=10000)
    check('low tag shown at the minimum', 'Low' in pg.inner_text('#pstCard h4'), pg.inner_text('#pstCard h4'))
    check('vendor and bin shown', 'ABB Saudi' in pg.inner_text('#pstCard') and 'Shelf B2' in pg.inner_text('#pstCard'))
    check('stock history lists 3 movements', pg.locator('#pstCard .rprow').count()==2, pg.locator('#pstCard .rprow').count())
    # list shows cost + low filter link
    pg.click('[data-spback]'); pg.wait_for_selector('.dtable')
    check('list has a cost column with 20', '20' in pg.inner_text('tr:has-text("E-100")'), pg.inner_text('tr:has-text("E-100")'))
    ctx.close(); b.close()
    # low link
    b,ctx,pg,errs2=newpage(p, mobile=False); signin(pg,'sup','1111','/#part=low'); pg.wait_for_selector('#spLow')
    check('#part=low turns the low filter on', pg.is_checked('#spLow') and pg.locator('[data-spi]').count()==1, pg.locator('[data-spi]').count())
    ctx.close(); b.close()
    # technician flow
    wo=call(st,{'action':'taskCreate','task':{'title':'Replace contactor','assignee':'tech1','equipment':'Shredder','equipmentNo':'SH-1'}})['task']['id']
    b,ctx,pg,errs3=newpage(p, mobile=True); login(pg,'tech1','2222'); pg.click('[data-sec=tasks]') if pg.locator('[data-sec=tasks]').count() else None
    pg.wait_for_selector('[data-task="%s"]'%wo, timeout=10000); pg.click('[data-task="%s"]'%wo); pg.click('#taskStart'); pg.wait_for_selector('#taskParts', timeout=10000)
    pg.click('#taskParts'); pg.wait_for_selector('#wAdd', timeout=10000)
    check('empty parts list', 'No parts' in pg.inner_text('#taskBody'), pg.inner_text('#taskBody'))
    pg.click('#wAdd'); pg.fill('#ppQ','contactor'); pg.wait_for_function("document.querySelectorAll('[data-ppi]').length==1", timeout=10000); pg.click('[data-ppi="0"]')
    pg.fill('#pqQ','20'); pg.click('#pqGo'); pg.wait_for_function("document.getElementById('pqMsg').textContent.length>0", timeout=10000); check('too many refused', 'Only' in pg.inner_text('#pqMsg'), pg.inner_text('#pqMsg'))
    pg.fill('#pqQ','2'); pg.fill('#pqN','new one'); pg.click('#pqGo'); pg.wait_for_selector('[data-wret]', timeout=10000)
    t=pg.inner_text('#taskBody'); check('line shows Contactor x 2 without money', 'Contactor' in t and '× 2' in t and 'Parts cost' not in t and '40' not in t, t)
    check('backend: stock 10', call(st,{'action':'partInfo','kind':'electrical','no':'E-100'})['part']['onHand']==10)
    pg.click('[data-wret="0"]'); pg.fill('#pqQ','1'); pg.click('#pqGo'); pg.wait_for_function("document.getElementById('taskBody').innerText.includes('× 1')", timeout=10000)
    check('return puts 1 back', call(st,{'action':'partInfo','kind':'electrical','no':'E-100'})['part']['onHand']==11)
    pg.click('#wBack'); pg.wait_for_selector('#taskParts'); check('close returns to the task', 'Replace contactor' in pg.inner_text('#taskBody'))
    ctx.close(); b.close()
    # supervisor sees cost on the work order
    b,ctx,pg,errs4=newpage(p, mobile=False); signin(pg,'sup','1111'); pg.wait_for_selector('[data-sec=tasks]'); pg.click('[data-sec=tasks]'); pg.click('#dRefresh'); pg.wait_for_timeout(1200)
    pg.click('text=Replace contactor'); pg.wait_for_selector('#dParts'); pg.click('#dParts'); pg.wait_for_selector('#wAdd')
    t=pg.inner_text('#taskBody'); check('manager sees cost 20 and total', 'Parts cost: 20' in t, t)
    pg.click('#wBack'); pg.wait_for_selector('#dParts'); check('manager close returns to the work order', 'Replace contactor' in pg.inner_text('#taskBody'))
    allerr=errs+errs2+errs3+errs4; check('no console errors', not allerr, allerr)
    ctx.close(); b.close()
print('bt_parts: %d passed, %d failed'%(R['pass'],R['fail']))
for f in R['f']: print('  FAIL',f)
sys.exit(1 if R['fail'] else 0)
