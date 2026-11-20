// Hub pane: Air control. Hand control, hands-free face control, the
// Shoulder-surfer shield and Away mode, a live view of the tracking, the
// gesture list, the trainer for your own gestures, and tuning.
import { addPane } from "../hub.js";
import { ext, get, set } from "../kv.js";

const $ = (s, el = document) => el.querySelector(s);
const GKEY = "devtab:gestures";
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/></svg>';
const GESTURES = [
  ["☝️", "Point", "Move the cursor"], ["🤏", "Pinch", "Click · twice to double-click"], ["🤏↕", "Pinch + move", "Drag the page"],
  ["✋↕", "Palm up / down", "Scroll"], ["✋↔", "Palm swipe", "Next / previous tab"], ["✋", "Palm, hold still", "All tabs in a 3D ring"],
  ["👍", "Thumbs up, hold", "Play / pause the video"], ["✌️", "Victory, hold", "Go back"], ["✊", "Fist, hold", "Minimize the window"],
  ["🤟", "Love sign, hold", "Air drawing"], ["👎", "Thumbs down, hold", "Reload"], ["⭐", "Your own", "Teach poses below"],
];
const FACE = [["😉", "Wink", "Click where you're looking"], ["🤨", "Raise eyebrows", "Scroll down"], ["😮", "Open mouth", "Scroll up"], ["🙆", "Tilt your head", "Next / previous tab"], ["😁", "Big smile", "Play / pause the video"]];
export const ACTIONS = [
  ["openurl", "Open a website…"], ["capture", "Screenshot (what you see)"], ["fullshot", "Full-page screenshot"], ["focus", "Start / stop Focus"], ["sounds", "Play / pause ambient sounds"],
  ["hub", "Open the DevTab Hub"], ["carousel", "All tabs in 3D"], ["draw", "Air drawing"], ["playpause", "Play / pause video"], ["mute", "Mute / unmute this tab"],
  ["newtab", "New tab"], ["close", "Close tab"], ["top", "Scroll to the top"], ["bottom", "Scroll to the bottom"], ["back", "Back"], ["forward", "Forward"], ["reload", "Reload"], ["minimize", "Minimize the window"],
];
const CONN = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
// the same hand-shape fingerprint the pages use to recognise your gestures
function shape(lm) {
  const w = lm[0], m = lm[9], ang = Math.atan2(m[0] - w[0], -(m[1] - w[1])), s = Math.hypot(m[0] - w[0], m[1] - w[1]) || 0.1;
  const c = Math.cos(-ang), sn = Math.sin(-ang), v = [];
  for (const p of lm) { const x = (p[0] - w[0]) / s, y = (p[1] - w[1]) / s; v.push(x * c - y * sn, x * sn + y * c); }
  return v;
}
const vdist = (a, b, mirror) => { let d = 0; for (let i = 0; i < a.length; i += 2) d += Math.hypot((mirror ? -a[i] : a[i]) - b[i], a[i + 1] - b[i + 1]); return d / (a.length / 2); };
let C = null;

async function render(el) {
  const S = C.S(), fx = S.fx, cam = fx.air || fx.faceCtl || fx.shield || fx.away;
  const mine = await get(GKEY, []);
  const sw = (k, label, sub) => `<label class="air__sw"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" data-cam="${k}" ${fx[k] ? "checked" : ""}></label>`;
  el.innerHTML = `
    <div class="air">
      <div class="air__hero${fx.air ? " is-on" : ""}">
        <div class="air__live"><canvas width="560" height="420" data-cv></canvas><span class="air__st" data-st>${cam ? "Starting camera…" : "Camera off"}</span></div>
        <div class="air__copy">
          <h3>${fx.air ? "Hand control is on" : "Control the web with your hands"}</h3>
          <p>Point to move a cursor, pinch to click, swipe between tabs, hold your palm still for all tabs in 3D, 🤟 to draw in the air. It all runs on this computer; the camera image never leaves it.</p>
          ${ext ? `<button type="button" class="btn air__go" data-toggle>${fx.air ? "⏻ Turn hand control off" : "✋ Turn on hand control"}</button>` : `<p class="note">Air control needs the installed extension.</p>`}
          <p class="note" data-why></p>
        </div>
      </div>
      <h4 class="tb__h">Face &amp; privacy</h4>
      <div class="air__sws">
        ${sw("faceCtl", "😉 Hands-free face control", "Move the cursor with your head, wink to click, eyebrows to scroll, tilt to switch tabs")}
        ${sw("shield", "👀 Shoulder-surfer shield", "The screen blurs the moment a second face appears behind you")}
        ${sw("away", "🔒 Away mode", `Leave your seat and tabs blur and mute after <select data-away>${[15, 30, 60, 120, 300].map((s) => `<option value="${s}"${(fx.awaySecs || 60) === s ? " selected" : ""}>${s < 60 ? s + " s" : s / 60 + " min"}</option>`).join("")}</select>; your face unlocks them`)}
      </div>
      <div class="air__grid air__grid--face">${FACE.map(([e, n, a]) => `<div class="air__g"><span>${e}</span><b>${n}</b><small>${a}</small></div>`).join("")}</div>
      <h4 class="tb__h">Hand gestures</h4>
      <div class="air__grid">${GESTURES.map(([e, n, a]) => `<div class="air__g"><span>${e}</span><b>${n}</b><small>${a}</small></div>`).join("")}</div>
      <h4 class="tb__h">Your own gestures</h4>
      <div class="air__mine">
        <div class="air__list" data-list>${mine.map((g) => `<div class="air__my"><span>★</span><b>${C.esc(g.name)}</b><small>${C.esc((ACTIONS.find((a) => a[0] === g.action) || ["", g.action])[1])}${g.url ? " · " + C.esc(g.url) : ""}</small><button type="button" class="ws__a ws__a--x" data-del="${g.id}">Delete</button></div>`).join("") || `<p class="note">None yet. Teach one: make a pose (say 🤘 rock or 👌 OK), show it three times, and pick what it does.</p>`}</div>
        <div class="air__teach" data-teach>
          <div class="air__row"><input placeholder="Name, e.g. Rock" maxlength="20" data-name><select data-action>${ACTIONS.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></div>
          <input class="air__url" placeholder="https://mail.google.com" data-url>
          <div class="air__row"><button type="button" class="btn btn--sm" data-rec>● Record pose (3×)</button><span class="air__dots" data-dots><i></i><i></i><i></i></span><span class="note" data-recst>${fx.air ? "Hold your pose in front of the camera." : "Turn on hand control above first."}</span></div>
          <p class="note" data-test></p>
        </div>
      </div>
      <h4 class="tb__h">Tuning</h4>
      <div class="air__set">
        <label class="row">Cursor speed <input type="range" min="0.7" max="1.6" step="0.1" value="${fx.airSpeed || 1}" data-k="airSpeed"></label>
        <label class="row">Face cursor speed <input type="range" min="0.6" max="1.8" step="0.1" value="${fx.faceSpeed || 1}" data-k="faceSpeed"></label>
        <label class="row">Scroll speed <input type="range" min="0.5" max="2" step="0.1" value="${fx.airScroll || 1}" data-k="airScroll"></label>
        <label class="row">How strict your own gestures are <input type="range" min="0.14" max="0.34" step="0.02" value="${fx.gestureTol || 0.24}" data-k="gestureTol"></label>
        <label class="row">Show the hand panel on pages <input type="checkbox" data-c="airPanel" ${fx.airPanel !== false ? "checked" : ""}></label>
        <p class="note">Sit about an arm's length from the camera in good light. Set a keyboard shortcut for hand control at chrome://extensions/shortcuts.</p>
      </div>
    </div>`;
  $("[data-url]", el).hidden = $("[data-action]", el).value !== "openurl";
  if (el._wired) return el._cleanup;
  el._wired = true; // listeners once per pane element, however often it re-renders

  let rec = null; // the recording in progress
  const onMsg = (m) => {
    if (!m || m.type !== "air") return;
    const stEl = $("[data-st]", el), cv = $("[data-cv]", el); if (!stEl || !cv) return;
    if (m.status === "error") { stEl.textContent = "Camera blocked: " + m.error; return; }
    if (m.status) return;
    const face = m.face ? (m.face.ok ? ` · ${m.face.n > 1 ? m.face.n + " faces" : "face 🙂"}` : " · no face") : "";
    stEl.textContent = (m.lm ? `${(m.g || "hand").replace("_", " ")}` : C.S().fx.air ? "Show your hand" : "Watching") + ` · ${m.fps} fps${face}`;
    const x = cv.getContext("2d"); x.clearRect(0, 0, cv.width, cv.height);
    if (!m.lm) return;
    const P = (p) => [p[0] * cv.width, p[1] * cv.height];
    x.strokeStyle = rec ? "#ff6ad5" : "#29e7ff"; x.lineWidth = 6; x.lineCap = "round"; x.shadowColor = x.strokeStyle; x.shadowBlur = 16;
    x.beginPath(); for (const [a, b] of CONN) { const [x1, y1] = P(m.lm[a]), [x2, y2] = P(m.lm[b]); x.moveTo(x1, y1); x.lineTo(x2, y2); } x.stroke(); x.shadowBlur = 0;
    m.lm.forEach((p, i) => { const [px, py] = P(p); x.fillStyle = i === 8 ? "#ffd166" : i === 4 ? "#ff7eb6" : "#fff"; x.beginPath(); x.arc(px, py, i === 8 || i === 4 ? 10 : 6, 0, 6.283); x.fill(); });
    const v = shape(m.lm);
    if (rec && rec.capturing) { rec.buf.push(v); if (rec.buf.length >= 12) finishSample(); }
    // live check against the gestures you've taught
    get(GKEY, []).then((list) => {
      const t = $("[data-test]", el); if (!t || !list.length || rec) return;
      let best = null, bd = 9; for (const g of list) for (const s of g.samples) { const d = Math.min(vdist(v, s), vdist(v, s, true)); if (d < bd) { bd = d; best = g; } }
      const tol = C.S().fx.gestureTol || 0.24;
      t.textContent = best ? (bd < tol ? `✅ Recognised: ★ ${best.name} (${bd.toFixed(2)})` : `Closest: ${best.name} (${bd.toFixed(2)}; needs under ${tol})`) : "";
    });
  };
  function finishSample() {
    const avg = rec.buf[0].map((_, i) => rec.buf.reduce((s, v) => s + v[i], 0) / rec.buf.length);
    rec.samples.push(avg); rec.capturing = false; rec.buf = [];
    el.querySelectorAll("[data-dots] i").forEach((d, i) => d.classList.toggle("on", i < rec.samples.length));
    if (rec.samples.length < 3) countdown(); else saveGesture();
  }
  function countdown() {
    let n = 3; const st = $("[data-recst]", el);
    const tick = () => { if (!rec) return; if (n > 0) { st.textContent = `Pose ${rec.samples.length + 1} of 3 in ${n}…`; n--; setTimeout(tick, 700); } else { st.textContent = `Hold it… 📸`; rec.capturing = true; } };
    tick();
  }
  async function saveGesture() {
    const list = await get(GKEY, []);
    const g = { id: Date.now().toString(36), name: rec.name, action: rec.action, url: rec.url, samples: rec.samples };
    // a pose too close to one you already have would fight with it
    const clash = list.find((o) => o.samples.some((a) => g.samples.some((b) => Math.min(vdist(a, b), vdist(a, b, true)) < 0.12)));
    rec = null;
    if (clash) { $("[data-recst]", el).textContent = `That looks like "${clash.name}". Try a more different pose.`; return; }
    list.push(g); await set(GKEY, list); C.toast(`★ ${g.name} saved. Hold the pose to use it on any tab.`); render(el);
  }

  if (ext) chrome.runtime.onMessage.addListener(onMsg);
  el.addEventListener("click", async (e) => {
    const S = C.S(), why = $("[data-why]", el);
    if (e.target.closest("[data-toggle]")) {
      if (S.fx.air) { S.fx.air = false; await C.persist(); C.toast("Hand control is off."); return render(el); }
      if (!(await enableCamera(why))) return;
      S.fx.air = true; await C.persist(); C.toast("Hand control is on. Show your hand ✋"); return render(el);
    }
    const d = e.target.closest("[data-del]");
    if (d) { const list = (await get(GKEY, [])).filter((g) => g.id !== d.dataset.del); await set(GKEY, list); return render(el); }
    if (e.target.closest("[data-rec]")) {
      if (!C.S().fx.air) { $("[data-recst]", el).textContent = "Turn on hand control above first."; return; }
      const name = $("[data-name]", el).value.trim(), action = $("[data-action]", el).value, url = $("[data-url]", el).value.trim();
      if (!name) { $("[data-name]", el).focus(); $("[data-recst]", el).textContent = "Give it a name first."; return; }
      if (action === "openurl" && !/^https?:\/\/\S+\.\S+/i.test(url)) { $("[data-url]", el).focus(); $("[data-recst]", el).textContent = "Type the full address, starting with https://"; return; }
      rec = { name, action, url: action === "openurl" ? url : "", samples: [], buf: [], capturing: false };
      el.querySelectorAll("[data-dots] i").forEach((x) => x.classList.remove("on"));
      countdown();
    }
  });
  el.addEventListener("change", async (e) => {
    const S = C.S(), t = e.target;
    if (t.matches("[data-action]")) $("[data-url]", el).hidden = t.value !== "openurl";
    if (t.dataset.cam) {
      if (t.checked && !(await enableCamera($("[data-why]", el)))) { t.checked = false; return; }
      S.fx[t.dataset.cam] = t.checked; await C.persist();
      C.toast({ faceCtl: "Face control", shield: "Shoulder-surfer shield", away: "Away mode" }[t.dataset.cam] + (t.checked ? " is on." : " is off."));
    }
    if (t.matches("[data-away]")) { S.fx.awaySecs = +t.value; await C.persist(); }
    if (t.dataset.c) { S.fx[t.dataset.c] = t.checked; await C.persist(); }
  });
  el.addEventListener("input", (e) => { const k = e.target.dataset.k; if (k) { C.S().fx[k] = +e.target.value; C.persist(); } });
  // website access (asked straight from the click) and the camera
  async function enableCamera(why) {
    const sites = await C.allowEverywhere();
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((x) => x.stop()); }
    catch (err) { why.textContent = "DevTab needs the camera for this. Allow it from the camera icon in the address bar, then try again."; return false; }
    if (!sites) C.toast("It works on DevTab tabs now. Allow website access to use it on every tab.");
    return true;
  }
  el._cleanup = () => { if (ext) chrome.runtime.onMessage.removeListener(onMsg); rec = null; };
  return el._cleanup;
}

export function initAir(ctx) {
  C = ctx;
  addPane({ id: "air", label: "Air control", icon: ICON, title: "Air control", sub: "Hands, face and privacy, through your camera", render });
}
