import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import type { Plugin } from 'vite';
import { uzlet } from './src/config/index.ts';

// Csak a kiválasztott témakészlet betűi kerülnek a buildbe (latin + latin-ext,
// tehát az ő és ű is). A betűk a @fontsource csomagokból jönnek, saját
// domainről töltődnek: nincs Google Fonts, nincs harmadik fél.
const BETUK: Record<string, string[]> = {
  meleg: [
    '@fontsource/young-serif/latin-400.css',
    '@fontsource/young-serif/latin-ext-400.css',
    '@fontsource-variable/source-sans-3/wght.css',
  ],
  letisztult: ['@fontsource-variable/newsreader/opsz.css', '@fontsource-variable/public-sans/wght.css'],
  meresz: ['@fontsource-variable/archivo/wdth.css'],
};

// A témakészlet + a konfigban felülírt színek CSS custom property-ként.
// Virtuális CSS-modulként a fő stíluslapba kerül (hash-elt fájl, nincs inline stílus).
function temaValtozok(): string {
  const t = uzlet.temaAdat;
  const s = uzlet.szinek;
  return `:root {
  --hatter: ${s.hatter};
  --felulet: ${s.felulet};
  --szoveg: ${s.szoveg};
  --halvany: ${s.halvany};
  --kiemelo: ${s.kiemelo};
  --kiemelo-szoveg: ${s.kiemeloSzoveg};
  --vonal: ${t.vonal};
  --betu-cim: ${t.betuCim};
  --betu-torzs: ${t.betuTorzs};
  --cim-suly: ${t.cimSuly};
  --cim-szelesseg: ${t.cimSzelesseg};
  --cim-atalakitas: ${t.cimNagybetus ? 'uppercase' : 'none'};
  color-scheme: ${t.nev === 'meresz' ? 'dark' : 'light'};
}\n`;
}

function tema(): Plugin {
  const betuk = 'virtual:tema-betuk';
  const valtozok = 'virtual:tema-valtozok.css';
  return {
    name: 'folyam-tema',
    resolveId(forras) {
      if (forras === betuk || forras === valtozok) return '\0' + forras;
    },
    load(azonosito) {
      if (azonosito === '\0' + betuk) return BETUK[uzlet.temaNev].map((f) => `import '${f}';`).join('\n');
      if (azonosito === '\0' + valtozok) return temaValtozok();
    },
  };
}

export default defineConfig({
  site: uzlet.domain,
  trailingSlash: 'always',
  output: 'static',
  build: {
    format: 'directory',
    // Szigorú CSP miatt: semmi inline <style> vagy <script>, minden külön fájl.
    inlineStylesheets: 'never',
  },
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      filter: (oldal) => !/\/(koszonjuk|404)\/?$/.test(oldal),
    }),
  ],
  vite: {
    plugins: [temaBetuk()],
    build: {
      // 0 = semmilyen kis szkript, stílus vagy kép ne kerüljön inline-ba (data: URI).
      assetsInlineLimit: 0,
    },
  },
});
