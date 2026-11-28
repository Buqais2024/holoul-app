import sys, json
from bt_common import *
R={'pass':0,'fail':0,'f':[]}
def check(n,c,x=''):
    if c: R['pass']+=1
    else: R['fail']+=1; R['f'].append(n+(' :: '+str(x)[:400] if x else ''))
def call(tok,b): return json.loads(ctl('/ctl/call', json.dumps(dict(b,token=tok))))
def tok(u,p): return json.loads(ctl('/ctl/call', json.dumps({'action':'login','username':u,'pin':p})))['token']
def draw(pg, sel, pts):
    box=pg.locator(sel).bounding_box(); x0,y0=box['x'],box['y']
    pg.mouse.move(x0+pts[0][0]*box['width'], y0+pts[0][1]*box['height']); pg.mouse.down()
    for a,b in pts[1:]: pg.mouse.move(x0+a*box['width'], y0+b*box['height'], steps=4)
    pg.mouse.up()
STROKE=[(0.2,0.3),(0.5,0.6),(0.8,0.3)]
with sync_playwright() as p:
    ctl('/ctl/reset'); st=tok('sup','1111')
    # ---------- request from an operator
    b,ctx,pg,errs=newpage(p, mobile=True); login(pg,'tech2','2223')
    pg.wait_for_selector('#tiles .tile', timeout=10000)
    check('Report a problem tile is on the home screen', pg.locator('#tiles .tile:has-text("Report a problem")').count()==1)
    pg.click('#tiles .tile:has-text("Report a problem")'); pg.wait_for_selector('#rqF', timeout=15000)
    pg.click('#rqGo'); check('title required', 'What is wrong' in pg.inner_text('#rqM'), pg.inner_text('#rqM'))
    pg.fill('#rqT','Conveyor belt is slipping'); pg.fill('#rqX','Started this morning')
    pg.fill('#rqA','conv'); pg.wait_for_selector('[data-rqi]'); pg.click('[data-rqi="0"]'); check('asset chosen', 'Conveyor' in pg.inner_text('#rqAs'))
    pg.click('#rqU [data-p="High"]')
    with pg.expect_file_chooser() as fc: pg.click('#rqPh')
    fc.value.set_files('/tmp/test_photo.png'); pg.wait_for_selector('#mkC', timeout=10000)
    before=pg.evaluate("document.getElementById('mkC').toDataURL('image/png').length"); draw(pg,'#mkC',STROKE)
    after=pg.evaluate("document.getElementById('mkC').toDataURL('image/png').length"); check('markup: drawing changes the picture', before!=after, (before,after))
    pg.click('#mkUndo'); undone=pg.evaluate("document.getElementById('mkC').toDataURL('image/png').length"); check('markup: undo restores it', undone==before, (before,undone))
    draw(pg,'#mkC',STROKE); pg.click('#mkOk'); pg.wait_for_selector('#mkC', state='detached'); check('form kept after markup', pg.input_value('#rqT')=='Conveyor belt is slipping' and 'Photo added' in pg.inner_text('#rqPhN'))
    pg.click('#rqGo'); pg.wait_for_function("!document.getElementById('taskModal').classList.contains('open')", timeout=15000)
    rl=call(tok('tech2','2223'),{'action':'requestList'})['requests']; r0=rl[0]
    check('request saved with asset, urgency and photo', (r0['title'],r0['assetNo'],r0['urgency'],r0['status'])==('Conveyor belt is slipping','BC-16','High','Pending') and r0['photo'].startswith('https://'), r0)
    call(tok('tech2','2223'),{'action':'requestCreate','request':{'title':'Light is out in hall A'}})
    ctx.close(); b.close()
    # ---------- supervisor answers
    b,ctx,pg,errs2=newpage(p, mobile=False); pg.goto(BASE+'/'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('[data-sec=requests]', timeout=15000)
    check('Work requests badge shows 2', pg.inner_text('[data-sec=requests] .cnt').strip()=='2', pg.inner_text('[data-sec=requests]'))
    pg.click('[data-sec=requests]'); pg.wait_for_selector('[data-rqa]'); check('both pending requests listed', pg.locator('[data-rqa]').count()==2)
    pg.click('[data-rqa]:near(:text("Conveyor belt"))') if False else pg.locator('.rprow:has-text("Conveyor belt") [data-rqa]').click(); pg.wait_for_selector('#rqF')
    pg.click('#rqGo'); check('approve needs a person', 'Choose' in pg.inner_text('#rqM'), pg.inner_text('#rqM'))
    pg.select_option('#rqW','tech1'); pg.click('#rqGo'); pg.wait_for_function("!document.getElementById('taskModal').classList.contains('open')", timeout=15000)
    ts=json.loads(ctl('/ctl/tasks')); t=[x for x in ts if x['Title']=='Conveyor belt is slipping']; check('work order created for tech1 with the asset and priority', len(t)==1 and t[0]['Assigned To']=='tech1' and t[0]['Equipment No']=='BC-16' and t[0]['Priority']=='High', t)
    pg.wait_for_selector('.rprow:has-text("Light is out") [data-rqd]'); pg.locator('.rprow:has-text("Light is out") [data-rqd]').click(); pg.wait_for_selector('#rqN'); pg.click('#rqGo'); check('decline needs a reason', 'reason' in pg.inner_text('#rqM').lower(), pg.inner_text('#rqM'))
    pg.fill('#rqN','Maintenance will do it on Thursday'); pg.click('#rqGo'); pg.wait_for_function("!document.getElementById('taskModal').classList.contains('open')", timeout=15000)
    pg.wait_for_function("document.querySelectorAll('[data-rqa]').length==0", timeout=10000); check('no pending requests left, badge gone', pg.locator('[data-sec=requests] .cnt').count()==0)
    ctx.close(); b.close()
    t2=tok('tech2','2223'); rl=call(t2,{'action':'requestList'})['requests']; check('operator sees the answers', sorted([x['status'] for x in rl])==['Approved','Declined'] and any(x['note'] for x in rl), rl)
    # ---------- field work order: extra asset, signature, comments, voice
    wo=call(st,{'action':'taskCreate','task':{'title':'Replace drive belt','assignee':'tech1','equipment':'Shredder','equipmentNo':'SH-1','needSignature':True,'needPhoto':True,'assets':[{'no':'BC-16'}]}})['task']['id']
    b=p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    ctx=b.new_context(viewport={'width':390,'height':844}, service_workers='block', permissions=['microphone'])
    def handler(route):
        r=urllib.request.urlopen(urllib.request.Request(BASE+'/api', data=(route.request.post_data or '').encode(), method='POST')).read().decode()
        route.fulfill(status=200, content_type='text/plain', body=r, headers={'access-control-allow-origin':'*'})
    ctx.route('https://script.google.com/**', handler); pg=ctx.new_page(); errs3=[]
    pg.on('pageerror', lambda e: errs3.append(str(e)))
    login(pg,'tech1','2222'); pg.wait_for_selector('[data-task="%s"]'%wo, timeout=10000); pg.click('[data-task="%s"]'%wo)
    check('extra asset shown on the task', 'Conveyor' in pg.inner_text('#taskBody'), pg.inner_text('#taskBody'))
    pg.click('#taskStart'); pg.wait_for_selector('#taskDoneOpen'); pg.click('#taskComments'); pg.wait_for_selector('#cmF', timeout=10000)
    pg.fill('#cmT','Belt is torn, need help @sup'); pg.click('#cmGo'); pg.wait_for_selector('.mention', timeout=10000); check('comment posted and @name highlighted', 'Belt is torn' in pg.inner_text('#cmList'))
    pg.click('#cmVoice'); pg.wait_for_function("document.getElementById('cmVoice').textContent.trim()==='Stop'", timeout=8000); pg.wait_for_timeout(1200); pg.click('#cmVoice')
    pg.wait_for_function("document.getElementById('cmRec').textContent.includes('ready')", timeout=8000); pg.click('#cmGo'); pg.wait_for_selector('a:has-text("Play voice note")', timeout=10000)
    cm=call(tok('sup','1111'),{'action':'comments','id':wo})['comments']; check('mention and voice note saved', cm[0]['mentions']==['sup'] and cm[1]['audio'].startswith('https://'), cm)
    pg.click('#cmBack'); pg.wait_for_selector('#taskDoneOpen'); pg.click('#taskDoneOpen'); pg.wait_for_selector('#taskNote')
    pg.fill('#taskNote','Replaced the belt'); pg.click('#taskDoneOk'); check('photo required first', 'photo' in pg.inner_text('#taskMsg').lower(), pg.inner_text('#taskMsg'))
    with pg.expect_file_chooser() as fc: pg.click('#taskPhoto')
    fc.value.set_files('/tmp/test_photo.png'); pg.wait_for_selector('#mkC', timeout=15000); draw(pg,'#mkC',STROKE); pg.click('#mkOk'); pg.wait_for_selector('.thumb img', timeout=10000); check('marked-up photo attached', pg.locator('.thumb img').count()==1)
    pg.click('#taskDoneOk'); check('signature required next', 'signature' in pg.inner_text('#taskMsg').lower(), pg.inner_text('#taskMsg'))
    pg.click('#taskSign'); pg.wait_for_selector('#sgC'); pg.click('#sgOk'); check('empty signature refused', 'Draw' in pg.inner_text('#sgMsg'), pg.inner_text('#sgMsg'))
    draw(pg,'#sgC',[(0.1,0.6),(0.3,0.2),(0.5,0.7),(0.8,0.3)]); pg.fill('#sgN','Khalid'); pg.click('#sgOk'); pg.wait_for_selector('#sgC', state='detached'); check('button shows Signed', 'Signed' in pg.inner_text('#taskSign'), pg.inner_text('#taskSign'))
    pg.click('#taskDoneOk'); pg.wait_for_function("!document.getElementById('taskModal').classList.contains('open')", timeout=10000); pg.wait_for_timeout(2500)
    d=[x for x in json.loads(ctl('/ctl/tasks')) if x['ID']==wo][0]; check('done with signature and name stored', d['Status']=='Done' and d['Signature'].startswith('data:image/png') and d['Signed Name']=='Khalid' and len(d['Signature'])<45000, (d['Status'], len(d['Signature'])))
    ctx.close(); b.close()
    # supervisor sees signature + comments
    b,ctx,pg,errs4=newpage(p, mobile=False); pg.goto(BASE+'/'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('[data-sec=tasks]', timeout=15000)
    pg.click('[data-sec=tasks]'); pg.click('#dRefresh'); pg.wait_for_timeout(1500); pg.locator('[data-tid="%s"]'%wo).first.click(); pg.wait_for_selector('#dSig img', timeout=10000); check('supervisor sees the signature image', pg.locator('#dSig img').count()==1)
    pg.click('#dComments'); pg.wait_for_selector('#cmList'); check('supervisor reads the comments', 'Belt is torn' in pg.inner_text('#cmList'))
    # new work order form: signature flag + extra asset search
    pg.click('#cmBack'); pg.keyboard.press('Escape'); pg.evaluate("document.getElementById('taskModal').classList.remove('open')")
    pg.click('[data-act=new]'); pg.wait_for_selector('#dForm'); pg.fill('#fTitle','Check both lines'); pg.select_option('#fWho','tech1'); pg.check('#fNeedSig'); pg.fill('#fAsQ','conv'); pg.wait_for_selector('[data-asi]'); pg.click('[data-asi="0"]')
    check('extra asset chip added', 'Conveyor' in pg.inner_text('#fAsChips')); pg.click('#fGo'); pg.wait_for_function("!document.getElementById('taskModal').classList.contains('open')", timeout=15000)
    n=[x for x in json.loads(ctl('/ctl/tasks')) if x['Title']=='Check both lines'][0]; check('new order stores flag and extra asset', n['Need Signature']=='Yes' and 'BC-16' in n['Assets'], n)
    allerr=errs+errs2+errs3+errs4; check('no page errors', not [e for e in allerr if 'MediaRecorder' not in e], allerr)
    ctx.close(); b.close()
print('bt_field: %d passed, %d failed'%(R['pass'],R['fail']))
for f in R['f']: print('  FAIL',f)
sys.exit(1 if R['fail'] else 0)
