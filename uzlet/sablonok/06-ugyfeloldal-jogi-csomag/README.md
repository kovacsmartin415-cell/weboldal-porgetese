# Jogi szövegek az ügyfeleknek készített oldalakhoz

> **Nem jogi tanácsadás, éles használat előtt ügyvéddel átnézetendő.** Ezek mintaszövegek egy kis helyi vállalkozás (pék, virágos, borbély, asztalos, kis szállás) egy- vagy többoldalas weboldalához. Az ügyfél a saját oldaláért és a saját adatkezeléséért felel; mi a kitöltésben segítünk. Ezt az ajánlatban és a szerződésben is így írjuk.

A Folyam Studio saját oldalának szövegei (`adatkezeles/`, `impresszum/` a repó gyökerében) jó kiindulópontok voltak; ezek a sablonok arra épülnek, de az ügyfél az adatkezelő, nem mi.

## Mikor melyik kell

| Fájl | Mikor kell | Hova kerül az oldalon |
|---|---|---|
| `impresszum.md` | Mindig. | Lábléc: „Impresszum” link |
| `adatkezelesi-tajekoztato.md` | Mindig, ha van űrlap. Űrlap nélkül is ajánlott, mert a tárhely naplóz. | Lábléc + az űrlap alatt link |
| `suti-tajekoztato.md` | Csak ha van süti vagy analitika (Google Analytics, Facebook-pixel, beágyazott Google Térkép, YouTube). Ha nincs, ne tegyétek ki, hanem az adatkezelési tájékoztatóba írjátok be, hogy nincs süti. | Lábléc + a sütisáv „Részletek” linkje |
| `akadalymentessegi-nyilatkozat.md` | Kis boltnál nem kötelező (lásd a fájl elején), de jó gyakorlat. Online foglalásnál vagy rendelésnél nézzétek meg a fájl elején a kérdéseket. | Lábléc: „Akadálymentesség” |

## Alapelvek, amelyekkel a legtöbb szöveg rövid marad

- **Ne legyen süti, ha nem muszáj.** A Google Térképet ne ágyazzuk be, hanem linkeljük vagy statikus képpel mutassuk. A betűtípusokat saját tárhelyről töltsük, ne a Google szerveréről. Így nem kell sütisáv.
- **Csak annyi űrlapmező, amennyi kell.** Minden mezőt meg kell indokolni a tájékoztatóban.
- **Az ajánlatkérés jogalapja általában a szerződés előkészítése** (GDPR 6. cikk (1) b) pont), nem a hozzájárulás. Ezért nem kell kötelező „elfogadom” jelölőnégyzet; elég egy mondat és link az űrlap alatt. Ha mégis hírlevelet akar az ügyfél, az külön, nem előre bejelölt hozzájárulás.
- **Ugyanazok az adatok mindenhol.** Az impresszum, a tájékoztató, a Google Cégprofil és a lábléc adatai egyezzenek.

## Kitöltési sorrend

1. Impresszum (ehhez kell a legkevesebb, és innen jönnek az adatkezelő adatai).
2. Adatkezelési tájékoztató: az 1. melléklet szerinti űrlapmezők és a használt szolgáltatások alapján.
3. Ha van analitika: süti-tájékoztató és sütisáv.
4. Akadálymentességi nyilatkozat az átadás előtti ellenőrzés (`07`) eredményével.
