// Átadás előtti gyors ellenőrzés a kész buildön (npm run build után):
//   npm run ellenoriz
// - JSON-LD: szintaxis, schema.org típusok és mezőnevek, kötelező mezők
// - CSP-kompatibilitás: nincs inline szkript/stílus, nincs külső erőforrás
// - minden oldalon: lang, title, meta description, pontosan egy h1, alt a képeken
// - figyelmeztet a [TESZT ADAT] jelölésekre és a bemutató módra
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
if (!existsSync(dist)) {
  console.error('Nincs dist mappa. Előbb: npm run build');
  process.exit(1);
}

// A sablon által használt schema.org típusok és tulajdonságaik (schema.org v29 alapján).
const HELYI_VALLALKOZAS = [
  'name', 'description', 'url', 'telephone', 'email', 'image', 'logo', 'address', 'geo', 'hasMap',
  'openingHoursSpecification', 'specialOpeningHoursSpecification', 'priceRange', 'currenciesAccepted',
  'paymentAccepted', 'foundingDate', 'sameAs', 'hasOfferCatalog', 'areaServed', 'makesOffer',
];
const SZALLAS = [...HELYI_VALLALKOZAS, 'checkinTime', 'checkoutTime', 'amenityFeature', 'numberOfRooms', 'petsAllowed', 'starRating'];
const TIPUSOK = {
  LocalBusiness: HELYI_VALLALKOZAS,
  Bakery: HELYI_VALLALKOZAS,
  Florist: HELYI_VALLALKOZAS,
  HairSalon: HELYI_VALLALKOZAS,
  BeautySalon: HELYI_VALLALKOZAS,
  HomeAndConstructionBusiness: HELYI_VALLALKOZAS,
  GeneralContractor: HELYI_VALLALKOZAS,
  CafeOrCoffeeShop: HELYI_VALLALKOZAS,
  Store: HELYI_VALLALKOZAS,
  LodgingBusiness: SZALLAS,
  BedAndBreakfast: SZALLAS,
  Hotel: SZALLAS,
  Motel: SZALLAS,
  Hostel: SZALLAS,
  PostalAddress: ['streetAddress', 'addressLocality', 'postalCode', 'addressCountry', 'addressRegion'],
  GeoCoordinates: ['latitude', 'longitude'],
  OpeningHoursSpecification: ['dayOfWeek', 'opens', 'closes', 'validFrom', 'validThrough'],
  OfferCatalog: ['name', 'itemListElement'],
  Offer: ['itemOffered', 'price', 'priceCurrency', 'priceSpecification', 'availability'],
  PriceSpecification: ['price', 'minPrice', 'maxPrice', 'priceCurrency'],
  Product: ['name', 'description', 'image'],
  Service: ['name', 'description', 'image'],
};
const NAPOK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const hibak = [];
const figyelmeztetesek = [];

function jsonLdBejar(obj, ut, fajl) {
  if (Array.isArray(obj)) return obj.forEach((o, i) => jsonLdBejar(o, `${ut}[${i}]`, fajl));
  if (!obj || typeof obj !== 'object') return;
  const tipus = obj['@type'];
  if (tipus) {
    const engedett = TIPUSOK[tipus];
    if (!engedett) hibak.push(`${fajl} ${ut}: ismeretlen vagy nem várt @type: ${tipus}`);
    else {
      for (const kulcs of Object.keys(obj)) {
        if (!kulcs.startsWith('@') && !engedett.includes(kulcs)) hibak.push(`${fajl} ${ut}: a(z) ${tipus} típusnak nincs „${kulcs}” mezője`);
      }
    }
    if (tipus === 'OpeningHoursSpecification') {
      for (const k of ['opens', 'closes']) if (!/^\d{2}:\d{2}$/.test(obj[k])) hibak.push(`${fajl} ${ut}.${k}: ÓÓ:PP kell`);
      for (const n of [].concat(obj.dayOfWeek ?? [])) if (!NAPOK.includes(n)) hibak.push(`${fajl} ${ut}: hibás nap: ${n}`);
    }
  }
  for (const [k, v] of Object.entries(obj)) if (v && typeof v === 'object') jsonLdBejar(v, `${ut}.${k}`, fajl);
}

const htmlFajlok = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? htmlFajlok(p) : f.endsWith('.html') ? [p] : [];
  });

let jsonLdDb = 0;
for (const fajl of htmlFajlok(dist)) {
  const nev = relative(dist, fajl);
  const html = readFileSync(fajl, 'utf8');

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    jsonLdDb++;
    let adat;
    try {
      adat = JSON.parse(m[1]);
    } catch (e) {
      hibak.push(`${nev}: a JSON-LD nem érvényes JSON (${e.message})`);
      continue;
    }
    if (adat['@context'] !== 'https://schema.org') hibak.push(`${nev}: a JSON-LD @context legyen https://schema.org`);
    for (const kotelezo of ['name', 'address', 'telephone', 'url', 'openingHoursSpecification']) {
      if (!(kotelezo in adat)) hibak.push(`${nev}: a JSON-LD-ből hiányzik: ${kotelezo}`);
    }
    jsonLdBejar(adat, '$', nev);
  }

  // CSP: script-src 'self', style-src 'self'
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/g)) hibak.push(`${nev}: inline szkript: ${m[0]}`);
  if (/<style[\s>]/.test(html)) hibak.push(`${nev}: inline <style> blokk (a CSP tiltja)`);
  if (/\sstyle="/.test(html)) hibak.push(`${nev}: style="" attribútum (a CSP tiltja)`);
  if (/\son[a-z]+="/.test(html)) hibak.push(`${nev}: inline eseménykezelő (onclick stb.)`);
  for (const m of html.matchAll(/<(?:script|img|source|link|iframe)[^>]+(?:src|href|srcset)="(https?:)?\/\/[^"]+"/g)) {
    if (!/rel="(canonical|me|noopener)"/.test(m[0])) hibak.push(`${nev}: külső erőforrás: ${m[0].slice(0, 120)}`);
  }
  if (/<iframe/.test(html)) hibak.push(`${nev}: iframe (pl. beágyazott térkép) – sütik miatt kerülendő`);

  // alapvető SEO és akadálymentesség
  if (!/<html lang="hu"/.test(html)) hibak.push(`${nev}: hiányzik a lang="hu"`);
  if (!/<title>[^<]{5,}<\/title>/.test(html)) hibak.push(`${nev}: hiányzik a <title>`);
  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) hibak.push(`${nev}: hiányzik vagy túl rövid a meta description`);
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) hibak.push(`${nev}: ${h1} darab h1 van (1 kell)`);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(m[0])) hibak.push(`${nev}: alt nélküli kép`);
  if (!html.includes('href="#tartalom"')) hibak.push(`${nev}: hiányzik az „Ugrás a tartalomra” link`);

  const teszt = (html.match(/\[TESZT ADAT\]/g) ?? []).length;
  if (teszt) figyelmeztetesek.push(`${nev}: ${teszt} db [TESZT ADAT] – töltsd ki az adatkezelo mezőit az uzlet.json-ban`);
  if (html.includes('class="bemutato-sav"') && nev === 'index.html') figyelmeztetesek.push('bemutato: true – éles ügyféloldalnál állítsd false-ra (különben noindex)');
}

const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
if (robots.includes('Disallow: /\n')) figyelmeztetesek.push('robots.txt mindent tilt (bemutató mód)');
if (!existsSync(join(dist, 'sitemap-index.xml'))) hibak.push('hiányzik a sitemap-index.xml');
if (jsonLdDb === 0) hibak.push('nincs JSON-LD a főoldalon');

for (const f of figyelmeztetesek) console.log(`FIGYELEM  ${f}`);
for (const h of hibak) console.log(`HIBA      ${h}`);
console.log(`\n${htmlFajlok(dist).length} oldal, ${jsonLdDb} JSON-LD blokk, ${hibak.length} hiba, ${figyelmeztetesek.length} figyelmeztetés.`);
process.exit(hibak.length ? 1 : 0);
