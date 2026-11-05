// Élő csővezeték: a látogató saját, még el nem küldött adataiból épül fel
// az „E-mail Martinnak” előnézet és a tervezett táblázatsor.
// Minden felhasználói szöveg textContent-tel kerül ki (soha innerHTML).
import { reducedMotion } from '../../lib/env';
import { visibleLoop } from '../../lib/loop';

const SVGNS = 'http://www.w3.org/2000/svg';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export interface Pipeline {
  update(field: 'nev' | 'email' | 'uzenet', value: string): void;
  focus(field: 'nev' | 'email' | 'uzenet' | null): void;
  seal(): void;
  unseal(): void;
  relayout(): void;
}

type Field = 'nev' | 'email' | 'uzenet';

const ELLIPSIS = '…';
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n).trimEnd() + ELLIPSIS : t);
const oneLine = (t: string) => t.replace(/\s+/g, ' ').trim();

export function createPipeline(root: HTMLElement, form: HTMLFormElement, fields: Record<Field, HTMLInputElement | HTMLTextAreaElement>): Pipeline {
  root.replaceChildren();
  root.classList.add('cso--el');

  // ---------- SVG folyam (az űrlapból a kártyákba) ----------
  const svg = s('svg', { class: 'cso__folyam', focusable: 'false' });
  const gTrack = s('g', { class: 'cso__savok' });
  const gFlow = s('g', { class: 'cso__aramok' });
  const gPorts = s('g', { class: 'cso__portok' });
  svg.append(gTrack, gFlow, gPorts);

  const mkPath = (key: string) => {
    const track = s('path', { class: 'cso__sav', 'data-k': key });
    const flow = s('path', { class: 'cso__aram', 'data-k': key });
    gTrack.append(track); gFlow.append(flow);
    return { track, flow };
  };
  const strands: Record<Field, ReturnType<typeof mkPath>> = { nev: mkPath('nev'), email: mkPath('email'), uzenet: mkPath('uzenet') };
  const branchMail = mkPath('level');
  const branchRow = mkPath('sor');
  const portEls = [0, 1, 2, 3, 4].map(() => { const c = s('circle', { class: 'cso__port', r: '4' }); gPorts.append(c); return c; });

  // ---------- Fejléc ----------
  const fej = h('p', 'cso__fej');
  fej.append(h('span', 'cso__pont'), document.createTextNode('Élő előnézet a böngésződben'));

  // ---------- E-mail kártya ----------
  const mail = h('article', 'cso__kartya cso__kartya--level');
  const mailHead = h('header', 'kartya__fej');
  const mailChip = h('span', 'kartya__cimke', 'Előnézet');
  mailHead.append(h('span', 'kartya__nev', 'E-mail Martinnak'), mailChip);
  const meta = h('dl', 'level__meta');
  const row = (k: string) => { const dt = h('dt', undefined, k); const dd = h('dd'); meta.append(dt, dd); return dd; };
  const ddFrom = row('Feladó');
  const fromName = h('span', 'level__nev');
  const fromMail = h('span', 'level__cim');
  ddFrom.append(fromName, fromMail);
  row('Címzett').textContent = 'Martin';
  row('Tárgy').textContent = 'Új üzenet a Folyam Studio oldalról';
  const body = h('div', 'level__torzs');
  const stamp = h('span', 'kartya__pecset', 'Elküldve');
  mail.append(mailHead, meta, body, stamp);

  // ---------- Táblázatsor ----------
  const sheet = h('article', 'cso__kartya cso__kartya--tabla');
  const sheetHead = h('header', 'kartya__fej');
  const sheetChip = h('span', 'kartya__cimke kartya__cimke--terv', 'Tervezett');
  sheetHead.append(h('span', 'kartya__nev', 'Táblázatsor'), sheetChip);
  const table = h('table', 'tabla');
  const colgroup = h('colgroup');
  for (const c of ['tabla__c-sz', 'tabla__c-ido', 'tabla__c-nev', 'tabla__c-mail', 'tabla__c-uz', 'tabla__c-all']) colgroup.append(h('col', c));
  const thead = h('thead');
  const letters = h('tr', 'tabla__betuk');
  for (const l of ['', 'A', 'B', 'C', 'D', 'E']) letters.append(h('th', undefined, l));
  const heads = h('tr');
  heads.append(h('th', 'tabla__sorszam', '1'));
  for (const t of ['Időpont', 'Név', 'E-mail', 'Üzenet eleje', 'Állapot']) heads.append(h('th', undefined, t));
  thead.append(letters, heads);
  const tbody = h('tbody');
  const tr = h('tr');
  tr.append(h('th', 'tabla__sorszam', '2'));
  const cells = {
    ido: h('td'), nev: h('td'), email: h('td'), uzenet: h('td'), all: h('td'),
  };
  const statusChip = h('span', 'tabla__uj', 'Új');
  cells.all.append(statusChip);
  tr.append(cells.ido, cells.nev, cells.email, cells.uzenet, cells.all);
  const emptyRow = h('tr', 'tabla__ures');
  emptyRow.append(h('th', 'tabla__sorszam', '3'));
  for (let i = 0; i < 5; i++) emptyRow.append(h('td'));
  tbody.append(tr, emptyRow);
  table.append(colgroup, thead, tbody);
  sheet.append(sheetHead, table, h('span', 'kartya__pecset kartya__pecset--terv', 'Csak előnézet'));

  // ---------- Felirat ----------
  const caption = h('div', 'cso__felirat');
  const capMain = h('p', undefined, 'Így nézne ki a tervezett automatizálás. Ez itt csak előnézet a böngésződben: semmi nem megy el, amíg nem küldöd el.');
  const capNow = h('p', 'cso__ma', 'Ma így működik: az üzenet a Netlify űrlapkezelőjébe érkezik, és e-mail értesítés megy róla Martinnak. A táblázatba írás még tervezett funkció.');
  caption.append(capMain, capNow);

  const cards = h('div', 'cso__kartyak');
  cards.append(mail, sheet);
  root.append(svg, fej, cards, caption);

  // ---------- Tartalom ----------
  const values: Record<Field, string> = { nev: '', email: '', uzenet: '' };
  const placeholder = (el: HTMLElement, text: string, ph: string) => {
    el.textContent = text || ph;
    el.classList.toggle('ures', !text);
  };
  const flash = (el: HTMLElement) => {
    if (reducedMotion()) return;
    el.animate(
      [{ backgroundColor: 'rgba(217,178,31,0.55)' }, { backgroundColor: 'rgba(217,178,31,0)' }],
      { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' },
    );
  };
  const stampTime = () => {
    const d = new Date();
    const z = (n: number) => String(n).padStart(2, '0');
    const f = `${z(d.getMonth() + 1)}.${z(d.getDate())}. ${z(d.getHours())}:${z(d.getMinutes())}`;
    if (cells.ido.textContent !== f) { cells.ido.textContent = f; flash(cells.ido); }
  };
  const render = (changed?: Field) => {
    const n = oneLine(values.nev);
    const m = values.email.trim();
    placeholder(fromName, clip(n, 60), 'Neved');
    fromMail.textContent = m ? `<${clip(m, 60)}>` : '<e-mail-címed>';
    fromMail.classList.toggle('ures', !m);
    placeholder(body, clip(values.uzenet.trim(), 700), 'Itt jelenik meg, amit az Üzeneted mezőbe írsz.');
    placeholder(cells.nev, clip(n, 40), '');
    placeholder(cells.email, clip(m, 60), '');
    placeholder(cells.uzenet, clip(oneLine(values.uzenet), 48), '');
    const any = !!(n || m || values.uzenet.trim());
    tr.classList.toggle('tabla__sor--el', any);
    if (any) stampTime(); else cells.ido.textContent = '';
    if (changed) {
      flash(changed === 'nev' ? cells.nev : changed === 'email' ? cells.email : cells.uzenet);
      flash(changed === 'uzenet' ? body : fromName.parentElement!);
    }
  };
  render();

  // ---------- Geometria ----------
  let mergeTo: Field | null = null;
  function layout() {
    const R = root.getBoundingClientRect();
    const F = form.getBoundingClientRect();
    if (!R.width || !F.width) return;
    const side = R.left > F.right - 10; // asztali: mellette; telefon: alatta
    root.classList.toggle('cso--alatta', !side);
    const L = Math.min(R.left, F.left) - 20;
    const T = Math.min(R.top, F.top) - 20;
    const W = Math.max(R.right, F.right) - L + 20;
    const H = Math.max(R.bottom, F.bottom) - T + 20;
    svg.style.setProperty('left', `${L - R.left}px`);
    svg.style.setProperty('top', `${T - R.top}px`);
    svg.style.setProperty('width', `${W}px`);
    svg.style.setProperty('height', `${H}px`);
    svg.setAttribute('viewBox', `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`);
    const loc = (x: number, y: number): [number, number] => [x - L, y - T];
    const mr = mail.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
    const f = (k: Field) => fields[k].getBoundingClientRect();
    const fy = (k: Field) => (k === 'uzenet' ? f(k).top + 26 : f(k).top + f(k).height / 2);
    const p = (pts: [number, number][]) => pts.map((q) => q.map((v) => v.toFixed(1)).join(' '));

    let ports: [number, number][];
    if (side) {
      const [mx, my] = loc(R.left + 18, (mr.top + 40 + sr.top + 40) / 2);
      const strandD = (k: Field) => {
        const [sx, sy] = loc(f(k).right + 4, fy(k));
        const dx = mx - sx;
        return `M${sx.toFixed(1)} ${sy.toFixed(1)} C${p([[sx + dx * 0.55, sy], [mx - dx * 0.35, my], [mx, my]]).join(' ')}`;
      };
      const branchD = (r: DOMRect) => {
        const [px, py] = loc(r.left - 1, r.top + 40);
        const dx = px - mx;
        return `M${mx.toFixed(1)} ${my.toFixed(1)} C${p([[mx + dx * 0.6, my], [px - dx * 0.6, py], [px, py]]).join(' ')}`;
      };
      (Object.keys(strands) as Field[]).forEach((k) => { const d = strandD(k); strands[k].track.setAttribute('d', d); strands[k].flow.setAttribute('d', d); });
      for (const [b, r] of [[branchMail, mr], [branchRow, sr]] as const) { const d = branchD(r); b.track.setAttribute('d', d); b.flow.setAttribute('d', d); }
      ports = [loc(f('nev').right + 4, fy('nev')), loc(f('email').right + 4, fy('email')), loc(f('uzenet').right + 4, fy('uzenet')), loc(mr.left - 1, mr.top + 40), loc(sr.left - 1, sr.top + 40)];
    } else {
      // telefonon: gerinc a bal margóban, lefelé a kártyákig
      const spineX = loc(F.left - 9, 0)[0];
      const [, mergeY] = loc(0, F.bottom);
      const strandD = (k: Field) => {
        const [sx, sy] = loc(f(k).left - 2, fy(k));
        return `M${sx.toFixed(1)} ${sy.toFixed(1)} H${(spineX + 6).toFixed(1)} Q${spineX.toFixed(1)} ${sy.toFixed(1)} ${spineX.toFixed(1)} ${(sy + 6).toFixed(1)} V${mergeY.toFixed(1)}`;
      };
      const branchD = (r: DOMRect) => {
        const [px, py] = loc(r.left - 1, r.top + 22);
        return `M${spineX.toFixed(1)} ${mergeY.toFixed(1)} V${(py - 6).toFixed(1)} Q${spineX.toFixed(1)} ${py.toFixed(1)} ${(spineX + 6).toFixed(1)} ${py.toFixed(1)} H${px.toFixed(1)}`;
      };
      (Object.keys(strands) as Field[]).forEach((k) => { const d = strandD(k); strands[k].track.setAttribute('d', d); strands[k].flow.setAttribute('d', d); });
      for (const [b, r] of [[branchMail, mr], [branchRow, sr]] as const) { const d = branchD(r); b.track.setAttribute('d', d); b.flow.setAttribute('d', d); }
      ports = [loc(f('nev').left - 2, fy('nev')), loc(f('email').left - 2, fy('email')), loc(f('uzenet').left - 2, fy('uzenet')), loc(mr.left - 1, mr.top + 22), loc(sr.left - 1, sr.top + 22)];
    }
    ports.forEach(([x, y], i) => { portEls[i].setAttribute('cx', x.toFixed(1)); portEls[i].setAttribute('cy', y.toFixed(1)); });
  }

  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
  const ro = new ResizeObserver(schedule);
  ro.observe(root); ro.observe(form);
  for (const k of Object.keys(fields) as Field[]) ro.observe(fields[k]);
  window.addEventListener('resize', schedule, { passive: true });
  document.fonts?.ready.then(schedule).catch(() => {});
  schedule();

  // ---------- Áramlás animáció (stroke-dashoffset) ----------
  let offset = 0, speed = 0, sealed = false;
  const BASE = 22; // px/s nyugalomban
  const setOffset = () => { for (const el of gFlow.children) (el as SVGPathElement).style.setProperty('stroke-dashoffset', offset.toFixed(1)); };
  const loop = visibleLoop(root, (_t, dt) => {
    if (dt <= 0) { setOffset(); return; }
    speed *= Math.exp(-dt * 2.2);
    offset -= (BASE + speed) * dt;
    if (offset < -1e5) offset = 0;
    setOffset();
  });
  loop.start();

  const setActive = (k: Field | null) => {
    for (const key of Object.keys(strands) as Field[]) {
      strands[key].flow.classList.toggle('aktiv', key === k);
      strands[key].track.classList.toggle('aktiv', key === k);
    }
  };

  return {
    update(field, value) {
      if (sealed) {
        this.unseal();
        for (const k of Object.keys(fields) as Field[]) values[k] = fields[k].value;
      }
      values[field] = value;
      speed = Math.min(320, speed + 70);
      mergeTo = field;
      setActive(field);
      root.classList.add('cso--pezseg');
      render(field);
    },
    focus(field) { setActive(field ?? mergeTo); },
    seal() {
      sealed = true;
      speed = 420;
      root.classList.add('cso--elkuldve');
      mailChip.textContent = 'Elküldve';
      capMain.textContent = 'Elküldve. Az üzeneted e-mailben megy Martinnak; a táblázatsor továbbra is csak előnézet, ezt a részt még tervezzük.';
      for (const k of Object.keys(strands) as Field[]) strands[k].flow.classList.remove('aktiv');
    },
    unseal() {
      if (!sealed) return;
      sealed = false;
      root.classList.remove('cso--elkuldve');
      mailChip.textContent = 'Előnézet';
      capMain.textContent = 'Így nézne ki a tervezett automatizálás. Ez itt csak előnézet a böngésződben: semmi nem megy el, amíg nem küldöd el.';
    },
    relayout: schedule,
  };
}
