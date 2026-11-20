// Screenshot editor: stitches the captured screens into one tall image, then
// lets you draw arrows, boxes, pen and highlighter strokes, add text, blur
// private details and crop. Download as PNG or copy to the clipboard.
const $ = (s) => document.querySelector(s);
const COLORS = ["#ff3b5c", "#ffd166", "#5bd6a4", "#7c9cff", "#ffffff", "#111111"];
const data = await chrome.runtime.sendMessage({ type: "shot-data" });
const cv = $("#cv"), ctx = cv.getContext("2d");
let base = null, k = 1, tool = "arrow", color = COLORS[0], typing = false;
let state = { crop: null, items: [] }, past = [], future = [], live = null;

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 2200); }
const host = (() => { try { return new URL(data.url).hostname.replace(/^www\./, ""); } catch (e) { return "page"; } })();

if (!data || !data.parts) { $("#loading").textContent = "Nothing to show. Take a screenshot from the DevTab toolbar button."; throw new Error("no shot"); }

// stitch
const imgs = await Promise.all(data.parts.map((p) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = p.url; })));
k = imgs[0].naturalWidth / data.vw;
base = document.createElement("canvas"); base.width = imgs[0].naturalWidth; base.height = Math.round(data.H * k);
const bx = base.getContext("2d");
data.parts.forEach((p, i) => bx.drawImage(imgs[i], 0, Math.round(p.y * k)));
$("#loading").remove();
$("#meta").textContent = `${host} · ${Math.round(base.width / k)} × ${Math.round(base.height / k)} px`;
document.title = `Screenshot · ${host}`;

/* ---------- drawing ---------- */
const LW = () => Math.max(3, 4 * k);
function arrow(c, a, b, col, w) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x), head = w * 4.2;
  const line = () => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x - Math.cos(ang) * head * 0.6, b.y - Math.sin(ang) * head * 0.6); c.stroke(); c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - head * Math.cos(ang - 0.45), b.y - head * Math.sin(ang - 0.45)); c.lineTo(b.x - head * Math.cos(ang + 0.45), b.y - head * Math.sin(ang + 0.45)); c.closePath(); c.fill(); };
  c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = c.fillStyle = "rgba(0,0,0,.35)"; c.lineWidth = w + 3 * k; line();
  c.strokeStyle = c.fillStyle = col; c.lineWidth = w; line();
}
function draw(c, it) {
  const w = it.w || LW();
  c.save();
  if (it.type === "arrow") arrow(c, it.a, it.b, it.color, w);
  else if (it.type === "rect") { c.strokeStyle = it.color; c.lineWidth = w; c.shadowColor = "rgba(0,0,0,.35)"; c.shadowBlur = 6 * k; const x = Math.min(it.a.x, it.b.x), y = Math.min(it.a.y, it.b.y); c.beginPath(); c.roundRect(x, y, Math.abs(it.b.x - it.a.x), Math.abs(it.b.y - it.a.y), 6 * k); c.stroke(); }
  else if (it.type === "pen" || it.type === "mark") {
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = it.color;
    if (it.type === "mark") { c.globalAlpha = 0.38; c.lineWidth = w * 5; c.lineCap = "square"; } else c.lineWidth = w;
    c.beginPath(); it.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
  } else if (it.type === "text") {
    c.font = `700 ${it.size}px "Space Grotesk", sans-serif`; c.textBaseline = "top"; c.lineJoin = "round";
    it.text.split("\n").forEach((line, i) => { const y = it.a.y + i * it.size * 1.2; c.strokeStyle = it.color === "#111111" ? "rgba(255,255,255,.9)" : "rgba(0,0,0,.6)"; c.lineWidth = it.size * 0.16; c.strokeText(line, it.a.x, y); c.fillStyle = it.color; c.fillText(line, it.a.x, y); });
  } else if (it.type === "blur") {
    const x = Math.round(Math.min(it.a.x, it.b.x)), y = Math.round(Math.min(it.a.y, it.b.y)), ww = Math.round(Math.abs(it.b.x - it.a.x)), hh = Math.round(Math.abs(it.b.y - it.a.y));
    if (ww > 2 && hh > 2) {
      const cell = Math.max(6, Math.round(10 * k)), t = document.createElement("canvas"); t.width = Math.max(1, Math.ceil(ww / cell)); t.height = Math.max(1, Math.ceil(hh / cell));
      t.getContext("2d").drawImage(base, x, y, ww, hh, 0, 0, t.width, t.height);
      c.imageSmoothingEnabled = false; c.drawImage(t, 0, 0, t.width, t.height, x, y, ww, hh);
    }
  }
  c.restore();
}
function render() {
  const cr = state.crop || { x: 0, y: 0, w: base.width, h: base.height };
  if (cv.width !== cr.w || cv.height !== cr.h) { cv.width = cr.w; cv.height = cr.h; }
  ctx.save(); ctx.translate(-cr.x, -cr.y);
  ctx.drawImage(base, 0, 0);
  for (const it of state.items) draw(ctx, it);
  if (live) draw(ctx, live);
  ctx.restore();
  $("#undo").disabled = !past.length; $("#redo").disabled = !future.length;
}
render();

/* ---------- history ---------- */
const commit = (next) => { past.push(JSON.stringify(state)); future = []; state = next; render(); };
const undo = () => { if (!past.length) return; future.push(JSON.stringify(state)); state = JSON.parse(past.pop()); render(); };
const redo = () => { if (!future.length) return; past.push(JSON.stringify(state)); state = JSON.parse(future.pop()); render(); };
$("#undo").onclick = undo; $("#redo").onclick = redo;

/* ---------- tools ---------- */
$("#colors").innerHTML = COLORS.map((c, i) => `<button type="button" data-color="${c}" style="background:${c}" aria-pressed="${i === 0}" aria-label="Colour ${c}"></button>`).join("");
$("#colors").addEventListener("click", (e) => { const b = e.target.closest("[data-color]"); if (!b) return; color = b.dataset.color; document.querySelectorAll("[data-color]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
const setTool = (t) => { tool = t; document.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t))); cancelCrop(); };
$("#tools").addEventListener("click", (e) => { const b = e.target.closest("[data-tool]"); if (b) setTool(b.dataset.tool); });

// screen point -> image point (taking the crop into account)
const pt = (e) => { const r = cv.getBoundingClientRect(), s = cv.width / r.width, cr = state.crop || { x: 0, y: 0 }; return { x: (e.clientX - r.left) * s + cr.x, y: (e.clientY - r.top) * s + cr.y }; };

let cropSel = null;
function cancelCrop() { cropSel = null; $("#croprect").hidden = true; }
cv.addEventListener("pointerdown", (e) => {
  if (tool === "text") { e.preventDefault(); return startText(e); }
  cv.setPointerCapture(e.pointerId);
  const p = pt(e);
  if (tool === "crop") { cropSel = { a: p, b: p }; showCrop(); return; }
  live = { type: tool, color: tool === "mark" && color === "#111111" ? "#ffd166" : color, a: p, b: p, pts: [p], w: LW() };
});
cv.addEventListener("pointermove", (e) => {
  if (cropSel && e.buttons) { cropSel.b = pt(e); showCrop(); return; }
  if (!live) return;
  const p = pt(e); live.b = p; if (live.type === "pen" || live.type === "mark") live.pts.push(p);
  render();
});
cv.addEventListener("pointerup", () => {
  if (!live) return;
  const it = live; live = null;
  const big = Math.hypot(it.b.x - it.a.x, it.b.y - it.a.y) > 6 * k || it.pts.length > 3;
  if (big) commit({ ...state, items: [...state.items, it] }); else render();
});
function showCrop() {
  const r = cv.getBoundingClientRect(), s = r.width / cv.width, cr = state.crop || { x: 0, y: 0 }, el = $("#croprect");
  const x = Math.min(cropSel.a.x, cropSel.b.x), y = Math.min(cropSel.a.y, cropSel.b.y), w = Math.abs(cropSel.b.x - cropSel.a.x), h = Math.abs(cropSel.b.y - cropSel.a.y);
  Object.assign(el.style, { left: (x - cr.x) * s + "px", top: (y - cr.y) * s + "px", width: w * s + "px", height: h * s + "px" });
  el.hidden = w < 10 || h < 10;
}
$("#cropOk").addEventListener("click", () => {
  const x = Math.round(Math.min(cropSel.a.x, cropSel.b.x)), y = Math.round(Math.min(cropSel.a.y, cropSel.b.y));
  commit({ ...state, crop: { x, y, w: Math.round(Math.abs(cropSel.b.x - cropSel.a.x)), h: Math.round(Math.abs(cropSel.b.y - cropSel.a.y)) } });
  cancelCrop(); setTool("arrow"); toast("Cropped. Undo brings it back.");
});

function startText(e) {
  const p = pt(e), paper = $("#paper"), r = cv.getBoundingClientRect(), pr = paper.getBoundingClientRect(), s = r.width / cv.width;
  const box = document.createElement("div"); box.className = "txt"; box.contentEditable = "true";
  Object.assign(box.style, { left: e.clientX - pr.left + "px", top: e.clientY - pr.top - 4 + "px", color, fontSize: Math.round(24 * k * s) + "px" });
  paper.append(box); box.focus(); typing = true;
  const done = () => {
    typing = false; const text = box.innerText.trim(); box.remove();
    if (text) commit({ ...state, items: [...state.items, { type: "text", color, a: p, text, size: Math.round(24 * k) }] });
  };
  box.addEventListener("blur", done);
  box.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); box.blur(); } if (ev.key === "Escape") { box.innerText = ""; box.blur(); } });
}

document.addEventListener("keydown", (e) => {
  if (typing || (e.target.closest && e.target.closest(".txt"))) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") { e.preventDefault(); copy(); return; }
  if (e.key === "Escape") cancelCrop();
  const t = { a: "arrow", r: "rect", p: "pen", h: "mark", t: "text", b: "blur", c: "crop" }[e.key.toLowerCase()];
  if (t && !e.ctrlKey && !e.metaKey) setTool(t);
});

/* ---------- export ---------- */
const blob = () => new Promise((res) => { render(); cv.toBlob(res, "image/png"); });
async function save() {
  const b = await blob(), a = document.createElement("a");
  const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  a.href = URL.createObjectURL(b); a.download = `screenshot-${host}-${stamp}.png`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast("Saved to your downloads");
}
async function copy() {
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob() })]); toast("Copied: paste it anywhere"); }
  catch (e) { toast("Couldn't copy: try Download instead"); }
}
$("#save").onclick = save; $("#copy").onclick = copy;
