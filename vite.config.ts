import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    target: 'es2022',
    assetsInlineLimit: 0, // CSP: ne kerüljön data: URI-be betűtípus
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        adatkezeles: resolve(__dirname, 'adatkezeles/index.html'),
        impresszum: resolve(__dirname, 'impresszum/index.html'),
        koszonjuk: resolve(__dirname, 'koszonjuk/index.html'),
        notfound: resolve(__dirname, '404.html'),
      },
    },
  },
});
