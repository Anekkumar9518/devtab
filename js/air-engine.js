// Air control's eyes. Runs in the hidden offscreen page: reads the webcam,
// finds your hand (21 points + a gesture name) and your face with MediaPipe,
// all on this computer, and broadcasts the result about 25 times a second.
// No image ever leaves this page; only a few numbers per frame do.
import { FilesetResolver, GestureRecognizer, FaceDetector } from "./vendor/mediapipe/vision_bundle.mjs";

const BASE = chrome.runtime.getURL("js/vendor/mediapipe/");
let stream = null, reader = null, running = false, recog = null, faceDet = null, lastSent = 0, frames = 0, fpsT = performance.now(), fps = 0;

async function models() {
  if (recog) return;
  const fileset = { wasmLoaderPath: BASE + "wasm/vision_wasm_internal.js", wasmBinaryPath: BASE + "wasm/vision_wasm_internal.wasm" };
  const make = (delegate) => GestureRecognizer.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: BASE + "models/gesture_recognizer.task", delegate },
    runningMode: "VIDEO", numHands: 1, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { recog = await make("GPU"); } catch (e) { recog = await make("CPU"); }
  try { faceDet = await FaceDetector.createFromOptions(fileset, { baseOptions: { modelAssetPath: BASE + "models/blaze_face_short_range.tflite", delegate: "CPU" }, runningMode: "VIDEO", minDetectionConfidence: 0.5 }); } catch (e) { faceDet = null; }
}

const r3 = (v) => Math.round(v * 1000) / 1000;
function send(msg) { chrome.runtime.sendMessage({ type: "air", ...msg }).catch(() => {}); }

export async function start() {
  if (running) return;
  running = true;
  try {
    await models();
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: "user" }, audio: false });
  } catch (e) {
    running = false; send({ status: "error", error: String(e && e.name || e) }); return;
  }
  send({ status: "on" });
  const track = stream.getVideoTracks()[0];
  // frames arrive as the camera delivers them, with no timers that could be slowed down
  reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
  let n = 0;
  while (running) {
    let res;
    try { res = await reader.read(); } catch (e) { break; }
    if (res.done) break;
    const frame = res.value, now = performance.now();
    try {
      if (now - lastSent < 33) continue; // ~30 fps is plenty
      lastSent = now; n++;
      const out = { t: Date.now() };
      const g = recog.recognizeForVideo(frame, now);
      if (g.landmarks && g.landmarks[0]) {
        // mirror x so moving your hand right moves things right
        out.lm = g.landmarks[0].map((p) => [r3(1 - p.x), r3(p.y), r3(p.z)]);
        const c = g.gestures && g.gestures[0] && g.gestures[0][0];
        out.g = c ? c.categoryName : "None"; out.gs = c ? r3(c.score) : 0;
      }
      if (faceDet && n % 3 === 0) {
        const f = faceDet.detectForVideo(frame, now).detections[0];
        if (f) {
          const k = f.keypoints || [], bb = f.boundingBox, W = frame.displayWidth, H = frame.displayHeight;
          // keypoints: 0 right eye, 1 left eye, 2 nose, 3 mouth, 4/5 ears
          const eyeY = k[0] && k[1] ? (k[0].y + k[1].y) / 2 : 0, tilt = k[2] && k[3] ? r3((k[2].y - eyeY) / Math.max(0.01, k[3].y - eyeY)) : 0;
          out.face = { ok: true, x: r3(1 - (bb.originX + bb.width / 2) / W), y: r3((bb.originY + bb.height / 2) / H), size: r3(bb.width / W), tilt };
        } else out.face = { ok: false };
      }
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
export const isRunning = () => running;
