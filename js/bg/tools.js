// Runs a page tool in the current tab. It uses activeTab, so DevTab only gets
// into a page when you click its toolbar button or press a tool's shortcut.
const FILES = { color: "js/inject/color.js", images: "js/inject/images.js", fonts: "js/inject/fonts.js", media: "js/inject/media.js" };
const START = { color: "__devtabColor", images: "__devtabImages", fonts: "__devtabFonts", media: "__devtabMedia" };

export async function runTool(tool, tab) {
  if (!tab || !/^(https?|file):/i.test(tab.url || "") || /^https:\/\/(chrome|chromewebstore)\.google\.com\/webstore|microsoftedge\.microsoft\.com\/addons/i.test(tab.url || "")) {
    return { ok: false, error: "Browsers don't let extensions run tools on this page. Open a normal website and try again." };
  }
  try {
    let shot = null;
    // close any tool already open, so it isn't in the colour picker's screenshot
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => new Promise((r) => { if (window.__devtabUI) window.__devtabUI.close(); requestAnimationFrame(() => requestAnimationFrame(r)); }) });
    if (tool === "color") shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
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
