// Látható-e alapú renderhurok: csak akkor fut, ha az elem a képernyőn van
// és a fül látható. Mozgáscsökkentésnél egyetlen képkockát rajzol.
import { reducedMotion } from './env';

export interface Loop { start(): void; stop(): void; destroy(): void; renderOnce(): void; }

export function visibleLoop(el: Element, frame: (t: number, dt: number) => void, opts: { rootMargin?: string } = {}): Loop {
  let raf = 0, running = false, onScreen = false, last = 0, destroyed = false;
  const tick = (t: number) => {
    if (!running) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
    last = t;
    frame(t / 1000, dt);
    raf = requestAnimationFrame(tick);
  };
  const want = () => onScreen && !document.hidden && !destroyed && !reducedMotion();
  const sync = () => {
    if (want() && !running) { running = true; last = 0; raf = requestAnimationFrame(tick); }
    else if (!want() && running) { running = false; cancelAnimationFrame(raf); }
  };
  const io = new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; sync(); }, { rootMargin: opts.rootMargin ?? '100px' });
  io.observe(el);
  const vis = () => sync();
  document.addEventListener('visibilitychange', vis);
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqc = () => { sync(); if (reducedMotion()) loop.renderOnce(); };
  mq.addEventListener('change', mqc);
  const loop: Loop = {
    start: () => sync(),
    stop: () => { running = false; cancelAnimationFrame(raf); },
    renderOnce: () => frame(performance.now() / 1000, 0),
    destroy: () => { destroyed = true; running = false; cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener('visibilitychange', vis); mq.removeEventListener('change', mqc); },
  };
  if (reducedMotion()) requestAnimationFrame(() => loop.renderOnce());
  return loop;
}
