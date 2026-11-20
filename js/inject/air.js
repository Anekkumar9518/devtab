// Air control on the page: a holographic cursor and HUD driven by your hand.
//  ☝ point = move the cursor        🤏 pinch = click (twice = double-click)
//  🤏 pinch + move = drag the page    ✋ palm up/down = scroll, swipe = switch tab
//  ✋ hold still = pause video       👍 hold = play     ✌ hold = back
//  ✊ hold = minimize window          🤟 hold = new tab  👎 hold = reload
//  Face: look away and the video pauses; look back and it plays again.
// The hand data comes from DevTab's hidden page; the camera image never does.
(() => {
  if (window.__devtabAir) return;
  window.__devtabAir = true;
  const EXT_PAGE = location.protocol === "chrome-extension:";
  let S = {}, cfg = {};
  const loadCfg = async () => { S = (await chrome.storage.local.get("devtab:settings"))["devtab:settings"] || {}; cfg = S.fx || {}; if (!cfg.air && ui) teardown(); };
  loadCfg();
  chrome.storage.onChanged.addListener((ch) => { if (ch["devtab:settings"]) loadCfg(); });

  /* ---------- helpers ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  class OneEuro { // smooths jitter when still, stays responsive when moving
    constructor(min = 1.2, beta = 0.02, d = 1) { this.min = min; this.beta = beta; this.d = d; this.x = null; this.dx = 0; this.t = 0; }
    a(c, dt) { const r = 2 * Math.PI * c * dt; return r / (r + 1); }
    f(x, t) {
      if (this.x === null) { this.x = x; this.t = t; return x; }
      const dt = Math.max(0.001, (t - this.t) / 1000); this.t = t;
      const dx = (x - this.x) / dt; this.dx += this.a(this.d, dt) * (dx - this.dx);
      const c = this.min + this.beta * Math.abs(this.dx); this.x += this.a(c, dt) * (x - this.x); return this.x;
    }
  }
  const fx = new OneEuro(), fy = new OneEuro();
  const CONN = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
  const NAMES = { Pointing_Up: "☝ Point", Open_Palm: "✋ Palm", Closed_Fist: "✊ Fist", Thumb_Up: "👍 Thumbs up", Thumb_Down: "👎 Thumbs down", Victory: "✌ Victory", ILoveYou: "🤟 Love", None: "☝ Pointer" };

  /* ---------- HUD ---------- */
  let ui = null, host = null;
  function build() {
    const acc = cfg && S.mode === "hacker" ? (S.hacker && S.hacker.accent) || "#00ff66" : "#29e7ff";
    host = document.createElement("devtab-air");
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    document.documentElement.append(host);
    const r = host.attachShadow({ mode: "open" });
    r.innerHTML = `<style>
      :host { --c: ${acc}; }
      * { box-sizing: border-box; font-family: "JetBrains Mono", Consolas, ui-monospace, monospace; }
      .cur { position: fixed; left: 0; top: 0; width: 56px; height: 56px; margin: -28px 0 0 -28px; pointer-events: none; transition: opacity .25s; will-change: transform; }
      .cur .ring { position: absolute; inset: 0; border-radius: 50%; border: 2px dashed var(--c); opacity: .8; animation: spin 4s linear infinite; box-shadow: 0 0 18px -2px var(--c); }
      .cur .ring2 { position: absolute; inset: 9px; border-radius: 50%; border: 2px solid var(--c); opacity: .55; transition: transform .15s, border-color .15s; }
      .cur .dot { position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px; border-radius: 50%; background: var(--c); box-shadow: 0 0 12px var(--c), 0 0 3px #fff; }
      .cur .tick { position: absolute; left: 50%; top: -6px; width: 2px; height: 8px; margin-left: -1px; background: var(--c); }
      .cur .tick:nth-of-type(2) { top: auto; bottom: -6px; }
      .cur.hot .ring2 { transform: scale(.7); border-color: #ffd166; }
      .cur.hot .dot { background: #ffd166; box-shadow: 0 0 14px #ffd166; }
      .cur.pinch .ring2 { transform: scale(.45); border-width: 3px; }
      .cur.palm .ring { border-style: solid; animation-duration: 1.4s; }
      .cur.off { opacity: 0; }
      .hold { position: absolute; inset: -14px; transform: rotate(-90deg); }
      .hold circle { fill: none; stroke: var(--c); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 264; stroke-dashoffset: 264; filter: drop-shadow(0 0 6px var(--c)); }
      .hl { position: absolute; left: 50%; top: 100%; transform: translate(-50%, 18px); padding: 4px 10px; border-radius: 6px; background: rgba(0, 10, 20, .85); border: 1px solid var(--c); color: #fff; font-size: 12px; white-space: nowrap; opacity: 0; transition: opacity .15s; }
      .hl.on { opacity: 1; }
      @keyframes spin { to { transform: rotate(1turn); } }
      .lock { position: fixed; left: 0; top: 0; border: 2px solid #ffd166; border-radius: 8px; box-shadow: 0 0 0 4px rgba(255, 209, 102, .18), 0 0 24px rgba(255, 209, 102, .5); pointer-events: none; opacity: 0; transition: opacity .12s, transform .08s, width .08s, height .08s; }
      .lock.on { opacity: 1; }
      .lock::before, .lock::after { content: ""; position: absolute; width: 10px; height: 10px; border: 3px solid #ffd166; }
      .lock::before { left: -7px; top: -7px; border-right: 0; border-bottom: 0; } .lock::after { right: -7px; bottom: -7px; border-left: 0; border-top: 0; }
      .ripple { position: fixed; width: 20px; height: 20px; margin: -10px; border-radius: 50%; border: 3px solid var(--c); pointer-events: none; animation: rip .5s ease-out forwards; }
      @keyframes rip { to { transform: scale(4); opacity: 0; } }
      .flash { position: fixed; left: 50%; top: 18%; transform: translate(-50%, -10px) scale(.9); padding: 12px 22px; border-radius: 14px; background: rgba(0, 12, 24, .85); border: 1px solid var(--c); color: #fff; font-size: 18px; font-weight: 700; letter-spacing: .02em; box-shadow: 0 0 40px -10px var(--c); opacity: 0; transition: opacity .2s, transform .25s cubic-bezier(.2, 1.4, .4, 1); pointer-events: none; }
      .flash.on { opacity: 1; transform: translate(-50%, 0) scale(1); }
      .panel { position: fixed; left: 16px; bottom: 16px; width: 236px; padding: 10px; border-radius: 14px; background: rgba(0, 10, 22, .78); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); box-shadow: 0 0 30px -12px var(--c), inset 0 0 30px -18px var(--c); backdrop-filter: blur(10px); pointer-events: auto; color: #dff9ff; transition: opacity .3s; }
      .panel::before, .panel::after { content: ""; position: absolute; width: 14px; height: 14px; border: 2px solid var(--c); }
      .panel::before { left: -1px; top: -1px; border-right: 0; border-bottom: 0; border-radius: 14px 0 0 0; } .panel::after { right: -1px; bottom: -1px; border-left: 0; border-top: 0; border-radius: 0 0 14px 0; }
      .ph { display: flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: .14em; color: var(--c); }
      .ph b { flex: 1; } .ph i { width: 7px; height: 7px; border-radius: 50%; background: #ff4d6d; box-shadow: 0 0 8px #ff4d6d; animation: bl 1.2s steps(1) infinite; }
      @keyframes bl { 50% { opacity: .2; } }
      .ph button { all: unset; cursor: pointer; width: 20px; height: 20px; display: grid; place-items: center; border-radius: 5px; border: 1px solid color-mix(in srgb, var(--c) 40%, transparent); font-size: 11px; color: #dff9ff; }
      .ph button:hover { background: color-mix(in srgb, var(--c) 30%, transparent); }
      canvas { display: block; width: 216px; height: 150px; margin: 8px 0 6px; border-radius: 8px; background: radial-gradient(circle, rgba(41, 231, 255, .08), transparent 70%), repeating-linear-gradient(0deg, rgba(41, 231, 255, .06) 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, rgba(41, 231, 255, .06) 0 1px, transparent 1px 18px); }
      .st { display: flex; justify-content: space-between; font-size: 11px; color: rgba(223, 249, 255, .75); }
      .st b { color: #fff; }
      .help { position: absolute; left: 0; bottom: calc(100% + 8px); width: 300px; padding: 12px; border-radius: 12px; background: rgba(0, 10, 22, .92); border: 1px solid var(--c); font-size: 12px; line-height: 1.7; color: #dff9ff; }
      .help b { color: var(--c); font-weight: 700; }
      .dock { position: fixed; right: 14px; top: 50%; transform: translateY(-50%); display: grid; gap: 6px; padding: 8px; border-radius: 16px; background: rgba(0, 10, 22, .7); border: 1px solid color-mix(in srgb, var(--c) 50%, transparent); box-shadow: 0 0 26px -12px var(--c); pointer-events: auto; }
      .dock button { all: unset; cursor: pointer; position: relative; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; color: #dff9ff; font-size: 18px; border: 1px solid transparent; transition: background .12s, border-color .12s, transform .12s; }
      .dock button:hover, .dock button.hot { background: color-mix(in srgb, var(--c) 25%, transparent); border-color: var(--c); transform: scale(1.08); }
      .dock button span { position: absolute; right: calc(100% + 10px); padding: 3px 8px; border-radius: 6px; background: rgba(0, 10, 22, .9); border: 1px solid var(--c); font-size: 11px; white-space: nowrap; opacity: 0; transition: opacity .12s; pointer-events: none; }
      .dock button:hover span, .dock button.hot span { opacity: 1; }
      [hidden] { display: none !important; }
    </style>
    <div class="lock"></div>
    <div class="cur off"><div class="ring"></div><div class="ring2"></div><div class="dot"></div><span class="tick"></span><span class="tick"></span>
      <svg class="hold" viewBox="0 0 92 92"><circle cx="46" cy="46" r="42"/></svg><span class="hl"></span></div>
    <div class="flash"></div>
    <nav class="dock" aria-label="Air control actions">
      <button data-a="back">⟵<span>Back</span></button><button data-a="forward">⟶<span>Forward</span></button><button data-a="reload">⟳<span>Reload</span></button>
      <button data-a="newtab">＋<span>New tab</span></button><button data-a="close">✕<span>Close tab</span></button><button data-a="minimize">▁<span>Minimize window</span></button><button data-a="off">⏻<span>Turn Air off</span></button>
    </nav>
    <div class="panel"${cfg.airPanel === false ? " hidden" : ""}>
      <div class="ph"><i></i><b>AIR CONTROL</b><button data-help title="Gestures">?</button><button data-hide title="Hide this panel">–</button></div>
      <canvas width="432" height="300"></canvas>
      <div class="st"><span data-g>Show your hand</span><span><b data-fps>0</b> fps · <span data-face>🙂</span></span></div>
      <div class="help" hidden>
        <b>☝ Point</b> move the cursor<br><b>🤏 Pinch</b> click · pinch twice: double-click<br><b>🤏 Pinch + move</b> drag the page<br>
        <b>✋ Palm up / down</b> scroll · <b>swipe</b> switch tab<br><b>✋ Hold still</b> pause video · <b>👍 hold</b> play<br>
        <b>✌ Hold</b> back · <b>✊ Hold</b> minimize<br><b>🤟 Hold</b> new tab · <b>👎 Hold</b> reload<br><b>🙂 Look away</b> pauses video, look back plays it
      </div>
    </div>`;
    ui = {
      root: r, cur: r.querySelector(".cur"), lock: r.querySelector(".lock"), flash: r.querySelector(".flash"), hold: r.querySelector(".hold circle"), hl: r.querySelector(".hl"),
      cv: r.querySelector("canvas"), g: r.querySelector("[data-g]"), fps: r.querySelector("[data-fps]"), face: r.querySelector("[data-face]"), dock: r.querySelector(".dock"), panel: r.querySelector(".panel"),
    };
    r.querySelector("[data-help]").onclick = () => { const h = r.querySelector(".help"); h.hidden = !h.hidden; };
    r.querySelector("[data-hide]").onclick = () => { ui.panel.hidden = true; };
    ui.dock.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b) act(b.dataset.a); });
  }
  function teardown() { if (host) host.remove(); host = null; ui = null; }

  let flashT = 0;
  function flash(text) { if (!ui) return; ui.flash.textContent = text; ui.flash.classList.add("on"); clearTimeout(flashT); flashT = setTimeout(() => ui && ui.flash.classList.remove("on"), 1100); }
  function ripple(x, y) { const d = document.createElement("div"); d.className = "ripple"; d.style.left = x + "px"; d.style.top = y + "px"; ui.root.append(d); setTimeout(() => d.remove(), 520); }

  /* ---------- actions ---------- */
  const mainVideo = () => [...document.querySelectorAll("video")].filter((v) => { const r = v.getBoundingClientRect(); return r.width > 120 && r.height > 60; }).sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  function playVideo(play) {
    const v = mainVideo(); if (!v) return false;
    if (play) { v.play().catch(() => { const b = document.querySelector(".ytp-play-button"); if (b) b.click(); }); } else v.pause();
    return true;
  }
  function act(a) {
    if (a === "back") { flash("⟵ Back"); history.back(); }
    else if (a === "forward") { flash("⟶ Forward"); history.forward(); }
    else if (a === "reload") { flash("⟳ Reload"); location.reload(); }
    else if (a === "pause") { if (playVideo(false)) flash("⏸ Paused"); }
    else if (a === "play") { if (playVideo(true)) flash("▶ Playing"); }
    else { flash({ next: "Next tab ⟶", prev: "⟵ Previous tab", minimize: "▁ Minimize", newtab: "＋ New tab", close: "✕ Close tab", off: "⏻ Air off" }[a] || a); chrome.runtime.sendMessage({ type: "air-act", act: a }).catch(() => {}); }
  }
  const CLICKABLE = 'a[href], button, input, select, textarea, summary, label, video, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick], [tabindex]:not([tabindex="-1"])';
  function under(x, y) {
    let el = document.elementFromPoint(x, y);
    if (el === host) return { mine: ui.root.elementFromPoint(x, y) };
    while (el && el.shadowRoot && el.shadowRoot.elementFromPoint) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner; }
    return { el };
  }
  function click(x, y, dbl) {
    ripple(x, y);
    const u = under(x, y);
    if (u.mine) { const b = u.mine.closest && u.mine.closest("[data-a]"); if (b) act(b.dataset.a); return; }
    const el = u.el; if (!el) return;
    const o = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: window, button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...o, pointerType: "mouse", isPrimary: true }));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    const target = el.closest(CLICKABLE) || el;
    if (target.matches && target.matches("input, textarea, select, [contenteditable]")) target.focus();
    el.dispatchEvent(new PointerEvent("pointerup", { ...o, pointerType: "mouse", isPrimary: true }));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    if (target.tagName === "VIDEO") { playVideo(target.paused); return; }
    target.click();
    if (dbl) el.dispatchEvent(new MouseEvent("dblclick", { ...o, detail: 2 }));
  }
  function scrollAt(x, y, dy) {
    let el = under(x, y).el;
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) { el.scrollBy({ top: dy }); return; }
      el = el.parentElement;
    }
    window.scrollBy({ top: dy });
  }

  /* ---------- gestures ---------- */
  const st = { armed: false, handGone: 0, shownAt: performance.now(), hist: [], pinch: false, pStart: 0, pPos: null, pMid: null, drag: false, lastClick: 0, lastClickPos: null, hold: null, holdT: 0, fired: null, swipeCool: 0, palmHist: [], faceSeen: Date.now(), faceAway: false, pausedByFace: false, lastHand: 0, cx: innerWidth / 2, cy: innerHeight / 2 };
  const HOLDS = { Thumb_Up: ["play", 600, "👍 Play"], Victory: ["back", 800, "✌ Back"], Closed_Fist: ["minimize", 1000, "✊ Minimize"], ILoveYou: ["newtab", 900, "🤟 New tab"], Thumb_Down: ["reload", 1000, "👎 Reload"], PalmHold: ["pause", 900, "✋ Pause"] };

  function setHold(name, now) {
    if (name && !st.armed) name = null;
    if (!name) { st.hold = null; ui.hold.style.strokeDashoffset = "264"; ui.hl.classList.remove("on"); return; }
    if (st.fired === name) return; // already done; change gesture to do it again
    if (st.hold !== name) { st.hold = name; st.holdT = now; }
    const [a, dur, label] = HOLDS[name], k = clamp((now - st.holdT) / dur, 0, 1);
    ui.hold.style.strokeDashoffset = String(264 * (1 - k));
    ui.hl.textContent = label; ui.hl.classList.add("on");
    if (k >= 1) { st.fired = name; setHold(null); act(a); }
  }

  function frame(m) {
    const now = performance.now();
    if (!ui) build();
    ui.fps.textContent = m.fps || 0;
    if (m.face) {
      if (m.face.ok) { st.faceSeen = Date.now(); if (st.faceAway) { st.faceAway = false; if (st.pausedByFace && cfg.airFace !== false) { playVideo(true); flash("👀 Welcome back ▶"); } st.pausedByFace = false; } }
      else if (!st.faceAway && Date.now() - st.faceSeen > 2500) { st.faceAway = true; const v = mainVideo(); if (v && !v.paused && cfg.airFace !== false) { v.pause(); st.pausedByFace = true; flash("👀 Paused while you're away"); } }
      ui.face.textContent = st.faceAway ? "👀 away" : "🙂";
    }
    drawPanel(m.lm, m.g);
    const lm = m.lm;
    if (!lm) { if (st.lastHand && !st.handGone) st.handGone = now; ui.cur.classList.add("off"); ui.lock.classList.remove("on"); setHold(null); st.pinch = false; st.drag = false; st.fired = null; ui.g.textContent = "Show your hand"; return; }
    if (st.handGone && now - st.handGone > 500) st.armed = true;
    st.handGone = 0; st.lastHand = now;
    const d = (a, b) => Math.hypot(lm[a][0] - lm[b][0], lm[a][1] - lm[b][1]);
    const size = d(0, 9) || 0.1, ext = (t, p) => d(t, 0) > d(p, 0) * 1.08;
    const f = { i: ext(8, 6), m: ext(12, 10), r: ext(16, 14), p: ext(20, 18) };
    const pr = d(4, 8) / size;
    const g = m.gs > 0.55 ? m.g : "None";
    const palm = g === "Open_Palm" || (f.i && f.m && f.r && f.p && pr > 0.7);
    if (st.fired && (st.fired === "PalmHold" ? !palm : g !== st.fired)) st.fired = null;
    // after a page loads (say, after ✌ went back), wait for a fresh pose before any hold can fire
    if (!st.armed && (!palm && !HOLDS[g] || now - st.shownAt > 2500)) st.armed = true;

    // cursor from the index fingertip, mapped from a comfortable box in the camera view
    const sp = cfg.airSpeed || 1, bw = 0.62 / sp, bh = 0.56 / sp, bx = 0.5 - bw / 2, by = 0.42 - bh / 2;
    const tx = clamp((lm[8][0] - bx) / bw, 0, 1) * innerWidth, ty = clamp((lm[8][1] - by) / bh, 0, 1) * innerHeight;
    const cx = fx.f(tx, now), cy = fy.f(ty, now);
    st.hist.push([cx, cy, now]); if (st.hist.length > 8) st.hist.shift();

    // pinch with a little hysteresis so it doesn't flicker
    const posed = ["Closed_Fist", "Thumb_Up", "Thumb_Down", "Victory", "ILoveYou"].includes(g);
    if (!st.pinch && pr < 0.32 && !palm && !posed) { st.pinch = true; st.pStart = now; st.drag = false; const old = st.hist[Math.max(0, st.hist.length - 4)]; st.pPos = [old[0], old[1]]; st.pMid = [(lm[4][0] + lm[8][0]) / 2, (lm[4][1] + lm[8][1]) / 2]; }
    else if (st.pinch && (pr > 0.46 || posed)) {
      if (posed) { st.pinch = false; st.drag = false; } else {
      st.pinch = false;
      if (!st.drag && now - st.pStart < 650) {
        const dbl = now - st.lastClick < 500 && st.lastClickPos && Math.hypot(st.pPos[0] - st.lastClickPos[0], st.pPos[1] - st.lastClickPos[1]) < 50;
        click(st.pPos[0], st.pPos[1], dbl); st.lastClick = dbl ? 0 : now; st.lastClickPos = st.pPos;
      }
      st.drag = false; }
    }

    let x = cx, y = cy, mode = "point";
    if (st.pinch) {
      const mid = [(lm[4][0] + lm[8][0]) / 2, (lm[4][1] + lm[8][1]) / 2];
      if (!st.drag && (Math.hypot(mid[0] - st.pMid[0], mid[1] - st.pMid[1]) > 0.035)) st.drag = true;
      if (st.drag) { scrollAt(st.pPos[0], st.pPos[1], -(mid[1] - st.pMid[1]) * innerHeight * 2.4); st.pMid = mid; mode = "drag"; }
      else { x = st.pPos[0]; y = st.pPos[1]; mode = "pinch"; }
      setHold(null);
    } else if (palm) {
      mode = "palm";
      const c = lm[9]; st.palmHist.push([c[0], c[1], now]); while (st.palmHist.length && now - st.palmHist[0][2] > 400) st.palmHist.shift();
      const prev = st.palmHist[Math.max(0, st.palmHist.length - 2)], vy = c[1] - prev[1];
      const old = st.palmHist[0], dx = c[0] - old[0], dyy = c[1] - old[1];
      if (Math.abs(dx) > 0.26 && Math.abs(dx) > Math.abs(dyy) * 2.2 && now > st.swipeCool) { st.swipeCool = now + 1100; st.palmHist = []; act(dx > 0 ? "next" : "prev"); setHold(null); }
      else if (Math.abs(vy) > 0.006) { scrollAt(cx, cy, vy * innerHeight * 3.2 * (cfg.airScroll || 1)); setHold(null); st.holdStill = now; }
      else if (now - (st.holdStill || 0) > 250) setHold("PalmHold", now);
    } else if (HOLDS[g]) {
      mode = "hold";
      const mv = st.hist.length > 2 ? Math.hypot(cx - st.hist[st.hist.length - 3][0], cy - st.hist[st.hist.length - 3][1]) : 0;
      if (mv < 40) setHold(g, now); else setHold(null);
    } else setHold(null);

    ui.g.textContent = st.pinch ? (st.drag ? "🤏 Dragging" : "🤏 Pinch") : NAMES[g] || NAMES.None;
    ui.cur.classList.remove("off");
    ui.cur.classList.toggle("pinch", st.pinch); ui.cur.classList.toggle("palm", mode === "palm");
    ui.cur.style.transform = `translate(${x}px, ${y}px)`;
    st.cx = x; st.cy = y;

    // lock onto whatever is clickable under the cursor
    const u = under(x, y);
    ui.dock.querySelectorAll(".hot").forEach((b) => b.classList.remove("hot"));
    if (u.mine) { const b = u.mine.closest && u.mine.closest("[data-a]"); if (b) b.classList.add("hot"); ui.lock.classList.remove("on"); ui.cur.classList.toggle("hot", !!b); }
    else {
      const t = u.el && u.el.closest && u.el.closest(CLICKABLE);
      ui.cur.classList.toggle("hot", !!t);
      if (t && mode !== "palm") { const r = t.getBoundingClientRect(); if (r.width < innerWidth * 0.9 && r.height < innerHeight * 0.6) { Object.assign(ui.lock.style, { transform: `translate(${r.left - 4}px, ${r.top - 4}px)`, width: r.width + 8 + "px", height: r.height + 8 + "px" }); ui.lock.classList.add("on"); } else ui.lock.classList.remove("on"); }
      else ui.lock.classList.remove("on");
    }
  }

  function drawPanel(lm, g) {
    if (!ui || ui.panel.hidden) return;
    const c = ui.cv, x = c.getContext("2d"), W = c.width, H = c.height, col = getComputedStyle(host).getPropertyValue("--c").trim() || "#29e7ff";
    x.clearRect(0, 0, W, H);
    const scan = (performance.now() / 12) % H; x.fillStyle = "rgba(41,231,255,.08)"; x.fillRect(0, scan, W, 3);
    if (!lm) { x.fillStyle = "rgba(223,249,255,.5)"; x.font = "22px Consolas, monospace"; x.textAlign = "center"; x.fillText("searching for a hand…", W / 2, H / 2); return; }
    const P = (p) => [p[0] * W, p[1] * H];
    x.strokeStyle = col; x.lineWidth = 4; x.shadowColor = col; x.shadowBlur = 12; x.lineCap = "round";
    x.beginPath(); for (const [a, b] of CONN) { const [x1, y1] = P(lm[a]), [x2, y2] = P(lm[b]); x.moveTo(x1, y1); x.lineTo(x2, y2); } x.stroke();
    x.shadowBlur = 0;
    lm.forEach((p, i) => { const [px, py] = P(p); x.fillStyle = i === 8 ? "#ffd166" : i === 4 ? "#ff7eb6" : "#fff"; x.beginPath(); x.arc(px, py, i === 8 || i === 4 ? 7 : 4.5, 0, 6.283); x.fill(); });
  }

  /* ---------- incoming frames ---------- */
  chrome.runtime.onMessage.addListener((m) => {
    if (!m || m.type !== "air") return;
    if (EXT_PAGE && document.visibilityState !== "visible") return; // only the DevTab tab you're looking at
    if (m.status === "error") { if (!ui) build(); flash("📷 Camera unavailable: " + m.error); return; }
    if (m.status === "off") { teardown(); return; }
    if (m.status) return;
    if (!cfg.air) return;
    frame(m);
  });
  // a page shown again (back/forward cache, or switching to this tab) waits for a fresh pose too
  const rearm = () => { st.armed = false; st.fired = null; st.shownAt = performance.now(); st.pinch = false; st.drag = false; };
  addEventListener("pageshow", rearm);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") rearm(); });
  // hand gone for a while: hide the cursor
  setInterval(() => { if (ui && performance.now() - st.lastHand > 1500) { ui.cur.classList.add("off"); ui.lock.classList.remove("on"); } }, 500);
})();
