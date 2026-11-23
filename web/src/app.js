import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
const CITIES=window.CITIES,SLUG=decodeURIComponent(location.hash.slice(1)),D=CITIES.find(c=>c.slug===SLUG)||CITIES[0],W=D.w,H=D.h,Y=D.years.length,AR=0.04,CM=20; // 1 unit = 20 m, 0.04 ha per cell
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const LAND=D.land?b64(D.land):null,FIRST=b64(D.first),INSIDE=b64(D.inside),LS=new Set(D.ls_years);
const NAMES={'ra-anana':{fr:"Ra'anana",en:"Ra'anana",he:'רעננה'},'eilat':{fr:'Eilat',en:'Eilat',he:'אילת'}};
// UTM projection (WGS84), zone from D.crs
const ZONE=+D.crs.slice(-2),NORTH=D.crs.startsWith('EPSG:326');
function utm(lat,lon){const a=6378137,f=1/298.257223563,k0=.9996,n=f/(2-f),A=a/(1+n)*(1+n*n/4+n**4/64);
  const al=[n/2-2*n*n/3+5*n**3/16,13*n*n/48-3*n**3/5,61*n**3/240];const be=[0,0,0];
  const e=Math.sqrt(f*(2-f)),ph=lat*Math.PI/180,dl=(lon-(ZONE*6-183))*Math.PI/180;
  const t=Math.sinh(Math.atanh(Math.sin(ph))-e*Math.atanh(e*Math.sin(ph))),xi=Math.atan2(t,Math.cos(dl)),et=Math.atanh(Math.sin(dl)/Math.sqrt(1+t*t));
  let X=et,Yy=xi;for(let j=1;j<=3;j++){X+=al[j-1]*Math.cos(2*j*xi)*Math.sinh(2*j*et);Yy+=al[j-1]*Math.sin(2*j*xi)*Math.cosh(2*j*et)}
  return [500000+k0*A*X,(NORTH?0:1e7)+k0*A*Yy]}
const L0=D.bounds[0],T0=D.bounds[3];
const toXZ=(lat,lon)=>{const [E,N]=utm(lat,lon);return [(E-L0)/CM-W/2,(T0-N)/CM-H/2]};
// cells
const cells=[];const idx=new Int32Array(W*H).fill(-1);
const RD=Math.min(W,H)/2-1;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(Math.hypot(x+.5-W/2,y+.5-H/2)>RD)continue;
  idx[i]=cells.length;const hs=Math.abs(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
  cells.push({lt:LAND?LAND[i]:0,in:INSIDE[i]?1:0,x:x+.5-W/2,z:y+.5-H/2,gx:x,gy:y,f:(FIRST[i]===255||(LAND&&LAND[i]===1))?999:FIRST[i],h:hs,road:0,nb:0})}
// density (built neighbours at last year) -> taller towers in dense cores
for(const c of cells){let n=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const gx=c.gx+dx,gy=c.gy+dy;if(gx<0||gy<0||gx>=W||gy>=H)continue;const j=idx[gy*W+gx];if(j>=0&&cells[j].f<999)n++}c.nb=n/25}
const wrap=document.getElementById('v');const UIW=()=>innerWidth,UIH=()=>innerHeight;
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
wrap.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const cam=new THREE.OrthographicCamera(-100,100,100,-100,-1500,3000);cam.position.set(260,300,260);cam.lookAt(0,0,0);
const ctl=new OrbitControls(cam,renderer.domElement);ctl.enableDamping=true;ctl.minZoom=.7;ctl.maxZoom=12;ctl.maxPolarAngle=1.35;ctl.minPolarAngle=.3;ctl.screenSpacePanning=true;
const hemi=new THREE.HemisphereLight(0xf2f4ff,0x3a3a3c,1.2);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(-120,260,80);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
const sc=sun.shadow.camera;sc.left=-230;sc.right=230;sc.top=230;sc.bottom=-230;sc.near=1;sc.far=900;sun.shadow.bias=-.0004;sun.shadow.normalBias=.2;scene.add(sun);
// roads: rasterise OSM arteries onto the cell grid
D.osm.arteries.forEach(wy=>{const P=wy.pts.map(p=>toXZ(p[0],p[1])),r=wy.c?.78:.62,v=wy.c?2:1;
  for(let i=0;i<P.length-1;i++){const [x0,z0]=P[i],[x1,z1]=P[i+1],L=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.ceil(L/.3));
    for(let s=0;s<=n;s++){const px=x0+(x1-x0)*s/n,pz=z0+(z1-z0)*s/n,gx=Math.floor(px+W/2),gy=Math.floor(pz+H/2);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=gx+dx,Z=gy+dy;if(X<0||Z<0||X>=W||Z>=H)continue;const j=idx[Z*W+X];if(j<0)continue;const c=cells[j];if(Math.hypot(c.x-px,c.z-pz)<r)c.road=Math.max(c.road,v)}}}});
const ground0=0;
const PL=(r0,r1,h,y,c,rg)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,160),new THREE.MeshStandardMaterial({color:c,roughness:rg,metalness:.1}));m.position.y=y;m.receiveShadow=true;m.castShadow=false;scene.add(m);return m};
const ground=PL(RD+1.2,RD+1.6,7,-3.5,0x17171a,.6);           // raised body
PL(RD+1.5,RD+1.5,.5,-.25,0x3a3a40,.4);                        // bright rim at the top edge
PL(RD+5,RD+6,1.6,-7.8,0x0d0d0f,.9);                           // lower stage
const rimLine=new THREE.Mesh(new THREE.TorusGeometry(RD+1.5,.12,8,200).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0x9a9aa2}));rimLine.position.y=.02;scene.add(rimLine);
const geo=new THREE.BoxGeometry(1,1,1);geo.translate(0,.5,0);
const mat=new THREE.MeshStandardMaterial({roughness:.82,metalness:0});
const WATER=new THREE.Color('#1d5fa8'),WATER2=new THREE.Color('#2f86d8'),BARE=new THREE.Color('#2c2823'),BARE2=new THREE.Color('#3d372f');
const lerp0=(a,b,t)=>a+(b-a)*t;
// never-built cells (always green) are static, flat, merged 2x2 when possible, and cast no shadow
cells.forEach(c=>{c.st=c.f===999&&!c.road?1:0;c.sm=0});
const stBlocks=[];
for(let gy=0;gy<H-1;gy+=2)for(let gx=0;gx<W-1;gx+=2){const q4=[[0,0],[1,0],[0,1],[1,1]].map(([dx,dy])=>{const j=idx[(gy+dy)*W+gx+dx];return j<0?null:cells[j]});
  if(q4.every(c=>c&&c.st&&c.lt===q4[0].lt)){q4.forEach(c=>c.sm=1);stBlocks.push({x:gx+1-W/2,z:gy+1-H/2,s:1.96,h:q4[0].h,lt:q4[0].lt})}}
cells.forEach(c=>{if(c.st&&!c.sm)stBlocks.push({x:c.x,z:c.z,s:.96,h:c.h,lt:c.lt})});
let ND=0;cells.forEach(c=>{if(!c.st)c.di=ND++});
const Tg=new Float32Array(ND),Ch=new Float32Array(ND),Cg=new Float32Array(ND*3),Cc=new Float32Array(ND*3),DX=new Float32Array(ND),DZ=new Float32Array(ND);let firstFill=true,animating=false;cells.forEach(c=>{if(!c.st){DX[c.di]=c.x;DZ[c.di]=c.z}});
const mesh=new THREE.InstancedMesh(geo,mat,ND);mesh.setColorAt(0,new THREE.Color(1,1,1));mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;scene.add(mesh);
const smesh=new THREE.InstancedMesh(geo,mat,stBlocks.length);smesh.castShadow=false;smesh.receiveShadow=true;smesh.frustumCulled=false;scene.add(smesh);
const UT={value:0};
mat.onBeforeCompile=sh=>{sh.uniforms.uT=UT;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uT;varying vec3 vWP;').replace('#include <color_fragment>','#include <color_fragment>\n float gk=step(max(diffuseColor.r,diffuseColor.b)+.04,diffuseColor.g);float tq=floor(uT*7.);vec2 gq=floor(gl_FragCoord.xy*.55)+tq*vec2(17.3,9.1);float gn=fract(sin(dot(gq,vec2(12.9898,78.233)))*43758.5453);float wv=(sin(vWP.x*.11+vWP.z*.07+uT*1.1)*.5+.5)*(sin(vWP.z*.09-vWP.x*.05-uT*.8)*.5+.5);float wk=step(diffuseColor.r+.05,diffuseColor.b);float dk=step(.004,diffuseColor.r-diffuseColor.b)*step(diffuseColor.g,diffuseColor.r+.001)*(1.-gk)*(1.-wk);float sp=sin(vWP.x*.35+uT*1.6)*sin(vWP.z*.31-uT*1.2);diffuseColor.rgb*=(1.+(fract(sin(dot(floor(gl_FragCoord.xy*.55),vec2(12.9898,78.233)))*43758.5453)-.5)*.42*gk)*(1.+(gn-.5)*.1*wk)*(1.+(fract(sin(dot(floor(gl_FragCoord.xy*.55),vec2(12.9898,78.233)))*43758.5453)-.5)*.3*dk);float ws=(sin(vWP.x*.045+uT*.45)*sin(vWP.z*.04-uT*.36)+sin(vWP.x*.021-vWP.z*.027+uT*.27))*.25+.5;vec3 wa=diffuseColor.rgb*vec3(.62,.8,1.25),wb=diffuseColor.rgb*vec3(.85,1.45,1.2);diffuseColor.rgb=mix(diffuseColor.rgb,mix(wa,wb,clamp(ws,0.,1.)),wk);')};
const m4=new THREE.Matrix4(),col=new THREE.Color(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scl=new THREE.Vector3();
const lerp=(a,b,t)=>a+(b-a)*t,WH=new THREE.Color(1,1,1),G1=new THREE.Color('#1c9e4a'),G2=new THREE.Color('#52d977');
{const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_c=new THREE.Color(),_a=new THREE.Color('#1c9e4a'),_b=new THREE.Color('#52d977');
  stBlocks.forEach((b,i)=>{_p.set(b.x,0,b.z);_s.set(b.s,b.lt===1?.06:b.lt===2?.2+b.h*.12:.3+b.h*.3,b.s);_m.compose(_p,_q,_s);smesh.setMatrixAt(i,_m);if(b.lt===1)_c.copy(WATER).lerp(WATER2,b.h);else if(b.lt===2)_c.copy(BARE).lerp(BARE2,b.h);else _c.copy(_a).lerp(_b,b.h);smesh.setColorAt(i,_c)});smesh.instanceMatrix.needsUpdate=true;smesh.instanceColor.needsUpdate=true}
const gray=h=>{const k=Math.min(1,Math.max(0,(h-.8)/1.9)),v=lerp(.34,.035,k);return col.setRGB(v,v,v,THREE.SRGBColorSpace)};
const roadLabs=[];
{const by={};D.osm.arteries.forEach(wy=>{const nm=wy.nm||{};const key=nm.d||nm.en||nm.he;if(!key)return;const P=wy.pts.map(p=>toXZ(p[0],p[1])).filter(p=>Math.hypot(p[0],p[1])<RD-2);if(P.length<2)return;const e=by[key]=by[key]||{nm,pts:[],len:0};e.pts.push(...P);for(let i=0;i<P.length-1;i++)e.len+=Math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1])});
  const list=Object.values(by).filter(e=>e.len>25).sort((a,b)=>b.len-a.len),kept=[];
  for(const e of list){if(kept.length>=8)break;const m=e.pts[Math.floor(e.pts.length/2)];if(kept.every(k=>Math.hypot(k.x-m[0],k.z-m[1])>40))kept.push({nm:e.nm,x:m[0],z:m[1]})}
  kept.forEach(k=>{const d=document.createElement('div');d.className='rl';wrap.appendChild(d);roadLabs.push({d,nm:k.nm,v:new THREE.Vector3(k.x,3,k.z)})})}
const I18={
fr:{pts:'pts',since:'depuis {y}',sinceb:'plus bâti depuis {y}',newy:'nouveau cette année',tag:'vu du ciel, version utile',built:'bâti',green:'vert',neu:'nouveau',art:'axes principaux',kids:'aires de jeux',bf:'Avant',lens:'Cercle : {a} · Autour : {b}',pgs:'Aires de jeux : {n} (OpenStreetMap)',pc:'de la ville encore vert',wat:'eau',bare:'sol nu / désert',pcr:'du rayon de {r} km encore vert',pos:'Ma position',rot:'Rotation',w:'400 m : {p} % de vert',n:'Vert à {d} m',on:'Tu es sur du vert',b0:'Déjà bâti en ',b1:'Bâti en ',g:'Non bâti',gf:'Vert jusqu’en ',s30:'Landsat, 30 m par pixel (moins précis)',s10:'Sentinel-2, 10 m par pixel',sb:'Landsat + Sentinel-2',note:'Images satellites gratuites (Landsat depuis 1984, Sentinel-2 depuis 2017), un composite par an. Estimation par modèle : des zones de 20 m, pas des bâtiments. Avant 2017 la résolution est plus grossière.',outside:'Tu es à {d} km de la ville, hors de la carte.',loc:'Recherche de ta position...',nogeo:'Géolocalisation indisponible.',deny:'Position refusée.',nf:'Position introuvable.',ok:'Position affichée (±{a} m).'},
en:{pts:'pts',since:'since {y}',sinceb:'more built since {y}',newy:'new this year',tag:'seen from above, made useful',built:'built',green:'green',neu:'new',art:'main roads',kids:'playgrounds',bf:'Before',lens:'Circle: {a} · Around: {b}',pgs:'Playgrounds: {n} (OpenStreetMap)',pc:'of the city still green',wat:'water',bare:'bare ground / desert',pcr:'of the {r} km radius still green',pos:'My position',rot:'Rotate',w:'400 m: {p}% green',n:'Green at {d} m',on:'You are on green',b0:'Already built in ',b1:'Built in ',g:'Not built',gf:'Green until ',s30:'Landsat, 30 m per pixel (less precise)',s10:'Sentinel-2, 10 m per pixel',sb:'Landsat + Sentinel-2',note:'Free satellite imagery (Landsat since 1984, Sentinel-2 since 2017), one composite per year. Model estimate: 20 m areas, not individual buildings. Before 2017 the resolution is coarser.',outside:'You are {d} km from the city, outside the map.',loc:'Finding your position...',nogeo:'Geolocation unavailable.',deny:'Location denied.',nf:'Position not found.',ok:'Position shown (±{a} m).'},
he:{pts:'pts',since:'מאז {y}',sinceb:'בנוי יותר מאז {y}',newy:'חדש השנה',tag:'מבט מהשמיים, שימושי',built:'בנוי',green:'ירוק',neu:'חדש',art:'צירים ראשיים',kids:'מגרשי משחקים',bf:'לפני',lens:'עיגול: {a} · מסביב: {b}',pgs:'מגרשי משחקים: {n} (OpenStreetMap)',pc:'מהעיר עדיין ירוק',wat:'מים',bare:'קרקע חשופה / מדבר',pcr:'מהרדיוס של {r} ק״מ עדיין ירוק',pos:'המיקום שלי',rot:'סיבוב',w:'400 מ׳: {p}% ירוק',n:'ירוק במרחק {d} מ׳',on:'אתה על שטח ירוק',b0:'בנוי כבר ב־',b1:'נבנה ב־',g:'לא בנוי',gf:'ירוק עד ',s30:'Landsat, 30 מ׳ לפיקסל (פחות מדויק)',s10:'Sentinel-2, 10 מ׳ לפיקסל',sb:'Landsat + Sentinel-2',note:'תמונות לוויין חינמיות (Landsat מ־1984, Sentinel-2 מ־2017), הרכב אחד לשנה. אומדן של מודל: אזורים של 20 מ׳, לא בניינים. לפני 2017 הרזולוציה גסה יותר.',outside:'אתה {d} ק״מ מהעיר, מחוץ למפה.',loc:'מחפש מיקום...',nogeo:'מיקום לא זמין.',deny:'המיקום נדחה.',nf:'המיקום לא נמצא.',ok:'המיקום מוצג (±{a} מ׳).'}};
let LG=(()=>{try{const s=localStorage.getItem('city_lang');if(I18[s])return s}catch(e){}const n=(navigator.language||'en').slice(0,2);return I18[n]?n:'en'})();
const T=k=>I18[LG][k];
const YR=D.years,yi0=Y-1;let domYi=-1,lensOn=false,LR=9,tt=yi0,run=false,hp=null,dirty=true,facG=null;
const sl=document.getElementById('sl'),pl=document.getElementById('pl'),tkEl=document.getElementById('tk'),tip=document.getElementById('tip');
sl.max=yi0;sl.value=yi0;
const cmEl=document.getElementById('cm'),cmb=document.getElementById('cmb'),cmn=document.getElementById('cmn'),cml=document.getElementById('cml');
const COUNTRY={fr:'Israël',en:'Israel',he:'ישראל'};
CITIES.forEach(c=>{const o=document.createElement('div');o.dataset.slug=c.slug;o.setAttribute('role','option');o.innerHTML='<span></span><small></small>';if(c.slug===D.slug)o.className='on';o.onclick=()=>{if(c.slug===D.slug){cmEl.classList.remove('open');return}location.hash=c.slug;location.reload()};cml.appendChild(o)});
cmb.onclick=e=>{e.stopPropagation();const o=cmEl.classList.toggle('open');cmb.setAttribute('aria-expanded',o)};
addEventListener('click',()=>cmEl.classList.remove('open'));addEventListener('keydown',e=>{if(e.key==='Escape')cmEl.classList.remove('open')});
function applyLang(){domYi=-1;document.documentElement.lang=LG;document.documentElement.dir=LG==='he'?'rtl':'ltr';document.querySelectorAll('[data-i]').forEach(e=>e.textContent=T(e.dataset.i));if(!OUTL)document.querySelectorAll('[data-i=pc]').forEach(e=>e.textContent=T('pcr').replace('{r}',RKM));
  document.querySelectorAll('.lang button').forEach(b=>b.classList.toggle('on',b.dataset.l===LG));try{localStorage.setItem('city_lang',LG)}catch(e){}
  const nm=(NAMES[D.slug]||{})[LG]||D.name.split(',')[0];cmn.innerHTML='<span class="cn"></span> <span class="cc"></span>';cmn.firstChild.textContent=nm;cmn.lastChild.textContent=COUNTRY[LG];[...cml.children].forEach(o=>{o.firstChild.className='cn2';o.firstChild.textContent=(NAMES[o.dataset.slug]||{})[LG]||o.dataset.slug;o.lastChild.textContent=COUNTRY[LG]});document.title=nm+' · '+YR[0]+'-'+YR[yi0];
  window.__lh&&window.__lh();roadLabs.forEach(l=>{l.d.textContent=l.nm[LG]||l.nm.d||l.nm.en||l.nm.he});dirty=true}
// graph: green area per year
const bars=document.getElementById('gb'),gy=YR.map((_,y)=>{let n=0;cells.forEach(c=>{if(c.in&&c.lt===0&&c.f>y)n++});return n*AR}),gmax=Math.max(...gy);
bars.innerHTML=gy.map((v,i)=>'<div class="bar" data-i="'+i+'"><div style="height:'+Math.round(v/gmax*100)+'%"></div></div>').join('');
const NIN=cells.reduce((a,c)=>a+(c.in&&c.lt!==1?1:0),0),OUTL=cells.some(c=>!c.in);const NV=cells.reduce((a,c)=>a+(c.in&&c.lt===0?1:0),0);const BP0=cells.reduce((a,c)=>a+(c.in&&c.f<=0?1:0),0)/NIN*100,GP0=(NV-cells.reduce((a,c)=>a+(c.in&&c.lt===0&&c.f<=0?1:0),0))/NIN*100;const HASW=cells.some(c=>c.lt===1),HASB=cells.some(c=>c.lt===2);const RKM=(RD*CM/1000).toFixed(1);
function animStep(k){let mv=false;const ma=mesh.instanceMatrix.array,ca=mesh.instanceColor.array;
  for(let i=0;i<ND;i++){let d=Tg[i]-Ch[i];if(d>.002||d<-.002){Ch[i]+=d*k;mv=true}else Ch[i]=Tg[i];
    const o=i*16;ma[o]=.94;ma[o+5]=Math.max(.05,Ch[i]);ma[o+10]=.94;ma[o+12]=DX[i];ma[o+14]=DZ[i];ma[o+15]=1;
    const i3=i*3;for(let j=0;j<3;j++){const e=Cg[i3+j]-Cc[i3+j];if(e>.002||e<-.002){Cc[i3+j]+=e*k;mv=true}else Cc[i3+j]=Cg[i3+j];ca[i3+j]=Cc[i3+j]}}
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;return mv}
function update(t){
  const yi=Math.min(yi0,Math.max(0,Math.round(t)));
  let bt=0,nw=0,gv=0;
  for(let i=0;i<cells.length;i++){const c=cells[i];if(c.st)continue;let h,color;const hv=c.h;
    const ye=lensOn&&hp&&Math.hypot(c.x-hp.x,c.z-hp.z)<LR?(yi>yi0/2?0:yi0):t;const built=c.f<=ye+1e-6;
    if(c.road&&(built||c.f===999)){h=.08;color=c.road===2?col.setRGB(2.3,2.3,2.3,THREE.LinearSRGBColorSpace):col.setRGB(.7,.7,.72,THREE.LinearSRGBColorSpace)}
    else if(built){h=.8+c.nb*1.1+hv*.9;const age=ye-c.f;color=gray(h);if(c.f>0&&age<3)color.lerp(WH,(1-age/3)*.85)}
    else if(c.f<999&&c.lt===0&&c.f-1<ye){const k=ye-c.f+1,hb=.8+c.nb*1.1+hv*.9,hg=.3+hv*.3;h=hg+(hb-hg)*k;color=col.copy(WH)}
    else if(c.lt===1){h=.06;color=col.copy(WATER).lerp(WATER2,hv)}
    else if(c.lt===2){h=.2+hv*.12;color=col.copy(BARE).lerp(BARE2,hv)}
    else{h=.3+hv*.3;color=col.copy(G1).lerp(G2,hv)}
    if(c.in&&c.f<=yi){bt++;if(c.lt===0)gv++;if(c.f===yi&&yi>0)nw++}
    Tg[c.di]=h;Cg[c.di*3]=color.r;Cg[c.di*3+1]=color.g;Cg[c.di*3+2]=color.b}
  if(firstFill){firstFill=false;Ch.set(Tg);Cc.set(Cg)}animating=true;
  facG.visible=yi===yi0;
  if(yi===domYi){refreshTip(yi);return}domYi=yi;
  document.getElementById('yr').textContent=YR[yi];
  const sensor=LS.has(YR[yi])?T('s30'):(YR[yi]<=2018?T('sb'):T('s10'));document.getElementById('sn').textContent=sensor;
  sl.style.setProperty('--p',(yi/yi0*100)+'%');
  tkEl.querySelectorAll('div').forEach(d=>d.classList.toggle('on',+d.dataset.idx===yi));
  bars.querySelectorAll('.bar').forEach(b=>b.classList.toggle('on',+b.dataset.i===yi));
  const nf=new Intl.NumberFormat(LG,{maximumFractionDigits:1,minimumFractionDigits:0}),P=v=>nf.format(v),sg=v=>(v>0?'+':v<0?'\u2212':'')+P(Math.abs(v));
  const bp=bt/NIN*100,bp0=BP0,dNew=nw/NIN*100;
  document.getElementById('f1').textContent=P(Math.round(bp))+' %';
  document.getElementById('f2').textContent=yi===0?'\u2014':sg(Math.round(bp-bp0))+' '+T('pts');document.getElementById('l2').textContent=T('sinceb').replace('{y}',YR[0]);
  
  document.getElementById('f3').textContent=yi===0?'\u2014':sg(Math.round(dNew*10)/10)+' '+T('pts');document.getElementById('l3').textContent=T('newy');
  const gp=(NV-gv)/NIN*100;document.getElementById('pc').textContent=Math.round(gp)+' %';document.getElementById('gt').textContent=yi===0?'':(gp<GP0?'\u25BC ':'\u25B2 ')+P(Math.abs(Math.round(gp-GP0)))+' '+T('pts')+' '+T('since').replace('{y}',YR[0]);
  refreshTip(yi)}
// timeline ticks every 5 years
YR.forEach((y,i)=>{if(i===0||i===yi0||(y%5===0&&yi0-i>2)){const d=document.createElement('div');d.dataset.idx=i;d.style.left=(i/yi0*100)+'%';d.textContent=y;d.onclick=()=>{stop();tt=i;sl.value=i;update(i)};tkEl.appendChild(d)}});
function stop(){run=false;pl.innerHTML='&#9664;';}
sl.oninput=()=>{stop();tt=+sl.value;update(tt)};
pl.onclick=()=>{run=!run;pl.innerHTML=run?'&#10074;&#10074;':'&#9664;';if(run&&tt<=0)tt=yi0};
const roEl=document.getElementById('ro');roEl.checked=true;ctl.autoRotate=true;ctl.autoRotateSpeed=.9;let idleT=0;
roEl.onchange=e=>{ctl.autoRotate=e.target.checked;idleT=0};
renderer.domElement.addEventListener('pointerdown',()=>{ctl.autoRotate=false;idleT=0});
addEventListener('wheel',()=>{if(ctl.autoRotate){ctl.autoRotate=false}idleT=0},{passive:true});
// playgrounds: clay slides
// playgrounds: floating clay balloons on thin strings (instanced, gently bobbing)
facG=new THREE.Group();scene.add(facG);
const BP=[];D.osm.playgrounds.forEach((p,i)=>{const [x,z]=toXZ(p[0],p[1]);if(!cellAt(x,z))return;BP.push({x,z,ph:(i*2.399)%(Math.PI*2),k:i%4})});
const BCOL=[0xff7aa8,0xffa3bd,0xff9a76,0xc49bff].map(c=>new THREE.Color(c));
const bmesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,28,20),new THREE.MeshStandardMaterial({roughness:.42,metalness:0}),Math.max(1,BP.length));
bmesh.castShadow=true;bmesh.frustumCulled=false;BP.forEach((b,i)=>bmesh.setColorAt(i,BCOL[b.k]));facG.add(bmesh);
const bline=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(BP.length*6),3)),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.45}));bline.frustumCulled=false;facG.add(bline);
const bdot=new THREE.InstancedMesh(new THREE.CylinderGeometry(.55,.55,.05,20),new THREE.MeshBasicMaterial({color:0xff7aa8,transparent:true,opacity:.55,depthWrite:false}),Math.max(1,BP.length));
{const m=new THREE.Matrix4();BP.forEach((b,i)=>{m.makeTranslation(b.x,.3,b.z);bdot.setMatrixAt(i,m)});bdot.instanceMatrix.needsUpdate=true}facG.add(bdot);
const _bm=new THREE.Matrix4(),_bq=new THREE.Quaternion(),_bp=new THREE.Vector3(),_bs=new THREE.Vector3();
function animBalloons(tm){if(!facG.visible)return;const pa=bline.geometry.attributes.position;
  BP.forEach((b,i)=>{const y=7+Math.sin(tm*.9+b.ph)*.55,x=b.x+Math.sin(tm*.6+b.ph*1.7)*.35,z=b.z+Math.cos(tm*.5+b.ph)*.35;
    _bp.set(x,y,z);_bs.set(1.15,1.4,1.15);_bm.compose(_bp,_bq,_bs);bmesh.setMatrixAt(i,_bm);
    pa.setXYZ(i*2,b.x,.3,b.z);pa.setXYZ(i*2+1,x,y-1.35,z)});
  bmesh.instanceMatrix.needsUpdate=true;pa.needsUpdate=true}
let npg=BP.length;
// hover tooltip: year built + green share within 400 m
const WR=20;let tipX=0,tipY=0;
const hring=new THREE.Mesh(new THREE.RingGeometry(.975,1,96).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthTest:false}));hring.renderOrder=9;hring.visible=false;hring.position.y=5;scene.add(hring);
function cellAt(x,z){const gx=Math.floor(x+W/2),gy=Math.floor(z+H/2);if(gx<0||gy<0||gx>=W||gy>=H)return null;const j=idx[gy*W+gx];return j<0?null:cells[j]}
function refreshTip(yi){
  if(yi===undefined)yi=Math.min(yi0,Math.max(0,Math.round(tt)));
  const c=hp&&cellAt(hp.x,hp.z);if(!c){tip.style.display='none';hring.visible=false;return}
  let st;if(c.f===999)st=T('g');else if(c.f===0)st=T('b0')+YR[0];else if(c.f<=yi)st=T('b1')+YR[c.f];else st=T('gf')+YR[c.f];
  let n=0,g=0,nd=1e9;const gx0=c.gx,gy0=c.gy;
  for(let dy=-WR;dy<=WR;dy++)for(let dx=-WR;dx<=WR;dx++){const gx=gx0+dx,gy=gy0+dy;if(gx<0||gy<0||gx>=W||gy>=H)continue;const j=idx[gy*W+gx];if(j<0)continue;const d=Math.hypot(dx,dy);if(d>WR)continue;n++;if(cells[j].f>yi){g++;if(d<nd)nd=d}}
  const ya=yi>yi0/2?YR[0]:YR[yi0];tip.innerHTML='<b>'+st+'</b>'+(lensOn?'<span>'+T('lens').replace('{a}',ya).replace('{b}',YR[yi])+'</span>':'')+'<span>'+T('w').replace('{p}',Math.round(g/Math.max(1,n)*100))+'</span><span>'+(nd<.7?T('on'):nd>=1e8?'':T('n').replace('{d}',Math.round(nd*2)*10))+'</span>';
  tip.style.display='block';const RR=lensOn?LR:WR;hring.scale.set(RR,1,RR);hring.position.x=hp.x;hring.position.z=hp.z;hring.visible=true;
  const w=wrap.clientWidth;tip.style.left=Math.min(w-tip.offsetWidth-8,Math.max(8,tipX+16))+'px';tip.style.top=Math.max(8,tipY-tip.offsetHeight-14)+'px'}
const rc=new THREE.Raycaster(),pl3=new THREE.Plane(new THREE.Vector3(0,1,0),-1),hv3=new THREE.Vector3();
let lastE=null,inside=false;function aim(e){if(!explore)return;const b=renderer.domElement.getBoundingClientRect();tipX=e.clientX-b.left;tipY=e.clientY-b.top;rc.setFromCamera(new THREE.Vector2(tipX/b.width*2-1,-(tipY/b.height)*2+1),cam);hp=rc.ray.intersectPlane(pl3,hv3)?hv3.clone():null;lastE=e;if(lensOn)dirty=true;else refreshTip()}
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&e.buttons===0)aim(e)});
renderer.domElement.addEventListener('click',aim);
renderer.domElement.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){hp=null;lastE=null;dirty=true}});
// my position
const me=document.createElement('div');me.className='me';me.style.display='none';me.innerHTML='<i></i>';document.body.appendChild(me);let meV=null;const msg=document.getElementById('gm');
document.getElementById('gp').onclick=()=>{
  if(!navigator.geolocation){msg.textContent=T('nogeo');return}
  msg.textContent=T('loc');
  navigator.geolocation.getCurrentPosition(p=>{const [x,z]=toXZ(p.coords.latitude,p.coords.longitude);
    if(Math.abs(x)>W/2+5||Math.abs(z)>H/2+5){const dx=Math.max(0,Math.abs(x)-W/2)*CM,dz=Math.max(0,Math.abs(z)-H/2)*CM;msg.textContent=T('outside').replace('{d}',(Math.hypot(dx,dz)/1000).toFixed(1));meV=null;me.style.display='none';return}
    meV=new THREE.Vector3(x,6,z);me.style.display='block';msg.textContent=T('ok').replace('{a}',Math.round(p.coords.accuracy));
    hp=new THREE.Vector3(x,1,z);tipX=wrap.clientWidth/2;tipY=wrap.clientHeight/2;dirty=true;
  },e=>{msg.textContent=e.code===1?T('deny'):T('nf')},{enableHighAccuracy:true,timeout:15000})};
const bfB=document.getElementById('bf');bfB.onclick=()=>{lensOn=!lensOn;bfB.classList.toggle('on',lensOn);dirty=true};
document.querySelectorAll('.lang button').forEach(b=>b.onclick=()=>{LG=b.dataset.l;applyLang()});
const compass=document.getElementById('cp');
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;renderer.setSize(w,h);const asp=w/h,wide=w>900,s=wide?RD*Math.max(.8,.98/asp):RD*.97/asp;cam.left=-s*asp;cam.right=s*asp;cam.top=s;cam.bottom=-s;if(wide)cam.setViewOffset(w,h,-w*.2,0,w,h);else cam.setViewOffset(w,h,0,-h*.09,w,h);cam.updateProjectionMatrix()}
addEventListener('resize',resize);resize();document.getElementById('lw').style.display=HASW?'':'none';document.getElementById('lb').style.display=HASB?'':'none';applyLang();update(tt);ctl.enabled=false;renderer.domElement.style.pointerEvents='none';
let last=0,acc=0;
// ---------- scroll story ----------
const nm0=()=>(NAMES[D.slug]||{})[LG]||D.name.split(',')[0];
const bArr=YR.map((_,y)=>{let n=0;cells.forEach(c=>{if(c.in&&c.f<=y)n++});return n/NIN*100});
let ib=yi0,bestG=-1;for(let y=Math.min(5,yi0);y<=yi0;y++){const g=bArr[y]-bArr[Math.max(0,y-5)];if(g>bestG){bestG=g;ib=y}}
const ia=Math.max(0,ib-5);
const gArr=YR.map((_,y)=>{let n=0;cells.forEach(c=>{if(c.in&&c.lt===0&&c.f>y)n++});return n/NIN*100});
const lat0=(D.center?D.center[0]:(D.bbox[1]+D.bbox[3])/2).toFixed(2),lon0=(D.center?D.center[1]:(D.bbox[0]+D.bbox[2])/2).toFixed(2);
const ST={
fr:{s0:()=>({k:nm0().toUpperCase()+' · '+lat0+'°N '+lon0+'°E',h:'Vue du ciel, version utile.',p:'Des images satellites gratuites, une par an, de '+YR[0]+' à '+YR[yi0]+'. Fais défiler.'}),
 s1:()=>({k:YR[ia]+' → '+YR[ib],b:'+'+Math.round(bArr[ib]-bArr[ia])+' pts',p:'de la ville est devenue bâtie en cinq ans. C\u2019est la plus forte poussée.',n:'Chaque bloc blanc vient de basculer.'}),
 s2:()=>{const d=bArr[yi0]-bArr[ib],n=yi0-ib;return{k:'DEPUIS '+YR[ib],b:'+'+Math.round(d)+' pts',p:'en '+n+' ans'+(n>0&&d/n<bestG/5?' : le rythme ralentit.':' : la ville continue de grandir.')}},
 s3:()=>({k:'CE QUI RESTE VERT',b:Math.round(gArr[yi0])+' %',g:1,p:'de la ville est encore verte, contre '+Math.round(gArr[0])+' % en '+YR[0]+'.',n:'Tout ce qui n\u2019est pas bâti : champs, parcs, jardins.'}),back:'↑ Histoire'},
en:{s0:()=>({k:nm0().toUpperCase()+' · '+lat0+'°N '+lon0+'°E',h:'Seen from above, made useful.',p:'Free satellite images, one per year, from '+YR[0]+' to '+YR[yi0]+'. Scroll.'}),
 s1:()=>({k:YR[ia]+' → '+YR[ib],b:'+'+Math.round(bArr[ib]-bArr[ia])+' pts',p:'of the city became built in five years. The biggest push.',n:'Each white block just flipped.'}),
 s2:()=>{const d=bArr[yi0]-bArr[ib],n=yi0-ib;return{k:'SINCE '+YR[ib],b:'+'+Math.round(d)+' pts',p:'in '+n+' years'+(n>0&&d/n<bestG/5?': the pace slows down.':': the city keeps growing.')}},
 s3:()=>({k:'WHAT STAYS GREEN',b:Math.round(gArr[yi0])+' %',g:1,p:'of the city is still green, down from '+Math.round(gArr[0])+' % in '+YR[0]+'.',n:'Everything not built: fields, parks, gardens.'}),back:'↑ Story'},
he:{s0:()=>({k:nm0()+' · '+lat0+'°N '+lon0+'°E',h:'מבט מהשמיים, שימושי.',p:'תמונות לוויין חינמיות, אחת לשנה, מ־'+YR[0]+' עד '+YR[yi0]+'. גלול.'}),
 s1:()=>({k:YR[ia]+' → '+YR[ib],b:'+'+Math.round(bArr[ib]-bArr[ia])+' pts',p:'מהעיר נבנו בחמש שנים. הדחיפה הגדולה ביותר.',n:'כל בלוק לבן הרגע התהפך.'}),
 s2:()=>{const d=bArr[yi0]-bArr[ib],n=yi0-ib;return{k:'מאז '+YR[ib],b:'+'+Math.round(d)+' pts',p:'ב־'+n+' שנים'+(n>0&&d/n<bestG/5?': הקצב מואט.':': העיר ממשיכה לגדול.')}},
 s3:()=>({k:'מה נשאר ירוק',b:Math.round(gArr[yi0])+' %',g:1,p:'מהעיר עדיין ירוק, לעומת '+Math.round(gArr[0])+' % ב־'+YR[0]+'.',n:'כל מה שלא בנוי: שדות, פארקים, גינות.'}),back:'↑ סיפור'}};
const SECH=[100,260,200,110,130],vhpx=()=>innerHeight/100;
const storyEl=document.getElementById('story');storyEl.innerHTML=SECH.map(h=>'<section style="height:'+h+'vh"></section>').join('');
const card=document.getElementById('card'),upB=document.getElementById('up');
let secI=0,explore=false,cardKey=-1;
const KF=[{az:25,pol:70,z:.86},{az:45,pol:56,z:1.0},{az:58,pol:44,z:1.1},{az:62,pol:36,z:1.12},{az:40,pol:50,z:1.0}],CS={az:25,pol:70,z:.86};
const RAD=400;function setCam(){const a=CS.az*Math.PI/180,p=CS.pol*Math.PI/180;cam.position.set(RAD*Math.sin(p)*Math.sin(a),RAD*Math.cos(p),RAD*Math.sin(p)*Math.cos(a));cam.lookAt(0,0,0);cam.zoom=CS.z;cam.updateProjectionMatrix()}
function syncFromCam(){const r=cam.position.length();CS.az=Math.atan2(cam.position.x,cam.position.z)*180/Math.PI;CS.pol=Math.acos(cam.position.y/r)*180/Math.PI;CS.z=cam.zoom;KF[4].az=CS.az;KF[4].pol=CS.pol;KF[4].z=CS.z}
const ease=x=>x*x*(3-2*x),cl=x=>Math.max(0,Math.min(1,x));
function renderCard(i){const f=['s0','s1','s2','s3'][i];if(!f){card.style.opacity=0;return}
  const c=ST[LG][f]();card.innerHTML='<div class="kick">'+c.k+'</div>'+(c.h?'<div class="cbig sm">'+c.h+'</div>':'')+(c.b?'<div class="cbig'+(c.g?' g':'')+'">'+c.b+'</div>':'')+'<p>'+c.p+'</p>'+(c.n?'<div class="note">'+c.n+'</div>':'');
  card.style.opacity=1;card.classList.remove('in');void card.offsetWidth;card.classList.add('in')}
let lastY=-1;
function story(){
  const vh=vhpx();let st=[],a=0;SECH.forEach(h=>{st.push(a*vh);a+=h});
  const y=scrollY;let i=0;st.forEach((v,k)=>{if(y>=v-vh*25)i=k});
  const ex=i===4;
  if(i!==secI||ex!==explore||cardKey!==i+LG){secI=i;if(ex!==explore){explore=ex;document.body.classList.toggle('exp',ex);ctl.enabled=ex;renderer.domElement.style.pointerEvents=ex?'auto':'none';if(!ex){hp=null;tip.style.display='none';hring.visible=false}if(ex){setCam();ctl.target.set(0,0,0);ctl.autoRotate=roEl.checked;tt=yi0;sl.value=yi0;dirty=true}else{syncFromCam();ctl.autoRotate=false}}cardKey=i+LG;renderCard(i)}
  if(!explore){let t;const p1=cl((y-st[1])/((SECH[1]-100)*vh)),p2=cl((y-st[2])/((SECH[2]-100)*vh));
    if(y<st[1])t=0;else if(y<st[2])t=lerp(0,ib,ease(p1));else if(y<st[3])t=lerp(ib,yi0,ease(p2));else t=yi0;
    tt=t;sl.value=Math.round(t);dirty=true;lastY=y}
}
addEventListener('scroll',story,{passive:true});addEventListener('resize',story);
window.__lh=()=>{upB.textContent=ST[LG].back;cardKey=-1;story()};
upB.onclick=()=>scrollTo({top:0,behavior:'smooth'});

function frame(n){const d=Math.min(.1,(n-last)/1000);last=n;
  if(run){acc+=d;if(acc>.16){acc=0;tt=Math.max(0,tt-1);sl.value=tt;update(tt);if(tt<=0)stop()}}
  if(dirty&&!run){dirty=false;update(tt)}
  UT.value=n/1000;if(animating)animating=animStep(Math.min(1,d*5));
  if(!explore){const K=KF[secI],e=Math.min(1,d*2.2);CS.az+=(K.az-CS.az)*e+d*(secI<1?1.5:.8);K.az+=d*(secI<1?1.5:.8);CS.pol+=(K.pol-CS.pol)*e;CS.z+=(K.z-CS.z)*e;setCam()}
  animBalloons(n/1000);
  if(explore&&roEl.checked&&!ctl.autoRotate){idleT+=d;if(idleT>8){ctl.autoRotate=true;ctl.autoRotateSpeed=.9}}
  if(ctl.autoRotate&&lastE&&!lensOn&&!run)aim(lastE);
  if(explore)ctl.update();renderer.render(scene,cam);
  const w=wrap.clientWidth,h=wrap.clientHeight;
  roadLabs.forEach(l=>{const p=l.v.clone().project(cam),x=(p.x+1)/2*w,y=(1-p.y)/2*h;l.d.style.display=(x>0&&x<w&&y>0&&y<h)?'':'none';l.d.style.left=x+'px';l.d.style.top=y+'px'});
  if(meV){const p=meV.clone().project(cam);me.style.left=((p.x+1)/2*w)+'px';me.style.top=((1-p.y)/2*h)+'px'}
  const n0=new THREE.Vector3(0,0,0).project(cam),n1=new THREE.Vector3(0,0,-10).project(cam);
  compass.style.transform='rotate('+Math.atan2((n1.x-n0.x)*w,-(n1.y-n0.y)*h)*180/Math.PI+'deg)';
  requestAnimationFrame(frame)}
requestAnimationFrame(frame);
story();window.__ready=true;window.__set=v=>{tt=v;sl.value=v;update(v)};
