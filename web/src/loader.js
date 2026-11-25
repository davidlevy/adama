// loading screen: the name and a thin progress bar. It creeps while the data loads, app.js moves it forward (window.__ldp) and fades the screen out.
(()=>{const ld=document.getElementById('ld');if(!ld)return;
 ld.innerHTML='<div class="ldw"><span>Adama</span><i class="ldb" role="progressbar" aria-label="Loading"><b></b></i></div>';
 const bar=ld.querySelector('b');let p=0;const set=v=>{p=Math.max(p,Math.min(1,v));bar.style.transform='scaleX('+p+')'};window.__ldp=set;
 const t0=performance.now(),tick=()=>{if(!ld.isConnected)return;set(.85*(1-Math.exp(-(performance.now()-t0)/1500)));setTimeout(tick,120)};tick()})();
