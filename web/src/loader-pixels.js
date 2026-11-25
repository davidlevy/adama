// ARCHIVED loader (not built): the pixelated Earth that unrolls into the Caveat name. Replaced by the green-to-white writing
// loader inlined in template.html. To bring it back, paste this block in a <script> right after <div id="ld">Adama</div>
// in template.html (it sets window.__logoDone, which app.js waits for before fading #ld out).
// loading screen: a pixelated Earth (Europe, Africa, Arabia) dissolves from the centre and the Adama logo comes out of it,
// the pixels getting finer step by step until it is the written Caveat logo
(()=>{const ld=document.getElementById('ld');if(!ld)return;
 const K=1;
 const MASK='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/AAAAAAAAAAAAAAAAAAAAAAAAAAAH4A8AAAAAAAAAAAAAAAAAAAAAAAAAA/4AfgAAAAAAAAAAAAAAAAAAAAAAAAD/4Af4AAAAAAAAAAAAAAAAAAAAAAAAP/4D/+AAAAAAAAAAAAAAAAAAAAAAAAf/nQ//AAAAAAAAAAAAAAAAAAAAAAAA//HG//gAAAAAAAAAAAAAAAAAAAAAADn8AF//4AAAAAAAAAAAAAAAAAAAAAAHo4HH//8AAAAAAAAAAAAAAAAAAAAAAOAYP///+AAAAAAAAAAAAAAAAAAAAAAcAA/////AAAAAAAAAAAAAAAAAAAAAAoAB/////gAAAAAAAAAAAAAAAAAAAAAAAb/////gAAAAAAAAAAAAAAAAAAAAAAB73////wAAAAAAAAAAAAAAAAAAAACAD7/////4AAAAAAAAAAAAAAAAAAAAEAB//////4AAAAAAAAAAAAAAAAAAAAAAB//////4AAAAAAAAAAAAAAAAAAAAIAB//////8AAAAAAAAAAAAAAAAAAAAAAN///P//8AAAAAAAAAAAAAAAAAAAAQAP//+P//+AAAAAAAAAAAAAAAAAAAAAAf//+P//+AAAAAAAAAAAAAAAAAAAAAAfP+uH//+AAAAAAAAAAAAAAAAAAAAgAeL//H///AAAAAAAAAAAAAAAAAAAAgA////H///AAAAAAAAAAAAAAAAAAAAAB/6f/n///gAAAAAAAAAAAAAAAAAAAAD/4d////+gAAAAAAAAAAAAAAAAAABAH/+w/////gAAAAAAAAAAAAAAAAAABAP////////gAAAAAAAAAAAAAAAAAABAf///////fgAAAAAAAAAAAAAAAAAABAf///////PgAAAAAAAAAAAAAAAAAABAf/////j+HgAAAAAAAAAAAAAAAAAABA//////g+GgAAAAAAAAAAAAAAAAAABA////3/geGgAAAAAAAAAAAAAAAAAABA//////geDgAAAAAAAAAAAAAAAAAABAf///7/AOHgAAAAAAAAAAAAAAAAAABgf////8APHgAAAAAAAAAAAAAAAAAABgf////4AHDgAAAAAAAAAAAAAAAAAAAgP////8AADgAAAAAAAAAAAAAAAAAAAwH////8AABgAAAAAAAAAAAAAAAAAAAwB////8AABAAAAAAAAAAAAAAAAAAAAwAH///4AABAAAAAAAAAAAAAAAAAAAAQAB///wAABAAAAAAAAAAAAAAAAAAAAQAB///wAACAAAAAAAAAAAAAAAAAAAAQAB///AAACAAAAAAAAAAAAAAAAAAAAIAB//+AAAGAAAAAAAAAAAAAAAAAAAAIAA//+AAAEAAAAAAAAAAAAAAAAAAAAEAAf/8AAAMAAAAAAAAAAAAAAAAAAAAGAAf/8AAAYAAAAAAAAAAAAAAAAAAAACAAf/8AAAQAAAAAAAAAAAAAAAAAAAABAAf/8YAAwAAAAAAAAAAAAAAAAAAAAAgAf/+4ABgAAAAAAAAAAAAAAAAAAAAAwAf/94ADAAAAAAAAAAAAAAAAAAAAAAQAf/x4ACAAAAAAAAAAAAAAAAAAAAAAMAP/xwAAAAAAAAAAAAAAAAAAAAAAAAGAH/xgAAAAAAAAAAAAAAAAAAAAAAAACAH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAYAAAAAAAAAAAAAAAAAAAAAAAADwAABwAAAAAAAAAAAAAAAAAAAAAAAAAeAAeAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';   // 180x68 bits: land seen from above the Mediterranean (Natural Earth 110m, public domain), the globe is the disc of radius 31
 window.__logoDone=new Promise(res=>{let ended=false;const fin=()=>{if(ended)return;ended=true;ld.classList.add('slow');res()};
  setTimeout(fin,8000*K);
  let seen=false;try{seen=!!sessionStorage.getItem('adama-ld');sessionStorage.setItem('adama-ld','1')}catch(e){}   // the animation plays once per visit; afterwards the plain Caveat name
  if(seen||matchMedia('(prefers-reduced-motion:reduce)').matches||!document.fonts){fin();return}
  document.fonts.load('500 100px Caveat','Adama').then(()=>{
   const dpr=Math.min(2,devicePixelRatio||1),fs=Math.round(112*dpr),o=document.createElement('canvas'),ox=o.getContext('2d');
   ox.font='500 '+fs+'px Caveat';const w=Math.ceil(ox.measureText('Adama').width)+Math.round(fs*.3),h=Math.round(fs*1.25);
   o.width=w;o.height=h;ox.font='500 '+fs+'px Caveat';ox.fillStyle='#e4e4e7';ox.fillText('Adama',Math.round(fs*.15),Math.round(fs*.88));
   // the Earth, same size as the logo canvas
   const MW=180,MH=68,m=document.createElement('canvas');m.width=MW;m.height=MH;const mx=m.getContext('2d'),im=mx.createImageData(MW,MH),raw=atob(MASK);
   for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const n=y*MW+x,land=(raw.charCodeAt(n>>3)>>(7-(n&7)))&1,disc=(x+.5-MW/2)**2+(y+.5-MH/2)**2<=31*31,g=land?235:disc?70:0,k=n*4;im.data[k]=im.data[k+1]=im.data[k+2]=g;im.data[k+3]=255}
   mx.putImageData(im,0,0);
   const e=document.createElement('canvas');e.width=w;e.height=h;const ex=e.getContext('2d');ex.fillStyle='#000';ex.fillRect(0,0,w,h);ex.imageSmoothingQuality='high';
   const s=h/MH;ex.drawImage(m,(w-MW*s)/2,0,MW*s,MH*s);
   const c=document.createElement('canvas');c.width=w;c.height=h;c.style.cssText='width:'+w/dpr+'px;height:'+h/dpr+'px;display:block';c.setAttribute('role','img');c.setAttribute('aria-label','Adama');
   const cx=c.getContext('2d');ld.textContent='';ld.appendChild(c);
   const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v)};
   const down=(src,sw,sh)=>{const t=document.createElement('canvas');t.width=sw;t.height=sh;const tx=t.getContext('2d');tx.imageSmoothingQuality='high';tx.drawImage(src,0,0,sw,sh);return tx.getImageData(0,0,sw,sh).data};
   // px = size of a pixel, p = share of the Earth already replaced by the logo
   const render=(px,p)=>{cx.clearRect(0,0,w,h);
    if(px===1&&p===1){cx.drawImage(o,0,0);return}
    const sw=Math.max(1,Math.ceil(w/px)),sh=Math.max(1,Math.ceil(h/px)),A=down(e,sw,sh),B=down(o,sw,sh),mxd=Math.hypot(sw/2,sh/2);
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const k=(y*sw+x)*4,thr=Math.hypot(x+.5-sw/2,y+.5-sh/2)/mxd*.72+hash(Math.floor(x*px/(8*dpr)),Math.floor(y*px/(8*dpr)))*.28,v=p>thr?B[k+3]/255*228:A[k]*.9;
     if(v>2){cx.fillStyle='rgb('+Math.round(v)+','+Math.round(v)+','+Math.round(v*1.01)+')';cx.fillRect(x*px,y*px,px,px)}}};
   // The Earth flattens into a band, then each pixel of it goes to a pixel of the letters (pixels are paired from left to right,
   // so the globe seems to unroll into the name); finally the pixels get finer until the written Caveat logo.
   const px0=Math.max(2,Math.round(5*dpr)),gw=Math.ceil(w/px0),gh=Math.ceil(h/px0),A0=down(e,gw,gh),B0=down(o,gw,gh),S=[],T=[];
   for(let x=0;x<gw;x++)for(let y=0;y<gh;y++){const k=(y*gw+x)*4;if(A0[k]>20)S.push([x,y,A0[k]*.9]);if(B0[k+3]>90)T.push([x,y,B0[k+3]/255*228])}
   if(!S.length||!T.length){fin();return}
   const n=Math.max(S.length,T.length),P=[];for(let i=0;i<n;i++){const s=S[Math.floor(i*S.length/n)],q=T[Math.floor(i*T.length/n)];P.push([s[0],s[1],s[2],q[0],q[1],q[2]])}
   const D=1600*K,t0=performance.now(),lp=Math.log,lerp=(a,b,t)=>a+(b-a)*t,cl=u=>Math.min(1,Math.max(0,u)),easeIO=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
   const gcx=gw/2,gcy=gh/2,SX=gw*.88/(2*.456*h/px0),SY=.16;let last='';
   const pc=document.createElement('canvas');pc.width=w;pc.height=h;const pcx=pc.getContext('2d');
   const frame=now=>{const u=Math.min(1,(now-t0)/D);
    if(u>=.8){const t=(u-.8)/.2,px=Math.max(1,Math.round(Math.exp(lerp(lp(px0),0,easeIO(t)))));if(px+':r'!==last){last=px+':r';render(px,1);pcx.clearRect(0,0,w,h);pcx.drawImage(c,0,0)}
     const a=easeIO(t);cx.clearRect(0,0,w,h);cx.globalAlpha=a;cx.drawImage(o,0,0);cx.globalAlpha=1-a;cx.drawImage(pc,0,0);cx.globalAlpha=1}
    else{const f1=easeIO(cl((u-.06)/.36)),f2=easeIO(cl((u-.38)/.4));cx.clearRect(0,0,w,h);
     for(const q of P){const x=lerp(lerp(q[0],gcx+(q[0]-gcx)*SX,f1),q[3],f2),y=lerp(lerp(q[1],gcy+(q[1]-gcy)*SY,f1),q[4],f2),v=Math.round(lerp(q[2],q[5],f2));
      cx.fillStyle='rgb('+v+','+v+','+Math.round(v*1.01)+')';cx.fillRect(Math.round(x)*px0,Math.round(y)*px0,px0,px0)}}
    if(u<1)requestAnimationFrame(frame);else{render(1,1);setTimeout(fin,250*K)}};
   requestAnimationFrame(frame)}).catch(fin)})})();
