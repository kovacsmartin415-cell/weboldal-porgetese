// Élő képkockaszám-mérő: requestAnimationFrame időbélyegekből, az utolsó 60 kocka.
// Csak akkor fut, ha a szekció látszik (visibleLoop); mozgáscsökkentésnél áll,
// és csak gombnyomásra mér egyszer 2 másodpercig.
import { visibleLoop } from '../../lib/loop';
import { dprCap, reducedMotion } from '../../lib/env';

const KEN = '#D9B21F';
const ZUZMO = '#8C9878';
const RACS = 'rgba(236, 234, 227, 0.12)';
const N = 60;

export interface FpsMeter { destroy(): void; }

export function createFps(canvas: HTMLCanvasElement, out: HTMLElement, note: HTMLElement, trigger: HTMLButtonElement | null): FpsMeter {
  const ctx = canvas.getContext('2d');
  const frames: number[] = []; // képkocka-idők ms-ban
  let prev = 0, lastText = 0, peak = 60;
  let w = 0, h = 0, dpr = 1;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = dprCap();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    draw();
  };

  const fpsNow = (): number => {
    if (frames.length < 2) return 0;
    const sum = frames.reduce((a, b) => a + b, 0);
    return (frames.length * 1000) / sum;
  };

  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ymax = peak > 95 ? 130 : 70;
    const padL = 34, padR = 6, padT = 8, padB = 8;
    const gw = w - padL - padR, gh = h - padT - padB;
    const y = (f: number) => padT + gh * (1 - Math.min(f, ymax) / ymax);

    // rács: 0 / 30 / 60 (/120) kép/s
    ctx.font = '11px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const levels = ymax > 100 ? [0, 30, 60, 120] : [0, 30, 60];
    for (const lv of levels) {
      const yy = Math.round(y(lv)) + 0.5;
      ctx.strokeStyle = RACS;
      ctx.lineWidth = 1;
      ctx.setLineDash(lv === 0 ? [] : [2, 4]);
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
      ctx.fillStyle = ZUZMO;
      ctx.fillText(String(lv), padL - 8, yy);
    }
    ctx.setLineDash([]);
    // függőleges osztások (10 kockánként)
    ctx.strokeStyle = RACS;
    for (let i = 0; i <= N; i += 10) {
      const xx = Math.round(padL + (gw * i) / N) + 0.5;
      ctx.beginPath(); ctx.moveTo(xx, h - padB - 4); ctx.lineTo(xx, h - padB); ctx.stroke();
    }

    if (frames.length < 2) return;
    const step = gw / (N - 1);
    const x0 = padL + gw - step * (frames.length - 1);
    ctx.beginPath();
    frames.forEach((ms, i) => {
      const xx = x0 + step * i, yy = y(1000 / ms);
      if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
    });
    ctx.strokeStyle = KEN;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // a legfrissebb pont
    const lx = x0 + step * (frames.length - 1), ly = y(1000 / frames[frames.length - 1]);
    ctx.fillStyle = KEN;
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
  }

  const push = (tMs: number) => {
    if (prev) {
      const d = tMs - prev;
      if (d > 250) frames.length = 0; // szünet után (pl. rejtett fül) ne hamis zuhanást mutasson
      else if (d > 0) {
        frames.push(d);
        if (frames.length > N) frames.shift();
        peak = Math.max(peak * 0.995, 1000 / d);
      }
    }
    prev = tMs;
  };

  const text = (force = false) => {
    const now = performance.now();
    if (!force && now - lastText < 250) return;
    lastText = now;
    const f = fpsNow();
    out.textContent = f ? String(Math.round(f)) : '—';
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let loop: ReturnType<typeof visibleLoop> | null = null;
  let manualRaf = 0;
  const reduced = reducedMotion();

  if (!reduced) {
    note.textContent = 'Élő mérés. Csak akkor fut, amikor ez a rész látszik a képernyőn.';
    loop = visibleLoop(canvas, (t, dt) => {
      if (dt === 0) { draw(); return; }
      push(t * 1000);
      draw();
      text();
    }, { rootMargin: '0px' });
    loop.start();
  } else {
    note.textContent = 'Mozgáscsökkentés van beállítva, ezért a mérő magától nem fut. Gombnyomásra 2 másodpercig mér, utána megáll.';
    out.textContent = '—';
  }

  if (trigger) {
    trigger.hidden = !reduced;
    trigger.addEventListener('click', () => {
      cancelAnimationFrame(manualRaf);
      frames.length = 0; prev = 0;
      const start = performance.now();
      trigger.disabled = true;
      out.textContent = '…';
      const tick = (t: number) => {
        push(t);
        if (t - start < 2000) { manualRaf = requestAnimationFrame(tick); return; }
        draw(); text(true);
        trigger.disabled = false;
        trigger.focus();
      };
      manualRaf = requestAnimationFrame(tick);
    });
  }

  return {
    destroy() { loop?.destroy(); ro.disconnect(); cancelAnimationFrame(manualRaf); },
  };
}
