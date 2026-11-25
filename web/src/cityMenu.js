import {NAMES} from './data/names.js';
import {IC,LT} from './data/icons.js';
import {CTRY,CODE,CO} from './data/countries.js';
import {WORLD} from './worldmask.js';

// The city menu of the top bar: a search field, a list of the cities grouped by country (in columns) and a pixel world map, with a list / map switch.
// Needs: D (the current city), CITIES (the index of the site), T, getLang(), the links mode (PATHMODE, ROOTP) and the three elements of the menu.
// Returns { renderCities, cms (the search field), langChanged }.
export function initCityMenu({D,CITIES,T,getLang,PATHMODE,ROOTP,cmEl,cmb,cml}){
// city menu: search field + cities grouped by country, in columns
const cms=document.createElement('input'),cmg=document.createElement('div');cms.className='cms';cms.type='search';cms.autocomplete='off';cms.spellcheck=false;cmg.className='cmg';const cmt=document.createElement('div'),cmm=document.createElement('div');cmt.className='cmt';cmm.className='cmm';cmt.append(cms);const cmf=document.createElement('div');cmf.className='cmf';cmf.setAttribute('aria-hidden','true');cml.append(cmt,cmm,cmg,cmf);const fade=()=>cmf.classList.toggle('end',cml.scrollHeight-cml.scrollTop-cml.clientHeight<8);cml.addEventListener('scroll',fade);cml.onclick=e=>e.stopPropagation();
const nz=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// a city matches when one of its names (or its country) has a word that starts with what was typed: "t" finds Tel Aviv and Tiberias, "ra" finds Ra'anana and Rafah...
const cityMatch=(c,q)=>!q||[...['fr','en','he'].map(l=>(NAMES[c.slug]||{})[l]),c.name.split(',')[0],CO(c.slug)[getLang()]].some(n=>nz(n).split(/[\s\-\u2019'.]+/).some(w=>w.startsWith(q)));
const goCity=c=>{if(c.slug===D.slug){cmEl.classList.remove('open');return}if(PATHMODE){location.href=ROOTP+c.slug}else{location.hash=c.slug;location.reload()}};
function renderCities(){const q=nz(cms.value.trim()),by={},nmOf=c=>(NAMES[c.slug]||{})[getLang()]||c.name.split(',')[0];
  CITIES.forEach(c=>{if(cityMatch(c,q)){const k=CODE[c.slug]||'IL';(by[k]=by[k]||[]).push(c)}});
  cmg.innerHTML='';const codes=Object.keys(by).sort((a,b)=>CTRY[getLang()][a].localeCompare(CTRY[getLang()][b],getLang()));
  if(!codes.length){const p=document.createElement('p');p.className='cmn0';p.textContent=T('nocity');cmg.appendChild(p);return}
  codes.forEach(k=>{const sec=document.createElement('section'),h=document.createElement('h4'),ul=document.createElement('ul');h.textContent=CTRY[getLang()][k]+' \u00b7 '+by[k].length;
    by[k].sort((a,b)=>nmOf(a).localeCompare(nmOf(b),getLang())).forEach(c=>{const li=document.createElement('li'),n=document.createElement('span'),ly=document.createElement('i');li.dataset.slug=c.slug;li.setAttribute('role','option');if(c.slug===D.slug)li.className='on';
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
  const cname=c=>(NAMES[c.slug]||{})[getLang()]||c.name.split(',')[0],reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
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
  const ctry=k=>CTRY[getLang()][CODE[k.m[0].slug]||'IL'];
  function show(k,list){pop.hidden=false;pop.replaceChildren();pop.className=list?'lst':'';
    if(list){const h=document.createElement('span');h.textContent=ctry(k);pop.append(h);k.m.slice().sort((a,b)=>cname(a).localeCompare(cname(b),getLang())).forEach(c=>{const b=document.createElement('button');b.textContent=cname(c);if(c.slug===D.slug)b.className='on';b.onclick=()=>goCity(c);pop.append(b)})}
    else{const b=document.createElement('span');b.textContent=cname(k.m[0])+' · '+ctry(k);pop.append(b)}
    const m=list?Math.min(210,W/2):80;pop.style.left=Math.min(W-m,Math.max(m,k.x*cell))+'px';pop.style.top=k.y*cell+'px'}
  cv.onpointermove=e=>{const k=near(e);hov=k;cv.style.cursor=k?'pointer':'';if(k&&!pop.classList.contains('lst'))show(k,false);else if(!k&&!pop.classList.contains('lst'))pop.hidden=true};
  cv.onpointerleave=()=>{hov=null;if(!pop.classList.contains('lst'))pop.hidden=true};
  cv.onclick=e=>{const k=near(e);if(!k){pop.hidden=true;pop.className='';return}if(k.m.length===1)goCity(k.m[0]);else{hov=k;show(k,true)}};
  bL.onclick=()=>setView('list');bM.onclick=()=>setView('map');
  cms.oninput=()=>{if(view==='map')setView('list',true);renderCities();cml.scrollTop=0;fade()};
  cmb.addEventListener('click',()=>setTimeout(()=>{fade();if(cmEl.classList.contains('open')){setView(view,true);if(view==='map')pop.hidden=true}},0));
  cmvLang=()=>{bL.title=bL.ariaLabel=T('vlist');bM.title=bM.ariaLabel=T('vmap');cv.setAttribute('aria-label',T('vmap'));pop.hidden=true;pop.className=''};
  cml.dataset.view=view;bL.setAttribute('aria-pressed',view==='list');bM.setAttribute('aria-pressed',view==='map')}
return {renderCities,cms,langChanged:()=>cmvLang()}}
