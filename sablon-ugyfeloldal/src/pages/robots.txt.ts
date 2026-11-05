import type { APIRoute } from 'astro';
import { uzlet } from '../config';

// Bemutató oldalnál semmit ne indexeljenek a keresők.
export const GET: APIRoute = () => {
  const szoveg = uzlet.bemutato
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${uzlet.domain}/sitemap-index.xml\n`;
  return new Response(szoveg, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
