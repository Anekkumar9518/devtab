// Air control in the background: passes each frame of hand/face data from the
// offscreen page to the tab you're looking at, and does the things a page
// can't do itself (switch tabs, open or close a tab, minimize the window).
const SETTINGS = "devtab:settings";
let active = { id: null, url: "" };

async function refreshActive() {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  active = t ? { id: t.id, url: t.url || "" } : { id: null, url: "" };
}
chrome.tabs.onActivated.addListener(refreshActive);
chrome.windows.onFocusChanged.addListener(refreshActive);
chrome.tabs.onUpdated.addListener((id, ch) => { if (id === active.id && ch.url) active.url = ch.url; });

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m) return;
  if (m.type === "air") {
    // DevTab's own pages hear the offscreen page directly; web pages get it forwarded
    if (active.id === null) refreshActive();
    else if (/^https?:/.test(active.url)) chrome.tabs.sendMessage(active.id, m).catch(() => {});
    return;
  }
  if (m.type === "air-act" && sender.tab) {
    const t = sender.tab;
    (async () => {
      if (m.act === "next" || m.act === "prev") {
        const tabs = await chrome.tabs.query({ windowId: t.windowId }), i = tabs.findIndex((x) => x.id === t.id);
        const n = tabs[(i + (m.act === "next" ? 1 : -1) + tabs.length) % tabs.length];
        if (n) await chrome.tabs.update(n.id, { active: true });
      } else if (m.act === "minimize") await chrome.windows.update(t.windowId, { state: "minimized" });
      else if (m.act === "newtab") await chrome.tabs.create({ windowId: t.windowId, index: t.index + 1 });
      else if (m.act === "close") await chrome.tabs.remove(t.id);
      else if (m.act === "off") { const s = (await chrome.storage.local.get(SETTINGS))[SETTINGS] || {}; s.fx = { ...(s.fx || {}), air: false }; await chrome.storage.local.set({ [SETTINGS]: s }); }
      reply({ ok: true });
    })().catch(() => reply({ ok: false }));
    return true;
  }
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "toggle-air") return;
  const s = (await chrome.storage.local.get(SETTINGS))[SETTINGS] || {};
  s.fx = { ...(s.fx || {}), air: !(s.fx || {}).air };
  await chrome.storage.local.set({ [SETTINGS]: s });
});
refreshActive();
