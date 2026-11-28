from bt_common import *
import json
ctl('/ctl/reset')
tk=json.loads(ctl('/ctl/call', json.dumps({'action':'login','username':'sup','pin':'1111'})))['token']
ctl('/ctl/call', json.dumps({'token':tk,'action':'taskCreate','task':{'title':'Replace conveyor belt','assignee':'tech1','needNote':True,'needApproval':True,'category':'Mechanical','details':'Line 2'}}))
with sync_playwright() as p:
    b,ctx,pg,errs=newpage(p, mobile=True); pg.goto(BASE+'/'); pg.fill('#username','tech1'); pg.fill('#pin','2222'); pg.click('#btn'); pg.wait_for_selector('#taskBox:not(.hidden)')
    pg.click('[data-task="T-0001"]'); pg.click('#taskStart'); pg.wait_for_selector('#taskDoneOpen'); pg.click('#taskDoneOpen'); pg.wait_for_selector('#taskNote'); pg.click('#taskDoneOk'); pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/tech_en.png'); b.close()
    b,ctx,pg,errs=newpage(p, mobile=False); pg.goto(BASE+'/'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_selector('[data-act=new]')
    pg.click('[data-act=new]'); pg.wait_for_selector('#dForm'); pg.evaluate("document.querySelector('#fCat').scrollIntoView()"); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/sup_form.png'); b.close()
