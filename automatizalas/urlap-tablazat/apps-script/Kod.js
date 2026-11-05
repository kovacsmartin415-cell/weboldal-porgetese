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
