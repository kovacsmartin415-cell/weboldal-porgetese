/*
 * Netlify esemény-függvény: a `submission-created` név miatt a Netlify MINDEN ellenőrzött
 * (spamszűrőn átment) űrlapbeküldés után automatikusan meghívja. Kívülről URL-en nem hívható:
 * a Netlify a saját JWS-aláírásával védi az esemény-függvényeket.
 *
 * A törzs: { "payload": { id, form_name, created_at, site_url, data: { ...mezők, ip, user_agent, referrer } } }
 * Telepítés és környezeti változók: ../../README.md („B” változat).
 */
import { konfigKornyezetbol, kliensekKonfigbol, feldolgoz } from './feldolgozo.ts';

export default async (req: Request): Promise<Response> => {
  const konfig = konfigKornyezetbol(process.env);
  const torzs = await req.json();
  const eredmeny = await feldolgoz(torzs, konfig, kliensekKonfigbol(konfig), Date.now());
  console.log('[urlap] Feldolgozva: ' + eredmeny);
  return new Response(eredmeny);
};
