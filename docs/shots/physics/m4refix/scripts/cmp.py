import sys,re
def load(f):
    secs={}; cur=None
    for line in open(f):
        if line.startswith('#'): cur=line.split(' Hz')[0].replace('# ','').strip(); secs[cur]={}; continue
        if line.startswith('deg'): continue
        parts=line.rstrip('\n'); deg=parts[:5].strip(); cells=[parts[5+36*i:5+36*(i+1)] for i in range(6)]
        secs[cur][deg]=[[float(x) for x in c.split('|')] for c in cells]
    return secs
names=['litter-dry','litter-wet','grass-wet','sand-dry','sand-wet','coast-wet']
a=load(sys.argv[1]); b=load(sys.argv[2]); only=sys.argv[3] if len(sys.argv)>3 else ''
for sec in a:
    if only and only not in sec: continue
    diffs=[]
    for deg in a[sec]:
        for i in range(6):
            x=a[sec][deg][i]; y=b[sec][deg][i]
            if abs(x[1]-y[1])>0.02 or abs(x[3]-y[3])>0.05 or abs(x[0]-y[0])>0.02:
                diffs.append(f"{deg}d {names[i]}: {x[1]:.2f}->{y[1]:.2f} m/s (rise {x[0]:.2f}->{y[0]:.2f}, least {x[2]:.2f}->{y[2]:.2f}, slip {x[3]:.2f}->{y[3]:.2f})")
    print(f"== {sec}: {len(diffs)} differ" + ('' if not diffs else ':\n   ' + '\n   '.join(diffs)))
