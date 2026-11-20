// Price & change spy: re-checks the bits of pages you asked DevTab to watch (a
// price, a headline, a stock line, a whole page) and notifies you when they
// change. Each check reads the page the way your browser would (your cookies,
// your region), first as plain HTML and, for sites that build the page with
// JavaScript, in a muted background tab for a few seconds.
import { sync } from "./audio.js";

const KEY = "devtab:spy";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (t) => String(t || "").replace(/\s+/g, " ").trim();
const short = (t, n = 70) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
const hash = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };

// "₹1,23,456.00", "$19.99", "1.299,00 €", "Rs. 499" → { n, cur }
export function parsePrice(t) {
  t = N(t);
  const CUR = "(₹|Rs\\.?|INR|\\$|US\\$|USD|€|EUR|£|GBP|¥|JPY|AED|SGD|A\\$|C\\$)";
  const NUM = "(\\d{1,3}(?:[.,\\u00a0\\u202f ]\\d{2,3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  const m = t.match(new RegExp(CUR + "\\s?" + NUM, "i")) || t.match(new RegExp(NUM + "\\s?" + CUR, "i"));
  let cur = "", s;
  if (m) { if (/\d/.test(m[1])) { s = m[1]; cur = m[2]; } else { cur = m[1]; s = m[2]; } }
  else { const k = t.match(new RegExp(NUM)); if (!k) return null; s = k[1]; }
  s = s.replace(/[\s  ]/g, "");
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc > -1 && ld > -1) { const dec = lc > ld ? "," : "."; s = s.split(dec === "," ? "." : ",").join(""); if (dec === ",") s = s.replace(",", "."); }
  else if (lc > -1) s = s.length - lc - 1 === 3 || (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, "") : s.replace(",", ".");
  else if (ld > -1 && ((s.match(/\./g) || []).length > 1 || (s.length - ld - 1 === 3 && /€/.test(cur)))) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  cur = /^(rs\.?|inr)$/i.test(cur) ? "₹" : /^(usd|us\$)$/i.test(cur) ? "$" : /^eur$/i.test(cur) ? "€" : /^gbp$/i.test(cur) ? "£" : /^jpy$/i.test(cur) ? "¥" : cur;
  return { n, cur };
}
const money = (n, cur) => (cur || "") + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

async function getState() { return (await chrome.storage.local.get(KEY))[KEY] || { watches: [], every: 360, dropsOnly: false }; }
const putState = (s) => chrome.storage.local.set({ [KEY]: s });

/* ---------- reading a page ---------- */
let parsing = false;
async function parseHTML(html, selector) {
  if (!parsing) { parsing = true; await chrome.storage.session.set({ spyParse: true }); await sync(); }
  for (let i = 0; i < 3; i++) {
    const r = await chrome.runtime.sendMessage({ target: "offscreen", type: "spy-parse", html, selector }).catch(() => null);
    if (r) return r;
    await sleep(400); // the hidden page is still starting
  }
  return null;
}
async function doneParsing() { if (parsing) { parsing = false; await chrome.storage.session.set({ spyParse: false }); await sync(); } }

function readInTab(selector) {
  const el = document.querySelector(selector);
  if (!el) return { found: false, captcha: /captcha|robot check|are you a human|unusual traffic|verify you are/i.test((document.body ? document.body.innerText : "").slice(0, 4000)) };
  const c = el.cloneNode(true); c.querySelectorAll("script,style,noscript,template").forEach((x) => x.remove());
  return { found: true, text: c.textContent };
}
async function viaTab(w) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url: w.url, active: false });
    await chrome.tabs.update(tab.id, { muted: true }).catch(() => {});
    await new Promise((res) => {
      const done = () => { chrome.tabs.onUpdated.removeListener(l); clearTimeout(to); res(); };
      const l = (id, ch) => { if (id === tab.id && ch.status === "complete") done(); };
      chrome.tabs.onUpdated.addListener(l); const to = setTimeout(done, 30000);
    });
    let r = null;
    for (let i = 0; i < 4; i++) { // prices often appear a moment after the page loads
      await sleep(1500);
      [{ result: r }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readInTab, args: [w.selector] });
      if (r && r.found && N(r.text)) break;
    }
    return r;
  } catch (e) { return { found: false, error: "Couldn't open the page in the background." }; }
  finally { if (tab) chrome.tabs.remove(tab.id).catch(() => {}); }
}

async function read(w) {
  const origin = (() => { try { return new URL(w.url).origin + "/*"; } catch (e) { return null; } })();
  if (!origin || !(await chrome.permissions.contains({ origins: [origin] }))) return { error: "DevTab no longer has access to this site. Open it and add the watch again." };
  if (w.via !== "tab") {
    try {
      const res = await fetch(w.url, { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const r = await parseHTML(await res.text(), w.selector);
        if (r && r.found && N(r.text)) return { text: r.text, via: "fetch" };
      }
    } catch (e) { /* offline, or the site refused */ }
  }
  const r = await viaTab(w);
  if (r && r.found && N(r.text)) return { text: r.text, via: "tab" };
  if (r && r.captcha) return { error: "The site asked for a captcha. Open it once yourself, then DevTab can check again." };
  return { error: (r && r.error) || "Couldn't find that part of the page any more. The site may have changed its layout." };
}

/* ---------- checking ---------- */
async function checkOne(id) {
  let s = await getState(); let w = s.watches.find((x) => x.id === id); if (!w) return null;
  const r = await read(w);
  s = await getState(); w = s.watches.find((x) => x.id === id); if (!w) return null; // deleted meanwhile
  const now = Date.now(); w.checked = now;
  if (r.error) { w.error = r.error; w.fails = (w.fails || 0) + 1; await putState(s); return w; }
  w.error = ""; w.fails = 0; w.via = r.via;
  const text = N(r.text);
  let changed = false, note = null;
  if (w.kind === "price") {
    const p = parsePrice(text);
    if (!p) { w.error = "That part of the page no longer shows a price."; await putState(s); return w; }
    if (w.baseline && p.n !== w.num) { changed = true; note = { from: w.num, to: p.n }; w.prev = w.num; }
    w.num = p.n; w.cur = p.cur || w.cur; w.value = text;
    w.history = [...(w.history || []), { t: now, n: p.n }].slice(-60);
    if (w.low == null || p.n < w.low) w.low = p.n;
    if (w.high == null || p.n > w.high) w.high = p.n;
  } else {
    const v = w.kind === "page" ? hash(text) : short(text, 400);
    if (w.baseline && v !== w.value) { changed = true; note = { from: w.sample || w.value, to: short(text, 400) }; w.prevSample = w.sample || w.value; }
    if (changed || !w.baseline) w.history = [...(w.history || []), { t: now, v: short(text, 160) }].slice(-30);
    w.value = v; w.sample = short(text, 400); w.words = text.split(" ").length;
  }
  w.baseline = true;
  if (changed) {
    w.changedAt = now; w.unseen = true;
    const drop = w.kind === "price" && note.to < note.from;
    if (!(s.dropsOnly && w.kind === "price" && !drop)) notify(w, note, drop);
  }
  await putState(s);
  return w;
}

function notify(w, note, drop) {
  let title, message;
  if (w.kind === "price") {
    const pct = Math.abs(((note.to - note.from) / note.from) * 100).toFixed(1);
    title = drop ? `💰 Price dropped ${pct}%` : `📈 Price went up ${pct}%`;
    message = `${short(w.label, 60)}\n${money(note.from, w.cur)} → ${money(note.to, w.cur)}`;
  } else if (w.kind === "page") { title = `👀 ${host(w.url)} changed its page`; message = short(w.label, 90); }
  else { title = `👀 ${short(w.label, 40)} changed`; message = `“${short(N(note.from), 60)}” → “${short(N(note.to), 60)}”`; }
  chrome.notifications.create(`spy|${w.id}|${Date.now()}`, { type: "basic", iconUrl: "icons/icon128.png", title, message, contextMessage: host(w.url), priority: 2 }, () => void chrome.runtime.lastError);
}

let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));
async function runChecks(ids) {
  try { const out = []; for (const id of ids) out.push(await checkOne(id)); return out; }
  finally { await doneParsing(); }
}
async function checkDue() {
  const s = await getState(), now = Date.now();
  const due = s.watches.filter((w) => !w.paused && now - (w.checked || 0) >= (s.every || 360) * 60000 - 90000).map((w) => w.id);
  if (due.length) await runChecks(due);
}

chrome.alarms.get("spy").then((a) => { if (!a) chrome.alarms.create("spy", { periodInMinutes: 30, delayInMinutes: 1 }); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "spy") enqueue(checkDue); });

chrome.notifications.onClicked.addListener(async (nid) => {
  if (!nid.startsWith("spy|")) return;
  const id = nid.split("|")[1], s = await getState(), w = s.watches.find((x) => x.id === id);
  chrome.notifications.clear(nid);
  if (w) { w.unseen = false; await putState(s); chrome.tabs.create({ url: w.url }); }
});

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m) return;
  if (m.type === "spy-add" && m.watch) {
    (async () => {
      const s = await getState(), w = m.watch;
      const old = s.watches.find((x) => x.url === w.url && x.selector === w.selector);
      const item = { id: old ? old.id : Math.random().toString(36).slice(2, 10), added: old ? old.added : Date.now(), url: w.url, title: w.title || "", label: w.label || w.title || host(w.url), selector: w.selector, kind: w.kind, value: w.value, num: w.num, cur: w.cur, sample: w.sample, history: w.kind === "price" && w.num != null ? [{ t: Date.now(), n: w.num }] : [], low: w.num, high: w.num, baseline: false, checked: 0 };
      if (old) Object.assign(old, item); else s.watches.unshift(item);
      await putState(s);
      reply({ ok: true, count: s.watches.length, every: s.every || 360 });
      enqueue(() => runChecks([item.id])); // first look, to learn how this site loads
    })();
    return true;
  }
  if (m.type === "spy-check") {
    (async () => {
      const s = await getState(), ids = m.id ? [m.id] : s.watches.filter((w) => !w.paused).map((w) => w.id);
      await enqueue(() => runChecks(ids));
      reply({ ok: true });
    })();
    return true;
  }
});
