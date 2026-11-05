// Nyitókép: „A folyam kirajzolja a nevet”.
// GPU-s részecskerendszer (GPUComputationRenderer, ping-pong pozíció/sebesség textúrák),
// curl-zajos áramlás, a részecskék a FOLYAM szóvá állnak össze, egér/ujj örvényt kavar,
// kattintásra lökéshullám, görgetésre a betűk lefelé folynak.
import * as THREE from 'three';
import { GPUComputationRenderer, type Variable } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { dprCap, hasWebGL2, isCoarse, pointer, reducedMotion } from '../lib/env';
import { visibleLoop, type Loop } from '../lib/loop';
import { FONT_FAMILY, WORD, place, sampleWord, textObstacles, type Placement } from './hero-flow/targets';
import { BLIT_FRAG, FADE_FRAG, POINTS_FRAG, POINTS_VERT, QUAD_VERT, SIM_POSITION, SIM_VELOCITY } from './hero-flow/shaders';
import '../styles/modules/hero-flow.css';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Statikus tartalék: SVG-szó kén peremmel és gőz kitöltéssel, a vászon helyén. */
function fallback(el: HTMLElement, canvas: HTMLCanvasElement | null): void {
  el.classList.add('nyito--statikus');
  if (canvas) canvas.hidden = true;
  if (el.querySelector('.nyito__tartalek')) return;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'nyito__tartalek');
  svg.setAttribute('viewBox', '0 0 600 140');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', '2');
  t.setAttribute('y', '128');
  t.setAttribute('textLength', '596');
  t.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  t.textContent = WORD;
  svg.append(t);
  el.prepend(svg);
}

async function fontReady(): Promise<void> {
  const load = document.fonts?.load?.(`800 200px ${FONT_FAMILY}`, WORD) ?? Promise.resolve();
  await Promise.race([load.catch(() => undefined), new Promise((r) => setTimeout(r, 3000))]);
}

export async function init(el: HTMLElement): Promise<void> {
  const canvas = el.querySelector<HTMLCanvasElement>('.nyito__vaszon');
  if (!canvas || !hasWebGL2()) { fallback(el, canvas); return; }

  await fontReady();

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch {
    fallback(el, canvas); return;
  }
  renderer.setClearColor(0x151819, 1);
  renderer.autoClear = false;

  const coarse = isCoarse();
  const SIDE = coarse ? 160 : 300; // 25 600 / 90 000 részecske
  const N = SIDE * SIDE;
  const LETTER_SHARE = coarse ? 0.8 : 0.78;
  const nLetter = Math.floor(N * LETTER_SHARE);

  const floatOK = renderer.extensions.has('EXT_color_buffer_float');
  const halfOK = floatOK || renderer.extensions.has('EXT_color_buffer_half_float');
  if (!halfOK) { renderer.dispose(); fallback(el, canvas); return; }

  // --- Állapot ---
  let W = 1, H = 1, aspect = 1;
  let simTime = 0;
  const textRect = new THREE.Vector4(0, 0, 0, 0);
  const ptr = new THREE.Vector2(99, 99), ptrPrev = new THREE.Vector2(99, 99), ptrVel = new THREE.Vector2();
  let ptrSeen = 0;

  // --- Célpontok és véletlenek (DataTexture) ---
  const targetData = new Float32Array(N * 4);
  const auxData = new Float32Array(N * 4);
  const tTarget = new THREE.DataTexture(targetData, SIDE, SIDE, THREE.RGBAFormat, THREE.FloatType);
  const tAux = new THREE.DataTexture(auxData, SIDE, SIDE, THREE.RGBAFormat, THREE.FloatType);
  for (const t of [tTarget, tAux]) { t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; }

  const toWorld = (px: number, py: number): [number, number] => [(px - W / 2) / (H / 2), 1 - (2 * py) / H];

  let placement: Placement | null = null;
  let letterDensity = 1;
  const river = new THREE.Vector4(0.1, 0.16, 1.4, 0.1);

  function layoutTargets(): void {
    const r = el.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); aspect = W / H;
    const gutter = parseFloat(getComputedStyle(el).paddingLeft) || 24;
    const head = document.querySelector('.fejlec')?.getBoundingClientRect();
    const topPad = Math.max(56, head ? head.bottom - r.top + 28 : 96);
    const obs = textObstacles(el);
    placement = place(W, H, obs, topPad, gutter);
    const s = sampleWord(placement, nLetter);
    letterDensity = s.count / Math.max(1, s.area);

    // Szövegblokk uv-ban (a kompozit itt visszafogja a fényt).
    if (obs.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const o of obs) { x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x + o.w); y1 = Math.max(y1, o.y + o.h); }
      textRect.set(x0 / W, 1 - y1 / H, x1 / W, 1 - y0 / H);
    }

    // A folyó középvonala a szó magassága és a bal alsó szöveg között fut.
    const [, wy] = toWorld(0, placement.y + placement.h * 0.5);
    river.set(wy * 0.55 - 0.05, coarse ? 0.1 : 0.16, coarse ? 2.2 : 1.4, coarse ? 0.05 : 0.12);

    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < s.count; i++) { minX = Math.min(minX, s.pts[i * 2]); maxX = Math.max(maxX, s.pts[i * 2]); }
    const spanX = Math.max(1, maxX - minX);
    const top = placement.y, spanY = Math.max(1, placement.h);
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      if (i < s.count) {
        const [x, y] = toWorld(s.pts[i * 2], s.pts[i * 2 + 1]);
        targetData[o] = x; targetData[o + 1] = y; targetData[o + 2] = s.edge[i]; targetData[o + 3] = 1;
        const nx = (s.pts[i * 2] - minX) / spanX; // 0 bal .. 1 jobb
        const ny = (s.pts[i * 2 + 1] - top) / spanY; // 0 fent .. 1 lent
        auxData[o + 2] = 0.04 + 0.34 * (1 - ny) + 0.1 * Math.random(); // alul olvad először
        auxData[o + 3] = 0.15 + 1.15 * nx + 0.3 * Math.random(); // balról jobbra áll össze
      } else {
        targetData[o] = 0; targetData[o + 1] = 0; targetData[o + 2] = 0; targetData[o + 3] = 0;
        auxData[o + 2] = 2; auxData[o + 3] = 0;
      }
    }
    tTarget.needsUpdate = true;
    tAux.needsUpdate = true;
  }

  for (let i = 0; i < N; i++) { auxData[i * 4] = Math.random(); auxData[i * 4 + 1] = Math.random(); }

  // --- GPGPU ---
  const gpu = new GPUComputationRenderer(SIDE, SIDE, renderer);
  gpu.setDataType(floatOK ? THREE.FloatType : THREE.HalfFloatType);
  const pos0 = gpu.createTexture();
  const vel0 = gpu.createTexture();
  const velVar: Variable = gpu.addVariable('textureVelocity', SIM_VELOCITY, vel0);
  const posVar: Variable = gpu.addVariable('texturePosition', SIM_POSITION, pos0);
  gpu.setVariableDependencies(velVar, [posVar, velVar]);
  gpu.setVariableDependencies(posVar, [posVar, velVar]);
  const vu = velVar.material.uniforms;
  Object.assign(vu, {
    uTime: { value: 0 }, uDt: { value: 0 }, uScroll: { value: 0 }, uK: { value: 46 }, uC: { value: 11 },
    uPtr: { value: ptr }, uPtrVel: { value: ptrVel }, uPtrR: { value: coarse ? 0.22 : 0.17 },
    uShock: { value: new THREE.Vector4(0, 0, -99, 0) }, uJitter: { value: coarse ? 0.006 : 0.0045 },
    tTarget: { value: tTarget }, tAux: { value: tAux }, uRiver: { value: river },
  });
  const pu = posVar.material.uniforms;
  Object.assign(pu, { uTime: { value: 0 }, uDt: { value: 0 }, uAspect: { value: 1 }, tTarget: { value: tTarget }, tAux: { value: tAux }, uRiver: { value: river } });

  /** Kezdőállapot: szétszórt folyó (mozgásnál) vagy a kész szó (csökkentett mozgásnál). */
  function fillInitial(formed: boolean): void {
    const p = pos0.image.data as Float32Array, v = vel0.image.data as Float32Array;
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      const letter = targetData[o + 3] > 0.5;
      if (formed && letter) {
        p[o] = targetData[o]; p[o + 1] = targetData[o + 1];
        v[o] = 0; v[o + 1] = 0;
      } else {
        const ax = auxData[o], ay = auxData[o + 1];
        const x = letter ? targetData[o] - 0.2 - Math.random() * (aspect * 1.4 + 0.5) : (Math.random() * 2 - 1) * (aspect + 0.12);
        const ry = river.x + river.w * x + river.y * Math.sin(x * river.z);
        p[o] = x;
        p[o + 1] = ry + (ax - 0.5) * 0.55 + (Math.random() - 0.5) * (letter ? 0.5 : 0.25);
        v[o] = 0.3 + 0.26 * ay; v[o + 1] = 0;
      }
      p[o + 2] = 0; p[o + 3] = 1; v[o + 2] = 0; v[o + 3] = 1;
    }
    pos0.needsUpdate = true; vel0.needsUpdate = true;
  }

  // --- Megjelenítés ---
  const cam = new THREE.Camera();
  const refs = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { refs[i * 2] = ((i % SIDE) + 0.5) / SIDE; refs[i * 2 + 1] = (Math.floor(i / SIDE) + 0.5) / SIDE; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('ref', new THREE.BufferAttribute(refs, 2));
  const pointsMat = new THREE.ShaderMaterial({
    vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG,
    uniforms: { tPos: { value: null }, tVel: { value: null }, tTarget: { value: tTarget }, tAux: { value: tAux }, uAspect: { value: 1 }, uPx: { value: 2 }, uPxStream: { value: 1.6 }, uAlpha: { value: 0.1 }, uGain: { value: 1 }, uTime: { value: 0 } },
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    depthTest: false, depthWrite: false, transparent: true,
  });
  const points = new THREE.Points(geo, pointsMat);
  points.frustumCulled = false;
  const pointsScene = new THREE.Scene(); pointsScene.add(points);

  const quad = new THREE.PlaneGeometry(2, 2);
  const fadeMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: FADE_FRAG, uniforms: { uDecay: { value: 0.85 } },
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcAlphaFactor,
    depthTest: false, depthWrite: false, transparent: true,
  });
  const fadeMesh = new THREE.Mesh(quad, fadeMat); fadeMesh.frustumCulled = false;
  const fadeScene = new THREE.Scene(); fadeScene.add(fadeMesh);

  const trail = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const blitMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: BLIT_FRAG,
    uniforms: { tTrail: { value: trail.texture }, uTextRect: { value: textRect }, uAspect: { value: 1 }, uTexel: { value: new THREE.Vector2(1, 1) } },
    depthTest: false, depthWrite: false,
  });
  const blitMesh = new THREE.Mesh(quad, blitMat); blitMesh.frustumCulled = false;
  const blitScene = new THREE.Scene(); blitScene.add(blitMesh);

  function resize(): void {
    const r = el.getBoundingClientRect();
    const dpr = dprCap();
    renderer.setPixelRatio(dpr);
    renderer.setSize(r.width, r.height, false);
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    trail.setSize(buf.x, buf.y);
    (blitMat.uniforms.uTexel.value as THREE.Vector2).set(dpr / buf.x, dpr / buf.y);
    layoutTargets();
    pu.uAspect.value = aspect;
    pointsMat.uniforms.uAspect.value = aspect;
    blitMat.uniforms.uAspect.value = aspect;
    // Pontméret eszközpixelben: ~16 átfedés pixelenként, hogy a betű belseje sima gőz legyen, ne szemcsés zaj.
    const rho = letterDensity / (dpr * dpr);
    const S = Math.min(9, Math.max(1.6 * dpr, Math.sqrt(16 / (0.6 * rho))));
    pointsMat.uniforms.uPx.value = S;
    pointsMat.uniforms.uAlpha.value = Math.min(0.6, 1.4 / (rho * 0.6 * S * S));
    pointsMat.uniforms.uPxStream.value = dpr * (coarse ? 1.9 : 1.6);
    renderer.setRenderTarget(trail); renderer.clear(); renderer.setRenderTarget(null);
  }

  resize();
  fillInitial(reducedMotion());
  const err = gpu.init();
  if (err) { console.warn('[hero-flow]', err); renderer.dispose(); fallback(el, canvas); return; }

  // --- Bemenet ---
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const r = canvas.getBoundingClientRect();
    const [x, y] = [(e.clientX - r.left - r.width / 2) / (r.height / 2), 1 - (2 * (e.clientY - r.top)) / r.height];
    (vu.uShock.value as THREE.Vector4).set(x, y, simTime, 1);
  };
  el.addEventListener('pointerdown', onDown, { passive: true });

  function updatePointer(dt: number): void {
    const r = canvas!.getBoundingClientRect();
    const fresh = performance.now() - pointer.t < 1200;
    const inside = fresh && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    if (!inside) { ptr.set(99, 99); ptrVel.multiplyScalar(0.9); ptrSeen = 0; return; }
    const x = (pointer.x - r.left - r.width / 2) / (r.height / 2), y = 1 - (2 * (pointer.y - r.top)) / r.height;
    if (!ptrSeen) ptrPrev.set(x, y);
    ptrSeen = 1;
    ptr.set(x, y);
    if (dt > 0) {
      const ix = (x - ptrPrev.x) / dt, iy = (y - ptrPrev.y) / dt;
      ptrVel.x += (ix - ptrVel.x) * 0.35; ptrVel.y += (iy - ptrVel.y) * 0.35;
    }
    ptrPrev.set(x, y);
  }

  function scrollRatio(): number {
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
  }

  function draw(gain: number, decay: number): void {
    pointsMat.uniforms.tPos.value = gpu.getCurrentRenderTarget(posVar).texture;
    pointsMat.uniforms.tVel.value = gpu.getCurrentRenderTarget(velVar).texture;
    pointsMat.uniforms.uGain.value = gain;
    fadeMat.uniforms.uDecay.value = decay;
    renderer.setRenderTarget(trail);
    if (decay <= 0) renderer.clear(); else renderer.render(fadeScene, cam);
    renderer.render(pointsScene, cam);
    renderer.setRenderTarget(null);
    renderer.render(blitScene, cam);
  }

  let lost = false;
  const frame = (_t: number, dt: number) => {
    if (lost) return;
    if (reducedMotion() || dt === 0) {
      // Egyetlen állókép: a kész szó, utánhúzás nélkül.
      draw(1.0, 0);
      return;
    }
    // Teszthorog: a szimuláció ideje olvasható, és megállítható egy képkocka rögzítéséhez.
    const hook = el as HTMLElement & { __folyamIdo?: number; __folyamAllj?: boolean };
    if (hook.__folyamAllj) return;
    simTime += dt;
    hook.__folyamIdo = simTime;
    updatePointer(dt);
    ptrVel.multiplyScalar(Math.pow(0.04, dt)); // elengedve gyorsan lecseng
    const s = scrollRatio();
    vu.uTime.value = simTime; vu.uDt.value = dt; vu.uScroll.value = s;
    pu.uTime.value = simTime; pu.uDt.value = dt;
    pointsMat.uniforms.uTime.value = simTime;
    gpu.compute();
    const decay = Math.pow(0.8, dt * 60);
    draw(1 - decay, decay);
  };

  const loop: Loop = visibleLoop(el, frame);
  loop.start();

  // --- Átméretezés ---
  let rt = 0, lastW = W, lastH = H;
  const ro = new ResizeObserver(() => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      // Telefonon a címsor ki-be csúszása miatti apró magasságváltozást figyelmen kívül hagyjuk.
      if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 90) return;
      lastW = r.width; lastH = r.height;
      resize();
      if (reducedMotion()) { fillInitial(true); gpu.renderTexture(pos0, posVar.renderTargets[0]); gpu.renderTexture(pos0, posVar.renderTargets[1]); }
      loop.renderOnce();
    }, 150);
  });
  ro.observe(el);

  // Csökkentett mozgásra váltáskor a kész szó álljon elő.
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (!e.matches) return;
    fillInitial(true);
    for (const v of [posVar, velVar]) for (const t of v.renderTargets) gpu.renderTexture(v === posVar ? pos0 : vel0, t);
    loop.renderOnce();
  });

  // --- Elveszett WebGL-kontextus ---
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; loop.stop(); });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    simTime = 0;
    fillInitial(reducedMotion());
    for (const v of [posVar, velVar]) for (const t of v.renderTargets) gpu.renderTexture(v === posVar ? pos0 : vel0, t);
    tTarget.needsUpdate = true; tAux.needsUpdate = true;
    loop.start();
    loop.renderOnce();
  });
}
