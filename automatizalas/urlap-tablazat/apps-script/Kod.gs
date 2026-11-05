/* GENERÁLT FÁJL – a forrás az apps-script/Kod.js és a kozos/*.ts. Újraépítés: npm run build:apps-script */

/**
 * Űrlap → Google Táblázat + e-mail  (Netlify Forms kimenő webhook → Apps Script webalkalmazás)
 * Folyam Studio
 *
 * Mit csinál?
 *   A Netlify minden új űrlapbeküldésnél POST-ot küld ide. A szkript:
 *     1. ellenőrzi a titkos kulcsot (?kulcs=... az URL végén),
 *     2. kiszűri az ismétlődést, a spamet és az elárasztást,
 *     3. új sort ír az „Üzenetek” lapra (Állapot = Új),
 *     4. értesítő e-mailt küld a tulajdonosnak, és ha be van kapcsolva, visszaigazolást a feladónak,
 *     5. minden hibát és kihagyást az „Hibanapló” lapra ír.
 *
 * Beüzemelés (részletesen: README.md):
 *   1. Bővítmények → Apps Script, ide bemásolni ezt a teljes fájlt.
 *   2. Lent a BEALLITASOK-at kitölteni.
 *   3. Futtatás: `beallitas` (engedélyek megadása) → a naplóban megjelenik a titkos kulcs.
 *   4. Telepítés → Új telepítés → Webalkalmazás (Végrehajtás: Én, Hozzáférés: Bárki).
 *   5. Netlify: Form submission notifications → HTTP POST request → URL: <webalkalmazás URL>?kulcs=<kulcs>
 *
 * Miért nem JWS-aláírás?
 *   A Netlify a webhook aláírását az X-Webhook-Signature FEJLÉCBEN küldi, az Apps Script doPost(e)
 *   viszont a kérés fejléceit nem adja át (csak a query paramétereket és a törzset). Ezért a titkos
 *   kulcs az URL-ben utazik. Szigorúbb módhoz lásd: NETLIFY_API_TOKEN a README-ben.
 */

// ============================================================================
// BEÁLLÍTÁSOK – csak ezt a részt kell átírni
// ============================================================================
var BEALLITASOK = {
  // A lapok neve a táblázatban (a `beallitas` futtatás létrehozza őket).
  lapNev: 'Üzenetek',
  naploLapNev: 'Hibanapló',

  // Kinek menjen az értesítő? Üresen hagyva: annak a Google-fióknak, amelyik a szkriptet telepítette.
  // Több címzett vesszővel: 'anna@pelda.hu, bela@pelda.hu'
  ertesitesCimzett: '',

  // A levelekben feladóként megjelenő név.
  feladoNev: 'Weboldal űrlap',

  // A cég adatai a visszaigazoló levélhez.
  ceg: {
    nev: 'Folyam Studio',
    alairas: 'Martin\nFolyam Studio',
    valaszido: 'Általában egy munkanapon belül válaszolunk.',
    megszolitas: 'tegezo', // 'tegezo' vagy 'magazo'
    kiemeloSzin: '#18302E',
  },

  // Kapjon-e a feladó automatikus visszaigazolást? (true / false)
  visszaigazolas: false,

  // Csak ezeket az űrlapokat dolgozzuk fel (a HTML-ben a form name="..." értéke). Üres = mindet.
  urlapok: [],

  // Mezőleképezés: melyik űrlapmezőből legyen a Név, E-mail, Telefon, Üzenet.
  // null = alapértelmezés (nev/name, email, telefon/phone, uzenet/message stb.).
  // Példa: { nev: ['teljes_nev', ['vezeteknev', 'keresztnev']], email: ['email'], telefon: ['tel'], uzenet: ['kerdes'] }
  mezok: null,

  // Hány utolsó sort nézzünk meg ismétlődés és elárasztás után kutatva.
  vizsgaltSorok: 300,

  // Szabályok felülírása (null = alapértelmezés). Pl. { maxUgyanattol: 5, tiltottSzavak: ['kaszinó'] }
  szabalyok: null,
};

// ============================================================================
// Webalkalmazás belépési pontok
// ============================================================================

/** Böngészőből megnyitva csak ennyit mond – így ellenőrizhető, hogy a telepítés él. */
function doGet() {
  return ContentService.createTextOutput('Az űrlap-fogadó működik. (Ide a Netlify POST-ol, böngészőből nincs teendő.)');
}

/** A Netlify kimenő webhookja ide érkezik. */
function doPost(e) {
  try {
    var kulcs = e && e.parameter ? String(e.parameter.kulcs || '') : '';
    var elvart = PropertiesService.getScriptProperties().getProperty('TITKOS_KULCS') || '';
    if (!elvart || !egyezik_(kulcs, elvart)) {
      elutasitasNaplo_();
      return json_({ ok: false });
    }
    var torzs = e && e.postData ? e.postData.contents : '';
    var bekuldes = UrlapLogika.bekuldesKinyer(torzs);
    bekuldes = netlifyEllenorzes_(bekuldes);
    if (!bekuldes) return json_({ ok: false });
    var eredmeny = feldolgoz_(bekuldes);
    return json_({ ok: true, eredmeny: eredmeny });
  } catch (hiba) {
    naplo_('HIBA', 'Feldolgozási hiba', hibaSzoveg_(hiba), '');
    // 200-as választ adunk: a Netlify úgysem tud mit kezdeni a hibával, a beküldés pedig a Netlify
    // felületén is megmarad. A hibát a Hibanapló lap és a végrehajtási napló mutatja.
    return json_({ ok: false });
  }
}

// ============================================================================
// Egyszer futtatandó és karbantartó függvények (a szerkesztő „Futtatás” menüjéből)
// ============================================================================

/** Első beüzemelés: lapok, fejléc, formázás, titkos kulcs. Többször is futtatható, nem töröl semmit. */
function beallitas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Europe/Budapest');
  var beall = beallitasok_();

  var lap = ss.getSheetByName(BEALLITASOK.lapNev) || ss.insertSheet(BEALLITASOK.lapNev);
  if (lap.getLastRow() === 0) {
    var fejlec = beall.oszlopok.map(function (o) { return o.fejlec; });
    lap.getRange(1, 1, 1, fejlec.length).setValues([fejlec]).setFontWeight('bold');
    lap.setFrozenRows(1);
  }
  var ix = UrlapLogika.fejlecIndexek(fejlecSor_(lap), beall.oszlopok);
  if (ix.idopont !== undefined) lap.getRange(2, ix.idopont + 1, lap.getMaxRows() - 1, 1).setNumberFormat('yyyy.mm.dd. hh:mm');
  if (ix.uzenet !== undefined) {
    lap.setColumnWidth(ix.uzenet + 1, 420);
    lap.getRange(2, ix.uzenet + 1, lap.getMaxRows() - 1, 1).setWrap(true);
  }
  if (ix.allapot !== undefined) {
    var szabaly = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Új', 'Folyamatban', 'Megválaszolva', 'Lezárva', 'Hiányos', 'Spam?', 'Túl sok üzenet'], true)
      .setAllowInvalid(true)
      .build();
    lap.getRange(2, ix.allapot + 1, lap.getMaxRows() - 1, 1).setDataValidation(szabaly);
  }

  var naplo = ss.getSheetByName(BEALLITASOK.naploLapNev) || ss.insertSheet(BEALLITASOK.naploLapNev);
  if (naplo.getLastRow() === 0) {
    naplo.getRange(1, 1, 1, 5).setValues([['Időpont', 'Szint', 'Esemény', 'Részletek', 'Azonosító']]).setFontWeight('bold');
    naplo.setFrozenRows(1);
  }

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TITKOS_KULCS')) props.setProperty('TITKOS_KULCS', ujKulcsErtek_());
  // Az engedélykérés miatt itt egyszer meghívjuk a levélküldő szolgáltatást is (nem küld levelet).
  var keret = MailApp.getRemainingDailyQuota();
  Logger.log('Kész. Mai e-mail-keret: ' + keret + ' levél.');
  kulcsMegjelenitese();
}

/** Kiírja a naplóba a titkos kulcsot és a Netlifyba beírandó URL végét. */
function kulcsMegjelenitese() {
  var kulcs = PropertiesService.getScriptProperties().getProperty('TITKOS_KULCS');
  Logger.log('Titkos kulcs: ' + kulcs);
  Logger.log('A Netlifyba ez kerül: <webalkalmazás URL-je>?kulcs=' + kulcs);
}

/** Új titkos kulcs (ha a régi kiszivárgott). Utána a Netlify webhook URL-jét is frissíteni kell! */
function ujKulcs() {
  PropertiesService.getScriptProperties().setProperty('TITKOS_KULCS', ujKulcsErtek_());
  kulcsMegjelenitese();
}

/** Próbaüzenet a Netlify nélkül: sort ír és levelet küld, mintha az űrlapot kitöltötték volna. */
function probaUzenet() {
  var e = feldolgoz_({
    id: 'proba-' + new Date().getTime(),
    form_name: 'kapcsolat',
    site_url: 'https://pelda.netlify.app',
    created_at: new Date().toISOString(),
    data: {
      nev: 'Próba Péter',
      email: Session.getEffectiveUser().getEmail(),
      telefon: '06 30 123 4567',
      uzenet: 'Ez egy próbaüzenet a beüzemeléshez.\nHa ezt látod a táblázatban és a postafiókban, minden működik.',
      referrer: 'https://pelda.netlify.app/kapcsolat/',
    },
  });
  Logger.log(JSON.stringify(e));
}

// ============================================================================
// Belső függvények (a _ végű nevek nem jelennek meg a Futtatás menüben)
// ============================================================================

function beallitasok_() {
  var b = UrlapLogika.beallitasokOsszefesul(UrlapLogika.alapBeallitasok(), {
    ceg: BEALLITASOK.ceg,
    visszaigazolas: BEALLITASOK.visszaigazolas,
    urlapok: BEALLITASOK.urlapok,
    mezok: BEALLITASOK.mezok,
    szabalyok: BEALLITASOK.szabalyok,
  });
  try {
    b.tablazatUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  } catch (e) {
    b.tablazatUrl = '';
  }
  return b;
}

/** A fő folyamat. Visszaadja, mi történt (a válaszba és a próbafüggvénybe). */
function feldolgoz_(bekuldes) {
  var beall = beallitasok_();
  var u = UrlapLogika.lekepez(bekuldes, beall, new Date().getTime());
  if (!UrlapLogika.urlapEngedelyezett(u, beall)) return 'kihagyva: más űrlap (' + u.urlapNev + ')';

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lap = ss.getSheetByName(BEALLITASOK.lapNev);
  if (!lap) throw new Error('Nincs „' + BEALLITASOK.lapNev + '” lap. Futtasd a beallitas függvényt.');

  var zar = LockService.getScriptLock();
  zar.waitLock(30000); // egyszerre csak egy beküldés olvasson és írjon
  var d;
  try {
    var fejlec = fejlecSor_(lap);
    var korabbiak = UrlapLogika.korabbiSorok(fejlec, utolsoSorok_(lap, BEALLITASOK.vizsgaltSorok), beall.oszlopok);
    d = UrlapLogika.dont(u, korabbiak, beall);
    if (d.dontes === 'uj' && ipKorlat_(u.ip, beall.szabalyok)) {
      d = { dontes: 'korlat', allapot: UrlapLogika.ALLAPOT.korlat, ertesites: false, visszaigazolas: false, okok: ['túl sok üzenet ugyanarról a hálózatról'] };
    }
    if (d.dontes === 'duplikatum') {
      naplo_('INFO', 'Ismétlődés kihagyva', d.okok.join('; '), u.azonosito);
      return 'duplikatum';
    }
    sorIras_(lap, fejlec, u, d, beall);
  } finally {
    zar.releaseLock();
  }
  if (d.dontes === 'spam' || d.dontes === 'korlat') {
    naplo_('INFO', d.dontes === 'spam' ? 'Gyanús üzenet (spam?)' : 'Korlátozás', d.okok.join('; '), u.azonosito);
  }

  if (d.ertesites) {
    try {
      var level = UrlapLogika.ertesitoEmail(u, d, beall);
      var opciok = { to: cimzett_(), subject: level.targy, body: level.szoveg, htmlBody: level.html, name: BEALLITASOK.feladoNev };
      if (level.valaszCim) opciok.replyTo = level.valaszCim;
      MailApp.sendEmail(opciok);
    } catch (hiba) {
      naplo_('HIBA', 'Értesítő e-mail nem ment ki', hibaSzoveg_(hiba), u.azonosito);
    }
  }
  if (d.visszaigazolas) {
    try {
      if (MailApp.getRemainingDailyQuota() < 5) {
        naplo_('FIGYELEM', 'Visszaigazolás kihagyva', 'Fogy a napi e-mail-keret, a tulajdonosi értesítőknek tartalékoljuk.', u.azonosito);
      } else {
        var vissza = UrlapLogika.visszaigazoloEmail(u, beall);
        MailApp.sendEmail({ to: u.email, subject: vissza.targy, body: vissza.szoveg, htmlBody: vissza.html, name: beall.ceg.nev || BEALLITASOK.feladoNev, replyTo: cimzett_() });
      }
    } catch (hiba) {
      naplo_('HIBA', 'Visszaigazolás nem ment ki', hibaSzoveg_(hiba), u.azonosito);
    }
  }
  return d.dontes;
}

function sorIras_(lap, fejlec, u, d, beall) {
  var adatok = UrlapLogika.sorAdatok(u, d);
  var sor = UrlapLogika.sorFejlecSzerint(adatok, fejlec, beall.oszlopok).map(function (v, i) {
    var kulcs = oszlopKulcs_(fejlec[i], beall.oszlopok);
    if (kulcs === 'idopont' && typeof v === 'number') return new Date(v);
    return typeof v === 'string' ? UrlapLogika.cellaBiztos(v) : v;
  });
  lap.appendRow(sor);
  var ix = UrlapLogika.fejlecIndexek(fejlec, beall.oszlopok);
  if (ix.idopont !== undefined) lap.getRange(lap.getLastRow(), ix.idopont + 1).setNumberFormat('yyyy.mm.dd. hh:mm');
}

function oszlopKulcs_(fejlec, oszlopok) {
  for (var i = 0; i < oszlopok.length; i++) {
    if (UrlapLogika.kulcsNormal(oszlopok[i].fejlec) === UrlapLogika.kulcsNormal(String(fejlec))) return oszlopok[i].kulcs;
  }
  return '';
}

function fejlecSor_(lap) {
  var oszlopok = lap.getLastColumn();
  return oszlopok > 0 ? lap.getRange(1, 1, 1, oszlopok).getValues()[0] : [];
}

function utolsoSorok_(lap, db) {
  var utolso = lap.getLastRow();
  if (utolso < 2) return [];
  var kezdet = Math.max(2, utolso - db + 1);
  return lap.getRange(kezdet, 1, utolso - kezdet + 1, lap.getLastColumn()).getValues();
}

/** Ugyanarról az IP-ről (hash-elve, nem tároljuk) érkező üzenetek száma óránként, a gyorsítótárban. */
function ipKorlat_(ip, sz) {
  if (!ip) return false;
  var cache = CacheService.getScriptCache();
  var k = 'ip-' + UrlapLogika.hash32('ip|' + ip);
  var db = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(db), sz.korlatAblakPerc * 60);
  return db > sz.maxUgyanattol * 2;
}

/**
 * Szigorú mód (opcionális): ha a Szkripttulajdonságok között van NETLIFY_API_TOKEN, a beküldést
 * a Netlify API-ból újra lekérjük az azonosítója alapján, és CSAK az ott tárolt adatot használjuk.
 * Így hamisított kérés akkor sem kerül a táblázatba, ha a titkos kulcs kiszivárgott.
 */
function netlifyEllenorzes_(bekuldes) {
  var token = PropertiesService.getScriptProperties().getProperty('NETLIFY_API_TOKEN');
  if (!token) return bekuldes;
  var id = String(bekuldes.id || '');
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
    naplo_('FIGYELEM', 'Elutasítva (szigorú mód)', 'Hiányzó vagy hibás beküldés-azonosító.', id);
    return null;
  }
  var valasz = UrlFetchApp.fetch('https://api.netlify.com/api/v1/submissions/' + encodeURIComponent(id), {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  var kod = valasz.getResponseCode();
  if (kod === 200) {
    var adat = JSON.parse(valasz.getContentText());
    var b = Array.isArray(adat) ? adat[0] : adat;
    if (b && String(b.id) === id) return b;
  }
  if (kod === 404 || kod === 200) {
    naplo_('FIGYELEM', 'Elutasítva (szigorú mód)', 'A Netlify nem ismeri ezt a beküldést – hamisított kérés?', id);
    return null;
  }
  // A Netlify API most nem elérhető: a beérkezett adattal megyünk tovább, de feljegyezzük.
  naplo_('FIGYELEM', 'Netlify API nem válaszolt', 'HTTP ' + kod + ' – ellenőrzés nélkül feldolgozva.', id);
  return bekuldes;
}

function cimzett_() {
  return BEALLITASOK.ertesitesCimzett || Session.getEffectiveUser().getEmail();
}

function egyezik_(a, b) {
  // Állandó idejű összehasonlítás (ne lehessen időméréssel kitalálni a kulcsot).
  if (a.length !== b.length) return false;
  var elteres = 0;
  for (var i = 0; i < a.length; i++) elteres |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return elteres === 0;
}

function ujKulcsErtek_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

/** Hibás kulcsú kérések naplózása, óránként legfeljebb 10 sor (hogy a napló ne teljen meg). */
function elutasitasNaplo_() {
  var cache = CacheService.getScriptCache();
  var db = Number(cache.get('elutasitva') || 0) + 1;
  cache.put('elutasitva', String(db), 3600);
  if (db <= 10) naplo_('FIGYELEM', 'Elutasítva: hiányzó vagy hibás kulcs', db === 10 ? 'Ebben az órában több ilyet már nem naplózunk.' : '', '');
}

function naplo_(szint, esemeny, reszletek, azonosito) {
  try {
    console.log(szint + ' | ' + esemeny + ' | ' + reszletek + ' | ' + azonosito);
    var lap = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BEALLITASOK.naploLapNev);
    if (!lap) return;
    lap.appendRow([new Date(), szint, esemeny, UrlapLogika.cellaBiztos(String(reszletek || '')).slice(0, 2000), UrlapLogika.cellaBiztos(String(azonosito || ''))]);
  } catch (e) {
    console.error('A naplózás sem sikerült: ' + e);
  }
}

function hibaSzoveg_(hiba) {
  return hiba && hiba.message ? hiba.message : String(hiba);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ======================================================================
 * KÖZÖS LOGIKA – generált rész, NE szerkeszd itt!
 * Forrás: automatizalas/urlap-tablazat/kozos/*.ts  (npm run build:apps-script)
 * ==================================================================== */
const UrlapLogika = (function () {
"use strict";
// ===== kozos/urlap-logika.ts =====
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

// ---------------------------------------------------------------------------
// Alapbeállítások
// ---------------------------------------------------------------------------

const ALLAPOT = {
  uj: 'Új',
  hianyos: 'Hiányos',
  spam: 'Spam?',
  korlat: 'Túl sok üzenet',
};

function alapBeallitasok() {
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
function beallitasokOsszefesul(alap, felulir) {
  const ered = JSON.parse(JSON.stringify(alap));
  const f = felulir || {};
  const kulcsok = Object.keys(f);
  for (let i = 0; i < kulcsok.length; i++) {
    const k = kulcsok[i];
    const ertek = f[k];
    if (ertek === undefined || ertek === null) continue;
    if ((k === 'ceg' || k === 'szabalyok' || k === 'mezok') && typeof ertek === 'object' && !Array.isArray(ertek)) {
      const cel = (ered)[k];
      const forras = ertek;
      const belso = Object.keys(forras);
      for (let j = 0; j < belso.length; j++) {
        if (forras[belso[j]] !== undefined && forras[belso[j]] !== null) cel[belso[j]] = forras[belso[j]];
      }
    } else {
      (ered)[k] = ertek;
    }
  }
  return ered;
}

// ---------------------------------------------------------------------------
// Szövegtisztítás
// ---------------------------------------------------------------------------

// Vezérlőkarakterek (a sortörés és a tab kivételével), nulla szélességű és irányváltó karakterek.
const TILTOTT_KARAKTEREK = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function szovegge(ertek) {
  if (ertek === undefined || ertek === null) return '';
  if (Array.isArray(ertek)) return ertek.map(szovegge).filter(function (s) { return s !== ''; }).join(', ');
  if (typeof ertek === 'object') return '';
  return String(ertek);
}

/** Többsoros szöveg: vezérlőkarakterek ki, sorvégek egységesítve, max. 2 üres sor egymás után, levágás. */
function tisztitTobbsoros(ertek, max) {
  let s = szovegge(ertek);
  if (typeof s.normalize === 'function') s = s.normalize('NFC');
  s = s.replace(/\r\n?/g, '\n').replace(TILTOTT_KARAKTEREK, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return levag(s, max);
}

/** Egysoros szöveg: minden whitespace-sorozat egy szóköz. */
function tisztitEgysoros(ertek, max) {
  let s = szovegge(ertek);
  if (typeof s.normalize === 'function') s = s.normalize('NFC');
  s = s.replace(TILTOTT_KARAKTEREK, '').replace(/\s+/g, ' ').trim();
  return levag(s, max);
}

function levag(s, max) {
  if (!max || s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).replace(/\s+$/, '') + '…';
}

/** Mezőnév-összehasonlításhoz: kisbetű, ékezet nélkül, csak betű és szám. */
function kulcsNormal(k) {
  let s = String(k).toLowerCase();
  if (typeof s.normalize === 'function') s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return s.replace(/[^a-z0-9]/g, '');
}

// RFC 5322 egyszerűsített, gyakorlatban bevált változata. Szándékosan nem túl megengedő.
const EMAIL_MINTA = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function emailNormal(ertek) {
  return tisztitEgysoros(ertek, 254).replace(/\s/g, '').toLowerCase();
}

function ervenyesEmail(email) {
  if (!email || email.length > 254) return false;
  if (email.indexOf('..') !== -1) return false;
  const reszek = email.split('@');
  if (reszek.length !== 2 || reszek[0].length > 64) return false;
  if (reszek[0].charAt(0) === '.' || reszek[0].charAt(reszek[0].length - 1) === '.') return false;
  return EMAIL_MINTA.test(email) && /\.[A-Za-z]{2,}$/.test(email);
}

/** Telefonszám: csak számjegy, +, szóköz, kötőjel, zárójel, perjel marad. A 06-os magyar számot +36-ra alakítja. */
function telefonNormal(ertek, max) {
  let s = tisztitEgysoros(ertek, 80).replace(/[^0-9+()\-/ ]/g, '').replace(/\s+/g, ' ').trim();
  const szamjegyek = s.replace(/[^0-9]/g, '');
  if (/^06/.test(s.replace(/[^0-9+]/g, '')) && szamjegyek.length >= 10 && szamjegyek.length <= 11) {
    s = '+36 ' + s.replace(/^\D*06\D*/, '');
  }
  return levag(s, max);
}

function linkekSzama(s) {
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
function bekuldesKinyer(torzs) {
  let t = torzs;
  if (typeof t === 'string') {
    t = JSON.parse(t);
  }
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw new Error('A kérés törzse nem JSON-objektum.');
  const obj = t;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload;
  }
  return obj;
}

function adatIndex(adat) {
  const ered = {};
  const kulcsok = Object.keys(adat);
  for (let i = 0; i < kulcsok.length; i++) {
    const n = kulcsNormal(kulcsok[i]);
    if (!(n in ered)) ered[n] = kulcsok[i];
  }
  return ered;
}

/** Az első nem üres jelölt értéke, és a felhasznált eredeti mezőnevek. */
function jeloltErtek(adat, index, jeloltek) {
  for (let i = 0; i < jeloltek.length; i++) {
    const j = jeloltek[i];
    const lista = Array.isArray(j) ? j : [j];
    const ertekek = [];
    const mezok = [];
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

function idopontKinyer(b, most) {
  const s = szovegge(b.created_at);
  if (s) {
    const ms = Date.parse(s);
    if (!isNaN(ms)) return ms;
  }
  return most;
}

function biztonsagosUrl(s) {
  const t = tisztitEgysoros(s, 500);
  return /^https?:\/\/[^\s"'<>]+$/i.test(t) ? t : '';
}

/**
 * Netlify beküldés → egységes Üzenet.
 * A Netlify a `data` alatt adja a mezőket, és hozzáteszi az ip, user_agent, referrer mezőket.
 */
function lekepez(b, beall, most) {
  const adat = (b && b.data && typeof b.data === 'object') ? b.data : {};
  const index = adatIndex(adat);
  const sz = beall.szabalyok;
  const hasznalt = {};

  const nev = jeloltErtek(adat, index, beall.mezok.nev);
  const email = jeloltErtek(adat, index, beall.mezok.email);
  const tel = jeloltErtek(adat, index, beall.mezok.telefon);
  const uz = jeloltErtek(adat, index, beall.mezok.uzenet);
  const osszes = nev.mezok.concat(email.mezok, tel.mezok, uz.mezok);
  for (let i = 0; i < osszes.length; i++) hasznalt[osszes[i]] = true;

  const kihagyott = {};
  for (let i = 0; i < beall.kihagyottMezok.length; i++) kihagyott[kulcsNormal(beall.kihagyottMezok[i])] = true;
  kihagyott[kulcsNormal(beall.csapdaMezo)] = true;

  const egyeb = [];
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

  const u = {
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
function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

/** Duplikátumkereséshez: e-mail + üzenet, kisbetűsen, whitespace nélkül (a táblázat esetleges ' előtagja nélkül). */
function ujjlenyomat(email, uzenet) {
  const e = String(email || '').replace(/^'/, '').toLowerCase().trim();
  const u = String(uzenet || '').replace(/^'/, '').toLowerCase().replace(/\s+/g, '');
  return hash32(e + '|' + u);
}

function hianyzoMezok(u, sz) {
  const hiany = [];
  for (let i = 0; i < sz.kotelezo.length; i++) {
    const k = sz.kotelezo[i];
    const v = (u)[k];
    if (typeof v !== 'string' || v.trim() === '') hiany.push(k);
  }
  return hiany;
}

function ervenyesit(u, sz) {
  const hibak = [];
  const spam = [];
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

function duplikatumE(u, korabbiak, ablakPerc) {
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

function korlatTullepve(u, korabbiak, sz) {
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
function dont(u, korabbiak, beall) {
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

function urlapEngedelyezett(u, beall) {
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
function cellaBiztos(ertek) {
  const s = String(ertek);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

/** Egy sor értékei kulcs szerint. Az időpont epoch ms (szám) – a hívó alakítja dátummá. */
function sorAdatok(u, d) {
  const egyeb = [];
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
function sorFejlecSzerint(adatok, fejlecSor, oszlopok) {
  const fejlecKulcs = {};
  for (let i = 0; i < oszlopok.length; i++) fejlecKulcs[kulcsNormal(oszlopok[i].fejlec)] = oszlopok[i].kulcs;
  const fejlecek = fejlecSor && fejlecSor.length ? fejlecSor : oszlopok.map(function (o) { return o.fejlec; });
  const sor = [];
  for (let i = 0; i < fejlecek.length; i++) {
    const kulcs = fejlecKulcs[kulcsNormal(szovegge(fejlecek[i]))];
    const v = kulcs !== undefined ? adatok[kulcs] : undefined;
    sor.push(v === undefined ? '' : v);
  }
  return sor;
}

function fejlecIndexek(fejlecSor, oszlopok) {
  const ered = {};
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
function cellaIdopont(v) {
  if (v && typeof v === 'object' && typeof (v).getTime === 'function') {
    const ms = (v).getTime();
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
function korabbiSorok(fejlecSor, sorok, oszlopok) {
  const ix = fejlecIndexek(fejlecSor, oszlopok);
  const ered = [];
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

function utolsoVasarnap0100Utc(ev, honap0) {
  const d = new Date(Date.UTC(ev, honap0 + 1, 0, 1, 0, 0)); // a hónap utolsó napja, 01:00 UTC
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
}

/** Budapest eltolása UTC-hez képest percben (EU-szabály: nyári idő márc. utolsó vasárnapjától okt. utolsó vasárnapjáig, 01:00 UTC). */
function budapestEltolasPerc(ms) {
  const ev = new Date(ms).getUTCFullYear();
  return ms >= utolsoVasarnap0100Utc(ev, 2) && ms < utolsoVasarnap0100Utc(ev, 9) ? 120 : 60;
}

const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

function ketJegy(n) {
  return n < 10 ? '0' + n : String(n);
}

/** „2026. november 5., 14:32” – budapesti idő szerint. */
function idoSzoveg(ms) {
  const d = new Date(ms + budapestEltolasPerc(ms) * 60000);
  return d.getUTCFullYear() + '. ' + HONAPOK[d.getUTCMonth()] + ' ' + d.getUTCDate() + '., ' + ketJegy(d.getUTCHours()) + ':' + ketJegy(d.getUTCMinutes());
}

/** „2026.11.05. 14:32:10” – rövid, rendezhető alak naplóba. */
function idoRovid(ms) {
  const d = new Date(ms + budapestEltolasPerc(ms) * 60000);
  return d.getUTCFullYear() + '.' + ketJegy(d.getUTCMonth() + 1) + '.' + ketJegy(d.getUTCDate()) + '. ' + ketJegy(d.getUTCHours()) + ':' + ketJegy(d.getUTCMinutes()) + ':' + ketJegy(d.getUTCSeconds());
}

/** Google Táblázat-dátumsorszám (1899-12-30 = 0) budapesti falióra-idő szerint. */
function msbolSorszam(ms) {
  return (ms + budapestEltolasPerc(ms) * 60000) / 86400000 + 25569;
}

function sorszambolMs(sorszam) {
  const helyi = (sorszam - 25569) * 86400000;
  return helyi - budapestEltolasPerc(helyi - 3600000) * 60000;
}

// ===== kozos/email-sablon.ts =====
/*
 * Közös e-mail-sablonok: értesítő a tulajdonosnak és (opcionális) visszaigazolás a feladónak.
 * HTML + sima szöveges változat. Minden, a látogatótól származó adat HTML-escape-elve kerül
 * a levélbe; linket csak általunk épített mailto:/tel: és ellenőrzött http(s) címből készítünk.
 *
 * Ugyanazok a megkötések érvényesek, mint az urlap-logika.ts-re (Apps Scriptben is fut).
 */


// ---------------------------------------------------------------------------
// Escape-elés és biztonságos építőelemek
// ---------------------------------------------------------------------------

function htmlEscape(ertek) {
  return String(ertek === undefined || ertek === null ? '' : ertek)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Többsoros szöveg HTML-be: escape, majd sortörés → <br>. */
function tobbsorosHtml(s) {
  return htmlEscape(s).replace(/\n/g, '<br>\n');
}

/** Levél fejlécébe kerülő szöveg: nincs sortörés (fejléc-befecskendezés ellen), max. hossz. */
function fejlecBiztos(s, max) {
  return levag(String(s).replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim(), max);
}

function biztonsagosSzin(s, alap) {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(s)) ? String(s) : alap;
}

/** Megszólításra alkalmas név? (Nincs benne link, szám, @ – különben a visszaigazolás reklámhordozóvá válhatna.) */
function megszolithatoNev(nev) {
  const n = String(nev || '').trim();
  return /^[\p{L}][\p{L} .'\u2019-]{0,59}$/u.test(n) ? n : '';
}

function telHref(tel) {
  const t = tel.replace(/[^0-9+]/g, '');
  return t.length >= 6 ? 'tel:' + t : '';
}

function mailtoHref(email, targy) {
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

function keret(cim, eloszoveg, tartalom, lablec, kiemelo) {
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

function bekezdes(html, extra) {
  return '<tr><td style="padding:0 24px 16px;font-family:' + BETU + ';font-size:16px;line-height:1.55;color:' + SZIN.szoveg + ';' + (extra || '') + '">' + html + '</td></tr>\n';
}

function gomb(href, felirat, hatter, elso) {
  return '<a href="' + htmlEscape(href) + '" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:6px;font-family:' + BETU +
    ';font-size:16px;font-weight:600;text-decoration:none;' +
    (elso ? 'background:' + hatter + ';color:#FFFFFF;' : 'background:#FFFFFF;color:' + hatter + ';border:2px solid ' + hatter + ';') + '">' + htmlEscape(felirat) + '</a>';
}

// ---------------------------------------------------------------------------
// Értesítő a tulajdonosnak
// ---------------------------------------------------------------------------

function ertesitoTargy(u, d) {
  const elotag = d.dontes === 'hianyos' ? '[Hiányos] ' : '';
  const ki = u.nev || u.email || 'névtelen feladó';
  return fejlecBiztos(elotag + 'Új üzenet a weboldalról: ' + ki, 150);
}

function ertesitoEmail(u, d, beall, figyelmeztetes) {
  const kiemelo = biztonsagosSzin(beall.ceg.kiemeloSzin, '#18302E');
  const targy = ertesitoTargy(u, d);
  const valaszTargy = 'Re: ' + (beall.ceg.nev ? beall.ceg.nev + ' – ' : '') + 'üzeneted';
  const mailto = mailtoHref(u.email, valaszTargy);
  const tel = telHref(u.telefon);
  const ido = idoSzoveg(u.idopont);

  // --- adatsorok (HTML és szöveg párhuzamosan) ---
  const sorokHtml = [];
  const sorokSzoveg = [];
  function adatsor(cimke, ertekHtml, ertekSzoveg) {
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
    const egyeb = [];
    for (let i = 0; i < u.egyebMezok.length; i++) {
      egyeb.push('<tr><td style="padding:4px 12px 4px 0;vertical-align:top;font-family:' + BETU + ';font-size:14px;color:' + SZIN.halvany + ';">' + htmlEscape(u.egyebMezok[i][0]) +
        '</td><td style="padding:4px 0;vertical-align:top;font-family:' + BETU + ';font-size:14px;color:' + SZIN.szoveg + ';word-break:break-word;">' + tobbsorosHtml(u.egyebMezok[i][1]) + '</td></tr>');
    }
    t += '<tr><td style="padding:0 24px 16px;"><div style="font-family:' + BETU + ';font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:' + SZIN.halvany + ';padding-bottom:4px;">További mezők</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0">' + egyeb.join('') + '</table></td></tr>\n';
  }

  const gombok = [];
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
function visszaigazoloEmail(u, beall) {
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
    bekezdesek.filter(function (b) { return !!b; }).reduce(function (acc, b) { return acc.concat([b, '']); }, []),
    [elkoszones, c.alairas, '', '--', lablecSzoveg],
  ).join('\n');

  return { targy: targy, html: html, szoveg: szoveg, valaszCim: '' };
}

return {
  ALLAPOT: ALLAPOT,
  alapBeallitasok: alapBeallitasok,
  beallitasokOsszefesul: beallitasokOsszefesul,
  szovegge: szovegge,
  tisztitTobbsoros: tisztitTobbsoros,
  tisztitEgysoros: tisztitEgysoros,
  levag: levag,
  kulcsNormal: kulcsNormal,
  emailNormal: emailNormal,
  ervenyesEmail: ervenyesEmail,
  telefonNormal: telefonNormal,
  linkekSzama: linkekSzama,
  bekuldesKinyer: bekuldesKinyer,
  lekepez: lekepez,
  hash32: hash32,
  ujjlenyomat: ujjlenyomat,
  hianyzoMezok: hianyzoMezok,
  ervenyesit: ervenyesit,
  duplikatumE: duplikatumE,
  korlatTullepve: korlatTullepve,
  dont: dont,
  urlapEngedelyezett: urlapEngedelyezett,
  cellaBiztos: cellaBiztos,
  sorAdatok: sorAdatok,
  sorFejlecSzerint: sorFejlecSzerint,
  fejlecIndexek: fejlecIndexek,
  cellaIdopont: cellaIdopont,
  korabbiSorok: korabbiSorok,
  budapestEltolasPerc: budapestEltolasPerc,
  idoSzoveg: idoSzoveg,
  idoRovid: idoRovid,
  msbolSorszam: msbolSorszam,
  sorszambolMs: sorszambolMs,
  htmlEscape: htmlEscape,
  tobbsorosHtml: tobbsorosHtml,
  fejlecBiztos: fejlecBiztos,
  biztonsagosSzin: biztonsagosSzin,
  megszolithatoNev: megszolithatoNev,
  ertesitoTargy: ertesitoTargy,
  ertesitoEmail: ertesitoEmail,
  visszaigazoloEmail: visszaigazoloEmail
};
})();
