// „Ne nekünk hidd el. Mérd meg.” – a látogató saját böngészőjében mért számok.
// Semmit nem küldünk el: nincs fetch, nincs beacon, minden itt marad a lapon.
import '../styles/modules/perf-meter.css';
import { reducedMotion } from '../lib/env';
import { watchFCP, watchLCP, watchCLS, watchINP, netSupported, netSnapshot, watchResources, cookieCount } from './perf-meter/metrics';
import { createFps } from './perf-meter/fps';

const NEM_MERI = 'ez a böngésző nem méri';

const fix = (d: number) => new Intl.NumberFormat('hu-HU', { minimumFractionDigits: d, maximumFractionDigits: d });
const egesz = fix(0), egyTized = fix(1), ketSzazad = fix(2), haromEzred = fix(3);

interface Vital {
  key: string; kod: string; nev: string; egyseg: string;
  jo: number; gyenge: number;          // Google küszöbök, mért egységben (ms vagy CLS)
  fmt: (v: number) => string;          // kijelzés
  cimke: (v: number) => string;        // küszöbcímke
  magyar: string;
}

const VITALS: Vital[] = [
  {
    key: 'lcp', kod: 'LCP', nev: 'Legnagyobb elem megjelenése', egyseg: 's', jo: 2500, gyenge: 4000,
    fmt: (v) => ketSzazad.format(v / 1000), cimke: (v) => `${egyTized.format(v / 1000)} s`,
    magyar: 'Ennyi idő alatt jelent meg a legnagyobb dolog a képernyődön, általában a cím vagy egy kép. Ekkor érzi úgy a vevő, hogy betöltött az oldal.',
  },
  {
    key: 'fcp', kod: 'FCP', nev: 'Első tartalom', egyseg: 's', jo: 1800, gyenge: 3000,
    fmt: (v) => ketSzazad.format(v / 1000), cimke: (v) => `${egyTized.format(v / 1000)} s`,
    magyar: 'Ennyi idő után látszott az első betű vagy kép. Addig üres képernyőt nézel, és nem tudod, jön-e még valami.',
  },
  {
    key: 'cls', kod: 'CLS', nev: 'Elcsúszás betöltés közben', egyseg: '', jo: 0.1, gyenge: 0.25,
    fmt: (v) => haromEzred.format(v), cimke: (v) => ketSzazad.format(v).replace(/0$/, ''),
    magyar: 'Mennyit ugrált a tartalom, amíg betöltött. Nulla közelében senki nem nyom véletlenül rossz gombra, mert semmi nem csúszik el az ujja alól.',
  },
  {
    key: 'inp', kod: 'INP', nev: 'Reakcióidő (közelítés)', egyseg: 'ms', jo: 200, gyenge: 500,
    fmt: (v) => egesz.format(v), cimke: (v) => `${egesz.format(v)} ms`,
    magyar: 'Kattintás, koppintás vagy gépelés után ennyi idő telt el, mire a képernyő válaszolt. Élőben frissül: nyúlj bármihez az oldalon.',
  },
];

/** Egyszeri, rövid „felpörgés” a mért értékre. Mozgáscsökkentésnél nincs. */
class Kijelzo {
  private cel = NaN;
  private anim = 0;
  private kesz = false;
  constructor(private el: HTMLElement, private fmt: (v: number) => string, private latszik: () => boolean) {}
  set(v: number) {
    this.cel = v;
    if (!this.latszik()) return;           // még nem látszik: a megjelenéskor pörög fel
    if (this.kesz || reducedMotion()) { this.kesz = true; this.el.textContent = this.fmt(v); return; }
    // A végső szám szélessége előre fenntartva: a felpörgés ne tologassa a mértékegységet.
    this.el.style.setProperty('min-width', `${this.fmt(v).length}ch`);
    if (!this.anim) this.indit();
  }
  mutat() { if (!Number.isNaN(this.cel)) this.set(this.cel); }
  private indit() {
    const t0 = performance.now(), hossz = 900;
    const lep = (t: number) => {
      const p = Math.min(1, (t - t0) / hossz);
      const e = 1 - Math.pow(1 - p, 3);
      this.el.textContent = this.fmt(this.cel * e);
      if (p < 1) this.anim = requestAnimationFrame(lep);
      else { this.anim = 0; this.kesz = true; this.el.textContent = this.fmt(this.cel); }
    };
    this.anim = requestAnimationFrame(lep);
  }
}

const vitalHTML = (v: Vital, i: number) => `
  <article class="pm__mero" data-vital="${v.key}" aria-labelledby="pm-${v.key}-nev">
    <header class="pm__sor">
      <span class="pm__kod">${String(i + 1).padStart(2, '0')} · ${v.kod}</span>
      ${v.key === 'inp' ? '<span class="pm__elo">élő</span>' : ''}
    </header>
    <h3 class="pm__nev" id="pm-${v.key}-nev">${v.nev}</h3>
    <p class="pm__ertek"><span class="pm__szam" data-szam>—</span><span class="pm__egyseg" data-egyseg>${v.egyseg}</span></p>
    <div class="pm__skala" aria-hidden="true">
      <div class="pm__sav"><i class="pm__zona pm__zona--jo"></i><i class="pm__zona pm__zona--kozep"></i><i class="pm__zona pm__zona--rossz"></i></div>
      <b class="pm__tu"></b>
      <span class="pm__cimke pm__cimke--jo">jó ≤ ${v.cimke(v.jo)}</span>
      <span class="pm__cimke pm__cimke--rossz">${v.cimke(v.gyenge)}</span>
    </div>
    <p class="pm__allapot" data-allapot>mérés folyamatban</p>
    <p class="pm__magyar">${v.magyar}</p>
  </article>`;

const netHTML = (key: string, i: number, kod: string, nev: string, egyseg: string) => `
  <article class="pm__mero pm__mero--halo" data-net="${key}" aria-labelledby="pm-${key}-nev">
    <header class="pm__sor"><span class="pm__kod">${String(i).padStart(2, '0')} · ${kod}</span></header>
    <h3 class="pm__nev" id="pm-${key}-nev">${nev}</h3>
    <p class="pm__ertek"><span class="pm__szam" data-szam>—</span><span class="pm__egyseg" data-egyseg>${egyseg}</span></p>
    <p class="pm__allapot" data-allapot></p>
    <p class="pm__magyar" data-magyar></p>
  </article>`;

const NAV_TIPUS: Record<string, string> = {
  navigate: 'első betöltés', reload: 'újratöltés', back_forward: 'vissza/előre lépés', prerender: 'előtöltés',
};

export function init(el: HTMLElement): void {
  const root = el.querySelector<HTMLElement>('[data-perf-root]');
  if (!root) return;
  // Az élő számok (FPS, INP) ne olvastassák fel magukat folyamatosan.
  root.setAttribute('aria-live', 'off');

  root.innerHTML = `
    <div class="pm">
      <p class="pm__fej">
        <span class="pm__fej-jel" aria-hidden="true"></span>
        <span>Mérés: <b data-navtipus>—</b></span>
        <span>időpont: <b data-ido>—</b></span>
        <span>helyszín: a te böngésződ</span>
      </p>
      <div class="pm__racs">
        ${VITALS.map(vitalHTML).join('')}
        <section class="pm__szkop" aria-labelledby="pm-fps-nev">
          <header class="pm__sor">
            <span class="pm__kod">05 · FPS</span><span class="pm__elo">élő</span>
          </header>
          <div class="pm__szkop-fej">
            <h3 class="pm__nev" id="pm-fps-nev">Képkocka másodpercenként</h3>
            <p class="pm__ertek"><span class="pm__szam" data-fps>—</span><span class="pm__egyseg">kép/s</span></p>
          </div>
          <div class="pm__kepernyo"><canvas class="pm__vaszon" aria-hidden="true"></canvas></div>
          <p class="pm__allapot" data-fps-megj></p>
          <p class="pm__magyar">Hányszor rajzolja újra a képernyőt a böngésződ, amíg ezt nézed (az utolsó 60 kocka). Ha a vonal egyenes, minden simán mozog; ha lecsúszik, akad.</p>
          <button type="button" class="pm__gomb" data-fps-gomb hidden>Mérés 2 másodpercig</button>
        </section>
        ${netHTML('adat', 6, 'ÁTVITEL', 'Letöltött adat', 'kB')}
        ${netHTML('keres', 7, 'KÉRÉSEK', 'Lekért fájlok', 'db')}
        ${netHTML('harmadik', 8, 'KÜLSŐ', 'Harmadik féltől', 'db')}
        ${netHTML('suti', 9, 'SÜTIK', 'Sütik ezen a címen', 'db')}
      </div>
      <div class="pm__lab">
        <div class="pm__ujra">
          <button type="button" class="gomb gomb--fo" data-ujra>Mérd újra</button>
          <p class="apro">Újratölti az oldalt, és visszahoz ide. Minden szám egy friss betöltésből jön; másodszorra a fájlok nagy része valószínűleg már a gyorsítótárból érkezik, ezt is kiírjuk.</p>
        </div>
        <p class="pm__forras">A „jó” küszöbök a Google által közzétett határértékek: web.dev/vitals.</p>
        <p class="pm__privat">A mérés csak a te böngésződben fut, nem küldjük el sehova.</p>
      </div>
    </div>`;

  const q = <T extends HTMLElement = HTMLElement>(sel: string, p: ParentNode = root) => p.querySelector<T>(sel)!;

  // --- láthatóság: a felpörgés akkor indul, amikor a mérőt tényleg látod ---
  let latszik = false;
  const kijelzok: Kijelzo[] = [];
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      latszik = true;
      root.classList.add('pm--latszik');
      kijelzok.forEach((k) => k.mutat());
      io.disconnect();
    }
  }, { threshold: 0.15 });
  io.observe(q('.pm__racs'));
  const lat = () => latszik;

  // --- fejléc ---
  q('[data-ido]').textContent = new Intl.DateTimeFormat('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());

  // --- Web Vitals ---
  for (const v of VITALS) {
    const box = q(`[data-vital="${v.key}"]`);
    const k = new Kijelzo(q('[data-szam]', box), v.fmt, lat);
    kijelzok.push(k);
    const allapot = q('[data-allapot]', box);
    const max = v.gyenge * 1.3;
    box.style.setProperty('--jo', String(v.jo / max));
    box.style.setProperty('--rossz', String(v.gyenge / max));
    const frissit = (val: number) => {
      k.set(val);
      box.style.setProperty('--x', String(Math.min(1, Math.max(0, val / max))));
      box.classList.add('pm__mero--van');
      const sav = val <= v.jo ? 'a „jó” sávban' : val <= v.gyenge ? 'a „javításra szorul” sávban' : 'a „gyenge” sávban';
      allapot.textContent = sav;
      box.dataset.sav = val <= v.jo ? 'jo' : val <= v.gyenge ? 'kozep' : 'rossz';
    };
    const nemMeri = () => {
      box.classList.add('pm__mero--nincs');
      allapot.textContent = NEM_MERI;
      q('[data-egyseg]', box).textContent = '';
    };

    if (v.key === 'lcp' && !watchLCP(frissit)) nemMeri();
    if (v.key === 'fcp' && !watchFCP(frissit)) nemMeri();
    if (v.key === 'cls' && !watchCLS(frissit)) nemMeri();
    if (v.key === 'inp') {
      let volt = false, sajat = 0;
      const ok = watchINP((ms, db) => {
        volt = true;
        frissit(ms);
        allapot.textContent += ` · ${db} mért interakció alapján`;
      });
      if (!ok) nemMeri();
      else {
        allapot.textContent = 'még nem nyúltál semmihez: kattints vagy gépelj bárhol az oldalon';
        const jelez = () => {
          sajat++;
          // A böngésző csak a 16 ms-nál hosszabb eseményeket jelenti. Ha volt interakció,
          // de nem jött bejegyzés, akkor minden reakció ennél gyorsabb volt.
          window.setTimeout(() => {
            if (volt) return;
            q('[data-szam]', box).textContent = '< 16';
            box.style.setProperty('--x', '0');
            box.classList.add('pm__mero--van');
            box.dataset.sav = 'jo';
            allapot.textContent = `${sajat} interakció, mind 16 ms alatt: ennél gyorsabbat a böngésző nem is jelent`;
          }, 600);
        };
        window.addEventListener('pointerup', jelez, { passive: true });
        window.addEventListener('keyup', jelez, { passive: true });
      }
    }
  }

  // --- Hálózat ---
  const adatBox = q('[data-net="adat"]'), keresBox = q('[data-net="keres"]');
  const harmBox = q('[data-net="harmadik"]'), sutiBox = q('[data-net="suti"]');
  const meret = (b: number) => (b >= 1024 * 1024 ? { n: b / 1048576, u: 'MB', f: ketSzazad } : { n: b / 1024, u: 'kB', f: egyTized });
  let adatEgyseg = 'kB';
  const adatK = new Kijelzo(q('[data-szam]', adatBox), (n) => (adatEgyseg === 'MB' ? ketSzazad : egyTized).format(n), lat);
  const keresK = new Kijelzo(q('[data-szam]', keresBox), (n) => egesz.format(n), lat);
  const harmK = new Kijelzo(q('[data-szam]', harmBox), (n) => egesz.format(n), lat);
  const sutiK = new Kijelzo(q('[data-szam]', sutiBox), (n) => egesz.format(n), lat);
  kijelzok.push(adatK, keresK, harmK, sutiK);

  const halo = () => {
    const s = netSnapshot();
    q('[data-navtipus]').textContent = NAV_TIPUS[s.navType] ?? s.navType;
    const m = meret(s.transfer);
    adatEgyseg = m.u;
    q('[data-egyseg]', adatBox).textContent = m.u;
    adatK.set(m.n);
    const kicsi = meret(s.decoded);
    q('[data-allapot]', adatBox).textContent = s.transfer === 0 && s.decoded > 0
      ? `gyorsítótárból jött: most semmit nem kellett letölteni (kicsomagolva ${kicsi.f.format(kicsi.n)} ${kicsi.u})`
      : `kicsomagolva ${kicsi.f.format(kicsi.n)} ${kicsi.u}${s.cached ? `, ${s.cached} fájl a gyorsítótárból jött` : ''}`;
    q('[data-magyar]', adatBox).textContent = 'Ennyit kellett eddig letöltenie a gépednek vagy telefonodnak ehhez az oldalhoz. Mobilneten ez a te adatkereted.';

    keresK.set(s.requests);
    q('[data-allapot]', keresBox).textContent = 'az oldal maga, a betűk, a stílus és a kód';
    q('[data-magyar]', keresBox).textContent = 'Ennyi külön fájlt kért le a böngésző. A görgetéssel később betöltődő részek is ide számítanak, ezért ez a szám nőhet.';

    harmK.set(s.thirdParty);
    harmBox.dataset.sav = s.thirdParty === 0 ? 'jo' : 'kozep';
    q('[data-allapot]', harmBox).textContent = s.thirdParty === 0
      ? 'minden fájl erről a címről jött'
      : `más szerverre ment: ${s.thirdOrigins.map((o) => o.replace(/^https?:\/\//, '')).join(', ')}`;
    q('[data-magyar]', harmBox).textContent = 'Kérés más cég szerverére: hirdetés, követőkód, külső betűtípus. Ezek lassítanak, és adatot visznek ki rólad.';
  };

  if (netSupported()) {
    halo();
    watchResources(halo);
  } else {
    for (const b of [adatBox, keresBox, harmBox]) {
      b.classList.add('pm__mero--nincs');
      q('[data-allapot]', b).textContent = NEM_MERI;
      q('[data-egyseg]', b).textContent = '';
    }
    q('[data-navtipus]').textContent = 'betöltés';
  }

  const sutik = cookieCount();
  sutiK.set(sutik);
  sutiBox.dataset.sav = sutik === 0 ? 'jo' : 'kozep';
  q('[data-allapot]', sutiBox).textContent = sutik === 0
    ? 'egy sem, ezért nincs sütisáv sem'
    : `${sutik} süti látszik ennél a címnél`;
  q('[data-magyar]', sutiBox).textContent = 'Apró fájlok, amiket egy oldal a gépeden hagy, gyakran azért, hogy követni tudjon. A JavaScript által látható sütiket számoltuk meg.';

  // --- FPS ---
  createFps(q<HTMLCanvasElement>('.pm__vaszon'), q('[data-fps]'), q('[data-fps-megj]'), q<HTMLButtonElement>('[data-fps-gomb]'));

  // --- Mérd újra: friss betöltés, vissza erre a szekcióra ---
  q('[data-ujra]').addEventListener('click', () => {
    // A böngésző ne a régi görgetési pozíciót állítsa vissza (a lusta modulok miatt
    // az oldal magassága betöltéskor még más), hanem ugorjon a #merd horgonyra.
    try { history.scrollRestoration = 'manual'; } catch { /* nem támogatott */ }
    history.replaceState(null, '', '#merd');
    location.reload();
  });
}
