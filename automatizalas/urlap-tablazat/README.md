# Űrlapból e-mail és táblázatsor

Ha valaki kitölti a weboldal kapcsolati űrlapját, az üzenet magától:

1. új sorként bekerül egy **Google Táblázatba** (Időpont, Név, E-mail, Telefon, Üzenet, Forrás oldal, Állapot = „Új”),
2. **értesítő e-mailben** megérkezik a tulajdonoshoz (a „Válasz” gombbal egyből a feladónak lehet visszaírni),
3. ha be van kapcsolva, a feladó **automatikus visszaigazolást** kap („Megkaptuk az üzeneted…”).

Közben kiszűri az ismétlődést, a spamet és az elárasztást, és minden hibát egy külön **Hibanapló** lapra ír.

Két, egymással egyenértékű megvalósítás van. Mindkettő ingyenes keretben fut, és ugyanazt a közös, tesztelt logikát használja (`kozos/`).

```
A)  űrlap ─▶ Netlify Forms ─▶ kimenő webhook ─▶ Google Apps Script (doPost) ─▶ Táblázat + Gmail
B)  űrlap ─▶ Netlify Forms ─▶ submission-created függvény (Netlify) ─▶ Sheets API + Resend/SMTP
```

---

## Tartalom

- [Melyiket válaszd?](#melyiket-válaszd)
- [A mappa tartalma](#a-mappa-tartalma)
- [A) Apps Script: telepítés lépésről lépésre](#a-apps-script-telepítés-lépésről-lépésre)
- [B) Netlify Function: telepítés lépésről lépésre](#b-netlify-function-telepítés-lépésről-lépésre)
- [Mezők és oszlopok testreszabása](#mezők-és-oszlopok-testreszabása)
- [Mit szűr ki, és mi kerül az Állapot oszlopba?](#mit-szűr-ki-és-mi-kerül-az-állapot-oszlopba)
- [Biztonság](#biztonság)
- [Hibaelhárítás](#hibaelhárítás)
- [GDPR](#gdpr)
- [Költség](#költség)
- [Fejlesztőknek: tesztek, építés](#fejlesztőknek-tesztek-építés)

---

## Melyiket válaszd?

| | **A) Apps Script** | **B) Netlify Function** |
|---|---|---|
| Kinek való | Kisvállalkozás, amelynek a levelezése Gmailben / Google Workspace-ben van | Ha a weboldal kódja nálunk (Folyam Studio) van, és saját domainről menjen a levél |
| Mi kell hozzá | Egy Google-fiók | Google Cloud szolgáltatásfiók + e-mail-szolgáltató (Resend vagy SMTP) |
| Hol fut | Az ügyfél Google-fiókjában | Az ügyfél Netlify-projektjében |
| Beállítás | ~15 perc, kattintgatás, kódot nem kell érteni | ~30 perc, környezeti változók + új telepítés (deploy) |
| A levél feladója | Az ügyfél Gmail-címe | Bármilyen saját cím (pl. `urlap@cegnev.hu`) |
| Webhook-hitelesítés | Titkos kulcs az URL-ben (lásd [Biztonság](#biztonság)) | Nem kell: a Netlify belül hívja, kívülről nem érhető el |
| Napi levélkeret | 100 címzett (ingyenes Gmail), 1500 (Workspace) | Resend: 100/nap, 3000/hó; Gmail SMTP: kb. 500/nap |
| Ha a weboldal kódjához nem nyúlhatunk | ✔ működik | ✖ deploy kell |
| Automatikus adattörlés (megőrzési idő) | ✔ beépítve (`regiUzenetekTorlese`) | kézzel, vagy később ütemezett függvénnyel |

**Röviden:** ha az ügyfél Google-t használ és egyszerűség kell → **A**. Ha a weboldal Netlify-projektje a mi kezünkben van, és fontos a saját domainről küldött, jól kézbesíthető levél → **B**.

Mindkettőnél a Netlify a saját felületén is megőrzi a beküldéseket (Forms menü), így ha az automatizálás valamiért leáll, üzenet akkor sem vész el.

---

## A mappa tartalma

```
urlap-tablazat/
├── README.md                     ← ez a leírás
├── pelda-tablazat-fejlec.csv     ← a táblázat fejléce + egy példasor (importálható)
├── package.json                  ← npm test, npm run build:apps-script, npm run proba
├── kozos/
│   ├── urlap-logika.ts           ← mezőleképezés, validálás, spam-, duplikátum- és elárasztásszűrés, időzóna
│   └── email-sablon.ts           ← értesítő + visszaigazoló levél (HTML + szöveg, XSS-biztos)
├── apps-script/
│   ├── Kod.gs                    ← A) EZT kell bemásolni az Apps Scriptbe (generált, minden benne van)
│   ├── Kod.js                    ← A) az Apps Script-specifikus rész forrása (beállítások az elején)
│   └── appsscript.json           ← A) jegyzékfájl (időzóna, engedélyek, webalkalmazás-beállítás)
├── netlify-function/
│   └── submission-created/       ← B) a Netlify függvény (+ Google Sheets- és e-mail-kliens)
├── eszkozok/
│   ├── apps-script-epites.mjs    ← a Kod.gs összeállítása a forrásokból
│   ├── proba-bekuldes.mjs        ← próbabeküldés az A) webalkalmazásnak
│   └── minta-esemeny.json        ← mintabeküldés (B) helyi próbájához
└── tesztek/                      ← node:test egység- és integrációs tesztek
```

---

## A) Apps Script: telepítés lépésről lépésre

Idő: kb. 15 perc. Kell: az ügyfél Google-fiókja (vagy egy erre a célra létrehozott fiók), és belépés a Netlify-projektbe.

> Tipp: ha az ügyfélnek Google Workspace-e van, abba a fiókba telepíts (nagyobb levélkeret, és a Google ott adatfeldolgozóként szerződik – lásd [GDPR](#gdpr)).

### 1. Google Táblázat létrehozása

1. Nyisd meg: <https://sheets.new> (az ügyfél fiókjával belépve).
2. Bal felül nevezd el, pl. **„Weboldal – beérkezett üzenetek”**.
3. A lapokat és a fejlécet a szkript hozza létre a 4. lépésben – itt nincs más teendő.
   (Ha kézzel szeretnéd: **Fájl → Importálás → Feltöltés → `pelda-tablazat-fejlec.csv`** → „Aktuális lap cseréje”, majd nevezd át a lapot **Üzenetek**-re, és töröld a példasort.)

### 2. Az Apps Script beillesztése

1. A táblázatban: **Bővítmények → Apps Script**. Új lapon megnyílik a szerkesztő.
2. Bal felül a projekt nevére kattintva nevezd el: **„Űrlap-fogadó”**.
3. Bal oldalt a **Fájlok** alatt ott a `Kód.gs` (vagy `Code.gs`). Kattints bele, jelölj ki benne mindent (Ctrl+A / Cmd+A) és töröld.
4. Nyisd meg ebből a mappából az **`apps-script/Kod.gs`** fájlt, másold ki a **teljes** tartalmát, és illeszd be a szerkesztőbe.
5. Mentés: a lemez ikon vagy Ctrl+S.
6. (Ajánlott) Bal oldalt **⚙ Projektbeállítások** → pipáld be: **„Az „appsscript.json” jegyzékfájl megjelenítése a szerkesztőben”**. Vissza a **‹›  Szerkesztő** nézetbe, nyisd meg az `appsscript.json`-t, és cseréld le a tartalmát az **`apps-script/appsscript.json`** tartalmára. Mentés.
   Ettől lesz az időzóna Budapest, és ettől kér a szkript csak annyi engedélyt, amennyi kell (csak ezt az egy táblázatot látja, nem a teljes Drive-ot).

### 3. Beállítások kitöltése

A `Kod.gs` legtetején van a `BEALLITASOK` blokk. Ezeket nézd át:

| Beállítás | Mit írj be |
|---|---|
| `ertesitesCimzett` | Kinek menjen az értesítő. Üresen hagyva: a telepítő Google-fiók címe. Több cím vesszővel. |
| `feladoNev` | A levelekben ez látszik feladónévként, pl. `'Kovács Pékség weboldal'`. |
| `ceg.nev`, `ceg.alairas`, `ceg.valaszido` | A visszaigazoló levélhez. Az aláírásban `\n` = új sor. |
| `ceg.megszolitas` | `'tegezo'` vagy `'magazo'` – igazodjon a weboldal hangneméhez. |
| `visszaigazolas` | `true`, ha a feladó kapjon visszaigazolást. Alapból `false`. |
| `urlapok` | Ha a weboldalon több űrlap van, és csak egyet kell feldolgozni: `['kapcsolat']`. |
| `mezok` | Ha az űrlap mezőnevei eltérnek a megszokottól – lásd [Mezők és oszlopok](#mezők-és-oszlopok-testreszabása). |
| `megorzesNap` | Hány nap után törlődjenek a sorok (GDPR). Egyezzen az adatkezelési tájékoztatóval. |

Mentés (Ctrl+S).

### 4. Első futtatás és engedélyek

1. Fent a függvényválasztóban válaszd ki: **`beallitas`**, majd **▷ Futtatás**.
2. Felugrik: **„Engedélyezés szükséges”** → **Engedélyek áttekintése** → válaszd ki a Google-fiókot.
3. Megjelenhet: **„A Google nem ellenőrizte ezt az alkalmazást”**. Ez saját szkriptnél normális: **Speciális → Ugrás az Űrlap-fogadó oldalra (nem biztonságos)**.
4. Az engedélyek listája: a táblázat szerkesztése, e-mail küldése a nevedben, külső szolgáltatás elérése (csak a szigorú módhoz), időzítők kezelése, e-mail-cím megtekintése → **Engedélyezés**.
5. Lent a **Végrehajtási napló**ban megjelenik:
   ```
   Titkos kulcs: 3f9c…
   A Netlifyba ez kerül: <webalkalmazás URL-je>?kulcs=3f9c…
   ```
   Ezt a kulcsot a 6. lépésben használod. (Bármikor újra kiírathatod a `kulcsMegjelenitese` futtatásával.)
6. A táblázatban most már van **Üzenetek** és **Hibanapló** lap. Az Állapot oszlopban legördülő lista van (Új, Folyamatban, Megválaszolva, Lezárva…).
7. (Ajánlott, GDPR) Futtasd egyszer az **`idozitoBeallitasa`** függvényt is: ez naponta hajnalban törli a `megorzesNap`-nál régebbi sorokat.

### 5. Telepítés webalkalmazásként

1. Jobb felül: **Telepítés → Új telepítés**.
2. A „Típus kiválasztása” melletti **⚙** ikon → **Webalkalmazás**.
3. Kitöltés:
   - **Leírás:** `Netlify űrlap-fogadó v1`
   - **Végrehajtás mint:** **Én** (a saját fiókod nevében ír a táblázatba és küld levelet)
   - **Hozzáférés:** **Bárki** (a Netlify nem tud Google-fiókkal belépni; a védelmet a titkos kulcs adja)
4. **Telepítés** → másold ki a **Webalkalmazás URL-jét** (`https://script.google.com/macros/s/AKfy…/exec`).
5. Ellenőrzés: nyisd meg az URL-t böngészőben. Ezt kell látnod: *„Az űrlap-fogadó működik.”*

> **Fontos, ha később módosítod a kódot:** a változás csak akkor él, ha új verziót telepítesz. **Telepítés → Telepítések kezelése → ✏ (szerkesztés) → Verzió: Új verzió → Telepítés.** Így az URL nem változik. (Az „Új telepítés” új URL-t adna, amit a Netlifyban is át kellene írni.)

### 6. Netlify webhook beállítása

1. <https://app.netlify.com> → válaszd ki a projektet (site-ot).
2. **Project configuration → Notifications → Emails and webhooks** (régebbi felületen: *Site configuration / Site settings → Forms → Form notifications*).
3. A **Form submission notifications** résznél: **Add notification → HTTP POST request**.
4. Kitöltés:
   - **Event to listen for:** `New form submission`
   - **URL to notify:** a webalkalmazás URL-je + `?kulcs=` + a titkos kulcs, pl.
     `https://script.google.com/macros/s/AKfy…/exec?kulcs=3f9c…`
   - **JWS secret token:** hagyd **üresen** (az Apps Script nem látja azt a fejlécet, amiben ez utazna – lásd [Biztonság](#biztonság)).
   - **Form:** a kapcsolati űrlap (pl. `kapcsolat`), vagy *Any form*.
5. **Save**.

Az űrlapnak Netlify Formsként kell működnie (a HTML `<form>`-on `data-netlify="true"` és `name="…"`, a beküldések megjelennek a Netlify **Forms** menüjében). A webhook csak a Netlify spamszűrőjén átjutott beküldésekre fut le.

### 7. Tesztelés

Haladj sorban, így pontosan látszik, hol akad el, ha elakad:

1. **Szkript önmagában:** az Apps Script-szerkesztőben futtasd a **`probaUzenet`** függvényt. → Új sor az Üzenetek lapon, és értesítő a postafiókban (a próbaüzenet a saját címedről jön).
2. **Webalkalmazás kívülről** (Node 22 kell hozzá, ebben a mappában):
   ```bash
   npm run proba -- "https://script.google.com/macros/s/AKfy…/exec?kulcs=3f9c…"
   ```
   Válasz: `Rendben: uj – nézd meg a táblázatot és a postafiókot.` Rossz kulccsal: `Elutasítva…`, és bejegyzés a Hibanapló lapon.
3. **Élesben:** töltsd ki a weboldal űrlapját. 10–30 mp-en belül ott a sor és a levél.
4. **Ismétlés-szűrés:** a Netlify **Forms** menüjében nem lehet újraküldeni, de a 2. pont parancsát ugyanazzal a kulccsal kétszer futtatva két sor lesz (minden futás új azonosítót kap) – ugyanazt a beküldést (ugyanazzal az azonosítóval) viszont csak egyszer írja be.

### 8. Szigorú mód (opcionális)

Ha a titkos kulcs kiszivárogna, valaki hamis sorokat írhatna a táblázatba. A szigorú módban a szkript minden beérkezett beküldést **visszakérdez a Netlifytól** az azonosítója alapján, és csak a Netlifynál ténylegesen meglévő adatot írja be.

1. Netlify: jobb felül a profilképed → **User settings → Applications → Personal access tokens → New access token**. Adj neki nevet (`urlap-fogado`) és **lejárati időt**.
2. Apps Script: **⚙ Projektbeállítások → Szkripttulajdonságok → Szkripttulajdonság hozzáadása**: név `NETLIFY_API_TOKEN`, érték a token. Mentés.

Kompromisszum: a Netlify személyes tokenje **a teljes Netlify-fiókhoz** hozzáfér (nem korlátozható egy projektre). Ezért az ügyfél saját Netlify-fiókjában hozd létre, lejárattal, és csak akkor kapcsold be, ha a kockázat indokolja (pl. sokan látják a Netlify-beállításokat).

---

## B) Netlify Function: telepítés lépésről lépésre

Idő: kb. 30 perc. Kell: a weboldal repója (deploy joggal), egy Google-fiók és egy e-mail-szolgáltató.

### 1. Google Cloud: szolgáltatásfiók és kulcs

1. <https://console.cloud.google.com> → fent a projektválasztó → **Új projekt** → név: `cegnev-urlap` → **Létrehozás**.
2. **API-k és szolgáltatások → Könyvtár** → keresd: **Google Sheets API** → **Engedélyezés**.
3. **IAM és adminisztráció → Szolgáltatásfiókok → + Szolgáltatásfiók létrehozása** → név: `urlap` → **Létrehozás és folytatás** → szerepkört **nem kell** adni → **Kész**.
4. Kattints a létrejött fiókra → **Kulcsok → Kulcs hozzáadása → Új kulcs létrehozása → JSON → Létrehozás**. Letöltődik egy `.json` fájl. **Ezt bizalmasan kezeld**, ne tedd a repóba.
   (Ha hibát kapsz, hogy a kulcs létrehozását szabályzat tiltja – ez újabb Google Workspace-szervezeteknél alapértelmezés –, a Workspace-adminnak kell feloldania az `iam.disableServiceAccountKeyCreation` szabályt erre a projektre, vagy válaszd az A) megoldást.)
5. A JSON-ból két érték kell: `client_email` (pl. `urlap@cegnev-urlap.iam.gserviceaccount.com`) és `private_key` (a `-----BEGIN PRIVATE KEY-----…` szöveg).

### 2. A táblázat megosztása

1. Hozz létre egy Google Táblázatot (<https://sheets.new>), és nevezd el a lapot **Üzenetek**-re (alul a lapfülön dupla kattintás). A fejlécet az első beküldésnél magától beírja – vagy importáld a `pelda-tablazat-fejlec.csv`-t.
2. **Fájl → Beállítások → Időzóna:** `(GMT+01:00) Budapest`.
3. **Megosztás** → add hozzá a szolgáltatásfiók `client_email` címét **Szerkesztő** joggal → vedd ki a pipát az „Értesítés küldése” elől → **Megosztás**.
4. A táblázat URL-jéből másold ki az azonosítót: `https://docs.google.com/spreadsheets/d/`**`EZ_AZ_AZONOSÍTÓ`**`/edit`.

### 3. E-mail-szolgáltató (válassz egyet)

**Resend (ajánlott)** – <https://resend.com>, ingyenes: 3000 levél/hó, 100/nap.
1. Regisztráció → **Domains → Add Domain** → az ügyfél domainje (pl. `cegnev.hu`) → a megadott DNS-rekordokat (SPF, DKIM) vedd fel a domain DNS-kezelőjében → **Verify**.
2. **API Keys → Create API Key** → jogosultság: *Sending access* → másold ki (`re_…`).

**SMTP (pl. Gmail)** – csak 465-ös (implicit TLS) port támogatott.
1. Gmailnél: a fiókon legyen kétlépcsős azonosítás → <https://myaccount.google.com/apppasswords> → alkalmazásjelszó létrehozása.
2. `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=a Gmail-cím`, `SMTP_PASS=az alkalmazásjelszó`. Tárhelyszolgáltatói postafióknál a szolgáltató SMTP-adatai kellenek.

### 4. A függvény bemásolása a weboldal repójába

A Netlify a `netlify/functions/` mappát nézi. Másold át **ezzel a szerkezettel** (így a relatív importok maradnak érvényesek):

```
urlap-tablazat/kozos/                             →  netlify/kozos/
urlap-tablazat/netlify-function/submission-created/  →  netlify/functions/submission-created/
```

```bash
mkdir -p netlify/functions
cp -r automatizalas/urlap-tablazat/kozos netlify/kozos
cp -r automatizalas/urlap-tablazat/netlify-function/submission-created netlify/functions/
```

A függvény neve (`submission-created`) **nem változtatható**: a Netlify erről tudja, hogy minden ellenőrzött beküldés után le kell futtatnia. Kívülről URL-en nem hívható meg. Csomag telepítése nem kell (nincs függősége); a Netlify a TypeScriptet magától lefordítja.

### 5. Környezeti változók

Netlify → projekt → **Project configuration → Environment variables → Add a variable → Add a single variable**. A **Scopes** legyen legalább *Functions*. Minden változó után **Create variable**.

| Változó | Kötelező | Példa / leírás |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✔ | `urlap@cegnev-urlap.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | ✔ | a JSON `private_key` értéke, idézőjelek nélkül. A `\n`-ek maradhatnak szövegként, a függvény kijavítja. Jelöld *Contains secret values*-nak. |
| `GOOGLE_SHEET_ID` | ✔ | a táblázat azonosítója az URL-ből |
| `GOOGLE_SHEET_TAB` | | lapnév, alapból `Üzenetek` |
| `GOOGLE_LOG_TAB` | | hibanapló lap, alapból `Hibanapló` (ha nincs, létrehozza) |
| `ERTESITES_CIMZETT` | ✔* | `iroda@cegnev.hu` (több cím vesszővel) |
| `EMAIL_FELADO` | | `Kovács Pékség weboldal <urlap@cegnev.hu>` – Resendnél hitelesített domainről |
| `EMAIL_SZOLGALTATO` | | `resend`, `smtp` vagy `nincs`. Üresen: `RESEND_API_KEY` → resend, `SMTP_HOST` → smtp, egyébként nincs |
| `RESEND_API_KEY` | Resendnél | `re_…` (secret) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP-nél | port alapból `465`; a jelszó secret |
| `VISSZAIGAZOLAS` | | `igen` → a feladó visszaigazolást kap |
| `CEG_NEV`, `CEG_ALAIRAS`, `VALASZIDO` | | a visszaigazoló levélhez; az aláírásban `\n` = új sor |
| `MEGSZOLITAS` | | `tegezo` (alap) vagy `magazo` |
| `KIEMELO_SZIN` | | a levél kiemelőszíne, pl. `#18302E` |
| `URLAP_NEVEK` | | csak ezeket az űrlapokat dolgozza fel, pl. `kapcsolat,ajanlatkeres` |
| `MEZO_TERKEP` | | JSON, lásd [Mezők](#mezők-és-oszlopok-testreszabása) |
| `SZABALYOK` | | JSON, pl. `{"maxUgyanattol":5}` |

\* Ha `EMAIL_SZOLGALTATO=nincs`, csak táblázatba ír.

> A Netlify a függvények környezeti változóit összesen **4 KB**-ra korlátozza. A privát kulcs kb. 1,7 KB, így bőven elfér, de ne másold be a teljes JSON-fájlt egy változóba.

### 6. Telepítés és próba

1. Commit + push (vagy **Deploys → Trigger deploy**). A deploy naplójában látszik: `Functions bundling … submission-created`.
2. Töltsd ki a weboldal űrlapját.
3. Ellenőrzés: **Logs → Functions → submission-created**. Siker esetén: `[urlap] Feldolgozva: uj`.
4. Helyi próba (Netlify CLI-vel, a repó gyökerében, a környezeti változók `netlify link` után elérhetők):
   ```bash
   netlify functions:invoke submission-created --payload automatizalas/urlap-tablazat/eszkozok/minta-esemeny.json
   ```

Ha a táblázat épp nem elérhető, az értesítő akkor is kimegy, benne egy figyelmeztetéssel („NEM került be a táblázatba…”). Ha se táblázat, se e-mail nem megy, a függvény hibával áll le, és ez a Netlify naplójában látszik.

---

## Mezők és oszlopok testreszabása

**Mezők.** A szkript az űrlap mezőneveit kisbetűsítve, ékezet és írásjel nélkül hasonlítja össze, így a `Név`, `nev`, `NEV`, `név` ugyanaz. Alapértelmezett jelöltek (az első kitöltött nyer):

| Cél | Elfogadott mezőnevek |
|---|---|
| Név | `nev`, `name`, `neved`, `teljes-nev`, `full-name`, **`vezeteknev` + `keresztnev`** (összefűzve), `first-name` + `last-name` |
| E-mail | `email`, `e-mail`, `email-cim`, `mail` |
| Telefon | `telefon`, `telefonszam`, `tel`, `phone`, `mobil` |
| Üzenet | `uzenet`, `uzeneted`, `message`, `body`, `megjegyzes`, `kerdes` |

Ha eltér, csak azt a mezőt kell felülírni, a többi marad:

- **A)** `BEALLITASOK.mezok = { uzenet: ['igeny', 'leiras'] }`
- **B)** `MEZO_TERKEP={"uzenet":["igeny","leiras"],"nev":[["vezeteknev","keresztnev"]]}`

A nem leképezett mezők (pl. „Milyen szolgáltatás érdekel?”) az értesítő levél **További mezők** részébe kerülnek. A technikai mezők (`form-name`, `bot-field`, `ip`, `user_agent`, `referrer`) kimaradnak.

**Oszlopok.** A szkript az első sor **fejléce alapján** ír, nem pozíció szerint. Ezért az ügyfél nyugodtan:
- átrendezheti az oszlopokat,
- beszúrhat saját oszlopot (pl. „Megjegyzés”, „Felelős”) – ezek üresen maradnak, a szkript nem írja felül,
- törölheti a Telefon oszlopot, ha nincs ilyen mező.

Az **Azonosító** és az **Időpont** oszlopot ne töröld: ezekből dolgozik az ismétlődés- és elárasztásszűrés.

---

## Mit szűr ki, és mi kerül az Állapot oszlopba?

| Eset | Mikor | Sor a táblázatban | Értesítő | Visszaigazolás |
|---|---|---|---|---|
| **Új** | minden rendben | ✔ `Új` | ✔ | ✔ (ha be van kapcsolva) |
| **Hiányos** | hiányzik a név / e-mail / üzenet, vagy hibás az e-mail-cím | ✔ `Hiányos` | ✔ `[Hiányos]` tárggyal | ✖ |
| **Spam?** | kitöltött csapdamező, 3-nál több link, link a név mezőben, tiltott kifejezés, csak link az üzenetben | ✔ `Spam?` | ✖ | ✖ |
| **Túl sok üzenet** | ugyanarról a címről 1 órán belül a 4. üzenet, vagy összesen 30 üzenet/óra (A-ban ugyanarról az IP-ről is) | ✔ `Túl sok üzenet` | ✖ | ✖ |
| **Ismétlődés** | ugyanaz a Netlify-azonosító már szerepel, vagy ugyanaz az e-mail + üzenet 10 percen belül | ✖ (csak Hibanapló: INFO) | ✖ | ✖ |

A gyanús üzeneteket sem dobjuk el: bekerülnek a táblázatba, csak levél nem megy róluk. Hetente érdemes rájuk szűrni (Adatok → Szűrő létrehozása → Állapot).

A számok módosíthatók (A: `BEALLITASOK.szabalyok`, B: `SZABALYOK` JSON): `maxUgyanattol`, `maxOsszesen`, `korlatAblakPerc`, `duplikatumAblakPerc`, `maxLinkek`, `tiltottSzavak`.

---

## Biztonság

**A webhook hitelesítése (A).** A Netlify a kimenő webhookot – ha megadsz *JWS secret token*-t – az `X-Webhook-Signature` fejlécben aláírja: ez egy HS256-tal aláírt JWT, benne `iss: "netlify"` és `sha256` (a kérés törzsének hexadecimális SHA-256 hash-e). Az ellenőrzéshez tehát a **fejléc** kellene. A Google Apps Script `doPost(e)` eseményobjektuma viszont **nem tartalmazza a kérés fejléceit** (csak a query paramétereket és a törzset; a Google erre vonatkozó funkciókérése évek óta nyitott). Ezért:

- a titkos kulcs az URL-ben utazik (`?kulcs=…`, 64 hexa karakter, véletlen), és a szkript állandó idejű összehasonlítással ellenőrzi;
- **a kompromisszum:** az URL (benne a kulccsal) látszik a Netlify-beállításokban mindenkinek, akinek oda hozzáférése van, és a kulcs nem védi a törzs sértetlenségét úgy, mint az aláírás. HTTPS miatt útközben nem olvasható ki. Ha kiszivárog: **`ujKulcs`** futtatása + a Netlify-URL frissítése;
- erősebb védelemhez: **szigorú mód** (fent, 8. pont) – a beküldést a Netlify API-ból kérjük vissza, így hamisított kérés nem kerül be;
- a B) megoldásban nincs ilyen gond: az esemény-függvényt a Netlify belül, saját aláírással hívja, kívülről nem érhető el.

**További védelmek (mindkettőben):**
- **Képletbefecskendezés ellen:** a `=`, `+`, `-`, `@` kezdetű szöveg nem futhat le képletként a táblázatban (A: `'` előtag; B: a Sheets API `stringValue`-ként kapja).
- **XSS ellen:** a levelekben minden látogatói adat HTML-escape-elve szerepel; link csak általunk épített `mailto:`/`tel:` címből és ellenőrzött `https://` oldalcímből készül.
- **Fejléc-befecskendezés ellen:** a tárgyból és a címekből a sortörések kikerülnek.
- **Vezérlő- és irányváltó karakterek** (pl. U+202E) kiszűrve.
- **A visszaigazolás nem reklámhordozó:** nem idézi vissza az üzenetet, a nevet csak akkor írja ki, ha névnek látszik, és elárasztásnál/spamnél nem megy ki. Így nem lehet a mi nevünkben tartalmat küldeni idegen címekre.

---

## Hibaelhárítás

| Tünet | Ok és megoldás |
|---|---|
| A webalkalmazás URL-je böngészőben Google-belépést kér | A telepítésnél a Hozzáférés nem **Bárki**. Telepítések kezelése → ✏ → Hozzáférés: Bárki → Új verzió. |
| `npm run proba` válasza HTML, nem JSON | Ugyanaz, vagy rossz az URL (a `/exec` végű kell, nem a `/dev`). |
| `Elutasítva` / a Hibanaplóban „hibás kulcs” | A Netlifyba írt URL-ben a `?kulcs=` érték nem egyezik. `kulcsMegjelenitese` → másold újra. |
| Módosítottam a kódot, de nem változik semmi | Új verziót kell telepíteni (A/5. „Fontos” doboz). |
| Nincs sor, nincs semmi a Hibanaplóban | Nem jön webhook. Netlify → Forms: megérkezett a beküldés? Ha a *Spam submissions* közé került, a webhook nem fut. Nézd meg a Netlify értesítés beállításait (melyik űrlapra szól). |
| A Netlify a webhookot sikertelennek jelzi, pedig a sor megvan | Az Apps Script a POST-ra 302-es átirányítással válaszol (ez a Google működése). A sor ettől még rendben bekerül; ha a Netlify újrapróbálja, az ismétlődésszűrés kiszűri. |
| Kétszer jött ugyanaz a sor | Csak akkor fordulhat elő, ha az Azonosító oszlopot törölték vagy átnevezték. |
| `Exception: Service invoked too many times for one day: email` | Elfogyott a napi levélkeret (ingyenes Gmail: 100 címzett/nap). A sorok továbbra is bekerülnek. Kapcsold ki a visszaigazolást, vagy válts Workspace-re / B-re. |
| Rossz az időpont (1 órával eltér) | A táblázat időzónája nem Budapest: Fájl → Beállítások → Időzóna. (A: az `appsscript.json` is legyen bemásolva.) |
| B: `Google Sheets API 403 … Megosztottad a táblázatot…` | A táblázat nincs megosztva a szolgáltatásfiók címével Szerkesztő joggal. |
| B: `Google Sheets API 404` | Rossz a `GOOGLE_SHEET_ID`. |
| B: `Google-bejelentkezés sikertelen (400): invalid_grant` | Hibás vagy csonka `GOOGLE_PRIVATE_KEY` (a teljes `-----BEGIN…END PRIVATE KEY-----` kell), vagy a gép órája rossz. |
| B: `Nincs „Üzenetek” nevű lap` | Nevezd át a lapot, vagy állítsd be a `GOOGLE_SHEET_TAB`-ot. |
| B: `Resend hiba 403` | A feladó domainje nincs hitelesítve a Resendben (`EMAIL_FELADO`). Próbához `onboarding@resend.dev` használható, de az csak a saját Resend-címedre küld. |
| B: `SMTP hiba (bejelentkezés): 535` | Rossz felhasználónév/jelszó; Gmailnél alkalmazásjelszó kell, nem a fiók jelszava. |
| B: a függvény nem fut le | A fájl helye/neve nem `netlify/functions/submission-created/submission-created.ts`, vagy hiányzik a `netlify/kozos/` mappa. A deploy naplójában nézd meg a „Functions bundling” részt. |

Az A) megoldásnál a részletes futási napló: Apps Script-szerkesztő → bal oldalt **☰ Végrehajtások**.

---

## GDPR

Ez nem jogi tanácsadás, hanem gyakorlati ellenőrzőlista. Az adatkezelési tájékoztatót az ügyfél felelőssége naprakészen tartani.

**Szerepek**
- **Adatkezelő:** az ügyfél (a weboldal üzemeltetője).
- **Adatfeldolgozók:**
  - **Netlify, Inc.** (USA) – fogadja és tárolja az űrlapbeküldéseket (Forms). Adatfeldolgozási megállapodás (DPA) a Netlify oldalán érhető el; az EU-ból történő adattovábbítás az EU–USA adatvédelmi keretrendszeren (DPF) és/vagy általános szerződési feltételeken (SCC) alapul – az aktuális állapotot a Netlify DPA-ja és a DPF-lista mutatja.
  - **Google** – a táblázat és (A esetén) a levélküldés. **Google Workspace** fióknál a Google adatfeldolgozóként szerződik (Cloud Data Processing Addendum), ezt az admin konzolban el kell fogadni. **Ingyenes, magánszemélyeknek szóló Gmail-fióknál nincs ilyen adatfeldolgozói szerződés** – üzleti célra ezért Workspace ajánlott.
  - **B esetén:** Google Cloud (Sheets API), és az e-mail-szolgáltató (pl. **Resend**, USA; vagy az SMTP-szolgáltató).
  - **Folyam Studio:** ha a beállítás és karbantartás során hozzáférünk az adatokhoz, mi is adatfeldolgozók vagyunk → írásos adatfeldolgozói szerződés kell az ügyféllel (GDPR 28. cikk).

**Adattakarékosság – mit tárol a megoldás**
- Táblázat: időpont, név, e-mail, telefon, üzenet, forrásoldal, állapot, beküldés-azonosító.
- **IP-címet nem ír a táblázatba.** Az A) változat az elárasztásszűréshez az IP-cím hash-ét legfeljebb 1 órára a Google gyorsítótárában tartja. (A Netlify a saját felületén az IP-t és a böngészőazonosítót is tárolja a beküldés mellett.)
- A visszaigazoló levél nem tartalmazza az üzenetet.

**Megőrzési idő**
- Javaslat: a megkeresés lezárása után **1 év** (ha szerződés lesz belőle, az onnantól a szerződéses iratok szabályai szerint).
- A) `BEALLITASOK.megorzesNap` + `idozitoBeallitasa` → automatikus törlés a táblázatból.
- B) a táblázatban szűrővel, kézzel (pl. negyedévente).
- **A Netlify is tárolja a beküldéseket**, és ezt egyik megoldás sem törli: Netlify → **Forms** → az űrlap → beküldés → **Delete**. Tegyétek be a negyedéves teendők közé, és az értesítő leveleket is töröljétek a postafiókból a megőrzési idő végén.

**Érintetti kérések** (pl. „töröljétek az adataimat”): három helyről kell törölni – a táblázatból, a Netlify Forms-ból és a postafiókból (értesítő levél).

**A tájékoztatóba ezt kell beírni (minta-pontok)**
- milyen adatokat kér az űrlap, és mi a cél (megkeresés megválaszolása, ajánlatadás);
- jogalap: ajánlatkérésnél jellemzően a szerződés előkészítése (GDPR 6. cikk (1) b)), általános kérdésnél jogos érdek (f) vagy hozzájárulás (a) – igazodjon ahhoz, amit az űrlap jelölőnégyzete állít; hozzájárulásnál a visszavonás lehetőségét is írjátok le;
- **adatfeldolgozók névvel és székhellyel:** Netlify, Inc. (USA), Google Ireland Ltd. / Google LLC, és B esetén az e-mail-szolgáltató; valamint a Folyam Studio, ha karbantartja;
- **harmadik országba továbbítás** (USA) és annak garanciája (DPF / SCC);
- megőrzési idő (ugyanaz, mint a `megorzesNap`);
- automatikus visszaigazoló levél küldése (ha be van kapcsolva) – ez nem marketing;
- az érintetti jogok és a NAIH elérhetősége.

**Biztonság**: a táblázatot csak azokkal osszátok meg, akiknek dolgozniuk kell vele; a Google-fiókon legyen kétlépcsős azonosítás; a titkos kulcsot és a privát kulcsot ne küldjétek e-mailben.

---

## Költség

Mindkét megoldás jellemzően **0 Ft/hó** egy kisvállalkozás forgalmánál. A keretek 2026 végén, tájékoztató jelleggel – az aktuális számokat a szolgáltatók árazási oldalán ellenőrizd:

| Szolgáltatás | Ingyenes keret |
|---|---|
| Netlify Forms | Régi Starter csomag: 100 beküldés/hó/projekt. Az új, kreditalapú csomagokban a beküldés kreditet fogyaszt – lásd netlify.com/pricing. |
| Netlify Functions (B) | Kisvállalkozási forgalomnál a havi ingyenes keret töredéke (egy beküldés = egy rövid futás). |
| Google Apps Script (A) | Ingyenes. Levél: 100 címzett/nap (Gmail), 1500/nap (Workspace). Napi kvóták: developers.google.com/apps-script/guides/services/quotas |
| Google Sheets / Sheets API (B) | Ingyenes; percenkénti kéréskorlát van, ami kézi űrlapforgalomnál nem érhető el. Egy táblázat max. 10 millió cella. |
| Resend (B) | 3000 levél/hó, 100/nap, 1 domain. |
| Gmail SMTP (B) | Kb. 500 levél/nap (ingyenes fiók). |
| Google Workspace (ajánlott, nem kötelező) | Fizetős, felhasználónként havidíj – az ügyfélnek a levelezéséhez általában úgyis megvan. |

---

## Fejlesztőknek: tesztek, építés

Node.js **22.18+** kell (a TypeScriptet a Node maga futtatja, típusellenőrzés nélkül). Függőség nincs, `npm install` nem kell.

```bash
cd automatizalas/urlap-tablazat
npm test                    # összes teszt (node:test)
npm run build:apps-script   # apps-script/Kod.gs újraépítése a forrásokból
```

- A közös logika **egy helyen** van (`kozos/*.ts`), és mindkét változat ezt használja. Az Apps Script-változathoz az építő eltávolítja a típusokat, és a kódot egy `UrlapLogika` névtérbe csomagolja a `Kod.js` mögé. Ezért a `kozos/` fájlokban: csak törölhető TypeScript, egysoros import/export, nincs Node- vagy böngésző-API, nincs `?.` / `??`.
- A `kozos/` vagy az `apps-script/Kod.js` módosítása után **mindig** futtasd a `build:apps-script`-et – a tesztek ellenőrzik, hogy a `Kod.gs` naprakész.
- A tesztek a tiszta logikán túl a kész `Kod.gs`-t is lefuttatják Node `vm`-ben, hamisított Google-szolgáltatásokkal (SpreadsheetApp, MailApp stb.), a B) változatot pedig hamis `fetch`-csel és egy hamis SMTP-szerverrel.
