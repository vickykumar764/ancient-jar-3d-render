// Our cast as lit flat sprites in the 3D world — Ancient Jar version (Zhang Heng's seismoscope, 132 AD China).
// Each frame every character asks for a drawing (a key + a draw call); the pool keeps one canvas per distinct
// drawing, so courtiers laughing in step share canvases. Characters are yaw-only billboards shaded by cardShade()
// (scene tint, bright floor, side gradient toward the sun, painted crescent in the drawing); standing ones get a
// soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, INVENTOR, EMPEROR, GUARD, courtier,
  fxBurst, fxPuff, fxRing, fxContact, fxShadow, fxFlame, fxCup,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, D0, V3, JarState } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** hill mound surface — same ellipsoid as world.ts moundY: centre (28,-35), radii 15 x 13, top D0+6.5; ground is D0 */
const hillY = (x: number, z: number) => {
  const u = 1 - ((x - 28) / 15) ** 2 - ((z + 35) / 13) ** 2;
  return Math.max(D0, D0 - 0.3 + 6.8 * Math.sqrt(Math.max(0, u)));
};
/** head-shape seed: 7 shapes, so characters standing together still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
type LightName = "day" | "golden" | "night" | "dawn" | "warm";
/** per-shot light (shot plan): day palace/city -> golden hilltop sunset -> night blue -> dawn rubble -> warm cutaway */
const LIGHT_OF: Record<number, LightName> = {
  1: "day", 2: "day", 3: "day", 4: "day", 5: "day", 6: "day", 7: "day", 8: "day", 9: "day",
  10: "golden", 11: "night", 12: "night", 13: "night", 14: "night", 15: "golden",
  16: "dawn", 17: "warm", 18: "warm", 19: "day", 20: "day",
};
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: LightName = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
/** expression-swap times (s, absolute) per shot, so a blink hides each swap */
const SWAPS: Record<number, number[]> = {
  1: [3.8], 2: [7.29], 5: [19.83], 6: [28.43], 7: [32.7], 8: [34.18], 9: [36.39],
  11: [52.57], 12: [53.83, 55.8], 13: [56.37], 14: [61.0], 15: [65.45],
};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const blink = (t: number, id: number, i: number) => lidAt(t, i, SWAPS[id] ?? []);
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
const INV: Who = { i: 0, o: INVENTOR, okey: "inv" };
const EMP: Who = { i: 1, o: EMPEROR, okey: "emp" };
const court = (i: number): Who => ({ i: 10 + i, o: courtier(i), okey: `c${i % 6}` });
const guard = (i: number): Who => ({ i: 20 + i, o: GUARD, okey: "guard" });
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<LightName, [number, number, number]> = {
  day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.1, 0.11, 0.22], dawn: [0.22, 0.2, 0.3], warm: [0.25, 0.2, 0.28],
};
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- cast by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

const FRONT = { side: false, mirror: false };
/** world anchors (fixed layout): jar dais, throne, gates, hilltop camp */
const THRONE: V3 = [0, D0, -14];
const JAR: V3 = [0, D0, -6];
const CAMP: V3 = [28, D0 + 6, -35];

/** place one character + its contact blob (gy = ground height under the feet; y = card height, e.g. a throne seat) */
const put = (out: Stage, cam: CamInfo, who: Who, x: number, y: number, z: number, fo: FrontOpts, so: SideOpts,
  view: { side: boolean; mirror: boolean } = FRONT, scale = 1, gy = y) => {
  out.places.push(person(cam, who, x, y, z, view, fo, so, scale));
  blob(out, x, gy, z, scale);
};
/** the emperor seated on the throne (card sits 0.25 m up on the seat; blob stays on the floor) */
const emperor = (out: Stage, cam: CamInfo, t: number, id: number, expr: Expr) => {
  // seated on the throne seat (top D0+1.7): mesh y D0+1.45 puts the butt ~on the seat, feet just above the dais (D0+1.2)
  put(out, cam, EMP, THRONE[0], D0 + 1.45, THRONE[2],
    { mode: "sit", expr, blink: blink(t, id, 1) }, {}, FRONT, 1.12, D0 + 1.2);
};
/** the laughing court in an arc before the throne */
const courtArc = (out: Stage, cam: CamInfo, t: number, id: number, exprs: Expr[]) => {
  const xs = [-4.5, -2.7, -1.2, 1.2, 2.7, 4.5];
  xs.forEach((x, i) => {
    put(out, cam, court(i), x, D0 + 0.6, -11.5 - (i % 2) * 0.7, // hall floor top is D0+0.6 (was D0: buried to the knees)
      { mode: "stand", expr: exprs[i % exprs.length], blink: blink(t, id, 10 + i),
        wave: i % 3 === 2 ? q(0.5 + 0.5 * Math.sin(t * 8 + i), 30) : undefined }, {});
  });
};

// ---------------- one-off effects (all driven by id + t inside stage()) ----------------
/** ball-drop clink star, 6 frames long, at frame f0 */
const burst = (out: Stage, f: number, f0: number, x: number, y: number, z: number, s = 1) => {
  const d = f - f0;
  if (d < 0 || d >= 6) return;
  const u = q(d / 6, 30);
  out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x, y, z, w: 1.1 * s, h: 1.1 * s });
};
/** drifting dust puff (soft card), cycling with period cyc frames, offset off */
const puff = (out: Stage, f: number, x: number, y: number, z: number, w: number, h: number, cyc: number, off: number) => {
  const u = q((((f / cyc + off) % 1) + 1) % 1, 30);
  out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x, y, z, w, h, soft: true });
};
/** campfire / torch flame, flickering with t */
const flame = (out: Stage, t: number, x: number, y: number, z: number, w: number, h: number) => {
  const u = q(t % 1, 30);
  out.fx.push({ key: `flame${u}`, cw: 200, ch: 300, draw: (p) => fxFlame(p, u), x, y, z, w, h });
};
/** ground ripple ring (flat), cycling with period cyc frames */
const ring = (out: Stage, f: number, x: number, y: number, z: number, w: number, cyc: number, off = 0) => {
  const u = q((((f / cyc + off) % 1) + 1) % 1, 30);
  out.fx.push({ key: `ring${u}`, cw: 600, ch: 600, draw: (p) => fxRing(p, u), x, y, z, w, h: w, flat: true });
};

/** everything with a face in shot `id` at time t (seconds). Shot ids 1-20, 2878 frames @30fps (shot plan). */
export const stage = (id: number, t: number, st: JarState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  LNAME = LIGHT_OF[id] ?? "day";
  findSun(cam, SUN);
  const f = Math.round(t * FPS);
  void st; // the jar itself is world geometry; the cast only needs id + t
  switch (id) {
    case 1: {
      // hook: the inventor leans over the jar, hands reaching to the dragon's mouth; upright once the ball seats ("रखी" f91)
      const placing = f < 110;
      const view = viewOf(cam, 0.3, -3.9, 0, -1);
      // on the dais (top D0+0.5), 0.4 m clear of the jar bulge (surface z -4.28) — was (0,D0,-5.2): inside the jar, invisible
      put(out, cam, INV, 0.3, D0 + 0.5, -3.9,
        { mode: "stand", expr: "neutral", blink: blink(t, id, 0), headTilt: placing ? 10 : 4 },
        { mode: placing ? "push" : "stand", pose: 0.65, expr: "neutral", blink: blink(t, id, 0) },
        view);
      emperor(out, cam, t, id, "neutral");
      break;
    }
    case 2: {
      // whole court laughing; the inventor small centre-frame
      emperor(out, cam, t, id, "laugh");
      courtArc(out, cam, t, id, ["laugh", "laugh", "grin"]);
      put(out, cam, INV, 0, D0 + 0.6, -9.5, { mode: "stand", expr: "nervous", blink: blink(t, id, 0), headTilt: 8 }, {}, FRONT, 0.85);
      break;
    }
    case 3: case 4: break; // jar only (orbit / balls + frogs) — no people
    case 5: {
      // the emperor on his throne, dismissive wave (he rises to wave it away: feet on the throne dais, D0+1.2)
      put(out, cam, EMP, THRONE[0], D0 + 1.2, THRONE[2],
        { mode: "stand", expr: "stern", blink: blink(t, id, 1), wave: q(0.6 + 0.4 * Math.sin(t * 6), 30) }, {}, FRONT, 1.12, D0 + 1.2);
      put(out, cam, court(0), -3.2, D0 + 0.6, -12.6, { mode: "stand", expr: "grin", blink: blink(t, id, 10) }, {});
      put(out, cam, court(1), 3.2, D0 + 0.6, -12.6, { mode: "stand", expr: "neutral", blink: blink(t, id, 11) }, {});
      break;
    }
    case 6: {
      // one ball drops; the inventor looks up, shock landing 3 f before "गिरी" (f853); courtiers glance
      const shock = f >= 850;
      // on the dais, clear of the jar bulge — was (0.6,D0,-5.0): inside the jar, only a head showed
      put(out, cam, INV, 0.9, D0 + 0.5, -3.7,
        { mode: "stand", expr: shock ? "shock" : "nervous", blink: blink(t, id, 0), headTilt: shock ? -6 : 4 }, {});
      put(out, cam, court(2), -2.5, D0 + 0.6, -9, { mode: "stand", expr: "neutral", look: 1, blink: blink(t, id, 12) }, {});
      put(out, cam, court(3), 2.5, D0 + 0.6, -9, { mode: "stand", expr: "neutral", look: -1, blink: blink(t, id, 13) }, {});
      burst(out, f, 850, 0, D0 + 1.22, -3.15, 1); // clink at ball 0's frog mouth (world: seat (0,10,-4.05) -> frog (0,7.22,-3.15))
      break;
    }
    case 7: {
      // extreme close on the wine cup: the laugh dies as no ripple comes ("लहर" f981)
      const laughing = f < 978;
      put(out, cam, EMP, THRONE[0], D0 + 0.25, THRONE[2],
        { mode: "sit", expr: laughing ? "laugh" : "neutral", blink: blink(t, id, 1) }, {}, FRONT, 1.5, D0);
      out.fx.push({ key: "cup", cw: 200, ch: 200, draw: (p) => fxCup(p), x: 0.85, y: D0 + 1.55, z: -13.3, w: 0.4, h: 0.4 }); // in the emperor's lap (was D0+0.95: inside the throne dais)
      break;
    }
    case 8: {
      // the court roars louder ("अब" f1025); the inventor shrinking in frame, head bowed
      emperor(out, cam, t, id, "laugh");
      courtArc(out, cam, t, id, ["laugh", "laugh", "laugh", "grin"]);
      put(out, cam, INV, 0, D0 + 0.6, -9.5, { mode: "stand", expr: "nervous", blink: blink(t, id, 0), headTilt: 12 }, {}, FRONT, 0.8);
      break;
    }
    case 9: {
      // exile: two guards drag the inventor from the jar to the gates, dust at his heels
      const u = smooth((f - 1082) / 231);
      const z = -5 + 25 * u, x = 0.3 * Math.sin(u * Math.PI * 3);
      // hall floor D0+0.6, steps down to the courtyard D0 at z 2..5 — was constant D0 (buried in the hall)
      const gy9 = z < 2 ? D0 + 0.6 : z < 5 ? D0 + 0.6 - (z - 2) * 0.2 : D0;
      const phase = q((((f / 20) % 1) + 1) % 1, 120);
      const view = viewOf(cam, x, z, 0, 1);
      put(out, cam, INV, x, gy9, z,
        { mode: "stroll", phase, expr: "nervous", blink: blink(t, id, 0), tilt: 6 },
        { mode: "march", phase, expr: "nervous", blink: blink(t, id, 0), stomp: 0.7, stride: view.fs }, view);
      for (const s of [-1, 1]) {
        const gx = x + s * 0.9, gi = s > 0 ? 1 : 0;
        put(out, cam, guard(gi), gx, gy9, z + 0.2,
          { mode: "march", phase: q((((f / 20 + 0.5) % 1) + 1) % 1, 120), expr: "stern", blink: blink(t, id, 20 + gi) },
          { mode: "march", phase: q((((f / 20 + 0.5) % 1) + 1) % 1, 120), expr: "stern", blink: blink(t, id, 20 + gi), stomp: 1, stride: view.fs }, view);
      }
      // the emperor points him to the gate while the drag is still in the hall
      if (f < 1160) {
        put(out, cam, EMP, THRONE[0], D0 + 0.25, THRONE[2],
          { mode: "stand", expr: "stern", blink: blink(t, id, 1), wave: 1 }, {}, FRONT, 1.12, D0);
      }
      puff(out, f, x, D0 + 0.06, z + 0.4, 1.1, 0.7, 45, 0);
      puff(out, f, x + 0.4, D0 + 0.06, z - 0.3, 0.9, 0.6, 45, 0.5);
      break;
    }
    case 10: {
      // hilltop camp at sunset: drags the jar up, then settles alone by the fire
      const u = smooth((f - 1314) / 66);
      if (f < 1380) {
        // walks up the slope to the campfire (was: ended at the jar, 1.1 m from its axis — inside the jar body)
        const x = 24 + (30 - 24) * u, z = -30 + (-31.8 + 30) * u, y = hillY(x, z);
        const view = viewOf(cam, x, z, 1, -1);
        const ph = q((((f / 45) % 1) + 1) % 1, 120);
        put(out, cam, INV, x, y, z,
          { mode: "stroll", phase: ph, expr: "nervous", blink: blink(t, id, 0), tilt: 8, headTilt: 8 },
          { mode: "march", phase: ph, expr: "nervous", blink: blink(t, id, 0), stomp: 0.6, stride: view.fs }, view);
      } else {
        // sits by the campfire, clear of the jar (frogs reach 2.85 m from its axis)
        put(out, cam, INV, 30.0, hillY(30.0, -31.5), -31.5,
          { mode: "sit", expr: "neutral", blink: blink(t, id, 0), headTilt: 4 }, {});
      }
      flame(out, t, 30.5, hillY(30.5, -33) + 0.1, -33, 0.55, 0.85); // on the real campfire (30.5,-33)
      break;
    }
    case 11: {
      // night: one ball drops in the dark; he bolts upright — shock 3 f before "गिरी" (f1577)
      const up = f >= 1574;
      put(out, cam, INV, 30.0, hillY(30.0, -31.5), -31.5,
        { mode: "sit", expr: up ? "shock" : "neutral", blink: blink(t, id, 0), tilt: up ? -5 : 0 }, {});
      burst(out, f, 1574, 30.0, D0 + 7.32, -33.0, 1); // clink at ball 1's frog mouth (30.02,13.32,-32.98)
      flame(out, t, 30.5, hillY(30.5, -33) + 0.1, -33, 0.4, 0.6);
      break;
    }
    case 12: {
      // all eight balls rain: second ball just before "दूसरी" (f1615), then eight just before "आठों" (f1674)
      put(out, cam, INV, 30.0, hillY(30.0, -31.5), -31.5,
        { mode: "stand", expr: "shock", blink: blink(t, id, 0), wave: 1, tilt: -6 }, {});
      burst(out, f, 1612, 30.85, D0 + 7.32, -35, 1); // clink at ball 2's frog mouth (30.85,13.32,-35)
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        burst(out, f, 1671 + k, 28 + 2.85 * Math.sin(a), D0 + 7.32, -35 + 2.85 * Math.cos(a), 0.9); // one burst on each frog mouth (sin=x, cos=z, as in world.ts — was cos/sin swapped)
      }
      break;
    }
    case 13: {
      // run down to the gates by torchlight, shouting, arms waving ("भागा" f1742)
      const u = smooth((f - 1688) / 132);
      const x = 30 + (0.5 - 30) * u, z = -31.5 + (20 + 31.5) * u, y = hillY(x, z); // from the fire down to the gates — was linear (floated ~5 m)
      const phase = f < 1688 ? 0 : q((((f / 15) % 1) + 1) % 1, 120);
      const view = viewOf(cam, x, z, -28, 55);
      put(out, cam, INV, x, y, z,
        { mode: "march", phase, expr: "shock", blink: blink(t, id, 0) },
        { mode: "march", phase, expr: "shock", blink: blink(t, id, 0), stomp: 1.2, stride: view.fs }, view);
      flame(out, t, x + 0.5, y + 1.25, z + 0.2, 0.4, 0.6); // his torch
      break;
    }
    case 14: {
      // guards at the gate mock him, laughing, pointing back up the hill ("अरे" f1830)
      const mocking = f >= 1827;
      for (const s of [-1, 1]) {
        const gi = s > 0 ? 1 : 0;
        put(out, cam, guard(gi), s * 1.6, D0, 23.2,
          { mode: "stand", expr: mocking ? "laugh" : "grin", blink: blink(t, id, 20 + gi),
            wave: s < 0 && mocking ? 1 : undefined }, {});
      }
      const view = viewOf(cam, 0.5, 19.5, 1, -1);
      put(out, cam, INV, 0.5, D0, 19.5,
        { mode: "stroll", phase: q((((f / 45) % 1) + 1) % 1, 120), expr: "nervous", blink: blink(t, id, 0), headTilt: 10 },
        { mode: "march", phase: q((((f / 45) % 1) + 1) % 1, 120), expr: "nervous", blink: blink(t, id, 0), stomp: 0.5, stride: view.fs }, view, 0.85);
      break;
    }
    case 15: {
      // trudges back up the hill at dawn, slow walk, head down
      const u = smooth((f - 1954) / 117);
      const x = 0.5 + (30.0 - 0.5) * u, z = 19.5 + (-31.5 - 19.5) * u, y = hillY(x, z); // climbs the mound — was linear (floated ~3.5 m); ends at the fire
      const phase = q((((f / 45) % 1) + 1) % 1, 120);
      const view = viewOf(cam, x, z, 27, -54);
      put(out, cam, INV, x, y, z,
        { mode: "stroll", phase, expr: "nervous", blink: blink(t, id, 0), tilt: 6, headTilt: 10 },
        { mode: "march", phase, expr: "nervous", blink: blink(t, id, 0), stomp: 0.5, stride: view.fs }, view);
      break;
    }
    case 16: {
      // dawn: the palace is rubble — dust settling, no people
      puff(out, f, 0, D0 + 0.3, -14, 1.6, 1.0, 90, 0);
      puff(out, f, -2, D0 + 0.2, -8, 1.3, 0.85, 90, 0.33);
      puff(out, f, 2.5, D0 + 0.25, -11, 1.4, 0.9, 90, 0.66);
      break;
    }
    case 17: case 18: break; // mechanism cutaway / pendulum demo — no people
    case 19: {
      // one ball: a ripple runs through the distant ground + quake dust
      puff(out, f, 0, D0 + 0.2, -10, 1.5, 1.0, 75, 0);
      puff(out, f, 3, D0 + 0.2, -6, 1.2, 0.8, 75, 0.5);
      ring(out, f, 0, D0 + 0.06, -8, 3, 60, 0);
      break;
    }
    case 20: {
      // eight balls: the ground splits under the palace; payoff — the jar stands intact on the hill
      puff(out, f, 0, D0 + 0.3, -10, 1.8, 1.1, 90, 0);
      puff(out, f, -3, D0 + 0.25, -13, 1.4, 0.9, 90, 0.4);
      ring(out, f, 0, D0 + 0.06, -8, 4, 70, 0);
      ring(out, f, 28, D0 + 6.55, -35, 4, 70, 0.5);
      break;
    }
    default: break;
  }
  return out;
};

export { FPS };
