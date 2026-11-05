/*
 * Közös e-mail-sablonok: értesítő a tulajdonosnak és (opcionális) visszaigazolás a feladónak.
 * HTML + sima szöveges változat. Minden, a látogatótól származó adat HTML-escape-elve kerül
 * a levélbe; linket csak általunk épített mailto:/tel: és ellenőrzött http(s) címből készítünk.
 *
 * Ugyanazok a megkötések érvényesek, mint az urlap-logika.ts-re (Apps Scriptben is fut).
 */
import type { Uzenet, Beallitasok, Dontes } from './urlap-logika.ts';
import { idoSzoveg, ervenyesEmail, levag } from './urlap-logika.ts';

export interface Level {
  targy: string;
  html: string;
  szoveg: string;
  /** A „Válasz” gomb címzettje; '' ha nincs érvényes cím. */
  valaszCim: string;
}

// ---------------------------------------------------------------------------
// Escape-elés és biztonságos építőelemek
// ---------------------------------------------------------------------------

export function htmlEscape(ertek: unknown): string {
  return String(ertek === undefined || ertek === null ? '' : ertek)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Többsoros szöveg HTML-be: escape, majd sortörés → <br>. */
export function tobbsorosHtml(s: string): string {
  return htmlEscape(s).replace(/\n/g, '<br>\n');
}

/** Levél fejlécébe kerülő szöveg: nincs sortörés (fejléc-befecskendezés ellen), max. hossz. */
export function fejlecBiztos(s: string, max: number): string {
  return levag(String(s).replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim(), max);
}

export function biztonsagosSzin(s: string, alap: string): string {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(s)) ? String(s) : alap;
}

/** Megszólításra alkalmas név? (Nincs benne link, szám, @ – különben a visszaigazolás reklámhordozóvá válhatna.) */
export function megszolithatoNev(nev: string): string {
  const n = String(nev || '').trim();
  return /^[\p{L}][\p{L} .'\u2019-]{0,59}$/u.test(n) ? n : '';
}

function telHref(tel: string): string {
  const t = tel.replace(/[^0-9+]/g, '');
  return t.length >= 6 ? 'tel:' + t : '';
}

function mailtoHref(email: string, targy: string): string {
  if (!ervenyesEmail(email)) return '';
  return 'mailto:' + encodeURIComponent(email).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(targy);
}

// ---------------------------------------------------------------------------
// Közös keret
// ---------------------------------------------------------------------------

const BETU = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SZIN = {
  hatter: '#ECEAE3',
  lap: '#FFFFFF',
  szoveg: '#151819',
  halvany: '#5E615D',
  vonal: '#DAD7CE',
  kiemelo: '#D9B21F',
};

function keret(cim: string, eloszoveg: string, tartalom: string, lablec: string, kiemelo: string): string {
  return '<!DOCTYPE html>\n<html lang="hu">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="color-scheme" content="light">\n<meta name="supported-color-schemes" content="light">\n' +
    '<title>' + htmlEscape(cim) + '</title>\n</head>\n' +
    '<body style="margin:0;padding:0;background:' + SZIN.hatter + ';-webkit-text-size-adjust:100%;">\n' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">' + htmlEscape(eloszoveg) + '</div>\n' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + SZIN.hatter + ';">\n' +
    '<tr><td align="center" style="padding:24px 12px;">\n' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:' + SZIN.lap + ';border-radius:10px;border-top:4px solid ' + kiemelo + ';">\n' +
    tartalom +
    '</table>\n' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">\n' +
    '<tr><td style="padding:16px 8px;font-family:' + BETU + ';font-size:13px;line-height:1.5;color:' + SZIN.halvany + ';">' + lablec + '</td></tr>\n' +
    '</table>\n' +
    '</td></tr>\n</table>\n</body>\n</html>\n';
}

function bekezdes(html: string, extra?: string): string {
  return '<tr><td style="padding:0 24px 16px;font-family:' + BETU + ';font-size:16px;line-height:1.55;color:' + SZIN.szoveg + ';' + (extra || '') + '">' + html + '</td></tr>\n';
}

function gomb(href: string, felirat: string, hatter: string, elso: boolean): string {
  return '<a href="' + htmlEscape(href) + '" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:6px;font-family:' + BETU +
    ';font-size:16px;font-weight:600;text-decoration:none;' +
    (elso ? 'background:' + hatter + ';color:#FFFFFF;' : 'background:#FFFFFF;color:' + hatter + ';border:2px solid ' + hatter + ';') + '">' + htmlEscape(felirat) + '</a>';
}

// ---------------------------------------------------------------------------
// Értesítő a tulajdonosnak
// ---------------------------------------------------------------------------

export function ertesitoTargy(u: Uzenet, d: Dontes): string {
  const elotag = d.dontes === 'hianyos' ? '[Hiányos] ' : '';
  const ki = u.nev || u.email || 'névtelen feladó';
  return fejlecBiztos(elotag + 'Új üzenet a weboldalról: ' + ki, 150);
}

export function ertesitoEmail(u: Uzenet, d: Dontes, beall: Beallitasok, figyelmeztetes?: string): Level {
  const kiemelo = biztonsagosSzin(beall.ceg.kiemeloSzin, '#18302E');
  const targy = ertesitoTargy(u, d);
  const valaszTargy = 'Re: ' + (beall.ceg.nev ? beall.ceg.nev + ' – ' : '') + 'üzeneted';
  const mailto = mailtoHref(u.email, valaszTargy);
  const tel = telHref(u.telefon);
  const ido = idoSzoveg(u.idopont);

  // --- adatsorok (HTML és szöveg párhuzamosan) ---
  const sorokHtml: string[] = [];
  const sorokSzoveg: string[] = [];
  function adatsor(cimke: string, ertekHtml: string, ertekSzoveg: string): void {
    if (!ertekSzoveg) return;
    sorokHtml.push('<tr><td style="padding:6px 0;vertical-align:top;width:110px;font-family:' + BETU + ';font-size:14px;color:' + SZIN.halvany + ';">' + htmlEscape(cimke) +
      '</td><td style="padding:6px 0;vertical-align:top;font-family:' + BETU + ';font-size:16px;color:' + SZIN.szoveg + ';word-break:break-word;overflow-wrap:anywhere;">' + ertekHtml + '</td></tr>');
    sorokSzoveg.push(cimke + ': ' + ertekSzoveg);
  }
  const linkStilus = 'color:' + kiemelo + ';text-decoration:underline;';
  adatsor('E-mail', mailto ? '<a href="' + htmlEscape(mailto) + '" style="' + linkStilus + '">' + htmlEscape(u.email) + '</a>' : htmlEscape(u.email), u.email);
  adatsor('Telefon', tel ? '<a href="' + htmlEscape(tel) + '" style="' + linkStilus + '">' + htmlEscape(u.telefon) + '</a>' : htmlEscape(u.telefon), u.telefon);
  adatsor('Oldal', u.forrasOldal ? '<a href="' + htmlEscape(u.forrasOldal) + '" style="' + linkStilus + '">' + htmlEscape(levag(u.forrasOldal.replace(/^https?:\/\//, ''), 60)) + '</a>' : '', u.forrasOldal);
  adatsor('Időpont', htmlEscape(ido), ido);
  adatsor('Űrlap', htmlEscape(u.urlapNev), u.urlapNev);

  let t = '';
  t += '<tr><td style="padding:24px 24px 4px;font-family:' + BETU + ';font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:' + SZIN.halvany + ';">Új üzenet a weboldalról</td></tr>\n';
  t += '<tr><td style="padding:0 24px 16px;font-family:' + BETU + ';font-size:24px;line-height:1.25;font-weight:700;color:' + SZIN.szoveg + ';word-break:break-word;">' + htmlEscape(u.nev || 'Névtelen feladó') + '</td></tr>\n';
  if (figyelmeztetes) {
    t += bekezdes('<strong>Figyelem:</strong> ' + htmlEscape(figyelmeztetes), 'background:#FFF6D6;border-left:4px solid ' + SZIN.kiemelo + ';padding:12px 16px;');
  }
  if (d.dontes === 'hianyos' && d.okok.length) {
    t += bekezdes('Az üzenet hiányos vagy hibás adatot tartalmaz (' + htmlEscape(d.okok.join(', ')) + '). Visszaigazolást nem küldtünk.', 'color:' + SZIN.halvany + ';font-size:14px;');
  }
  t += '<tr><td style="padding:0 24px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + sorokHtml.join('') + '</table></td></tr>\n';
  t += '<tr><td style="padding:8px 24px 20px;"><div style="border-left:4px solid ' + kiemelo + ';background:#F6F5F1;padding:14px 16px;border-radius:0 6px 6px 0;font-family:' + BETU +
    ';font-size:16px;line-height:1.6;color:' + SZIN.szoveg + ';word-break:break-word;overflow-wrap:anywhere;">' + (u.uzenet ? tobbsorosHtml(u.uzenet) : '<em>(üres üzenet)</em>') + '</div></td></tr>\n';

  if (u.egyebMezok.length) {
    const egyeb: string[] = [];
    for (let i = 0; i < u.egyebMezok.length; i++) {
      egyeb.push('<tr><td style="padding:4px 12px 4px 0;vertical-align:top;font-family:' + BETU + ';font-size:14px;color:' + SZIN.halvany + ';">' + htmlEscape(u.egyebMezok[i][0]) +
        '</td><td style="padding:4px 0;vertical-align:top;font-family:' + BETU + ';font-size:14px;color:' + SZIN.szoveg + ';word-break:break-word;">' + tobbsorosHtml(u.egyebMezok[i][1]) + '</td></tr>');
    }
    t += '<tr><td style="padding:0 24px 16px;"><div style="font-family:' + BETU + ';font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:' + SZIN.halvany + ';padding-bottom:4px;">További mezők</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0">' + egyeb.join('') + '</table></td></tr>\n';
  }

  const gombok: string[] = [];
  if (mailto) gombok.push(gomb(mailto, 'Válasz neki', kiemelo, true));
  if (beall.tablazatUrl && /^https:\/\//.test(beall.tablazatUrl)) gombok.push(gomb(beall.tablazatUrl, 'Táblázat megnyitása', kiemelo, gombok.length === 0));
  if (gombok.length) t += '<tr><td style="padding:0 24px 20px;">' + gombok.join('') + '</td></tr>\n';

  const lablec = 'Ezt a levelet a weboldal kapcsolatfelvételi űrlapja küldte automatikusan. Az üzenet a táblázatba is bekerült' +
    (u.azonosito ? ' (azonosító: ' + htmlEscape(u.azonosito) + ')' : '') + '. ' +
    (mailto ? 'Ha erre a levélre válaszolsz, a válasz közvetlenül a feladóhoz megy.' : '');

  const html = keret(targy, levag(u.uzenet.replace(/\s+/g, ' '), 110), t, lablec, kiemelo);

  const szoveg = [
    'Új üzenet a weboldalról',
    '',
    'Név: ' + (u.nev || '–'),
  ].concat(sorokSzoveg, [
    '',
    figyelmeztetes ? 'FIGYELEM: ' + figyelmeztetes + '\n' : '',
    'Üzenet:',
    u.uzenet || '(üres üzenet)',
    '',
  ]).concat(u.egyebMezok.length ? ['További mezők:'].concat(u.egyebMezok.map(function (m) { return '- ' + m[0] + ': ' + m[1]; }), ['']) : [])
    .concat([
      beall.tablazatUrl ? 'Táblázat: ' + beall.tablazatUrl : '',
      '--',
      'Automatikus értesítés a weboldal űrlapjáról' + (u.azonosito ? ' (azonosító: ' + u.azonosito + ')' : '') + '.',
    ]).filter(function (sor, i, t2) { return !(sor === '' && t2[i - 1] === ''); }).join('\n');

  return { targy: targy, html: html, szoveg: szoveg, valaszCim: ervenyesEmail(u.email) ? u.email : '' };
}

// ---------------------------------------------------------------------------
// Visszaigazolás a feladónak
// ---------------------------------------------------------------------------

/**
 * Szándékosan NEM idézi vissza az üzenetet, és a nevet is csak akkor írja ki, ha névnek látszik:
 * így a visszaigazolás nem használható arra, hogy valaki a mi nevünkben küldjön tartalmat másnak.
 */
export function visszaigazoloEmail(u: Uzenet, beall: Beallitasok): Level {
  const c = beall.ceg;
  const kiemelo = biztonsagosSzin(c.kiemeloSzin, '#18302E');
  const tegez = c.megszolitas !== 'magazo';
  const nev = megszolithatoNev(u.nev);
  const megszolitas = nev ? 'Kedves ' + nev + '!' : (tegez ? 'Szia!' : 'Jó napot kívánunk!');
  const targy = fejlecBiztos((tegez ? 'Megkaptuk az üzeneted' : 'Megkaptuk az üzenetét') + (c.nev ? ' – ' + c.nev : ''), 150);

  const bekezdesek = tegez ? [
    'Köszönjük, hogy írtál, az üzeneted megérkezett hozzánk.',
    c.valaszido,
    'Ha közben eszedbe jut még valami, csak válaszolj erre a levélre, ugyanide fut be.',
    'Ezt a levelet a gép küldte, hogy biztosan tudd: nem veszett el semmi. A választ már ember írja.',
  ] : [
    'Köszönjük, hogy írt nekünk, az üzenete megérkezett.',
    c.valaszido,
    'Ha közben eszébe jut még valami, egyszerűen válaszoljon erre a levélre.',
    'Ezt a levelet a rendszer automatikusan küldte, hogy biztosan tudja: az üzenete nem veszett el. A választ már személyesen írjuk.',
  ];
  const elkoszones = tegez ? 'Üdv,' : 'Üdvözlettel:';
  const lablecSzoveg = tegez
    ? 'Azért kapod ezt a levelet, mert valaki ezzel az e-mail-címmel írt nekünk a weboldalunk űrlapján. Ha nem te voltál, nyugodtan hagyd figyelmen kívül, több levelet nem küldünk.'
    : 'Azért kapja ezt a levelet, mert valaki ezzel az e-mail-címmel írt nekünk a weboldalunk űrlapján. Ha nem Ön volt, kérjük, hagyja figyelmen kívül, több levelet nem küldünk.';

  let t = '<tr><td style="padding:28px 24px 12px;font-family:' + BETU + ';font-size:20px;line-height:1.3;font-weight:700;color:' + SZIN.szoveg + ';">' + htmlEscape(megszolitas) + '</td></tr>\n';
  for (let i = 0; i < bekezdesek.length; i++) {
    if (bekezdesek[i]) t += bekezdes(htmlEscape(bekezdesek[i]));
  }
  t += bekezdes(htmlEscape(elkoszones) + '<br>\n' + tobbsorosHtml(c.alairas), 'padding-bottom:28px;');

  const html = keret(targy, bekezdesek[0], t, htmlEscape(lablecSzoveg), kiemelo);
  const szoveg = [megszolitas, ''].concat(
    bekezdesek.filter(function (b) { return !!b; }).reduce(function (acc: string[], b) { return acc.concat([b, '']); }, []),
    [elkoszones, c.alairas, '', '--', lablecSzoveg],
  ).join('\n');

  return { targy: targy, html: html, szoveg: szoveg, valaszCim: '' };
}
