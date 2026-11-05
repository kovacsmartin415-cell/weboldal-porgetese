// „Rakd össze a saját oldaladat” – élő oldalvázlat-generátor.
// Valódi űrlapelemek balra, CSS/DOM-ból épített telefon jobbra. Váltáskor a blokkok
// View Transitions API-val (vagy FLIP-pel) rendeződnek át, a paletta @property-vel
// regisztrált custom property-kkel folyik át. Semmi nem kerül tárolásra, nincs hálózat.
import '../styles/modules/configurator.css';
import { reducedMotion } from '../lib/env';
import { TYPES, MOODS, PACKAGES, DEFAULT_TOWN, type BizType, type MoodId, type TypeId, type BlockId, type Palette, type Week } from './configurator/data';
import { drawMap } from './configurator/map';

type Attrs = Record<string, string | number | boolean | undefined>;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') n.className = String(v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  n.append(...kids);
  return n;
}
const svgIcon = (inner: string, cls = 'kf__ikon'): SVGSVGElement => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.innerHTML = inner; // statikus, saját jelölés, nincs style attribútum
  return s;
};

const ICONS: Record<TypeId, string> = {
  pekseg: '<path d="M3.5 15.5c0-4.8 3.8-8.5 8.5-8.5s8.5 3.7 8.5 8.5V18h-17z"/><path d="M8.5 9.5l1.5 3M12 8.5v3.5M15.5 9.5l-1.5 3"/>',
  virag: '<circle cx="12" cy="8" r="2.2"/><path d="M12 5.8c0-2 1.6-3 2.8-2 1.2 1-.2 3.2-2.8 4.2M12 5.8c0-2-1.6-3-2.8-2-1.2 1 .2 3.2 2.8 4.2M14.2 8.4c1.9.4 2.8 2 1.6 3-1.1.9-3-.6-3.6-2.6M9.8 8.4c-1.9.4-2.8 2-1.6 3 1.1.9 3-.6 3.6-2.6"/><path d="M12 10.5V21M12 17c-2.5-.2-4-1.6-4.4-3.6 2.4.1 4 1.3 4.4 3.6zM12 15.5c2-.1 3.4-1.2 3.8-2.9-2 0-3.4 1-3.8 2.9z"/>',
  borbely: '<circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="17.5" r="2.8"/><path d="M8.5 15.5L18 3.5M15.5 15.5L6 3.5"/>',
  asztalos: '<path d="M3 16.5L16.5 7l3.5 3.5L6.5 20z"/><path d="M6 15.5l1 1M8.6 13.6l1 1M11.2 11.8l1 1M13.8 10l1 1"/><path d="M16.5 7l1.8-3.2 3.2 3.2-1.5 3.5"/>',
  szallas: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M8.5 20v-4.5h7V20M8.5 15.5c0-1.2.8-2 2-2h3c1.2 0 2 .8 2 2"/>',
};

const ITEMS_TITLE: Record<TypeId, string> = {
  pekseg: 'Ma a pultban',
  virag: 'Kínálat',
  borbely: 'Árak',
  asztalos: 'Amit készítünk',
  szallas: 'Szobák és árak',
};

const PALETTE_KEYS: [keyof Palette, string][] = [
  ['bg', '--vz-bg'], ['surf', '--vz-surf'], ['ink', '--vz-ink'], ['muted', '--vz-muted'],
  ['acc', '--vz-acc'], ['onAcc', '--vz-on-acc'], ['hero', '--vz-hero'], ['heroInk', '--vz-hero-ink'],
  ['p1', '--vz-p1'], ['p2', '--vz-p2'],
];

// --- Budapesti idő a „Nyitva most” jelzéshez és a telefon állapotsorához ---
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function budapestNow(): { day: number; min: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const hh = +get('hour'), mm = +get('minute');
  return { day: WD[get('weekday')] ?? 1, min: hh * 60 + mm, hhmm: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}
const isOpen = (w: Week, day: number, min: number) => { const s = w[day]; return !!s && min >= s[0] && min < s[1]; };

const typeOf = (id: TypeId) => TYPES.find((t) => t.id === id)!;

export function init(section: HTMLElement): void {
  const root = section.querySelector<HTMLElement>('[data-configurator-root]');
  if (!root) return;

  const state = { type: 'pekseg' as TypeId, mood: 'meleg' as MoodId, name: typeOf('pekseg').defaultName, town: DEFAULT_TOWN };
  const defaults = new Set(TYPES.map((t) => t.defaultName));

  // ================= Vezérlők =================
  const form = h('form', { class: 'kf__vezerlok', 'aria-label': 'A vázlat beállításai', novalidate: true });
  form.addEventListener('submit', (e) => e.preventDefault());

  const typeChips = h('div', { class: 'kf__chipek kf__chipek--tipus' });
  for (const t of TYPES) {
    const input = h('input', { type: 'radio', name: 'kf-tipus', value: t.id, class: 'kf__radio', checked: t.id === state.type });
    typeChips.append(h('label', { class: 'kf__chip' }, input, svgIcon(ICONS[t.id]), h('span', {}, t.label)));
  }
  const typeSet = h('fieldset', { class: 'kf__csoport' }, h('legend', { class: 'kf__cimke' }, h('span', { class: 'kf__szam', 'aria-hidden': 'true' }, '1'), 'Mivel foglalkozol?'), typeChips);

  const nameInput = h('input', { id: 'kf-nev', type: 'text', maxlength: 40, autocomplete: 'off', spellcheck: 'false', value: state.name });
  const townInput = h('input', { id: 'kf-telepules', type: 'text', maxlength: 40, autocomplete: 'off', spellcheck: 'false', value: state.town });
  const nameField = h('div', { class: 'kf__mezo' }, h('label', { for: 'kf-nev', class: 'kf__cimke' }, h('span', { class: 'kf__szam', 'aria-hidden': 'true' }, '2'), 'A vállalkozásod neve'), nameInput);
  const townField = h('div', { class: 'kf__mezo' }, h('label', { for: 'kf-telepules', class: 'kf__cimke' }, h('span', { class: 'kf__szam', 'aria-hidden': 'true' }, '3'), 'Település'), townInput);

  const moodChips = h('div', { class: 'kf__chipek kf__chipek--hangulat' });
  const swatchSets: Record<MoodId, HTMLElement[]> = { meleg: [], letisztult: [], meresz: [] };
  for (const m of MOODS) {
    const input = h('input', { type: 'radio', name: 'kf-hangulat', value: m.id, class: 'kf__radio', checked: m.id === state.mood });
    const sw = [h('span', { class: 'kf__folt' }), h('span', { class: 'kf__folt' }), h('span', { class: 'kf__folt' })];
    swatchSets[m.id] = sw;
    moodChips.append(h('label', { class: 'kf__chip kf__chip--hangulat' }, input,
      h('span', { class: 'kf__foltok', 'aria-hidden': 'true' }, ...sw),
      h('span', { class: 'kf__chip-szoveg' }, h('span', {}, m.label), h('span', { class: 'kf__chip-sugo' }, m.hint))));
  }
  const moodSet = h('fieldset', { class: 'kf__csoport' }, h('legend', { class: 'kf__cimke' }, h('span', { class: 'kf__szam', 'aria-hidden': 'true' }, '4'), 'Hangulat'), moodChips);

  form.append(typeSet, nameField, townField, moodSet);

  // ================= Telefon és vázlat =================
  const clock = h('span', { class: 'kf-tel__ora' });
  const statusBar = h('div', { class: 'kf-tel__allapot', 'aria-hidden': 'true' }, clock,
    h('span', { class: 'kf-tel__jelek' }, h('span', { class: 'kf-tel__terero' }), h('span', { class: 'kf-tel__akku' })));

  const kind = h('p', { class: 'vz__fajta' });
  const nameSr = h('span', { class: 'rejtett' });
  const nameVis = h('span', { class: 'vz__nev-betuk', 'aria-hidden': 'true' });
  const nameH = h('h3', { class: 'vz__nev' }, nameSr, nameVis);
  const head = h('header', { class: 'vz__fej' }, h('div', { class: 'vz__minta', 'aria-hidden': 'true' }), kind, nameH);

  const introP = h('p', { class: 'vz__bemutato' });
  const openState = h('strong', { class: 'vz__nyitva-allapot' });
  const openHours = h('span', { class: 'vz__nyitva-ido' });
  const itemsTitle = h('h4', { class: 'vz__alcim' });
  const itemsList = h('ul', { class: 'vz__tetelek' });
  const mapSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mapSvg.setAttribute('class', 'vz-map');
  mapSvg.setAttribute('aria-hidden', 'true');
  mapSvg.setAttribute('focusable', 'false');
  const mapTown = h('span', { class: 'vz-map__nev' });

  const blocks: Record<BlockId, HTMLElement> = {
    intro: h('section', { class: 'vz-blokk vz-blokk--intro' }, introP),
    open: h('section', { class: 'vz-blokk vz-blokk--nyitva' },
      h('span', { class: 'vz__pont', 'aria-hidden': 'true' }), h('span', { class: 'vz__nyitva-szoveg' }, openState, openHours)),
    items: h('section', { class: 'vz-blokk vz-blokk--tetelek' }, itemsTitle, itemsList),
    map: h('section', { class: 'vz-blokk vz-blokk--terkep' },
      h('figure', { class: 'vz-terkep' }, mapSvg, h('figcaption', { class: 'vz-terkep__felirat' }, mapTown, h('span', { class: 'vz-terkep__megj' }, 'térkép helye')))),
    call: h('section', { class: 'vz-blokk vz-blokk--hivas' },
      h('span', { class: 'vz-hivj' }, svgIcon('<path d="M6.6 3.5h3l1.5 4-2 1.3a11 11 0 005.9 5.9l1.3-2 4 1.5v3c0 1.1-.9 2-2 2A16.5 16.5 0 014.6 5.5c0-1.1.9-2 2-2z"/>', 'vz-hivj__ikon'), 'Hívj fel'),
      h('span', { class: 'vz-hivj__megj' }, 'Egy koppintás, és csörög nálad a telefon.')),
  };
  const blockWrap = h('div', { class: 'vz__blokkok' });
  const vz = h('div', { class: 'vz' },
    h('p', { class: 'vz__jel' }, 'Vázlat, minden adat példa.'),
    head, blockWrap,
    h('p', { class: 'vz__lab' }, 'Vázlat, minden adat példa. A böngésződben készült, nem ment el sehova.'));
  const screen = h('div', { class: 'kf-tel__kepernyo' }, statusBar, vz);
  const phone = h('div', { class: 'kf-tel', role: 'group', 'aria-label': 'Élő előnézet: a vázlat egy telefonon' },
    h('div', { class: 'kf-tel__keret' }, h('span', { class: 'kf-tel__sziget', 'aria-hidden': 'true' }), screen));
  const stage = h('div', { class: 'kf__szinpad' }, phone);
  const preview = h('div', { class: 'kf__elonezet' }, h('p', { class: 'kf__elonezet-cim', 'aria-hidden': 'true' }, 'Élő előnézet'), stage);

  // ================= Összegzés =================
  const pkgName = h('p', { class: 'kf__csomag' });
  const pkgPrice = h('p', { class: 'kf__ar' });
  const pkgWhy = h('p', { class: 'kf__miert' });
  const askBtn = h('button', { type: 'button', class: 'gomb gomb--fo kf__kerem' }, 'Erről kérdeznék, írok nektek');
  const summary = h('aside', { class: 'kf__osszeg', 'aria-labelledby': 'kf-osszeg-cim' },
    h('h3', { id: 'kf-osszeg-cim', class: 'kf__osszeg-cim' }, 'Ebből indulnánk'),
    h('div', { class: 'kf__csomag-doboz' }, pkgName, pkgPrice),
    pkgWhy,
    h('p', { class: 'kf__szemlelteto' }, 'Szemléltető ár, nem ajánlat. Ez egy tesztoldal, megrendelést nem fogadunk.'),
    askBtn,
    h('p', { class: 'kf__megj' }, 'A gomb a lenti üzenetmezőbe beírja a választásodat, ha még üres. Átírhatod, és csak akkor megy el, ha te elküldöd.'));

  const live = h('p', { class: 'rejtett', 'aria-live': 'polite', role: 'status' });
  const wrap = h('div', { class: 'kf' }, form, preview, summary, live);
  root.replaceChildren(wrap);

  // ================= Megjelenítés =================
  const motion = () => !reducedMotion();
  let typing = 0;

  function renderName(next: string, mode: 'diff' | 'type' | 'none') {
    const shown = next.trim() || 'A vállalkozásod neve';
    const prev = nameVis.dataset.text ?? '';
    nameSr.textContent = shown;
    nameVis.dataset.text = shown;
    nameH.classList.toggle('vz__nev--ures', !next.trim());
    let keep = 0;
    if (mode === 'diff') while (keep < prev.length && keep < shown.length && prev[keep] === shown[keep]) keep++;
    const animate = motion() && mode !== 'none';
    nameVis.replaceChildren();
    let i = 0, fresh = 0;
    for (const [wi, word] of shown.split(' ').entries()) {
      if (wi > 0) { nameVis.append(' '); i++; }
      const w = h('span', { class: 'vz__szo' });
      for (const ch of word) {
        const s = h('span', { class: 'vz__betu' }, ch);
        if (animate && i >= keep) { s.classList.add('vz__betu--uj'); s.style.setProperty('--d', `${fresh++ * (mode === 'type' ? 38 : 22)}ms`); }
        w.append(s);
        i++;
      }
      nameVis.append(w);
    }
  }

  function applyPalette() {
    const t = typeOf(state.type);
    const p = t.palettes[state.mood];
    for (const [k, v] of PALETTE_KEYS) wrap.style.setProperty(v, p[k]);
    for (const m of MOODS) {
      const pm = t.palettes[m.id];
      const [a, b, c] = swatchSets[m.id];
      a.style.setProperty('--c', pm.bg); b.style.setProperty('--c', pm.hero === pm.bg ? pm.acc : pm.hero); c.style.setProperty('--c', pm.acc);
    }
  }

  function renderOpen() {
    const t = typeOf(state.type);
    const now = budapestNow();
    const open = isOpen(t.week, now.day, now.min);
    blocks.open.classList.toggle('vz-blokk--zarva', !open);
    openState.textContent = open ? 'Nyitva most' : 'Most zárva';
    openHours.textContent = `Példa nyitvatartás: ${t.hours.split(', ').map((x) => x.replace(/ /g, '\u00a0')).join(', ')}`;
    clock.textContent = now.hhmm;
  }

  function renderTown() {
    const town = state.town.trim();
    mapTown.textContent = town || 'Település';
    drawMap(mapSvg, town);
    renderKind();
  }
  function renderKind() {
    const t = typeOf(state.type);
    const town = state.town.trim();
    kind.textContent = town ? `${t.label} · ${town}` : t.label;
  }

  function renderType() {
    const t = typeOf(state.type);
    vz.dataset.type = t.id;
    introP.textContent = t.intro;
    itemsTitle.textContent = ITEMS_TITLE[t.id];
    itemsList.replaceChildren(...t.items.map((it) =>
      h('li', { class: 'vz-tetel' }, h('span', { class: 'vz-tetel__nev' }, it.name),
        h('span', { class: 'vz-tetel__ar' }, it.price, h('span', { class: 'vz-tetel__pelda' }, 'példa ár')))));
    blockWrap.replaceChildren(...t.order.map((b) => blocks[b]));
    renderKind();
    renderOpen();
    const pk = PACKAGES[t.pkg];
    pkgName.textContent = pk.name;
    pkgPrice.textContent = pk.price;
    pkgWhy.textContent = t.why;
    summary.dataset.pkg = String(t.pkg);
  }

  function renderMood() {
    vz.dataset.mood = state.mood;
    wrap.dataset.mood = state.mood;
  }

  // --- Átmenetek ---
  const flipTargets = () => [head, ...Object.values(blocks), summary.querySelector('.kf__csomag-doboz') as HTMLElement];
  function flip(update: () => void, fade: boolean) {
    if (!motion()) { update(); return; }
    const els = flipTargets();
    const first = new Map(els.map((e) => [e, e.getBoundingClientRect()]));
    const h0 = screen.getBoundingClientRect().height;
    update();
    const h1 = screen.getBoundingClientRect().height;
    const ease = 'cubic-bezier(.2,.75,.2,1)';
    if (Math.abs(h1 - h0) > 1) screen.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: 520, easing: ease });
    for (const e of els) {
      const a = first.get(e)!, b = e.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) + Math.abs(dy) < 0.5 && !fade) continue;
      const kf: Keyframe[] = [{ transform: `translate(${dx}px, ${dy}px)`, opacity: fade ? 0.35 : 1 }, { transform: 'translate(0, 0)', opacity: 1 }];
      e.animate(kf, { duration: 560, easing: ease });
    }
  }
  let currentVT: ViewTransition | null = null;
  function transition(update: () => void, kindOf: 'type' | 'mood') {
    if (!motion()) { update(); return; }
    const doc = document as Document & { startViewTransition?: (cb: () => void) => ViewTransition };
    if (kindOf === 'type' && typeof doc.startViewTransition === 'function') {
      currentVT?.skipTransition();
      wrap.classList.add('kf--vt');
      const vt = doc.startViewTransition(update);
      currentVT = vt;
      vt.finished.finally(() => { if (currentVT === vt) { currentVT = null; wrap.classList.remove('kf--vt'); } });
      return;
    }
    flip(update, kindOf === 'type');
  }

  // --- Élő régió ---
  let liveTimer = 0;
  const say = (msg: string, delay = 0) => {
    clearTimeout(liveTimer);
    liveTimer = window.setTimeout(() => { live.textContent = msg; }, delay);
  };
  const describe = () => {
    const t = typeOf(state.type);
    const m = MOODS.find((x) => x.id === state.mood)!;
    return `Vázlat frissítve: ${t.label.toLowerCase()}, ${m.label} hangulat. Javasolt csomag: ${PACKAGES[t.pkg].name}.`;
  };

  // ================= Események =================
  typeChips.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value as TypeId;
    if (v === state.type) return;
    const t = typeOf(v);
    const swapName = !state.name.trim() || defaults.has(state.name.trim());
    transition(() => {
      state.type = v;
      renderType();
      applyPalette();
      if (swapName) {
        state.name = t.defaultName;
        nameInput.value = t.defaultName;
        renderName(state.name, 'type');
      }
      say(describe(), 150);
    }, 'type');
  });

  moodChips.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value as MoodId;
    if (v === state.mood) return;
    transition(() => { state.mood = v; renderMood(); applyPalette(); say(describe(), 150); }, 'mood');
  });

  nameInput.addEventListener('input', () => {
    clearTimeout(typing);
    state.name = nameInput.value;
    renderName(state.name, 'diff');
    say(`A vázlat fejlécében: ${state.name.trim() || 'üres név'}.`, 900);
  });
  townInput.addEventListener('input', () => {
    state.town = townInput.value;
    renderTown();
    say(state.town.trim() ? `Térkép és fejléc: ${state.town.trim()}.` : 'Település törölve a vázlatról.', 900);
  });

  askBtn.addEventListener('click', () => {
    const ta = document.getElementById('uzenet') as HTMLTextAreaElement | null;
    const target = document.getElementById('kapcsolat');
    const t = typeOf(state.type);
    const m = MOODS.find((x) => x.id === state.mood)!;
    const bits = [state.name.trim(), state.town.trim()].filter(Boolean);
    const msg = `Szia! ${t.iam}${bits.length ? ` (${bits.join(', ')})` : ''}, a »${m.label}« hangulatú vázlat tetszett.\n\n`;
    let filled = false;
    if (ta && !ta.value.trim()) {
      ta.value = msg;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      filled = true;
    }
    (target ?? ta)?.scrollIntoView({ behavior: motion() ? 'smooth' : 'auto', block: 'start' });
    if (ta) {
      ta.focus({ preventScroll: true });
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
    }
    say(filled
      ? 'Beírtuk a választásodat az üzenetmezőbe. Átírhatod, és csak akkor megy el, ha te elküldöd.'
      : 'Az üzenetmezőben már van szöveg, nem írtuk felül. A választásod: ' + `${t.label}, ${m.label} hangulat.`);
  });

  // Első kirajzolás (animáció nélkül), majd a név begépelése, amikor a szekció látszik.
  renderMood();
  applyPalette();
  renderType();
  renderTown();
  renderName(state.name, 'none');
  wrap.classList.add('kf--kesz');

  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); if (motion()) renderName(state.name, 'type'); }
  }, { threshold: 0.35 });
  io.observe(phone);

  // A „Nyitva most” és az óra percenként frissül, csak látható fülön.
  window.setInterval(() => { if (!document.hidden) renderOpen(); }, 30_000);
}
