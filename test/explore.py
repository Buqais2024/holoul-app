from bt_common import *
ctl('/ctl/reset')
with sync_playwright() as p:
    b,ctx,pg,errs=newpage(p, mobile=False)
    pg.goto(BASE+'/'); pg.fill('#username','sup'); pg.fill('#pin','1111'); pg.click('#btn'); pg.wait_for_timeout(2500)
    print(pg.url); print([x for x in pg.eval_on_selector_all('a,button','els=>els.map(e=>(e.id||e.className)+":"+e.textContent.trim().slice(0,20)).slice(0,40)')])
    pg.screenshot(path='/tmp/sup_home.png'); print(errs)
    b.close()
