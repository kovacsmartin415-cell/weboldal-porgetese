// Üzlettípusonkénti alapértelmezések. Új típus felvételekor ide írj egy sort,
// és a schema.ts `tipus` enumjába is vedd fel.

export type TemaNev = 'meleg' | 'letisztult' | 'meresz';

export interface TipusAlap {
  /** Emberi megnevezés, pl. a címsorban: „Pékség Veszprémben”. */
  megnevezes: string;
  /** schema.org típus a JSON-LD-hez (a LocalBusiness legpontosabb altípusa). */
  schemaTipus: string;
  /** A kínálat tételei termékek vagy szolgáltatások (schema.org Product / Service). */
  tetelTipus: 'Product' | 'Service';
  tema: TemaNev;
  kiemeltCim: string;
  kinalatCim: string;
  urlapCim: string;
  urlapBevezeto: string;
  urlapTargyak: string[];
  urlapDatumCimke?: string;
}

export const TIPUSOK = {
  pekseg: {
    megnevezes: 'Pékség',
    schemaTipus: 'Bakery',
    tetelTipus: 'Product',
    tema: 'meleg',
    kiemeltCim: 'Ami ma a pultban van',
    kinalatCim: 'Kínálat és árak',
    urlapCim: 'Előrendelés, kérdés',
    urlapBevezeto: 'Nagyobb mennyiséget, tortát vagy rendezvényre szánt pékárut legalább két nappal előre kérj.',
    urlapTargyak: ['Előrendelés', 'Rendezvény, céges rendelés', 'Kérdés'],
    urlapDatumCimke: 'Mikorra kéred?',
  },
  viragos: {
    megnevezes: 'Virágbolt',
    schemaTipus: 'Florist',
    tetelTipus: 'Product',
    tema: 'letisztult',
    kiemeltCim: 'Most a boltban',
    kinalatCim: 'Csokrok, díszek és árak',
    urlapCim: 'Rendelés, ajánlatkérés',
    urlapBevezeto: 'Esküvőre, temetésre, rendezvényre szívesen adunk egyedi ajánlatot.',
    urlapTargyak: ['Csokorrendelés', 'Esküvő, rendezvény', 'Temetés', 'Kérdés'],
    urlapDatumCimke: 'Melyik napra?',
  },
  borbely: {
    megnevezes: 'Borbély',
    // A schema.org-ban nincs külön BarberShop típus; a HairSalon a legpontosabb.
    schemaTipus: 'HairSalon',
    tetelTipus: 'Service',
    tema: 'meresz',
    kiemeltCim: 'Amiért a legtöbben jönnek',
    kinalatCim: 'Szolgáltatások és árak',
    urlapCim: 'Időpontkérés, kérdés',
    urlapBevezeto: 'Írd meg, melyik nap és napszak lenne jó, visszajelzünk egy konkrét időponttal.',
    urlapTargyak: ['Időpontkérés', 'Kérdés'],
    urlapDatumCimke: 'Melyik nap lenne jó?',
  },
  asztalos: {
    megnevezes: 'Asztalosműhely',
    schemaTipus: 'HomeAndConstructionBusiness',
    tetelTipus: 'Service',
    tema: 'meleg',
    kiemeltCim: 'Amit a legtöbbször készítünk',
    kinalatCim: 'Munkák és irányárak',
    urlapCim: 'Ajánlatkérés',
    urlapBevezeto: 'Írd le, mit szeretnél, és ha van, a méreteket. Felmérés után pontos árat adunk.',
    urlapTargyak: ['Ajánlatkérés', 'Javítás, felújítás', 'Kérdés'],
  },
  szallas: {
    megnevezes: 'Szállás',
    schemaTipus: 'LodgingBusiness',
    tetelTipus: 'Service',
    tema: 'letisztult',
    kiemeltCim: 'Szobák',
    kinalatCim: 'Szobák és árak',
    urlapCim: 'Szabad hely, foglalás',
    urlapBevezeto: 'Írd meg az érkezés és távozás napját és hányan jönnétek, válaszolunk a szabad helyekkel.',
    urlapTargyak: ['Foglalási érdeklődés', 'Csoportos ajánlat', 'Kérdés'],
    urlapDatumCimke: 'Érkezés napja',
  },
  egyeb: {
    megnevezes: 'Üzlet',
    schemaTipus: 'LocalBusiness',
    tetelTipus: 'Product',
    tema: 'letisztult',
    kiemeltCim: 'Kiemelt kínálat',
    kinalatCim: 'Kínálat és árak',
    urlapCim: 'Üzenet',
    urlapBevezeto: 'Írj nekünk, általában egy munkanapon belül válaszolunk.',
    urlapTargyak: ['Kérdés', 'Ajánlatkérés'],
  },
} as const satisfies Record<string, TipusAlap>;

export type TipusNev = keyof typeof TIPUSOK;
export const TIPUS_NEVEK = Object.keys(TIPUSOK) as [TipusNev, ...TipusNev[]];
