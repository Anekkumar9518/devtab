// Tiny key-value store shared by the new tab, the hub panes and the background
// worker: chrome.storage.local in the extension, localStorage on the web demo.

export const ext = typeof chrome !== "undefined" && !!(chrome.storage && chrome.storage.local);

export async function get(key, fallback) {
  try {
    if (ext) { const v = (await chrome.storage.local.get(key))[key]; return v === undefined ? fallback : v; }
    const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
export async function set(key, value) {
  try {
    if (ext) await chrome.storage.local.set({ [key]: value });
    else { localStorage.setItem(key, JSON.stringify(value)); dispatchEvent(new CustomEvent("devtab-kv", { detail: key })); }
  } catch (e) { /* full or blocked */ }
}
export async function del(key) {
  try { if (ext) await chrome.storage.local.remove(key); else { localStorage.removeItem(key); dispatchEvent(new CustomEvent("devtab-kv", { detail: key })); } } catch (e) {}
}
// Calls fn(newValue) when the key changes (in this tab or any other).
export function watch(key, fn) {
  if (ext) chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[key]) fn(ch[key].newValue); });
  else {
    addEventListener("devtab-kv", (e) => { if (e.detail === key) get(key, null).then(fn); });
    addEventListener("devtab-local", (e) => { if (e.detail === key) get(key, null).then(fn); }); // tasks.js writes
    addEventListener("storage", (e) => { if (e.key === key) get(key, null).then(fn); });
  }
}
