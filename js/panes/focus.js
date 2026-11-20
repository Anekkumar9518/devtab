// Hub pane: Focus mode. A countdown ring, quick durations, and the list of
// sites that get blocked while it runs.
import { addPane, openHub } from "../hub.js";
import { getFocus, startFocus, endFocus, extendFocus, getLog, todayStats, dur, cleanSite, FOCUS } from "../focus-core.js";
import { watch, ext } from "../kv.js";

const $ = (s, el = document) => el.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const CIRC = 2 * Math.PI * 88;
const PRESETS = {
  Social: ["instagram.com", "facebook.com", "x.com", "twitter.com", "linkedin.com", "snapchat.com"],
  Video: ["youtube.com", "netflix.com", "primevideo.com", "hotstar.com", "twitch.tv"],
  News: ["news.google.com", "reddit.com", "news.ycombinator.com", "ndtv.com"],
  Shopping: ["amazon.in", "amazon.com", "flipkart.com", "myntra.com", "meesho.com"],
};
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>';
let C = null, F = null, pick = 25;

const fmtLeft = (ms) => { const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000); return m >= 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };

function render(el) {
  const S = C.S();
  pick = S.focus.minutes || 25;
  el.innerHTML = `
    <div class="fz">
      <div class="fz__hero">
        <div class="fz__ring">
          <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="fz__bg" cx="100" cy="100" r="88"/><circle class="fz__fg" cx="100" cy="100" r="88" style="stroke-dasharray:${CIRC}"/></svg>
          <div class="fz__time"><b data-time></b><span data-state></span></div>
        </div>
        <div class="fz__ctl" data-ctl></div>
      </div>
      <div class="fz__block">
        <div class="fz__bh"><h4>Blocked while you focus</h4><span data-count></span></div>
        <div class="fz__sites" data-sites></div>
        <form class="fz__add" data-add><input name="s" placeholder="Add a site, e.g. instagram.com" autocomplete="off" spellcheck="false"><button class="btn btn--sm">Block</button></form>
        <div class="fz__presets">${Object.keys(PRESETS).map((k) => `<button type="button" data-preset="${k}">+ ${k}</button>`).join("")}</div>
        ${ext ? "" : `<p class="note">The timer works here; blocking sites needs the installed extension.</p>`}
      </div>
    </div>`;
  const draw = async () => {
    F = await getFocus();
    const running = F && Date.now() < F.endsAt;
    const ms = running ? F.endsAt - Date.now() : pick * 60000;
    $("[data-time]", el).textContent = fmtLeft(ms);
    $("[data-state]", el).textContent = running ? "focusing" : "ready";
    $(".fz__fg", el).style.strokeDashoffset = running ? String(CIRC * (1 - ms / (F.endsAt - F.startedAt))) : "0";
    el.classList.toggle("is-running", !!running);
  };
  const drawCtl = async () => {
    F = await getFocus();
    const running = F && Date.now() < F.endsAt, st = todayStats(await getLog());
    const stat = `<p class="fz__stat">Today: <b>${st.sessions}</b> session${st.sessions === 1 ? "" : "s"} · <b>${dur(st.minutes)}</b> focused</p>`;
    $("[data-ctl]", el).innerHTML = running
      ? `<p class="fz__lead">Deep work in progress. ${F.sites.length} site${F.sites.length === 1 ? " is" : "s are"} blocked until ${new Date(F.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</p>
         <div class="fz__row"><button type="button" class="btn btn--ghost fz__more" data-more>+5 min</button><button type="button" class="fz__hold" data-hold><span></span><b>Hold to end early</b></button></div>${stat}`
      : `<p class="fz__lead">Pick a length and start. Distracting sites stay closed until the timer ends.</p>
         <div class="fz__chips">${[15, 25, 45, 60, 90].map((m) => `<button type="button" data-min="${m}" aria-pressed="${m === pick}">${m}<small>min</small></button>`).join("")}
           <label class="fz__custom"><input type="number" min="1" max="600" value="${[15, 25, 45, 60, 90].includes(pick) ? "" : pick}" placeholder="custom" data-custom aria-label="Custom minutes"></label></div>
         <button type="button" class="btn fz__go" data-go>${ICON}Start ${pick}-minute focus</button>${stat}`;
  };
  const drawSites = () => {
    const sites = C.S().focus.sites;
    $("[data-sites]", el).innerHTML = sites.map((s, i) => `<span class="fz__site">${C.favicon("https://" + s) ? `<img src="${C.favicon("https://" + s)}" alt="">` : `<i>${C.esc(s[0].toUpperCase())}</i>`}${C.esc(s)}<button type="button" data-rm="${i}" aria-label="Unblock ${C.esc(s)}">×</button></span>`).join("") || `<span class="note">Nothing blocked yet.</span>`;
    $("[data-count]", el).textContent = sites.length + " site" + (sites.length === 1 ? "" : "s");
  };
  draw(); drawCtl(); drawSites();
  const iv = setInterval(draw, 1000);

  let holdT = 0;
  el.addEventListener("click", async (e) => {
    const t = e.target, S = C.S();
    const mb = t.closest("[data-min]");
    if (mb) { pick = +mb.dataset.min; S.focus.minutes = pick; C.persist(); drawCtl(); draw(); return; }
    if (t.closest("[data-go]")) { await startFocus(pick, S.focus.sites.slice()); C.toast(`Focus on. ${S.focus.sites.length} sites blocked for ${pick} minutes.`); drawCtl(); draw(); return; }
    if (t.closest("[data-more]")) { await extendFocus(5); C.toast("Added 5 minutes."); drawCtl(); return; }
    const rm = t.closest("[data-rm]");
    if (rm) { S.focus.sites.splice(+rm.dataset.rm, 1); await C.persist(); await syncSites(); drawSites(); return; }
    const pr = t.closest("[data-preset]");
    if (pr) { const add = PRESETS[pr.dataset.preset].filter((x) => !S.focus.sites.includes(x)); S.focus.sites.push(...add); await C.persist(); await syncSites(); drawSites(); C.toast(add.length ? `Blocked ${add.length} more sites.` : "Those are already blocked."); }
  });
  el.addEventListener("input", (e) => { if (e.target.matches("[data-custom]")) { const v = Math.round(+e.target.value); if (v >= 1 && v <= 600) { pick = v; C.S().focus.minutes = v; C.persist(); el.querySelectorAll("[data-min]").forEach((b) => b.setAttribute("aria-pressed", "false")); $("[data-go]", el).innerHTML = `${ICON}Start ${pick}-minute focus`; draw(); } } });
  el.addEventListener("submit", async (e) => {
    e.preventDefault(); const S = C.S(), v = cleanSite(e.target.s.value);
    if (!v || !v.includes(".")) return C.toast("Type a site like instagram.com");
    if (!S.focus.sites.includes(v)) S.focus.sites.push(v);
    e.target.reset(); await C.persist(); await syncSites(); drawSites();
  });
  // a deliberate 2.5 s hold to give up early
  el.addEventListener("pointerdown", (e) => { const h = e.target.closest("[data-hold]"); if (!h) return; h.classList.add("is-holding"); holdT = setTimeout(async () => { await endFocus(false); C.toast("Focus ended early. Sites unblocked."); drawCtl(); draw(); }, 2500); });
  const cancel = () => { clearTimeout(holdT); el.querySelectorAll(".is-holding").forEach((x) => x.classList.remove("is-holding")); };
  el.addEventListener("pointerup", cancel); el.addEventListener("pointerleave", cancel, true);
  return () => clearInterval(iv);
}

// a session in progress picks up sites you add or remove
async function syncSites() { const f = await getFocus(); if (f) { f.sites = C.S().focus.sites.slice(); const { set } = await import("../kv.js"); await set(FOCUS, f); } }

// the countdown chip in the top bar
async function drawChip() {
  const chip = $("#focusChip"); F = await getFocus();
  const running = F && Date.now() < F.endsAt;
  chip.hidden = !running;
  if (running) { chip.innerHTML = `${ICON}<b>${fmtLeft(F.endsAt - Date.now())}</b>`; chip.style.setProperty("--k", ((Date.now() - F.startedAt) / (F.endsAt - F.startedAt)).toFixed(3)); }
}

export function initFocus(ctx) {
  C = ctx;
  addPane({ id: "focus", label: "Focus", icon: ICON, title: "Focus mode", sub: "Block distractions and work in sprints", render });
  $("#focusChip").addEventListener("click", () => openHub("focus"));
  drawChip(); setInterval(async () => {
    await drawChip();
    // the web demo has no background worker, so the page ends the session itself
    if (!ext && F && Date.now() >= F.endsAt) { const e = await endFocus(true); if (e) C.toast(`🎉 Focus complete: ${e.minutes} minutes.`); }
  }, 1000);
  watch(FOCUS, drawChip);
}
