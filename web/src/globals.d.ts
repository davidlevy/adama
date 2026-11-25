// Things the page puts on `window` and the files esbuild turns into modules.
interface Window {
  __ldp?: (progress: number) => void;                       // moves the loading bar (loader.ts), called by app.ts
  __music?: ((on: boolean) => void) & {peak: () => number; state: () => string | undefined};   // debug hook of music.ts
  __lh?: () => void;
}
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
