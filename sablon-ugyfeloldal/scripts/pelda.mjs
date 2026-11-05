// Példakonfig bemásolása: npm run pelda -- pekseg
// Az examples/<nev>.json lesz az src/config/uzlet.json, az examples/fotok/<nev>/
// mappa tartalma pedig az src/assets/fotok/ mappába kerül (a régi fotók törlődnek).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { uzletSema } from '../src/config/schema.ts';

const gyoker = fileURLToPath(new URL('..', import.meta.url));
const nev = process.argv[2];
const peldak = readdirSync(`${gyoker}examples`)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

if (!nev || !peldak.includes(nev)) {
  console.error(`Használat: npm run pelda -- <név>\nElérhető példák: ${peldak.join(', ')}`);
  process.exit(1);
}

const adat = JSON.parse(readFileSync(`${gyoker}examples/${nev}.json`, 'utf8'));
const ellenorzes = uzletSema.safeParse(adat);
if (!ellenorzes.success) {
  console.error(`Az examples/${nev}.json hibás – nem másoltam be semmit.`);
  console.error(ellenorzes.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

adat.$schema = '../../uzlet.schema.json';
writeFileSync(`${gyoker}src/config/uzlet.json`, JSON.stringify(adat, null, 2) + '\n');

const fotoCel = `${gyoker}src/assets/fotok`;
rmSync(fotoCel, { recursive: true, force: true });
mkdirSync(fotoCel, { recursive: true });
const fotoForras = `${gyoker}examples/fotok/${nev}`;
if (existsSync(fotoForras)) cpSync(fotoForras, fotoCel, { recursive: true });

console.log(`Kész: src/config/uzlet.json = examples/${nev}.json${existsSync(fotoForras) ? `, fotók: examples/fotok/${nev}/ → src/assets/fotok/` : ' (fotók nélkül)'}.`);
console.log('Következő lépés: npm run dev  vagy  npm run build');
