// The pet's pixel art, shared by the new tab (js/fx/pet.js) and the
// pet that visits websites (js/inject/pet-anywhere.js). A classic script,
// so content scripts can load it too. Exposes globalThis.DevtabPet.
(() => {
  if (globalThis.DevtabPet) return;
  const SIZE = 24;
  const rgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  /* ---------- drawing (one pixel = one fillRect on a 24×24 canvas) ---------- */
  function palette(kind, hacker, accent) {
    const a = rgb(accent);
    if (hacker) return { dark: css(mix(a, [0, 0, 0], 0.78)), body: css(mix(a, [0, 0, 0], 0.55)), shade: css(mix(a, [0, 0, 0], 0.72)), hi: css(mix(a, [0, 0, 0], 0.35)), screen: "#000", eye: css(a), light: css(a), cheek: css(mix(a, [255, 255, 255], 0.4)), nose: css(a), stripe: css(mix(a, [0, 0, 0], 0.7)) };
    if (kind === "cat") return { dark: "#2a1a10", body: "#f2a65a", shade: "#c97a34", hi: "#ffd19c", screen: "#2a1a10", eye: "#9be36a", light: "#ff6b8a", cheek: "#ff9db4", nose: "#ff6b8a", stripe: "#c97a34" };
    return { dark: "#4a5578", body: "#e3e8f6", shade: "#a9b2cd", hi: "#ffffff", screen: "#0d1120", eye: css(mix(a, [255, 255, 255], 0.35)), light: "#ff5c8a", cheek: "#ff9db4", nose: "#ff6b8a", stripe: "#a9b2cd" };
  }

  function eyes(R, c, f, x0, x1, y) {
    const l = f.look || 0;
    if (f.eye === "blink" || f.eye === "sleep") { R(x0 + l, y + 2, 2, 1, c.eye); R(x1 + l, y + 2, 2, 1, c.eye); return; }
    if (f.eye === "happy") { [[0, 1], [1, 0], [2, 1]].forEach(([dx, dy]) => { R(x0 + dx - 0 + l, y + 1 + dy, 1, 1, c.eye); R(x1 + dx + l, y + 1 + dy, 1, 1, c.eye); }); return; }
    if (f.eye === "sad") { R(x0 + l, y + 1, 2, 2, c.eye); R(x1 + l, y + 1, 2, 2, c.eye); R(x0 - 1 + l, y, 1, 1, c.eye); R(x1 + 2 + l, y, 1, 1, c.eye); R(x0 + l, y + 3, 1, 1, "#7cc4ff"); return; }
    R(x0 + l, y, 2, 3, c.eye); R(x1 + l, y, 2, 3, c.eye);
    R(x0 + l, y, 1, 1, "#ffffff"); R(x1 + l, y, 1, 1, "#ffffff");
  }

  function drawRobot(R, c, f) {
    const up = f.pose === "sleep" ? 2 : f.pose === "hop" ? -1 : 0;
    // antenna with a blinking light
    R(11, 3 + up, 2, 2, c.shade); R(11, 1 + up, 2, 2, f.blink ? c.light : c.hi);
    // head
    R(5, 5 + up, 14, 1, c.dark); R(5, 15 + up, 14, 1, c.dark); R(4, 6 + up, 1, 9, c.dark); R(19, 6 + up, 1, 9, c.dark);
    R(5, 6 + up, 14, 9, c.body); R(5, 6 + up, 14, 1, c.hi); R(5, 14 + up, 14, 1, c.shade);
    R(7, 8 + up, 10, 5, c.screen);
    eyes(R, c, f, 9, 13, 9 + up);
    if (f.eye === "happy") { R(7, 12 + up, 1, 1, c.cheek); R(16, 12 + up, 1, 1, c.cheek); }
    // body
    R(7, 16 + up, 10, 1, c.dark); R(7, 17 + up, 1, 4, c.dark); R(16, 17 + up, 1, 4, c.dark); R(7, 21 + up, 10, 1, c.dark);
    R(8, 17 + up, 8, 4, c.body); R(8, 20 + up, 8, 1, c.shade);
    R(11, 18 + up, 2, 2, f.blink ? c.eye : c.light);
    // arms
    if (f.pose === "happy") { R(4, 11 + up, 2, 5, c.dark); R(18, 11 + up, 2, 5, c.dark); R(4, 10 + up, 2, 1, c.body); R(18, 10 + up, 2, 1, c.body); }
    else { R(5, 17 + up, 2, 4, c.shade); R(17, 17 + up, 2, 4, c.shade); R(5, 17 + up, 1, 3, c.shade); R(18, 17 + up, 1, 3, c.shade); }
    // legs
    if (f.pose !== "sleep") {
      const a = f.pose === "walk1" ? 1 : 0, b = f.pose === "walk2" ? 1 : 0;
      R(9, 22 - a, 2, 2, c.shade); R(13, 22 - b, 2, 2, c.shade);
    }
  }

  function drawCat(R, c, f) {
    const up = f.pose === "sleep" ? 3 : f.pose === "hop" ? -1 : 0;
    // ears
    R(5, 4 + up, 1, 1, c.dark); R(5, 5 + up, 2, 1, c.dark); R(5, 6 + up, 3, 1, c.body); R(6, 5 + up, 1, 1, c.cheek);
    R(18, 4 + up, 1, 1, c.dark); R(17, 5 + up, 2, 1, c.dark); R(16, 6 + up, 3, 1, c.body); R(17, 5 + up, 1, 1, c.cheek);
    // head
    R(4, 7 + up, 16, 1, c.dark); R(3, 8 + up, 1, 6, c.dark); R(20, 8 + up, 1, 6, c.dark); R(4, 14 + up, 16, 1, c.dark);
    R(4, 8 + up, 16, 6, c.body); R(9, 8 + up, 1, 2, c.stripe); R(12, 8 + up, 1, 2, c.stripe); R(15, 8 + up, 1, 2, c.stripe);
    eyes(R, c, f, 7, 15, 10 + up);
    R(11, 12 + up, 2, 1, c.nose);
    R(1, 11 + up, 3, 1, c.shade); R(1, 13 + up, 3, 1, c.shade); R(20, 11 + up, 3, 1, c.shade); R(20, 13 + up, 3, 1, c.shade);
    // body (a loaf when sleeping)
    R(5, 15 + up, 14, 6 - Math.max(0, up - 1), c.body); R(5, 15 + up, 14, 1, c.shade);
    R(8, 17 + up, 1, 3, c.stripe); R(11, 17 + up, 1, 3, c.stripe); R(14, 17 + up, 1, 3, c.stripe);
    // tail
    const tw = f.blink ? 1 : 0;
    R(19, 18 + up, 2, 1, c.body); R(21, 16 + up - tw, 1, 3, c.body); R(20, 15 + up - tw, 1, 1, c.dark);
    // paws
    if (f.pose !== "sleep") { const a = f.pose === "walk1" ? 1 : 0, b = f.pose === "walk2" ? 1 : 0; R(6, 21 - a, 3, 2, c.body); R(15, 21 - b, 3, 2, c.body); R(6, 22 - a, 3, 1, c.shade); R(15, 22 - b, 3, 1, c.shade); }
    if (f.pose === "happy") { R(2, 8 + up, 1, 1, c.cheek); R(21, 8 + up, 1, 1, c.cheek); }
  }

  // Grey specks and a cobweb, more the longer it's been left alone.
  function drawDust(R, dust) {
    if (dust < 0.05) return;
    let s = 7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const n = Math.round(dust * 26);
    for (let i = 0; i < n; i++) R(4 + Math.floor(r() * 16), 4 + Math.floor(r() * 18), 1, 1, i % 3 ? "rgba(120,112,96,.85)" : "rgba(170,160,140,.9)");
    if (dust > 0.7) { for (let i = 0; i < 5; i++) { R(4 + i, 5, 1, 1, "rgba(220,220,220,.55)"); R(4, 5 + i, 1, 1, "rgba(220,220,220,.55)"); } R(6, 7, 1, 1, "rgba(220,220,220,.55)"); }
  }

  function paintPet(canvas, f, kind, hacker, accent, dust) {
    const x = canvas.getContext("2d"); x.clearRect(0, 0, SIZE, SIZE);
    if (f.flip) { x.save(); x.translate(SIZE, 0); x.scale(-1, 1); }
    const R = (X, Y, W, H, col) => { x.fillStyle = col; x.fillRect(X, Y, W, H); };
    const c = palette(kind, hacker, accent);
    (kind === "cat" ? drawCat : drawRobot)(R, c, f);
    drawDust(R, dust);
    if (f.flip) x.restore();
  }

  globalThis.DevtabPet = { paintPet, SIZE };
})();
