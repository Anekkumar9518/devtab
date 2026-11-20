// Font finder: hover any text to see which font is actually being rendered
// (not just the CSS list), its size, weight and colour. Click for the full
// details, a live sample and a "Copy CSS" button.
(() => {
  const UI = window.__devtabUI;
  const GENERIC = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "-apple-system", "blinkmacsystemfont", "emoji", "math"];
  const meas = document.createElement("canvas").getContext("2d");
  const width = (font) => { meas.font = `72px ${font}`; return meas.measureText("mmmmmmmmmmlli1WQ@#äé漢").width; };
  const base = { monospace: width("monospace"), serif: width("serif"), "sans-serif": width("sans-serif") };
  // Is this font really there? Compare widths against the generic fallbacks.
  const hasFont = (name) => {
    const n = name.toLowerCase();
    if (GENERIC.includes(n)) return true;
    for (const f of document.fonts) if (f.family.replace(/["']/g, "").toLowerCase() === n && f.status === "loaded") return true;
    return Object.keys(base).some((g) => width(`"${name}", ${g}`) !== base[g]);
  };
  const stack = (ff) => ff.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  const rendered = (ff) => { for (const f of stack(ff)) if (hasFont(f)) return f; return "default"; };
  const toHex = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return c; return "#" + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, "0")).join("") + (m[3] && +m[3] < 1 ? Math.round(m[3] * 255).toString(16).padStart(2, "0") : ""); };
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const WEIGHT = { 100: "Thin", 200: "Extra light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" };

  function textAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.tagName === "DEVTAB-TOOL") continue;
      if (hasText(el) || ["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(el.tagName)) return el;
    }
    return null;
  }
  function read(el) {
    const cs = getComputedStyle(el), lh = cs.lineHeight === "normal" ? "normal" : (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2).replace(/\.?0+$/, "");
    return { el, family: cs.fontFamily, font: rendered(cs.fontFamily), size: cs.fontSize, weight: cs.fontWeight, style: cs.fontStyle, lh, ls: cs.letterSpacing, color: toHex(cs.color), transform: cs.textTransform, text: (el.innerText || el.value || el.textContent || "").trim().slice(0, 80) };
  }

  window.__devtabFonts = () => {
    const { w } = UI.open(`
      .tag b { max-width: 380px; overflow: hidden; text-overflow: ellipsis; }
      .sample { margin: 12px 0 8px; padding: 14px; border-radius: 14px; background: rgba(255,255,255,.05); color: var(--fg); overflow-wrap: anywhere; }
      .w.hk .sample { border-radius: 2px; }
      .sample .aa { font-size: 44px; line-height: 1.1; } .sample .tx { font-size: 15px; margin-top: 8px; opacity: .8; }
      .dot { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; margin-right: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.3); }
      .link { color: var(--a); font-size: 12.5px; }`);
    const hud = document.createElement("div"); hud.className = "hud";
    hud.innerHTML = `<b>Aa Font finder</b><span>hover any text · click for details</span><button class="btn g" data-q>Exit</button>`;
    const box = document.createElement("div"); box.className = "box"; box.style.display = "none";
    const tag = document.createElement("div"); tag.className = "tag"; tag.style.display = "none";
    w.append(box, tag, hud);
    hud.querySelector("[data-q]").onclick = () => UI.close();
    let cur = null, pinned = false;

    UI.on(document, "mousemove", (e) => {
      if (pinned) return;
      const el = textAt(e.clientX, e.clientY);
      if (!el) { box.style.display = tag.style.display = "none"; cur = null; return; }
      if (cur && cur.el === el) { UI.place(tag, e.clientX + 6, e.clientY + 40); return; }
      cur = read(el);
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { display: "", left: r.left - 3 + "px", top: r.top - 3 + "px", width: r.width + 6 + "px", height: r.height + 6 + "px" });
      tag.innerHTML = `<b style="font-family:${UI.esc(cur.font === "default" ? "inherit" : `'${cur.font}'`)}">${UI.esc(cur.font)}</b>${parseFloat(cur.size)}px · ${cur.weight} ${WEIGHT[cur.weight] || ""} · line ${cur.lh} · <span class="dot" style="background:${cur.color}"></span>${cur.color}`;
      tag.style.display = ""; UI.place(tag, e.clientX + 6, e.clientY + 40);
    }, true);
    UI.on(document, "click", (e) => {
      if (e.composedPath().some((n) => n.tagName === "DEVTAB-TOOL")) return;
      if (!cur || pinned) return;
      e.preventDefault(); e.stopPropagation();
      pinned = true; tag.style.display = "none";
      const f = cur, fam = f.font === "default" ? "inherit" : `'${f.font}'`;
      const css = `font-family: ${f.family};\nfont-size: ${f.size};\nfont-weight: ${f.weight};${f.style !== "normal" ? `\nfont-style: ${f.style};` : ""}\nline-height: ${f.lh};${f.ls !== "normal" ? `\nletter-spacing: ${f.ls};` : ""}\ncolor: ${f.color};`;
      const isWeb = [...document.fonts].some((x) => x.family.replace(/["']/g, "").toLowerCase() === f.font.toLowerCase());
      const p = document.createElement("div"); p.className = "panel";
      p.innerHTML = `<button class="x" data-x>×</button><h3>${UI.esc(f.font)}</h3><p>${isWeb ? "Web font loaded by this site" : GENERIC.includes(f.font.toLowerCase()) ? "The browser's default font for this family" : "Installed on your device"}</p>
        <div class="sample" style="font-family:${UI.esc(fam)};font-weight:${f.weight};font-style:${f.style}"><div class="aa">Aa Gg 123</div><div class="tx">${UI.esc(f.text || "The quick brown fox jumps over the lazy dog")}</div></div>
        <div class="row"><span class="k">Rendered</span><span class="v">${UI.esc(f.font)}</span><button class="cp" data-c="${UI.esc(f.font)}">Copy</button></div>
        <div class="row"><span class="k">Font stack</span><span class="v">${UI.esc(f.family)}</span></div>
        <div class="row"><span class="k">Size</span><span class="v">${f.size}</span></div>
        <div class="row"><span class="k">Weight</span><span class="v">${f.weight} ${WEIGHT[f.weight] || ""}${f.style !== "normal" ? " · " + f.style : ""}</span></div>
        <div class="row"><span class="k">Line height</span><span class="v">${f.lh}</span></div>
        ${f.ls !== "normal" ? `<div class="row"><span class="k">Letter spacing</span><span class="v">${f.ls}</span></div>` : ""}
        <div class="row"><span class="k">Colour</span><span class="v"><span class="dot" style="background:${f.color}"></span>${f.color}</span><button class="cp" data-c="${f.color}">Copy</button></div>
        <div class="acts"><button class="btn" data-css>Copy CSS</button><button class="btn g" data-x>Back</button>${isWeb || !GENERIC.includes(f.font.toLowerCase()) ? `<a class="link" href="https://fonts.google.com/?query=${encodeURIComponent(f.font)}" target="_blank" rel="noopener">Find on Google Fonts ↗</a>` : ""}</div>`;
      w.append(p); UI.place(p, e.clientX, e.clientY);
      p.addEventListener("click", async (ev) => {
        const c = ev.target.closest("[data-c]"); if (c) { await UI.copy(c.dataset.c); UI.toast(w, `Copied ${c.dataset.c}`); }
        if (ev.target.closest("[data-css]")) { await UI.copy(css); UI.toast(w, "CSS copied"); }
        if (ev.target.closest("[data-x]")) { p.remove(); pinned = false; cur = null; }
      });
    }, true);
  };
})();
