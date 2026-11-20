// Air control in the background: passes each frame of hand/face data to the
// tab you're looking at, keeps small thumbnails of your tabs for the 3D
// carousel, and does what a page can't do itself (switch, open, close or mute
// tabs, minimize, screenshots, start Focus or sounds, open a site).
import { startFocus, getFocus, endFocus } from "../focus-core.js";
import { runTool } from "./tools.js";

const SETTINGS = "devtab:settings";
let active = { id: null, url: "" };
const camOn = async () => { const fx = (((await chrome.storage.local.get(SETTINGS))[SETTINGS] || {}).fx) || {}; return !!(fx.air || fx.faceCtl || fx.shield || fx.away); };

async function refreshActive() {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  active = t ? { id: t.id, url: t.url || "" } : { id: null, url: "" };
  if (t) setTimeout(() => thumb(t.id), 700);
}
chrome.tabs.onActivated.addListener(refreshActive);
chrome.windows.onFocusChanged.addListener(refreshActive);
chrome.tabs.onUpdated.addListener((id, ch, tab) => { if (id === active.id && ch.url) active.url = ch.url; if (tab.active && ch.status === "complete") setTimeout(() => thumb(id), 900); });
chrome.tabs.onRemoved.addListener(async (id) => { const { thumbs = {} } = await chrome.storage.session.get("thumbs"); if (thumbs[id]) { delete thumbs[id]; chrome.storage.session.set({ thumbs }); } });

// a small picture of the tab you're on, for the carousel (only while the camera features are on)
let lastThumb = 0;
async function thumb(tabId) {
  if (Date.now() - lastThumb < 600 || !(await camOn())) return;
  try {
    const t = await chrome.tabs.get(tabId); if (!t.active || !/^https?:/.test(t.url || "")) return;
    lastThumb = Date.now();
    const url = await chrome.tabs.captureVisibleTab(t.windowId, { format: "jpeg", quality: 55 });
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const w = 360, h = Math.round((bmp.height / bmp.width) * w), c = new OffscreenCanvas(w, h);
    c.getContext("2d").drawImage(bmp, 0, 0, w, h);
    const b = await c.convertToBlob({ type: "image/jpeg", quality: 0.7 }), buf = new Uint8Array(await b.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    const { thumbs = {} } = await chrome.storage.session.get("thumbs");
    thumbs[tabId] = "data:image/jpeg;base64," + btoa(bin);
    const keys = Object.keys(thumbs); while (keys.length > 40) delete thumbs[keys.shift()];
    await chrome.storage.session.set({ thumbs });
  } catch (e) { /* not capturable (another window on top, a protected page…) */ }
}

const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m) return;
  if (m.type === "air") {
    // DevTab's own pages hear the offscreen page directly; web pages get it forwarded
    if (active.id === null) refreshActive();
    else if (/^https?:/.test(active.url)) chrome.tabs.sendMessage(active.id, m).catch(() => {});
    return;
  }
  if (m.type === "air-tabs") {
    (async () => {
      const win = sender.tab ? sender.tab.windowId : undefined;
      const tabs = await chrome.tabs.query(win !== undefined ? { windowId: win } : { currentWindow: true });
      const { thumbs = {} } = await chrome.storage.session.get("thumbs");
      reply(tabs.map((t) => ({ id: t.id, title: t.title || t.url, url: t.url || "", fav: t.favIconUrl && /^https?:|^data:/.test(t.favIconUrl) ? t.favIconUrl : "", thumb: thumbs[t.id] || "", active: t.active })));
    })();
    return true;
  }
  if (m.type === "air-act" && sender.tab) {
    const t = sender.tab;
    (async () => {
      const a = m.act;
      if (a === "next" || a === "prev") {
        const tabs = await chrome.tabs.query({ windowId: t.windowId }), i = tabs.findIndex((x) => x.id === t.id);
        const n = tabs[(i + (a === "next" ? 1 : -1) + tabs.length) % tabs.length]; if (n) await chrome.tabs.update(n.id, { active: true });
      } else if (a === "goto") { await chrome.tabs.update(m.id, { active: true }); }
      else if (a === "minimize") await chrome.windows.update(t.windowId, { state: "minimized" });
      else if (a === "newtab") await chrome.tabs.create({ windowId: t.windowId, index: t.index + 1 });
      else if (a === "close") await chrome.tabs.remove(t.id);
      else if (a === "closetab" && m.id) await chrome.tabs.remove(m.id);
      else if (a === "mute") await chrome.tabs.update(t.id, { muted: !(t.mutedInfo && t.mutedInfo.muted) });
      else if (a === "openurl" && /^https?:\/\//i.test(m.url || "")) await chrome.tabs.create({ url: m.url, index: t.index + 1 });
      else if (a === "hub") await chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html#hub"), index: t.index + 1 });
      else if (a === "focus") { const f = await getFocus(); if (f && Date.now() < f.endsAt) await endFocus(false); else { const s = (await chrome.storage.local.get(SETTINGS))[SETTINGS] || {}; await startFocus((s.focus && s.focus.minutes) || 25, (s.focus && s.focus.sites) || []); } }
      else if (a === "sounds") { const k = "devtab:ambient", amb = (await chrome.storage.local.get(k))[k] || { on: false, levels: {} }; if (!Object.values(amb.levels || {}).some((v) => v > 0)) amb.levels = { rain: 0.55, keys: 0.35 }; amb.on = !amb.on; await chrome.storage.local.set({ [k]: amb }); }
      else if (a === "capture") {
        // a screenshot of what you see (drawings included), saved to Downloads
        const url = await chrome.tabs.captureVisibleTab(t.windowId, { format: "png" });
        const host = (() => { try { return new URL(t.url).hostname.replace(/^www\./, ""); } catch (e) { return "page"; } })();
        await chrome.downloads.download({ url, filename: `DevTab/${m.name || "screenshot"}-${host}-${stamp()}.png`, saveAs: false });
      } else if (a === "fullshot") await runTool("shot", t);
      else if (a === "off") { const s = (await chrome.storage.local.get(SETTINGS))[SETTINGS] || {}; s.fx = { ...(s.fx || {}), air: false }; await chrome.storage.local.set({ [SETTINGS]: s }); }
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
