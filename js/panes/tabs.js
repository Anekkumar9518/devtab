// Hub pane: Tabs. Everything that's open, which tabs are asleep, duplicates
// to close in one go, and the auto-sleep setting.
import { addPane } from "../hub.js";
import { get, ext } from "../kv.js";

const $ = (s, el = document) => el.querySelector(s);
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/><path d="M15 4h4l-4 4h4"/></svg>';
const MB_PER_TAB = 80; // a typical tab's memory, used for the "about" estimate
let C = null, filter = "";

const norm = (u) => { try { const x = new URL(u); x.hash = ""; return (x.origin + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch (e) { return u; } };
const ago = (ms) => { if (!ms) return ""; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? m + "m ago" : m < 1440 ? Math.round(m / 60) + "h ago" : Math.round(m / 1440) + "d ago"; };

async function render(el) {
  if (!ext || !chrome.tabs) { el.innerHTML = `<div class="ws__empty"><div class="ws__art">${ICON}</div><h4>Tab sleeper lives in the extension</h4><p>Installed, DevTab puts tabs you haven't used for a while to sleep so they give back their memory, and finds duplicate tabs to close in one click.</p></div>`; return; }
  const draw = async () => {
    const S = C.S(), cfg = S.tabs, me = await chrome.tabs.getCurrent();
    const tabs = await chrome.tabs.query({}), stats = await get("devtab:sleeper", { total: 0, today: 0 });
    const asleep = tabs.filter((t) => t.discarded), groups = {};
    for (const t of tabs) if (/^https?:/.test(t.url || "")) (groups[norm(t.url)] = groups[norm(t.url)] || []).push(t);
    const dups = Object.values(groups).filter((g) => g.length > 1), extra = dups.reduce((s, g) => s + g.length - 1, 0);
    const f = filter.toLowerCase(), list = tabs.filter((t) => !f || (t.title || "").toLowerCase().includes(f) || (t.url || "").toLowerCase().includes(f)).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    el.innerHTML = `
      <div class="tb">
        <div class="tb__stats">
          <div><b>${tabs.length}</b><span>tabs open</span></div>
          <div class="is-z"><b>${asleep.length}</b><span>asleep now 💤</span></div>
          <div><b>~${((asleep.length * MB_PER_TAB) / 1024).toFixed(1)} GB</b><span>memory freed (about)</span></div>
          <div><b>${extra}</b><span>duplicate tab${extra === 1 ? "" : "s"}</span></div>
        </div>
        <div class="tb__ctl">
          <div class="tb__auto"><span>Auto-sleep tabs unused for</span><div class="seg">${[[0, "Off"], [15, "15m"], [30, "30m"], [60, "1h"], [120, "2h"]].map(([v, n]) => `<button type="button" data-auto="${v}" aria-pressed="${(cfg.autoSleep || 0) === v}">${n}</button>`).join("")}</div></div>
          <label class="row">Keep pinned tabs awake <input type="checkbox" data-pin ${cfg.keepPinned ? "checked" : ""}></label>
          <div class="tb__btns"><button type="button" class="btn" data-sleepall>💤 Sleep all other tabs</button>${extra ? `<button type="button" class="btn btn--ghost" data-dedupe>Close ${extra} duplicate${extra === 1 ? "" : "s"}</button>` : ""}</div>
          <p class="note">Sleeping tabs stay in your tab bar and reload when you click them. Tabs playing sound are never put to sleep. ${stats.total ? `DevTab has put ${stats.total} tab${stats.total === 1 ? "" : "s"} to sleep so far (${stats.today} today).` : ""}</p>
        </div>
        ${dups.length ? `<h4 class="tb__h">Duplicates</h4><div class="tb__dups">${dups.map((g) => `<div class="tb__dup">${C.favicon(g[0].url) ? `<img src="${C.favicon(g[0].url, 32)}" alt="">` : ""}<span>${C.esc(g[0].title || g[0].url)}</span><em>×${g.length}</em><button type="button" class="ws__a" data-close="${g.slice(1).map((t) => t.id).join(",")}">Close extras</button></div>`).join("")}</div>` : ""}
        <div class="tb__lh"><h4 class="tb__h">All tabs</h4><input class="tb__q" placeholder="Filter tabs…" value="${C.esc(filter)}" data-q></div>
        <div class="tb__list">${list.map((t) => `
          <div class="tb__row${t.discarded ? " is-z" : ""}${t.id === (me && me.id) ? " is-me" : ""}">
            ${C.favicon(t.url || "") ? `<img src="${C.favicon(t.url, 32)}" alt="">` : `<i></i>`}
            <span class="tb__t"><b>${C.esc(t.title || t.url || "New tab")}</b><small>${C.esc(C.host(t.url || ""))}${t.lastAccessed ? " · " + ago(t.lastAccessed) : ""}</small></span>
            ${t.audible ? `<em class="tb__tag">🔊 playing</em>` : t.discarded ? `<em class="tb__tag is-z">💤 asleep</em>` : t.active ? `<em class="tb__tag is-on">active</em>` : ""}
            <span class="tb__acts">${!t.discarded && !t.active && /^https?:/.test(t.url || "") ? `<button type="button" data-sleep="${t.id}" title="Sleep">💤</button>` : ""}<button type="button" data-go="${t.id}" data-win="${t.windowId}" title="Go to tab">↗</button>${t.id === (me && me.id) ? "" : `<button type="button" data-close="${t.id}" title="Close">×</button>`}</span>
          </div>`).join("")}</div>
      </div>`;
  };
  await draw();
  el.addEventListener("click", async (e) => {
    const S = C.S(), t = e.target;
    const a = t.closest("[data-auto]"); if (a) { S.tabs.autoSleep = +a.dataset.auto; await C.persist(); C.toast(+a.dataset.auto ? `Tabs unused for ${a.textContent} will sleep.` : "Auto-sleep is off."); return draw(); }
    if (t.closest("[data-sleepall]")) { const r = await chrome.runtime.sendMessage({ type: "sleep" }); C.toast(`Put ${r.count} tab${r.count === 1 ? "" : "s"} to sleep.`); return draw(); }
    const sl = t.closest("[data-sleep]"); if (sl) { await chrome.runtime.sendMessage({ type: "sleep", ids: [+sl.dataset.sleep] }); return draw(); }
    const g = t.closest("[data-go]"); if (g) { await chrome.tabs.update(+g.dataset.go, { active: true }); await chrome.windows.update(+g.dataset.win, { focused: true }); return; }
    const cl = t.closest("[data-close]"); if (cl) { const ids = cl.dataset.close.split(",").map(Number); await chrome.tabs.remove(ids); C.toast(`Closed ${ids.length} tab${ids.length === 1 ? "" : "s"}.`); return draw(); }
    if (t.closest("[data-dedupe]")) {
      const tabs = await chrome.tabs.query({}), groups = {}, ids = [];
      for (const x of tabs) if (/^https?:/.test(x.url || "")) (groups[norm(x.url)] = groups[norm(x.url)] || []).push(x);
      // keep the active or most recently used copy of each
      for (const gr of Object.values(groups)) if (gr.length > 1) { gr.sort((p, q) => (q.active - p.active) || (q.lastAccessed || 0) - (p.lastAccessed || 0)); ids.push(...gr.slice(1).map((x) => x.id)); }
      if (ids.length) await chrome.tabs.remove(ids); C.toast(`Closed ${ids.length} duplicate tab${ids.length === 1 ? "" : "s"}.`); return draw();
    }
  });
  el.addEventListener("change", async (e) => { if (e.target.matches("[data-pin]")) { C.S().tabs.keepPinned = e.target.checked; await C.persist(); } });
  el.addEventListener("input", (e) => { if (e.target.matches("[data-q]")) { filter = e.target.value; clearTimeout(el._t); el._t = setTimeout(async () => { await draw(); const q = $("[data-q]", el); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 200); } });
}

export function initTabs(ctx) {
  C = ctx;
  addPane({ id: "tabs", label: "Tabs", icon: ICON, title: "Tab sleeper", sub: "Free up memory and clear out duplicates", render: (el) => { render(el); } });
}
