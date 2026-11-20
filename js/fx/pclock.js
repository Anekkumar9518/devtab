// Particle clock: the digits are made of thousands of glowing dots. Move the
// cursor through them and they scatter like sand, then flow back into place.
// In the Hacker look each dot is a falling Matrix character instead.

const CHARS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏ0123456789<>/{}[]=+*#$";
let cv = null, ctx = null, clockEl = null, getS = null;
let P = [], dpr = 1, W = 0, H = 0, M = 120, raf = 0, on = false, mode = "dev", accent = "#7c9cff";
let sprites = [], frozen = false, lastText = "";
const mouse = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, v: 0 };

const rgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// small glowing dots, white at the top fading to the accent at the bottom
function makeSprites() {
  const a = rgb(accent); sprites = [];
  for (let i = 0; i < 6; i++) {
    const k = i / 5, c = [255 + (a[0] - 255) * k * 0.75, 255 + (a[1] - 255) * k * 0.75, 255 + (a[2] - 255) * k * 0.75].map(Math.round);
    const s = document.createElement("canvas"), r = Math.ceil(5 * dpr); s.width = s.height = r * 2;
    const x = s.getContext("2d"), g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(0.35, `rgba(${c},.85)`); g.addColorStop(1, `rgba(${c},0)`);
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); sprites.push(s);
  }
}

// Where the dots should sit: draw the time off-screen and sample its pixels.
function targets() {
  const span = clockEl.querySelector("span"); if (!span) return [];
  const cr = clockEl.getBoundingClientRect(), sr = span.getBoundingClientRect(), cs = getComputedStyle(span);
  const off = document.createElement("canvas"); off.width = W; off.height = H;
  const o = off.getContext("2d");
  o.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * dpr}px ${cs.fontFamily}`;
  if ("letterSpacing" in o) o.letterSpacing = (parseFloat(cs.letterSpacing) || 0) * dpr + "px";
  o.textBaseline = "middle"; o.fillStyle = "#fff";
  o.fillText(span.textContent, (sr.left - cr.left + M) * dpr, (sr.top - cr.top + M + sr.height / 2 + parseFloat(cs.fontSize) * 0.04) * dpr);
  const step = Math.round((mode === "hacker" ? 7.5 : 4.2) * dpr);
  const data = o.getImageData(0, 0, W, H).data, out = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 140) out.push([x + (Math.random() - 0.5) * dpr, y + (Math.random() - 0.5) * dpr]);
  return out;
}

function retarget(initial) {
  const T = targets();
  for (let i = T.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [T[i], T[j]] = [T[j], T[i]]; }
  const keep = Math.min(P.length, T.length);
  for (let i = 0; i < keep; i++) { P[i].tx = T[i][0]; P[i].ty = T[i][1]; P[i].dead = false; }
  for (let i = keep; i < P.length; i++) P[i].dead = true; // spare dots drift away and fade
  for (let i = keep; i < T.length; i++) {
    const [tx, ty] = T[i];
    const x = initial ? (mode === "hacker" ? tx : tx + (Math.random() - 0.5) * W * 0.6) : W / 2 + (Math.random() - 0.5) * 40;
    const y = initial ? (mode === "hacker" ? -Math.random() * H * 1.5 : ty + (Math.random() - 0.5) * H) : H / 2 + (Math.random() - 0.5) * 40;
    P.push({ x, y, vx: 0, vy: 0, tx, ty, a: initial ? 0 : 1, dead: false, ch: CHARS[(Math.random() * CHARS.length) | 0], s: 0.7 + Math.random() * 0.6, w: Math.random() * 6.28 });
  }
}

function size() {
  dpr = Math.min(2, devicePixelRatio || 1);
  const r = clockEl.getBoundingClientRect();
  Object.assign(cv.style, { left: -M + "px", top: -M + "px", width: r.width + M * 2 + "px", height: r.height + M * 2 + "px" });
  W = cv.width = Math.round((r.width + M * 2) * dpr);
  H = cv.height = Math.round((r.height + M * 2) * dpr);
  makeSprites();
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  if (document.hidden || frozen) return;
  const r = cv.getBoundingClientRect();
  const mx = (mouse.x - r.left) * dpr, my = (mouse.y - r.top) * dpr;
  const R = 95 * dpr, R2 = R * R, push = (6 + Math.min(mouse.v, 4) * 4) * dpr;
  mouse.v *= 0.9;
  ctx.clearRect(0, 0, W, H);
  const hacker = mode === "hacker", t = now / 1000;
  if (hacker) { ctx.font = `700 ${Math.round(10 * dpr)}px "JetBrains Mono", monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; }
  else ctx.globalCompositeOperation = "lighter";
  const a = rgb(accent), lit = a.map((v) => Math.round(v + (255 - v) * 0.45));
  let alive = 0;
  for (const p of P) {
    if (p.dead) { p.a -= 0.02; p.vy += 0.15 * dpr; }
    else {
      const k = hacker && p.y < p.ty - 40 * dpr ? 0.012 : 0.055; // Matrix dots rain in before they settle
      p.vx += (p.tx - p.x) * k; p.vy += (p.ty - p.y) * k + (hacker && p.y < p.ty ? 0.4 * dpr : 0);
      p.a = Math.min(1, p.a + 0.03);
    }
    const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
    if (d2 < R2) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * push; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
    p.vx *= 0.8; p.vy *= 0.8;
    p.x += p.vx + Math.sin(t * 1.3 + p.w) * 0.12 * dpr; p.y += p.vy + Math.cos(t * 1.1 + p.w) * 0.12 * dpr;
    if (p.a <= 0) continue;
    alive++;
    if (hacker) {
      if (Math.random() < 0.02) p.ch = CHARS[(Math.random() * CHARS.length) | 0];
      const near = Math.abs(p.x - p.tx) + Math.abs(p.y - p.ty) < 3 * dpr;
      ctx.fillStyle = near ? `rgba(${lit},${p.a.toFixed(2)})` : `rgba(${a},${(0.55 * p.a).toFixed(2)})`;
      ctx.fillText(p.ch, p.x, p.y);
    } else {
      const spr = sprites[Math.min(5, Math.max(0, Math.floor((p.ty / H - 0.3) / 0.45 * 6)))];
      const sz = spr.width * 0.6 * p.s;
      ctx.globalAlpha = p.a; ctx.drawImage(spr, p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  if (alive < P.length * 0.8) P = P.filter((p) => !(p.dead && p.a <= 0));
}

addEventListener("pointermove", (e) => {
  const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
  mouse.v = Math.min(6, Math.hypot(dx, dy) / 12);
  mouse.x = e.clientX; mouse.y = e.clientY;
}, { passive: true });
document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -1e4; });

function start() {
  if (on) return;
  on = true;
  cv = document.createElement("canvas"); cv.className = "pclock"; cv.setAttribute("aria-hidden", "true");
  clockEl.appendChild(cv); ctx = cv.getContext("2d");
  clockEl.classList.add("is-particles");
  size(); P = []; lastText = ""; refresh(true);
  raf = requestAnimationFrame(frame);
}
function stop() {
  if (!on) return;
  on = false; cancelAnimationFrame(raf); cv.remove(); cv = null; P = [];
  clockEl.classList.remove("is-particles");
}

// Call after the clock's text changes (every minute, or second).
export function refresh(initial) {
  if (!on) return;
  const span = clockEl.querySelector("span"); if (!span) return;
  if (!cv.isConnected) clockEl.appendChild(cv); // the clock's HTML was replaced
  if (span.textContent === lastText && !initial) return;
  lastText = span.textContent;
  document.fonts.ready.then(() => retarget(initial === true || P.length === 0));
}

export function setParticleClock(enabled, look, acc) {
  const want = enabled && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const changed = look !== mode || acc !== accent;
  mode = look; accent = acc;
  if (!want) return stop();
  if (on && changed) { stop(); }
  start();
}
export const freezeParticles = (v) => { frozen = v; };

export function initParticleClock(el) {
  clockEl = el;
  let t = 0;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (on) { size(); P = []; lastText = ""; refresh(true); } }, 200); });
}
