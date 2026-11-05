> **Sablon – nem jogi tanácsadás, éles használat előtt ügyvéddel átnézetendő.**

---

## Előbb: kötelező-e az ügyfélnek?

*Belső útmutató, közzététel előtt törlendő.*

**A jogszabály.** Az (EU) 2019/882 irányelvet (European Accessibility Act, EAA) Magyarországon a termékekre és a szolgáltatásokra vonatkozó akadálymentességi követelményeknek való megfelelés általános szabályairól szóló **2022. évi XVII. törvény** (Aktv.) ültette át. A végrehajtási részleteket kormányrendelet (a források szerint a 605/2022. Korm. rendelet) adja. A követelményeket **2025. június 28-tól** kell alkalmazni. A törvény a fogyasztóknak nyújtott szolgáltatások közül többek között az **e-kereskedelmi szolgáltatásokra** vonatkozik: ezek olyan, távolról, weboldalon vagy alkalmazáson keresztül nyújtott szolgáltatások, amelyek fogyasztói szerződés megkötésére irányulnak (webshop, online foglalás fizetéssel vagy kötelezettségvállalással).

**Mikrovállalkozás-kivétel.** A keresőtalálatok szerint az Aktv. 3. § (3) bekezdése alapján a **szolgáltatást nyújtó mikrovállalkozás** nem köteles teljesíteni az 1. melléklet szolgáltatásokra vonatkozó követelményeit (3. és 4. pont, ebben vannak a weboldal-követelmények), és mentesül a törvény többi, ehhez kapcsolódó kötelezettsége alól. Ez megfelel az irányelv 4. cikk (5) bekezdésének.

Mikrovállalkozás: **10 főnél kevesebbet foglalkoztat**, és az éves nettó árbevétele **vagy** mérlegfőösszege legfeljebb **2 millió eurónak** megfelelő forintösszeg (a kis- és középvállalkozásokról szóló 2004. évi XXXIV. törvény 3. §-a szerint; ellenőrizendő, hogy az Aktv. erre utal-e vissza). Ha a vállalkozás kinövi ezt, a kivétel megszűnik.

**Mit jelent ez a mi ügyfeleinknek?**

| Helyzet | Valószínű eredmény |
|---|---|
| Pék, virágos, borbély, asztalos bemutatkozó oldala ajánlatkérő űrlappal, online fizetés és online szerződéskötés nélkül | Valószínűleg nem e-kereskedelmi szolgáltatás, és az ügyfél mikrovállalkozás is. Nem kötelező, a nyilatkozat önkéntes. |
| Kis szállás, ahol a foglalás az oldalon köt szerződést (pl. foglalási motor, előleg kártyával) | Lehet e-kereskedelmi szolgáltatás. Ha a szállás mikrovállalkozás, mentesül; ha 10 vagy több főt foglalkoztat, vagy 2 millió eurónál nagyobb az árbevétele, a követelmények vonatkozhatnak rá. Ügyvéddel tisztázni. |
| Időpontfoglaló a borbélynál (külső rendszer, pl. foglalási platform) | A foglaló rendszer szolgáltatója felel a saját felületéért. A mi oldalunk bemutatkozó oldal. Ellenőrizendő. |
| Webshop | Nem vállaljuk. |

A közszféra honlapjaira külön törvény vonatkozik (2018. évi LXXV. törvény), ez magánvállalkozásra nem érvényes.

**Akkor miért tegyük ki?** Mert a WCAG 2.2 AA szintet amúgy is célnak tekintjük (`07-atadasi-checklist.md`), és egy rövid, őszinte nyilatkozat megmutatja a látogatónak, hova írjon, ha elakadt. Ha a vállalkozásra a törvény mégis vonatkozik, ennél részletesebb tájékoztatás kell (a szolgáltatás akadálymentességi jellemzői az általános szerződési feltételekben vagy más jól hozzáférhető helyen); azt az ügyvéd fogalmazza meg.

Források (keresőtalálatok, 2026. november 5.; a törvény szövegét az njt.hu-n ellenőrizni kell): parlament.hu (T/365. törvényjavaslat és indokolás), hozzafer.hu („A 2022. évi XVII. törvényről közérthetően”), nstudio.hu („Akadálymentes weboldal: kire vonatkozik a törvény?”), kts.hu, telex.hu (2025. június 27.), eur-lex.europa.eu (az irányelv összefoglalója), net.jogtar.hu (kkv-törvény).

---

# Akadálymentességi nyilatkozat

Utolsó frissítés: {{2026. … …}}

Szeretnénk, ha a {{valahol-pekseg.hu}} oldalt mindenki használni tudná, akkor is, ha képernyőolvasóval, csak billentyűzettel, nagyítással vagy lassú mobilinternettel böngészik.

{{Önkéntes változat:}} Vállalkozásunk mikrovállalkozás, ezért a 2022. évi XVII. törvény akadálymentességi követelményei ránk nem kötelezőek. Ettől függetlenül az oldalt a nemzetközi irányelv, a **WCAG 2.2 AA** szint szerint készítettük el.

## Mit tettünk?

- Az oldal minden része elérhető billentyűzettel, a kijelölt elem jól látszik.
- A szöveg és a háttér között elég nagy a kontraszt, a szöveg 200%-ra nagyítható, és telefonon is olvasható, oldalra görgetés nélkül.
- A képeknek van szöveges leírása; a díszítő képeket a képernyőolvasó átugorja.
- Az oldalak címsorai logikus sorrendben vannak, a nyelv magyarnak van jelölve.
- Az űrlap mezőinek van felirata, a hibaüzenet szövegesen is megmondja, mi a gond.
- A gombok és linkek elég nagyok ahhoz, hogy ujjal is el lehessen találni őket.
- {{Ha a gépeden be van kapcsolva a mozgáscsökkentés, az oldal nem animál.}}

## Hogyan ellenőriztük?

{{2026. … …}}-án/én saját ellenőrzést végeztünk: automatikus ellenőrzővel ({{axe / WAVE}}), billentyűzettel, {{NVDA / VoiceOver}} képernyőolvasóval, 200%-os nagyítással és telefonon. Külső szakértő nem vizsgálta az oldalt.

## Amiről tudunk, hogy nem tökéletes

- {{Pl. „A Google Térkép, ahová a »Útvonal« link visz, a Google felülete, ennek akadálymentességére nincs ráhatásunk.”}}
- {{Pl. „A letölthető árlap (PDF) képként készült; ugyanez a tartalom szövegként is olvasható a Kínálat oldalon.”}}
- {{Ha nincs ismert hiba: „Jelenleg nem tudunk ilyenről. Ha te találsz, írd meg.”}}

## Ha akadályba ütköztél

Írj nekünk a {{…@…}} címre, vagy hívj a {{…}} számon. Írd meg, melyik oldalon, milyen eszközzel és programmal (pl. „iPhone, VoiceOver”) jártál, és mi nem működött. {{5 munkanapon}} belül válaszolunk, és ha tudjuk, kijavítjuk. Addig is telefonon vagy személyesen minden információt megadunk, ami az oldalon szerepel.
