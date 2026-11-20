// Your DevTab pet, out on the web. It treats the page as a level: headings,
// images, buttons and search boxes are platforms. It walks along them, jumps
// between them, follows them as you scroll, naps on search bars, sits on
// pictures and runs away from your cursor. Click it for a cuddle; drag it and
// let go to throw it; the little × hides it on this site.
(async () => {
  if (window.__devtabPetOut || window.top !== window) return;
  window.__devtabPetOut = true;
  const get = async (k) => (await chrome.storage.local.get(k))[k];
  let S = (await get("devtab:settings")) || {};
  const fx = () => S.fx || {};
  const host = location.hostname.replace(/^www\./, "");
  if (!fx().petEverywhere || (fx().petHidden || []).includes(host) || matchMedia("(prefers-reduced-motion: reduce)").matches) { window.__devtabPetOut = false; return; }
  const P = globalThis.DevtabPet; if (!P) return;
  const W = 72, H = 72, SC = W / P.SIZE;

  // UI in a shadow root so the site's CSS can't reach it
  const hostEl = document.createElement("devtab-pet");
  hostEl.style.cssText = "all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;";
  document.documentElement.append(hostEl);
  const root = hostEl.attachShadow({ mode: "open" });
  const accent = (S[S.mode] && S[S.mode].accent) || "#7c9cff", hacker = S.mode === "hacker";
  root.innerHTML = `<style>
    .p { position: fixed; left: 0; top: 0; width: ${W}px; height: ${H}px; cursor: grab; touch-action: none; user-select: none; filter: drop-shadow(0 6px 6px rgba(0,0,0,.4)); will-change: transform; }
    .p.held { cursor: grabbing; }
    canvas { width: ${W}px; height: ${H}px; image-rendering: pixelated; display: block; }
    .say { position: absolute; bottom: 100%; left: 50%; transform: translate(-50%, 4px) scale(.9); opacity: 0; padding: 6px 11px; border-radius: 13px 13px 13px 4px; background: ${hacker ? "#000" : "#fff"}; color: ${hacker ? accent : "#14161f"}; ${hacker ? `border:1px solid ${accent};` : ""} font: 600 12px "Segoe UI", system-ui, sans-serif; white-space: nowrap; box-shadow: 0 8px 18px rgba(0,0,0,.3); transition: .2s; pointer-events: none; }
    .say.on { opacity: 1; transform: translate(-50%, -6px) scale(1); }
    .x { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; border: 0; background: rgba(0,0,0,.7); color: #fff; font: 700 12px sans-serif; line-height: 18px; text-align: center; cursor: pointer; opacity: 0; transition: opacity .15s; padding: 0; }
    .p:hover .x { opacity: 1; }
    .fx { position: absolute; top: 2px; font: 18px sans-serif; color: #ff5c8a; pointer-events: none; animation: up 1.5s ease-out forwards; }
    .fx.z { color: #9fb0ff; font: 700 14px Consolas, monospace; }
    @keyframes up { from { transform: translateY(0) scale(.6); opacity: 0; } 15% { opacity: 1; } to { transform: translateY(-56px) scale(1.2); opacity: 0; } }
  </style><div class="p"><canvas width="${P.SIZE}" height="${P.SIZE}"></canvas><span class="say"></span><button class="x" title="Hide the pet on this site">×</button></div>`;
  const el = root.querySelector(".p"), cv = el.querySelector("canvas"), say = el.querySelector(".say");
  const name = fx().petName || "Bit", kind = fx().petKind || "robot";

  const speak = (t, ms = 3000) => { say.textContent = t; say.classList.add("on"); clearTimeout(say._t); say._t = setTimeout(() => say.classList.remove("on"), ms); };
  const puff = (ch, n = 1, cls = "") => { for (let i = 0; i < n; i++) { const s = document.createElement("span"); s.className = "fx " + cls; s.textContent = ch; s.style.left = 16 + Math.random() * 36 + "px"; s.style.animationDelay = i * 90 + "ms"; el.append(s); setTimeout(() => s.remove(), 1700); } };

  /* ---------- the level: things it can stand on ---------- */
  let plats = [];
  const visible = (r) => r.width >= 70 && r.height >= 14 && r.top > 40 && r.top < innerHeight - 30 && r.left > -10 && r.right < innerWidth + 10;
  function scan() {
    const out = [];
    for (const e of document.querySelectorAll('h1, h2, h3, img, video, button, input[type="search"], input[name="q"], [role="search"], textarea, figure, .card, article > header')) {
      if (e.closest("devtab-pet, devtab-tool")) continue;
      const r = e.getBoundingClientRect(); if (!visible(r)) continue;
      const cs = getComputedStyle(e); if (cs.visibility === "hidden" || +cs.opacity < 0.1) continue;
      out.push({ e, kind: e.matches('input[type="search"], input[name="q"], [role="search"], textarea') ? "search" : e.matches("img, video, figure") ? "img" : "text" });
      if (out.length > 60) break;
    }
    plats = out;
  }
  scan(); setInterval(scan, 1500);
  addEventListener("scroll", () => { clearTimeout(scan._t); scan._t = setTimeout(scan, 120); }, { passive: true });

  /* ---------- body ---------- */
  const B = { x: innerWidth * 0.75, y: innerHeight - H, vx: 0, vy: 0, dir: -1, on: null, off: 0, st: "fall", until: 0, frame: 0, jump: null, drag: null, blink: false };
  const floorY = () => innerHeight - H - 2;
  const top = (p) => { const r = p.e.getBoundingClientRect(); return { r, y: r.top - H + 8 }; };
  const land = (p) => { const { r } = top(p); B.on = p; B.off = Math.max(0, Math.min(r.width - W, B.x - r.left)); B.vy = 0; };
  function jumpTo(p) {
    const { r, y } = top(p), x = r.left + Math.max(0, Math.min(r.width - W, (r.width - W) * Math.random()));
    B.jump = { x0: B.x, y0: B.y, x1: x, y1: y, t: 0, p }; B.st = "jump"; B.on = null; B.dir = x > B.x ? 1 : -1;
  }
  function choose(now) {
    const r = Math.random();
    const search = plats.find((p) => p.kind === "search");
    if (search && r < 0.15 && B.on !== search) { jumpTo(search); B.after = "sleep"; return; }
    if (plats.length && r < 0.55) { const near = plats.filter((p) => p !== B.on).sort((a, b) => Math.abs(top(a).r.left - B.x) + Math.abs(top(a).y - B.y) - (Math.abs(top(b).r.left - B.x) + Math.abs(top(b).y - B.y)))[Math.floor(Math.random() * 3)]; if (near) { jumpTo(near); B.after = near.kind === "img" ? "sit" : "idle"; return; } }
    if (r < 0.8) { B.st = "walk"; B.walkTo = Math.random(); B.until = now + 5000; return; }
    B.st = "idle"; B.until = now + 1500 + Math.random() * 3000;
  }

  const mouse = { x: -999, y: -999, t: 0 };
  addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now(); }, { passive: true });

  function step(now) {
    B.frame++;
    B.blink = B.frame % 150 < 5;
    if (B.drag) { /* follows the pointer */ }
    else if (B.st === "jump") {
      const j = B.jump; j.t = Math.min(1, j.t + 0.032);
      const { y } = top(j.p); j.y1 = y;
      B.x = j.x0 + (j.x1 - j.x0) * j.t; B.y = j.y0 + (j.y1 - j.y0) * j.t - Math.sin(Math.PI * j.t) * 110;
      if (j.t >= 1) { land(j.p); B.st = B.after || "idle"; B.after = null; B.until = now + (B.st === "sleep" ? 14000 : B.st === "sit" ? 6000 : 2000); if (B.st === "sleep") speak(Math.random() < 0.5 ? "Comfy search bar…" : "zZz"); }
    } else if (B.st === "fall") {
      B.vy = Math.min(B.vy + 0.9, 24); B.y += B.vy; B.x += B.vx; B.vx *= 0.97;
      B.x = Math.max(0, Math.min(innerWidth - W, B.x));
      // land on the first platform under its feet
      for (const p of plats) { const { r, y } = top(p); if (B.x + W * 0.5 > r.left && B.x + W * 0.5 < r.right && B.y >= y - 2 && B.y - B.vy <= y + 2) { B.y = y; land(p); B.st = "idle"; B.until = now + 1200; break; } }
      if (B.y >= floorY()) { B.y = floorY(); B.vy = 0; B.on = null; B.st = "idle"; B.until = now + 1200; }
    } else {
      // standing (on a platform or the floor)
      if (B.on) {
        const { r, y } = top(B.on);
        if (!B.on.e.isConnected || r.top < -40 || r.top > innerHeight + 20) { B.on = null; B.st = "fall"; B.vy = 0; }
        else {
          if (B.st === "walk") { const target = (r.width - W) * B.walkTo, d = target - B.off; B.dir = Math.sign(d) || B.dir; B.off += Math.sign(d) * Math.min(Math.abs(d), 1.3); if (Math.abs(d) < 2 || now > B.until) { B.st = "idle"; B.until = now + 1500; } }
          B.off = Math.max(0, Math.min(Math.max(0, r.width - W), B.off));
          B.x = r.left + B.off; B.y = y;
        }
      } else {
        B.y = floorY();
        if (B.st === "walk") { const target = (innerWidth - W) * B.walkTo, d = target - B.x; B.dir = Math.sign(d) || B.dir; B.x += Math.sign(d) * Math.min(Math.abs(d), 1.5); if (Math.abs(d) < 2 || now > B.until) { B.st = "idle"; B.until = now + 1500; } }
      }
      if (B.st === "sleep" && B.frame % 70 === 0) puff("z", 1, "z");
      // run from a cursor that comes close
      const dx = B.x + W / 2 - mouse.x, dy = B.y + H / 2 - mouse.y;
      if (B.st !== "flee" && Math.hypot(dx, dy) < 110 && now - mouse.t < 400) {
        B.st = "flee"; B.until = now + 900; B.dir = dx > 0 ? 1 : -1; if (Math.random() < 0.3) speak(["Eek!", "Can't catch me!", "Hey!"][Math.floor(Math.random() * 3)], 1200);
      }
      if (B.st === "flee") {
        if (B.on) { B.off += B.dir * 4; const { r } = top(B.on); if (B.off < 0 || B.off > r.width - W) { B.on = null; B.st = "fall"; B.vx = B.dir * 6; B.vy = -9; } }
        else B.x = Math.max(0, Math.min(innerWidth - W, B.x + B.dir * 4.5));
        if (now > B.until && B.st === "flee") { B.st = "idle"; B.until = now + 800; }
      }
      if ((B.st === "idle" || B.st === "sit" || B.st === "sleep") && now > B.until) choose(now);
    }
    const pose = B.st === "sleep" || B.st === "sit" ? "sleep" : B.st === "jump" || B.st === "fall" ? "hop" : B.st === "walk" || B.st === "flee" ? (Math.floor(B.frame / (B.st === "flee" ? 4 : 8)) % 2 ? "walk1" : "walk2") : "idle";
    const eye = B.st === "sleep" ? "sleep" : B.st === "flee" ? "happy" : B.blink ? "blink" : "open";
    P.paintPet(cv, { pose: B.st === "sit" ? "idle" : pose, eye, blink: B.blink, look: 0, flip: B.dir < 0 }, kind, hacker, accent, 0);
    el.style.transform = `translate(${Math.round(B.x)}px, ${Math.round(B.y)}px)`;
  }
  const loop = (t) => { requestAnimationFrame(loop); if (!document.hidden) step(t); };
  requestAnimationFrame(loop);

  /* ---------- touch it ---------- */
  let down = null;
  el.addEventListener("pointerdown", (e) => { if (e.target.closest(".x")) return; down = { x: e.clientX, y: e.clientY, ox: e.clientX - B.x, oy: e.clientY - B.y, lx: e.clientX, ly: e.clientY }; el.setPointerCapture(e.pointerId); e.preventDefault(); });
  el.addEventListener("pointermove", (e) => {
    if (!down) return;
    if (!B.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { B.drag = true; B.on = null; el.classList.add("held"); speak("Whoa!", 1000); }
    if (B.drag) { B.vx = e.clientX - down.lx; B.vy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY; B.x = e.clientX - down.ox; B.y = e.clientY - down.oy; }
  });
  el.addEventListener("pointerup", () => {
    if (!down) return;
    if (B.drag) { B.drag = null; el.classList.remove("held"); B.st = "fall"; B.vx = Math.max(-25, Math.min(25, B.vx)); B.vy = Math.max(-25, Math.min(25, B.vy)); }
    else { puff("♥", 3); speak([`${name} ♥ ${host}`, "Hehe", "Nice site!", "Pet me more"][Math.floor(Math.random() * 4)], 1600); B.st = "idle"; B.until = performance.now() + 1500; }
    down = null;
  });
  root.querySelector(".x").addEventListener("click", async () => {
    const s = (await get("devtab:settings")) || {}; s.fx = s.fx || {}; s.fx.petHidden = [...new Set([...(s.fx.petHidden || []), host])];
    await chrome.storage.local.set({ "devtab:settings": s });
    speak("Bye! See you on other sites.", 1500); setTimeout(() => hostEl.remove(), 1200);
  });
  chrome.storage.onChanged.addListener((ch) => { if (ch["devtab:settings"]) { S = ch["devtab:settings"].newValue || {}; if (!fx().petEverywhere) hostEl.remove(); } });
  setTimeout(() => speak(Math.random() < 0.5 ? `Ooh, ${host}!` : "New level unlocked", 2200), 900);
})();
