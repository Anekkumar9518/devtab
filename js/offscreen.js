// The extension's hidden audio page. The background worker can't play sound,
// so it keeps this document open while something should be heard: the
// reminder ringtone, the ambient mix, or both.
import { Ambient } from "./ambient-engine.js";

const amb = new Ambient();
const tone = new Audio("sounds/ring.wav");
tone.loop = true;

function apply(s) {
  if (s.ringing) { if (tone.paused) tone.play().catch(() => {}); }
  else if (!tone.paused) { tone.pause(); tone.currentTime = 0; }
  amb.set(s.on ? s.levels : {});
}

chrome.runtime.onMessage.addListener((m) => { if (m && m.target === "offscreen" && m.type === "state") apply(m); });
chrome.runtime.sendMessage({ type: "offscreen-ready" }).catch(() => {});
