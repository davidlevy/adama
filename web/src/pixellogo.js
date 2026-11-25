// The pixelated Earth (Europe, Africa, Arabia) that unrolls into the written Caveat name: shown in the About dialog each time it opens.
// The globe flattens into a band, each pixel goes to a pixel of the letters (paired left to right), then the pixels get finer
// until the real logo. Ported from the first loading screen.
const MASK='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/AAAAAAAAAAAAAAAAAAAAAAAAAAAH4A8AAAAAAAAAAAAAAAAAAAAAAAAAA/4AfgAAAAAAAAAAAAAAAAAAAAAAAAD/4Af4AAAAAAAAAAAAAAAAAAAAAAAAP/4D/+AAAAAAAAAAAAAAAAAAAAAAAAf/nQ//AAAAAAAAAAAAAAAAAAAAAAAA//HG//gAAAAAAAAAAAAAAAAAAAAAADn8AF//4AAAAAAAAAAAAAAAAAAAAAAHo4HH//8AAAAAAAAAAAAAAAAAAAAAAOAYP///+AAAAAAAAAAAAAAAAAAAAAAcAA/////AAAAAAAAAAAAAAAAAAAAAAoAB/////gAAAAAAAAAAAAAAAAAAAAAAAb/////gAAAAAAAAAAAAAAAAAAAAAAB73////wAAAAAAAAAAAAAAAAAAAACAD7/////4AAAAAAAAAAAAAAAAAAAAEAB//////4AAAAAAAAAAAAAAAAAAAAAAB//////4AAAAAAAAAAAAAAAAAAAAIAB//////8AAAAAAAAAAAAAAAAAAAAAAN///P//8AAAAAAAAAAAAAAAAAAAAQAP//+P//+AAAAAAAAAAAAAAAAAAAAAAf//+P//+AAAAAAAAAAAAAAAAAAAAAAfP+uH//+AAAAAAAAAAAAAAAAAAAAgAeL//H///AAAAAAAAAAAAAAAAAAAAgA////H///AAAAAAAAAAAAAAAAAAAAAB/6f/n///gAAAAAAAAAAAAAAAAAAAAD/4d////+gAAAAAAAAAAAAAAAAAABAH/+w/////gAAAAAAAAAAAAAAAAAABAP////////gAAAAAAAAAAAAAAAAAABAf///////fgAAAAAAAAAAAAAAAAAABAf///////PgAAAAAAAAAAAAAAAAAABAf/////j+HgAAAAAAAAAAAAAAAAAABA//////g+GgAAAAAAAAAAAAAAAAAABA////3/geGgAAAAAAAAAAAAAAAAAABA//////geDgAAAAAAAAAAAAAAAAAABAf///7/AOHgAAAAAAAAAAAAAAAAAABgf////8APHgAAAAAAAAAAAAAAAAAABgf////4AHDgAAAAAAAAAAAAAAAAAAAgP////8AADgAAAAAAAAAAAAAAAAAAAwH////8AABgAAAAAAAAAAAAAAAAAAAwB////8AABAAAAAAAAAAAAAAAAAAAAwAH///4AABAAAAAAAAAAAAAAAAAAAAQAB///wAABAAAAAAAAAAAAAAAAAAAAQAB///wAACAAAAAAAAAAAAAAAAAAAAQAB///AAACAAAAAAAAAAAAAAAAAAAAIAB//+AAAGAAAAAAAAAAAAAAAAAAAAIAA//+AAAEAAAAAAAAAAAAAAAAAAAAEAAf/8AAAMAAAAAAAAAAAAAAAAAAAAGAAf/8AAAYAAAAAAAAAAAAAAAAAAAACAAf/8AAAQAAAAAAAAAAAAAAAAAAAABAAf/8YAAwAAAAAAAAAAAAAAAAAAAAAgAf/+4ABgAAAAAAAAAAAAAAAAAAAAAwAf/94ADAAAAAAAAAAAAAAAAAAAAAAQAf/x4ACAAAAAAAAAAAAAAAAAAAAAAMAP/xwAAAAAAAAAAAAAAAAAAAAAAAAGAH/xgAAAAAAAAAAAAAAAAAAAAAAAACAH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAYAAAAAAAAAAAAAAAAAAAAAAAADwAABwAAAAAAAAAAAAAAAAAAAAAAAAAeAAeAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';   // 180x68 bits: land seen from above the Mediterranean (Natural Earth 110m, public domain), the globe is the disc of radius 31
const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v)},lerp=(a,b,t)=>a+(b-a)*t,cl=u=>Math.min(1,Math.max(0,u)),easeIO=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
export async function playPixelLogo(host,size=64){
  if(!host)return;host.__stop&&host.__stop();let alive=true;host.__stop=()=>{alive=false};host.textContent='';
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  try{await document.fonts.load('500 100px Caveat','Adama')}catch(e){}
  if(!alive)return;
  const dpr=Math.min(2,devicePixelRatio||1),fs=Math.round(size*dpr),o=document.createElement('canvas'),ox=o.getContext('2d');
  ox.font='500 '+fs+'px Caveat';const w=Math.ceil(ox.measureText('Adama').width)+Math.round(fs*.3),h=Math.round(fs*1.25);
  o.width=w;o.height=h;ox.font='500 '+fs+'px Caveat';ox.fillStyle='#e4e4e7';ox.fillText('Adama',Math.round(fs*.15),Math.round(fs*.88));
  const c=document.createElement('canvas');c.width=w;c.height=h;c.style.cssText='width:'+w/dpr+'px;height:'+h/dpr+'px;display:block';c.setAttribute('role','img');c.setAttribute('aria-label','Adama');
  const cx=c.getContext('2d');host.appendChild(c);
  if(reduce){cx.drawImage(o,0,0);return}
  const MW=180,MH=68,m=document.createElement('canvas');m.width=MW;m.height=MH;const mx=m.getContext('2d'),im=mx.createImageData(MW,MH),raw=atob(MASK);
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const n=y*MW+x,land=(raw.charCodeAt(n>>3)>>(7-(n&7)))&1,disc=(x+.5-MW/2)**2+(y+.5-MH/2)**2<=31*31,g=land?235:disc?70:0,k=n*4;im.data[k]=im.data[k+1]=im.data[k+2]=g;im.data[k+3]=255}
  mx.putImageData(im,0,0);
  const e=document.createElement('canvas');e.width=w;e.height=h;const ex=e.getContext('2d');ex.fillStyle='#000';ex.fillRect(0,0,w,h);ex.imageSmoothingQuality='high';
  const s=h/MH;ex.drawImage(m,(w-MW*s)/2,0,MW*s,MH*s);
  const down=(src,sw,sh)=>{const t=document.createElement('canvas');t.width=sw;t.height=sh;const tx=t.getContext('2d');tx.imageSmoothingQuality='high';tx.drawImage(src,0,0,sw,sh);return tx.getImageData(0,0,sw,sh).data};
  // px = size of a pixel, p = share of the Earth already replaced by the logo
  const render=(px,p)=>{cx.clearRect(0,0,w,h);
    if(px===1&&p===1){cx.drawImage(o,0,0);return}
    const sw=Math.max(1,Math.ceil(w/px)),sh=Math.max(1,Math.ceil(h/px)),A=down(e,sw,sh),B=down(o,sw,sh),mxd=Math.hypot(sw/2,sh/2);
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const k=(y*sw+x)*4,thr=Math.hypot(x+.5-sw/2,y+.5-sh/2)/mxd*.72+hash(Math.floor(x*px/(8*dpr)),Math.floor(y*px/(8*dpr)))*.28,v=p>thr?B[k+3]/255*228:A[k]*.9;
      if(v>2){cx.fillStyle='rgb('+Math.round(v)+','+Math.round(v)+','+Math.round(v*1.01)+')';cx.fillRect(x*px,y*px,px,px)}}};
  const px0=Math.max(2,Math.round(5*dpr*size/112)),gw=Math.ceil(w/px0),gh=Math.ceil(h/px0),A0=down(e,gw,gh),B0=down(o,gw,gh),S=[],T=[];
  for(let x=0;x<gw;x++)for(let y=0;y<gh;y++){const k=(y*gw+x)*4;if(A0[k]>20)S.push([x,y,A0[k]*.9]);if(B0[k+3]>90)T.push([x,y,B0[k+3]/255*228])}
  if(!S.length||!T.length){cx.drawImage(o,0,0);return}
  const n=Math.max(S.length,T.length),P=[];for(let i=0;i<n;i++){const s=S[Math.floor(i*S.length/n)],q=T[Math.floor(i*T.length/n)];P.push([s[0],s[1],s[2],q[0],q[1],q[2]])}
  const D=1800,t0=performance.now(),lp=Math.log,gcx=gw/2,gcy=gh/2,SX=gw*.88/(2*.456*h/px0),SY=.16,pc=document.createElement('canvas');pc.width=w;pc.height=h;const pcx=pc.getContext('2d');let last='';
  const frame=now=>{if(!alive)return;const u=Math.min(1,(now-t0)/D);
    if(u>=.8){const t=(u-.8)/.2,px=Math.max(1,Math.round(Math.exp(lerp(lp(px0),0,easeIO(t)))));if(px+':r'!==last){last=px+':r';render(px,1);pcx.clearRect(0,0,w,h);pcx.drawImage(c,0,0)}
      const a=easeIO(t);cx.clearRect(0,0,w,h);cx.globalAlpha=a;cx.drawImage(o,0,0);cx.globalAlpha=1-a;cx.drawImage(pc,0,0);cx.globalAlpha=1}
    else{const f1=easeIO(cl((u-.06)/.36)),f2=easeIO(cl((u-.38)/.4));cx.clearRect(0,0,w,h);
      for(const q of P){const x=lerp(lerp(q[0],gcx+(q[0]-gcx)*SX,f1),q[3],f2),y=lerp(lerp(q[1],gcy+(q[1]-gcy)*SY,f1),q[4],f2),v=Math.round(lerp(q[2],q[5],f2));
        cx.fillStyle='rgb('+v+','+v+','+Math.round(v*1.01)+')';cx.fillRect(Math.round(x)*px0,Math.round(y)*px0,px0,px0)}}
    if(u<1)requestAnimationFrame(frame);else render(1,1)};
  requestAnimationFrame(frame)}
