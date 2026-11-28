import sys, json, subprocess
from bt_common import *
R={'pass':0,'fail':0,'f':[]}
def check(n,c,x=''):
    if c: R['pass']+=1
    else: R['fail']+=1; R['f'].append(n+(' :: '+str(x)[:300] if x else ''))
def call(tok,b): return json.loads(ctl('/ctl/call', json.dumps(dict(b,token=tok))))
def tok(u,p): return json.loads(ctl('/ctl/call', json.dumps({'action':'login','username':u,'pin':p})))['token']
def decode(svg): return subprocess.run(['node','/tmp/qrlib/decode.js'],input=svg,capture_output=True,text=True).stdout.strip()
STUB="window.__prints=0; window.print=()=>{window.__prints++}"
def signin(pg,u,pin,url='/'):
    pg.add_init_script(STUB); pg.goto(BASE+url); pg.fill('#username',u); pg.fill('#pin',pin); pg.click('#btn')
def close_modal(pg): pg.evaluate("document.getElementById('taskModal').classList.remove('open')")
with sync_playwright() as p:
    ctl('/ctl/reset'); st=tok('sup','1111'); t1=tok('tech1','2222'); t2=tok('tech2','2223')
    # ---- supervisor, desktop: a QR link opens the asset right after sign-in
    b,ctx,pg,errs=newpage(p, mobile=False); signin(pg,'sup','1111','/#asset=SH-1')
    pg.wait_for_selector('.eqhead h3', timeout=12000)
    check('QR link opens the asset after sign-in', pg.text_content('.eqhead h3').strip()=='Shredder', pg.inner_text('#dBody')[:200] if pg.locator('#dBody').count() else '')
    check('link is removed from the address bar', '#asset' not in pg.url, pg.url)
    pg.wait_for_selector('.stbar')
    check('asset is Online at first', 'Online' in pg.inner_text('.stbar'), pg.inner_text('.stbar'))
    # ---- mark offline from the page
    pg.click('[data-dtgo]'); pg.wait_for_selector('#dtF')
    pg.click('#dtGo'); check('cause is required for unplanned', 'cause' in pg.inner_text('#dtMsg').lower(), pg.inner_text('#dtMsg'))
    pg.select_option('#dtC','Material jam'); pg.fill('#dtN','Jammed at the feed'); pg.click('#dtGo')
    pg.wait_for_selector('.stbar.off', timeout=8000)
    check('card turns Offline with cause', 'Offline' in pg.inner_text('.stbar') and 'Material jam' in pg.inner_text('.stbar'), pg.inner_text('.stbar'))
    d=call(st,{'action':'downtimeList','no':'SH-1'}); check('downtime saved by the supervisor', d['open'] and d['open']['cause']=='Material jam' and d['open']['note']=='Jammed at the feed' and d['open']['startedBy']=='sup', d)
    # list shows the badge
    pg.click('[data-eqback]'); pg.wait_for_selector('[data-eqi]')
    check('offline badge in the asset list', pg.locator('tr:has-text("Shredder") .offtag').count()==1 and pg.locator('tr:has-text("Conveyor") .offtag').count()==0)
    pg.click('tr:has-text("Shredder")'); pg.wait_for_selector('.stbar.off')
    # ---- back online with a work order linked
    wo=call(st,{'action':'taskCreate','task':{'title':'Clear the feed','assignee':'tech1','equipment':'Shredder','equipmentNo':'SH-1','line':'L1'}})['task']['id']
    pg.click('#dRefresh') if pg.locator('#dRefresh').count() else None
    pg.click('[data-eqback]'); pg.click('tr:has-text("Shredder")'); pg.wait_for_selector('[data-dtgo]'); pg.wait_for_timeout(1200)
    pg.click('[data-dtgo]'); pg.wait_for_selector('#dtF'); pg.fill('#dtN','Cleared'); 
    opts=pg.eval_on_selector_all('#dtO option','e=>e.map(x=>x.value)'); check('work order offered for linking', wo in opts, opts)
    pg.select_option('#dtO',wo); pg.click('#dtGo'); pg.wait_for_selector('.stbar:not(.off)', timeout=8000)
    check('back Online', 'Online' in pg.inner_text('.stbar'))
    d=call(st,{'action':'downtimeList','no':'SH-1'}); check('closed entry keeps note and order', d['open'] is None and d['entries'][0]['order']==wo and 'Cleared' in d['entries'][0]['note'], d['entries'])
    pg.wait_for_timeout(800)
    check('history and cause ranking shown', 'Material jam' in pg.inner_text('#dBody') and 'Lost time by cause' in pg.inner_text('#dBody'))
    # ---- QR label for the asset
    pg.click('[data-qr]'); pg.wait_for_selector('#qrBox svg')
    svg=pg.eval_on_selector('#qrBox svg','e=>e.outerHTML'); got=decode(svg)
    check('QR on screen decodes to the asset link', got.endswith('#asset=SH-1') and got.startswith('http'), got)
    check('QR modal shows name and number', 'Shredder' in pg.inner_text('#qrBox') and 'SH-1' in pg.inner_text('#qrBox'))
    pg.click('#qrPrint'); pg.wait_for_timeout(400)
    check('print asked for one label', pg.evaluate('window.__prints')==1 and pg.locator('#printLabels .plabel').count()==1, pg.evaluate('window.__prints'))
    check('print layout is hidden on screen', pg.evaluate("getComputedStyle(document.getElementById('printLabels')).display")=='none')
    close_modal(pg)
    # ---- print all labels from the list
    pg.click('[data-eqback]'); pg.wait_for_selector('[data-act=printEq]'); pg.click('[data-act=printEq]'); pg.wait_for_timeout(500)
    check('all numbered assets get a label', pg.locator('#printLabels .plabel').count()==2, pg.locator('#printLabels .plabel').count())
    codes=[decode(pg.locator('#printLabels .plabel svg').nth(i).evaluate('e=>e.outerHTML')) for i in range(2)]
    check('every label decodes to its own link', sorted(c.split('#')[1] for c in codes)==['asset=BC-16','asset=SH-1'], codes)
    # ---- link while signed in
    pg.evaluate("location.hash='#asset=BC-16'"); pg.wait_for_selector('.eqhead h3:has-text("Conveyor")', timeout=8000)
    check('hashchange opens another asset', True)
    pg.evaluate("location.hash='#asset=NOPE'"); pg.wait_for_timeout(1500)
    check('unknown asset says so', 'not found' in pg.inner_text('#toast').lower(), pg.inner_text('#toast'))
    # ---- failure causes
    pg.click('[data-eqback]') if pg.locator('[data-eqback]').count() else None
    pg.wait_for_selector('[data-act=causes]'); pg.click('[data-act=causes]'); pg.wait_for_selector('[data-cn]')
    check('starter causes listed', pg.locator('[data-cn]').count()==9)
    pg.click('#cuAdd'); pg.keyboard.type('Belt slip'); pg.uncheck('[data-ca="8"]'); pg.click('#cuSave'); pg.wait_for_timeout(1000)
    c=call(st,{'action':'causes'}); check('causes saved from the form', 'Belt slip' in c['causes'] and 'Other' not in c['causes'] and len(c['all'])==10, c)
    # ---- meters
    pg.click('[data-eqi="1"]') if False else None
    pg.click('tr:has-text("Shredder")'); pg.wait_for_selector('[data-mtadd]'); pg.click('[data-mtadd]'); pg.wait_for_selector('#mtF')
    check('replaced tick shown for running hours only', pg.is_visible('#mtRW'))
    pg.select_option('#mtS','__new'); check('new meter asks for name and unit', pg.is_visible('#mtNm') and not pg.is_visible('#mtRW'))
    pg.fill('#mtNm','Oil pressure'); pg.fill('#mtUn','PSI'); pg.fill('#mtV','42'); pg.click('#mtGo'); pg.wait_for_timeout(1200)
    m=call(st,{'action':'meterList','no':'SH-1'}); check('named meter saved', any(x['name']=='Oil pressure' and x['unit']=='PSI' and x['latest']==42 for x in m['meters']), m['meters'])
    check('meter tile shows value and unit', '42' in pg.inner_text('#mtCard') and 'PSI' in pg.inner_text('#mtCard'), pg.inner_text('#mtCard'))
    pg.click('[data-mtadd]'); pg.wait_for_selector('#mtF'); check('the new meter is offered next time', 'Oil pressure' in pg.inner_text('#mtS'))
    pg.select_option('#mtS','Oil pressure'); pg.fill('#mtV','30'); pg.click('#mtGo'); pg.wait_for_timeout(1000)
    check('a lower pressure is accepted', call(st,{'action':'meterList','no':'SH-1'})['meters'][0]['latest'] in (30,42) and any(x['name']=='Oil pressure' and x['latest']==30 for x in call(st,{'action':'meterList','no':'SH-1'})['meters']))
    # ---- scan form (typed number)
    pg.click('[data-eqback]'); pg.click('[data-act=scanQr]'); pg.wait_for_selector('#scN'); pg.fill('#scN','BC-16'); pg.click('#scGo')
    pg.wait_for_selector('.eqhead h3:has-text("Conveyor")', timeout=8000); check('typing a number opens the asset', True)
    # ---- parts: QR link + labels
    pg.evaluate("location.hash='#part=m:M-7'"); pg.wait_for_selector('.eqhead h3:has-text("Shredder blade")', timeout=10000)
    check('part link opens the part', True)
    pg.click('[data-spqr]'); pg.wait_for_selector('#qrBox svg'); got=decode(pg.eval_on_selector('#qrBox svg','e=>e.outerHTML'))
    check('part QR decodes to the part link', got.endswith('#part=m:M-7'), got); close_modal(pg)
    pg.click('[data-spback]'); pg.click('[data-sp=electrical]'); pg.click('[data-act=printSp]'); pg.wait_for_timeout(500)
    check('parts labels: one per listed part', pg.locator('#printLabels .plabel').count()==1)
    check('labels use the part link format', decode(pg.locator('#printLabels .plabel svg').first.evaluate('e=>e.outerHTML')).endswith('#part=e:E-100'))
    check('no JS errors (supervisor)', not errs, errs); b.close()
    # ---- supervisor, phone: no overflow on the asset page
    b,ctx,pg,errs=newpage(p, mobile=True); signin(pg,'sup','1111','/#asset=SH-1'); pg.wait_for_selector('.eqhead h3', timeout=12000); pg.wait_for_timeout(1500)
    check('phone: no horizontal overflow on the asset page', pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+1"), pg.evaluate("document.documentElement.scrollWidth"))
    pg.screenshot(path='/tmp/asset_phone.png'); b.close()
    # ---- technician with a work order on the asset: card, then offline / online
    wo2=call(st,{'action':'taskCreate','task':{'title':'Replace blade','assignee':'tech1','equipment':'Shredder','equipmentNo':'SH-1','line':'L1'}})['task']['id']
    b,ctx,pg,errs=newpage(p, mobile=True); signin(pg,'tech1','2222','/#asset=SH-1'); pg.wait_for_selector('#acDt', timeout=12000)
    check('technician sees the asset card', 'Shredder' in pg.inner_text('#taskBody') and 'Replace blade' in pg.inner_text('#taskBody'), pg.inner_text('#taskBody'))
    check('technician has no full asset page button', pg.locator('#acOpen').count()==0)
    pg.click('#acDt'); pg.wait_for_selector('#dtF'); pg.select_option('#dtC','Electrical fault'); pg.click('#dtGo')
    pg.wait_for_selector('#acDt:has-text("Back online")', timeout=8000)
    check('technician marked it offline', call(st,{'action':'downtimeList','no':'SH-1'})['open']['startedBy']=='tech1')
    pg.click('#acDt'); pg.wait_for_selector('#dtF'); pg.click('#dtGo'); pg.wait_for_selector('#acDt:has-text("Mark offline")', timeout=8000)
    check('technician put it back online', call(st,{'action':'downtimeList','no':'SH-1'})['open'] is None)
    check('no JS errors (technician)', not errs, errs); b.close()
    # ---- technician without a work order: card only
    b,ctx,pg,errs=newpage(p, mobile=True); signin(pg,'tech2','2223','/#asset=SH-1'); pg.wait_for_selector('#taskBody h2', timeout=12000); pg.wait_for_timeout(500)
    check('no work order: no offline button, says so', pg.locator('#acDt').count()==0 and 'no open work orders' in pg.inner_text('#taskBody').lower(), pg.inner_text('#taskBody'))
    check('no JS errors (technician 2)', not errs, errs); b.close()
    # ---- a part link for someone without the right
    b,ctx,pg,errs=newpage(p, mobile=True); signin(pg,'tech2','2223','/#part=m:M-7'); pg.wait_for_timeout(3000)
    check('part link without the right says no access', 'access' in pg.inner_text('#toast').lower(), pg.inner_text('#toast')); b.close()
print(f"\nbrowser-assets: {R['pass']} passed, {R['fail']} failed")
for f in R['f']: print('  FAIL',f)
sys.exit(1 if R['fail'] else 0)
