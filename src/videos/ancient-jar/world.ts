// The whole place as one three.js scene: sky, palace courtyard (hall, throne, banquet table, the giant bronze
// jar with its 8 golden dragons and 8 frogs), city wall + red gates, hilltop camp mound, mechanism cutaway jar,
// rubble palace, smoke, clouds and the cast. update(id, f, camera) poses everything for shot `id` at frame f
// (pure function of id + f). The jar travels: palace dais (shots 1-8), dragged up the hill during shot 9,
// camp on the mound (shots 10-16, 19-20); shots 17-18 look at the cutaway jar instead.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, V, lam, Kit, Ray, kitClone, prop } from "./build";
import { ctex, stoneHD, cobbleHD, grassHD, cloudHD, bronzeHD, lacquerHD, beam, roofHD } from "./paint";
import { LIGHTS, LOOK, LightPreset, WorldLook } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, D0, SHOTS, ShotDef, V3, smooth, clamp01, camAt, jarState, JarState, FOREGROUND, JAR, THRONE, BANQUET, HILL, CUTJAR } from "./story";

// ---------------- assets ----------------
// NOTE: public/bridge/kenney/ does not exist in this project (no GLB on disk at all), so every load below
// fails gracefully (bridge loader catches per file) and loadKit resolves to an empty Kit. Nothing essential
// depends on it: trees/bushes/banners are drawn as cartoon geometry by build.ts prop()/kitClone(), and the
// world geometry is all primitives. If the GLBs are ever copied in, the kit props start appearing.
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree",
  "plant_bushLarge", "plant_bushDetailed", "plant_bush", "hedge", "lantern", "cart", "stall-red", "stall-green",
  "banner-red", "banner-green", "windmill", "stall-bench"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

// ---------------- jar geometry constants ----------------
const JAR_RIM = 3.45; // jar body height above its base (local y of the rim)
const DRAGON_R = 1.35, MOUTH_R = 1.95, FROG_R = 2.85; // radii from the jar axis: dragon heads / ball seats / frogs
const BALL_R = 0.26;
const JAR_PALACE: V3 = [JAR[0], JAR[1] + 0.5, JAR[2]]; // jar base on the palace dais (dais top = D0 + 0.5)
const JAR_CAMP: V3 = [HILL[0], HILL[1] + 0.6, HILL[2]]; // jar base on the camp platform (mound top D0 + 6, platform 0.6)
const CAMP_FIRE: V3 = [30.5, 0, -33]; // x, z of the campfire (y from moundY)

/** mound surface height at (x, z): ellipsoid centred on HILL, top at D0 + 6.5 */
const moundY = (x: number, z: number) => {
  const u = 1 - ((x - HILL[0]) / 15) ** 2 - ((z - HILL[2]) / 13) ** 2;
  return D0 - 0.3 + 6.8 * Math.sqrt(Math.max(0, u));
};

const beamBetween = (a: THREE.Vector3, b: THREE.Vector3, th: number) => {
  const g = new THREE.BoxGeometry(th, a.distanceTo(b), th);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1));
  return g.applyMatrix4(m);
};
/** sun disc (solid, soft rim) and the flat golden halo (lighting.md 6 / depth.md 6.4: r50 13-26 % of the frame width) */
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
const smokeTex = () => ctex("smoke", 256, 256, (g) => {
  for (const [x, y, r, c] of [[90, 150, 60, "#8f8d96"], [150, 120, 70, "#a3a1aa"], [170, 165, 55, "#8f8d96"], [120, 100, 50, "#b4b2ba"]] as const) {
    g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2); g.fill();
  }
});

/** every lens position of the film looking at its subject: centre, sides and top of frame (houses there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};
/** slab test over the film's sight lines: does this box block any camera ray? */
const makeBlocked = (rays: Ray[]) => (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
  for (const { o, d, len } of rays) {
    let t0 = 0, t1 = len;
    for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) t0 = Infinity; continue; }
      const ta = (a - oo) / dd, tb = (b - oo) / dd;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t0 <= t1) return true;
  }
  return false;
};

/** one golden dragon head (primitives, crisp edges for the ink pass): skull, snout, eyes, swept horns,
 *  and a hinged lower jaw. Local +z is outward; jaw opens by rotating the pivot +x (front drops). */
const makeDragonHead = (gold: THREE.Material, dark: THREE.Material, s = 1) => {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * s, y * s, z * s); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  add(new THREE.SphereGeometry(0.34, 12, 10), gold, 0, 0.1, 0, 0, 0, 0, 0.9, 0.8, 1.15); // skull
  add(new THREE.ConeGeometry(0.2, 0.55, 8), gold, 0, 0.02, 0.5, Math.PI / 2); // snout, pointing +z
  add(new THREE.SphereGeometry(0.09, 10, 8), dark, -0.16, 0.28, 0.22); // eyes
  add(new THREE.SphereGeometry(0.09, 10, 8), dark, 0.16, 0.28, 0.22);
  add(new THREE.SphereGeometry(0.045, 8, 6), gold, -0.16, 0.34, 0.24); // eye glints
  add(new THREE.SphereGeometry(0.045, 8, 6), gold, 0.16, 0.34, 0.24);
  add(new THREE.ConeGeometry(0.06, 0.5, 6), gold, -0.2, 0.3, -0.25, -0.9); // swept horns
  add(new THREE.ConeGeometry(0.06, 0.5, 6), gold, 0.2, 0.3, -0.25, -0.9);
  add(new THREE.ConeGeometry(0.05, 0.3, 6), gold, 0, 0.42, -0.1, -0.5); // crest spike
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.12 * s, 0.22 * s);
  const jawBox = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.08 * s, 0.62 * s), gold);
  jawBox.position.set(0, -0.04 * s, 0.3 * s); jawBox.castShadow = true; jawBox.receiveShadow = true;
  jaw.add(jawBox);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.06 * s, 0.1 * s), dark);
  chin.position.set(0, 0.01 * s, 0.58 * s); jaw.add(chin);
  g.add(jaw);
  return { group: g, jaw };
};

/** one grey-green frog below the jar, mouth open upward (dark mouth box reads as the open gape) */
const makeFrog = (jade: THREE.Material, dark: THREE.Material, s = 1) => {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * s, y * s, z * s); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  add(new THREE.SphereGeometry(0.42, 14, 10), jade, 0, 0.22, 0, 1.15, 0.55, 1); // squat body
  add(new THREE.SphereGeometry(0.3, 12, 8), jade, 0, 0.48, 0.08, 1, 0.7, 0.9); // head
  add(new THREE.SphereGeometry(0.09, 8, 6), dark, -0.14, 0.68, 0.12); // eyes
  add(new THREE.SphereGeometry(0.09, 8, 6), dark, 0.14, 0.68, 0.12);
  add(new THREE.BoxGeometry(0.34, 0.05, 0.22), dark, 0, 0.52, 0.32); // open mouth
  return g;
};

type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<string, THREE.Texture[]>;
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private palace = new THREE.Group(); // intact hall + throne + banquet table (hidden when the palace is rubble)
  private jarGroup = new THREE.Group(); // the giant bronze jar: dragons, balls, jaws, frogs (travels palace <-> camp)
  private ballMeshes: THREE.Mesh[] = [];
  private jawPivots: THREE.Group[] = [];
  private cutGroup = new THREE.Group(); // mechanism cutaway jar at CUTJAR (shots 17-18 only)
  private cutJaws: THREE.Group[] = [];
  private cutBalls: THREE.Mesh[] = [];
  private pendulum = new THREE.Group();
  private rubble = new THREE.Group();
  private crack = new THREE.Group();
  private flames: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: number; ph: number; camp: boolean }[] = [];
  private waves: { mesh: THREE.Mesh; base: Float32Array; phase: number }[] = [];
  private smoke: { m: THREE.Mesh; mat: THREE.MeshLambertMaterial; top: V3; k: number; camp: boolean }[] = [];
  private clouds: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    const rays = sightLines(), blocked = makeBlocked(rays);
    // ---- sky + light ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.cloudMaps = {};
    for (const k of ["day", "golden", "night", "dawn", "warm"] as const) {
      const pal = (LOOK as unknown as Record<string, WorldLook>)[k]?.cloud ?? LOOK.day.cloud;
      this.cloudMaps[k] = [0, 1, 2, 3].map((i) => cloudHD(i, pal));
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- materials ----
    M.bronze = lam("bronzeHD", () => ({ map: bronzeHD() }));
    M.gold = twoTone(new THREE.MeshPhongMaterial({ color: "#c9962e", specular: "#ffe9a8", shininess: 70 }), 0.15);
    M.lacquer = lam("lacquerHD", () => ({ map: lacquerHD() }));
    M.stone = lam("stoneHD", () => ({ map: stoneHD("stoneHD") }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.wood = lam("wood", () => ({ map: beam() }));
    M.roofGold = lam("roofGold", () => ({ map: roofHD("#c9962e") }));
    M.roofRed = lam("roofRed", () => ({ map: roofHD("#b8442f") }));
    M.jade = lam("jade", () => ({ color: "#57a05e" }));
    M.dark = lam("darkMouth", () => ({ color: "#2c2024" }));
    M.cream = lam("cream", () => ({ color: "#ecdab2" }));
    M.rubbleGrey = lam("rubbleGrey", () => ({ map: stoneHD("rubbleHD", ["#a89a88", "#97897a", "#b3a593", "#8d7f70"], "#6f6258") }));
    M.crack = new THREE.MeshBasicMaterial({ color: "#241a20", transparent: true, opacity: 0.95 });

    // ---- ground: cobbled courtyard, grass beyond, hill mound ----
    const b = new Batch();
    b.add(quadUp(-70, 70, -60, 40, 35, 25, 0.001), M.cobble);
    b.add(quadUp(-900, 900, -900, -60, 450, 210), M.grass);
    b.add(quadUp(-900, 900, 40, 900, 450, 215), M.grass);
    b.add(quadUp(-900, -70, -60, 40, 207.5, 25), M.grass);
    b.add(quadUp(70, 900, -60, 40, 207.5, 25), M.grass);
    const mound = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    b.add(mound, M.grass, new THREE.Matrix4().compose(V(HILL[0], D0 - 0.3, HILL[2]), new THREE.Quaternion(), V(15, 6.8, 13)));
    // far hills (incl. the distant northern hills of shot 19)
    const hillGeo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" })), lam("hillC", () => ({ color: "#8bbf63" }))];
    ([[-360, 250, 190, 52, 120], [140, 380, 240, 64, 140], [430, 150, 170, 48, 130], [-440, -130, 190, 44, 150], [-90, -390, 250, 58, 140],
      [320, -330, 210, 54, 130], [520, -60, 160, 40, 120], [-560, 60, 200, 46, 140],
      [-80, -180, 150, 42, 110], [0, -230, 190, 50, 130], [90, -190, 150, 44, 110]] as const).forEach(([x, z, sx, sy, sz], i) =>
      b.add(hillGeo, hm[i % 3], new THREE.Matrix4().compose(V(x, D0 - 2, z), new THREE.Quaternion(), V(sx, sy, sz))));

    // ---- city wall + red gates (z = +25) ----
    b.add(boxGeo(V(-60, D0, 24.4), V(-3, D0 + 7, 25.6), 2), M.stone);
    b.add(boxGeo(V(3, D0, 24.4), V(60, D0 + 7, 25.6), 2), M.stone);
    b.add(boxGeo(V(-3, D0 + 5.5, 24.4), V(3, D0 + 7, 25.6), 2), M.stone); // lintel over the gate
    b.add(boxGeo(V(-60, D0 + 7, 24.4), V(60, D0 + 7.8, 25.6), 2), M.stone); // parapet
    for (let x = -58; x < 60; x += 4) b.add(boxGeo(V(x, D0 + 7.8, 24.6), V(x + 1.6, D0 + 8.6, 25.4), 2), M.stone); // crenellations
    for (const s of [-1, 1]) { // gate towers + gold caps
      b.add(boxGeo(V(s * 3.8 - 1.2, D0, 23.8), V(s * 3.8 + 1.2, D0 + 10, 26.2), 2), M.stone);
      const cap = new THREE.ConeGeometry(1.9, 2.2, 4); cap.rotateY(Math.PI / 4);
      b.add(cap, M.roofGold, new THREE.Matrix4().makeTranslation(s * 3.8, D0 + 11.1, 25));
    }
    // red gate doors (closed), gold bars
    for (const s of [-1, 1]) {
      b.add(boxGeo(V(s * 1.5 - 1.45, D0, 24.9), V(s * 1.5 + 1.45, D0 + 5.4, 25.3), 2), M.lacquer);
      b.add(boxGeo(V(-2.9, D0 + 1.6, 24.85), V(2.9, D0 + 1.85, 25.35), 2), M.gold);
      b.add(boxGeo(V(-2.9, D0 + 3.6, 24.85), V(2.9, D0 + 3.85, 25.35), 2), M.gold);
    }
    // gate banner poles (cloth is dynamic, waves per frame)
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.05, 0.06, 4.4, 8).translate(0, 2.2, 0), M.wood,
      new THREE.Matrix4().makeTranslation(s * 5, D0 + 7.8, 24.2));

    // ---- jar dais (palace) + camp platform (hill) ----
    b.add(boxGeo(V(JAR[0] - 3.2, D0, JAR[2] - 3.2), V(JAR[0] + 3.2, D0 + 0.5, JAR[2] + 3.2), 2), M.stone);
    b.add(boxGeo(V(JAR[0] - 3.4, D0 + 0.5, JAR[2] - 3.4), V(JAR[0] + 3.4, D0 + 0.62, JAR[2] + 3.4), 2), M.gold); // gold trim
    b.add(boxGeo(V(HILL[0] - 3, HILL[1] - 0.4, HILL[2] - 3), V(HILL[0] + 3, HILL[1] + 0.6, HILL[2] + 3), 2), M.stone);
    // campfire stone ring + logs
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      b.add(boxGeo(V(-0.22, -0.12, -0.22), V(0.22, 0.12, 0.22), 1),
        M.rubbleGrey, new THREE.Matrix4().makeTranslation(CAMP_FIRE[0] + Math.cos(a) * 0.9, moundY(CAMP_FIRE[0], CAMP_FIRE[2]) + 0.1, CAMP_FIRE[2] + Math.sin(a) * 0.9));
    }
    for (const ry of [0.5, -0.5]) b.add(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 8).rotateZ(Math.PI / 2).rotateY(ry), M.wood,
      new THREE.Matrix4().makeTranslation(CAMP_FIRE[0], moundY(CAMP_FIRE[0], CAMP_FIRE[2]) + 0.16, CAMP_FIRE[2]));
    // vegetable patch rows (low green mounds) + washing-line poles
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
      const x = 23.5 + k * 0.7, z = -38.5 + r * 0.8;
      b.add(new THREE.SphereGeometry(0.28, 8, 6), M.jade, new THREE.Matrix4().makeTranslation(x, moundY(x, z) + 0.12, z));
    }
    for (const x of [25.5, 29.5]) b.add(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 8).translate(0, 1.1, 0), M.wood,
      new THREE.Matrix4().makeTranslation(x, moundY(x, -31.5), -31.5));
    b.add(beamBetween(V(25.5, moundY(25.5, -31.5) + 2.1, -31.5), V(29.5, moundY(29.5, -31.5) + 2.1, -31.5), 0.03), M.dark);
    b.build(R);

    // ---- palace hall, throne, banquet table (own group: hidden when the palace is rubble) ----
    const pb = new Batch();
    pb.add(boxGeo(V(-10, D0, -18), V(10, D0 + 0.6, 2), 2), M.stone); // hall floor
    for (let i = 0; i < 3; i++) pb.add(boxGeo(V(-6 - i, D0 + 0.6 - (i + 1) * 0.2, 2 + i * 0.7), V(6 + i, D0 + 0.6 - i * 0.2, 2.7 + i * 0.7), 2), M.stone); // front steps
    pb.add(boxGeo(V(-10, D0 + 0.6, -18), V(10, D0 + 7, -17.2), 2), M.lacquer); // back wall
    for (const s of [-1, 1]) pb.add(boxGeo(V(s * 9.2, D0 + 0.6, -18), V(s * 10, D0 + 7, 2), 2), M.lacquer); // side walls
    pb.add(boxGeo(V(-11, D0 + 6.8, -19), V(11, D0 + 7.1, 3), 2), M.gold); // eave slab
    const roof = new THREE.ConeGeometry(15.5, 4.5, 4); roof.rotateY(Math.PI / 4);
    pb.add(roof, M.roofGold, new THREE.Matrix4().makeTranslation(0, D0 + 7 + 2.25, -8)); // gold pyramid roof
    for (const x of [-7.5, 7.5]) for (const z of [-3, -9, -15]) { // red columns, gold base + cap
      pb.add(new THREE.CylinderGeometry(0.35, 0.4, 6.4, 12).translate(0, 3.2, 0), M.lacquer, new THREE.Matrix4().makeTranslation(x, D0 + 0.6, z));
      pb.add(boxGeo(V(x - 0.5, D0 + 0.6, z - 0.5), V(x + 0.5, D0 + 0.9, z + 0.5)), M.gold);
      pb.add(boxGeo(V(x - 0.5, D0 + 6.7, z - 0.5), V(x + 0.5, D0 + 7.0, z + 0.5)), M.gold);
    }
    // gold emblem disc on the back wall
    pb.add(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 24).rotateX(Math.PI / 2), M.gold, new THREE.Matrix4().makeTranslation(0, D0 + 4.6, -17.1));
    // throne dais + throne (gold chair, red cushion)
    pb.add(boxGeo(V(THRONE[0] - 3, D0 + 0.6, THRONE[2] - 2), V(THRONE[0] + 3, D0 + 1.2, THRONE[2] + 2), 2), M.stone);
    pb.add(boxGeo(V(-0.8, D0 + 1.2, -14.6), V(0.8, D0 + 1.7, -13.4), 2), M.gold); // seat
    pb.add(boxGeo(V(-0.8, D0 + 1.2, -15.1), V(0.8, D0 + 3.6, -14.6), 2), M.gold); // tall back
    for (const s of [-1, 1]) pb.add(boxGeo(V(s * 0.8 - 0.14, D0 + 1.7, -14.6), V(s * 0.8 + 0.14, D0 + 2.3, -13.4), 2), M.gold); // arms
    pb.add(boxGeo(V(-0.65, D0 + 1.7, -14.5), V(0.65, D0 + 1.85, -13.5), 2), M.lacquer); // red cushion
    // braziers flanking the throne (bowls on stands; flames are dynamic)
    for (const s of [-1, 1]) {
      pb.add(new THREE.CylinderGeometry(0.5, 0.3, 0.35, 12).translate(0, 0.17, 0), M.bronze, new THREE.Matrix4().makeTranslation(s * 3.5, D0 + 1.2, -12));
      pb.add(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 8).translate(0, 0.5, 0), M.bronze, new THREE.Matrix4().makeTranslation(s * 3.5, D0 + 0.6, -12));
    }
    // banquet table with cups at (4,0,-8)
    pb.add(boxGeo(V(BANQUET[0] - 1.6, D0 + 1.35, BANQUET[2] - 0.6), V(BANQUET[0] + 1.6, D0 + 1.5, BANQUET[2] + 0.6), 2), M.wood);
    for (const [lx, lz] of [[-1.4, -0.45], [1.4, -0.45], [-1.4, 0.45], [1.4, 0.45]] as const)
      pb.add(boxGeo(V(BANQUET[0] + lx - 0.08, D0 + 0.6, BANQUET[2] + lz - 0.08), V(BANQUET[0] + lx + 0.08, D0 + 1.35, BANQUET[2] + lz + 0.08)), M.wood);
    for (const [cx, cz] of [[3.0, -8.3], [4.0, -7.7], [5.0, -8.4], [4.6, -7.6]] as const) {
      pb.add(new THREE.CylinderGeometry(0.09, 0.06, 0.22, 10).translate(0, 0.11, 0), M.gold, new THREE.Matrix4().makeTranslation(cx, D0 + 1.5, cz));
    }
    // small side table by the throne with the emperor's wine cups (shot 7 looks at [1.2, D0+1.3, -12.5])
    pb.add(boxGeo(V(1.5, D0 + 0.6, -13.1), V(2.5, D0 + 0.75, -12.3), 2), M.wood);
    pb.add(boxGeo(V(1.9, D0 + 0.6, -12.8), V(2.1, D0 + 1.0, -12.6)), M.wood);
    pb.add(new THREE.CylinderGeometry(0.1, 0.07, 0.24, 10).translate(0, 0.12, 0), M.gold, new THREE.Matrix4().makeTranslation(2.0, D0 + 0.75, -12.7));
    pb.add(new THREE.CylinderGeometry(0.1, 0.07, 0.24, 10).translate(0, 0.12, 0), M.gold, new THREE.Matrix4().makeTranslation(1.7, D0 + 1.5, -8.2));
    pb.build(this.palace);
    R.add(this.palace);

    // ---- background palace-city houses (red walls, gold/red roofs), never blocking a camera ray ----
    const hb = new Batch();
    const bgHouse = (x: number, z: number, yaw: number, w: number, d: number, h: number, wall: THREE.Material, roofM: THREE.Material) => {
      const hx = w / 2 + 1, hz = d / 2 + 1;
      if (blocked(x - hx, x + hx, D0, D0 + h + d * 0.45 + 1.2, z - hz, z + hz)) return;
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, D0, z);
      hb.add(boxGeo(V(-w / 2, 0, -d / 2), V(w / 2, h, d / 2), 2), wall, m);
      const cap = new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.6, d * 0.45 + 1.2, 4); cap.rotateY(Math.PI / 4 + yaw);
      hb.add(cap, roofM, new THREE.Matrix4().makeTranslation(x, D0 + h + (d * 0.45 + 1.2) / 2, z));
      hb.add(boxGeo(V(-0.5, 0, d / 2), V(0.5, 1.9, d / 2 + 0.15), 1), M.dark, m); // door
      for (const s of [-1, 1]) hb.add(boxGeo(V(s * w * 0.28 - 0.35, h * 0.55, d / 2), V(s * w * 0.28 + 0.35, h * 0.55 + 0.7, d / 2 + 0.12), 1), M.dark, m);
    };
    for (const [x, z] of [[-48, 38], [-36, 46], [-24, 36], [24, 38], [36, 47], [48, 37], [-12, 52], [14, 52]] as const)
      bgHouse(x, z, Math.PI, 8 + ((x * 7) % 3), 7, 6.5 + ((x * 13) % 3), (x + z) % 2 ? M.lacquer : M.cream, (x * z) % 2 ? M.roofGold : M.roofRed);
    for (const [x, z] of [[-40, -32], [-28, -44], [-16, -34], [16, -30]] as const)
      bgHouse(x, z, 0, 8, 7, 7, (x % 2 ? M.lacquer : M.cream), M.roofGold);
    for (const [x, z, yaw] of [[-22, -8, Math.PI / 2], [-24, 10, Math.PI / 2], [22, -12, -Math.PI / 2], [24, 8, -Math.PI / 2]] as const)
      bgHouse(x, z, yaw, 8, 7, 6.5, M.cream, M.roofRed);
    hb.build(R);

    // ---- cartoon trees / bushes / banners (build.ts prop: VEG + banners need no GLB) ----
    const tb = new Batch();
    const tree = (name: string, x: number, y: number, z: number, h: number, yaw = 0) => {
      const r = 0.45 * h;
      if (!blocked(x - r, x + r, y, y + h, z - r, z + r)) prop(tb, kit, name, x, y, z, h, yaw);
    };
    tree("tree_oak", -13, D0, 4, 8); tree("tree_default", 13, D0, 6, 7.5); tree("tree_detailed", -14, D0, -20, 8.5); tree("tree_fat", 14, D0, -20, 7);
    tree("tree_oak", -9, D0, 14, 7); tree("tree_default", 9, D0, 14, 7.5); tree("tree_oak", -9, D0, 20, 8); tree("tree_default", 9, D0, 20, 7);
    tree("tree_oak", 14, D0, -30, 8); tree("tree_default", 18, D0, -46, 9); tree("tree_cone", 38, D0, -26, 9); tree("tree_oak", 42, D0, -42, 8);
    tree("tree_oak", -20, D0, 32, 8); tree("tree_default", 20, D0, 32, 7.5); tree("tree_fat", -30, D0, 30, 8); tree("tree_default", 30, D0, 34, 7);
    tree("plant_bushLarge", -12, D0, -1, 1.4); tree("plant_bush", 12, D0, -1, 1.2); tree("plant_bushDetailed", -11, D0, 10, 1.3);
    tree("plant_bushLarge", 11, D0, 10, 1.4); tree("plant_bush", -6, D0, 22, 1.2); tree("plant_bushDetailed", 6, D0, 22, 1.3);
    tree("plant_bushLarge", 24, D0 + 6, -31, 1.5); tree("plant_bush", 32, D0 + 6, -31, 1.3);
    prop(tb, kit, "banner-red", -6, D0, 22.5, 3.4, 0);
    prop(tb, kit, "banner-green", 6, D0, 22.5, 3.4, Math.PI);
    tb.build(R);

    // ---- the giant bronze jar (dynamic group) ----
    const jar = this.jarGroup;
    const profile: [number, number][] = [[0.01, 0], [1.05, 0], [1.35, 0.15], [1.6, 0.6], [1.72, 1.2], [1.68, 1.8], [1.45, 2.45], [1.15, 2.95], [1.05, 3.15], [1.28, 3.3], [1.3, JAR_RIM]];
    const bodyGeo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 28);
    const body = new THREE.Mesh(bodyGeo, M.bronze);
    body.castShadow = true; body.receiveShadow = true; jar.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 10, 28).rotateX(Math.PI / 2), M.gold);
    rim.position.y = JAR_RIM; rim.castShadow = true; jar.add(rim);
    for (const [y, r] of [[0.6, 1.62], [1.8, 1.7], [2.9, 1.22]] as const) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 28).rotateX(Math.PI / 2), M.gold);
      band.position.y = y; jar.add(band);
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
      const head = makeDragonHead(M.gold, M.dark);
      head.group.position.set(sx * DRAGON_R, JAR_RIM - 0.15, cz * DRAGON_R);
      head.group.rotation.y = a;
      jar.add(head.group);
      this.jawPivots.push(head.jaw);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 14, 10), M.bronze);
      ball.castShadow = true;
      jar.add(ball); this.ballMeshes.push(ball);
      const frog = makeFrog(M.jade, M.dark);
      frog.position.set(sx * FROG_R, 0, cz * FROG_R);
      frog.rotation.y = a; // frogs face outward, mouths under the dragons
      jar.add(frog);
    }
    jar.position.set(...JAR_PALACE);
    R.add(jar);

    // ---- mechanism cutaway jar at CUTJAR (shots 17-18 only) ----
    const cut = this.cutGroup;
    cut.position.set(CUTJAR[0], CUTJAR[1], CUTJAR[2]);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.4, 24), M.stone);
    plinth.position.y = 0.2; plinth.castShadow = true; plinth.receiveShadow = true; cut.add(plinth);
    // shell open toward the camera (cameras at -19,+9 look from +x/+z: opening centred on theta ~0.64)
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.75, 3.4, 24, 1, true, 1.55, Math.PI * 2 - 1.8),
      twoTone(new THREE.MeshLambertMaterial({ map: bronzeHD(), side: THREE.DoubleSide })) as THREE.MeshLambertMaterial);
    shell.position.y = 2.1; shell.castShadow = true; shell.receiveShadow = true; cut.add(shell);
    const cutRim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.09, 10, 28).rotateX(Math.PI / 2), M.gold);
    cutRim.position.y = 3.8; cut.add(cutRim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24).rotateX(-Math.PI / 2), M.dark);
    floor.position.y = 0.42; cut.add(floor);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
      const head = makeDragonHead(M.gold, M.dark, 0.8);
      head.group.position.set(sx * 1.35, 3.65, cz * 1.35);
      head.group.rotation.y = a;
      cut.add(head.group);
      this.cutJaws.push(head.jaw);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), M.bronze);
      ball.castShadow = true;
      cut.add(ball); this.cutBalls.push(ball);
    }
    // pendulum: pivot at the top interior, rod + heavy gold bob; 8 rods from the hub to the dragon heads
    this.pendulum.position.set(0, 3.55, 0);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.7, 0.12).translate(0, -1.35, 0), M.gold);
    rod.castShadow = true; this.pendulum.add(rod);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), M.gold);
    bob.position.y = -2.7; bob.castShadow = true; this.pendulum.add(bob);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.gold);
    this.pendulum.add(hub);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const target = V(Math.sin(a) * 1.3, 0.15, Math.cos(a) * 1.3);
      const rodMesh = new THREE.Mesh(beamBetween(V(0, 0, 0), target, 0.05), M.gold);
      rodMesh.castShadow = true; this.pendulum.add(rodMesh);
    }
    cut.add(this.pendulum);
    cut.visible = false;
    R.add(cut);

    // ---- rubble palace (shot 16 only) ----
    const rb = this.rubble;
    const rubbleAdd = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; rb.add(m); return m;
    };
    rubbleAdd(new THREE.BoxGeometry(0.55, 2.4, 0.55), M.stone, -3.5, D0 + 1.2, -10, 0.12, 0, 0.28); // broken pillars
    rubbleAdd(new THREE.BoxGeometry(0.55, 1.6, 0.55), M.stone, -1.2, D0 + 0.8, -13, -0.1, 0.3, -0.22);
    rubbleAdd(new THREE.BoxGeometry(0.55, 3.0, 0.55), M.stone, 3.8, D0 + 1.5, -11, 0.2, -0.2, 0.35);
    rubbleAdd(new THREE.BoxGeometry(0.55, 1.1, 0.55), M.stone, 1.5, D0 + 0.55, -15, 0.3, 0.4, 0.15);
    rubbleAdd(new THREE.CylinderGeometry(0.35, 0.4, 5.5, 12).rotateZ(Math.PI / 2 - 0.15), M.lacquer, 0.5, D0 + 0.4, -8.5, 0, 0.4, 0); // toppled column
    rubbleAdd(new THREE.BoxGeometry(7.5, 0.45, 0.7), M.roofGold, 0.8, D0 + 0.7, -9, 0.1, 0.5, 0.32); // fallen roof beam
    rubbleAdd(new THREE.BoxGeometry(5, 0.5, 3.5), M.rubbleGrey, -0.5, D0 + 0.25, -12.5, 0, 0.2, 0); // rubble heap base
    for (let k = 0; k < 7; k++) {
      const a = k * 1.7;
      rubbleAdd(new THREE.BoxGeometry(0.5 + (k % 3) * 0.25, 0.4 + (k % 2) * 0.3, 0.5), M.rubbleGrey,
        -0.5 + Math.cos(a) * (1.2 + (k % 3) * 0.5), D0 + 0.7 + (k % 2) * 0.35, -12.5 + Math.sin(a) * 0.9, k, k * 0.7, 0);
    }
    for (let k = 0; k < 6; k++) { // more scattered chunks so the heap reads as a destroyed palace, not a few boxes
      const a = k * 2.4 + 0.8;
      rubbleAdd(new THREE.BoxGeometry(0.4 + (k % 2) * 0.3, 0.35 + (k % 3) * 0.2, 0.45), M.rubbleGrey,
        -2.5 + Math.cos(a) * (2.2 + (k % 2) * 0.8), D0 + 0.35 + (k % 2) * 0.2, -10.5 + Math.sin(a) * 1.6, k * 1.3, k, 0.4);
    }
    rubbleAdd(new THREE.BoxGeometry(0.5, 0.5, 0.5), M.gold, 2.2, D0 + 0.3, -10.5, 0.4, 0.8, 0.2); // a gold throne fragment
    rb.visible = false;
    R.add(rb);

    // ---- ground crack (shot 20, when quake > 0) ----
    const crackMat = M.crack as THREE.MeshBasicMaterial;
    for (const [x, z, w, l, rot] of [[0, 4, 7, 1.0, 0.3], [3, -2, 3.2, 0.6, -0.5]] as const) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(w, l), crackMat);
      c.rotation.set(-Math.PI / 2, 0, rot);
      c.position.set(x, D0 + 0.03, z);
      this.crack.add(c);
    }
    this.crack.visible = false;
    R.add(this.crack);

    // ---- flames (campfire + braziers): unlit cones, flicker per frame ----
    const flameCols = ["#ff7a26", "#ffb02e", "#ffe08a"];
    const addFlame = (x: number, y: number, z: number, s: number, camp: boolean) => {
      for (let k = 0; k < 3; k++) {
        const mat = new THREE.MeshBasicMaterial({ color: flameCols[k], transparent: true, opacity: 0.95 });
        const m = new THREE.Mesh(new THREE.ConeGeometry((0.28 - k * 0.08) * s, (0.7 - k * 0.15) * s, 8), mat);
        m.position.set(x + (k - 1) * 0.07 * s, y + (0.35 - k * 0.07) * s, z);
        m.layers.set(NOINK);
        this.flames.push({ m, mat, base: 1, ph: k * 2.1 + x, camp });
        R.add(m);
      }
    };
    const fy = moundY(CAMP_FIRE[0], CAMP_FIRE[2]);
    addFlame(CAMP_FIRE[0], fy + 0.1, CAMP_FIRE[2], 1.15, true);
    addFlame(-3.5, D0 + 1.55, -12, 0.8, false);
    addFlame(3.5, D0 + 1.55, -12, 0.8, false);

    // ---- waving banners + washing-line cloth (vertex wave per frame) ----
    const addWave = (x: number, y: number, z: number, w: number, h: number, yaw: number, mat: THREE.Material, phase: number) => {
      const geo = new THREE.PlaneGeometry(w, h, 8, 6);
      geo.translate(0, -h / 2, 0); // hangs from its top edge
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z); mesh.rotation.y = yaw;
      mesh.castShadow = true;
      this.waves.push({ mesh, base: (geo.attributes.position.array as Float32Array).slice(), phase });
      R.add(mesh);
    };
    const bannerMat = lam("bannerRed", () => ({ color: "#b8553a", side: THREE.DoubleSide }));
    const bannerMatG = lam("bannerGreen", () => ({ color: "#4f8a5a", side: THREE.DoubleSide }));
    const clothMat = lam("clothWhite", () => ({ color: "#efe6d2", side: THREE.DoubleSide }));
    addWave(-5, D0 + 12.0, 24.2, 1.1, 2.6, 0, bannerMat, 0);
    addWave(5, D0 + 12.0, 24.2, 1.1, 2.6, 0, bannerMatG, 1.3);
    addWave(-9, D0 + 6.6, 1.8, 1.1, 2.4, 0, bannerMat, 2.1);
    addWave(9, D0 + 6.6, 1.8, 1.1, 2.4, 0, bannerMatG, 0.7);
    addWave(26.8, moundY(26.8, -31.5) + 2.05, -31.5, 0.7, 0.9, 0, clothMat, 1.1);
    addWave(28.2, moundY(28.2, -31.5) + 2.05, -31.5, 0.7, 0.9, 0, bannerMat, 2.6);

    // ---- smoke: campfire + braziers (billboarded puffs, rise + fade) ----
    const smokeT = smokeTex();
    const addSmoke = (top: V3, n: number, camp: boolean) => {
      for (let k = 0; k < n; k++) {
        const mat = new THREE.MeshLambertMaterial({ map: smokeT, transparent: true, depthWrite: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        m.layers.set(NOINK);
        this.smoke.push({ m, mat, top, k: k / n, camp }); R.add(m);
      }
    };
    addSmoke([CAMP_FIRE[0], fy + 0.9, CAMP_FIRE[2]], 5, true);
    addSmoke([-3.5, D0 + 2.0, -12], 2, false);
    addSmoke([3.5, D0 + 2.0, -12], 2, false);

    // ---- the CAM agent's near framing objects (from story.ts FOREGROUND) ----
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el.
   *  Shot 20 is the sunrise payoff: the sun sits low ahead-left (el 6) instead of the day preset's high sun. */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const ss = s as ShotDef & { sunAz?: number; sunEl?: number };
    const az = THREE.MathUtils.degToRad(id === 20 ? -15 : ss.sunAz ?? L.az), el = THREE.MathUtils.degToRad(id === 20 ? 6 : ss.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az); // screen right = (-fz, fx)
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], js: JarState = jarState(id, t), L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK); // sky, clouds, smoke and sun sprites live on the no-ink layer but are still rendered
    // ---- light rig (lighting.md 9.4): camera-relative sun frozen per shot, two-tone uniforms, shadow fit ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden" || s.light === "dawn") Rr = Math.max(Rr, 30); // low sun: long shadows need a wide fit
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0; // not used by the two-tone shading
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog (colour = horizon colour, linear fogNear -> fogFar), sun disc + halo, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" || s.light === "dawn" || id === 20;
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    const cloudTexs = this.cloudMaps[s.light] ?? this.cloudMaps.day;
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = cloudTexs[i % 4];
    }
    // ---- foreground framing objects: inside their frames AND their own shot (so a crossfade layer never shows them) ----
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- jar travel: palace (1-8), dragged up the hill through shot 9, camp (10-16, 19-20) ----
    const u9 = id === 9 ? smooth((f - SHOTS[8].a) / (SHOTS[8].b - SHOTS[8].a)) : id <= 8 ? 0 : 1;
    const jx = JAR_PALACE[0] + (JAR_CAMP[0] - JAR_PALACE[0]) * u9;
    const jz = JAR_PALACE[2] + (JAR_CAMP[2] - JAR_PALACE[2]) * u9;
    const jy = JAR_PALACE[1] + (JAR_CAMP[1] - JAR_PALACE[1]) * u9;
    const sh = js.jarShake;
    const jx2 = (Math.sin(t * 31.7) * 0.5 + Math.sin(t * 47.3) * 0.3) * 0.05 * sh;
    const jz2 = (Math.sin(t * 29.1 + 1.7) * 0.5 + Math.sin(t * 43.9 + 0.6) * 0.3) * 0.05 * sh;
    this.jarGroup.position.set(jx + jx2, jy + Math.abs(Math.sin(t * 37.7)) * 0.03 * sh, jz + jz2);
    this.jarGroup.rotation.z = Math.sin(t * 41.3) * 0.02 * sh;
    this.jarGroup.rotation.x = Math.sin(t * 35.9 + 2.0) * 0.015 * sh;
    // ---- balls + dragon jaws (main jar and cutaway jar share the same JarState.balls) ----
    const seat = new THREE.Vector3(), frog = new THREE.Vector3();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, u = clamp01(js.balls[k] ?? 0);
      seat.set(Math.sin(a) * MOUTH_R, JAR_RIM + 0.05, Math.cos(a) * MOUTH_R);
      frog.set(Math.sin(a) * FROG_R, 0.72, Math.cos(a) * FROG_R);
      const p = seat.lerp(frog, u); p.y += Math.sin(Math.PI * u) * 1.0;
      this.ballMeshes[k].position.copy(p);
      this.jawPivots[k].rotation.x = 0.1 + 0.8 * u;
      this.cutBalls[k].position.set(Math.sin(a) * 1.55, 3.55 - u * 2.2 + Math.sin(Math.PI * u) * 0.5, Math.cos(a) * 1.55);
      this.cutJaws[k].rotation.x = 0.1 + 0.8 * u;
    }
    // ---- pendulum, cutaway visibility, rubble, crack, quake ----
    this.pendulum.rotation.z = js.pendulum;
    this.cutGroup.visible = id === 17 || id === 18;
    this.rubble.visible = js.rubble;
    this.palace.visible = !js.rubble;
    this.crack.visible = js.quake > 0;
    ((this.crack.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.95 * clamp01(js.quake * 1.5);
    const q = js.quake;
    const qx = (Math.sin(t * 13.7) * 0.5 + Math.sin(t * 29.3) * 0.3 + Math.sin(t * 47.1) * 0.2) * 0.08 * q;
    const qz = (Math.sin(t * 17.3 + 1.3) * 0.5 + Math.sin(t * 31.1 + 0.4) * 0.3) * 0.08 * q;
    this.root.position.set(qx, Math.sin(t * 23.7) * 0.03 * q, qz);
    // ---- campfire + brazier flames (braziers die with the palace in the rubble shot) ----
    for (const fl of this.flames) {
      if (!fl.camp && js.rubble) { fl.m.visible = false; continue; }
      fl.m.visible = true;
      const flick = 1 + 0.22 * Math.sin(t * 11 + fl.ph) + 0.12 * Math.sin(t * 23 + fl.ph * 2);
      fl.m.scale.set(1, flick, 1);
      fl.mat.opacity = 0.85 + 0.15 * Math.sin(t * 17 + fl.ph);
    }
    // ---- waving banners / washing cloth ----
    for (const w of this.waves) {
      const pos = w.mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const bx = w.base[i * 3], by = w.base[i * 3 + 1], depth = -by / 2.6; // 0 at the top edge .. ~1 at the hem
        pos.setZ(i, (0.03 + 0.07 * depth) * Math.sin(t * 3 + bx * 4 + w.phase) + 0.03 * depth * depth * Math.sin(t * 2.1 + w.phase * 2));
      }
      pos.needsUpdate = true;
      w.mesh.geometry.computeVertexNormals();
    }
    // ---- smoke (brazier smoke dies with the palace) ----
    for (const sm of this.smoke) {
      if (!sm.camp && js.rubble) { sm.m.visible = false; continue; }
      sm.m.visible = true;
      const uu = (t * 0.11 + sm.k) % 1, sz = 3 + uu * 9;
      sm.m.position.set(sm.top[0] - uu * 18, sm.top[1] + uu * 13 + uu * uu * 4, sm.top[2] + uu * 3);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.85 * (1 - uu) ** 1.2;
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, js, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint); // legacy emissive card until the CHAR agent's cardShade lands
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}

/** horizontal quad facing up at height D0 + dy covering x0..x1, z0..z1 (z0 < z1) */
function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = D0 + dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
