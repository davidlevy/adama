// The page calls langBus.emit() when the language changes; the Preact components subscribe to re-render with the new texts.
type Listener = () => void;
const listeners = new Set<Listener>();

export const langBus = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  emit(): void {
    listeners.forEach(fn => fn());
  },
};
