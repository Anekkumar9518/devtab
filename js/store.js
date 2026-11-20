// Settings live in chrome.storage.local (synced across tabs). When the page runs
// outside the extension (the GitHub Pages demo), it falls back to localStorage.
// Uploaded images and videos are Blobs in IndexedDB, which has room for big files.

const KEY = "devtab:settings";
const ext = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

export const DEFAULTS = {
  mode: "dev",                       // "dev" | "hacker"
  name: "",
  clock24: false,
  seconds: false,
  engine: "google",
  links: "top",                      // "top" (most visited) | "custom"
  custom: [
    { t: "GitHub", u: "https://github.com" },
    { t: "Stack Overflow", u: "https://stackoverflow.com", icon: "https://cdn.sstatic.net/Sites/stackoverflow/Img/apple-touch-icon.png" },
    { t: "MDN", u: "https://developer.mozilla.org" },
    { t: "YouTube", u: "https://www.youtube.com" },
    { t: "Gmail", u: "https://mail.google.com", icon: "https://ssl.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png" },
    { t: "Claude", u: "https://claude.ai" },
  ],
  todos: [],
  showTodo: true,
  showWeather: true,
  showDock: true,
  dockFolder: "1",                  // Chrome's bookmarks bar
  showGoogle: true,
  city: null,                        // { name, lat, lon }
  boot: true,
  dev: { bg: "aurora", accent: "#7c9cff", dim: 25, blur: 0 },
  hacker: { bg: "matrix", accent: "#00ff66", dim: 20, blur: 0 },
  photo: null,                       // { id, author, url } for the 4K photo background
  github: "",                        // username for the GitHub city background
  fx: {
    parallax: true, timeTravel: true, particleClock: true, gravity: true, launch: true,
    pet: true, petKind: "robot", petName: "Bit", recall: true, wrapped: false,
    petEverywhere: false, petHidden: [], air: false,
  },
  tabs: { autoSleep: 60, keepPinned: true },
  news: { tab: "india", ticker: true },
  focus: { minutes: 25, sites: ["youtube.com", "instagram.com", "facebook.com", "x.com", "twitter.com", "reddit.com", "netflix.com"] },
};

export async function load() {
  let s = null;
  try {
    if (ext) s = (await chrome.storage.local.get(KEY))[KEY];
    else s = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch (e) { s = null; }
  const out = structuredClone(DEFAULTS);
  if (s) {
    Object.assign(out, s);
    out.dev = { ...DEFAULTS.dev, ...(s.dev || {}) };
    out.hacker = { ...DEFAULTS.hacker, ...(s.hacker || {}) };
    out.fx = { ...DEFAULTS.fx, ...(s.fx || {}) };
    out.focus = { ...DEFAULTS.focus, ...(s.focus || {}) };
    out.tabs = { ...DEFAULTS.tabs, ...(s.tabs || {}) };
    out.news = { ...DEFAULTS.news, ...(s.news || {}) };
  }
  return out;
}

export async function save(s) {
  try {
    if (ext) await chrome.storage.local.set({ [KEY]: s });
    else localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) { /* storage full or blocked: the page still works for this session */ }
}

export function onChange(fn) {
  if (ext) chrome.storage.onChanged.addListener((ch) => { if (ch[KEY]) fn(ch[KEY].newValue); });
  else addEventListener("storage", (e) => { if (e.key === KEY && e.newValue) fn(JSON.parse(e.newValue)); });
}

/* ---------- media (IndexedDB) ---------- */
const db = () => new Promise((res, rej) => {
  const r = indexedDB.open("devtab", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("media");
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction("media", mode), store = t.objectStore("media");
    const req = fn(store);
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
  });
};
export const putMedia = (key, blob) => tx("readwrite", (s) => s.put(blob, key));
export const getMedia = (key) => tx("readonly", (s) => s.get(key)).catch(() => null);
export const delMedia = (key) => tx("readwrite", (s) => s.delete(key));
