// Tesztadatok: egy valósághű Netlify beküldés (a kimenő webhook ezt küldi; a függvény { payload: ... } alakban kapja).
import type { NetlifyBekuldes } from '../kozos/urlap-logika.ts';

export const MOST = Date.parse('2026-11-05T13:32:10.000Z'); // 14:32:10 Budapest (CET)

export function mintaBekuldes(felulir?: Record<string, unknown>, adat?: Record<string, unknown>): NetlifyBekuldes {
  const alap: NetlifyBekuldes = {
    id: '6727a3f0c1e2b40008a1b2c3',
    number: 12,
    form_name: 'kapcsolat',
    form_id: '6727a3f0c1e2b40008a1b000',
    site_url: 'https://pelda.netlify.app',
    created_at: '2026-11-05T13:32:10.000Z',
    data: Object.assign({
      'form-name': 'kapcsolat',
      'bot-field': '',
      nev: 'Kiss Anna',
      email: 'Anna.Kiss@Pelda.hu ',
      telefon: '06 30 123 4567',
      uzenet: 'Szia!\r\nÉrdekelne egy egyszerű weboldal a pékségünknek.\n\n\n\nMikor tudnánk beszélni?',
      adatkezeles: 'elfogadom',
      ip: '203.0.113.7',
      user_agent: 'Mozilla/5.0',
      referrer: 'https://pelda.netlify.app/kapcsolat/',
    }, adat || {}),
  };
  return Object.assign(alap, felulir || {});
}
