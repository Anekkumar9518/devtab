// Focus sessions, shared by the new tab, the blocked page and the background
// worker. A session is { startedAt, endsAt, minutes, sites }; finished ones go
// into a log that Wrapped reads.
import { get, set, del } from "./kv.js";

export const FOCUS = "devtab:focus";
export const FOCUSLOG = "devtab:focuslog";

export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
export const matches = (u, sites) => { const h = hostOf(u); return !!h && (sites || []).some((s) => h === s || h.endsWith("." + s)); };
export const cleanSite = (s) => hostOf(/^https?:\/\//i.test(s.trim()) ? s.trim() : "https://" + s.trim());

export const getFocus = () => get(FOCUS, null);
export const getLog = () => get(FOCUSLOG, []);

export async function startFocus(minutes, sites) {
  const now = Date.now();
  await set(FOCUS, { startedAt: now, endsAt: now + minutes * 60000, minutes, sites });
}
export async function extendFocus(minutes) {
  const f = await getFocus(); if (!f) return;
  f.endsAt += minutes * 60000; f.minutes += minutes; await set(FOCUS, f);
}
// completed: the timer ran out (true) or you ended it early (false)
export async function endFocus(completed) {
  const f = await getFocus(); if (!f) return null;
  const end = Math.min(Date.now(), f.endsAt);
  const log = await getLog();
  const entry = { start: f.startedAt, end, minutes: Math.max(0, Math.round((end - f.startedAt) / 60000)), planned: f.minutes, completed: !!completed };
  log.unshift(entry);
  await set(FOCUSLOG, log.slice(0, 500));
  await del(FOCUS);
  return entry;
}

// "today: 3 sessions, 1h 15m"
export function todayStats(log) {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const today = log.filter((x) => x.start >= d0.getTime());
  return { sessions: today.length, minutes: today.reduce((s, x) => s + x.minutes, 0) };
}
export const dur = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);
