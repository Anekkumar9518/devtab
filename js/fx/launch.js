// Launch scenes: a 0.7-second animation as you open a site from a shortcut, the
// dock or the search box. Video sites get a play button that rushes past,
// GitHub fills with contribution squares, mail opens an envelope, and so on;
// anything else flies through a warp tunnel with its own icon.
// In the Hacker look every scene turns green, with a terminal line.

const DUR = 720;
export const SITES = {
  youtube: ["YouTube", "https://www.youtube.com"], github: ["GitHub", "https://github.com"], gmail: ["Gmail", "https://mail.google.com"],
  google: ["Google", "https://www.google.com"], stackoverflow: ["Stack Overflow", "https://stackoverflow.com"], reddit: ["Reddit", "https://www.reddit.com"],
  x: ["X", "https://x.com"], twitter: ["X", "https://x.com"], instagram: ["Instagram", "https://www.instagram.com"], linkedin: ["LinkedIn", "https://www.linkedin.com"],
  netflix: ["Netflix", "https://www.netflix.com"], spotify: ["Spotify", "https://open.spotify.com"], chatgpt: ["ChatGPT", "https://chatgpt.com"], claude: ["Claude", "https://claude.ai"],
  gemini: ["Gemini", "https://gemini.google.com"], figma: ["Figma", "https://www.figma.com"], notion: ["Notion", "https://www.notion.so"], vercel: ["Vercel", "https://vercel.com"],
  npm: ["npm", "https://www.npmjs.com"], mdn: ["MDN", "https://developer.mozilla.org"], wikipedia: ["Wikipedia", "https://www.wikipedia.org"], amazon: ["Amazon", "https://www.amazon.in"],
  flipkart: ["Flipkart", "https://www.flipkart.com"], whatsapp: ["WhatsApp", "https://web.whatsapp.com"], maps: ["Google Maps", "https://maps.google.com"], drive: ["Google Drive", "https://drive.google.com"],
  facebook: ["Facebook", "https://www.facebook.com"], discord: ["Discord", "https://discord.com/app"], twitch: ["Twitch", "https://www.twitch.tv"], hackernews: ["Hacker News", "https://news.ycombinator.com"],
  hn: ["Hacker News", "https://news.ycombinator.com"], codepen: ["CodePen", "https://codepen.io"], leetcode: ["LeetCode", "https://leetcode.com"], canva: ["Canva", "https://www.canva.com"],
};

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
function sceneFor(url) {
  const h = host(url);
  const has = (...k) => k.some((x) => h.includes(x));
  if (has("youtube", "netflix", "twitch", "primevideo", "hotstar")) return h.includes("netflix") ? "curtain" : "play";
  if (has("github", "gitlab")) return "grid";
  if (has("mail.", "gmail", "outlook")) return "mail";
  if (has("stackoverflow", "stackexchange")) return "stack";
  if (has("reddit", "news.ycombinator")) return "upvote";
  if (h === "x.com" || has("twitter")) return "slash";
  if (has("linkedin")) return "network";
  if (has("spotify", "music", "soundcloud")) return "rings";
  if (has("chatgpt", "claude", "gemini", "openai", "anthropic", "perplexity")) return "spark";
  if (has("maps.")) return "pin";
  if (has("wikipedia")) return "orbit";
  if (has("npmjs")) return "cube";
  return "warp";
}

const ease = (k) => 1 - Math.pow(1 - k, 3);
const easeIn = (k) => k * k * k;
const fade = (k, a, b) => Math.max(0, Math.min(1, (k - a) / (b - a)));

const SCENES = {
  play(x, w, h, k, c) {
    x.fillStyle = `rgba(0,0,0,${0.85 * ease(k)})`; x.fillRect(0, 0, w, h);
    x.strokeStyle = c("#ff3b3b", 0.5 * (1 - k)); x.lineWidth = 3;
    for (let i = 0; i < 48; i++) { const a = (i / 48) * 6.283, r0 = 60 + k * 300, r1 = r0 + 80 + k * 900; x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); x.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1); x.stroke(); }
    const s = 0.4 + easeIn(k) * 16, r = 60 * s;
    x.globalAlpha = 1 - fade(k, 0.8, 1);
    const g = x.createRadialGradient(w / 2 - r * 0.3, h / 2 - r * 0.3, 0, w / 2, h / 2, r);
    g.addColorStop(0, c("#ff6a5c")); g.addColorStop(1, c("#d81f3c"));
    x.fillStyle = g; x.beginPath(); x.arc(w / 2, h / 2, r, 0, 6.283); x.fill();
    x.strokeStyle = c("#ffffff", 0.35, true); x.lineWidth = 4 * s; x.beginPath(); x.arc(w / 2, h / 2, r + 10 * s, 0, 6.283); x.stroke();
    x.fillStyle = c("#ffffff", 1, true); x.beginPath(); x.moveTo(w / 2 - 16 * s, h / 2 - 24 * s); x.lineTo(w / 2 + 26 * s, h / 2); x.lineTo(w / 2 - 16 * s, h / 2 + 24 * s); x.closePath(); x.fill();
    x.globalAlpha = 1;
  },
  curtain(x, w, h, k, c) {
    const n = 28;
    for (let i = 0; i < n; i++) { const kk = ease(fade(k, i / n * 0.5, i / n * 0.5 + 0.5)); x.fillStyle = c(i % 2 ? "#b20710" : "#e50914", 0.95); x.fillRect((i / n) * w, 0, w / n + 1, h * kk); }
  },
  grid(x, w, h, k, c) {
    x.fillStyle = `rgba(13,17,23,${0.9 * ease(k)})`; x.fillRect(0, 0, w, h);
    const cs = Math.max(18, w / 52), cols = Math.ceil(w / cs), rows = Math.ceil(h / cs), G = ["#0e4429", "#006d32", "#26a641", "#39d353"];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const d = (i + j) / (cols + rows), v = fade(k * 1.5, d, d + 0.2); if (!v) continue;
      const lv = ((i * 7 + j * 13) % 11) % 4, sz = (cs - 4) * ease(v);
      x.fillStyle = c(G[lv]); x.beginPath(); x.roundRect(i * cs + (cs - sz) / 2, j * cs + (cs - sz) / 2, sz, sz, 3); x.fill();
    }
  },
  mail(x, w, h, k, c) {
    x.fillStyle = `rgba(10,12,24,${0.88 * ease(k)})`; x.fillRect(0, 0, w, h);
    const s = 1 + easeIn(fade(k, 0.55, 1)) * 9, W = 300 * s, H = 200 * s, cx = w / 2, cy = h / 2 + 30;
    const open = ease(fade(k, 0.1, 0.45)), up = ease(fade(k, 0.3, 0.7)) * 140 * s;
    x.fillStyle = c("#ffffff", 1, true); x.fillRect(cx - W * 0.42, cy - H / 2 - up + 10 * s, W * 0.84, H * 0.8);
    x.fillStyle = c("#ea4335"); for (let i = 0; i < 4; i++) x.fillRect(cx - W * 0.32, cy - H / 2 - up + (40 + i * 26) * s, W * (i === 3 ? 0.4 : 0.64), 8 * s);
    x.fillStyle = c("#f2f2f2", 1, true); x.fillRect(cx - W / 2, cy - H / 2 + H * 0.15, W, H * 0.85);
    x.fillStyle = c("#d93025"); x.beginPath(); x.moveTo(cx - W / 2, cy - H / 2 + H * 0.15); x.lineTo(cx, cy + H * 0.15); x.lineTo(cx + W / 2, cy - H / 2 + H * 0.15); x.lineTo(cx + W / 2, cy + H / 2); x.lineTo(cx - W / 2, cy + H / 2); x.closePath(); x.globalAlpha = 0.25; x.fill(); x.globalAlpha = 1;
    x.fillStyle = c("#ea4335"); x.beginPath(); x.moveTo(cx - W / 2, cy - H / 2 + H * 0.15); x.lineTo(cx, cy - H / 2 + H * 0.15 + H * 0.55 * (1 - 2 * open)); x.lineTo(cx + W / 2, cy - H / 2 + H * 0.15); x.closePath(); x.fill();
  },
  stack(x, w, h, k, c) {
    x.fillStyle = `rgba(20,14,8,${0.85 * ease(k)})`; x.fillRect(0, 0, w, h);
    const cx = w / 2, by = h / 2 + 110;
    x.strokeStyle = c("#bcbbbb"); x.lineWidth = 14; x.lineJoin = "round"; x.beginPath(); x.moveTo(cx - 130, by - 70); x.lineTo(cx - 130, by); x.lineTo(cx + 130, by); x.lineTo(cx + 130, by - 70); x.stroke();
    for (let i = 0; i < 5; i++) {
      const v = ease(fade(k, i * 0.12, i * 0.12 + 0.35)), ty = by - 36 - i * 34, y = -60 + (ty + 60) * v, a = (i * 12) * Math.PI / 180;
      x.save(); x.translate(cx - 10 + i * 8, y); x.rotate(a * v); x.fillStyle = c("#f48024"); x.fillRect(-90, -9, 180, 18); x.restore();
    }
  },
  upvote(x, w, h, k, c) {
    x.fillStyle = `rgba(10,10,12,${0.85 * ease(k)})`; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 36; i++) {
      const sx = ((i * 97) % 100) / 100 * w, d = (i % 9) / 9 * 0.4, v = fade(k, d, d + 0.6), y = h + 60 - v * (h + 200), s = 18 + (i % 4) * 8;
      x.fillStyle = c(i % 3 ? "#ff4500" : "#ff8b60", 0.9); x.beginPath(); x.moveTo(sx, y - s); x.lineTo(sx + s, y); x.lineTo(sx + s * 0.45, y); x.lineTo(sx + s * 0.45, y + s); x.lineTo(sx - s * 0.45, y + s); x.lineTo(sx - s * 0.45, y); x.lineTo(sx - s, y); x.closePath(); x.fill();
    }
  },
  slash(x, w, h, k, c) {
    x.fillStyle = `rgba(0,0,0,${0.92 * ease(k)})`; x.fillRect(0, 0, w, h);
    x.strokeStyle = c("#ffffff", 1, true); x.lineCap = "round"; x.lineWidth = Math.min(w, h) * 0.06;
    const a = ease(fade(k, 0, 0.45)), b = ease(fade(k, 0.3, 0.75)), m = Math.min(w, h) * 0.35;
    x.beginPath(); x.moveTo(w / 2 - m, h / 2 - m); x.lineTo(w / 2 - m + 2 * m * a, h / 2 - m + 2 * m * a); x.stroke();
    x.beginPath(); x.moveTo(w / 2 + m, h / 2 - m); x.lineTo(w / 2 + m - 2 * m * b, h / 2 - m + 2 * m * b); x.stroke();
  },
  network(x, w, h, k, c, st) {
    x.fillStyle = `rgba(4,12,24,${0.88 * ease(k)})`; x.fillRect(0, 0, w, h);
    if (!st.pts) st.pts = Array.from({ length: 26 }, (_, i) => [w / 2 + Math.cos(i * 2.4) * (60 + i * 18), h / 2 + Math.sin(i * 2.4) * (40 + i * 12)]);
    const n = Math.floor(ease(k) * st.pts.length);
    x.strokeStyle = c("#0a66c2", 0.8); x.lineWidth = 2;
    for (let i = 1; i < n; i++) { const p = st.pts[i], q = st.pts[Math.floor(i / 2)]; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); }
    for (let i = 0; i < n; i++) { x.fillStyle = c(i ? "#70b5f9" : "#ffffff", 1, !i); x.beginPath(); x.arc(st.pts[i][0], st.pts[i][1], i ? 7 : 14, 0, 6.283); x.fill(); }
  },
  rings(x, w, h, k, c) {
    x.fillStyle = `rgba(6,10,8,${0.88 * ease(k)})`; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { const v = fade(k, i * 0.08, i * 0.08 + 0.6), r = v * Math.max(w, h) * 0.6; x.strokeStyle = c("#1db954", 1 - v); x.lineWidth = 10; x.beginPath(); x.arc(w / 2, h / 2, r, 0, 6.283); x.stroke(); }
    for (let i = 0; i < 5; i++) { const bh = 30 + Math.abs(Math.sin(k * 20 + i)) * 90; x.fillStyle = c("#1ed760"); x.fillRect(w / 2 - 70 + i * 30, h / 2 - bh / 2, 18, bh); }
  },
  spark(x, w, h, k, c, st) {
    x.fillStyle = `rgba(8,6,16,${0.88 * ease(k)})`; x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 260 * ease(k) + 1); g.addColorStop(0, c("#d97757", 0.9)); g.addColorStop(1, c("#d97757", 0)); x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (!st.p) st.p = Array.from({ length: 140 }, () => [Math.random() * 6.283, 0.4 + Math.random(), 2 + Math.random() * 4]);
    for (const [a, sp, r] of st.p) { const d = ease(k) * sp * Math.max(w, h) * 0.55; x.fillStyle = c("#ffffff", 1 - k * 0.6, true); x.beginPath(); x.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, r * (1 - k * 0.5), 0, 6.283); x.fill(); }
  },
  pin(x, w, h, k, c) {
    x.fillStyle = `rgba(6,14,10,${0.85 * ease(k)})`; x.fillRect(0, 0, w, h);
    const v = fade(k, 0, 0.45), bounce = v < 1 ? -h * 0.6 * (1 - ease(v)) : 0, cx = w / 2, cy = h / 2 + bounce;
    for (let i = 0; i < 3; i++) { const r = fade(k, 0.45 + i * 0.12, 1) * 260; if (r) { x.strokeStyle = c("#34a853", 1 - r / 260); x.lineWidth = 4; x.beginPath(); x.ellipse(w / 2, h / 2 + 70, r, r * 0.35, 0, 0, 6.283); x.stroke(); } }
    x.fillStyle = c("#ea4335"); x.beginPath(); x.arc(cx, cy - 20, 46, Math.PI, 0); x.quadraticCurveTo(cx + 46, cy + 20, cx, cy + 70); x.quadraticCurveTo(cx - 46, cy + 20, cx - 46, cy - 20); x.fill();
    x.fillStyle = c("#7a1c14"); x.beginPath(); x.arc(cx, cy - 20, 16, 0, 6.283); x.fill();
  },
  orbit(x, w, h, k, c) {
    x.fillStyle = `rgba(10,10,12,${0.9 * ease(k)})`; x.fillRect(0, 0, w, h);
    const L = "WΩИ維ウ百Аmenta∑ίو", R = 140 + ease(k) * 80;
    x.font = '600 28px "Space Grotesk", serif'; x.textAlign = "center"; x.textBaseline = "middle";
    for (let i = 0; i < 48; i++) {
      const a = i * 0.7 + k * 7, b = (i / 48) * Math.PI, z = Math.sin(a) * Math.sin(b);
      x.fillStyle = c("#ffffff", 0.35 + 0.65 * (z + 1) / 2, true);
      x.fillText(L[i % L.length], w / 2 + Math.cos(a) * Math.sin(b) * R, h / 2 + Math.cos(b) * R);
    }
    x.textAlign = "start";
  },
  cube(x, w, h, k, c) {
    x.fillStyle = `rgba(20,4,6,${0.88 * ease(k)})`; x.fillRect(0, 0, w, h);
    const s = 70 + easeIn(k) * 900, cx = w / 2, cy = h / 2, o = ease(fade(k, 0.1, 0.6)) * s * 0.35;
    const face = (pts, col) => { x.fillStyle = col; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); };
    face([[cx, cy - s - o], [cx + s * 0.87, cy - s / 2 - o], [cx, cy - o], [cx - s * 0.87, cy - s / 2 - o]], c("#ff6b6b"));
    face([[cx - s * 0.87, cy - s / 2], [cx, cy], [cx, cy + s], [cx - s * 0.87, cy + s / 2]], c("#cb3837"));
    face([[cx + s * 0.87, cy - s / 2], [cx, cy], [cx, cy + s], [cx + s * 0.87, cy + s / 2]], c("#a62b2a"));
  },
  warp(x, w, h, k, c, st) {
    x.fillStyle = `rgba(3,4,10,${0.9 * ease(k)})`; x.fillRect(0, 0, w, h);
    if (!st.s) st.s = Array.from({ length: 260 }, () => [Math.random() * 6.283, Math.random() * 0.2, 0.3 + Math.random()]);
    x.lineWidth = 2;
    for (const [a, r0, sp] of st.s) {
      const d0 = (r0 + easeIn(k) * sp) * Math.max(w, h), d1 = d0 * (1 + 0.2 + k * 0.6);
      x.strokeStyle = c("#c9d4ff", Math.min(1, k * 2)); x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * d0, h / 2 + Math.sin(a) * d0); x.lineTo(w / 2 + Math.cos(a) * d1, h / 2 + Math.sin(a) * d1); x.stroke();
    }
    if (st.img && st.img.complete && st.img.naturalWidth) {
      const s = 64 + easeIn(k) * 900; x.globalAlpha = 1 - fade(k, 0.7, 1);
      x.fillStyle = c("#eef0f6", 1, true); x.beginPath(); x.roundRect(w / 2 - s * 0.7, h / 2 - s * 0.7, s * 1.4, s * 1.4, s * 0.3); x.fill();
      x.drawImage(st.img, w / 2 - s / 2, h / 2 - s / 2, s, s); x.globalAlpha = 1;
    }
  },
};

let busy = false;
export function launch(url, { icon, hacker, accent, name } = {}) {
  if (busy || matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  busy = true;
  const cv = document.createElement("canvas"); cv.className = "launch"; document.body.append(cv);
  const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  const x = cv.getContext("2d"); x.scale(dpr, dpr);
  const n = parseInt((accent || "#00ff66").slice(1), 16), A = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // colour picker: brand-ish colours normally, all accent in the Hacker look (keepLight keeps whites bright)
  const c = (hex, a = 1, keepLight) => {
    if (!hacker) { const m = parseInt(hex.slice(1), 16); return `rgba(${(m >> 16) & 255},${(m >> 8) & 255},${m & 255},${a})`; }
    return keepLight ? `rgba(${A.map((v) => Math.round(v + (255 - v) * 0.6))},${a})` : `rgba(${A},${a})`;
  };
  const kind = sceneFor(url), st = {};
  if (icon) { st.img = new Image(); st.img.src = icon; }
  const label = `> launching ${host(url) || name || url} …`;
  return new Promise((done) => {
    const t0 = performance.now();
    const frame = (now) => {
      const k = Math.max(0, Math.min(1, (now - t0) / DUR)); // rAF time can be a hair before t0
      x.clearRect(0, 0, w, h);
      SCENES[kind](x, w, h, k, c, st);
      if (hacker) {
        x.fillStyle = `rgba(${A},${Math.min(1, k * 3)})`; x.font = '600 16px "JetBrains Mono", monospace';
        x.fillText(label.slice(0, Math.ceil(label.length * Math.min(1, k * 1.6))) + (k < 1 ? "▋" : " [OK]"), 32, h - 40);
        x.fillStyle = "rgba(0,0,0,.25)"; for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1);
      }
      if (k < 1) requestAnimationFrame(frame);
      else { done(); setTimeout(() => { cv.remove(); busy = false; }, 1500); }
    };
    requestAnimationFrame(frame);
  });
}
// in case the page is restored from the back/forward cache with the overlay still up
addEventListener("pageshow", () => { document.querySelectorAll(".launch").forEach((e) => e.remove()); busy = false; });
