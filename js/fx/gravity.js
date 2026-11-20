// Gravity mode (an easter egg): shake the mouse hard, or type "gravity", and the
// whole page falls down. Grab things and throw them; they bounce and tumble.
// Double-click (or Esc, or the Restore button) and everything flies back.
// Physics by matter.js (MIT), bundled locally in js/vendor.

let active = false, M = null, ctx = null;
const loadMatter = () => M ? Promise.resolve(M) : new Promise((res, rej) => {
  const s = document.createElement("script"); s.src = "js/vendor/matter.min.js";
  s.onload = () => res((M = window.Matter)); s.onerror = rej; document.head.appendChild(s);
});

// What falls: everything you can see on the page, each as its own body.
const PICK = ["#clock", ".brand", ".modes", "#weather", ".gbar__link", "#appsBtn", "#avatar", "#openSettings", "#hubBtn", "#focusChip", "#soundChip", "#greet", "#search", "#hints > *", "#links .link", "#dock .dk", "#todo", "#tt", "#pet"];

function visible(el) {
  if (el.closest("[hidden]")) return false;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden";
}

export async function startGravity() {
  if (active || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  active = true;
  try { await loadMatter(); } catch (e) { active = false; return; }
  const { Engine, Bodies, Composite, Body, Mouse, MouseConstraint, Events } = M;
  ctx.onStart && ctx.onStart();
  document.body.classList.add("is-grav");

  const layer = document.createElement("div"); layer.className = "grav";
  const hint = document.createElement("div"); hint.className = "grav__hint";
  hint.innerHTML = `<span>🪐 Gravity mode</span><small>Grab and throw anything · double-click to put it all back</small><button type="button">Restore</button>`;
  document.body.append(layer, hint);

  // Snapshot everything first, then lift it out of the page.
  const items = [];
  const seen = new Set();
  for (const sel of PICK) for (const el of document.querySelectorAll(sel)) {
    if (seen.has(el) || !visible(el)) continue;
    seen.add(el);
    items.push({ el, r: el.getBoundingClientRect() });
  }
  for (const it of items) {
    const { el, r } = it;
    let node;
    if (el.id === "clock") { node = el; it.style = el.getAttribute("style") || ""; }   // the live clock flies itself, particles and all
    else {
      // a copy keeps the original layout intact; parent classes keep parent-scoped styles working
      node = document.createElement("div"); node.className = el.parentElement.className; node.style.display = "contents";
      const c = el.cloneNode(true); c.removeAttribute("id"); c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
      c.querySelectorAll("canvas").forEach((cv, i) => { const src = el.querySelectorAll("canvas")[i]; cv.getContext("2d").drawImage(src, 0, 0); });
      node.append(c); it.copy = c; el.style.visibility = "hidden";
    }
    const target = it.copy || node;
    Object.assign(target.style, { position: "fixed", left: "0px", top: "0px", width: r.width + "px", height: r.height + "px", margin: "0", right: "auto", bottom: "auto",
      transform: `translate(${r.left}px, ${r.top}px)`, transition: "none", zIndex: "41", pointerEvents: "none", willChange: "transform", maxHeight: "none", maxWidth: "none", translate: "none" });
    it.node = target;
    if (node !== el) layer.append(node);
  }

  const engine = Engine.create(); engine.gravity.y = 1.15;
  const W = innerWidth, H = innerHeight, T = 400;
  Composite.add(engine.world, [
    Bodies.rectangle(W / 2, H + T / 2, W * 3, T, { isStatic: true }),
    Bodies.rectangle(-T / 2, H / 2, T, H * 3, { isStatic: true }),
    Bodies.rectangle(W + T / 2, H / 2, T, H * 3, { isStatic: true }),
    Bodies.rectangle(W / 2, -T / 2 - H, W * 3, T, { isStatic: true }),
  ]);
  for (const it of items) {
    const { r } = it;
    it.body = Bodies.rectangle(r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, {
      restitution: 0.42, friction: 0.25, frictionAir: 0.008, density: 0.0012, chamfer: { radius: Math.min(10, r.height / 2 - 1, r.width / 2 - 1) },
    });
    Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 3, y: -Math.random() * 3 });
    Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.06);
    Composite.add(engine.world, it.body);
  }
  const mouse = Mouse.create(layer);
  const mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.18, damping: 0.08, render: { visible: false } } });
  Composite.add(engine.world, mc);
  Events.on(mc, "startdrag", () => layer.classList.add("is-grab"));
  Events.on(mc, "enddrag", () => layer.classList.remove("is-grab"));

  let raf = 0, last = performance.now();
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    Engine.update(engine, Math.min(1000 / 30, now - last)); last = now;
    for (const it of items) {
      const b = it.body, r = it.r;
      it.node.style.transform = `translate(${b.position.x - r.width / 2}px, ${b.position.y - r.height / 2}px) rotate(${b.angle}rad)`;
    }
  };
  raf = requestAnimationFrame(loop);

  let done = false;
  const restore = () => {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    hint.classList.add("is-out");
    for (const it of items) {
      it.node.style.transition = "transform .9s cubic-bezier(.2, 1.25, .35, 1)";
      it.node.style.transform = `translate(${it.r.left}px, ${it.r.top}px) rotate(0rad)`;
    }
    setTimeout(() => {
      for (const it of items) {
        if (it.copy) it.el.style.visibility = "";
        else it.el.setAttribute("style", it.style);
      }
      layer.remove(); hint.remove();
      document.removeEventListener("keydown", onKey); removeEventListener("resize", restore);
      document.body.classList.remove("is-grav");
      active = false; ctx.onEnd && ctx.onEnd();
    }, 950);
  };
  const onKey = (e) => { if (e.key === "Escape") restore(); };
  layer.addEventListener("dblclick", restore);
  hint.querySelector("button").addEventListener("click", restore);
  document.addEventListener("keydown", onKey);
  addEventListener("resize", restore);
}

// Shake detection: several fast left-right reversals within a second.
export function initGravity(c) {
  ctx = c;
  let lastX = null, lastDir = 0, flips = [], lastT = 0;
  addEventListener("pointermove", (e) => {
    if (!ctx.enabled() || active || e.buttons || e.pointerType === "touch") return;
    const now = performance.now(), dx = e.clientX - (lastX ?? e.clientX), dt = Math.max(1, now - lastT);
    lastX = e.clientX; lastT = now;
    if (Math.abs(dx) / dt < 1.6) return; // only fast moves count
    const dir = Math.sign(dx);
    if (dir && dir !== lastDir) { flips.push(now); lastDir = dir; }
    flips = flips.filter((t) => now - t < 1000);
    if (flips.length >= 7) { flips = []; startGravity(); }
  }, { passive: true });
  // typing g-r-a-v-i-t-y anywhere (outside a text box) works too
  let buf = "";
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
    buf = (buf + e.key.toLowerCase()).slice(-7);
    if (buf === "gravity" && ctx.enabled()) { buf = ""; startGravity(); }
  });
}
export const gravityActive = () => active;
