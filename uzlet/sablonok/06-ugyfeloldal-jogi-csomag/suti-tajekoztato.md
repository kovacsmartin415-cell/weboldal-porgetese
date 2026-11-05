> **Sablon – nem jogi tanácsadás, éles használat előtt ügyvéddel átnézetendő.**
> Csak akkor kell, ha az oldalon van süti vagy hasonló, a látogató eszközén tárolt azonosító. Ha nincs, ne tegyétek ki, és sütisáv se legyen.
>
> A sütik elhelyezéséhez (a feltétlenül szükségesek kivételével) a látogató előzetes hozzájárulása kell. Ez az e-adatvédelmi irányelv (2002/58/EK) 5. cikk (3) bekezdéséből jön; a magyar átültetése az elektronikus hírközlésről szóló 2003. évi C. törvény (Eht.) 155. § (4) bekezdése (hatályos szövegét ellenőrizni). A hozzájárulás feltételei a GDPR szerintiek (4. cikk 11. pont, 7. cikk).

---

## Előbb: kell-e ez egyáltalán?

*Belső útmutató, közzététel előtt törlendő.*

Egy kis bolt oldalán általában nincs rá szükség, ha:

- a térképet linkként vagy statikus képként tesszük ki, nem beágyazott Google Térképként;
- a betűtípus saját tárhelyről töltődik;
- nincs Facebook-pixel, Google Analytics, YouTube-beágyazás (vagy a YouTube-videó kattintásra töltődik, `youtube-nocookie.com` címről);
- a látogatottság mérésére semmit nem használunk, vagy a tárhely szerveroldali statisztikáját nézzük.

Ha az ügyfél ragaszkodik a Google Analyticshez:

- Sütisáv kell, amelyben az **elutasítás ugyanolyan könnyű, mint az elfogadás** (azonos méretű, egy kattintásos gombok), nincs előre bejelölt jelölőnégyzet, és az analitika **csak elfogadás után** töltődik be.
- A döntést meg kell tudni változtatni később is (pl. lábléc: „Sütibeállítások”).
- A Google Analytics IP-címet és eszközazonosítót küld az USA-ba; ezt az adatkezelési tájékoztatóban is le kell írni.
- Gondoljátok végig, megéri-e: egy napi 30 látogatós pékségnél a mérés keveset mond, a sütisáv viszont mindenkit zavar.

---

# Süti-tájékoztató

Hatályos: {{2026. … …}}-tól

A {{valahol-pekseg.hu}} oldal üzemeltetője {{Valahol Pékség Kft.}} (elérhetőségek az [impresszumban](/impresszum/)). Ez a tájékoztató az [adatkezelési tájékoztató](/adatkezeles/) része.

## Mi az a süti?

Kis szöveges fájl, amelyet a weboldal a böngésződben tárol, és a következő látogatáskor visszaolvas. Ugyanígy kezeljük a böngésző helyi tárolóját (localStorage) és a hasonló technikákat.

## Milyen sütiket használunk?

### Feltétlenül szükséges sütik

Ezek nélkül az oldal egy funkciója nem működne. Ehhez nem kell hozzájárulás.

| Név | Ki helyezi el | Mire | Meddig |
|---|---|---|---|
| {{sutibeallitas}} | mi | megjegyzi, hogy elfogadtad vagy elutasítottad a statisztikai sütiket | {{6 hónap}} |

### Statisztikai sütik (csak a hozzájárulásoddal)

Ezekkel mérjük, hányan és honnan látogatják az oldalt, mely oldalakat nézik. A sütik csak akkor kerülnek a böngésződbe, ha a sütisávon az „Elfogadom” gombra kattintasz.

| Név | Ki helyezi el | Mire | Meddig |
|---|---|---|---|
| `_ga` | Google (Google Analytics 4) | megkülönbözteti a látogatókat | 2 év |
| `_ga_{{AZONOSÍTÓ}}` | Google (Google Analytics 4) | a munkamenet állapotát tárolja | 2 év |

*A pontos neveket és lejáratokat a beállítás után a böngésző fejlesztői eszközében nézzétek meg, és azt írjátok be, ami ténylegesen ott van.*

Jogalap: a hozzájárulásod (GDPR 6. cikk (1) bekezdés a) pont). A Google Analytics adatai a Google LLC-hez (USA) kerülhetnek; a továbbítás alapja az EU–USA adatvédelmi keretrendszer és az általános szerződési feltételek (részletek az adatkezelési tájékoztató 4. pontjában). A Google adatkezeléséről: policies.google.com/privacy.

Beállítások a Google Analyticsben: {{a GA4 a Google tájékoztatása szerint nem tárol IP-címet (ellenőrizendő); adatmegőrzés: 2 hónap; Google-jelek: kikapcsolva; adatmegosztás a Google-lel: kikapcsolva}}.

### Harmadik féltől származó tartalom

{{Ha van beágyazott térkép vagy videó:}} A térkép (Google Térkép) / a videó (YouTube) csak akkor töltődik be, ha rákattintasz. Ekkor a Google saját sütiket helyezhet el, amelyekre a Google tájékoztatója vonatkozik.

## Hogyan változtathatod meg a döntésed?

Bármikor, az oldal alján lévő **„Sütibeállítások”** linken. A hozzájárulás visszavonása nem érinti a korábbi adatkezelés jogszerűségét.

A böngésződben is törölheted a sütiket, vagy letilthatod őket:
- Chrome: Beállítások → Adatvédelem és biztonság → Harmadik féltől származó cookie-k
- Firefox: Beállítások → Adatvédelem és biztonság
- Safari: Beállítások → Adatvédelem
- Edge: Beállítások → Cookie-k és webhelyengedélyek

## Kérdés, panasz

Az adatkezelési tájékoztató 6–8. pontja szerint.
