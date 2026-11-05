# Élesítés és átadás előtti ellenőrzőlista

Folyam Studio · 0.1-es változat, 2026. november

Minden ügyfélnél végigmegyünk rajta, egyikünk ellenőriz, a másik javít. Ami nem vonatkozik az oldalra, azt „n/a”-val jelöljük, nem hagyjuk üresen. A kitöltött példány a `05-atadas-atveteli-jegyzokonyv.md` mellé megy az ügyfélnek.

| | |
|---|---|
| Ügyfél, domain | {{…}} |
| Ellenőrizte / dátum | {{…}} |
| Commit / deploy azonosító | {{…}} |

---

## 1. Teljesítmény

A Core Web Vitals „jó” küszöbei a web.dev szerint, a valós látogatók 75. percentilisén mérve. Egy kis bolt oldalán valós adat (CrUX) jellemzően nincs, ezért laborméréssel és valódi, olcsó telefonon ellenőrzünk.

- [ ] **LCP** (Largest Contentful Paint, a legnagyobb elem megjelenése) ≤ **2,5 s**
- [ ] **INP** (Interaction to Next Paint, reakció kattintásra) ≤ **200 ms**
- [ ] **CLS** (Cumulative Layout Shift, elugráló tartalom) ≤ **0,1**
- [ ] PageSpeed Insights / Lighthouse, **mobil** profil: mért értékek feljegyezve: LCP ____ s, TBT ____ ms, CLS ____ (belső célunk: Performance ≥ 90)
- [ ] Kipróbálva egy régebbi Android telefonon, mobilneten (nem wifin): az első képernyő 3 másodpercen belül használható
- [ ] Képek: AVIF vagy WebP, a megjelenítési mérethez igazítva, `width` és `height` megadva, a hajtás alatti képek `loading="lazy"`, a fő kép **nem** lazy és `fetchpriority="high"`
- [ ] Betűtípus: saját tárhelyről, `woff2`, csak a használt vastagságok és a latin + latin-ext részhalmaz, `font-display: swap`, a fő betű előtöltve
- [ ] Nincs felesleges JavaScript-könyvtár; a teljes oldal első betöltése {{≤ 500 KB}}
- [ ] Gyorsítótár-fejlécek: a hash-elt fájlok hosszú ideig (`immutable`), a HTML nem

## 2. Akadálymentesség (WCAG 2.2 AA)

Eszközök: axe DevTools vagy WAVE (automatikus, a hibák kb. harmadát találja meg), utána kézi ellenőrzés billentyűzettel és képernyőolvasóval (NVDA Windowson vagy VoiceOver Macen / iPhone-on). Zárójelben a WCAG sikerességi feltétel száma.

**Észlelhető**
- [ ] Minden tartalmi képnek van értelmes `alt` szövege, a díszítő képeké üres (`alt=""`) (1.1.1)
- [ ] Címsorok sorrendben (egy `h1`, utána `h2`, `h3`), listák listaként, táblázat fejléccel (1.3.1)
- [ ] Szövegkontraszt legalább 4,5:1, nagy szövegnél 3:1 (1.4.3)
- [ ] Gombok, mezőkeretek, fókuszjelzés, ikonok kontrasztja legalább 3:1 (1.4.11)
- [ ] 200%-os nagyításnál minden olvasható és használható (1.4.4)
- [ ] 320 CSS px szélességen nincs vízszintes görgetés (1.4.10)
- [ ] Megnövelt sor- és betűközzel sem csúszik szét a szöveg (1.4.12)
- [ ] Ha van videó: felirat (1.2.2); ha automatikusan mozgó elem (körhinta) van: megállítható (2.2.2)

**Kezelhető**
- [ ] Minden elérhető és kezelhető billentyűzettel, nincs billentyűcsapda (2.1.1, 2.1.2)
- [ ] „Ugrás a tartalomhoz” link az oldal elején (2.4.1)
- [ ] Minden oldalnak egyedi, beszédes `<title>`-je van (2.4.2)
- [ ] Logikus fókuszsorrend (2.4.3), a fókusz mindig látszik (2.4.7)
- [ ] A fókuszált elemet nem takarja el teljesen ragadós fejléc, sütisáv vagy csevegőablak (2.4.11, WCAG 2.2-ben új)
- [ ] A linkek szövegéből kiderül, hova visznek (nem „kattints ide”) (2.4.4)
- [ ] Érintési célpontok legalább 24 × 24 CSS px, vagy elég távol vannak egymástól (2.5.8, WCAG 2.2-ben új)
- [ ] Ha valami csak húzással működik, van egy kattintásos megoldás is (2.5.7, WCAG 2.2-ben új)

**Érthető**
- [ ] `<html lang="hu">`, az idegen nyelvű részek külön jelölve (3.1.1, 3.1.2)
- [ ] A kapcsolat / segítség (telefon, e-mail) minden oldalon ugyanott van (3.2.6, WCAG 2.2-ben új)
- [ ] Az űrlap minden mezőjének látható felirata van, a kötelező mezők jelölve (3.3.2)
- [ ] Hibás kitöltésnél a hibaüzenet szövegesen megmondja, mi a baj, és hogyan javítható (3.3.1, 3.3.3)
- [ ] Az űrlap nem kéri kétszer ugyanazt (3.3.7, WCAG 2.2-ben új)
- [ ] Nincs olyan belépés vagy ellenőrzés, ami fejtörőt vagy kód bemásolását igényli, alternatíva nélkül; captchát nem használunk (3.3.8, WCAG 2.2-ben új)

**Robusztus**
- [ ] A saját gombok, menük helyes névvel, szereppel, állapottal (pl. `aria-expanded`) (4.1.2)
- [ ] Az űrlap beküldése utáni visszajelzést a képernyőolvasó is felolvassa (4.1.3)

**Nem WCAG AA, de nálunk alap**
- [ ] `prefers-reduced-motion` mellett nincs folyamatos animáció
- [ ] A telefonszám `tel:` link, az e-mail `mailto:` link
- [ ] Képernyőolvasóval végigmentünk a főoldalon és az űrlapon

## 3. Jogi

- [ ] **Impresszum** kint van, adatai egyeznek a cégkivonattal / nyilvántartással (Ekertv. 4. §, `06-ugyfeloldal-jogi-csomag/impresszum.md`)
- [ ] **Adatkezelési tájékoztató** kint van, azt írja le, ami valóban történik (milyen mezők, hova megy az e-mail, van-e táblázat, ki fér hozzá)
- [ ] Az űrlap alatt egy mondat és link a tájékoztatóhoz; nincs előre bejelölt jelölőnégyzet
- [ ] **Sütik:** a böngésző fejlesztői eszközében (Application → Cookies, Local Storage) ellenőrizve, hogy az első betöltéskor **nincs** nem szükséges süti
- [ ] Ha van analitika: sütisáv, egyforma súlyú „Elfogadom” / „Elutasítom”, a mérés csak elfogadás után töltődik be, **süti-tájékoztató** kint van, „Sütibeállítások” link a láblécben
- [ ] Nincs beágyazott Google Térkép vagy YouTube, ami magától betöltődik (link, statikus kép vagy kattintásra töltés)
- [ ] Betűtípus nem a Google szerveréről töltődik
- [ ] Fotók: minden képnél tudjuk, honnan jön, és van rá engedély (szerződés 5. pont); a lista az átadási dokumentumok között
- [ ] Felismerhető embert ábrázoló fotónál van hozzájárulás
- [ ] Betűtípusok, ikonok, programkönyvtárak licence feljegyezve
- [ ] **Akadálymentességi nyilatkozat** kint van (önkéntes vagy kötelező változat, lásd a sablon elején)
- [ ] Az árak mellett világos, hogy bruttó vagy nettó, és ha fogyasztónak szól, a bruttó ár látszik
- [ ] Adatfeldolgozási megállapodás aláírva, ha hozzáférünk az űrlapadatokhoz (`04`)

## 4. SEO alapok

- [ ] Minden oldalnak egyedi `<title>` (kb. 50–60 karakter, elöl a lényeg és a település: „Valahol Pékség – friss kenyér és torta, Veszprém”)
- [ ] Minden oldalnak egyedi `<meta name="description">` (kb. 120–155 karakter, emberi mondat)
- [ ] Oldalanként egy `h1`
- [ ] `<link rel="canonical">`, a `www` és a csupasz domain közül az egyik átirányít a másikra (301)
- [ ] `sitemap.xml` és `robots.txt` elérhető, a robots nem tilt le mindent (a tesztkörnyezet `noindex`-e **le van véve** élesben)
- [ ] Open Graph címkék (`og:title`, `og:description`, `og:image` 1200 × 630), hogy Messengerben jól nézzen ki a megosztott link
- [ ] Favicon és `apple-touch-icon`
- [ ] Ha volt régi oldal: a régi címek 301-gyel átirányítva az újakra
- [ ] Saját 404-es oldal, link a főoldalra
- [ ] **LocalBusiness JSON-LD** a főoldalon (lent minta), a legpontosabb altípussal: pék → `Bakery`, virágos → `Florist`, borbély → `HairSalon` (schema.org-on nincs külön borbélytípus), asztalos → `HomeAndConstructionBusiness`, kis szállás → `BedAndBreakfast` vagy `LodgingBusiness`
- [ ] JSON-LD ellenőrizve a Google Rich Results Testtel és a validator.schema.org-gal, hiba nélkül
- [ ] **NAP-egyezés:** a név, cím, telefonszám betűre ugyanaz a weboldalon, a JSON-LD-ben, a Google Cégprofilban és a Facebookon (ugyanaz az írásmód: „Kossuth u. 12.” vagy „Kossuth utca 12.”, ugyanaz a telefonformátum)
- [ ] Nyitvatartás egyezik a Google Cégprofillal, ünnepi nyitvatartás felvéve
- [ ] Google Cégprofil: kategória, leírás, fotók, weboldal-link a végleges domainre
- [ ] Google Search Console az **ügyfél fiókjában** hitelesítve, sitemap beküldve

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Bakery",
  "name": "{{Valahol Pékség}}",
  "url": "https://{{valahol-pekseg.hu}}/",
  "telephone": "+36{{…}}",
  "image": "https://{{valahol-pekseg.hu}}/img/bolt.jpg",
  "priceRange": "{{Ft}}",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "{{Kossuth utca 12.}}",
    "addressLocality": "{{Veszprém}}",
    "postalCode": "{{8200}}",
    "addressCountry": "HU"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": {{47.09}}, "longitude": {{17.91}} },
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "06:00", "closes": "18:00" },
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday", "opens": "06:00", "closes": "12:00" }
  ],
  "sameAs": ["{{https://www.facebook.com/…}}"]
}
</script>
```

Szigorú CSP mellett (`script-src 'self'`) az `application/ld+json` blokk adat, nem futó szkript, a böngésző nem tiltja le; ettől függetlenül nézzétek meg a konzolban.

## 5. Biztonság

- [ ] HTTPS működik, a tanúsítvány érvényes, a `http://` cím átirányít `https://`-re
- [ ] Biztonsági fejlécek beállítva (Netlify: `netlify.toml` vagy `_headers`), ellenőrizve a securityheaders.com-on vagy a Mozilla Observatoryn:
  - [ ] `Strict-Transport-Security: max-age=31536000` (az `includeSubDomains` csak akkor, ha minden aldomain HTTPS)
  - [ ] `Content-Security-Policy` (legalább `default-src 'self'`; `frame-ancestors 'none'`; `form-action 'self'`)
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] `Permissions-Policy` (pl. `camera=(), microphone=(), geolocation=()`)
- [ ] Űrlap spam ellen: rejtett csapdamező (Netlify: `netlify-honeypot`), a tárhely spamszűrője bekapcsolva; captcha csak ha elkerülhetetlen (adatvédelmi és akadálymentességi okból)
- [ ] Az űrlap csak a szükséges mezőket kéri, a szabad szöveges mező hossza korlátozva
- [ ] Az automatizálásban (webhook, Apps Script) nincs titkos kulcs a kódban vagy a nyilvános tárolóban; a webhook címe nem szerepel a HTML-ben
- [ ] Saját domainről küldött e-mailnél SPF, DKIM, DMARC rekord beállítva (különben spambe mehet az értesítő)
- [ ] Minden fiókon (regisztrátor, tárhely, Google, GitHub) kétlépcsős azonosítás
- [ ] Függőségek frissek, `npm audit` nem jelez magas kockázatot
- [ ] A tesztcímek (deploy preview) nem indexelhetők, és nem tartalmaznak valódi ügyféladatot

## 6. Űrlap és automatizálás

- [ ] Tesztküldés telefonról és gépről: megérkezik az e-mail {{a tulajdonos címére}}
- [ ] Az e-mail tárgya beszédes („Új tortarendelés: {{név}}, {{dátum}}”), a „Válasz” gomb a beküldőnek válaszol
- [ ] A beküldés bekerül a Google Táblázatba, minden mező a helyére
- [ ] Hiányzó kötelező mezőnél, hibás e-mail-címnél érthető magyar hibaüzenet
- [ ] Köszönőoldal vagy üzenet: mikor számíthat válaszra
- [ ] {{Automatikus visszaigazoló e-mail a beküldőnek, ha kértük}}
- [ ] Mi történik, ha a táblázat nem elérhető? Az e-mail ettől még megérkezik (ellenőrizve)
- [ ] JavaScript nélkül is elküldhető az űrlap
- [ ] A teszt-beküldések törölve élesítés előtt (Netlify és táblázat)

## 7. Mentés

- [ ] A forráskód az ügyfél GitHub-tárolójában vagy ZIP-ben átadva
- [ ] Netlify deploy-előzmények megvannak (egy kattintással visszaállítható az előző változat)
- [ ] Az űrlapbeküldések CSV-be exportálhatók; az ügyfél tudja, hol
- [ ] A Google Táblázat verzióelőzményei bekapcsolva (alapértelmezett), megosztás csak meghívottaknak
- [ ] A DNS-rekordok listája (A, CNAME, MX, TXT) dokumentálva az átadott útmutatóban
- [ ] A fotók eredeti, nagy felbontású változata az ügyfélnél megvan

## 8. Domain és fiókok

- [ ] **A domain az ügyfél nevén van** (a regisztrátor felületén és a nyilvános domainkeresőben ellenőrizve)
- [ ] A regisztrátori fiók az ügyfél e-mail-címével jött létre, a jelszót ő állította be
- [ ] Automatikus megújítás bekapcsolva, a lejárat dátuma az ügyfél naptárában
- [ ] Tárhely, Google Cégprofil, Search Console, {{analitika}}: az ügyfél a tulajdonos, mi meghívott felhasználók vagyunk
- [ ] Az átadás után nem maradt nálunk olyan hozzáférés, amiről nem állapodtunk meg (`05` jegyzőkönyv 2. pont)

## 9. Utolsó kör élesítés előtt

- [ ] Helyesírás-ellenőrzés minden oldalon; a nevek, árak, nyitvatartás az ügyféllel még egyszer jóváhagyatva
- [ ] Minden link működik (belső és külső), nincs `#` vagy `localhost` link
- [ ] Nincs benne lorem ipsum, `{{helyőrző}}`, `[TESZT ADAT]`, „TODO”
- [ ] Kipróbálva: Chrome, Safari (iPhone), Firefox, Samsung Internet
- [ ] Az ügyfél látta és jóváhagyta az élő oldalt
