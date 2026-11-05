// Közös környezeti jelzők és segédek. Minden modul ezt használja.
export const reducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isCoarse = (): boolean => window.matchMedia('(pointer: coarse)').matches;

/** DPR-plafon: telefonon 1.5, asztalin 2. */
export const dprCap = (): number => Math.min(window.devicePixelRatio || 1, isCoarse() ? 1.5 : 2);

export function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/** Egyszerű, megosztott egér-/érintésállapot (CSS-pixelben, viewporthoz). */
export const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, down: false, t: 0 };
let lastX = 0, lastY = 0, lastT = performance.now();
window.addEventListener('pointermove', (e) => {
  const now = performance.now();
  const dt = Math.max(1, now - lastT);
  pointer.vx = (e.clientX - lastX) / dt;
  pointer.vy = (e.clientY - lastY) / dt;
  pointer.x = lastX = e.clientX;
  pointer.y = lastY = e.clientY;
  pointer.t = lastT = now;
}, { passive: true });
window.addEventListener('pointerdown', () => { pointer.down = true; }, { passive: true });
window.addEventListener('pointerup', () => { pointer.down = false; }, { passive: true });

/** Görgetés-állapot: pozíció és simított sebesség (px/ms). */
export const scroll = { y: 0, v: 0 };
let sy = window.scrollY, st = performance.now();
window.addEventListener('scroll', () => {
  const now = performance.now();
  const dt = Math.max(1, now - st);
  const v = (window.scrollY - sy) / dt;
  scroll.v = scroll.v * 0.7 + v * 0.3;
  scroll.y = sy = window.scrollY;
  st = now;
}, { passive: true });
