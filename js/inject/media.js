// Media downloader: every image on the page (including srcset's largest
// version, CSS backgrounds, inline SVGs and the share image) and every video
// the site serves as a plain file, in one panel. Filter, select, download.
// Videos that stream in pieces (blob:/MediaSource) or come from streaming
// services are listed with a note instead: they can't be saved as a file.
(() => {
  const UI = window.__devtabUI;
  const STREAMING = /(^|\.)(youtube\.com|youtu\.be|netflix\.com|primevideo\.com|hotstar\.com|jiocinema\.com|disneyplus\.com|hulu\.com|instagram\.com|facebook\.com|tiktok\.com|twitch\.tv|spotify\.com|vimeo\.com|dailymotion\.com|x\.com|twitter\.com)$/i;
  const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v|mkv)(\?|#|$)/i;
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (e) { return null; } };
  const extOf = (u) => { if (!u) return ""; if (u.startsWith("data:")) { const m = /^data:image\/([a-z0-9.+-]+)/i.exec(u); return m ? m[1].toLowerCase().replace("svg+xml", "svg").replace("jpeg", "jpg") : ""; } const m = /\.([a-z0-9]{2,5})(\?|#|$)/i.exec(new URL(u).pathname); return m ? m[1].toLowerCase().replace("jpeg", "jpg") : ""; };
  const nameOf = (u, i, fallbackExt) => {
    let base = "", ext = extOf(u) || fallbackExt;
    try { if (!u.startsWith("data:")) base = decodeURIComponent(new URL(u).pathname.split("/").pop() || ""); } catch (e) {}
    base = base.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^\w\-. ]+/g, "_").slice(0, 60) || `${fallbackExt === "svg" ? "vector" : "image"}-${i + 1}`;
    return `${base}.${ext || "jpg"}`;
  };
  // the biggest candidate in a srcset
  const bestSrcset = (ss) => { if (!ss) return null; let best = null, bw = 0; for (const part of ss.split(",")) { const [u, d] = part.trim().split(/\s+/); const w = d ? parseFloat(d) * (d.endsWith("x") ? 1000 : 1) : 1; if (u && w >= bw) { bw = w; best = u; } } return best && abs(best); };

  function collectImages() {
    const seen = new Map();
    const add = (url, from, el) => { if (!url) return; if (!/^(https?:|data:image)/.test(url)) return; if (!seen.has(url)) seen.set(url, { url, from, el }); };
    for (const img of document.images) { add(bestSrcset(img.srcset) || abs(img.currentSrc || img.src), "img", img); }
    for (const s of document.querySelectorAll("picture source[srcset]")) add(bestSrcset(s.srcset), "img", s.parentElement.querySelector("img"));
    let n = 0;
    for (const el of document.querySelectorAll("body *")) {
      if (++n > 4000) break;
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== "none") for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) add(abs(m[1]), "background", el);
    }
    for (const svg of document.querySelectorAll("svg")) {
      const r = svg.getBoundingClientRect(); if (r.width < 16 || r.height < 16) continue;
      const c = svg.cloneNode(true); c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      if (!c.getAttribute("width")) c.setAttribute("width", Math.round(r.width)); if (!c.getAttribute("height")) c.setAttribute("height", Math.round(r.height));
      add("data:image/svg+xml;charset=utf-8," + encodeURIComponent(c.outerHTML), "svg", svg);
    }
    for (const m of document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')) add(abs(m.content), "share image", null);
    return [...seen.values()];
  }

  function collectVideos() {
    const out = new Map(), streams = [];
    const add = (url, el) => { url = abs(url); if (!url || !/^https?:/.test(url) || out.has(url)) return; out.set(url, { url, el }); };
    for (const v of document.querySelectorAll("video")) {
      const src = v.currentSrc || v.src;
      if (src && src.startsWith("blob:")) { streams.push(v); continue; }
      if (src) add(src, v);
      for (const s of v.querySelectorAll("source[src]")) if (!s.src.startsWith("blob:")) add(s.src, v);
    }
    for (const a of document.querySelectorAll("a[href]")) if (VIDEO_EXT.test(a.href)) add(a.href, null);
    for (const m of document.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]')) if (VIDEO_EXT.test(m.content)) add(m.content, null);
    for (const e of performance.getEntriesByType("resource")) if (VIDEO_EXT.test(e.name) && !/\.(m4s|ts)(\?|$)/i.test(e.name)) add(e.name, null);
    return { files: [...out.values()], streams };
  }

  const size = (u) => new Promise((res) => { if (u.startsWith("data:image/svg")) { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([0, 0]); i.src = u; return; } const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([0, 0]); i.src = u; });
  const fmtDur = (s) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "");

  window.__devtabMedia = async () => {
    const { w } = UI.open(`
      .side { position: fixed; top: 12px; right: 12px; bottom: 12px; width: min(460px, calc(100vw - 24px)); display: flex; flex-direction: column; border-radius: 22px; background: var(--bg); border: 1px solid var(--ln); box-shadow: 0 30px 80px rgba(0,0,0,.6); backdrop-filter: blur(20px); pointer-events: auto; animation: sIn .35s cubic-bezier(.2,1.2,.35,1); overflow: hidden; }
      @keyframes sIn { from { transform: translateX(30px); opacity: 0; } }
      .w.hk .side { border-radius: 2px; border-color: var(--a); }
      .hd { padding: 16px 16px 10px; border-bottom: 1px solid var(--ln); position: relative; }
      .hd h3 { margin: 0; font-size: 17px; } .hd p { margin: 2px 0 10px; font-size: 12.5px; color: var(--mu); }
      .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: rgba(0,0,0,.3); }
      .tabs button { all: unset; cursor: pointer; flex: 1; text-align: center; padding: 8px; border-radius: 9px; font-size: 13px; font-weight: 600; color: var(--mu); }
      .tabs button[aria-pressed="true"] { background: var(--a); color: #0a0a0a; }
      .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px 16px; border-bottom: 1px solid var(--ln); font-size: 12px; color: var(--mu); }
      .chip { all: unset; cursor: pointer; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--ln); font-size: 11.5px; color: var(--mu); }
      .chip[aria-pressed="true"] { border-color: var(--a); color: var(--fg); background: color-mix(in srgb, var(--a) 18%, transparent); }
      .w.hk .tabs, .w.hk .tabs button, .w.hk .chip { border-radius: 2px; }
      .grid { flex: 1; min-height: 0; overflow: auto; padding: 12px 16px; display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 128px; gap: 8px; align-content: start; }
      .cell { position: relative; border-radius: 12px; overflow: hidden; background: repeating-conic-gradient(#2a2d3a 0 25%, #1f2230 0 50%) 0 0 / 14px 14px; cursor: pointer; outline: 2px solid transparent; transition: outline-color .15s, transform .15s; }
      .w.hk .cell { border-radius: 2px; }
      .cell:hover { transform: translateY(-2px); }
      .cell.on { outline-color: var(--a); }
      .cell img { width: 100%; height: 100%; object-fit: contain; display: block; }
      .cell .meta { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 6px 5px; background: linear-gradient(transparent, rgba(0,0,0,.85)); font: 600 10.5px Consolas, monospace; color: #fff; }
      .cell .ck { position: absolute; top: 6px; left: 6px; width: 20px; height: 20px; border-radius: 6px; background: rgba(0,0,0,.55); border: 1.5px solid rgba(255,255,255,.7); display: grid; place-items: center; color: #0a0a0a; font-size: 13px; font-weight: 800; }
      .cell.on .ck { background: var(--a); border-color: var(--a); }
      .cell .dl { all: unset; cursor: pointer; position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 8px; background: rgba(0,0,0,.6); color: #fff; display: grid; place-items: center; font-size: 14px; opacity: 0; transition: opacity .15s; }
      .cell:hover .dl { opacity: 1; } .cell .dl:hover { background: var(--a); color: #0a0a0a; }
      .vlist { flex: 1; overflow: auto; padding: 12px 16px; display: grid; gap: 8px; align-content: start; }
      .vid { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 14px; border: 1px solid var(--ln); background: rgba(255,255,255,.03); }
      .w.hk .vid { border-radius: 2px; }
      .vid .th { width: 96px; height: 60px; flex: none; border-radius: 9px; background: #111 center / cover; display: grid; place-items: center; color: rgba(255,255,255,.7); font-size: 20px; }
      .vid b { display: block; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
      .vid small { display: block; font-size: 11.5px; color: var(--mu); }
      .vid .btn { margin-left: auto; flex: none; }
      .note { margin: 4px 0 0; padding: 12px 14px; border-radius: 14px; background: rgba(255, 207, 107, .1); color: #ffd98a; font-size: 12.5px; line-height: 1.5; }
      .empty { grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--mu); font-size: 13px; }
      .ft { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--ln); }
      .ft span { flex: 1; font-size: 12.5px; color: var(--mu); }`);
    const side = document.createElement("div"); side.className = "side"; w.append(side);
    const host = location.hostname.replace(/^www\./, "");
    side.innerHTML = `<div class="hd"><button class="x" data-q>×</button><h3>⬇ Media downloader</h3><p>${UI.esc(host)} · saved to Downloads/${UI.esc(host)}</p>
      <div class="tabs"><button data-tab="img" aria-pressed="true">Images <span data-ni>…</span></button><button data-tab="vid" aria-pressed="false">Videos <span data-nv>…</span></button></div></div>
      <div data-body style="display:contents"></div>`;
    side.querySelector("[data-q]").onclick = () => UI.close();

    // gather everything first
    const imgs = collectImages();
    const vids = collectVideos();
    side.querySelector("[data-nv]").textContent = `(${vids.files.length})`;
    await Promise.all(imgs.map(async (it, i) => { it.dim = await size(it.url); it.ext = extOf(it.url) || (it.from === "svg" ? "svg" : ""); it.name = nameOf(it.url, i, it.from === "svg" ? "svg" : "jpg"); }));
    const usable = imgs.filter((x) => x.dim[0] > 1 && x.dim[1] > 1).sort((a, b) => b.dim[0] * b.dim[1] - a.dim[0] * a.dim[1]);
    side.querySelector("[data-ni]").textContent = `(${usable.length})`;

    let tab = "img", minSize = 0, type = "all";
    const sel = new Set();
    const send = (items) => chrome.runtime.sendMessage({ type: "download", host, items });
    const shown = () => usable.filter((x) => Math.max(...x.dim) >= minSize && (type === "all" || (type === "jpg" ? /^(jpg|jpeg)$/.test(x.ext) : x.ext === type)));

    const body = side.querySelector("[data-body]");
    function drawImages() {
      const list = shown();
      const types = ["all", ...new Set(usable.map((x) => x.ext).filter(Boolean))].slice(0, 7);
      body.innerHTML = `<div class="bar">Size ${[[0, "All"], [100, "100px+"], [500, "500px+"], [1000, "1000px+"]].map(([v, n]) => `<button class="chip" data-min="${v}" aria-pressed="${v === minSize}">${n}</button>`).join("")}
          <span style="width:100%;height:0"></span>Type ${types.map((t) => `<button class="chip" data-type="${t}" aria-pressed="${t === type}">${t === "all" ? "All" : t.toUpperCase()}</button>`).join("")}</div>
        <div class="grid">${list.map((x) => `<div class="cell${sel.has(x.url) ? " on" : ""}" data-u="${UI.esc(x.url)}" title="${UI.esc(x.name)}"><img src="${UI.esc(x.url)}" alt="" loading="lazy"><span class="ck">${sel.has(x.url) ? "✓" : ""}</span><button class="dl" data-one="${UI.esc(x.url)}" title="Download">⬇</button><span class="meta">${x.dim[0]}×${x.dim[1]}${x.ext ? " · " + x.ext.toUpperCase() : ""}</span></div>`).join("") || `<p class="empty">No images match these filters.</p>`}</div>
        <div class="ft"><span>${sel.size ? `${sel.size} selected` : `${list.length} images`}</span><button class="btn g" data-all>${list.length && list.every((x) => sel.has(x.url)) ? "Clear" : "Select all"}</button><button class="btn" data-get ${list.length ? "" : "disabled"}>${sel.size ? `Download ${sel.size}` : `Download all ${list.length}`}</button></div>`;
    }
    function drawVideos() {
      const blocked = STREAMING.test(location.hostname);
      body.innerHTML = `<div class="vlist">
        ${blocked ? `<p class="note">${UI.esc(host)} streams its videos in protected pieces, and its terms don't allow downloading them, so DevTab doesn't save videos here. Many sites offer their own download or offline option.</p>` : ""}
        ${!blocked ? vids.files.map((v, i) => { const el = v.el, d = el ? fmtDur(el.duration) : "", res = el && el.videoWidth ? `${el.videoWidth}×${el.videoHeight}` : ""; return `<div class="vid"><span class="th" style="${el && el.poster ? `background-image:url('${UI.esc(el.poster)}')` : ""}">▶</span><span><b title="${UI.esc(v.url)}">${UI.esc(nameOf(v.url, i, "mp4"))}</b><small>${[res, d, (extOf(v.url) || "video").toUpperCase()].filter(Boolean).join(" · ")}</small></span><button class="btn" data-v="${UI.esc(v.url)}">Download</button></div>`; }).join("") : ""}
        ${!blocked && !vids.files.length ? `<p class="empty">No downloadable video files on this page.</p>` : ""}
        ${!blocked && vids.streams.length ? `<p class="note">${vids.streams.length} video${vids.streams.length === 1 ? " streams" : "s stream"} in pieces (it plays from a <code>blob:</code> address), so there's no single file to save.</p>` : ""}
      </div>`;
    }
    const draw = () => (tab === "img" ? drawImages() : drawVideos());
    draw();

    side.addEventListener("click", async (e) => {
      const t = e.target;
      const tb = t.closest("[data-tab]"); if (tb) { tab = tb.dataset.tab; side.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b === tb))); return draw(); }
      const mn = t.closest("[data-min]"); if (mn) { minSize = +mn.dataset.min; return draw(); }
      const ty = t.closest("[data-type]"); if (ty) { type = ty.dataset.type; return draw(); }
      const one = t.closest("[data-one]"); if (one) { const x = usable.find((y) => y.url === one.dataset.one); await send([{ url: x.url, filename: x.name }]); return UI.toast(w, `Saving ${x.name}`); }
      const cell = t.closest(".cell"); if (cell) { const u = cell.dataset.u; sel.has(u) ? sel.delete(u) : sel.add(u); return draw(); }
      if (t.closest("[data-all]")) { const list = shown(); if (list.every((x) => sel.has(x.url))) list.forEach((x) => sel.delete(x.url)); else list.forEach((x) => sel.add(x.url)); return draw(); }
      if (t.closest("[data-get]")) {
        const list = sel.size ? usable.filter((x) => sel.has(x.url)) : shown();
        const r = await send(list.map((x) => ({ url: x.url, filename: x.name })));
        UI.toast(w, r && r.ok ? `Downloading ${list.length} image${list.length === 1 ? "" : "s"} to Downloads/${host}` : (r && r.error) || "Download failed");
        return;
      }
      const v = t.closest("[data-v]"); if (v) { const r = await send([{ url: v.dataset.v, filename: nameOf(v.dataset.v, 0, "mp4") }]); UI.toast(w, r && r.ok ? "Video download started" : (r && r.error) || "Download failed"); }
    });
  };
})();
