// Image size finder: hover any image (including CSS backgrounds, SVGs, videos
// and canvases) to see its real resolution next to the size it's shown at.
// Click one for the details; "All images" lists every image on the page.
(() => {
  const UI = window.__devtabUI;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const ratio = (w, h) => { if (!w || !h) return "–"; const g = gcd(w, h), a = w / g, b = h / g; return a <= 32 && b <= 32 ? `${a}:${b}` : (w / h).toFixed(2) + ":1"; };
  const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(2) + " MB" : n > 0 ? Math.round(n / 1024) + " KB" : "");
  const typeOf = (src) => { if (!src) return ""; if (src.startsWith("data:")) return (src.slice(5, src.indexOf(";")) || "").split("/")[1].toUpperCase(); const m = /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)(\?|#|$)/i.exec(src); return m ? m[1].toUpperCase().replace("JPEG", "JPG") : ""; };
  const sizeOf = (src) => { try { const e = performance.getEntriesByName(new URL(src, location.href).href)[0]; return e ? e.encodedBodySize || e.transferSize || 0 : 0; } catch (e) { return 0; } };
  const bgUrl = (el) => { const m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage || ""); return m ? m[1] : null; };
  const cache = new Map();
  const natural = (src) => cache.get(src) || (cache.set(src, new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([0, 0]); i.src = src; })), cache.get(src));

  // What counts as "an image" at this point on the page?
  async function info(el) {
    const r = el.getBoundingClientRect(), shown = [Math.round(r.width), Math.round(r.height)];
    if (el.tagName === "IMG") { const src = el.currentSrc || el.src; return { el, kind: "img", src, nat: [el.naturalWidth, el.naturalHeight], shown, alt: el.alt }; }
    if (el.tagName === "VIDEO") return { el, kind: "video", src: el.currentSrc, nat: [el.videoWidth, el.videoHeight], shown };
    if (el.tagName === "CANVAS") return { el, kind: "canvas", src: "", nat: [el.width, el.height], shown };
    if (el.tagName.toLowerCase() === "svg") { const vb = el.viewBox && el.viewBox.baseVal; return { el, kind: "svg", src: "", nat: vb && vb.width ? [Math.round(vb.width), Math.round(vb.height)] : shown, shown, vector: true }; }
    const bg = bgUrl(el); if (bg) return { el, kind: "background", src: new URL(bg, location.href).href, nat: await natural(new URL(bg, location.href).href), shown };
    return null;
  }
  function pick(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.tagName === "DEVTAB-TOOL") continue;
      const t = el.tagName;
      if (t === "IMG" || t === "VIDEO" || t === "CANVAS" || t.toLowerCase() === "svg") return el;
      if (el.closest && el.closest("svg") && el.closest("svg") !== el) return el.closest("svg");
      if (bgUrl(el)) return el;
    }
    return null;
  }

  window.__devtabImages = () => {
    const { w } = UI.open(`
      .thumb { width: 100%; max-height: 180px; object-fit: contain; border-radius: 12px; background: repeating-conic-gradient(#2a2d3a 0 25%, #1c1f2a 0 50%) 0 0 / 16px 16px; margin: 12px 0 6px; }
      .w.hk .thumb { border-radius: 2px; }
      .big { font: 800 26px Consolas, monospace; color: var(--fg); margin: 6px 0 2px; }
      .warn { color: #ffcf6b; } .ok { color: #5bd6a4; }
      .list { position: fixed; top: 70px; right: 14px; bottom: 14px; width: 340px; overflow: auto; padding: 14px; border-radius: 20px; background: var(--bg); border: 1px solid var(--ln); pointer-events: auto; animation: p .3s; }
      .w.hk .list { border-radius: 2px; }
      .it { all: unset; cursor: pointer; display: flex; gap: 10px; align-items: center; width: 100%; padding: 8px; border-radius: 12px; box-sizing: border-box; }
      .it:hover { background: rgba(255,255,255,.06); }
      .it img { width: 54px; height: 40px; object-fit: cover; border-radius: 8px; flex: none; background: #222; }
      .it b { display: block; font: 700 13px Consolas, monospace; } .it small { color: var(--mu); font-size: 11px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 230px; }`);
    const hud = document.createElement("div"); hud.className = "hud";
    const all = [...document.images].filter((i) => i.naturalWidth > 1);
    hud.innerHTML = `<b>🖼 Image size finder</b><span>hover any image · click for details</span><button class="btn g" data-list>All images (${all.length})</button><button class="btn g" data-q>Exit</button>`;
    const box = document.createElement("div"); box.className = "box"; box.style.display = "none";
    const tag = document.createElement("div"); tag.className = "tag"; tag.style.display = "none";
    w.append(box, tag, hud);
    let cur = null, pinned = false, seq = 0;

    UI.on(document, "mousemove", async (e) => {
      if (pinned) return;
      const el = pick(e.clientX, e.clientY), n = ++seq;
      if (!el) { box.style.display = tag.style.display = "none"; cur = null; return; }
      const i = await info(el); if (n !== seq || !i) return;
      cur = i;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { display: "", left: r.left - 3 + "px", top: r.top - 3 + "px", width: r.width + 6 + "px", height: r.height + 6 + "px" });
      const k = i.nat[0] && i.shown[0] ? i.nat[0] / i.shown[0] : 0;
      tag.innerHTML = `<b>${i.vector ? "Vector · " : ""}${i.nat[0]} × ${i.nat[1]}</b>shown at ${i.shown[0]} × ${i.shown[1]}${k ? ` · <span class="${k < 0.98 ? "warn" : "ok"}">${k.toFixed(2)}×</span>` : ""}${typeOf(i.src) ? " · " + typeOf(i.src) : ""}${kb(sizeOf(i.src)) ? " · " + kb(sizeOf(i.src)) : ""}`;
      tag.style.display = ""; UI.place(tag, e.clientX + 6, e.clientY + 40);
    }, true);
    UI.on(document, "click", (e) => {
      if (e.composedPath().some((n) => n.tagName === "DEVTAB-TOOL")) return;
      if (!cur || pinned) return;
      e.preventDefault(); e.stopPropagation(); details(cur, e.clientX, e.clientY);
    }, true);

    function details(i, x, y) {
      pinned = true; tag.style.display = "none";
      const k = i.nat[0] && i.shown[0] ? i.nat[0] / i.shown[0] : 0, size = sizeOf(i.src);
      const verdict = !k ? "" : k < 0.98 ? `<span class="warn">Upscaled: shown bigger than it is, so it may look blurry.</span>` : k > 2.2 ? `<span class="warn">Much bigger than shown: could be resized to save ${size ? "bandwidth" : "data"}.</span>` : `<span class="ok">Sharp: the right size for where it's shown${k >= 1.9 ? " (retina-ready)" : ""}.</span>`;
      const p = document.createElement("div"); p.className = "panel";
      p.innerHTML = `<button class="x" data-x>×</button><h3>${{ img: "Image", background: "Background image", svg: "SVG", video: "Video", canvas: "Canvas" }[i.kind]}</h3>
        ${i.src && i.kind !== "video" ? `<img class="thumb" src="${UI.esc(i.src)}" alt="">` : ""}
        <div class="big">${i.nat[0]} × ${i.nat[1]}</div><p>${verdict}</p>
        <div class="row"><span class="k">Shown at</span><span class="v">${i.shown[0]} × ${i.shown[1]}${k ? ` (${k.toFixed(2)}×)` : ""}</span></div>
        <div class="row"><span class="k">Aspect ratio</span><span class="v">${ratio(i.nat[0], i.nat[1])}</span></div>
        <div class="row"><span class="k">Megapixels</span><span class="v">${((i.nat[0] * i.nat[1]) / 1e6).toFixed(2)} MP</span></div>
        ${typeOf(i.src) ? `<div class="row"><span class="k">Format</span><span class="v">${typeOf(i.src)}</span></div>` : ""}
        ${size ? `<div class="row"><span class="k">File size</span><span class="v">${kb(size)}</span></div>` : ""}
        ${i.alt !== undefined ? `<div class="row"><span class="k">Alt text</span><span class="v">${i.alt ? UI.esc(i.alt) : '<span class="warn">missing</span>'}</span></div>` : ""}
        ${i.src ? `<div class="row"><span class="k">URL</span><span class="v">${UI.esc(i.src.length > 90 ? i.src.slice(0, 90) + "…" : i.src)}</span><button class="cp" data-copy>Copy</button></div>` : ""}
        <div class="acts">${i.src ? `<button class="btn" data-open>Open image</button>` : ""}<button class="btn g" data-x>Back</button></div>`;
      w.append(p); UI.place(p, x, y);
      const th = p.querySelector(".thumb"); if (th) th.onload = () => UI.place(p, x, y); // it grows once the picture loads
      p.addEventListener("click", async (ev) => {
        if (ev.target.closest("[data-copy]")) { await UI.copy(i.src); UI.toast(w, "Image URL copied"); }
        if (ev.target.closest("[data-open]")) window.open(i.src, "_blank", "noopener");
        if (ev.target.closest("[data-x]")) { p.remove(); pinned = false; }
      });
    }

    hud.querySelector("[data-q]").onclick = () => UI.close();
    hud.querySelector("[data-list]").onclick = () => {
      const old = w.querySelector(".list"); if (old) return old.remove();
      const L = document.createElement("div"); L.className = "list";
      const sorted = all.slice().sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);
      L.innerHTML = `<h3 style="margin:2px 6px 10px;font-size:15px">${sorted.length} images, largest first</h3>` + sorted.map((im, n) => {
        const r = im.getBoundingClientRect(), k = r.width ? im.naturalWidth / r.width : 0;
        return `<button class="it" data-n="${n}"><img src="${UI.esc(im.currentSrc || im.src)}" alt=""><span><b>${im.naturalWidth} × ${im.naturalHeight}</b><small>${r.width ? `shown ${Math.round(r.width)}×${Math.round(r.height)} · ${k.toFixed(1)}×` : "not visible"}${typeOf(im.currentSrc || im.src) ? " · " + typeOf(im.currentSrc || im.src) : ""}</small><small>${UI.esc(im.alt || (im.currentSrc || im.src).split("/").pop().slice(0, 50))}</small></span></button>`;
      }).join("");
      w.append(L);
      L.addEventListener("click", (ev) => { const b = ev.target.closest("[data-n]"); if (!b) return; const im = sorted[+b.dataset.n]; im.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => { const r = im.getBoundingClientRect(); Object.assign(box.style, { display: "", left: r.left - 3 + "px", top: r.top - 3 + "px", width: r.width + 6 + "px", height: r.height + 6 + "px" }); }, 500); });
    };
  };
})();
