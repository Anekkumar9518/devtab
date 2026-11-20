// The extension's hidden page. The background worker can't play sound or use
// the camera, so it keeps this document open while one of these is needed:
// the reminder ringtone, the ambient mix, or Air control's hand tracking.
import { Ambient } from "./ambient-engine.js";
import { start as airStart, stop as airStop } from "./air-engine.js";

const amb = new Ambient();
const tone = new Audio("sounds/ring.wav");
tone.loop = true;

function apply(s) {
  if (s.ringing) { if (tone.paused) tone.play().catch(() => {}); }
  else if (!tone.paused) { tone.pause(); tone.currentTime = 0; }
  amb.set(s.on ? s.levels : {});
  if (s.air) airStart(); else airStop();
}

chrome.runtime.onMessage.addListener((m) => { if (m && m.target === "offscreen" && m.type === "state") apply(m); });
chrome.runtime.sendMessage({ type: "offscreen-ready" }).catch(() => {});
