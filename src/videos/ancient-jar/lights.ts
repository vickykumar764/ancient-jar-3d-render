// Light presets per time of day. The sun is CAMERA-RELATIVE and frozen per shot (world.ts update()):
// az = degrees from the shot camera's forward axis (0 = sun straight ahead = backlight, +90 = screen right,
// 180 = behind camera), el = elevation. lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).
// Field names follow lighting.md 9.1 exactly (the CHAR and POST agents read them); values are tuned on renders.
type C3 = [number, number, number];
export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;      // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  blob: C3; actorShadow: boolean;                                                    // contact blobs / card shadows
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string; // depth.md 6.5
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;         // three lights (unpatched mats only)
  bias: number; normalBias: number;
};
export const LIGHTS: Record<"day" | "golden" | "night" | "dawn" | "warm", LightPreset> = {
  day: {
    az: 75, el: 48,
    lit: [1.58, 1.5, 1.33], shade: [0.3, 0.29, 0.36], lift: [0.05, 0.06, 0.11], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#b8d0ec", fogNear: 25, fogFar: 300, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 6, el: 7,
    lit: [1.5, 0.68, 0.24], shade: [0.15, 0.15, 0.3], lift: [0.04, 0.06, 0.17], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.78, 0.56], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.80, 0.95],
    blob: [0.75, 0.74, 0.9], actorShadow: true,
    top: "#6a4f8c", hor: "#ffd08a", skyCurve: [0.05, 0.6, 1.0], fog: "#efb489", fogNear: 50, fogFar: 380, sunDisc: "#ffcf9e",
    sunCol: "#ffab5e", sunI: 5.5, sky: "#d8b0b8", ground: "#8a6a60", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
  night: {
    // deep blue night, low warm torch key (moon high behind camera-left; torch is the warm key on faces)
    az: 210, el: 28,
    lit: [1.35, 0.85, 0.45], shade: [0.12, 0.16, 0.32], lift: [0.03, 0.05, 0.12], lambert: 0.35, sideK: 0.8, term: 0.15,
    charTint: [0.85, 0.88, 1.0], charShade: 0.9, charGrad: 0.08, bodyGrad: 0.22, sideTint: [0.9, 0.85, 0.7],
    blob: [0.4, 0.42, 0.55], actorShadow: true,
    top: "#16233f", hor: "#1a2a4a", skyCurve: [0.0, 0.3, 0.7], fog: "#1a2a4a", fogNear: 30, fogFar: 320, sunDisc: "#f5d9a0",
    sunCol: "#ffd9a0", sunI: 1.2, sky: "#2a3a5f", ground: "#3a3f4a", hemiI: 0.35,
    bias: -0.0004, normalBias: 0.02,
  },
  dawn: {
    // pale gold-pink dawn, low sun just over the horizon (rubble reveal)
    az: 8, el: 5,
    lit: [1.6, 1.1, 0.75], shade: [0.28, 0.26, 0.38], lift: [0.08, 0.07, 0.12], lambert: 0.35, sideK: 0.82, term: 0.12,
    charTint: [1.0, 0.9, 0.82], charShade: 0.88, charGrad: 0.08, bodyGrad: 0.22, sideTint: [0.9, 0.88, 0.98],
    blob: [0.7, 0.65, 0.7], actorShadow: true,
    top: "#7a86c0", hor: "#ffd9a8", skyCurve: [0.05, 0.5, 0.9], fog: "#f2c9a0", fogNear: 40, fogFar: 350, sunDisc: "#ffe0b0",
    sunCol: "#ffc890", sunI: 4.0, sky: "#e8c4b8", ground: "#9a7a68", hemiI: 0.5,
    bias: -0.0005, normalBias: 0.025,
  },
  warm: {
    // lamp-lit interior (mechanism cutaway): warm lamp key, cool shade, dark warm-brown surroundings
    az: 60, el: 15,
    lit: [1.7, 1.05, 0.5], shade: [0.18, 0.16, 0.28], lift: [0.05, 0.04, 0.08], lambert: 0.4, sideK: 0.8, term: 0.15,
    charTint: [1.0, 0.88, 0.68], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.82, 0.95],
    blob: [0.6, 0.5, 0.45], actorShadow: true,
    top: "#4a3226", hor: "#6b4a30", skyCurve: [0.0, 0.4, 0.8], fog: "#5a4028", fogNear: 15, fogFar: 120, sunDisc: "#000000",
    sunCol: "#ffb060", sunI: 2.2, sky: "#7a5a40", ground: "#5a4030", hemiI: 0.4,
    bias: -0.0003, normalBias: 0.02,
  },
};

/** world-only look per light (sky stops by elevation in degrees, river colours, cloud palette). All colours are
 *  ON-SCREEN targets under the current PBR-Neutral tone map; world.ts pre-inverts the tone map (shade.ts untone). */
export type WorldLook = {
  sky: { c: string[]; e: number[] };                         // 5 stops: c[i] at elevation e[i] (deg), smoothstep between
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;                                                 // shade.ts uBounce: albedo x bounce on shaded faces turned to the lens
  sat: number;                                                // shade.ts uSat: world albedo saturation (1 = as painted)
  cloud: { lit: string; mid: string; shade: string };
};
export const LOOK: Record<"day" | "golden" | "night" | "dawn" | "warm", WorldLook> = {
  day: {
    // depth.md 2.2: horizon #9fb6e6 just above the skyline, upper sky #5e93d9 at ~20 deg (grade: frame top #5997e2)
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0],
    sat: 1.08,
  },
  golden: {
    // sunset, not dusk: #ffd08a horizon, peach/orange through ~10 deg, warm rose at 20, muted warm mauve only near the top
    // (the golden grade adds ~+11/255 blue to shadows/mids, so these lean warm)
    sky: { c: ["#ffc47c", "#f7ae78", "#e8967c", "#c4848e", "#8a6f8a"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1e3a6e", mid: "#355f96", far: "#d4a48e", crest: "#d9a088", trough: "#16294f", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.1,
  },
  night: {
    // night blue: dark blue horizon, deeper blue overhead; torch-warm bounce only
    sky: { c: ["#1a2a4a", "#22345c", "#2c4470", "#1c2c50", "#101a30"], e: [0, 3, 8, 16, 40] },
    water: { near: "#0e2238", mid: "#122c4a", far: "#1a2a4a", crest: "#3a5a8a", trough: "#0a1826", glint: "#f5d9a0", shade: [0.3, 0.36, 0.55] },
    cloud: { lit: "#8a94b8", mid: "#5a6488", shade: "#2c3550" },
    bounce: [0.02, 0.02, 0.05],
    sat: 0.95,
  },
  dawn: {
    // pale gold horizon, pink through ~10 deg, soft mauve only near the top
    sky: { c: ["#ffd9a8", "#f7b89a", "#e89a9a", "#b08aa8", "#7a6f9a"], e: [0, 4, 10, 20, 40] },
    water: { near: "#5a4a6e", mid: "#7a5a7e", far: "#e8a898", crest: "#f2b8a0", trough: "#3a2c50", glint: "#ffe0b0", shade: [0.45, 0.42, 0.6] },
    cloud: { lit: "#ffd9b8", mid: "#f2a8a0", shade: "#a88ab0" },
    bounce: [0.05, 0.02, 0.01],
    sat: 1.05,
  },
  warm: {
    // lamp-lit interior: dark warm brown all round (no real sky visible inside the jar)
    sky: { c: ["#6b4a30", "#5a3d28", "#4a3226", "#3a281e", "#2a1c14"], e: [0, 3, 8, 16, 40] },
    water: { near: "#3a2818", mid: "#4a3424", far: "#5a4028", crest: "#8a6248", trough: "#241812", glint: "#ffb060", shade: [0.4, 0.34, 0.3] },
    cloud: { lit: "#c89868", mid: "#8a6248", shade: "#4a3428" },
    bounce: [0.06, 0.03, 0.0],
    sat: 1.05,
  },
};
