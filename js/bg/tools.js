// Runs a page tool in the current tab. It uses activeTab, so DevTab only gets
// into a page when you click its toolbar button or press a tool's shortcut.
const FILES = { color: "js/inject/color.js", images: "js/inject/images.js", fonts: "js/inject/fonts.js", media: "js/inject/media.js", stack: "js/inject/stack.js" };
const START = { color: "__devtabColor", images: "__devtabImages", fonts: "__devtabFonts", media: "__devtabMedia", stack: "__devtabStack" };

export async function runTool(tool, tab) {
  if (!tab || !/^(https?|file):/i.test(tab.url || "") || /^https:\/\/(chrome|chromewebstore)\.google\.com\/webstore|microsoftedge\.microsoft\.com\/addons/i.test(tab.url || "")) {
    return { ok: false, error: "Browsers don't let extensions run tools on this page. Open a normal website and try again." };
  }
  try {
    let shot = null;
    // close any tool already open, so it isn't in the colour picker's screenshot
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => new Promise((r) => { if (window.__devtabUI) window.__devtabUI.close(); requestAnimationFrame(() => requestAnimationFrame(r)); }) });
    if (tool === "color") shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    if (tool === "stack") {
      // the detector runs in the page's own world so it can see the page's JavaScript
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", files: ["js/inject/stack-detect.js"] });
      shot = result;
    }
    if (tool === "shot") return await fullPage(tab);
    if (tool === "time") { await chrome.tabs.create({ url: chrome.runtime.getURL("time.html?u=" + encodeURIComponent(tab.url)), index: tab.index + 1 }); return { ok: true }; }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["js/inject/ui.js", FILES[tool]] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (fn, arg) => window[fn](arg), args: [START[tool], shot] });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "That page didn't let DevTab in. Reload it and try again." };
  }
}

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  const tool = { "pick-color": "color", "image-size": "images", "font-finder": "fonts", "media-downloader": "media" }[cmd];
  if (!tool) return;
  tab = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  const r = await runTool(tool, tab);
  if (!r.ok) chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title: "DevTab tools", message: r.error });
});
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m || m.type !== "tool") return;
  chrome.tabs.get(m.tabId).then((tab) => runTool(m.tool, tab)).then(reply, () => reply({ ok: false, error: "Couldn't find that tab." }));
  return true;
});

// Saves files the media downloader picked, into Downloads/<site>/.
const clean = (s) => String(s || "").split(String.fromCharCode(92)).join("_").replace(/[\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/^\.+/, "").slice(0, 80) || "file";
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m || m.type !== "download" || !Array.isArray(m.items)) return;
  (async () => {
    const folder = clean(m.host);
    let ok = 0;
    for (const it of m.items.slice(0, 500)) {
      if (!/^(https?:|data:image\/)/i.test(it.url || "")) continue;
      try { await chrome.downloads.download({ url: it.url, filename: `${folder}/${clean(it.filename)}`, conflictAction: "uniquify", saveAs: false }); ok++; }
      catch (e) { /* one bad URL shouldn't stop the rest */ }
    }
    reply(ok ? { ok: true, count: ok } : { ok: false, error: "The site didn't allow those files to be saved." });
  })();
  return true;
});

/* ---------- full-page screenshot ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastShot = null;
async function fullPage(tab) {
  const exec = (func, args = []) => chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args }).then((r) => r[0].result);
  const info = await exec(() => {
    if (window.__devtabUI) window.__devtabUI.close();
    const se = document.scrollingElement || document.documentElement;
    return { H: Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0), vh: innerHeight, vw: innerWidth, dpr: devicePixelRatio, x: scrollX, y: scrollY };
  });
  const maxH = Math.min(info.H, Math.floor(30000 / info.dpr)); // stay inside the browser's canvas limits
  const parts = [];
  let y = 0;
  for (let i = 0; i < 80; i++) {
    const at = await exec((y, i) => {
      if (i === 1) { // after the first screen, hide headers and bars that stick, so they don't repeat down the page
        window.__devtabFixed = [];
        for (const el of document.querySelectorAll("body *")) { const p = getComputedStyle(el).position; if (p === "fixed" || p === "sticky") { window.__devtabFixed.push([el, el.style.getPropertyValue("visibility"), el.style.getPropertyPriority("visibility")]); el.style.setProperty("visibility", "hidden", "important"); } }
      }
      window.scrollTo(0, y);
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(scrollY)))));
    }, [y, i]);
    await sleep(i ? 600 : 200); // the browser allows two captures a second; this also lets lazy images load
    parts.push({ y: at, url: await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }) });
    if (at + info.vh >= maxH) break;
    const next = at + info.vh;
    if (i > 0 && at === parts[parts.length - 2].y) break; // it won't scroll any further
    y = next;
  }
  await exec((x, y) => { (window.__devtabFixed || []).forEach(([el, v, p]) => (v ? el.style.setProperty("visibility", v, p) : el.style.removeProperty("visibility"))); window.__devtabFixed = null; window.scrollTo(x, y); }, [info.x, info.y]);
  const last = parts[parts.length - 1];
  lastShot = { parts, vw: info.vw, vh: info.vh, H: Math.min(maxH, last.y + info.vh), title: tab.title || "", url: tab.url, at: Date.now() };
  await chrome.tabs.create({ url: chrome.runtime.getURL("shot.html"), index: tab.index + 1 });
  return { ok: true };
}
chrome.runtime.onMessage.addListener((m, sender, reply) => { if (m && m.type === "shot-data") { reply(lastShot); return false; } });
