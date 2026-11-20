// The features that run on every website (the pet out on the web, and Air
// control). They need access to all sites, which Chrome asks you for when you
// switch one on. Their scripts are registered only while they're on.
const SETTINGS = "devtab:settings";
const ALL = ["https://*/*", "http://*/*"];
const SCRIPTS = {
  pet: { id: "devtab-pet", js: ["js/petdraw.js", "js/inject/pet-anywhere.js"], key: "petEverywhere" },
  air: { id: "devtab-air", js: ["js/inject/air.js"], key: "air" },
};

export async function syncEverywhere() {
  const fx = (((await chrome.storage.local.get(SETTINGS))[SETTINGS] || {}).fx) || {};
  const allowed = await chrome.permissions.contains({ origins: ALL });
  const have = new Set((await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id));
  for (const s of Object.values(SCRIPTS)) {
    const want = allowed && !!fx[s.key];
    if (want && !have.has(s.id)) {
      await chrome.scripting.registerContentScripts([{ id: s.id, js: s.js, matches: ALL, runAt: "document_idle", allFrames: false, persistAcrossSessions: true }]).catch(() => {});
      // and start it on the tabs that are already open
      for (const t of await chrome.tabs.query({ url: ALL })) chrome.scripting.executeScript({ target: { tabId: t.id }, files: s.js }).catch(() => {});
    } else if (!want && have.has(s.id)) await chrome.scripting.unregisterContentScripts({ ids: [s.id] }).catch(() => {});
  }
}
chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[SETTINGS]) { const o = (ch[SETTINGS].oldValue || {}).fx || {}, n = (ch[SETTINGS].newValue || {}).fx || {}; if (o.petEverywhere !== n.petEverywhere || o.air !== n.air) syncEverywhere(); } });
chrome.permissions.onAdded.addListener(syncEverywhere);
chrome.permissions.onRemoved.addListener(syncEverywhere);
chrome.runtime.onInstalled.addListener(syncEverywhere);
