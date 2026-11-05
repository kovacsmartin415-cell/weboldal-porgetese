import type { APIRoute } from 'astro';
import { uzlet } from '../config';

// Egyszerű ikon a cég kezdőbetűjével, a téma színeiben. Ha az ügyfélnek van
// logója, tegyél egy saját favicon.svg-t a public mappába, és töröld ezt a fájlt.
export const GET: APIRoute = () => {
  const betu = [...uzlet.nev.trim()][0]?.toUpperCase() ?? '•';
  const csalad = uzlet.temaNev === 'meresz' ? 'Arial Narrow, Arial, sans-serif' : 'Georgia, serif';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="6" fill="${uzlet.szinek.kiemelo}"/><text x="32" y="45" text-anchor="middle" font-family="${csalad}" font-size="40" font-weight="700" fill="${uzlet.szinek.kiemeloSzoveg}">${betu.replace(/[<>&"]/g, '')}</text></svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
