import { load, save, onChange, putMedia, getMedia, delMedia, DEFAULTS } from "./store.js";
import { runScene, SCENE_LIST } from "./backgrounds.js";
import { getTasks, setTasks, getHistory, addHistory, clearHistory, newTask, act, when, TASKS, HISTORY } from "./tasks.js";
import { renderAlert } from "./alertui.js";
import { initLinks, drawLinks, drawDock, drawGoogle, bookmarkFolders } from "./links.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ext = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;

/* ---------- icons (inline, so the extension needs no remote code) ---------- */
const P = {
  gear: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
$("#openSettings").innerHTML = icon("gear");

/* ---------- search ---------- */
const ENGINES = {
  google: ["Google", "https://www.google.com/search?q="],
  ddg: ["DuckDuckGo", "https://duckduckgo.com/?q="],
  bing: ["Bing", "https://www.bing.com/search?q="],
  brave: ["Brave", "https://search.brave.com/search?q="],
};
const BANGS = {
  g: ["GitHub", "https://github.com/search?type=repositories&q="],
  so: ["Stack Overflow", "https://stackoverflow.com/search?q="],
  yt: ["YouTube", "https://www.youtube.com/results?search_query="],
  npm: ["npm", "https://www.npmjs.com/search?q="],
  mdn: ["MDN", "https://developer.mozilla.org/en-US/search?q="],
  w: ["Wikipedia", "https://en.wikipedia.org/w/index.php?search="],
  r: ["Reddit", "https://www.reddit.com/search/?q="],
  maps: ["Google Maps", "https://www.google.com/maps/search/"],
  cl: ["Claude", "https://claude.ai/new?q="],
  gpt: ["ChatGPT", "https://chatgpt.com/?q="],
};
const looksLikeUrl = (q) => /^(https?:\/\/)?(localhost(:\d+)?|([\w-]+\.)+[a-z]{2,})(:\d+)?(\/\S*)?$/i.test(q) && !/\s/.test(q);
function resolve(q) {
  q = q.trim(); if (!q) return null;
  if (looksLikeUrl(q)) return { url: /^https?:\/\//i.test(q) ? q : (q.startsWith("localhost") ? "http://" : "https://") + q, label: "Open " + q };
  const m = q.match(/^(\S+)\s+(.+)$/);
  if (m && BANGS[m[1].toLowerCase()]) { const [name, base] = BANGS[m[1].toLowerCase()]; return { url: base + encodeURIComponent(m[2]), label: `Search ${name} for “${m[2]}”` }; }
  const [name, base] = ENGINES[S.engine] || ENGINES.google;
  return { url: base + encodeURIComponent(q), label: `Search ${name} for “${q}”` };
}

/* ---------- state ---------- */
let S = await load();
let scene = null, mediaUrl = null;
const M = () => S[S.mode];
const persist = () => save(S);

/* ---------- background ---------- */
async function paintBackground() {
  const canvas = $("#bgCanvas"), img = $("#bgImg"), vid = $("#bgVideo"), credit = $("#credit");
  if (scene) { scene.stop(); scene = null; }
  if (mediaUrl) { URL.revokeObjectURL(mediaUrl); mediaUrl = null; }
  canvas.hidden = img.hidden = vid.hidden = true; vid.pause(); vid.removeAttribute("src"); credit.innerHTML = "";
  document.body.style.removeProperty("--solid");
  const bg = M().bg;
  if (bg === "custom") {
    const blob = await getMedia("custom-" + S.mode);
    if (blob) {
      mediaUrl = URL.createObjectURL(blob);
      if (blob.type.startsWith("video/")) { vid.src = mediaUrl; vid.hidden = false; vid.play().catch(() => {}); }
      else { img.src = mediaUrl; img.hidden = false; }
      return;
    }
  } else if (bg === "photo") {
    if (!S.photo) await newPhoto(false);
    if (S.photo) {
      img.src = `https://picsum.photos/id/${S.photo.id}/3840/2160`; img.hidden = false;
      credit.innerHTML = `Photo by <a href="${esc(S.photo.url)}" target="_blank" rel="noopener">${esc(S.photo.author)}</a> on Unsplash`;
      return;
    }
  } else if (bg === "solid") {
    document.body.style.setProperty("--solid", M().solid || "#0b0d12");
    return;
  }
  canvas.hidden = false;
  scene = runScene(canvas, SCENE_LIST.some(([k]) => k === bg) ? bg : DEFAULTS[S.mode].bg, M().accent);
}

// A random 4K landscape from Picsum (Unsplash photos, free to use).
async function newPhoto(repaint = true) {
  try {
    const r = await fetch(`https://picsum.photos/v2/list?page=${1 + Math.floor(Math.random() * 25)}&limit=40`);
    const list = (await r.json()).filter((p) => p.width >= 3000 && p.width > p.height);
    const p = list[Math.floor(Math.random() * list.length)];
    if (p) { S.photo = { id: p.id, author: p.author, url: p.url }; await persist(); }
  } catch (e) { toast("Couldn't reach the photo service. Check your connection."); }
  if (repaint) paintBackground();
}

/* ---------- look ---------- */
function applyLook() {
  const b = document.body, m = M();
  b.dataset.mode = S.mode;
  b.style.setProperty("--accent", m.accent);
  b.style.setProperty("--dim", m.dim / 100);
  b.style.setProperty("--blur", m.blur + "px");
  document.querySelectorAll("[data-set-mode]").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.setMode === S.mode)));
  $("#prompt").textContent = S.mode === "hacker" ? "root@devtab:~#" : "❯";
  $("#q").placeholder = S.mode === "hacker" ? "search, open a site, or try: g react" : "Search, open a URL, or try  g react · yt lofi · so css grid";
  $(".brand__txt").textContent = S.mode === "hacker" ? "devtab://root" : "devtab";
  $("#todoTitle").textContent = S.mode === "hacker" ? "./tasks" : "Tasks";
  $("#todo").hidden = !S.showTodo;
  tick(true); drawGreeting(); drawGoogle();
}

/* ---------- clock + greeting ---------- */
const pad = (n) => String(n).padStart(2, "0");
let lastMin = -1;
function tick(force) {
  const d = new Date();
  if (!force && !S.seconds && d.getMinutes() === lastMin) return;
  lastMin = d.getMinutes();
  let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM";
  if (!S.clock24) h = h % 12 || 12;
  const txt = (S.clock24 ? pad(h) : h) + ":" + pad(d.getMinutes()) + (S.seconds ? ":" + pad(d.getSeconds()) : "");
  const c = $("#clock");
  c.dataset.text = txt;
  c.innerHTML = `<span>${txt}</span>${S.clock24 ? "" : `<small>${ap}</small>`}`;
  if (d.getHours() === 0 && d.getMinutes() === 0) drawGreeting();
}
setInterval(tick, 1000);
function drawGreeting() {
  const d = new Date(), h = d.getHours();
  const part = h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Working late";
  const date = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const nm = S.name ? ", " + S.name : "";
  $("#greet").innerHTML = S.mode === "hacker"
    ? `<span class="hk">[ ${esc(date.toLowerCase())} ]</span> access granted${esc(nm.toLowerCase())}`
    : `<span class="cm">//</span> ${esc(part + nm)} · ${esc(date)}`;
}

/* ---------- search box ---------- */
const q = $("#q"), hints = $("#hints");
function drawHints() {
  const v = q.value;
  if (!v.trim()) {
    hints.innerHTML = Object.entries(BANGS).slice(0, 7).map(([k, [n]]) => `<button type="button" data-bang="${k}"><b>${k}</b> ${n}</button>`).join("");
    hints.classList.remove("is-go");
  } else {
    const r = resolve(v);
    hints.innerHTML = r ? `<span>↵ ${esc(r.label)}</span><span class="dim">Ctrl ↵ opens in a new tab</span>` : "";
    hints.classList.add("is-go");
  }
}
q.addEventListener("input", drawHints);
q.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const r = resolve(q.value); if (r) window.open(r.url, "_blank", "noopener"); }
});
$("#search").addEventListener("submit", (e) => { e.preventDefault(); const r = resolve(q.value); if (r) location.href = r.url; });
hints.addEventListener("click", (e) => { const b = e.target.closest("[data-bang]"); if (b) { q.value = b.dataset.bang + " "; q.focus(); drawHints(); } });

/* ---------- tasks, reminders and history ---------- */
let TL = [], HIST = [], histPage = 0, whenAt = null;
const HPER = 8;
const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/></svg>';
$("#whenBtn").innerHTML = CLOCK;
$("#addBtn").innerHTML = icon("plus");
function drawGo() {
  const go = $("#whenGo"), has = $("#todoIn").value.trim().length > 0;
  go.innerHTML = whenAt ? `${CLOCK}<span>Set reminder · <b>${esc(when(whenAt))}</b></span>` : `${CLOCK}<span>Pick a time above</span>`;
  go.disabled = !whenAt;
  go.classList.toggle("is-ready", !!whenAt && has);
  // the + button is for tasks without a reminder; with the time box open, "Set reminder" does the job
  $("#addBtn").hidden = !has || !$("#whenBox").hidden;
}
$("#todoIn").addEventListener("input", () => { $("#todoIn").classList.remove("is-nudge"); drawGo(); });
drawGo();
const fmt = (ms) => new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function loadTasks() {
  TL = await getTasks(); HIST = await getHistory();
  if (S.todos && S.todos.length) { // move to-dos from the first version into tasks
    for (const t of S.todos) { const n = newTask(t.text); if (t.done) n.status = "done"; TL.push(n); }
    S.todos = []; await persist(); await setTasks(TL);
  }
}
function drawTodos() {
  const now = Date.now();
  const open = TL.filter((t) => t.status !== "done").sort((a, b) => (a.at || 9e15) - (b.at || 9e15) || a.created - b.created);
  const done = TL.filter((t) => t.status === "done").sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 3);
  const badge = (t) => t.status === "ringing" ? `<em class="tb tb--ring">${CLOCK}ringing now</em>`
    : t.status === "started" ? `<em class="tb tb--go">in progress</em>`
    : t.status !== "done" && t.at ? `<em class="tb${t.at < now ? " tb--late" : ""}">${CLOCK}${esc(when(t.at))}</em>` : "";
  const row = (t) => `<li class="is-${t.status}"><button type="button" class="todo__ck" data-ck="${t.id}" aria-label="${t.status === "done" ? "Mark not done" : "Mark done"}">${t.status === "done" ? icon("check") : ""}</button><span class="tlist__txt">${esc(t.text)}${badge(t)}</span><button type="button" class="todo__x" data-del="${t.id}" aria-label="Delete task">${icon("x")}</button></li>`;
  $("#todoList").innerHTML = open.concat(done).map(row).join("")
    || `<li class="todo__empty">${S.mode === "hacker" ? "no pending tasks. system idle." : "Nothing yet. Add a task, and tap the clock to get a reminder."}</li>`;
  $("#todoCount").textContent = open.length ? String(open.length) : "";
  $("#histCount").textContent = HIST.length ? String(HIST.length) : "";
  drawHistory();
}
const H_LABEL = { created: "Added", started: "Started", completed: "Completed", snoozed: "Snoozed", deleted: "Deleted" };
const H_ICON = { created: "plus", completed: "check", snoozed: "square", deleted: "trash" };
function drawHistory() {
  const pages = Math.max(1, Math.ceil(HIST.length / HPER));
  histPage = Math.min(histPage, pages - 1);
  const slice = HIST.slice(histPage * HPER, histPage * HPER + HPER);
  $("#histList").innerHTML = slice.map((h) => `<li class="h--${h.action}"><span class="hlist__ic">${h.action === "started" ? "▶" : h.action === "snoozed" ? CLOCK : icon(H_ICON[h.action] || "check")}</span><div><b>${esc(h.text)}</b><small>${H_LABEL[h.action] || h.action}${h.extra ? " · " + esc(h.extra) : ""} · ${fmt(h.time)}</small></div></li>`).join("")
    || `<li class="todo__empty">No history yet. Adding, starting, completing and snoozing tasks shows up here.</li>`;
  $("#histPager").innerHTML = HIST.length > HPER
    ? `<button type="button" data-pg="-1" ${histPage === 0 ? "disabled" : ""} aria-label="Previous page">‹</button><span>Page ${histPage + 1} of ${pages}</span><button type="button" data-pg="1" ${histPage >= pages - 1 ? "disabled" : ""} aria-label="Next page">›</button><button type="button" class="pager__clear" data-hclear>Clear</button>`
    : HIST.length ? `<span></span><button type="button" class="pager__clear" data-hclear>Clear history</button>` : "";
}

/* the reminder time picker */
const pad2 = (n) => String(n).padStart(2, "0");
const localInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
function setWhen(ms) {
  whenAt = ms;
  $("#whenSel").innerHTML = ms ? `${CLOCK}<span>Reminds you <b>${esc(when(ms))}</b></span><button type="button" data-clear-when aria-label="Remove reminder">${icon("x")}</button>` : "";
  $("#whenBtn").classList.toggle("is-on", !!ms);
  if (ms) $("#whenAt").value = localInput(ms);
  drawGo();
}
$("#whenBtn").addEventListener("click", () => {
  const box = $("#whenBox"), open = box.hidden;
  box.hidden = !open; $("#whenBtn").setAttribute("aria-expanded", String(open));
  $("#whenAt").min = localInput(Date.now());
  if (open) $("#todoIn").focus();
  drawGo();
});
$("#whenBox").addEventListener("click", (e) => {
  const c = e.target.closest("[data-in]");
  if (c) {
    if (c.dataset.in === "tomorrow") { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); setWhen(d.getTime()); }
    else setWhen(Date.now() + +c.dataset.in * 60000);
    $("#todoIn").focus(); return;
  }
  if (e.target.closest("[data-clear-when]")) { setWhen(null); $("#whenAt").value = ""; }
});
$("#whenAt").addEventListener("change", (e) => { setWhen(e.target.value ? new Date(e.target.value).getTime() : null); });

$("#todoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = $("#todoIn").value.trim();
  if (!v) { $("#todoIn").focus(); $("#todoIn").classList.remove("is-nudge"); void $("#todoIn").offsetWidth; $("#todoIn").classList.add("is-nudge"); return toast("Type what to be reminded about first."); }
  if (whenAt && whenAt < Date.now() - 30000) return toast("That time has already passed. Pick a time in the future.");
  const t = newTask(v, whenAt);
  TL = await getTasks(); TL.push(t); await setTasks(TL);
  await addHistory(t, "created", whenAt ? "reminder " + when(whenAt) : null);
  if (whenAt) toast(`Got it. I'll ring at ${when(whenAt)}.`);
  $("#todoIn").value = ""; setWhen(null); $("#whenAt").value = ""; $("#whenBox").hidden = true; $("#whenBtn").setAttribute("aria-expanded", "false"); drawGo();
  await loadTasks(); drawTodos();
});
$("#todoList").addEventListener("click", async (e) => {
  const c = e.target.closest("[data-ck]"), x = e.target.closest("[data-del]");
  if (c) { const t = TL.find((y) => y.id === c.dataset.ck); if (t) await act(t.id, t.status === "done" ? "reopen" : "complete"); }
  if (x) { const t = TL.find((y) => y.id === x.dataset.del); if (t) { await act(t.id, "delete"); await addHistory(t, "deleted"); } }
  if (c || x) { await loadTasks(); drawTodos(); }
});
$("#todo").addEventListener("click", async (e) => {
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    document.querySelectorAll("#todo [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === tab)));
    document.querySelectorAll("#todo [data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
    return;
  }
  const pg = e.target.closest("[data-pg]"); if (pg) { histPage += +pg.dataset.pg; drawHistory(); return; }
  if (e.target.closest("[data-hclear]") && confirm("Clear the whole task history?")) { await clearHistory(); await loadTasks(); histPage = 0; drawTodos(); }
});

// keep the list live: the background worker and other tabs change it too
const refreshTasks = async () => { await loadTasks(); drawTodos(); };
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && (ch[TASKS] || ch[HISTORY])) refreshTasks(); });
} else {
  addEventListener("devtab-local", refreshTasks);
  addEventListener("storage", (e) => { if (e.key === TASKS || e.key === HISTORY) refreshTasks(); });
}
setInterval(drawTodos, 30000); // keeps "late" badges and relative times fresh

// Web demo only: there's no background worker, so this page rings and shows the alert itself.
if (!ext) {
  let showing = false;
  setInterval(async () => {
    if (showing || document.hidden) return;
    const list = await getTasks();
    const t = list.find((x) => x.status === "ringing") || list.find((x) => x.status === "open" && x.at && x.at <= Date.now());
    if (!t) return;
    showing = true; t.status = "ringing"; await setTasks(list);
    const wrap = document.createElement("div");
    wrap.className = "al-modal";
    wrap.innerHTML = `<div class="al-modal__box" style="--accent:${esc(M().accent)}"><button type="button" class="al-modal__x" aria-label="Close and snooze 5 minutes">×</button><div class="al-body"></div></div>`;
    document.body.appendChild(wrap);
    const tone = new Audio("sounds/ring.wav"); tone.loop = true; tone.play().catch(() => {});
    let stop = () => {};
    const finish = async (a, m) => { tone.pause(); stop(); wrap.remove(); await act(t.id, a, m); showing = false; refreshTasks(); };
    const onAction = (a, m) => finish(a, m); onAction.inPage = true;
    stop = renderAlert(wrap.querySelector(".al-body"), t, S.mode, onAction);
    wrap.querySelector(".al-modal__x").addEventListener("click", () => finish("snooze", 5));
  }, 3000);
}

/* ---------- weather (Open-Meteo, no key) ---------- */
const WMO = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Snow", 80: "Showers", 81: "Showers", 82: "Showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };
async function drawWeather() {
  const el = $("#weather");
  el.hidden = !(S.showWeather && S.city);
  if (el.hidden) return;
  const key = "devtab:wx:" + S.city.lat + "," + S.city.lon;
  let wx = null;
  try { const c = JSON.parse(sessionStorage.getItem(key) || "null"); if (c && Date.now() - c.at < 20 * 60 * 1000) wx = c; } catch (e) {}
  if (!wx) {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${S.city.lat}&longitude=${S.city.lon}&current=temperature_2m,weather_code&timezone=auto`);
      const j = await r.json(); wx = { t: Math.round(j.current.temperature_2m), c: j.current.weather_code, at: Date.now() };
      sessionStorage.setItem(key, JSON.stringify(wx));
    } catch (e) { el.hidden = true; return; }
  }
  el.innerHTML = `<b>${wx.t}°</b><span>${esc(WMO[wx.c] || "")} · ${esc(S.city.name)}</span>`;
}

/* ---------- hacker boot sequence ---------- */
async function boot() {
  if (S.mode !== "hacker" || !S.boot || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const last = +localStorage.getItem("devtab:boot") || 0;
  if (Date.now() - last < 20 * 60 * 1000) return; // once every 20 minutes, not every tab
  localStorage.setItem("devtab:boot", String(Date.now()));
  const el = $("#boot"), pre = $("pre", el);
  const lines = ["[ OK ] mounting /dev/focus", "[ OK ] loading kernel modules: caffeine, music", "[ OK ] decrypting session keys", "[ OK ] bypassing distractions", "[ ** ] establishing secure tunnel ...", `[ OK ] welcome back${S.name ? ", " + S.name.toLowerCase() : ""}.`];
  el.hidden = false; pre.textContent = "";
  for (const l of lines) { pre.textContent += l + "\n"; await new Promise((r) => setTimeout(r, 110)); }
  await new Promise((r) => setTimeout(r, 250));
  el.classList.add("is-out"); setTimeout(() => { el.hidden = true; el.classList.remove("is-out"); }, 400);
}

/* ---------- settings drawer ---------- */
const drawer = $("#settings"), scrim = $("#scrim");
function drawSettings() {
  const m = M();
  const sc = SCENE_LIST.map(([k, n]) => `<button type="button" class="tile${m.bg === k ? " is-on" : ""}" data-bg="${k}"><span class="tile__pv tile__pv--${k}"></span>${n}</button>`).join("");
  drawer.innerHTML = `
    <div class="drawer__head"><h2>Settings</h2><button type="button" class="icon-btn" data-close aria-label="Close settings">${icon("x")}</button></div>
    <section><h3>Look</h3>
      <div class="seg"><button type="button" data-set-mode="dev" aria-pressed="${S.mode === "dev"}">💻 Developer</button><button type="button" data-set-mode="hacker" aria-pressed="${S.mode === "hacker"}">🕶️ Hacker</button></div>
      <p class="note">Each look keeps its own background, colour and dim level.</p></section>
    <section><h3>Background</h3>
      <div class="tiles">${sc}
        <button type="button" class="tile${m.bg === "photo" ? " is-on" : ""}" data-bg="photo"><span class="tile__pv tile__pv--photo">${icon("image")}</span>4K photo</button>
        <button type="button" class="tile${m.bg === "custom" ? " is-on" : ""}" data-bg="custom"><span class="tile__pv tile__pv--custom">${icon("upload")}</span>Your image / video</button>
        <button type="button" class="tile${m.bg === "solid" ? " is-on" : ""}" data-bg="solid"><span class="tile__pv tile__pv--solid">${icon("square")}</span>Solid colour</button>
      </div>
      ${m.bg === "photo" ? `<button type="button" class="btn" data-photo>${icon("shuffle")}New random photo</button>` : ""}
      ${m.bg === "custom" ? `<label class="btn">${icon("upload")}Choose image or video<input type="file" accept="image/*,video/*" data-upload hidden></label><p class="note">MP4 or WebM loops, or any image. It's stored in this browser only, never uploaded.</p>` : ""}
      ${m.bg === "solid" ? `<label class="row">Colour <input type="color" data-solid value="${esc(m.solid || "#0b0d12")}"></label>` : ""}
    </section>
    <section><h3>Colour &amp; contrast</h3>
      <label class="row">Accent <input type="color" data-k="accent" value="${esc(m.accent)}"></label>
      <label class="row">Dim background <input type="range" min="0" max="80" data-k="dim" value="${m.dim}"></label>
      <label class="row">Blur background <input type="range" min="0" max="20" data-k="blur" value="${m.blur}"></label>
    </section>
    <section><h3>Clock</h3>
      <label class="row">Your name <input type="text" maxlength="24" data-name value="${esc(S.name)}" placeholder="for the greeting"></label>
      <label class="row">24-hour clock <input type="checkbox" data-t="clock24" ${S.clock24 ? "checked" : ""}></label>
      <label class="row">Show seconds <input type="checkbox" data-t="seconds" ${S.seconds ? "checked" : ""}></label>
    </section>
    <section><h3>Search</h3>
      <label class="row">Engine <select data-engine>${Object.entries(ENGINES).map(([k, [n]]) => `<option value="${k}"${S.engine === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <p class="note">Shortcuts: ${Object.entries(BANGS).map(([k, [n]]) => `<code>${k}</code> ${n}`).join(" · ")}</p>
    </section>
    <section><h3>Shortcuts</h3>
      <div class="seg"><button type="button" data-links="top" aria-pressed="${S.links === "top"}">Most visited</button><button type="button" data-links="custom" aria-pressed="${S.links === "custom"}">My shortcuts</button></div>
      <p class="note">Tap the <b>+</b> tile to add any link. Hover a tile to edit or remove it, and drag tiles to reorder. Editing a most-visited tile turns it into your own list.</p>
    </section>
    <section><h3>Bookmarks dock</h3>
      <label class="row">Show the dock <input type="checkbox" data-t="showDock" ${S.showDock ? "checked" : ""}></label>
      <label class="row">Folder <select data-dockfolder>${FOLDERS.map(([id, n]) => `<option value="${esc(id)}"${(S.dockFolder || "1") === id ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      ${ext ? `<button type="button" class="btn btn--ghost" data-bm-manager>Open the bookmark manager</button>` : ""}
      <p class="note">Shows your Chrome bookmarks. Add one with Ctrl+D on any page; it appears here straight away.</p>
    </section>
    <section><h3>Google bar</h3>
      <label class="row">Gmail, Images, apps &amp; account <input type="checkbox" data-t="showGoogle" ${S.showGoogle ? "checked" : ""}></label>
    </section>
    <section><h3>Widgets</h3>
      <label class="row">Tasks &amp; reminders <input type="checkbox" data-t="showTodo" ${S.showTodo ? "checked" : ""}></label>
      <label class="row">Weather <input type="checkbox" data-t="showWeather" ${S.showWeather ? "checked" : ""}></label>
      <form class="addlink" data-city><input name="c" placeholder="${S.city ? esc(S.city.name) : "Your city, e.g. Noida"}"><button class="btn btn--sm">Set city</button></form>
      <label class="row">Hacker boot animation <input type="checkbox" data-t="boot" ${S.boot ? "checked" : ""}></label>
    </section>
    <section><button type="button" class="btn btn--ghost" data-reset>Reset everything</button>
      <p class="note">DevTab is open source · <a href="https://github.com/Anekkumar9518/devtab" target="_blank" rel="noopener">github.com/Anekkumar9518/devtab</a></p></section>`;
}
let FOLDERS = [["1", "Bookmarks bar"]];
const openSettings = async () => { try { FOLDERS = await bookmarkFolders(); } catch (e) {} drawSettings(); drawer.hidden = scrim.hidden = false; requestAnimationFrame(() => drawer.classList.add("is-in")); };
const closeSettings = () => { drawer.classList.remove("is-in"); setTimeout(() => { drawer.hidden = scrim.hidden = true; }, 220); };
$("#openSettings").addEventListener("click", openSettings);
scrim.addEventListener("click", closeSettings);

async function setMode(mode) {
  if (S.mode === mode) return;
  S.mode = mode; await persist(); applyLook(); paintBackground(); drawTodos(); boot();
  if (!drawer.hidden) drawSettings();
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-set-mode]"); if (b) setMode(b.dataset.setMode); });

drawer.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.closest("[data-close]")) return closeSettings();
  const bg = t.closest("[data-bg]");
  if (bg) { M().bg = bg.dataset.bg; await persist(); paintBackground(); drawSettings(); return; }
  if (t.closest("[data-photo]")) return newPhoto();
  if (t.closest("[data-bm-manager]")) { try { chrome.tabs.create({ url: navigator.userAgent.includes("Edg/") ? "edge://favorites" : "chrome://bookmarks" }); } catch (e) { toast("Open chrome://bookmarks from the address bar."); } return; }
  const ln = t.closest("[data-links]");
  if (ln) { S.links = ln.dataset.links; await persist(); drawLinks(); drawSettings(); return; }
  const lx = t.closest("[data-link-x]");
  if (lx) { S.custom.splice(+lx.dataset.linkX, 1); await persist(); drawLinks(); drawSettings(); return; }
  if (t.closest("[data-reset]") && confirm("Reset all DevTab settings, links and tasks?")) {
    await delMedia("custom-dev").catch(() => {}); await delMedia("custom-hacker").catch(() => {});
    S = structuredClone(DEFAULTS); await persist(); applyLook(); paintBackground(); drawLinks(); drawDock(); drawTodos(); drawWeather(); drawSettings();
  }
});
drawer.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.k) {
    const k = t.dataset.k; M()[k] = k === "accent" ? t.value : +t.value; persist();
    applyLook(); if (k === "accent") paintBackground();
  } else if (t.matches("[data-name]")) { S.name = t.value.trim(); persist(); drawGreeting(); }
  else if (t.matches("[data-solid]")) { M().solid = t.value; persist(); document.body.style.setProperty("--solid", t.value); }
});
drawer.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.t) { S[t.dataset.t] = t.checked; await persist(); applyLook(); drawWeather(); drawDock(); }
  else if (t.matches("[data-dockfolder]")) { S.dockFolder = t.value; await persist(); drawDock(); }
  else if (t.matches("[data-engine]")) { S.engine = t.value; await persist(); drawHints(); }
  else if (t.matches("[data-upload]") && t.files[0]) {
    const f = t.files[0];
    if (!/^(image|video)\//.test(f.type)) return toast("That isn't an image or a video.");
    if (f.size > 400 * 1024 * 1024) return toast("That file is over 400 MB. Try a shorter or smaller video.");
    await putMedia("custom-" + S.mode, f); M().bg = "custom"; await persist(); paintBackground(); toast("Background saved in this browser.");
  }
});
drawer.addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target;
  if (f.matches("[data-addlink]")) {
    let u = f.u.value.trim(); if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    S.custom.push({ t: f.t.value.trim(), u }); await persist(); drawLinks(); drawSettings();
  } else if (f.matches("[data-city]")) {
    const c = f.c.value.trim(); if (!c) return;
    try {
      const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(c)}`)).json();
      const r = j.results && j.results[0];
      if (!r) return toast("Couldn't find that city.");
      S.city = { name: r.name, lat: +r.latitude.toFixed(3), lon: +r.longitude.toFixed(3) }; S.showWeather = true;
      await persist(); drawWeather(); drawSettings(); toast(`Weather set to ${r.name}${r.country ? ", " + r.country : ""}.`);
    } catch (err) { toast("The weather service didn't answer. Try again."); }
  }
});

/* ---------- toast ---------- */
let toastT = 0;
function toast(msg) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("is-on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), 2600);
}

/* ---------- keys ---------- */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !drawer.hidden) return closeSettings();
  if (e.target.closest("input, textarea, select")) return;
  if (e.key === "/") { e.preventDefault(); q.focus(); }
  else if (e.key.toLowerCase() === "m" && e.altKey) setMode(S.mode === "dev" ? "hacker" : "dev");
});

/* ---------- other tabs changed something ---------- */
onChange((ns) => {
  if (!ns) return;
  const before = JSON.stringify([S.mode, S.dev, S.hacker, S.photo]);
  S = { ...structuredClone(DEFAULTS), ...ns, dev: { ...DEFAULTS.dev, ...ns.dev }, hacker: { ...DEFAULTS.hacker, ...ns.hacker } };
  applyLook(); drawTodos(); drawLinks(); drawDock(); drawWeather();
  if (JSON.stringify([S.mode, S.dev, S.hacker, S.photo]) !== before) paintBackground();
});

/* ---------- start ---------- */
initLinks({ S: () => S, persist, toast, icon, esc });
applyLook();
paintBackground();
drawDock();
drawHints(); drawLinks(); drawWeather();
await loadTasks(); drawTodos();
boot();
if (!matchMedia("(pointer: coarse)").matches) q.focus({ preventScroll: true });
