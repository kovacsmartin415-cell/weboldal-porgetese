/*
 * Google Sheets API kliens függőség nélkül: szolgáltatásfiók (service account) JWT → hozzáférési token,
 * majd REST hívások a beépített fetch-csel.
 *
 * Írásnál a spreadsheets.batchUpdate / appendCells kérést használjuk: a szöveg `stringValue`-ként megy,
 * így a táblázat SOHA nem értelmezi képletként (=HYPERLINK... stb.), az időpont pedig valódi dátum lesz.
 */
import { createSign } from 'node:crypto';
import type { Oszlop } from '../../kozos/urlap-logika.ts';
import { sorFejlecSzerint, fejlecIndexek, msbolSorszam, idoRovid, levag } from '../../kozos/urlap-logika.ts';

export const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets/';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

function base64url(s: string | Buffer): string {
  return Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** A Netlify felületére bemásolt kulcsban a sortörés gyakran \n szövegként marad – ezt javítjuk. */
export function privatKulcsNormal(kulcs: string): string {
  return String(kulcs || '').replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim() + '\n';
}

/** RS256-tal aláírt JWT a Google OAuth „jwt-bearer” folyamatához. */
export function jwtAlairas(email: string, privatKulcs: string, mostMs: number, scope: string = SCOPE): string {
  const iat = Math.floor(mostMs / 1000);
  const fej = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const torzs = base64url(JSON.stringify({ iss: email, scope: scope, aud: TOKEN_URL, iat: iat, exp: iat + 3600 }));
  const alairo = createSign('RSA-SHA256');
  alairo.update(fej + '.' + torzs);
  return fej + '.' + torzs + '.' + base64url(alairo.sign(privatKulcsNormal(privatKulcs)));
}

export interface TablazatBeallitas {
  tablazatId: string;
  lapNev: string;
  naploLapNev: string;
  szolgaltatasFiok: string;
  privatKulcs: string;
  fetch?: FetchFn;
  most?: () => number;
}

export interface TablazatKliens {
  fejlecEsUtolsoSorok(db: number): Promise<{ fejlec: unknown[]; sorok: unknown[][] }>;
  sorHozzaad(fejlec: unknown[], adatok: Record<string, string | number>, oszlopok: Oszlop[]): Promise<void>;
  naplo(szint: string, esemeny: string, reszletek: string, azonosito: string): Promise<void>;
}

function lapHivatkozas(nev: string): string {
  return "'" + nev.replace(/'/g, "''") + "'";
}

export function googleTablazat(b: TablazatBeallitas): TablazatKliens {
  const f: FetchFn = b.fetch || ((url, init) => fetch(url, init));
  const most = b.most || Date.now;
  let token = '';
  let tokenLejar = 0;
  let lapIdk: Record<string, number> | null = null;

  async function hozzaferes(): Promise<string> {
    if (token && most() < tokenLejar - 60000) return token;
    const valasz = await f(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(jwtAlairas(b.szolgaltatasFiok, b.privatKulcs, most())),
    });
    const adat = await valasz.json().catch(() => ({}));
    if (!valasz.ok || !adat.access_token) {
      throw new Error('Google-bejelentkezés sikertelen (' + valasz.status + '): ' + (adat.error_description || adat.error || 'ismeretlen hiba') + '. Ellenőrizd a GOOGLE_SERVICE_ACCOUNT_EMAIL és GOOGLE_PRIVATE_KEY változókat.');
    }
    token = adat.access_token;
    tokenLejar = most() + (Number(adat.expires_in) || 3600) * 1000;
    return token;
  }

  async function hivas(modszer: string, ut: string, torzs?: unknown): Promise<any> {
    const init: RequestInit = { method: modszer, headers: { Authorization: 'Bearer ' + (await hozzaferes()) } };
    if (torzs !== undefined) {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(torzs);
    }
    const valasz = await f(API + encodeURIComponent(b.tablazatId) + ut, init);
    const szoveg = await valasz.text();
    if (!valasz.ok) {
      let uzenet = szoveg;
      try { uzenet = JSON.parse(szoveg).error.message; } catch (e) { /* nyers szöveg marad */ }
      const tipp = valasz.status === 403 ? ' (Megosztottad a táblázatot a szolgáltatásfiók e-mail-címével, Szerkesztő joggal?)' : valasz.status === 404 ? ' (Jó a GOOGLE_SHEET_ID?)' : '';
      throw new Error('Google Sheets API ' + valasz.status + ': ' + levag(String(uzenet), 300) + tipp);
    }
    return szoveg ? JSON.parse(szoveg) : {};
  }

  async function lapId(nev: string, letrehoz: boolean): Promise<number> {
    if (!lapIdk || !(nev in lapIdk)) {
      const adat = await hivas('GET', '?fields=' + encodeURIComponent('sheets.properties(sheetId,title)'));
      lapIdk = {};
      for (const l of adat.sheets || []) lapIdk[l.properties.title] = l.properties.sheetId;
    }
    if (nev in lapIdk) return lapIdk[nev];
    if (!letrehoz) throw new Error('Nincs „' + nev + '” nevű lap a táblázatban (GOOGLE_SHEET_TAB).');
    const v = await hivas('POST', ':batchUpdate', { requests: [{ addSheet: { properties: { title: nev } } }] });
    const id = v.replies[0].addSheet.properties.sheetId;
    lapIdk[nev] = id;
    return id;
  }

  function cella(v: string | number, datum: boolean): Record<string, unknown> {
    if (datum && typeof v === 'number') {
      return { userEnteredValue: { numberValue: msbolSorszam(v) }, userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'yyyy.mm.dd. hh:mm' } } };
    }
    if (typeof v === 'number') return { userEnteredValue: { numberValue: v } };
    return { userEnteredValue: { stringValue: String(v) } };
  }

  async function sorokHozzaad(nev: string, sorok: Array<Array<string | number>>, datumOszlop: number, letrehoz: boolean): Promise<void> {
    const id = await lapId(nev, letrehoz);
    await hivas('POST', ':batchUpdate', {
      requests: [{
        appendCells: {
          sheetId: id,
          rows: sorok.map((s, si) => ({ values: s.map((v, i) => cella(v, si === sorok.length - 1 && i === datumOszlop)) })),
          fields: 'userEnteredValue,userEnteredFormat.numberFormat',
        },
      }],
    });
  }

  return {
    async fejlecEsUtolsoSorok(db) {
      const tartomany = encodeURIComponent(lapHivatkozas(b.lapNev) + '!A1:Z');
      const adat = await hivas('GET', '/values/' + tartomany + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');
      const ertekek: unknown[][] = adat.values || [];
      return { fejlec: ertekek[0] || [], sorok: ertekek.slice(1).slice(-db) };
    },

    async sorHozzaad(fejlec, adatok, oszlopok) {
      const sorok: Array<Array<string | number>> = [];
      // Üres lap: először a fejlécet írjuk be.
      if (!fejlec || fejlec.length === 0) sorok.push(oszlopok.map((o) => o.fejlec));
      const tenylegesFejlec = fejlec && fejlec.length ? fejlec : oszlopok.map((o) => o.fejlec);
      sorok.push(sorFejlecSzerint(adatok, tenylegesFejlec, oszlopok));
      const ix = fejlecIndexek(tenylegesFejlec, oszlopok);
      await sorokHozzaad(b.lapNev, sorok, ix.idopont === undefined ? -1 : ix.idopont, false);
    },

    async naplo(szint, esemeny, reszletek, azonosito) {
      await sorokHozzaad(b.naploLapNev, [[idoRovid(most()), szint, esemeny, levag(reszletek || '', 2000), azonosito || '']], -1, true);
    },
  };
}
