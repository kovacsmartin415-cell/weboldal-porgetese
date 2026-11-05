# weboldal-porgetese

itt vagyok

A Folyam Studio (Kovács Martin és Zachar Zekő) munkarepója. Ami itt van, és mire jó:

| Mappa / fájl | Mi ez |
|---|---|
| `index.html`, `src/`, `public/`, `adatkezeles/`, `impresszum/`, `koszonjuk/`, `404.html` | A Folyam Studio bemutatóoldala, „Áramlás” változat. Vite + TypeScript + three.js. A tervezési döntések: [`DESIGN.md`](DESIGN.md). |
| [`sablon-ugyfeloldal/`](sablon-ugyfeloldal/README.md) | A termék: Astro-sablon helyi boltok oldalához. Egy konfigfájl kitöltésével kész egy pék, virágos, borbély oldala. Két példa benne. |
| [`automatizalas/urlap-tablazat/`](automatizalas/urlap-tablazat/README.md) | Űrlap → Google Táblázat-sor + értesítő e-mail. Két változat (Apps Script, Netlify Function), 58 teszttel. |
| [`uzlet/vallalkozas-inditas.md`](uzlet/vallalkozas-inditas.md) | Cégforma, adó, költségek, lépések – forrásokkal. Nem adótanácsadás. |
| [`uzlet/sablonok/`](uzlet/sablonok/README.md) | Kérdőív, árajánlat, szerződés-tervezet, adatfeldolgozási megállapodás, átadás-átvétel, ügyféloldal jogi csomag, élesítési checklist. Tervezetek, ügyvéddel átnézendők. |
| [`uzlet/ertekesites/`](uzlet/ertekesites/README.md) | Piac és árak, ügyfélszerzés, megkereső szövegek szakmánként, 90 napos terv. |

## A bemutatóoldal futtatása

```bash
npm install
```

```bash
npm run dev
```

Build: `npm run build` → `dist/`. A Netlify a `netlify.toml` alapján épít, és csak akkor, ha a weboldal forrása változott.

## Amit élesítés előtt el kell intézni

- Valódi e-mail-cím és a hiányzó cégadatok a jogi oldalakon (most `TESZT ADAT` jelöléssel).
- Írásos közös adatkezelési megállapodás kettőtök között, Zekő hozzájárulása a neve megjelenéséhez.
- A jogi szövegeket jogász nézze át.
