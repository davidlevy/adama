// Loading screen: the name and a thin progress bar. It creeps while the data loads; app.ts moves it forward (window.__ldp) and fades the screen out.
const ld = document.getElementById('ld');
if (ld) {
  ld.innerHTML =
    '<div class="ldw"><span>Adama</span><i class="ldb" role="progressbar" aria-label="Loading"><b></b></i></div>';
  const bar = ld.querySelector('b') as HTMLElement;
  let progress = 0;
  const set = (v: number) => {
    progress = Math.max(progress, Math.min(1, v));
    bar.style.transform = `scaleX(${progress})`;
  };
  window.__ldp = set;
  const t0 = performance.now();
  const tick = () => {
    if (!ld.isConnected) return;
    set(0.85 * (1 - Math.exp(-(performance.now() - t0) / 1500)));
    setTimeout(tick, 120);
  };
  tick();
}
