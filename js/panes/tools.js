// Hub pane: Tools. A colour picker that works anywhere on your screen (the
// browser's EyeDropper), an image inspector for files you drop in, and how to
// use the page tools (colour, image size, font finder) on any website.
import { addPane } from "../hub.js";

const $ = (s, el = document) => el.querySelector(s);
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9Z"/></svg>';
const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]; };
const fromHsl = (h, s, l) => { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return hex(...[f(0), f(8), f(4)].map((v) => Math.round(v * 255))); };
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(2) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
let C = null;

async function copy(t) { try { await navigator.clipboard.writeText(t); C.toast(`Copied ${t}`); } catch (e) { C.toast(t); } }

function colorCard(H) {
  const rgb = rgbOf(H), [h, s, l] = hsl(rgb), light = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 150;
  const pal = [90, 75, 60, null, 35, 22, 12].map((L) => (L === null ? H : fromHsl(h, s, L))).concat([fromHsl((h + 180) % 360, s, l), fromHsl((h + 30) % 360, s, l), fromHsl((h + 330) % 360, s, l), fromHsl((h + 120) % 360, s, l), fromHsl((h + 240) % 360, s, l)]);
  return `<div class="tl__sw" style="background:${H};color:${light ? "#111" : "#fff"}"><b>${H}</b><span>rgb(${rgb.join(", ")}) · hsl(${h}, ${s}%, ${l}%)</span></div>
    <div class="tl__vals">${[H, `rgb(${rgb.join(", ")})`, `hsl(${h}, ${s}%, ${l}%)`].map((v) => `<button type="button" data-copy="${v}">${v}</button>`).join("")}</div>
    <div class="tl__pal">${pal.map((c) => `<button type="button" data-copy="${c}" title="${c}" style="background:${c}"></button>`).join("")}</div>`;
}

function render(el) {
  const canPick = "EyeDropper" in window;
  el.innerHTML = `
    <div class="tl">
      <section class="tl__card tl__card--pick">
        <div class="tl__h"><span class="tl__ic tl__ic--c">${ICON}</span><div><h4>Colour picker</h4><p>Pick any colour on your screen, even outside the browser.</p></div></div>
        <button type="button" class="btn tl__go" data-pick ${canPick ? "" : "disabled"}>${canPick ? "🎯 Pick a colour" : "Not supported in this browser"}</button>
        <div data-color></div>
        <div class="tl__hist" data-hist></div>
      </section>
      <section class="tl__card tl__card--img">
        <div class="tl__h"><span class="tl__ic tl__ic--i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></span><div><h4>Image inspector</h4><p>Resolution, ratio, size and main colours.</p></div></div>
        <label class="tl__drop" data-drop><input type="file" accept="image/*" hidden data-file><span>Drop an image here, paste one, or <u>choose a file</u></span></label>
        <div data-img></div>
      </section>
      <section class="tl__card tl__card--web">
        <h4>On any website</h4>
        <p>Click the <b>DevTab</b> button in your toolbar (pin it with the 🧩 menu) or press a shortcut:</p>
        <div class="tl__keys"><div><kbd>Alt</kbd><kbd>Shift</kbd><kbd>1</kbd><span>Colour picker with a magnifier</span></div><div><kbd>Alt</kbd><kbd>Shift</kbd><kbd>2</kbd><span>Image size finder</span></div><div><kbd>Alt</kbd><kbd>Shift</kbd><kbd>3</kbd><span>Font finder</span></div></div>
      </section>
    </div>`;
  let hist = []; try { hist = JSON.parse(localStorage.getItem("devtab:colors") || "[]"); } catch (e) {}
  const drawHist = () => { $("[data-hist]", el).innerHTML = hist.length ? `<span>Recent</span>${hist.map((c) => `<button type="button" data-show="${c}" title="${c}" style="background:${c}"></button>`).join("")}` : ""; };
  drawHist();
  const show = (H) => { $("[data-color]", el).innerHTML = colorCard(H); };
  el.addEventListener("click", async (e) => {
    const cp = e.target.closest("[data-copy]"); if (cp) return copy(cp.dataset.copy);
    const sh = e.target.closest("[data-show]"); if (sh) return show(sh.dataset.show);
    if (e.target.closest("[data-pick]")) {
      try {
        const { sRGBHex } = await new EyeDropper().open();
        const H = sRGBHex.startsWith("#") ? sRGBHex.toUpperCase() : hex(...sRGBHex.match(/\d+/g).map(Number));
        show(H); copy(H);
        hist = [H, ...hist.filter((c) => c !== H)].slice(0, 12); try { localStorage.setItem("devtab:colors", JSON.stringify(hist)); } catch (err) {} drawHist();
      } catch (err) { /* cancelled */ }
    }
  });
  const inspect = (file) => {
    if (!file || !file.type.startsWith("image/")) return C.toast("That isn't an image.");
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight, g = gcd(w, h);
      // main colours: sample a small copy and bucket similar pixels
      const cv = document.createElement("canvas"), k = Math.min(1, 80 / Math.max(w, h)); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      const x = cv.getContext("2d"); x.drawImage(img, 0, 0, cv.width, cv.height);
      const d = x.getImageData(0, 0, cv.width, cv.height).data, B = {};
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const key = [d[i] >> 5, d[i + 1] >> 5, d[i + 2] >> 5].join(); (B[key] = B[key] || [0, 0, 0, 0]); B[key][0] += d[i]; B[key][1] += d[i + 1]; B[key][2] += d[i + 2]; B[key][3]++; }
      const main = Object.values(B).sort((a, b) => b[3] - a[3]).slice(0, 6).map(([r, gg, b, n]) => hex(Math.round(r / n), Math.round(gg / n), Math.round(b / n)));
      $("[data-img]", el).innerHTML = `<div class="tl__img"><img src="${url}" alt=""><div>
        <b class="tl__res">${w} × ${h}</b>
        <span>${(g && w / g <= 32 ? `${w / g}:${h / g}` : (w / h).toFixed(2) + ":1")} · ${((w * h) / 1e6).toFixed(2)} MP · ${kb(file.size)} · ${(file.type.split("/")[1] || "").toUpperCase()}</span>
        <span class="tl__fn">${C.esc(file.name || "pasted image")}</span>
        <div class="tl__pal tl__pal--sm">${main.map((c) => `<button type="button" data-copy="${c}" title="${c}" style="background:${c}"></button>`).join("")}</div></div></div>`;
    };
    img.src = url;
  };
  $("[data-file]", el).addEventListener("change", (e) => inspect(e.target.files[0]));
  const drop = $("[data-drop]", el);
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); inspect(e.dataTransfer.files[0]); });
  const onPaste = (e) => { const f = [...(e.clipboardData || {}).files || []].find((x) => x.type.startsWith("image/")); if (f) inspect(f); };
  addEventListener("paste", onPaste);
  return () => removeEventListener("paste", onPaste);
}

export function initTools(ctx) {
  C = ctx;
  addPane({ id: "tools", label: "Tools", icon: ICON, title: "Tools", sub: "Colour picker, image inspector, and page tools", render });
}
