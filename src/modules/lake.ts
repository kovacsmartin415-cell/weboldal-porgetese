// Lábléc: Sete Cidades ikertavai. Két összeérő krátertó (kék és zöld) felülnézetből,
// valódi hullámegyenlettel (WebGL2, half-float ping-pong), fénytöréssel a „Folyam” logón.
import '../styles/modules/lake.css';
import { dprCap, hasWebGL2, reducedMotion } from '../lib/env';
import { visibleLoop, type Loop } from '../lib/loop';
import { VERT, SIM, DROP, VIEW } from './lake/shaders';

const SIM_SCALE = 4;   // a szimuláció ¼ felbontásban fut (CSS-pixelhez képest)
const STEP_HZ = 120;   // rögzített szimulációs lépés

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
type Drop = { ax: number; ay: number; bx: number; by: number; r: number; s: number };

const TAVAK_MONDAT = 'Sete Cidadesben két tó ér össze egy híd alatt, egyik kék, másik zöld – mint mi ketten, Martin és Zekő.';

export function init(el: HTMLElement): void {
  const canvas = el.querySelector<HTMLCanvasElement>('[data-lake]');
  const logo = el.querySelector<HTMLElement>('.lab__logo');
  addCaption(el);
  if (!canvas || !logo || !hasWebGL2()) return; // marad a CSS-es két színfolt

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  let W = 0, H = 0, dpr = 1, sw = 0, sh = 0, bridgeY = 0;
  let progs: { sim: Prog; drop: Prog; view: Prog } | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let tex: WebGLTexture[] = [], fbo: WebGLFramebuffer[] = [];
  let logoTex: WebGLTexture | null = null;
  let cur = 0, acc = 0, time = 0, nextRain = 3 + Math.random() * 5;
  let internalFmt: number = gl.RGBA16F, texType: number = gl.HALF_FLOAT;
  let ok = false;
  const drops: Drop[] = [];
  const logoCanvas = document.createElement('canvas');

  // ---------- GL segédek ----------
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const program = (fs: string, names: string[]): Prog => {
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p) || 'link');
    const u: Prog['u'] = {};
    for (const n of names) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  };

  const pickFormat = (): boolean => {
    // half-float render target: EXT_color_buffer_float (WebGL2) vagy EXT_color_buffer_half_float
    if (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')) {
      internalFmt = gl.RGBA16F; texType = gl.HALF_FLOAT;
      return true;
    }
    return false;
  };

  const makeTargets = () => {
    for (const t of tex) gl.deleteTexture(t);
    for (const f of fbo) gl.deleteFramebuffer(f);
    tex = []; fbo = [];
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFmt, sw, sh, 0, gl.RGBA, texType, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      tex.push(t); fbo.push(f);
    }
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return complete;
  };

  // A „Folyam” felirat offscreen példánya pontosan a DOM-szöveg helyén.
  const drawLogo = () => {
    if (!logoTex) return;
    const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
    logoCanvas.width = cw; logoCanvas.height = ch;
    const c = logoCanvas.getContext('2d')!;
    c.fillStyle = '#000';
    c.fillRect(0, 0, cw, ch);
    const cs = getComputedStyle(logo);
    const fr = el.getBoundingClientRect(), lr = logo.getBoundingClientRect();
    const size = parseFloat(cs.fontSize);
    c.scale(dpr, dpr);
    c.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    const ls = parseFloat(cs.letterSpacing);
    if ('letterSpacing' in c && !Number.isNaN(ls)) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ls}px`;
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#fff';
    const m = c.measureText(logo.textContent || 'Folyam');
    const asc = m.fontBoundingBoxAscent ?? size * 0.95, desc = m.fontBoundingBoxDescent ?? size * 0.25;
    const lh = parseFloat(cs.lineHeight) || size * 0.85;
    const base = lr.top - fr.top + (lh - (asc + desc)) / 2 + asc;
    c.fillText(logo.textContent || 'Folyam', lr.left - fr.left + parseFloat(cs.paddingLeft || '0'), base);
    gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, logoCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  };

  const setup = (): boolean => {
    if (!pickFormat()) return false;
    progs = {
      sim: program(SIM, ['uState', 'uTexel', 'uSize', 'uBridgeY']),
      drop: program(DROP, ['uState', 'uSize', 'uA', 'uB', 'uRadius', 'uStrength', 'uBridgeY']),
      view: program(VIEW, ['uState', 'uLogo', 'uTexel', 'uSize', 'uTime', 'uBridgeY']),
    };
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    logoTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    sw = 0; sh = 0;
    return resize(true);
  };

  const resize = (force = false): boolean => {
    const w = el.clientWidth, h = el.clientHeight;
    const d = dprCap();
    if (!force && w === W && h === H && d === dpr) return ok;
    W = w; H = h; dpr = d;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    const nsw = Math.max(8, Math.ceil(W / SIM_SCALE)), nsh = Math.max(8, Math.ceil(H / SIM_SCALE));
    if (nsw !== sw || nsh !== sh) {
      sw = nsw; sh = nsh;
      if (!makeTargets()) return false;
      cur = 0;
    }
    placeBridge();
    drawLogo();
    return true;
  };

  // A híd a linkek és az apró szöveg közti résbe kerül, hogy ne fusson szöveg alá.
  const placeBridge = () => {
    const fr = el.getBoundingClientRect();
    const a = el.querySelector('.lab__linkek')?.getBoundingClientRect();
    const b = el.querySelector('.lab .apro')?.getBoundingClientRect();
    bridgeY = a && b && b.top > a.bottom ? (a.bottom + b.top) / 2 - fr.top : H * 0.58;
  };

  // ---------- szimuláció ----------
  const pass = (prog: Prog) => {
    const dst = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[dst]);
    gl.viewport(0, 0, sw, sh);
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(prog.u.uState, 0);
    gl.uniform2f(prog.u.uSize, W, H);
    gl.uniform1f(prog.u.uBridgeY, bridgeY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = dst;
  };
  const step = () => {
    const s = progs!.sim;
    gl.useProgram(s.p);
    gl.uniform2f(s.u.uTexel, 1 / sw, 1 / sh);
    pass(s);
  };
  const applyDrops = () => {
    const d = progs!.drop;
    while (drops.length) {
      const q = drops.shift()!;
      gl.useProgram(d.p);
      gl.uniform2f(d.u.uA, q.ax, q.ay);
      gl.uniform2f(d.u.uB, q.bx, q.by);
      gl.uniform1f(d.u.uRadius, q.r);
      gl.uniform1f(d.u.uStrength, q.s);
      pass(d);
    }
  };
  const render = () => {
    const v = progs!.view;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(v.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(v.u.uState, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.uniform1i(v.u.uLogo, 1);
    gl.uniform2f(v.u.uTexel, 1 / sw, 1 / sh);
    gl.uniform2f(v.u.uSize, W, H);
    gl.uniform1f(v.u.uTime, time);
    gl.uniform1f(v.u.uBridgeY, bridgeY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (t: number, dt: number) => {
    if (!ok || gl.isContextLost()) return;
    resize();
    if (dt === 0) { // állókép (mozgáscsökkentés): ami a sorban van, azt kifuttatjuk egy gyűrűvé
      if (drops.length) {
        applyDrops();
        for (let i = 0; i < 70; i++) step();
      }
      time = t % 1000;
      render();
      return;
    }
    time += dt;
    // ritka, magától érkező esőcsepp
    nextRain -= dt;
    if (nextRain <= 0) {
      nextRain = 4 + Math.random() * 9;
      const x = W * (0.06 + Math.random() * 0.88), y = H * (0.1 + Math.random() * 0.8);
      drops.push({ ax: x, ay: y, bx: x, by: y, r: 12, s: -0.6 });
    }
    applyDrops();
    acc = Math.min(acc + dt, 4 / STEP_HZ);
    while (acc >= 1 / STEP_HZ) { step(); acc -= 1 / STEP_HZ; }
    render();
  };

  // ---------- indulás ----------
  let loop: Loop | null = null;
  const start = () => {
    try { ok = setup(); } catch (err) { ok = false; console.warn('[folyam] tó: WebGL beállítás sikertelen', err); }
    el.classList.toggle('lab--to-el', ok);
    if (!ok) return;
    if (!loop) loop = visibleLoop(el, frame, { rootMargin: '50px' });
    loop.start();
    if (reducedMotion()) loop.renderOnce();
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    ok = false;
    loop?.stop();
    el.classList.remove('lab--to-el');
  });
  canvas.addEventListener('webglcontextrestored', () => start());

  // ---------- interakció (a lábléc elemen, a linkek kattinthatók maradnak) ----------
  const local = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  let last: { x: number; y: number } | null = null;
  el.addEventListener('pointerdown', (e) => {
    if (!ok) return;
    if ((e.target as Element).closest('a')) return;
    const p = local(e);
    drops.push({ ax: p.x, ay: p.y, bx: p.x, by: p.y, r: 16, s: -1.4 });
    if (reducedMotion()) {
      // egyetlen gyűrű-állókép: a felületet előbb elsimítjuk, hogy csak ez az egy gyűrű látsszon
      makeTargets();
      cur = 0;
      loop?.renderOnce();
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!ok || e.pointerType === 'touch' || reducedMotion()) { last = null; return; }
    const p = local(e);
    if (last) {
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d > 1.5) {
        drops.push({ ax: last.x, ay: last.y, bx: p.x, by: p.y, r: 9, s: -Math.min(0.08, d * 0.004) });
        last = p;
      }
    } else last = p;
  });
  el.addEventListener('pointerleave', () => { last = null; });

  let ro: ResizeObserver | null = null;
  ro = new ResizeObserver(() => { if (ok && reducedMotion()) loop?.renderOnce(); });
  ro.observe(el);

  // a betűk betöltése után rajzoljuk a logót, hogy a víz alatti példány pontosan fedje a DOM-szöveget
  start();
  const cs = getComputedStyle(logo);
  const fontsReady = document.fonts
    ? document.fonts.load(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, logo.textContent || 'Folyam').then(() => document.fonts.ready)
    : Promise.resolve();
  fontsReady.then(() => { if (ok) { resize(true); if (reducedMotion()) loop?.renderOnce(); } }, () => {});
}

function addCaption(el: HTMLElement) {
  const racs = el.querySelector('.lab__racs');
  if (!racs || racs.querySelector('.lab__tavak')) return;
  const p = document.createElement('p');
  p.className = 'lab__tavak';
  p.textContent = TAVAK_MONDAT;
  const apro = racs.querySelector('.apro');
  if (apro) apro.after(p); else racs.append(p);
}
