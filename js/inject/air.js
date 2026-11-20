// DevTab's camera features on the page. Hand data and face data come from
// DevTab's hidden page (the camera image never does). This script turns them
// into a holographic cursor and HUD, gestures, face control, the 3D tab
// carousel, air drawing, your own trained gestures, and the Shoulder-surfer
// shield / Away mode screens.
(() => {
  if (window.__devtabAir) return;
  window.__devtabAir = true;
  const EXT_PAGE = location.protocol === "chrome-extension:";
  let S = {}, cfg = {}, myGestures = [];
  const anyCam = () => !!(cfg.air || cfg.faceCtl || cfg.shield || cfg.away);
  const loadCfg = async () => {
    const r = await chrome.storage.local.get(["devtab:settings", "devtab:gestures"]);
    S = r["devtab:settings"] || {}; cfg = S.fx || {}; myGestures = r["devtab:gestures"] || [];
    if (ui) { ui.panel.hidden = !cfg.air || cfg.airPanel === false; ui.dock.hidden = !cfg.air; if (!cfg.air) ui.cur.classList.add("off"); if (!cfg.faceCtl) ui.fcur.classList.add("off"); }
    if (!anyCam() && ui) teardown();
  };
  loadCfg();
  chrome.storage.onChanged.addListener((ch) => { if (ch["devtab:settings"] || ch["devtab:gestures"]) loadCfg(); });

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
  const fx = new OneEuro(0.9, 4), fy = new OneEuro(0.9, 4), ffx = new OneEuro(0.8, 0.01), ffy = new OneEuro(0.8, 0.01);
  const CONN = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
  const NAMES = { Pointing_Up: "☝ Point", Open_Palm: "✋ Palm", Closed_Fist: "✊ Fist", Thumb_Up: "👍 Thumbs up", Thumb_Down: "👎 Thumbs down", Victory: "✌ Victory", ILoveYou: "🤟 Love", None: "☝ Pointer" };

  /* ---------- HUD ---------- */
  let ui = null, host = null;
  function build() {
    const acc = S.mode === "hacker" ? (S.hacker && S.hacker.accent) || "#00ff66" : "#29e7ff";
    host = document.createElement("devtab-air");
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    document.documentElement.append(host);
    const r = host.attachShadow({ mode: "open" });
    r.innerHTML = `<style>
      :host { --c: ${acc}; --f: #ff6ad5; }
      * { box-sizing: border-box; font-family: "JetBrains Mono", Consolas, ui-monospace, monospace; }
      [hidden] { display: none !important; }
      .cur, .fcur { position: fixed; left: 0; top: 0; width: 48px; height: 48px; margin: -24px 0 0 -24px; pointer-events: none; transition: opacity .25s; will-change: transform; z-index: 5; }
      .cur .ring { position: absolute; inset: 0; border-radius: 50%; border: 2px dashed var(--c); opacity: .8; animation: spin 4s linear infinite; box-shadow: 0 0 18px -2px var(--c); }
      .cur .ring2 { position: absolute; inset: 9px; border-radius: 50%; border: 2px solid var(--c); opacity: .55; transition: transform .15s, border-color .15s; }
      .cur .dot { position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px; border-radius: 50%; background: var(--c); box-shadow: 0 0 12px var(--c), 0 0 3px #fff; }
      .cur .tick { position: absolute; left: 50%; top: -6px; width: 2px; height: 8px; margin-left: -1px; background: var(--c); } .cur .tick:nth-of-type(2) { top: auto; bottom: -6px; }
      .cur.hot .ring2 { transform: scale(.7); border-color: #ffd166; } .cur.hot .dot { background: #ffd166; box-shadow: 0 0 14px #ffd166; }
      .cur.pinch .ring2, .cur.press .ring2 { transform: scale(.45); border-width: 3px; border-color: #fff; } .cur.press .dot { transform: scale(1.6); }
      .cur.scroll .ring { border-style: solid; animation: none; } .cur.scroll .dot, .cur.scroll .tick { opacity: 0; }
      .cur .ico { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: 20px; font-weight: 700; text-shadow: 0 0 10px var(--c); opacity: 0; transition: opacity .15s; }
      .cur.scroll .ico { opacity: 1; }
      .cur .dot { transition: transform .12s; }
      .cur.pen .ring { border-style: solid; border-color: var(--ink, #29e7ff); } .cur.pen .dot { background: var(--ink, #29e7ff); }
      .cur.off, .fcur.off { opacity: 0; }
      .fcur .ring { position: absolute; inset: 4px; border-radius: 50%; border: 2px solid var(--f); box-shadow: 0 0 18px -2px var(--f); }
      .fcur .eye { position: absolute; inset: 0; display: grid; place-items: center; font-size: 18px; }
      .fcur .wink { position: absolute; inset: -6px; transform: rotate(-90deg); } .fcur .wink circle { fill: none; stroke: var(--f); stroke-width: 4; stroke-dasharray: 220; stroke-dashoffset: 220; }
      .hold { position: absolute; inset: -14px; transform: rotate(-90deg); }
      .hold circle { fill: none; stroke: var(--c); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 264; stroke-dashoffset: 264; filter: drop-shadow(0 0 6px var(--c)); }
      .hl { position: absolute; left: 50%; top: 100%; transform: translate(-50%, 18px); padding: 4px 10px; border-radius: 6px; background: rgba(0, 10, 20, .85); border: 1px solid var(--c); color: #fff; font-size: 12px; white-space: nowrap; opacity: 0; transition: opacity .15s; }
      .hl.on { opacity: 1; }
      @keyframes spin { to { transform: rotate(1turn); } }
      .lock { position: fixed; left: 0; top: 0; border: 2px solid #ffd166; border-radius: 8px; box-shadow: 0 0 0 4px rgba(255, 209, 102, .18), 0 0 24px rgba(255, 209, 102, .5); pointer-events: none; opacity: 0; transition: opacity .12s, transform .08s, width .08s, height .08s; }
      .lock.on { opacity: 1; }
      .lock::before, .lock::after { content: ""; position: absolute; width: 10px; height: 10px; border: 3px solid #ffd166; }
      .lock::before { left: -7px; top: -7px; border-right: 0; border-bottom: 0; } .lock::after { right: -7px; bottom: -7px; border-left: 0; border-top: 0; }
      .ripple { position: fixed; width: 20px; height: 20px; margin: -10px; border-radius: 50%; border: 3px solid var(--c); pointer-events: none; animation: rip .5s ease-out forwards; z-index: 6; }
      @keyframes rip { to { transform: scale(4); opacity: 0; } }
      .flash { position: fixed; left: 50%; top: 18%; transform: translate(-50%, -10px) scale(.9); padding: 12px 22px; border-radius: 14px; background: rgba(0, 12, 24, .85); border: 1px solid var(--c); color: #fff; font-size: 18px; font-weight: 700; box-shadow: 0 0 40px -10px var(--c); opacity: 0; transition: opacity .2s, transform .25s cubic-bezier(.2, 1.4, .4, 1); pointer-events: none; z-index: 9; }
      .flash.on { opacity: 1; transform: translate(-50%, 0) scale(1); }
      .panel { position: fixed; left: 16px; bottom: 16px; width: 236px; padding: 10px; border-radius: 14px; background: rgba(0, 10, 22, .78); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); box-shadow: 0 0 30px -12px var(--c), inset 0 0 30px -18px var(--c); backdrop-filter: blur(10px); pointer-events: auto; color: #dff9ff; }
      .panel::before, .panel::after { content: ""; position: absolute; width: 14px; height: 14px; border: 2px solid var(--c); }
      .panel::before { left: -1px; top: -1px; border-right: 0; border-bottom: 0; border-radius: 14px 0 0 0; } .panel::after { right: -1px; bottom: -1px; border-left: 0; border-top: 0; border-radius: 0 0 14px 0; }
      .ph { display: flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: .14em; color: var(--c); }
      .ph b { flex: 1; } .ph i { width: 7px; height: 7px; border-radius: 50%; background: #ff4d6d; box-shadow: 0 0 8px #ff4d6d; animation: bl 1.2s steps(1) infinite; }
      @keyframes bl { 50% { opacity: .2; } }
      .ph button, .dtb button { all: unset; cursor: pointer; }
      .ph button { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 5px; border: 1px solid color-mix(in srgb, var(--c) 40%, transparent); font-size: 11px; color: #dff9ff; }
      canvas.sk { display: block; width: 216px; height: 150px; margin: 8px 0 6px; border-radius: 8px; background: radial-gradient(circle, rgba(41, 231, 255, .08), transparent 70%), repeating-linear-gradient(0deg, rgba(41, 231, 255, .06) 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, rgba(41, 231, 255, .06) 0 1px, transparent 1px 18px); }
      .st { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: rgba(223, 249, 255, .75); } .st b { color: #fff; } .st > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .st > span:last-child { flex: none; }
      .help { position: absolute; left: 0; bottom: calc(100% + 8px); width: 310px; padding: 12px; border-radius: 12px; background: rgba(0, 10, 22, .94); border: 1px solid var(--c); font-size: 12px; line-height: 1.7; color: #dff9ff; }
      .help b { color: var(--c); }
      .dock { position: fixed; right: 14px; top: 50%; transform: translateY(-50%); display: grid; gap: 6px; padding: 8px; border-radius: 16px; background: rgba(0, 10, 22, .7); border: 1px solid color-mix(in srgb, var(--c) 50%, transparent); box-shadow: 0 0 26px -12px var(--c); pointer-events: auto; }
      .dock button { all: unset; cursor: pointer; position: relative; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; color: #dff9ff; font-size: 18px; border: 1px solid transparent; transition: background .12s, border-color .12s, transform .12s; }
      .dock button:hover, .dock button.hot { background: color-mix(in srgb, var(--c) 25%, transparent); border-color: var(--c); transform: scale(1.08); }
      .dock button span { position: absolute; right: calc(100% + 10px); padding: 3px 8px; border-radius: 6px; background: rgba(0, 10, 22, .9); border: 1px solid var(--c); font-size: 11px; white-space: nowrap; opacity: 0; transition: opacity .12s; pointer-events: none; }
      .dock button:hover span, .dock button.hot span { opacity: 1; }
      .car { position: fixed; inset: 0; z-index: 3; pointer-events: auto; display: grid; place-items: center; animation: fin .35s ease; }
      @keyframes fin { from { opacity: 0; } }
      .car__bg { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 55%, rgba(0, 40, 70, .55), rgba(0, 6, 14, .92)); backdrop-filter: blur(8px); }
      .car__bg::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(41, 231, 255, .05) 0 1px, transparent 1px 4px); }
      .car__floor { position: absolute; left: 50%; top: 62%; width: 1400px; height: 700px; transform: translateX(-50%) rotateX(78deg); background: radial-gradient(circle, color-mix(in srgb, var(--c) 30%, transparent), transparent 60%), repeating-radial-gradient(circle, transparent 0 60px, color-mix(in srgb, var(--c) 25%, transparent) 61px 62px); border-radius: 50%; opacity: .6; pointer-events: none; }
      .car__stage { position: relative; width: 260px; height: 180px; perspective: 1500px; transform-style: preserve-3d; }
      .car__ring { position: absolute; inset: 0; transform-style: preserve-3d; }
      .card__x { all: unset; position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: rgba(0, 10, 20, .8); border: 1px solid rgba(255, 255, 255, .3); color: #fff; font-size: 14px; cursor: pointer; opacity: 0; transition: opacity .15s, background .15s, transform .15s; }
      .card.front .card__x, .card:hover .card__x { opacity: 1; }
      .card__x:hover, .card__x.hot { background: #ff4d6d; border-color: #ff4d6d; transform: scale(1.15); }
      .card.hot { border-color: #ffd166; box-shadow: 0 0 50px -4px #ffd166; }
      .car__side { all: unset; position: absolute; top: 50%; transform: translateY(-50%); width: 84px; height: 160px; display: grid; place-items: center; border-radius: 22px; background: rgba(0, 12, 24, .55); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); color: #dff9ff; font-size: 30px; cursor: pointer; transition: background .15s, transform .15s; }
      .car__side[data-car=l] { left: 4vw; } .car__side[data-car=r] { right: 4vw; }
      .car__side:hover, .car__side.hot { background: color-mix(in srgb, var(--c) 30%, transparent); transform: translateY(-50%) scale(1.06); }
      .car__bar { position: absolute; left: 50%; bottom: 4%; transform: translateX(-50%); display: flex; gap: 10px; }
      .car__bar button { all: unset; cursor: pointer; padding: 12px 20px; border-radius: 14px; background: rgba(0, 12, 24, .7); border: 1px solid var(--c); color: #dff9ff; font-size: 14px; font-weight: 700; transition: background .15s, transform .15s; }
      .car__bar button:hover, .car__bar button.hot { background: color-mix(in srgb, var(--c) 35%, transparent); transform: scale(1.06); }
      .edge { position: fixed; left: 0; right: 0; height: 80px; display: grid; place-items: center; pointer-events: none; opacity: 0; transition: opacity .15s; z-index: 4; }
      .edge.t { top: 0; background: linear-gradient(color-mix(in srgb, var(--c) 35%, transparent), transparent); }
      .edge.b { bottom: 0; background: linear-gradient(transparent, color-mix(in srgb, var(--c) 35%, transparent)); }
      .edge i { font-style: normal; font-size: 13px; letter-spacing: .12em; color: #fff; padding: 5px 14px; border-radius: 99px; background: rgba(0, 12, 24, .7); border: 1px solid var(--c); }
      .edge.go i { animation: nudge .6s ease-in-out infinite; } .edge.t.go i { animation-direction: reverse; }
      @keyframes nudge { 50% { transform: translateY(5px); } }
      .guide { position: fixed; inset: 0; z-index: 8; display: grid; place-items: center; background: rgba(0, 6, 14, .6); backdrop-filter: blur(6px); pointer-events: auto; animation: fin .3s ease; }
      .guide__box { width: min(880px, 94vw); padding: 26px; border-radius: 26px; background: rgba(0, 12, 24, .92); border: 1px solid var(--c); box-shadow: 0 0 80px -20px var(--c); color: #dff9ff; }
      .guide__h { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; } .guide__h b { font-size: 20px; letter-spacing: .12em; color: var(--c); } .guide__h span { font-size: 13px; opacity: .75; }
      .guide__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .gt { display: grid; gap: 6px; align-content: start; padding: 14px; border-radius: 16px; background: rgba(41, 231, 255, .05); border: 1px solid color-mix(in srgb, var(--c) 25%, transparent); }
      .gt em { font-style: normal; font-size: 30px; line-height: 1; height: 38px; font-family: "Segoe UI Emoji", "Apple Color Emoji", sans-serif; display: inline-block; }
      .gt b { font-size: 13.5px; color: #fff; font-family: "Segoe UI", system-ui, sans-serif; } .gt small { font-size: 12px; line-height: 1.45; opacity: .75; font-family: "Segoe UI", system-ui, sans-serif; }
      .gt.tap em { animation: tapdip 1.1s ease-in-out infinite; } @keyframes tapdip { 30% { transform: translateY(7px) scale(.94); } 45% { transform: none; } }
      .gt.scr em { animation: updown 1.6s ease-in-out infinite; } @keyframes updown { 25% { transform: translateY(-6px); } 75% { transform: translateY(6px); } }
      .gt.swp em { animation: side 1.4s ease-in-out infinite; } @keyframes side { 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
      .guide__f { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; font-size: 12.5px; opacity: .9; }
      .guide__f button { all: unset; cursor: pointer; padding: 12px 26px; border-radius: 14px; background: var(--c); color: #001018; font-weight: 800; font-size: 15px; font-family: "Segoe UI", system-ui, sans-serif; transition: transform .15s; white-space: nowrap; }
      .guide__f button:hover, .guide__f button.hot { transform: scale(1.06); box-shadow: 0 0 30px var(--c); }
      .card { position: absolute; inset: 0; border-radius: 14px; overflow: hidden; background: rgba(0, 20, 36, .85); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); box-shadow: 0 0 30px -10px var(--c); -webkit-box-reflect: below 10px linear-gradient(transparent 55%, rgba(255, 255, 255, .22)); transition: border-color .2s, box-shadow .2s, opacity .2s; cursor: pointer; }
      .card.front { border-color: #fff; box-shadow: 0 0 50px -4px var(--c), 0 0 0 2px var(--c); }
      .card__img { height: 140px; background: #06111c center top / cover no-repeat; display: grid; place-items: center; }
      .card__img img { width: 48px; height: 48px; filter: drop-shadow(0 0 12px var(--c)); }
      .card__t { display: flex; align-items: center; gap: 7px; height: 40px; padding: 0 10px; font-size: 12px; color: #dff9ff; white-space: nowrap; overflow: hidden; }
      .card__t img { width: 16px; height: 16px; flex: none; } .card__t span { overflow: hidden; text-overflow: ellipsis; }
      .car__info { position: absolute; left: 50%; bottom: 12%; transform: translateX(-50%); text-align: center; color: #dff9ff; pointer-events: none; }
      .car__info b { display: block; max-width: 70vw; font-size: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 0 18px var(--c); }
      .car__info span { font-size: 12px; opacity: .7; }
      .car__hint { position: absolute; left: 50%; top: 9%; transform: translateX(-50%); padding: 7px 14px; border-radius: 999px; border: 1px solid var(--c); background: rgba(0, 12, 24, .7); color: #dff9ff; font-size: 12.5px; letter-spacing: .04em; pointer-events: none; }
      canvas.ink { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 1; pointer-events: none; }
      canvas.ink.mouse { pointer-events: auto; cursor: crosshair; }
      .dtb { position: fixed; left: 50%; top: 14px; transform: translateX(-50%); z-index: 7; display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 16px; background: rgba(0, 10, 22, .85); border: 1px solid var(--c); box-shadow: 0 0 30px -10px var(--c); pointer-events: auto; color: #dff9ff; font-size: 12px; }
      .dtb b { margin-right: 6px; letter-spacing: .1em; color: var(--c); }
      .dtb button { height: 34px; min-width: 34px; padding: 0 10px; display: grid; place-items: center; border-radius: 10px; border: 1px solid transparent; font-size: 13px; color: #dff9ff; }
      .dtb button:hover, .dtb button.hot { background: color-mix(in srgb, var(--c) 25%, transparent); border-color: var(--c); }
      .dtb .sw { width: 22px; min-width: 22px; height: 22px; padding: 0; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
      .dtb .sw.on { outline: 2px solid #fff; outline-offset: 3px; }
      .guard { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; pointer-events: auto; backdrop-filter: blur(28px) saturate(.6); -webkit-backdrop-filter: blur(28px) saturate(.6); background: rgba(4, 6, 14, .55); animation: fin .15s ease; }
      .guard__box { display: grid; justify-items: center; gap: 10px; padding: 30px 40px; border-radius: 24px; background: rgba(0, 10, 22, .8); border: 1px solid var(--g, #ff6ad5); box-shadow: 0 0 60px -14px var(--g, #ff6ad5); color: #fff; text-align: center; }
      .guard__box .guard__eye { font-size: 64px; line-height: 1; opacity: 1; animation: look 2.4s ease-in-out infinite; font-family: "Segoe UI Emoji", "Apple Color Emoji", sans-serif; }
      @keyframes look { 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
      .guard__box b { font-size: 24px; font-family: "Segoe UI", system-ui, sans-serif; } .guard__box span { font-size: 13px; opacity: .75; }
      .guard.away { --g: var(--c); } .guard.away .guard__eye { animation: none; }
      .guard__clock { font-size: 44px; font-weight: 700; color: var(--c); text-shadow: 0 0 20px var(--c); }
    </style>
    <div class="lock"></div>
    <canvas class="ink" hidden></canvas>
    <div class="dtb" hidden><b>✏ AIR DRAW</b><button class="sw on" data-ink="#29e7ff" style="background:#29e7ff;color:#29e7ff"></button><button class="sw" data-ink="#ff6ad5" style="background:#ff6ad5;color:#ff6ad5"></button><button class="sw" data-ink="#ffd166" style="background:#ffd166;color:#ffd166"></button><button class="sw" data-ink="#5bff9c" style="background:#5bff9c;color:#5bff9c"></button><button class="sw" data-ink="#ffffff" style="background:#fff;color:#fff"></button>
      <button data-d="mouse" title="Draw with the mouse too">🖱 Mouse</button><button data-d="undo">↶ Undo</button><button data-d="clear">🗑 Clear</button><button data-d="save">💾 Save</button><button data-d="done">✕ Done</button></div>
    <div class="car" hidden><div class="car__bg"></div><div class="car__floor"></div><div class="car__stage"><div class="car__ring"></div></div><div class="car__info"><b></b><span></span></div>
      <div class="car__hint">✋ grab and move to spin · 👆 tap a tab to open, ✕ to close it · ✊ hold to exit</div>
      <button class="car__side" data-car="l" title="Turn left">◀</button><button class="car__side" data-car="r" title="Turn right">▶</button>
      <div class="car__bar"><button data-car="new">＋ New tab</button><button data-car="x">✕ Exit</button></div></div>
    <div class="edge t"><i>▲ SCROLLING UP</i></div><div class="edge b"><i>▼ SCROLLING DOWN</i></div>
    <div class="cur off"><div class="ring"></div><div class="ring2"></div><div class="dot"></div><span class="tick"></span><span class="tick"></span><span class="ico">↕</span><svg class="hold" viewBox="0 0 92 92"><circle cx="46" cy="46" r="42"/></svg><span class="hl"></span></div>
    <div class="fcur off"><div class="ring"></div><div class="eye">👁</div><svg class="wink" viewBox="0 0 76 76"><circle cx="38" cy="38" r="35"/></svg></div>
    <div class="flash"></div>
    <nav class="dock" aria-label="Air control actions">
      <button data-a="back">⟵<span>Back</span></button><button data-a="forward">⟶<span>Forward</span></button><button data-a="reload">⟳<span>Reload</span></button>
      <button data-a="carousel">🌀<span>All tabs in 3D</span></button><button data-a="draw">✏<span>Air drawing</span></button>
      <button data-a="newtab">＋<span>New tab</span></button><button data-a="close">✕<span>Close tab</span></button><button data-a="minimize">▁<span>Minimize window</span></button><button data-a="off">⏻<span>Turn hand control off</span></button>
    </nav>
    <div class="panel">
      <div class="ph"><i></i><b>AIR CONTROL</b><button data-help title="Gestures">?</button><button data-hide title="Hide this panel">–</button></div>
      <canvas class="sk" width="432" height="300"></canvas>
      <div class="st"><span data-g>Show your hand</span><span><b data-fps>0</b> fps · <span data-face>🙂</span></span></div>
    </div>
    <div class="guide" hidden><div class="guide__box">
      <div class="guide__h"><b>✋ AIR CONTROL</b><span>Your hand is the mouse. Sit an arm's length from the camera, raise your hand and try these:</span></div>
      <div class="guide__grid">
        <div class="gt"><em>☝️</em><b>Point to move</b><small>Move your whole hand, not just the finger. The cursor glides and sticks to links.</small></div>
        <div class="gt tap"><em>👆</em><b>Tap to click</b><small>Flick your index finger down and up, like pressing a button. Tap twice for a double-click.</small></div>
        <div class="gt"><em>🤏</em><b>Or pinch to click</b><small>Touch thumb and index finger. Pinch and move to drag the page.</small></div>
        <div class="gt scr"><em>✋</em><b>Open hand up / down</b><small>Scrolls the page. Two fingers ✌️ scroll too, like a trackpad.</small></div>
        <div class="gt scr"><em>☝️</em><b>Point at the edge</b><small>Hold the cursor at the top or bottom of the screen to keep scrolling.</small></div>
        <div class="gt swp"><em>✋</em><b>Swipe sideways</b><small>Open hand: next / previous tab. Two fingers ✌️: back / forward.</small></div>
        <div class="gt"><em>✊</em><b>Hold a fist</b><small>All your tabs in 3D. Tap one to open it, ✕ to close it, or ＋ for a new tab.</small></div>
        <div class="gt"><em>👍</em><b>Hold a pose</b><small>👍 play / pause video · 🤟 air drawing · 👎 reload · plus poses you teach DevTab.</small></div>
      </div>
      <div class="guide__f"><span>A ring fills while you hold a pose, so nothing fires by accident. Open this guide again with <b>?</b> on the hand panel.</span><button data-guide-ok>Got it · let's go</button></div>
    </div></div>
    <div class="guard" hidden><div class="guard__box"><span class="guard__eye">👀</span><b></b><span class="guard__txt"></span><div class="guard__clock" hidden></div></div></div>`;
    ui = {
      root: r, cur: r.querySelector(".cur"), fcur: r.querySelector(".fcur"), lock: r.querySelector(".lock"), flash: r.querySelector(".flash"), hold: r.querySelector(".hold circle"), hl: r.querySelector(".hl"),
      wink: r.querySelector(".wink circle"), cv: r.querySelector("canvas.sk"), g: r.querySelector("[data-g]"), fps: r.querySelector("[data-fps]"), face: r.querySelector("[data-face]"),
      dock: r.querySelector(".dock"), panel: r.querySelector(".panel"), car: r.querySelector(".car"), ring: r.querySelector(".car__ring"), info: r.querySelector(".car__info"),
      ink: r.querySelector("canvas.ink"), dtb: r.querySelector(".dtb"), guard: r.querySelector(".guard"),
      edgeT: r.querySelector(".edge.t"), edgeB: r.querySelector(".edge.b"), guide: r.querySelector(".guide"),
    };
    ui.panel.hidden = !cfg.air || cfg.airPanel === false; ui.dock.hidden = !cfg.air;
    r.querySelector("[data-help]").onclick = () => showGuide(ui.guide.hidden);
    r.querySelector("[data-guide-ok]").onclick = () => showGuide(false);
    r.querySelector("[data-hide]").onclick = () => { ui.panel.hidden = true; };
    ui.dock.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b) act(b.dataset.a); });
    ui.dtb.addEventListener("click", (e) => drawButton(e.target.closest("button")));
    ui.car.addEventListener("click", (e) => {
      const x = e.target.closest("[data-close]"); if (x) { e.stopPropagation(); return closeTabInCarousel(+x.dataset.close); }
      const b = e.target.closest("[data-car]");
      if (b) { const k = b.dataset.car; if (k === "l" || k === "r") { car.rot += (k === "l" ? 1 : -1) * car.step; car.vel = 0; } else if (k === "new") { closeCarousel(); act("newtab"); } else closeCarousel(); return; }
      const c = e.target.closest(".card"); if (c) return pickTab(+c.dataset.id);
      if (e.isTrusted && e.target.closest(".car__bg")) closeCarousel();
    });
    ui.car.addEventListener("wheel", (e) => { e.preventDefault(); car.rot -= e.deltaY * 0.25; spin(); }, { passive: false });
    setupInk();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    chrome.runtime.sendMessage({ type: "cam-state?" }).then(guard).catch(() => {});
    if (cfg.air && !cfg.airGuided && !EXT_PAGE) showGuide(true); // the first time: how it works
  }
  function teardown() { cancelAnimationFrame(raf); if (host) host.remove(); host = null; ui = null; }
  async function showGuide(on) {
    if (!ui) return;
    ui.guide.hidden = !on;
    if (!on && !cfg.airGuided) { cfg.airGuided = true; const k = "devtab:settings", s = (await chrome.storage.local.get(k))[k] || {}; s.fx = { ...(s.fx || {}), airGuided: true }; await chrome.storage.local.set({ [k]: s }); }
  }
  const ensure = () => { if (!ui) build(); return ui; };

  let flashT = 0;
  function flash(text) { if (!ui) return; ui.flash.textContent = text; ui.flash.classList.add("on"); clearTimeout(flashT); flashT = setTimeout(() => ui && ui.flash.classList.remove("on"), 1200); }
  function ripple(x, y) { const d = document.createElement("div"); d.className = "ripple"; d.style.left = x + "px"; d.style.top = y + "px"; ui.root.append(d); setTimeout(() => d.remove(), 520); }

  /* ---------- actions ---------- */
  const mainVideo = () => [...document.querySelectorAll("video")].filter((v) => { const r = v.getBoundingClientRect(); return r.width > 120 && r.height > 60; }).sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  function playVideo(play) {
    const v = mainVideo(); if (!v) return false;
    if (play === undefined) play = v.paused;
    if (play) v.play().catch(() => { const b = document.querySelector(".ytp-play-button"); if (b) b.click(); }); else v.pause();
    return play ? "▶ Playing" : "⏸ Paused";
  }
  const BG_LABEL = { next: "Next tab ⟶", prev: "⟵ Previous tab", minimize: "▁ Minimize", newtab: "＋ New tab", close: "✕ Close tab", off: "⏻ Hand control off", mute: "🔇 Mute / unmute", hub: "✦ DevTab Hub", focus: "🎯 Focus", sounds: "🎵 Sounds", capture: "📸 Screenshot saved", fullshot: "📸 Full-page screenshot…", openurl: "↗ Opening…" };
  function act(a, extra = {}) {
    if (a === "back") { flash("⟵ Back"); history.back(); }
    else if (a === "forward") { flash("⟶ Forward"); history.forward(); }
    else if (a === "reload") { flash("⟳ Reload"); location.reload(); }
    else if (a === "playpause" || a === "pause" || a === "play") { const r = playVideo(a === "playpause" ? undefined : a === "play"); if (r) flash(r); }
    else if (a === "top") { scrollTo({ top: 0, behavior: "smooth" }); flash("⤒ Top"); }
    else if (a === "bottom") { scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }); flash("⤓ Bottom"); }
    else if (a === "carousel") openCarousel();
    else if (a === "draw") toggleDraw();
    else if (a === "carclose") { closeCarousel(); flash("✊ Closed"); }
    else if (a === "guide") showGuide(true);
    else { flash(BG_LABEL[a] || a); chrome.runtime.sendMessage({ type: "air-act", act: a, ...extra }).catch(() => {}); }
  }
  const CLICKABLE = 'a[href], button, input, select, textarea, summary, label, video, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick], [tabindex]:not([tabindex="-1"])';
  function under(x, y) {
    let el = document.elementFromPoint(x, y);
    if (el === host) {
      let mine = ui.root.elementFromPoint(x, y);
      // the browser doesn't hit-test the 3D cards reliably, so check their on-screen boxes, nearest first
      if (car.open && mine && mine.closest && !mine.closest("button")) {
        const inBox = (e) => { const r = e.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
        const cards = [...ui.ring.querySelectorAll(".card")].filter((c) => c.style.pointerEvents !== "none").sort((a, b) => +b.style.zIndex - +a.style.zIndex);
        const c = cards.find(inBox); if (c) { const xb = c.querySelector(".card__x"); mine = xb && inBox(xb) ? xb : c; }
      }
      return { mine };
    }
    while (el && el.shadowRoot && el.shadowRoot.elementFromPoint) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner; }
    return { el };
  }
  function click(x, y, dbl) {
    const p = target(x, y); x = p.x; y = p.y;
    ripple(x, y);
    if (p.mine) { const b = p.mine.closest && p.mine.closest("button, .card"); if (b) b.click(); return; }
    const el = p.el; if (!el) return;
    const o = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: window, button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...o, pointerType: "mouse", isPrimary: true }));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    const t = p.t || el.closest(CLICKABLE) || el;
    if (t.matches && t.matches("input, textarea, select, [contenteditable]")) t.focus();
    el.dispatchEvent(new PointerEvent("pointerup", { ...o, pointerType: "mouse", isPrimary: true }));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    if (t.tagName === "VIDEO") { playVideo(); return; }
    // links that open a new tab would be stopped as a pop-up, so DevTab opens them itself
    const a = t.closest && t.closest("a[href]");
    if (a && a.target === "_blank" && /^https?:/i.test(a.href)) { chrome.runtime.sendMessage({ type: "air-act", act: "openurl", url: a.href }).catch(() => {}); flash("↗ Opening in a new tab"); return; }
    t.click();
    if (dbl) el.dispatchEvent(new MouseEvent("dblclick", { ...o, detail: 2 }));
  }
  function dblAt(x, y) {
    const p = target(x, y); ripple(p.x, p.y);
    if (p.mine || !p.el) return;
    p.el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, view: window, button: 0, detail: 2 }));
  }
  let hlT = 0;
  function flash2(text) { if (!ui) return; ui.hl.textContent = text; ui.hl.classList.add("on"); clearTimeout(hlT); hlT = setTimeout(() => ui && !st.hold && ui.hl.classList.remove("on"), 700); }
  function scrollAt(x, y, dy) {
    let el = under(x, y).el;
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) { el.scrollBy({ top: dy }); return; }
      el = el.parentElement;
    }
    window.scrollBy({ top: dy });
  }

  /* ---------- your own gestures: hand shape, normalised for position, size and angle ---------- */
  function shape(lm) {
    const w = lm[0], m = lm[9], ang = Math.atan2(m[0] - w[0], -(m[1] - w[1])), s = Math.hypot(m[0] - w[0], m[1] - w[1]) || 0.1;
    const c = Math.cos(-ang), sn = Math.sin(-ang), v = [];
    for (const p of lm) { const x = (p[0] - w[0]) / s, y = (p[1] - w[1]) / s; v.push(x * c - y * sn, x * sn + y * c); }
    return v;
  }
  const vdist = (a, b, mirror) => { let d = 0; for (let i = 0; i < a.length; i += 2) d += Math.hypot((mirror ? -a[i] : a[i]) - b[i], a[i + 1] - b[i + 1]); return d / (a.length / 2); };
  function myMatch(lm) {
    if (!myGestures.length) return null;
    const v = shape(lm); let best = null, bd = 9, second = 9;
    for (const gs of myGestures) { let d = 9; for (const smp of gs.samples || []) d = Math.min(d, vdist(v, smp), vdist(v, smp, true)); if (d < bd) { second = bd; bd = d; best = gs; } else if (d < second) second = d; }
    return best && bd < (cfg.gestureTol || 0.24) && (myGestures.length === 1 || bd < second * 0.8) ? best : null;
  }

  /* ---------- hand gestures ---------- */
  // The cursor follows your knuckles, not your fingertip, so tapping or
  // pinching doesn't shake it. Each camera frame is filtered, and a loop at the
  // screen's own frame rate glides the cursor there, so it moves smoothly
  // instead of jumping 30 times a second.
  const st = {
    armed: false, handGone: 0, shownAt: performance.now(), lastHand: 0, fired: null, hold: null, holdT: 0,
    tx: null, ty: null, px: null, py: null, pHist: [], mode: "point", hot: false, lockT: 0,
    pinch: false, pStart: 0, pPos: null, pMid: null, drag: false,
    rHist: [], tap: null, lastTap: 0, lastTapPos: null, aHist: [],
    sPrev: null, sHist: [], freeze: null, v: 0, q: 0, scrollEl: null, swipeCool: 0, edgeT: 0, edgeEl: null,
  };
  const HOLDS = {
    Closed_Fist: ["carousel", 650, "✊ All tabs in 3D"], Thumb_Up: ["playpause", 700, "👍 Play / pause"],
    ILoveYou: ["draw", 800, "🤟 Air drawing"], Thumb_Down: ["reload", 1000, "👎 Reload"],
  };

  function setHold(name, now, spec) {
    if (name && !st.armed) name = null;
    if (!name) { st.hold = null; ui.hold.style.strokeDashoffset = "264"; ui.hl.classList.remove("on"); return; }
    if (st.fired === name) return; // done already; change pose to do it again
    if (st.hold !== name) { st.hold = name; st.holdT = now; }
    const [a, dur, label, extra] = spec || HOLDS[name], k = clamp((now - st.holdT) / dur, 0, 1);
    ui.hold.style.strokeDashoffset = String(264 * (1 - k));
    ui.hl.textContent = label; ui.hl.classList.add("on");
    if (k >= 1) { st.fired = name; setHold(null); act(a, extra || {}); }
  }

  // scrolling is queued and played out smoothly by the frame loop
  const scrollDir = () => (cfg.airScrollFlip ? -1 : 1);
  function scrollable(x, y) {
    let el = under(x, y).el;
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) return el;
      el = el.parentElement;
    }
    return null; // the page itself
  }
  const scrollNow = (el, dy) => (el && el.isConnected ? el : window).scrollBy({ top: dy, behavior: "instant" });
  function endScroll(fling) {
    if (st.sPrev && fling && Math.abs(st.v) > 4) st.q = clamp(st.q + st.v * 7, -2500, 2500); // a little momentum
    st.sPrev = null; st.v = 0; st.sHist = []; st.freeze = null;
  }

  // a tap (or pinch) clicks; a second one on the same spot within half a second is a double-click
  function tapAt(p) {
    const now = performance.now();
    if (now - st.lastTap < 520 && st.lastTapPos && Math.hypot(p[0] - st.lastTapPos[0], p[1] - st.lastTapPos[1]) < 60) {
      dblAt(st.lastTapPos[0], st.lastTapPos[1]); st.lastTap = 0; flash2("👆👆 Double tap");
    } else { click(p[0], p[1]); st.lastTap = now; st.lastTapPos = p; }
  }
  const posAgo = (ms) => { const t = performance.now() - ms; let best = st.pHist[st.pHist.length - 1]; for (let i = st.pHist.length - 1; i >= 0; i--) { best = st.pHist[i]; if (st.pHist[i][2] <= t) break; } return best ? [best[0], best[1]] : [st.px, st.py]; };

  function handFrame(m, now) {
    const lm = m.lm;
    if (!lm) {
      if (st.lastHand && !st.handGone) st.handGone = now;
      endScroll(false); ui.cur.classList.add("off"); ui.lock.classList.remove("on"); setHold(null);
      if (draw.on && st.pinch) endStroke();
      st.pinch = false; st.drag = false; st.fired = null; st.tap = null; st.rHist = []; st.aHist = []; car.gx = null;
      ui.g.textContent = "Show your hand"; return false;
    }
    if (st.handGone && now - st.handGone > 500) st.armed = true;
    st.handGone = 0; st.lastHand = now;
    const d = (a, b) => Math.hypot(lm[a][0] - lm[b][0], lm[a][1] - lm[b][1]);
    const size = d(0, 9) || 0.1, ext = (t, p) => d(t, 0) > d(p, 0) * 1.08;
    const f = { i: ext(8, 6), m: ext(12, 10), r: ext(16, 14), p: ext(20, 18) };
    const pr = d(4, 8) / size;
    const g = m.gs > 0.5 ? m.g : "None";
    const palm = g === "Open_Palm" || (f.i && f.m && f.r && f.p && pr > 0.55);
    const two = !palm && (g === "Victory" || (f.i && f.m && !f.r && !f.p && pr > 0.4));
    const mine = !st.pinch && !palm ? myMatch(lm) : null;
    const posed = !!mine || ["Closed_Fist", "Thumb_Up", "Thumb_Down", "ILoveYou"].includes(g);
    const key = mine ? "my:" + mine.id : g;
    if (st.fired && st.fired !== key) st.fired = null;
    if (!st.armed && ((!HOLDS[g] && !mine) || now - st.shownAt > 2500)) st.armed = true;

    // where the cursor should be: index + middle knuckles, mapped from a comfortable box in the camera view
    const ax = lm[5][0] * 0.6 + lm[9][0] * 0.4, ay = lm[5][1] * 0.6 + lm[9][1] * 0.4;
    st.aHist.push([ax, ay, now]); while (st.aHist.length > 1 && now - st.aHist[0][2] > 260) st.aHist.shift();
    const sp = cfg.airSpeed || 1, bw = 0.46 / sp, bh = 0.38 / sp, bx = 0.5 - bw / 2, by = 0.56 - bh / 2;
    let tx = fx.f(clamp((ax - bx) / bw, 0, 1), now) * innerWidth, ty = fy.f(clamp((ay - by) / bh, 0, 1), now) * innerHeight;
    if (st.tx !== null && !st.freeze && Math.hypot(tx - st.tx, ty - st.ty) < 1.5) { tx = st.tx; ty = st.ty; } // ignore the tiniest shimmer
    if (st.px === null) { st.px = tx; st.py = ty; }
    const o = st.aHist[0], still = Math.hypot(ax - o[0], ay - o[1]) < 0.03;

    // pinch: thumb meets index finger
    let pinchStart = false, pinchEnd = false;
    if (!st.pinch && pr < 0.3 && !palm && !two && !posed) { st.pinch = true; pinchStart = true; st.pStart = now; st.drag = false; st.pPos = [st.px, st.py]; st.pMid = [(lm[4][0] + lm[8][0]) / 2, (lm[4][1] + lm[8][1]) / 2]; st.tap = null; }
    else if (st.pinch && (pr > 0.45 || posed)) { st.pinch = false; pinchEnd = !posed; }

    // air tap: flick the index finger down (like pressing a button) and back up
    const r = d(8, 5) / size;
    st.rHist.push([r, now]); while (st.rHist.length > 1 && now - st.rHist[0][1] > 450) st.rHist.shift();
    let tapped = null;
    if (!st.pinch && !palm && !two && !posed) {
      const top = Math.max(...st.rHist.map((h) => h[0]));
      if (!st.tap) {
        if (top > 0.42 && r < top * 0.74 && still && !f.m) { st.tap = { t: now, min: r, top, at: posAgo(160) }; ui.cur.classList.add("press"); }
      } else {
        st.tap.min = Math.min(st.tap.min, r);
        if (r > st.tap.min + (st.tap.top - st.tap.min) * 0.45) { if (now - st.tap.t < 650) tapped = st.tap.at; st.tap = null; }
        else if (now - st.tap.t > 650) st.tap = null; // it stayed bent: that's a fist, not a tap
      }
    } else st.tap = null;
    if (!st.tap) ui.cur.classList.remove("press");

    const mode = st.pinch ? (st.drag ? "drag" : "pinch") : mine ? "mine" : palm || two ? "scroll" : HOLDS[g] ? "hold" : "point";
    st.mode = mode;

    // the target the frame loop glides to
    if (mode === "scroll" && !car.open) { if (!st.freeze) st.freeze = [st.px, st.py]; st.tx = st.freeze[0]; st.ty = st.freeze[1]; }
    else if (st.pinch && !st.drag && !draw.on) { st.tx = st.pPos[0]; st.ty = st.pPos[1]; }
    else { if (mode !== "scroll") st.freeze = null; st.tx = tx; st.ty = ty; }

    // poses you hold: a ring fills, then it happens
    if (mine) setHold("my:" + mine.id, now, [mine.action, 700, "★ " + mine.name, { url: mine.url, name: "gesture" }]);
    else if (car.open && g === "Closed_Fist") setHold("Closed_Fist", now, ["carclose", 450, "✊ Close"]);
    else if (mode === "hold" && still && !(car.open && g !== "Closed_Fist")) setHold(g, now);
    else setHold(null);

    if (car.open) carouselHand(mode, ax, tapped, pinchStart, now);
    else if (draw.on) drawHand(mode, pinchStart, pinchEnd, tapped);
    else {
      if (tapped) tapAt(tapped);
      if (pinchEnd && !st.drag && now - st.pStart < 700) tapAt(st.pPos);
      if (st.pinch) {
        // pinch and move: grab the page and drag it
        const mid = [(lm[4][0] + lm[8][0]) / 2, (lm[4][1] + lm[8][1]) / 2];
        if (!st.drag && Math.hypot(mid[0] - st.pMid[0], mid[1] - st.pMid[1]) > 0.04) { st.drag = true; st.scrollEl = scrollable(st.pPos[0], st.pPos[1]); }
        if (st.drag) { st.q += -(mid[1] - st.pMid[1]) * innerHeight * 2.4 * (cfg.airScroll || 1); st.pMid = mid; }
      }
      if (mode === "scroll") {
        // open hand or two fingers: move up / down to scroll, swipe sideways for tabs (✋) or back / forward (✌)
        if (!st.sPrev) { st.sPrev = [ax, ay]; st.sHist = []; st.scrollEl = scrollable(st.freeze[0], st.freeze[1]); }
        st.sHist.push([ax, ay, now]); while (st.sHist.length > 1 && now - st.sHist[0][2] > 380) st.sHist.shift();
        const dy = ay - st.sPrev[1]; st.sPrev = [ax, ay];
        const h0 = st.sHist[0], sx = ax - h0[0], sy = ay - h0[1];
        if (Math.abs(sx) > 0.17 && Math.abs(sx) > Math.abs(sy) * 2.2 && now > st.swipeCool && st.armed) {
          st.swipeCool = now + 1000; st.sHist = []; st.q = 0; st.v = 0;
          act(palm ? (sx > 0 ? "next" : "prev") : sx > 0 ? "forward" : "back");
        } else if (Math.abs(dy) > 0.0012 && ay < 0.9 && now > st.swipeCool - 600) {
          const amt = dy * innerHeight * 2.8 * (cfg.airScroll || 1) * scrollDir();
          st.q += amt; st.v = st.v * 0.6 + amt * 0.4;
        } else st.v *= 0.7;
      } else if (st.sPrev) endScroll(true);
    }

    ui.g.textContent = car.open ? (mode === "scroll" ? "🌀 Spinning" : "☝ Tap a tab · ✊ close") : draw.on ? (st.pinch ? "✏ Drawing" : "✏ Pinch to draw") : st.pinch ? (st.drag ? "🤏 Dragging" : "🤏 Pinch") : mine ? "★ " + mine.name : mode === "scroll" ? (palm ? "✋ Scroll · swipe: tabs" : "✌ Scroll · swipe: back") : mode === "hold" ? NAMES[g] : "☝ Point · tap to click";
    ui.cur.classList.remove("off");
    ui.cur.classList.toggle("pinch", st.pinch); ui.cur.classList.toggle("scroll", mode === "scroll"); ui.cur.classList.toggle("pen", draw.on);
    return true;
  }

  // the frame loop: glides the cursor, plays out scrolling, edge-scrolls, spins the carousel, draws ink
  let raf = 0, lastT = 0;
  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (!ui) return;
    const dt = Math.min(64, t - (lastT || t)); lastT = t;
    const live = cfg.air && performance.now() - st.lastHand < 350;
    if (st.tx !== null && st.px !== null) {
      const k = 1 - Math.exp(-dt / (st.hot && st.mode === "point" ? 85 : 55));
      st.px += (st.tx - st.px) * k; st.py += (st.ty - st.py) * k;
      ui.cur.style.transform = `translate(${st.px.toFixed(1)}px, ${st.py.toFixed(1)}px)`;
      st.pHist.push([st.px, st.py, t]); if (st.pHist.length > 40) st.pHist.shift();
    }
    // queued scrolling, eased
    if (Math.abs(st.q) >= 0.5) {
      let s = st.q * (1 - Math.exp(-dt / 75));
      if (Math.abs(s) < 1) s = Math.sign(st.q) * Math.min(1, Math.abs(st.q));
      s = Math.round(s); if (s) { scrollNow(st.scrollEl, s); st.q -= s; } else st.q = 0;
    } else st.q = 0;
    // point at the top or bottom edge to scroll
    let edge = 0;
    if (live && st.mode === "point" && !car.open && !draw.on && st.py !== null) {
      const z = Math.min(80, innerHeight * 0.09);
      edge = st.py < z ? -(1 - st.py / z) : st.py > innerHeight - z ? (st.py - (innerHeight - z)) / z : 0;
    }
    if (edge) {
      if (!st.edgeT) { st.edgeT = t; st.edgeEl = scrollable(st.px, clamp(st.py, 100, innerHeight - 100)); }
      if (t - st.edgeT > 420) scrollNow(st.edgeEl, Math.sign(edge) * Math.max(1, Math.round(Math.abs(edge) ** 1.4 * dt * 1.1 * (cfg.airScroll || 1))));
    } else st.edgeT = 0;
    ui.edgeT.style.opacity = edge < 0 ? String(0.25 + Math.abs(edge) * 0.75) : "0"; ui.edgeB.style.opacity = edge > 0 ? String(0.25 + edge * 0.75) : "0";
    ui.edgeT.classList.toggle("go", edge < 0 && t - st.edgeT > 420); ui.edgeB.classList.toggle("go", edge > 0 && t - st.edgeT > 420);
    if (car.open) carouselTick(dt, live);
    if (draw.on && st.pinch && draw.cur && live) addPoint(st.px, st.py);
    if (live && t - st.lockT > 45) { st.lockT = t; lockOn(st.px, st.py, st.mode === "point" || st.mode === "pinch" || st.mode === "hold"); }
  }

  // the clickable thing at (x, y), or one just next to it: the cursor doesn't have to be pixel-perfect
  const NEAR = [[0, -12], [0, 12], [-12, 0], [12, 0], [-10, -10], [10, -10], [-10, 10], [10, 10], [0, -22], [0, 22], [-22, 0], [22, 0]];
  function target(x, y) {
    const u = under(x, y);
    if (u.mine) return { mine: u.mine, x, y };
    const hit = (el) => (el && el.closest ? el.closest(CLICKABLE) : null);
    if (hit(u.el)) return { el: u.el, t: hit(u.el), x, y };
    for (const [dx, dy] of NEAR) {
      const v = under(x + dx, y + dy), h = !v.mine && hit(v.el);
      if (h) { const r = h.getBoundingClientRect(); return { el: v.el, t: h, x: clamp(x, r.left + 2, r.right - 2), y: clamp(y, r.top + 2, r.bottom - 2) }; }
    }
    return { el: u.el, t: null, x, y };
  }
  function lockOn(x, y, allow) {
    if (x === null) return;
    const u = target(x, y);
    ui.root.querySelectorAll(".dock .hot, .dtb .hot, .car .hot, .guide .hot").forEach((b) => b.classList.remove("hot"));
    if (u.mine) { const b = u.mine.closest && u.mine.closest("button, .card"); if (b) b.classList.add("hot"); ui.lock.classList.remove("on"); st.hot = !!b; ui.cur.classList.toggle("hot", st.hot); return; }
    st.hot = !!u.t; ui.cur.classList.toggle("hot", st.hot);
    if (u.t && allow) { const r = u.t.getBoundingClientRect(); if (r.width < innerWidth * 0.9 && r.height < innerHeight * 0.6) { Object.assign(ui.lock.style, { transform: `translate(${r.left - 4}px, ${r.top - 4}px)`, width: r.width + 8 + "px", height: r.height + 8 + "px" }); ui.lock.classList.add("on"); return; } }
    ui.lock.classList.remove("on");
  }

  /* ---------- 3D tab carousel ---------- */
  const car = { open: false, tabs: [], rot: 0, vel: 0, gx: null, step: 30, R: 400, front: null };
  const esc = (s) => String(s || "").replace(/[<>&"]/g, "");
  function renderCards() {
    // many tabs make a full ring; a few sit on an arc, so they don't stand edge-on
    const tabs = car.tabs, n = tabs.length; car.full = n >= 9;
    const step = car.full ? 360 / n : 34, R = car.full ? Math.max(340, 140 / Math.tan(Math.PI / n)) : 560;
    car.step = step; car.R = R;
    const fav = (t) => (t.fav ? `<img src="${esc(t.fav)}" alt="">` : "");
    ui.ring.innerHTML = tabs.map((t, i) => `<div class="card" data-id="${t.id}" data-i="${i}" style="transform: rotateY(${i * step}deg) translateZ(${R}px)"><div class="card__img" style="${t.thumb ? `background-image:url('${t.thumb}')` : ""}">${t.thumb ? "" : fav(t)}</div><div class="card__t">${fav(t)}<span>${esc(t.title)}</span></div><button class="card__x" data-close="${t.id}" title="Close this tab">✕</button></div>`).join("");
  }
  async function openCarousel() {
    ensure();
    const tabs = await chrome.runtime.sendMessage({ type: "air-tabs" }).catch(() => null);
    if (!tabs || !tabs.length) return flash("No tabs to show");
    if (draw.on) toggleDraw(false);
    car.tabs = tabs; car.open = true; car.gx = null; car.vel = 0;
    renderCards();
    car.rot = -Math.max(0, tabs.findIndex((t) => t.active)) * car.step; spin();
    ui.car.hidden = false;
  }
  function spin() {
    if (!car.tabs.length) return;
    const n = car.tabs.length;
    if (!car.full) { const lo = -(n - 1) * car.step; if (car.rot > 0 || car.rot < lo) { car.rot = clamp(car.rot, lo - 8, 8); car.vel *= 0.5; } }
    ui.ring.style.transform = `translateZ(${-car.R}px) rotateY(${car.rot}deg)`;
    const i = car.full ? ((Math.round(-car.rot / car.step) % n) + n) % n : clamp(Math.round(-car.rot / car.step), 0, n - 1);
    ui.ring.querySelectorAll(".card").forEach((c) => {
      const k = +c.dataset.i, rel = ((k * car.step + car.rot) % 360 + 540) % 360 - 180; // angle from the front
      c.classList.toggle("front", k === i);
      c.style.opacity = String(Math.max(0.12, Math.cos((rel * Math.PI) / 180) * 0.85 + 0.15)); // the back of the ring fades
      c.style.zIndex = String(Math.round(180 - Math.abs(rel)));
      c.style.pointerEvents = Math.abs(rel) < 70 ? "auto" : "none";
    });
    const t = car.tabs[i]; car.front = t;
    ui.info.querySelector("b").textContent = t.title || t.url;
    ui.info.querySelector("span").textContent = `${i + 1} of ${n} · ${(() => { try { return new URL(t.url).hostname; } catch (e) { return ""; } })()}`;
  }
  function pickTab(id) { closeCarousel(); chrome.runtime.sendMessage({ type: "air-act", act: "goto", id }).catch(() => {}); }
  function closeTabInCarousel(id) {
    const i = car.tabs.findIndex((t) => t.id === id); if (i < 0) return;
    const front = car.front && car.front.id;
    chrome.runtime.sendMessage({ type: "air-act", act: "closetab", id }).catch(() => {});
    car.tabs.splice(i, 1); flash("✕ Tab closed");
    if (!car.tabs.length) return closeCarousel();
    renderCards();
    const fi = Math.max(0, car.tabs.findIndex((t) => t.id === front));
    car.rot = -(front === id ? Math.min(i, car.tabs.length - 1) : fi) * car.step; spin();
  }
  function closeCarousel() { car.open = false; car.gx = null; if (ui) ui.car.hidden = true; }
  function carouselHand(mode, ax, tapped, pinchStart, now) {
    if (mode === "scroll") { // grab the ring and turn it
      if (car.gx === null) car.gx = ax;
      const dx = ax - car.gx; car.gx = ax;
      const dr = dx * 460; car.rot += dr; car.vel = car.vel * 0.5 + dr * 0.5; car.moved = now;
    } else car.gx = null;
    if (tapped) tapAt(tapped);
    if (pinchStart) tapAt([st.px, st.py]);
  }
  function carouselTick(dt, live) {
    if (car.gx === null) {
      if (Math.abs(car.vel) > 0.08) { car.rot += car.vel * (dt / 33); car.vel *= Math.pow(0.88, dt / 16); }
      else { car.vel = 0; const snap = Math.round(car.rot / car.step) * car.step; car.rot += (snap - car.rot) * (1 - Math.exp(-dt / 110)); }
    }
    // hover the ◀ ▶ buttons to keep turning
    if (live && st.px !== null) { const u = under(st.px, st.py), b = u.mine && u.mine.closest && u.mine.closest("[data-car=l], [data-car=r]"); if (b) { car.rot += (b.dataset.car === "l" ? 1 : -1) * dt * 0.09; car.vel = 0; } }
    spin();
  }

  /* ---------- air drawing ---------- */
  const draw = { on: false, strokes: [], cur: null, color: "#29e7ff", mouse: false };
  function setupInk() {
    const c = ui.ink;
    const size = () => { if (!ui) return; const d = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * d; c.height = innerHeight * d; c.getContext("2d").setTransform(d, 0, 0, d, 0, 0); renderInk(); };
    addEventListener("resize", size); addEventListener("scroll", () => draw.on && renderInk(), { passive: true }); size();
    let m = null;
    c.addEventListener("pointerdown", (e) => { m = true; startStroke(e.clientX, e.clientY); c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", (e) => { if (m) addPoint(e.clientX, e.clientY); });
    c.addEventListener("pointerup", () => { m = null; endStroke(); });
  }
  function startStroke(x, y) { draw.cur = { c: draw.color, pts: [[x + scrollX, y + scrollY]] }; draw.strokes.push(draw.cur); renderInk(); }
  function addPoint(x, y) { if (!draw.cur) return; const p = draw.cur.pts, l = p[p.length - 1], nx = x + scrollX, ny = y + scrollY; if (Math.hypot(nx - l[0], ny - l[1]) > 2) { p.push([nx, ny]); renderInk(); } }
  function endStroke() { if (draw.cur && draw.cur.pts.length < 2) draw.strokes.pop(); draw.cur = null; renderInk(); }
  function renderInk() {
    if (!ui) return; const x = ui.ink.getContext("2d"); x.clearRect(0, 0, innerWidth, innerHeight);
    if (!draw.on) return;
    for (const s of draw.strokes) {
      // a smooth curve through the midpoints, so lines look hand-drawn, not jagged
      const path = () => {
        const P = s.pts.map(([px, py]) => [px - scrollX, py - scrollY]);
        x.beginPath(); x.moveTo(P[0][0], P[0][1]);
        for (let i = 1; i < P.length - 1; i++) x.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
        if (P.length > 1) x.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
      };
      x.lineCap = x.lineJoin = "round";
      x.strokeStyle = s.c; x.lineWidth = 9; x.shadowColor = s.c; x.shadowBlur = 22; x.globalAlpha = 0.65; path(); x.stroke();
      x.shadowBlur = 0; x.globalAlpha = 1; x.strokeStyle = "#fff"; x.lineWidth = 2.6; path(); x.stroke();
    }
  }
  function toggleDraw(on = !draw.on) {
    ensure(); draw.on = on;
    ui.ink.hidden = ui.dtb.hidden = !on; ui.ink.classList.toggle("mouse", on && draw.mouse);
    renderInk(); flash(on ? "✏ Air drawing: pinch and move to draw" : "✏ Drawing off");
  }
  async function drawButton(b) {
    if (!b) return;
    if (b.dataset.ink) { draw.color = b.dataset.ink; ui.dtb.querySelectorAll(".sw").forEach((s) => s.classList.toggle("on", s === b)); host.style.setProperty("--ink", draw.color); return; }
    const d = b.dataset.d;
    if (d === "undo") { draw.strokes.pop(); renderInk(); }
    else if (d === "clear") { draw.strokes = []; renderInk(); }
    else if (d === "mouse") { draw.mouse = !draw.mouse; ui.ink.classList.toggle("mouse", draw.mouse); b.style.borderColor = draw.mouse ? "var(--c)" : ""; }
    else if (d === "done") toggleDraw(false);
    else if (d === "save") {
      // hide the HUD, keep the drawing, take the picture, bring the HUD back
      const hide = [ui.dtb, ui.cur, ui.fcur, ui.panel, ui.dock, ui.lock, ui.flash];
      const was = hide.map((e) => e.style.visibility); hide.forEach((e) => (e.style.visibility = "hidden"));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await chrome.runtime.sendMessage({ type: "air-act", act: "capture", name: "drawing" }).catch(() => {});
      hide.forEach((e, i) => (e.style.visibility = was[i])); flash("💾 Saved to Downloads/DevTab");
    }
  }
  function drawHand(mode, pinchStart, pinchEnd, tapped) {
    if (pinchStart) {
      const u = under(st.px, st.py);
      if (u.mine && u.mine.closest && u.mine.closest(".dtb button, .dock button")) { st.toolbarPress = u.mine.closest(".dtb button, .dock button"); return; }
      startStroke(st.px, st.py);
    }
    if (pinchEnd) { if (st.toolbarPress) { st.toolbarPress.click(); st.toolbarPress = null; } else endStroke(); }
    // a tap only works on DevTab's own buttons here, so drawing never clicks the page by accident
    if (tapped) { const u = under(tapped[0], tapped[1]); if (u.mine) click(tapped[0], tapped[1]); }
  }

  /* ---------- hands-free: face control ---------- */
  const fc = { cx: null, cy: null, winkT: 0, winkOn: false, rollT: 0, rollDir: 0, cool: 0, smileT: 0, smiled: false };
  function faceFrame(f, now, handBusy) {
    if (!cfg.faceCtl || !f || !f.ok || handBusy) { if (ui) ui.fcur.classList.add("off"); return; }
    // the cursor follows your nose, around a centre that slowly re-adjusts to how you sit
    if (fc.cx === null) { fc.cx = f.x; fc.cy = f.y; }
    fc.cx += (f.x - fc.cx) * 0.003; fc.cy += (f.y - fc.cy) * 0.003;
    const gain = (cfg.faceSpeed || 1) * 7;
    const x = ffx.f(clamp(0.5 + (f.x - fc.cx) * gain, 0, 1) * innerWidth, now), y = ffy.f(clamp(0.5 + (f.y - fc.cy) * gain * 1.3, 0, 1) * innerHeight, now);
    ui.fcur.classList.remove("off"); ui.fcur.style.transform = `translate(${x}px, ${y}px)`;
    lockOn(x, y, true);
    // wink (one eye) = click; ordinary blinks (both eyes) are ignored
    const hi = Math.max(f.blinkL, f.blinkR), lo = Math.min(f.blinkL, f.blinkR), wink = hi > 0.5 && lo < 0.22;
    if (wink && !fc.winkOn) { fc.winkOn = true; fc.winkT = now; }
    if (fc.winkOn) ui.wink.style.strokeDashoffset = String(220 * (1 - clamp((now - fc.winkT) / 250, 0, 1)));
    if (!wink && fc.winkOn) { fc.winkOn = false; ui.wink.style.strokeDashoffset = "220"; const dur = now - fc.winkT; if (dur > 90 && dur < 900 && now > fc.cool) { click(x, y); fc.cool = now + 500; } }
    // raised eyebrows scroll down, an open mouth scrolls up
    if (f.brow > 0.5) scrollAt(x, y, (f.brow - 0.45) * 60 * (cfg.airScroll || 1));
    else if (f.jaw > 0.42) scrollAt(x, y, -(f.jaw - 0.35) * 70 * (cfg.airScroll || 1));
    // tilt your head to switch tabs
    const dir = f.roll > 17 ? 1 : f.roll < -17 ? -1 : 0;
    if (dir && dir === fc.rollDir) { if (now - fc.rollT > 450 && now > fc.cool) { act(dir > 0 ? "next" : "prev"); fc.cool = now + 1500; fc.rollT = now + 99999; } }
    else { fc.rollDir = dir; fc.rollT = now; }
    // a big smile plays or pauses the video
    if (f.smile > 0.65) { if (!fc.smileT) fc.smileT = now; if (!fc.smiled && now - fc.smileT > 900) { fc.smiled = true; act("playpause"); } } else { fc.smileT = 0; fc.smiled = false; }
  }

  /* ---------- shield & away ---------- */
  function guard(s) {
    if (!s || !ui) return;
    const on = !!(s.shield || s.away);
    ui.guard.hidden = !on; ui.guard.classList.toggle("away", !s.shield && !!s.away);
    if (!on) return;
    const b = ui.guard.querySelector("b"), sp = ui.guard.querySelector(".guard__txt"), clk = ui.guard.querySelector(".guard__clock"), eye = ui.guard.querySelector(".guard__eye");
    if (s.shield) { eye.textContent = "👀"; b.textContent = "Someone's watching"; sp.textContent = "Shoulder-surfer shield is on. The screen clears when they leave."; clk.hidden = true; }
    else { eye.textContent = "🔒"; b.textContent = "You're away"; sp.textContent = "Tabs are blurred and muted. Look at the camera to unlock."; clk.hidden = false; clk.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  }

  /* ---------- skeleton in the panel ---------- */
  function drawPanel(lm) {
    if (!ui || ui.panel.hidden) return;
    const c = ui.cv, x = c.getContext("2d"), W = c.width, H = c.height, col = getComputedStyle(host).getPropertyValue("--c").trim() || "#29e7ff";
    x.clearRect(0, 0, W, H);
    x.fillStyle = "rgba(41,231,255,.08)"; x.fillRect(0, (performance.now() / 12) % H, W, 3);
    if (!lm) { x.fillStyle = "rgba(223,249,255,.5)"; x.font = "22px Consolas, monospace"; x.textAlign = "center"; x.fillText("searching for a hand…", W / 2, H / 2); return; }
    const P = (p) => [p[0] * W, p[1] * H];
    x.strokeStyle = col; x.lineWidth = 4; x.shadowColor = col; x.shadowBlur = 12; x.lineCap = "round";
    x.beginPath(); for (const [a, b] of CONN) { const [x1, y1] = P(lm[a]), [x2, y2] = P(lm[b]); x.moveTo(x1, y1); x.lineTo(x2, y2); } x.stroke();
    x.shadowBlur = 0;
    lm.forEach((p, i) => { const [px, py] = P(p); x.fillStyle = i === 8 ? "#ffd166" : i === 4 ? "#ff7eb6" : "#fff"; x.beginPath(); x.arc(px, py, i === 8 || i === 4 ? 7 : 4.5, 0, 6.283); x.fill(); });
  }

  /* ---------- incoming ---------- */
  chrome.runtime.onMessage.addListener((m) => {
    if (!m) return;
    if (m.type === "cam-state") { if (anyCam()) { ensure(); guard(m); } return; }
    if (m.type !== "air") return;
    if (EXT_PAGE && document.visibilityState !== "visible") return; // only the DevTab tab you're looking at
    if (m.status === "error") { ensure(); flash("📷 Camera unavailable: " + m.error); return; }
    if (m.status === "off") { teardown(); return; }
    if (m.status || !anyCam()) return;
    ensure();
    const now = performance.now();
    ui.fps.textContent = m.fps || 0;
    let handBusy = false;
    // while DevTab's Hub is open (say, teaching a gesture), hands only preview there; nothing fires
    const quiet = EXT_PAGE && !!document.querySelector("#hub[open]");
    if (cfg.air && !quiet) { drawPanel(m.lm); handBusy = handFrame(m, now); }
    else if (quiet && ui) { ui.cur.classList.add("off"); ui.lock.classList.remove("on"); handBusy = !!m.lm; }
    if (m.face) { ui.face.textContent = m.face.ok ? (m.face.n > 1 ? `👥 ${m.face.n}` : "🙂") : "👀 away"; faceFrame(m.face, now, handBusy || now - st.lastHand < 400); }
  });
  document.addEventListener("keydown", (e) => {
    if (!ui) return;
    if (e.key === "Escape" && ui.guide && !ui.guide.hidden) { showGuide(false); e.stopPropagation(); }
    else if (e.key === "Escape" && car.open) { closeCarousel(); e.stopPropagation(); }
    else if (e.key === "Escape" && draw.on) { toggleDraw(false); e.stopPropagation(); }
    else if (car.open && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { car.rot += (e.key === "ArrowLeft" ? 1 : -1) * car.step; spin(); e.preventDefault(); }
    else if (car.open && e.key === "Enter" && car.front) { pickTab(car.front.id); e.preventDefault(); }
  }, true);
  // a page shown again (back/forward cache, or switching to this tab) waits for a fresh pose
  const rearm = () => { st.armed = false; st.fired = null; st.shownAt = performance.now(); st.pinch = false; st.drag = false; st.tap = null; st.q = 0; endScroll(false); if (ui) chrome.runtime.sendMessage({ type: "cam-state?" }).then(guard).catch(() => {}); };
  addEventListener("pageshow", rearm);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") rearm(); });
  setInterval(() => { if (ui && performance.now() - st.lastHand > 1500 && !car.open) { ui.cur.classList.add("off"); ui.lock.classList.remove("on"); } }, 500);
  // pages opened while the guard is up start covered too
  chrome.runtime.sendMessage({ type: "cam-state?" }).then((s) => { if (s && (s.shield || s.away)) loadCfg().then(() => { if (anyCam()) { ensure(); guard(s); } }); }).catch(() => {});
})();
