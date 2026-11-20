// Runs a page tool in the current tab. It uses activeTab, so DevTab only gets
// into a page when you click its toolbar button or press a tool's shortcut.
const FILES = { color: "js/inject/color.js", images: "js/inject/images.js", fonts: "js/inject/fonts.js" };
const START = { color: "__devtabColor", images: "__devtabImages", fonts: "__devtabFonts" };

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
  const tool = { "pick-color": "color", "image-size": "images", "font-finder": "fonts" }[cmd];
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
