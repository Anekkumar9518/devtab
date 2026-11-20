// The extension's hidden page. The background worker can't play sound or use
// the camera, so it keeps this document open while one of these is needed:
// the reminder ringtone, the ambient mix, Air control's hand tracking, or
// reading a page for the price & change spy.
import { Ambient } from "./ambient-engine.js";
import { start as airStart, stop as airStop } from "./air-engine.js";

const amb = new Ambient();
const tone = new Audio("sounds/ring.wav");
tone.loop = true;

function apply(s) {
  if (s.ringing) { if (tone.paused) tone.play().catch(() => {}); }
  else if (!tone.paused) { tone.pause(); tone.currentTime = 0; }
  amb.set(s.on ? s.levels : {});
  if (s.air) airStart({ hands: s.hands, face: s.face }); else airStop();
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m || m.target !== "offscreen") return;
  if (m.type === "state") apply(m);
  if (m.type === "spy-parse") {
    // the price & change spy: find the watched part of a page's HTML
    const doc = new DOMParser().parseFromString(m.html, "text/html");
    let el = null; try { el = doc.querySelector(m.selector); } catch (e) {}
    if (!el) return reply({ found: false, captcha: /captcha|robot check|are you a human|unusual traffic|verify you are/i.test((doc.body ? doc.body.textContent : "").slice(0, 6000)) });
    el.querySelectorAll("script,style,noscript,template").forEach((x) => x.remove());
    reply({ found: true, text: el.textContent });
  }
});
chrome.runtime.sendMessage({ type: "offscreen-ready" }).catch(() => {});
