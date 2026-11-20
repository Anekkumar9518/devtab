// Hub pane: Workspaces. Save every tab in this window under a name, then
// reopen the whole set later in one click.
import { addPane } from "../hub.js";
import { get, set, ext } from "../kv.js";

const KEY = "devtab:workspaces";
const $ = (s, el = document) => el.querySelector(s);
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 4v5M2 21h20"/></svg>';
const openable = (u) => /^(https?|file|ftp):/i.test(u || "");
let C = null;

async function currentTabs() {
  if (!(ext && chrome.tabs)) return [];
  return (await chrome.tabs.query({ currentWindow: true })).filter((t) => openable(t.url)).map((t) => ({ u: t.url, t: t.title || t.url, p: !!t.pinned }));
}
const ago = (ms) => {
  const d = Math.round((Date.now() - ms) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? d + " days ago" : new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
const icons = (tabs, n = 9) => tabs.slice(0, n).map((x) => C.favicon(x.u) ? `<img src="${C.favicon(x.u, 32)}" alt="" title="${C.esc(x.t)}">` : `<i title="${C.esc(x.t)}">${C.esc((C.host(x.u)[0] || "?").toUpperCase())}</i>`).join("") + (tabs.length > n ? `<em>+${tabs.length - n}</em>` : "");

async function render(el) {
  if (!ext) {
    el.innerHTML = `<div class="ws__empty"><div class="ws__art">${ICON}</div><h4>Workspaces live in the extension</h4><p>Install DevTab, then save all the tabs of a window (say "Client work" or "Learning") and bring the whole set back in one click.</p></div>`;
    return;
  }
  const draw = async () => {
    const list = await get(KEY, []), now = await currentTabs();
    el.innerHTML = `
      <form class="ws__save" data-save>
        <div class="ws__now"><span class="ws__icons">${icons(now, 12)}</span><span><b>${now.length}</b> tab${now.length === 1 ? "" : "s"} in this window</span></div>
        <div class="ws__row"><input name="n" maxlength="40" placeholder="Name it, e.g. Client work" autocomplete="off" required><button class="btn btn--sm" ${now.length ? "" : "disabled"}>Save workspace</button></div>
      </form>
      <div class="ws__list">${list.map((w, i) => `
        <article class="ws__card" data-i="${i}">
          <div class="ws__head"><b class="ws__name">${C.esc(w.name)}</b><small>${w.tabs.length} tabs · saved ${ago(w.at)}</small></div>
          <div class="ws__icons">${icons(w.tabs)}</div>
          <div class="ws__acts">
            <button type="button" class="btn btn--sm" data-open="${i}">Open in new window</button>
            <button type="button" class="ws__a" data-here="${i}">Add here</button>
            <button type="button" class="ws__a" data-update="${i}" title="Replace with the tabs open now">Update</button>
            <button type="button" class="ws__a" data-rename="${i}">Rename</button>
            <button type="button" class="ws__a ws__a--x" data-del="${i}">Delete</button>
          </div>
        </article>`).join("") || `<div class="ws__empty"><div class="ws__art">${ICON}</div><h4>No workspaces yet</h4><p>Open the tabs for a project, name them above and save. Next time, one click brings them all back.</p></div>`}</div>`;
  };
  await draw();
  el.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = e.target.n.value.trim(), tabs = await currentTabs();
    if (!name || !tabs.length) return;
    const list = await get(KEY, []);
    list.unshift({ id: Date.now().toString(36), name, tabs, at: Date.now() });
    await set(KEY, list); C.toast(`Saved "${name}" with ${tabs.length} tabs.`); draw();
  });
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-open], button[data-here], button[data-update], button[data-rename], button[data-del]"); if (!b) return;
    const list = await get(KEY, []), i = +Object.values(b.dataset)[0], w = list[i]; if (!w) return;
    if ("open" in b.dataset) {
      const win = await chrome.windows.create({ url: w.tabs.map((x) => x.u), focused: true });
      w.tabs.forEach((x, k) => { if (x.p && win.tabs[k]) chrome.tabs.update(win.tabs[k].id, { pinned: true }); });
    } else if ("here" in b.dataset) {
      for (const x of w.tabs) await chrome.tabs.create({ url: x.u, active: false, pinned: x.p });
      C.toast(`Opened ${w.tabs.length} tabs from "${w.name}".`);
    } else if ("update" in b.dataset) {
      w.tabs = await currentTabs(); w.at = Date.now(); await set(KEY, list); C.toast(`"${w.name}" now has ${w.tabs.length} tabs.`); draw();
    } else if ("rename" in b.dataset) {
      const card = b.closest(".ws__card"), nm = $(".ws__name", card);
      nm.innerHTML = `<input class="ws__ren" maxlength="40" value="${C.esc(w.name)}">`;
      const inp = $("input", nm); inp.focus(); inp.select();
      const done = async (ok) => { if (ok && inp.value.trim()) { w.name = inp.value.trim(); await set(KEY, list); } draw(); };
      inp.addEventListener("keydown", (k) => { if (k.key === "Enter") done(true); if (k.key === "Escape") done(false); });
      inp.addEventListener("blur", () => done(true));
    } else if ("del" in b.dataset) {
      list.splice(i, 1); await set(KEY, list); draw();
      C.toast(`Deleted "${w.name}".`, { undo: async () => { const l = await get(KEY, []); l.splice(i, 0, w); await set(KEY, l); draw(); } });
    }
  });
}

export function initWorkspaces(ctx) {
  C = ctx;
  addPane({ id: "workspaces", label: "Workspaces", icon: ICON, title: "Workspaces", sub: "Save a window of tabs, reopen it in one click", render: (el) => { render(el); } });
}
