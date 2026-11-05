// „Hogyan épül egy oldal”: görgetéshez kötött 3D telefon, amin felépül egy (kitalált) pékség oldala.
// WebGL2 nélkül ugyanaz a 2D kijelző egy CSS-sel rajzolt telefonkeretben jelenik meg.
import '../styles/modules/phone-build.css';
import { reducedMotion, isCoarse, dprCap, hasWebGL2, pointer } from '../lib/env';
import { visibleLoop } from '../lib/loop';
import { Screen, scrollTarget } from './phone-build/screen';
import type { PhoneScene, Pose } from './phone-build/scene';

// Lépésenkénti szög (rx: billentés, ry: fordulás, rz: dőlés)
const POSES = [
  { rx: 0.08, ry: 0.42, rz: -0.05 },
  { rx: -0.05, ry: -0.36, rz: 0.06 },
  { rx: 0.14, ry: 0.26, rz: -0.03 },
  { rx: 0.03, ry: -0.1, rz: 0.015 },
];
// Mozgáscsökkentésnél ezt az állapotot mutatja a kijelző lépésenként
const STILL_S = [0.95, 1.95, 2.55, 3.97];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function poseAt(s: number) {
  const u = Math.min(2.9999, Math.max(0, s - 0.5));
  const i = Math.floor(u), f = smooth(u - i);
  const a = POSES[i], b = POSES[i + 1];
  return { rx: lerp(a.rx, b.rx, f), ry: lerp(a.ry, b.ry, f), rz: lerp(a.rz, b.rz, f) };
}

export async function init(el: HTMLElement): Promise<void> {
  const ragad = el.querySelector<HTMLElement>('.telefon__ragad');
  const canvas = el.querySelector<HTMLCanvasElement>('.telefon__vaszon');
  const list = el.querySelector<HTMLElement>('.lepesek');
  const steps = [...el.querySelectorAll<HTMLElement>('.lepes')];
  if (!ragad || !canvas || !list || steps.length !== 4) return;

  const coarse = isCoarse();
  const screen = new Screen();
  screen.setScale(coarse ? 1.5 : 2);

  // Lépésjelző (telefonos nézethez)
  const jelzo = document.createElement('div');
  jelzo.className = 'pb-jelzo';
  jelzo.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i++) jelzo.appendChild(document.createElement('span'));
  ragad.appendChild(jelzo);
  const dots = [...jelzo.children] as HTMLElement[];

  // --- 3D vagy tartalék ---
  let gl: PhoneScene | null = null;
  if (hasWebGL2()) {
    try {
      const { PhoneScene } = await import('./phone-build/scene');
      gl = new PhoneScene(canvas, screen.canvas, { coarse, dpr: dprCap() });
    } catch (err) {
      console.warn('[phone-build] WebGL nem indult, 2D tartalék', err);
      gl = null;
    }
  }

  let fallback: HTMLElement | null = null;
  const showFallback = (on: boolean) => {
    if (on && !fallback) {
      fallback = document.createElement('div');
      fallback.className = 'pb-tartalek';
      fallback.setAttribute('aria-hidden', 'true');
      const kij = document.createElement('div');
      kij.className = 'pb-tartalek__kijelzo';
      screen.canvas.classList.add('pb-tartalek__vaszon');
      kij.appendChild(screen.canvas);
      fallback.appendChild(kij);
      ragad.insertBefore(fallback, canvas.nextSibling);
    }
    el.classList.toggle('pb-2d', on);
  };
  if (!gl) showFallback(true);

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    showFallback(true);
    loop.renderOnce();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    gl?.restore();
    showFallback(false);
    dirtyKey = '';
    loop.renderOnce();
  });

  // --- Görgetési állapot ---
  let sTarget = 0, intro = 0, step = -1;
  let sCur = 0, scrollCur = 0, mx = 0, my = 0, first = true;
  const desktop = window.matchMedia('(min-width: 900px)');

  const measure = () => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = Math.max(1, r.height - vh);
    sTarget = clamp01(-r.top / total) * 4;
    intro = clamp01(1 - r.top / vh);
  };

  const listLayout = (u: number) => {
    if (!desktop.matches) { list.style.removeProperty('--pb-y'); return; }
    const i = Math.min(2, Math.floor(u)), f = u - i;
    const top = lerp(steps[i].offsetTop, steps[Math.min(3, i + 1)].offsetTop, f);
    const anchor = list.clientHeight * 0.16;
    list.style.setProperty('--pb-y', `${(anchor - top).toFixed(1)}px`);
  };

  const setStep = (n: number) => {
    if (n === step) return false;
    step = n;
    steps.forEach((li, i) => { if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    dots.forEach((d, i) => d.classList.toggle('on', i <= n));
    return true;
  };

  const onScroll = () => {
    measure();
    const n = Math.min(3, Math.floor(sTarget));
    const changed = setStep(n);
    if (reducedMotion()) {
      listLayout(n);
      if (changed) loop.renderOnce();
    } else {
      listLayout(Math.min(3, Math.max(0, sTarget - 0.5)));
    }
  };

  // --- Rajzolás ---
  let dirtyKey = '';
  const frame = (t: number, dt: number) => {
    measure();
    let s: number, sc: number, spin: number;
    if (reducedMotion()) {
      const n = Math.min(3, Math.floor(sTarget));
      s = STILL_S[n];
      sc = scrollTarget(s);
      spin = 0;
      mx = my = 0;
    } else {
      const k = first || dt === 0 ? 1 : 1 - Math.exp(-dt * 9);
      sCur += (sTarget - sCur) * k;
      s = sCur;
      const st = scrollTarget(s);
      scrollCur += (st - scrollCur) * (first || dt === 0 ? 1 : 1 - Math.exp(-dt * 7));
      sc = scrollCur;
      spin = 1 - smooth(intro);
      const tx = pointer.x > -9000 ? (pointer.x / window.innerWidth - 0.5) * 2 : 0;
      const ty = pointer.y > -9000 ? (pointer.y / window.innerHeight - 0.5) * 2 : 0;
      const pk = dt === 0 ? 1 : 1 - Math.exp(-dt * 3);
      mx += (tx - mx) * pk; my += (ty - my) * pk;
      first = false;
    }

    // kijelző: csak ha változott valami
    const live = !reducedMotion() && (s < 0.95 || (s > 3.1 && s < 3.65));
    const key = `${s.toFixed(4)}|${sc.toFixed(1)}|${live ? Math.floor(t * 30) : ''}`;
    if (key !== dirtyKey) {
      dirtyKey = key;
      screen.draw({ s, time: t, scroll: sc, still: reducedMotion() });
      if (gl) gl.texture.needsUpdate = true;
    }

    const base = reducedMotion() ? POSES[Math.min(3, Math.floor(sTarget))] : poseAt(s);
    const bob = reducedMotion() ? 0 : Math.sin(t * 0.9) * 0.045;
    const pose: Pose = {
      rx: base.rx + my * 0.07 + spin * 0.25,
      ry: base.ry + mx * 0.14 + spin * Math.PI * 0.92,
      rz: base.rz + (reducedMotion() ? 0 : Math.sin(t * 0.6) * 0.012),
      y: 0.06 + bob - spin * 0.25,
    };
    if (gl && !lost) gl.render(pose);
    if (fallback && el.classList.contains('pb-2d')) {
      fallback.style.setProperty('--pb-ry', `${(pose.ry * 22).toFixed(2)}deg`);
      fallback.style.setProperty('--pb-rx', `${(-pose.rx * 18).toFixed(2)}deg`);
    }
  };

  const loop = visibleLoop(el, frame);

  // Méretezés
  const ro = new ResizeObserver(() => {
    if (gl) gl.setSize(canvas.clientWidth, canvas.clientHeight);
    onScroll();
    dirtyKey = '';
    loop.renderOnce();
  });
  ro.observe(canvas);
  ro.observe(list);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  desktop.addEventListener('change', onScroll);

  // Betűk: a canvas csak betöltött betűvel rajzol szépen
  const fonts = [
    '700 20px "Bricolage Grotesque Variable"',
    '400 14px "IBM Plex Sans"', '500 14px "IBM Plex Sans"', '600 14px "IBM Plex Sans"',
    '500 12px "JetBrains Mono Variable"',
  ];
  Promise.all(fonts.map((f) => document.fonts.load(f, 'Kovászos őű'))).catch(() => undefined).then(() => {
    screen.invalidateArt();
    dirtyKey = '';
    loop.renderOnce();
  });

  onScroll();
  loop.start();
  loop.renderOnce();
}
