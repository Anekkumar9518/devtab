// Parallax: the background shifts in layers as the mouse moves (or the phone
// tilts), like looking through a window. Scenes read par.x / par.y (-1..1);
// photos and videos move with the --px / --py variables on .bg.

export const par = { x: 0, y: 0, tx: 0, ty: 0, on: true };
const clamp = (v) => Math.max(-1, Math.min(1, v));

addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  par.tx = clamp((e.clientX / innerWidth) * 2 - 1);
  par.ty = clamp((e.clientY / innerHeight) * 2 - 1);
}, { passive: true });
document.addEventListener("pointerleave", () => { par.tx = par.ty = 0; });
addEventListener("deviceorientation", (e) => {
  if (e.gamma === null) return;
  par.tx = clamp(e.gamma / 25);
  par.ty = clamp((e.beta - 45) / 25);
}, { passive: true });

let el = null, lx = 9, ly = 9;
function loop() {
  requestAnimationFrame(loop);
  if (document.hidden) return;
  const tx = par.on ? par.tx : 0, ty = par.on ? par.ty : 0;
  par.x += (tx - par.x) * 0.06;
  par.y += (ty - par.y) * 0.06;
  if (!el) el = document.querySelector(".bg");
  if (el && (Math.abs(par.x - lx) > 0.002 || Math.abs(par.y - ly) > 0.002)) {
    lx = par.x; ly = par.y;
    el.style.setProperty("--px", par.x.toFixed(3));
    el.style.setProperty("--py", par.y.toFixed(3));
  }
}
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(loop);
