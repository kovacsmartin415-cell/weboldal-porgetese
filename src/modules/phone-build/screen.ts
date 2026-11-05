// A telefon kijelzője: egy kitalált pékség mobiloldala, 2D canvasra rajzolva.
// Ugyanez a kód rajzol a WebGL-textúrára és a CSS-es tartalék-telefonba.
// Bemenet: s ∈ [0, 4] folyamatos haladás (0 beszélgetés, 1 terv, 2 építés, 3 a tiéd).

const GOZ = '#ECEAE3';
const BAZ = '#151819';
const KEN = '#D9B21F';
const ZUZ = '#8C9878';
const KAL = '#18302E';
const HAMU = '#5E615D';

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const mix = (a: string, b: string, t: number): string => {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

const F_CIM = '"Bricolage Grotesque Variable", "Arial Narrow", sans-serif';
const F_TORZS = '"IBM Plex Sans", system-ui, sans-serif';
const F_ADAT = '"JetBrains Mono Variable", ui-monospace, monospace';

export const LW = 360;
export const SCREEN_ASPECT = 1.39 / 2.99; // szélesség / magasság, a 3D kijelzővel egyezik
export const LH = Math.round(LW / SCREEN_ASPECT);
const BAR = 40; // állapotsor
const VIEW_H = LH - BAR;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type C = CanvasRenderingContext2D;

function rr(ctx: C, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function font(ctx: C, f: string) { ctx.font = f; }

// ---------- Oldal-elrendezés (oldal-koordináta, a görgetett tartalomban) ----------
const PAD = 20;
const L = {
  nav: 0, navH: 56,
  hero: 56, heroH: 270,
  title: 352,
  sub: 432,
  badge: 458, badgeH: 30,
  prodHead: 524,
  prod: 556, rowH: 64,
  hoursHead: 836,
  hours: 870, hourRow: 30,
  mapHead: 1034,
  map: 1052, mapH: 176,
  btn: 1244, btnH: 48,
  foot: 1316,
};
export const PAGE_H = 1360;
const MAX_SCROLL = PAGE_H - VIEW_H;

const PRODUCTS = [
  { name: 'Kovászos kenyér', desc: '1 kg, fehér és teljes kiőrlésű', price: '1 290', kind: 0 },
  { name: 'Rozsos vekni', desc: '750 g, köménnyel', price: '1 190', kind: 1 },
  { name: 'Kakaós csiga', desc: 'vajas, reggelente frissen', price: '450', kind: 2 },
  { name: 'Túrós batyu', desc: 'házi túróval', price: '490', kind: 3 },
];
const HOURS: [string, string, boolean][] = [
  ['Hétfő', 'zárva', false],
  ['Kedd–péntek', '6:30–18:00', true],
  ['Szombat', '7:00–12:00', false],
  ['Vasárnap', 'zárva', false],
];

const CHAT: [0 | 1, string][] = [
  [0, 'Mit árulsz a legszívesebben?'],
  [1, 'Kovászos kenyeret és kakaós csigát.'],
  [0, 'Mikor vagy nyitva?'],
  [1, 'Kedd–péntek fél 7-től 6-ig, szombaton délig.'],
  [0, 'Mit kérdeznek a vevők a legtöbbször?'],
  [1, 'Hogy van-e még kenyér délután.'],
  [0, 'Akkor ez kerül az oldal tetejére.'],
];

// ---------- Kódból rajzolt „fotók” ----------
interface Art { hero: HTMLCanvasElement; thumbs: HTMLCanvasElement[]; map: HTMLCanvasElement; scale: number; }

function off(w: number, h: number, scale: number): [HTMLCanvasElement, C] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  return [c, ctx];
}

function drawLoaf(ctx: C, cx: number, cy: number, rx: number, ry: number, crust: string, seed: number, scores = 3) {
  const r = rng(seed);
  // árnyék
  ctx.save();
  ctx.fillStyle = rgba(BAZ, 0.45);
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.06, cy + ry * 0.78, rx * 1.02, ry * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // héj
  const g = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.45, ry * 0.1, cx, cy, rx * 1.05);
  g.addColorStop(0, mix(crust, GOZ, 0.28));
  g.addColorStop(0.45, crust);
  g.addColorStop(1, mix(crust, BAZ, 0.55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy + ry * 0.35);
  ctx.bezierCurveTo(cx - rx * 1.02, cy - ry * 0.9, cx - rx * 0.4, cy - ry * 1.08, cx, cy - ry);
  ctx.bezierCurveTo(cx + rx * 0.45, cy - ry * 1.06, cx + rx * 1.03, cy - ry * 0.8, cx + rx, cy + ry * 0.35);
  ctx.bezierCurveTo(cx + rx * 0.9, cy + ry * 0.75, cx - rx * 0.9, cy + ry * 0.75, cx - rx, cy + ry * 0.35);
  ctx.fill();
  // bevágások: sötét barázda + lisztes perem
  for (let i = 0; i < scores; i++) {
    const t = scores === 1 ? 0 : i / (scores - 1) - 0.5;
    const x0 = cx + t * rx * 1.15 - rx * 0.18, y0 = cy - ry * 0.55 + Math.abs(t) * ry * 0.3;
    const x1 = x0 + rx * 0.36, y1 = y0 + ry * 0.55;
    ctx.lineCap = 'round';
    ctx.strokeStyle = mix(crust, BAZ, 0.65);
    ctx.lineWidth = Math.max(1.2, rx * 0.07);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + rx * 0.22, y0 + ry * 0.12, x1, y1); ctx.stroke();
    ctx.strokeStyle = rgba(GOZ, 0.75);
    ctx.lineWidth = Math.max(0.8, rx * 0.025);
    ctx.beginPath(); ctx.moveTo(x0 - 1, y0 - 2); ctx.quadraticCurveTo(x0 + rx * 0.2, y0 + ry * 0.06, x1 - 2, y1 - 3); ctx.stroke();
  }
  // liszt
  for (let i = 0; i < rx * 1.2; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = cx + Math.cos(a) * rx * 0.85 * d, y = cy - ry * 0.35 + Math.sin(a) * ry * 0.55 * d;
    ctx.fillStyle = rgba(GOZ, 0.25 + r() * 0.5);
    ctx.beginPath(); ctx.arc(x, y, 0.4 + r() * 1.1, 0, Math.PI * 2); ctx.fill();
  }
}

function makeArt(scale: number): Art {
  // Nyitókép: kovászos kenyér a kaldera-zöld deszkán
  const [hero, h] = off(LW, L.heroH, scale);
  h.fillStyle = KAL; h.fillRect(0, 0, LW, L.heroH);
  const glow = h.createRadialGradient(LW * 0.78, 30, 10, LW * 0.78, 30, 300);
  glow.addColorStop(0, rgba(KEN, 0.28)); glow.addColorStop(1, rgba(KEN, 0));
  h.fillStyle = glow; h.fillRect(0, 0, LW, L.heroH);
  // deszka
  h.fillStyle = mix(KAL, BAZ, 0.45);
  h.beginPath(); h.ellipse(LW * 0.5, 228, 200, 46, 0, 0, Math.PI * 2); h.fill();
  const r = rng(7);
  h.strokeStyle = rgba(GOZ, 0.06); h.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const y = 196 + i * 7; h.beginPath(); h.moveTo(20, y + r() * 4); h.bezierCurveTo(120, y - 6, 240, y + 8, 340, y + r() * 4); h.stroke(); }
  // búzakalász zuzmó színben
  h.strokeStyle = rgba(ZUZ, 0.8); h.lineWidth = 1.6;
  for (let k = 0; k < 2; k++) {
    const bx = 34 + k * 18, by = 236;
    h.beginPath(); h.moveTo(bx, by); h.quadraticCurveTo(bx + 6, by - 80, bx + 26, by - 150); h.stroke();
    for (let j = 0; j < 7; j++) {
      const t = 0.45 + j * 0.08; const px = bx + 26 * t * t + 2, py = by - 150 * t;
      h.fillStyle = rgba(ZUZ, 0.85);
      h.beginPath(); h.ellipse(px - 5, py, 7, 3, -0.8, 0, Math.PI * 2); h.fill();
      h.beginPath(); h.ellipse(px + 6, py - 2, 7, 3, 0.7, 0, Math.PI * 2); h.fill();
    }
  }
  drawLoaf(h, LW * 0.53, 168, 118, 64, KEN, 11, 3);
  drawLoaf(h, LW * 0.86, 232, 44, 24, mix(KEN, BAZ, 0.35), 5, 1);
  // lisztpor a levegőben
  for (let i = 0; i < 70; i++) { h.fillStyle = rgba(GOZ, r() * 0.35); h.beginPath(); h.arc(r() * LW, r() * L.heroH, r() * 1.4, 0, Math.PI * 2); h.fill(); }

  // Termékképek
  const thumbs: HTMLCanvasElement[] = [];
  for (let k = 0; k < 4; k++) {
    const [c, t] = off(44, 44, scale);
    t.fillStyle = k % 2 ? mix(KAL, GOZ, 0.12) : KAL; t.fillRect(0, 0, 44, 44);
    if (k === 0) drawLoaf(t, 22, 22, 16, 9, KEN, 3, 2);
    else if (k === 1) drawLoaf(t, 22, 22, 17, 8, mix(KEN, BAZ, 0.45), 9, 3);
    else if (k === 2) {
      t.fillStyle = mix(KEN, GOZ, 0.2); t.beginPath(); t.arc(22, 23, 14, 0, Math.PI * 2); t.fill();
      t.strokeStyle = mix(KEN, BAZ, 0.7); t.lineWidth = 2.6; t.lineCap = 'round';
      t.beginPath();
      for (let a = 0; a < Math.PI * 5.2; a += 0.15) { const rr0 = 1 + a * 0.75; const x = 22 + Math.cos(a) * rr0, y = 23 + Math.sin(a) * rr0; if (a === 0) t.moveTo(x, y); else t.lineTo(x, y); }
      t.stroke();
    } else {
      t.fillStyle = mix(KEN, GOZ, 0.35);
      t.beginPath(); t.moveTo(8, 32); t.lineTo(22, 9); t.lineTo(36, 32); t.closePath(); t.fill();
      t.fillStyle = GOZ; t.beginPath(); t.moveTo(16, 31); t.lineTo(22, 20); t.lineTo(28, 31); t.closePath(); t.fill();
      t.strokeStyle = mix(KEN, BAZ, 0.4); t.lineWidth = 1.4; t.beginPath(); t.moveTo(8, 32); t.lineTo(22, 9); t.lineTo(36, 32); t.closePath(); t.stroke();
    }
    thumbs.push(c);
  }

  // Térkép-csempe
  const mw = LW - PAD * 2;
  const [map, m] = off(mw, L.mapH, scale);
  m.fillStyle = mix(GOZ, HAMU, 0.1); m.fillRect(0, 0, mw, L.mapH);
  m.fillStyle = rgba(ZUZ, 0.45); rr(m, 196, 18, 96, 62, 6); m.fill(); // park
  m.strokeStyle = rgba(KAL, 0.35); m.lineWidth = 10; m.lineCap = 'round';
  m.beginPath(); m.moveTo(-10, 150); m.bezierCurveTo(80, 120, 140, 176, 330, 128); m.stroke(); // patak
  const road = (pts: number[], w: number) => {
    m.lineCap = 'round'; m.lineJoin = 'round';
    for (const [lw, col] of [[w + 2.5, rgba(HAMU, 0.35)], [w, GOZ]] as [number, string][]) {
      m.strokeStyle = col; m.lineWidth = lw; m.beginPath(); m.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) m.lineTo(pts[i], pts[i + 1]);
      m.stroke();
    }
  };
  road([-10, 98, 120, 90, 330, 104], 9);
  road([132, -10, 140, 90, 150, 190], 9);
  road([40, -10, 60, 190], 5);
  road([-10, 40, 330, 30], 5);
  road([230, 100, 250, 190], 5);
  // tű
  const px = 140, py = 86;
  m.fillStyle = rgba(BAZ, 0.25); m.beginPath(); m.ellipse(px, py + 2, 9, 3.5, 0, 0, Math.PI * 2); m.fill();
  m.fillStyle = KEN; m.beginPath(); m.moveTo(px, py); m.bezierCurveTo(px - 16, py - 20, px - 12, py - 38, px, py - 38); m.bezierCurveTo(px + 12, py - 38, px + 16, py - 20, px, py); m.fill();
  m.fillStyle = BAZ; m.beginPath(); m.arc(px, py - 26, 4.5, 0, Math.PI * 2); m.fill();
  font(m, `600 11px ${F_TORZS}`); m.fillStyle = BAZ; m.fillText('Kovászos Pékség', px + 16, py - 22);

  return { hero, thumbs, map, scale };
}

// ---------- Rajzoló ----------
export interface ScreenState {
  s: number; // 0..4
  time: number; // mp, csak apró, időzített részletekhez (pötty, kurzor)
  scroll: number; // a lap görgetése a kijelzőn belül (oldal-px)
  still: boolean; // mozgáscsökkentés: nincs villogás
}

export function scrollTarget(s: number): number {
  if (s < 1) return 0;
  if (s < 2) {
    const wire = clamp01((s - 1) / 0.55);
    const front = easeOut(wire) * PAGE_H;
    const follow = Math.min(MAX_SCROLL, Math.max(0, front - 520));
    return follow * (1 - smooth((s - 1.72) / 0.26));
  }
  if (s < 3) {
    const wipe = wipeY(s);
    const follow = Math.min(MAX_SCROLL, Math.max(0, wipe - 430));
    return lerp(follow, 400, smooth((s - 2.84) / 0.16));
  }
  return 400;
}

function wipeY(s: number) { return smooth((s - 2) / 0.8) * (PAGE_H + 20); }

export class Screen {
  readonly canvas: HTMLCanvasElement;
  private ctx: C;
  private art: Art | null = null;
  private scale = 1;

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** Pixelméret beállítása logikai szélesség szorzójával. */
  setScale(scale: number) {
    if (scale === this.scale && this.art) return;
    this.scale = scale;
    this.canvas.width = Math.round(LW * scale);
    this.canvas.height = Math.round(LH * scale);
    this.art = null;
  }

  /** Betűk betöltése után újra kell rajzolni a képeket (a térképen szöveg van). */
  invalidateArt() { this.art = null; }

  draw(st: ScreenState) {
    const ctx = this.ctx;
    if (!this.art) this.art = makeArt(this.scale);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
    ctx.fillStyle = GOZ;
    ctx.fillRect(0, 0, LW, LH);

    const s = Math.max(0, Math.min(4, st.s));
    const chatOut = smooth((s - 0.86) / 0.2);

    if (chatOut > 0) {
      ctx.save();
      ctx.translate(0, BAR);
      ctx.beginPath(); ctx.rect(0, 0, LW, VIEW_H); ctx.clip();
      ctx.translate(0, -st.scroll);
      if (s < 2) this.wire(clamp01((s - 1) / 0.55), s < 1 ? 0.25 * chatOut : 1);
      else if (s < 2.9) {
        const wy = wipeY(s);
        this.wire(1, 1);
        ctx.save(); ctx.beginPath(); ctx.rect(0, -10, LW, wy + 10); ctx.clip();
        this.page(st, null);
        ctx.restore();
        if (wy < PAGE_H) this.wipeLine(wy, s);
      } else this.page(st, clamp01((s - 3) / 0.82));
      ctx.restore();
    }
    if (chatOut < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - chatOut;
      ctx.translate(0, -chatOut * 40);
      this.chat(s, st);
      ctx.restore();
    }
    if (s >= 3) this.editOverlay(st, clamp01((s - 3) / 0.82));
    this.statusBar();
  }

  // ----- állapotsor (közös) -----
  private statusBar() {
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.fillStyle = GOZ; ctx.fillRect(0, 0, LW, BAR);
    font(ctx, `600 14px ${F_TORZS}`); ctx.fillStyle = BAZ; ctx.textAlign = 'left';
    ctx.fillText('8:41', 30, 27);
    // sziget
    ctx.fillStyle = '#000'; rr(ctx, LW / 2 - 46, 9, 92, 26, 13); ctx.fill();
    // térerő + akku
    ctx.fillStyle = BAZ;
    for (let i = 0; i < 4; i++) { rr(ctx, 270 + i * 5, 26 - (i + 1) * 3, 3, (i + 1) * 3, 1); ctx.fill(); }
    ctx.strokeStyle = BAZ; ctx.lineWidth = 1.2; rr(ctx, 298, 15, 24, 12, 3.5); ctx.stroke();
    rr(ctx, 300.5, 17.5, 16, 7, 2); ctx.fill();
    rr(ctx, 323.5, 19, 2, 4, 1); ctx.fill();
  }

  // ----- 0. beszélgetés -----
  private chat(s: number, st: ScreenState) {
    const ctx = this.ctx;
    const k = 0.9 + clamp01(s / 0.82) * (CHAT.length - 0.9);
    // fejléc
    const top = BAR;
    ctx.fillStyle = GOZ; ctx.fillRect(0, top, LW, LH - top);
    ctx.strokeStyle = BAZ; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(26, top + 20); ctx.lineTo(19, top + 28); ctx.lineTo(26, top + 36); ctx.stroke();
    ctx.fillStyle = KEN; ctx.beginPath(); ctx.arc(54, top + 28, 17, 0, Math.PI * 2); ctx.fill();
    font(ctx, `700 13px ${F_CIM}`); ctx.fillStyle = BAZ; ctx.textAlign = 'center'; ctx.fillText('KP', 54, top + 33);
    ctx.textAlign = 'left';
    font(ctx, `600 15px ${F_TORZS}`); ctx.fillText('Kovászos Pékség', 80, top + 25);
    font(ctx, `400 11.5px ${F_ADAT}`); ctx.fillStyle = HAMU; ctx.fillText('első beszélgetés', 80, top + 41);
    ctx.fillStyle = rgba(BAZ, 0.12); ctx.fillRect(0, top + 56, LW, 1);

    // buborékok
    font(ctx, `400 14.5px ${F_TORZS}`);
    const maxW = 236, lh = 19.5;
    type B = { side: 0 | 1; lines: string[]; w: number; h: number; y: number; a: number };
    const bubbles: B[] = [];
    let y = 0;
    let prevSide = -1;
    for (let i = 0; i < CHAT.length; i++) {
      const a = clamp01((k - i) / 0.55);
      if (a <= 0) break;
      const [side, text] = CHAT[i];
      const lines = wrap(ctx, text, maxW - 26);
      const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 26);
      const h = lines.length * lh + 16;
      y += prevSide === -1 ? 0 : prevSide === side ? 6 : 14;
      bubbles.push({ side, lines, w, h, y, a });
      y += h * easeOut(a);
      prevSide = side;
    }
    // gépelés-jelző a következőhöz
    const n = bubbles.length;
    const frac = k - Math.floor(k);
    const typing = n < CHAT.length && (k - (n - 1)) > 0.6 && frac > 0.15;
    const typingSide = typing ? CHAT[n][0] : 0;
    const typingY = y + (n ? (CHAT[n - 1][0] === typingSide ? 6 : 14) : 0);
    const contentBottom = typing ? typingY + 36 : y;
    const areaTop = top + 72, areaBottom = LH - 78;
    const shift = Math.max(0, contentBottom - (areaBottom - areaTop));

    ctx.save();
    ctx.beginPath(); ctx.rect(0, top + 57, LW, areaBottom - top - 45); ctx.clip();
    ctx.translate(0, areaTop - shift);
    for (const b of bubbles) {
      const e = easeOut(b.a);
      const x = b.side === 0 ? 16 : LW - 16 - b.w;
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, (1 - e) * 12);
      ctx.fillStyle = b.side === 0 ? KAL : rgba(BAZ, 0.08);
      rr(ctx, x, b.y, b.w, b.h, b.side === 0 ? [16, 16, 16, 4] : [16, 16, 4, 16]); ctx.fill();
      ctx.fillStyle = b.side === 0 ? GOZ : BAZ;
      font(ctx, `400 14.5px ${F_TORZS}`);
      b.lines.forEach((l, i) => ctx.fillText(l, x + 13, b.y + 22 + i * lh));
      ctx.restore();
    }
    if (typing) {
      const w = 58, x = typingSide === 0 ? 16 : LW - 16 - w;
      ctx.fillStyle = typingSide === 0 ? KAL : rgba(BAZ, 0.08);
      rr(ctx, x, typingY, w, 34, 17); ctx.fill();
      for (let d = 0; d < 3; d++) {
        const ph = st.still ? 0.5 : 0.5 + 0.5 * Math.sin(st.time * 7 - d * 0.9);
        ctx.fillStyle = typingSide === 0 ? rgba(GOZ, 0.45 + ph * 0.5) : rgba(BAZ, 0.3 + ph * 0.45);
        ctx.beginPath(); ctx.arc(x + 17 + d * 12, typingY + 17 - ph * 2.5, 3.3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // beviteli sáv
    ctx.fillStyle = rgba(BAZ, 0.12); ctx.fillRect(0, LH - 70, LW, 1);
    ctx.strokeStyle = rgba(BAZ, 0.25); ctx.lineWidth = 1.2;
    rr(ctx, 16, LH - 56, LW - 76, 38, 19); ctx.stroke();
    font(ctx, `400 14px ${F_TORZS}`); ctx.fillStyle = HAMU; ctx.fillText('Üzenet', 34, LH - 32);
    ctx.fillStyle = KEN; ctx.beginPath(); ctx.arc(LW - 37, LH - 37, 19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = BAZ; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(LW - 37, LH - 28); ctx.lineTo(LW - 37, LH - 46); ctx.moveTo(LW - 44, LH - 39); ctx.lineTo(LW - 37, LH - 46); ctx.lineTo(LW - 30, LH - 39); ctx.stroke();
  }

  // ----- 1. drótváz -----
  private wire(t: number, alpha: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = GOZ; ctx.fillRect(0, -BAR, LW, PAGE_H + BAR + 40);
    // pontrács, mint a tervlapon
    ctx.fillStyle = rgba(HAMU, 0.16);
    for (let y = 8; y < PAGE_H; y += 16) for (let x = 8; x < LW; x += 16) ctx.fillRect(x, y, 1.2, 1.2);

    const items: ((p: number) => void)[] = [];
    const box = (x: number, y: number, w: number, h: number, r = 4, cross = false, label = '') => (p: number) => {
      const per = 2 * (w + h);
      ctx.strokeStyle = rgba(HAMU, 0.7); ctx.lineWidth = 1.4;
      ctx.setLineDash([per * p, per + 1]);
      rr(ctx, x, y, w, h, r); ctx.stroke();
      ctx.setLineDash([]);
      if (cross && p > 0.5) {
        const q = (p - 0.5) * 2;
        ctx.strokeStyle = rgba(HAMU, 0.35); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * q, y + h * q); ctx.moveTo(x + w, y); ctx.lineTo(x + w - w * q, y + h * q); ctx.stroke();
      }
      if (label && p > 0.6) {
        ctx.globalAlpha = alpha * (p - 0.6) / 0.4;
        font(ctx, `500 10.5px ${F_ADAT}`);
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = GOZ; ctx.fillRect(x + 8, y + 8, tw + 10, 17);
        ctx.fillStyle = HAMU; ctx.fillText(label, x + 13, y + 20);
        ctx.globalAlpha = alpha;
      }
    };
    const bar = (x: number, y: number, w: number, h: number, a = 0.22) => (p: number) => {
      ctx.fillStyle = rgba(HAMU, a); rr(ctx, x, y, Math.max(0.01, w * easeOut(p)), h, h / 2); ctx.fill();
    };
    // fejléc
    items.push(box(PAD, 16, 92, 24, 3, false, 'logó'));
    items.push(bar(LW - PAD - 26, 20, 26, 3, 0.5), bar(LW - PAD - 26, 27, 26, 3, 0.5), bar(LW - PAD - 26, 34, 26, 3, 0.5));
    items.push(box(0.5, L.hero + 0.5, LW - 1, L.heroH - 1, 0, true, 'fotó: a kenyér'));
    items.push(bar(PAD, L.title, 290, 22, 0.3), bar(PAD, L.title + 34, 200, 22, 0.3));
    items.push(bar(PAD, L.sub - 10, 150, 9));
    items.push(box(PAD, L.badge, 170, L.badgeH, 15, false, ''));
    items.push(bar(PAD, L.prodHead - 16, 130, 16, 0.3));
    PRODUCTS.forEach((_, i) => {
      const y = L.prod + i * L.rowH;
      items.push(box(PAD, y + 10, 44, 44, 6, true));
      items.push(bar(PAD + 58, y + 18, 130, 10), bar(PAD + 58, y + 36, 170, 7, 0.14), bar(LW - PAD - 56, y + 23, 56, 10, 0.3));
    });
    items.push(bar(PAD, L.hoursHead - 16, 140, 16, 0.3));
    HOURS.forEach((_, i) => { const y = L.hours + i * L.hourRow; items.push(bar(PAD, y + 8, 110, 9), bar(LW - PAD - 90, y + 8, 90, 9)); });
    items.push(bar(PAD, L.mapHead - 16, 120, 16, 0.3));
    items.push(box(PAD, L.map, LW - PAD * 2, L.mapH, 8, true, 'térkép'));
    items.push(box(PAD, L.btn, LW - PAD * 2, L.btnH, 4, false, 'gomb: útvonal'));
    items.push(bar(PAD, L.foot, 180, 8, 0.14));

    const N = items.length;
    items.forEach((fn, i) => {
      const p = clamp01((t * (N + 3) - i) / 3.5);
      if (p > 0) fn(p);
    });
    ctx.restore();
  }

  private wipeLine(wy: number, s: number) {
    const ctx = this.ctx;
    ctx.fillStyle = KEN; ctx.fillRect(0, wy - 1, LW, 2.5);
    const pct = Math.round(clamp01((s - 2) / 0.8) * 100);
    font(ctx, `600 10.5px ${F_ADAT}`);
    const label = `épül · ${pct}%`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = KEN; rr(ctx, LW - PAD - tw - 14, wy - 10, tw + 14, 20, 3); ctx.fill();
    ctx.fillStyle = BAZ; ctx.textAlign = 'left'; ctx.fillText(label, LW - PAD - tw - 7, wy + 4);
  }

  // ----- 2–3. a kész oldal -----
  private page(st: ScreenState, edit: number | null) {
    const ctx = this.ctx;
    const art = this.art!;
    ctx.fillStyle = GOZ; ctx.fillRect(0, -BAR, LW, PAGE_H + BAR + 40);
    ctx.textAlign = 'left';
    // fejléc
    font(ctx, `700 21px ${F_CIM}`); ctx.fillStyle = BAZ; ctx.fillText('Kovászos', PAD, 36);
    const kw = ctx.measureText('Kovászos').width;
    font(ctx, `400 13px ${F_TORZS}`); ctx.fillStyle = HAMU; ctx.fillText('pékség', PAD + kw + 6, 36);
    ctx.fillStyle = BAZ;
    for (let i = 0; i < 3; i++) { rr(ctx, LW - PAD - 22, 21 + i * 7, 22, 2.4, 1.2); ctx.fill(); }
    ctx.fillStyle = rgba(BAZ, 0.1); ctx.fillRect(0, L.navH - 1, LW, 1);
    // nyitókép
    ctx.drawImage(art.hero, 0, L.hero, LW, L.heroH);
    // cím
    font(ctx, `700 29px ${F_CIM}`); ctx.fillStyle = BAZ;
    ctx.fillText('Kovászos kenyér,', PAD, L.title + 18);
    ctx.fillText('minden reggel.', PAD, L.title + 52);
    font(ctx, `500 12.5px ${F_ADAT}`); ctx.fillStyle = HAMU; ctx.fillText('Veszprém, belváros', PAD, L.sub);
    // nyitva jelvény
    ctx.fillStyle = rgba(BAZ, 0.07); rr(ctx, PAD, L.badge, 174, L.badgeH, 15); ctx.fill();
    ctx.fillStyle = mix(KEN, BAZ, 0.15); ctx.beginPath(); ctx.arc(PAD + 16, L.badge + 15, 4.5, 0, Math.PI * 2); ctx.fill();
    font(ctx, `600 13px ${F_TORZS}`); ctx.fillStyle = BAZ; ctx.fillText('Ma nyitva 18:00-ig', PAD + 28, L.badge + 20);
    // termékek
    font(ctx, `700 21px ${F_CIM}`); ctx.fillStyle = BAZ; ctx.fillText('Ma a pulton', PAD, L.prodHead);
    PRODUCTS.forEach((p, i) => {
      const y = L.prod + i * L.rowH;
      ctx.save(); rr(ctx, PAD, y + 10, 44, 44, 6); ctx.clip(); ctx.drawImage(art.thumbs[p.kind], PAD, y + 10, 44, 44); ctx.restore();
      font(ctx, `500 15px ${F_TORZS}`); ctx.fillStyle = BAZ; ctx.fillText(p.name, PAD + 58, y + 30);
      font(ctx, `400 12px ${F_TORZS}`); ctx.fillStyle = HAMU; ctx.fillText(p.desc, PAD + 58, y + 47);
      if (!(i === 0 && edit !== null)) {
        font(ctx, `600 14px ${F_ADAT}`); ctx.fillStyle = BAZ; ctx.textAlign = 'right';
        ctx.fillText(`${p.price} Ft`, LW - PAD, y + 36); ctx.textAlign = 'left';
      }
      ctx.fillStyle = rgba(BAZ, 0.08); ctx.fillRect(PAD, y + L.rowH - 0.5, LW - PAD * 2, 1);
    });
    if (edit !== null) this.priceField(st, edit);
    // nyitvatartás
    font(ctx, `700 21px ${F_CIM}`); ctx.fillStyle = BAZ; ctx.fillText('Nyitvatartás', PAD, L.hoursHead);
    HOURS.forEach(([d, h, today], i) => {
      const y = L.hours + i * L.hourRow;
      if (today) { ctx.fillStyle = rgba(KEN, 0.28); rr(ctx, PAD - 8, y, LW - PAD * 2 + 16, L.hourRow - 2, 4); ctx.fill(); }
      font(ctx, `${today ? 600 : 400} 14px ${F_TORZS}`); ctx.fillStyle = BAZ; ctx.fillText(d, PAD, y + 19);
      font(ctx, `500 13px ${F_ADAT}`); ctx.fillStyle = h === 'zárva' ? HAMU : BAZ; ctx.textAlign = 'right'; ctx.fillText(h, LW - PAD, y + 19); ctx.textAlign = 'left';
    });
    // térkép
    font(ctx, `700 21px ${F_CIM}`); ctx.fillStyle = BAZ; ctx.fillText('Itt találsz', PAD, L.mapHead);
    ctx.save(); rr(ctx, PAD, L.map, LW - PAD * 2, L.mapH, 8); ctx.clip(); ctx.drawImage(art.map, PAD, L.map, LW - PAD * 2, L.mapH); ctx.restore();
    ctx.fillStyle = BAZ; rr(ctx, PAD, L.btn, LW - PAD * 2, L.btnH, 4); ctx.fill();
    font(ctx, `600 15px ${F_TORZS}`); ctx.fillStyle = GOZ; ctx.textAlign = 'center'; ctx.fillText('Útvonaltervezés', LW / 2, L.btn + 30); ctx.textAlign = 'left';
    font(ctx, `400 11px ${F_ADAT}`); ctx.fillStyle = HAMU; ctx.fillText('Kitalált pékség, bemutató oldal.', PAD, L.foot + 8);
  }

  // Az ár mezője szerkesztés közben (3. lépés)
  private priceField(st: ScreenState, t: number) {
    const ctx = this.ctx;
    const y = L.prod;
    const OLD = '1 290', NEW = '1 350';
    let val = OLD;
    if (t > 0.26) val = OLD.slice(0, OLD.length - Math.min(OLD.length, Math.floor((t - 0.26) / 0.16 * OLD.length + 0.0001)));
    if (t > 0.44) val = NEW.slice(0, Math.min(NEW.length, Math.floor((t - 0.44) / 0.16 * NEW.length) + 1));
    if (t > 0.6) val = NEW;
    const editing = t > 0.17 && t < 0.74;
    font(ctx, `600 14px ${F_ADAT}`);
    const unit = ' Ft';
    const full = val + unit;
    const tw = ctx.measureText(full).width;
    const right = LW - PAD;
    if (editing) {
      const w = Math.max(84, tw + 20);
      ctx.fillStyle = mix(GOZ, '#FFFFFF', 0.6); rr(ctx, right - w + 8, y + 17, w, 28, 4); ctx.fill();
      ctx.strokeStyle = KEN; ctx.lineWidth = 2; rr(ctx, right - w + 8, y + 17, w, 28, 4); ctx.stroke();
    }
    const saved = t >= 0.74;
    const flash = saved ? 1 - clamp01((t - 0.74) / 0.2) : 0;
    if (flash > 0) { ctx.fillStyle = rgba(KEN, 0.35 * flash); rr(ctx, right - tw - 8, y + 18, tw + 16, 26, 4); ctx.fill(); }
    ctx.fillStyle = BAZ; ctx.textAlign = 'right'; ctx.fillText(full, right, y + 36); ctx.textAlign = 'left';
    if (editing) {
      const blink = st.still || Math.sin(st.time * 9) > -0.2;
      if (blink) {
        const ux = ctx.measureText(unit).width;
        ctx.fillStyle = BAZ; ctx.fillRect(right - ux + 1, y + 22, 1.6, 18);
      }
    }
  }

  // Szerkesztő sáv, ujj, „Mentve” jelzés – nem görgetődik
  private editOverlay(st: ScreenState, t: number) {
    const ctx = this.ctx;
    // eszköztár
    const bar = easeOut((t - 0.08) / 0.12);
    if (bar > 0) {
      const y = BAR - 52 + 52 * bar;
      ctx.fillStyle = BAZ; ctx.fillRect(0, y, LW, 52);
      font(ctx, `600 14px ${F_TORZS}`); ctx.fillStyle = GOZ; ctx.textAlign = 'left';
      ctx.fillText('Szerkesztés', PAD, y + 31);
      const saved = t >= 0.74;
      ctx.fillStyle = saved ? rgba(GOZ, 0.14) : KEN; rr(ctx, LW - PAD - 84, y + 11, 84, 30, 4); ctx.fill();
      font(ctx, `600 13px ${F_TORZS}`); ctx.fillStyle = saved ? GOZ : BAZ; ctx.textAlign = 'center';
      ctx.fillText(saved ? 'Mentve' : 'Mentés', LW - PAD - 42, y + 31); ctx.textAlign = 'left';
    }
    // ujj
    const priceVY = BAR + L.prod - st.scroll + 52;
    const saveX = LW - PAD - 30, saveY = BAR + 44;
    const startX = LW - 40, startY = LH + 30;
    let fx = startX, fy = startY, press = 0;
    if (t < 0.15) { const e = smooth(t / 0.15); fx = lerp(startX, LW - PAD - 16, e); fy = lerp(startY, priceVY, e); }
    else if (t < 0.62) { fx = LW - PAD - 16; fy = priceVY; press = t < 0.24 ? Math.sin(((t - 0.15) / 0.09) * Math.PI) : 0; }
    else if (t < 0.72) { const e = smooth((t - 0.62) / 0.1); fx = lerp(LW - PAD - 16, saveX, e); fy = lerp(priceVY, saveY, e); }
    else if (t < 0.8) { fx = saveX; fy = saveY; press = Math.sin(((t - 0.72) / 0.08) * Math.PI); }
    else { const e = smooth((t - 0.8) / 0.1); fx = lerp(saveX, startX, e); fy = lerp(saveY, startY, e); }
    if (t > 0 && t < 0.9) {
      // érintés-hullám
      if (press > 0) {
        ctx.strokeStyle = rgba(KEN, 0.9 * press); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fx, fy, 18 + (1 - press) * 10 + press * 6, 0, Math.PI * 2); ctx.stroke();
      }
      const r = 15 - press * 2.5;
      ctx.fillStyle = rgba(BAZ, 0.18); ctx.beginPath(); ctx.arc(fx + 2, fy + 3, r + 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(GOZ, 0.82); ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(BAZ, 0.55); ctx.lineWidth = 1.5; ctx.stroke();
    }
    // „Mentve” felirat pipával
    const toast = easeOut((t - 0.76) / 0.1);
    if (toast > 0) {
      const w = 132, h = 42, x = (LW - w) / 2, y = LH - 30 - h + (1 - toast) * 24;
      ctx.save(); ctx.globalAlpha = toast;
      ctx.fillStyle = BAZ; rr(ctx, x, y, w, h, 21); ctx.fill();
      const ck = clamp01((t - 0.8) / 0.12);
      ctx.strokeStyle = KEN; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash([24 * ck, 30]);
      ctx.beginPath(); ctx.moveTo(x + 22, y + 21); ctx.lineTo(x + 29, y + 28); ctx.lineTo(x + 42, y + 14); ctx.stroke();
      ctx.setLineDash([]);
      font(ctx, `600 14.5px ${F_TORZS}`); ctx.fillStyle = GOZ; ctx.fillText('Mentve', x + 54, y + 26);
      ctx.restore();
    }
  }
}

function wrap(ctx: C, text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
