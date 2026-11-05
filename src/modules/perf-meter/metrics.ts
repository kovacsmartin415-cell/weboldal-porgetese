// Valódi mérések a látogató böngészőjéből. Semmi nem megy ki a hálózatra:
// minden szám a PerformanceObserver / Navigation & Resource Timing API-ból jön.

export const supports = (type: string): boolean =>
  typeof PerformanceObserver !== 'undefined' &&
  Array.isArray(PerformanceObserver.supportedEntryTypes) &&
  PerformanceObserver.supportedEntryTypes.includes(type);

function observe(type: string, cb: (entries: PerformanceEntry[]) => void, extra: Record<string, unknown> = {}): boolean {
  if (!supports(type)) return false;
  try {
    const po = new PerformanceObserver((list) => cb(list.getEntries()));
    po.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
    return true;
  } catch {
    return false;
  }
}

/** First Contentful Paint (ms). */
export function watchFCP(cb: (ms: number) => void): boolean {
  return observe('paint', (es) => {
    for (const e of es) if (e.name === 'first-contentful-paint') cb(e.startTime);
  });
}

/** Largest Contentful Paint (ms) – mindig a legutolsó jelölt számít. */
export function watchLCP(cb: (ms: number) => void): boolean {
  return observe('largest-contentful-paint', (es) => {
    const last = es[es.length - 1];
    if (last) cb(last.startTime);
  });
}

interface LayoutShiftEntry extends PerformanceEntry { value: number; hadRecentInput: boolean; }

/** Cumulative Layout Shift – a web.dev szerinti munkamenet-ablakokkal (1 s szünet, max 5 s). */
export function watchCLS(cb: (cls: number) => void): boolean {
  let cls = 0, sess = 0, first = 0, last = 0;
  const ok = observe('layout-shift', (es) => {
    for (const raw of es) {
      const e = raw as LayoutShiftEntry;
      if (e.hadRecentInput) continue;
      if (sess && e.startTime - last < 1000 && e.startTime - first < 5000) {
        sess += e.value;
        last = e.startTime;
      } else {
        sess = e.value;
        first = last = e.startTime;
      }
      cls = Math.max(cls, sess);
    }
    cb(cls);
  });
  if (ok) cb(cls); // elmozdulás nélkül is van eredmény: 0
  return ok;
}

interface EventTimingEntry extends PerformanceEntry { interactionId?: number; }

/**
 * Interaction to Next Paint közelítés: interakciónként a leghosszabb eseményidő,
 * ebből 50 interakciónként egy kiugró értéket eldobunk (ahogy a web-vitals is).
 * A böngésző csak a 16 ms-nál hosszabb eseményeket jelenti.
 */
export function watchINP(cb: (ms: number, count: number) => void): boolean {
  const byId = new Map<number, number>();
  return observe('event', (es) => {
    let changed = false;
    for (const raw of es) {
      const e = raw as EventTimingEntry;
      const id = e.interactionId ?? 0;
      if (!id) continue;
      const prev = byId.get(id) ?? 0;
      if (e.duration > prev) { byId.set(id, e.duration); changed = true; }
    }
    if (!changed) return;
    const all = [...byId.values()].sort((a, b) => b - a);
    const skip = Math.min(all.length - 1, Math.floor(all.length / 50));
    cb(all[skip], all.length);
  }, { durationThreshold: 16 });
}

export interface NetSnapshot {
  transfer: number;      // átvitt bájt (fejlécekkel)
  decoded: number;       // kicsomagolt méret
  requests: number;      // kérések száma (az oldal + minden erőforrás)
  cached: number;        // gyorsítótárból (vagy csak fejléccel újraellenőrizve) jött
  thirdParty: number;
  thirdOrigins: string[];
  navType: string;
}

interface SizedEntry extends PerformanceEntry { transferSize: number; encodedBodySize: number; decodedBodySize: number; }

export function netSupported(): boolean {
  return typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function' &&
    performance.getEntriesByType('navigation').length > 0;
}

export function netSnapshot(): NetSnapshot {
  const nav = performance.getEntriesByType('navigation') as (SizedEntry & { type?: string })[];
  const res = performance.getEntriesByType('resource') as SizedEntry[];
  const all: SizedEntry[] = [...nav, ...res];
  const thirdOrigins = new Set<string>();
  let transfer = 0, decoded = 0, cached = 0, thirdParty = 0;
  for (const e of all) {
    transfer += e.transferSize || 0;
    decoded += e.decodedBodySize || 0;
    const fromCache = (e.transferSize === 0 && e.decodedBodySize > 0) ||
      (e.encodedBodySize > 0 && e.transferSize > 0 && e.transferSize < e.encodedBodySize);
    if (fromCache) cached++;
    let origin = '';
    try { const u = new URL(e.name, location.href); if (u.protocol.startsWith('http')) origin = u.origin; } catch { /* nem URL */ }
    if (origin && origin !== location.origin) { thirdParty++; thirdOrigins.add(origin); }
  }
  return { transfer, decoded, requests: all.length, cached, thirdParty, thirdOrigins: [...thirdOrigins], navType: nav[0]?.type ?? 'navigate' };
}

/** Erőforrás-figyelés: a később (görgetésre) betöltődő fájlok is beszámítanak. */
export function watchResources(cb: () => void): boolean {
  let t = 0;
  return observe('resource', () => {
    clearTimeout(t);
    t = window.setTimeout(cb, 120);
  });
}

export function cookieCount(): number {
  try {
    return document.cookie.split(';').map((s) => s.trim()).filter(Boolean).length;
  } catch {
    return 0;
  }
}
