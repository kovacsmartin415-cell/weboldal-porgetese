/*
 * E-mail-küldés függőség nélkül, két választható úton:
 *   - Resend HTTP API (ajánlott; ingyenes keret, saját domain hitelesítésével),
 *   - SMTP implicit TLS-sel (465-ös port; pl. Gmail alkalmazásjelszóval, tárhelyszolgáltató postafiókja).
 */
import { connect as tlsConnect } from 'node:tls';
import { randomBytes } from 'node:crypto';
import type { Duplex } from 'node:stream';

export interface KimenoLevel {
  felado: string; // "Név <cim@domain.hu>" vagy "cim@domain.hu"
  cimzett: string[];
  targy: string;
  html: string;
  szoveg: string;
  valaszCim?: string;
}

export interface EmailKuldo {
  kuld(level: KimenoLevel): Promise<void>;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

// ---------------------------------------------------------------------------
// Segédek
// ---------------------------------------------------------------------------

/** Fejlécértékből minden sortörés ki (fejléc-befecskendezés ellen). */
export function fejlecTiszta(s: string): string {
  return String(s || '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
}

/** "Név <cim@x.hu>" → { nev, cim } */
export function cimElemez(s: string): { nev: string; cim: string } {
  const t = fejlecTiszta(s);
  const m = t.match(/^\s*"?([^"<]*?)"?\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (m) return { nev: m[1].trim(), cim: m[2] };
  return { nev: '', cim: t };
}

/** RFC 2047 encoded-word (UTF-8, base64), 75 karakteres darabokra bontva, többbájtos karaktert nem vágva ketté. */
export function kodoltSzo(s: string): string {
  const t = fejlecTiszta(s);
  if (/^[\x20-\x7E]*$/.test(t)) return t;
  const darabok: string[] = [];
  let aktualis = '';
  for (const kar of Array.from(t)) {
    if (Buffer.byteLength(aktualis + kar, 'utf8') > 45) {
      darabok.push(aktualis);
      aktualis = '';
    }
    aktualis += kar;
  }
  if (aktualis) darabok.push(aktualis);
  return darabok.map((d) => '=?UTF-8?B?' + Buffer.from(d, 'utf8').toString('base64') + '?=').join('\r\n ');
}

function cimFejlec(s: string): string {
  const c = cimElemez(s);
  return c.nev ? kodoltSzo(c.nev) + ' <' + c.cim + '>' : c.cim;
}

function base64Sorok(s: string): string {
  return (Buffer.from(s, 'utf8').toString('base64').match(/.{1,76}/g) || []).join('\r\n');
}

/** Teljes MIME-üzenet (multipart/alternative: szöveg + HTML). */
export function mimeUzenet(l: KimenoLevel, most: Date, hatar?: string): string {
  const h = hatar || 'hatar-' + randomBytes(12).toString('hex');
  const domain = cimElemez(l.felado).cim.split('@')[1] || 'localhost';
  const fejlecek = [
    'From: ' + cimFejlec(l.felado),
    'To: ' + l.cimzett.map(cimFejlec).join(', '),
  ];
  if (l.valaszCim) fejlecek.push('Reply-To: ' + cimFejlec(l.valaszCim));
  fejlecek.push(
    'Subject: ' + kodoltSzo(l.targy),
    'Date: ' + most.toUTCString().replace('GMT', '+0000'),
    'Message-ID: <' + randomBytes(16).toString('hex') + '@' + domain + '>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + h + '"',
  );
  return fejlecek.join('\r\n') + '\r\n\r\n' +
    '--' + h + '\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + base64Sorok(l.szoveg) + '\r\n' +
    '--' + h + '\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + base64Sorok(l.html) + '\r\n' +
    '--' + h + '--\r\n';
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

export function resendKuldo(apiKulcs: string, fetchFn?: FetchFn): EmailKuldo {
  const f: FetchFn = fetchFn || ((url, init) => fetch(url, init));
  return {
    async kuld(l) {
      const torzs: Record<string, unknown> = {
        from: fejlecTiszta(l.felado),
        to: l.cimzett.map(fejlecTiszta),
        subject: fejlecTiszta(l.targy),
        html: l.html,
        text: l.szoveg,
      };
      if (l.valaszCim) torzs.reply_to = fejlecTiszta(l.valaszCim);
      const v = await f('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKulcs, 'Content-Type': 'application/json' },
        body: JSON.stringify(torzs),
      });
      if (!v.ok) throw new Error('Resend hiba ' + v.status + ': ' + (await v.text()).slice(0, 300));
    },
  };
}

// ---------------------------------------------------------------------------
// SMTP (implicit TLS)
// ---------------------------------------------------------------------------

export interface SmtpBeallitas {
  host: string;
  port: number;
  felhasznalo: string;
  jelszo: string;
  /** Tesztekhez cserélhető; alapból TLS-kapcsolat a host:port-ra. */
  kapcsolodj?: () => Duplex;
  idokorlatMs?: number;
}

export function smtpKuldo(b: SmtpBeallitas): EmailKuldo {
  return {
    kuld(l) {
      return smtpKuldes(b, l);
    },
  };
}

async function smtpKuldes(b: SmtpBeallitas, l: KimenoLevel): Promise<void> {
  const socket: Duplex = b.kapcsolodj ? b.kapcsolodj() : tlsConnect({ host: b.host, port: b.port, servername: b.host });
  const valaszok: Array<{ kod: number; szoveg: string }> = [];
  const varakozok: Array<(v: { kod: number; szoveg: string }) => void> = [];
  let puffer = '';
  let tobbsoros: string[] = [];
  let hiba: Error | null = null;
  let hibaKezelo: ((e: Error) => void) | null = null;

  socket.setEncoding('utf8');
  socket.on('data', (d: string) => {
    puffer += d;
    let i: number;
    while ((i = puffer.indexOf('\n')) !== -1) {
      const sor = puffer.slice(0, i).replace(/\r$/, '');
      puffer = puffer.slice(i + 1);
      tobbsoros.push(sor.slice(4));
      if (/^\d{3} /.test(sor) || /^\d{3}$/.test(sor)) {
        const v = { kod: Number(sor.slice(0, 3)), szoveg: tobbsoros.join('\n') };
        tobbsoros = [];
        const w = varakozok.shift();
        if (w) w(v); else valaszok.push(v);
      }
    }
  });
  socket.on('error', (e: Error) => {
    hiba = e;
    if (hibaKezelo) hibaKezelo(e);
  });
  socket.on('close', () => {
    if (!hiba) hiba = new Error('Az SMTP-kapcsolat váratlanul lezárult.');
    if (hibaKezelo) hibaKezelo(hiba);
  });
  const idozito = setTimeout(() => socket.destroy(new Error('SMTP időtúllépés')), b.idokorlatMs || 20000);

  function valasz(): Promise<{ kod: number; szoveg: string }> {
    if (hiba) return Promise.reject(hiba);
    const kesz = valaszok.shift();
    if (kesz) return Promise.resolve(kesz);
    return new Promise((ok, nem) => {
      hibaKezelo = nem;
      varakozok.push(ok);
    });
  }

  async function var_(elvart: number[], mit: string): Promise<void> {
    const v = await valasz();
    if (elvart.indexOf(v.kod) === -1) throw new Error('SMTP hiba (' + mit + '): ' + v.kod + ' ' + v.szoveg);
  }

  async function parancs(sor: string, elvart: number[], mit: string): Promise<void> {
    socket.write(sor + '\r\n');
    await var_(elvart, mit);
  }

  try {
    await var_([220], 'kapcsolódás');
    await parancs('EHLO ' + (cimElemez(l.felado).cim.split('@')[1] || 'localhost'), [250], 'EHLO');
    await parancs('AUTH PLAIN ' + Buffer.from('\u0000' + b.felhasznalo + '\u0000' + b.jelszo, 'utf8').toString('base64'), [235], 'bejelentkezés');
    await parancs('MAIL FROM:<' + cimElemez(l.felado).cim + '>', [250], 'feladó');
    for (const c of l.cimzett) await parancs('RCPT TO:<' + cimElemez(c).cim + '>', [250, 251], 'címzett');
    await parancs('DATA', [354], 'DATA');
    // „Dot-stuffing”: a ponttal kezdődő sorok elé még egy pont kerül.
    const tartalom = mimeUzenet(l, new Date()).replace(/\r\n\./g, '\r\n..');
    await parancs(tartalom + '\r\n.', [250], 'üzenet átadása');
    // A levél ezen a ponton már átadva; a QUIT válasza (221) csak udvariasság, a hibája nem számít.
    await parancs('QUIT', [221], 'QUIT').catch(() => undefined);
  } finally {
    clearTimeout(idozito);
    socket.end();
  }
}
