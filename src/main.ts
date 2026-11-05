// Belépési pont. A nehéz modulok (Three.js) csak akkor töltődnek, amikor a szekciójuk közel ér.
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-500.css';
import '@fontsource/ibm-plex-sans/latin-ext-600.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/base.css';
import { scroll, reducedMotion } from './lib/env';

document.body.classList.remove('is-loading');

// --- Mai dátum magyarul ---
for (const el of document.querySelectorAll<HTMLTimeElement>('time[data-today]')) {
  const d = new Date();
  el.dateTime = d.toISOString().slice(0, 10);
  el.textContent = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Atlantic/Azores' }).format(d);
}

// --- Két óra: Azori-szigetek és Budapest ---
const clocks = [...document.querySelectorAll<HTMLTimeElement>('time[data-tz]')];
const tick = () => {
  const now = new Date();
  for (const c of clocks) {
    const tz = c.dataset.tz!;
    c.textContent = new Intl.DateTimeFormat('hu-HU', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(now);
  }
};
tick();
setInterval(tick, 15_000);

// --- Görgetési sebességre reagáló címszélesség (változó betű wdth tengely) ---
if (!reducedMotion()) {
  const root = document.documentElement;
  let cur = 100;
  const step = () => {
    const target = 100 - Math.min(25, Math.abs(scroll.v) * 9);
    cur += (target - cur) * 0.12;
    root.style.setProperty('--flex-wdth', cur.toFixed(1));
    scroll.v *= 0.92;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// --- Modulok lusta betöltése ---
type Loader = () => Promise<{ init: (el: HTMLElement) => void | Promise<void> }>;
const modules: Record<string, Loader> = {
  hero: () => import('./modules/hero-flow'),
  phone: () => import('./modules/phone-build'),
  configurator: () => import('./modules/configurator'),
  perf: () => import('./modules/perf-meter'),
  contact: () => import('./modules/contact'),
  lake: () => import('./modules/lake'),
};

const started = new WeakSet<Element>();
const boot = async (el: HTMLElement) => {
  if (started.has(el)) return;
  started.add(el);
  const name = el.dataset.module!;
  const load = modules[name];
  if (!load) return;
  try {
    const mod = await load();
    await mod.init(el);
    el.classList.add('modul-kesz');
  } catch (err) {
    // Egy modul hibája ne vigye el az oldalt: a statikus tartalom ott marad.
    console.error(`[folyam] a(z) ${name} modul nem indult`, err);
    el.classList.add('modul-hiba');
  }
};

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); boot(e.target as HTMLElement); }
}, { rootMargin: '600px 0px' });

const all = [...document.querySelectorAll<HTMLElement>('[data-module]')];
for (const el of all) {
  if (el.dataset.module === 'hero') boot(el); else io.observe(el);
}

// A betöltés után üresjáratban minden modult elindítunk (a renderhurkok képernyőn kívül úgyis állnak).
// Így a modulok végső magassága már akkor kész, mielőtt a látogató odagörget vagy horgonyra ugrik:
// nincs elrendezés-ugrás (CLS).
const idle = (fn: () => void) =>
  'requestIdleCallback' in window ? (window as any).requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 1200);
const bootRest = () => {
  const rest = all.filter((el) => !started.has(el));
  let i = 0;
  const next = () => { if (i < rest.length) { boot(rest[i++]); idle(next); } };
  idle(next);
};
if (document.readyState === 'complete') bootRest(); else window.addEventListener('load', bootRest, { once: true });
