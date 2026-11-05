// Az egyetlen kliensoldali szkript. Kiszámolja Budapest-időben, hogy most
// nyitva van-e az üzlet, kijelöli a mai napot a heti táblázatban, és elrejti
// a már elmúlt eltéréseket. Nincs külső függősége, nincs inline kód (CSP).
import { allapot, allapotSzoveg, budapestiIdo, hetNapja, type NyitvatartasAdat } from '../lib/nyitvatartas';

function futtat(): void {
  const most = budapestiIdo();

  document.querySelectorAll<HTMLElement>('[data-nyitvatartas]').forEach((doboz) => {
    let adat: NyitvatartasAdat;
    try {
      adat = JSON.parse(doboz.dataset.nyitvatartas ?? '');
    } catch {
      return;
    }
    const a = allapot(adat, most);
    const { cimke, reszlet } = allapotSzoveg(a);
    const sor = doboz.querySelector<HTMLElement>('[data-allapot]');
    if (!sor) return;
    sor.querySelector('[data-allapot-cimke]')!.textContent = cimke;
    sor.querySelector('[data-allapot-reszlet]')!.textContent = reszlet;
    sor.dataset.nyitva = a.nyitva ? 'igen' : 'nem';
    sor.hidden = false;
  });

  const ma = hetNapja(most.iso);
  document.querySelectorAll<HTMLElement>('tr[data-nap]').forEach((sor) => {
    if (sor.dataset.nap === ma) sor.setAttribute('aria-current', 'date');
  });

  document.querySelectorAll<HTMLElement>('[data-ig]').forEach((elem) => {
    if ((elem.dataset.ig ?? '') < most.iso) elem.hidden = true;
  });
  document.querySelectorAll<HTMLElement>('[data-elteresek]').forEach((doboz) => {
    if (!doboz.querySelector('li:not([hidden])')) doboz.hidden = true;
  });
}

futtat();
