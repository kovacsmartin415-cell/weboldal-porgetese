// Űrlap: magyar hibaüzenetek a natív constraint API-val, és progresszív
// javítású beküldés (fetch POST a "/"-ra, Netlify Forms). JS nélkül a sima
// POST az action-re megy, ehhez nem nyúlunk.

type Ctrl = HTMLInputElement | HTMLTextAreaElement;

function message(el: Ctrl): string {
  const v = el.validity;
  const empty = el.type !== 'checkbox' && el.value.trim() === '';
  switch (el.name) {
    case 'nev':
      if (v.valueMissing || empty) return 'Írd be a neved, hogy tudjuk, kinek válaszolunk.';
      if (v.tooLong) return 'A név legfeljebb 120 karakter lehet.';
      break;
    case 'email':
      if (v.valueMissing || empty) return 'Írd be az e-mail-címed, erre válaszolunk.';
      if (v.typeMismatch || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(el.value.trim())) return 'Ez nem tűnik e-mail-címnek. Így nézzen ki: nev@pelda.hu';
      if (v.tooLong) return 'Az e-mail-cím legfeljebb 200 karakter lehet.';
      break;
    case 'uzenet':
      if (v.valueMissing || empty) return 'Írj pár szót az üzenetbe.';
      if (v.tooLong) return 'Az üzenet legfeljebb 4000 karakter lehet.';
      break;
    case 'adatkezeles':
      if (v.valueMissing) return 'A küldéshez fogadd el az adatkezelési tájékoztatót.';
      break;
  }
  return '';
}

export interface FormHooks { onSent(): void; }

export function enhanceForm(form: HTMLFormElement, hooks: FormHooks): void {
  const status = form.querySelector<HTMLElement>('.urlap__allapot');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const ctrls = ['nev', 'email', 'uzenet', 'adatkezeles']
    .map((n) => form.elements.namedItem(n))
    .filter((e): e is Ctrl => e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement);

  // Saját hibaüzenetek a mezők alatt; a buborékot nem használjuk.
  form.noValidate = true;
  const errs = new Map<Ctrl, HTMLElement>();
  const shown = new Set<Ctrl>();
  for (const el of ctrls) {
    const box = el.closest('.mezo') ?? el.parentElement!;
    const err = document.createElement('span');
    err.className = 'mezo__hiba';
    err.id = `${el.id}-hiba`;
    err.hidden = true;
    box.append(err);
    errs.set(el, err);
    el.setAttribute('aria-describedby', err.id);
  }

  const check = (el: Ctrl) => {
    el.setCustomValidity('');
    const m = message(el);
    el.setCustomValidity(m);
    if (shown.has(el)) {
      const err = errs.get(el)!;
      err.textContent = m;
      err.hidden = !m;
      if (m) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    }
    return !m;
  };
  const reveal = (el: Ctrl) => { shown.add(el); check(el); };
  const hideAll = () => {
    shown.clear();
    for (const el of ctrls) { el.removeAttribute('aria-invalid'); const e = errs.get(el)!; e.hidden = true; e.textContent = ''; }
  };

  for (const el of ctrls) {
    check(el);
    el.addEventListener('input', () => check(el));
    el.addEventListener('change', () => { if (el.type === 'checkbox') reveal(el); else check(el); });
    el.addEventListener('blur', () => { if (el.value.trim() !== '' && el.type !== 'checkbox') reveal(el); });
  }

  const say = (text: string, kind: 'ok' | 'hiba' | 'folyamat' | '' = '') => {
    if (!status) return;
    status.replaceChildren(document.createTextNode(text));
    status.dataset.allapot = kind;
  };

  const label = button?.textContent ?? '';
  let busy = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const okAll = ctrls.map((el) => { reveal(el); return el.checkValidity(); }).every(Boolean);
    if (!okAll || !form.checkValidity()) {
      const first = ctrls.find((el) => !el.validity.valid);
      say('Nézd át a megjelölt mezőket.', 'hiba');
      first?.focus();
      return;
    }

    busy = true;
    if (button) { button.disabled = true; button.textContent = 'Küldés…'; }
    form.setAttribute('aria-busy', 'true');
    say('Küldés folyamatban…', 'folyamat');

    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === 'string') params.append(k, v);
    if (!params.has('form-name')) params.set('form-name', form.getAttribute('name') || 'kapcsolat');

    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 15000);
    let problem = '';
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: ctl.signal,
      });
      if (!res.ok) problem = `A szerver hibával válaszolt (${res.status}).`;
    } catch {
      problem = 'Nem értük el a szervert: lehet, hogy megszakadt az internetkapcsolat.';
    } finally {
      clearTimeout(timer);
      busy = false;
      form.removeAttribute('aria-busy');
      if (button) { button.disabled = false; button.textContent = label; }
    }

    if (!problem) {
      say('Megkaptuk, köszönjük. Martin válaszol.', 'ok');
      hooks.onSent();
      form.reset();
      hideAll();
      for (const el of ctrls) check(el);
      return;
    }

    // Hiba: érthető üzenet, az adatok az űrlapban maradnak, és felkínáljuk a natív beküldést.
    if (!status) return;
    status.replaceChildren(
      document.createTextNode(`Nem sikerült elküldeni. ${problem} Az üzeneted megmaradt az űrlapban. Próbáld újra, vagy küldd el hagyományosan: `),
    );
    const fallback = document.createElement('button');
    fallback.type = 'button';
    fallback.className = 'urlap__tartalek';
    fallback.textContent = 'Hagyományos beküldés';
    fallback.addEventListener('click', () => {
      // a natív submit() nem váltja ki a submit eseményt: sima POST az action-re (/koszonjuk/)
      HTMLFormElement.prototype.submit.call(form);
    });
    status.append(fallback);
    status.dataset.allapot = 'hiba';
  });
}
