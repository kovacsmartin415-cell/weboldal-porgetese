/*
 * Közös, tiszta logika az „űrlapból e-mail és táblázatsor” automatizáláshoz.
 *
 * Ugyanez a fájl fut a Netlify Functionben (B) és – típusok nélkül, egyetlen
 * .gs fájlba fűzve – a Google Apps Scriptben (A). Ezért:
 *   - nincs I/O, nincs Node- vagy böngésző-API (nincs crypto, URL, Intl, TextEncoder),
 *   - csak „törölhető” TypeScript (nincs enum, namespace, paraméter-tulajdonság),
 *   - nincs opcionális láncolás és nullish-operátor (a régebbi Apps Script-futtatók miatt óvatosság),
 *   - minden importált/exportált sor egysoros (az Apps Script-építő ezt várja).
 */

// ---------------------------------------------------------------------------
// Típusok
// ---------------------------------------------------------------------------

/** A Netlify beküldés-objektuma (webhookban közvetlenül, a függvényben `payload` alatt). */
export interface NetlifyBekuldes {
  id?: string;
  number?: number;
  form_name?: string;
  form_id?: string;
  site_url?: string;
  created_at?: string;
  data?: Record<string, unknown>;
  [kulcs: string]: unknown;
}

/** Egy mezőhöz tartozó lehetséges űrlapmező-nevek. Tömb a tömbben = összefűzendő mezők (pl. vezetéknév + keresztnév). */
export type MezoJeloltek = Array<string | string[]>;

export interface MezoTerkep {
  nev: MezoJeloltek;
  email: MezoJeloltek;
  telefon: MezoJeloltek;
  uzenet: MezoJeloltek;
}

export interface Oszlop {
  /** Belső kulcs: idopont, nev, email, telefon, uzenet, forrasOldal, allapot, azonosito, urlapNev, egyeb */
  kulcs: string;
  /** A táblázat első sorában szereplő fejléc. */
  fejlec: string;
}

export interface Uzenet {
  azonosito: string;
  /** Igaz, ha az azonosító a Netlifytől jött (nem mi számoltuk). */
  netlifyAzonosito: boolean;
  idopont: number; // epoch ms
  urlapNev: string;
  nev: string;
  email: string;
  telefon: string;
  uzenet: string;
  forrasOldal: string;
  egyebMezok: Array<[string, string]>;
  /** A csapdamező (honeypot) tartalma – normál esetben üres. */
  csapda: string;
  /** IP-cím, csak a korlátozáshoz (nem kerül a táblázatba). */
  ip: string;
}

export interface Szabalyok {
  kotelezo: string[]; // pl. ['nev', 'email', 'uzenet']
  maxHossz: { nev: number; email: number; telefon: number; uzenet: number; egyeb: number };
  maxLinkek: number;
  tiltottSzavak: string[];
  duplikatumAblakPerc: number;
  korlatAblakPerc: number;
  maxUgyanattol: number;
  maxOsszesen: number;
}

export interface Beallitasok {
  mezok: MezoTerkep;
  oszlopok: Oszlop[];
  kihagyottMezok: string[];
  csapdaMezo: string;
  szabalyok: Szabalyok;
  /** Ha nem üres, csak ezeket az űrlapokat dolgozzuk fel (form-name). */
  urlapok: string[];
  ceg: {
    nev: string;
    alairas: string;
    valaszido: string;
    megszolitas: 'tegezo' | 'magazo';
    kiemeloSzin: string;
  };
  visszaigazolas: boolean;
  tablazatUrl: string;
}

export interface KorabbiSor {
  azonosito: string;
  idopont: number; // epoch ms, 0 ha ismeretlen
  email: string;
  uzenet: string;
}

export type DontesTipus = 'uj' | 'hianyos' | 'spam' | 'korlat' | 'duplikatum';

export interface Dontes {
  dontes: DontesTipus;
  /** A táblázat Állapot oszlopába kerülő szöveg ('' = nem írunk sort). */
  allapot: string;
  ertesites: boolean;
  visszaigazolas: boolean;
  okok: string[];
}

// ---------------------------------------------------------------------------
// Alapbeállítások
// ---------------------------------------------------------------------------

export const ALLAPOT = {
  uj: 'Új',
  hianyos: 'Hiányos',
  spam: 'Spam?',
  korlat: 'Túl sok üzenet',
};

export function alapBeallitasok(): Beallitasok {
  return {
    mezok: {
      nev: ['nev', 'name', 'neved', 'teljes-nev', 'full-name', ['vezeteknev', 'keresztnev'], ['first-name', 'last-name']],
      email: ['email', 'e-mail', 'email-cim', 'emailcim', 'mail'],
      telefon: ['telefon', 'telefonszam', 'tel', 'phone', 'mobil'],
      uzenet: ['uzenet', 'uzeneted', 'message', 'body', 'megjegyzes', 'kerdes'],
    },
    oszlopok: [
      { kulcs: 'idopont', fejlec: 'Időpont' },
      { kulcs: 'nev', fejlec: 'Név' },
      { kulcs: 'email', fejlec: 'E-mail' },
      { kulcs: 'telefon', fejlec: 'Telefon' },
      { kulcs: 'uzenet', fejlec: 'Üzenet' },
      { kulcs: 'forrasOldal', fejlec: 'Forrás oldal' },
      { kulcs: 'allapot', fejlec: 'Állapot' },
      { kulcs: 'azonosito', fejlec: 'Azonosító' },
    ],
    kihagyottMezok: ['form-name', 'bot-field', 'ip', 'user_agent', 'referrer', 'g-recaptcha-response'],
    csapdaMezo: 'bot-field',
    szabalyok: {
      kotelezo: ['nev', 'email', 'uzenet'],
      maxHossz: { nev: 120, email: 200, telefon: 40, uzenet: 5000, egyeb: 1000 },
      maxLinkek: 3,
      tiltottSzavak: ['viagra', 'casino', 'kaszinó', 'crypto investment', 'backlink', 'seo services', 'porn'],
      duplikatumAblakPerc: 10,
      korlatAblakPerc: 60,
      maxUgyanattol: 3,
      maxOsszesen: 30,
    },
    urlapok: [],
    ceg: {
      nev: 'Folyam Studio',
      alairas: 'A Folyam Studio csapata',
      valaszido: 'Általában egy munkanapon belül válaszolunk.',
      megszolitas: 'tegezo',
      kiemeloSzin: '#18302E',
    },
    visszaigazolas: false,
    tablazatUrl: '',
  };
}

/** Sekély összefésülés: a felülírás csak a megadott kulcsokat cseréli (a ceg és szabalyok mezőnként). */
export function beallitasokOsszefesul(alap: Beallitasok, felulir: Record<string, unknown>): Beallitasok {
  const ered: Beallitasok = JSON.parse(JSON.stringify(alap));
  const f = felulir || {};
  const kulcsok = Object.keys(f);
  for (let i = 0; i < kulcsok.length; i++) {
    const k = kulcsok[i];
    const ertek = f[k];
    if (ertek === undefined || ertek === null) continue;
    if ((k === 'ceg' || k === 'szabalyok' || k === 'mezok') && typeof ertek === 'object' && !Array.isArray(ertek)) {
      const cel = (ered as unknown as Record<string, Record<string, unknown>>)[k];
      const forras = ertek as Record<string, unknown>;
      const belso = Object.keys(forras);
      for (let j = 0; j < belso.length; j++) {
        if (forras[belso[j]] !== undefined && forras[belso[j]] !== null) cel[belso[j]] = forras[belso[j]];
      }
    } else {
      (ered as unknown as Record<string, unknown>)[k] = ertek;
    }
  }
  return ered;
}

// ---------------------------------------------------------------------------
// Szövegtisztítás
// ---------------------------------------------------------------------------

// Vezérlőkarakterek (a sortörés és a tab kivételével), nulla szélességű és irányváltó karakterek.
const TILTOTT_KARAKTEREK = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function szovegge(ertek: unknown): string {
  if (ertek === undefined || ertek === null) return '';
  if (Array.isArray(ertek)) return ertek.map(szovegge).filter(function (s) { return s !== ''; }).join(', ');
  if (typeof ertek === 'object') return '';
  return String(ertek);
}

/** Többsoros szöveg: vezérlőkarakterek ki, sorvégek egységesítve, max. 2 üres sor egymás után, levágás. */
export function tisztitTobbsoros(ertek: unknown, max: number): string {
  let s = szovegge(ertek);
  if (typeof s.normalize === 'function') s = s.normalize('NFC');
  s = s.replace(/\r\n?/g, '\n').replace(TILTOTT_KARAKTEREK, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return levag(s, max);
}

/** Egysoros szöveg: minden whitespace-sorozat egy szóköz. */
export function tisztitEgysoros(ertek: unknown, max: number): string {
  let s = szovegge(ertek);
  if (typeof s.normalize === 'function') s = s.normalize('NFC');
  s = s.replace(TILTOTT_KARAKTEREK, '').replace(/\s+/g, ' ').trim();
  return levag(s, max);
}

export function levag(s: string, max: number): string {
  if (!max || s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).replace(/\s+$/, '') + '…';
}

/** Mezőnév-összehasonlításhoz: kisbetű, ékezet nélkül, csak betű és szám. */
export function kulcsNormal(k: string): string {
  let s = String(k).toLowerCase();
  if (typeof s.normalize === 'function') s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return s.replace(/[^a-z0-9]/g, '');
}

// RFC 5322 egyszerűsített, gyakorlatban bevált változata. Szándékosan nem túl megengedő.
const EMAIL_MINTA = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function emailNormal(ertek: unknown): string {
  return tisztitEgysoros(ertek, 254).replace(/\s/g, '').toLowerCase();
}

export function ervenyesEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (email.indexOf('..') !== -1) return false;
  const reszek = email.split('@');
  if (reszek.length !== 2 || reszek[0].length > 64) return false;
  if (reszek[0].charAt(0) === '.' || reszek[0].charAt(reszek[0].length - 1) === '.') return false;
  return EMAIL_MINTA.test(email) && /\.[A-Za-z]{2,}$/.test(email);
}

/** Telefonszám: csak számjegy, +, szóköz, kötőjel, zárójel, perjel marad. A 06-os magyar számot +36-ra alakítja. */
export function telefonNormal(ertek: unknown, max: number): string {
  let s = tisztitEgysoros(ertek, 80).replace(/[^0-9+()\-/ ]/g, '').replace(/\s+/g, ' ').trim();
  const szamjegyek = s.replace(/[^0-9]/g, '');
  if (/^06/.test(s.replace(/[^0-9+]/g, '')) && szamjegyek.length >= 10 && szamjegyek.length <= 11) {
    s = '+36 ' + s.replace(/^\D*06\D*/, '');
  }
  return levag(s, max);
}

export function linkekSzama(s: string): number {
  const talalat = s.match(/(https?:\/\/|www\.|\[url[=\]])/gi);
  return talalat ? talalat.length : 0;
}

// ---------------------------------------------------------------------------
// Beküldés kinyerése és mezőleképezés
// ---------------------------------------------------------------------------

/**
 * A kérés törzséből kiveszi a Netlify beküldés-objektumot. Elfogadja:
 *  - a kimenő webhook formáját (maga a beküldés),
 *  - a `submission-created` függvény formáját ({ payload: beküldés }),
 *  - szövegként kapott JSON-t.
 */
export function bekuldesKinyer(torzs: unknown): NetlifyBekuldes {
  let t: unknown = torzs;
  if (typeof t === 'string') {
    t = JSON.parse(t);
  }
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw new Error('A kérés törzse nem JSON-objektum.');
  const obj = t as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as NetlifyBekuldes;
  }
  return obj as NetlifyBekuldes;
}

function adatIndex(adat: Record<string, unknown>): Record<string, string> {
  const ered: Record<string, string> = {};
  const kulcsok = Object.keys(adat);
  for (let i = 0; i < kulcsok.length; i++) {
    const n = kulcsNormal(kulcsok[i]);
    if (!(n in ered)) ered[n] = kulcsok[i];
  }
  return ered;
}

/** Az első nem üres jelölt értéke, és a felhasznált eredeti mezőnevek. */
function jeloltErtek(adat: Record<string, unknown>, index: Record<string, string>, jeloltek: MezoJeloltek): { ertek: string; mezok: string[] } {
  for (let i = 0; i < jeloltek.length; i++) {
    const j = jeloltek[i];
    const lista = Array.isArray(j) ? j : [j];
    const ertekek: string[] = [];
    const mezok: string[] = [];
    for (let k = 0; k < lista.length; k++) {
      const eredeti = index[kulcsNormal(lista[k])];
      if (eredeti === undefined) continue;
      const v = szovegge(adat[eredeti]).trim();
      if (v !== '') {
        ertekek.push(v);
        mezok.push(eredeti);
      }
    }
    if (ertekek.length > 0) return { ertek: ertekek.join(' '), mezok: mezok };
  }
  return { ertek: '', mezok: [] };
}

function idopontKinyer(b: NetlifyBekuldes, most: number): number {
  const s = szovegge(b.created_at);
  if (s) {
    const ms = Date.parse(s);
    if (!isNaN(ms)) return ms;
  }
  return most;
}

function biztonsagosUrl(s: string): string {
  const t = tisztitEgysoros(s, 500);
  return /^https?:\/\/[^\s"'<>]+$/i.test(t) ? t : '';
}

/**
 * Netlify beküldés → egységes Üzenet.
 * A Netlify a `data` alatt adja a mezőket, és hozzáteszi az ip, user_agent, referrer mezőket.
 */
export function lekepez(b: NetlifyBekuldes, beall: Beallitasok, most: number): Uzenet {
  const adat: Record<string, unknown> = (b && b.data && typeof b.data === 'object') ? b.data : {};
  const index = adatIndex(adat);
  const sz = beall.szabalyok;
  const hasznalt: Record<string, boolean> = {};

  const nev = jeloltErtek(adat, index, beall.mezok.nev);
  const email = jeloltErtek(adat, index, beall.mezok.email);
  const tel = jeloltErtek(adat, index, beall.mezok.telefon);
  const uz = jeloltErtek(adat, index, beall.mezok.uzenet);
  const osszes = nev.mezok.concat(email.mezok, tel.mezok, uz.mezok);
  for (let i = 0; i < osszes.length; i++) hasznalt[osszes[i]] = true;

  const kihagyott: Record<string, boolean> = {};
  for (let i = 0; i < beall.kihagyottMezok.length; i++) kihagyott[kulcsNormal(beall.kihagyottMezok[i])] = true;
  kihagyott[kulcsNormal(beall.csapdaMezo)] = true;

  const egyeb: Array<[string, string]> = [];
  const kulcsok = Object.keys(adat);
  for (let i = 0; i < kulcsok.length; i++) {
    const k = kulcsok[i];
    if (hasznalt[k] || kihagyott[kulcsNormal(k)]) continue;
    const v = tisztitTobbsoros(adat[k], sz.maxHossz.egyeb);
    if (v === '') continue;
    egyeb.push([tisztitEgysoros(k, 60), v]);
    if (egyeb.length >= 20) break;
  }

  const csapdaKulcs = index[kulcsNormal(beall.csapdaMezo)];
  const forras = biztonsagosUrl(szovegge(adat.referrer)) || biztonsagosUrl(szovegge(b.site_url));

  const u: Uzenet = {
    azonosito: '',
    netlifyAzonosito: false,
    idopont: idopontKinyer(b || {}, most),
    urlapNev: tisztitEgysoros(b.form_name || adat['form-name'], 100),
    nev: tisztitEgysoros(nev.ertek, sz.maxHossz.nev),
    email: emailNormal(email.ertek).slice(0, sz.maxHossz.email),
    telefon: telefonNormal(tel.ertek, sz.maxHossz.telefon),
    uzenet: tisztitTobbsoros(uz.ertek, sz.maxHossz.uzenet),
    forrasOldal: forras,
    egyebMezok: egyeb,
    csapda: csapdaKulcs ? tisztitEgysoros(adat[csapdaKulcs], 200) : '',
    ip: tisztitEgysoros(adat.ip, 60),
  };
  const id = tisztitEgysoros(b.id, 100);
  if (id) {
    u.azonosito = id;
    u.netlifyAzonosito = true;
  } else {
    // Nincs Netlify-azonosító (pl. kézi teszt): tartalomból számolt, determinisztikus azonosító.
    u.azonosito = 'h-' + hash32(u.email + '|' + u.uzenet + '|' + Math.floor(u.idopont / 60000));
  }
  return u;
}

// ---------------------------------------------------------------------------
// Ellenőrzés, spam, duplikátum, korlátozás
// ---------------------------------------------------------------------------

/** FNV-1a 32 bites hash, 8 hexa jegy. Nem kriptográfiai – csak azonosításra. */
export function hash32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

/** Duplikátumkereséshez: e-mail + üzenet, kisbetűsen, whitespace nélkül (a táblázat esetleges ' előtagja nélkül). */
export function ujjlenyomat(email: string, uzenet: string): string {
  const e = String(email || '').replace(/^'/, '').toLowerCase().trim();
  const u = String(uzenet || '').replace(/^'/, '').toLowerCase().replace(/\s+/g, '');
  return hash32(e + '|' + u);
}

export function hianyzoMezok(u: Uzenet, sz: Szabalyok): string[] {
  const hiany: string[] = [];
  for (let i = 0; i < sz.kotelezo.length; i++) {
    const k = sz.kotelezo[i];
    const v = (u as unknown as Record<string, unknown>)[k];
    if (typeof v !== 'string' || v.trim() === '') hiany.push(k);
  }
  return hiany;
}

export function ervenyesit(u: Uzenet, sz: Szabalyok): { hibak: string[]; spamOkok: string[] } {
  const hibak: string[] = [];
  const spam: string[] = [];
  const hiany = hianyzoMezok(u, sz);
  for (let i = 0; i < hiany.length; i++) hibak.push('hiányzó mező: ' + hiany[i]);
  if (u.email && !ervenyesEmail(u.email)) hibak.push('érvénytelen e-mail-cím');

  if (u.csapda) spam.push('a csapdamező ki van töltve');
  if (linkekSzama(u.uzenet) > sz.maxLinkek) spam.push('túl sok link az üzenetben');
  if (linkekSzama(u.nev) > 0) spam.push('link a név mezőben');
  const egybe = (u.nev + ' ' + u.uzenet).toLowerCase();
  for (let i = 0; i < sz.tiltottSzavak.length; i++) {
    const szo = String(sz.tiltottSzavak[i]).toLowerCase().trim();
    if (szo && egybe.indexOf(szo) !== -1) {
      spam.push('tiltott kifejezés: ' + szo);
      break;
    }
  }
  if (u.uzenet && !/\p{L}/u.test(u.uzenet.replace(/https?:\/\/\S+/g, ''))) spam.push('az üzenetben nincs szöveg, csak link vagy jel');
  return { hibak: hibak, spamOkok: spam };
}

export function duplikatumE(u: Uzenet, korabbiak: KorabbiSor[], ablakPerc: number): string {
  const lenyomat = ujjlenyomat(u.email, u.uzenet);
  const ablak = ablakPerc * 60000;
  for (let i = 0; i < korabbiak.length; i++) {
    const k = korabbiak[i];
    if (k.azonosito && k.azonosito === u.azonosito) return 'ugyanez a beküldés-azonosító már szerepel';
    if (u.uzenet && k.idopont && Math.abs(u.idopont - k.idopont) <= ablak && ujjlenyomat(k.email, k.uzenet) === lenyomat) {
      return 'ugyanez az üzenet ' + ablakPerc + ' percen belül már megérkezett';
    }
  }
  return '';
}

export function korlatTullepve(u: Uzenet, korabbiak: KorabbiSor[], sz: Szabalyok): string {
  const ablak = sz.korlatAblakPerc * 60000;
  let ugyanattol = 0;
  let osszes = 0;
  for (let i = 0; i < korabbiak.length; i++) {
    const k = korabbiak[i];
    if (!k.idopont || u.idopont - k.idopont > ablak || k.idopont - u.idopont > ablak) continue;
    osszes++;
    if (u.email && String(k.email).replace(/^'/, '').toLowerCase() === u.email) ugyanattol++;
  }
  if (u.email && ugyanattol >= sz.maxUgyanattol) return 'ugyanerről a címről ' + ugyanattol + ' üzenet jött ' + sz.korlatAblakPerc + ' percen belül';
  if (osszes >= sz.maxOsszesen) return 'összesen ' + osszes + ' üzenet jött ' + sz.korlatAblakPerc + ' percen belül';
  return '';
}

/** A fő döntés: mi történjen ezzel a beküldéssel. */
export function dont(u: Uzenet, korabbiak: KorabbiSor[], beall: Beallitasok): Dontes {
  const sz = beall.szabalyok;
  const dup = duplikatumE(u, korabbiak, sz.duplikatumAblakPerc);
  if (dup) return { dontes: 'duplikatum', allapot: '', ertesites: false, visszaigazolas: false, okok: [dup] };

  const e = ervenyesit(u, sz);
  if (e.spamOkok.length > 0) return { dontes: 'spam', allapot: ALLAPOT.spam, ertesites: false, visszaigazolas: false, okok: e.spamOkok };

  const korlat = korlatTullepve(u, korabbiak, sz);
  if (korlat) return { dontes: 'korlat', allapot: ALLAPOT.korlat, ertesites: false, visszaigazolas: false, okok: [korlat] };

  if (e.hibak.length > 0) return { dontes: 'hianyos', allapot: ALLAPOT.hianyos, ertesites: true, visszaigazolas: false, okok: e.hibak };

  return { dontes: 'uj', allapot: ALLAPOT.uj, ertesites: true, visszaigazolas: beall.visszaigazolas && ervenyesEmail(u.email), okok: [] };
}

export function urlapEngedelyezett(u: Uzenet, beall: Beallitasok): boolean {
  if (!beall.urlapok || beall.urlapok.length === 0) return true;
  for (let i = 0; i < beall.urlapok.length; i++) {
    if (kulcsNormal(beall.urlapok[i]) === kulcsNormal(u.urlapNev)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Táblázat: sorok írása és olvasása fejléc szerint
// ---------------------------------------------------------------------------

/**
 * Képletbefecskendezés elleni védelem: a =, +, -, @ (és tab/CR) kezdetű szöveget a táblázat
 * képletként értelmezné. Az aposztróf előtag szövegként rögzíti, és a cellában nem látszik.
 */
export function cellaBiztos(ertek: string): string {
  const s = String(ertek);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

/** Egy sor értékei kulcs szerint. Az időpont epoch ms (szám) – a hívó alakítja dátummá. */
export function sorAdatok(u: Uzenet, d: Dontes): Record<string, string | number> {
  const egyeb: string[] = [];
  for (let i = 0; i < u.egyebMezok.length; i++) egyeb.push(u.egyebMezok[i][0] + ': ' + u.egyebMezok[i][1]);
  return {
    idopont: u.idopont,
    nev: u.nev,
    email: u.email,
    telefon: u.telefon,
    uzenet: u.uzenet,
    forrasOldal: u.forrasOldal,
    allapot: d.allapot,
    azonosito: u.azonosito,
    urlapNev: u.urlapNev,
    egyeb: egyeb.join('\n'),
    okok: d.okok.join('; '),
  };
}

/**
 * A táblázat tényleges fejlécsorához igazított értéklista. Ha az ügyfél átrendezi az
 * oszlopokat vagy saját oszlopot (pl. „Megjegyzés”) szúr be, az is működik: ismeretlen fejléc → ''.
 */
export function sorFejlecSzerint(adatok: Record<string, string | number>, fejlecSor: unknown[], oszlopok: Oszlop[]): Array<string | number> {
  const fejlecKulcs: Record<string, string> = {};
  for (let i = 0; i < oszlopok.length; i++) fejlecKulcs[kulcsNormal(oszlopok[i].fejlec)] = oszlopok[i].kulcs;
  const fejlecek = fejlecSor && fejlecSor.length ? fejlecSor : oszlopok.map(function (o) { return o.fejlec; });
  const sor: Array<string | number> = [];
  for (let i = 0; i < fejlecek.length; i++) {
    const kulcs = fejlecKulcs[kulcsNormal(szovegge(fejlecek[i]))];
    const v = kulcs !== undefined ? adatok[kulcs] : undefined;
    sor.push(v === undefined ? '' : v);
  }
  return sor;
}

export function fejlecIndexek(fejlecSor: unknown[], oszlopok: Oszlop[]): Record<string, number> {
  const ered: Record<string, number> = {};
  for (let i = 0; i < oszlopok.length; i++) {
    const cel = kulcsNormal(oszlopok[i].fejlec);
    for (let j = 0; j < fejlecSor.length; j++) {
      if (kulcsNormal(szovegge(fejlecSor[j])) === cel) {
        ered[oszlopok[i].kulcs] = j;
        break;
      }
    }
  }
  return ered;
}

/** Cellaérték → epoch ms. Elfogad Date-et (Apps Script), Sheets-sorszámot (API) és szöveges dátumot. */
export function cellaIdopont(v: unknown): number {
  if (v && typeof v === 'object' && typeof (v as { getTime?: unknown }).getTime === 'function') {
    const ms = (v as Date).getTime();
    return isNaN(ms) ? 0 : ms;
  }
  if (typeof v === 'number' && isFinite(v)) return sorszambolMs(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const ms = Date.parse(v);
    return isNaN(ms) ? 0 : ms;
  }
  return 0;
}

/** A táblázat utolsó soraiból a duplikátum- és korlátellenőrzéshez szükséges adatok. */
export function korabbiSorok(fejlecSor: unknown[], sorok: unknown[][], oszlopok: Oszlop[]): KorabbiSor[] {
  const ix = fejlecIndexek(fejlecSor, oszlopok);
  const ered: KorabbiSor[] = [];
  for (let i = 0; i < sorok.length; i++) {
    const s = sorok[i] || [];
    ered.push({
      azonosito: ix.azonosito !== undefined ? szovegge(s[ix.azonosito]) : '',
      idopont: ix.idopont !== undefined ? cellaIdopont(s[ix.idopont]) : 0,
      email: ix.email !== undefined ? szovegge(s[ix.email]) : '',
      uzenet: ix.uzenet !== undefined ? szovegge(s[ix.uzenet]) : '',
    });
  }
  return ered;
}

// ---------------------------------------------------------------------------
// Idő: Europe/Budapest (Intl nélkül, hogy mindenhol ugyanúgy fusson)
// ---------------------------------------------------------------------------

function utolsoVasarnap0100Utc(ev: number, honap0: number): number {
  const d = new Date(Date.UTC(ev, honap0 + 1, 0, 1, 0, 0)); // a hónap utolsó napja, 01:00 UTC
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
}

/** Budapest eltolása UTC-hez képest percben (EU-szabály: nyári idő márc. utolsó vasárnapjától okt. utolsó vasárnapjáig, 01:00 UTC). */
export function budapestEltolasPerc(ms: number): number {
  const ev = new Date(ms).getUTCFullYear();
  return ms >= utolsoVasarnap0100Utc(ev, 2) && ms < utolsoVasarnap0100Utc(ev, 9) ? 120 : 60;
}

const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

function ketJegy(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** „2026. november 5., 14:32” – budapesti idő szerint. */
export function idoSzoveg(ms: number): string {
  const d = new Date(ms + budapestEltolasPerc(ms) * 60000);
  return d.getUTCFullYear() + '. ' + HONAPOK[d.getUTCMonth()] + ' ' + d.getUTCDate() + '., ' + ketJegy(d.getUTCHours()) + ':' + ketJegy(d.getUTCMinutes());
}

/** „2026.11.05. 14:32:10” – rövid, rendezhető alak naplóba. */
export function idoRovid(ms: number): string {
  const d = new Date(ms + budapestEltolasPerc(ms) * 60000);
  return d.getUTCFullYear() + '.' + ketJegy(d.getUTCMonth() + 1) + '.' + ketJegy(d.getUTCDate()) + '. ' + ketJegy(d.getUTCHours()) + ':' + ketJegy(d.getUTCMinutes()) + ':' + ketJegy(d.getUTCSeconds());
}

/** Google Táblázat-dátumsorszám (1899-12-30 = 0) budapesti falióra-idő szerint. */
export function msbolSorszam(ms: number): number {
  return (ms + budapestEltolasPerc(ms) * 60000) / 86400000 + 25569;
}

export function sorszambolMs(sorszam: number): number {
  const helyi = (sorszam - 25569) * 86400000;
  return helyi - budapestEltolasPerc(helyi - 3600000) * 60000;
}
