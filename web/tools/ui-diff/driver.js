window.__run=async(prefix)=>{
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)};
const pathOf=e=>{const a=[];let n=e;while(n&&n!==document.documentElement){const p=n.parentElement;a.push(n.tagName+(n.id?'#'+n.id:'')+':'+(p?[...p.children].indexOf(n):0));n=p}return a.reverse().join('>')};
const SKIP=new Set(['SCRIPT','STYLE','META','LINK','TITLE','CANVAS']);
const dump=async name=>{const out={};for(const e of document.querySelectorAll('body *')){if(SKIP.has(e.tagName))continue;out[pathOf(e)]=fnv(getComputedStyle(e).cssText)}
 await fetch('http://127.0.0.1:8766/'+prefix+name,{method:'POST',body:JSON.stringify(out)});return Object.keys(out).length};
const wk=setInterval(()=>window.dispatchEvent(new MouseEvent('mousemove')),500);const res={};
await sleep(6500);res.story=await dump('1_story');
scrollTo(0,document.documentElement.scrollHeight);await sleep(3000);res.explore=await dump('2_explore');
document.getElementById('cmb').click();await sleep(700);const bs=document.querySelectorAll('.cmv button');if(bs[0])bs[0].click();await sleep(700);res.menuList=await dump('3_menu_list');
if(bs[1])bs[1].click();await sleep(900);res.menuMap=await dump('4_menu_map');
document.getElementById('cm').classList.remove('open');await sleep(600);
document.getElementById('abt').click();await sleep(900);res.about=await dump('5_about');
document.getElementById('abx').click();await sleep(700);
const gpa=document.getElementById('gpa');if(gpa){gpa.click();await sleep(700)}res.typing=await dump('6_typing');
const hb=document.getElementById('zp');if(hb){hb.click();await sleep(400)}res.hand=await dump('7_hand');
const ht=document.getElementById('ht');if(ht){ht.click();await sleep(900)}res.heat=await dump('8_heat');
clearInterval(wk);return JSON.stringify(res)};
'driver ready'
