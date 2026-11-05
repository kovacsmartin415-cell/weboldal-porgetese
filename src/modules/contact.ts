// Kapcsolat: furnasi gőz (folyadékszimuláció), élő csővezeték, beküldés.
import '../styles/modules/contact.css';
import { hasWebGL2, reducedMotion } from '../lib/env';
import { createSteam, type Steam } from './contact/steam';
import { createPipeline, type Pipeline } from './contact/pipeline';
import { enhanceForm } from './contact/form';

type Field = 'nev' | 'email' | 'uzenet';

export function init(el: HTMLElement): void {
  const form = el.querySelector<HTMLFormElement>('form[name="kapcsolat"]');
  const canvas = el.querySelector<HTMLCanvasElement>('canvas[data-steam]');
  const root = el.querySelector<HTMLElement>('[data-pipeline-root]');

  // 1) Gőz – WebGL2 nélkül nincs semmi, a bazalt alap marad.
  let steam: Steam | null = null;
  if (canvas && hasWebGL2()) {
    try { steam = createSteam(canvas, el); } catch (err) { console.warn('[folyam] gőz nélkül', err); }
  }
  if (!steam && canvas) canvas.hidden = true;

  if (!form) return;
  const get = (n: Field) => form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null;
  const fields = { nev: get('nev'), email: get('email'), uzenet: get('uzenet') };

  // 2) Csővezeték
  let pipe: Pipeline | null = null;
  if (root && fields.nev && fields.email && fields.uzenet) {
    pipe = createPipeline(root, form, fields as Record<Field, HTMLInputElement | HTMLTextAreaElement>);
  }

  // Gépelés: csővezeték frissül, a mező helyéről gőz pöffen.
  let lastPuff = 0;
  for (const k of Object.keys(fields) as Field[]) {
    const f = fields[k];
    if (!f) continue;
    f.addEventListener('input', () => {
      pipe?.update(k, f.value);
      if (!steam || !canvas || reducedMotion()) return;
      const now = performance.now();
      if (now - lastPuff < 55) return;
      lastPuff = now;
      const c = canvas.getBoundingClientRect();
      const r = f.getBoundingClientRect();
      const guess = k === 'uzenet' ? r.width * (0.15 + Math.random() * 0.7) : Math.min(r.width - 18, 16 + f.value.length * 8.6);
      steam.puff(r.left - c.left + guess, r.top - c.top + 2, 0.8 + Math.random() * 0.4);
    });
    f.addEventListener('focus', () => pipe?.focus(k));
    f.addEventListener('blur', () => pipe?.focus(null));
  }

  // 3) Beküldés
  enhanceForm(form, { onSent: () => pipe?.seal() });
}
