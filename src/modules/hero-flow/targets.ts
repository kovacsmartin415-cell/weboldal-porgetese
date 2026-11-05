// A FOLYAM szó elhelyezése és célpontjainak mintavételezése egy offscreen 2D vásznon.

export const WORD = 'FOLYAM';
export const FONT_FAMILY = '"Bricolage Grotesque Variable"';
const WEIGHT = 800;

export interface Box { x: number; y: number; w: number; h: number; }
export interface Placement extends Box { fs: number; }

/** A szövegblokk sorainak tényleges dobozai (szekcióhoz viszonyítva, CSS px). */
export function textObstacles(section: HTMLElement): Box[] {
  const sr = section.getBoundingClientRect();
  const out: Box[] = [];
  const push = (r: DOMRect) => { if (r.width > 1 && r.height > 1) out.push({ x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height }); };
  const wrap = section.querySelector('.nyito__szoveg');
  if (!wrap) return out;
  for (const child of Array.from(wrap.children)) {
    if (child.matches('h1, p')) {
      const range = document.createRange();
      range.selectNodeContents(child);
      for (const r of Array.from(range.getClientRects())) push(r);
    } else {
      for (const c of Array.from(child.children)) push(c.getBoundingClientRect());
    }
  }
  return out;
}

function makeCtx(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context');
  return ctx;
}

function setFont(ctx: CanvasRenderingContext2D, fs: number): void {
  ctx.font = `${WEIGHT} ${fs}px ${FONT_FAMILY}`;
  // Keskenyített változat (wdth 75): ugyanakkora helyre nagyobb betű fér.
  try { (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = 'condensed'; } catch { /* régi böngésző */ }
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(-0.01 * fs).toFixed(1)}px`; } catch { /* */ }
}

interface Metrics { w: number; h: number; left: number; ascent: number; }
function measure(fs: number): Metrics {
  const ctx = makeCtx(4, 4);
  setFont(ctx, fs);
  const m = ctx.measureText(WORD);
  const left = m.actualBoundingBoxLeft;
  return { w: left + m.actualBoundingBoxRight, h: m.actualBoundingBoxAscent + Math.max(0, m.actualBoundingBoxDescent), left, ascent: m.actualBoundingBoxAscent };
}

const hit = (a: Box, b: Box, m: number) =>
  a.x < b.x + b.w + m && a.x + a.w > b.x - m && a.y < b.y + b.h + m && a.y + a.h > b.y - m;

/**
 * A legnagyobb betűméret, amivel a szó a szöveget nem takarva elfér: asztalin jobbra igazítva
 * a felső/jobb térrészben, telefonon a szöveg fölötti sávban középre.
 */
export function place(W: number, H: number, obstacles: Box[], topPad: number, gutter: number): Placement {
  const narrow = W < 700;
  const base = measure(100);
  const maxW = narrow ? W - 2 * gutter : Math.min(W - 2 * gutter, W * 0.62);
  let fs = Math.min(maxW / base.w * 100, (H * 0.42) / base.h * 100, 420);
  const margin = narrow ? 14 : 22;
  for (; fs > 24; fs -= 2) {
    const w = base.w * fs / 100, h = base.h * fs / 100;
    const x = narrow ? (W - w) / 2 : W - gutter - w;
    for (let y = topPad; y + h < H * 0.8; y += 4) {
      const b = { x, y, w, h };
      if (!obstacles.some((o) => hit(b, o, margin))) return { x, y, w, h, fs };
    }
  }
  const w = base.w * 0.6, h = base.h * 0.6;
  return { x: W - gutter - w, y: topPad, w, h, fs: 60 };
}

export interface Samples { pts: Float32Array; edge: Float32Array; count: number; }

/** A szó kitöltött pixeleiből `n` pontot vesz (CSS px, szekcióhoz viszonyítva), peremtávolsággal. */
export function sampleWord(p: Placement, n: number): Samples {
  const scale = Math.min(2, 1400 / Math.max(1, p.w));
  const pad = 4;
  const cw = p.w * scale + pad * 2, ch = p.h * scale + pad * 2;
  const ctx = makeCtx(cw, ch);
  const fs = p.fs * scale;
  setFont(ctx, fs);
  const m = ctx.measureText(WORD);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(WORD, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const img = ctx.getImageData(0, 0, W, H).data;

  // Belső távolság a legközelebbi üres pixelig (kétmenetes chamfer-transzformáció).
  const BIG = 1e6;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = img[i * 4 + 3] > 127 ? BIG : 0;
  const D1 = 1, D2 = 1.4142;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (d[i] === 0) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + D1); else v = Math.min(v, D1);
    if (y > 0) { v = Math.min(v, d[i - W] + D1); if (x > 0) v = Math.min(v, d[i - W - 1] + D2); if (x < W - 1) v = Math.min(v, d[i - W + 1] + D2); } else v = Math.min(v, D1);
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (d[i] === 0) continue;
    let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + D1); else v = Math.min(v, D1);
    if (y < H - 1) { v = Math.min(v, d[i + W] + D1); if (x < W - 1) v = Math.min(v, d[i + W + 1] + D2); if (x > 0) v = Math.min(v, d[i + W - 1] + D2); } else v = Math.min(v, D1);
    d[i] = v;
  }
  const filled: number[] = [];
  for (let i = 0; i < W * H; i++) if (d[i] > 0) filled.push(i);
  const pts = new Float32Array(n * 2);
  const edge = new Float32Array(n);
  if (!filled.length) return { pts, edge, count: 0 };
  const band = Math.max(2, fs * 0.05);
  let k = 0, guard = 0;
  while (k < n && guard < n * 20) {
    guard++;
    const i = filled[(Math.random() * filled.length) | 0];
    const e = 1 - Math.min(1, (d[i] - 1) / band);
    // A peremre valamivel több pont jut: élesebb körvonal.
    if (Math.random() > 0.6 + 0.4 * e) continue;
    const x = (i % W) + Math.random(), y = ((i / W) | 0) + Math.random();
    pts[k * 2] = p.x + (x - pad) / scale;
    pts[k * 2 + 1] = p.y + (y - pad) / scale;
    edge[k] = e;
    k++;
  }
  return { pts, edge, count: k };
}
