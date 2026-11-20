// Hub → Spy: everything the price & change spy is watching, with price graphs,
// what changed and when, and how often to check.
import { addPane } from "../hub.js";
import { get, set, ext } from "../kv.js";

const KEY = "devtab:spy";
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M10 15h4M2.5 13 5 6h2M21.5 13 19 6h-2"/></svg>';
const DEF = { watches: [], every: 360, dropsOnly: false };
let C = null;

const ago = (ms) => { if (!ms) return "not yet"; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? m + "m ago" : m < 1440 ? Math.round(m / 60) + "h ago" : Math.round(m / 1440) + "d ago"; };
const money = (n, cur) => (n == null ? "—" : (cur || "") + n.toLocaleString("en-IN", { maximumFractionDigits: 2 }));

function spark(h) {
  const pts = (h || []).filter((p) => p.n != null);
  if (pts.length < 2) return `<div class="spy__spark spy__spark--flat">price graph appears after a few checks</div>`;
  const W = 220, H = 54, ns = pts.map((p) => p.n), lo = Math.min(...ns), hi = Math.max(...ns), t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const xy = pts.map((p) => [((p.t - t0) / Math.max(1, t1 - t0)) * (W - 8) + 4, hi === lo ? H / 2 : H - 6 - ((p.n - lo) / (hi - lo)) * (H - 12)]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const down = ns[ns.length - 1] <= ns[0], last = xy[xy.length - 1];
  return `<svg class="spy__spark ${down ? "is-down" : "is-up"}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Price history"><polygon points="4,${H} ${line} ${last[0].toFixed(1)},${H}"/><polyline points="${line}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5"/></svg>`;
}

function card(w) {
  let big, chip = "";
  if (w.kind === "price") {
    big = money(w.num, w.cur);
    if (w.prev != null && w.prev !== w.num) {
      const d = w.num - w.prev, pct = Math.abs((d / w.prev) * 100).toFixed(1);
      chip = `<em class="spy__chip ${d < 0 ? "is-down" : "is-up"}">${d < 0 ? "▼" : "▲"} ${pct}% <small>from ${money(w.prev, w.cur)}</small></em>`;
    }
  } else big = w.kind === "page" ? `${(w.words || 0).toLocaleString()} words` : C.esc((w.sample || w.value || "").slice(0, 140));
  const changed = w.changedAt ? `changed ${ago(w.changedAt)}` : "no change yet";
  const range = w.kind === "price" && w.low != null && w.high != null && w.low !== w.high ? `<span>low ${money(w.low, w.cur)} · high ${money(w.high, w.cur)}</span>` : "";
  const was = w.kind !== "price" && w.prevSample ? `<p class="spy__was"><b>Before:</b> ${C.esc(w.prevSample.slice(0, 160))}</p>` : "";
  return `<article class="spy__card${w.unseen ? " is-new" : ""}${w.paused ? " is-paused" : ""}" data-id="${w.id}">
    <header>${C.favicon(w.url) ? `<img src="${C.favicon(w.url, 32)}" alt="">` : "<i></i>"}<span><b>${C.esc(w.label)}</b><small>${C.esc(C.host(w.url))} · ${w.kind === "price" ? "💰 price" : w.kind === "page" ? "📄 whole page" : "👀 text"}</small></span>${w.unseen ? `<em class="spy__new">NEW</em>` : ""}</header>
    <div class="spy__val${w.kind === "price" ? "" : " is-text"}">${big}${chip}</div>
    ${w.kind === "price" ? spark(w.history) : ""}${was}
    ${w.error ? `<p class="spy__err">⚠ ${C.esc(w.error)}</p>` : ""}
    <footer><span>checked ${ago(w.checked)} · ${changed}${w.via === "tab" ? " · reads in a background tab" : ""}</span>${range}</footer>
    <div class="spy__acts"><button type="button" class="ws__a" data-check>Check now</button><button type="button" class="ws__a" data-open>Open</button><button type="button" class="ws__a" data-pause>${w.paused ? "Resume" : "Pause"}</button><button type="button" class="ws__a ws__a--x" data-del>Delete</button></div>
  </article>`;
}

function render(el) {
  if (!ext) { el.innerHTML = `<div class="ws__empty"><div class="ws__art">${ICON}</div><h4>The spy lives in the extension</h4><p>Installed, DevTab can watch a price or any part of a page (a competitor's pricing, an Amazon or Flipkart deal, a job board) and ping you the moment it changes.</p></div>`; return; }
  const draw = async () => {
    const s = await get(KEY, DEF), list = s.watches || [];
    const drops = list.filter((w) => w.kind === "price" && w.prev != null && w.num < w.prev).length;
    el.innerHTML = `<div class="spy">
      <div class="tb__stats spy__stats"><div><b>${list.length}</b><span>watching</span></div><div class="is-z"><b>${list.filter((w) => w.changedAt).length}</b><span>changed so far</span></div><div><b>${drops}</b><span>price drop${drops === 1 ? "" : "s"} 💰</span></div><div><b>${ago(Math.max(0, ...list.map((w) => w.checked || 0)))}</b><span>last check</span></div></div>
      <div class="tb__ctl">
        <div class="tb__auto"><span>Check every</span><div class="seg">${[[60, "1h"], [180, "3h"], [360, "6h"], [720, "12h"], [1440, "24h"]].map(([v, n]) => `<button type="button" data-every="${v}" aria-pressed="${(s.every || 360) === v}">${n}</button>`).join("")}</div></div>
        <label class="row">Only tell me when a price drops <input type="checkbox" data-drops ${s.dropsOnly ? "checked" : ""}></label>
        <div class="tb__btns">${list.length ? `<button type="button" class="btn" data-checkall>🔄 Check all now</button>` : ""}</div>
        <p class="note">To watch something, open the page, click the DevTab button in your toolbar and pick <b>Price &amp; change spy</b>, then click the price or text. Checks use your own browser, so you see your prices (your city, your account). Nothing is sent anywhere else.</p>
      </div>
      ${list.length ? `<div class="spy__grid">${list.map(card).join("")}</div>` : `<div class="ws__empty"><div class="ws__art">${ICON}</div><h4>Nothing watched yet</h4><p>Open a product page or a competitor's site, click the DevTab toolbar button → <b>Price &amp; change spy</b>, and point at what to watch. DevTab spots the price on its own on most shops.</p></div>`}
    </div>`;
    if (list.some((w) => w.unseen)) { s.watches.forEach((w) => (w.unseen = false)); await set(KEY, s); const b = document.getElementById("hb-spy"); if (b) b.textContent = ""; }
  };
  draw();
  const onCh = (ch, area) => { if (area === "local" && ch[KEY]) draw(); };
  chrome.storage.onChanged.addListener(onCh);
  el.addEventListener("click", async (e) => {
    const t = e.target, s = await get(KEY, DEF);
    const ev = t.closest("[data-every]"); if (ev) { s.every = +ev.dataset.every; await set(KEY, s); C.toast(`DevTab will check every ${ev.textContent}.`); return; }
    if (t.closest("[data-checkall]")) { t.closest("[data-checkall]").textContent = "Checking…"; await chrome.runtime.sendMessage({ type: "spy-check" }); C.toast("Checked everything."); return draw(); }
    const c = t.closest(".spy__card"); if (!c) return;
    const id = c.dataset.id, w = s.watches.find((x) => x.id === id); if (!w) return;
    if (t.closest("[data-open]")) return chrome.tabs.create({ url: w.url });
    if (t.closest("[data-check]")) { t.closest("[data-check]").textContent = "Checking…"; await chrome.runtime.sendMessage({ type: "spy-check", id }); return draw(); }
    if (t.closest("[data-pause]")) { w.paused = !w.paused; await set(KEY, s); return; }
    if (t.closest("[data-del]")) { s.watches = s.watches.filter((x) => x.id !== id); await set(KEY, s); C.toast("Stopped watching it."); }
  });
  el.addEventListener("change", async (e) => { if (e.target.matches("[data-drops]")) { const s = await get(KEY, DEF); s.dropsOnly = e.target.checked; await set(KEY, s); } });
  return () => chrome.storage.onChanged.removeListener(onCh);
}

export function initSpy(ctx) {
  C = ctx;
  addPane({
    id: "spy", label: "Spy", icon: ICON, title: "Price & change spy", sub: "Prices and pages you're watching",
    badge: (b) => { if (!b) return; const upd = (s) => { const n = ((s || DEF).watches || []).filter((w) => w.unseen).length; b.textContent = n ? String(n) : ""; }; get(KEY, DEF).then(upd); },
    render,
  });
}
