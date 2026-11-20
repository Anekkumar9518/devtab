// Hub pane: your browsing "Wrapped". Time per site, tabs opened, busiest hours,
// focus sessions and tasks done, for today, the last 7 or the last 30 days.
// Opt-in, and it never leaves this browser. Makes a shareable PNG card.
import { addPane } from "../hub.js";
import { get, set, ext } from "../kv.js";
import { getLog, dur } from "../focus-core.js";

const STATS = "devtab:stats";
const $ = (s, el = document) => el.querySelector(s);
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>';
let C = null, range = 7;

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hm = (sec) => { if (sec > 0 && sec < 60) return "<1m"; const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const hourLbl = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });

async function summary(days) {
  const all = await get(STATS, { days: {} });
  const keys = []; for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); keys.push(dayKey(d)); }
  const sites = {}, hours = Array(24).fill(0), perDay = [];
  let tabs = 0, total = 0;
  for (const k of keys) {
    const d = all.days[k]; let dayTotal = 0;
    if (d) { tabs += d.tabs || 0; for (const [h, s] of Object.entries(d.sites)) { sites[h] = (sites[h] || 0) + s; dayTotal += s; } d.hours.forEach((s, i) => (hours[i] += s)); }
    total += dayTotal; perDay.push([k, dayTotal]);
  }
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1));
  const log = (await getLog()).filter((x) => x.start >= since.getTime());
  const hist = (await get("devtab:history", [])).filter((h) => h.action === "completed" && h.time >= since.getTime());
  const top = Object.entries(sites).sort((a, b) => b[1] - a[1]);
  const peak = hours.indexOf(Math.max(...hours));
  return { tabs, total, top, hours, perDay, peak, focus: { n: log.length, min: log.reduce((s, x) => s + x.minutes, 0), best: Math.max(0, ...log.map((x) => x.minutes)) }, done: hist.length, hasData: total > 0 || tabs > 0 };
}

function verdict(s) {
  if (!s.hasData) return "Browse a little and come back: your story fills in as you go.";
  const [site, sec] = s.top[0] || ["", 0];
  const owl = s.peak >= 22 || s.peak < 4, early = s.peak >= 5 && s.peak < 9;
  return `Your top site was ${site} at ${hm(sec)}. ${owl ? "Night owl detected 🦉" : early ? "Early bird energy 🌅" : `You're busiest around ${hourLbl(s.peak)}.`}`;
}

async function render(el) {
  const S = C.S();
  if (!ext) {
    el.innerHTML = `<div class="wr__off"><div class="wr__art">${ICON}</div><h4>Wrapped needs the extension</h4><p>Installed, DevTab can count your tabs, time per site and busiest hours, all kept in your browser, and turn them into a shareable card.</p></div>`;
    return;
  }
  if (!S.fx.wrapped) {
    el.innerHTML = `<div class="wr__off"><div class="wr__art">${ICON}</div><h4>Your browsing, wrapped</h4>
      <p>See where your time goes: top sites, tabs opened, your busiest hour, focus streaks and tasks done, then share it as a card.</p>
      <p class="wr__priv">🔒 Everything stays in this browser. Nothing is uploaded, ever. Turn it off and clear it any time.</p>
      <button type="button" class="btn wr__start" data-on>Start my Wrapped</button></div>`;
    $("[data-on]", el).addEventListener("click", async () => { S.fx.wrapped = true; await C.persist(); C.toast("Wrapped is on. Check back after some browsing."); render(el); });
    return;
  }
  const s = await summary(range);
  const maxH = Math.max(1, ...s.hours), maxD = Math.max(1, ...s.perDay.map((x) => x[1])), top = s.top.slice(0, 6), maxS = top[0] ? top[0][1] : 1;
  el.innerHTML = `
    <div class="wr">
      <div class="wr__bar"><div class="seg wr__seg">${[[1, "Today"], [7, "7 days"], [30, "30 days"]].map(([d, n]) => `<button type="button" data-range="${d}" aria-pressed="${d === range}">${n}</button>`).join("")}</div>
        <button type="button" class="btn btn--sm" data-share>Share card</button></div>
      <p class="wr__verdict">${C.esc(verdict(s))}</p>
      <div class="wr__stats">
        <div class="wr__stat"><b>${s.tabs.toLocaleString()}</b><span>tabs opened</span></div>
        <div class="wr__stat"><b>${hm(s.total)}</b><span>time on the web</span></div>
        <div class="wr__stat"><b>${s.focus.best ? dur(s.focus.best) : "–"}</b><span>longest focus · ${s.focus.n} session${s.focus.n === 1 ? "" : "s"}</span></div>
        <div class="wr__stat"><b>${s.done}</b><span>tasks completed</span></div>
      </div>
      <div class="wr__cols">
        <section class="wr__card"><h4>Top sites</h4><ol class="wr__top">${top.map(([h, sec], i) => `<li style="--w:${(sec / maxS * 100).toFixed(1)}%"><span class="wr__rank">${i + 1}</span>${C.favicon("https://" + h) ? `<img src="${C.favicon("https://" + h, 32)}" alt="">` : ""}<span class="wr__h">${C.esc(h)}</span><span class="wr__t">${hm(sec)}</span></li>`).join("") || `<li class="note">No sites yet.</li>`}</ol></section>
        <section class="wr__card"><h4>When you browse</h4><div class="wr__hours">${s.hours.map((v, i) => `<i style="--h:${(v / maxH * 100).toFixed(1)}%" class="${i === s.peak && v ? "is-peak" : ""}" title="${hourLbl(i)}: ${hm(v)}"></i>`).join("")}</div><div class="wr__axis"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>
          ${range > 1 ? `<h4 class="wr__h4">Day by day</h4><div class="wr__days">${s.perDay.map(([k, v]) => `<i style="--h:${(v / maxD * 100).toFixed(1)}%" title="${k}: ${hm(v)}"></i>`).join("")}</div>` : ""}</section>
      </div>
      <div class="wr__foot"><span>🔒 Stored only in this browser.</span><button type="button" class="wr__link" data-clear>Clear data</button><button type="button" class="wr__link" data-stop>Turn off</button></div>
    </div>`;
  el._s = s;
  if (el._wired) return;
  el._wired = true; // one listener per pane element, however often it re-renders
  el.addEventListener("click", async (e) => {
    const r = e.target.closest("[data-range]"); if (r) { range = +r.dataset.range; return render(el); }
    if (e.target.closest("[data-share]")) return shareCard(el._s);
    if (e.target.closest("[data-clear]") && confirm("Clear all Wrapped data?")) { await set(STATS, { days: {} }); render(el); }
    if (e.target.closest("[data-stop]")) { C.S().fx.wrapped = false; await C.persist(); render(el); }
  });
}

// A 1080×1350 card, drawn on a canvas, in the current look.
async function shareCard(s) {
  const S = C.S(), hacker = S.mode === "hacker", acc = S[S.mode].accent;
  const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
  const x = cv.getContext("2d");
  await document.fonts.ready;
  const UI = hacker ? '"JetBrains Mono", monospace' : '"Space Grotesk", system-ui, sans-serif', MONO = '"JetBrains Mono", monospace';
  if (hacker) { x.fillStyle = "#000"; x.fillRect(0, 0, 1080, 1350); x.fillStyle = acc; x.globalAlpha = 0.08; for (let i = 0; i < 1350; i += 4) x.fillRect(0, i, 1080, 1); x.globalAlpha = 1; }
  else {
    const g = x.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, "#0b0d1a"); g.addColorStop(1, "#1a1035"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
    const r = x.createRadialGradient(860, 220, 0, 860, 220, 700); r.addColorStop(0, acc + "88"); r.addColorStop(1, acc + "00"); x.fillStyle = r; x.fillRect(0, 0, 1080, 1350);
  }
  const period = range === 1 ? "today" : `the last ${range} days`;
  x.fillStyle = acc; x.font = `600 30px ${MONO}`; x.fillText(hacker ? "> devtab --wrapped" : "DEVTAB WRAPPED", 80, 120);
  x.fillStyle = "#fff"; x.font = `700 84px ${UI}`; x.fillText(S.name ? `${S.name}'s web,` : "My web,", 80, 230); x.fillText(period + ".", 80, 320);
  const stats = [[s.tabs.toLocaleString(), "tabs opened"], [hm(s.total), "on the web"], [s.focus.best ? dur(s.focus.best) : "–", "longest focus"], [String(s.done), "tasks done"]];
  stats.forEach(([v, l], i) => {
    const cx = 80 + (i % 2) * 470, cy = 430 + Math.floor(i / 2) * 190;
    x.fillStyle = hacker ? "rgba(0,255,102,.06)" : "rgba(255,255,255,.06)"; x.beginPath(); x.roundRect(cx, cy, 440, 160, hacker ? 2 : 28); x.fill();
    x.fillStyle = "#fff"; x.font = `700 68px ${UI}`; x.fillText(v, cx + 32, cy + 92);
    x.fillStyle = "rgba(255,255,255,.6)"; x.font = `500 26px ${UI}`; x.fillText(l, cx + 32, cy + 134);
  });
  x.fillStyle = acc; x.font = `600 28px ${MONO}`; x.fillText(hacker ? "// top sites" : "TOP SITES", 80, 860);
  const top = s.top.slice(0, 4), maxS = top[0] ? top[0][1] : 1;
  top.forEach(([h, sec], i) => {
    const y = 910 + i * 82;
    x.fillStyle = hacker ? "rgba(0,255,102,.12)" : "rgba(255,255,255,.07)"; x.beginPath(); x.roundRect(80, y, 920, 62, hacker ? 2 : 16); x.fill();
    x.fillStyle = acc; x.globalAlpha = 0.35; x.beginPath(); x.roundRect(80, y, Math.max(40, 920 * sec / maxS), 62, hacker ? 2 : 16); x.fill(); x.globalAlpha = 1;
    x.fillStyle = "#fff"; x.font = `600 30px ${UI}`; x.fillText(`${i + 1}. ${h}`, 104, y + 42);
    x.font = `500 28px ${MONO}`; const t = hm(sec); x.fillText(t, 976 - x.measureText(t).width, y + 42);
  });
  x.fillStyle = "rgba(255,255,255,.5)"; x.font = `500 24px ${UI}`; x.fillText("Made with DevTab · github.com/Anekkumar9518/devtab", 80, 1290);
  cv.toBlob(async (blob) => {
    let copied = false;
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); copied = true; } catch (e) {}
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `devtab-wrapped-${dayKey(new Date())}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    C.toast(copied ? "Card saved and copied: paste it anywhere." : "Card saved to your downloads.");
  }, "image/png");
}

export function initWrapped(ctx) {
  C = ctx;
  addPane({ id: "wrapped", label: "Wrapped", icon: ICON, title: "Your Wrapped", sub: "Where your time on the web goes", render: (el) => { render(el); } });
}
