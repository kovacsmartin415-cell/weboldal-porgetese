// A konfigban megadott fotók feloldása az src/assets mappából.
// Az Astro ezeket optimalizálja (webp, több szélesség), és a build megáll,
// ha egy hivatkozott fájl hiányzik.
import type { ImageMetadata } from 'astro';

const osszes = import.meta.glob<{ default: ImageMetadata }>('/src/assets/**/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

export function kep(fajl: string): ImageMetadata {
  const kulcs = `/src/assets/${fajl.replace(/^\/+/, '').replace(/^src\/assets\//, '')}`;
  const talalat = osszes[kulcs];
  if (!talalat) {
    const elerheto = Object.keys(osszes)
      .map((k) => k.replace('/src/assets/', ''))
      .join(', ');
    throw new Error(
      `A konfigban szereplő fotó nincs meg: src/assets/${fajl}\nElérhető fotók: ${elerheto || '(egy sincs)'}`,
    );
  }
  return talalat.default;
}
