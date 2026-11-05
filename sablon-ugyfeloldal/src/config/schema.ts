// Az uzlet.json sémája. Minden mező magyarázata a README-ben is megvan.
// Ha a konfig hibás, a build megáll és pontosan megmondja, melyik mező a rossz.

import { z } from 'zod';
import { TIPUSOK, TIPUS_NEVEK } from './tipusok.ts';
import { TEMAK, kontrasztHibak, type Szinek } from './temak.ts';

export const NAPOK = ['hetfo', 'kedd', 'szerda', 'csutortok', 'pentek', 'szombat', 'vasarnap'] as const;
export type NapKulcs = (typeof NAPOK)[number];

const szoveg = z.string().trim().min(1, 'nem lehet üres');
const ido = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'ÓÓ:PP formátum kell, pl. "07:30"');
const percben = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const sav = z
  .object({ tol: ido, ig: ido })
  .strict()
  .refine((s) => percben(s.ig) > percben(s.tol), { message: 'az "ig" legyen később, mint a "tol" (éjfélen átnyúló sáv nem támogatott)' });
const nap = z.array(sav).default([]);
const datum = z.iso.date({ message: 'ÉÉÉÉ-HH-NN formátum kell, pl. "2026-12-24"' });
const hexSzin = z.string().regex(/^#[0-9a-fA-F]{6}$/, '6 jegyű hex szín kell, pl. "#1F4E79"');
const url = z.url({ protocol: /^https?$/, message: 'teljes URL kell, https://-sel' });

const foto = z
  .object({
    /** Elérési út az src/assets mappán belül, pl. "fotok/pult.jpg". */
    fajl: szoveg,
    /** Mit lát rajta, aki nem látja. Ne „kép” vagy „fotó” legyen. */
    alt: szoveg,
    szerzo: z.string().optional(),
    forras: url.optional(),
  })
  .strict();

const tetel = z
  .object({
    nev: szoveg,
    leiras: z.string().optional(),
    /** Forintban, egész szám. Ha nincs, az arSzoveg jelenik meg (pl. „felmérés után”). */
    ar: z.number().int().nonnegative().optional(),
    arTol: z.boolean().default(false),
    arSzoveg: z.string().optional(),
    /** Pl. "db", "kg", "500 g", "fő/éj". */
    egyseg: z.string().optional(),
    /** Szolgáltatásnál, pl. "30 perc". */
    idotartam: z.string().optional(),
    /** Rövid jelölések: „csak szombaton”, „laktózmentes”. */
    jelolesek: z.array(szoveg).default([]),
    kiemelt: z.boolean().default(false),
    foto: foto.optional(),
  })
  .strict();

const szinFelulirasok = z
  .object({
    hatter: hexSzin,
    felulet: hexSzin,
    szoveg: hexSzin,
    halvany: hexSzin,
    kiemelo: hexSzin,
    kiemeloSzoveg: hexSzin,
  })
  .partial()
  .strict();

export const uzletSema = z
  .object({
    $schema: z.string().optional(),
    /** Bemutató oldal: sáv jelzi, hogy kitalált vállalkozás, és nem indexelődik. */
    bemutato: z.boolean().default(false),
    tipus: z.enum(TIPUS_NEVEK),
    /** Pontosabb schema.org típus felülírása, pl. "BedAndBreakfast". */
    schemaTipus: z.string().regex(/^[A-Z][A-Za-z]+$/).optional(),
    nev: szoveg,
    /** Az élő oldal címe, pl. "https://kovaszeskalasz.hu" (perjel nélkül). */
    domain: url.transform((u) => u.replace(/\/+$/, '')),
    seo: z
      .object({
        /** A címsorba kerülő rövid leírás, pl. "Kovászos pékség Veszprémben". */
        cimke: szoveg.optional(),
        /** Meta description, 120–160 karakter ideális. Ha nincs, a rövid bemutatkozásból készül. */
        leiras: z.string().max(170, 'legfeljebb kb. 160 karakter legyen').optional(),
      })
      .strict()
      .default({}),
    bemutatkozas: z
      .object({
        /** 1–2 konkrét mondat: mit, kinek, miben más. Szlogen helyett. */
        rovid: szoveg.max(260, 'a rövid bemutatkozás legfeljebb 2 mondat legyen'),
        hosszu: z.array(szoveg).min(1, 'legalább egy bekezdés kell a Rólunk oldalra'),
        /** Egy őszinte mondat arról, mit NEM csinálnak. Erősebb, mint egy szlogen. */
        nemCsinaljuk: z.string().optional(),
        /** Opcionális: kik dolgoznak itt (csak valódi nevek). */
        csapat: z.array(z.object({ nev: szoveg, szerep: z.string().optional() }).strict()).default([]),
        alapitva: z.number().int().min(1800).max(2100).optional(),
      })
      .strict(),
    cim: z
      .object({
        utca: szoveg,
        iranyitoszam: z.string().regex(/^\d{4}$/, '4 jegyű irányítószám kell'),
        varos: szoveg,
        orszag: z.string().length(2).default('HU'),
        /** Hogyan találnak oda: „a buszmegállóval szemben, az udvarban”. */
        utmutato: z.string().optional(),
        geo: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict().optional(),
        /** A Google Cégprofil vagy térkép linkje; ha nincs, a címből készül. */
        terkepLink: url.optional(),
        parkolas: z.string().optional(),
      })
      .strict(),
    telefon: z.string().regex(/^\+?[\d\s/()-]{8,20}$/, 'telefonszám, pl. "+36 88 555 0142"'),
    email: z.email({ message: 'érvényes e-mail cím kell' }).optional(),
    nyitvatartas: z
      .object({
        het: z.object(Object.fromEntries(NAPOK.map((n) => [n, nap])) as Record<NapKulcs, typeof nap>).strict(),
        /** A magyar munkaszüneti napokon automatikusan zárva (kivétellel felülírható). */
        unnepnapokonZarva: z.boolean().default(true),
        kivetelek: z
          .array(
            z
              .object({
                datum,
                /** Ha több napra szól (pl. szabadság), az utolsó nap. */
                datumIg: datum.optional(),
                /** Üres lista = zárva. */
                nyitva: z.array(sav).default([]),
                megjegyzes: z.string().optional(),
              })
              .strict()
              .refine((k) => !k.datumIg || k.datumIg >= k.datum, { message: 'a datumIg nem lehet korábbi, mint a datum' }),
          )
          .default([]),
        megjegyzes: z.string().optional(),
      })
      .strict(),
    kinalat: z
      .object({
        cim: z.string().optional(),
        bevezeto: z.string().optional(),
        /** Az árlista alján: allergének, fizetési módok, árak érvényessége. */
        megjegyzes: z.string().optional(),
        kategoriak: z
          .array(z.object({ nev: szoveg, leiras: z.string().optional(), tetelek: z.array(tetel).min(1) }).strict())
          .min(1, 'legalább egy kategória kell'),
      })
      .strict(),
    foglalas: z.object({ url, felirat: szoveg }).strict().optional(),
    kozosseg: z
      .array(
        z
          .object({
            halozat: z.enum(['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'egyeb']),
            url,
            felirat: z.string().optional(),
          })
          .strict(),
      )
      .default([]),
    googleCegprofil: url.optional(),
    tema: z
      .object({
        keszlet: z.enum(['meleg', 'letisztult', 'meresz']).optional(),
        szinek: szinFelulirasok.default({}),
      })
      .strict()
      .default({ szinek: {} }),
    fotok: z
      .object({
        fo: foto.optional(),
        rolunk: z.array(foto).default([]),
        terkep: foto.optional(),
      })
      .strict()
      .default({ rolunk: [] }),
    szovegek: z
      .object({
        kiemeltCim: z.string().optional(),
        urlapCim: z.string().optional(),
        urlapBevezeto: z.string().optional(),
        urlapTargyak: z.array(szoveg).min(1).optional(),
        /** Üres szöveg ("") kikapcsolja a dátummezőt. */
        urlapDatumCimke: z.string().optional(),
      })
      .strict()
      .default({}),
    adatkezelo: z
      .object({
        nev: z.string().optional(),
        forma: z.string().optional(),
        szekhely: z.string().optional(),
        adoszam: z.string().optional(),
        nyilvantartasiSzam: z.string().optional(),
        nyilvantarto: z.string().optional(),
        kepviselo: z.string().optional(),
        email: z.email().optional(),
        telefon: z.string().optional(),
        /** Mennyi ideig őrzik az űrlapon kapott üzeneteket. */
        megorzes: z.string().default('a megkeresés lezárásától számított 1 évig'),
      })
      .strict()
      .default({ megorzes: 'a megkeresés lezárásától számított 1 évig' }),
    tarhely: z
      .object({ nev: szoveg, cim: szoveg, elerhetoseg: szoveg })
      .strict()
      .default({
        nev: 'Netlify, Inc.',
        cim: '512 2nd Street, Suite 200, San Francisco, CA 94107, USA',
        elerhetoseg: 'https://www.netlify.com/support/',
      }),
    keszito: z
      .object({ nev: szoveg, url: url.optional() })
      .strict()
      .default({ nev: 'Folyam Studio' }),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    const tema = TEMAK[cfg.tema.keszlet ?? TIPUSOK[cfg.tipus].tema];
    const szinek: Szinek = { ...tema.szinek, ...cfg.tema.szinek };
    for (const hiba of kontrasztHibak(szinek)) {
      ctx.addIssue({ code: 'custom', path: ['tema', 'szinek'], message: hiba });
    }
  });

export type UzletBemenet = z.input<typeof uzletSema>;
export type Uzlet = z.output<typeof uzletSema>;
export type Tetel = z.output<typeof tetel>;
export type Foto = z.output<typeof foto>;
export type Sav = z.output<typeof sav>;
