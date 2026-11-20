// Live sky: the real weather and the real sun for your city. Rain streaks and
// drops on the glass, snow, fog, lightning, clouds that drift with the wind,
// and a sky that follows sunrise and sunset. Layers move with the parallax.
import { par } from "../parallax.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const rnd = (a, b) => a + Math.random() * (b - a);

// sky colours (top, middle, horizon) by how high the sun is: -1 midnight .. 1 noon
const STOPS = [
  [-1, ["#01020a", "#040818", "#0a1230"]],
  [-0.3, ["#03051a", "#0b1442", "#1d2a63"]],
  [-0.08, ["#151240", "#4b2f73", "#d9675a"]],
  [0.06, ["#2c3f8f", "#c97a8a", "#ffb27a"]],
  [0.25, ["#2a64c9", "#5f9fe8", "#b9defa"]],
  [1, ["#1b56c4", "#4a95ec", "#a6d6fb"]],
].map(([e, c]) => [e, c.map(hex)]);
function skyAt(e) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [e0, c0] = STOPS[i], [e1, c1] = STOPS[i + 1];
    if (e <= e1) { const k = clamp((e - e0) / (e1 - e0), 0, 1); return c0.map((c, j) => mixc(c, c1[j], k)); }
  }
  return STOPS[STOPS.length - 1][1];
}

// WMO weather code -> what to draw
export function weatherKind(code) {
  if ([95, 96, 99].includes(code)) return ["thunder", 0.9];
  if ([71, 85].includes(code)) return ["snow", 0.5];
  if (code === 73) return ["snow", 0.75];
  if ([75, 86].includes(code)) return ["snow", 1];
  if (code === 77) return ["snow", 0.35];
  if ([45, 48].includes(code)) return ["fog", 1];
  if (code >= 51 && code <= 57) return ["rain", 0.35];
  if ([61, 80].includes(code)) return ["rain", 0.55];
  if ([63, 81].includes(code)) return ["rain", 0.75];
  if ([65, 66, 67, 82].includes(code)) return ["rain", 1];
  return ["clear", 0];
}
export const PREVIEW = { clear: [0, 8], cloudy: [3, 92], rain: [63, 95], thunder: [95, 100], snow: [73, 90], fog: [45, 70] };

// Where the sun is at a given minute of the day.
export function sunAt(m, rise, set) {
  if (m >= rise && m <= set) { const p = (m - rise) / (set - rise); return { day: true, p, e: Math.sin(Math.PI * p) }; }
  const nightLen = 1440 - set + rise;
  const q = ((m - set + 1440) % 1440) / nightLen;
  return { day: false, p: q, e: -Math.sin(Math.PI * q) };
}

function cloudSprite(color, seed) {
  const c = document.createElement("canvas"); c.width = 440; c.height = 180;
  const x = c.getContext("2d");
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 26; i++) {
    const u = r(), cx = 70 + u * 300, hump = Math.sin(u * Math.PI);
    const cy = 122 - hump * (18 + r() * 46), rr = 16 + (14 + r() * 26) * (0.55 + hump * 0.6);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, css(color, 0.3)); g.addColorStop(0.55, css(color, 0.16)); g.addColorStop(1, css(color, 0));
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rr, 0, 6.283); x.fill();
  }
  // shade the underside a little, like real cumulus
  x.globalCompositeOperation = "source-atop";
  const sh = x.createLinearGradient(0, 70, 0, 160); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(30,36,52,.35)");
  x.fillStyle = sh; x.fillRect(0, 0, 440, 180);
  return c;
}

function layers(w, h) {
  // three silhouettes, drawn wider than the screen so the parallax never shows an edge
  const pad = w * 0.06, L = [];
  const hill = (base, amp, f, ph) => {
    const p = new Path2D(); p.moveTo(-pad, h);
    for (let x = -pad; x <= w + pad; x += 8) p.lineTo(x, base - amp * (0.55 * Math.sin(x * f + ph) + 0.3 * Math.sin(x * f * 2.3 + ph * 1.7) + 0.15 * Math.sin(x * f * 5.1)));
    p.lineTo(w + pad, h); p.closePath(); return p;
  };
  L.push({ path: hill(h * 0.74, h * 0.07, 2.2 / w, 1.3), depth: 0.25, shade: 0.5 });
  L.push({ path: hill(h * 0.82, h * 0.045, 3.4 / w, 4.1), depth: 0.5, shade: 0.7 });
  const city = new Path2D(), wins = [];
  let x = -pad; city.moveTo(-pad, h);
  while (x < w + pad) {
    const bw = rnd(w * 0.018, w * 0.045), bh = rnd(h * 0.05, h * 0.19) * (Math.random() < 0.12 ? 1.5 : 1), top = h - bh;
    city.lineTo(x, top); city.lineTo(x + bw, top);
    if (Math.random() < 0.15) { city.lineTo(x + bw * 0.5, top - h * 0.02); city.lineTo(x + bw, top); } // a spire now and then
    const cw = Math.max(3, bw / 7), ch = Math.max(3, h / 160);
    for (let yy = top + ch * 2; yy < h - ch; yy += ch * 2.6)
      for (let xx = x + cw; xx < x + bw - cw; xx += cw * 2) if (Math.random() < 0.38) wins.push([xx, yy, cw, ch, Math.random()]);
    x += bw + rnd(0, w * 0.006);
  }
  city.lineTo(w + pad, h); city.closePath();
  L.push({ path: city, depth: 1, shade: 0.86, wins });
  return L;
}

export const sky = {
  init(w, h, dpr) {
    const area = (w * h) / (1920 * 1080 * dpr * dpr);
    return {
      stars: Array.from({ length: Math.round(260 * Math.max(0.6, area)) }, () => ({ x: Math.random(), y: Math.random() * 0.75, r: rnd(0.4, 1.4), p: rnd(0, 6.28), s: rnd(0.6, 2) })),
      clouds: Array.from({ length: 16 }, (_, i) => ({ x: Math.random(), y: rnd(0.02, 0.42), s: rnd(0.6, 1.7), i: i % 6, v: rnd(0.6, 1.4) })),
      rain: Array.from({ length: Math.round(900 * area) }, () => ({ x: Math.random() * w, y: Math.random() * h, l: rnd(14, 30) * dpr, v: rnd(16, 26) * dpr })),
      snow: Array.from({ length: Math.round(420 * area) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: rnd(1, 3.2) * dpr, v: rnd(0.6, 1.8) * dpr, p: rnd(0, 6.28) })),
      glass: Array.from({ length: 46 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: rnd(2.5, 9) * dpr, vy: 0, slide: false, trail: [] })),
      L: layers(w, h), sprites: [], spriteKey: "", flash: 0, nextBolt: 4, bolt: null, shoot: null, last: 0,
      fog: null,
    };
  },

  draw(ctx, w, h, t, st, accent, mouse, dpr, env) {
    const D = (env && env.data) || {};
    const dt = Math.min(0.05, t - (st.last || t)); st.last = t;
    const wx = D.wx || null;
    const off = wx && Number.isFinite(wx.off) ? wx.off : -new Date().getTimezoneOffset() * 60;
    const rise = wx ? wx.rise : 375, set = wx ? wx.set : 1080;
    const m = D.override != null ? D.override : ((Date.now() / 60000 + off / 60) % 1440 + 1440) % 1440;
    let code = wx ? wx.code : 0, cloud = wx ? wx.cloud : 15;
    if (D.preview && PREVIEW[D.preview]) [code, cloud] = PREVIEW[D.preview];
    const wind = wx ? wx.wind : 8;
    const [kind, inten] = weatherKind(code);
    const sun = sunAt(m, rise, set), e = sun.e;
    const ov = clamp(Math.max((cloud - 40) / 60, kind === "clear" ? 0 : 0.55 + inten * 0.35), 0, 1); // how overcast
    const px = par.x * dpr, py = par.y * dpr;

    // sky
    let [top, mid, hor] = skyAt(e);
    const grey = mixc([62, 70, 84], [16, 18, 26], clamp(-e * 2 + 0.3, 0, 1));
    const gk = ov * (kind === "thunder" ? 0.85 : 0.7);
    top = mixc(top, grey, gk); mid = mixc(mid, grey, gk); hor = mixc(hor, mixc(grey, [120, 128, 140], 0.3), gk * 0.9);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(top)); g.addColorStop(0.55, css(mid)); g.addColorStop(0.8, css(hor)); g.addColorStop(1, css(hor));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // stars and the odd shooting star
    const sa = clamp(-e * 3.2, 0, 1) * (1 - ov * 0.9);
    if (sa > 0.01) {
      const sx = -px * 8, sy = -py * 4;
      for (const s of st.stars) {
        const a = sa * (0.55 + 0.45 * Math.sin(t * s.s + s.p));
        ctx.fillStyle = `rgba(235,240,255,${a.toFixed(3)})`;
        ctx.fillRect(s.x * w + sx, s.y * h + sy, s.r * dpr, s.r * dpr);
      }
      if (!st.shoot && Math.random() < 0.002 * sa) st.shoot = { x: rnd(0.1, 0.8) * w, y: rnd(0.05, 0.3) * h, k: 0 };
      if (st.shoot) {
        const S = st.shoot; S.k += dt * 1.6;
        const x1 = S.x + S.k * w * 0.25, y1 = S.y + S.k * h * 0.12, tail = 120 * dpr;
        const lg = ctx.createLinearGradient(x1 - tail, y1 - tail * 0.48, x1, y1);
        lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(1, `rgba(255,255,255,${(sa * (1 - S.k)).toFixed(3)})`);
        ctx.strokeStyle = lg; ctx.lineWidth = 1.6 * dpr; ctx.beginPath(); ctx.moveTo(x1 - tail, y1 - tail * 0.48); ctx.lineTo(x1, y1); ctx.stroke();
        if (S.k >= 1) st.shoot = null;
      }
    }

    // sun or moon on an arc across the sky
    const hz = h * 0.74;
    const bx = w * (0.1 + 0.8 * sun.p) - px * 14, by = hz - Math.sin(Math.PI * sun.p) * h * 0.58 - py * 8;
    const vis = 1 - ov * 0.85;
    if (sun.day) {
      const low = clamp(1 - e / 0.3, 0, 1);
      const col = mixc([255, 246, 214], [255, 156, 84], low), R = (34 + low * 14) * dpr;
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, R * 9);
      glow.addColorStop(0, css(col, 0.55 * vis)); glow.addColorStop(0.25, css(col, 0.16 * vis)); glow.addColorStop(1, css(col, 0));
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      const disc = clamp(1 - ov * 1.5, 0, 1);
      if (disc > 0.01) { ctx.fillStyle = css(mixc(col, [255, 255, 255], 0.4), disc); ctx.beginPath(); ctx.arc(bx, by, R, 0, 6.283); ctx.fill(); }
    } else {
      const R = 24 * dpr, mv = clamp(1 - ov * 1.5, 0, 1) * clamp(-e * 4, 0, 1) * clamp((hz - by) / (h * 0.12), 0, 1);
      if (mv > 0.01) {
        const glow = ctx.createRadialGradient(bx, by, 0, bx, by, R * 8);
        glow.addColorStop(0, `rgba(200,215,255,${(0.3 * mv).toFixed(3)})`); glow.addColorStop(1, "rgba(200,215,255,0)");
        ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
        const body = ctx.createRadialGradient(bx - R * 0.35, by - R * 0.35, R * 0.1, bx, by, R);
        body.addColorStop(0, `rgba(250,252,255,${mv.toFixed(3)})`); body.addColorStop(1, `rgba(196,206,232,${mv.toFixed(3)})`);
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(bx, by, R, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(150,160,192,${(0.3 * mv).toFixed(3)})`;
        for (const [cx, cy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [0.05, 0.42, 0.12], [-0.2, 0.32, 0.08]]) { ctx.beginPath(); ctx.arc(bx + cx * R, by + cy * R, cr * R, 0, 6.283); ctx.fill(); }
      }
    }

    // clouds, tinted by the light
    const cday = mixc([255, 255, 255], [255, 196, 170], clamp(1 - e / 0.25, 0, 1) * (e > -0.1 ? 1 : 0));
    let ccol = e > -0.1 ? cday : mixc([46, 54, 80], [255, 196, 170], clamp((e + 0.1) * 10 + 0.3, 0, 0.3));
    ccol = mixc(ccol, mixc([150, 156, 168], [36, 40, 52], clamp(-e * 3, 0, 1)), ov * 0.75);
    const key = ccol.map((v) => Math.round(v / 6)).join(",");
    if (key !== st.spriteKey) { st.spriteKey = key; st.sprites = Array.from({ length: 6 }, (_, i) => cloudSprite(ccol, i + 1)); }
    const nC = Math.round(3 + clamp(cloud, 0, 100) / 100 * 13);
    const drift = (0.004 + wind / 4000) * dt;
    for (let i = 0; i < nC; i++) {
      const c = st.clouds[i]; c.x += drift * c.v; if (c.x > 1.25) { c.x = -0.3; c.y = rnd(0.02, 0.42); }
      const sw = 420 * c.s * dpr * (w / (1600 * dpr)), shh = 170 * c.s * dpr * (w / (1600 * dpr));
      ctx.globalAlpha = clamp(0.55 + ov * 0.45, 0, 1);
      ctx.drawImage(st.sprites[c.i], c.x * w - sw / 2 - px * 22, c.y * h - py * 10, sw, shh);
    }
    ctx.globalAlpha = 1;
    if (ov > 0.5) { const og = ctx.createLinearGradient(0, 0, 0, h * 0.6); og.addColorStop(0, css(grey, (ov - 0.5) * 0.9)); og.addColorStop(1, css(grey, 0)); ctx.fillStyle = og; ctx.fillRect(0, 0, w, h * 0.6); }

    // lightning lights everything up for a moment
    if (kind === "thunder") {
      if (t > st.nextBolt) {
        st.flash = 1; st.nextBolt = t + rnd(4, 11);
        let bx2 = rnd(0.15, 0.85) * w, by2 = 0; const pts = [[bx2, by2]];
        while (by2 < hz * 0.95) { bx2 += rnd(-40, 40) * dpr; by2 += rnd(20, 50) * dpr; pts.push([bx2, by2]); }
        st.bolt = pts;
      }
      if (st.flash > 0) {
        ctx.fillStyle = `rgba(220,228,255,${(st.flash * 0.45).toFixed(3)})`; ctx.fillRect(0, 0, w, h);
        if (st.flash > 0.55 && st.bolt) {
          ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 2.4 * dpr; ctx.shadowColor = "#bcd0ff"; ctx.shadowBlur = 24 * dpr;
          ctx.beginPath(); st.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.shadowBlur = 0;
        }
        st.flash = Math.max(0, st.flash - dt * 2.6);
      }
    }

    // hills and the city, each at its own depth
    const night = clamp(-e * 3 + 0.15, 0, 1);
    for (const l of st.L) {
      const base = mixc(hor, [4, 6, 14], l.shade + (1 - l.shade) * night * 0.6);
      ctx.save(); ctx.translate(-px * 30 * l.depth, -py * 12 * l.depth);
      ctx.fillStyle = css(mixc(base, grey, ov * 0.25)); ctx.fill(l.path);
      if (l.wins && night > 0.05) {
        const lit = clamp(night * 1.4, 0, 1);
        ctx.fillStyle = `rgba(255,206,120,${(0.75 * lit).toFixed(3)})`;
        ctx.beginPath();
        for (const [x, y, ww, hh, r] of l.wins) if (r < lit * 0.85 && Math.sin(t * 0.05 + r * 50) > -0.92) ctx.rect(x, y, ww, hh);
        ctx.fill();
      }
      ctx.restore();
    }

    // fog: slow bands of mist
    if (kind === "fog" || (D.preview === "fog")) {
      if (!st.fog) {
        const f = document.createElement("canvas"); f.width = 800; f.height = 200; const fx = f.getContext("2d");
        for (let i = 0; i < 18; i++) { const r = rnd(50, 95), x = rnd(r, 800 - r), y = rnd(r * 0.6, 200 - r * 0.6), gg = fx.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, "rgba(255,255,255,.2)"); gg.addColorStop(1, "rgba(255,255,255,0)"); fx.fillStyle = gg; fx.beginPath(); fx.ellipse(x, y, r, r * 0.6, 0, 0, 6.283); fx.fill(); }
        st.fog = f;
      }
      const fc = clamp(0.35 + Math.max(0, e) * 0.5, 0.2, 0.8);
      ctx.globalAlpha = fc;
      for (let b = 0; b < 4; b++) {
        const y = h * (0.42 + b * 0.13) - py * 6 * b, bw = w * 0.9, bh = h * 0.3, xo = ((t * (8 + b * 5) * dpr) % (bw * 0.55));
        for (let x = -bw + xo - px * 10 * b; x < w; x += bw * 0.55) ctx.drawImage(st.fog, x, y, bw, bh);
      }
      ctx.globalAlpha = 1;
      const hz2 = ctx.createLinearGradient(0, h * 0.3, 0, h);
      hz2.addColorStop(0, css(hor, 0)); hz2.addColorStop(1, css(mixc(hor, [200, 205, 215], 0.4), 0.5 * fc));
      ctx.fillStyle = hz2; ctx.fillRect(0, 0, w, h);
    }

    // rain streaks, then drops on the glass
    if (kind === "rain" || kind === "thunder") {
      const n = Math.round(st.rain.length * clamp(inten, 0.25, 1)), slant = 0.12 + wind / 90;
      ctx.strokeStyle = `rgba(200,214,238,${(0.22 + inten * 0.18).toFixed(3)})`; ctx.lineWidth = Math.max(1, dpr * 1.1);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const r = st.rain[i];
        r.y += r.v * (0.7 + inten * 0.5); r.x += r.v * slant;
        if (r.y > h) { r.y = -r.l; r.x = Math.random() * (w + h * slant) - h * slant; }
        ctx.moveTo(r.x - px * 6, r.y); ctx.lineTo(r.x - r.l * slant - px * 6, r.y - r.l);
      }
      ctx.stroke();
      const gN = Math.round(st.glass.length * clamp(inten + 0.2, 0.3, 1));
      for (let i = 0; i < gN; i++) {
        const d = st.glass[i];
        if (!d.slide && Math.random() < 0.0012 * (d.r / dpr)) d.slide = true;
        if (d.slide) {
          d.vy = Math.min(d.vy + 0.15 * dpr, 5 * dpr); d.y += d.vy; d.x += Math.sin(d.y * 0.02) * 0.4 * dpr;
          if (Math.random() < 0.3) d.trail.push([d.x, d.y - d.r, d.r * 0.32, 1]);
          if (d.y > h + 20) { d.y = Math.random() * h * 0.7; d.x = Math.random() * w; d.vy = 0; d.slide = false; d.r = rnd(2.5, 9) * dpr; }
        }
        for (const tr of d.trail) tr[3] -= dt * 0.25;
        d.trail = d.trail.filter((tr) => tr[3] > 0).slice(-30);
        for (const [x, y, r, a] of d.trail) { ctx.fillStyle = `rgba(210,225,245,${(0.25 * a).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
        const lg = ctx.createRadialGradient(d.x - d.r * 0.35, d.y - d.r * 0.4, d.r * 0.1, d.x, d.y, d.r);
        lg.addColorStop(0, "rgba(255,255,255,.55)"); lg.addColorStop(0.45, "rgba(190,210,235,.12)"); lg.addColorStop(0.85, "rgba(10,20,40,.22)"); lg.addColorStop(1, "rgba(255,255,255,.18)");
        ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.9, d.r, 0, 0, 6.283); ctx.fill();
      }
    }

    // snow drifting down
    if (kind === "snow") {
      const n = Math.round(st.snow.length * clamp(inten, 0.3, 1));
      ctx.fillStyle = "rgba(245,248,255,.85)"; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = st.snow[i];
        s.y += s.v * (1 + inten * 0.4); s.x += Math.sin(t * 0.8 + s.p) * 0.5 * dpr + wind / 60 * dpr;
        if (s.y > h) { s.y = -5; s.x = Math.random() * w; }
        if (s.x > w + 10) s.x = -10;
        const sx = s.x - px * 10 * (s.r / dpr / 3);
        ctx.moveTo(sx + s.r, s.y); ctx.arc(sx, s.y, s.r, 0, 6.283);
      }
      ctx.fill();
    }
  },
};

// The time-travel track: the real sky colours across the day, midnight to midnight.
export function dayGradient(rise, set) {
  const stops = [];
  for (let m = 0; m <= 1440; m += 40) {
    const [top, mid] = skyAt(sunAt(m % 1440, rise, set).e);
    stops.push(`${css(mixc(top, mid, 0.6))} ${((m / 1440) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
