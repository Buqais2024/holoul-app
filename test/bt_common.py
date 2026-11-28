import json, urllib.request
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8788'
def ctl(path, body=''):
    return urllib.request.urlopen(urllib.request.Request(BASE+path, data=body.encode(), method='POST')).read().decode()
def newpage(p, mobile=True, lang='en'):
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1280,'height':900}, service_workers='block', locale='ar-SA' if lang=='ar' else 'en-US', accept_downloads=True)
    def handler(route):
        req=route.request
        r=urllib.request.urlopen(urllib.request.Request(BASE+'/api', data=(req.post_data or '').encode(), method='POST')).read().decode()
        route.fulfill(status=200, content_type='text/plain', body=r, headers={'access-control-allow-origin':'*'})
    ctx.route('https://script.google.com/**', handler)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' and 'favicon' not in m.text else None)
    return b, ctx, pg, errs
def login(pg, user, pin, lang=None):
    pg.goto(BASE+'/')
    if lang: pg.evaluate("l=>{localStorage.setItem('lang',l)}", lang)
    pg.fill('#username', user); pg.fill('#pin', pin); pg.click('#btn')
    pg.wait_for_selector('#taskBox, #dashRoot, #dash', timeout=8000, state='attached')
