// Absztrakt utcaháló SVG-ben, a település nevéből vetett álvéletlennel:
// ugyanaz a név mindig ugyanazt a „térképet” adja, másik név másikat.
const NS = 'http://www.w3.org/2000/svg';

function seedFrom(s: string): number {
  let h = 2166136261;
  for (const ch of s.toLowerCase()) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const el = (tag: string, attrs: Record<string, string | number>) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

export const MAP_W = 320, MAP_H = 150;

/** Kicseréli az svg tartalmát a település nevéhez tartozó utcahálóra. */
export function drawMap(svg: SVGSVGElement, town: string): void {
  const r = rng(seedFrom(town || 'település'));
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

  svg.append(el('rect', { class: 'vz-map__alap', x: 0, y: 0, width: MAP_W, height: MAP_H }));

  // Víz vagy park: egy lágy folt valahol a szélén.
  const water = r() > 0.45;
  const wx = r() > 0.5 ? -20 + r() * 60 : MAP_W - 40 - r() * 60;
  const wy = r() * MAP_H;
  svg.append(el('ellipse', { class: water ? 'vz-map__viz' : 'vz-map__park', cx: wx, cy: wy, rx: 50 + r() * 50, ry: 30 + r() * 30, transform: `rotate(${(r() * 60 - 30).toFixed(1)} ${wx.toFixed(1)} ${wy.toFixed(1)})` }));

  // Elforgatott rácsháló, kissé szabálytalan közökkel.
  const g = el('g', { transform: `rotate(${(r() * 24 - 12).toFixed(1)} ${MAP_W / 2} ${MAP_H / 2})` });
  for (let x = -60 + r() * 30; x < MAP_W + 60; x += 26 + r() * 30) {
    g.append(el('line', { class: 'vz-map__utca', x1: x.toFixed(1), y1: -60, x2: (x + r() * 16 - 8).toFixed(1), y2: MAP_H + 60 }));
  }
  for (let y = -40 + r() * 20; y < MAP_H + 40; y += 22 + r() * 26) {
    g.append(el('line', { class: 'vz-map__utca', x1: -60, y1: y.toFixed(1), x2: MAP_W + 60, y2: (y + r() * 14 - 7).toFixed(1) }));
  }
  svg.append(g);

  // Egy főút ívesen keresztben.
  const y0 = 20 + r() * (MAP_H - 40), y1 = 20 + r() * (MAP_H - 40);
  svg.append(el('path', { class: 'vz-map__fout', d: `M -10 ${y0.toFixed(1)} C ${MAP_W * 0.35} ${(y0 + (r() - 0.5) * 120).toFixed(1)}, ${MAP_W * 0.65} ${(y1 + (r() - 0.5) * 120).toFixed(1)}, ${MAP_W + 10} ${y1.toFixed(1)}` }));

  // A tű: a vállalkozás helye.
  const px = MAP_W * (0.42 + r() * 0.16), py = MAP_H * (0.42 + r() * 0.12);
  const pin = el('g', { class: 'vz-map__tu', transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})` });
  pin.append(el('circle', { class: 'vz-map__tu-kor', cx: 0, cy: 0, r: 18 }));
  pin.append(el('path', { class: 'vz-map__tu-jel', d: 'M0 6 C -6 -2, -9 -6, -9 -10 A 9 9 0 1 1 9 -10 C 9 -6, 6 -2, 0 6 Z' }));
  pin.append(el('circle', { class: 'vz-map__tu-pont', cx: 0, cy: -10, r: 3.2 }));
  svg.append(pin);
}
