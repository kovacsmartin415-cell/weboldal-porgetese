// A három témakészlet. A színek CSS custom property-ként kerülnek a /tema.css-be.
// Minden szövegszín-pár legalább 4.5:1 kontrasztú (WCAG 2.2 AA) – ezt a build
// ellenőrzi akkor is, ha a konfigban felülírod a színeket.

import type { TemaNev } from './tipusok.ts';

export interface Szinek {
  /** Oldal alapszíne. */
  hatter: string;
  /** Kiemelt sávok, táblázatok, kártyák háttere. */
  felulet: string;
  /** Fő szövegszín. */
  szoveg: string;
  /** Másodlagos szöveg (leírások, megjegyzések). */
  halvany: string;
  /** Az egyetlen kiemelő szín: linkek, gomb, fókuszkeret. */
  kiemelo: string;
  /** Szöveg a kiemelő színű gombon. */
  kiemeloSzoveg: string;
}

export interface Tema {
  nev: TemaNev;
  leiras: string;
  szinek: Szinek;
  /** Nem szöveges díszítő vonalak (elválasztók). Nem kell 4.5:1. */
  vonal: string;
  betuCim: string;
  betuTorzs: string;
  /** A címek font-stretch / súly / betűköz beállítása. */
  cimSuly: number;
  cimSzelesseg: string;
  cimNagybetus: boolean;
}

export const TEMAK: Record<TemaNev, Tema> = {
  meleg: {
    nev: 'meleg',
    leiras: 'Lisztfehér alap, kéregbarna szöveg, zománctábla-kék kiemelés. Pékség, asztalos, kávézó.',
    szinek: {
      hatter: '#F4EFE6',
      felulet: '#E9E1D2',
      szoveg: '#2A1F17',
      halvany: '#5C4D40',
      kiemelo: '#1F4E79',
      kiemeloSzoveg: '#FFFFFF',
    },
    vonal: '#CBBBA2',
    betuCim: "'Young Serif', 'Georgia', serif",
    betuTorzs: "'Source Sans 3 Variable', 'Source Sans 3', 'Segoe UI', sans-serif",
    cimSuly: 400,
    cimSzelesseg: '100%',
    cimNagybetus: false,
  },
  letisztult: {
    nev: 'letisztult',
    leiras: 'Majdnem fehér alap, grafit szöveg, szárzöld kiemelés. Virágbolt, szállás, rendelő.',
    szinek: {
      hatter: '#FAFAF7',
      felulet: '#EDEFE8',
      szoveg: '#1B1F1C',
      halvany: '#4C5550',
      kiemelo: '#2D5A3A',
      kiemeloSzoveg: '#FFFFFF',
    },
    vonal: '#C9CFC4',
    betuCim: "'Newsreader Variable', 'Newsreader', 'Georgia', serif",
    betuTorzs: "'Public Sans Variable', 'Public Sans', 'Segoe UI', sans-serif",
    cimSuly: 500,
    cimSzelesseg: '100%',
    cimNagybetus: false,
  },
  meresz: {
    nev: 'meresz',
    leiras: 'Sötét alap, csontfehér szöveg, jelzőpiros kiemelés, keskeny vastag címek. Borbély, műhely, szerviz.',
    szinek: {
      hatter: '#161514',
      felulet: '#24221F',
      szoveg: '#F3EEE6',
      halvany: '#BDB4A8',
      kiemelo: '#FF6A4D',
      kiemeloSzoveg: '#161514',
    },
    vonal: '#3D3934',
    betuCim: "'Archivo Variable', 'Archivo', 'Arial Narrow', sans-serif",
    betuTorzs: "'Archivo Variable', 'Archivo', 'Segoe UI', sans-serif",
    cimSuly: 800,
    cimSzelesseg: '68%',
    cimNagybetus: true,
  },
};

// ---- kontraszt (WCAG 2.x relatív fénysűrűség) ----

function fenysuruseg(hex: string): number {
  const csatornak = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = csatornak.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function kontraszt(a: string, b: string): number {
  const x = fenysuruseg(a);
  const y = fenysuruseg(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** A ténylegesen használt szövegszín-párok. Mindnek ≥ 4.5:1-nek kell lennie. */
export const SZOVEG_PAROK: Array<[keyof Szinek, keyof Szinek]> = [
  ['szoveg', 'hatter'],
  ['halvany', 'hatter'],
  ['szoveg', 'felulet'],
  ['halvany', 'felulet'],
  ['kiemelo', 'hatter'],
  ['kiemelo', 'felulet'],
  ['kiemeloSzoveg', 'kiemelo'],
];

export function kontrasztHibak(sz: Szinek, min = 4.5): string[] {
  return SZOVEG_PAROK.flatMap(([elo, hat]) => {
    const k = kontraszt(sz[elo], sz[hat]);
    return k < min ? [`${elo} (${sz[elo]}) a ${hat} (${sz[hat]}) színen csak ${k.toFixed(2)}:1, legalább ${min}:1 kell`] : [];
  });
}
