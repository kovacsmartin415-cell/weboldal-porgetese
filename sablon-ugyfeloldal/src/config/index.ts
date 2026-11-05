// A konfig betöltése és a belőle számolt értékek. Minden oldal innen dolgozik:
//   import { uzlet } from '../config';
// Ezt a fájlt az astro.config.ts is használja (betűk, domain), ezért itt nincs
// import.meta.glob és semmi Astro-specifikus.

import nyers from './uzlet.json';
import { uzletSema, type Uzlet } from './schema';
import { z } from 'zod';
import { TIPUSOK, type TipusAlap } from './tipusok';
import { TEMAK, type Szinek, type Tema } from './temak';

function betolt(): Uzlet {
  const eredmeny = uzletSema.safeParse(nyers);
  if (!eredmeny.success) {
    const uzenet = z.prettifyError(eredmeny.error);
    throw new Error(`\n\nHibás src/config/uzlet.json:\n${uzenet}\n\n(A mezők leírása: README.md és src/config/schema.ts)\n`);
  }
  return eredmeny.data;
}

const cfg = betolt();
const tipusAlap: TipusAlap = TIPUSOK[cfg.tipus];
const tema: Tema = TEMAK[cfg.tema.keszlet ?? tipusAlap.tema];
const szinek: Szinek = { ...tema.szinek, ...cfg.tema.szinek };

const teljesCim = `${cfg.cim.iranyitoszam} ${cfg.cim.varos}, ${cfg.cim.utca}`;
const terkepLink =
  cfg.cim.terkepLink ??
  cfg.googleCegprofil ??
  (cfg.cim.geo
    ? `https://www.google.com/maps/search/?api=1&query=${cfg.cim.geo.lat},${cfg.cim.geo.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cfg.nev}, ${teljesCim}`)}`);
const osmLink = cfg.cim.geo
  ? `https://www.openstreetmap.org/?mlat=${cfg.cim.geo.lat}&mlon=${cfg.cim.geo.lng}#map=18/${cfg.cim.geo.lat}/${cfg.cim.geo.lng}`
  : `https://www.openstreetmap.org/search?query=${encodeURIComponent(teljesCim)}`;

const urlapDatumCimke = cfg.szovegek.urlapDatumCimke ?? ('urlapDatumCimke' in tipusAlap ? tipusAlap.urlapDatumCimke : undefined);

export const uzlet = {
  ...cfg,
  tipusAlap,
  temaNev: tema.nev,
  temaAdat: tema,
  szinek,
  teljesCim,
  terkepLink,
  osmLink,
  /** tel: link, szóközök nélkül, +36 előtaggal */
  telefonHref: `tel:${cfg.telefon.replace(/[^\d+]/g, '').replace(/^06/, '+36')}`,
  cimke: cfg.seo.cimke ?? `${tipusAlap.megnevezes} – ${cfg.cim.varos}`,
  leiras: cfg.seo.leiras ?? cfg.bemutatkozas.rovid,
  szoveg: {
    kiemeltCim: cfg.szovegek.kiemeltCim ?? tipusAlap.kiemeltCim,
    kinalatCim: cfg.kinalat.cim ?? tipusAlap.kinalatCim,
    urlapCim: cfg.szovegek.urlapCim ?? tipusAlap.urlapCim,
    urlapBevezeto: cfg.szovegek.urlapBevezeto ?? tipusAlap.urlapBevezeto,
    urlapTargyak: cfg.szovegek.urlapTargyak ?? [...tipusAlap.urlapTargyak],
    urlapDatumCimke: urlapDatumCimke || undefined,
  },
};

export type UzletAdat = typeof uzlet;

/** Forint formázás: 1 450 Ft (nem törő szóközzel). */
export function forint(osszeg: number): string {
  return `${new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(osszeg).replace(/\s/g, ' ')} Ft`;
}
