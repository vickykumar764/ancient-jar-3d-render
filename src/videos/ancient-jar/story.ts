// Timeline of the Ancient Jar short (Hindi remake of Rick's Clips "The Ancient Jar That Warned an Empire"):
// shots timed to the voice words (remotion/voice/words.json, 18 lines, 95.932 s = 2878 frames @30fps),
// story physics (jar balls, pendulum, quake, rubble) and the camera grammar measured in the reference study:
// continuous slow push-ins; symmetric ease-in-out moves ~23 f (10 in / 10 out), peak ~15 px/f at 720p;
// big reframes are cuts; impacts are 7-frame kicks that flip sign every frame; no hand-held float.
// World layout (fixed, all agents use these): palace courtyard at origin; jar dais (0,0,-6); throne (0,0,-14);
// banquet table (4,0,-8); city wall + red gates z=+25; hilltop camp mound at (28,0,-35), camp on top y~D0+6;
// mechanism cutaway jar at (-22,0,5). Ground level D0 = 6.0 (bridge convention).
export const FPS = 30;
export const TOTAL = 2878;
export const D0 = 6.0; // ground level (m)
export type V3 = [number, number, number];

/** fixed world anchors (all agents use these) */
export const JAR: V3 = [0, D0, -6]; // jar dais, palace courtyard
export const THRONE: V3 = [0, D0, -14];
export const BANQUET: V3 = [4, D0, -8];
export const GATES: V3 = [0, D0, 25]; // city wall + red gates
export const HILL: V3 = [28, D0 + 6, -35]; // hilltop camp mound, camp on top
export const CUTJAR: V3 = [-22, D0, 5]; // mechanism cutaway jar

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- story physics (tau = story time in seconds) ----------------
export type Light = "day" | "golden" | "night" | "dawn" | "warm";
export type ShotDef = { id: number; a: number; b: number; light: Light; tau: (t: number) => number; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 208, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S1 L01 hook: ball into the dragon's mouth
  { id: 2, a: 209, b: 272, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S2 L02 court laughs
  { id: 3, a: 273, b: 430, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S3a L03a orbit the jar: 8 dragons
  { id: 4, a: 431, b: 584, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S3b L03b low angle: balls + frogs
  { id: 5, a: 585, b: 784, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S4 L04 emperor's pride
  { id: 6, a: 785, b: 914, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S5 L05 one ball drops (f850, on "गिरी" f853), nothing happens
  { id: 7, a: 915, b: 1015, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S6 L06 wine cup: not a ripple
  { id: 8, a: 1016, b: 1081, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S7 L07 court roars louder
  { id: 9, a: 1082, b: 1313, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S8 L08 exile: dragged out with the jar
  { id: 10, a: 1314, b: 1504, light: "golden", tau: (t) => t, sunAz: 6, sunEl: 7 }, // S9 L09 hilltop camp at sunset
  { id: 11, a: 1505, b: 1600, light: "night", tau: (t) => t, sunAz: 210, sunEl: 28 }, // S10a L10a night: one ball, then a second
  { id: 12, a: 1601, b: 1681, light: "night", tau: (t) => t, sunAz: 210, sunEl: 28 }, // S10b L10b night: all eight at once
  { id: 13, a: 1682, b: 1820, light: "night", tau: (t) => t, sunAz: 210, sunEl: 28 }, // S11 L11 run to the gates by torchlight
  { id: 14, a: 1821, b: 1953, light: "night", tau: (t) => t, sunAz: 210, sunEl: 28 }, // S12 L12 guards mock him at the gate
  { id: 15, a: 1954, b: 2071, light: "golden", tau: (t) => t, sunAz: 6, sunEl: 7 }, // S13 L13 trudges back up the hill
  { id: 16, a: 2072, b: 2183, light: "dawn", tau: (t) => t, sunAz: 8, sunEl: 5 }, // S14 L14 dawn: the palace is rubble
  { id: 17, a: 2184, b: 2354, light: "warm", tau: (t) => t, sunAz: 60, sunEl: 15 }, // S15a L15 mechanism cutaway: pendulum hangs
  // S15b L16 mechanism demo, replayed twice: tau = seconds since the shot started, so the pendulum phase
  // functions read 0 at the shot start and the two strikes land at tau 2.9 (f2442, on "टकराता") and tau 5.0 (f2505, on "जबड़ा").
  { id: 18, a: 2355, b: 2576, light: "warm", tau: (t) => t - 78.5, sunAz: 60, sunEl: 15 },
  { id: 19, a: 2577, b: 2677, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S16 L17 one ball: distant hills ripple
  { id: 20, a: 2678, b: 2878, light: "day", tau: (t) => t, sunAz: 75, sunEl: 48 }, // S17 L18 eight balls: ground splits, jar stands in the sun
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 10: 8, 11: 8, 15: 8, 16: 8, 17: 8, 19: 6, 20: 6 };
export const FLASH_AT = 208;

/** shot boundaries are 1 frame apart at hard cuts (the next shot's `a` is the previous shot's `b` + 1);
 *  a frame falling in the 1-frame gap renders the shot that just ended (the outgoing shot of the cut),
 *  never the last shot of the film (the old fallback returned SHOTS[last], so 10 cut frames would
 *  have flashed the finale's wide shot for 1/30 s each). */
export const shotAt = (f: number) => {
  const exact = SHOTS.find((s) => f >= s.a && f < s.b);
  if (exact) return exact;
  const prev = [...SHOTS].reverse().find((s) => f >= s.b);
  return prev ?? SHOTS[0];
};
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

/** jar physics. balls: 8 entries, 0 = seated in a dragon mouth, 1 = dropped into a frog mouth (0->1 over ~12 f).
 *  pendulum: swing angle in radians, 0 at rest. quake: 0..1 earthquake shake. jarShake: 0..1 jar shudder.
 *  rubble: the palace is rubble (shot 16 only). */
export type JarState = { balls: number[]; pendulum: number; quake: number; jarShake: number; rubble: boolean };
/** one ball's 0->1 fall starting at frame f0 (12-frame ease) */
const dropAt = (f: number, f0: number) => smooth((f - f0) / 12);
/** a single-drop shudder pulse: 0.2 at the drop frame, decaying to 0 over 15 f */
const dropShake = (f: number, f0: number) => (f < f0 ? 0 : 0.2 * Math.max(0, 1 - (f - f0) / 15));
/** one pendulum burst around a strike at tau c (shot-18 story time): swings up to +/-0.35 rad, strike at the peak */
const burst = (tau: number, c: number) => {
  if (tau < c - 1.2 || tau > c + 1.5) return 0;
  const env = smooth((tau - (c - 1.2)) / 0.5) * (1 - smooth((tau - c) / 1.5));
  return 0.35 * Math.sin(2 * Math.PI * 1.1 * (tau - c + 1.2)) * env;
};
export const jarState = (id: number, t: number): JarState => {
  const f = t * FPS;
  const tau = SHOTS[id - 1].tau(t);
  let balls = [0, 0, 0, 0, 0, 0, 0, 0];
  let pendulum = 0;
  let quake = 0;
  let jarShake = 0;
  if (id === 6) { balls[0] = dropAt(f, 850); jarShake = dropShake(f, 850); } // S5: one ball falls (f850, on "गिरी" f853), nothing happens
  else if (id >= 7 && id <= 10) { balls[0] = 1; } // the fallen ball stays down through the laughter, exile and sunset
  else if (id === 11) { // S10a night: ball 1 at f1574 (on "गिरी" f1577), ball 2 at f1612 (on "दूसरी" f1615); inventor sits up
    balls[0] = 1; balls[1] = dropAt(f, 1574); balls[2] = dropAt(f, 1612);
    jarShake = Math.max(dropShake(f, 1574), dropShake(f, 1612));
  } else if (id === 12) { // S10b night: all eight down by f1671-1678 (balls 1,2 already down, the other five drop staggered on "आठों" f1674)
    balls = [1, 1, 1, dropAt(f, 1671), dropAt(f, 1672), dropAt(f, 1673), dropAt(f, 1674), dropAt(f, 1675)];
    jarShake = 0.5;
  } else if (id >= 13 && id <= 16) { balls = [1, 1, 1, 1, 1, 1, 1, 1]; } // jar off-screen (run, gate, hill, rubble): balls stay down
  else if (id === 17) { balls = [0, 0, 0, 0, 0, 0, 0, 0]; } // cutaway jar at rest: pendulum hangs, all balls seated
  else if (id === 18) { // mechanism demo, replayed twice: strikes at f2442 ("टकराता") and f2505 ("जबड़ा"); both demo balls drop on "गिर" f2566
    balls[0] = dropAt(f, 2563); balls[1] = dropAt(f, 2563);
    pendulum = burst(tau, 2.9) + burst(tau, 5.0);
    jarShake = Math.max(dropShake(f, 2563), dropShake(f, 2563));
  } else if (id === 19) { // S16: one ball = far away (f~2600)
    balls[0] = dropAt(f, 2600); jarShake = dropShake(f, 2600);
  } else if (id === 20) { // S17: eight balls = right underneath; staggered drops from f~2700
    balls = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => dropAt(f, 2700 + k * 8));
    quake = 0.8 * smooth((f - 2700) / 60) * (1 - smooth((f - 2800) / 50)); // ramps up ~f2700, peak ~0.8, 0 by f2850
    pendulum = 0.5 * Math.sin(2 * Math.PI * 0.9 * (t - 89.27)) * (quake / 0.8 || 0);
  }
  return { balls, pendulum, quake, jarShake, rubble: id === 16 };
};

// ---------------- camera ----------------
// Grammar (motion.md / SKILL.md): every move is a symmetric smootherstep glide of 18-40 f (peak speed = 1.875 x distance / dur,
// so dur >= 0.075 x the move in 720p px keeps the peak near the reference 14-25 px/f); a reframe bigger than about
// half a frame width or 40 % zoom is a hard cut on its key frame. Glides are centred on the old key frame (the
// whoosh in the sound mix peaks there), so a glide key starts dur/2 earlier. Holds push in (dolly toward the look
// point or a fov zoom near walls/towers): 0.15-0.35 %/f, ~0.6 %/f for ~35 f on the punch words. Rolls of 4-4.6 deg
// over >= 18 f on emphasis beats, held tilt <= 0.07 rad.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** reference camera ease: symmetric smootherstep (attack = release, ~10 f each on a 23 f move) */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (with 8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** dolly push: camera slides toward the look point by factor k */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** zoom push (camera stays put, for lenses next to walls / pillars): tan(fov/2) shrinks by k */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** a roll-only move on top of an existing framing */
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

// focus anchors (eyes / mouths / the jar) for the DOF table
const jarMouth: V3 = [0, D0 + 3.6, -4.3]; // dragon mouths on the camera side (seats y ~D0+4.0, z -4.05)
const emperorEyes: V3 = [0, D0 + 2.7, -14]; // seated emperor's eyes (mesh y D0+1.45, scale 1.12)
const emperorStand: V3 = [0, D0 + 3.3, -14]; // standing emperor's eyes (feet on the throne dais, D0+1.2)
const frogMouth: V3 = [0, D0 + 2.6, -3.8]; // mid-fall of ball 0 (seat 10.0 -> frog 7.22), camera side
/** ball 0's frog mouth (where the shot-6 ball lands): seat (0,10,-4.05) -> frog (0,7.22,-3.15) */
const ball0Frog: V3 = [0, D0 + 1.22, -3.15];
const wineCup: V3 = [0.85, D0 + 1.55, -13.3]; // emperor's cup in his lap (seat top D0+1.7)
const hillJar: V3 = [29.3, D0 + 8.0, -33.2]; // night ball-drop area: ball-1 seat/frog + inventor by the fire
const pendulumPt: V3 = [-22, D0 + 2.2, 5];

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// shot 1 (hook): hands place the ball in the dragon's mouth -> slow push-in to the jar ->
// the em-dash pause (~f126, 4.2 s) pushes to the emperor's face
const S1a = (f: number) => dolly([2.4, D0 + 4.0, 2.8], [0, D0 + 3.2, -4.3], pushK(f, 0, 0.0025), { fov: 38 }); // hook: inventor below, dragon mouths above (was 4.1 m off the jar wall)
const S1b = (f: number) => dolly([2.2, D0 + 2.1, -9.5], emperorEyes, pushK(f, 126, 0.002, 0.006, 35), { fov: 36, roll: -0.03 });
const S1c = (f: number) => dolly([1.4, D0 + 1.9, -11.0], emperorEyes, pushK(f, 170, 0.0025), { fov: 34, roll: 0.03 });
// shot 2 (court laughs): wide throne hall, inventor small centre-frame, emperor chuckling
const S2a = (f: number) => dolly([7.0, D0 + 3.2, 2.0], [0, D0 + 1.6, -10], pushK(f, 209, 0.002), { fov: 44 });
// shot 3 (jar reveal 1): slow orbit around the giant bronze jar, 8 golden dragons coiled round it
const S3a = (f: number) => dolly([5.5, D0 + 2.4, -0.5], [0, D0 + 2.0, -6], pushK(f, 273, 0.0018), { fov: 42 });
const S3b = (f: number) => dolly([-5.0, D0 + 2.8, -11.5], [0, D0 + 2.0, -6], pushK(f, 360, 0.0018), { fov: 42 });
// shot 4 (jar reveal 2): low angle, bronze balls in dragon mouths, frogs below with open mouths
const S4a = (f: number) => dolly([2.6, D0 + 2.0, 1.8], [0, D0 + 2.6, -3.8], pushK(f, 431, 0.0025), { fov: 40 }); // balls (10.0) AND frogs (7.22) both in frame
const S4b = (f: number) => dolly([1.6, D0 + 1.6, 0.6], [0, D0 + 2.6, -3.8], pushK(f, 500, 0.002), { fov: 36 });
// shot 5 (emperor's pride): emperor on throne, army banners behind; dismissive wave
const S5a = (f: number) => dolly([3.5, D0 + 2.2, -6.0], emperorStand, pushK(f, 585, 0.002), { fov: 40 });
const S5b = (f: number) => dolly([2.4, D0 + 2.0, -8.5], emperorStand, pushK(f, 690, 0.0018, 0.006, 30), { fov: 38, roll: 0.05 });
// shot 6 (false alarm): close on ONE ball dropping into the frog's mouth; courtiers glance; nothing happens
const S6a = (f: number) => dolly([2.2, D0 + 3.0, 1.6], [0, D0 + 2.6, -3.6], pushK(f, 785, 0.0025), { fov: 40 }); // whole fall path in frame: seat 10.0 -> frog 7.22
const S6b = (f: number) => dolly([1.8, D0 + 3.0, 0.9], [0, D0 + 2.7, -3.6], pushK(f, 838, 0.002), { fov: 38, roll: -0.04 });
// shot 7 (wine cup): extreme close on the emperor's wine cup — not even a ripple
const S7a = (f: number) => dolly([1.9, D0 + 1.9, -11.2], wineCup, pushK(f, 915, 0.003), { fov: 32 });
// shot 8 (louder laughter): court roars; inventor shrinking in frame, head bowed
const S8a = (f: number) => dolly([-5.0, D0 + 2.6, 0.0], [0, D0 + 1.2, -8], pushK(f, 1016, 0.002), { fov: 44 });
// shot 9 (exile): emperor points to the gate -> guards drag the inventor out with the jar
const S9a = (f: number) => dolly([4.0, D0 + 2.4, -8.0], emperorStand, pushK(f, 1082, 0.002), { fov: 40, roll: 0.04 });
const S9b = (f: number) => dolly([3.0, D0 + 2.0, 16.0], [0, D0 + 1.2, 2.0], pushK(f, 1180, 0.002), { fov: 42 });
// shot 10 (hilltop camp, golden): inventor drags the jar up the hill, settles alone; campfire, vegetable patch
const S10a = (f: number) => dolly([20.0, D0 + 9.0, -24.0], [28, D0 + 7.0, -35], pushK(f, 1314, 0.0016), { fov: 44 });
const S10b = (f: number) => dolly([39.0, D0 + 8.5, -31.5], [29.5, D0 + 7.0, -32.0], pushK(f, 1400, 0.002), { fov: 40 }); // due EAST, low: inventor (30,-31.5) + fire (30.5,-33) sit IN FRONT of the jar's east face (jar surface at z -31.5 reaches x 29.56 < 30; fire y 12.3 is below the jar base 14). Settled framing verified f1470 PASS. NOTE: f1415 stills (twice FAIL) were mid-glide frames (glide 1400-1430, f1415 = 50% mix) — the inventor was out of frame because the mid-glide look direction put him ~14 deg to the side, NOT because of occlusion; judge this shot only on settled frames f1430+.
// shot 11 (night, one ball): night blue; ONE ball drops in the dark; inventor sits up
const S11a = (f: number) => dolly([33.0, D0 + 9.6, -28.0], [29.3, D0 + 8.2, -33.2], pushK(f, 1505, 0.0025), { fov: 36 }); // night jar + inventor by the fire
const S11b = (f: number) => dolly([33.5, D0 + 9.6, -27.0], [29.5, D0 + 8.0, -33.0], pushK(f, 1564, 0.002), { fov: 38 }); // ball 1 falls (seat 16.1 -> frog 13.32) + inventor sits up
// shot 12 (night, all eight): the jar shudders; balls rain into the frogs
const S12a = (f: number) => dolly([32.0, D0 + 9.8, -27.5], [29.0, D0 + 8.3, -33.5], pushK(f, 1601, 0.002), { fov: 40 }); // all eight rain + inventor standing, shock
// shot 13 (run to the gates, night): inventor runs down by torchlight, shouting, arms waving
const S13a = (f: number) => dolly([14.0, D0 + 4.0, -8.0], [24, D0 + 6.5, -28], pushK(f, 1682, 0.002), { fov: 42 });
const S13b = (f: number) => dolly([6.0, D0 + 2.2, 10.0], [1, D0 + 1.5, 20], pushK(f, 1750, 0.0025), { fov: 40 });
// shot 14 (guards mock him, night): guards at the gate laughing, pointing back up the hill
const S14a = (f: number) => dolly([3.5, D0 + 2.0, 17.0], [0, D0 + 1.7, 24], pushK(f, 1821, 0.002), { fov: 40 });
const S14b = (f: number) => dolly([2.2, D0 + 1.9, 19.5], [0, D0 + 1.7, 24], pushK(f, 1880, 0.002, 0.006, 30), { fov: 37, roll: -0.05 });
// shot 15 (sent back, golden): inventor trudges back up the hill at dawn; small against the sky
const S15a = (f: number) => dolly([14.0, D0 + 2.5, -16.0], [28, D0 + 8.0, -35], pushK(f, 1954, 0.0016), { fov: 44 });
// shot 16 (rubble, dawn): the palace is a heap of rubble; dust, broken pillars, a fallen roof beam
const S16a = (f: number) => dolly([6.0, D0 + 4.5, -24.0], [0, D0 + 1.2, -11.0], pushK(f, 2072, 0.0018), { fov: 44 }); // from the north: rubble heap centre-frame, the empty jar dais behind it (was: dais filled the foreground)
const S16b = (f: number) => dolly([2.0, D0 + 2.6, -22.0], [0, D0 + 1.0, -12.0], pushK(f, 2120, 0.002), { fov: 40 });
// shot 17 (mechanism cutaway, warm): inside the jar, the heavy golden pendulum hangs; rods to each dragon
const S17a = (f: number) => dolly([-16.8, D0 + 2.8, 10.8], [-22, D0 + 2.0, 5], pushK(f, 2184, 0.002), { fov: 38 }); // whole cutaway interior (was 2.9-5 m: wall + rod only)
const S17b = (f: number) => dolly([-17.6, D0 + 2.6, 9.6], [-22, D0 + 2.0, 5], pushK(f, 2260, 0.0025), { fov: 36 });
// shot 18 (how it works, warm): tremor -> pendulum swings -> rod strikes -> jaw snaps open -> ball drops (x2)
const S18a = (f: number) => dolly([-16.8, D0 + 2.8, 10.8], [-22, D0 + 2.0, 5], pushK(f, 2355, 0.002), { fov: 38 });
const S18b = (f: number) => dolly([-17.8, D0 + 2.4, 9.2], [-22, D0 + 1.9, 5], pushK(f, 2430, 0.0025), { fov: 34, roll: 0.04 }); // strike: rod + jaw + ball in frame
const S18c = (f: number) => dolly([-17.2, D0 + 2.8, 10.0], [-22, D0 + 2.0, 5], pushK(f, 2493, 0.0025), { fov: 36, roll: -0.04 });
// shot 19 (one ball, day): distant hills, a small ripple running through the ground
const S19a = (f: number) => dolly([6.0, D0 + 6.0, -18.0], [0, D0 + 4.0, -70], pushK(f, 2577, 0.0016), { fov: 44 });
const S19b = (f: number) => dolly([4.0, D0 + 4.5, -22.0], [0, D0 + 1.0, -40], pushK(f, 2620, 0.002), { fov: 42 });
// shot 20 (eight balls, day): the ground splits under the palace; payoff — the jar stands intact on the hill
// in the rising sun; the last 30 f (1 s) hold on the jar with a slow push-in.
const S20a = (f: number) => dolly([7.0, D0 + 4.0, 8.0], [0, D0 + 1.5, -10], pushK(f, 2678, 0.002), { fov: 44, roll: -0.03 });
const S20b = (f: number) => dolly([19.0, D0 + 10.0, -22.0], [28, D0 + 7.5, -35], pushK(f, 2760, 0.0016), { fov: 42 });

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 126, dur: 24, s: S1b }, // centred on 138: the em-dash pause pushes to the emperor's face
    { f: 170, dur: 20, s: S1c }, // centred on 180: closer on the emperor's eyes, roll flips
  ],
  2: [{ f: 209, s: S2a }],
  3: [
    { f: 273, s: S3a },
    { f: 360, dur: 40, s: S3b }, // slow orbit round the jar, centred on 380
  ],
  4: [
    { f: 431, s: S4a },
    { f: 500, dur: 24, s: S4b }, // centred on 512: closer on the balls and frogs
  ],
  5: [
    { f: 585, s: S5a },
    { f: 690, dur: 24, s: S5b }, // centred on 702: the dismissive wave, punch push + roll
  ],
  6: [
    { f: 785, s: S6a },
    { f: 838, dur: 24, s: S6b }, // centred on 850: the ball drops (kick), roll -0.04
  ],
  7: [{ f: 915, s: S7a }],
  8: [{ f: 1016, s: S8a }],
  9: [
    { f: 1082, s: S9a }, // emperor points to the gate
    { f: 1180, dur: 30, s: S9b }, // centred on 1195: guards drag the inventor toward the gates
  ],
  10: [
    { f: 1314, s: S10a }, // golden hilltop wide (crossfade in from the palace)
    { f: 1400, dur: 30, s: S10b }, // centred on 1415: closer on the inventor, jar and campfire
  ],
  11: [
    { f: 1505, s: S11a }, // night: close on the jar in the dark
    { f: 1564, dur: 20, s: S11b }, // centred on 1574: the inventor sits up (first ball drops f1574)
  ],
  12: [
    { f: 1601, s: S12a },
    { f: 1664, dur: 20, s: rolled(S12a, 0.06) }, // all eight drop (kick at 55.7 s): roll 3.4 deg through level
  ],
  13: [
    { f: 1682, s: S13a }, // following the run down from the hill
    { f: 1750, dur: 30, s: S13b }, // centred on 1765: closer, near the gates by torchlight
  ],
  14: [
    { f: 1821, s: S14a },
    { f: 1880, dur: 24, s: S14b }, // centred on 1892: the mocking line, punch push + roll
  ],
  15: [{ f: 1954, s: S15a }],
  16: [
    { f: 2072, s: S16a }, // dawn rubble wide (crossfade in)
    { f: 2120, dur: 30, s: S16b }, // centred on 2135: closer on the broken pillars and fallen beam
  ],
  17: [
    { f: 2184, s: S17a }, // warm cutaway reveal (crossfade in)
    { f: 2260, dur: 30, s: S17b }, // centred on 2275: closer on the hanging pendulum
  ],
  18: [
    { f: 2355, s: S18a },
    { f: 2430, dur: 24, s: S18b }, // centred on 2442: first strike (on "टकराता" f2445), rod and jaw
    { f: 2493, dur: 24, s: S18c }, // centred on 2505: jaw snaps (on "जबड़ा" f2508), other side
  ],
  19: [
    { f: 2577, s: S19a }, // distant hills wide (crossfade in)
    { f: 2620, dur: 24, s: S19b }, // centred on 2632: the ripple running through the ground
  ],
  20: [
    { f: 2678, s: S20a }, // the ground splits under the palace (quake kick at 90.0 s)
    { f: 2760, dur: 40, s: S20b }, // centred on 2780: glide out to the hill — the jar stands intact in the rising sun; 1 s hold
  ],
};

// impact kicks (reference v14): the image offset flips sign every frame (~3 px at 720p per unit), decays to 0 in
// 7 f, roll +-0.23 deg per unit; they start on the first frame at/after the event. No hand-held float.
// Ball drops (f850 / f1574 / f1612 / f1671-1678) and the quake start (f2700) — all grounded in words.json (3f before the word).
const KICKS: [number, number][] = [[28.33, 0.7], [52.47, 0.7], [53.73, 0.7], [55.7, 1.6], [90.0, 1.6]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a; // metres at the look distance for 3 px x a
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
/** Lens blur per shot (thin lens). cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
 *  Reference: DOF on in ~1/3 of shots; when on, background sigma720 CU 4.2, MS 4.0, FS 2.7, WS 1.9,
 *  foreground objects 4-8 (disc radius at 1080p = 3 x sigma720). Establishing/wide/most full shots stay sharp.
 *  Entries switch on cuts (no dur) or ramp with the camera glide they share f/dur with. focus = world point (else the
 *  camera look point). DOF is on for ~987 f of 2878 (~34%): hook, balls/frogs, ball drop, wine cup, night jar, mechanism. */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 15, focus: () => jarMouth }, // hook: hands + jar sharp, hall soft
  { f: 126, dur: 24, cInf: 14, focus: () => emperorEyes }, // emperor's face at the em-dash (ramps with the glide)
  { f: 209, cInf: 0 }, // wide throne hall (establishing, kept sharp)
  { f: 273, cInf: 0 }, // jar orbit (reveal, kept sharp)
  { f: 431, cInf: 12, focus: () => frogMouth }, // balls in dragon mouths, frogs below
  { f: 585, cInf: 0 }, // emperor on throne, banners behind (kept readable)
  { f: 785, cInf: 14, focus: () => ball0Frog }, // the one ball drops (focus on ball 0's frog)
  { f: 915, cInf: 16, focus: () => wineCup }, // wine cup ECU: not even a ripple
  { f: 1016, cInf: 0 }, // court roars (wide, kept sharp)
  { f: 1082, cInf: 0 }, // exile (action beat, kept sharp)
  { f: 1314, cInf: 0 }, // hilltop camp wide (golden establishing)
  { f: 1505, cInf: 14, focus: () => hillJar }, // night: the jar in the dark
  { f: 1601, dur: 20, cInf: 12, focus: () => hillJar }, // all eight drop (ramps with the roll)
  { f: 1682, cInf: 0 }, // run to the gates (action, kept sharp)
  { f: 1821, cInf: 0 }, // guards at the gate (kept sharp so the pointing reads)
  { f: 1954, cInf: 0 }, // trudge back up the hill (wide silhouette)
  { f: 2072, cInf: 0 }, // dawn rubble (kept readable)
  { f: 2184, cInf: 0 }, // mechanism cutaway reveal (interior, kept sharp)
  { f: 2355, dur: 24, cInf: 12, focus: () => pendulumPt }, // pendulum swings, rod strikes, jaw snaps
  { f: 2577, cInf: 0 }, // distant hills (wide)
  { f: 2678, cInf: 0 }, // ground splits + payoff (wide, kept sharp)
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on (DOF): the DOF table's focus point, else the camera look point */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects: visible while a <= f < b; kit = a GLB name accepted by build.ts prop() */
// pos = base point (prop()'s x, y, z: the model's base sits on y), s = height in metres (prop()'s h), yaw in radians.
// They sit at 0.3-0.5 x the focus distance and cover 10-25 % of one frame edge, never a face; they are meant to be
// in front of the lens, so build them outside prop()'s sight-line test.
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // ranges stay inside one shot (world.ts shows an entry only inside its own shot, so crossfade layers never see it).
  // throne hall (shot 2): a red banner at the hall's edge, right of the lens
  { a: 209, b: 272, kit: "banner-red", pos: [6.8, D0, -1.0], s: 2.4, yaw: 0.3 },
  // exile (shot 9, second framing): a cart on the gate path, bottom-right of the drag
  { a: 1180, b: 1313, kit: "cart", pos: [4.5, D0, 10.5], s: 0.9, yaw: 0.4 },
  // hilltop camp (shot 10): a lantern by the campfire, and a large bush on the hillside (y = mound surface)
  { a: 1314, b: 1504, kit: "lantern", pos: [26.2, D0 + 6.3, -32.5], s: 0.8, yaw: 0 },
  { a: 1314, b: 1504, kit: "plant_bushLarge", pos: [23.5, D0 + 5.75, -30.5], s: 1.6, yaw: 0.5 },
  // run to the gates (shot 13): a lantern at the gate approach, torchlight side
  { a: 1682, b: 1820, kit: "lantern", pos: [5.5, D0, 15.0], s: 1.0, yaw: 0 },
  // guards at the gate (shot 14): a red banner on the wall by the gates
  { a: 1821, b: 1953, kit: "banner-red", pos: [-3.8, D0, 21.5], s: 2.6, yaw: -0.2 },
  // trudge back up the hill (shot 15): an oak on the hillside, left of the path (y = mound surface ~D0+3.2)
  { a: 1954, b: 2071, kit: "tree_oak", pos: [19.0, D0 + 3.2, -27.0], s: 3.2, yaw: 0.3 },
  // dawn rubble (shot 16): a bush in the rubble foreground, bottom-left
  { a: 2072, b: 2183, kit: "plant_bushDetailed", pos: [-4.5, D0, -1.0], s: 1.2, yaw: 0.6 },
  // distant hills (shot 19): an oak on the near hill, framing the ripple ground
  { a: 2577, b: 2677, kit: "tree_oak", pos: [-9.0, D0, -32.0], s: 4.0, yaw: 0 },
];
