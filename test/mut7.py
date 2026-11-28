import subprocess, sys
src=open('/home/claude/src/holoul-app/Code.gs').read()
M=[("if (!(n >= 1 && n <= i) || !isFinite(n))","if (!(n >= 1 && n <= i + 1) || !isFinite(n))"),
("if (v === 'fail') { if (!note)","if (false) { if (!note)"),
("res = 'fail'; failed.push({ id: s.id, text: s.text, why: n +","res = 'pass'; failed.push({ id: s.id, text: s.text, why: n +"),
("(s.min !== undefined && n < s.min) || (s.max !== undefined && n > s.max)","(s.min !== undefined && n < s.min)"),
("if (s.showIf && !(shown[s.showIf.step] && result[s.showIf.step] === s.showIf.when))","if (false)"),
("if (t['Procedure'] && !runRows().some(r => r['Task ID'] === t['ID'])) throw","if (false) throw"),
("if (runRows().some(r => r['Task ID'] === t['ID'])) throw new Error('This procedure was already","if (false) throw new Error('This procedure was already"),
("priority: 'High', category: pr['Category'],","priority: 'Normal', category: pr['Category'],"),
("if (!isManager(user) && lc(r['By']) !== lc(user.username)) throw new Error('You do not have permission to see this run')","if (false) throw new Error('x')"),
("if (r['Status'] !== 'Requested') throw new Error('This purchase order was already answered')","if (false) throw new Error('x')"),
("if (r['Status'] !== 'Approved') throw new Error('Only an approved","if (false) throw new Error('Only an approved"),
("if (x.q > round3(l.qty - l.got))","if (false)"),
("r['Status'] = all ? 'Received' : 'Partly received'","r['Status'] = 'Received'"),
("if (lines.some(l => l.got > 0)) throw","if (false) throw"),
("partFind(l.kind, l.no);   // stop before","/* */   // stop before"),
("if (s.status !== 'work' && !f.force)","if (false)"),
("if (r['Status'] !== 'Ordered' && r['Status'] !== 'Partly received') throw","if (false) throw"),
("capacity: s.status === 'work' ? a.hours : 0","capacity: a.hours"),
("load: round3(here.reduce((n, t) => n + (est[t['ID']].hours || 1), 0))","load: here.length"),
("if (o) return { status: 'off', reason: o['Type'] };","if (false) return { status: 'off', reason: o['Type'] };"),
("{ hours: Math.round(m.reduce((s, r) => s + hrs(r), 0) / m.length * 4) / 4","{ hours: Math.round(m.reduce((s, r) => s + hrs(r), 0) / 1 * 4) / 4"),
("if (t['Status'] !== 'Open' && t['Status'] !== 'In progress') throw new Error('Only open work orders can be moved')","if (false) throw new Error('x')"),
]
bad=0
for i,(a,b) in enumerate(M):
    if src.count(a)!=1: print('NOT FOUND',i,a[:50]); bad+=1; continue
    open('/tmp/mut.gs','w').write(src.replace(a,b))
    r=subprocess.run(['node','plan.test.js'],env={'CODE':'/tmp/mut.gs','PATH':'/usr/bin:/usr/local/bin'},capture_output=True,text=True,timeout=120)
    killed = r.returncode!=0
    print(('killed  ' if killed else 'SURVIVED'),i,a[:60])
    if not killed: bad+=1
print('mutation survivors/not found:',bad,'of',len(M))
