// „Furnasi gőz”: egyszerűsített stable fluids (Stam) nyers WebGL2-ben.
// Lépések: advekció, felhajtóerő, örvényerősség-megőrzés, divergencia,
// nyomás (Jacobi, 20 iteráció), gradiens kivonása, festék advekciója.
// A sebességrács ~¼, a festék (gőz + kén) ~½ CSS-felbontású.
import { dprCap, isCoarse, reducedMotion } from '../../lib/env';
import { visibleLoop, type Loop } from '../../lib/loop';

export interface Steam {
  /** Gőzpöffenet a szekcióhoz (canvashoz) viszonyított CSS-pixelben. */
  puff(x: number, y: number, strength?: number): void;
  destroy(): void;
}

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
`;

const FS = {
  advect: HEAD + `
uniform sampler2D uVel; uniform sampler2D uSrc;
uniform vec2 uVelT; uniform float uDt; uniform vec4 uDiss; uniform vec4 uTop;
void main() {
  vec2 c = vUv - uDt * texture(uVel, vUv).xy * uVelT;
  // felfelé haladva a gőz „lecsapódik”: gyorsabban oszlik, így marad hely a sötétnek
  vec4 diss = uDiss + uTop * smoothstep(0.35, 1.0, vUv.y);
  o = texture(uSrc, c) / (1.0 + diss * uDt);
}`,
  buoy: HEAD + `
uniform sampler2D uVel; uniform sampler2D uDye;
uniform float uDt; uniform float uBuoy; uniform float uTime; uniform float uWind;
void main() {
  vec2 v = texture(uVel, vUv).xy;
  float d = texture(uDye, vUv).r;
  v.y += uDt * uBuoy * d;
  // enyhe, lassan vándorló oldalszél: a csóvák ne legyenek egyenesek
  float w = sin(vUv.y * 5.1 + uTime * 0.23) + 0.6 * sin(vUv.y * 11.3 - uTime * 0.41 + vUv.x * 3.0);
  v.x += uDt * uWind * w * d;
  o = vec4(v, 0.0, 1.0);
}`,
  curl: HEAD + `
uniform sampler2D uVel; uniform vec2 uT;
void main() {
  float L = texture(uVel, vUv - vec2(uT.x, 0.0)).y;
  float R = texture(uVel, vUv + vec2(uT.x, 0.0)).y;
  float B = texture(uVel, vUv - vec2(0.0, uT.y)).x;
  float T = texture(uVel, vUv + vec2(0.0, uT.y)).x;
  o = vec4(0.5 * ((R - L) - (T - B)), 0.0, 0.0, 1.0);
}`,
  vort: HEAD + `
uniform sampler2D uVel; uniform sampler2D uCurl; uniform vec2 uT;
uniform float uCurlK; uniform float uDt;
void main() {
  float L = texture(uCurl, vUv - vec2(uT.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uT.x, 0.0)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uT.y)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uT.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= uCurlK * C;
  f.y *= -1.0;
  vec2 v = texture(uVel, vUv).xy + f * uDt;
  o = vec4(clamp(v, -900.0, 900.0), 0.0, 1.0);
}`,
  div: HEAD + `
uniform sampler2D uVel; uniform vec2 uT;
void main() {
  vec2 C = texture(uVel, vUv).xy;
  float L = texture(uVel, vUv - vec2(uT.x, 0.0)).x;
  float R = texture(uVel, vUv + vec2(uT.x, 0.0)).x;
  float B = texture(uVel, vUv - vec2(0.0, uT.y)).y;
  float T = texture(uVel, vUv + vec2(0.0, uT.y)).y;
  if (vUv.x - uT.x < 0.0) L = -C.x;
  if (vUv.x + uT.x > 1.0) R = -C.x;
  if (vUv.y - uT.y < 0.0) B = -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
  pressure: HEAD + `
uniform sampler2D uP; uniform sampler2D uDiv; uniform vec2 uT;
void main() {
  float L = texture(uP, vUv - vec2(uT.x, 0.0)).x;
  float R = texture(uP, vUv + vec2(uT.x, 0.0)).x;
  float B = texture(uP, vUv - vec2(0.0, uT.y)).x;
  float T = texture(uP, vUv + vec2(0.0, uT.y)).x;
  if (vUv.y + uT.y > 1.0) T = 0.0; // nyitott teteje: ott elszáll a gőz
  float d = texture(uDiv, vUv).x;
  o = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
}`,
  grad: HEAD + `
uniform sampler2D uP; uniform sampler2D uVel; uniform vec2 uT;
void main() {
  float L = texture(uP, vUv - vec2(uT.x, 0.0)).x;
  float R = texture(uP, vUv + vec2(uT.x, 0.0)).x;
  float B = texture(uP, vUv - vec2(0.0, uT.y)).x;
  float T = texture(uP, vUv + vec2(0.0, uT.y)).x;
  if (vUv.y + uT.y > 1.0) T = 0.0;
  vec2 v = texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B);
  o = vec4(v, 0.0, 1.0);
}`,
  scale: HEAD + `
uniform sampler2D uSrc; uniform float uK;
void main() { o = uK * texture(uSrc, vUv); }`,
  splat: HEAD + `
uniform vec2 uPt; uniform vec2 uCss; uniform float uR; uniform vec4 uVal;
void main() {
  vec2 d = (vUv - uPt) * uCss;
  float g = exp(-dot(d, d) / (uR * uR));
  o = uVal * g; // összeadó keveréssel kerül a mezőbe
}`,
  display: HEAD + `
uniform sampler2D uDye; uniform float uMaxA; uniform float uBottom; uniform float uBottomA;
const vec3 STEAM = vec3(0.925, 0.918, 0.890);
const vec3 SULF = vec3(0.851, 0.698, 0.122);
void main() {
  vec2 d = max(texture(uDye, vUv).rg, 0.0);
  float dens = d.r;
  float k = 1.0 - exp(-dens * 1.6);
  // a szekció alján (a szöveg alatt nincs semmi) a fumarolák sűrűbbek lehetnek
  float cap = mix(uMaxA, uBottomA, 1.0 - smoothstep(0.0, uBottom, vUv.y));
  float a = k * cap;
  float s = clamp(d.g / max(dens, 1e-3), 0.0, 1.0) * smoothstep(0.25, 1.1, dens);
  vec3 col = mix(STEAM, SULF, s * 0.6);
  // finom zaj a sávosodás ellen
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  a = clamp(a + n * 0.006, 0.0, 1.0);
  o = vec4(col * a, a);
}`,
};

type ProgName = keyof typeof FS;
interface Prog { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null>; }
interface FBO { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number; }
interface Double { read: FBO; write: FBO; w: number; h: number; swap(): void; }

interface Splat { x: number; y: number; vx: number; vy: number; dye: number; sulf: number; r: number; }

export function createSteam(canvas: HTMLCanvasElement, section: HTMLElement): Steam | null {
  const reduced = reducedMotion();
  const coarse = isCoarse();
  const glOrNull = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!glOrNull) return null;
  const gl: WebGL2RenderingContext = glOrNull;

  let progs = {} as Record<ProgName, Prog>;
  let vao: WebGLVertexArrayObject | null = null;
  let vel!: Double, dye!: Double, pres!: Double;
  let divF!: FBO, curlF!: FBO;
  let cssW = 1, cssH = 1;
  let ready = false, lost = false, warmed = false, time = 0;
  const pending: Splat[] = [];

  const P = {
    velDiss: 0.2,
    dyeDiss: 0.1,
    topFade: 0.5,
    sulfDiss: 0.75,
    curl: 16,
    pressureDecay: 0.8,
    iters: 20,
    buoy: 110,
    wind: 18,
    maxA: 0.2,      // a szöveg mögött legfeljebb ~20% fedés
    bottomA: 0.42,  // a legalsó sávban, ahol nincs szöveg
  };

  function compile(type: number, src: string): WebGLShader {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      throw new Error('[goz] shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function build(): boolean {
    const ext = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    if (!ext) return false;
    gl.getExtension('OES_texture_float_linear');
    const vs = compile(gl.VERTEX_SHADER, VERT);
    progs = {} as Record<ProgName, Prog>;
    for (const name of Object.keys(FS) as ProgName[]) {
      const p = gl.createProgram()!;
      gl.attachShader(p, vs);
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FS[name]));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('[goz] link: ' + gl.getProgramInfoLog(p));
      const u: Record<string, WebGLUniformLocation | null> = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i)!;
        u[info.name] = gl.getUniformLocation(p, info.name);
      }
      progs[name] = { p, u };
    }
    vao = gl.createVertexArray();
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    return true;
  }

  function fbo(w: number, h: number, internal: number, format: number): FBO {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h };
  }
  function dbl(w: number, h: number, internal: number, format: number): Double {
    const d: Double = {
      read: fbo(w, h, internal, format), write: fbo(w, h, internal, format), w, h,
      swap() { const t = d.read; d.read = d.write; d.write = t; },
    };
    return d;
  }
  function free(f?: FBO) { if (f) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fb); } }
  function freeAll() {
    for (const d of [vel, dye, pres]) if (d) { free(d.read); free(d.write); }
    free(divF); free(curlF);
  }

  function gridSize(scale: number, cap: number): [number, number] {
    let w = cssW * scale, h = cssH * scale;
    const m = Math.max(w, h);
    if (m > cap) { w *= cap / m; h *= cap / m; }
    return [Math.max(8, Math.round(w)), Math.max(8, Math.round(h))];
  }

  function allocate() {
    const r = canvas.getBoundingClientRect();
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    const bs = Math.min(1, dprCap() * 0.5);
    canvas.width = Math.max(1, Math.round(cssW * bs));
    canvas.height = Math.max(1, Math.round(cssH * bs));
    freeAll();
    const [vw, vh] = gridSize(0.25, coarse ? 128 : 200);
    const [dw, dh] = gridSize(0.5, coarse ? 360 : 512);
    vel = dbl(vw, vh, gl.RG16F, gl.RG);
    dye = dbl(dw, dh, gl.RG16F, gl.RG);
    pres = dbl(vw, vh, gl.R16F, gl.RED);
    divF = fbo(vw, vh, gl.R16F, gl.RED);
    curlF = fbo(vw, vh, gl.R16F, gl.RED);
    gl.bindFramebuffer(gl.FRAMEBUFFER, vel.read.fb);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('[goz] framebuffer');
    warmed = false; warmLeft = 0; cancelAnimationFrame(stillRaf); stillRaf = 0;
  }

  // --- rajzolási segédek ---
  let unit = 0;
  function use(name: ProgName): Prog { const pr = progs[name]; gl.useProgram(pr.p); unit = 0; return pr; }
  function tex(pr: Prog, name: string, f: FBO) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, f.tex);
    gl.uniform1i(pr.u[name], unit++);
  }
  function draw(target: FBO | null) {
    if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, target.w, target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const velScale = () => vel.w / cssW; // rácscella / CSS-pixel

  // Gauss-folt összeadó keveréssel, csak a folt körüli téglalapban (scissor).
  function splatInto(f: FBO, s: Splat, r: number, val: [number, number]) {
    const pr = use('splat');
    gl.uniform2f(pr.u.uPt, s.x / cssW, 1 - s.y / cssH);
    gl.uniform2f(pr.u.uCss, cssW, cssH);
    gl.uniform1f(pr.u.uR, r);
    gl.uniform4f(pr.u.uVal, val[0], val[1], 0, 0);
    const k = f.w / cssW, ext = r * 3;
    const x0 = Math.max(0, Math.floor((s.x - ext) * k)), x1 = Math.min(f.w, Math.ceil((s.x + ext) * k));
    const y0 = Math.max(0, Math.floor((cssH - s.y - ext) * k)), y1 = Math.min(f.h, Math.ceil((cssH - s.y + ext) * k));
    if (x1 <= x0 || y1 <= y0) return;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x0, y0, x1 - x0, y1 - y0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    draw(f);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
  }
  function splat(s: Splat) {
    splatInto(vel.read, s, s.r, [s.vx, s.vy]);
    splatInto(dye.read, s, s.r * 0.9, [s.dye, s.sulf]);
  }

  // Fumarolák: 2–3 forrás a szekció alján, lüktető erősséggel.
  const vents = () => (cssW < 700 ? [0.22, 0.78] : [0.12, 0.5, 0.88]);
  function emitVents(dt: number) {
    const vs = velScale();
    vents().forEach((fx, i) => {
      const t = time * (0.37 + i * 0.11) + i * 2.3;
      const puls = 0.55 + 0.3 * Math.sin(t) + 0.15 * Math.sin(t * 2.7 + 1.1);
      const sway = Math.sin(time * 0.19 + i) * 0.012;
      splat({
        x: (fx + sway) * cssW, y: cssH - 10,
        vx: Math.sin(time * 0.6 + i * 1.7) * 8 * vs * dt * 60,
        vy: (140 * vs) * dt * puls,
        dye: 4.2 * dt * puls, sulf: 2.8 * dt * puls,
        r: cssW < 700 ? 26 : 34,
      });
    });
  }

  function step(dt: number) {
    time += dt;
    emitVents(dt);
    while (pending.length) splat(pending.shift()!);

    const vT: [number, number] = [1 / vel.w, 1 / vel.h];

    let pr = use('buoy');
    tex(pr, 'uVel', vel.read); tex(pr, 'uDye', dye.read);
    gl.uniform1f(pr.u.uDt, dt); gl.uniform1f(pr.u.uBuoy, P.buoy * velScale() * 4);
    gl.uniform1f(pr.u.uTime, time); gl.uniform1f(pr.u.uWind, P.wind * velScale() * 4);
    draw(vel.write); vel.swap();

    pr = use('curl');
    tex(pr, 'uVel', vel.read); gl.uniform2f(pr.u.uT, ...vT);
    draw(curlF);

    pr = use('vort');
    tex(pr, 'uVel', vel.read); tex(pr, 'uCurl', curlF);
    gl.uniform2f(pr.u.uT, ...vT); gl.uniform1f(pr.u.uCurlK, P.curl); gl.uniform1f(pr.u.uDt, dt);
    draw(vel.write); vel.swap();

    pr = use('div');
    tex(pr, 'uVel', vel.read); gl.uniform2f(pr.u.uT, ...vT);
    draw(divF);

    pr = use('scale');
    tex(pr, 'uSrc', pres.read); gl.uniform1f(pr.u.uK, P.pressureDecay);
    draw(pres.write); pres.swap();

    for (let i = 0; i < P.iters; i++) {
      pr = use('pressure');
      tex(pr, 'uP', pres.read); tex(pr, 'uDiv', divF); gl.uniform2f(pr.u.uT, ...vT);
      draw(pres.write); pres.swap();
    }

    pr = use('grad');
    tex(pr, 'uP', pres.read); tex(pr, 'uVel', vel.read); gl.uniform2f(pr.u.uT, ...vT);
    draw(vel.write); vel.swap();

    pr = use('advect');
    tex(pr, 'uVel', vel.read); tex(pr, 'uSrc', vel.read);
    gl.uniform2f(pr.u.uVelT, ...vT); gl.uniform1f(pr.u.uDt, dt);
    gl.uniform4f(pr.u.uDiss, P.velDiss, P.velDiss, 0, 0);
    gl.uniform4f(pr.u.uTop, 0, 0, 0, 0);
    draw(vel.write); vel.swap();

    pr = use('advect');
    tex(pr, 'uVel', vel.read); tex(pr, 'uSrc', dye.read);
    gl.uniform2f(pr.u.uVelT, ...vT); gl.uniform1f(pr.u.uDt, dt);
    gl.uniform4f(pr.u.uDiss, P.dyeDiss, P.sulfDiss, 0, 0);
    gl.uniform4f(pr.u.uTop, P.topFade, P.topFade, 0, 0);
    draw(dye.write); dye.swap();
  }

  function display(dim = 1) {
    const pr = use('display');
    tex(pr, 'uDye', dye.read);
    gl.uniform1f(pr.u.uMaxA, P.maxA * dim);
    gl.uniform1f(pr.u.uBottomA, P.bottomA * dim);
    gl.uniform1f(pr.u.uBottom, Math.min(0.5, 70 / cssH));
    draw(null);
  }

  // Előmelegítés: hogy a gőz már ott legyen, mire a szekció a képbe ér.
  // Animált módban képkockánként 8 lépésben, hogy ne akadjon; állóképnél egyben.
  let warmLeft = 0, stillRaf = 0;
  function warm(n: number, dt = 1 / 30) {
    const k = Math.min(n, warmLeft);
    for (let i = 0; i < k; i++) step(dt);
    warmLeft -= k;
    if (warmLeft <= 0) warmed = true;
  }

  // Gyenge gépen (a valódi képkocka-idő alapján) kevesebb nyomás-iterációval fut.
  let avg = 1 / 60, seen = 0;
  function govern(dt: number) {
    avg = avg * 0.95 + dt * 0.05;
    if (++seen < 90) return;
    if (avg > 1 / 30 && P.iters > 8) { P.iters -= 4; seen = 0; }
  }

  function frame(_t: number, dt: number) {
    if (!ready || lost) return;
    if (!warmed) {
      if (reducedMotion() || dt === 0) {
        // állókép: a csóvát több képkockára elosztva számoljuk ki, és csak a végén rajzoljuk ki egyszer
        if (stillRaf) return;
        if (warmLeft <= 0) warmLeft = 110;
        const chunk = () => {
          stillRaf = 0;
          if (!ready || lost) return;
          warm(12, 1 / 15);
          if (warmed) display(reducedMotion() ? 0.8 : 1);
          else stillRaf = requestAnimationFrame(chunk);
        };
        stillRaf = requestAnimationFrame(chunk);
        return;
      }
      if (warmLeft <= 0) warmLeft = 150;
      warm(8);
      return display(1);
    }
    if (dt > 0) { govern(dt); step(Math.min(dt, 1 / 30)); }
    display(reducedMotion() ? 0.8 : 1);
  }

  // --- beállítás ---
  try {
    if (!build()) return null;
    allocate();
    ready = true;
  } catch (err) {
    console.warn(err);
    return null;
  }

  const loop: Loop = visibleLoop(section, frame);
  loop.start();

  let roTimer = 0;
  let lastW = cssW, lastH = cssH;
  const ro = new ResizeObserver(() => {
    clearTimeout(roTimer);
    roTimer = window.setTimeout(() => {
      if (lost) return;
      const r = canvas.getBoundingClientRect();
      if (Math.abs(r.width - lastW) < 2 && Math.abs(r.height - lastH) < 2) return;
      lastW = r.width; lastH = r.height;
      allocate();
      if (reducedMotion()) loop.renderOnce();
    }, 150);
  });
  ro.observe(canvas);

  const onLost = (e: Event) => { e.preventDefault(); lost = true; ready = false; loop.stop(); };
  const onRestored = () => {
    lost = false;
    try { if (build()) { allocate(); ready = true; loop.start(); if (reducedMotion()) loop.renderOnce(); } }
    catch (err) { console.warn(err); }
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // Egér / ujj: sebességet ír a mezőbe, a gyorsabb mozgás több gőzt kelt.
  let px = NaN, py = NaN, pt = 0;
  const onMove = (e: PointerEvent) => {
    if (reducedMotion() || !ready) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const now = e.timeStamp || performance.now();
    if (!Number.isNaN(px) && now - pt < 120) {
      const dtm = Math.max(8, now - pt) / 1000;
      const dx = (x - px) / dtm, dy = (y - py) / dtm; // CSS px / s
      const sp = Math.hypot(dx, dy);
      if (sp > 30) {
        const vs = velScale();
        const k = Math.min(1, 1600 / sp); // nagyon gyors rántásnál se robbanjon
        pending.push({
          x, y, vx: dx * vs * 0.55 * k, vy: -dy * vs * 0.55 * k,
          dye: Math.min(0.55, sp / 2600), sulf: 0, r: coarse ? 30 : 38,
        });
        if (pending.length > 24) pending.splice(0, pending.length - 24);
      }
    }
    px = x; py = y; pt = now;
  };
  section.addEventListener('pointermove', onMove, { passive: true });

  return {
    puff(x, y, strength = 1) {
      if (!ready || reducedMotion()) return;
      const vs = velScale();
      pending.push({
        x, y, vx: (Math.random() - 0.5) * 50 * vs, vy: (90 + Math.random() * 60) * vs * strength,
        dye: 0.32 * strength, sulf: 0.02, r: 14 + Math.random() * 6,
      });
    },
    destroy() {
      loop.destroy(); ro.disconnect();
      section.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    },
  };
}
