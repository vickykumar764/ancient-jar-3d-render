// Ancient Jar Hindi short — STILLS-based shard renderer (the correct render path).
//
// WHY STILLS, NOT `remotion render`:
// 1. The Actions speed test (run 42777971110, 2026-11-10) FAILED in video mode: after "Rendered 0/10"
//    the seek to frame 1 timed out after 33 s ("waiting for the page to render the React component at
//    frame 1 failed: timeout 33000ms"). Frame 0's seek + capture had succeeded. The render readiness
//    path itself is sound — a local renderStill of frame 1 (33 s readiness timeout, all 19 Kenney GLBs
//    404ing) renders a correct hook frame — so the hang lives in the multi-frame video-mode seek on a
//    live page, not in our scene code or asset loading. Stills never seek: each frame gets a fresh page.
// 2. The same failure family as Manjhi: multi-frame `remotion render` at 1080x1920 under SwiftShader
//    TILES every frame after the first (mountain/sky repeats ~5x vertically, seam at 780px — a
//    Chrome/SwiftShader compositor/screenshot defect, proven on Manjhi 2026-11-10 by elimination:
//    post chain OFF still tiles; single-frame and fresh-page renders are correct). renderStill
//    (fresh browser + fresh page per frame) is CORRECT at full 1080x1920.
// So each frame is rendered as a still (fresh page) and the shard is encoded with ffmpeg. Output specs
// are unchanged: 1080x1920, 30fps, h264 crf 16.
//
// NOTE on the Kenney 404s (do NOT re-diagnose): 8 veg GLBs now live under public/bridge/kenney/
// (Nature Kit, CC0). The other 11 KENNEY names are not files and never will be — veg is drawn
// procedurally by build.ts (VEG map), banners are painted cloth, and lantern/cart/stall-*/windmill do
// not exist in Kenney's catalog (checked across 8 kits); build.ts draws lantern/cart as primitives and
// omits stalls/windmill. loadKit() also has an 8 s race so a hung fetch can never block the render.
//
// usage:
//   node scripts/jar-render-shard.mjs <shardIndex> <numShards> [--out out/part-N.mp4]
//   node scripts/jar-render-shard.mjs --frames <start>-<end> [--out out/speed-test-10.mp4]
// Env: JAR_CHROME (browser executable; default: Playwright Chromium, then headless shell)
//      REMOTION_TMP (must point at a big-drive folder; every bundle copies public/ into it)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const args = process.argv.slice(2);
let start, end, outMp4;
const outIdx = args.indexOf("--out");
outMp4 = outIdx >= 0 ? args[outIdx + 1] : null;
if (args[0] === "--frames") {
  [start, end] = args[1].split("-").map(Number);
  if (!outMp4) outMp4 = "out/speed-test.mp4";
} else {
  const shard = Number(args[0]), numShards = Number(args[1]);
  if (!outMp4) outMp4 = `out/part-${shard}.mp4`;
  // total frames are read from the composition below; shard range is computed after bundling.
  start = null; end = null;
  var shardIndex = shard, totalShards = numShards;
}

const candidates = [
  process.env.JAR_CHROME,
  `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`,
  "node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell",
].filter(Boolean);
const browserExecutable = candidates.find((c) => fs.existsSync(path.resolve(c)));
if (!browserExecutable) { console.error("No Chrome/Chromium executable found (set JAR_CHROME)"); process.exit(1); }
console.log("Chrome:", browserExecutable);

// Remotion 4.0.542: gl:"swangle" -> --use-gl=angle --use-angle=swiftshader (the proven WebGL path).
const chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "AncientJar", browserExecutable, chromiumOptions });
const total = composition.durationInFrames;
const fps = composition.fps;
console.log(`Composition: ${composition.width}x${composition.height} ${fps}fps ${total} frames`);
if (start === null) {
  const shardSize = Math.ceil(total / totalShards);
  start = shardIndex * shardSize;
  end = Math.min(start + shardSize - 1, total - 1);
}
const count = end - start + 1;
console.log(`Rendering frames ${start}-${end} (${count} frames) -> ${outMp4}`);
const framesDir = path.resolve(path.dirname(outMp4), `shardframes-${start}-${end}`);
fs.mkdirSync(framesDir, { recursive: true });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
const t0 = Date.now();
for (let f = start; f <= end; f++) {
  const ft0 = Date.now();
  await renderStill({
    composition, serveUrl, frame: f,
    output: path.join(framesDir, `frame_${String(f).padStart(4, "0")}.jpg`),
    imageFormat: "jpeg", jpegQuality: 90, scale: 1.0,
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 300000, onBrowserLog,
  });
  console.log(`still ${f} ${((Date.now() - ft0) / 1000).toFixed(1)}s (elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
const renderSeconds = (Date.now() - t0) / 1000;
console.log(`STILLS_DONE frames=${count} RENDER_SECONDS=${renderSeconds.toFixed(1)} SECONDS_PER_FRAME=${(renderSeconds / count).toFixed(2)}`);
// Encode the shard to mp4 (30fps, h264, crf 16, yuv420p).
fs.mkdirSync(path.dirname(path.resolve(outMp4)), { recursive: true });
execFileSync("ffmpeg", [
  "-y", "-framerate", String(fps), "-start_number", String(start),
  "-i", path.join(framesDir, "frame_%04d.jpg"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-movflags", "+faststart",
  path.resolve(outMp4),
], { stdio: "inherit" });
execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height,nb_frames,duration", "-of", "default=noprint_wrappers=1", path.resolve(outMp4)], { stdio: "inherit" });
console.log(`ENCODED ${outMp4}`);
// Free disk: the JPEG intermediates are no longer needed once the mp4 exists.
fs.rmSync(framesDir, { recursive: true, force: true });
console.log(`DONE ${outMp4} total_seconds=${((Date.now() - t0) / 1000).toFixed(1)}`);
