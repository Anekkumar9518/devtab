// "What was I doing?" After Chrome restarts, the first new tab shows what you
// were working on last time (your in-progress task, or the page you were on)
// with your open tabs, and brings them all back in one click.
import { get, set, ext } from "../kv.js";

const LAST = "devtab:lastSession";
const $ = (s, el = document) => el.querySelector(s);

const when = (ms) => {
  const d = new Date(ms), now = new Date();
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
  return days === 0 ? `Earlier today at ${t}` : days === 1 ? `Yesterday at ${t}` : `${d.toLocaleDateString(undefined, { weekday: "long" })} at ${t}`;
};
// "portfolio SEO - Google Docs" -> "portfolio SEO"
const tidy = (title) => (title || "").split(/ [-–|·] /)[0].trim().slice(0, 70);

export async function initRecall(C) {
  if (!ext || !C.S().fx.recall) return;
  const L = await get(LAST, null);
  if (!L || L.dismissed || !L.tabs || !L.tabs.length) return;
  const what = L.task || tidy(L.title) || C.host(L.tabs[0].u);
  const S = C.S(), hi = new Date().getHours(), greet = hi < 12 ? "Good morning" : hi < 17 ? "Welcome back" : "Good evening";
  const el = document.createElement("aside");
  el.className = "recall"; el.setAttribute("aria-label", "Pick up where you left off");
  el.innerHTML = `
    <div class="recall__glow"></div>
    <p class="recall__k">${S.mode === "hacker" ? "> session.restore()" : `${greet}${S.name ? ", " + C.esc(S.name) : ""}`}</p>
    <p class="recall__t">${when(L.at)} you were working on</p>
    <h3 class="recall__what">${C.esc(what)}</h3>
    <div class="recall__tabs">${L.tabs.slice(0, 10).map((t) => C.favicon(t.u) ? `<img src="${C.favicon(t.u, 32)}" alt="" title="${C.esc(t.t)}">` : "").join("")}${L.tabs.length > 10 ? `<em>+${L.tabs.length - 10}</em>` : ""}</div>
    <div class="recall__acts"><button type="button" class="btn btn--sm" data-restore>Restore ${L.tabs.length} tab${L.tabs.length === 1 ? "" : "s"}</button><button type="button" class="btn btn--ghost btn--sm" data-skip>Not now</button></div>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("is-in"));
  const close = async () => { L.dismissed = true; await set(LAST, L); el.classList.remove("is-in"); setTimeout(() => el.remove(), 400); };
  el.addEventListener("click", async (e) => {
    if (e.target.closest("[data-restore]")) {
      const open = new Set((await chrome.tabs.query({ currentWindow: true })).map((t) => t.url));
      let n = 0; for (const t of L.tabs) if (!open.has(t.u)) { chrome.tabs.create({ url: t.u, active: false }); n++; }
      C.toast(n ? `Restored ${n} tab${n === 1 ? "" : "s"}.` : "Those tabs are already open.");
      close();
    } else if (e.target.closest("[data-skip]")) close();
  });
}
