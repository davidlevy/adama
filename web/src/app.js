import * as THREE from 'three';
import {WORLD} from './worldmask.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
// Links are either paths (/adama/haifa?s=...) when the page was built with --base, or hashes (#haifa?s=...) anywhere else.
const PATHMODE=!!document.querySelector('meta[name=adama-routing]'),ROOTP=new URL(document.baseURI).pathname;
if(PATHMODE&&location.hash.length>1){   // older links #slug, #slug?s=..., #slug~token: open the path version
  const h=decodeURIComponent(location.hash.slice(1)),i=h.search(/[?~]/),sl=i<0?h:h.slice(0,i),r=i<0?'':h.slice(i);
  location.replace(ROOTP+sl+(r[0]==='~'?'?s='+r.slice(1):r))}
const BASE=new URL('data/',document.baseURI).href,getJSON=async u=>{const r=await fetch(u,{cache:'no-cache'});if(!r.ok)throw new Error(u+' '+r.status);return r.json()};
// city names in links are read with or without hyphens and case: ra-anana, raanana, Tel-Aviv, telaviv
const NORM=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,''),CITIES=await getJSON(BASE+'cities.json'),HASH=PATHMODE?decodeURIComponent(location.pathname.slice(ROOTP.length)).split('/')[0]+location.search:decodeURIComponent(location.hash.slice(1)),SLUG=HASH.split(/[?~]/)[0],D=await getJSON(BASE+(CITIES.find(c=>c.slug===SLUG)||CITIES.find(c=>NORM(c.slug)===NORM(SLUG))||CITIES[0]).slug+'.json'),W=D.w,H=D.h,Y=D.years.length,AR=0.04,CM=20; // 1 unit = 20 m, 0.04 ha per cell
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const LAND=D.land?b64(D.land):null,FIRST=b64(D.first),INSIDE=b64(D.inside),LS=new Set(D.ls_years);
const NAMES={'ra-anana':{fr:"Ra'anana",en:"Ra'anana",he:'רעננה'},'eilat':{fr:'Eilat',en:'Eilat',he:'אילת'},'jerusalem':{fr:'Jérusalem',en:'Jerusalem',he:'ירושלים'},'tel-aviv':{fr:'Tel Aviv',en:'Tel Aviv',he:'תל אביב'},'haifa':{fr:'Haïfa',en:'Haifa',he:'חיפה'},'grenoble':{fr:'Grenoble',en:'Grenoble',he:'גרנובל'},'beer-sheva':{fr:'Beer-Sheva',en:'Beer Sheva',he:'באר שבע'},'dubai':{fr:'Dubaï',en:'Dubai',he:'דובאי'},'ein-gedi':{fr:'Ein Gedi',en:'Ein Gedi',he:'עין גדי'},'modiin':{fr:'Modi\u2019in',en:'Modi\u2019in',he:'מודיעין'},'paris':{fr:'Paris',en:'Paris',he:'פריז'},'hod-hasharon':{fr:'Hod HaSharon',en:'Hod HaSharon',he:'הוד השרון'},'petah-tikva':{fr:'Petah Tikva',en:'Petah Tikva',he:'פתח תקווה'},'ramat-hasharon':{fr:'Ramat HaSharon',en:'Ramat HaSharon',he:'רמת השרון'},'holon':{fr:'Holon',en:'Holon',he:'חולון'},'bnei-brak':{fr:'Bnei Brak',en:'Bnei Brak',he:'בני ברק'},'netanya':{fr:'Netanya',en:'Netanya',he:'נתניה'},'ashkelon':{fr:'Ashkelon',en:'Ashkelon',he:'אשקלון'},'tiberias':{fr:'Tibériade',en:'Tiberias',he:'טבריה'},'harish':{fr:'Harish',en:'Harish',he:'חריש'},'amsterdam':{fr:'Amsterdam',en:'Amsterdam',he:'אמסטרדם'},'venice':{fr:'Venise',en:'Venice',he:'ונציה'},'karmiel':{fr:'Karmiel',en:'Karmiel',he:'כרמיאל'},'ashdod':{fr:'Ashdod',en:'Ashdod',he:'אשדוד'},'rishon-lezion':{fr:'Rishon LeZion',en:'Rishon LeZion',he:'ראשון לציון'},'rehovot':{fr:'Rehovot',en:'Rehovot',he:'רחובות'},'palma':{fr:'Palma de Majorque',en:'Palma de Mallorca',he:'פלמה דה מיורקה'},'ibiza':{fr:'Ibiza',en:'Ibiza',he:'איביזה'},'limassol':{fr:'Limassol',en:'Limassol',he:'לימסול'},'shenzhen':{fr:'Shenzhen',en:'Shenzhen',he:'שנג׳ן'},'singapore':{fr:'Singapour',en:'Singapore',he:'סינגפור'},'strasbourg':{fr:'Strasbourg',en:'Strasbourg',he:'שטרסבורג'},'metz':{fr:'Metz',en:'Metz',he:'מץ'},'kfar-saba':{fr:'Kfar Saba',en:'Kfar Saba',he:'כפר סבא'},'cape-town':{fr:"Le Cap",en:"Cape Town",he:'קייפטאון'},'lagos':{fr:"Lagos",en:"Lagos",he:'לאגוס'},'miami':{fr:"Miami",en:"Miami",he:'מיאמי'},'nouakchott':{fr:"Nouakchott",en:"Nouakchott",he:'נואקשוט'},'mexico-city':{fr:"Mexico",en:"Mexico City",he:'מקסיקו סיטי'},'hong-kong':{fr:"Hong Kong",en:"Hong Kong",he:'הונג קונג'},'macau':{fr:"Macao",en:"Macau",he:'מקאו'},'santa-cruz-de-tenerife':{fr:"Santa Cruz de Tenerife",en:"Santa Cruz de Tenerife",he:'סנטה קרוס דה טנריפה'},'hadera':{fr:"Hadera",en:"Hadera",he:'חדרה'},'las-vegas':{fr:"Las Vegas",en:"Las Vegas",he:'לאס וגאס'},'ofakim':{fr:"Ofakim",en:"Ofakim",he:'אופקים'}};
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
D.osm.arteries.forEach(wy=>{const P=wy.pts.map(p=>toXZ(p[0],p[1])),r=wy.c?.78:.62,v=wy.c?2:1;
  for(let i=0;i<P.length-1;i++){const [x0,z0]=P[i],[x1,z1]=P[i+1],L=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.ceil(L/.3));
    for(let s=0;s<=n;s++){const px=x0+(x1-x0)*s/n,pz=z0+(z1-z0)*s/n,gx=Math.floor(px+W/2),gy=Math.floor(pz+H/2);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=gx+dx,Z=gy+dy;if(X<0||Z<0||X>=W||Z>=H)continue;const j=idx[Z*W+X];if(j<0)continue;const c=cells[j];if(Math.hypot(c.x-px,c.z-pz)<r)c.road=Math.max(c.road,v)}}}});
const ground0=0;
const PL=(r0,r1,h,y,c,rg)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,160),new THREE.MeshStandardMaterial({color:c,roughness:rg,metalness:.1}));m.position.y=y;m.receiveShadow=true;m.castShadow=false;scene.add(m);return m};
const ground=PL(RD+1.5,RD+1.5,5,-2.5,0xd2d2d8,.55);ground.material.emissive=new THREE.Color(0x8a8a92);           // simple light-grey slab
const rimLine=new THREE.Mesh(new THREE.TorusGeometry(RD+1.5,.12,8,200).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff}));rimLine.position.y=.02;scene.add(rimLine);
const geo=new THREE.BoxGeometry(1,1,1);geo.translate(0,.5,0);
const mat=new THREE.MeshStandardMaterial({roughness:.82,metalness:0});
const WATER=new THREE.Color('#1d5fa8'),WATER2=new THREE.Color('#2f86d8'),BARE=new THREE.Color('#4a4033'),BARE2=new THREE.Color('#6b5c45'),FIELD=new THREE.Color('#5f9d33'),FIELD2=new THREE.Color('#86b946');
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
const lerp=(a,b,t)=>a+(b-a)*t,WH=new THREE.Color(1,1,1),G1=new THREE.Color('#1b8a40'),G2=new THREE.Color('#2fa650');
{const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_c=new THREE.Color(),_a=new THREE.Color('#1b8a40'),_b=new THREE.Color('#2fa650');
  stBlocks.forEach((b,i)=>{_p.set(b.x,0,b.z);_s.set(b.s,b.lt===1?.06:b.lt===2?.2+b.h*.12:b.lt===3?.26:.42,b.s);_m.compose(_p,_q,_s);smesh.setMatrixAt(i,_m);if(b.lt===1)_c.copy(WATER).lerp(WATER2,b.h);else if(b.lt===2)_c.copy(BARE).lerp(BARE2,b.h);else if(b.lt===3)_c.copy(FIELD).lerp(FIELD2,.5);else _c.copy(_a).lerp(_b,.5);smesh.setColorAt(i,_c)});smesh.instanceMatrix.needsUpdate=true;smesh.instanceColor.needsUpdate=true}
const gray=h=>{const k=Math.min(1,Math.max(0,(h-.8)/1.9)),v=lerp(.52,.075,k);return col.setRGB(v,v,v,THREE.SRGBColorSpace)};
const roadLabs=[];
{const by={};D.osm.arteries.forEach(wy=>{const nm=wy.nm||{};const key=nm.d||nm.en||nm.he;if(!key)return;const P=wy.pts.map(p=>toXZ(p[0],p[1])).filter(p=>Math.hypot(p[0],p[1])<RD-2);if(P.length<2)return;const e=by[key]=by[key]||{nm,pts:[],len:0};e.pts.push(...P);for(let i=0;i<P.length-1;i++)e.len+=Math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1])});
  const list=Object.values(by).filter(e=>e.len>25).sort((a,b)=>b.len-a.len),kept=[];
  for(const e of list){if(kept.length>=8)break;const m=e.pts[Math.floor(e.pts.length/2)];if(kept.every(k=>Math.hypot(k.x-m[0],k.z-m[1])>40))kept.push({nm:e.nm,x:m[0],z:m[1]})}
  kept.forEach(k=>{const d=document.createElement('div');d.className='rl';wrap.appendChild(d);roadLabs.push({d,nm:k.nm,v:new THREE.Vector3(k.x,3,k.z)})})}
const IC={heat:'<svg viewBox="0 0 15 15"><path d="M5.5 9V3.2a2 2 0 014 0V9a3.2 3.2 0 11-4 0z"/><path d="M7.5 5.5v5"/></svg>',air:'<svg viewBox="0 0 15 15"><path d="M1.5 5h7a2 2 0 10-2-2"/><path d="M1.5 8h10a2 2 0 11-2 2"/><path d="M1.5 11h4"/></svg>',hoods:'<svg viewBox="0 0 15 15"><path d="M7.5 13.5s4-3.6 4-7a4 4 0 10-8 0c0 3.4 4 7 4 7z"/><circle cx="7.5" cy="6.5" r="1.4"/></svg>',towers:'<svg viewBox="0 0 15 15"><path d="M3 13.5V2.5h6v11M9 6.5h3v7M5 5h2M5 7.5h2M5 10h2"/></svg>',share:'<svg viewBox="0 0 15 15"><path d="M7.5 9.5v-8M4.8 4.2L7.5 1.5l2.7 2.7M3 7.5v5h9v-5"/></svg>'},LT={heat:'heat',air:'airb',hoods:'hoods',towers:'twr'};
const I18={
fr:{heat:'Chaleur',hv:'chaleur de surface en été, depuis {y}',hl:'normal',hh:'plus chaud',pts:'pts',since:'depuis {y}',sinceb:'plus bâti depuis {y}',newy:'nouveau cette année',tag:'40 ans de villes qui s\u2019étendent, vues de l\u2019espace',scr:'Défiler',mus:'Musique',find:'Chercher une ville',vlist:'Liste',vmap:'Carte',nocity:'Aucune ville',play:'Lancer',pyr:'pts/an',hoods:'Quartiers',mobt:'Mieux sur ordinateur',mobp:'Adama est une expérience 3D faite pour la souris ou le trackpad. Elle fonctionne sur mobile, mais elle est beaucoup plus agréable sur un écran d\u2019ordinateur.',mobok:'Continuer quand même',shr:'Partager',shc:'Lien copié',twr:'Tours',airb:'Air',air:'Qualité de l\u2019air',airu:'µg/m³',airwho:'seuil OMS 5',airnow:'Aujourd\u2019hui : indice {a}, station {s} à {d} km',airno:'pas de donnée avant {y}',airwhat:'Moyenne annuelle des particules fines (PM2.5). Pointillé horizontal : limite de l\u2019OMS (5 µg/m³). Trait vertical : l\u2019année affichée.',airx:'{x}× la limite de l\u2019OMS',airok:'sous la limite de l\u2019OMS',airsub:'particules fines dans l\u2019air, moyenne {y}',airbrk:'avant {y}: autre modèle, tendance moins sûre',airsrc:'Source : {s}, ~{r} km',about:'À propos',abh:'Adama montre sur quoi nos villes ont grandi.',abp:'Depuis 1984, des images satellites gratuites suivent chaque ville. Fais défiler les années et regarde le vert laisser place au béton.',ab1:'Images Landsat (30 m) puis Sentinel-2 (10 m), une composition par an.',ab2:'Un modèle appris sur ESA WorldCover estime le bâti par zones de 20 m, pas bâtiment par bâtiment.',ab3:'Les routes, les aires de jeux et les tours viennent d\u2019OpenStreetMap.',aby:'Pour voir la Terre du ciel, découvrez le travail de Yann Arthus-Bertrand',abmap:'Voir la carte',ab4:'Le bouton CHALEUR montre la température de surface en été (bande thermique Landsat, 100 m), comparée à la médiane de la ville : sans couleur, normal ; orange, plus chaud ; rouge, très chaud ; jaune pâle, le plus chaud. Disponible pour certaines villes.',abme:'Je l\u2019ai développé en pensant à ma ville, Ra\u2019anana : ses espaces verts et ses <b>aires de jeux</b>.',abc:'Adama est open source. Ajoute ta ville, corrige un bug, améliore le modèle : les contributions sont les bienvenues.',abback:'Retour au site',cr:'Données satellite',built:'bâti',green:'vert',neu:'nouveau',art:'axes principaux',kids:'aires de jeux',bf:'Avant',lens:'Cercle : {a} · Autour : {b}',pgs:'Aires de jeux : {n} (OpenStreetMap)',pc:'de la ville encore vert',wat:'eau',bare:'sol nu / désert',field:'champs',pcr:'du rayon de {r} km encore vert',pos:'Zoom sur mon quartier',rot:'Rotation',w:'400 m : {p} % de vert',n:'Vert à {d} m',on:'Tu es sur du vert',b0:'Déjà bâti en ',b1:'Bâti en ',g:'Non bâti',gf:'Vert jusqu’en ',s30:'Landsat, 30 m par pixel (moins précis)',s10:'Sentinel-2, 10 m par pixel',sb:'Landsat + Sentinel-2',note:'Images satellites gratuites (Landsat depuis 1984, Sentinel-2 depuis 2017), un composite par an. Estimation par modèle : des zones de 20 m, pas des bâtiments. Avant 2017 la résolution est plus grossière.',outside:'Tu es à {d} km de la ville, hors de la carte.',loc:'Recherche de ta position...',nogeo:'Géolocalisation indisponible.',deny:'Position refusée.',addr:'Ou tape une adresse',adrgo:'Aller',adrnf:'Adresse introuvable. Essaie sans le numéro, ou le nom de la rue dans la langue locale (hébreu, par ex.).',nf:'Position introuvable.',ok:'Position affichée (±{a} m).'},
en:{heat:'Heat',hv:'summer surface heat since {y}',hl:'normal',hh:'hotter',pts:'pts',since:'since {y}',sinceb:'more built since {y}',newy:'new this year',tag:'40 years of cities spreading, seen from space',scr:'Scroll',mus:'Music',find:'Search a city',vlist:'List',vmap:'Map',nocity:'No city',play:'Play',pyr:'pts/yr',hoods:'Districts',mobt:'Best on desktop',mobp:'Adama is a 3D experience made for a mouse or trackpad. It works on mobile, but it is much better on a computer screen.',mobok:'Continue anyway',shr:'Share',shc:'Link copied',twr:'Towers',airb:'Air',air:'Air quality',airu:'µg/m³',airwho:'WHO limit 5',airnow:'Today: index {a}, {s} station {d} km away',airno:'no data before {y}',airwhat:'Yearly average of fine particles (PM2.5). Horizontal dashes: WHO limit (5 µg/m³). Vertical line: the year shown.',airx:'{x}× the WHO limit',airok:'under the WHO limit',airsub:'fine particles in the air, {y} average',airbrk:'before {y}: different model, less reliable trend',airsrc:'Source: {s}, ~{r} km',about:'About',abh:'Adama shows what our cities grew over.',abp:'Since 1984, free satellite images have followed every city. Scroll through the years and watch the green give way to concrete.',ab1:'Landsat (30 m) then Sentinel-2 (10 m) images, one composite per year.',ab2:'A model trained on ESA WorldCover estimates what is built in 20 m areas, not building by building.',ab3:'Roads, playgrounds and towers come from OpenStreetMap.',aby:'To see the Earth from above, discover the work of Yann Arthus-Bertrand',abmap:'See the map',ab4:'The HEAT button shows summer surface temperature (Landsat thermal band, 100 m) against the city median: no colour is normal, orange is warmer, red is hot, pale yellow is the hottest. Available for some cities.',abme:'I built it thinking of my city, Ra\u2019anana: its green spaces and its <b>playgrounds</b>.',abc:'Adama is open source. Add your city, fix a bug, improve the model: contributions are welcome.',abback:'Back to the site',cr:'Satellite data',built:'built',green:'green',neu:'new',art:'main roads',kids:'playgrounds',bf:'Before',lens:'Circle: {a} · Around: {b}',pgs:'Playgrounds: {n} (OpenStreetMap)',pc:'of the city still green',wat:'water',bare:'bare ground / desert',field:'fields',pcr:'of the {r} km radius still green',pos:'Zoom my neighbourhood',rot:'Rotate',w:'400 m: {p}% green',n:'Green at {d} m',on:'You are on green',b0:'Already built in ',b1:'Built in ',g:'Not built',gf:'Green until ',s30:'Landsat, 30 m per pixel (less precise)',s10:'Sentinel-2, 10 m per pixel',sb:'Landsat + Sentinel-2',note:'Free satellite imagery (Landsat since 1984, Sentinel-2 since 2017), one composite per year. Model estimate: 20 m areas, not individual buildings. Before 2017 the resolution is coarser.',outside:'You are {d} km from the city, outside the map.',loc:'Finding your position...',nogeo:'Geolocation unavailable.',deny:'Location denied.',addr:'Or type an address',adrgo:'Go',adrnf:'Address not found. Try without the number, or the street name in the local language (Hebrew, for example).',nf:'Position not found.',ok:'Position shown (±{a} m).'},
he:{heat:'חום',hv:'חום פני השטח בקיץ מאז {y}',hl:'רגיל',hh:'חם יותר',pts:'pts',since:'מאז {y}',sinceb:'בנוי יותר מאז {y}',newy:'חדש השנה',tag:'40 שנות התפשטות של ערים, מהחלל',scr:'גלול',mus:'מוזיקה',find:'חיפוש עיר',vlist:'רשימה',vmap:'מפה',nocity:'אין עיר',play:'הפעל',pyr:'נק׳/שנה',hoods:'שכונות',mobt:'עדיף במחשב',mobp:'אדמה היא חוויה תלת־ממדית שנועדה לעכבר או לטרקפד. היא עובדת גם בנייד, אבל הרבה יותר נעים במסך מחשב.',mobok:'להמשיך בכל זאת',shr:'שיתוף',shc:'הקישור הועתק',twr:'מגדלים',airb:'אוויר',air:'איכות האוויר',airu:'µg/m³',airwho:'סף WHO 5',airnow:'היום: מדד {a}, תחנה {s} במרחק {d} ק״מ',airno:'אין נתונים לפני {y}',airwhat:'ממוצע שנתי של חלקיקים עדינים (PM2.5). קו מקווקו אופקי: מגבלת WHO‏ (5 µg/m³). קו אנכי: השנה המוצגת.',airx:'פי {x} ממגבלת WHO',airok:'מתחת למגבלת WHO',airsub:'חלקיקים עדינים באוויר, ממוצע {y}',airbrk:'לפני {y}: מודל אחר, מגמה פחות אמינה',airsrc:'מקור: {s}, ~{r} ק״מ',about:'אודות',abh:'אדמה מראה על חשבון מה הערים שלנו גדלו.',abp:'מאז 1984 תמונות לוויין חינמיות עוקבות אחרי כל עיר. גללו בין השנים וראו את הירוק מפנה מקום לבטון.',ab1:'תמונות Landsat (30 מ׳) ואחר כך Sentinel-2 (10 מ׳), הרכב אחד בשנה.',ab2:'מודל שאומן על ESA WorldCover מעריך את הבנוי באזורים של 20 מ׳, לא בניין אחר בניין.',ab3:'כבישים, מגרשי משחקים ומגדלים מגיעים מ־OpenStreetMap.',aby:'כדי לראות את כדור הארץ מלמעלה, גלו את עבודתו של Yann Arthus-Bertrand',abmap:'לצפייה במפה',ab4:'כפתור החום מציג את טמפרטורת פני השטח בקיץ (ערוץ תרמי של Landsat, 100 מ׳) ביחס לחציון העיר: בלי צבע – רגיל, כתום – חם יותר, אדום – חם מאוד, צהוב בהיר – החם ביותר. זמין בחלק מהערים.',abme:'פיתחתי את זה מתוך מחשבה על העיר שלי, רעננה: המרחבים הירוקים שלה ו<b>מגרשי המשחקים</b> שלה.',abc:'אדמה היא קוד פתוח. הוסיפו את העיר שלכם, תקנו באג, שפרו את המודל: תרומות יתקבלו בברכה.',abback:'חזרה לאתר',cr:'נתוני לוויין',built:'בנוי',green:'ירוק',neu:'חדש',art:'צירים ראשיים',kids:'מגרשי משחקים',bf:'לפני',lens:'עיגול: {a} · מסביב: {b}',pgs:'מגרשי משחקים: {n} (OpenStreetMap)',pc:'מהעיר עדיין ירוק',wat:'מים',bare:'קרקע חשופה / מדבר',field:'שדות',pcr:'מהרדיוס של {r} ק״מ עדיין ירוק',pos:'התמקד בשכונה שלי',rot:'סיבוב',w:'400 מ׳: {p}% ירוק',n:'ירוק במרחק {d} מ׳',on:'אתה על שטח ירוק',b0:'בנוי כבר ב־',b1:'נבנה ב־',g:'לא בנוי',gf:'ירוק עד ',s30:'Landsat, 30 מ׳ לפיקסל (פחות מדויק)',s10:'Sentinel-2, 10 מ׳ לפיקסל',sb:'Landsat + Sentinel-2',note:'תמונות לוויין חינמיות (Landsat מ־1984, Sentinel-2 מ־2017), הרכב אחד לשנה. אומדן של מודל: אזורים של 20 מ׳, לא בניינים. לפני 2017 הרזולוציה גסה יותר.',outside:'אתה {d} ק״מ מהעיר, מחוץ למפה.',loc:'מחפש מיקום...',nogeo:'מיקום לא זמין.',deny:'המיקום נדחה.',addr:'או הקלידו כתובת',adrgo:'עבור',adrnf:'הכתובת לא נמצאה. נסו בלי המספר.',nf:'המיקום לא נמצא.',ok:'המיקום מוצג (±{a} מ׳).'}};
let LG=(()=>{try{const s=localStorage.getItem('city_lang');if(I18[s])return s}catch(e){}const n=(navigator.language||'en').slice(0,2);return I18[n]?n:'en'})();
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
const cmEl=document.getElementById('cm'),cmb=document.getElementById('cmb'),cmn=document.getElementById('cmn'),cml=document.getElementById('cml');
const CTRY={fr:{IL:'Israël',FR:'France',AE:'Émirats arabes unis',NL:'Pays-Bas',IT:'Italie',ES:'Espagne',CY:'Chypre',CN:'Chine',SG:'Singapour',ZA:'Afrique du Sud',NG:'Nigéria',US:'États-Unis',MR:'Mauritanie',MX:'Mexique',HK:'Hong Kong',MO:'Macao'},en:{IL:'Israel',FR:'France',AE:'United Arab Emirates',NL:'Netherlands',IT:'Italy',ES:'Spain',CY:'Cyprus',CN:'China',SG:'Singapore',ZA:'South Africa',NG:'Nigeria',US:'United States',MR:'Mauritania',MX:'Mexico',HK:'Hong Kong',MO:'Macau'},he:{IL:'ישראל',FR:'צרפת',AE:'איחוד האמירויות',NL:'הולנד',IT:'איטליה',ES:'ספרד',CY:'קפריסין',CN:'סין',SG:'סינגפור',ZA:'דרום אפריקה',NG:'ניגריה',US:'ארצות הברית',MR:'מאוריטניה',MX:'מקסיקו',HK:'הונג קונג',MO:'מקאו'}},CODE={grenoble:'FR',dubai:'AE',paris:'FR',amsterdam:'NL',venice:'IT',palma:'ES',ibiza:'ES',limassol:'CY',shenzhen:'CN',singapore:'SG',strasbourg:'FR',metz:'FR','cape-town':'ZA',lagos:'NG',miami:'US',nouakchott:'MR','mexico-city':'MX','hong-kong':'HK',macau:'MO','santa-cruz-de-tenerife':'ES','las-vegas':'US'},CO=s=>({get fr(){return CTRY.fr[CODE[s]||'IL']},get en(){return CTRY.en[CODE[s]||'IL']},get he(){return CTRY.he[CODE[s]||'IL']}});const COUNTRY=CO(D.slug);
// city menu: search field + cities grouped by country, in columns
const cms=document.createElement('input'),cmg=document.createElement('div');cms.className='cms';cms.type='search';cms.autocomplete='off';cms.spellcheck=false;cmg.className='cmg';const cmt=document.createElement('div'),cmm=document.createElement('div');cmt.className='cmt';cmm.className='cmm';cmt.append(cms);cml.append(cmt,cmm,cmg);cml.onclick=e=>e.stopPropagation();
const nz=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// a city matches when one of its names (or its country) has a word that starts with what was typed: "t" finds Tel Aviv and Tiberias, "ra" finds Ra'anana and Rafah...
const cityMatch=(c,q)=>!q||[...['fr','en','he'].map(l=>(NAMES[c.slug]||{})[l]),c.name.split(',')[0],CO(c.slug)[LG]].some(n=>nz(n).split(/[\s\-\u2019'.]+/).some(w=>w.startsWith(q)));
const goCity=c=>{if(c.slug===D.slug){cmEl.classList.remove('open');return}if(PATHMODE){location.href=ROOTP+c.slug}else{location.hash=c.slug;location.reload()}};
function renderCities(){const q=nz(cms.value.trim()),by={},nmOf=c=>(NAMES[c.slug]||{})[LG]||c.name.split(',')[0];
  CITIES.forEach(c=>{if(cityMatch(c,q)){const k=CODE[c.slug]||'IL';(by[k]=by[k]||[]).push(c)}});
  cmg.innerHTML='';const codes=Object.keys(by).sort((a,b)=>CTRY[LG][a].localeCompare(CTRY[LG][b],LG));
  if(!codes.length){const p=document.createElement('p');p.className='cmn0';p.textContent=T('nocity');cmg.appendChild(p);return}
  codes.forEach(k=>{const sec=document.createElement('section'),h=document.createElement('h4'),ul=document.createElement('ul');h.textContent=CTRY[LG][k]+' \u00b7 '+by[k].length;
    by[k].sort((a,b)=>nmOf(a).localeCompare(nmOf(b),LG)).forEach(c=>{const li=document.createElement('li'),n=document.createElement('span'),ly=document.createElement('i');li.dataset.slug=c.slug;li.setAttribute('role','option');if(c.slug===D.slug)li.className='on';
      n.className='cn2';n.textContent=nmOf(c);ly.className='ly';ly.innerHTML=(c.has||[]).map(x=>'<b title="'+T(LT[x])+'">'+IC[x]+'</b>').join('');li.append(n,ly);
      li.onclick=()=>goCity(c);ul.appendChild(li)});
    sec.append(h,ul);cmg.appendChild(sec)})}
cms.oninput=renderCities;cms.onkeydown=e=>{if(e.key==='Enter'){const f=cmg.querySelector('li');if(f)f.click()}};
cmb.onclick=e=>{e.stopPropagation();const o=cmEl.classList.toggle('open');cmb.setAttribute('aria-expanded',o);if(o){cms.value='';renderCities();if(matchMedia('(hover:hover)').matches)setTimeout(()=>cms.focus(),50)}};
addEventListener('click',()=>cmEl.classList.remove('open'));addEventListener('keydown',e=>{if(e.key==='Escape')cmEl.classList.remove('open')});
// The city menu has a list / map switch. The map is a pixel world: the current city in white, the others in violet, cities that are
// close together (Israel, Europe) grouped in one marker with their number; a click opens the city, or lists the group.
let cmvLang=()=>{};
{const raw=atob(WORLD.bits),isL=(x,y)=>x>=0&&y>=0&&x<WORLD.w&&y<WORLD.h&&(raw.charCodeAt((y*WORLD.w+x)>>3)>>(7-((y*WORLD.w+x)&7)))&1;
  const cname=c=>(NAMES[c.slug]||{})[LG]||c.name.split(',')[0],reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const gx=c=>(c.ll[1]+180)/360*WORLD.w,gy=c=>(WORLD.latN-c.ll[0])/(WORLD.latN-WORLD.latS)*WORLD.h;
  const cl=[];CITIES.filter(c=>c.ll).forEach(c=>{const k=cl.find(o=>Math.hypot(o.x-gx(c),o.y-gy(c))<2.2);if(k)k.m.push(c);else cl.push({x:gx(c),y:gy(c),m:[c]})});
  cl.forEach(k=>{k.x=k.m.reduce((a,c)=>a+gx(c),0)/k.m.length;k.y=k.m.reduce((a,c)=>a+gy(c),0)/k.m.length});
  const sw=document.createElement('div'),bL=document.createElement('button'),bM=document.createElement('button'),cv=document.createElement('canvas'),pop=document.createElement('aside'),cx=cv.getContext('2d'),bg=document.createElement('canvas');
  sw.className='cmv';bL.innerHTML='<svg viewBox="0 0 14 14"><path d="M2 3.5h10M2 7h10M2 10.5h10"/></svg>';
  bM.innerHTML='<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2"/><path d="M1.8 7h10.4M7 1.8c-2.2 2.4-2.2 8 0 10.4M7 1.8c2.2 2.4 2.2 8 0 10.4"/></svg>';
  sw.append(bL,bM);cmt.append(sw);cv.setAttribute('role','img');cmm.append(cv,pop);
  let W=0,cell=1,dpr=1,hov=null,mapRaf=0,view='map';try{view=localStorage.getItem('adama-cmview')==='list'?'list':'map'}catch(e){}
  const isCur=k=>k.m.some(c=>c.slug===D.slug);
  function layout(){const w=cmm.clientWidth;if(!w)return false;dpr=Math.min(2,devicePixelRatio||1);if(w===W&&bg.width===Math.round(w*dpr))return true;W=w;cell=W/WORLD.w;const h=cell*WORLD.h;
    for(const c of [cv,bg]){c.width=Math.round(W*dpr);c.height=Math.round(h*dpr)}cv.style.width=W+'px';cv.style.height=h+'px';
    const g=bg.getContext('2d');g.scale(dpr,dpr);
    for(let y=0;y<WORLD.h;y++)for(let x=0;x<WORLD.w;x++){const hs=Math.abs(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
      if(isL(x,y)){const v=Math.round(52+(y/WORLD.h)*20+hs*14);g.fillStyle='rgb('+v+','+v+','+Math.round(v*1.16)+')';const s=cell*.8;g.fillRect(x*cell+(cell-s)/2,y*cell+(cell-s)/2,s,s)}
    }
    return true}
  function draw(t){if(!layout())return;cx.setTransform(dpr,0,0,dpr,0,0);cx.clearRect(0,0,W,cell*WORLD.h);cx.drawImage(bg,0,0,W,cell*WORLD.h);
    const sq=(x,y,s)=>cx.fillRect(x-s/2,y-s/2,s,s);
    cl.forEach(k=>{if(isCur(k))return;const x=k.x*cell,y=k.y*cell,s=cell*(1.1+Math.min(1.6,(k.m.length-1)*.3)),h=k===hov;
      cx.fillStyle='rgba(165,107,255,'+(h?.34:.16)+')';sq(x,y,s*2.4);cx.fillStyle='rgba(165,107,255,'+(h?.5:.28)+')';sq(x,y,s*1.6);cx.fillStyle=h?'#c9a7ff':'#a56bff';sq(x,y,s);
      if(k.m.length>1){cx.fillStyle='rgba(255,255,255,.85)';cx.font='600 10px Geist,system-ui,sans-serif';cx.textBaseline='middle';cx.fillText(k.m.length,x+s*.9+2,y-s*.5)}});
    cl.forEach(k=>{if(!isCur(k))return;const x=k.x*cell,y=k.y*cell,s=cell*(1.5+Math.min(1.6,(k.m.length-1)*.3)),p=reduce?0:(t*.8)%1,r=s*(1.6+Math.floor(p*5)*.55);
      cx.fillStyle='rgba(255,255,255,.12)';sq(x,y,s*3.2);cx.fillStyle='rgba(255,255,255,.28)';sq(x,y,s*1.9);
      if(!reduce){cx.strokeStyle='rgba(255,255,255,'+(.55*(1-p))+')';cx.lineWidth=Math.max(1,cell*.45);cx.strokeRect(x-r/2,y-r/2,r,r)}
      cx.fillStyle='#fff';sq(x,y,s);
      if(k.m.length>1){cx.fillStyle='#fff';cx.font='600 10px Geist,system-ui,sans-serif';cx.textBaseline='middle';cx.fillText(k.m.length,x+s*.9+2,y-s*.5)}})}
  function loop(t){if(!cmEl.classList.contains('open')||view!=='map'){mapRaf=0;return}draw(t/1000);mapRaf=requestAnimationFrame(loop)}
  const start=()=>{if(!mapRaf&&view==='map')mapRaf=requestAnimationFrame(loop)};
  function setView(v,keep){view=v;cml.dataset.view=v;bL.setAttribute('aria-pressed',v==='list');bM.setAttribute('aria-pressed',v==='map');if(!keep)try{localStorage.setItem('adama-cmview',v)}catch(e){}pop.hidden=true;start()}
  const near=e=>{const r=cv.getBoundingClientRect();const px=e.clientX-r.left,py=e.clientY-r.top;let b=null,bd=22;cl.forEach(k=>{const d=Math.hypot(k.x*cell-px,k.y*cell-py);if(d<bd){bd=d;b=k}});return b};
  const ctry=k=>CTRY[LG][CODE[k.m[0].slug]||'IL'];
  function show(k,list){pop.hidden=false;pop.replaceChildren();pop.className=list?'lst':'';
    if(list){const h=document.createElement('span');h.textContent=ctry(k);pop.append(h);k.m.slice().sort((a,b)=>cname(a).localeCompare(cname(b),LG)).forEach(c=>{const b=document.createElement('button');b.textContent=cname(c);if(c.slug===D.slug)b.className='on';b.onclick=()=>goCity(c);pop.append(b)})}
    else{const b=document.createElement('span');b.textContent=cname(k.m[0])+' · '+ctry(k);pop.append(b)}
    const m=list?Math.min(210,W/2):80;pop.style.left=Math.min(W-m,Math.max(m,k.x*cell))+'px';pop.style.top=k.y*cell+'px'}
  cv.onpointermove=e=>{const k=near(e);hov=k;cv.style.cursor=k?'pointer':'';if(k&&!pop.classList.contains('lst'))show(k,false);else if(!k&&!pop.classList.contains('lst'))pop.hidden=true};
  cv.onpointerleave=()=>{hov=null;if(!pop.classList.contains('lst'))pop.hidden=true};
  cv.onclick=e=>{const k=near(e);if(!k){pop.hidden=true;pop.className='';return}if(k.m.length===1)goCity(k.m[0]);else{hov=k;show(k,true)}};
  bL.onclick=()=>setView('list');bM.onclick=()=>setView('map');
  cms.oninput=()=>{if(view==='map')setView('list',true);renderCities()};
  cmb.addEventListener('click',()=>setTimeout(()=>{if(cmEl.classList.contains('open')){setView(view,true);if(view==='map')pop.hidden=true}},0));
  cmvLang=()=>{bL.title=bL.ariaLabel=T('vlist');bM.title=bM.ariaLabel=T('vmap');cv.setAttribute('aria-label',T('vmap'));pop.hidden=true;pop.className=''};
  cml.dataset.view=view;bL.setAttribute('aria-pressed',view==='list');bM.setAttribute('aria-pressed',view==='map')}

function applyLang(){domYi=-1;airLang();document.documentElement.lang=LG;document.documentElement.dir=LG==='he'?'rtl':'ltr';document.querySelectorAll('[data-i]').forEach(e=>e.textContent=T(e.dataset.i));[['ht','heat','heat'],['ar','air','airb'],['hdb','hoods','hoods']].forEach(([id,ic,k])=>{const b=document.getElementById(id);if(b)b.innerHTML=IC[ic]+T(k)});{const b=document.getElementById('shr');b.innerHTML=IC.share;b.setAttribute('aria-label',T('shr'));b.title=T('shr')}document.querySelectorAll('[data-ih]').forEach(e=>e.innerHTML=T(e.dataset.ih));if(!OUTL)document.querySelectorAll('[data-i=pc]').forEach(e=>e.textContent=T('pcr').replace('{r}',RKM));
  document.querySelectorAll('.lang button').forEach(b=>b.classList.toggle('on',b.dataset.l===LG));try{localStorage.setItem('city_lang',LG)}catch(e){}
  const nm=(NAMES[D.slug]||{})[LG]||D.name.split(',')[0];cmn.innerHTML='<span class="cn"></span> <span class="cc"></span>';cmn.firstChild.textContent=nm;cmn.lastChild.textContent=COUNTRY[LG];cms.placeholder=T('find');renderCities();document.title=((NAMES[D.slug]||{}).en||D.name.split(',')[0])+', '+YR[0]+'\u2013'+YR[yi0]+' \u00b7 Adama \u2013 40 years of cities spreading, seen from space';
  cmvLang();window.__lh&&window.__lh();roadLabs.forEach(l=>{l.d.textContent=l.nm[LG]||l.nm.d||l.nm.en||l.nm.he});hoodTxt();dirty=true}
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
  kept.forEach(e=>{const d=document.createElement('div');d.className='hd';d.innerHTML='<span></span><b><svg viewBox="0 0 14 14" width="14" height="14"><path d="M7 .8 11 6H9.3L12.2 10H7.8v3.2H6.2V10H1.8L4.7 6H3z"/></svg><i></i></b>';wrap.appendChild(d);hoodLabs.push({d,h:e.h,g:e.g,v:new THREE.Vector3(e.x,4,e.z)})});hoodYi=-1;dirty=true};
let hoodsOn=true,hoodYi=-1;const HOOD_MIN=.3,HOOD_ZOOM=1.3;   // pills appear once the map is zoomed in a little
const hoodTxt=()=>{const yi=Math.min(yi0,Math.max(0,Math.round(tt)));hoodYi=yi;hoodLabs.forEach(l=>{const h=l.h,nm=LG==='he'?(h[4]||h[2]):(h[3]||(/^[0-9 ]+$/.test(h[2])&&h[4]?h[4]:h[2]));l.d.firstChild.textContent=nm;
  const b=l.d.lastChild,dv=yi>0?l.g[yi]-l.g[yi-1]:0;b.style.display=Math.abs(dv)<HOOD_MIN?'none':'';b.lastChild.textContent=(dv>0?'▲ +':'▼ −')+Math.abs(dv).toFixed(1)+' '+T('pts');l.d.title=YR[Math.max(0,yi-1)]+' → '+YR[yi]})};
if(D.hoods)makeHoods(D.hoods);   // pre-generated by scripts/neighborhoods.py; cities without the file simply have no pills
const NIN=cells.reduce((a,c)=>a+(c.in&&c.lt!==1?1:0),0),OUTL=cells.some(c=>!c.in);const NV=cells.reduce((a,c)=>a+(c.in&&c.lt===0?1:0),0);const BP0=cells.reduce((a,c)=>a+(c.in&&c.f<=0?1:0),0)/NIN*100,GP0=(NV-cells.reduce((a,c)=>a+(c.in&&c.lt===0&&c.f<=0?1:0),0))/NIN*100;const HASW=cells.some(c=>c.lt===1),HASB=cells.some(c=>c.lt===2);const RKM=(RD*CM/1000).toFixed(1);
// Zoomed out, built cells merge into mosaic blocks (2x2, 4x4, 8x8) so the city reads as fewer, bigger blocks. Blocks are capped at 2x2; the story mode (zoom .86-1.12) is always in mosaic.
let LODm=1;const LODMAX=2,LODC={};
function lodGroups(m){if(LODC[m])return LODC[m];const mp=new Map();for(const c of cells){if(c.st)continue;const k=c.road?'r'+c.di:(c.gx/m|0)+','+(c.gy/m|0);let a=mp.get(k);if(!a)mp.set(k,a=[]);a.push(c.di)}return LODC[m]=[...mp.values()]}
// zoom thresholds with a 6% hysteresis so the level does not flicker at the edge
function lodFor(z){let m=LODm;const T=[[1.2,1],[0,2]];for(const[zt,mm]of T)if(z>=zt*(mm>=LODm?.94:1.06)){m=mm;break}return Math.min(m,LODMAX)}
function animStep(k){let mv=false;const ma=mesh.instanceMatrix.array,ca=mesh.instanceColor.array;
  for(let i=0;i<ND;i++){let d=Tg[i]-Ch[i];if(d>.002||d<-.002){Ch[i]+=d*k;mv=true}else Ch[i]=Tg[i];
    const o=i*16;const sc=.94+.06*Math.max(0,Math.min(1,(.7-Ch[i])/.3));ma[o]=sc;ma[o+5]=Math.max(.05,Ch[i]);ma[o+10]=sc;ma[o+12]=DX[i];ma[o+14]=DZ[i];ma[o+15]=1;
    const i3=i*3;for(let j=0;j<3;j++){const e=Cg[i3+j]-Cc[i3+j];if(e>.002||e<-.002){Cc[i3+j]+=e*k;mv=true}else Cc[i3+j]=Cg[i3+j];ca[i3+j]=Cc[i3+j]}}
  if(LODm>1)for(const g of lodGroups(LODm)){const n=g.length;if(n<2)continue;let h=0,r=0,gg=0,b=0,x=0,z=0;
    for(const i of g){h+=Ch[i];r+=Cc[i*3];gg+=Cc[i*3+1];b+=Cc[i*3+2];x+=DX[i];z+=DZ[i]}
    const o=g[0]*16,s=Math.sqrt(n)*.97;ma[o]=s;ma[o+5]=Math.max(.05,h/n);ma[o+10]=s;ma[o+12]=x/n;ma[o+14]=z/n;ca[g[0]*3]=r/n;ca[g[0]*3+1]=gg/n;ca[g[0]*3+2]=b/n;
    for(let q=1;q<n;q++){const p=g[q]*16;ma[p]=0;ma[p+5]=0;ma[p+10]=0}}
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;return stepTowers(Math.min(1,k*.7))||mv}
let airLang=()=>{},airOn=false,airV=null;
// ---------- air haze: stacked translucent veils above the city, grainy like the green; the grain gets coarser and stronger when the air is worse ----------
const HZ_Y=[5,9.5,14,18.5],HZ_U={uT:UT,uA:{value:.02},uG:{value:.5},uS:{value:.7}};
const hzMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:HZ_U,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 vUv;uniform float uT,uA,uG,uS;void main(){float r=length(vUv-.5)*2.;float edge=1.-smoothstep(.8,1.,r);vec2 gq=floor(gl_FragCoord.xy*uS)+floor(uT*1.5)*vec2(17.3,9.1);float gn=fract(sin(dot(gq,vec2(12.9898,78.233)))*43758.5453);gl_FragColor=vec4(.42,.42,.44,uA*edge*(1.-uG+uG*2.*gn));}'});
const haze=new THREE.Group();haze.visible=false;HZ_Y.forEach(y=>{const m=new THREE.Mesh(new THREE.CircleGeometry(RD*1.03,96).rotateX(-Math.PI/2),hzMat);m.position.y=y;m.renderOrder=8;m.frustumCulled=false;haze.add(m)});scene.add(haze);
function hazeSet(){const who=(D.air&&D.air.who_pm25)||5,k=airV==null?0:Math.min(1,Math.max(0,(airV-who)/25));haze.visible=airOn&&airV!=null;
  const total=.07+.38*k;HZ_U.uA.value=1-Math.pow(1-total,1/HZ_Y.length);HZ_U.uG.value=.5+.45*k;HZ_U.uS.value=.75-.45*k;
  // bad air also dulls the colours (no tint, so it cannot be mistaken for desert)
  renderer.domElement.style.filter=airOn&&airV!=null?'saturate('+(1-.6*k).toFixed(2)+') contrast('+(1-.14*k).toFixed(2)+') brightness('+(1-.1*k).toFixed(2)+')':''}
function animHaze(tm){if(!haze.visible)return;haze.children.forEach((m,i)=>{m.position.y=HZ_Y[i]+(VX-1)*5*(i+1)/HZ_Y.length+Math.sin(tm*.12+i)*.2})}
// ---------- air quality (air.json from scripts/air_quality.py): yearly PM2.5 curve that follows the timeline ----------
const AIR=D.air&&D.air.series&&D.air.series.pm25,AIRL=D.air&&D.air.live;let airUpd=()=>{};
if(AIR||AIRL){const el=document.createElement('div');el.className='air';document.body.appendChild(el);
  const W_=230,H_=48,y0=AIR?AIR.years[0]:0,y1=AIR?AIR.years[AIR.years.length-1]:1,who=D.air.who_pm25||5,vmax=AIR?Math.max(who*1.4,...AIR.values)*1.08:1,
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
let VX=1;// buildings grow taller when zoomed in, for contrast with the ground
function update(t){
  const yi=Math.min(yi0,Math.max(0,Math.round(t)));airUpd(YR[yi]);
  let bt=0,nw=0,gv=0;const HYc=HT&&heatOn?HY[hIdx(YR[yi])]:null;
  for(let i=0;i<cells.length;i++){const c=cells[i];if(c.st)continue;let h,color;const hv=c.h;
    const ye=lensOn&&hp&&Math.hypot(c.x-hp.x,c.z-hp.z)<LR?(yi>yi0/2?0:yi0):t;const built=c.f<=ye+1e-6;
    if(c.road&&(built||c.f===999)){h=.08;color=c.road===2?col.setRGB(2.3,2.3,2.3,THREE.LinearSRGBColorSpace):col.setRGB(.7,.7,.72,THREE.LinearSRGBColorSpace)}
    else if(built){const h0=.8+c.nb*1.1+hv*.9;h=h0*VX;const age=ye-c.f;color=gray(h0);if(c.f>0&&age<3)color.lerp(WH,(1-age/3)*.85)}
    else if(c.f<999&&(c.lt===0||c.lt===3)&&c.f-1<ye){const k=ye-c.f+1,hb=(.8+c.nb*1.1+hv*.9)*VX,hg=.42;h=hg+(hb-hg)*k;color=col.copy(WH)}
    else if(c.lt===1){h=.06;color=col.copy(WATER).lerp(WATER2,hv)}
    else if(c.lt===2){h=.2+hv*.12;color=col.copy(BARE).lerp(BARE2,hv)}
    else if(c.lt===3){h=.26;color=col.copy(FIELD).lerp(FIELD2,.5)}
    else{h=.42;color=col.copy(G1).lerp(G2,.5)}
    if(heatOn&&HT&&!(c.road&&(built||c.f===999))){{const an=heatAt(HYc,c.gx+.5,c.gy+.5);color=color.clone().lerp(heatCol(an,hCol),heatMix(an))}}
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
  const gp=(NV-gv)/NIN*100;document.getElementById('pc').textContent=Math.round(gp)+' %';document.getElementById('gt').textContent=yi===0?'':(gp<GP0?'\u25BC ':'\u25B2 ')+P(Math.abs(Math.round(gp-GP0)))+' '+T('pts')+' '+T('since').replace('{y}',YR[0]);
  refreshTip(yi)}
// timeline ticks every 5 years
YR.forEach((y,i)=>{if(i===0||i===yi0||(y%5===0&&yi0-i>2)){const d=document.createElement('div');d.dataset.idx=i;d.style.left=(i/yi0*100)+'%';d.textContent=y;d.onclick=()=>{stop();tt=i;sl.value=i;update(i)};tkEl.appendChild(d)}});
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
// trackpad pinch: Chrome sends ctrl+wheel (which would zoom the page), Safari sends gesture events
addEventListener('wheel',e=>{if(!e.ctrlKey||!explore)return;e.preventDefault();zoomBy(Math.exp(-e.deltaY*.01))},{passive:false});
let g0=1;addEventListener('gesturestart',e=>{if(explore){e.preventDefault();g0=cam.zoom}});addEventListener('gesturechange',e=>{if(explore){e.preventDefault();cam.zoom=Math.min(ctl.maxZoom,Math.max(ctl.minZoom,g0*e.scale));cam.updateProjectionMatrix();dirty=true}})}
// my position
const me=document.createElement('div');me.className='me';me.style.display='none';me.innerHTML='<i></i>';document.body.appendChild(me);let meV=null;const msg=document.getElementById('gm');
const place=(lat,lon,acc)=>{const [x,z]=toXZ(lat,lon);
  if(Math.abs(x)>W/2+5||Math.abs(z)>H/2+5){const dx=Math.max(0,Math.abs(x)-W/2)*CM,dz=Math.max(0,Math.abs(z)-H/2)*CM;msg.textContent=T('outside').replace('{d}',(Math.hypot(dx,dz)/1000).toFixed(1));meV=null;me.style.display='none';return}
  meV=new THREE.Vector3(x,6,z);{const d=new THREE.Vector3(x,0,z).sub(ctl.target);cam.position.add(d);ctl.target.add(d);cam.zoom=Math.max(cam.zoom,5);cam.updateProjectionMatrix();ctl.update()}me.style.display='block';msg.textContent=acc?T('ok').replace('{a}',Math.round(acc)):'';
  hp=new THREE.Vector3(x,1,z);tipX=wrap.clientWidth/2;tipY=wrap.clientHeight/2;dirty=true};
// no GPS (denied, unavailable): ask for an address. The text is sent to OpenStreetMap Nominatim, limited to the box of this city.
const askAddr=why=>{msg.style.pointerEvents='auto';msg.style.maxWidth='none';msg.textContent=why+' ';
  const i=document.createElement('input'),g=document.createElement('button'),err=document.createElement('span');i.placeholder=T('addr');i.className='adr';g.className='pill';g.textContent=T('adrgo');
  // Photon (OpenStreetMap, tolerant to typos and Latin spelling) first, then Nominatim; both limited to the box of this city.
  // OpenStreetMap often lacks the house number, so the search is repeated without numbers.
  const [w,s,e,n]=D.bbox,city=nm0();
  const photon=async q=>{const r=await fetch('https://photon.komoot.io/api/?limit=1&lang='+(LG==='fr'?'fr':'en')+'&bbox='+[w,s,e,n].join(',')+'&q='+encodeURIComponent(q+' '+city)),j=await r.json();return j.features.map(f=>({lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0]}))};
  const nominatim=async q=>{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&bounded=1&viewbox='+[w,n,e,s].join(',')+'&q='+encodeURIComponent(q),{headers:{'Accept-Language':LG}});return r.json()};
  const find=async q=>{for(const f of [photon,nominatim]){try{const j=await f(q);if(j.length)return j}catch(x){}}return[]};
  const go=async()=>{const q=i.value.trim();if(!q)return;err.textContent='';
    let j=await find(q);const q2=q.replace(/\d+[a-z]?/gi,' ').replace(/[,\s]+/g,' ').trim();if(!j.length&&q2&&q2!==q)j=await find(q2);
    if(j.length){msg.textContent='';msg.style.pointerEvents='none';msg.style.maxWidth='';place(+j[0].lat,+j[0].lon,0)}else err.textContent=T('adrnf')};
  g.onclick=go;i.onkeydown=e=>{if(e.key==='Enter')go()};msg.append(i,g,err)};
document.getElementById('gp').onclick=()=>{
  if(!navigator.geolocation){askAddr(T('nogeo'));return}
  msg.style.pointerEvents='none';msg.style.maxWidth='';msg.textContent=T('loc');
  navigator.geolocation.getCurrentPosition(p=>place(p.coords.latitude,p.coords.longitude,p.coords.accuracy),
    e=>askAddr(e.code===1?T('deny'):T('nf')),{enableHighAccuracy:true,timeout:15000})};
const hdB=document.getElementById('hdb');if(hoodLabs.length){hdB.style.display='';hdB.classList.add('on');hdB.onclick=()=>{hoodsOn=!hoodsOn;hdB.classList.toggle('on',hoodsOn);dirty=true}}
const htB=document.getElementById('ht');if(HT){htB.style.display='';htB.onclick=()=>{heatOn=!heatOn;htB.classList.toggle('on',heatOn);document.body.classList.toggle('heat',heatOn);const yi=Math.min(yi0,Math.max(0,Math.round(tt)));paintStatic(yi);if(heatOn)heatStat(yi);domYi=-1;update(tt);dirty=true}}
const bfB=document.getElementById('bf');bfB.onclick=()=>{lensOn=!lensOn;bfB.classList.toggle('on',lensOn);dirty=true};
document.querySelectorAll('.lang button').forEach(b=>b.onclick=()=>{LG=b.dataset.l;applyLang()});
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
const ST={
fr:{s0:()=>({k:nm0().toUpperCase()+' · '+lat0+'°N '+lon0+'°E',h:'Où est passé le vert ?',p:'Des images satellites gratuites, de '+YR[0]+' à '+YR[yi0]+'. Fais défiler.'}),
 s1:()=>({k:YR[ia]+' → '+YR[ib],b:'+'+Math.round(bArr[ib]-bArr[ia])+' pts',p:'de la ville est devenue bâtie en cinq ans. C\u2019est la plus forte poussée.',n:'Chaque bloc blanc vient de basculer.'}),
 s2:()=>{const d=bArr[yi0]-bArr[ib],n=yi0-ib;return{k:'DEPUIS '+YR[ib],b:'+'+Math.round(d)+' pts',p:'en '+n+' ans'+(n>0&&d/n<bestG/5?' : le rythme ralentit.':' : la ville continue de grandir.')}},
 s3:()=>({k:'CE QUI RESTE VERT',b:Math.round(gArr[yi0])+' %',g:1,p:'de la ville est encore verte, contre '+Math.round(gArr[0])+' % en '+YR[0]+'.',n:'Parcs, jardins, arbres et terrains. Les champs sont comptés à part.'}),back:'↑ Histoire'},
en:{s0:()=>({k:nm0().toUpperCase()+' · '+lat0+'°N '+lon0+'°E',h:'Where did the green go?',p:'Free satellite images, from '+YR[0]+' to '+YR[yi0]+'. Scroll.'}),
 s1:()=>({k:YR[ia]+' → '+YR[ib],b:'+'+Math.round(bArr[ib]-bArr[ia])+' pts',p:'of the city became built in five years. The biggest push.',n:'Each white block just flipped.'}),
 s2:()=>{const d=bArr[yi0]-bArr[ib],n=yi0-ib;return{k:'SINCE '+YR[ib],b:'+'+Math.round(d)+' pts',p:'in '+n+' years'+(n>0&&d/n<bestG/5?': the pace slows down.':': the city keeps growing.')}},
 s3:()=>({k:'WHAT STAYS GREEN',b:Math.round(gArr[yi0])+' %',g:1,p:'of the city is still green, down from '+Math.round(gArr[0])+' % in '+YR[0]+'.',n:'Parks, gardens, trees and open land. Fields are counted apart.'}),back:'↑ Story'},
he:{s0:()=>({k:nm0()+' · '+lat0+'°N '+lon0+'°E',h:'לאן נעלם הירוק?',p:'תמונות לוויין חינמיות, מ־'+YR[0]+' עד '+YR[yi0]+'. גלול.'}),
 s1:()=>({k:YR[ia]+' → '+YR[ib],b:'+'+Math.round(bArr[ib]-bArr[ia])+' pts',p:'מהעיר נבנו בחמש שנים. הדחיפה הגדולה ביותר.',n:'כל בלוק לבן הרגע התהפך.'}),
 s2:()=>{const d=bArr[yi0]-bArr[ib],n=yi0-ib;return{k:'מאז '+YR[ib],b:'+'+Math.round(d)+' pts',p:'ב־'+n+' שנים'+(n>0&&d/n<bestG/5?': הקצב מואט.':': העיר ממשיכה לגדול.')}},
 s3:()=>({k:'מה נשאר ירוק',b:Math.round(gArr[yi0])+' %',g:1,p:'מהעיר עדיין ירוק, לעומת '+Math.round(gArr[0])+' % ב־'+YR[0]+'.',n:'פארקים, גינות, עצים ושטח פתוח. שדות נספרים בנפרד.'}),back:'↑ סיפור'}};
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
  const y=scrollY;document.body.classList.toggle('top',y<60);let i=0;st.forEach((v,k)=>{if(y>=v-vh*25)i=k});
  const ex=i===4;
  if(i!==secI||ex!==explore||cardKey!==i+LG){secI=i;if(ex!==explore){explore=ex;document.body.classList.toggle('exp',ex);ctl.enabled=ex;renderer.domElement.style.pointerEvents=ex?'auto':'none';if(!ex){hp=null;tip.style.display='none';hring.visible=false}if(ex){setCam();ctl.target.set(0,0,0);ctl.autoRotate=roEl.checked;tt=DLY!=null?DLY:yi0;DLY=null;sl.value=tt;dirty=true}else{syncFromCam();ctl.autoRotate=false}}cardKey=i+LG;renderCard(i)}
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
addEventListener('scroll',story,{passive:true});{const ab=v=>document.body.classList.toggle('ab-open',v);document.getElementById('logo').onclick=e=>{e.preventDefault();ab(true)};document.getElementById('abt').onclick=()=>ab(true);['abx','abm'].forEach(i=>document.getElementById(i).onclick=()=>ab(false));addEventListener('keydown',e=>{if(e.key==='Escape')ab(false)})}addEventListener('scroll',()=>document.body.classList.toggle('scrolled',scrollY>40),{passive:true});addEventListener('resize',story);
const RELOAD='<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',setUp=()=>{upB.innerHTML=RELOAD;upB.title=upB.ariaLabel=ST[LG].back.replace('↑ ','')};setUp();
window.__lh=()=>{setUp();cardKey=-1;story()};
upB.onclick=()=>scrollTo({top:0,behavior:'smooth'});

function frame(n){const d=Math.min(.1,(n-last)/1000);last=n;
  if(run){acc+=d;if(acc>.16){acc=0;tt=Math.max(0,tt-1);sl.value=tt;update(tt);if(tt<=0)stop()}}
  if(dirty&&!run){dirty=false;update(tt)}
  UT.value=n/1000;if(animating)animating=animStep(Math.min(1,d*5));
  if(!explore){const K=KF[secI],e=Math.min(1,d*2.2);CS.az+=(K.az-CS.az)*e+d*(secI<1?1.5:.8);K.az+=d*(secI<1?1.5:.8);CS.pol+=(K.pol-CS.pol)*e;CS.z+=(K.z-CS.z)*e;setCam()}
  animBalloons(n/1000);animHaze(n/1000);
  if(explore&&roEl.checked&&!ctl.autoRotate){idleT+=d;if(idleT>8){ctl.autoRotate=true;ctl.autoRotateSpeed=.3}}
  if(ctl.autoRotate&&lastE&&!lensOn&&!run)aim(lastE);
  if(explore)ctl.update();{const v=explore?Math.round((1+Math.min(1,Math.max(0,(cam.zoom-1.2)/2.8))*2.2)*10)/10:1;if(v!==VX){VX=v;update(tt)}}{const m=lodFor(cam.zoom);if(m!==LODm){LODm=m;animating=true}}renderer.render(scene,cam);
  const w=wrap.clientWidth,h=wrap.clientHeight;
  const hoodsShow=explore&&hoodsOn&&cam.zoom>=HOOD_ZOOM;if(hoodsShow&&Math.min(yi0,Math.max(0,Math.round(tt)))!==hoodYi)hoodTxt();
  hoodLabs.forEach(l=>{const p=l.v.clone().project(cam),x=(p.x+1)/2*w,y=(1-p.y)/2*h;l.d.style.display=(hoodsShow&&x>0&&x<w&&y>0&&y<h)?'block':'none';l.d.style.left=x+'px';l.d.style.top=y+'px'});
  roadLabs.forEach(l=>{const p=l.v.clone().project(cam),x=(p.x+1)/2*w,y=(1-p.y)/2*h;l.d.style.display=(x>0&&x<w&&y>0&&y<h)?'':'none';l.d.style.left=x+'px';l.d.style.top=y+'px'});
  if(meV){const p=meV.clone().project(cam);me.style.left=((p.x+1)/2*w)+'px';me.style.top=((1-p.y)/2*h)+'px'}
  const n0=new THREE.Vector3(0,0,0).project(cam),n1=new THREE.Vector3(0,0,-10).project(cam);
  compass.style.transform='rotate('+Math.atan2((n1.x-n0.x)*w,-(n1.y-n0.y)*h)*180/Math.PI+'deg)';
  requestAnimationFrame(frame)}
requestAnimationFrame(frame);
story();window.__ready=true;window.__set=v=>{tt=v;sl.value=v;update(v)};

{const l=document.getElementById('ld');if(l)Promise.resolve(window.__logoDone).then(()=>{l.style.opacity=0;setTimeout(()=>l.remove(),600)})}

// ---------- share / deep link: #slug?s=<token> ----------
// The token is base64url of: 1 byte (year - 1980), 1 or more flag bytes (see FLAGS below) and, when a view is saved
// (explore mode), 11 more bytes: latitude, longitude (1e-5 degree), zoom (x10), azimuth and polar angle of the camera. About 15 characters. The address bar follows the session.
// The older #slug?y=2010&l=heat,air&d=0&lg=fr and #slug~<token> are still read.
{const shB=document.getElementById('shr'),btn=id=>document.getElementById(id),on=b=>b&&b.style.display!=='none';
  const fromXZ=(x,z)=>{const E=(x+W/2)*CM+L0,N=T0-(z+H/2)*CM,la0=(D.bbox[1]+D.bbox[3])/2,lo0=(D.bbox[0]+D.bbox[2])/2,kx=111320*Math.cos(la0*Math.PI/180);let la=la0,lo=lo0;
    for(let k=0;k<2;k++){const [e,n]=utm(la,lo);la+=(N-n)/111000;lo+=(E-e)/kx}return [la,lo]};
  // Flags, one bit each, in this order. Bits 0-6 are in the first flag byte, bit 7 of a flag byte says that another flag byte follows
  // (7 more flags each), so new layers can be added at the end without breaking the links already shared.
  const FLAGS=[
    {get:()=>heatOn,set:v=>v&&on(btn('ht'))&&btn('ht').click()},                       // 0 heat layer
    {get:()=>airOn,set:v=>v&&on(btn('ar'))&&btn('ar').click()},                        // 1 air layer
    {get:()=>!!hoodLabs.length&&!hoodsOn,set:v=>v&&hoodLabs.length&&hdB.click()},      // 2 districts hidden
    {get:()=>explore,set:()=>{}},                                                      // 3 a view is saved (explore mode)
    {get:()=>lensOn,set:v=>v&&btn('bf').click()}];                                     // 4 "before" lens
  const VIEW=3;
  const enc=()=>{const yi=Math.min(yi0,Math.max(0,Math.round(tt))),bits=FLAGS.map(f=>f&&f.get()?1:0),fb=[];
    for(let k=0;k<bits.length;k+=7){let v=0;for(let j=0;j<7;j++)v|=(bits[k+j]||0)<<j;fb.push(v)}
    while(fb.length>1&&fb[fb.length-1]===0)fb.pop();fb.forEach((v,i)=>{if(i<fb.length-1)fb[i]=v|128});
    const b=[YR[yi]-1980,...fb];
    if(bits[VIEW]){const [la,lo]=fromXZ(ctl.target.x,ctl.target.z),dv=new DataView(new ArrayBuffer(9));dv.setUint32(0,Math.round((la+90)*1e5));dv.setUint32(4,Math.round((lo+180)*1e5));dv.setUint8(8,Math.max(1,Math.min(255,Math.round(cam.zoom*10))));
      b.push(...new Uint8Array(dv.buffer),Math.round((ctl.getAzimuthalAngle()+Math.PI)/(2*Math.PI)*255),Math.max(0,Math.min(255,Math.round(ctl.getPolarAngle()*100))))}
    return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
  const dec=t=>{try{const b=[...atob(t.replace(/-/g,'+').replace(/_/g,'/'))].map(c=>c.charCodeAt(0));if(b.length<2)return null;
    const bits=[];let p=1;for(;;){const v=b[p++];if(v===undefined)return null;for(let j=0;j<7;j++)bits.push((v>>j)&1);if(!(v&128))break}
    const o={y:1980+b[0],bits};
    if(bits[VIEW]&&b.length>=p+9){const dv=new DataView(new Uint8Array(b.slice(p,p+9)).buffer);o.view={lat:dv.getUint32(0)/1e5-90,lon:dv.getUint32(4)/1e5-180,zoom:dv.getUint8(8)/10};if(b.length>=p+11){o.view.az=b[p+9]/255*2*Math.PI-Math.PI;o.view.pol=b[p+10]/100}}
    return o}catch(e){return null}};
  const hashState=()=>{const rest=HASH.slice(SLUG.length);
    if(rest[0]==='~')return dec(rest.slice(1));
    if(rest[0]==='?'){const q=new URLSearchParams(rest.slice(1));if(q.has('s'))return dec(q.get('s'));const L=(q.get('l')||'').split(',');   // older links: ?y=2010&l=heat,air&d=0
      return{y:+q.get('y')||null,bits:[L.includes('heat')?1:0,L.includes('air')?1:0,q.get('d')==='0'?1:0],old:true,full:q.has('y')||q.has('l')}}
    return null};
  const deepLink=()=>PATHMODE?location.origin+ROOTP+D.slug+'?s='+enc():location.origin+location.pathname+'#'+D.slug+'?s='+enc();
  const toast=m=>{const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.classList.add('in'),10);setTimeout(()=>{t.classList.remove('in');setTimeout(()=>t.remove(),400)},2200)};
  const share=async()=>{const url=deepLink();
    if(navigator.share&&matchMedia('(pointer:coarse)').matches){try{await navigator.share({title:document.title,url});return}catch(e){if(e&&e.name==='AbortError')return}}
    try{await navigator.clipboard.writeText(url);toast(T('shc'))}catch(e){toast(url)}};shB.onclick=share;
  const P=hashState();
  if(P){
    const i=YR.indexOf(P.y);if(i>=0){tt=i;sl.value=i;DLY=i}
    FLAGS.forEach((f,k)=>f&&f.set(!!P.bits[k]));
    domYi=-1;update(tt);dirty=true;
    if(!P.old||P.full)setTimeout(()=>scrollTo(0,document.documentElement.scrollHeight),400);
    if(P.view)setTimeout(()=>{roEl.checked=false;ctl.autoRotate=false;const [x,z]=toXZ(P.view.lat,P.view.lon),d=new THREE.Vector3(x,0,z).sub(ctl.target);cam.position.add(d);ctl.target.add(d);cam.zoom=Math.min(ctl.maxZoom,Math.max(ctl.minZoom,P.view.zoom));if(P.view.pol!=null){const t=ctl.target,r=cam.position.distanceTo(t),pl=Math.min(ctl.maxPolarAngle,Math.max(ctl.minPolarAngle,P.view.pol));cam.position.set(t.x+r*Math.sin(pl)*Math.sin(P.view.az),t.y+r*Math.cos(pl),t.z+r*Math.sin(pl)*Math.cos(P.view.az))}cam.updateProjectionMatrix();ctl.update();dirty=true},1100)}
  // a link pasted in an open tab only changes the hash: load it again (path links reload the page by themselves)
  if(!PATHMODE)addEventListener('hashchange',()=>location.reload());
  // the address bar follows the session: in explore mode it always holds a link that restores the view
  setInterval(()=>{if(P&&!explore&&performance.now()<1500)return;const st=explore?'?s='+enc():'';
    if(PATHMODE){if(decodeURIComponent(location.pathname+location.search)!==ROOTP+D.slug+st)history.replaceState(null,'',ROOTP+D.slug+st)}
    else{const h='#'+D.slug+st;if(decodeURIComponent(location.hash)!==h)history.replaceState(null,'',location.pathname+location.search+h)}},800)}

// ---------- mobile notice: the experience is much better on a desktop ----------
{const m=document.getElementById('mob');let seen=false;try{seen=sessionStorage.getItem('mob')==='1'}catch(e){}
  if(!seen&&(matchMedia('(max-width:820px)').matches||matchMedia('(hover:none) and (pointer:coarse)').matches)){
    const close=()=>{m.classList.remove('on');try{sessionStorage.setItem('mob','1')}catch(e){}};
    m.classList.add('on');document.getElementById('mobok').onclick=close;addEventListener('keydown',e=>{if(e.key==='Escape'&&m.classList.contains('on'))close()})}}

// ---------- ambient music that slowly builds up with the story (Web Audio, nothing to download) ----------
// A drone that never stops, soft chords and a slow pentatonic melody that enter as the story advances. No sequencer.
// Two pieces: the other one is used each time the city changes (stored in localStorage), not during a visit.
{const S=60/70/4,
    PRG=[{d:45,ch:[[57,0,3,7,14],[53,0,4,7,11],[48,0,4,7,14],[55,0,4,7,14]],   // A minor: Am9 Fmaj7 Cadd9 Gadd9
          mel:[76,-1,72,-1,74,-1,69,-1,72,-1,76,-1,79,-1,76,74]},
         {d:38,ch:[[50,0,3,7,14],[46,0,4,7,11],[53,0,4,7,14],[48,0,4,7,14]],   // D dorian: Dm9 Bbmaj7 Fadd9 Cadd9
          mel:[81,-1,77,-1,79,-1,74,-1,77,-1,72,-1,74,-1,69,72]}],
    hz=m=>440*Math.pow(2,(m-69)/12),bt=document.getElementById('mus');
  let SEC=0;try{const lc=localStorage.getItem('adama_mc'),ls=+localStorage.getItem('adama_ms')||0;SEC=lc===null?0:(lc===D.slug?ls:1-ls);localStorage.setItem('adama_mc',D.slug);localStorage.setItem('adama_ms',SEC)}catch(e){}
  let ac,mg,pad,bell,nb,an,timer=0,step=0,next=0,on=false,ex=null;
  const prog=()=>explore?.5:Math.min(1,scrollY/Math.max(1,SECH.slice(0,4).reduce((a,h)=>a+h,0)*vhpx()));
  const lv=(p,a)=>Math.max(0,Math.min(1,(p-a)/.15)),vol=()=>explore?0:1.1;
  const mk=()=>{ac=new(window.AudioContext||window.webkitAudioContext)();mg=ac.createGain();mg.gain.value=0;an=ac.createAnalyser();mg.connect(an);an.connect(ac.destination);
    const len=ac.sampleRate*4,ib=ac.createBuffer(2,len,ac.sampleRate);for(let c=0;c<2;c++){const d=ib.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2)}
    const verb=ac.createConvolver();verb.buffer=ib;const vg=ac.createGain();vg.gain.value=.7;verb.connect(vg);vg.connect(mg);
    const dly=ac.createDelay(2);dly.delayTime.value=S*6;const fb=ac.createGain();fb.gain.value=.45;dly.connect(fb);fb.connect(dly);const dg=ac.createGain();dg.gain.value=.4;dly.connect(dg);dg.connect(mg);dg.connect(verb);
    pad=ac.createGain();pad.connect(mg);pad.connect(verb);bell=ac.createGain();bell.connect(mg);bell.connect(dly);bell.connect(verb);
    nb=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1};
  const tone=(t,f,dur,type,vol,cut,dest,att=.01)=>{const o=ac.createOscillator(),g=ac.createGain(),fl=ac.createBiquadFilter();o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=cut;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(fl);fl.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+.05)};
  // a held note: rises over `att`, stays, fades over `att` (notes that follow each other cross-fade)
  const sus=(t,f,dur,type,vol,cut,dest,att)=>{const o=ac.createOscillator(),g=ac.createGain(),fl=ac.createBiquadFilter();o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=cut;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+att);g.gain.setValueAtTime(vol,t+dur-att);g.gain.linearRampToValueAtTime(0,t+dur);o.connect(fl);fl.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+.05)};
  const swell=(t,dur,vol,dest)=>{const n=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();n.buffer=nb;n.loop=true;fl.type='bandpass';fl.frequency.value=2200;fl.Q.value=.6;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+dur*.6);g.gain.linearRampToValueAtTime(0,t+dur);n.connect(fl);fl.connect(g);g.connect(dest);n.start(t);n.stop(t+dur+.05)};
  const play=(i,t,p)=>{const P=PRG[SEC],c=P.ch[Math.floor(i/32)%4],r=c[0],iv=c.slice(1);
    if(i%128===0)[[0,'sine',.09],[7,'triangle',.035],[12,'sine',.03]].forEach(([x,ty,v])=>[-1,1].forEach(d=>sus(t,hz(P.d+x)*(1+d*.002),128*S+6,ty,v,500,pad,6)));
    if(i%32===0){const pd=lv(p,.05);if(pd>0)iv.concat(iv.map(x=>x+12)).forEach(x=>[-1,1].forEach(d=>sus(t,hz(r+x)*(1+d*.003),32*S+4,'triangle',.02*pd,500+900*p,pad,4)));
      const a=lv(p,.45);if(a>0)swell(t,32*S,.025*a,pad);
      const k=lv(p,.78);if(k>0){const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(38,t+.25);g.gain.setValueAtTime(.16*k,t);g.gain.exponentialRampToValueAtTime(.0001,t+.7);o.connect(g);g.connect(mg);o.start(t);o.stop(t+.75)}}
    if(i%8===0){const m=P.mel[(i/8)%16],ml=lv(p,.2);if(ml>0&&m>0){tone(t,hz(m),S*22,'sine',.06*ml,2600,bell,.3);const sh=lv(p,.5);if(sh>0)tone(t+S*2,hz(m+12),S*16,'sine',.02*sh,3500,bell,.3)}}};
  const tick=()=>{if(explore!==ex){ex=explore;mg.gain.setTargetAtTime(vol(),ac.currentTime,ex?1.4:1.2)}const p=prog();while(next<ac.currentTime+.2){play(step,next,p);next+=S;step++}};
  const set=v=>{on=v;bt.classList.toggle('off',!v);bt.setAttribute('aria-pressed',v);bt.title=bt.ariaLabel=T('mus');
    if(v){if(!ac)mk();ac.resume();mg.gain.cancelScheduledValues(ac.currentTime);mg.gain.setTargetAtTime(vol(),ac.currentTime,1.2);ex=explore;if(!timer){step=0;next=ac.currentTime+.08;timer=setInterval(tick,40)}}
    else if(ac){mg.gain.setTargetAtTime(0,ac.currentTime,.3);setTimeout(()=>{if(!on){clearInterval(timer);timer=0;ac.suspend()}},1500)}};
  bt.onclick=e=>{e.stopPropagation();set(!on)};
  document.addEventListener('visibilitychange',()=>{if(ac&&on)document.hidden?ac.suspend():ac.resume()});
  window.__music=Object.assign(set,{peak:()=>{const d=new Float32Array(an.fftSize);an.getFloatTimeDomainData(d);return Math.max(...d.map(Math.abs))},state:()=>ac&&ac.state+' '+step+' sec='+SEC});
  bt.title=bt.ariaLabel=T('mus')}

// clean screen: the legend and the language / share / sound buttons fade out when nobody touches the page for a few seconds
// (the scroll of the Play button does not count as an interaction)
{let idle=0;const wake=()=>{document.body.classList.remove('idle');clearTimeout(idle);idle=setTimeout(()=>document.body.classList.add('idle'),4000)};
  ['mousemove','mousedown','pointerdown','touchstart','wheel','keydown'].forEach(e=>addEventListener(e,wake,{passive:true}));wake()}
