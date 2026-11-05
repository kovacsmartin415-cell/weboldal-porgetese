import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { alapBeallitasok, beallitasokOsszefesul, lekepez, dont } from '../kozos/urlap-logika.ts';
import { ertesitoEmail, visszaigazoloEmail, htmlEscape, megszolithatoNev, fejlecBiztos, biztonsagosSzin } from '../kozos/email-sablon.ts';
import { mintaBekuldes, MOST } from './minta.ts';

const B = beallitasokOsszefesul(alapBeallitasok(), { tablazatUrl: 'https://docs.google.com/spreadsheets/d/abc/edit' });

function level(adat?: Record<string, unknown>) {
  const u = lekepez(mintaBekuldes({}, adat), B, MOST);
  return { u, l: ertesitoEmail(u, dont(u, [], B), B) };
}

/** Az összes HTML-tag neve és az összes attribútum (durva, de a teszt céljára elég). */
function tagok(html: string): string[] {
  return (html.match(/<\s*([a-zA-Z!][a-zA-Z0-9]*)/g) || []).map((t) => t.replace(/[<\s]/g, '').toLowerCase());
}

describe('értesítő e-mail (tulajdonosnak)', () => {
  test('tartalom: név, adatok, üzenet, gombok, szöveges változat', () => {
    const { l } = level();
    assert.equal(l.targy, 'Új üzenet a weboldalról: Kiss Anna');
    assert.equal(l.valaszCim, 'anna.kiss@pelda.hu');
    assert.match(l.html, /<html lang="hu">/);
    assert.match(l.html, /name="viewport"/);
    assert.match(l.html, /max-width:600px/);
    assert.match(l.html, /Kiss Anna/);
    assert.match(l.html, /href="mailto:anna\.kiss@pelda\.hu\?subject=Re%3A%20Folyam%20Studio%20%E2%80%93%20%C3%BCzeneted"/);
    assert.match(l.html, /href="tel:\+36301234567"/);
    assert.match(l.html, /Szia!<br>\nÉrdekelne/);
    assert.match(l.html, /2026\. november 5\., 14:32/);
    assert.match(l.html, /Táblázat megnyitása/);
    assert.match(l.html, /adatkezeles/);
    assert.match(l.szoveg, /^Új üzenet a weboldalról\n\nNév: Kiss Anna\nE-mail: anna\.kiss@pelda\.hu\nTelefon: \+36 30 123 4567\n/);
    assert.match(l.szoveg, /Üzenet:\nSzia!\nÉrdekelne egy egyszerű weboldal a pékségünknek\.\n\nMikor tudnánk beszélni\?/);
    assert.doesNotMatch(l.szoveg, /\n\n\n/);
    assert.doesNotMatch(l.szoveg, /</);
  });

  test('XSS: a látogató adata sehol nem lesz HTML-tag vagy attribútum', () => {
    const tamado = '"><script>alert(1)</script><img src=x onerror=alert(2)>';
    const { l } = level({
      nev: tamado,
      uzenet: tamado + '\n<a href="javascript:alert(3)">katt</a>',
      telefon: '"><svg onload=alert(4)>',
      referrer: 'https://pelda.hu/"><script>alert(5)</script>',
      'Egyéb <b>mező</b>': '<iframe src=//rossz.hu>',
    });
    const engedett = new Set(['!doctype', 'html', 'head', 'meta', 'title', 'body', 'div', 'table', 'tr', 'td', 'a', 'br', 'em', 'strong']);
    for (const t of tagok(l.html)) assert.ok(engedett.has(t), 'váratlan tag: ' + t);
    assert.doesNotMatch(l.html, /<script|<img|<svg|<iframe|<b>|<[^>]*\son(error|load)=/i);
    assert.doesNotMatch(l.html, /href="javascript:/i);
    assert.match(l.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    // A „mailto:” csak érvényes címhez készül, a tel: csak számjegyekből.
    const hrefek = (l.html.match(/href="([^"]*)"/g) || []);
    for (const h of hrefek) assert.match(h, /^href="(mailto:|tel:\+?\d+"|https:\/\/)/, h);
    // A rossz referrer nem link, helyette a site_url.
    assert.match(l.html, /href="https:\/\/pelda\.netlify\.app"/);
  });

  test('tárgy: nincs sortörés (fejléc-befecskendezés), hosszkorlát, hiányos jelölés', () => {
    const { l } = level({ nev: 'Anna\r\nBcc: aldozat@pelda.hu' });
    assert.doesNotMatch(l.targy, /[\r\n]/);
    assert.equal(fejlecBiztos('a\u2028b\nc', 100), 'a b c');
    assert.ok(fejlecBiztos('x'.repeat(500), 150).length <= 150);
    const u = lekepez(mintaBekuldes({}, { email: 'rossz' }), B, MOST);
    const h = ertesitoEmail(u, dont(u, [], B), B);
    assert.match(h.targy, /^\[Hiányos\] /);
    assert.equal(h.valaszCim, '');
    assert.doesNotMatch(h.html, /mailto:/);
    assert.match(h.html, /érvénytelen e-mail-cím/);
  });

  test('figyelmeztetés blokk (pl. a táblázatba írás nem sikerült) escape-elve', () => {
    const u = lekepez(mintaBekuldes(), B, MOST);
    const l = ertesitoEmail(u, dont(u, [], B), B, 'Hiba <b>403</b>');
    assert.match(l.html, /Figyelem:<\/strong> Hiba &lt;b&gt;403&lt;\/b&gt;/);
    assert.match(l.szoveg, /FIGYELEM: Hiba <b>403<\/b>/);
  });

  test('kiemelőszín csak érvényes hexa lehet', () => {
    assert.equal(biztonsagosSzin('#D9B21F', '#000'), '#D9B21F');
    assert.equal(biztonsagosSzin('red;background:url(x)', '#000'), '#000');
    const rossz = beallitasokOsszefesul(B, { ceg: { kiemeloSzin: '"><script>' } });
    const u = lekepez(mintaBekuldes(), rossz, MOST);
    assert.doesNotMatch(ertesitoEmail(u, dont(u, [], rossz), rossz).html, /<script/);
  });
});

describe('visszaigazoló e-mail (feladónak)', () => {
  test('tegező, emberi hang, nem idézi vissza az üzenetet', () => {
    const u = lekepez(mintaBekuldes({}, { uzenet: 'TITKOS-TARTALOM https://reklam.example' }), B, MOST);
    const l = visszaigazoloEmail(u, B);
    assert.equal(l.targy, 'Megkaptuk az üzeneted – Folyam Studio');
    assert.match(l.szoveg, /^Kedves Kiss Anna!\n\nKöszönjük, hogy írtál/);
    assert.match(l.szoveg, /Általában egy munkanapon belül válaszolunk\./);
    assert.match(l.szoveg, /Ha nem te voltál/);
    assert.doesNotMatch(l.html + l.szoveg, /TITKOS-TARTALOM|reklam\.example/);
    assert.match(l.html, /Kedves Kiss Anna!/);
  });

  test('magázó változat és saját aláírás többsoros', () => {
    const m = beallitasokOsszefesul(B, { ceg: { megszolitas: 'magazo', alairas: 'Kovács Béla\nKovács Pékség' } });
    const l = visszaigazoloEmail(lekepez(mintaBekuldes(), m, MOST), m);
    assert.equal(l.targy, 'Megkaptuk az üzenetét – Folyam Studio');
    assert.match(l.szoveg, /Köszönjük, hogy írt nekünk/);
    assert.match(l.szoveg, /Üdvözlettel:\nKovács Béla\nKovács Pékség/);
    assert.match(l.html, /Kovács Béla<br>\nKovács Pékség/);
  });

  test('gyanús „név” (link, szám, HTML) nem kerül a megszólításba', () => {
    assert.equal(megszolithatoNev("Kiss-Nagy Anna O'Brien"), "Kiss-Nagy Anna O'Brien");
    assert.equal(megszolithatoNev('Nyerj 1000 eurót www.spam.example'), '');
    assert.equal(megszolithatoNev('<b>Anna</b>'), '');
    const u = lekepez(mintaBekuldes({}, { nev: 'Olcsó hitel: www.spam.example' }), B, MOST);
    const l = visszaigazoloEmail(u, B);
    assert.match(l.szoveg, /^Szia!\n/);
    assert.doesNotMatch(l.html + l.szoveg, /spam\.example/);
  });

  test('htmlEscape mind az öt veszélyes karakterre', () => {
    assert.equal(htmlEscape(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    assert.equal(htmlEscape(undefined), '');
  });
});
