// GitHub city: your last year of contributions as a night skyline. Every day is
// a building and busier days are taller. The year is laid out as four city
// blocks (one per quarter) with streets between them. It turns slowly, tilts
// with the parallax, and a building lights up when you point at it.
import { par } from "../parallax.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const BW = 13, BD = 7, GAP = 2; // weeks per block, days deep, street width

function build(gh) {
  const days = gh ? gh.days : Array.from({ length: 364 }, () => ({ date: "", count: 0, level: 0 }));
  const first = gh && days[0].date ? new Date(days[0].date + "T00:00:00").getDay() : 0;
  const max = gh ? gh.max : 1, B = [];
  days.forEach((d, i) => {
    const k = i + first, week = Math.floor(k / 7), wd = k % 7;
    const blk = Math.min(3, Math.floor(week / BW)), c = week - blk * BW;
    const X = (blk % 2) * (BW + GAP) + c, Z = Math.floor(blk / 2) * (BD + GAP) + wd;
    const hgt = d.count ? 0.7 + 6 * Math.sqrt(d.count / max) : 0.08;
    B.push({ X, Z, hgt, d, seed: (i * 9301 + 49297) % 233280 / 233280, delay: 0 });
  });
  const cx = (BW * 2 + GAP) / 2, cz = (BD * 2 + GAP) / 2;
  for (const b of B) { b.X -= cx; b.Z -= cz; b.delay = Math.hypot(b.X, b.Z) * 0.04 + b.seed * 0.3; }
  return B;
}

const fmtDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function inPoly(x, y, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

export const city = {
  fps: 45,
  init(w, h, dpr) {
    return { stars: Array.from({ length: 220 }, () => [Math.random(), Math.random() * 0.55, Math.random() * 1.2 + 0.3, Math.random() * 6.28]), ref: undefined, B: [], born: 0 };
  },
  draw(ctx, w, h, t, st, accent, mouse, dpr, env) {
    const D = (env && env.data) || {}, gh = D.gh && D.gh.days ? D.gh : null;
    if (st.ref !== gh) { st.ref = gh; st.B = build(gh); st.born = t; }
    const A = rgb(accent), hacker = document.body.dataset.mode === "hacker";

    // night sky with a glow on the horizon
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#03040b"); g.addColorStop(0.55, css(mixc([6, 8, 20], A, 0.12))); g.addColorStop(1, css(mixc([10, 12, 28], A, 0.3)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (const [x, y, r, p] of st.stars) { ctx.fillStyle = `rgba(230,236,255,${(0.35 + 0.35 * Math.sin(t * 1.5 + p)).toFixed(2)})`; ctx.fillRect(x * w - par.x * 6 * dpr, y * h, r * dpr, r * dpr); }

    // camera: slow turn, tilt and turn a little more with the mouse
    const th = t * 0.055 + par.x * 0.45, cs = Math.cos(th), sn = Math.sin(th);
    const phi = 0.62 + par.y * 0.12, sT = Math.sin(phi), cT = Math.cos(phi);
    const S = Math.min(w / 39, h / 23), cx = w / 2, cy = h * 0.63;
    const P = (x, y, z) => { const xr = x * cs - z * sn, zr = x * sn + z * cs; return [cx + xr * S, cy + zr * S * sT - y * S * cT]; };

    // the ground, with a faint grid
    const ex = BW + GAP / 2 + 1.5, ez = BD + GAP / 2 + 1.5;
    const gp = [P(-ex, 0, -ez), P(ex, 0, -ez), P(ex, 0, ez), P(-ex, 0, ez)];
    ctx.fillStyle = css(mixc([6, 8, 16], A, 0.06), 0.92); ctx.beginPath(); gp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = css(A, 0.09); ctx.lineWidth = dpr; ctx.beginPath();
    for (let x = -ex; x <= ex + 0.01; x += 1) { const [a1, b1] = P(x, 0, -ez), [a2, b2] = P(x, 0, ez); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); }
    for (let z = -ez; z <= ez + 0.01; z += 1) { const [a1, b1] = P(-ex, 0, z), [a2, b2] = P(ex, 0, z); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); }
    ctx.stroke();

    // buildings, far to near
    const order = st.B.map((b) => ({ b, z: (b.X + 0.5) * sn + (b.Z + 0.5) * cs })).sort((p, q) => p.z - q.z);
    const lvl = (n) => [mixc([22, 26, 44], A, 0.18), mixc(A, [14, 16, 30], 0.62), mixc(A, [14, 16, 30], 0.42), mixc(A, [14, 16, 30], 0.2), mixc(A, [255, 255, 255], 0.18)][n] || A;
    const faces = [[0, 1, 0, 1], [0, 0, 0, -1], [1, 0, 1, 0], [-1, 0, -1, 0]]; // side normals (nx, nz) as used below
    const hit = [];
    const mx = mouse.x === null ? -1 : mouse.x * dpr, my = mouse.y === null ? -1 : mouse.y * dpr;
    let hovered = null;
    for (const { b } of order) {
      const grow = clamp((t - st.born - b.delay) / 0.9, 0, 1), e = 1 - Math.pow(1 - grow, 3);
      const H = Math.max(0.04, b.hgt * e), g0 = 0.12, x0 = b.X + g0, x1 = b.X + 1 - g0, z0 = b.Z + g0, z1 = b.Z + 1 - g0;
      const isHover = st.hover === b;
      let base = lvl(b.d.level);
      if (isHover) base = mixc(base, [255, 255, 255], 0.55);
      const poly = [];
      const sides = [
        [[x0, z1], [x1, z1], 0, 1], [[x1, z0], [x0, z0], 0, -1], [[x1, z1], [x1, z0], 1, 0], [[x0, z0], [x0, z1], -1, 0],
      ];
      for (const [[ax, az], [bx, bz], nx, nz] of sides) {
        if (nx * sn + nz * cs <= 0) continue; // faces away from us
        const shade = 0.42 + 0.22 * (nx * cs - nz * sn);
        const p1 = P(ax, 0, az), p2 = P(bx, 0, bz), p3 = P(bx, H, bz), p4 = P(ax, H, az);
        ctx.fillStyle = css(mixc([4, 5, 10], base, shade)); ctx.beginPath(); ctx.moveTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3); ctx.lineTo(...p4); ctx.closePath(); ctx.fill();
        poly.push(p1, p2, p3, p4);
        // lit windows on taller buildings
        if (H > 1.1 && b.d.count) {
          const floors = Math.floor(H * 1.6), lit = hacker ? css(A, 0.85) : "rgba(255,214,140,.85)";
          ctx.fillStyle = lit; ctx.beginPath();
          for (let f = 0; f < floors; f++) for (let k = 0; k < 2; k++) {
            if (Math.sin(b.seed * 97 + f * 13.1 + k * 7.3 + t * 0.15) < 0.1) continue;
            const u0 = k ? 0.58 : 0.16, u1 = u0 + 0.26, v0 = (f + 0.3) / floors * (H - 0.2) / H, v1 = (f + 0.72) / floors * (H - 0.2) / H;
            const q = (u, v) => [p1[0] + (p2[0] - p1[0]) * u + (p4[0] - p1[0]) * v, p1[1] + (p2[1] - p1[1]) * u + (p4[1] - p1[1]) * v];
            const a1 = q(u0, v0), a2 = q(u1, v0), a3 = q(u1, v1), a4 = q(u0, v1);
            ctx.moveTo(...a1); ctx.lineTo(...a2); ctx.lineTo(...a3); ctx.lineTo(...a4); ctx.closePath();
          }
          ctx.fill();
        }
      }
      const t1 = P(x0, H, z0), t2 = P(x1, H, z0), t3 = P(x1, H, z1), t4 = P(x0, H, z1);
      ctx.fillStyle = css(mixc(base, [255, 255, 255], b.d.level >= 3 ? 0.2 : 0.06)); ctx.beginPath(); ctx.moveTo(...t1); ctx.lineTo(...t2); ctx.lineTo(...t3); ctx.lineTo(...t4); ctx.closePath(); ctx.fill();
      if (b.d.level >= 3) { ctx.strokeStyle = css(mixc(A, [255, 255, 255], 0.5), 0.6); ctx.lineWidth = dpr; ctx.stroke(); }
      poly.push(t1, t2, t3, t4);
      if (b.d.date) hit.push([b, poly, t1, t3]);
    }

    // which building is under the cursor (nearest first)
    if (mouse.free && mx >= 0) {
      for (let i = hit.length - 1; i >= 0; i--) {
        const [b, poly] = hit[i];
        const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
        if (mx < Math.min(...xs) || mx > Math.max(...xs) || my < Math.min(...ys) || my > Math.max(...ys)) continue;
        // test the outline: top face plus the visible sides
        let inside = false;
        for (let k = 0; k < poly.length; k += 4) if (inPoly(mx, my, poly.slice(k, k + 4))) { inside = true; break; }
        if (inside) { hovered = b; break; }
      }
    }
    st.hover = hovered;

    if (hovered) {
      const e = hit.find((x) => x[0] === hovered), top = [(e[2][0] + e[3][0]) / 2, (e[2][1] + e[3][1]) / 2];
      // a beam of light from the roof
      const bm = ctx.createLinearGradient(top[0], top[1], top[0], top[1] - 160 * dpr);
      bm.addColorStop(0, css(mixc(A, [255, 255, 255], 0.5), 0.55)); bm.addColorStop(1, css(A, 0));
      ctx.fillStyle = bm; ctx.fillRect(top[0] - 5 * dpr, top[1] - 160 * dpr, 10 * dpr, 160 * dpr);
      const n = hovered.d.count, label = `${fmtDay(hovered.d.date)}: ${n} contribution${n === 1 ? "" : "s"}`;
      ctx.font = `600 ${13 * dpr}px ${hacker ? '"JetBrains Mono", monospace' : '"Space Grotesk", system-ui, sans-serif'}`;
      const tw = ctx.measureText(label).width, bx = clamp(top[0] - tw / 2 - 12 * dpr, 8, w - tw - 32 * dpr), by = top[1] - 52 * dpr;
      ctx.fillStyle = "rgba(8,10,20,.88)"; ctx.strokeStyle = css(A, 0.9); ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath(); ctx.roundRect(bx, by, tw + 24 * dpr, 30 * dpr, hacker ? 2 : 9 * dpr); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(label, bx + 12 * dpr, by + 15 * dpr);
    }

    // no username yet, or still loading
    const msg = !D.gh ? "Add your GitHub username in Settings → Background to build your city"
      : D.gh.loading ? `Building @${D.gh.user}'s city…` : D.gh.error ? D.gh.error : "";
    if (msg) {
      ctx.font = `500 ${15 * dpr}px "Space Grotesk", system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(230,236,255,.75)"; ctx.fillText(msg, w / 2, h * 0.9); ctx.textAlign = "start";
    }
  },
};
