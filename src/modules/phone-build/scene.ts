// A 3D telefon: lekerekített test, kamerasziget, oldalgombok, tükröződő bevonat,
// valós árnyék és kontakt-árnyék. A kijelző egy CanvasTexture (screen.ts rajzolja).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';


export interface Pose { rx: number; ry: number; rz: number; y: number; }

const W = 1.5, H = 3.1, D = 0.17;

/** Lekerekített doboz, aminek az alaprajzi sarka nagy, az éle lapos: a RoundedBoxGeometry-t mélységben összenyomjuk. */
function slab(w: number, h: number, d: number, r: number, seg: number): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, r * 2, seg, r);
  g.scale(1, 1, d / (r * 2));
  return g;
}

/** Lekerekített téglalap sík 0..1 UV-vel. */
function roundedPlane(w: number, h: number, r: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 12);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  uv.needsUpdate = true;
  return g;
}

function contactTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 64, 4, 128, 64, 124);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.35, 'rgba(0,0,0,0.38)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 32);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class PhoneScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly texture: THREE.CanvasTexture;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  private phone = new THREE.Group();
  private contact: THREE.Mesh;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private disposables: { dispose(): void }[] = [];
  private w = 1; private h = 1;

  constructor(canvas: HTMLCanvasElement, screenCanvas: HTMLCanvasElement, opts: { coarse: boolean; dpr: number }) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: !opts.coarse, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(opts.dpr);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;

    this.pmrem = new THREE.PMREMGenerator(r);
    this.buildEnv();
    this.scene.environmentIntensity = 0.85;

    const seg = opts.coarse ? 5 : 8;
    const keep = <T extends { dispose(): void }>(x: T) => { this.disposables.push(x); return x; };

    // --- anyagok ---
    const bodyMat = keep(new THREE.MeshPhysicalMaterial({
      color: 0x1d2224, metalness: 0.82, roughness: 0.3,
      clearcoat: 1, clearcoatRoughness: 0.06,
    }));
    const backMat = keep(new THREE.MeshPhysicalMaterial({
      color: 0x18302e, metalness: 0.15, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: new THREE.Color(0x8c9878),
    }));
    const glassMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x050607, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }));
    const lensMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x07090a, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.35 }));
    const ringMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x9a9d98, metalness: 1, roughness: 0.22 }));
    const islandMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x1f3a37, metalness: 0.1, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }));

    // --- kijelző textúra ---
    const tex = new THREE.CanvasTexture(screenCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy());
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture = keep(tex);
    const screenMat = keep(new THREE.MeshPhysicalMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1,
      roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04,
    }));
    screenMat.toneMapped = false;

    // --- test ---
    const body = new THREE.Mesh(keep(slab(W, H, D, 0.22, seg)), bodyMat);
    body.castShadow = true;
    this.phone.add(body);
    // hátlap: kicsit kisebb, színezett üveg
    const back = new THREE.Mesh(keep(roundedPlane(W - 0.05, H - 0.05, 0.2)), backMat);
    back.position.z = -D / 2 - 0.0015; back.rotation.y = Math.PI;
    this.phone.add(back);
    // előlap üveg (keret) + kijelző
    const front = new THREE.Mesh(keep(roundedPlane(W - 0.035, H - 0.035, 0.205)), glassMat);
    front.position.z = D / 2 + 0.0015;
    this.phone.add(front);
    const sw = W - 0.11, sh = H - 0.11;
    const screen = new THREE.Mesh(keep(roundedPlane(sw, sh, 0.17)), screenMat);
    screen.position.z = D / 2 + 0.003;
    this.phone.add(screen);

    // --- kamerasziget a hátoldalon (hátulról nézve bal felül) ---
    const island = new THREE.Group();
    const isl = new THREE.Mesh(keep(slab(0.66, 0.66, 0.05, 0.16, seg)), islandMat);
    isl.castShadow = true;
    island.add(isl);
    const lensGeo = keep(new THREE.CylinderGeometry(0.105, 0.105, 0.05, 40));
    const ringGeo = keep(new THREE.TorusGeometry(0.113, 0.014, 12, 48));
    const lensAt = [[-0.14, 0.14], [-0.14, -0.14], [0.15, 0.0]];
    for (const [x, y] of lensAt) {
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.rotation.x = Math.PI / 2; lens.position.set(x, y, -0.03);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(x, y, -0.055);
      island.add(lens, ring);
    }
    const flash = new THREE.Mesh(keep(new THREE.CircleGeometry(0.035, 24)), keep(new THREE.MeshStandardMaterial({ color: 0xecead3, emissive: 0x403a20, roughness: 0.3 })));
    flash.position.set(0.15, 0.2, -0.026); flash.rotation.y = Math.PI;
    island.add(flash);
    island.position.set(W / 2 - 0.43, H / 2 - 0.43, -D / 2 - 0.02);
    this.phone.add(island);

    // --- oldalgombok ---
    const btnGeo = (h: number) => keep(slab(0.05, h, 0.07, 0.022, 3));
    const addBtn = (x: number, y: number, h: number) => {
      const b = new THREE.Mesh(btnGeo(h), bodyMat);
      b.position.set(x, y, 0); b.castShadow = true;
      this.phone.add(b);
    };
    addBtn(W / 2 + 0.008, 0.62, 0.42); // bekapcsoló
    addBtn(-W / 2 - 0.008, 0.95, 0.16); // műveletgomb
    addBtn(-W / 2 - 0.008, 0.6, 0.32); // hangerő +
    addBtn(-W / 2 - 0.008, 0.2, 0.32); // hangerő -

    this.scene.add(this.phone);

    // --- fények ---
    const key = new THREE.DirectionalLight(0xfff3dc, 2.0);
    key.position.set(-2.4, 6, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(opts.coarse ? 512 : 1024, opts.coarse ? 512 : 1024);
    const sc = key.shadow.camera;
    sc.left = -2.4; sc.right = 2.4; sc.top = 2.4; sc.bottom = -2.4; sc.near = 1; sc.far = 16;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xd9b21f, 1.1);
    rim.position.set(4, 1.5, -3);
    this.scene.add(rim);
    this.scene.add(new THREE.HemisphereLight(0xecead3, 0x18302e, 0.35));

    // --- talaj: valós árnyék + kontakt-árnyék ---
    const groundY = -2.15;
    const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(14, 14)), keep(new THREE.ShadowMaterial({ color: 0x030807, opacity: 0.42 })));
    ground.rotation.x = -Math.PI / 2; ground.position.y = groundY; ground.receiveShadow = true;
    this.scene.add(ground);
    const cTex = keep(contactTexture());
    this.contact = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.6, 1.3)), keep(new THREE.MeshBasicMaterial({ map: cTex, transparent: true, depthWrite: false, opacity: 0.8, color: 0x020605 })));
    this.contact.rotation.x = -Math.PI / 2; this.contact.position.y = groundY + 0.002;
    this.scene.add(this.contact);
  }

  private buildEnv() {
    const room = new RoomEnvironment();
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(room, 0.04);
    this.scene.environment = this.envRT.texture;
    room.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  }

  /** Kontextus-visszaállítás után: környezet és textúra újra. */
  restore() {
    this.buildEnv();
    this.texture.needsUpdate = true;
  }

  setSize(w: number, h: number) {
    if (w < 2 || h < 2) return;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const cam = this.camera;
    cam.aspect = w / h;
    // illesztés: a telefon + árnyék férjen be magasságban és szélességben is
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const needH = 5.0, needW = 2.6;
    const dist = Math.max(needH / 2 / t, needW / 2 / (t * cam.aspect));
    cam.position.set(0, 0.55, dist);
    cam.lookAt(0, -0.32, 0);
    cam.updateProjectionMatrix();
  }

  render(p: Pose) {
    this.phone.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
    this.phone.position.y = p.y;
    const lift = p.y + 0.0;
    const s = 1 - lift * 0.8;
    this.contact.scale.set(s, s, s);
    (this.contact.material as THREE.MeshBasicMaterial).opacity = 0.7 - lift * 1.2;
    this.renderer.render(this.scene, this.camera);
  }

  get size() { return [this.w, this.h]; }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
