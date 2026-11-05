// Próbabeküldés az Apps Script webalkalmazásnak, pontosan úgy, ahogy a Netlify webhook küldené.
// Használat:  npm run proba -- "https://script.google.com/macros/s/AKfy.../exec?kulcs=..."  [email-cím]
// A második (opcionális) paraméter a feladó e-mail-címe – ide megy a visszaigazolás, ha be van kapcsolva.
import { readFileSync } from 'node:fs';

const [url, email] = process.argv.slice(2);
if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec\?kulcs=.+/.test(url)) {
  console.error('Add meg a webalkalmazás URL-jét a kulccsal együtt:\n  npm run proba -- "https://script.google.com/macros/s/.../exec?kulcs=..."');
  process.exit(1);
}
const { payload } = JSON.parse(readFileSync(new URL('./minta-esemeny.json', import.meta.url), 'utf8'));
payload.id = 'proba-' + Date.now(); // minden futás új azonosító, különben duplikátumként kihagyná
payload.created_at = new Date().toISOString();
if (email) payload.data.email = email;

// Az Apps Script a POST után 302-vel átirányít; a fetch ezt GET-ként követi, és így kapjuk meg a választ.
const valasz = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const szoveg = await valasz.text();
console.log('HTTP ' + valasz.status);
console.log(szoveg.slice(0, 500));
try {
  const j = JSON.parse(szoveg);
  console.log(j.ok ? 'Rendben: ' + j.eredmeny + ' – nézd meg a táblázatot és a postafiókot.' : 'Elutasítva: rossz kulcs, vagy hiba történt – nézd meg a Hibanapló lapot.');
} catch {
  console.log('Nem JSON a válasz: valószínűleg nem „Bárki” hozzáféréssel telepítetted, vagy régi a telepítés.');
}
