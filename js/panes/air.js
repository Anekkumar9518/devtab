// Hub pane: Air control. Turn it on (camera + every-website access), watch the
// live hand tracking, learn the gestures, and tune speed and face pause.
import { addPane } from "../hub.js";
import { ext } from "../kv.js";

const $ = (s, el = document) => el.querySelector(s);
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/></svg>';
const GESTURES = [
  ["☝️", "Point", "Move the cursor"], ["🤏", "Pinch", "Click · twice to double-click"], ["🤏↕", "Pinch + move", "Drag the page"],
  ["✋↕", "Palm up / down", "Scroll"], ["✋↔", "Palm swipe", "Next / previous tab"], ["✋", "Palm, hold still", "Pause the video"],
  ["👍", "Thumbs up, hold", "Play the video"], ["✌️", "Victory, hold", "Go back"], ["✊", "Fist, hold", "Minimize the window"],
  ["🤟", "Love sign, hold", "New tab"], ["👎", "Thumbs down, hold", "Reload"], ["🙂", "Look away", "Video pauses, plays when you're back"],
];
const CONN = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
let C = null;

async function render(el) {
  const S = C.S(), on = !!S.fx.air;
  el.innerHTML = `
    <div class="air">
      <div class="air__hero${on ? " is-on" : ""}">
        <div class="air__live"><canvas width="560" height="420" data-cv></canvas><span class="air__st" data-st>${on ? "Starting camera…" : "Camera off"}</span></div>
        <div class="air__copy">
          <h3>${on ? "Air control is on" : "Control the web with your hands"}</h3>
          <p>${on ? "Point at anything and pinch to click. Works on every tab; the HUD shows what your hand is doing. Everything runs on this computer: the camera image never leaves it." : "Move a cursor with your finger, pinch to click, swipe between tabs, pause videos with your palm. Your face is tracked too, so videos pause when you look away. It all runs on this computer, and the camera image never leaves it."}</p>
          ${ext ? `<button type="button" class="btn air__go" data-toggle>${on ? "⏻ Turn Air control off" : "✋ Turn on Air control"}</button>` : `<p class="note">Air control needs the installed extension.</p>`}
          <p class="note" data-why></p>
        </div>
      </div>
      <h4 class="tb__h">Gestures</h4>
      <div class="air__grid">${GESTURES.map(([e, n, a]) => `<div class="air__g"><span>${e}</span><b>${n}</b><small>${a}</small></div>`).join("")}</div>
      <h4 class="tb__h">Tuning</h4>
      <div class="air__set">
        <label class="row">Cursor speed <input type="range" min="0.7" max="1.6" step="0.1" value="${S.fx.airSpeed || 1}" data-k="airSpeed"></label>
        <label class="row">Scroll speed <input type="range" min="0.5" max="2" step="0.1" value="${S.fx.airScroll || 1}" data-k="airScroll"></label>
        <label class="row">Pause videos when I look away <input type="checkbox" data-c="airFace" ${S.fx.airFace !== false ? "checked" : ""}></label>
        <label class="row">Show the hand panel on pages <input type="checkbox" data-c="airPanel" ${S.fx.airPanel !== false ? "checked" : ""}></label>
        <p class="note">Tip: sit about an arm's length from the camera with your hand in good light. You can set a keyboard shortcut for turning Air on and off at chrome://extensions/shortcuts.</p>
      </div>
    </div>`;
  if (el._wired) return el._cleanup;
  el._wired = true; // listeners once per pane element, however often it re-renders
  const onMsg = (m) => {
    const cv = $("[data-cv]", el); if (!cv) return; const x = cv.getContext("2d");
    if (!m || m.type !== "air") return;
    const stEl = $("[data-st]", el); if (!stEl) return;
    if (m.status === "error") { stEl.textContent = "Camera blocked: " + m.error; return; }
    if (m.status) return;
    stEl.textContent = m.lm ? `${(m.g || "hand").replace("_", " ")} · ${m.fps} fps${m.face ? (m.face.ok ? " · face 🙂" : " · face away") : ""}` : `Show your hand · ${m.fps} fps`;
    x.clearRect(0, 0, cv.width, cv.height);
    if (!m.lm) return;
    const P = (p) => [p[0] * cv.width, p[1] * cv.height];
    x.strokeStyle = "#29e7ff"; x.lineWidth = 6; x.lineCap = "round"; x.shadowColor = "#29e7ff"; x.shadowBlur = 16;
    x.beginPath(); for (const [a, b] of CONN) { const [x1, y1] = P(m.lm[a]), [x2, y2] = P(m.lm[b]); x.moveTo(x1, y1); x.lineTo(x2, y2); } x.stroke(); x.shadowBlur = 0;
    m.lm.forEach((p, i) => { const [px, py] = P(p); x.fillStyle = i === 8 ? "#ffd166" : i === 4 ? "#ff7eb6" : "#fff"; x.beginPath(); x.arc(px, py, i === 8 || i === 4 ? 10 : 6, 0, 6.283); x.fill(); });
  };
  if (ext) chrome.runtime.onMessage.addListener(onMsg);

  el.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-toggle]")) return;
    const S = C.S(), why = $("[data-why]", el);
    if (S.fx.air) { S.fx.air = false; await C.persist(); C.toast("Air control is off. The camera is off."); return render(el); }
    // 1) access to websites (must be asked straight from the click) 2) the camera 3) go
    const sites = await C.allowEverywhere();
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); }
    catch (err) { why.textContent = "DevTab needs the camera for Air control. Allow it in the address bar's camera icon, then try again."; return; }
    S.fx.air = true; await C.persist();
    C.toast(sites ? "Air control is on. Show your hand to the camera ✋" : "Air control is on here. Allow website access to use it on every tab.");
    render(el);
  });
  el.addEventListener("input", async (e) => { const k = e.target.dataset.k; if (k) { C.S().fx[k] = +e.target.value; C.persist(); } });
  el.addEventListener("change", async (e) => { const k = e.target.dataset.c; if (k) { C.S().fx[k] = e.target.checked; await C.persist(); } });
  el._cleanup = () => { if (ext) chrome.runtime.onMessage.removeListener(onMsg); };
  return el._cleanup;
}

export function initAir(ctx) {
  C = ctx;
  addPane({ id: "air", label: "Air control", icon: ICON, title: "Air control", sub: "Hand and face gestures on every tab", render });
}
