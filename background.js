// DevTab background worker: turns tasks with a time into chrome.alarms and, when
// one is due, rings, opens an alert window on top of everything and shows a
// notification. It runs whether or not a DevTab tab is open.
import { getTasks, setTasks, act, TASKS } from "./js/tasks.js";
import { setRinging } from "./js/bg/audio.js";
import "./js/bg/focus.js";
import "./js/bg/track.js";
import "./js/bg/tools.js";

const PREFIX = "task:";
const W = 440, H = 600;

/* ---------- alarms follow the task list ---------- */
async function syncAlarms() {
  const tasks = await getTasks();
  const want = new Map(tasks.filter((t) => t.at && t.status === "open").map((t) => [PREFIX + t.id, t.at]));
  const have = await chrome.alarms.getAll();
  for (const a of have) {
    if (!a.name.startsWith(PREFIX)) continue;
    const at = want.get(a.name);
    if (at === undefined || Math.abs(Math.max(at, Date.now()) - a.scheduledTime) > 1500) await chrome.alarms.clear(a.name);
    else want.delete(a.name); // already scheduled correctly
  }
  // chrome.alarms needs a time in the future, so anything overdue fires in a second
  for (const [name, at] of want) chrome.alarms.create(name, { when: Math.max(at, Date.now() + 1000) });
}

/* ---------- ringtone: played by the shared audio page (js/bg/audio.js) ---------- */
const ring = (on) => setRinging(on);

/* ---------- which alert window belongs to which task ---------- */
const getWins = async () => (await chrome.storage.session.get("wins")).wins || {};
const setWins = (wins) => chrome.storage.session.set({ wins });

async function openWindow(t) {
  const wins = await getWins();
  if (wins[t.id]) { try { await chrome.windows.update(wins[t.id], { focused: true, drawAttention: true }); return; } catch (e) { /* it was closed */ } }
  const opts = { url: chrome.runtime.getURL("alert.html?id=" + encodeURIComponent(t.id)), type: "popup", width: W, height: H, focused: true };
  try {
    // centre it over the window you're using, when Chrome reports a usable size
    const last = await chrome.windows.getLastFocused();
    const ok = (n) => Number.isFinite(n);
    if (last && ok(last.left) && ok(last.top) && ok(last.width) && ok(last.height) && last.state !== "minimized") {
      opts.left = Math.max(0, Math.round(last.left + (last.width - W) / 2));
      opts.top = Math.max(0, Math.round(last.top + Math.max(0, last.height - H) / 2));
    }
  } catch (e) { /* no window yet: let Chrome place it */ }
  let win;
  try { win = await chrome.windows.create(opts); }
  catch (e) { delete opts.left; delete opts.top; win = await chrome.windows.create(opts); } // position rejected: let Chrome place it
  wins[t.id] = win.id; await setWins(wins);
}

/* ---------- a task is due ---------- */
async function fire(id) {
  const tasks = await getTasks();
  const t = tasks.find((x) => x.id === id);
  if (!t || !(t.status === "open" || t.status === "ringing")) return;
  t.status = "ringing"; t.rangAt = Date.now();
  await setTasks(tasks);
  await ring(true);
  await openWindow(t);
  chrome.notifications.create(PREFIX + id, {
    type: "basic", iconUrl: "icons/icon128.png", priority: 2, requireInteraction: true,
    title: "⏰ " + t.text, message: "It's time. Start it now, mark it complete, or snooze it.",
    buttons: [{ title: "▶ Start now" }, { title: "✓ Complete" }],
  });
}

/* ---------- after start / complete / snooze ---------- */
async function settle(id) {
  chrome.notifications.clear(PREFIX + id);
  const wins = await getWins(), wid = wins[id];
  delete wins[id]; await setWins(wins);
  if (wid) chrome.windows.remove(wid).catch(() => {});
  if (!(await getTasks()).some((t) => t.status === "ringing")) await ring(false);
}
async function handle(id, action, minutes) {
  await act(id, action, minutes);
  await settle(id);
  await syncAlarms();
}

/* ---------- events ---------- */
chrome.alarms.onAlarm.addListener((a) => { if (a.name.startsWith(PREFIX)) fire(a.name.slice(PREFIX.length)); });

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === "task") { handle(msg.id, msg.action, msg.minutes).then(() => reply({ ok: true })); return true; }
});

chrome.notifications.onButtonClicked.addListener((nid, i) => { if (nid.startsWith(PREFIX)) handle(nid.slice(PREFIX.length), i === 0 ? "start" : "complete"); });
chrome.notifications.onClicked.addListener(async (nid) => {
  const wins = await getWins(), wid = wins[nid.slice(PREFIX.length)];
  if (wid) chrome.windows.update(wid, { focused: true }).catch(() => {});
});

// Closing the alert window without choosing counts as "remind me in 5 minutes", so nothing is lost.
chrome.windows.onRemoved.addListener(async (winId) => {
  const wins = await getWins();
  const id = Object.keys(wins).find((k) => wins[k] === winId);
  if (!id) return;
  delete wins[id]; await setWins(wins);
  const t = (await getTasks()).find((x) => x.id === id);
  if (t && t.status === "ringing") await handle(id, "snooze", 5);
});

// The list changed (added, edited, or completed from the new tab): reschedule,
// and stop ringing for anything that was dealt with somewhere else.
chrome.storage.onChanged.addListener(async (ch, area) => {
  if (area !== "local" || !ch[TASKS]) return;
  await syncAlarms();
  const tasks = ch[TASKS].newValue || [];
  const wins = await getWins();
  for (const id of Object.keys(wins)) { const t = tasks.find((x) => x.id === id); if (!t || t.status !== "ringing") await settle(id); }
});

// After a restart, catch up: overdue tasks ring now, and anything that was ringing rings again.
async function catchUp() {
  await setWins({});
  const tasks = await getTasks();
  let changed = false;
  for (const t of tasks) if (t.status === "ringing") { t.status = "open"; changed = true; }
  if (changed) await setTasks(tasks);
  await syncAlarms();
}
chrome.runtime.onStartup.addListener(catchUp);
chrome.runtime.onInstalled.addListener(catchUp);
