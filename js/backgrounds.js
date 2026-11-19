// Animated backgrounds, drawn on a <canvas> at the screen's real resolution,
// so they stay sharp on 4K monitors without shipping a heavy video.
// Each one takes (ctx, w, h, t, state, accent) per frame; the runner handles
// sizing, device pixel ratio, pausing on hidden tabs and reduced motion.

const rgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

const SCENES = {
  // Slow, glowing colour fields: calm enough to sit behind a clock all day.
  aurora: {
    scale: 0.5, // drawn at half resolution: it's soft anyway, and it saves power
    init: () => ({ seeds: Array.from({ length: 5 }, (_, i) => ({ p: Math.random() * 6.28, s: 0.04 + Math.random() * 0.05, r: 0.45 + Math.random() * 0.35, k: i })) }),
    draw(ctx, w, h, t, st, accent) {
      const a = rgb(accent);
      const pal = [a, [124, 92, 255], [0, 200, 200], [255, 90, 160], [40, 110, 255]];
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#06070d"; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      st.seeds.forEach((s, i) => {
        const x = w * (0.5 + 0.38 * Math.sin(t * s.s + s.p + i));
        const y = h * (0.5 + 0.32 * Math.cos(t * s.s * 0.8 + s.p * 1.7));
        const r = Math.max(w, h) * s.r;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const c = pal[i % pal.length];
        g.addColorStop(0, rgba(c, 0.32)); g.addColorStop(0.5, rgba(c, 0.1)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });
      ctx.globalCompositeOperation = "source-over";
    },
  },

  // Drifting nodes that link up when they get close, and to your cursor.
  constellation: {
    init: (w, h) => {
      const n = Math.min(160, Math.round((w * h) / 14000));
      return { pts: Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35 })) };
    },
    draw(ctx, w, h, t, st, accent, mouse, dpr) {
      const a = rgb(accent);
      const bgG = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.max(w, h) * 0.7);
      bgG.addColorStop(0, rgba(mix(a, [5, 6, 10], 0.82), 1)); bgG.addColorStop(1, "#05060a");
      ctx.fillStyle = bgG; ctx.fillRect(0, 0, w, h);
      const R = 140 * dpr, pts = st.pts;
      for (const p of pts) {
        p.x += p.vx * dpr; p.y += p.vy * dpr;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      ctx.lineWidth = dpr;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < R) { ctx.strokeStyle = rgba(a, 0.42 * (1 - d / R)); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        }
        if (mouse.x !== null) {
          const d = Math.hypot(p.x - mouse.x * dpr, p.y - mouse.y * dpr);
          if (d < R * 1.6) { ctx.strokeStyle = rgba(a, 0.7 * (1 - d / (R * 1.6))); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x * dpr, mouse.y * dpr); ctx.stroke(); }
        }
        ctx.fillStyle = rgba(mix(a, [255, 255, 255], 0.5), 0.8);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.1 * dpr, 0, 6.283); ctx.fill();
      }
    },
  },

  // Falling code. The classic, tinted with the accent colour.
  matrix: {
    fps: 24,
    init: (w, h, dpr) => {
      const size = Math.round(16 * dpr);
      return { size, drops: Array.from({ length: Math.ceil(w / size) }, () => Math.random() * -60), first: true };
    },
    draw(ctx, w, h, t, st, accent) {
      const a = rgb(accent);
      if (st.first) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); st.first = false; }
      ctx.fillStyle = "rgba(0,0,0,0.075)"; ctx.fillRect(0, 0, w, h);
      ctx.font = `${st.size}px "JetBrains Mono", monospace`;
      const chars = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789<>/{}[];=+*#$";
      st.drops.forEach((y, i) => {
        const ch = chars[(Math.random() * chars.length) | 0];
        const x = i * st.size, py = y * st.size;
        ctx.fillStyle = Math.random() < 0.06 ? "#eafff0" : rgba(a, 0.85);
        ctx.fillText(ch, x, py);
        st.drops[i] = py > h && Math.random() > 0.975 ? 0 : y + 1;
      });
    },
  },

  // Flying through space. Stars stretch into streaks as they pass.
  starfield: {
    init: () => ({ stars: Array.from({ length: 700 }, () => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random() })) }),
    draw(ctx, w, h, t, st, accent) {
      const a = rgb(accent);
      ctx.fillStyle = "rgba(3,4,10,0.55)"; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, f = Math.max(w, h) * 0.5;
      for (const s of st.stars) {
        const pz = s.z; s.z -= 0.0035;
        if (s.z <= 0.01) { s.x = (Math.random() - 0.5) * 2; s.y = (Math.random() - 0.5) * 2; s.z = 1; continue; }
        const x = cx + (s.x / s.z) * f, y = cy + (s.y / s.z) * f;
        const px = cx + (s.x / pz) * f, py = cy + (s.y / pz) * f;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const k = 1 - s.z;
        ctx.strokeStyle = rgba(mix([255, 255, 255], a, s.z * 0.6), k);
        ctx.lineWidth = Math.max(0.5, k * 2.4);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      }
    },
  },

  // An 80s horizon: striped sun, neon grid rolling towards you.
  synthwave: {
    init: () => ({}),
    draw(ctx, w, h, t, st, accent) {
      const a = rgb(accent), hz = h * 0.58;
      const sky = ctx.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, "#090014"); sky.addColorStop(1, "#2a0838");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz);
      const sr = Math.min(w, h) * 0.2, sx = w / 2, sy = hz - sr * 0.35;
      const sun = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
      sun.addColorStop(0, "#ffd36b"); sun.addColorStop(0.55, "#ff4d8d"); sun.addColorStop(1, "#7a1fd6");
      ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.283); ctx.clip();
      ctx.fillStyle = sun; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      ctx.fillStyle = "#2a0838";
      for (let i = 0; i < 7; i++) { const y = sy + sr * (0.1 + i * 0.13), hh = 2 + i * 1.6; ctx.fillRect(sx - sr, y, sr * 2, hh * (h / 900)); }
      ctx.restore();
      const ground = ctx.createLinearGradient(0, hz, 0, h);
      ground.addColorStop(0, "#14001f"); ground.addColorStop(1, "#050008");
      ctx.fillStyle = ground; ctx.fillRect(0, hz, w, h - hz);
      ctx.strokeStyle = rgba(a, 0.85); ctx.lineWidth = Math.max(1, h / 700);
      ctx.shadowColor = rgba(a, 0.9); ctx.shadowBlur = 12;
      const off = (t * 0.6) % 1;
      for (let i = 0; i < 18; i++) { const z = (i + off) / 18, y = hz + (h - hz) * z * z; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let i = -16; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.02, hz); ctx.lineTo(w / 2 + i * w * 0.18, h); ctx.stroke(); }
      ctx.shadowBlur = 0;
    },
  },
};

export const SCENE_LIST = [
  ["aurora", "Aurora"], ["constellation", "Constellation"], ["matrix", "Matrix rain"], ["starfield", "Starfield"], ["synthwave", "Synthwave"],
];

// Runs one scene on a canvas until stop() is called.
export function runScene(canvas, name, accent) {
  const scene = SCENES[name] || SCENES.aurora;
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mouse = { x: null, y: null };
  let st, raf = 0, last = 0, dpr = 1, w = 0, h = 0, alive = true;
  const size = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1) * (scene.scale || 1);
    w = canvas.width = Math.round(innerWidth * dpr);
    h = canvas.height = Math.round(innerHeight * dpr);
    st = scene.init(w, h, dpr);
  };
  const frame = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    if (scene.fps && now - last < 1000 / scene.fps) return;
    last = now;
    scene.draw(ctx, w, h, now / 1000, st, accent, mouse, dpr);
  };
  const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
  const onLeave = () => { mouse.x = mouse.y = null; };
  size();
  addEventListener("resize", size);
  addEventListener("pointermove", onMove);
  document.addEventListener("pointerleave", onLeave);
  if (reduce) { for (let i = 0; i < 40; i++) scene.draw(ctx, w, h, i / 10, st, accent, mouse, dpr); }
  else raf = requestAnimationFrame(frame);
  return {
    stop() { alive = false; cancelAnimationFrame(raf); removeEventListener("resize", size); removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave); },
  };
}
