// Colour picker: the page freezes into a screenshot, a magnifying loupe follows
// the cursor, and a click picks the exact pixel. HEX is copied straight away;
// the card shows RGB, HSL and a palette built from the colour.
(() => {
  const UI = window.__devtabUI;
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const toHsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]; };
  const fromHsl = (h, s, l) => { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return hex(...[f(0), f(8), f(4)].map((v) => Math.round(v * 255))); };
  const textOn = (r, g, b) => (r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#111" : "#fff");

  window.__devtabColor = (shot) => {
    const { w } = UI.open(`
      .stage { position: fixed; inset: 0; pointer-events: auto; cursor: none; }
      .stage img { position: absolute; inset: 0; width: 100vw; height: 100vh; }
      .loupe { position: fixed; width: 150px; height: 150px; border-radius: 50%; overflow: hidden; border: 3px solid #fff; box-shadow: 0 0 0 2px var(--a), 0 14px 40px rgba(0,0,0,.6); pointer-events: none; transform: translate(-50%, -50%); }
      .w.hk .loupe { border-radius: 4px; }
      .loupe canvas { width: 150px; height: 150px; image-rendering: pixelated; }
      .lab { position: fixed; transform: translate(-50%, 92px); padding: 5px 10px; border-radius: 999px; background: var(--bg); border: 1px solid var(--a); font: 700 12.5px Consolas, monospace; pointer-events: none; }
      .sw { height: 110px; border-radius: 14px; display: flex; align-items: flex-end; padding: 12px; font: 800 22px Consolas, monospace; margin: 12px 0 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); }
      .w.hk .sw { border-radius: 2px; }
      .pal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-top: 6px; }
      .pal button { all: unset; cursor: pointer; height: 34px; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); transition: transform .1s; }
      .pal button:hover { transform: scale(1.12); }
      .lbl { margin: 14px 0 0; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--mu); }`);
    const img = new Image(); img.src = shot;
    const stage = document.createElement("div"); stage.className = "stage"; stage.append(img);
    const loupe = document.createElement("div"); loupe.className = "loupe"; const lc = document.createElement("canvas"); lc.width = lc.height = 15; loupe.append(lc);
    const lab = document.createElement("div"); lab.className = "lab";
    const hud = document.createElement("div"); hud.className = "hud"; hud.innerHTML = `<b>🎨 Colour picker</b><span>click any pixel · Esc to quit</span><button class="btn g" data-q>Exit</button>`;
    w.append(stage, loupe, lab, hud);
    hud.querySelector("[data-q]").onclick = () => UI.close();
    const src = document.createElement("canvas"), sx = src.getContext("2d", { willReadFrequently: true });
    img.onload = () => { src.width = img.naturalWidth; src.height = img.naturalHeight; sx.drawImage(img, 0, 0); };
    const scale = () => src.width / innerWidth;
    const px = (x, y) => { const k = scale(), d = sx.getImageData(Math.min(src.width - 1, Math.round(x * k)), Math.min(src.height - 1, Math.round(y * k)), 1, 1).data; return [d[0], d[1], d[2]]; };
    let picking = true;
    const lx = lc.getContext("2d");
    stage.addEventListener("mousemove", (e) => {
      if (!picking || !src.width) return;
      const k = scale(), cx = Math.round(e.clientX * k), cy = Math.round(e.clientY * k);
      lx.imageSmoothingEnabled = false; lx.clearRect(0, 0, 15, 15);
      lx.drawImage(src, cx - 7, cy - 7, 15, 15, 0, 0, 15, 15);
      lx.strokeStyle = "rgba(255,255,255,.9)"; lx.lineWidth = 0.12; lx.strokeRect(7, 7, 1, 1);
      const [r, g, b] = px(e.clientX, e.clientY);
      loupe.style.left = lab.style.left = e.clientX + "px"; loupe.style.top = lab.style.top = e.clientY + "px";
      lab.textContent = hex(r, g, b).toUpperCase();
      loupe.style.display = lab.style.display = "";
    });
    stage.addEventListener("click", async (e) => {
      if (!picking || !src.width) return;
      picking = false; loupe.style.display = lab.style.display = "none"; stage.style.cursor = "default";
      const [r, g, b] = px(e.clientX, e.clientY), H = hex(r, g, b).toUpperCase(), [h, s, l] = toHsl(r, g, b);
      await UI.copy(H);
      const pal = [
        ...[90, 75, 60].map((L) => fromHsl(h, s, L)), H.toLowerCase(), ...[35, 22, 12].map((L) => fromHsl(h, s, L)),
        fromHsl((h + 180) % 360, s, l), fromHsl((h + 30) % 360, s, l), fromHsl((h + 330) % 360, s, l), fromHsl((h + 120) % 360, s, l), fromHsl((h + 240) % 360, s, l), fromHsl(h, Math.max(0, s - 40), l), fromHsl(h, Math.min(100, s + 25), l),
      ];
      const panel = document.createElement("div"); panel.className = "panel";
      const rows = [["HEX", H], ["RGB", `rgb(${r}, ${g}, ${b})`], ["HSL", `hsl(${h}, ${s}%, ${l}%)`], ["CSS var", `--color: ${H};`]];
      panel.innerHTML = `<button class="x" data-x aria-label="Close">×</button><h3>Colour picked</h3><p>HEX copied to your clipboard</p>
        <div class="sw" style="background:${H};color:${textOn(r, g, b)}">${H}</div>
        ${rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${UI.esc(v)}</span><button class="cp" data-c="${UI.esc(v)}">Copy</button></div>`).join("")}
        <p class="lbl">Tints & shades</p><div class="pal">${pal.slice(0, 7).map((c) => `<button title="${c}" data-c="${c}" style="background:${c}"></button>`).join("")}</div>
        <p class="lbl">Complement · analogous · triad · muted · vivid</p><div class="pal">${pal.slice(7).map((c) => `<button title="${c}" data-c="${c}" style="background:${c}"></button>`).join("")}</div>
        <div class="acts"><button class="btn" data-again>Pick another</button><button class="btn g" data-x>Done</button></div>`;
      w.append(panel); UI.place(panel, e.clientX, e.clientY);
      UI.toast(w, `Copied ${H}`);
      panel.addEventListener("click", async (ev) => {
        const c = ev.target.closest("[data-c]"); if (c) { await UI.copy(c.dataset.c); UI.toast(w, `Copied ${c.dataset.c}`); return; }
        if (ev.target.closest("[data-again]")) { panel.remove(); picking = true; stage.style.cursor = "none"; return; }
        if (ev.target.closest("[data-x]")) UI.close();
      });
    });
  };
})();
