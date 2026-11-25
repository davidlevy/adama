// ambient music that slowly builds up with the story (Web Audio, nothing to download) ----------
// A drone that never stops, soft chords and a slow pentatonic melody that enter as the story advances. No sequencer.
// Four pieces, taken in turn each time the city changes (stored in localStorage), not during a visit. The third one is the only one with
// a beat (synthwave, 96 bpm: bass, lead, drums that come in as the story advances). The fourth one is an "ambient trap": a calm D minor pad with long held notes (75 bpm), then a half-time drop (16th hats, snare on beat 3, gliding 808) near the end of the story.
// Needs: slug (the city, to rotate the pieces), T (translations), isExplore() (the music is silent in explore mode), getProgress() (0..1 along the story).
export function initMusic({slug,T,isExplore,getProgress}){const PRG=[{bpm:70,d:45,ch:[[57,0,3,7,14],[53,0,4,7,11],[48,0,4,7,14],[55,0,4,7,14]],   // A minor: Am9 Fmaj7 Cadd9 Gadd9
          mel:[76,-1,72,-1,74,-1,69,-1,72,-1,76,-1,79,-1,76,74]},
         {bpm:70,d:38,ch:[[50,0,3,7,14],[46,0,4,7,11],[53,0,4,7,14],[48,0,4,7,14]],   // D dorian: Dm9 Bbmaj7 Fadd9 Cadd9
          mel:[81,-1,77,-1,79,-1,74,-1,77,-1,72,-1,74,-1,69,72]},
         {bpm:96,syn:1,d:42,ch:[[54,0,3,7,14],[50,0,4,7,11],[57,0,4,7,14],[52,0,4,7,14]],   // F# minor: F#m9 Dmaj7 Aadd9 Eadd9
          lead:[[85,-1,-1,83,81,-1,78,-1,81,-1,-1,-1,83,-1,81,-1],[83,-1,-1,81,78,-1,81,-1,83,-1,-1,-1,85,-1,83,-1],
                [81,-1,-1,85,88,-1,85,-1,83,-1,-1,-1,81,-1,-1,-1],[80,-1,-1,83,85,-1,83,-1,80,-1,-1,-1,78,-1,76,-1]]},
         {bpm:75,drop:1,d:38,   // D minor ambient trap: a static Dm9 pad (D F A E), one long held note per bar, then the drop
          ch:[[50,0,3,7,14]],long:[62,64,69,65,69,57,69,65]}],
    hz=m=>440*Math.pow(2,(m-69)/12),bt=document.getElementById('mus');
  let SEC=0;try{const lc=localStorage.getItem('adama_mc'),ls=+localStorage.getItem('adama_ms')||0;SEC=lc===null?0:(lc===slug?ls:(ls+1)%PRG.length);localStorage.setItem('adama_mc',slug);localStorage.setItem('adama_ms',SEC)}catch(e){}
  const S=60/PRG[SEC].bpm/4;
  let ac,mg,pad,bell,nb,an,vb,db,timer=0,step=0,next=0,on=false,ex=null;
  const prog=()=>isExplore()?.5:getProgress();
  const lv=(p,a)=>Math.max(0,Math.min(1,(p-a)/.15)),vol=()=>isExplore()?0:1.1;
  const mk=()=>{ac=new(window.AudioContext||window.webkitAudioContext)();mg=ac.createGain();mg.gain.value=0;an=ac.createAnalyser();mg.connect(an);an.connect(ac.destination);
    const len=ac.sampleRate*4,ib=ac.createBuffer(2,len,ac.sampleRate);for(let c=0;c<2;c++){const d=ib.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2)}
    const verb=vb=ac.createConvolver();verb.buffer=ib;const vg=ac.createGain();vg.gain.value=.7;verb.connect(vg);vg.connect(mg);
    const dly=ac.createDelay(2);dly.delayTime.value=S*6;const fb=ac.createGain();fb.gain.value=.45;dly.connect(fb);fb.connect(dly);const dg=ac.createGain();dg.gain.value=.4;dly.connect(dg);dg.connect(mg);dg.connect(verb);
    db=ac.createBiquadFilter();db.type='lowpass';db.frequency.value=3500;db.Q.value=1.1;db.connect(mg);   // drum bus of the fourth piece: a low-pass that opens and closes
    pad=ac.createGain();pad.connect(mg);pad.connect(verb);bell=ac.createGain();bell.connect(mg);bell.connect(dly);bell.connect(verb);
    nb=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1};
  const tone=(t,f,dur,type,vol,cut,dest,att=.01)=>{const o=ac.createOscillator(),g=ac.createGain(),fl=ac.createBiquadFilter();o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=cut;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(fl);fl.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+.05)};
  // a held note: rises over `att`, stays, fades over `att` (notes that follow each other cross-fade)
  const sus=(t,f,dur,type,vol,cut,dest,att)=>{const o=ac.createOscillator(),g=ac.createGain(),fl=ac.createBiquadFilter();o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=cut;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+att);g.gain.setValueAtTime(vol,t+dur-att);g.gain.linearRampToValueAtTime(0,t+dur);o.connect(fl);fl.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+.05)};
  const swell=(t,dur,vol,dest)=>{const n=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();n.buffer=nb;n.loop=true;fl.type='bandpass';fl.frequency.value=2200;fl.Q.value=.6;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+dur*.6);g.gain.linearRampToValueAtTime(0,t+dur);n.connect(fl);fl.connect(g);g.connect(dest);n.start(t);n.stop(t+dur+.05)};
  // synthwave piece: pulsing bass, a clear lead, four-on-the-floor kick, snare with a short gated tail, hats; each enters at its own point of the story
  const kick=(t,v,dest=mg)=>{const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(42,t+.16);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.42);o.connect(g);g.connect(dest);o.start(t);o.stop(t+.45)};
  const noise=(t,v,dur,type,f,dest)=>{const n=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();n.buffer=nb;fl.type=type;fl.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);n.connect(fl);fl.connect(g);g.connect(dest);n.start(t);n.stop(t+dur+.02)};
  const beat=(P,i,t,p,r)=>{const j=i%16,bs=lv(p,.25),ld=lv(p,.2),ht=lv(p,.35),dr=lv(p,.5);
    if(bs>0&&i%2===0)tone(t,hz(r-24+(((i/2)%4===3)?12:0)),S*1.7,'sawtooth',.07*bs,700+900*p,mg,.004);
    if(ld>0&&i%2===0){const m=P.lead[Math.floor(i/32)%4][(i%32)/2];if(m>0){tone(t,hz(m),S*3.4,'sawtooth',.035*ld,2400,bell,.012);tone(t,hz(m)*1.004,S*3.4,'square',.014*ld,1800,bell,.012)}}
    if(dr>0){if(j%4===0)kick(t,.17*dr);if(j===4||j===12){noise(t,.075*dr,.2,'bandpass',1900,mg);noise(t,.05*dr,.34,'bandpass',1900,vb);tone(t,185,.09,'triangle',.05*dr,900,mg,.002)}}
    if(ht>0&&i%2===0)noise(t,(j%4===2?.03:.014)*ht,j%4===2?.12:.035,'highpass',7500,mg)};
  // the drop of the fourth piece (ambient trap, half time): hats in 16ths with a roll every second bar, snare on beat 3, kick on 1 and the "a" of 2,
  // and an 808 that glides down onto each note; it comes in from the last part of the story
  const sub=(t,m,len,v)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(hz(m+4),t);o.frequency.exponentialRampToValueAtTime(hz(m),t+.07);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+len);o.connect(g);g.connect(mg);o.start(t);o.stop(t+len+.05)};
  const dropBeat=(P,i,t,p,r,c)=>{const d=lv(p,.75);if(d<=0)return;const j=i%16,bar=Math.floor(i/16),acc=j%4===0?1.25:1;
    if(j===0)db.frequency.setTargetAtTime(1500+7500*(.5-.5*Math.cos(bar*Math.PI/4)),t,.25);   // filter sweep on the drums over 8 bars
    noise(t,(j%2===0?.055:.024)*d*acc,j%4===2?.05:.028,'bandpass',5200,db);   // hats live between 2 and 7 kHz in the original, not above
    if(bar%2===1&&j>=14)noise(t+S/2,.016*d,.025,'bandpass',5200,db);
    if(j===8){noise(t,.14*d,.22,'bandpass',1500,db);noise(t,.08*d,.42,'bandpass',1500,vb);tone(t,190,.1,'triangle',.07*d,1000,db,.002)}
    if(j===0||j===10)kick(t,.42*d,db);
    const k=[0,6,10,14].indexOf(j);if(k>=0){const m=[34,38,37,42,38,45,37,34][(bar*2+(k>1?1:0))%8];sub(t,m,[S*5.5,S*3,S*3.6,S*2][k],.34*d)}};
  const play=(i,t,p)=>{const P=PRG[SEC],NC=P.ch.length,c=P.ch[Math.floor(i/32)%NC],r=c[0],iv=c.slice(1);
    if(i%(NC*32)===0)[[0,'sine',.09],[7,'triangle',.035],[12,'sine',.03]].forEach(([x,ty,v])=>[-1,1].forEach(d=>sus(t,hz(P.d+x)*(1+d*.002),NC*32*S+6,ty,v*(P.drop?.5:1),500,pad,6)));
    if(i%32===0){const pd=lv(p,.05);if(pd>0)iv.concat(iv.map(x=>x+12)).forEach(x=>[-1,1].forEach(d=>sus(t,hz(r+x)*(1+d*.003),32*S+4,'triangle',.02*pd*(P.drop?1.3:1),P.drop?800+1500*p:500+900*p,pad,4)));
      const a=lv(p,.45);if(a>0)swell(t,32*S,.025*a,pad);
      const k=P.syn||P.drop?0:lv(p,.78);if(k>0){const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(38,t+.25);g.gain.setValueAtTime(.16*k,t);g.gain.exponentialRampToValueAtTime(.0001,t+.7);o.connect(g);g.connect(mg);o.start(t);o.stop(t+.75)}}
    if(P.syn)beat(P,i,t,p,r);
    if(P.drop)dropBeat(P,i,t,p,r,c);
    if(P.drop&&i%16===0){const ml=lv(p,.1),m=P.long[(i/16)%P.long.length];if(ml>0){sus(t,hz(m),16*S+1.6,'sine',.07*ml,2600,bell,1.2);sus(t,hz(m)*1.004,16*S+1.6,'triangle',.02*ml,1800,bell,1.2)}}
    if(!P.syn&&!P.drop&&i%8===0){const m=P.mel[(i/8)%16],ml=lv(p,.2);if(ml>0&&m>0){tone(t,hz(m),S*22,'sine',.06*ml,2600,bell,.3);const sh=lv(p,.5);if(sh>0)tone(t+S*2,hz(m+12),S*16,'sine',.02*sh,3500,bell,.3)}}};
  const tick=()=>{if(isExplore()!==ex){ex=isExplore();mg.gain.setTargetAtTime(vol(),ac.currentTime,ex?1.4:1.2)}const p=prog();while(next<ac.currentTime+.2){play(step,next,p);next+=S;step++}};
  const set=v=>{on=v;bt.classList.toggle('off',!v);bt.setAttribute('aria-pressed',v);bt.title=bt.ariaLabel=T('mus');
    if(v){if(!ac)mk();ac.resume();mg.gain.cancelScheduledValues(ac.currentTime);mg.gain.setTargetAtTime(vol(),ac.currentTime,1.2);ex=isExplore();if(!timer){step=0;next=ac.currentTime+.08;timer=setInterval(tick,40)}}
    else if(ac){mg.gain.setTargetAtTime(0,ac.currentTime,.3);setTimeout(()=>{if(!on){clearInterval(timer);timer=0;ac.suspend()}},1500)}};
  bt.onclick=e=>{e.stopPropagation();set(!on)};
  document.addEventListener('visibilitychange',()=>{if(ac&&on)document.hidden?ac.suspend():ac.resume()});
  window.__music=Object.assign(set,{peak:()=>{const d=new Float32Array(an.fftSize);an.getFloatTimeDomainData(d);return Math.max(...d.map(Math.abs))},state:()=>ac&&ac.state+' '+step+' sec='+SEC});
  bt.title=bt.ariaLabel=T('mus')}
