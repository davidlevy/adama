import json, sys, glob, os
D=os.environ.get('UI_DIFF_DIR', '/tmp/ui-diff/') + ('' if os.environ.get('UI_DIFF_DIR','/tmp/ui-diff/').endswith('/') else '/')
a,b=sys.argv[1],sys.argv[2]
tot=0
for f in sorted(glob.glob(D+a+'*.json')):
    st=os.path.basename(f)[len(a):-5];g=D+b+st+'.json'
    if not os.path.exists(g): print(st,'missing');continue
    x=json.load(open(f));y=json.load(open(g))
    diff=[k for k in set(x)|set(y) if x.get(k)!=y.get(k)]
    tot+=len(diff);print('%-12s %3d differing of %d'%(st,len(diff),len(x)))
    for k in sorted(diff)[:6]: print('    ',k[-110:])
print('TOTAL',tot)
