// Website X-ray: hover anything for a holographic scan (box model, size,
// font, colours, layout). ↑/↓ walk up and down the page structure. Click to
// pin it: see its styles and HTML, or "Steal component" to get that section
// as clean, standalone HTML + CSS with a live preview.
(() => {
  const UI = window.__devtabUI;

  /* ---------- steal: rebuild a section as clean HTML + CSS ---------- */
  const INHERITED = ["color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform", "white-space", "cursor", "list-style-type"];
  const OWN = ["display", "position", "top", "right", "bottom", "left", "flex-direction", "flex-wrap", "justify-content", "align-items", "align-content", "align-self", "flex-grow", "flex-shrink", "flex-basis", "order", "row-gap", "column-gap",
    "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "max-width", "min-width", "min-height", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-top", "border-right", "border-bottom", "border-left", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
    "background-color", "background-image", "background-size", "background-position", "background-repeat", "box-shadow", "opacity", "overflow", "object-fit", "text-decoration-line", "vertical-align", "z-index"];
  const SIZED = /^(IMG|SVG|VIDEO|CANVAS|IFRAME|INPUT|BUTTON|SELECT|TEXTAREA|PICTURE)$/i;
  const PSEUDO = ["content", "display", "position", "top", "right", "bottom", "left", "width", "height", "margin", "padding", "color", "background-color", "background-image", "border", "border-radius", "font-size", "font-weight", "transform", "opacity"];
  let defFrame = null; const defCache = {};
  function defaults(tag) {
    if (defCache[tag]) return defCache[tag];
    if (!defFrame || !defFrame.isConnected) {
      defFrame = document.createElement("iframe"); defFrame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
      document.documentElement.append(defFrame); UI.cleanup.push(() => { defFrame && defFrame.remove(); defFrame = null; });
      const d = defFrame.contentDocument; d.open(); d.write("<!doctype html><html><head></head><body></body></html>"); d.close(); // standards mode, like real pages
    }
    const d = defFrame.contentDocument, e = d.createElement(tag); if (tag === "a") e.setAttribute("href", "#"); d.body.append(e);
    const cs = d.defaultView.getComputedStyle(e), out = {};
    for (const p of OWN) out[p] = cs.getPropertyValue(p);
    e.remove(); return (defCache[tag] = out);
  }
  const abs = (u) => { try { return new URL(u, location.href).href; } catch (e) { return u; } };
  const urls = (v) => v.replace(/url\(["']?([^"')]+)["']?\)/g, (m, u) => `url("${abs(u)}")`);
  // margin-top/right/bottom/left → margin: …, and the same for padding, borders and corners
  function compact(d) {
    const four = (name, keys) => {
      const v = keys.map((k) => d[k]); if (v.some((x) => x === undefined)) return;
      keys.forEach((k) => delete d[k]);
      d[name] = v[0] === v[1] && v[1] === v[2] && v[2] === v[3] ? v[0] : v[1] === v[3] ? (v[0] === v[2] ? `${v[0]} ${v[1]}` : `${v[0]} ${v[1]} ${v[2]}`) : v.join(" ");
    };
    four("margin", ["margin-top", "margin-right", "margin-bottom", "margin-left"]);
    four("padding", ["padding-top", "padding-right", "padding-bottom", "padding-left"]);
    four("border-radius", ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"]);
    const b = ["border-top", "border-right", "border-bottom", "border-left"];
    if (b.every((k) => d[k] !== undefined && d[k] === d["border-top"])) { d.border = d["border-top"]; b.forEach((k) => delete d[k]); }
    if (d["row-gap"] !== undefined && d["row-gap"] === d["column-gap"]) { d.gap = d["row-gap"]; delete d["row-gap"]; delete d["column-gap"]; }
    return d;
  }
  const block = (sel, d) => { const k = Object.keys(d); return k.length ? `${sel} {\n${k.map((p) => `  ${p}: ${d[p]};`).join("\n")}\n}` : ""; };
  // tidy, indented HTML
  const INLINE = /^(a|abbr|b|bdi|bdo|br|cite|code|data|dfn|em|i|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|u|var|img|svg|button|input|label|select|textarea)$/;
  function pretty(node, depth = 0) {
    const pad = "  ".repeat(depth);
    if (node.nodeType === 3) { const t = node.textContent.replace(/\s+/g, " ").trim(); return t ? pad + UI.esc(t) : ""; }
    const tag = node.tagName.toLowerCase(), open = node.outerHTML.slice(0, node.outerHTML.indexOf(">") + 1);
    if (tag === "svg" || /^(img|br|input|hr)$/.test(tag)) return pad + node.outerHTML.replace(/\s*\n\s*/g, "");
    const kids = [...node.childNodes].filter((c) => c.nodeType === 1 || c.textContent.trim());
    // keep it on one line when it only holds text and small inline bits
    if (node.outerHTML.length < 140 && kids.every((c) => c.nodeType === 3 || INLINE.test(c.tagName.toLowerCase()))) return pad + node.outerHTML.replace(/\s+/g, " ");
    return [pad + open, ...kids.map((c) => pretty(c, depth + 1)).filter(Boolean), `${pad}</${tag}>`].join("\n");
  }
  function steal(root) {
    const rules = [], map = new Map(); let n = 0;
    const walk = (el, parentCS) => {
      if (n >= 400) return;
      const cs = getComputedStyle(el), tag = el.tagName.toLowerCase(), def = defaults(tag), d = {};
      if (cs.display === "none") return;
      for (const p of OWN) {
        let v = cs.getPropertyValue(p);
        if (v === def[p]) continue;
        if (["top", "right", "bottom", "left", "z-index"].includes(p) && cs.position === "static") continue;
        if ((p === "min-width" || p === "min-height") && v === "auto") continue;
        if (/^border-(top|right|bottom|left)$/.test(p) && /^0px/.test(v)) continue;
        if (p === "background-image" && v !== "none") v = urls(v);
        d[p] = v;
      }
      for (const p of INHERITED) { const v = cs.getPropertyValue(p); if (!parentCS || v !== parentCS.getPropertyValue(p)) d[p] = v; }
      const r = el.getBoundingClientRect();
      if (SIZED.test(tag)) { d.width = Math.round(r.width) + "px"; d.height = Math.round(r.height) + "px"; }
      if (!parentCS) { d["box-sizing"] = "border-box"; if (!d["max-width"] || d["max-width"] === "none") d["max-width"] = Math.round(r.width) + "px"; }
      const cls = `dt-${++n}`;
      map.set(el, cls);
      const rule = block("." + cls, compact(d)); if (rule) rules.push(rule);
      // ::before / ::after decorations (icons, bullets, overlays)
      for (const ps of ["::before", "::after"]) {
        const pc = getComputedStyle(el, ps), c = pc.content;
        if (!c || c === "none" || c === "normal") continue;
        const pd = {};
        for (const p of PSEUDO) {
          let v = pc.getPropertyValue(p);
          if (!v || v === "none" || v === "auto" || v === "normal" || v === "0px" || /^0px none/.test(v) || (p === "position" && v === "static") || (p === "opacity" && v === "1")) continue;
          if (p === "background-image") v = urls(v);
          pd[p] = v;
        }
        rules.push(block(`.${cls}${ps}`, pd));
      }
      if (tag !== "svg") for (const c of el.children) walk(c, cs);
    };
    walk(root, null);
    // a clean copy: only our classes and the attributes that matter
    const KEEP = ["href", "src", "alt", "type", "placeholder", "title", "aria-label", "role", "colspan", "rowspan", "for", "name", "value", "width", "height", "target", "rel"];
    const svgCopy = (el) => {
      const c = el.cloneNode(true);
      // paint that came from the site's stylesheet goes inline
      const src = [el, ...el.querySelectorAll("*")], dst = [c, ...c.querySelectorAll("*")];
      if (src.length === dst.length) src.forEach((s, i) => {
        const t = dst[i]; if (t.tagName !== s.tagName) return;
        const k = getComputedStyle(s);
        for (const p of ["fill", "stroke", "stroke-width"]) if (!t.getAttribute(p) && k.getPropertyValue(p)) t.setAttribute(p, k.getPropertyValue(p));
        t.removeAttribute("class");
      });
      // icons drawn from a sprite elsewhere on the page: bring the drawing in
      c.querySelectorAll("use").forEach((u) => {
        const ref = (u.getAttribute("href") || u.getAttribute("xlink:href") || "").trim();
        const sym = ref.startsWith("#") && document.getElementById(ref.slice(1));
        if (!sym) return;
        if (sym.getAttribute("viewBox") && !c.getAttribute("viewBox")) c.setAttribute("viewBox", sym.getAttribute("viewBox"));
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        for (const k of sym.childNodes) g.append(k.cloneNode(true));
        u.replaceWith(g);
      });
      c.removeAttribute("style");
      c.setAttribute("class", map.get(el) || "");
      return c;
    };
    const copy = (el) => {
      const tag = el.tagName.toLowerCase();
      if (!map.has(el) || /^(script|noscript|style|link|template)$/.test(tag)) return null; // hidden, past the size limit, or code
      if (tag === "svg") return svgCopy(el);
      const c = document.createElement(tag);
      for (const a of KEEP) if (el.hasAttribute(a)) c.setAttribute(a, a === "href" || a === "src" ? abs(el.getAttribute(a)) : el.getAttribute(a));
      if (tag === "img" && el.currentSrc) c.setAttribute("src", el.currentSrc);
      c.setAttribute("class", map.get(el));
      for (const ch of el.childNodes) {
        if (ch.nodeType === 3) c.append(ch.textContent);
        else if (ch.nodeType === 1) { const k = copy(ch); if (k) c.append(k); }
      }
      return c;
    };
    const html = pretty(copy(root));
    const css = rules.join("\n\n");
    const host = location.hostname.replace(/^www\./, "");
    const fonts = [...new Set([...map.keys()].map((e) => getComputedStyle(e).fontFamily.split(",")[0].replace(/["']/g, "").trim()))].filter((f) => f && !/^(system-ui|sans-serif|serif|monospace|-apple-system|inherit)$/i.test(f));
    const note = fonts.length ? `/* Fonts used: ${fonts.join(", ")}. Load them (e.g. from Google Fonts) for an exact match. */\n` : "";
    return { html, css: note + css, count: n, capped: n >= 400, full: `<!doctype html>\n<!-- Component from ${host}, rebuilt with DevTab X-ray -->\n<meta charset="utf-8">\n<style>\nbody { margin: 24px; }\n${note}${css}\n</style>\n${html}\n` };
  }

  /* ---------- the scanner ---------- */
  window.__devtabXray = () => {
    const { w } = UI.open(`
      .xb, .xm, .xp { position: fixed; pointer-events: none; transition: all .07s ease-out; }
      .xm { background: rgba(255, 166, 77, .22); } .xp { background: rgba(91, 214, 164, .25); }
      .xb { border: 1.5px solid var(--a); background: color-mix(in srgb, var(--a) 14%, transparent); box-shadow: 0 0 22px color-mix(in srgb, var(--a) 60%, transparent); overflow: hidden; }
      .xb::after { content: ""; position: absolute; left: 0; right: 0; height: 26%; background: linear-gradient(transparent, color-mix(in srgb, var(--a) 40%, transparent), transparent); animation: sc 1.4s linear infinite; }
      @keyframes sc { from { top: -30%; } to { top: 110%; } }
      .xt { position: fixed; pointer-events: none; max-width: 360px; padding: 10px 12px; border-radius: 12px; background: var(--bg); border: 1px solid var(--a); box-shadow: 0 0 30px -8px var(--a), 0 14px 30px rgba(0,0,0,.5); font: 12px Consolas, monospace; color: var(--fg); }
      .w.hk .xt { border-radius: 2px; }
      .xt .tg { color: var(--a); font-weight: 700; font-size: 13px; word-break: break-all; } .xt .tg i { color: #ffd166; font-style: normal; } .xt .tg em { color: #5bd6a4; font-style: normal; }
      .xt .ln { display: flex; gap: 8px; margin-top: 4px; color: var(--mu); } .xt .ln b { color: var(--fg); font-weight: 400; }
      .xt .sw { display: inline-block; width: 11px; height: 11px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35); }
      .xt .hint { margin-top: 6px; color: var(--a); opacity: .8; }
      .side { position: fixed; top: 12px; right: 12px; bottom: 12px; width: min(520px, calc(100vw - 24px)); display: flex; flex-direction: column; border-radius: 20px; background: var(--bg); border: 1px solid var(--ln); box-shadow: 0 30px 80px rgba(0,0,0,.6); pointer-events: auto; overflow: hidden; animation: p .3s; }
      .w.hk .side { border-radius: 2px; border-color: var(--a); }
      .sh { position: relative; padding: 16px 16px 10px; border-bottom: 1px solid var(--ln); } .sh h3 { margin: 0 0 6px; font: 700 14px Consolas, monospace; color: var(--a); word-break: break-all; } .sh p { margin: 0; font-size: 12px; color: var(--mu); }
      .tabs { display: flex; gap: 4px; margin-top: 10px; } .tabs button { all: unset; cursor: pointer; padding: 7px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 600; color: var(--mu); }
      .tabs button[aria-pressed="true"] { background: var(--a); color: #0a0a0a; }
      .sb { flex: 1; overflow: auto; padding: 12px 16px; }
      pre { margin: 0; padding: 12px; border-radius: 12px; background: rgba(0,0,0,.35); font: 12px/1.55 Consolas, monospace; color: #dfe7ff; white-space: pre-wrap; word-break: break-all; max-height: none; }
      .kv { display: grid; grid-template-columns: 140px 1fr; gap: 4px 10px; font: 12px Consolas, monospace; } .kv span { color: var(--mu); } .kv b { font-weight: 400; color: var(--fg); word-break: break-all; }
      iframe { width: 100%; height: 260px; border: 1px solid var(--ln); border-radius: 12px; background: #fff; margin-bottom: 10px; }
      .lbl { margin: 12px 0 6px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--mu); }
      .sf { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 16px; border-top: 1px solid var(--ln); }`);
    const hud = document.createElement("div"); hud.className = "hud";
    hud.innerHTML = `<b>🩻 X-ray</b><span>hover · ↑↓ parent/child · click to inspect</span><button class="btn g" data-q>Exit</button>`;
    const xm = document.createElement("div"); xm.className = "xm"; const xp = document.createElement("div"); xp.className = "xp"; const xb = document.createElement("div"); xb.className = "xb";
    const tip = document.createElement("div"); tip.className = "xt"; tip.style.display = "none";
    w.append(xm, xp, xb, tip, hud);
    hud.querySelector("[data-q]").onclick = () => UI.close();
    let cur = null, pinned = false, mx = 0, my = 0;
    const px = (v) => parseFloat(v) || 0;
    const hex = (c) => { const m = c.match(/[\d.]+/g); if (!m || !/^rgb/.test(c)) return c; return "#" + m.slice(0, 3).map((v) => (+v | 0).toString(16).padStart(2, "0")).join("") + (m[3] !== undefined && +m[3] < 1 ? ` · ${Math.round(m[3] * 100)}%` : ""); };
    function show(el) {
      cur = el; const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const mT = px(cs.marginTop), mR = px(cs.marginRight), mB = px(cs.marginBottom), mL = px(cs.marginLeft), pT = px(cs.paddingTop), pR = px(cs.paddingRight), pB = px(cs.paddingBottom), pL = px(cs.paddingLeft);
      Object.assign(xm.style, { left: r.left - mL + "px", top: r.top - mT + "px", width: r.width + mL + mR + "px", height: r.height + mT + mB + "px" });
      Object.assign(xb.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      Object.assign(xp.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pL}px ${pT}px,${pL}px calc(100% - ${pB}px),calc(100% - ${pR}px) calc(100% - ${pB}px),calc(100% - ${pR}px) ${pT}px,${pL}px ${pT}px)` });
      const cls = [...el.classList].slice(0, 3).map((c) => "." + c).join("");
      const layout = cs.display.includes("flex") ? `flex ${cs.flexDirection}${cs.gap !== "normal" ? " · gap " + cs.gap : ""}` : cs.display.includes("grid") ? `grid · ${cs.gridTemplateColumns.split(" ").length} cols` : cs.display;
      const bg = cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : null;
      tip.innerHTML = `<div class="tg">${el.tagName.toLowerCase()}${el.id ? `<i>#${UI.esc(el.id)}</i>` : ""}<em>${UI.esc(cls)}</em></div>
        <div class="ln"><span>size</span><b>${Math.round(r.width)} × ${Math.round(r.height)}</b><span>${UI.esc(layout)}${cs.position !== "static" ? " · " + cs.position : ""}</span></div>
        <div class="ln"><span>font</span><b>${UI.esc(cs.fontFamily.split(",")[0].replace(/["']/g, ""))} ${cs.fontSize} / ${cs.fontWeight}</b></div>
        <div class="ln"><span>color</span><b><span class="sw" style="background:${cs.color}"></span>${hex(cs.color)}</b>${bg ? `<span>bg</span><b><span class="sw" style="background:${bg}"></span>${hex(bg)}</b>` : ""}</div>
        <div class="ln"><span>box</span><b>pad ${cs.padding} · margin ${cs.margin}</b></div>
        <div class="hint">click to inspect · steal this component</div>`;
      tip.style.display = ""; UI.place(tip, mx + 6, my + 30);
    }
    const pick = (x, y) => { for (const el of document.elementsFromPoint(x, y)) if (!el.tagName.startsWith("DEVTAB-") && el !== document.documentElement && el !== document.body) return el; return null; };
    UI.on(document, "mousemove", (e) => { mx = e.clientX; my = e.clientY; if (pinned) return; const el = pick(mx, my); if (el && el !== cur) show(el); else if (el) UI.place(tip, mx + 6, my + 30); }, true);
    UI.on(document, "keydown", (e) => {
      if (pinned || !cur) return;
      if (e.key === "ArrowUp" && cur.parentElement && cur.parentElement !== document.documentElement) { e.preventDefault(); show(cur.parentElement); }
      if (e.key === "ArrowDown" && cur.firstElementChild) { e.preventDefault(); show(cur.firstElementChild); }
      if (e.key === "Enter") { e.preventDefault(); inspect(cur); }
    }, true);
    UI.on(document, "click", (e) => { if (e.composedPath().some((n) => n.tagName === "DEVTAB-TOOL")) return; if (!cur || pinned) return; e.preventDefault(); e.stopPropagation(); inspect(cur); }, true);

    function inspect(el) {
      pinned = true; tip.style.display = "none";
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const keys = ["display", "position", "width", "height", "margin", "padding", "border", "border-radius", "background-color", "background-image", "color", "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "box-shadow", "opacity", "z-index", "flex-direction", "justify-content", "align-items", "gap", "grid-template-columns"];
      const st = steal(el);
      const side = document.createElement("div"); side.className = "side";
      const outer = el.outerHTML.length > 6000 ? el.outerHTML.slice(0, 6000) + "\n…" : el.outerHTML;
      side.innerHTML = `<div class="sh"><button class="x" data-x>×</button><h3>${el.tagName.toLowerCase()}${el.id ? "#" + UI.esc(el.id) : ""}${UI.esc([...el.classList].slice(0, 3).map((c) => "." + c).join(""))}</h3><p>${Math.round(r.width)} × ${Math.round(r.height)} px · ${st.count} element${st.count === 1 ? "" : "s"}${st.capped ? " (first 400 · pick a smaller part for the rest)" : ""}</p>
        <div class="tabs"><button data-t="steal" aria-pressed="true">🧲 Steal component</button><button data-t="css" aria-pressed="false">Styles</button><button data-t="html" aria-pressed="false">HTML</button></div></div>
        <div class="sb" data-b="steal"><p class="lbl">Live preview of the rebuilt component</p><iframe sandbox="" referrerpolicy="no-referrer"></iframe><p class="lbl">HTML</p><pre>${UI.esc(st.html)}</pre><p class="lbl">CSS</p><pre>${UI.esc(st.css)}</pre></div>
        <div class="sb" data-b="css" hidden><div class="kv">${keys.map((k) => { const v = cs.getPropertyValue(k); return v && v !== "none" && v !== "normal" && v !== "auto" && v !== "0px" ? `<span>${k}</span><b>${UI.esc(v)}</b>` : ""; }).join("")}</div></div>
        <div class="sb" data-b="html" hidden><pre>${UI.esc(outer)}</pre></div>
        <div class="sf"><button class="btn" data-c="full">Copy HTML + CSS</button><button class="btn g" data-c="html">Copy HTML</button><button class="btn g" data-c="css">Copy CSS</button><button class="btn g" data-c="dl">Download .html</button><button class="btn g" data-x>Back</button></div>`;
      w.append(side);
      side.querySelector("iframe").srcdoc = st.full;
      side.addEventListener("click", async (e) => {
        const t = e.target.closest("[data-t]");
        if (t) { side.querySelectorAll("[data-t]").forEach((b) => b.setAttribute("aria-pressed", String(b === t))); side.querySelectorAll("[data-b]").forEach((b) => (b.hidden = b.dataset.b !== t.dataset.t)); return; }
        const c = e.target.closest("[data-c]");
        if (c) {
          if (c.dataset.c === "dl") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([st.full], { type: "text/html" })); a.download = `component-${location.hostname.replace(/^www\./, "")}.html`; a.click(); UI.toast(w, "Saved the component"); return; }
          await UI.copy(c.dataset.c === "full" ? st.full : c.dataset.c === "html" ? st.html : st.css); UI.toast(w, c.dataset.c === "full" ? "HTML + CSS copied" : `${c.dataset.c.toUpperCase()} copied`); return;
        }
        if (e.target.closest("[data-x]")) { side.remove(); pinned = false; }
      });
    }
  };
})();
