// Price & change spy, the picking part: point at a price or any bit of text
// (or take the whole page) and DevTab keeps an eye on it from then on.
(() => {
  const UI = window.__devtabUI;
  const N = (t) => String(t || "").replace(/\s+/g, " ").trim();
  const textOf = (el) => { const c = el.cloneNode(true); c.querySelectorAll("script,style,noscript,template").forEach((x) => x.remove()); return N(c.textContent); };

  // same reading of prices as the background checker
  function parsePrice(t) {
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
    return { n, cur, sure: !!m };
  }
  const money = (p) => (p.cur || "") + p.n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  // a CSS path that should still find this element next time the page loads
  const okId = (id) => /^[A-Za-z][\w-]{1,48}$/.test(id) && !/\d{4,}|[a-f0-9]{8,}/i.test(id);
  const okCls = (c) => /^[A-Za-z_-][\w-]{1,32}$/.test(c) && !/\d{3,}|^(is-|has-|js-|ng-|active|hover|focus|selected|open|show|visible)/.test(c) && !/[A-Z].*[A-Z].*\d|__[a-zA-Z0-9]{5}$/.test(c);
  function selectorFor(el) {
    if (el.id && okId(el.id) && document.querySelectorAll("#" + CSS.escape(el.id)).length === 1) return "#" + CSS.escape(el.id);
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.documentElement; e = e.parentElement) {
      if (e !== el && e.id && okId(e.id) && document.querySelectorAll("#" + CSS.escape(e.id)).length === 1) { parts.unshift("#" + CSS.escape(e.id)); break; }
      if (e === document.body) { parts.unshift("body"); break; }
      let p = e.tagName.toLowerCase();
      const cls = [...e.classList].filter(okCls).slice(0, 2);
      if (cls.length) p += "." + cls.map((c) => CSS.escape(c)).join(".");
      const same = e.parentElement ? [...e.parentElement.children].filter((x) => x.tagName === e.tagName) : [];
      if (same.length > 1 && e.parentElement.querySelectorAll(":scope > " + p).length > 1) p += `:nth-of-type(${same.indexOf(e) + 1})`;
      parts.unshift(p);
      const sel = parts.join(" > ");
      try { if (parts.length >= 2 && document.querySelector(sel) === el && document.querySelectorAll(sel).length === 1) return sel; } catch (x) {}
    }
    return parts.join(" > ");
  }

  // the most likely "the price" on a product page: big, near the top, with a currency sign
  function guessPrice() {
    const known = document.querySelector('#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, .priceToPay .a-offscreen, [itemprop="price"], [data-testid*="price" i], .product-price, .price .amount');
    let best = null, bestScore = 0;
    const consider = (el) => {
      if (el.textContent.length > 80) return;
      const t = textOf(el); if (!t || t.length > 40) return;
      const p = parsePrice(t); if (!p || !p.sure || !p.n) return;
      const r = (el.closest(".a-price") || el).getBoundingClientRect(); if (!r.width && el.className !== "a-offscreen") return;
      const fs = parseFloat(getComputedStyle(el.closest(".a-price") || el).fontSize) || 12, top = r.top + scrollY;
      if (top > 2200) return;
      const score = fs * 3 - top / 120 + (el.matches('[itemprop="price"], .a-offscreen') ? 20 : 0) - (getComputedStyle(el).textDecorationLine.includes("line-through") || el.closest("del, s, strike") ? 60 : 0);
      if (score > bestScore) { best = el; bestScore = score; }
    };
    if (known) consider(known);
    if (!best) for (const el of document.querySelectorAll("body *")) { if (el.children.length > 3 || /^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH|DEVTAB-)/.test(el.tagName)) continue; consider(el); }
    return best;
  }

  window.__devtabSpy = () => {
    const { w } = UI.open(`
      .box { box-shadow: 0 0 0 9999px rgba(0,0,0,.12), 0 0 24px var(--a); }
      .tag b { font-size: 15px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
      .sug { position: fixed; left: 16px; bottom: 16px; display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 16px; border-radius: 18px; background: var(--bg); border: 1px solid var(--a); box-shadow: 0 0 30px -8px var(--a), 0 18px 40px rgba(0,0,0,.5); pointer-events: auto; font-size: 13px; animation: p .35s cubic-bezier(.2,1.3,.4,1); }
      .w.hk .sug { border-radius: 2px; }
      .sug b { display: block; font-size: 20px; color: var(--fg); } .sug span { color: var(--mu); }
      .lb { display: block; margin: 14px 0 6px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--mu); }
      .in { all: unset; box-sizing: border-box; width: 100%; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--ln); background: rgba(0,0,0,.3); color: var(--fg); font-size: 13.5px; }
      .in:focus { border-color: var(--a); }
      .val { margin-top: 12px; padding: 14px; border-radius: 14px; background: color-mix(in srgb, var(--a) 12%, transparent); border: 1px solid color-mix(in srgb, var(--a) 35%, transparent); }
      .val b { display: block; font-size: 26px; line-height: 1.1; } .val small { color: var(--mu); font-size: 12px; overflow-wrap: anywhere; }
      .seg { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: rgba(0,0,0,.3); border: 1px solid var(--ln); }
      .seg button { all: unset; flex: 1; text-align: center; cursor: pointer; padding: 7px 0; border-radius: 9px; font-size: 12.5px; font-weight: 600; color: var(--mu); }
      .seg button[aria-pressed="true"] { background: var(--a); color: #0a0a0a; } .seg button:disabled { opacity: .35; cursor: default; }
      .w.hk .in, .w.hk .val, .w.hk .seg, .w.hk .seg button { border-radius: 2px; }`);
    const hud = document.createElement("div"); hud.className = "hud";
    hud.innerHTML = `<b>🕵️ Spy</b><span>click a price or any text to watch it</span><button class="btn g" data-page>Watch whole page</button><button class="btn g" data-q>Exit</button>`;
    const box = document.createElement("div"); box.className = "box"; box.style.display = "none";
    const tag = document.createElement("div"); tag.className = "tag"; tag.style.display = "none";
    w.append(box, tag, hud);
    hud.querySelector("[data-q]").onclick = () => UI.close();
    let cur = null, panel = null;
    const pick = (x, y) => { for (const el of document.elementsFromPoint(x, y)) if (!el.tagName.startsWith("DEVTAB-") && el !== document.documentElement && el !== document.body) return el; return null; };
    const frame = (el) => { const r = el.getBoundingClientRect(); Object.assign(box.style, { display: "", left: r.left - 3 + "px", top: r.top - 3 + "px", width: r.width + 6 + "px", height: r.height + 6 + "px" }); };

    UI.on(document, "mousemove", (e) => {
      if (panel) return;
      const el = pick(e.clientX, e.clientY); if (!el) return;
      if (el !== cur) {
        cur = el; frame(el);
        const t = textOf(el), p = t.length < 60 ? parsePrice(t) : null;
        tag.innerHTML = p && p.sure ? `<b>💰 ${UI.esc(money(p))}</b>click to watch this price` : `<b>${UI.esc(t.slice(0, 60) || "(no text)")}${t.length > 60 ? "…" : ""}</b>click to watch this text`;
        tag.style.display = "";
      }
      UI.place(tag, e.clientX, e.clientY + 40);
    }, true);
    UI.on(document, "click", (e) => { if (e.composedPath().some((n) => n.tagName && n.tagName.startsWith("DEVTAB-"))) return; if (panel || !cur) return; e.preventDefault(); e.stopPropagation(); ask(cur); }, true);
    hud.querySelector("[data-page]").onclick = () => ask(document.querySelector("main") || document.body, true);

    // the best guess at the price, offered up front
    const g = guessPrice();
    if (g) {
      const p = parsePrice(textOf(g)), sug = document.createElement("div"); sug.className = "sug";
      sug.innerHTML = `<div><span>Looks like the price here</span><b>💰 ${UI.esc(money(p))}</b></div><button class="btn" data-sg>Watch this price</button>`;
      sug.querySelector("[data-sg]").onclick = () => { sug.remove(); ask(g); };
      w.append(sug);
      const vis = g.closest(".a-price") || g; vis.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => { if (!panel) frame(vis); }, 500);
    }

    function ask(el, whole = false) {
      if (panel) panel.remove();
      const text = textOf(el), p = text.length < 80 ? parsePrice(text) : null;
      let kind = whole ? "page" : p && p.sure ? "price" : "text";
      const sel = whole ? (el === document.body ? "body" : selectorFor(el)) : selectorFor(el);
      const vis = el.closest(".a-price") || el; if (!whole) frame(vis); else box.style.display = "none";
      tag.style.display = "none";
      // a short name: the page's main heading (the product name on shops), else its title without the site name
      const h1 = N((document.querySelector("h1") || {}).textContent || ""), og = N((document.querySelector('meta[property="og:title"]') || {}).content || "");
      const title = (h1.length >= 3 && h1.length <= 90 ? h1 : og && og.length <= 90 ? og : N(document.title).replace(/(\s+[|–—-]\s+[^|–—-]+)+$/, "")).slice(0, 80) || location.hostname;
      panel = document.createElement("div"); panel.className = "panel";
      const draw = () => {
        const shown = kind === "price" && p ? `<b>${UI.esc(money(p))}</b><small>right now</small>` : kind === "page" ? `<b>Whole page</b><small>${text.split(" ").length.toLocaleString()} words of text · you'll hear when any of it changes</small>` : `<b style="font-size:16px">${UI.esc(text.slice(0, 160) || "(empty)")}${text.length > 160 ? "…" : ""}</b><small>right now</small>`;
        panel.innerHTML = `<button class="x" data-x>×</button><h3>🕵️ Keep an eye on this?</h3><p>DevTab checks it in the background and notifies you when it changes.</p>
          <div class="val">${shown}</div>
          ${whole ? "" : `<span class="lb">Watch it as</span><div class="seg"><button data-k="price" aria-pressed="${kind === "price"}" ${p ? "" : "disabled"}>💰 Price</button><button data-k="text" aria-pressed="${kind === "text"}">👀 Text</button></div>`}
          <span class="lb">Name</span><input class="in" data-l maxlength="80" value="${UI.esc(title)}">
          <div class="acts"><button class="btn" data-go>Start watching</button><button class="btn g" data-x>Cancel</button></div>`;
      };
      draw();
      w.append(panel);
      const r = vis.getBoundingClientRect();
      if (whole) { panel.style.left = (innerWidth - panel.offsetWidth) / 2 + "px"; panel.style.top = "90px"; } else UI.place(panel, r.right, r.top + 30);
      panel.addEventListener("click", async (e) => {
        const k = e.target.closest("[data-k]"); if (k && !k.disabled) { const l = panel.querySelector("[data-l]").value; kind = k.dataset.k; draw(); panel.querySelector("[data-l]").value = l; return; }
        if (e.target.closest("[data-x]")) { panel.remove(); panel = null; cur = null; return; }
        if (e.target.closest("[data-go]")) {
          const b = e.target.closest("[data-go]"); b.textContent = "Saving…";
          const watch = { url: location.href.split("#")[0], title: document.title, label: N(panel.querySelector("[data-l]").value) || title, selector: sel, kind, value: kind === "price" ? text : text.slice(0, 400), sample: text.slice(0, 400), num: kind === "price" && p ? p.n : null, cur: p ? p.cur : "" };
          const res = await chrome.runtime.sendMessage({ type: "spy-add", watch }).catch(() => null);
          if (!res || !res.ok) { b.textContent = "Couldn't save. Try again"; return; }
          const h = res.every >= 60 ? `${Math.round(res.every / 60)} h` : `${res.every} min`;
          panel.innerHTML = `<h3>🕵️ Watching it</h3><p>DevTab checks every ${h} and pings you when it changes. You're watching ${res.count} thing${res.count === 1 ? "" : "s"}. See them all in the Hub → Spy.</p><div class="acts"><button class="btn" data-done>Done</button></div>`;
          panel.querySelector("[data-done]").onclick = () => UI.close();
          setTimeout(() => UI.close(), 4500);
        }
      });
    }
  };
})();
