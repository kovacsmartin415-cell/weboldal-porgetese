/*
 * A Netlify Function fő folyamata, a külvilágtól (Google, e-mail) leválasztva, hogy tesztelhető legyen.
 */
import type { Beallitasok } from '../../kozos/urlap-logika.ts';
import { alapBeallitasok, beallitasokOsszefesul, bekuldesKinyer, lekepez, urlapEngedelyezett, korabbiSorok, dont, sorAdatok } from '../../kozos/urlap-logika.ts';
import { ertesitoEmail, visszaigazoloEmail } from '../../kozos/email-sablon.ts';
import type { TablazatKliens } from './google-tablazat.ts';
import { googleTablazat } from './google-tablazat.ts';
import type { EmailKuldo } from './email-kuldes.ts';
import { resendKuldo, smtpKuldo } from './email-kuldes.ts';

export interface Konfig {
  beall: Beallitasok;
  cimzettek: string[];
  felado: string;
  vizsgaltSorok: number;
  emailSzolgaltato: 'resend' | 'smtp' | 'nincs';
  google: { tablazatId: string; lapNev: string; naploLapNev: string; szolgaltatasFiok: string; privatKulcs: string };
  resendKulcs: string;
  smtp: { host: string; port: number; felhasznalo: string; jelszo: string };
}

export interface Kliensek {
  tablazat: TablazatKliens;
  email: EmailKuldo | null;
}

type Env = Record<string, string | undefined>;

function igaz(s: string | undefined): boolean {
  return /^(1|true|igen|yes|be)$/i.test(String(s || '').trim());
}

function lista(s: string | undefined): string[] {
  return String(s || '').split(',').map((x) => x.trim()).filter((x) => x !== '');
}

function jsonEnv(env: Env, nev: string): Record<string, unknown> | null {
  const s = env[nev];
  if (!s || !s.trim()) return null;
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new Error(nev + ' nem érvényes JSON: ' + (e as Error).message);
  }
}

/** Környezeti változók → beállítások. Hiányzó kötelező értéknél érthető hibát dob. */
export function konfigKornyezetbol(env: Env): Konfig {
  const hiany = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEET_ID'].filter((k) => !env[k]);
  if (hiany.length) throw new Error('Hiányzó környezeti változó(k): ' + hiany.join(', ') + '. Netlify: Project configuration → Environment variables.');

  const tablazatId = String(env.GOOGLE_SHEET_ID).trim();
  const ceg: Record<string, unknown> = {};
  if (env.CEG_NEV) ceg.nev = env.CEG_NEV;
  if (env.CEG_ALAIRAS) ceg.alairas = env.CEG_ALAIRAS.replace(/\\n/g, '\n');
  if (env.VALASZIDO) ceg.valaszido = env.VALASZIDO;
  if (env.MEGSZOLITAS === 'magazo' || env.MEGSZOLITAS === 'tegezo') ceg.megszolitas = env.MEGSZOLITAS;
  if (env.KIEMELO_SZIN) ceg.kiemeloSzin = env.KIEMELO_SZIN;

  const beall = beallitasokOsszefesul(alapBeallitasok(), {
    ceg: ceg,
    visszaigazolas: igaz(env.VISSZAIGAZOLAS),
    urlapok: lista(env.URLAP_NEVEK),
    mezok: jsonEnv(env, 'MEZO_TERKEP'),
    szabalyok: jsonEnv(env, 'SZABALYOK'),
    tablazatUrl: 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(tablazatId) + '/edit',
  });

  let szolg = String(env.EMAIL_SZOLGALTATO || '').trim().toLowerCase();
  if (!szolg) szolg = env.RESEND_API_KEY ? 'resend' : env.SMTP_HOST ? 'smtp' : 'nincs';
  if (szolg !== 'resend' && szolg !== 'smtp' && szolg !== 'nincs') throw new Error('EMAIL_SZOLGALTATO csak resend, smtp vagy nincs lehet.');
  if (szolg === 'resend' && !env.RESEND_API_KEY) throw new Error('EMAIL_SZOLGALTATO=resend, de nincs RESEND_API_KEY.');
  if (szolg === 'smtp' && (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS)) throw new Error('EMAIL_SZOLGALTATO=smtp, de hiányzik az SMTP_HOST / SMTP_USER / SMTP_PASS.');
  const cimzettek = lista(env.ERTESITES_CIMZETT);
  if (szolg !== 'nincs' && cimzettek.length === 0) throw new Error('Hiányzik az ERTESITES_CIMZETT (kinek menjen az értesítő).');

  return {
    beall: beall,
    cimzettek: cimzettek,
    felado: env.EMAIL_FELADO || (env.SMTP_USER ? 'Weboldal űrlap <' + env.SMTP_USER + '>' : 'Weboldal űrlap <onboarding@resend.dev>'),
    vizsgaltSorok: Number(env.VIZSGALT_SOROK) > 0 ? Number(env.VIZSGALT_SOROK) : 300,
    emailSzolgaltato: szolg as Konfig['emailSzolgaltato'],
    google: {
      tablazatId: tablazatId,
      lapNev: env.GOOGLE_SHEET_TAB || 'Üzenetek',
      naploLapNev: env.GOOGLE_LOG_TAB || 'Hibanapló',
      szolgaltatasFiok: String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL).trim(),
      privatKulcs: String(env.GOOGLE_PRIVATE_KEY),
    },
    resendKulcs: env.RESEND_API_KEY || '',
    smtp: { host: env.SMTP_HOST || '', port: Number(env.SMTP_PORT) || 465, felhasznalo: env.SMTP_USER || '', jelszo: env.SMTP_PASS || '' },
  };
}

export function kliensekKonfigbol(k: Konfig): Kliensek {
  return {
    tablazat: googleTablazat(k.google),
    email: k.emailSzolgaltato === 'resend' ? resendKuldo(k.resendKulcs) : k.emailSzolgaltato === 'smtp' ? smtpKuldo(k.smtp) : null,
  };
}

function hibaSzoveg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Egy beküldés feldolgozása. Visszatérés: a döntés neve (uj, hianyos, spam, korlat, duplikatum, kihagyva).
 * Ha a táblázatba írás nem sikerül, az értesítő akkor is kimegy (figyelmeztetéssel) – így üzenet nem vész el.
 */
export async function feldolgoz(torzs: unknown, k: Konfig, kl: Kliensek, most: number): Promise<string> {
  const beall = k.beall;
  const u = lekepez(bekuldesKinyer(torzs), beall, most);
  if (!urlapEngedelyezett(u, beall)) return 'kihagyva';

  const naplo = async (szint: string, esemeny: string, reszletek: string): Promise<void> => {
    console.log('[urlap] ' + szint + ' | ' + esemeny + ' | ' + reszletek + ' | ' + u.azonosito);
    try {
      await kl.tablazat.naplo(szint, esemeny, reszletek, u.azonosito);
    } catch (e) {
      console.error('[urlap] A hibanaplóba írás sem sikerült: ' + hibaSzoveg(e));
    }
  };

  let tablaHiba = '';
  let fejlec: unknown[] = [];
  let korabbiak: ReturnType<typeof korabbiSorok> = [];
  try {
    const t = await kl.tablazat.fejlecEsUtolsoSorok(k.vizsgaltSorok);
    fejlec = t.fejlec;
    korabbiak = korabbiSorok(t.fejlec, t.sorok, beall.oszlopok);
  } catch (e) {
    tablaHiba = hibaSzoveg(e);
  }

  const d = dont(u, korabbiak, beall);
  if (d.dontes === 'duplikatum') {
    await naplo('INFO', 'Ismétlődés kihagyva', d.okok.join('; '));
    return d.dontes;
  }

  if (!tablaHiba) {
    try {
      await kl.tablazat.sorHozzaad(fejlec, sorAdatok(u, d), beall.oszlopok);
    } catch (e) {
      tablaHiba = hibaSzoveg(e);
    }
  }
  if (tablaHiba) await naplo('HIBA', 'Táblázatba írás sikertelen', tablaHiba);
  if (d.dontes === 'spam' || d.dontes === 'korlat') await naplo('INFO', d.dontes === 'spam' ? 'Gyanús üzenet (spam?)' : 'Korlátozás', d.okok.join('; '));

  let emailHiba = '';
  if (kl.email && d.ertesites) {
    const l = ertesitoEmail(u, d, beall, tablaHiba ? 'Ez az üzenet NEM került be a táblázatba (' + tablaHiba + '). A Netlify felületén is megtalálod.' : undefined);
    try {
      await kl.email.kuld({ felado: k.felado, cimzett: k.cimzettek, targy: l.targy, html: l.html, szoveg: l.szoveg, valaszCim: l.valaszCim || undefined });
    } catch (e) {
      emailHiba = hibaSzoveg(e);
      await naplo('HIBA', 'Értesítő e-mail nem ment ki', emailHiba);
    }
  }
  if (kl.email && d.visszaigazolas) {
    const l = visszaigazoloEmail(u, beall);
    try {
      await kl.email.kuld({ felado: k.felado, cimzett: [u.email], targy: l.targy, html: l.html, szoveg: l.szoveg, valaszCim: k.cimzettek[0] });
    } catch (e) {
      await naplo('HIBA', 'Visszaigazolás nem ment ki', hibaSzoveg(e));
    }
  }

  // Ha se a táblázat, se az értesítő nem sikerült, a függvény hibával álljon le, hogy a Netlify naplójában látsszon.
  if (tablaHiba && (emailHiba || !kl.email)) throw new Error('Az üzenet sem a táblázatba, sem e-mailben nem jutott el: ' + tablaHiba + (emailHiba ? ' / ' + emailHiba : ''));
  return d.dontes;
}
