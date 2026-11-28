import json
from bt_common import *
from playwright.sync_api import sync_playwright
def call(tok,b): return json.loads(ctl('/ctl/call', json.dumps(dict(b,token=tok))))
with sync_playwright() as p:
    ctl('/ctl/reset'); st=json.loads(ctl('/ctl/call', json.dumps({'action':'login','username':'sup','pin':'1111'})))['token']
    call(st,{'action':'meterAdd','meter':{'no':'SH-1','reading':'1200'}}); call(st,{'action':'meterAdd','meter':{'no':'SH-1','name':'Oil pressure','unit':'PSI','reading':'42'}})
    for c,m in [('Material jam',50),('Electrical fault',140),('Lack of lubrication',35)]:
        call(st,{'action':'downtimeStart','downtime':{'no':'SH-1','cause':c}}); ctl('/ctl/advance', str(m*60000)); call(st,{'action':'downtimeEnd','downtime':{'no':'SH-1'}}); ctl('/ctl/advance','60000')
    call(st,{'action':'downtimeStart','downtime':{'no':'SH-1','cause':'Power loss','note':'Tripped the main breaker'}}); ctl('/ctl/advance', str(25*60000))
    b,ctx,pg,errs=newpage(p, mobile=False); pg.add_init_script("window.print=()=>{}")
    pg.goto(BASE+'/#asset=SH-1'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('.stbar.off', timeout=12000); pg.wait_for_timeout(2500)
    pg.click('[data-qr]'); pg.wait_for_selector('#qrBox svg'); pg.wait_for_timeout(400); pg.screenshot(path='/tmp/r3_qr.png')
    pg.click('#qrPrint'); pg.wait_for_timeout(300); pg.emulate_media(media='print'); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/r3_print_one.png')
    pg.emulate_media(media='screen'); pg.evaluate("document.getElementById('taskModal').classList.remove('open')"); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/r3_asset_desktop.png', full_page=True); b.close()
    b,ctx,pg,errs=newpage(p, mobile=False); pg.add_init_script("window.print=()=>{}")
    pg.goto(BASE+'/'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('[data-sec=equipment]'); pg.click('[data-sec=equipment]'); pg.wait_for_selector('[data-eqi]'); pg.wait_for_timeout(500)
    pg.screenshot(path='/tmp/r3_list.png')
    pg.click('[data-act=printEq]'); pg.wait_for_timeout(400); pg.emulate_media(media='print'); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/r3_print_all.png'); b.close()
    b,ctx,pg,errs=newpage(p, mobile=True); pg.goto(BASE+'/#asset=SH-1'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('.stbar.off', timeout=12000); pg.wait_for_timeout(2000)
    pg.screenshot(path='/tmp/r3_asset_phone.png', full_page=True); b.close()
print('done')
