// Shortcuts (the tiles under the search box), the bookmarks dock at the bottom,
// and the Google bar (Gmail, Images, apps, account) at the top right.

const $ = (s, el = document) => el.querySelector(s);
const ext = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
export const favicon = (u, size = 64) => ext ? chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(u)}&size=${size}`) : null;
const siteIco = (u) => { try { return new URL(u).origin + "/favicon.ico"; } catch (e) { return ""; } };
const letterOf = (t, u) => (t || host(u) || "?").trim().charAt(0).toUpperCase();
const MAX = 16;

let C; // { S(), persist(), toast(), icon(), esc() } from app.js
const esc = (s) => C.esc(s);

/* ---------- icons: site icon > Chrome's cache > /favicon.ico > letter ---------- */
let genericBytes = null;
async function isGenericChromeIcon(src) {
  try {
    const bytes = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());
    genericBytes = genericBytes || await bytes(favicon("https://devtab-no-such-site.invalid/"));
    const b = await bytes(src);
    return b.length === genericBytes.length && b.every((v, i) => v === genericBytes[i]);
  } catch (e) { return false; }
}
function wireIcons(root) {
  root.querySelectorAll("img[data-u]").forEach(async (img) => {
    const fallback = () => {
      if (!img.dataset.tried) { img.dataset.tried = "1"; img.src = siteIco(img.dataset.u); return; }
      const b = document.createElement("b"); b.textContent = img.dataset.l || "?"; img.replaceWith(b);
    };
    img.addEventListener("error", fallback);
    if (ext && img.src.includes("/_favicon/") && await isGenericChromeIcon(img.src)) fallback();
  });
}
const iconImg = (u, title, own) => `<img src="${esc(own || favicon(u) || siteIco(u))}" alt="" data-u="${esc(u)}" data-l="${esc(letterOf(title, u))}"${own ? ' data-tried="1"' : ""} loading="lazy" draggable="false">`;

// Reads the page's own <link rel="icon"> (and apple-touch-icon, which is bigger).
// In the extension that needs permission to read the site, asked for just before.
async function findSiteIcon(u) {
  const loads = (src) => new Promise((res) => {
    const im = new Image(); const t = setTimeout(() => res(false), 5000);
    im.onload = () => { clearTimeout(t); res(im.naturalWidth >= 16); }; im.onerror = () => { clearTimeout(t); res(false); };
    im.src = src;
  });
  try {
    const r = await fetch(u, { credentials: "omit", redirect: "follow" });
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const base = r.url || u;
    const size = (l) => Math.max(0, ...((l.getAttribute("sizes") || "").match(/\d+/g) || ["0"]).map(Number));
    const cands = [...doc.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="mask-icon"]')]
      .filter((l) => l.getAttribute("href"))
      .map((l) => ({ href: new URL(l.getAttribute("href"), base).href, score: /apple-touch/.test(l.rel) ? 180 : (l.type === "image/svg+xml" || /\.svg(\?|$)/.test(l.getAttribute("href"))) ? 200 : size(l) || 32, mask: l.rel === "mask-icon" }))
      .filter((c) => !c.mask)
      .sort((a, b) => b.score - a.score);
    for (const c of cands) if (await loads(c.href)) return c.href;
  } catch (e) { /* blocked or offline */ }
  const ico = siteIco(u);
  return ico && await loads(ico) ? ico : null;
}

/* ---------- shortcuts ---------- */
async function currentItems() {
  const S = C.S();
  if (S.links === "top" && ext && chrome.topSites) {
    try {
      const items = (await chrome.topSites.get()).slice(0, 8).map((x) => ({ t: x.title || host(x.url), u: x.url }));
      const seen = new Set(items.map((x) => host(x.u)));
      for (const l of S.custom) if (items.length < 8 && !seen.has(host(l.u))) { items.push(l); seen.add(host(l.u)); }
      return items;
    } catch (e) { /* fall through */ }
  }
  return S.custom;
}
export async function drawLinks() {
  const S = C.S(), editable = S.links === "custom" || !ext;
  const items = (await currentItems()).slice(0, MAX);
  const tile = (l, i) => `<div class="link" data-i="${i}" ${editable ? 'draggable="true"' : ""}>
      <a class="link__a" href="${esc(l.u)}" data-url="${esc(l.u)}" data-title="${esc(l.t || host(l.u))}"><span class="link__ic">${iconImg(l.u, l.t, l.icon)}</span><span class="link__t">${esc(l.t || host(l.u))}</span></a>
      ${editable ? `<span class="link__tools"><button type="button" data-edit="${i}" aria-label="Edit ${esc(l.t)}" title="Edit">${C.icon("pen")}</button><button type="button" data-rm="${i}" aria-label="Remove ${esc(l.t)}" title="Remove">${C.icon("x")}</button></span>` : ""}
    </div>`;
  const add = items.length < MAX ? `<div class="link link--add"><button type="button" class="link__a" id="addTile" aria-label="Add a shortcut"><span class="link__ic">${C.icon("plus")}</span><span class="link__t">Add</span></button></div>` : "";
  $("#links").innerHTML = items.map(tile).join("") + add;
  wireIcons($("#links"));
}

/* the add / edit dialog */
let editIndex = null;
const dlg = () => $("#scDlg");
function preview() {
  let u = $("#scUrl").value.trim();
  if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
  let ok = false; try { ok = !!new URL(u).hostname.includes("."); } catch (e) {}
  $("#scHost").textContent = ok ? host(u) : "Paste a link and give it a name";
  $("#scIcon").innerHTML = ok ? iconImg(u, $("#scName").value, null) : C.icon("plus");
  if (ok) wireIcons($("#scIcon"));
}
let pvT = 0;
function openDialog(i) {
  const S = C.S(); editIndex = i;
  const l = i === null ? { t: "", u: "" } : S.custom[i];
  $("#scDlgT").textContent = i === null ? "Add shortcut" : "Edit shortcut";
  $("#scUrl").value = l.u; $("#scName").value = l.t;
  $("#scSave").disabled = false; $("#scSave").textContent = "Save";
  $("#scNote").textContent = ext ? "DevTab reads the site's own icon. Chrome may ask once to let it read that site; access is removed right after." : "DevTab uses the site's own icon when the site allows it.";
  preview(); dlg().showModal(); $("#scUrl").focus();
}
async function moveTopToCustom() {
  const S = C.S();
  if (S.links === "custom") return;
  S.custom = (await currentItems()).map((x) => ({ t: x.t, u: x.u, icon: x.icon }));
  S.links = "custom";
}

/* hover: a card that types the URL out, and a 3D tilt on the tile */
let typeT = 0, hideT = 0;
function showCard(a) {
  clearTimeout(hideT); clearInterval(typeT);
  const card = $("#urlCard"), r = a.getBoundingClientRect(), u = a.dataset.url;
  let proto = "", hostPart = u, rest = "";
  try { const x = new URL(u); proto = x.protocol + "//"; hostPart = x.host; rest = (x.pathname === "/" ? "" : x.pathname) + x.search; } catch (e) {}
  if (rest.length > 38) rest = rest.slice(0, 37) + "…";
  const img = a.querySelector(".link__ic img"), letter = a.querySelector(".link__ic b");
  card.innerHTML = `<span class="urlcard__ic">${img ? `<img src="${esc(img.src)}" alt="">` : `<b>${esc(letter ? letter.textContent : "?")}</b>`}</span>
    <span class="urlcard__body"><b class="urlcard__t">${esc(a.dataset.title)}</b><code class="urlcard__u"><i class="p"></i><i class="h"></i><i class="r"></i><span class="urlcard__cur"></span></code></span>`;
  const segs = [[proto, ".p"], [hostPart, ".h"], [rest, ".r"]];
  const total = proto.length + hostPart.length + rest.length;
  let n = 0;
  const tick = () => {
    n = Math.min(total, n + 2); let left = n;
    for (const [txt, sel] of segs) { const k = Math.max(0, Math.min(txt.length, left)); card.querySelector(sel).textContent = txt.slice(0, k); left -= k; }
    if (n >= total) clearInterval(typeT);
  };
  tick(); typeT = setInterval(tick, 16);
  const below = r.top < 150;
  card.style.left = Math.min(innerWidth - 20, Math.max(20, r.left + r.width / 2)) + "px";
  card.style.top = (below ? r.bottom + 14 : r.top - 14) + "px";
  card.classList.toggle("is-below", below);
  card.classList.add("is-on");
}
function hideCard() { hideT = setTimeout(() => { $("#urlCard").classList.remove("is-on"); clearInterval(typeT); }, 60); }

/* ---------- bookmarks dock ---------- */
const DEMO_BM = [
  { t: "GitHub", u: "https://github.com" }, { t: "Stack Overflow", u: "https://stackoverflow.com" }, { t: "MDN", u: "https://developer.mozilla.org" },
  { t: "Vercel", u: "https://vercel.com" }, { t: "Figma", u: "https://www.figma.com" }, { t: "Notion", u: "https://www.notion.so" },
  { t: "Search Console", u: "https://search.google.com/search-console" }, { t: "Meta Ads", u: "https://adsmanager.facebook.com" },
];
const FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';
// Chrome keeps bookmarks in two places: on this device, and (when you're signed
// in) in your Google account, each with its own Bookmarks bar and Other
// bookmarks. "auto" is every Bookmarks bar together, or, if those are empty,
// all your bookmarks; "all" is always everything.
const VIRTUAL = { auto: "Bookmarks bar", all: "All bookmarks", 1: "Bookmarks bar" };
const isBar = (n) => (n.folderType ? n.folderType === "bookmarks-bar" : n.id === "1");
const asItem = (b) => ({ id: b.id, t: b.title, u: b.url });
async function topFolders() { const [root] = await chrome.bookmarks.getTree(); return (root.children || []).filter((r) => r.folderType !== "managed"); }
async function children(id) {
  if (!(ext && chrome.bookmarks)) return id === "demo" || id === "1" || id === "auto" || id === "all" ? DEMO_BM : [];
  if (VIRTUAL[id]) {
    const tops = await topFolders();
    const bars = tops.filter(isBar).flatMap((r) => (r.children || []).map(asItem));
    if (id !== "all" && bars.length) return bars;
    const seen = new Set(), out = [];
    for (const r of [...tops.filter(isBar), ...tops.filter((r) => !isBar(r))]) for (const c of r.children || []) {
      const k = c.url || "folder:" + c.id; if (seen.has(k)) continue; seen.add(k); out.push(asItem(c));
    }
    return out;
  }
  return (await chrome.bookmarks.getChildren(id)).map(asItem);
}
async function hasAnyBookmark() { try { const [root] = await chrome.bookmarks.getTree(); const any = (n) => !!n.url || (n.children || []).some(any); return any(root); } catch (e) { return false; } }
// How much room the dock has: it sits between the to-do panel and the photo credit.
const dockRoom = () => (innerWidth <= 900 ? innerWidth - 32 : Math.min(860, innerWidth - 760));
export async function drawDock() {
  const S = C.S(), dock = $("#dock");
  dock.hidden = !S.showDock;
  if (dock.hidden) return;
  let id = S.dockFolder || "auto";
  if (ext && chrome.bookmarks && !VIRTUAL[id]) { try { await chrome.bookmarks.get(id); } catch (e) { id = "auto"; } } // that folder was deleted
  let items = [];
  try { items = await children(id); } catch (e) { items = []; }
  // whatever doesn't fit goes behind a "+N" button that opens the whole folder
  const fit = Math.max(3, Math.floor((dockRoom() - 24) / 50));
  let shown = items, more = 0;
  if (items.length > fit) { shown = items.slice(0, fit - 1); more = items.length - shown.length; }
  let name = VIRTUAL[id] || "Bookmarks";
  if (more && ext && chrome.bookmarks && !VIRTUAL[id]) { try { name = (await chrome.bookmarks.get(id))[0].title || name; } catch (e) {} }
  const none = ext && chrome.bookmarks && !items.length && !(await hasAnyBookmark());
  dock.innerHTML = (shown.map((b) => b.u
    ? `<a class="dk" href="${esc(b.u)}" data-label="${esc(b.t || host(b.u))}" aria-label="${esc(b.t || host(b.u))}">${iconImg(b.u, b.t, null)}</a>`
    : `<button type="button" class="dk dk--folder" data-folder="${esc(b.id)}" data-name="${esc(b.t)}" data-label="${esc(b.t || "Folder")}" aria-label="Folder ${esc(b.t)}">${FOLDER}</button>`).join("")
    + (more ? `<button type="button" class="dk dk--more" data-folder="${esc(id)}" data-name="${esc(name)}" data-label="${more} more" aria-label="${more} more bookmarks">+${more}</button>` : ""))
    || `<span class="dock__empty">${!ext ? "Your bookmarks show here in the extension." : none ? `No bookmarks in this Chrome profile yet. Press Ctrl+D on any page, or <button type="button" class="dock__imp" data-import>bring them from another browser</button>` : "No bookmarks in this folder. Pick another one in Settings → Bookmarks dock."}</span>`;
  wireIcons(dock);
}
const stack = [];
async function openFolder(id, name, anchor, push = true) {
  const pop = $("#dockPop");
  if (push) stack.push({ id, name });
  const items = await children(id);
  pop.innerHTML = `<div class="dock-pop__head">${stack.length > 1 ? `<button type="button" data-back aria-label="Back">‹</button>` : ""}<b>${esc(name || "Folder")}</b><small>${items.length}</small></div>
    <div class="dock-pop__grid">${items.map((b) => b.u
      ? `<a class="dpi" href="${esc(b.u)}"><span class="dpi__ic">${iconImg(b.u, b.t, null)}</span><span>${esc(b.t || host(b.u))}</span></a>`
      : `<button type="button" class="dpi" data-sub="${esc(b.id)}" data-name="${esc(b.t)}"><span class="dpi__ic dpi__ic--f">${FOLDER}</span><span>${esc(b.t || "Folder")}</span></button>`).join("") || `<p class="dock__empty">Empty folder</p>`}</div>`;
  wireIcons(pop);
  if (anchor) { const r = anchor.getBoundingClientRect(); pop.style.left = Math.min(innerWidth - 190, Math.max(190, r.left + r.width / 2)) + "px"; }
  pop.hidden = false;
}
const closeFolder = () => { $("#dockPop").hidden = true; stack.length = 0; };

/* ---------- Google bar ---------- */
// Google's own product icons, so the grid looks right even for apps you haven't opened yet
const GI = (n) => `https://ssl.gstatic.com/images/branding/product/2x/${n}_48dp.png`;
const GAPPS = [
  ["Search", "https://www.google.com/", "googleg"], ["Gmail", "https://mail.google.com/", "gmail_2020q4"], ["Drive", "https://drive.google.com/", "drive_2020q4"], ["Docs", "https://docs.google.com/document/", "docs_2020q4"],
  ["Sheets", "https://docs.google.com/spreadsheets/", "sheets_2020q4"], ["Slides", "https://docs.google.com/presentation/", "slides_2020q4"], ["Calendar", "https://calendar.google.com/", "calendar_2020q4"], ["Meet", "https://meet.google.com/", "meet_2020q4"],
  ["Maps", "https://maps.google.com/", "maps"], ["Photos", "https://photos.google.com/", "photos"], ["YouTube", "https://www.youtube.com/", "youtube"], ["Translate", "https://translate.google.com/", "translate"],
  ["Keep", "https://keep.google.com/", "keep_2020q4"], ["Search Console", "https://search.google.com/search-console", "search_console"], ["Analytics", "https://analytics.google.com/", "analytics"], ["Google Ads", "https://ads.google.com/", "ads"],
];
export function drawGoogle() {
  const S = C.S();
  $("#gbar").hidden = !S.showGoogle;
  const nm = (S.name || "").trim();
  $("#avatar").innerHTML = `<span>${esc(nm ? nm.charAt(0).toUpperCase() : "")}</span>`;
  if (!nm) $("#avatar").innerHTML = C.icon("user");
}
function openApps() {
  const pop = $("#appsPop");
  pop.innerHTML = `<div class="apps-pop__grid">${GAPPS.map(([n, u, i]) => `<a class="app" href="${u}"><span class="app__ic">${iconImg(u, n, GI(i))}</span><span>${n}</span></a>`).join("")}</div>`;
  wireIcons(pop); pop.hidden = false; $("#appsBtn").setAttribute("aria-expanded", "true");
}
const closeApps = () => { $("#appsPop").hidden = true; $("#appsBtn").setAttribute("aria-expanded", "false"); };

/* ---------- wiring ---------- */
export function initLinks(ctx) {
  C = ctx;
  $("#appsBtn").innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor">' + [5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => `<circle cx="${x}" cy="${y}" r="2.1"/>`)).join("") + "</g></svg>";
  const links = $("#links");

  links.addEventListener("click", async (e) => {
    if (e.target.closest("#addTile")) { openDialog(null); return; }
    const ed = e.target.closest("[data-edit]"), rm = e.target.closest("[data-rm]");
    if (ed || rm) {
      e.preventDefault();
      await moveTopToCustom();
      const S = C.S();
      if (ed) return openDialog(+ed.dataset.edit);
      const [gone] = S.custom.splice(+rm.dataset.rm, 1);
      await C.persist(); drawLinks(); hideCard(); C.toast(`Removed ${gone.t || host(gone.u)}.`);
    }
  });
  links.addEventListener("pointerover", (e) => { const a = e.target.closest(".link__a[data-url]"); if (a) showCard(a); });
  links.addEventListener("pointerout", (e) => { const a = e.target.closest(".link__a[data-url]"); if (a && !a.contains(e.relatedTarget)) hideCard(); });
  links.addEventListener("focusin", (e) => { const a = e.target.closest(".link__a[data-url]"); if (a) showCard(a); });
  links.addEventListener("focusout", hideCard);
  links.addEventListener("pointermove", (e) => {
    const t = e.target.closest(".link"); if (!t || t.classList.contains("link--add")) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--rx", ((e.clientY - r.top) / r.height - 0.5) * -18 + "deg");
    t.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 18 + "deg");
    t.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
  });
  links.addEventListener("pointerleave", () => links.querySelectorAll(".link").forEach((t) => { t.style.removeProperty("--rx"); t.style.removeProperty("--ry"); }), true);

  // drag to reorder
  let from = null;
  links.addEventListener("dragstart", (e) => { const t = e.target.closest(".link[draggable=true]"); if (!t) return; from = +t.dataset.i; t.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; hideCard(); });
  links.addEventListener("dragover", (e) => { const t = e.target.closest(".link[data-i]"); if (from === null || !t) return; e.preventDefault(); links.querySelectorAll(".is-over").forEach((x) => x.classList.remove("is-over")); t.classList.add("is-over"); });
  links.addEventListener("dragend", () => { from = null; links.querySelectorAll(".is-drag, .is-over").forEach((x) => x.classList.remove("is-drag", "is-over")); });
  links.addEventListener("drop", async (e) => {
    const t = e.target.closest(".link[data-i]"); if (from === null || !t) return; e.preventDefault();
    const to = +t.dataset.i; await moveTopToCustom();
    const S = C.S(); const [m] = S.custom.splice(from, 1); S.custom.splice(to, 0, m);
    from = null; await C.persist(); drawLinks();
  });

  // the dialog
  $("#scUrl").addEventListener("input", () => { clearTimeout(pvT); pvT = setTimeout(preview, 350); });
  $("#scCancel").addEventListener("click", () => dlg().close());
  $("#scForm").addEventListener("submit", (e) => {
    e.preventDefault();
    let u = $("#scUrl").value.trim();
    if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
    let url; try { url = new URL(u); if (!url.hostname.includes(".") && url.hostname !== "localhost") throw 0; } catch (err) { $("#scUrl").focus(); $("#scUrl").classList.add("is-nudge"); setTimeout(() => $("#scUrl").classList.remove("is-nudge"), 400); return; }
    const origin = url.origin + "/*";
    // must be asked for right away, while the click still counts as the user's
    const perm = ext && chrome.permissions ? chrome.permissions.request({ origins: [origin] }).catch(() => false) : Promise.resolve(false);
    (async () => {
      $("#scSave").disabled = true; $("#scSave").textContent = "Getting icon…";
      const granted = await perm;
      const icon = granted || !ext ? await findSiteIcon(url.href) : null;
      if (granted) chrome.permissions.remove({ origins: [origin] }).catch(() => {});
      await moveTopToCustom();
      const S = C.S(), entry = { t: $("#scName").value.trim() || host(url.href), u: url.href };
      if (icon) entry.icon = icon;
      if (editIndex === null) S.custom.push(entry); else S.custom[editIndex] = entry;
      await C.persist(); await drawLinks(); dlg().close();
      C.toast(icon ? `${entry.t} added with its own icon.` : `${entry.t} added.`);
    })();
  });
  dlg().addEventListener("click", (e) => { if (e.target === dlg()) dlg().close(); }); // click outside closes

  // dock: magnify like a macOS dock, folders open a grid
  const dock = $("#dock");
  dock.addEventListener("pointermove", (e) => {
    dock.querySelectorAll(".dk").forEach((d) => {
      const r = d.getBoundingClientRect(), dx = Math.abs(e.clientX - (r.left + r.width / 2));
      d.style.setProperty("--s", (1 + 0.55 * Math.max(0, 1 - dx / 130)).toFixed(3));
    });
  });
  let tip = null;
  dock.addEventListener("pointerover", (e) => {
    const d = e.target.closest(".dk"); if (!d) return;
    if (!tip) { tip = document.createElement("div"); tip.className = "dk-tip"; document.body.append(tip); }
    tip.textContent = d.dataset.label; tip.classList.add("is-on");
    const place = () => { const r = d.getBoundingClientRect(); tip.style.left = r.left + r.width / 2 + "px"; tip.style.top = r.top - 10 + "px"; };
    place(); setTimeout(place, 150); // again once the magnify has settled
  });
  dock.addEventListener("pointerleave", () => { dock.querySelectorAll(".dk").forEach((d) => d.style.removeProperty("--s")); if (tip) tip.classList.remove("is-on"); });
  let rz = 0; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawDock, 200); });
  dock.addEventListener("click", (e) => {
    if (e.target.closest("[data-import]")) { try { chrome.tabs.create({ url: navigator.userAgent.includes("Edg/") ? "edge://settings/profiles/importBrowsingData" : "chrome://settings/importData" }); } catch (x) {} return; }
    const f = e.target.closest("[data-folder]"); if (f) { if (tip) tip.classList.remove("is-on"); stack.length = 0; openFolder(f.dataset.folder, f.dataset.name, f); }
  });
  $("#dockPop").addEventListener("click", (e) => {
    const s = e.target.closest("[data-sub]"); if (s) return openFolder(s.dataset.sub, s.dataset.name, null);
    if (e.target.closest("[data-back]")) { stack.pop(); const p = stack[stack.length - 1]; openFolder(p.id, p.name, null, false); }
  });
  if (ext && chrome.bookmarks) ["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered"].forEach((ev) => chrome.bookmarks[ev] && chrome.bookmarks[ev].addListener(() => drawDock()));

  $("#appsBtn").addEventListener("click", () => ($("#appsPop").hidden ? openApps() : closeApps()));
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("#appsPop, #appsBtn")) closeApps();
    if (!e.target.closest("#dockPop, #dock")) closeFolder();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeApps(); closeFolder(); } });
}

// Every bookmark folder, for the dock's folder picker in Settings.
export async function bookmarkFolders() {
  const out = [["auto", "Bookmarks bar (all of them)"], ["all", "All bookmarks"]];
  if (!(ext && chrome.bookmarks)) return out;
  const tops = await topFolders();
  // with both device and account bookmarks there are two "Bookmarks bar" folders; say which is which
  const both = tops.some((r) => r.syncing) && tops.some((r) => !r.syncing);
  const walk = (n, depth) => { for (const c of n.children || []) if (!c.url) { out.push([c.id, "\u00a0\u00a0".repeat(depth) + (c.title || "Untitled")]); walk(c, depth + 1); } };
  for (const r of tops) { out.push([r.id, (r.title || "Bookmarks") + (both ? (r.syncing ? " · Google account" : " · this device") : "")]); walk(r, 1); }
  return out;
}
