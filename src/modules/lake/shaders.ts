// Sete Cidades ikertavai – shaderek (WebGL2, GLSL ES 3.00).

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/* Közös: a földnyelv alakja CSS-pixelben (y lefelé nő).
   Visszaad: x = előjeles távolság a parttól (negatív = szárazföld),
             y = a híd/földnyelv középvonala x-ben,
             z = 1 ha a híd alatti átfolyóban vagyunk. */
const LAND = /* glsl */ `
uniform vec2 uSize;      // a lábléc mérete CSS-pixelben
uniform float uBridgeY;  // a híd magassága CSS-pixelben (a szövegsorok közti résben)
float lhash(float n) { return fract(sin(n) * 43758.5453); }
float lnoise(float x) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(lhash(i), lhash(i + 1.0), u) * 2.0 - 1.0;
}
vec3 land(vec2 p) {
  float yn = p.y / uSize.y;
  float sc = clamp(uSize.x / 1100.0, 0.45, 1.0);
  float bx = uSize.x * 0.5 + sin(yn * 2.6 + 0.4) * uSize.x * 0.012 + lnoise(p.y * 0.02) * 4.0 * sc;
  float by = uBridgeY;
  float dy = abs(p.y - by);
  // keskeny a hídnál, lent kiszélesedő félsziget, fent kisebb földnyúlvány
  float hw = 5.0 * sc + 1.0 + pow(dy / uSize.y, 1.3) * (p.y > by ? 80.0 : 34.0) * sc;
  hw += lnoise(p.y * 0.045 + 3.1) * 2.2 * sc + lnoise(p.y * 0.13) * 0.9;
  float d = abs(p.x - bx) - hw;
  float chan = 1.0 - step(9.0 * sc + 2.0, dy); // a híd alatt átfolyik a víz
  return vec3(d, bx, chan);
}
`;

/* Hullámegyenlet: R = magasság, G = sebesség. */
export const SIM = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uState;
uniform vec2 uTexel;
${LAND}
bool isLand(vec2 uv) {
  vec2 p = vec2(uv.x, 1.0 - uv.y) * uSize;
  vec3 l = land(p);
  return l.x < 0.0 && l.z < 0.5;
}
float hAt(vec2 uv) { return isLand(uv) ? 0.0 : texture(uState, uv).r; }
void main() {
  if (isLand(vUv)) { o = vec4(0.0); return; }
  vec4 s = texture(uState, vUv);
  float avg = (
    hAt(vUv + vec2(uTexel.x, 0.0)) + hAt(vUv - vec2(uTexel.x, 0.0)) +
    hAt(vUv + vec2(0.0, uTexel.y)) + hAt(vUv - vec2(0.0, uTexel.y))) * 0.25;
  s.g += (avg - s.r) * 1.15;
  s.g *= 0.994;
  s.r += s.g;
  s.r *= 0.9995;
  o = vec4(s.r, s.g, 0.0, 1.0);
}`;

/* Csepp / nyom: koszinusz-púp egy szakasz mentén (pont = nulla hosszú szakasz). */
export const DROP = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uState;
uniform vec2 uSize;
uniform vec2 uA;        // CSS-px, y lefelé
uniform vec2 uB;
uniform float uRadius;  // CSS-px
uniform float uStrength;
void main() {
  vec4 s = texture(uState, vUv);
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec2 ab = uB - uA;
  float t = clamp(dot(p - uA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float d = length(p - (uA + ab * t)) / uRadius;
  float k = max(0.0, 1.0 - d);
  k = 0.5 - cos(k * 3.14159265) * 0.5;
  s.r += k * uStrength;
  o = vec4(s.r, s.g, 0.0, 1.0);
}`;

/* Megjelenítés: két tó, fénytörés a logón, fresnel égbolt, kausztika, part, híd. */
export const VIEW = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uState;
uniform sampler2D uLogo;
uniform vec2 uTexel;     // szimulációs texel
uniform float uTime;
${LAND}

const vec3 GOZ = vec3(0.925, 0.918, 0.890);
const vec3 BAZALT = vec3(0.082, 0.094, 0.098);
const vec3 ZUZMO = vec3(0.549, 0.596, 0.471);
const vec3 HAMU = vec3(0.369, 0.380, 0.365);
// tompa, bazalthoz illő kék és a kalderató zöldje
const vec3 KEK_MELY = vec3(0.075, 0.140, 0.200);
const vec3 KEK_SEKELY = vec3(0.135, 0.215, 0.262);
const vec3 ZOLD_MELY = vec3(0.064, 0.150, 0.140);
const vec3 ZOLD_SEKELY = vec3(0.130, 0.235, 0.205);

float hash2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.1) * 0.28 + vnoise(p * 4.3) * 0.17; }

float H(vec2 uv) { return texture(uState, uv).r; }

void main() {
  vec2 uv = vUv;
  vec2 p = vec2(uv.x, 1.0 - uv.y) * uSize;   // CSS-px, y lefelé
  vec3 L = land(p);
  float shore = L.x;
  float yn = p.y / uSize.y;

  // --- felület ---
  float hl = H(uv - vec2(uTexel.x, 0.0)), hr = H(uv + vec2(uTexel.x, 0.0));
  float hd = H(uv - vec2(0.0, uTexel.y)), hu = H(uv + vec2(0.0, uTexel.y));
  float hc = H(uv);
  vec2 g = vec2(hr - hl, hd - hu);            // y lefelé
  vec3 n = normalize(vec3(-g * 3.2, 1.0));
  float lap = hl + hr + hd + hu - 4.0 * hc;

  // --- mélység ---
  float dep = smoothstep(0.0, 150.0, shore);
  float side = smoothstep(-24.0, 24.0, p.x - L.y);
  vec3 deep = mix(KEK_MELY, ZOLD_MELY, side);
  vec3 shallow = mix(KEK_SEKELY, ZOLD_SEKELY, side);
  // a part mentén sekély, kissé zuzmós aljzat
  vec3 bed = mix(shallow, mix(shallow, ZUZMO * 0.42, 0.35), (1.0 - smoothstep(0.0, 26.0, shore)));
  vec3 water = mix(bed, deep, pow(dep, 0.7));
  // lassú, nagy léptékű árnyalás: a tó nem egyszínű lap
  water *= 0.9 + 0.2 * fbm(p * 0.004 + vec2(uTime * 0.004, 0.0));

  // --- fénytörés: a logó a víz alatt ---
  float sc = clamp(uSize.x / 1100.0, 0.45, 1.0);
  vec2 off = n.xy * (8.0 + 16.0 * dep) * (0.5 + 0.5 * sc);
  vec2 lp = p + off;
  float a = texture(uLogo, vec2(lp.x / uSize.x, 1.0 - lp.y / uSize.y)).r;
  // kromatikus remegés helyett csak enyhe elnyelés: mélyebben tompább
  vec3 logoCol = mix(GOZ, mix(GOZ, deep * 2.2, 0.25), dep * 0.6);
  vec3 col = mix(water, logoCol, a * 0.9);

  // --- kausztika a sekély szélen ---
  float shallowK = 1.0 - smoothstep(4.0, 70.0, shore);
  float ca = clamp(-lap * 9.0, 0.0, 1.0);
  float idle = pow(vnoise(p * 0.09 + vec2(uTime * 0.25, -uTime * 0.18)) * vnoise(p * 0.07 - vec2(uTime * 0.15, uTime * 0.21)), 2.0);
  col += (ca * 0.55 + idle * 0.22) * shallowK * vec3(0.78, 0.86, 0.72);

  // --- égbolt-tükröződés (fresnel), enyhén döntött nézet: fent távolabb ---
  vec3 v = normalize(vec3(0.0, mix(1.25, 0.25, yn), 1.0));
  vec3 r = reflect(-v, n);
  float fr = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 sky = mix(vec3(0.30, 0.34, 0.36), GOZ * 0.78, smoothstep(0.0, 0.9, r.y));
  col = mix(col, sky, clamp(fr * 0.85, 0.0, 0.6));
  // napcsillanás a hullámhátakon
  vec3 sun = normalize(vec3(-0.35, 0.75, 0.55));
  float sp = pow(max(dot(r, sun), 0.0), 140.0);
  col += sp * 0.75 * GOZ * smoothstep(0.0, 0.004, length(g));

  // szórt fény a hullámok lejtőin: a gyűrű sík vízen is látszik
  vec3 ld = normalize(vec3(-0.45, -0.55, 0.7));
  col *= 1.0 + (dot(n, ld) - ld.z) * 2.2;

  // a part árnyéka a vízen és nedves sötét sáv
  col *= mix(0.72, 1.0, smoothstep(0.0, 10.0, shore));

  // --- szárazföld: bazalt, zuzmó ---
  float lf = fbm(p * 0.05);
  vec3 ground = mix(BAZALT * 1.1, mix(BAZALT, ZUZMO, 0.22), smoothstep(0.45, 0.85, lf) * 0.8);
  ground *= 0.9 + 0.2 * vnoise(p * 0.9);                       // finom bazaltszemcse
  ground = mix(ground, mix(BAZALT, ZUZMO, 0.35), smoothstep(-5.0, -1.5, shore) * 0.5); // zuzmós partszegély
  ground *= 1.0 - 0.2 * smoothstep(-12.0, -1.0, shore);
  float isLand = (1.0 - smoothstep(-0.8, 0.8, shore)) * (1.0 - L.z);
  col = mix(col, ground, isLand);
  // a logó a földnyelven is olvasható marad (fénytörés nélkül)
  float a0 = texture(uLogo, vec2(uv.x, uv.y)).r;
  col = mix(col, GOZ * 0.93, a0 * 0.9 * isLand);

  // --- a híd: keskeny, világos fedlap a földnyelv két darabja között ---
  float by = uBridgeY;
  float bw = 4.5 * sc + 1.5;
  float bl = 9.0 * sc + 6.0;
  vec2 bq = abs(vec2(p.x - L.y, p.y - by)) - vec2(bw, bl);
  float deck = 1.0 - smoothstep(-0.6, 0.6, max(bq.x, bq.y));
  float shadowB = (1.0 - smoothstep(-0.5, 3.5, max(bq.x - 2.0, bq.y))) * L.z;
  col *= 1.0 - shadowB * 0.35;
  vec3 deckCol = mix(HAMU, GOZ, 0.25);
  deckCol *= 0.82 + 0.18 * step(0.0, -(abs(p.x - L.y) - bw + 1.2)); // korlát-élek
  col = mix(col, deckCol, deck);

  // finom szemcse a sávosodás ellen
  col += (hash2(p + fract(uTime)) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;
