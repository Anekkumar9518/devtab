// Tasks, reminders and their history. Shared by the new tab page, the alert
// popup and the background worker, so every part reads and writes the same data.
// In the extension it lives in chrome.storage.local; on the web demo, localStorage.

const ext = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
export const TASKS = "devtab:tasks";
export const HISTORY = "devtab:history";
const HISTORY_MAX = 1000;

async function read(key, fallback) {
  try {
    if (ext) { const v = (await chrome.storage.local.get(key))[key]; return v === undefined ? fallback : v; }
    const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
async function write(key, value) {
  try { if (ext) await chrome.storage.local.set({ [key]: value }); else { localStorage.setItem(key, JSON.stringify(value)); dispatchEvent(new CustomEvent("devtab-local", { detail: key })); } } catch (e) {}
}

export const getTasks = () => read(TASKS, []);
export const setTasks = (list) => write(TASKS, list);
export const getHistory = () => read(HISTORY, []);

export async function addHistory(task, action, extra) {
  const h = await getHistory();
  h.unshift({ id: task.id, text: task.text, at: task.at || null, action, extra: extra || null, time: Date.now() });
  await write(HISTORY, h.slice(0, HISTORY_MAX));
}
export const clearHistory = () => write(HISTORY, []);

export function newTask(text, at) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, at: at || null, status: "open", snoozes: 0, created: Date.now() };
}

// The things you can do to a task. Returns the updated task (or null).
export async function act(id, action, minutes) {
  const list = await getTasks();
  const t = list.find((x) => x.id === id);
  if (!t) return null;
  if (action === "start") { t.status = "started"; t.startedAt = Date.now(); await addHistory(t, "started"); }
  else if (action === "complete") { t.status = "done"; t.doneAt = Date.now(); await addHistory(t, "completed"); }
  else if (action === "reopen") { t.status = t.startedAt ? "started" : "open"; delete t.doneAt; }
  else if (action === "snooze") {
    const m = Math.max(1, Math.min(24 * 60, Math.round(minutes || 5)));
    t.at = Date.now() + m * 60 * 1000; t.status = "open"; t.snoozes = (t.snoozes || 0) + 1;
    await addHistory(t, "snoozed", m + " min");
  } else if (action === "delete") {
    await setTasks(list.filter((x) => x.id !== id)); return t;
  }
  await setTasks(list);
  return t;
}

// "6:30 PM", "Tomorrow, 9:00 AM", "Mon 24 Nov, 9:00 AM"
export function when(ms) {
  const d = new Date(ms), now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  if (diff === 0) return time;
  if (diff === 1) return "Tomorrow, " + time;
  if (diff === -1) return "Yesterday, " + time;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + ", " + time;
}
