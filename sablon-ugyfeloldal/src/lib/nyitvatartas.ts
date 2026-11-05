// Nyitvatartás-számítás. Ugyanez a modul fut a buildben (összegzés, táblázat)
// és a böngészőben („Nyitva most / Zárva, holnap 7:00-kor nyit”), ezért nincs
// benne semmilyen függőség. Időzóna: mindig Europe/Budapest, a látogató gépétől
// függetlenül.

export const NAP_KULCSOK = ['hetfo', 'kedd', 'szerda', 'csutortok', 'pentek', 'szombat', 'vasarnap'] as const;
export type Nap = (typeof NAP_KULCSOK)[number];

export interface Idosav {
  tol: string;
  ig: string;
}
export interface Kivetel {
  datum: string;
  datumIg?: string;
  nyitva: Idosav[];
  megjegyzes?: string;
}
export interface NyitvatartasAdat {
  het: Record<Nap, Idosav[]>;
  unnepnapokonZarva: boolean;
  kivetelek: Kivetel[];
}

export const NAP_NEV: Record<Nap, string> = {
  hetfo: 'hétfő',
  kedd: 'kedd',
  szerda: 'szerda',
  csutortok: 'csütörtök',
  pentek: 'péntek',
  szombat: 'szombat',
  vasarnap: 'vasárnap',
};
/** „hétfőn”, „kedden” … – a „…-kor nyit” mondathoz. */
const NAP_RAGOS: Record<Nap, string> = {
  hetfo: 'hétfőn',
  kedd: 'kedden',
  szerda: 'szerdán',
  csutortok: 'csütörtökön',
  pentek: 'pénteken',
  szombat: 'szombaton',
  vasarnap: 'vasárnap',
};
const NAP_ROVID: Record<Nap, string> = {
  hetfo: 'H',
  kedd: 'K',
  szerda: 'Sze',
  csutortok: 'Cs',
  pentek: 'P',
  szombat: 'Szo',
  vasarnap: 'V',
};
const HONAP_ROVID = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
/** Napszám + rag: 1-jén, 2-án, 3-án, 4-én … */
const NAP_RAG = ['', 'jén', 'án', 'án', 'én', 'én', 'án', 'én', 'án', 'én', 'én', 'én', 'én', 'án', 'én', 'én', 'án', 'én', 'án', 'én', 'án', 'én', 'én', 'án', 'én', 'én', 'án', 'én', 'án', 'én', 'án', 'én'];

// ---------- dátum-segédek (UTC-ben számolunk, csak a naptári nap számít) ----------

export function isoBol(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function isoba(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function napotHozzaad(iso: string, n: number): string {
  const d = isoBol(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoba(d);
}
export function hetNapja(iso: string): Nap {
  // getUTCDay: 0 = vasárnap
  return NAP_KULCSOK[(isoBol(iso).getUTCDay() + 6) % 7];
}
export function percben(ido: string): number {
  return Number(ido.slice(0, 2)) * 60 + Number(ido.slice(3, 5));
}
/** "07:30" → "7:30" */
export function idoKiir(ido: string): string {
  return ido.replace(/^0(\d)/, '$1');
}
export function savKiir(s: Idosav): string {
  return `${idoKiir(s.tol)}–${idoKiir(s.ig)}`;
}
export function savokKiir(savok: Idosav[]): string {
  return savok.length ? savok.map(savKiir).join(', ') : 'zárva';
}
export function datumKiir(iso: string): string {
  const d = isoBol(iso);
  return `${HONAP_ROVID[d.getUTCMonth()]} ${d.getUTCDate()}.`;
}
function datumRagos(iso: string): string {
  const d = isoBol(iso);
  return `${HONAP_ROVID[d.getUTCMonth()]} ${d.getUTCDate()}-${NAP_RAG[d.getUTCDate()]}`;
}

// ---------- magyar munkaszüneti napok (Mt. 102. §) ----------

function husvetVasarnap(ev: number): string {
  // Anonymous Gregorian algoritmus
  const a = ev % 19;
  const b = Math.floor(ev / 100);
  const c = ev % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const honap = Math.floor((h + l - 7 * m + 114) / 31);
  const nap = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ev}-${String(honap).padStart(2, '0')}-${String(nap).padStart(2, '0')}`;
}

const unnepCache = new Map<number, Map<string, string>>();
export function unnepnapok(ev: number): Map<string, string> {
  const meglevo = unnepCache.get(ev);
  if (meglevo) return meglevo;
  const h = husvetVasarnap(ev);
  const lista: Array<[string, string]> = [
    [`${ev}-01-01`, 'Újév'],
    [`${ev}-03-15`, 'Nemzeti ünnep'],
    [napotHozzaad(h, -2), 'Nagypéntek'],
    [h, 'Húsvét'],
    [napotHozzaad(h, 1), 'Húsvéthétfő'],
    [`${ev}-05-01`, 'A munka ünnepe'],
    [napotHozzaad(h, 49), 'Pünkösd'],
    [napotHozzaad(h, 50), 'Pünkösdhétfő'],
    [`${ev}-08-20`, 'Államalapítás ünnepe'],
    [`${ev}-10-23`, 'Nemzeti ünnep'],
    [`${ev}-11-01`, 'Mindenszentek'],
    [`${ev}-12-25`, 'Karácsony'],
    [`${ev}-12-26`, 'Karácsony másnapja'],
  ];
  const m = new Map(lista);
  unnepCache.set(ev, m);
  return m;
}

// ---------- egy adott nap nyitvatartása ----------

export interface NapiNyitvatartas {
  iso: string;
  nap: Nap;
  savok: Idosav[];
  /** Miért tér el a heti rendtől (kivétel megjegyzése vagy az ünnep neve). */
  eltero?: string;
}

export function napiNyitvatartas(adat: NyitvatartasAdat, iso: string): NapiNyitvatartas {
  const nap = hetNapja(iso);
  const kivetel = adat.kivetelek.find((k) => iso >= k.datum && iso <= (k.datumIg ?? k.datum));
  if (kivetel) return { iso, nap, savok: kivetel.nyitva, eltero: kivetel.megjegyzes ?? 'eltérő nyitvatartás' };
  if (adat.unnepnapokonZarva) {
    const unnep = unnepnapok(Number(iso.slice(0, 4))).get(iso);
    if (unnep && adat.het[nap].length) return { iso, nap, savok: [], eltero: unnep };
  }
  return { iso, nap, savok: adat.het[nap] };
}

// ---------- „most” Budapesten ----------

export interface Pillanat {
  iso: string;
  perc: number;
}

export function budapestiIdo(most: Date = new Date()): Pillanat {
  const reszek = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(most);
  const r = (t: string) => reszek.find((p) => p.type === t)?.value ?? '00';
  return { iso: `${r('year')}-${r('month')}-${r('day')}`, perc: Number(r('hour')) * 60 + Number(r('minute')) };
}

// ---------- állapot: nyitva most / mikor nyit ----------

export type Allapot =
  | { nyitva: true; zar: string; ma: NapiNyitvatartas }
  | { nyitva: false; ma: NapiNyitvatartas; kovetkezo?: { iso: string; tol: string; eltolas: number } };

export function allapot(adat: NyitvatartasAdat, most: Pillanat): Allapot {
  const ma = napiNyitvatartas(adat, most.iso);
  const aktualis = ma.savok.find((s) => most.perc >= percben(s.tol) && most.perc < percben(s.ig));
  if (aktualis) return { nyitva: true, zar: aktualis.ig, ma };
  for (let eltolas = 0; eltolas <= 21; eltolas++) {
    const nap = eltolas === 0 ? ma : napiNyitvatartas(adat, napotHozzaad(most.iso, eltolas));
    const sav = nap.savok.find((s) => eltolas > 0 || percben(s.tol) > most.perc);
    if (sav) return { nyitva: false, ma, kovetkezo: { iso: nap.iso, tol: sav.tol, eltolas } };
  }
  return { nyitva: false, ma };
}

/** Két rövid szöveg: a jelző („Nyitva most”) és a részlet („18:00-ig”). */
export function allapotSzoveg(a: Allapot): { cimke: string; reszlet: string } {
  if (a.nyitva) return { cimke: 'Nyitva most', reszlet: `ma ${idoKiir(a.zar)}-ig` };
  const k = a.kovetkezo;
  const ok = a.ma.eltero && !a.ma.savok.length ? ` (ma: ${a.ma.eltero})` : '';
  if (!k) return { cimke: 'Zárva', reszlet: `a következő hetekben nem nyitunk${ok}` };
  const ido = `${idoKiir(k.tol)}-kor`;
  let mikor: string;
  if (k.eltolas === 0) mikor = `ma ${ido}`;
  else if (k.eltolas === 1) mikor = `holnap ${ido}`;
  else if (k.eltolas < 7) mikor = `${NAP_RAGOS[hetNapja(k.iso)]} ${ido}`;
  else mikor = `${datumRagos(k.iso)} ${ido}`;
  return { cimke: 'Zárva', reszlet: `${mikor} nyit${ok}` };
}

// ---------- tömör heti összegzés: „H–P 6:30–18:00 · Szo 7:00–12:00 · V zárva” ----------

export function hetiOsszegzes(het: Record<Nap, Idosav[]>): Array<{ napok: string; idok: string }> {
  const csoportok: Array<{ elso: Nap; utolso: Nap; idok: string }> = [];
  for (const nap of NAP_KULCSOK) {
    const idok = savokKiir(het[nap]);
    const utolso = csoportok[csoportok.length - 1];
    if (utolso && utolso.idok === idok) utolso.utolso = nap;
    else csoportok.push({ elso: nap, utolso: nap, idok });
  }
  return csoportok.map((c) => ({
    napok: c.elso === c.utolso ? NAP_ROVID[c.elso] : `${NAP_ROVID[c.elso]}–${NAP_ROVID[c.utolso]}`,
    idok: c.idok,
  }));
}

/** Az aktuális és következő időszak eltérései (kivételek + ünnepnapok), a megjelenítéshez. */
export function kozelgoElteresek(adat: NyitvatartasAdat, tolIso: string, napok: number): NapiNyitvatartas[] {
  const lista: NapiNyitvatartas[] = [];
  for (let i = 0; i < napok; i++) {
    const n = napiNyitvatartas(adat, napotHozzaad(tolIso, i));
    if (n.eltero) lista.push(n);
  }
  return lista;
}
