import subprocess, sys
src=open('/home/claude/src/holoul-app/Code.gs').read()
M=[("if (!isManager(user)) throw new Error('Only a supervisor can see maintenance cost')","if (false) throw new Error('x')"),
("const qty = -numOf(r['Qty'])","const qty = numOf(r['Qty'])"),
("b.labor += h * labor / as.length","b.labor += h / as.length"),
("if (t['Status'] !== 'Done') return;\n    const h = numOf","if (false) return;\n    const h = numOf"),
("const mins = r['Ended'] ? numOf(r['Minutes']) : minutesBetween(r['Started'], now);","const mins = numOf(r['Minutes']);"),
("b.downHours += mins / 60; b.downCost += mins / 60 * downRate;","b.downHours += mins / 60; b.downCost += mins / 60 * labor;"),
("const as = assetsOf(t);\n    as.forEach(a => { const b = bucket(a.no, a.name); b.parts += amount / as.length","const as = [assetsOf(t)[0]];\n    as.forEach(a => { const b = bucket(a.no, a.name); b.parts += amount / as.length"),
("if (d < from || d > to) return;\n    const t = byId","if (false) return;\n    const t = byId"),
("if (!publicOn()) throw new Error('The fault form is switched off');\n  f = f || {};","f = f || {};"),
("if (String(f.website || '').trim()) return","if (false) return"),
("['pub_all', 20]","['pub_all', 2000]"),
("if (dev) keys.push(['pub_d_' + dev, 3])","if (false) keys.push(['pub_d_' + dev, 3])"),
("['pub_m_' + lc(asset ? asset.no : machine).slice(0, 60), 4]","['pub_m_' + lc(asset ? asset.no : machine).slice(0, 60), 400]"),
(">= 40) throw new Error('The inbox is full",">= 4000) throw new Error('The inbox is full"),
("f.urgency !== 'Urgent' ? f.urgency : 'Normal'","true ? f.urgency : 'Normal'"),
("if (machine.length < 2) throw","if (false) throw"),
("if (title.length < 4) throw","if (false) throw"),
("function publicAsset(f) {\n  if (!publicOn()) throw new Error('The fault form is switched off');","function publicAsset(f) {"),
("if (nums.length >= 3) r.usual","if (nums.length >= 1) r.usual"),
("use = cols.slice(-10);","use = cols.slice(-30);"),
("if (hd && hd < d.date) cols.push","if (hd && hd <= d.date) cols.push"),
("if (limits[r.row]) r.limit = limits[r.row];","/* */"),
("if (!isManager(user)) throw new Error('Only a supervisor can change the settings');","if (false) throw new Error('x')"),
("if (!isFinite(n) || n < 0 || n > 100000) throw","if (!isFinite(n)) throw"),
]
bad=0
for i,(a,b) in enumerate(M):
    if src.count(a)!=1: print('NOT FOUND',i,a[:50]); bad+=1; continue
    open('/tmp/mut.gs','w').write(src.replace(a,b))
    r=subprocess.run(['node','r8.test.js'],env={'CODE':'/tmp/mut.gs','PATH':'/usr/bin:/usr/local/bin'},capture_output=True,text=True,timeout=120)
    killed = r.returncode!=0
    print(('killed  ' if killed else 'SURVIVED'),i,a[:60])
    if not killed: bad+=1
print('mutation survivors/not found:',bad,'of',len(M))
