// Tab sleeper: tabs you haven't looked at for a while are put to sleep
// (chrome.tabs.discard): they stay in the tab strip but give back their
// memory, and reload when you click them. Tabs playing sound, pinned tabs
// (if you like) and the active tab are never touched.
const SETTINGS = "devtab:settings", STATS = "devtab:sleeper";

export async function sleepTab(id) {
  try { await chrome.tabs.discard(id); } catch (e) { return false; }
  const s = (await chrome.storage.local.get(STATS))[STATS] || { total: 0, day: "", today: 0 };
  const d = new Date().toDateString();
  if (s.day !== d) { s.day = d; s.today = 0; }
  s.total++; s.today++;
  await chrome.storage.local.set({ [STATS]: s });
  return true;
}
const canSleep = (t, cfg) => !t.active && !t.discarded && !t.audible && /^https?:/.test(t.url || "") && !(cfg.keepPinned && t.pinned) && t.status === "complete";

chrome.alarms.create("sleeper:tick", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== "sleeper:tick") return;
  const cfg = (((await chrome.storage.local.get(SETTINGS))[SETTINGS] || {}).tabs) || {};
  if (!cfg.autoSleep) return;
  const cutoff = Date.now() - cfg.autoSleep * 60000;
  for (const t of await chrome.tabs.query({})) if (canSleep(t, cfg) && t.lastAccessed && t.lastAccessed < cutoff) await sleepTab(t.id);
});
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m || m.type !== "sleep") return;
  (async () => {
    const cfg = (((await chrome.storage.local.get(SETTINGS))[SETTINGS] || {}).tabs) || {};
    const ids = m.ids || (await chrome.tabs.query({})).filter((t) => canSleep(t, cfg) && t.id !== (sender.tab && sender.tab.id)).map((t) => t.id);
    let n = 0; for (const id of ids) if (await sleepTab(id)) n++;
    reply({ ok: true, count: n });
  })();
  return true;
});
