// Two opt-in features that watch your tabs, and keep everything in this
// browser (chrome.storage.local): nothing is ever sent anywhere.
//  · Wrapped: time spent per site, tabs opened, busiest hours.
//  · "What was I doing?": a snapshot of your open tabs, offered back after a restart.
export const STATS = "devtab:stats";
export const SNAP = "devtab:snap";
export const LAST = "devtab:lastSession";
const SETTINGS = "devtab:settings";
const MAX_CHUNK = 5 * 60 * 1000; // never credit more than 5 minutes at once (sleep, crashes)

const fx = async () => ((await chrome.storage.local.get(SETTINGS))[SETTINGS] || {}).fx || {};
const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hostOf = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.hostname.replace(/^www\./, "") : null; } catch (e) { return null; } };

let q = Promise.resolve(); // keep writes in order
const serial = (fn) => (q = q.then(fn, fn));

async function credit(host, since, now) {
  if (!host || !since) return;
  const ms = Math.min(MAX_CHUNK, now - since); if (ms < 1000) return;
  const all = (await chrome.storage.local.get(STATS))[STATS] || { days: {} };
  const k = dayKey(since), d = (all.days[k] = all.days[k] || { tabs: 0, sites: {}, hours: Array(24).fill(0) });
  d.sites[host] = (d.sites[host] || 0) + Math.round(ms / 1000);
  d.hours[new Date(since).getHours()] += Math.round(ms / 1000);
  const keys = Object.keys(all.days).sort(); while (keys.length > 62) delete all.days[keys.shift()];
  await chrome.storage.local.set({ [STATS]: all });
}

// Close the current stretch and start a new one on `tab` (or nothing).
const switchTo = (tab) => serial(async () => {
  const now = Date.now();
  const { cur } = await chrome.storage.session.get("cur");
  if ((await fx()).wrapped && cur) await credit(cur.host, cur.since, now);
  await chrome.storage.session.set({ cur: tab ? { host: hostOf(tab.url), since: now } : null });
});
const activeTab = async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return t || null; };

chrome.tabs.onActivated.addListener(async ({ tabId }) => { try { switchTo(await chrome.tabs.get(tabId)); } catch (e) {} snapshot(); });
chrome.tabs.onUpdated.addListener((id, ch, tab) => { if (tab.active && (ch.url || ch.status === "complete")) switchTo(tab); if (ch.url || ch.title) snapshot(); });
chrome.tabs.onRemoved.addListener(() => snapshot());
chrome.windows.onFocusChanged.addListener(async (w) => { if (w === chrome.windows.WINDOW_ID_NONE) switchTo(null); else switchTo(await activeTab()); });
chrome.idle.setDetectionInterval(120);
chrome.idle.onStateChanged.addListener(async (s) => { if (s === "active") switchTo(await activeTab()); else switchTo(null); });
chrome.tabs.onCreated.addListener(() => serial(async () => {
  if (!(await fx()).wrapped) return;
  const all = (await chrome.storage.local.get(STATS))[STATS] || { days: {} };
  const k = dayKey(Date.now()), d = (all.days[k] = all.days[k] || { tabs: 0, sites: {}, hours: Array(24).fill(0) });
  d.tabs++; await chrome.storage.local.set({ [STATS]: all });
}));
// credit time every minute so a sleeping worker never loses much
chrome.alarms.create("track:flush", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (a) => { if (a.name === "track:flush") switchTo(await activeTab()); });

/* ---------- "What was I doing?" ---------- */
let snapT = 0;
function snapshot() {
  clearTimeout(snapT);
  snapT = setTimeout(async () => {
    if (!(await fx()).recall) return;
    const tabs = (await chrome.tabs.query({})).filter((t) => hostOf(t.url)).map((t) => ({ u: t.url, t: t.title || t.url, a: !!t.active }));
    if (tabs.length) await chrome.storage.local.set({ [SNAP]: { at: Date.now(), tabs } });
  }, 2500);
}
chrome.runtime.onStartup.addListener(async () => {
  if (!(await fx()).recall) return;
  const snap = (await chrome.storage.local.get(SNAP))[SNAP];
  if (!snap || !snap.tabs || !snap.tabs.length) return;
  const tasks = (await chrome.storage.local.get("devtab:tasks"))["devtab:tasks"] || [];
  const started = tasks.filter((t) => t.status === "started").sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0];
  const active = snap.tabs.find((t) => t.a) || snap.tabs[snap.tabs.length - 1];
  await chrome.storage.local.set({ [LAST]: { at: snap.at, tabs: snap.tabs, task: started ? started.text : null, title: active ? active.t : null, dismissed: false } });
});
