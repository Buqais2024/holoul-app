// Serves the app files and answers API calls from the real Code.gs running on the mock.
const http = require('http'), fs = require('fs'), path = require('path');
const { buildWorld } = require('./world');
const ROOT = process.env.APP || '/home/claude/src/holoul-app', CODE = process.env.CODE || path.join(ROOT, 'Code.gs');
let rt = buildWorld(CODE);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css' };
http.createServer((req, res) => {
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
    const body = Buffer.concat(chunks).toString();
    if (req.url === '/api') { let out; try { out = JSON.stringify(rt.call(JSON.parse(body))); } catch (e) { out = JSON.stringify({ ok: false, error: String(e.message) }); } res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(out); }
    if (req.url === '/ctl/reset') { rt = buildWorld(CODE); res.writeHead(200); return res.end('ok'); }
    if (req.url === '/ctl/call') { const b = JSON.parse(body); let out; try { out = JSON.stringify(rt.call(b)); } catch (e) { out = JSON.stringify({ ok: false, error: String(e.message) }); } res.writeHead(200); return res.end(out); }
    if (req.url === '/ctl/advance') { rt.advance(Number(body) || 0); res.writeHead(200); return res.end('ok'); }
    if (req.url === '/ctl/cycle') { res.writeHead(200); return res.end(JSON.stringify(rt.api.automationCycle())); }
    if (req.url === '/ctl/mails') { res.writeHead(200); return res.end(JSON.stringify(rt.mails.map(m => ({ to: m.to, subject: m.subject, att: m.attachments.length })))); }
    if (req.url === '/ctl/tasks') { res.writeHead(200); return res.end(JSON.stringify(rt.api.readTasks())); }
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
}).listen(8788, () => console.log('up'));
