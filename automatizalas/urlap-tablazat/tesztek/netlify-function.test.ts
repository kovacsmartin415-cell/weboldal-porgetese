import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { createServer, connect } from 'node:net';
import type { AddressInfo } from 'node:net';
import { konfigKornyezetbol, feldolgoz } from '../netlify-function/submission-created/feldolgozo.ts';
import type { Konfig } from '../netlify-function/submission-created/feldolgozo.ts';
import { jwtAlairas, googleTablazat, privatKulcsNormal } from '../netlify-function/submission-created/google-tablazat.ts';
import type { TablazatKliens } from '../netlify-function/submission-created/google-tablazat.ts';
import { mimeUzenet, kodoltSzo, cimElemez, resendKuldo, smtpKuldo } from '../netlify-function/submission-created/email-kuldes.ts';
import type { KimenoLevel } from '../netlify-function/submission-created/email-kuldes.ts';
import { msbolSorszam } from '../kozos/urlap-logika.ts';
import { mintaBekuldes, MOST } from './minta.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const ENV = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'urlap@projekt.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY: PEM.replace(/\n/g, '\\n'), // ahogy a Netlify felületére bemásolva gyakran kinéz
  GOOGLE_SHEET_ID: 'tablazat123',
  ERTESITES_CIMZETT: 'iroda@pelda.hu, tulaj@pelda.hu',
  RESEND_API_KEY: 're_teszt',
  EMAIL_FELADO: 'Weboldal <urlap@pelda.hu>',
};

function b64urlJson(s: string) {
  return JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

describe('környezeti változók', () => {
  test('alapértékek és automatikus szolgáltatóválasztás', () => {
    const k = konfigKornyezetbol(ENV);
    assert.equal(k.emailSzolgaltato, 'resend');
    assert.deepEqual(k.cimzettek, ['iroda@pelda.hu', 'tulaj@pelda.hu']);
    assert.equal(k.google.lapNev, 'Üzenetek');
    assert.equal(k.google.naploLapNev, 'Hibanapló');
    assert.equal(k.beall.visszaigazolas, false);
    assert.equal(k.beall.tablazatUrl, 'https://docs.google.com/spreadsheets/d/tablazat123/edit');
    assert.equal(konfigKornyezetbol({ ...ENV, RESEND_API_KEY: undefined, SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@gmail.com', SMTP_PASS: 'x' }).emailSzolgaltato, 'smtp');
    assert.equal(konfigKornyezetbol({ ...ENV, RESEND_API_KEY: undefined, ERTESITES_CIMZETT: undefined }).emailSzolgaltato, 'nincs');
  });

  test('cég, visszaigazolás, űrlapszűrés, mezőtérkép JSON-ból', () => {
    const k = konfigKornyezetbol({ ...ENV, VISSZAIGAZOLAS: 'igen', CEG_NEV: 'Kovács Pékség', CEG_ALAIRAS: 'Béla\\nKovács Pékség', MEGSZOLITAS: 'magazo', URLAP_NEVEK: 'kapcsolat, ajanlatkeres', MEZO_TERKEP: '{"uzenet":["igeny"]}' });
    assert.equal(k.beall.visszaigazolas, true);
    assert.equal(k.beall.ceg.nev, 'Kovács Pékség');
    assert.equal(k.beall.ceg.alairas, 'Béla\nKovács Pékség');
    assert.equal(k.beall.ceg.megszolitas, 'magazo');
    assert.deepEqual(k.beall.urlapok, ['kapcsolat', 'ajanlatkeres']);
    assert.deepEqual(k.beall.mezok.uzenet, ['igeny']);
    assert.ok(k.beall.mezok.nev.length > 1);
  });

  test('érthető hibák', () => {
    assert.throws(() => konfigKornyezetbol({}), /Hiányzó környezeti változó\(k\): GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID/);
    assert.throws(() => konfigKornyezetbol({ ...ENV, MEZO_TERKEP: '{rossz' }), /MEZO_TERKEP nem érvényes JSON/);
    assert.throws(() => konfigKornyezetbol({ ...ENV, EMAIL_SZOLGALTATO: 'smtp' }), /SMTP_HOST/);
    assert.throws(() => konfigKornyezetbol({ ...ENV, ERTESITES_CIMZETT: '' }), /ERTESITES_CIMZETT/);
  });
});

describe('Google Sheets kliens', () => {
  test('JWT: RS256 aláírás ellenőrizhető, helyes mezők, \\n-es kulcs is jó', () => {
    const jwt = jwtAlairas(ENV.GOOGLE_SERVICE_ACCOUNT_EMAIL, ENV.GOOGLE_PRIVATE_KEY, MOST);
    const [fej, torzs, alairas] = jwt.split('.');
    assert.deepEqual(b64urlJson(fej), { alg: 'RS256', typ: 'JWT' });
    assert.deepEqual(b64urlJson(torzs), {
      iss: ENV.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token',
      iat: Math.floor(MOST / 1000), exp: Math.floor(MOST / 1000) + 3600,
    });
    const v = createVerify('RSA-SHA256');
    v.update(fej + '.' + torzs);
    assert.equal(v.verify(publicKey, Buffer.from(alairas.replace(/-/g, '+').replace(/_/g, '/'), 'base64')), true);
    assert.equal(privatKulcsNormal('"' + ENV.GOOGLE_PRIVATE_KEY + '"'), PEM);
  });

  function hamisGoogle(lapok: Record<string, unknown[][]>, opciok: { tiltott?: boolean } = {}) {
    const hivasok: Array<{ url: string; init: any; torzs: any }> = [];
    const ids: Record<string, number> = {};
    Object.keys(lapok).forEach((n, i) => { ids[n] = i + 1; });
    const f = async (url: string, init: any = {}) => {
      const torzs = init.body && init.headers['Content-Type'] === 'application/json' ? JSON.parse(init.body) : init.body;
      hivasok.push({ url, init, torzs });
      const valasz = (kod: number, adat: unknown) => new Response(JSON.stringify(adat), { status: kod });
      if (url.startsWith('https://oauth2.googleapis.com/token')) return valasz(200, { access_token: 'tok-1', expires_in: 3600 });
      if (opciok.tiltott) return valasz(403, { error: { message: 'The caller does not have permission' } });
      if (url.includes('/values/')) {
        const nev = decodeURIComponent(url.split('/values/')[1].split('?')[0]).split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");
        return valasz(200, lapok[nev] && lapok[nev].length ? { values: lapok[nev] } : {});
      }
      if (url.includes('?fields=')) return valasz(200, { sheets: Object.keys(ids).map((t) => ({ properties: { title: t, sheetId: ids[t] } })) });
      if (url.endsWith(':batchUpdate')) {
        const r = torzs.requests[0];
        if (r.addSheet) { ids[r.addSheet.properties.title] = 99; return valasz(200, { replies: [{ addSheet: { properties: { sheetId: 99 } } }] }); }
        return valasz(200, { replies: [{}] });
      }
      return valasz(404, {});
    };
    return { f, hivasok };
  }

  const fejlec = ['Időpont', 'Név', 'E-mail', 'Telefon', 'Üzenet', 'Forrás oldal', 'Állapot', 'Azonosító'];

  test('olvasás + appendCells: a szöveg stringValue (nem képlet), az időpont valódi dátum; a token gyorsítótárazva', async () => {
    const g = hamisGoogle({ 'Üzenetek': [fejlec, ['x'], ['y']] });
    const t = googleTablazat({ tablazatId: 'tablazat123', lapNev: 'Üzenetek', naploLapNev: 'Hibanapló', szolgaltatasFiok: ENV.GOOGLE_SERVICE_ACCOUNT_EMAIL, privatKulcs: PEM, fetch: g.f, most: () => MOST });
    const olv = await t.fejlecEsUtolsoSorok(1);
    assert.deepEqual(olv, { fejlec, sorok: [['y']] });
    assert.match(g.hivasok[1].url, /\/values\/'%C3%9Czenetek'!A1%3AZ\?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER$/);
    assert.equal(g.hivasok[1].init.headers.Authorization, 'Bearer tok-1');

    await t.sorHozzaad(fejlec, { idopont: MOST, nev: '=HYPERLINK("x")', email: 'a@b.hu', allapot: 'Új' }, konfigKornyezetbol(ENV).beall.oszlopok);
    const keres = g.hivasok.at(-1)!.torzs.requests[0].appendCells;
    assert.equal(keres.sheetId, 1);
    assert.equal(keres.fields, 'userEnteredValue,userEnteredFormat.numberFormat');
    const ertekek = keres.rows[0].values;
    assert.deepEqual(ertekek[0], { userEnteredValue: { numberValue: msbolSorszam(MOST) }, userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'yyyy.mm.dd. hh:mm' } } });
    assert.deepEqual(ertekek[1], { userEnteredValue: { stringValue: '=HYPERLINK("x")' } });
    assert.deepEqual(ertekek[3], { userEnteredValue: { stringValue: '' } });
    assert.equal(g.hivasok.filter((h) => h.url.includes('oauth2')).length, 1, 'egy token elég');
  });

  test('üres lapra először fejléc kerül; hiányzó naplólap létrejön fejléccel', async () => {
    const g = hamisGoogle({ 'Üzenetek': [] });
    const t = googleTablazat({ tablazatId: 't', lapNev: 'Üzenetek', naploLapNev: 'Hibanapló', szolgaltatasFiok: 'a@b', privatKulcs: PEM, fetch: g.f, most: () => MOST });
    const { fejlec: f0 } = await t.fejlecEsUtolsoSorok(10);
    await t.sorHozzaad(f0, { idopont: MOST, nev: 'Anna' }, konfigKornyezetbol(ENV).beall.oszlopok);
    const sorok = g.hivasok.at(-1)!.torzs.requests[0].appendCells.rows;
    assert.equal(sorok.length, 2);
    assert.equal(sorok[0].values[0].userEnteredValue.stringValue, 'Időpont');
    assert.equal(sorok[1].values[1].userEnteredValue.stringValue, 'Anna');

    await t.naplo('HIBA', 'Próba', 'részletek', 'id1');
    const kerek = g.hivasok.filter((h) => h.url.endsWith(':batchUpdate')).map((h) => h.torzs.requests[0]);
    assert.equal(kerek.at(-3).addSheet.properties.title, 'Hibanapló');
    assert.equal(kerek.at(-2).appendCells.rows[0].values[1].userEnteredValue.stringValue, 'Szint');
    assert.deepEqual(kerek.at(-1).appendCells.rows[0].values.map((v: any) => v.userEnteredValue.stringValue), ['2026.11.05. 14:32:10', 'HIBA', 'Próba', 'részletek', 'id1']);
  });

  test('403-nál érthető tipp a megosztásról', async () => {
    const g = hamisGoogle({ 'Üzenetek': [] }, { tiltott: true });
    const t = googleTablazat({ tablazatId: 't', lapNev: 'Üzenetek', naploLapNev: 'Hibanapló', szolgaltatasFiok: 'a@b', privatKulcs: PEM, fetch: g.f });
    await assert.rejects(t.fejlecEsUtolsoSorok(5), /403: The caller does not have permission \(Megosztottad a táblázatot a szolgáltatásfiók/);
  });
});

describe('feldolgozás (submission-created)', () => {
  function hamisKliensek(o: { olvasHiba?: boolean; irasHiba?: boolean; emailHiba?: boolean; sorok?: unknown[][] } = {}) {
    const irt: any[] = [];
    const naplo: any[] = [];
    const levelek: KimenoLevel[] = [];
    const fej = ['Időpont', 'Név', 'E-mail', 'Telefon', 'Üzenet', 'Forrás oldal', 'Állapot', 'Azonosító'];
    const tablazat: TablazatKliens = {
      async fejlecEsUtolsoSorok() { if (o.olvasHiba) throw new Error('Google Sheets API 403'); return { fejlec: fej, sorok: o.sorok || [] }; },
      async sorHozzaad(f, adatok) { if (o.irasHiba) throw new Error('írási hiba'); irt.push({ f, adatok }); },
      async naplo(szint, esemeny, reszletek, azonosito) { naplo.push([szint, esemeny, reszletek, azonosito]); },
    };
    const email = { async kuld(l: KimenoLevel) { if (o.emailHiba) throw new Error('Resend hiba 401'); levelek.push(l); } };
    return { kl: { tablazat, email }, irt, naplo, levelek };
  }
  const K: Konfig = konfigKornyezetbol({ ...ENV, VISSZAIGAZOLAS: 'igen' });
  const csendes = () => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {}; return () => { console.log = l; console.error = e; }; };

  test('új üzenet: sor + értesítő a tulajdonosnak + visszaigazolás a feladónak', async () => {
    const h = hamisKliensek();
    const vissza = csendes();
    try {
      assert.equal(await feldolgoz({ payload: mintaBekuldes() }, K, h.kl, MOST), 'uj');
    } finally { vissza(); }
    assert.equal(h.irt.length, 1);
    assert.equal(h.irt[0].adatok.allapot, 'Új');
    assert.equal(h.irt[0].adatok.nev, 'Kiss Anna');
    assert.equal(h.levelek.length, 2);
    assert.deepEqual(h.levelek[0].cimzett, ['iroda@pelda.hu', 'tulaj@pelda.hu']);
    assert.equal(h.levelek[0].valaszCim, 'anna.kiss@pelda.hu');
    assert.equal(h.levelek[0].felado, 'Weboldal <urlap@pelda.hu>');
    assert.deepEqual(h.levelek[1].cimzett, ['anna.kiss@pelda.hu']);
    assert.equal(h.levelek[1].valaszCim, 'iroda@pelda.hu');
  });

  test('duplikátum (Netlify-azonosító már a táblázatban) → semmi nem történik, csak napló', async () => {
    const h = hamisKliensek({ sorok: [[msbolSorszam(MOST), 'Kiss Anna', 'anna.kiss@pelda.hu', '', 'x', '', 'Új', '6727a3f0c1e2b40008a1b2c3']] });
    const vissza = csendes();
    try {
      assert.equal(await feldolgoz({ payload: mintaBekuldes() }, K, h.kl, MOST), 'duplikatum');
    } finally { vissza(); }
    assert.equal(h.irt.length + h.levelek.length, 0);
    assert.equal(h.naplo[0][1], 'Ismétlődés kihagyva');
  });

  test('ha a táblázat nem elérhető, az értesítő akkor is kimegy, figyelmeztetéssel', async () => {
    const h = hamisKliensek({ olvasHiba: true });
    const vissza = csendes();
    try {
      assert.equal(await feldolgoz({ payload: mintaBekuldes() }, K, h.kl, MOST), 'uj');
    } finally { vissza(); }
    assert.equal(h.irt.length, 0);
    assert.match(h.levelek[0].html, /NEM került be a táblázatba \(Google Sheets API 403\)/);
    assert.equal(h.naplo[0][1], 'Táblázatba írás sikertelen');
  });

  test('ha se táblázat, se e-mail nem megy, a függvény hibát dob (látszik a Netlify naplójában)', async () => {
    const h = hamisKliensek({ irasHiba: true, emailHiba: true });
    const vissza = csendes();
    try {
      await assert.rejects(feldolgoz({ payload: mintaBekuldes() }, K, h.kl, MOST), /sem a táblázatba, sem e-mailben/);
    } finally { vissza(); }
  });

  test('spam → sor „Spam?” állapottal, levél nélkül; más űrlap → kihagyva', async () => {
    const h = hamisKliensek();
    const vissza = csendes();
    try {
      assert.equal(await feldolgoz({ payload: mintaBekuldes({}, { uzenet: 'http://a.hu http://b.hu http://c.hu http://d.hu' }) }, K, h.kl, MOST), 'spam');
      const csakHirlevel = konfigKornyezetbol({ ...ENV, URLAP_NEVEK: 'hirlevel' });
      assert.equal(await feldolgoz({ payload: mintaBekuldes() }, csakHirlevel, h.kl, MOST), 'kihagyva');
    } finally { vissza(); }
    assert.equal(h.irt[0].adatok.allapot, 'Spam?');
    assert.equal(h.levelek.length, 0);
  });
});

describe('e-mail-küldés', () => {
  const L: KimenoLevel = {
    felado: 'Weboldal űrlap <urlap@pelda.hu>',
    cimzett: ['iroda@pelda.hu'],
    targy: 'Új üzenet a weboldalról: Kiss Anna – árajánlat kérése, hosszabb tárggyal, hogy több darabra törjön',
    html: '<p>Szia</p>\n.pont a sor elején',
    szoveg: 'Szia\n.pont a sor elején',
    valaszCim: 'anna@pelda.hu\r\nBcc: aldozat@pelda.hu',
  };

  test('MIME: kódolt tárgy és név, base64 részek, nincs fejléc-befecskendezés', () => {
    const m = mimeUzenet(L, new Date(MOST), 'HATAR');
    const [fejlecek, ...tobbi] = m.split('\r\n\r\n');
    assert.match(fejlecek, /^From: =\?UTF-8\?B\?[^?]+\?= <urlap@pelda\.hu>\r\nTo: iroda@pelda\.hu\r\n/);
    assert.doesNotMatch(fejlecek, /^Bcc:/m);
    assert.match(fejlecek, /^Reply-To: anna@pelda\.hu Bcc: aldozat@pelda\.hu$/m); // egy sorba lapítva: nem lesz új fejléc
    assert.match(fejlecek, /^Date: Thu, 05 Nov 2026 13:32:10 \+0000$/m);
    assert.match(fejlecek, /Content-Type: multipart\/alternative; boundary="HATAR"/);
    const targySor = fejlecek.split('\r\nSubject: ')[1].split('\r\nDate:')[0];
    for (const d of targySor.split('\r\n ')) assert.ok(d.length <= 75, 'encoded-word túl hosszú: ' + d.length);
    const dekodolt = targySor.split('\r\n ').map((d) => Buffer.from(d.slice(10, -2), 'base64').toString('utf8')).join('');
    assert.equal(dekodolt, L.targy);
    assert.match(tobbi.join('\r\n\r\n'), /--HATAR--\r\n$/);
    const reszek = m.split('--HATAR\r\n').slice(1).map((r) => Buffer.from(r.split('\r\n\r\n')[1].replace(/--HATAR--\r\n$/, ''), 'base64').toString('utf8'));
    assert.deepEqual(reszek, [L.szoveg, L.html]);
    assert.equal(kodoltSzo('Plain ASCII subject'), 'Plain ASCII subject');
    assert.deepEqual(cimElemez('"Kiss Anna" <anna@pelda.hu>'), { nev: 'Kiss Anna', cim: 'anna@pelda.hu' });
  });

  test('Resend: helyes kérés', async () => {
    let keres: any;
    const k = resendKuldo('re_123', async (url, init) => { keres = { url, init }; return new Response('{"id":"x"}', { status: 200 }); });
    await k.kuld(L);
    assert.equal(keres.url, 'https://api.resend.com/emails');
    assert.equal(keres.init.headers.Authorization, 'Bearer re_123');
    const t = JSON.parse(keres.init.body);
    assert.deepEqual(Object.keys(t).sort(), ['from', 'html', 'reply_to', 'subject', 'text', 'to']);
    assert.equal(t.reply_to, 'anna@pelda.hu Bcc: aldozat@pelda.hu');
    const hibas = resendKuldo('rossz', async () => new Response('{"message":"API key is invalid"}', { status: 401 }));
    await assert.rejects(hibas.kuld(L), /Resend hiba 401: .*invalid/);
  });

  test('SMTP: teljes párbeszéd egy hamis szerverrel (AUTH PLAIN, dot-stuffing, QUIT)', async () => {
    const parancsok: string[] = [];
    let adat = '';
    const szerver = createServer((s) => {
      let puffer = '';
      let dataModban = false;
      s.write('220 hamis.szerver ESMTP\r\n');
      s.on('data', (d) => {
        puffer += d.toString('utf8');
        while (true) {
          if (dataModban) {
            const vege = puffer.indexOf('\r\n.\r\n');
            if (vege === -1) return;
            adat = puffer.slice(0, vege);
            puffer = puffer.slice(vege + 5);
            dataModban = false;
            s.write('250 2.0.0 Elfogadva\r\n');
            continue;
          }
          const i = puffer.indexOf('\r\n');
          if (i === -1) return;
          const sor = puffer.slice(0, i);
          puffer = puffer.slice(i + 2);
          parancsok.push(sor);
          if (sor.startsWith('EHLO')) s.write('250-hamis.szerver\r\n250-SIZE 1000000\r\n250 AUTH PLAIN LOGIN\r\n');
          else if (sor.startsWith('AUTH')) s.write('235 2.7.0 OK\r\n');
          else if (sor.startsWith('MAIL') || sor.startsWith('RCPT')) s.write('250 OK\r\n');
          else if (sor === 'DATA') { dataModban = true; s.write('354 Mehet\r\n'); }
          else if (sor === 'QUIT') { s.end('221 Viszlát\r\n'); }
        }
      });
    });
    await new Promise<void>((ok) => szerver.listen(0, '127.0.0.1', ok));
    const port = (szerver.address() as AddressInfo).port;
    try {
      const k = smtpKuldo({ host: '127.0.0.1', port, felhasznalo: 'urlap@pelda.hu', jelszo: 'titok', kapcsolodj: () => connect(port, '127.0.0.1') });
      await k.kuld(L);
    } finally {
      szerver.close();
    }
    assert.deepEqual(parancsok.slice(0, 2), ['EHLO pelda.hu', 'AUTH PLAIN ' + Buffer.from('\u0000urlap@pelda.hu\u0000titok').toString('base64')]);
    assert.deepEqual(parancsok.slice(2), ['MAIL FROM:<urlap@pelda.hu>', 'RCPT TO:<iroda@pelda.hu>', 'DATA', 'QUIT']);
    assert.match(adat, /^From: /);
    assert.match(adat, /Content-Transfer-Encoding: base64/);
  });

  test('SMTP: elutasított bejelentkezésnél érthető hiba', async () => {
    const szerver = createServer((s) => {
      s.write('220 hamis\r\n');
      s.on('data', (d) => {
        const sor = d.toString();
        if (sor.startsWith('EHLO')) s.write('250 hamis\r\n');
        else if (sor.startsWith('AUTH')) s.write('535 5.7.8 Hibás felhasználónév vagy jelszó\r\n');
      });
    });
    await new Promise<void>((ok) => szerver.listen(0, '127.0.0.1', ok));
    const port = (szerver.address() as AddressInfo).port;
    try {
      const k = smtpKuldo({ host: 'x', port, felhasznalo: 'a', jelszo: 'b', kapcsolodj: () => connect(port, '127.0.0.1') });
      await assert.rejects(k.kuld(L), /SMTP hiba \(bejelentkezés\): 535/);
    } finally {
      szerver.close();
    }
  });
});
