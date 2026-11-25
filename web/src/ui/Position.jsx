// "My location | Address" control of the explore bar, as a Preact component.
// States: nothing / busy (locating, searching) / on (the marker is on the map) + a field to type an address. A click on the active segment clears it.
// The scene (app.js) gives the component a small api; the component never touches Three.js:
//   T(key)               translated string          subscribe(fn) -> unsubscribe   called when the language changes
//   place(lat, lon)      -> {ok:true} | {ok:false, km}    moves the camera to the point and shows the marker
//   clear()              hides the marker          find(text) -> Promise<[{lat, lon}]>   address search (OpenStreetMap)
import {render} from 'preact';
import {useState, useEffect, useRef} from 'preact/hooks';

function Position({api}) {
  const [mode, setMode] = useState('');      // '' | 'gps' | 'addr'
  const [st, setSt] = useState('');          // '' | 'busy' | 'on'
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [, setTick] = useState(0);
  const input = useRef(null);
  const T = api.T;

  useEffect(() => api.subscribe(() => setTick(n => n + 1)), []);                               // re-render on language change
  useEffect(() => { if (typing && input.current) input.current.focus(); }, [typing]);
  useEffect(() => { const m = document.getElementById('gm'); if (m) m.textContent = msg; }, [msg]);   // the message slot sits at the end of the bar

  const reset = (m = '') => { setMode(''); setSt(''); setMsg(m); };
  const placeAt = (lat, lon, acc, how) => {
    const r = api.place(lat, lon);
    if (r.ok) { setMode(how); setSt('on'); setMsg(acc ? T('ok').replace('{a}', Math.round(acc)) : ''); }
    else reset(T('outside').replace('{d}', r.km));
  };
  const openAddr = why => { setMsg(why || ''); setTyping(true); };
  const clear = () => { api.clear(); reset(); };

  const onGps = () => {
    setTyping(false);
    if (mode === 'gps') { clear(); return; }
    if (!navigator.geolocation) { openAddr(T('nogeo')); return; }
    setMode('gps'); setSt('busy'); setMsg(T('loc'));
    navigator.geolocation.getCurrentPosition(
      p => placeAt(p.coords.latitude, p.coords.longitude, p.coords.accuracy, 'gps'),
      e => { setMode(''); setSt(''); openAddr(e.code === 1 ? T('deny') : T('nf')); },
      {enableHighAccuracy: true, timeout: 15000});
  };
  const onAddr = () => { if (mode === 'addr') clear(); openAddr(''); };
  const submit = async () => {
    const q = text.trim(); if (!q) return;
    setMsg(T('loc')); setMode('addr'); setSt('busy');
    const found = await api.find(q);
    if (found.length) { setTyping(false); setText(''); placeAt(+found[0].lat, +found[0].lon, 0, 'addr'); }
    else reset(T('adrnf'));
  };
  const onKey = e => {
    if (e.key === 'Escape') { setTyping(false); setMsg(''); }
    else if (e.key === 'Enter') submit();
  };
  const onBlur = () => { if (!text.trim()) setTimeout(() => { if (document.activeElement !== input.current) setTyping(false); }, 120); };

  return (
    <span class={'seg' + (typing ? ' typing' : '')} id="gp" role="group" data-mode={mode} data-st={st}>
      <button id="gpm" onClick={onGps}>{T('mypos')}</button>
      {typing
        ? <input ref={input} class="adr" type="text" autocomplete="off" spellcheck={false} value={text} placeholder={T('addr')} aria-label={T('addr')}
            onInput={e => setText(e.currentTarget.value)} onKeyDown={onKey} onBlur={onBlur} />
        : <button id="gpa" onClick={onAddr}>{T('addrb')}</button>}
    </span>
  );
}

export const mountPosition = (root, api) => render(<Position api={api} />, root);
