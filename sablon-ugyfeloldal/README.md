# Folyam ügyféloldal-sablon

Ebből a sablonból egy pékség, virágbolt, borbély, asztalosműhely vagy kis szállás weboldala **egy nap alatt** elkészül. Minden tartalom egyetlen fájlból jön: `src/config/uzlet.json`. Abból generálódik a főoldal, az árlista, a Rólunk, a Kapcsolat (űrlappal), az adatkezelési tájékoztató, az impresszum, a 404, a sitemap, a robots.txt és a Google számára a LocalBusiness JSON-LD.

Amit tud:

- **Astro 7**, statikus HTML. Kliensoldali JavaScript csak egy kis modul (kb. 4 kB): kiírja, hogy „Nyitva most, ma 18:00-ig” vagy „Zárva, holnap 6:30-kor nyit”, mindig budapesti idő szerint. JavaScript nélkül a heti nyitvatartás látszik, ami mindig igaz.
- **Magyar munkaszüneti napok automatikusan** (húsvét, pünkösd is), plusz saját kivételek (szenteste, szabadság).
- **3 témakészlet** (`meleg`, `letisztult`, `meresz`), mindegyik ≥ 4.5:1 kontraszttal. Ha felülírod a színeket, a build ellenőrzi a kontrasztot, és megáll, ha kevés.
- **Saját domainről** tölt minden betűt (fontsource, latin-ext, tehát ő és ű is), képet és szkriptet. Nincs Google Fonts, nincs beágyazott térkép, nincs süti, nincs sütisáv.
- **Szigorú CSP** és biztonsági fejlécek a `netlify.toml`-ban.
- **Netlify Forms** űrlap honeypottal és hozzájárulás-jelölőnégyzettel.
- **Akadálymentesség** (WCAG 2.2 AA): „Ugrás a tartalomra” link, látható fókusz, valódi címkék, `prefers-reduced-motion`, legalább 24 px-es (gomboknál 46 px-es) érintési célok.

## Gyorsindítás

```bash
npm install
npm run pelda -- pekseg     # vagy: borbely
npm run dev                 # http://localhost:4321
```

Parancsok:

| parancs | mit csinál |
|---|---|
| `npm run pelda -- <név>` | bemásolja az `examples/<név>.json`-t a `src/config/uzlet.json` helyére, és a fotóit az `src/assets/fotok/` mappába (a régieket törli) |
| `npm run dev` | fejlesztői szerver |
| `npm run build` | éles build a `dist/` mappába; hibás konfignál megáll és megmondja, melyik mező a rossz |
| `npm run ellenoriz` | a kész buildet ellenőrzi: JSON-LD, inline kód (CSP), title/description/h1/alt, `[TESZT ADAT]` maradványok |
| `npm run preview` | a kész build helyi kiszolgálása |
| `npm run sema` | újragenerálja az `uzlet.schema.json`-t (VS Code-ban automatikus kiegészítés és aláhúzás az `uzlet.json`-ban) |

## Új ügyfél felvétele lépésről lépésre

### 1. Új projekt a sablonból

Másoljátok ki a `sablon-ugyfeloldal` mappát egy új repóba (pl. `ugyfel-kovaszeskalasz`), majd `npm install`. Induljatok a hozzá legközelebbi példából: `npm run pelda -- pekseg`.

### 2. A konfig kitöltése (`src/config/uzlet.json`)

A mezők pontos leírása a `src/config/schema.ts`-ben van; VS Code-ban a `$schema` sor miatt rámutatva is látszik. A legfontosabbak:

| mező | mire figyelj |
|---|---|
| `bemutato` | éles oldalnál **`false`**. Ha `true`, sáv jelzi, hogy kitalált vállalkozás, és a keresők nem indexelik. |
| `tipus` | `pekseg`, `viragos`, `borbely`, `asztalos`, `szallas`, `egyeb`. Ebből jön a schema.org típus (Bakery, Florist, HairSalon, HomeAndConstructionBusiness, LodgingBusiness), az alapértelmezett téma és az űrlap szövegei. Pontosabb típus: `schemaTipus`, pl. `"BedAndBreakfast"`. |
| `domain` | a végleges cím `https://`-sel, perjel nélkül. A canonical, az Open Graph és a sitemap ebből készül. |
| `bemutatkozas.rovid` | 1–2 konkrét mondat: mit, hol, miben más. **Nem szlogen.** Teszt: ha a név kicserélésével a szomszéd versenytársra is igaz, írjátok újra. |
| `bemutatkozas.hosszu` | a Rólunk oldal bekezdései; az első a főoldalra is kikerül. |
| `bemutatkozas.nemCsinaljuk` | egy őszinte mondat arról, mit nem vállalnak. Ez győz meg, nem a „minőség, megbízhatóság”. |
| `cim` | `geo` (szélesség, hosszúság) a Google Térképről: jobb klikk a helyre → a koordináták másolása. `terkepLink`-nek a Google Cégprofil térképlinkje a legjobb. |
| `telefon` | ahogy kiírva látszódjon: `"+36 30 123 4567"`; a `tel:` link automatikus. |
| `nyitvatartas.het` | napokra idősávok, `[]` = zárva. Ebédszünet: két sáv egy napon. |
| `nyitvatartas.kivetelek` | `datum` (+ több napnál `datumIg`), `nyitva` (`[]` = zárva), `megjegyzes`. Felülírja az ünnepnapot is. |
| `nyitvatartas.unnepnapokonZarva` | alapból `true`: a munkaszüneti napokon zárva. December 24. nem munkaszüneti nap, azt kivételként adjátok meg. |
| `kinalat.kategoriak[].tetelek[]` | `nev`, `leiras`, `ar` (Ft, egész szám), `egyseg` („db”, „1 kg”), `idotartam` („40 perc”), `arTol`, vagy ár helyett `arSzoveg` („felmérés után”), `jelolesek` („csak szombaton”), `kiemelt` (főoldalra kerül; a fotós kiemelt tétel lesz a nagy). |
| `foglalas` | ha van külső időpontfoglaló, ide a link; a főoldali második gomb erre mutat. Beágyazni nem kell (CSP). |
| `tema.keszlet`, `tema.szinek` | lásd lent. |
| `szovegek` | az űrlap címe, bevezetője, témái, dátummező felirata (`""` = nincs dátummező). |
| `adatkezelo` | név, forma, székhely, adószám, nyilvántartási/cégjegyzékszám, e-mail. **Ami hiányzik, ott az oldalon `[TESZT ADAT]` jelenik meg**, a build pedig figyelmeztet. |
| `tarhely` | alapból a Netlify adatai; átadás előtt ellenőrizzétek a Netlify aktuális címét. |

### 3. Fotók

- Tegyétek az `src/assets/fotok/` mappába, a konfigban így hivatkozzatok rájuk: `"fajl": "fotok/pult.jpg"`.
- `fotok.fo`: a főoldal nagy képe, **álló 4:5, legalább 1600 px magas**. Ebből készül a Facebook/Viber megosztási kép is (1200×630). Ha nincs jó fotó, hagyjátok ki: a főoldal fotó nélkül is teljes (a jobb oldalon a heti nyitvatartás áll), lásd a borbély példát.
- `fotok.rolunk[]`: fekvő 3:2. Tételhez: `tetelek[].foto`, 4:3.
- Az `alt` azt írja le, mi látszik („Kovászos cipók a pult polcain”), ne azt, hogy „kép”.
- Csak az ügyfél saját vagy általatok készített fotója, vagy olyan, aminek a licence megengedi (pl. Unsplash „Free”, nem Unsplash+). A fotóst a `szerzo`/`forras` mezőben megnevezhetitek; az impresszumba kerül.
- Az Astro mindegyikből webp-t és több méretet készít; az első kép azonnal, a többi lustán töltődik.
- A pékség példa képei **helykitöltők** („PÉLDAFOTÓ HELYE” felirattal), nem valódi fotók.

### 4. Téma és színek

| készlet | hangulat | betűk | alapból |
|---|---|---|---|
| `meleg` | lisztfehér, kéregbarna, zománctábla-kék kiemelés | Young Serif + Source Sans 3 | pékség, asztalos |
| `letisztult` | majdnem fehér, grafit, szárzöld kiemelés | Newsreader + Public Sans | virágbolt, szállás |
| `meresz` | sötét alap, csontfehér, jelzőpiros, keskeny vastag címek | Archivo (változó szélesség) | borbély |

Saját színek (pl. az ügyfél cégtáblájának színe): `"tema": { "keszlet": "meleg", "szinek": { "kiemelo": "#7A2E1F" } }`. Felülírható: `hatter`, `felulet`, `szoveg`, `halvany`, `kiemelo`, `kiemeloSzoveg`. A build minden szövegszín-párt ellenőriz (4.5:1), és pontosan kiírja, melyik kevés. Egyetlen kiemelő szín legyen; színátmenet, lila-kék, árnyék nincs a rendszerben, és ne is kerüljön bele.

Csak a választott téma betűi kerülnek a buildbe (`astro.config.ts`, `BETUK`).

### 5. Build és ellenőrzés

```bash
npm run build && npm run ellenoriz && npm run preview
```

Nézzétek meg telefonon is (390 px széles nézet), kattintsatok végig minden linket, töltsétek ki az űrlapot az éles oldalon. A `[TESZT ADAT]`-ból nem maradhat egy sem.

### 6. Netlify-ra kötés

1. Töltsétek fel a projektet egy GitHub-repóba.
2. Netlify: **Add new project → Import an existing project → GitHub**, válasszátok a repót. A build parancs (`npm run build`), a `dist` mappa és a Node verzió a `netlify.toml`-ból jön, semmit nem kell beírni.
3. **Forms → Enable form detection**, majd egy új deploy. Utána a `kapcsolat` űrlap megjelenik a listában.
4. **Forms → Form notifications → Email notification**: az ügyfél e-mail-címére menjenek az üzenetek. Teszteljétek egy valódi beküldéssel; a spam mappát is nézzétek meg.
5. A Netlify ingyenes csomagjának űrlap-kerete korlátozott; nézzétek meg az aktuális díjszabást, és mondjátok el az ügyfélnek.

### 7. Domain az ügyfél nevére

- A domaint **az ügyfél nevére** regisztráljátok (a .hu domainnél ő legyen a domainhasználó), a saját regisztrátori fiókjába. Ti legfeljebb technikai kapcsolattartók vagytok. Így ha valaha váltani akar, nem rajtatok múlik.
- Netlify: **Domain management → Add a domain**. Vagy a Netlify DNS-t használjátok (névszerverek átállítása), vagy a regisztrátornál `A` rekord a Netlify terheléselosztójára és `CNAME` a `www`-re (a Netlify kiírja a pontos értékeket).
- A HTTPS (Let's Encrypt) magától elkészül. Válasszatok elsődleges címet (`www` nélkül vagy azzal), a másik átirányít.
- Írjátok át a `domain` mezőt a végleges címre, és deployoljatok újra (canonical, sitemap, JSON-LD).
- A HSTS fejléc `includeSubDomains` nélkül van beállítva, mert az ügyfélnek lehet más aldomainje (pl. levelezés). Ha minden aldomain HTTPS, bővíthetitek.

### 8. Google Cégprofil

Legyen kitöltve és ellenőrizve. A név, cím, telefonszám **betűre ugyanaz** legyen, mint a weboldalon. A profil linkje a `googleCegprofil` mezőbe kerül (lábléc + `sameAs`), a weboldal címét pedig a profilba írjátok be. A JSON-LD-t az élő oldalon érdemes a Google Rich Results Testtel és a validator.schema.org-gal is megnézni.

### 9. Átadás

- [ ] `bemutato: false`, nincs `[TESZT ADAT]`, az `npm run ellenoriz` hiba nélkül fut.
- [ ] Az ügyfél átnézte az árakat, a nyitvatartást és az adatkezelési tájékoztatót (ez sablon, nem jogi tanács: ha érzékeny adatot is kezelnek, nézesse át szakemberrel).
- [ ] A domain az ügyfél nevén van, a hozzáférés nála van.
- [ ] Az ügyfél tagja a Netlify-projektnek (vagy saját fiókjába került át), és megkapja az űrlapüzeneteket.
- [ ] Megmutattátok neki, hogyan írja át a nyitvatartást: a GitHub webes felületén az `uzlet.json` szerkesztése → mentés → a Netlify pár perc alatt újraépíti az oldalt. Ha hibás a fájl, a build nem megy ki, a régi oldal marad élőben.
- [ ] Megbeszéltétek, ki és milyen határidővel módosít (szenteste, szabadság).

## Mire figyeljetek

- **Őszinteség.** Ne kerüljön az oldalra kitalált vélemény, „100+ elégedett ügyfél”, stock csapatkép. Ha nincs vélemény, nincs véleményblokk.
- **Újraépítés.** Az „Eltérő nyitvatartás” lista a build napjától számított 4 hónapot mutatja (a már elmúlt napokat a böngésző elrejti). Érdemes havonta egyszer automatikusan újraépíteni: Netlify **Build hooks** + egy ütemezett hívás (pl. GitHub Actions `schedule`).
- **Semmi külső beágyazás.** Térkép, Instagram-feed, foglalási widget, chat: mind sütit tesz és megtöri a CSP-t. Linkkel oldjátok meg. Ha mégis kell, a `netlify.toml` CSP-jét tudatosan kell bővíteni, és az adatkezelési tájékoztatót is.
- **Inline kód tilos.** A CSP `script-src 'self'; style-src 'self'`, ezért ne írjatok `style="…"` attribútumot vagy `<script>` blokkot. Az Astro komponensek `<style>` és `<script>` blokkjai rendben vannak: külön fájlba kerülnek (`inlineStylesheets: 'never'`, `assetsInlineLimit: 0`). Az `npm run ellenoriz` szól, ha valami mégis becsúszik.
- **A szöveg az ügyfél szavaival.** Kérdezzétek meg, mit kérdeznek tőle a legtöbbször a pultnál, és arra válaszoljon az oldal.

## Fájlszerkezet

```
src/config/uzlet.json     ← AZ EGYETLEN FÁJL, amit ügyfélenként szerkesztetek
src/config/schema.ts      Zod-séma: mezők, formátumok, kontraszt-ellenőrzés
src/config/tipusok.ts     üzlettípusok alapértelmezései (schema.org típus, téma, űrlapszövegek)
src/config/temak.ts       a 3 témakészlet színei és betűi
src/lib/nyitvatartas.ts   nyitvatartás-logika (build + böngésző), ünnepnapok
src/scripts/nyitva.ts     az egyetlen kliensoldali szkript
src/pages/                oldalak, robots.txt, favicon.svg
src/assets/fotok/         az ügyfél fotói
examples/                 példakonfigok (pekseg, borbely) és fotóik
scripts/                  pelda, ellenoriz, sema
netlify.toml              build, CSP és biztonsági fejlécek, gyorsítótár
```
