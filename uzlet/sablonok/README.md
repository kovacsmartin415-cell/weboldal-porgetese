# Folyam Studio – üzleti sablonok

Kovács Martin és Zachar Zekő weboldal-készítő kezdeményezésének papírjai, az első hívástól az átadásig. Helyi boltoknak (pék, virágos, borbély, asztalos, kis szállás) készítünk egy- vagy többoldalas weboldalt, ajánlatkérő űrlapot e-mail- és táblázat-automatizálással, és rendbe tesszük a Google Cégprofilt. Webshopot, közösségimédia-kezelést és Google-helyezés garanciát nem vállalunk.

**Állapot:** 0.1-es változat, 2026. november. Bejegyzett vállalkozásunk még nincs, ezért a saját adataink helyén `[TESZT ADAT]` áll. A jogi szövegek tervezetek: **nem jogi tanácsadás, éles használat előtt ügyvéddel átnézetendők.**

## Mi mire való

| Fájl | Mire | Mikor |
|---|---|---|
| `01-elso-beszelgetes-kerdoiv.md` (+ `.docx`) | Kérdőív az első híváshoz, jegyzethelyekkel. A Word-változat kitölthető, nyomtatható. | 1. nap |
| `02-arajanlat-sablon.md` | Árajánlat: tételek, mi van benne és mi nincs, ütemezés, 50/50 fizetés, érvényesség, két ÁFA-változat (ÁFA-körös / alanyi mentes). | A terv elfogadása után |
| `03-vallalkozasi-szerzodes-tervezet.md` | Vállalkozási szerződés (Ptk.) weboldal-készítésre: átadás-átvétel, javítási körök, fotók jogtisztasága, felhasználási jog (Szjt.), domain az ügyfél nevén, referencia csak hozzájárulással, felmondás, vita. A végén táblázat arról, melyik jogszabályhelyet hogyan ellenőriztük. | Az ajánlat elfogadása után |
| `04-adatfeldolgozasi-megallapodas.md` | GDPR 28. cikk szerinti adatfeldolgozói szerződés, ha hozzáférünk az ügyfél űrlapadataihoz vagy táblázatához. A szerződés 3. melléklete. | A szerződéssel együtt |
| `05-atadas-atveteli-jegyzokonyv.md` (+ `.docx`) | Átadott oldal, fiókok, dokumentumok, betanítás, hibalista, átvételi nyilatkozat. A szerződés 4. melléklete. | Átadáskor |
| `06-ugyfeloldal-jogi-csomag/` | Az ügyfél oldalára kerülő szövegek: impresszum, adatkezelési tájékoztató (űrlap + Netlify), süti-tájékoztató (csak ha van analitika), akadálymentességi nyilatkozat (és elemzés, kire kötelező). Saját README-je van. | Építés közben |
| `07-atadasi-checklist.md` | Élesítés előtti ellenőrzőlista: Core Web Vitals, WCAG 2.2 AA, jogi, SEO (LocalBusiness JSON-LD, NAP), biztonság, mentés, domain. | Élesítés előtt |

## Kitöltési sorrend egy ügyfélnél

1. **Hívás előtt és alatt:** `01` kérdőív. Hívás után 5 perc összefoglaló.
2. **3. nap:** terv (oldalak, szövegvázlat, fotólista). Ehhez nincs sablon, mert minden ügyfélnél más. Ha nem tetszik, ingyen kidobjuk.
3. **A terv elfogadása után:** `02` árajánlat.
4. **Az ajánlat elfogadása után:** `03` szerződés + `04` adatfeldolgozási megállapodás (ha kell), aláírás, előlegszámla.
5. **Építés közben:** `06` jogi szövegek kitöltése az ügyfél adataival. Domain regisztrálása az ügyfél nevére.
6. **Élesítés előtt:** `07` ellenőrzőlista végig.
7. **Átadáskor:** `05` jegyzőkönyv, betanítás, végszámla.

## Jelölések

- `{{NAGYBETŰS_HELYŐRZŐ}}` vagy `{{példa szöveg}}`: ügyfelenként kitöltendő vagy cserélendő.
- `[TESZT ADAT]`: a Folyam Studio saját adata (cégnév, székhely, adószám, bankszámla), ami a bejegyzés után lesz meg.
- *Dőlt „Megjegyzés”* és „Belső útmutató” blokkok: nekünk vagy az ügyvédnek szólnak, küldés előtt törlendők.

Küldés előtt keressetek rá a fájlban a `{{` és a `[TESZT` szövegre. Ha találat van, a dokumentum még nem kész.

## Mielőtt bármelyiket élesben használjuk

- [ ] **Vállalkozási forma.** Két egyéni vállalkozó, közös bt./kft., vagy egyikünk vállalkozó, a másik alvállalkozó? Ettől függ, ki a szerződő fél, és hogyan rendezzük kettőnk között a szerzői jogot. Könyvelővel és ügyvéddel.
- [ ] **KATA nem jó nekünk:** 2022 szeptembere óta KATA-s egyéni vállalkozó csak magánszemélytől szerezhet KATA-s bevételt, az ügyfeleink pedig vállalkozások. Könyvelővel ellenőrizni.
- [ ] **ÁFA.** Az alanyi adómentesség határa 2026-ban 20 millió Ft éves bevétel (2025-ben 18 millió Ft volt; NAV). Év közben induló vállalkozásnál időarányos. Ha alanyi mentesek vagyunk, a weboldalon és az ajánlatban ne „+ ÁFA” szerepeljen, hanem a végösszeg.
- [ ] **Ügyvéd** nézze át a `03`, `04`, `05` dokumentumot és a `06` mintáit. A `03` végén lévő táblázat megmondja, mit kell a hatályos jogszabályszöveggel összevetni.
- [ ] **Saját adatkezelési tájékoztatónk** (a repó gyökerében, `adatkezeles/`) is kövesse le, ha ügyfelek adataival dolgozunk: ilyenkor mi is adatkezelők vagyunk a saját ügyfeleink kapcsolattartóinak adataira.
- [ ] Érdemes lehet szakmai felelősségbiztosítást kérni ajánlatra, ha az ügyfelek száma nő.

## Források

A jogszabályhelyeket keresőtalálatokkal, egyetemi jegyzetekkel, szakvéleményekkel ellenőriztük (2026. november 5.). A Nemzeti Jogszabálytárat (njt.hu) és a Jogtárat ebből a munkakörnyezetből nem tudtuk közvetlenül megnyitni, ezért ahol „ellenőrizendő” áll, ott a hatályos szöveget meg kell nézni.

- Ptk. (2013. évi V. törvény) 6:238–6:249. § – Miskolci Egyetem ÁJK előadásvázlat; bírósági Ptk. e-learning (projektjeink.birosag.hu); MKIK választottbírósági ítélet 1/7/21.
- Szjt. (1999. évi LXXVI. törvény) 42., 43., 45., 46. § – a Szerzői Jogi Szakértő Testület szakvéleményei (sztnh.gov.hu); Kúria BH 2021.113.
- Aktv. (2022. évi XVII. törvény) – parlament.hu (T/365. törvényjavaslat), hozzafer.hu, nstudio.hu, telex.hu (2025. június 27.), EUR-Lex összefoglaló az (EU) 2019/882 irányelvről.
- Ekertv. (2001. évi CVIII. törvény) 4. § – a hatályos szöveg ellenőrizendő.
- Alanyi adómentesség: nav.gov.hu, „Emelkedik az alanyi adómentesség értékhatára”; adozona.hu.
- Core Web Vitals küszöbök: web.dev, „How the Core Web Vitals metrics thresholds were defined”.
- WCAG 2.2 új feltételei: W3C (w3.org/TR/WCAG22), Deque University összefoglaló.
- Netlify DPA, DPF-tanúsítás: netlify.com/pdf/netlify-dpa.pdf, Netlify Trust Center; dataprivacyframework.gov.
