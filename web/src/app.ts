// @ts-nocheck
// TODO(ts): this file is not type-checked yet. The scene, the story, the share links and the air / heat / tower layers are still
// to be split out of it into typed modules (as music.ts, pixellogo.ts and ui/Position.tsx were), and then this line goes away.
import * as THREE from 'three';
import {playPixelLogo} from './pixellogo';
import {mountPosition} from './ui/Position';
import {NAMES} from './data/names';
import {IC,LT} from './data/icons';
import {I18} from './i18n';
import {initMusic} from './music';
import {mountCityMenu} from './ui/city-menu/CityMenu';
import {ui} from './ui/store';

import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
// Links are either paths (/adama/haifa?s=...) when the page was built with --base, or hashes (#haifa?s=...) anywhere else.
const PATHMODE=!!document.querySelector('meta[name=adama-routing]'),ROOTP=new URL(document.baseURI).pathname;
if(PATHMODE&&location.hash.length>1){   // older links #slug, #slug?s=..., #slug~token: open the path version
  const h=decodeURIComponent(location.hash.slice(1)),i=h.search(/[?/]/),sl=i<0?h:h.slice(0,i),r=i<0?'':h.slice(i);
  location.replace(ROOTP+sl+r)}
// the Vercel copy reads its data straight from Cloudflare (<meta name="adama-data">, added by publish.sh); everywhere else the data sits next to the page
const BASE=document.querySelector('meta[name=adama-data]')?.content||new URL('data/',document.baseURI).href,getJSON=async u=>{const r=await fetch(u,{cache:'no-cache'});if(!r.ok)throw new Error(u+' '+r.status);return r.json()};
// city names in links are read with or without hyphens and case: raanana, raanana, Tel-Aviv, telaviv
const NORM=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,''),CITIES=await getJSON(BASE+'cities.json'),HASH=PATHMODE?decodeURIComponent(location.pathname.slice(ROOTP.length)).split('/')[0]+location.search:decodeURIComponent(location.hash.slice(1)),SLUG=HASH.split(/[?/]/)[0],D=await getJSON(BASE+(CITIES.find(c=>c.slug===SLUG)||CITIES.find(c=>NORM(c.slug)===NORM(SLUG))||CITIES[0]).slug+'.json'),W=D.w,H=D.h,Y=D.years.length,AR=0.04,CM=20; // 1 unit = 20 m, 0.04 ha per cell
window.__ldp&&window.__ldp(.7);   // loading bar: data is here, the build follows
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const LAND=D.land?b64(D.land):null,FIRST=b64(D.first),INSIDE=b64(D.inside),LS=new Set(D.ls_years);
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
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
wrap.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const cam=new THREE.OrthographicCamera(-100,100,100,-100,-1500,3000);cam.position.set(260,300,260);cam.lookAt(0,0,0);
const ctl=new OrbitControls(cam,renderer.domElement);ctl.enableDamping=true;ctl.minZoom=.7;ctl.maxZoom=12;ctl.maxPolarAngle=1.35;ctl.minPolarAngle=.087;ctl.screenSpacePanning=true;
const hemi=new THREE.HemisphereLight(0xf2f4ff,0x3a3a3c,1.2);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(-120,260,80);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
const sc=sun.shadow.camera;sc.left=-230;sc.right=230;sc.top=230;sc.bottom=-230;sc.near=1;sc.far=900;sun.shadow.bias=-.0004;sun.shadow.normalBias=.2;scene.add(sun);
// roads: rasterise OSM arteries onto the cell grid
// road classes: 2 wide primary/trunk/motorway (light), 1 narrow primary (dark), 3 secondary/tertiary (darker, only when zoomed in a lot)
const RANK=[0,2,3,1],RL=[0,0,0,0];   // RL: length of each road class, in cells
D.osm.arteries.forEach(wy=>{const v=!wy.c?3:wy.w>=10?2:1,P=wy.pts.map(p=>toXZ(p[0],p[1])),r=v===2?.78:.62;
  for(let i=0;i<P.length-1;i++){const [x0,z0]=P[i],[x1,z1]=P[i+1],L=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.ceil(L/.3));if(Math.hypot(x0,z0)<RD)RL[v]+=L;
    for(let s=0;s<=n;s++){const px=x0+(x1-x0)*s/n,pz=z0+(z1-z0)*s/n,gx=Math.floor(px+W/2),gy=Math.floor(pz+H/2);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=gx+dx,Z=gy+dy;if(X<0||Z<0||X>=W||Z>=H)continue;const j=idx[Z*W+X];if(j<0)continue;const c=cells[j];if(Math.hypot(c.x-px,c.z-pz)<r)if(RANK[v]>RANK[c.road])c.road=v}}}});
{const f=1000/Math.max(1,cells.reduce((n,c)=>n+c.in,0)*(D.cell_m||20));RDEN=[RL[2]*f,(RL[2]+RL[1])*f,(RL[2]+RL[1]+RL[3])*f]}
const ground0=0;
const PL=(r0,r1,h,y,c,rg)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,160),new THREE.MeshStandardMaterial({color:c,roughness:rg,metalness:.1}));m.position.y=y;m.receiveShadow=true;m.castShadow=false;scene.add(m);return m};
const ground=PL(RD+1.5,RD+1.5,5,-2.5,0xd2d2d8,.55);ground.material.emissive=new THREE.Color(0x8a8a92);           // simple light-grey slab
const rimLine=new THREE.Mesh(new THREE.TorusGeometry(RD+1.5,.12,8,200).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff}));rimLine.position.y=.02;scene.add(rimLine);
const geo=new THREE.BoxGeometry(1,1,1);geo.translate(0,.5,0);
const mat=new THREE.MeshStandardMaterial({roughness:.82,metalness:0});
const WATER=new THREE.Color('#1d5fa8'),WATER2=new THREE.Color('#2f86d8'),BARE=new THREE.Color('#4a4033'),BARE2=new THREE.Color('#6b5c45'),FIELD=new THREE.Color('#5e9a63'),FIELD2=new THREE.Color('#76ab76');
const lerp0=(a,b,t)=>a+(b-a)*t;
// never-built cells (always green) are static, flat, merged 2x2 when possible, and cast no shadow
cells.forEach(c=>{c.st=c.f===999&&!c.road?1:0;c.sm=0});
const stBlocks=[];
// static zones (water, bare ground, never-built green): merge 4x4 first, so they read as calm surfaces instead of a field of cubes
// 8x8 first for the meadows, fields and bare ground (few cells, few seams); water keeps the finer 4x4 blocks
for(let gy=0;gy<H-7;gy+=8)for(let gx=0;gx<W-7;gx+=8){const q=[];for(let dy=0;dy<8;dy++)for(let dx=0;dx<8;dx++){const j=idx[(gy+dy)*W+gx+dx];q.push(j<0?null:cells[j])}
  if(q[0]&&q[0].lt!==1&&q.every(c=>c&&c.st&&!c.sm&&c.lt===q[0].lt)){q.forEach(c=>c.sm=1);stBlocks.push({x:gx+4-W/2,z:gy+4-H/2,s:7.96,h:q[0].h,lt:q[0].lt})}}
for(let gy=0;gy<H-3;gy+=4)for(let gx=0;gx<W-3;gx+=4){const q=[];for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++){const j=idx[(gy+dy)*W+gx+dx];q.push(j<0?null:cells[j])}
  if(q[0]&&q.every(c=>c&&c.st&&!c.sm&&c.lt===q[0].lt)){q.forEach(c=>c.sm=1);stBlocks.push({x:gx+2-W/2,z:gy+2-H/2,s:3.96,h:q[0].h,lt:q[0].lt})}}
for(let gy=0;gy<H-1;gy+=2)for(let gx=0;gx<W-1;gx+=2){const q4=[[0,0],[1,0],[0,1],[1,1]].map(([dx,dy])=>{const j=idx[(gy+dy)*W+gx+dx];return j<0?null:cells[j]});
  if(q4.every(c=>c&&c.st&&!c.sm&&c.lt===q4[0].lt)){q4.forEach(c=>c.sm=1);stBlocks.push({x:gx+1-W/2,z:gy+1-H/2,s:1.96,h:q4[0].h,lt:q4[0].lt})}}
cells.forEach(c=>{if(c.st&&!c.sm)stBlocks.push({x:c.x,z:c.z,s:.96,h:c.h,lt:c.lt})});
let ND=0;cells.forEach(c=>{if(!c.st)c.di=ND++});
const Tg=new Float32Array(ND),Ch=new Float32Array(ND),Cg=new Float32Array(ND*3),Cc=new Float32Array(ND*3),DX=new Float32Array(ND),DZ=new Float32Array(ND);let firstFill=true,animating=false;cells.forEach(c=>{if(!c.st){DX[c.di]=c.x;DZ[c.di]=c.z}});
const mesh=new THREE.InstancedMesh(geo,mat,ND);mesh.setColorAt(0,new THREE.Color(1,1,1));mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;scene.add(mesh);
// distance of each water block to the nearest shore, in cells (two-pass chamfer): the waves run toward the coast along it
const sgeo=geo.clone(),aD=new Float32Array(stBlocks.length);
{const BIG=1e4,D=new Float32Array(W*H);let anyW=false;for(let i=0;i<W*H;i++){const w=LAND&&LAND[i]===1;D[i]=w?BIG:0;if(w)anyW=true}
  if(anyW){const R2=1.414;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(D[i]===0)continue;let d=D[i];if(x>0)d=Math.min(d,D[i-1]+1);if(y>0){d=Math.min(d,D[i-W]+1);if(x>0)d=Math.min(d,D[i-W-1]+R2);if(x<W-1)d=Math.min(d,D[i-W+1]+R2)}D[i]=d}
    for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;if(D[i]===0)continue;let d=D[i];if(x<W-1)d=Math.min(d,D[i+1]+1);if(y<H-1){d=Math.min(d,D[i+W]+1);if(x<W-1)d=Math.min(d,D[i+W+1]+R2);if(x>0)d=Math.min(d,D[i+W-1]+R2)}D[i]=d}
    stBlocks.forEach((b,i)=>{if(b.lt===1){const gx=Math.max(0,Math.min(W-1,Math.round(b.x+W/2-.5))),gy=Math.max(0,Math.min(H-1,Math.round(b.z+H/2-.5)));aD[i]=Math.min(D[gy*W+gx],200)}})}}
sgeo.setAttribute('aD',new THREE.InstancedBufferAttribute(aD,1));
const smesh=new THREE.InstancedMesh(sgeo,mat,stBlocks.length);smesh.castShadow=false;smesh.receiveShadow=true;smesh.frustumCulled=false;scene.add(smesh);
const UT={value:0};
mat.onBeforeCompile=sh=>{sh.uniforms.uT=UT;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;attribute float aD;varying float vD;').replace('#include <begin_vertex>','#include <begin_vertex>\nvD=aD;vWP=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uT;varying vec3 vWP;varying float vD;').replace('#include <color_fragment>','#include <color_fragment>\n float gk=step(max(diffuseColor.r,diffuseColor.b)+.04,diffuseColor.g);float tq=floor(uT*7.);vec2 gq=floor(gl_FragCoord.xy*.55)+tq*vec2(17.3,9.1);float gn=fract(sin(dot(gq,vec2(12.9898,78.233)))*43758.5453);float wv=(sin(vWP.x*.11+vWP.z*.07+uT*1.1)*.5+.5)*(sin(vWP.z*.09-vWP.x*.05-uT*.8)*.5+.5);float wk=step(diffuseColor.r+.05,diffuseColor.b);float dk=step(.004,diffuseColor.r-diffuseColor.b)*step(diffuseColor.g,diffuseColor.r+.001)*(1.-gk)*(1.-wk);float sp=sin(vWP.x*.35+uT*1.6)*sin(vWP.z*.31-uT*1.2);diffuseColor.rgb*=(1.+(fract(sin(dot(floor(gl_FragCoord.xy*.55),vec2(12.9898,78.233)))*43758.5453)-.5)*.42*gk)*(1.+(gn-.5)*.1*wk)*(1.+(fract(sin(dot(floor(gl_FragCoord.xy*.55),vec2(12.9898,78.233)))*43758.5453)-.5)*.3*dk);float gs=(sin(vWP.x*.08+uT*.25)*sin(vWP.z*.07-uT*.2)+sin(vWP.x*.034-vWP.z*.045+uT*.15))*.3+.5;vec3 ga=diffuseColor.rgb*vec3(.5,.78,.95),gb=diffuseColor.rgb*vec3(1.22,1.22,.62);float cn=fract(sin(dot(floor(vWP.xz/3.),vec2(12.9898,78.233)))*43758.5453),cs=.5+.5*sin(uT*.4+cn*6.2832);diffuseColor.rgb=mix(diffuseColor.rgb,mix(ga,gb,clamp(mix(gs,cs,.7),0.,1.)),gk);float ws=(sin(vWP.x*.06+uT*.35)*sin(vWP.z*.055-uT*.28)+sin(vWP.x*.03-vWP.z*.04+uT*.22))*.3+.5;vec3 wa=diffuseColor.rgb*vec3(.5,.75,1.4),wb=diffuseColor.rgb*vec3(.9,1.6,1.25);diffuseColor.rgb=mix(diffuseColor.rgb,mix(wa,wb,clamp(ws,0.,1.)),wk);float rb=sin((vWP.x*.7-vWP.z*.5)*.18-uT*.5);diffuseColor.rgb*=1.+wk*.12*rb;float cw=sin(vD*.55+uT*.6);float cm=smoothstep(.45,1.,cw)*smoothstep(60.,4.,vD);float fo=smoothstep(2.4,0.,vD)*(.65+.35*sin(vWP.x*.4+vWP.z*.3+uT*.8));diffuseColor.rgb+=wk*(vec3(.07,.14,.2)*cm+vec3(.3,.34,.36)*fo);')};
const m4=new THREE.Matrix4(),col=new THREE.Color(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scl=new THREE.Vector3();
// rounded trend arrow (up-right = gain, down-right = loss), shared by the stats and the district pills
const TA=dn=>'<svg class="ta'+(dn?' dn':'')+'" viewBox="0 0 14 14"><path d="M3.5 10.5 10.5 3.5M4.6 3.5h5.9v5.9"/></svg>';
const lerp=(a,b,t)=>a+(b-a)*t,WH=new THREE.Color(1,1,1),G1=new THREE.Color('#1b8a40'),G2=new THREE.Color('#2fa650');
{const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_c=new THREE.Color(),_a=new THREE.Color('#1b8a40'),_b=new THREE.Color('#2fa650');
  stBlocks.forEach((b,i)=>{_p.set(b.x,0,b.z);_s.set(b.s,b.lt===1?.06:b.lt===2?.2+b.h*.12:b.lt===3?.8:.42,b.s);_m.compose(_p,_q,_s);smesh.setMatrixAt(i,_m);if(b.lt===1)_c.copy(WATER).lerp(WATER2,b.h);else if(b.lt===2)_c.copy(BARE).lerp(BARE2,b.h);else if(b.lt===3)_c.copy(FIELD).lerp(FIELD2,.5);else _c.copy(_a).lerp(_b,.5);smesh.setColorAt(i,_c)});smesh.instanceMatrix.needsUpdate=true;smesh.instanceColor.needsUpdate=true}
// roads are grey, never white (white is only for new buildings): main axes lighter, secondary streets darker
// main roads stay white (they look good against the light plate); narrow roads and secondary streets are greys
const ROAD_MAJ=new THREE.Color().setRGB(2.3,2.3,2.3,THREE.LinearSRGBColorSpace),ROAD_MIN=new THREE.Color('#5d626b'),ROAD_MIN3=new THREE.Color('#4e535c');
// Road detail follows the zoom AND the road density of the city (km of road per km2), so that a dense city does not look cluttered and a small one is not bare:
// wide main roads are always drawn; narrow primary roads and secondary streets join once the zoom allows that much road per km2.
const rdOn=c=>c.road===2||(c.road===1?roadLv>=2:c.road===3&&roadLv>=3);
const gray=h=>{const k=Math.min(1,Math.max(0,(h-.8)/1.9)),v=lerp(.52,.075,k);return col.setRGB(v,v,v,THREE.SRGBColorSpace)};
const roadLabs=[];
{const by={};D.osm.arteries.forEach(wy=>{if(!wy.c)return;const nm=wy.nm||{};const key=nm.d||nm.en||nm.he;if(!key)return;const P=wy.pts.map(p=>toXZ(p[0],p[1])).filter(p=>Math.hypot(p[0],p[1])<RD-2);if(P.length<2)return;const e=by[key]=by[key]||{nm,pts:[],len:0};e.pts.push(...P);for(let i=0;i<P.length-1;i++)e.len+=Math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1])});
  const list=Object.values(by).filter(e=>e.len>25).sort((a,b)=>b.len-a.len),kept=[];
  for(const e of list){if(kept.length>=8)break;const m=e.pts[Math.floor(e.pts.length/2)];if(kept.every(k=>Math.hypot(k.x-m[0],k.z-m[1])>40))kept.push({nm:e.nm,x:m[0],z:m[1]})}
  kept.forEach(k=>{const d=document.createElement('div');d.className='rl';wrap.appendChild(d);roadLabs.push({d,nm:k.nm,v:new THREE.Vector3(k.x,3,k.z)})})}
// Names of the secondary and tertiary streets: only at strong zoom, a few, one per street, never on top of another label.
// Every 250 ms the streets near the centre of the screen are tried in order of distance to the centre; a name is kept only when its box overlaps nothing placed yet.
const STREET_ZOOM=6,STREET_MAX=5,streets=[],streetLabs=[];
{const by={};D.osm.arteries.forEach(wy=>{if(wy.c)return;const nm=wy.nm||{};const key=nm.d||nm.en||nm.he;if(!key)return;const P=wy.pts.map(p=>toXZ(p[0],p[1])).filter(p=>Math.hypot(p[0],p[1])<RD-2);if(P.length<1)return;(by[key]=by[key]||{nm,pts:[]}).pts.push(...P)});
  streets.push(...Object.values(by));
  for(let i=0;i<STREET_MAX;i++){const d=document.createElement('div');d.className='rl rs';d.style.display='none';wrap.appendChild(d);streetLabs.push({d,v:new THREE.Vector3(),on:false,txt:''})}}
const pickStreets=(w,h)=>{const placed=[],box=(x,y,tw)=>({x0:x-tw/2-8,x1:x+tw/2+8,y0:y-12,y1:y+12});
  const hit=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
  [...roadLabs,...hoodLabs].forEach(l=>{if(l.d.style.display==='none')return;const r=l.d.getBoundingClientRect(),q=wrap.getBoundingClientRect();placed.push({x0:r.left-q.left-8,x1:r.right-q.left+8,y0:r.top-q.top-8,y1:r.bottom-q.top+8})});
  if(meV){const p=meV.clone().project(cam),x=(p.x+1)/2*w,y=(1-p.y)/2*h;placed.push({x0:x-14,x1:x+14,y0:y-14,y1:y+14})}
  const v=new THREE.Vector3(),cand=[];
  for(const st of streets){let best=null,bd=1e9;for(const q of st.pts){v.set(q[0],3,q[1]).project(cam);const x=(v.x+1)/2*w,y=(1-v.y)/2*h,dx=Math.abs(x-w/2),dy=Math.abs(y-h/2);if(dx>w*.4||dy>h*.36)continue;const d=dx*dx+dy*dy;if(d<bd){bd=d;best={x,y,q}}}
    if(best)cand.push({st,x:best.x,y:best.y,q:best.q,d:bd})}
  cand.sort((a,b)=>a.d-b.d);let n=0;const used=new Set();   // two streets with the same name: only the nearest one is named
  for(const c of cand){if(n>=STREET_MAX)break;const txt=c.st.nm[LG]||c.st.nm.d||c.st.nm.en||c.st.nm.he,b=box(c.x,c.y,txt.length*7.4);if(used.has(txt)||placed.some(o=>hit(o,b)))continue;used.add(txt);placed.push(b);const l=streetLabs[n++];l.v.set(c.q[0],3,c.q[1]);l.on=true;if(l.txt!==txt){l.txt=txt;l.d.textContent=txt}}
  for(let i=n;i<STREET_MAX;i++)streetLabs[i].on=false};
let streetT=0;
let LG=ui.getState().lang;   // the language lives in the Zustand store (ui/store.ts); LG mirrors it for the code of this file
const T=k=>I18[LG][k];
const YR=D.years,yi0=Y-1;let domYi=-1,lensOn=false,LR=9,tt=yi0,run=false,hp=null,dirty=true,facG=null;
// Landsat surface temperature (optional layer): anomaly versus the city median, per 100 m block and year
const HT=D.heat||null,HOFF=D.off||[0,0];let heatOn=false,HY=null,HM=null;
if(HT){const fill=a=>{for(let i=0;i<a.length;i++)if(a[i]==null){let j=i-1;while(j>=0&&a[j]==null)j--;if(j<0){j=i+1;while(j<a.length&&a[j]==null)j++}a[i]=j>=0&&j<a.length?a[j]:null}return a};
  HY=fill(HT.data.map(x=>x?b64(x):null));HM=fill(HT.med.slice())}
const hIdx=yr=>Math.max(0,Math.min(HT.years.length-1,HT.years.indexOf(yr)<0?(yr<HT.years[0]?0:HT.years.length-1):HT.years.indexOf(yr)));
function heatAt(arr,u,v){const fx=(HOFF[0]+u)/HT.block-.5,fy=(HOFF[1]+v)/HT.block-.5,x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0,w=HT.w,hh=HT.h;
  const g=(x,y)=>arr[Math.max(0,Math.min(hh-1,y))*w+Math.max(0,Math.min(w-1,x))];
  const q=(g(x0,y0)*(1-tx)+g(x0+1,y0)*tx)*(1-ty)+(g(x0,y0+1)*(1-tx)+g(x0+1,y0+1)*tx)*ty;return (q-HT.base)/HT.step}
const HST=[[-6,.10,.30,.95],[-2.5,.15,.55,.85],[0,.20,.20,.22],[2.5,.95,.50,.10],[5,1,.20,.10],[8,1,.92,.70]];
function heatMix(a){return Math.max(0,Math.min(1,(a-.5)/3))*.8}
function heatCol(a,o){let i=0;while(i<HST.length-2&&a>HST[i+1][0])i++;const A=HST[i],B=HST[i+1],t=Math.max(0,Math.min(1,(a-A[0])/(B[0]-A[0])));return o.setRGB(A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t,A[3]+(B[3]-A[3])*t,THREE.SRGBColorSpace)}
const hCol=new THREE.Color();
// Real tall buildings from OpenStreetMap (optional towers.json): very dark glossy towers that rise when their area was built
const TW=D.towers?D.towers.towers:[],NT=TW.length,TTg=new Float32Array(NT),TC=new Float32Array(NT),TD=[];
const tMat=new THREE.MeshStandardMaterial({color:0x010101,roughness:.35,metalness:.4});
tMat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance+=vec3(.62,.66,.75)*pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),3.)*.22;')};
const tGeo=new THREE.BoxGeometry(1,1,1);tGeo.translate(0,.5,0);
const tMesh=new THREE.InstancedMesh(tGeo,tMat,Math.max(1,NT));tMesh.castShadow=true;tMesh.frustumCulled=false;scene.add(tMesh);
const UNDATED_FROM=1990,UND=Math.min(yi0,Math.max(0,UNDATED_FROM-YR[0])); // towers without a known year: not before 1990 (the satellite model would show them as soon as their cell is built)
TW.forEach(t=>{const [x,z]=toXZ(t[0],t[1]),c=cellAt(x,z);if(!c||Math.hypot(x,z)>RD-1){TD.push(null);return}
  TD.push({x,z,sx:Math.min(5,Math.max(1.6,t[3]/14)),sz:Math.min(5,Math.max(1.6,t[4]/14)),h:2+t[2]/20*1.5,f:t[5]>0?Math.max(0,Math.min(yi0,t[5]-YR[0])):Math.max(c.f<999?c.f:yi0,UND)})});
function stepTowers(k){let mv=false;const a=tMesh.instanceMatrix.array;
  for(let i=0;i<NT;i++){const T=TD[i],o=i*16;if(!T){a[o]=a[o+5]=a[o+10]=0;a[o+15]=1;continue}
    const d=TTg[i]-TC[i];if(d>.002||d<-.002){TC[i]+=d*k;mv=true}else TC[i]=TTg[i];
    a[o]=T.sx;a[o+5]=Math.max(.001,T.h*TC[i]);a[o+10]=T.sz;a[o+12]=T.x;a[o+13]=0;a[o+14]=T.z;a[o+15]=1}
  tMesh.instanceMatrix.needsUpdate=true;return mv}
function paintStatic(yi){const arr=HT&&heatOn?HY[hIdx(YR[yi])]:null,_c=new THREE.Color(),_a=new THREE.Color('#1b8a40'),_b=new THREE.Color('#2fa650');
  stBlocks.forEach((b,i)=>{if(b.lt===1)_c.copy(WATER).lerp(WATER2,b.h);else if(b.lt===2)_c.copy(BARE).lerp(BARE2,b.h);else if(b.lt===3)_c.copy(FIELD).lerp(FIELD2,.5);else _c.copy(_a).lerp(_b,.5);if(arr){const an=heatAt(arr,b.x+W/2,b.z+H/2);_c.lerp(heatCol(an,new THREE.Color()),heatMix(an))}smesh.setColorAt(i,_c)});smesh.instanceColor.needsUpdate=true}
function heatStat(yi){if(!HT||!HM)return;const k=hIdx(YR[yi]),avg=(i)=>{let a=0,n=0;for(let j=Math.max(0,i-2);j<=Math.min(HM.length-1,i+2);j++)if(HM[j]!=null){a+=HM[j];n++}return a/n},d=avg(k)-avg(Math.min(2,HM.length-1)),nf=new Intl.NumberFormat(LG,{maximumFractionDigits:1,minimumFractionDigits:1});
  document.getElementById('hvb').textContent=(k<=2?'':(d>=0?'+':'−')+nf.format(Math.abs(d))+' °C');document.getElementById('hvl').textContent=T('hv').replace('{y}',HT.years[Math.min(2,HT.years.length-1)]===YR[0]?YR[0]:HT.years[0])}
const sl=document.getElementById('sl'),pl=document.getElementById('pl'),tkEl=document.getElementById('tk'),tip=document.getElementById('tip');
sl.max=yi0;sl.value=yi0;
// city menu (src/cityMenu.js)
// the city menu of the top bar (src/ui/city-menu): a Preact component, it never touches the scene
const goCity=slug=>{if(slug===D.slug)return;if(PATHMODE){location.href=ROOTP+slug}else{location.hash=slug;location.reload()}};
mountCityMenu(document.querySelector('.crumb'),{cities:CITIES,current:{slug:D.slug,name:D.name},go:goCity});
let zpLang=()=>{};   // set by the hand tool below, called when the language changes
function applyLang(){domYi=-1;airLang();rainLang();document.documentElement.lang=LG;document.documentElement.dir=LG==='he'?'rtl':'ltr';document.querySelectorAll('[data-i]').forEach(e=>e.textContent=T(e.dataset.i));[['bf','before','bf'],['ht','heat','heat'],['ar','air','airb'],['rn','rain','rainb'],['mb','mobile','netb'],['hdb','hoods','hoods']].forEach(([id,ic,k])=>{const b=document.getElementById(id);if(b)b.innerHTML=IC[ic]+T(k)});{const b=document.getElementById('shr');b.innerHTML=IC.share;b.setAttribute('aria-label',T('shr'));b.title=T('shr')}document.querySelectorAll('[data-ih]').forEach(e=>e.innerHTML=T(e.dataset.ih));if(!OUTL)document.querySelectorAll('[data-i=pc]').forEach(e=>e.textContent=T('pcr').replace('{r}',RKM));
  document.querySelectorAll('.lang button').forEach(b=>b.classList.toggle('on',b.dataset.l===LG));try{localStorage.setItem('city_lang',LG)}catch(e){}
  document.title=((NAMES[D.slug]||{}).en||D.name.split(',')[0])+', '+YR[0]+'\u2013'+YR[yi0]+' \u00b7 Adama \u2013 40 years of cities spreading, seen from space';
  zpLang();window.__lh&&window.__lh();roadLabs.forEach(l=>{l.d.textContent=l.nm[LG]||l.nm.d||l.nm.en||l.nm.he});hoodTxt();dirty=true}
// graph: green area per year
const bars=document.getElementById('gb'),gy=YR.map((_,y)=>{let n=0;cells.forEach(c=>{if(c.in&&c.lt===0&&c.f>y)n++});return n*AR}),gmax=Math.max(...gy);
bars.innerHTML=gy.map((v,i)=>'<div class="bar" data-i="'+i+'"><div style="height:'+Math.round(v/gmax*100)+'%"></div></div>').join('');
// neighbourhood pills: change of the green share (points) around each OSM neighbourhood point, for the year on screen against the year before
const hoodLabs=[];
const makeHoods=raw=>{const SEP=34,list=[];hoodLabs.splice(0).forEach(l=>l.d.remove());
  raw.forEach(h=>{const [x,z]=toXZ(h[0],h[1]);if(Math.hypot(x,z)>RD-3)return;const r=h[5]==='suburb'?32:22;let n=0;const g=new Float64Array(YR.length);
    cells.forEach(c=>{if(!c.in||c.lt===1||Math.hypot(c.x-x,c.z-z)>r)return;n++;if(c.lt===0)for(let y=0;y<YR.length;y++)if(c.f>y)g[y]++});
    if(n<30)return;for(let y=0;y<YR.length;y++)g[y]=g[y]/n*100;list.push({h,x,z,g,loss:g[0]-g[YR.length-1]})});
  list.sort((a,b)=>b.loss-a.loss);const kept=[];
  for(const e of list){if(kept.length>=16)break;if(kept.every(k=>Math.hypot(k.x-e.x,k.z-e.z)>SEP))kept.push(e)}
  kept.forEach(e=>{const d=document.createElement('div');d.className='hd';d.innerHTML='<span></span><b><svg viewBox="0 0 14 14" width="12" height="12"><path d="M3.5 10.5 10.5 3.5M4.6 3.5h5.9v5.9"/></svg><i></i></b>';wrap.appendChild(d);hoodLabs.push({d,h:e.h,g:e.g,v:new THREE.Vector3(e.x,4,e.z)})});hoodYi=-1;dirty=true};
let hoodsOn=true,hoodYi=-1;const HOOD_MIN=.3,HOOD_ZOOM=1.3;   // pills appear once the map is zoomed in a little
const hoodTxt=()=>{const yi=Math.min(yi0,Math.max(0,Math.round(tt)));hoodYi=yi;hoodLabs.forEach(l=>{const h=l.h,nm=LG==='he'?(h[4]||h[2]):(h[3]||(/^[0-9 ]+$/.test(h[2])&&h[4]?h[4]:h[2]));l.d.firstChild.textContent=nm;
  const b=l.d.lastChild,dv=yi>0?l.g[yi]-l.g[yi-1]:0;b.style.display=Math.abs(dv)<HOOD_MIN?'none':'';b.classList.toggle('dn',dv<0);b.lastChild.textContent=(dv>0?'+':'−')+Math.abs(dv).toFixed(1)+' '+T('pts');l.d.title=YR[Math.max(0,yi-1)]+' → '+YR[yi]})};
if(D.hoods)makeHoods(D.hoods);   // pre-generated by scripts/neighborhoods.py; cities without the file simply have no pills
const NIN=cells.reduce((a,c)=>a+(c.in&&c.lt!==1?1:0),0),OUTL=cells.some(c=>!c.in);const NV=cells.reduce((a,c)=>a+(c.in&&c.lt===0?1:0),0);const BP0=cells.reduce((a,c)=>a+(c.in&&c.f<=0?1:0),0)/NIN*100,GP0=(NV-cells.reduce((a,c)=>a+(c.in&&c.lt===0&&c.f<=0?1:0),0))/NIN*100;const HASW=cells.some(c=>c.lt===1),HASB=cells.some(c=>c.lt===2);const RKM=(RD*CM/1000).toFixed(1);
const fArr=YR.map((_,y)=>{let n=0;cells.forEach(c=>{if(c.in&&c.lt===3&&c.f>y)n++});return n/NIN*100});   // fields still unbuilt, counted apart from the green
// Zoomed out (below zoom 1.2, the story included) the cells touch instead of keeping a 6 % gap: no speckle of gaps at about one pixel per cell.
// Merging cells into bigger blocks was tried (2x2, 4x4, 8x8): it gave dotted greens, white stripes and lattices, so cells stay single.
let LODm=1;   // 2 when zoomed out
// zoom thresholds with a 6% hysteresis so the level does not flicker at the edge
function lodFor(z){return z>=(LODm===1?1.2*.94:1.2*1.06)?1:2}
function animStep(k){let mv=false;const ma=mesh.instanceMatrix.array,ca=mesh.instanceColor.array;
  for(let i=0;i<ND;i++){let d=Tg[i]-Ch[i];if(d>.002||d<-.002){Ch[i]+=d*k;mv=true}else Ch[i]=Tg[i];
    const o=i*16;const sc=LODm>1?1:.94+.06*Math.max(0,Math.min(1,(.7-Ch[i])/.3));   // zoomed out the cells touch: no speckle of gaps
    ma[o]=sc;ma[o+5]=Math.max(.05,Ch[i]);ma[o+10]=sc;ma[o+12]=DX[i];ma[o+14]=DZ[i];ma[o+15]=1;
    const i3=i*3;for(let j=0;j<3;j++){const e=Cg[i3+j]-Cc[i3+j];if(e>.002||e<-.002){Cc[i3+j]+=e*k;mv=true}else Cc[i3+j]=Cg[i3+j];ca[i3+j]=Cc[i3+j]}}
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;return stepTowers(Math.min(1,k*.7))||mv}
let airLang=()=>{},airOn=false,airV=null,rainLang=()=>{},rainUpd=()=>{},rainFx=false,rainSet=()=>{},rainTick=()=>{},rainBase=.2,mobUpd=()=>{},mobTick=()=>{},mobOn=false,mobSet=()=>{};
// ---------- air haze: stacked translucent veils above the city, grainy like the green; the grain gets coarser and stronger when the air is worse ----------
const HZ_Y=[5,9.5,14,18.5],HZ_U={uT:UT,uA:{value:.02},uG:{value:.5},uS:{value:.7}};
const hzMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:HZ_U,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 vUv;uniform float uT,uA,uG,uS;void main(){float r=length(vUv-.5)*2.;float edge=1.-smoothstep(.8,1.,r);vec2 gq=floor(gl_FragCoord.xy*uS)+floor(uT*.4)*vec2(17.3,9.1);float gn=fract(sin(dot(gq,vec2(12.9898,78.233)))*43758.5453);gl_FragColor=vec4(.42,.42,.44,uA*edge*(1.-uG+uG*2.*gn));}'});
const haze=new THREE.Group();haze.visible=false;HZ_Y.forEach(y=>{const m=new THREE.Mesh(new THREE.CircleGeometry(RD*1.03,96).rotateX(-Math.PI/2),hzMat);m.position.y=y;m.renderOrder=8;m.frustumCulled=false;haze.add(m)});scene.add(haze);
function hazeSet(){const who=(D.air&&D.air.who_pm25)||5,k=airV==null?0:Math.min(1,Math.max(0,(airV-who)/25));haze.visible=airOn&&airV!=null;
  const total=.07+.38*k;HZ_U.uA.value=1-Math.pow(1-total,1/HZ_Y.length);HZ_U.uG.value=.5+.45*k;HZ_U.uS.value=.75-.45*k;
  // bad air also dulls the colours (no tint, so it cannot be mistaken for desert)
  renderer.domElement.style.filter=airOn&&airV!=null?'saturate('+(1-.6*k).toFixed(2)+') contrast('+(1-.14*k).toFixed(2)+') brightness('+(1-.1*k).toFixed(2)+')':''}
function animHaze(tm){if(!haze.visible)return;haze.children.forEach((m,i)=>{m.position.y=HZ_Y[i]+(VX-1)*5*(i+1)/HZ_Y.length+Math.sin(tm*.12+i)*.2})}
// ---------- air quality (air.json from scripts/air_quality.py): yearly PM2.5 curve that follows the timeline ----------
const AIR=D.air&&D.air.series&&D.air.series.pm25,AIRL=D.air&&D.air.live;let airUpd=()=>{};
if(AIR||AIRL){const el=document.createElement('div');el.className='air';document.getElementById('cards').prepend(el);
  const W_=170,H_=44,y0=AIR?AIR.years[0]:0,y1=AIR?AIR.years[AIR.years.length-1]:1,who=D.air.who_pm25||5,vmax=AIR?Math.max(who*1.4,...AIR.values)*1.08:1,
    X=y=>2+(y-y0)/Math.max(1,y1-y0)*(W_-4),Y=v=>H_-3-v/vmax*(H_-8),br=AIR&&AIR.break_before;
  const pts=AIR?AIR.years.map((y,i)=>[y,AIR.values[i]]):[],line=a=>a.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ');
  const old=br?pts.filter(p=>p[0]<=br):[],cur=br?pts.filter(p=>p[0]>=br):pts;
  const svg=AIR?'<svg viewBox="0 0 '+W_+' '+H_+'" width="'+W_+'" height="'+H_+'"><line x1="0" x2="'+W_+'" y1="'+Y(who)+'" y2="'+Y(who)+'" class="aw"/>'+(old.length>1?'<polyline points="'+line(old)+'" class="ao"/>':'')+(cur.length>1?'<polyline points="'+line(cur)+'" class="ac"/>':'')+'<line id="aml" y1="0" y2="'+H_+'" class="am"/><circle id="amc" r="3" class="ad"/></svg>':'';
  airUpd=yr=>{if(!AIR)return;if(yr>y1)yr=y1;const i=AIR.years.indexOf(yr),v=i<0?null:AIR.values[i];
    airV=v;hazeSet();
    
    el.querySelector('.av').innerHTML=v==null?'<span class="no">'+T('airno').replace('{y}',y0)+'</span>':(v>who*1.15?T('airx').replace('{x}','<b>'+(v/who).toFixed(v/who<10?1:0).replace(/\.0$/,'')+'</b>'):'<b>'+T('airok')+'</b>');
    el.title=[T('airwhat'),v==null?'':T('airsub').replace('{y}',yr)+' · '+v.toFixed(0)+' '+T('airu'),AIRL?T('airnow').replace('{a}',AIRL.aqi).replace('{s}',AIRL.station).replace('{d}',AIRL.distance_km):'',AIR?(br?T('airbrk').replace('{y}',br)+' · ':'')+T('airsrc').replace('{s}',AIR.source).replace('{r}',AIR.res_km||'<1'):''].filter(Boolean).join('\n');
    const l=el.querySelector('#aml'),c=el.querySelector('#amc');l.style.display=c.style.display=v==null?'none':'';if(v!=null){l.setAttribute('x1',X(yr));l.setAttribute('x2',X(yr));c.setAttribute('cx',X(yr));c.setAttribute('cy',Y(v))}};
  const notes=()=>(AIRL?'<div>'+T('airnow').replace('{a}',AIRL.aqi).replace('{s}',AIRL.station).replace('{d}',AIRL.distance_km)+'</div>':'')+(AIR?'<div>'+(br?T('airbrk').replace('{y}',br)+' · ':'')+T('airsrc').replace('{s}',AIR.source).replace('{r}',AIR.res_km||'<1')+'</div>':'');
  const arB=document.getElementById('ar');arB.style.display='';arB.onclick=()=>{airOn=!airOn;arB.classList.toggle('on',airOn);document.body.classList.toggle('airon',airOn);hazeSet();const yi=Math.min(yi0,Math.max(0,Math.round(tt)));airUpd(YR[yi]);dirty=true};
  airLang=()=>{el.innerHTML='<div class="ah"><div class="ax"><div class="at">'+T('air')+'</div><div class="av"></div></div>'+svg+'</div>';airUpd(YR[Math.min(yi0,Math.max(0,Math.round(tt)))])}}
// ---------- rainfall (rain.json from scripts/rainfall.py, CHIRPS): a small card with the yearly total and its 5-year average, no layer on the map ----------
const RAIN=D.rain&&D.rain.years&&D.rain.years.length>=10?D.rain:null;
if(RAIN){const el=document.getElementById('rain');
  const W_=170,H_=44,ys=RAIN.years,vs=RAIN.values,y0=ys[0],y1=ys[ys.length-1],mean=vs.reduce((a,b)=>a+b,0)/vs.length,vmax=Math.max(...vs)*1.04,vmin=Math.min(...vs)*.7,   // the scale starts under the driest year, not at zero: a line over 0-900 mm would look flat
    X=y=>2+(y-y0)/Math.max(1,y1-y0)*(W_-4),Y=v=>H_-3-(v-vmin)/(vmax-vmin)*(H_-8),
    ABS=RAIN.absolute!==false,   // a model that is known to run low (Open-Meteo): only the gap to the average is shown, not millimetres
    avg=ys.map((_,i)=>i<4?null:vs.slice(i-4,i+1).reduce((a,b)=>a+b,0)/5),line=a=>a.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ');
  const svg='<svg viewBox="0 0 '+W_+' '+H_+'" width="'+W_+'" height="'+H_+'"><line x1="0" x2="'+W_+'" y1="'+Y(mean)+'" y2="'+Y(mean)+'" class="rw"/><polyline points="'+line(ys.map((y,i)=>[y,vs[i]]))+'" class="ro"/><polyline points="'+line(ys.map((y,i)=>[y,avg[i]]).filter(p=>p[1]!=null))+'" class="rc"/><line id="rml" y1="0" y2="'+H_+'" class="rm"/><circle id="rmc" r="3" class="rd"/></svg>';
  rainUpd=yr=>{if(yr>y1)yr=y1;const i=ys.indexOf(yr),v=i<0?null:vs[i],d=v==null?0:Math.round((v/mean-1)*100);
    const sg=(d>0?'+':d<0?'\u2212':'')+Math.abs(d);
    el.querySelector('.rv').innerHTML=v==null?'<span class="no">'+T('airno').replace('{y}',y0)+'</span>':ABS?'<b>'+v+'</b> '+T('rainu')+' <span class="rp">'+T('rainvs').replace('{d}',sg)+'</span>':'<b>'+sg+' %</b> <span class="rp">'+T('rainrel').replace('{a}',y0).replace('{b}',y1)+'</span>';
    el.title=[T(ABS?'rainwhat':'rainwhat2').replace('{m}',Math.round(mean)).replace('{a}',y0).replace('{b}',y1),ABS&&v!=null?T('rainyr').replace('{y}',yr).replace('{v}',v):'',T('rainsrc').replace('{s}',RAIN.source).replace('{r}',RAIN.res_km)].filter(Boolean).join('\n');
    const l=el.querySelector('#rml'),c=el.querySelector('#rmc');l.style.display=c.style.display=v==null?'none':'';if(v!=null){l.setAttribute('x1',X(yr));l.setAttribute('x2',X(yr));c.setAttribute('cx',X(yr));c.setAttribute('cy',Y(v))}};
  rainLang=()=>{el.innerHTML='<div class="rh"><div class="rx"><div class="rt">'+T('rain')+'</div><div class="rv"></div></div>'+svg+'</div>';rainUpd(YR[Math.min(yi0,Math.max(0,Math.round(tt)))])}
  // the rain over the city (discreet): vertical streaks, more of them in a wet year, with the card; the RAIN button shows or hides both
  const NMAX=1600,HR=84,RU={uT:UT,uA:{value:0},uH:{value:HR},uL:{value:2.6},uF:{value:14}},rp=new Float32Array(NMAX*6);
  for(let k=0;k<NMAX;k++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*RD,x=Math.cos(a)*r,z=Math.sin(a)*r,y=Math.random()*HR;rp.set([x,y,z,x,y,z],k*6);}
  const rg=new THREE.BufferGeometry(),end=new Float32Array(NMAX*2),sd=new Float32Array(NMAX*2);for(let k=0;k<NMAX;k++){const q=Math.random();end[k*2]=0;end[k*2+1]=1;sd[k*2]=sd[k*2+1]=q}
  rg.setAttribute('position',new THREE.BufferAttribute(rp,3));rg.setAttribute('aEnd',new THREE.BufferAttribute(end,1));rg.setAttribute('aSd',new THREE.BufferAttribute(sd,1));
  const rm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:RU,
    vertexShader:'attribute float aEnd,aSd;uniform float uT,uH,uL,uF;varying float vA;void main(){float y=mod(position.y-uT*(9.+7.*aSd),uH);vA=smoothstep(uF,uF+16.,y)*(1.-smoothstep(uH*.7,uH,y))*(.45+.55*aEnd);vec3 p=vec3(position.x+y*.12,y+uL*aEnd,position.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader:'uniform float uA;varying float vA;void main(){gl_FragColor=vec4(.36,.62,1.,uA*vA);}'});
  const rain=new THREE.LineSegments(rg,rm);rain.frustumCulled=false;rain.renderOrder=9;rain.visible=false;scene.add(rain);
  const fxApply=(yr)=>{const i=ys.indexOf(Math.min(yr,y1)),v=i<0?mean:vs[i],k=Math.max(.08,Math.min(1,.5*v/mean));rg.setDrawRange(0,Math.round(NMAX*k)*2);rainBase=.34+.3*k};
  const rnB=document.getElementById('rn'),fxShow=()=>{rain.visible=document.body.classList.contains('exp')&&rainFx;   // (not `explore`: update() runs once before it is declared)
    document.body.classList.toggle('rainon',rainFx);rnB.classList.toggle('on',rainFx)};
  rnB.style.display='';
  rainSet=v=>{rainFx=v;fxShow();dirty=true};rnB.onclick=()=>rainSet(!rainFx);
  const upd0=rainUpd;rainUpd=yr=>{upd0(yr);fxApply(yr);fxShow()};
  rainTick=()=>{rain.visible=document.body.classList.contains('exp')&&rainFx;if(rain.visible){RU.uA.value=rainBase*Math.min(1,3.2/cam.zoom);RU.uF.value=haze.visible?22+(VX-1)*5.5:14}}   // with the haze on, the rain stays above its top veil (it rises with the zoom) and never crosses it   // zoomed in, the streaks would look huge: fainter
}
// observed mobile network (scripts/mobile_network.py): a white lattice floating over the city, tighter and brighter where the network is denser.
// Only a coarse grid (400 m blocks) comes from the file, no antenna position. The density of the selected year is a small texture read by the vertex shader.
const MOB=D.mobile&&D.mobile.years?D.mobile:null;
if(MOB){const bw=MOB.w,bh=MOB.h,bc=MOB.block_m/CM,grids=MOB.data.map(b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0))),tex=new THREE.DataTexture(new Uint8Array(bw*bh),bw,bh,THREE.RedFormat,THREE.UnsignedByteType);
  tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;tex.needsUpdate=true;
  // square lattice floating low over the city (the most readable shape): coarse lines every 4th, fine every 2nd, finest all; the denser the network the more of them show
  const st=Math.max(2,Math.ceil(Math.max(W,H)/110)),P=[],L=[],nx=Math.floor(W/st),nz=Math.floor(H/st),lv=i=>i%4===0?0:i%2===0?1:2;
  const TH=[0];
  for(let j=0;j<=nz;j++)for(let i=0;i<nx;i++)TH.forEach(o=>{P.push(i*st-W/2,0,j*st-H/2+o,(i+1)*st-W/2,0,j*st-H/2+o);L.push(lv(j),lv(j))});
  for(let i=0;i<=nx;i++)for(let j=0;j<nz;j++)TH.forEach(o=>{P.push(i*st-W/2+o,0,j*st-H/2,i*st-W/2+o,0,(j+1)*st-H/2);L.push(lv(i),lv(i))});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aLv',new THREE.Float32BufferAttribute(L,1));
  const MU={uD:{value:tex},uS:{value:new THREE.Vector2(1/(bw*bc),1/(bh*bc))},uO:{value:new THREE.Vector2(W/2,H/2)},uA:{value:.55},uAmp:{value:2},uR:{value:RD},uH:{value:0},uT:{value:0},uP:{value:st/3}};
  const mm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:MU,
    vertexShader:'attribute float aLv;uniform sampler2D uD;uniform vec2 uS,uO;uniform float uAmp,uR,uH,uT;varying float vA;varying vec2 vP;void main(){vP=position.xz;vec2 uv=(position.xz+uO)*uS;'+
      'float d=pow(texture2D(uD,uv).r,.7);float t=aLv<.5?.03:aLv<1.5?.22:.5;vA=smoothstep(t,t+.12,d)*(.7+.6*d)*(1.-smoothstep(.8,1.,length(position.xz)/uR));'+
      'float q=length(position.xz)/uR,w=0.;for(int k=0;k<2;k++){float x=q-fract(uT*.06+float(k)*.5)*1.25;w+=(x>0.?exp(-x*x/.0004):exp(x/.09))*(1.-smoothstep(.85,1.,q));}vA=min(1.,vA*(1.+2.2*w));gl_Position=projectionMatrix*modelViewMatrix*vec4(position.x,d*uAmp,position.z,1.);}',
    fragmentShader:'uniform float uA,uP;varying float vA;varying vec2 vP;void main(){float dt=1.;gl_FragColor=vec4(1.,1.,1.,uA*vA*dt);}'});
  const mesh=new THREE.LineSegments(g,mm);mesh.frustumCulled=false;mesh.renderOrder=9;mesh.visible=false;scene.add(mesh);
  const mbB=document.getElementById('mb'),y0=MOB.years[0],y1=MOB.years[MOB.years.length-1],empty=new Uint8Array(bw*bh);
  const show=()=>{mesh.visible=document.body.classList.contains('exp')&&mobOn;mbB.classList.toggle('on',mobOn);mbB.title=T('nett')};
  mobUpd=yr=>{tex.image.data.set(yr<y0?empty:grids[Math.min(yr,y1)-y0]);tex.needsUpdate=true;show()};
  mbB.style.display='';mobSet=v=>{mobOn=v;show();dirty=true};mbB.onclick=()=>mobSet(!mobOn);
  mobTick=()=>{mesh.visible=document.body.classList.contains('exp')&&mobOn;if(mesh.visible){mesh.position.y=4+VX*1.5;MU.uT.value=performance.now()/1000;MU.uA.value=1}}
}
let VX=1,roadLv=1;let RDEN=[0,0,0];   // km of road per km2 once the wide, then the wide + narrow, then all roads are drawn
const roadBudget=z=>.25*Math.pow(z,2.5);   // road density the view can take at this zoom
// buildings grow taller when zoomed in, for contrast with the ground
function update(t){
  const yi=Math.min(yi0,Math.max(0,Math.round(t)));airUpd(YR[yi]);rainUpd(YR[yi]);mobUpd(YR[yi]);
  let bt=0,nw=0,gv=0;const HYc=HT&&heatOn?HY[hIdx(YR[yi])]:null;
  for(let i=0;i<cells.length;i++){const c=cells[i];if(c.st)continue;let h,color;const hv=c.h;
    const ye=lensOn&&hp&&Math.hypot(c.x-hp.x,c.z-hp.z)<LR?(yi>yi0/2?0:yi0):t;const built=c.f<=ye+1e-6;
    if(rdOn(c)&&(built||c.f===999)){h=.08;color=col.copy(c.road===2?ROAD_MAJ:c.road===1?ROAD_MIN:ROAD_MIN3)}
    else if(built){const h0=.8+c.nb*1.1+hv*.9;h=h0*VX;const age=ye-c.f;color=gray(h0);if(c.f>0&&age<3)color.lerp(WH,(1-age/3)*.85)}
    else if(c.f<999&&(c.lt===0||c.lt===3)&&c.f-1<ye){const k=ye-c.f+1,hb=(.8+c.nb*1.1+hv*.9)*VX,hg=.42;h=hg+(hb-hg)*k;color=col.copy(WH)}
    else if(c.lt===1){h=.06;color=col.copy(WATER).lerp(WATER2,hv)}
    else if(c.lt===2){h=.2+hv*.12;color=col.copy(BARE).lerp(BARE2,hv)}
    else if(c.lt===3){h=.8;color=col.copy(FIELD).lerp(FIELD2,.5)}
    else{h=.42;color=col.copy(G1).lerp(G2,.5)}
    if(heatOn&&HT&&!(rdOn(c)&&(built||c.f===999))){{const an=heatAt(HYc,c.gx+.5,c.gy+.5);color=color.clone().lerp(heatCol(an,hCol),heatMix(an))}}
    if(c.in&&c.f<=yi){bt++;if(c.lt===0)gv++;if(c.f===yi&&yi>0)nw++}
    Tg[c.di]=h;Cg[c.di*3]=color.r;Cg[c.di*3+1]=color.g;Cg[c.di*3+2]=color.b}
  for(let i=0;i<NT;i++){const T=TD[i];TTg[i]=T?Math.max(0,Math.min(1,t-T.f+1)):0}
  if(firstFill){firstFill=false;Ch.set(Tg);Cc.set(Cg)}animating=true;
  facG.visible=yi===yi0;
  if(yi===domYi){refreshTip(yi);return}domYi=yi;if(heatOn)paintStatic(yi),heatStat(yi);
  document.getElementById('yr').textContent=YR[yi];
  const sensor=LS.has(YR[yi])?T('s30'):(YR[yi]<=2018?T('sb'):T('s10'));{const sn=document.getElementById('sn');sn.textContent=sensor.split(',')[0];sn.title=sensor}
  sl.style.setProperty('--p',(yi/yi0*100)+'%');
  tkEl.querySelectorAll('div').forEach(d=>d.classList.toggle('on',+d.dataset.idx===yi));
  bars.querySelectorAll('.bar').forEach(b=>b.classList.toggle('on',+b.dataset.i===yi));
  const nf=new Intl.NumberFormat(LG,{maximumFractionDigits:1,minimumFractionDigits:0}),P=v=>nf.format(v),sg=v=>(v>0?'+':v<0?'\u2212':'')+P(Math.abs(v));
  const bp=bt/NIN*100,bp0=BP0,dNew=nw/NIN*100;
  document.getElementById('f1').textContent=P(Math.round(bp))+' %';
  document.getElementById('f2').textContent=yi===0?'\u2014':sg(Math.round(bp-bp0))+' '+T('pts');document.getElementById('l2').textContent=T('sinceb').replace('{y}',YR[0]);
  
  document.getElementById('f3').textContent=yi===0?'\u2014':sg(Math.round(dNew*10)/10)+' '+T('pts');document.getElementById('l3').textContent=T('newy');['f2','f3'].forEach(k=>document.getElementById(k).parentElement.style.display=yi===0?'none':'');
  const gp=(NV-gv)/NIN*100;document.getElementById('pc').textContent=Math.round(gp)+' %';{const fe=document.getElementById('gf'),fv=Math.round(fArr[yi]);fe.textContent=fv>=1?T('fieldsl').replace('{n}',P(fv)):'';fe.style.display=fv>=1?'':'none'}document.getElementById('gt').innerHTML=yi===0?'':TA(gp<GP0)+P(Math.abs(Math.round(gp-GP0)))+' '+T('pts')+' '+T('since').replace('{y}',YR[0]);
  refreshTip(yi)}
// timeline ticks every 5 years
YR.forEach((y,i)=>{if(i===0||i===yi0||(y%5===0&&i>2&&yi0-i>2)){const d=document.createElement('div');d.dataset.idx=i;d.style.left=(i/yi0*100)+'%';d.textContent=y;d.onclick=()=>{stop();tt=i;sl.value=i;update(i)};tkEl.appendChild(d)}});
function stop(){run=false;pl.innerHTML='&#9664;';}
sl.oninput=()=>{stop();tt=+sl.value;update(tt)};
pl.onclick=()=>{run=!run;pl.innerHTML=run?'&#10074;&#10074;':'&#9664;';if(run&&tt<=0)tt=yi0};
const roEl=document.getElementById('ro');roEl.checked=true;ctl.autoRotate=true;ctl.autoRotateSpeed=.3;let idleT=0;
roEl.onchange=e=>{ctl.autoRotate=e.target.checked;idleT=0};
renderer.domElement.addEventListener('pointerdown',()=>{ctl.autoRotate=false;idleT=0});
addEventListener('wheel',()=>{if(ctl.autoRotate){ctl.autoRotate=false}idleT=0},{passive:true});
// playgrounds: clay slides
// playgrounds: floating clay balloons on thin strings (instanced, gently bobbing)
facG=new THREE.Group();scene.add(facG);
const BP=[];D.osm.playgrounds.forEach((p,i)=>{const [x,z]=toXZ(p[0],p[1]);if(!cellAt(x,z))return;BP.push({x,z,ph:(i*2.399)%(Math.PI*2),k:i%4})});
const BCOL=[0xa56bff,0xa56bff,0xa56bff,0xa56bff].map(c=>new THREE.Color(c));
const bmesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,28,20),new THREE.MeshStandardMaterial({roughness:.35,metalness:0,emissive:0x5a1fd0,emissiveIntensity:.45}),Math.max(1,BP.length));
bmesh.castShadow=true;bmesh.frustumCulled=false;BP.forEach((b,i)=>bmesh.setColorAt(i,BCOL[b.k]));facG.add(bmesh);
const bline=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(BP.length*6),3)),new THREE.LineBasicMaterial({color:0xa56bff,transparent:true,opacity:.3}));bline.frustumCulled=false;facG.add(bline);
const bdot=new THREE.InstancedMesh(new THREE.CylinderGeometry(.55,.55,.05,20),new THREE.MeshBasicMaterial({color:0xa56bff,transparent:true,opacity:.55,depthWrite:false}),Math.max(1,BP.length));
{const m=new THREE.Matrix4();BP.forEach((b,i)=>{m.makeTranslation(b.x,.3,b.z);bdot.setMatrixAt(i,m)});bdot.instanceMatrix.needsUpdate=true}facG.add(bdot);
const _bm=new THREE.Matrix4(),_bq=new THREE.Quaternion(),_bp=new THREE.Vector3(),_bs=new THREE.Vector3();
function animBalloons(tm){if(!facG.visible)return;const pa=bline.geometry.attributes.position;
  BP.forEach((b,i)=>{const y=2+5*VX+Math.sin(tm*.9+b.ph)*.55,x=b.x+Math.sin(tm*.6+b.ph*1.7)*.35,z=b.z+Math.cos(tm*.5+b.ph)*.35;
    _bp.set(x,y,z);_bs.set(.9,1.1,.9);_bm.compose(_bp,_bq,_bs);bmesh.setMatrixAt(i,_bm);
    pa.setXYZ(i*2,b.x,.3,b.z);pa.setXYZ(i*2+1,x,y-1.05,z)});
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
{const zoomBy=f=>{cam.zoom=Math.min(ctl.maxZoom,Math.max(ctl.minZoom,cam.zoom*f));cam.updateProjectionMatrix();dirty=true};document.getElementById('zi').onclick=()=>zoomBy(1.4);document.getElementById('zo').onclick=()=>zoomBy(1/1.4);
// hand tool: the usual way to move around, next to the zoom buttons. Left drag pans instead of rotating (right-click or Shift + drag always pan).
const zp=document.getElementById('zp');let hand=false;
const setHand=v=>{hand=v;zp.setAttribute('aria-pressed',v);ctl.mouseButtons={LEFT:v?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:v?THREE.MOUSE.ROTATE:THREE.MOUSE.PAN};ctl.touches={ONE:v?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE,TWO:v?THREE.TOUCH.DOLLY_ROTATE:THREE.TOUCH.DOLLY_PAN};renderer.domElement.style.cursor=v?'grab':''};
zp.onclick=()=>setHand(!hand);zpLang=()=>{zp.dataset.tip=zp.ariaLabel=T('pan')};zpLang();
// trackpad pinch: Chrome sends ctrl+wheel (which would zoom the page), Safari sends gesture events
addEventListener('wheel',e=>{if(!e.ctrlKey||!explore)return;e.preventDefault();zoomBy(Math.exp(-e.deltaY*.01))},{passive:false});
let g0=1;addEventListener('gesturestart',e=>{if(explore){e.preventDefault();g0=cam.zoom}});addEventListener('gesturechange',e=>{if(explore){e.preventDefault();cam.zoom=Math.min(ctl.maxZoom,Math.max(ctl.minZoom,g0*e.scale));cam.updateProjectionMatrix();dirty=true}})}
// my position
const me=document.createElement('div');me.className='me';me.style.display='none';me.innerHTML='<i></i>';document.body.appendChild(me);let meV=null,meLL=null,meGps=null;   // meLL: the placed address (goes in the link); meGps: the user's own position (never in the link, nor the centre when the view is still on it)const msg=document.getElementById('gm');
// my position: the scene side of the Position component (src/ui/Position.jsx), which owns the states and the markup
const clearPos=()=>{meV=null;meLL=null;meGps=null;me.style.display='none';hp=null;tip.style.display='none';dirty=true};
const place=(lat,lon,gps)=>{const [x,z]=toXZ(lat,lon);
  if(Math.abs(x)>W/2+5||Math.abs(z)>H/2+5){const dx=Math.max(0,Math.abs(x)-W/2)*CM,dz=Math.max(0,Math.abs(z)-H/2)*CM;meV=null;me.style.display='none';return {ok:false,km:(Math.hypot(dx,dz)/1000).toFixed(1)}}
  meV=new THREE.Vector3(x,6,z);meLL=gps?null:[lat,lon];meGps=gps?[lat,lon]:null;{const d=new THREE.Vector3(x,0,z).sub(ctl.target);cam.position.add(d);ctl.target.add(d);cam.zoom=Math.max(cam.zoom,5);cam.updateProjectionMatrix();ctl.update()}me.style.display='block';
  hp=new THREE.Vector3(x,1,z);tipX=wrap.clientWidth/2;tipY=wrap.clientHeight/2;dirty=true;return {ok:true}};
// a shared link that holds a point: draw the marker and tell the bar (no camera move, the saved view already looks at it)
const restoreMe=(lat,lon)=>{const [x,z]=toXZ(lat,lon);if(Math.abs(x)>W/2+5||Math.abs(z)>H/2+5)return;meV=new THREE.Vector3(x,6,z);meLL=[lat,lon];me.style.display='block';dirty=true;dispatchEvent(new CustomEvent('adama:pos-restored'))};
// Address search for the Position component: OpenStreetMap (Photon, then Nominatim), limited to the box of this city.
// OpenStreetMap often lacks the house number, so the search is repeated without numbers.
const findAddr=async q0=>{const [w,s,e,n]=D.bbox,city=nm0();
  // a pasted Google Maps link (the place pin !3d..!4d.. first, else the centre @lat,lon) or plain coordinates: no geocoder needed
  {const g=q0.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)||q0.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)||q0.match(/^\s*(-?\d{1,2}\.\d+)\s*[,; ]\s*(-?\d{1,3}\.\d+)\s*$/);if(g)return [{lat:+g[1],lon:+g[2]}]}
  const photon=async q=>{const r=await fetch('https://photon.komoot.io/api/?limit=1&lang='+(LG==='fr'?'fr':'en')+'&bbox='+[w,s,e,n].join(',')+'&q='+encodeURIComponent(q+' '+city)),j=await r.json();return j.features.map(f=>({lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0]}))};
  const nominatim=async q=>{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&bounded=1&viewbox='+[w,n,e,s].join(',')+'&q='+encodeURIComponent(q),{headers:{'Accept-Language':LG}});return r.json()};
  const find=async q=>{for(const f of [photon,nominatim]){try{const j=await f(q);if(j.length)return j}catch(x){}}return[]};
  let j=await find(q0);const q2=q0.replace(/\d+[a-z]?/gi,' ').replace(/[,\s]+/g,' ').trim();if(!j.length&&q2&&q2!==q0)j=await find(q2);return j};
mountPosition(document.getElementById('posroot'),{place,clear:clearPos,find:findAddr});
const hdB=document.getElementById('hdb');if(hoodLabs.length){/* the Districts button stays hidden (the pills already appear only when zoomed in); shared links that hide them still work through hdB.click() */hdB.classList.add('on');hdB.onclick=()=>{hoodsOn=!hoodsOn;hdB.classList.toggle('on',hoodsOn);dirty=true}}
const htB=document.getElementById('ht');if(HT){htB.style.display='';htB.onclick=()=>{heatOn=!heatOn;htB.classList.toggle('on',heatOn);document.body.classList.toggle('heat',heatOn);const yi=Math.min(yi0,Math.max(0,Math.round(tt)));paintStatic(yi);if(heatOn)heatStat(yi);domYi=-1;update(tt);dirty=true}}
const bfB=document.getElementById('bf');bfB.onclick=()=>{lensOn=!lensOn;bfB.classList.toggle('on',lensOn);dirty=true};
document.querySelectorAll('.lang button').forEach(b=>b.onclick=()=>ui.getState().setLang(b.dataset.l));
ui.subscribe(state=>{if(state.lang!==LG){LG=state.lang;applyLang()}});   // the language buttons only set the store; the page and the components follow
const compass=document.getElementById('cp');
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;renderer.setSize(w,h);const asp=w/h,wide=w>900,s=wide?RD*Math.max(.8,.98/asp):RD*.97/asp;cam.left=-s*asp;cam.right=s*asp;cam.top=s;cam.bottom=-s;if(wide)cam.setViewOffset(w,h,-w*.2,0,w,h);else cam.setViewOffset(w,h,0,-h*.09,w,h);cam.updateProjectionMatrix()}
addEventListener('resize',resize);resize();document.getElementById('lw').style.display=HASW?'':'none';document.getElementById('lb').style.display=HASB?'':'none';document.getElementById('lf').style.display=cells.some(c=>c.lt===3)?'':'none';applyLang();update(tt);ctl.enabled=false;renderer.domElement.style.pointerEvents='none';
let last=0,acc=0,DLY=null;
// ---------- scroll story ----------
const nm0=()=>(NAMES[D.slug]||{})[LG]||D.name.split(',')[0];
const bArr=YR.map((_,y)=>{let n=0;cells.forEach(c=>{if(c.in&&c.f<=y)n++});return n/NIN*100});
let ib=yi0,bestG=-1;for(let y=Math.min(5,yi0);y<=yi0;y++){const g=bArr[y]-bArr[Math.max(0,y-5)];if(g>bestG){bestG=g;ib=y}}
const ia=Math.max(0,ib-5);
const gArr=YR.map((_,y)=>{let n=0;cells.forEach(c=>{if(c.in&&c.lt===0&&c.f>y)n++});return n/NIN*100});
const lat0=(D.center?D.center[0]:(D.bbox[1]+D.bbox[3])/2).toFixed(2),lon0=(D.center?D.center[1]:(D.bbox[0]+D.bbox[2])/2).toFixed(2);
const ARR='<svg class="ra" viewBox="0 0 14 14"><path d="M2 7h9.5M7.5 3 11.5 7 7.5 11"/></svg>';
const ST={
fr:{s0:()=>({k:nm0().toUpperCase()+' · '+lat0+'°N '+lon0+'°E',h:'Où est passé le vert ?',p:'Des images satellites gratuites, de '+YR[0]+' à '+YR[yi0]+'. Fais défiler.'}),
 s1:()=>({k:YR[ia]+ARR+YR[ib],b:'+'+Math.round(bArr[ib]-bArr[ia])+' pts',p:'de la ville est devenue bâtie en cinq ans. C\u2019est la plus forte poussée.',n:'Chaque bloc blanc vient de basculer.'}),
 s2:()=>{const d=bArr[yi0]-bArr[ib],n=yi0-ib;return{k:'DEPUIS '+YR[ib],b:'+'+Math.round(d)+' pts',p:'en '+n+' ans'+(n>0&&d/n<bestG/5?' : le rythme ralentit.':' : la ville continue de grandir.')}},
 s3:()=>({k:'CE QUI RESTE VERT',b:Math.round(gArr[yi0])+' %',g:1,p:'de la ville est encore verte, contre '+Math.round(gArr[0])+' % en '+YR[0]+'.',n:'Parcs, jardins, arbres et terrains. Les champs sont comptés à part.'}),back:'↑ Histoire'},
en:{s0:()=>({k:nm0().toUpperCase()+' · '+lat0+'°N '+lon0+'°E',h:'Where did the green go?',p:'Free satellite images, from '+YR[0]+' to '+YR[yi0]+'. Scroll.'}),
 s1:()=>({k:YR[ia]+ARR+YR[ib],b:'+'+Math.round(bArr[ib]-bArr[ia])+' pts',p:'of the city became built in five years. The biggest push.',n:'Each white block just flipped.'}),
 s2:()=>{const d=bArr[yi0]-bArr[ib],n=yi0-ib;return{k:'SINCE '+YR[ib],b:'+'+Math.round(d)+' pts',p:'in '+n+' years'+(n>0&&d/n<bestG/5?': the pace slows down.':': the city keeps growing.')}},
 s3:()=>({k:'WHAT STAYS GREEN',b:Math.round(gArr[yi0])+' %',g:1,p:'of the city is still green, down from '+Math.round(gArr[0])+' % in '+YR[0]+'.',n:'Parks, gardens, trees and open land. Fields are counted apart.'}),back:'↑ Story'},
he:{s0:()=>({k:nm0()+' · '+lat0+'°N '+lon0+'°E',h:'לאן נעלם הירוק?',p:'תמונות לוויין חינמיות, מ־'+YR[0]+' עד '+YR[yi0]+'. גלול.'}),
 s1:()=>({k:YR[ia]+ARR+YR[ib],b:'+'+Math.round(bArr[ib]-bArr[ia])+' pts',p:'מהעיר נבנו בחמש שנים. הדחיפה הגדולה ביותר.',n:'כל בלוק לבן הרגע התהפך.'}),
 s2:()=>{const d=bArr[yi0]-bArr[ib],n=yi0-ib;return{k:'מאז '+YR[ib],b:'+'+Math.round(d)+' pts',p:'ב־'+n+' שנים'+(n>0&&d/n<bestG/5?': הקצב מואט.':': העיר ממשיכה לגדול.')}},
 s3:()=>({k:'מה נשאר ירוק',b:Math.round(gArr[yi0])+' %',g:1,p:'מהעיר עדיין ירוק, לעומת '+Math.round(gArr[0])+' % ב־'+YR[0]+'.',n:'פארקים, גינות, עצים ושטח פתוח. שדות נספרים בנפרד.'}),back:'↑ סיפור'}};
const SECH=[100,260,200,110,130],vhpx=()=>innerHeight/100;
const storyEl=document.getElementById('story');storyEl.innerHTML=SECH.map(h=>'<section style="height:'+h+'vh"></section>').join('');
const card=document.getElementById('card'),upB=document.getElementById('up');
let secI=0,explore=false,cardKey=-1,pendingView=null;   // pendingView: the camera of a shared link, applied when explore mode starts (it resets the camera)
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
  const y=scrollY;document.body.classList.toggle('top',y<60);let i=0;st.forEach((v,k)=>{if(y>=v-vh*25)i=k});
  const ex=i===4;
  if(i!==secI||ex!==explore||cardKey!==i+LG){secI=i;if(ex!==explore){explore=ex;document.body.classList.toggle('exp',ex);ctl.enabled=ex;renderer.domElement.style.pointerEvents=ex?'auto':'none';if(!ex){hp=null;tip.style.display='none';hring.visible=false}if(ex){setCam();ctl.target.set(0,0,0);ctl.autoRotate=roEl.checked;tt=DLY!=null?DLY:yi0;DLY=null;sl.value=tt;dirty=true;if(pendingView){const f=pendingView;pendingView=null;f()}}else{syncFromCam();ctl.autoRotate=false}}cardKey=i+LG;renderCard(i)}
  if(!explore){let t;const p1=cl((y-st[1])/((SECH[1]-100)*vh)),p2=cl((y-st[2])/((SECH[2]-100)*vh));
    if(y<st[1])t=0;else if(y<st[2])t=lerp(0,ib,ease(p1));else if(y<st[3])t=lerp(ib,yi0,ease(p2));else t=yi0;
    tt=t;sl.value=Math.round(t);dirty=true;lastY=y}
}

// big play button on the home screen: scrolls the story by itself (about 40 s), any wheel, touch or key stops it
{const pb=document.getElementById('play');let raf=0;
  const stop=()=>{cancelAnimationFrame(raf);raf=0};
  ['wheel','touchstart','keydown'].forEach(e=>addEventListener(e,stop,{passive:true}));
  pb.onclick=()=>{if(window.__music&&!window.__music.on)window.__music(true);stop();const vh=vhpx(),end=SECH.slice(0,4).reduce((a,h)=>a+h,0)*vh,sp=end/40;let y=scrollY,last=performance.now();
    const step=t=>{y+=sp*Math.min(.05,(t-last)/1000);last=t;scrollTo(0,y);raf=y<end?requestAnimationFrame(step):0};raf=requestAnimationFrame(step)}}
addEventListener('scroll',story,{passive:true});{const ab=v=>{document.body.classList.toggle('ab-open',v);if(v)playPixelLogo(document.getElementById('abl'))};document.getElementById('logo').onclick=e=>{e.preventDefault();ab(true)};document.getElementById('abt').onclick=()=>ab(true);['abx','abm'].forEach(i=>document.getElementById(i).onclick=()=>ab(false));addEventListener('keydown',e=>{if(e.key==='Escape')ab(false)})}addEventListener('scroll',()=>document.body.classList.toggle('scrolled',scrollY>40),{passive:true});addEventListener('resize',story);
const RELOAD='<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',setUp=()=>{upB.innerHTML=RELOAD;upB.title=upB.ariaLabel=ST[LG].back.replace('↑ ','')};setUp();
window.__lh=()=>{setUp();cardKey=-1;story()};
upB.onclick=()=>scrollTo({top:0,behavior:'smooth'});

function frame(n){const d=Math.min(.1,(n-last)/1000);last=n;
  if(run){acc+=d;if(acc>.16){acc=0;tt=Math.max(0,tt-1);sl.value=tt;update(tt);if(tt<=0)stop()}}
  if(dirty&&!run){dirty=false;update(tt)}
  UT.value=n/1000;if(animating)animating=animStep(Math.min(1,d*5));
  if(!explore){const K=KF[secI],e=Math.min(1,d*2.2);CS.az+=(K.az-CS.az)*e+d*(secI<1?1.5:.8);K.az+=d*(secI<1?1.5:.8);CS.pol+=(K.pol-CS.pol)*e;CS.z+=(K.z-CS.z)*e;setCam()}
  animBalloons(n/1000);animHaze(n/1000);rainTick();mobTick();
  if(explore&&roEl.checked&&!ctl.autoRotate){idleT+=d;if(idleT>8){ctl.autoRotate=true;ctl.autoRotateSpeed=.3}}
  if(ctl.autoRotate&&lastE&&!lensOn&&!run)aim(lastE);
  if(explore)ctl.update();{const v=explore?Math.round((1+Math.min(1,Math.max(0,(cam.zoom-1.2)/2.8))*2.2)*10)/10:1;if(v!==VX){VX=v;update(tt)}}{const B=roadBudget(cam.zoom),lv=RDEN[2]<=B?3:RDEN[1]<=B?2:1;if(lv!==roadLv){roadLv=lv;update(tt)}}{const m=lodFor(cam.zoom);if(m!==LODm){LODm=m;animating=true}}renderer.render(scene,cam);
  const w=wrap.clientWidth,h=wrap.clientHeight;
  const hoodsShow=explore&&hoodsOn&&cam.zoom>=HOOD_ZOOM;if(hoodsShow&&Math.min(yi0,Math.max(0,Math.round(tt)))!==hoodYi)hoodTxt();
  hoodLabs.forEach(l=>{const p=l.v.clone().project(cam),x=(p.x+1)/2*w,y=(1-p.y)/2*h;l.d.style.display=(hoodsShow&&x>0&&x<w&&y>0&&y<h)?'block':'none';l.d.style.left=x+'px';l.d.style.top=y+'px'});
  roadLabs.forEach(l=>{const p=l.v.clone().project(cam),x=(p.x+1)/2*w,y=(1-p.y)/2*h;l.d.style.display=(x>0&&x<w&&y>0&&y<h)?'':'none';l.d.style.left=x+'px';l.d.style.top=y+'px'});
  {const sOn=explore&&cam.zoom>=STREET_ZOOM&&roadLv>=3&&!lensOn;const now=performance.now();if(sOn&&now-streetT>250){streetT=now;pickStreets(w,h)}
    streetLabs.forEach(l=>{if(!sOn||!l.on){l.d.style.display='none';return}const p=l.v.clone().project(cam),x=(p.x+1)/2*w,y=(1-p.y)/2*h;l.d.style.display=(x>0&&x<w&&y>0&&y<h)?'':'none';l.d.style.left=x+'px';l.d.style.top=y+'px'})}
  if(meV){const p=meV.clone().project(cam);me.style.left=((p.x+1)/2*w)+'px';me.style.top=((1-p.y)/2*h)+'px'}
  const n0=new THREE.Vector3(0,0,0).project(cam),n1=new THREE.Vector3(0,0,-10).project(cam);
  compass.style.transform='rotate('+Math.atan2((n1.x-n0.x)*w,-(n1.y-n0.y)*h)*180/Math.PI+'deg)';
  requestAnimationFrame(frame)}
requestAnimationFrame(frame);
story();window.__ready=true;window.__set=v=>{tt=v;sl.value=v;update(v)};

{const l=document.getElementById('ld');if(l){window.__ldp&&window.__ldp(1);setTimeout(()=>{l.style.opacity=0;setTimeout(()=>l.remove(),600)},350)}}

// ---------- share / deep link: like Google Maps ----------
// /place/bat-yam/@32.0178,34.751?s=cR4gPBI_E4g   (hash build: #bat-yam/@...?s=...)
//   @lat,lon      the centre of explore mode, readable and editable by hand (a hand-written ,15z after it is read too, Google Maps scale, see gz2zoom)
//   s=<token>     everything else, opaque and short: base64url of one or more flag bytes, then the payload of each flag that is set, in flag order.
//                 Bit 7 of a flag byte says that another flag byte follows (7 more flags each), so a new layer or field is appended at the end of FIELDS.
// Every part is optional; either opens explore mode. The address bar follows the session. No language in the link.
{const shB=document.getElementById('shr'),btn=id=>document.getElementById(id),on=b=>b&&b.style.display!=='none';
  const fromXZ=(x,z)=>{const E=(x+W/2)*CM+L0,N=T0-(z+H/2)*CM,la0=(D.bbox[1]+D.bbox[3])/2,lo0=(D.bbox[0]+D.bbox[2])/2,kx=111320*Math.cos(la0*Math.PI/180);let la=la0,lo=lo0;
    for(let k=0;k<2;k++){const [e,n]=utm(la,lo);la+=(N-n)/111000;lo+=(E-e)/kx}return [la,lo]};
  // a hand-written @lat,lon,15z (or a pasted Google link): Google zoom -> our camera zoom, the same metres on screen (156543 m per pixel at zoom 0 on the equator)
  const gz2zoom=(gz,la)=>(cam.top-cam.bottom)*CM/(wrap.clientHeight*156543.03*Math.cos(la*Math.PI/180)/Math.pow(2,gz));
  const n4=x=>+x.toFixed(4),u16=x=>Math.max(0,Math.min(65535,Math.round(x)));
  // The fields of s=, one flag bit each, in this order (append new ones at the end, never reorder).
  // enc() returns the bytes of the payload or null when the field is off; dec(bytes, state) reads it and returns how many bytes it took.
  const FIELDS=[
    {k:'heat',enc:()=>heatOn?[]:null,dec:(b,o)=>{o.heat=1;return 0}},
    {k:'air',enc:()=>airOn?[]:null,dec:(b,o)=>{o.air=1;return 0}},
    {k:'before',enc:()=>lensOn?[]:null,dec:(b,o)=>{o.before=1;return 0}},
    {k:'hoodsOff',enc:()=>hoodLabs.length&&!hoodsOn?[]:null,dec:(b,o)=>{o.hoodsOff=1;return 0}},
    {k:'year',enc:()=>{const yi=Math.min(yi0,Math.max(0,Math.round(tt)));return yi===yi0?null:[YR[yi]-1980]},dec:(b,o)=>{o.y=1980+b[0];return 1}},
    {k:'camera',enc:()=>explore?[Math.round(((ctl.getAzimuthalAngle()*180/Math.PI)%360+360)%360/360*256)&255,Math.max(0,Math.min(255,Math.round(ctl.getPolarAngle()*180/Math.PI))),Math.max(1,Math.min(255,Math.round(cam.zoom*10)))]:null,   // heading (1/256 turn), tilt (degrees), camera zoom (x10)
      dec:(b,o)=>{o.az=b[0]/256*2*Math.PI;o.pol=b[1]*Math.PI/180;o.zoom=b[2]/10;return 3}},
    {k:'point',enc:()=>{if(!explore||!meLL)return null;const la=u16((meLL[0]-D.bbox[1])*1e5),lo=u16((meLL[1]-D.bbox[0])*1e5);return[la>>8,la&255,lo>>8,lo&255]},   // 1e-5 degree from the south-west corner of the city (a city is under 0.65 degree wide)
      dec:(b,o)=>{o.point={lat:D.bbox[1]+(b[0]<<8|b[1])/1e5,lon:D.bbox[0]+(b[2]<<8|b[3])/1e5};return 4}},
    {k:'rain',enc:()=>rainFx?[]:null,dec:(b,o)=>{o.rain=1;return 0}},
    {k:'mobile',enc:()=>mobOn?[]:null,dec:(b,o)=>{o.mobile=1;return 0}}];   // the RAIN button (card + rain over the city); the 8th flag opens a second flag byte, only when it is on
  const encData=()=>{const bits=FIELDS.map(f=>f.enc()),fb=[],pay=[];
    for(let k=0;k<bits.length;k+=7){let v=0;for(let j=0;j<7;j++)if(bits[k+j])v|=1<<j;fb.push(v)}
    while(fb.length>1&&fb[fb.length-1]===0)fb.pop();if(fb.length===1&&fb[0]===0)return '';
    fb.forEach((v,i)=>{if(i<fb.length-1)fb[i]=v|128});bits.forEach(b=>{if(b)pay.push(...b)});
    return btoa(String.fromCharCode(...fb,...pay)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
  const decData=t=>{try{const b=[...atob(t.replace(/-/g,'+').replace(/_/g,'/'))].map(c=>c.charCodeAt(0)),bits=[];let p=0;
    for(;;){const v=b[p++];if(v===undefined)return null;for(let j=0;j<7;j++)bits.push((v>>j)&1);if(!(v&128))break}
    const o={};bits.forEach((on,k)=>{if(on&&FIELDS[k])p+=FIELDS[k].dec(b.slice(p),o)});return o}catch(e){return null}};
  const enc=()=>{let loc='';if(explore){const [la,lo]=fromXZ(ctl.target.x,ctl.target.z);
      // the view is still centred on the user's GPS position (within 300 m): the centre would give it away, so it is left out
      if(!meGps||Math.hypot((la-meGps[0])*111000,(lo-meGps[1])*111000*Math.cos(la*Math.PI/180))>300)loc='/@'+n4(la)+','+n4(lo)}
    const d=encData();return loc+(d?'?s='+d:'')};
  const hashState=()=>{const tail=PATHMODE?decodeURIComponent(location.pathname):decodeURIComponent(location.hash.split('?')[0]);
    const LOCM=tail.match(/\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/),qi=HASH.indexOf('?'),S=qi<0?null:new URLSearchParams(HASH.slice(qi+1)).get('s');
    if(!LOCM&&!S)return null;
    const P=(S&&decData(S))||{};
    if(!LOCM&&P.zoom!=null)P.view={lat:null,lon:null,zoom:P.zoom,az:P.az,pol:P.pol};   // no centre in the link: keep the camera angles and zoom, stay where the city opens
    if(LOCM){const la=+LOCM[1],lo=+LOCM[2];P.view={lat:la,lon:lo,zoom:P.zoom!=null?P.zoom:LOCM[3]?gz2zoom(+LOCM[3],la):5};if(P.az!=null){P.view.az=P.az;P.view.pol=P.pol}}
    return P};
  const deepLink=()=>PATHMODE?location.origin+ROOTP+D.slug+enc():location.origin+location.pathname+'#'+D.slug+enc();
  const toast=m=>{const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.classList.add('in'),10);setTimeout(()=>{t.classList.remove('in');setTimeout(()=>t.remove(),400)},2200)};
  const share=async()=>{const url=deepLink();
    if(navigator.share&&matchMedia('(pointer:coarse)').matches){try{await navigator.share({title:document.title,url});return}catch(e){if(e&&e.name==='AbortError')return}}
    try{await navigator.clipboard.writeText(url);toast(T('shc'))}catch(e){toast(url)}};shB.onclick=share;
  const P=hashState();
  if(P){
    const i=YR.indexOf(P.y);if(i>=0){tt=i;sl.value=i;DLY=i}
    if(P.heat&&on(btn('ht')))btn('ht').click();if(P.air&&on(btn('ar')))btn('ar').click();if(P.before)btn('bf').click();if(P.hoodsOff&&hoodLabs.length)hdB.click();if(P.rain)rainSet(true);if(P.mobile)mobSet(true);
    domYi=-1;update(tt);dirty=true;
    setTimeout(()=>scrollTo(0,document.documentElement.scrollHeight),400);
    const applyView=()=>{roEl.checked=false;ctl.autoRotate=false;if(P.view.lat!=null){const [x,z]=toXZ(P.view.lat,P.view.lon),d=new THREE.Vector3(x,0,z).sub(ctl.target);cam.position.add(d);ctl.target.add(d)}cam.zoom=Math.min(ctl.maxZoom,Math.max(ctl.minZoom,P.view.zoom));if(P.view.pol!=null){const t=ctl.target,r=cam.position.distanceTo(t),pl=Math.min(ctl.maxPolarAngle,Math.max(ctl.minPolarAngle,P.view.pol));cam.position.set(t.x+r*Math.sin(pl)*Math.sin(P.view.az),t.y+r*Math.cos(pl),t.z+r*Math.sin(pl)*Math.cos(P.view.az))}cam.updateProjectionMatrix();ctl.update();dirty=true};
    if(P.view){if(explore)applyView();else pendingView=applyView}
    setTimeout(()=>{if(P.point)restoreMe(P.point.lat,P.point.lon)},1100)}
  // a link pasted in an open tab only changes the hash: load it again (path links reload the page by themselves)
  if(!PATHMODE)addEventListener('hashchange',()=>location.reload());
  // the address bar follows the session: in explore mode it always holds a link that restores the view
  setInterval(()=>{if(P&&!explore&&performance.now()<1500)return;const st=explore?enc():'';
    if(PATHMODE){if(decodeURIComponent(location.pathname+location.search)!==ROOTP+D.slug+st)history.replaceState(null,'',ROOTP+D.slug+st)}
    else{const h='#'+D.slug+st;if(decodeURIComponent(location.hash)!==h)history.replaceState(null,'',location.pathname+location.search+h)}},800)}

// ---------- mobile notice: the experience is much better on a desktop ----------
{const m=document.getElementById('mob');let seen=false;try{seen=sessionStorage.getItem('mob')==='1'}catch(e){}
  if(!seen&&(matchMedia('(max-width:820px)').matches||matchMedia('(hover:none) and (pointer:coarse)').matches)){
    const close=()=>{m.classList.remove('on');try{sessionStorage.setItem('mob','1')}catch(e){}};
    m.classList.add('on');document.getElementById('mobok').onclick=close;addEventListener('keydown',e=>{if(e.key==='Escape'&&m.classList.contains('on'))close()})}}

// ambient music (src/music.js)
initMusic({slug:D.slug,T,isExplore:()=>explore,getProgress:()=>Math.min(1,scrollY/Math.max(1,SECH.slice(0,4).reduce((a,h)=>a+h,0)*vhpx()))});

// clean screen: the legend and the language / share / sound buttons fade out when nobody touches the page for a few seconds
// (the scroll of the Play button does not count as an interaction)
{let idle=0;const wake=()=>{document.body.classList.remove('idle');clearTimeout(idle);idle=setTimeout(()=>{if(!document.querySelector('#gp input:focus'))document.body.classList.add('idle')},4000)};
  ['mousemove','mousedown','pointerdown','touchstart','wheel','keydown'].forEach(e=>addEventListener(e,wake,{passive:true}));wake()}
