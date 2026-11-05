// A vázlatkészítő adatai: típusok, kitalált példa-tartalom, hangulatonkénti paletták.
// Minden név, ár és nyitvatartás kitalált példa.

export type TypeId = 'pekseg' | 'virag' | 'borbely' | 'asztalos' | 'szallas';
export type MoodId = 'meleg' | 'letisztult' | 'meresz';
export type BlockId = 'intro' | 'open' | 'items' | 'map' | 'call';

export interface Palette {
  bg: string;    // a vázlat oldal alapja
  surf: string;  // kártyák
  ink: string;   // szöveg
  muted: string; // másodlagos szöveg
  acc: string;   // kiemelő (gomb)
  onAcc: string; // szöveg a kiemelőn
  hero: string;  // fejléc sáv
  heroInk: string;
  p1: string;    // fejléc-minta (díszítés)
  p2: string;
}

export interface Item { name: string; price: string; }

/** Nyitvatartás: hét napja (0 = vasárnap) → [nyitás, zárás] percben, vagy null. */
export type Week = Array<[number, number] | null>;

export interface BizType {
  id: TypeId;
  label: string;
  iam: string;        // „Pékség vagyok” – az üzenet elejére
  defaultName: string;
  intro: string;
  items: Item[];
  week: Week;
  hours: string;      // olvasható nyitvatartás
  order: BlockId[];   // a blokkok sorrendje a vázlaton
  pkg: 0 | 1;         // melyik szemléltető csomag
  why: string;
  palettes: Record<MoodId, Palette>;
}

export const MOODS: { id: MoodId; label: string; hint: string }[] = [
  { id: 'meleg', label: 'Meleg', hint: 'kerek formák, talpas betű' },
  { id: 'letisztult', label: 'Letisztult', hint: 'sok levegő, vékony vonalak' },
  { id: 'meresz', label: 'Merész', hint: 'sötét alap, nagy betű' },
];

export const PACKAGES = [
  { name: 'Egyoldalas bemutatkozó oldal', price: '150 000 Ft + ÁFA-tól' },
  { name: 'Több oldal + űrlap + automatizált értesítés', price: '320 000 Ft + ÁFA-tól' },
] as const;

const h = (hh: number, mm = 0) => hh * 60 + mm;

export const TYPES: BizType[] = [
  {
    id: 'pekseg',
    label: 'Pékség',
    iam: 'Pékség vagyok',
    defaultName: 'Kovász & Kalász',
    intro: 'Kovászos kenyeret sütünk minden hajnalban, a pult délre általában kiürül. Ha biztosra mennél, hívj, és félreteszünk egyet.',
    items: [
      { name: 'Kovászos fehér, 1 kg', price: '1 290 Ft' },
      { name: 'Kakaós csiga', price: '490 Ft' },
      { name: 'Sajtos pogácsa, 10 dkg', price: '380 Ft' },
    ],
    week: [null, [h(6), h(13)], [h(6), h(13)], [h(6), h(13)], [h(6), h(13)], [h(6), h(13)], [h(6), h(12)]],
    hours: 'H–P 6–13, Szo 6–12',
    order: ['open', 'intro', 'items', 'map', 'call'],
    pkg: 0,
    why: 'Egy pékségnek egy gyors oldal elég: nyitvatartás, mai kínálat, térkép és egy hívás gomb. Ezt keresik a vevők telefonon.',
    palettes: {
      meleg: { bg: '#F6EBD9', surf: '#FFF8EC', ink: '#3B2414', muted: '#6B4A2E', acc: '#8E4A14', onAcc: '#FFF8EC', hero: '#E8C88E', heroInk: '#3B2414', p1: '#D9A85B', p2: '#F4DDB0' },
      letisztult: { bg: '#FAF7F1', surf: '#FFFFFF', ink: '#2A2522', muted: '#665D55', acc: '#6E4219', onAcc: '#FFFFFF', hero: '#F1E6D2', heroInk: '#2A2522', p1: '#E2CDA6', p2: '#F8F0E2' },
      meresz: { bg: '#2B1A10', surf: '#3A2416', ink: '#F7E9CF', muted: '#D9BF96', acc: '#E9B949', onAcc: '#2B1A10', hero: '#E9B949', heroInk: '#2B1A10', p1: '#C99628', p2: '#F4D27A' },
    },
  },
  {
    id: 'virag',
    label: 'Virágbolt',
    iam: 'Virágboltom van',
    defaultName: 'Bimbó Virágműhely',
    intro: 'Csokrot kötünk, cserepes növényt és koszorút árulunk. Ha előző nap szólsz, a városon belül házhoz is visszük.',
    items: [
      { name: 'Szezonális csokor', price: '6 500 Ft-tól' },
      { name: 'Cserepes orchidea', price: '5 900 Ft' },
      { name: 'Ajtódísz, koszorú', price: '12 000 Ft-tól' },
    ],
    week: [null, [h(8), h(18)], [h(8), h(18)], [h(8), h(18)], [h(8), h(18)], [h(8), h(18)], [h(8), h(13)]],
    hours: 'H–P 8–18, Szo 8–13',
    order: ['intro', 'items', 'open', 'map', 'call'],
    pkg: 0,
    why: 'Egy virágboltnak egy szép, gyors oldal kell a kínálattal és egy hívás gombbal. A rendelést elsőre telefonon is lehet intézni.',
    palettes: {
      meleg: { bg: '#F7EFE6', surf: '#FFFAF4', ink: '#1F3A26', muted: '#4A5F4E', acc: '#A8324A', onAcc: '#FFFFFF', hero: '#F2C9C4', heroInk: '#1F3A26', p1: '#E58C9B', p2: '#7FA36F' },
      letisztult: { bg: '#F4F6F1', surf: '#FFFFFF', ink: '#1E2B22', muted: '#535F57', acc: '#2F5D3A', onAcc: '#FFFFFF', hero: '#E3EBDD', heroInk: '#1E2B22', p1: '#E7A0AE', p2: '#A9C29A' },
      meresz: { bg: '#12301E', surf: '#1B3F29', ink: '#F5EFE6', muted: '#C9D8C4', acc: '#F27E9A', onAcc: '#12301E', hero: '#F27E9A', heroInk: '#12301E', p1: '#C9506E', p2: '#2E6B45' },
    },
  },
  {
    id: 'borbely',
    label: 'Borbély',
    iam: 'Borbély vagyok',
    defaultName: 'Réz & Penge',
    intro: 'Hajvágás gépi és ollós technikával, szakálligazítás forró törülközővel. Bejelentkezéssel nem kell várnod, anélkül is fogadunk, ha van hely.',
    items: [
      { name: 'Hajvágás', price: '6 000 Ft' },
      { name: 'Szakálligazítás', price: '3 500 Ft' },
      { name: 'Haj és szakáll együtt', price: '8 500 Ft' },
    ],
    week: [null, null, [h(10), h(19)], [h(10), h(19)], [h(10), h(19)], [h(10), h(19)], [h(9), h(14)]],
    hours: 'K–P 10–19, Szo 9–14',
    order: ['open', 'call', 'items', 'intro', 'map'],
    pkg: 0,
    why: 'Egy borbélynak egy oldal elég: árak, nyitvatartás, és a hívás gomb rögtön felül, mert a legtöbben időpontot akarnak.',
    palettes: {
      meleg: { bg: '#F3EBDD', surf: '#FBF6EC', ink: '#1C1A17', muted: '#574E45', acc: '#7E4520', onAcc: '#FFFFFF', hero: '#1C1A17', heroInk: '#F3EBDD', p1: '#B87333', p2: '#3A332C' },
      letisztult: { bg: '#F7F5F0', surf: '#FFFFFF', ink: '#161514', muted: '#5C5852', acc: '#161514', onAcc: '#F3EBDD', hero: '#EDE7DC', heroInk: '#161514', p1: '#C9A27A', p2: '#DDD3C3' },
      meresz: { bg: '#111111', surf: '#1E1C1A', ink: '#F3EBDD', muted: '#CDBFA8', acc: '#C9853F', onAcc: '#111111', hero: '#C9853F', heroInk: '#111111', p1: '#111111', p2: '#F3EBDD' },
    },
  },
  {
    id: 'asztalos',
    label: 'Asztalos',
    iam: 'Asztalos vagyok',
    defaultName: 'Forgács Asztalosműhely',
    intro: 'Méretre készítünk konyhabútort, polcot és beltéri ajtót, főleg tömörfából. Felmérni kimegyünk, utána írásban kapsz árat.',
    items: [
      { name: 'Tölgy falipolc, 80 cm', price: '28 000 Ft' },
      { name: 'Konyhabútor, folyóméter', price: '180 000 Ft-tól' },
      { name: 'Beltéri ajtó felújítása', price: '45 000 Ft-tól' },
    ],
    week: [null, [h(7), h(16)], [h(7), h(16)], [h(7), h(16)], [h(7), h(16)], [h(7), h(15)], null],
    hours: 'H–Cs 7–16, P 7–15',
    order: ['intro', 'items', 'map', 'open', 'call'],
    pkg: 1,
    why: 'Egy asztalosnál a munka árajánlattal indul: kell pár oldal a korábbi munkáknak, egy űrlap méretekkel, és értesítés, amikor jön egy kérés.',
    palettes: {
      meleg: { bg: '#F1E4CC', surf: '#FAF2E3', ink: '#3A2A1C', muted: '#634D38', acc: '#6B4426', onAcc: '#FFFFFF', hero: '#C8A574', heroInk: '#2E2015', p1: '#A9824F', p2: '#DDBF8F' },
      letisztult: { bg: '#F6F1E8', surf: '#FFFFFF', ink: '#2B231C', muted: '#625548', acc: '#5A3D27', onAcc: '#FFFFFF', hero: '#E6D7BF', heroInk: '#2B231C', p1: '#CDB48C', p2: '#F1E7D6' },
      meresz: { bg: '#2A1F17', surf: '#382A1F', ink: '#F3E6CF', muted: '#D4C0A0', acc: '#D0A15E', onAcc: '#2A1F17', hero: '#D0A15E', heroInk: '#2A1F17', p1: '#A57636', p2: '#E6C48E' },
    },
  },
  {
    id: 'szallas',
    label: 'Kis szálláshely',
    iam: 'Kis szálláshelyet viszek',
    defaultName: 'Mészkő Vendégház',
    intro: 'Négy szoba saját fürdővel, csendes utcában, a belvárostól tíz perc sétára. Reggelit kérésre adunk, parkolni az udvarban lehet.',
    items: [
      { name: 'Kétágyas szoba, egy éj', price: '24 000 Ft' },
      { name: 'Családi szoba, egy éj', price: '32 000 Ft' },
      { name: 'Reggeli, fejenként', price: '3 500 Ft' },
    ],
    week: [[h(8), h(20)], [h(8), h(20)], [h(8), h(20)], [h(8), h(20)], [h(8), h(20)], [h(8), h(20)], [h(8), h(20)]],
    hours: 'Recepció minden nap 8–20',
    order: ['intro', 'items', 'map', 'call', 'open'],
    pkg: 1,
    why: 'Egy szálláshelynek külön oldal kell a szobáknak, egy érdeklődő űrlap dátumokkal, és azonnali értesítés neked. Foglalási rendszer nem kell hozzá.',
    palettes: {
      meleg: { bg: '#F5F0E6', surf: '#FFFBF4', ink: '#173A4A', muted: '#486170', acc: '#1B6476', onAcc: '#FFFFFF', hero: '#BFDCE0', heroInk: '#173A4A', p1: '#7DB3BD', p2: '#F5F0E6' },
      letisztult: { bg: '#F7F8F6', surf: '#FFFFFF', ink: '#10303C', muted: '#4D626A', acc: '#155A6E', onAcc: '#FFFFFF', hero: '#E4EEEE', heroInk: '#10303C', p1: '#A9CDD1', p2: '#FFFFFF' },
      meresz: { bg: '#0E3442', surf: '#154453', ink: '#F4F1EA', muted: '#BFD6DA', acc: '#7FD1C9', onAcc: '#0E3442', hero: '#7FD1C9', heroInk: '#0E3442', p1: '#F4F1EA', p2: '#3C9C9A' },
    },
  },
];

export const DEFAULT_TOWN = 'Veszprém';
