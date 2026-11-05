import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { KorabbiSor } from '../kozos/urlap-logika.ts';
import {
  alapBeallitasok, beallitasokOsszefesul, bekuldesKinyer, lekepez, ervenyesit, dont, duplikatumE, korlatTullepve,
  cellaBiztos, sorAdatok, sorFejlecSzerint, korabbiSorok, ervenyesEmail, telefonNormal, tisztitTobbsoros, tisztitEgysoros,
  budapestEltolasPerc, idoSzoveg, idoRovid, msbolSorszam, sorszambolMs, urlapEngedelyezett, hash32, ALLAPOT,
} from '../kozos/urlap-logika.ts';
import { mintaBekuldes, MOST } from './minta.ts';

const B = alapBeallitasok();

describe('mezőleképezés', () => {
  test('webhook-alak (közvetlen beküldés) és függvény-alak ({ payload }) ugyanazt adja', () => {
    const b = mintaBekuldes();
    assert.deepEqual(bekuldesKinyer(b), b);
    assert.deepEqual(bekuldesKinyer({ payload: b }), b);
    assert.deepEqual(bekuldesKinyer(JSON.stringify(b)), b);
    assert.throws(() => bekuldesKinyer('[1,2]'), /nem JSON-objektum/);
    assert.throws(() => bekuldesKinyer('nem json'));
  });

  test('alapértelmezett mezők, tisztítás, forrásoldal, azonosító', () => {
    const u = lekepez(mintaBekuldes(), B, MOST);
    assert.equal(u.azonosito, '6727a3f0c1e2b40008a1b2c3');
    assert.equal(u.netlifyAzonosito, true);
    assert.equal(u.nev, 'Kiss Anna');
    assert.equal(u.email, 'anna.kiss@pelda.hu');
    assert.equal(u.telefon, '+36 30 123 4567');
    assert.equal(u.uzenet, 'Szia!\nÉrdekelne egy egyszerű weboldal a pékségünknek.\n\nMikor tudnánk beszélni?');
    assert.equal(u.forrasOldal, 'https://pelda.netlify.app/kapcsolat/');
    assert.equal(u.urlapNev, 'kapcsolat');
    assert.equal(u.idopont, MOST);
    assert.equal(u.ip, '203.0.113.7');
    // A kihagyott (technikai) mezők nem kerülnek az „egyéb” közé, a hozzájárulás igen.
    assert.deepEqual(u.egyebMezok, [['adatkezeles', 'elfogadom']]);
  });

  test('ékezetes / nagybetűs / angol mezőnevek is felismerhetők', () => {
    const u = lekepez(mintaBekuldes({}, { nev: undefined, email: undefined, uzenet: undefined, telefon: undefined, 'Név': 'Nagy Béla', 'E-mail': 'bela@pelda.hu', Message: 'Helló', Phone: '+36 1 234 5678' }), B, MOST);
    assert.equal(u.nev, 'Nagy Béla');
    assert.equal(u.email, 'bela@pelda.hu');
    assert.equal(u.uzenet, 'Helló');
    assert.equal(u.telefon, '+36 1 234 5678');
  });

  test('összefűzött mezők (vezetéknév + keresztnév) és egyedi leképezés', () => {
    const adat = { nev: undefined, vezeteknev: 'Kovács', keresztnev: 'Éva', kerdes: 'Mennyi?', uzenet: undefined };
    const u = lekepez(mintaBekuldes({}, adat), B, MOST);
    assert.equal(u.nev, 'Kovács Éva');
    assert.equal(u.uzenet, 'Mennyi?');
    const sajat = beallitasokOsszefesul(B, { mezok: { uzenet: ['igeny'] } });
    const u2 = lekepez(mintaBekuldes({}, { uzenet: 'ez most egyéb', igeny: 'Webshop kellene' }), sajat, MOST);
    assert.equal(u2.uzenet, 'Webshop kellene');
    assert.deepEqual(u2.egyebMezok.map((m) => m[0]), ['uzenet', 'adatkezeles']);
    assert.deepEqual(sajat.mezok.nev, B.mezok.nev, 'a felül nem írt mezők maradnak');
  });

  test('azonosító nélkül tartalomból számolt, determinisztikus azonosító', () => {
    const b = mintaBekuldes({ id: undefined });
    const a1 = lekepez(b, B, MOST).azonosito;
    assert.match(a1, /^h-[0-9a-f]{8}$/);
    assert.equal(lekepez(b, B, MOST).azonosito, a1);
    assert.equal(lekepez(b, B, MOST).netlifyAzonosito, false);
  });

  test('hiányzó created_at → a „most” időpont; veszélyes referrer → üres forrásoldal helyett site_url', () => {
    const u = lekepez(mintaBekuldes({ created_at: undefined }, { referrer: 'javascript:alert(1)' }), B, MOST + 5000);
    assert.equal(u.idopont, MOST + 5000);
    assert.equal(u.forrasOldal, 'https://pelda.netlify.app');
  });

  test('vezérlő- és irányváltó karakterek kiszűrése, hosszkorlát', () => {
    assert.equal(tisztitEgysoros('a\u0000b\u202Ec\u200B  d\n e', 100), 'abc d e');
    assert.equal(tisztitTobbsoros('x'.repeat(50), 10), 'xxxxxxxxx…');
    const u = lekepez(mintaBekuldes({}, { uzenet: 'y'.repeat(9000) }), B, MOST);
    assert.equal(u.uzenet.length, B.szabalyok.maxHossz.uzenet);
  });

  test('űrlapszűrés', () => {
    const u = lekepez(mintaBekuldes(), B, MOST);
    assert.equal(urlapEngedelyezett(u, B), true);
    assert.equal(urlapEngedelyezett(u, beallitasokOsszefesul(B, { urlapok: ['Kapcsolat'] })), true);
    assert.equal(urlapEngedelyezett(u, beallitasokOsszefesul(B, { urlapok: ['hirlevel'] })), false);
  });
});

describe('validálás és spam', () => {
  test('e-mail-cím ellenőrzés', () => {
    for (const jo of ['a@b.hu', 'anna.kiss+web@pelda.co.uk', 'x_y@sub.domain.com']) assert.equal(ervenyesEmail(jo), true, jo);
    for (const rossz of ['', 'a@b', 'a@@b.hu', 'a..b@c.hu', '.a@b.hu', 'a@b.h', 'a b@c.hu', 'a@-b.hu', '<a@b.hu>']) assert.equal(ervenyesEmail(rossz), false, rossz);
  });

  test('telefonszám-normalizálás', () => {
    assert.equal(telefonNormal('06-30/123-4567', 40), '+36 30/123-4567');
    assert.equal(telefonNormal('+36 (1) 234 5678', 40), '+36 (1) 234 5678');
    assert.equal(telefonNormal('hívj: 0630 1234567 <script>', 40), '+36 30 1234567');
  });

  test('hiányzó és hibás mezők', () => {
    const u = lekepez(mintaBekuldes({}, { email: 'nem-email', uzenet: '   ' }), B, MOST);
    assert.deepEqual(ervenyesit(u, B.szabalyok).hibak, ['hiányzó mező: uzenet', 'érvénytelen e-mail-cím']);
  });

  test('spam-jelek: csapdamező, linkek, tiltott szó, link a névben, csak link', () => {
    const okok = (adat: Record<string, unknown>) => ervenyesit(lekepez(mintaBekuldes({}, adat), B, MOST), B.szabalyok).spamOkok;
    assert.deepEqual(okok({}), []);
    assert.match(okok({ 'bot-field': 'x' })[0], /csapda/);
    assert.match(okok({ uzenet: 'http://a.hu http://b.hu www.c.hu [url=d]e[/url]' })[0], /túl sok link/);
    assert.match(okok({ uzenet: 'Best CASINO bonus' })[0], /tiltott kifejezés: casino/);
    assert.match(okok({ nev: 'Buy now https://spam.example' })[0], /link a név/);
    assert.ok(okok({ uzenet: 'https://spam.example/!!!' }).some((o) => /nincs szöveg/.test(o)));
    assert.deepEqual(okok({ uzenet: 'Здравствуйте, нужен сайт' }), [], 'nem latin betűs üzenet nem spam');
  });
});

describe('duplikátum- és elárasztásszűrés', () => {
  const u = lekepez(mintaBekuldes(), B, MOST);
  const sor = (o: Partial<KorabbiSor>): KorabbiSor => Object.assign({ azonosito: 'masik', idopont: MOST - 3600000 * 5, email: 'x@y.hu', uzenet: 'más' }, o);

  test('ugyanaz a Netlify-azonosító → duplikátum (a webhook újrapróbálkozása)', () => {
    assert.match(duplikatumE(u, [sor({ azonosito: u.azonosito })], 10), /azonosító/);
  });

  test('ugyanaz a tartalom 10 percen belül → duplikátum; 10 percen túl → nem', () => {
    const tartalom = { email: "'ANNA.KISS@pelda.hu", uzenet: u.uzenet.replace(/\n/g, '  \n') };
    assert.match(duplikatumE(u, [sor(Object.assign({ idopont: MOST - 9 * 60000 }, tartalom))], 10), /10 percen belül/);
    assert.equal(duplikatumE(u, [sor(Object.assign({ idopont: MOST - 11 * 60000 }, tartalom))], 10), '');
  });

  test('elárasztás: ugyanarról a címről és összesen', () => {
    const harom = [1, 2, 3].map((i) => sor({ email: 'anna.kiss@pelda.hu', idopont: MOST - i * 60000 }));
    assert.match(korlatTullepve(u, harom, B.szabalyok), /ugyanerről a címről 3/);
    assert.equal(korlatTullepve(u, harom.slice(0, 2), B.szabalyok), '');
    const regi = [1, 2, 3].map((i) => sor({ email: 'anna.kiss@pelda.hu', idopont: MOST - 61 * 60000 - i }));
    assert.equal(korlatTullepve(u, regi, B.szabalyok), '', 'az ablakon kívüliek nem számítanak');
    const sok = Array.from({ length: 30 }, (_, i) => sor({ email: 'm' + i + '@x.hu', idopont: MOST - i * 1000 }));
    assert.match(korlatTullepve(u, sok, B.szabalyok), /összesen 30/);
  });

  test('döntés: új, hiányos, spam, korlát, duplikátum – és a visszaigazolás feltételei', () => {
    let d = dont(u, [], B);
    assert.deepEqual([d.dontes, d.allapot, d.ertesites, d.visszaigazolas], ['uj', 'Új', true, false]);
    const bekapcs = beallitasokOsszefesul(B, { visszaigazolas: true });
    assert.equal(dont(u, [], bekapcs).visszaigazolas, true);

    const hianyos = lekepez(mintaBekuldes({}, { email: 'rossz' }), bekapcs, MOST);
    d = dont(hianyos, [], bekapcs);
    assert.deepEqual([d.dontes, d.allapot, d.ertesites, d.visszaigazolas], ['hianyos', ALLAPOT.hianyos, true, false]);

    const spam = lekepez(mintaBekuldes({}, { 'bot-field': 'x' }), bekapcs, MOST);
    d = dont(spam, [], bekapcs);
    assert.deepEqual([d.dontes, d.allapot, d.ertesites, d.visszaigazolas], ['spam', 'Spam?', false, false]);

    const harom = [1, 2, 3].map((i) => sor({ email: u.email, idopont: MOST - i * 60000 }));
    d = dont(u, harom, bekapcs);
    assert.deepEqual([d.dontes, d.allapot, d.ertesites, d.visszaigazolas], ['korlat', 'Túl sok üzenet', false, false]);

    d = dont(u, [sor({ azonosito: u.azonosito })], bekapcs);
    assert.deepEqual([d.dontes, d.allapot, d.ertesites], ['duplikatum', '', false]);
  });
});

describe('táblázatsor', () => {
  test('képletbefecskendezés elleni védelem', () => {
    assert.equal(cellaBiztos('=HYPERLINK("http://x","katt")'), '\'=HYPERLINK("http://x","katt")');
    assert.equal(cellaBiztos('+36 30 123'), "'+36 30 123");
    assert.equal(cellaBiztos('-1'), "'-1");
    assert.equal(cellaBiztos('@SUM(A1)'), "'@SUM(A1)");
    assert.equal(cellaBiztos('\t=1'), "'\t=1");
    assert.equal(cellaBiztos('Szia'), 'Szia');
  });

  test('sor a tényleges fejléc szerint – átrendezett és saját oszlop is működik', () => {
    const u = lekepez(mintaBekuldes(), B, MOST);
    const adatok = sorAdatok(u, dont(u, [], B));
    const alap = sorFejlecSzerint(adatok, [], B.oszlopok);
    assert.deepEqual(alap, [MOST, 'Kiss Anna', 'anna.kiss@pelda.hu', '+36 30 123 4567', u.uzenet, 'https://pelda.netlify.app/kapcsolat/', 'Új', u.azonosito]);
    const atrendezett = sorFejlecSzerint(adatok, ['Állapot', 'Megjegyzés', 'e-mail', 'NÉV', 'Időpont'], B.oszlopok);
    assert.deepEqual(atrendezett, ['Új', '', 'anna.kiss@pelda.hu', 'Kiss Anna', MOST]);
  });

  test('korábbi sorok beolvasása fejléc szerint (Date, sorszám és szöveg időpont)', () => {
    const fejlec = ['Időpont', 'Név', 'E-mail', 'Telefon', 'Üzenet', 'Forrás oldal', 'Állapot', 'Azonosító'];
    const k = korabbiSorok(fejlec, [
      [new Date(MOST), 'A', 'a@b.hu', '', 'x', '', 'Új', 'id1'],
      [msbolSorszam(MOST), 'B', 'b@b.hu', '', 'y', '', 'Új', 'id2'],
      ['2026-11-05T13:32:10Z', 'C', 'c@b.hu', '', 'z', '', 'Új', 'id3'],
      [],
    ], B.oszlopok);
    assert.deepEqual(k.map((s) => [s.azonosito, s.idopont, s.email]), [['id1', MOST, 'a@b.hu'], ['id2', MOST, 'b@b.hu'], ['id3', MOST, 'c@b.hu'], ['', 0, '']]);
  });
});

describe('idő (Europe/Budapest)', () => {
  test('téli és nyári idő, átállás határán', () => {
    assert.equal(budapestEltolasPerc(Date.parse('2026-01-15T12:00:00Z')), 60);
    assert.equal(budapestEltolasPerc(Date.parse('2026-07-15T12:00:00Z')), 120);
    // 2026: nyári idő márc. 29. 01:00 UTC – okt. 25. 01:00 UTC
    assert.equal(budapestEltolasPerc(Date.parse('2026-03-29T00:59:59Z')), 60);
    assert.equal(budapestEltolasPerc(Date.parse('2026-03-29T01:00:00Z')), 120);
    assert.equal(budapestEltolasPerc(Date.parse('2026-10-25T00:59:59Z')), 120);
    assert.equal(budapestEltolasPerc(Date.parse('2026-10-25T01:00:00Z')), 60);
  });

  test('magyar formázás', () => {
    assert.equal(idoSzoveg(MOST), '2026. november 5., 14:32');
    assert.equal(idoSzoveg(Date.parse('2026-07-01T22:05:00Z')), '2026. július 2., 00:05');
    assert.equal(idoRovid(MOST), '2026.11.05. 14:32:10');
  });

  test('Google Táblázat-sorszám oda-vissza', () => {
    assert.equal(msbolSorszam(Date.parse('1899-12-30T00:00:00Z') - 3600000), 0); // CET éjfél = 0
    for (const ms of [MOST, Date.parse('2026-07-15T08:00:00Z'), Date.parse('2026-03-29T03:00:00Z')]) {
      assert.ok(Math.abs(sorszambolMs(msbolSorszam(ms)) - ms) < 2, new Date(ms).toISOString());
    }
  });

  test('hash32 stabil', () => {
    assert.equal(hash32(''), '811c9dc5');
    assert.equal(hash32('a'), 'e40c292c');
  });
});
