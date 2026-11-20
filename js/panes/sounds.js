// Hub pane: ambient sounds. Mix rain, café, keyboard, server hum, waves and a
// fireplace. In the extension the sound plays from the background audio page,
// so it keeps going on every tab; on the web demo it plays in this page.
import { addPane, openHub } from "../hub.js";
import { SOUNDS, Ambient } from "../ambient-engine.js";
import { get, set, watch, ext } from "../kv.js";

const AMBIENT = "devtab:ambient";
const $ = (s, el = document) => el.querySelector(s);
const sv = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICONS = {
  rain: sv('<path d="M20 15.5A4.5 4.5 0 0 0 17.5 7 6 6 0 0 0 6 8.5 4 4 0 0 0 6.5 16.5"/><path d="M8 19l-1 2M12 18l-1 3M16 19l-1 2"/>'),
  cafe: sv('<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M7 2v2M11 2v2M15 2v2"/>'),
  keys: sv('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
  server: sv('<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"/>'),
  waves: sv('<path d="M2 7c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 13c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 19c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>'),
  fire: sv('<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7Z"/><path d="M12 22c-2 0-3-1.5-3-3.5S12 14 12 14s3 2.5 3 4.5-1 3.5-3 3.5Z"/>'),
};
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5v15l12-7.5Z" fill="currentColor"/></svg>', PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4h4v16h-4zM13.5 4h4v16h-4z" fill="currentColor"/></svg>';
const MIXES = { "Deep work": { rain: 0.55, keys: 0.35 }, "Coffee shop": { cafe: 0.75, rain: 0.2 }, "Night shift": { server: 0.55, rain: 0.3 }, Campfire: { fire: 0.7, waves: 0.3 }, Beach: { waves: 0.8 } };
const NOTE_ICON = sv('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>');

let C = null, A = { on: false, levels: {} }, engine = null;
const playing = () => A.on && Object.values(A.levels).some((v) => v > 0);
const save = async () => { await set(AMBIENT, A); drawChip(); };

function render(el) {
  el.innerHTML = `
    <div class="snd">
      <div class="snd__top">
        <button type="button" class="snd__play" data-master aria-label="Play or pause"></button>
        <div class="snd__now"><b data-now></b><span data-nowsub></span></div>
        <div class="snd__sleep"><span>Stop after</span>${[0, 15, 30, 60].map((m) => `<button type="button" data-sleep="${m}">${m ? m + "m" : "Off"}</button>`).join("")}</div>
      </div>
      <div class="snd__mixes">${Object.keys(MIXES).map((k) => `<button type="button" data-mix="${k}">${k}</button>`).join("")}</div>
      <div class="snd__grid">${SOUNDS.map((s) => `
        <div class="snd__card" data-snd="${s.id}">
          <button type="button" class="snd__tap" data-tap="${s.id}" aria-label="Toggle ${s.name}"><span class="snd__ic">${ICONS[s.id]}</span><span class="snd__eq"><i></i><i></i><i></i><i></i></span></button>
          <b>${s.name}</b><small>${s.note}</small>
          <input type="range" min="0" max="100" data-vol="${s.id}" aria-label="${s.name} volume">
        </div>`).join("")}</div>
      <p class="note">${ext ? "Generated live in your browser, nothing is downloaded. It keeps playing on every tab until you pause it." : "Generated live in your browser. On the demo it plays while this page is open."}</p>
    </div>`;
  const draw = () => {
    $("[data-master]", el).innerHTML = playing() ? PAUSE : PLAY;
    $("[data-master]", el).classList.toggle("is-on", playing());
    const names = SOUNDS.filter((s) => (A.levels[s.id] || 0) > 0).map((s) => s.name);
    $("[data-now]", el).textContent = playing() ? "Now playing" : names.length ? "Paused" : "Pick a sound";
    $("[data-nowsub]", el).textContent = names.join(" · ") || "Tap any card below, or try a mix";
    el.querySelectorAll("[data-snd]").forEach((c) => { const v = A.levels[c.dataset.snd] || 0; c.classList.toggle("is-on", v > 0); c.classList.toggle("is-live", v > 0 && A.on); $("input", c).value = Math.round(v * 100); c.style.setProperty("--v", v); });
    const left = A.on && A.stopAt ? Math.round((A.stopAt - Date.now()) / 60000) : 0;
    el.querySelectorAll("[data-sleep]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.sleep === (A.sleep || 0))));
    if (left > 0) $("[data-nowsub]", el).textContent += ` · stops in ${left}m`;
  };
  draw();
  el.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.closest("[data-master]")) { if (!Object.values(A.levels).some((v) => v > 0)) A.levels = { ...MIXES["Deep work"] }; A.on = !playing(); if (A.on && A.sleep) A.stopAt = Date.now() + A.sleep * 60000; }
    else if (t.closest("[data-tap]")) { const id = t.closest("[data-tap]").dataset.tap; A.levels[id] = (A.levels[id] || 0) > 0 ? 0 : 0.6; A.on = true; }
    else if (t.closest("[data-mix]")) { A.levels = { ...MIXES[t.closest("[data-mix]").dataset.mix] }; A.on = true; }
    else if (t.closest("[data-sleep]")) { A.sleep = +t.closest("[data-sleep]").dataset.sleep; A.stopAt = A.sleep ? Date.now() + A.sleep * 60000 : null; }
    else return;
    await save(); draw();
  });
  el.addEventListener("input", (e) => { const id = e.target.dataset.vol; if (!id) return; A.levels[id] = +e.target.value / 100; if (A.levels[id] > 0) A.on = true; clearTimeout(el._t); el._t = setTimeout(save, 120); draw(); });
  const iv = setInterval(draw, 15000);
  el._redraw = draw;
  return () => clearInterval(iv);
}

function drawChip() {
  const chip = $("#soundChip");
  chip.hidden = !playing();
  chip.innerHTML = `${NOTE_ICON}<span class="snd__eq is-mini"><i></i><i></i><i></i></span>`;
  const pane = document.querySelector(".hub__pane--sounds"); if (pane && pane._redraw) pane._redraw();
}

export async function initSounds(ctx) {
  C = ctx;
  addPane({ id: "sounds", label: "Sounds", icon: NOTE_ICON, title: "Ambient sounds", sub: "Mix a soundscape for deep work", render });
  A = await get(AMBIENT, { on: false, levels: {} });
  if (!ext) { A.on = false; engine = new Ambient(); } // the demo never starts playing by itself
  $("#soundChip").addEventListener("click", () => openHub("sounds"));
  watch(AMBIENT, (v) => { if (v) { A = v; drawChip(); if (engine) engine.set(A.on ? A.levels : {}); } });
  if (engine) {
    // the web demo plays here, and honours the sleep timer itself
    setInterval(() => { if (A.on && A.stopAt && Date.now() >= A.stopAt) { A.on = false; A.stopAt = null; save(); } }, 5000);
  }
  drawChip();
}
