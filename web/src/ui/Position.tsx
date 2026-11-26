// "My location | Address" control of the explore bar, as a Preact component.
// States: nothing / busy (locating, searching) / on (the marker is on the map) + a field to type an address. A click on the active segment clears it.
// The scene (app.ts) gives the component a small api; the component never touches Three.js:
//   (the texts come from the store: useT() in ui/store.ts)
//   place(lat, lon)      -> {ok:true} | {ok:false, km}    moves the camera to the point and shows the marker
//   clear()              hides the marker          find(text) -> Promise<[{lat, lon}]>   address search (OpenStreetMap)
import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import css from './Position.module.css';
import { useT } from './store';

/** What the scene gives the component (see the comment above). */
export interface PositionApi {
  place(lat: number, lon: number): { ok: true } | { ok: false; km: string };
  clear(): void;
  find(text: string): Promise<{ lat: number | string; lon: number | string }[]>;
}
type Mode = '' | 'gps' | 'addr';
type Status = '' | 'busy' | 'on';

function Position({ api }: { api: PositionApi }) {
  const [mode, setMode] = useState<Mode>('');
  const [st, setSt] = useState<Status>('');
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const req = useRef(0); // id of the latest request: a GPS fix or an address answer that arrives after a clear or a newer request is ignored
  const T = useT();

  useEffect(() => {
    if (typing && input.current) input.current.focus();
  }, [typing]);
  useEffect(() => {
    // a shared link held a point: the scene has drawn the marker, show it in the bar too
    const onRestored = () => {
      setMode('addr');
      setSt('on');
      setMsg(T('sharedpt'));
    };
    addEventListener('adama:pos-restored', onRestored);
    return () => removeEventListener('adama:pos-restored', onRestored);
  }, [T]);
  useEffect(() => {
    const m = document.getElementById('gm');
    if (m) m.textContent = msg;
  }, [msg]); // the message slot sits at the end of the bar

  const reset = (m = '') => {
    setMode('');
    setSt('');
    setMsg(m);
  };
  const placeAt = (lat: number, lon: number, acc: number, how: Mode) => {
    const r = api.place(lat, lon);
    if (r.ok) {
      setMode(how);
      setSt('on');
      setMsg(acc ? T('ok').replace('{a}', String(Math.round(acc))) : '');
    } else reset(T('outside').replace('{d}', r.km));
  };
  const openAddr = (why?: string) => {
    setMsg(why || '');
    setTyping(true);
  };
  const clear = () => {
    req.current++;
    api.clear();
    reset();
  };

  const onGps = () => {
    setTyping(false);
    if (mode === 'gps') {
      clear();
      return;
    }
    if (!navigator.geolocation) {
      openAddr(T('nogeo'));
      return;
    }
    const id = ++req.current;
    setMode('gps');
    setSt('busy');
    setMsg(T('loc'));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (id === req.current) placeAt(p.coords.latitude, p.coords.longitude, p.coords.accuracy, 'gps');
      },
      (e) => {
        if (id === req.current) {
          setMode('');
          setSt('');
          openAddr(e.code === 1 ? T('deny') : T('nf'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  const onAddr = () => {
    if (mode === 'addr') clear();
    openAddr('');
  };
  const submit = async () => {
    const q = text.trim();
    if (!q) return;
    const id = ++req.current;
    setMsg(T('loc'));
    setMode('addr');
    setSt('busy');
    const found = await api.find(q);
    if (id !== req.current) return;
    if (found.length) {
      setTyping(false);
      setText('');
      placeAt(+found[0].lat, +found[0].lon, 0, 'addr');
    } else reset(T('adrnf'));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTyping(false);
      setMsg('');
    } else if (e.key === 'Enter') submit();
  };
  const onBlur = () => {
    if (!text.trim())
      setTimeout(() => {
        if (document.activeElement !== input.current) setTyping(false);
      }, 120);
  };

  return (
    <span class={css.seg} id="gp" role="group" data-mode={mode} data-st={st}>
      <button id="gpm" onClick={onGps}>
        {T('mypos')}
      </button>
      {typing ? (
        <input
          ref={input}
          class={css.adr}
          type="text"
          autocomplete="off"
          spellcheck={false}
          value={text}
          placeholder={T('addr')}
          aria-label={T('addr')}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={onKey}
          onBlur={onBlur}
        />
      ) : (
        <button id="gpa" onClick={onAddr}>
          {T('addrb')}
        </button>
      )}
    </span>
  );
}

export const mountPosition = (root: HTMLElement, api: PositionApi) => render(<Position api={api} />, root);
