// DevTab's camera brain. Runs in the hidden offscreen page: reads the webcam
// and, on this computer only, finds your hand (21 points + a gesture name)
// and up to three faces (head angle, blinks, eyebrows, mouth, how many people
// are looking). It broadcasts a few numbers per frame; no image ever leaves.
import { FilesetResolver, GestureRecognizer, FaceLandmarker } from "./vendor/mediapipe/vision_bundle.mjs";

const BASE = chrome.runtime.getURL("js/vendor/mediapipe/");
const fileset = { wasmLoaderPath: BASE + "wasm/vision_wasm_internal.js", wasmBinaryPath: BASE + "wasm/vision_wasm_internal.wasm" };
let stream = null, reader = null, running = false, recog = null, faceLm = null, want = { hands: true, face: true };
let lastSent = 0, frames = 0, fpsT = performance.now(), fps = 0;

async function make(Task, opts) {
  try { return await Task.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: "GPU" } }); }
  catch (e) { return Task.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: "CPU" } }); }
}
async function models() {
  if (want.hands && !recog) recog = await make(GestureRecognizer, { baseOptions: { modelAssetPath: BASE + "models/gesture_recognizer.task" }, runningMode: "VIDEO", numHands: 1, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  if (want.face && !faceLm) faceLm = await make(FaceLandmarker, { baseOptions: { modelAssetPath: BASE + "models/face_landmarker.task" }, runningMode: "VIDEO", numFaces: 3, minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const deg = (r) => Math.round((r * 180) / Math.PI * 10) / 10;
function send(msg) { chrome.runtime.sendMessage({ type: "air", ...msg }).catch(() => {}); }

// Head angles from the 4×4 face transform (column-major). Mirrored so that
// turning your head right reads as "right", like a mirror.
function pose(m) {
  const r00 = m[0], r10 = m[1], r20 = m[2], r21 = m[6], r22 = m[10];
  return { yaw: -deg(Math.atan2(-r20, Math.hypot(r21, r22))), pitch: deg(Math.atan2(r21, r22)), roll: -deg(Math.atan2(r10, r00)) };
}
function faces(res) {
  const list = res.faceLandmarks || [];
  if (!list.length) return { ok: false, n: 0 };
  // the main face is the biggest one (closest to the camera)
  let best = 0, bw = 0;
  list.forEach((pts, i) => { let a = 1, b = 0; for (const p of pts) { if (p.x < a) a = p.x; if (p.x > b) b = p.x; } if (b - a > bw) { bw = b - a; best = i; } });
  const pts = list[best], bs = {};
  ((res.faceBlendshapes || [])[best] || { categories: [] }).categories.forEach((c) => (bs[c.categoryName] = c.score));
  const nose = pts[1];
  const out = { ok: true, n: list.length, x: r3(1 - nose.x), y: r3(nose.y), size: r3(bw),
    blinkL: r3(bs.eyeBlinkLeft || 0), blinkR: r3(bs.eyeBlinkRight || 0), brow: r3(Math.max(bs.browInnerUp || 0, ((bs.browOuterUpLeft || 0) + (bs.browOuterUpRight || 0)) / 2)),
    jaw: r3(bs.jawOpen || 0), smile: r3(((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2) };
  const mx = (res.facialTransformationMatrixes || [])[best];
  if (mx && mx.data) Object.assign(out, pose(mx.data));
  // the other faces' sizes, so a tiny face on a poster far away can be told apart from a person
  out.others = list.filter((_, i) => i !== best).map((p) => { let a = 1, b = 0; for (const q of p) { if (q.x < a) a = q.x; if (q.x > b) b = q.x; } return r3(b - a); });
  return out;
}

export async function start(cfg) {
  want = { hands: cfg ? cfg.hands !== false : true, face: cfg ? !!cfg.face : true };
  if (running) { await models(); return; }
  running = true;
  try {
    await models();
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: "user" }, audio: false });
  } catch (e) { running = false; send({ status: "error", error: String((e && e.name) || e) }); return; }
  send({ status: "on" });
  // keep at most one waiting frame, so a slow moment never builds up lag
  reader = new MediaStreamTrackProcessor({ track: stream.getVideoTracks()[0], maxBufferSize: 1 }).readable.getReader();
  let n = 0;
  while (running) {
    let res;
    try { res = await reader.read(); } catch (e) { break; }
    if (res.done) break;
    const frame = res.value, now = performance.now();
    try {
      if (now - lastSent < 33) continue;
      lastSent = now; n++;
      const out = { t: Date.now() };
      if (want.hands && recog) {
        const g = recog.recognizeForVideo(frame, now);
        if (g.landmarks && g.landmarks[0]) {
          out.lm = g.landmarks[0].map((p) => [r3(1 - p.x), r3(p.y), r3(p.z)]);
          const c = g.gestures && g.gestures[0] && g.gestures[0][0];
          out.g = c ? c.categoryName : "None"; out.gs = c ? r3(c.score) : 0;
        }
      }
      // faces every other frame: plenty for blinks and head movement, and half the work
      if (want.face && faceLm && n % 2 === 0) out.face = faces(faceLm.detectForVideo(frame, now));
      frames++; if (now - fpsT > 1000) { fps = frames; frames = 0; fpsT = now; } out.fps = fps;
      send(out);
    } catch (e) { /* skip a bad frame */ }
    finally { frame.close(); }
  }
}

export function stop() {
  running = false;
  try { reader && reader.cancel(); } catch (e) {}
  reader = null;
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  send({ status: "off" });
}
