// Build-oldali segéd: a konfig nyitvatartása a kliensmodul formátumában,
// és a közelgő eltérések listája.
import { uzlet } from '../config';
import {
  budapestiIdo,
  datumKiir,
  NAP_NEV,
  hetNapja,
  napotHozzaad,
  napiNyitvatartas,
  savokKiir,
  unnepnapok,
  type NyitvatartasAdat,
} from './nyitvatartas';

export const nyitvaAdat: NyitvatartasAdat = {
  het: uzlet.nyitvatartas.het,
  unnepnapokonZarva: uzlet.nyitvatartas.unnepnapokonZarva,
  kivetelek: uzlet.nyitvatartas.kivetelek,
};

export const nyitvaJson = JSON.stringify(nyitvaAdat);

export interface Elteres {
  /** Az utolsó érintett nap (ISO) – a kliens ez után elrejti. */
  ig: string;
  szoveg: string;
}

/** A build napjától számított `napok` napon belüli eltérések: kivételek és ünnepnapok. */
export function kozelgoElteresek(napok = 120): Elteres[] {
  const ma = budapestiIdo().iso;
  const hatar = napotHozzaad(ma, napok);
  const lista: Array<Elteres & { tol: string }> = [];

  for (const k of uzlet.nyitvatartas.kivetelek) {
    const ig = k.datumIg ?? k.datum;
    if (ig < ma || k.datum > hatar) continue;
    const mikor =
      ig === k.datum ? `${datumKiir(k.datum)} (${NAP_NEV[hetNapja(k.datum)]})` : `${datumKiir(k.datum)} – ${datumKiir(ig)}`;
    lista.push({ tol: k.datum, ig, szoveg: `${mikor}: ${savokKiir(k.nyitva)}${k.megjegyzes ? ` – ${k.megjegyzes}` : ''}` });
  }

  if (uzlet.nyitvatartas.unnepnapokonZarva) {
    const evek = new Set([Number(ma.slice(0, 4)), Number(hatar.slice(0, 4))]);
    for (const ev of evek) {
      for (const [iso, nev] of unnepnapok(ev)) {
        if (iso < ma || iso > hatar) continue;
        const nap = napiNyitvatartas(nyitvaAdat, iso);
        // Csak ha a heti rend szerint nyitva lenne, és nem kivétel írja felül.
        const kivetelben = uzlet.nyitvatartas.kivetelek.some((k) => iso >= k.datum && iso <= (k.datumIg ?? k.datum));
        if (kivetelben || !uzlet.nyitvatartas.het[nap.nap].length) continue;
        lista.push({ tol: iso, ig: iso, szoveg: `${datumKiir(iso)} (${NAP_NEV[nap.nap]}): zárva – ${nev}` });
      }
    }
  }

  return lista.sort((a, b) => a.tol.localeCompare(b.tol)).map(({ ig, szoveg }) => ({ ig, szoveg }));
}
