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

function temaBetuk(): Plugin {
  const id = 'virtual:tema-betuk';
  return {
    name: 'folyam-tema-betuk',
    resolveId(forras) {
      if (forras === id) return '\0' + id;
    },
    load(azonosito) {
      if (azonosito === '\0' + id) return BETUK[uzlet.temaNev].map((f) => `import '${f}';`).join('\n');
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
