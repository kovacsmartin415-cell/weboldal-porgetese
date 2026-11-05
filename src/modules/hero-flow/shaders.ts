// A nyitókép shaderei (GLSL ES 1.0 stílus; a three WebGL2 alatt átfordítja).

/** Simplex 3D zaj (Ashima Arts / Ian McEwan, MIT) + 2D curl a potenciál gradienséből. */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
// Divergenciamentes 2D áramlás: a skalár potenciál forgatott gradiense.
vec2 curl2(vec2 p, float t){
  const float e = 0.08;
  float n0 = snoise(vec3(p, t));
  float nx = snoise(vec3(p + vec2(e, 0.0), t));
  float ny = snoise(vec3(p + vec2(0.0, e), t));
  return vec2(ny - n0, -(nx - n0)) / e;
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

/** A folyó középvonala: enyhén kanyargó sáv, ami a szó magasságában fut át. */
const RIVER = /* glsl */ `
uniform vec4 uRiver; // x: alap y, y: amplitúdó, z: frekvencia, w: dőlés
float riverY(float x, float t){ return uRiver.x + uRiver.w * x + uRiver.y * sin(x * uRiver.z + t * 0.13) + 0.04 * sin(x * 3.1 - t * 0.21); }
`;

export const SIM_VELOCITY = /* glsl */ `
uniform float uTime;
uniform float uDt;
uniform float uScroll;
uniform float uK;
uniform float uC;
uniform vec2 uPtr;      // világkoordináta
uniform vec2 uPtrVel;   // egység / s, simítva
uniform float uPtrR;
uniform vec4 uShock;    // xy hely, z kezdőidő, w erő
uniform float uJitter;
uniform sampler2D tTarget; // xy cél, z perem (0..1), w szerep (1 betű, 0 háttérfolyam)
uniform sampler2D tAux;    // x,y véletlen, z feloldási küszöb, w belépési késleltetés
${NOISE}
${RIVER}
void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 P = texture2D(texturePosition, uv);
  vec4 V = texture2D(textureVelocity, uv);
  vec4 T = texture2D(tTarget, uv);
  vec4 A = texture2D(tAux, uv);
  vec2 pos = P.xy, vel = V.xy;
  float isLetter = step(0.5, T.w);

  // Közös áramlási mező: lassan változó curl-zaj.
  vec2 c = curl2(pos * 1.35 + vec2(0.0, uTime * 0.05), uTime * 0.11);

  // Háttérfolyó: balról jobbra, a középvonal felé enyhén húz.
  float ry = riverY(pos.x, uTime) + (A.x - 0.5) * 0.55;
  vec2 river = vec2(0.30 + 0.26 * A.y, 0.0) + c * 0.20;
  river.y += (ry - pos.y) * 0.45;
  river.y -= uScroll * 0.9 * (1.0 - isLetter);

  // Belépés és görgetéses feloldás (csak a betűrészecskéknek).
  float form = isLetter * smoothstep(0.0, 1.0, clamp((uTime - A.w) / 0.85, 0.0, 1.0));
  float rel = isLetter * smoothstep(A.z, A.z + 0.16, uScroll);
  float hold = form * (1.0 - rel);

  // Lefelé folyás: gyorsuló, kanyargó csorgás a következő szekció felé.
  float drop = 0.7 + 0.9 * A.y + 1.4 * rel * uScroll;
  vec2 fall = vec2(0.06 + c.x * 0.32, -drop + c.y * 0.15);
  vec2 free = mix(river, fall, rel);
  vec2 acc = (free - vel) * 2.4 * (1.0 - hold);

  // Rugó a betű célpontjához; a cél maga is finoman áramlik (élő betű).
  vec2 tgt = T.xy + c * uJitter * (1.0 - 0.65 * T.z);
  vec2 sp = (tgt - pos) * uK - vel * uC;
  float m = length(sp);
  sp *= min(1.0, 26.0 / max(m, 1e-4));
  acc += sp * hold;

  // Mutató: sebességgel arányos taszítás + két ellentétes örvény a nyomában.
  vec2 dp = pos - uPtr;
  float r2 = dot(dp, dp);
  float spd = min(length(uPtrVel), 5.0);
  float fall2 = exp(-r2 / (uPtrR * uPtrR));
  vec2 dir = dp / sqrt(r2 + 1e-5);
  float side = sign(uPtrVel.x * dp.y - uPtrVel.y * dp.x + 1e-6);
  vec2 perp = vec2(-dir.y, dir.x) * side;
  acc += (dir * 9.0 + perp * 14.0 + uPtrVel * 3.0) * fall2 * spd;

  // Lökéshullám: táguló gyűrű.
  float age = uTime - uShock.z;
  if (age > 0.0 && age < 2.5) {
    vec2 ds = pos - uShock.xy;
    float rs = length(ds);
    float ring = age * 1.25;
    float w = 0.09 + age * 0.08;
    float f = exp(-pow((rs - ring) / w, 2.0)) * exp(-age * 1.8) * uShock.w;
    acc += (ds / max(rs, 1e-3)) * f * 13.0;
  }

  vel += acc * uDt;
  gl_FragColor = vec4(vel, 0.0, 1.0);
}
`;

export const SIM_POSITION = /* glsl */ `
uniform float uTime;
uniform float uDt;
uniform float uAspect;
uniform sampler2D tTarget;
uniform sampler2D tAux;
${RIVER}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 P = texture2D(texturePosition, uv);
  vec4 V = texture2D(textureVelocity, uv);
  vec4 T = texture2D(tTarget, uv);
  vec4 A = texture2D(tAux, uv);
  vec2 pos = P.xy + V.xy * uDt;
  float isLetter = step(0.5, T.w);
  float formed = isLetter * step(A.w + 0.3, uTime);
  float edge = uAspect + 0.12;
  // A háttérfolyó (és a még be nem állt betűrészecskék) a jobb szélen kilép, balról újra belép.
  if (formed < 0.5 && pos.x > edge) {
    float r = hash12(uv * 913.0 + uTime);
    pos.x = -edge - r * 0.25;
    pos.y = riverY(pos.x, uTime) + (hash12(uv * 371.0 - uTime) - 0.5) * 0.6;
  }
  if (formed < 0.5 && pos.y < -1.25) { pos.x = -edge - A.x * 0.3; pos.y = riverY(pos.x, uTime) + (A.y - 0.5) * 0.5; }
  pos.y = max(pos.y, -1.35);
  gl_FragColor = vec4(pos, 0.0, 1.0);
}
`;

export const POINTS_VERT = /* glsl */ `
attribute vec2 ref;
uniform sampler2D tPos;
uniform sampler2D tVel;
uniform sampler2D tTarget;
uniform sampler2D tAux;
uniform float uAspect;
uniform float uPx;
uniform float uPxStream;
uniform float uAlpha;
uniform float uTime;
varying vec3 vCol;
varying float vA;
const vec3 GOZ = vec3(0.925, 0.918, 0.890);
const vec3 KEN = vec3(0.851, 0.698, 0.122);
const vec3 ZUZMO = vec3(0.549, 0.596, 0.471);
void main(){
  vec4 P = texture2D(tPos, ref);
  vec4 V = texture2D(tVel, ref);
  vec4 T = texture2D(tTarget, ref);
  vec4 A = texture2D(tAux, ref);
  float isLetter = step(0.5, T.w);
  float spd = length(V.xy);
  float edge = smoothstep(0.2, 0.95, T.z);
  // Gőz: lassan sodródó, összefüggő világos-sötét foltok a betű belsejében.
  vec2 q = P.xy * vec2(5.0, 7.0);
  float steam = 0.5 + 0.25 * sin(q.x + uTime * 0.9 + sin(q.y * 0.8 - uTime * 0.6) * 1.7)
                    + 0.25 * sin(q.y * 1.3 - uTime * 0.7 + sin(q.x * 0.6 + uTime * 0.4) * 2.0);
  vec3 inner = mix(GOZ * 0.55, GOZ, steam * steam * (3.0 - 2.0 * steam));
  vec3 letter = mix(inner, KEN, edge);
  letter = mix(letter, KEN, smoothstep(0.4, 1.6, spd) * 0.45);
  // A betű sűrűségéből számolt alap-átlátszóság; mozgásban (folyóként) erősebb.
  float boost = 1.0 + 1.8 * smoothstep(0.06, 0.5, spd);
  float la = mix(0.7 + 0.5 * steam, 1.45, edge) * uAlpha * boost;
  float sa = 0.20 + 0.26 * A.y;
  vCol = mix(ZUZMO, letter, isLetter);
  vA = mix(sa, la, isLetter);
  gl_PointSize = mix(uPxStream * (0.85 + 0.5 * A.x), uPx * (1.0 - 0.3 * edge), isLetter);
  gl_Position = vec4(P.x / uAspect, P.y, 0.0, 1.0);
}
`;

export const POINTS_FRAG = /* glsl */ `
uniform float uGain;
varying vec3 vCol;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d) * vA * uGain;
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const FADE_FRAG = /* glsl */ `
uniform float uDecay;
void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, uDecay); }
`;

/** Kompozit: bazalt alap + fény, árnyalattartó lágy plafon (nem ég ki fehérre), sötétített szövegzóna. */
export const BLIT_FRAG = /* glsl */ `
uniform sampler2D tTrail;
uniform vec4 uTextRect; // uv: x0, y0, x1, y1 (a szövegblokk)
uniform float uAspect;
uniform vec2 uTexel;
varying vec2 vUv;
const vec3 BAZALT = vec3(0.0824, 0.0941, 0.0980);
void main(){
  vec3 L = texture2D(tTrail, vUv).rgb;
  // Olcsó fénykoszorú: két gyűrűben 8-8 minta.
  vec3 g = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854 + 0.39;
    vec2 d = vec2(cos(a), sin(a)) * uTexel;
    g += texture2D(tTrail, vUv + d * 5.0).rgb + texture2D(tTrail, vUv + d * 13.0).rgb * 0.6;
  }
  L += g * (0.32 / 12.8);
  // A szöveg alatt visszafogjuk a fényt, hogy a cím olvasható maradjon.
  vec2 q = vec2(
    smoothstep(uTextRect.x - 0.12, uTextRect.x + 0.04, vUv.x) * (1.0 - smoothstep(uTextRect.z - 0.10, uTextRect.z + 0.10, vUv.x)),
    smoothstep(uTextRect.y - 0.12, uTextRect.y + 0.06, vUv.y) * (1.0 - smoothstep(uTextRect.w - 0.06, uTextRect.w + 0.12, vUv.y))
  );
  L *= 1.0 - 0.5 * q.x * q.y;
  vec3 c = BAZALT + L;
  float m = max(max(c.r, c.g), c.b);
  const float knee = 0.78;
  if (m > knee) { float t = knee + (1.0 - knee) * (1.0 - exp(-(m - knee) / (1.0 - knee))); c *= t / m; }
  // Enyhe peremsötétítés.
  vec2 v = (vUv - 0.5) * vec2(uAspect, 1.0);
  c = mix(BAZALT, c, 1.0 - 0.25 * smoothstep(0.55, 1.3, length(v)));
  gl_FragColor = vec4(c, 1.0);
}
`;
