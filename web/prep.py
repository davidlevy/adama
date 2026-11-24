import json,base64,math,os
def utm(lat,lon,zone=36):
    a=6378137;f=1/298.257223563;k0=.9996;n=f/(2-f);A=a/(1+n)*(1+n*n/4+n**4/64)
    al=[n/2-2*n*n/3+5*n**3/16,13*n*n/48-3*n**3/5,61*n**3/240]
    e=math.sqrt(f*(2-f));ph=math.radians(lat);dl=math.radians(lon-(zone*6-183))
    t=math.sinh(math.atanh(math.sin(ph))-e*math.atanh(e*math.sin(ph)));xi=math.atan2(t,math.cos(dl));et=math.atanh(math.sin(dl)/math.sqrt(1+t*t))
    X,Y=et,xi
    for j in (1,2,3):
        X+=al[j-1]*math.cos(2*j*xi)*math.sinh(2*j*et);Y+=al[j-1]*math.sin(2*j*xi)*math.cosh(2*j*et)
    return 500000+k0*A*X,k0*A*Y
def crop(d,lat=None,lon=None,R=None):
    global utm
    zone=int(d['crs'][-2:]);_u=utm;utm=lambda a,b,z=zone:_u(a,b,z)
    """Crop city data to a square window around (lat,lon) of radius R cells (20 m). Default: keep as is."""
    w,h=d['w'],d['h'];L,B,Rr,T=d['bounds']
    if lat is None: return d
    E,N=utm(lat,lon);cx=int((E-L)/20);cy=int((T-N)/20)
    x0,y0=max(0,cx-R-1),max(0,cy-R-1);x1,y1=min(w,cx+R+2),min(h,cy+R+2)
    out=dict(d)
    for k in ('first','inside','land'):
        if k in d:
            raw=base64.b64decode(d[k])
            rows=[raw[yy*w+x0:yy*w+x1] for yy in range(y0,y1)]
            out[k]=base64.b64encode(b''.join(rows)).decode()
    out['off']=[x0,y0]
    out['w'],out['h']=x1-x0,y1-y0
    out['bounds']=[L+x0*20,T-y1*20,L+x1*20,T-y0*20]
    # keep only road segments touching the window
    nl,nr=L+x0*20,L+x1*20;nb,nt=T-y1*20,T-y0*20
    def keep(a):
        for p in a['pts']:
            e,n=utm(p[0],p[1])
            if nl-200<=e<=nr+200 and nb-200<=n<=nt+200:return True
        return False
    osm=dict(d['osm']);osm['arteries']=[a for a in d['osm']['arteries'] if keep(a)]
    osm['playgrounds']=[p for p in d['osm']['playgrounds'] if nl<=utm(p[0],p[1])[0]<=nr and nb<=utm(p[0],p[1])[1]<=nt]
    out['osm']=osm;out['center']=[lat,lon]
    return out
def greens(d,path):
    """Cells almost entirely inside an OpenStreetMap park and without buildings (scripts/green_spaces.py) were never built: the model took them for built-up."""
    g=os.path.join(os.path.dirname(path),'greens.json')
    if not os.path.exists(g):return d
    m=json.load(open(g));w,h=d['w'],d['h']
    if (m['w'],m['h'])!=(w,h):return d
    first=bytearray(base64.b64decode(d['first']));mask=base64.b64decode(m['mask'])
    for i,v in enumerate(mask):
        if v==1:first[i]=255
    d=dict(d);d['first']=base64.b64encode(bytes(first)).decode()
    return d
def load(path,**kw):return crop(greens(json.load(open(path,encoding='utf-8')),path),**kw)
