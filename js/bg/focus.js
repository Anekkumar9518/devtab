// Focus mode in the background: the countdown badge on the toolbar icon, the
// end-of-session alarm and notification, and sending blocked sites to the
// "Access denied" page while a session runs.
import { FOCUS, getFocus, endFocus, matches } from "../focus-core.js";

const blockedPage = (url) => chrome.runtime.getURL("blocked.html?u=" + encodeURIComponent(url));

async function badge() {
  const f = await getFocus();
  if (!f) { chrome.action.setBadgeText({ text: "" }); return; }
  const left = Math.max(0, Math.ceil((f.endsAt - Date.now()) / 60000));
  chrome.action.setBadgeBackgroundColor({ color: "#7c5cff" });
  chrome.action.setBadgeText({ text: left + "m" });
}
async function schedule() {
  const f = await getFocus();
  await chrome.alarms.clear("focus:end"); await chrome.alarms.clear("focus:tick");
  if (f) {
    chrome.alarms.create("focus:end", { when: Math.max(f.endsAt, Date.now() + 1000) });
    chrome.alarms.create("focus:tick", { periodInMinutes: 0.5 });
  }
  badge();
}
// Close the door on anything already open when a session starts.
async function sweep() {
  const f = await getFocus(); if (!f) return;
  for (const t of await chrome.tabs.query({})) if (t.url && matches(t.url, f.sites)) chrome.tabs.update(t.id, { url: blockedPage(t.url) }).catch(() => {});
}
async function finish() {
  const e = await endFocus(true);
  if (e) chrome.notifications.create("focus:done", {
    type: "basic", iconUrl: "icons/icon128.png", priority: 2,
    title: "🎉 Focus session complete", message: `${e.minutes} minutes of deep work. Take a short break; your sites are unblocked.`,
  });
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local" || !ch[FOCUS]) return;
  schedule();
  if (ch[FOCUS].newValue && !ch[FOCUS].oldValue) sweep();
  if (ch[FOCUS].newValue && ch[FOCUS].oldValue && ch[FOCUS].newValue.sites.join() !== ch[FOCUS].oldValue.sites.join()) sweep();
});
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === "focus:end") finish();
  else if (a.name === "focus:tick") { const f = await getFocus(); if (f && Date.now() >= f.endsAt) finish(); else badge(); }
});
chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0 || !/^https?:/.test(d.url)) return;
  const f = await getFocus();
  if (f && Date.now() < f.endsAt && matches(d.url, f.sites)) chrome.tabs.update(d.tabId, { url: blockedPage(d.url) }).catch(() => {});
});
chrome.runtime.onStartup.addListener(async () => { const f = await getFocus(); if (f && Date.now() >= f.endsAt) finish(); else schedule(); });
chrome.runtime.onInstalled.addListener(schedule);
