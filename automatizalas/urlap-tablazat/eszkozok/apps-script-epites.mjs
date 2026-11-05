// Az Apps Script-változat összeállítása EGYETLEN, beilleszthető fájlba:
//   apps-script/Kod.js (Apps Script-specifikus rész, beállításokkal az elején)
// + kozos/urlap-logika.ts + kozos/email-sablon.ts (típusok nélkül, egy `UrlapLogika` névtérbe csomagolva)
// = apps-script/Kod.gs  ← ezt kell bemásolni az Apps Script-szerkesztőbe.
//
// Futtatás: npm run build:apps-script   (Node 22.18+; függőség nincs)
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const GYOKER = join(dirname(fileURLToPath(import.meta.url)), '..');
const KOZOS = ['kozos/urlap-logika.ts', 'kozos/email-sablon.ts'];
export const KIMENET = join(GYOKER, 'apps-script', 'Kod.gs');

/**
 * Típuseltávolítás „strip” módban (a kód karakterre pontosan megmarad, csak a típusok helyén lesz szóköz),
 * majd a típusok helyén maradt szóközök összehúzása. A transform módot szándékosan kerüljük: az a
 * reguláris kifejezésekben lévő U+2028-féle escape-eket nyers karakterré alakítaná, ami szintaktikai hiba.
 */
// A strip mód a típusok helyére szóközt, nem ASCII karakter helyére néha nem törő szóközt (U+00A0) tesz.
const URES = (c) => c !== '\n' && c !== '\r' && /\s/.test(c);

export function tipusTelenit(forras) {
  const ki = stripTypeScriptTypes(forras, { mode: 'strip' });
  if (ki.length !== forras.length) throw new Error('Váratlan: a strip mód megváltoztatta a hosszt.');
  let ered = '';
  let i = 0;
  while (i < ki.length) {
    if (URES(ki[i])) {
      let j = i;
      let valtozott = false;
      while (j < ki.length && URES(ki[j])) {
        if (ki[j] !== forras[j]) valtozott = true;
        j++;
      }
      if (!valtozott) {
        ered += ki.slice(i, j);
      } else {
        const elozo = ered.slice(-1);
        const kov = ki[j];
        const sorelejen = elozo === '' || elozo === '\n';
        if (sorelejen) ered += forras.slice(i, j).match(/^[ \t]*/)[0]; // eredeti behúzás megtartása
        else if (/[),;\]\n]/.test(kov) || elozo === '(' || kov === undefined) ered += '';
        else ered += ' ';
      }
      i = j;
    } else {
      ered += ki[i];
      i++;
    }
  }
  return ered
    .replace(/^[^\S\n]+$/gm, '') // csak whitespace-ből álló sorok ürítése
    .replace(/\/\*\*(?:(?!\*\/)[^])*\*\/\n(?=[^\S\n]*\n)/g, '') // eltávolított típus fölött árván maradt doc-komment
    .replace(/\n{3,}/g, '\n\n');
}

function modulTorzs(relUt, exportok) {
  let kod = tipusTelenit(readFileSync(join(GYOKER, relUt), 'utf8'));
  kod = kod.replace(/^import [^\n]*\n/gm, '');
  kod = kod.replace(/^export (async function|function|const|let|class) ([A-Za-z0-9_$]+)/gm, (_, fajta, nev) => {
    exportok.push(nev);
    return fajta + ' ' + nev;
  });
  if (/^\s*(export|import)\b/m.test(kod)) throw new Error(relUt + ': maradt export/import sor – csak egysoros importot és `export function|const` alakot használj.');
  if (/\?\.|\?\?/.test(kod)) throw new Error(relUt + ': `?.` vagy `??` az Apps Script-be kerülő kódban – kerüld.');
  return '// ===== ' + relUt + ' =====\n' + kod.trim() + '\n';
}

export function epit() {
  const exportok = [];
  const torzsek = KOZOS.map((f) => modulTorzs(f, exportok));
  const ragasz = readFileSync(join(GYOKER, 'apps-script', 'Kod.js'), 'utf8').trim();
  const nevter =
    '/* ======================================================================\n' +
    ' * KÖZÖS LOGIKA – generált rész, NE szerkeszd itt!\n' +
    ' * Forrás: automatizalas/urlap-tablazat/kozos/*.ts  (npm run build:apps-script)\n' +
    ' * ==================================================================== */\n' +
    'const UrlapLogika = (function () {\n' +
    '"use strict";\n' +
    torzsek.join('\n') +
    '\nreturn {\n' + exportok.map((n) => '  ' + n + ': ' + n).join(',\n') + '\n};\n})();\n';
  return '/* GENERÁLT FÁJL – a forrás az apps-script/Kod.js és a kozos/*.ts. Újraépítés: npm run build:apps-script */\n\n' +
    ragasz + '\n\n' + nevter;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(KIMENET, epit());
  console.log('Kész: ' + KIMENET);
}
