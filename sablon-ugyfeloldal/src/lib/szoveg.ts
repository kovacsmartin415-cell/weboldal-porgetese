import { forint } from '../config';
import type { Tetel } from '../config/schema';

/** Ár kiírása: „1 450 Ft”, „6 500 Ft-tól”, vagy az arSzoveg. */
export function arKiir(t: Tetel): string {
  if (t.ar === undefined) return t.arSzoveg ?? 'kérj ajánlatot';
  return t.arTol ? `${forint(t.ar)}-tól` : forint(t.ar);
}

/** A tétel mellé írt mértékegység/időtartam: „/ db”, „· 40 perc”. */
export function egysegKiir(t: Tetel): string {
  const reszek: string[] = [];
  if (t.egyseg && t.ar !== undefined) reszek.push(`/ ${t.egyseg}`);
  if (t.idotartam) reszek.push(t.idotartam);
  return reszek.join(' · ');
}
