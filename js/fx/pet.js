// A pet that lives in your new tab: a pixel robot ("Bit") or a pixel cat.
// It walks along the bottom of the screen, naps on the clock, watches your
// cursor, cheers when you complete a task and sulks when you snooze. Leave it
// for days and it gets dusty; click it to clean it up. Drag it and let go.
import { get, set, watch } from "../kv.js";
import { addPane } from "../hub.js";

const PET = "devtab:pet";
const SIZE = 24, SCALE = 3;
const $ = (s, el = document) => el.querySelector(s);
const rgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

let C = null, P = null, el = null, cv = null, ctx = null, say = null, data = null;
let stats = { done: 0, snoozed: 0 };

const paintPet = (...a) => globalThis.DevtabPet.paintPet(...a);
export { paintPet };

/* ---------- mood ---------- */
function happiness() {
  const today = data.petDay === new Date().toDateString() ? data.petsToday || 0 : 0;
  return Math.max(0, Math.min(1, 0.55 + 0.1 * stats.done - 0.08 * stats.snoozed + 0.04 * today - 0.5 * data.dust));
}
const moodName = (h) => (h > 0.72 ? "happy" : h < 0.35 ? "sad" : "okay");
async function loadStats() {
  const h = await get("devtab:history", []), t0 = dayStart();
  stats = { done: h.filter((x) => x.action === "completed" && x.time >= t0).length, snoozed: h.filter((x) => x.action === "snoozed" && x.time >= t0).length };
}

/* ---------- life ---------- */
function speak(text, ms = 3600) {
  if (!say) return;
  say.textContent = text; say.classList.add("is-on");
  clearTimeout(say._t); say._t = setTimeout(() => say.classList.remove("is-on"), ms);
}
function puff(char, n = 1, cls = "") {
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span"); s.className = "pet__fx " + cls; s.textContent = char;
    s.style.left = 20 + Math.random() * 40 + "px"; s.style.animationDelay = i * 90 + "ms";
    el.append(s); setTimeout(() => s.remove(), 1600 + i * 90);
  }
}

const B = { x: 200, y: 0, vx: 0, vy: 0, dir: 1, state: "idle", until: 0, target: 0, frame: 0, eye: "open", blink: false, drag: null, perch: null, look: 0, react: 0 };
const floorY = () => innerHeight - SIZE * SCALE - 4;
const clockTop = () => { const c = $("#clock span"); if (!c || C.gravityActive()) return null; const r = c.getBoundingClientRect(); return r.width ? { x: r.left + r.width * (0.2 + Math.random() * 0.6), y: r.top - SIZE * SCALE + 14 } : null; };

function think(now) {
  const night = (() => { const h = new Date().getHours(); return h >= 23 || h < 6; })();
  const focusing = C.focusing();
  const r = Math.random();
  if (focusing && r < 0.6) return go("sleep", now + 20000, "Shh… focusing");
  if (night && r < 0.5) return go("sleep", now + 25000);
  if (r < 0.5) { B.target = 30 + Math.random() * (innerWidth - 120); return go("walk", now + 15000); }
  if (r < 0.65) { const top = clockTop(); if (top) return jumpTo(top.x, top.y, "perch"); }
  return go("idle", now + 2000 + Math.random() * 4000);
}
function go(state, until, line) { B.state = state; B.until = until; if (line) speak(line); }
function jumpTo(x, y, after) { B.perch = after === "perch" ? { x, y } : null; B.jump = { x0: B.x, y0: B.y, x1: x, y1: y, t: 0, after }; B.state = "jump"; B.dir = x > B.x ? 1 : -1; }

function step(now) {
  if (!el || el.hidden) return;
  const fy = floorY();
  const h = happiness(), mood = moodName(h);
  B.frame++;
  if (B.frame % 120 === 0 || B.frame % 127 === 0) B.blink = true; else if (B.frame % 6 === 0) B.blink = false;

  if (B.drag) { /* following the pointer */ }
  else if (B.state === "fall") {
    B.vy += 0.9; B.y += B.vy; B.x += B.vx; B.vx *= 0.98;
    if (B.y >= fy) { B.y = fy; if (Math.abs(B.vy) > 6) { B.vy *= -0.35; } else { B.vy = 0; go("idle", now + 1500, Math.random() < 0.5 ? "Whee!" : "Again!"); } }
  } else if (B.state === "jump") {
    const j = B.jump; j.t = Math.min(1, j.t + 0.03);
    B.x = j.x0 + (j.x1 - j.x0) * j.t; B.y = j.y0 + (j.y1 - j.y0) * j.t - Math.sin(Math.PI * j.t) * 120;
    if (j.t >= 1) { if (j.after === "perch") go("sleep", now + 12000 + Math.random() * 14000); else go("idle", now + 1500); }
  } else if (B.state === "walk") {
    const sp = mood === "happy" ? 1.7 : mood === "sad" ? 0.8 : 1.2, d = B.target - B.x;
    B.dir = Math.sign(d) || B.dir; B.x += Math.sign(d) * Math.min(Math.abs(d), sp); B.y = fy;
    if (Math.abs(d) < 2 || now > B.until) go("idle", now + 2000 + Math.random() * 3000);
  } else if (B.state === "sleep" || B.state === "idle" || B.state === "react") {
    if (!B.perch && B.state !== "react") B.y = fy;
    if (B.perch) { const top = clockTop(); if (!top) { B.perch = null; B.state = "fall"; B.vy = 0; } }
    if (B.state === "sleep" && B.frame % 70 === 0) puff("z", 1, "is-z");
    if (now > B.until) {
      if (B.perch) { B.perch = null; jumpTo(30 + Math.random() * (innerWidth - 120), fy, "floor"); }
      else think(now);
    }
  }
  // eyes follow a nearby cursor
  const dx = (C.mouse.x ?? -999) - (B.x + 36), dy = (C.mouse.y ?? -999) - (B.y + 36);
  B.look = Math.hypot(dx, dy) < 260 && B.state !== "sleep" ? Math.max(-1, Math.min(1, Math.round(dx / 80))) : 0;

  const pose = B.state === "sleep" ? "sleep" : B.state === "react" && mood !== "sad" ? "happy" : B.state === "jump" || B.state === "fall" ? "hop" : B.state === "walk" ? (Math.floor(B.frame / 8) % 2 ? "walk1" : "walk2") : "idle";
  const eye = B.state === "sleep" ? "sleep" : B.state === "react" ? (B.react < 0 ? "sad" : "happy") : B.blink ? "blink" : mood === "happy" && B.frame % 300 < 60 ? "happy" : mood === "sad" ? "sad" : "open";
  if (B.state === "react" && now > B.until) go("idle", now + 1500);
  paintPet(cv, { pose, eye, blink: B.blink, look: B.look * B.dir, flip: B.dir < 0 }, C.S().fx.petKind, document.body.dataset.mode === "hacker", C.S()[C.S().mode].accent, data.dust);
  el.style.transform = `translate(${Math.round(B.x)}px, ${Math.round(B.y)}px)`;
  el.dataset.mood = mood;
}

async function save() { await set(PET, data); }
function react(kind) {
  B.state = "react"; B.until = performance.now() + 2200; B.react = kind === "sad" ? -1 : 1;
  if (kind === "party") { puff("✦", 6, "is-star"); speak(["Nice one! ✓", "Task crushed!", "Look at you go!", "+1 productivity"][Math.floor(Math.random() * 4)]); }
  else if (kind === "sad") speak(["Again? 😢", "Snooze… really?", "We'll get it next time."][Math.floor(Math.random() * 3)]);
}

function tooltip() {
  const h = happiness(), hearts = Math.round(h * 5);
  el.title = `${C.S().fx.petName || "Bit"} is ${moodName(h)} · ${"♥".repeat(hearts)}${"♡".repeat(5 - hearts)} · ${stats.done} task${stats.done === 1 ? "" : "s"} done today${data.dust > 0.1 ? " · dusty, click to clean" : ""}`;
}

export function drawPet() {
  if (!el) return;
  el.hidden = !C.S().fx.pet || matchMedia("(prefers-reduced-motion: reduce)").matches;
  tooltip();
}

export async function initPet(ctx) {
  C = ctx;
  data = await get(PET, null);
  const now = Date.now();
  if (!data) data = { born: now, lastSeen: now, dust: 0, pets: 0 };
  const away = (now - (data.lastSeen || now)) / 86400000;
  if (away > 0.5) data.dust = Math.min(1, (data.dust || 0) + (away - 0.5) * 0.3); // neglect gathers dust
  data.lastSeen = now; await save();
  await loadStats();

  el = document.createElement("div"); el.className = "pet"; el.id = "pet"; el.setAttribute("role", "button"); el.setAttribute("aria-label", "Your pet. Click to pet it.");
  el.innerHTML = `<canvas width="${SIZE}" height="${SIZE}"></canvas><span class="pet__say"></span>`;
  document.body.append(el);
  cv = $("canvas", el); say = $(".pet__say", el);
  B.x = 40 + Math.random() * (innerWidth * 0.5); B.y = floorY();
  drawPet();

  // greeting
  const name = C.S().fx.petName || "Bit";
  setTimeout(() => {
    if (data.dust > 0.5) speak("*cough* it's dusty in here… click me to clean!", 5000);
    else if (Math.random() < 0.35) { const h = new Date().getHours(); speak(h < 12 ? "Morning! ☕" : h < 18 ? "Hey! What are we building?" : h < 23 ? "Evening session? 🌙" : "Coding this late? 🦉"); }
  }, 1200);

  // click: pet (or clean); drag: pick it up and throw
  let down = null;
  el.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), ox: e.clientX - B.x, oy: e.clientY - B.y, lx: e.clientX, ly: e.clientY }; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", (e) => {
    if (!down) return;
    if (!B.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { B.drag = true; B.perch = null; el.classList.add("is-held"); speak("Whoa!", 1200); }
    if (B.drag) { B.vx = e.clientX - down.lx; B.vy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY; B.x = e.clientX - down.ox; B.y = e.clientY - down.oy; }
  });
  el.addEventListener("pointerup", async () => {
    if (!down) return;
    if (B.drag) { B.drag = null; el.classList.remove("is-held"); B.state = "fall"; }
    else {
      const today = new Date().toDateString();
      if (data.petDay !== today) { data.petDay = today; data.petsToday = 0; }
      data.pets = (data.pets || 0) + 1; data.petsToday++;
      if (data.dust > 0.05) { data.dust = Math.max(0, data.dust - 0.34); puff("·", 8, "is-dust"); speak(data.dust > 0.05 ? "Keep going… *sneeze*" : "Sparkly clean! ✨"); }
      else { puff("♥", 3, "is-heart"); B.state = "react"; B.until = performance.now() + 1600; B.react = 1; if (Math.random() < 0.4) speak(["Hehe", "♥", `${name} likes that`, "Purr… I mean, beep."][Math.floor(Math.random() * 4)], 1800); }
      await save(); tooltip();
    }
    down = null;
  });

  // react to your tasks
  watch("devtab:history", async (h) => {
    if (!h || !h.length) return;
    const last = h[0]; await loadStats(); tooltip();
    if (Date.now() - last.time > 8000) return;
    if (last.action === "completed") react("party");
    else if (last.action === "snoozed") react("sad");
  });

  let raf = 0;
  const loop = (t) => { raf = requestAnimationFrame(loop); if (!document.hidden) step(t); };
  raf = requestAnimationFrame(loop);
  addEventListener("resize", () => { B.x = Math.min(B.x, innerWidth - 80); });

  addPane({ id: "pet", label: "Pet", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="6" width="14" height="10" rx="2"/><path d="M12 3v3M9 11h.01M15 11h.01M8 20h8M10 16v4M14 16v4"/></svg>', title: () => `${C.S().fx.petName || "Bit"}, your tab pet`, sub: "Keep it happy: finish tasks, don't over-snooze", render: renderPane });
}

/* ---------- Hub pane ---------- */
function renderPane(pane) {
  const S = C.S();
  const h = happiness(), hearts = Math.round(h * 5);
  const days = Math.max(1, Math.round((Date.now() - data.born) / 86400000));
  pane.innerHTML = `
    <div class="petp">
      <div class="petp__stage"><canvas width="${SIZE}" height="${SIZE}" data-big></canvas><div class="petp__floor"></div></div>
      <div class="petp__info">
        <div class="petp__mood"><span class="petp__hearts">${"♥".repeat(hearts)}<i>${"♥".repeat(5 - hearts)}</i></span><b>${C.esc(S.fx.petName || "Bit")} is ${moodName(h)}</b></div>
        <div class="petp__stats">
          <div><b>${stats.done}</b><span>tasks done today</span></div>
          <div><b>${stats.snoozed}</b><span>snoozes today</span></div>
          <div><b>${data.pets || 0}</b><span>times petted</span></div>
          <div><b>${days}</b><span>day${days === 1 ? "" : "s"} together</span></div>
        </div>
        <label class="row">Name <input type="text" maxlength="14" data-pname value="${C.esc(S.fx.petName || "Bit")}"></label>
        <div class="seg"><button type="button" data-kind="robot" aria-pressed="${S.fx.petKind !== "cat"}">🤖 Robot</button><button type="button" data-kind="cat" aria-pressed="${S.fx.petKind === "cat"}">🐱 Cat</button></div>
        <label class="row">Show on my new tab <input type="checkbox" data-pshow ${S.fx.pet ? "checked" : ""}></label>
        <label class="row">🌐 Take ${C.esc(S.fx.petName || "Bit")} to every website <input type="checkbox" data-pevery ${S.fx.petEverywhere ? "checked" : ""}></label>
        ${(S.fx.petHidden || []).length ? `<p class="note">Hidden on: ${S.fx.petHidden.map((h) => `<button type="button" class="ws__a" data-unhide="${C.esc(h)}">${C.esc(h)} ✕</button>`).join(" ")}</p>` : ""}
        <p class="note">${data.dust > 0.1 ? "It's dusty. Click it a few times to clean it up. " : ""}Completing tasks makes it happy; snoozing makes it sad. It naps on the clock, sleeps at night, and you can drag it around and let go.</p>
      </div>
    </div>`;
  const big = $("[data-big]", pane);
  let f = 0, raf = 0;
  const anim = () => { raf = requestAnimationFrame(anim); f++; const blink = f % 140 < 6; paintPet(big, { pose: Math.floor(f / 20) % 2 ? "walk1" : "walk2", eye: blink ? "blink" : moodName(happiness()) === "happy" ? (f % 240 < 80 ? "happy" : "open") : moodName(happiness()) === "sad" ? "sad" : "open", blink }, C.S().fx.petKind, document.body.dataset.mode === "hacker", C.S()[C.S().mode].accent, data.dust); };
  anim();
  pane.addEventListener("click", async (e) => { const k = e.target.closest("[data-kind]"); if (k) { C.S().fx.petKind = k.dataset.kind; pane.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b === k))); await C.persist(); } });
  pane.addEventListener("change", async (e) => {
    if (e.target.matches("[data-pshow]")) { C.S().fx.pet = e.target.checked; await C.persist(); drawPet(); }
    if (e.target.matches("[data-pevery]")) {
      const on = e.target.checked && (await C.allowEverywhere());
      e.target.checked = on; C.S().fx.petEverywhere = on; await C.persist();
      C.toast(on ? `${C.S().fx.petName || "Bit"} will visit the websites you open. Hover it and press × to hide it on a site.` : "The pet stays home now.");
    }
  });
  pane.addEventListener("click", async (e) => { const u = e.target.closest("[data-unhide]"); if (u) { C.S().fx.petHidden = (C.S().fx.petHidden || []).filter((h) => h !== u.dataset.unhide); await C.persist(); u.remove(); } });
  pane.addEventListener("input", (e) => { if (e.target.matches("[data-pname]")) { C.S().fx.petName = e.target.value.trim() || "Bit"; C.persist(); tooltip(); $("#hubTitle").textContent = `${C.S().fx.petName}, your tab pet`; } });
  return () => cancelAnimationFrame(raf);
}
