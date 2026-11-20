// DevTab Hub: one place for the bigger tools (Focus, Sounds, Workspaces,
// Wrapped, Tools, Pet). Each feature registers a pane; the hub draws the rail,
// the header and swaps panes. Press H (or the ✦ button) to open it.

const $ = (s) => document.querySelector(s);
const panes = [];
let current = null, cleanup = null, C = null;

export function addPane(p) { panes.push(p); }
export const hubCtx = () => C;

function drawNav() {
  $("#hubNav").innerHTML = panes.map((p) => `<button type="button" data-pane="${p.id}" aria-current="${p.id === current}" title="${p.label}">${p.icon}<span>${p.label}</span>${p.badge ? `<i class="hub__badge" id="hb-${p.id}"></i>` : ""}</button>`).join("");
  panes.forEach((p) => p.badge && p.badge($(`#hb-${p.id}`)));
}

export function showPane(id) {
  const p = panes.find((x) => x.id === id) || panes[0];
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  current = p.id;
  try { localStorage.setItem("devtab:hubPane", p.id); } catch (e) {}
  drawNav();
  $("#hubTitle").textContent = typeof p.title === "function" ? p.title() : p.title || p.label;
  $("#hubSub").textContent = typeof p.sub === "function" ? p.sub() : p.sub || "";
  // a fresh element each time, so one pane's listeners never fire in another
  const old = $("#hubPane"), el = old.cloneNode(false);
  old.replaceWith(el);
  el.className = "hub__pane hub__pane--" + p.id;
  cleanup = p.render(el, C) || null;
}

export function openHub(id) {
  const d = $("#hub");
  if (!d.open) d.showModal();
  let last = null; try { last = localStorage.getItem("devtab:hubPane"); } catch (e) {}
  showPane(id || current || last || panes[0].id);
}
export function closeHub() { const d = $("#hub"); if (d.open) d.close(); }
export const hubOpen = () => $("#hub").open;

export function initHub(ctx) {
  C = ctx;
  const d = $("#hub");
  $("#hubBtn").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.9L19 9.7l-4.6 2.6L13 18l-1-5.2L7 11l5-2.1Z"/><path d="M5 3v3M3.5 4.5h3M19 16v4M17 18h4"/></svg>';
  $("#hubBtn").addEventListener("click", () => openHub());
  $("#hubClose").innerHTML = ctx.icon("x");
  $("#hubClose").addEventListener("click", closeHub);
  $("#hubNav").addEventListener("click", (e) => { const b = e.target.closest("[data-pane]"); if (b) showPane(b.dataset.pane); });
  d.addEventListener("click", (e) => { if (e.target === d) closeHub(); });
  d.addEventListener("close", () => { if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; } });
  document.addEventListener("keydown", (e) => {
    // Ctrl+K works anywhere, even while typing in the search box
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); return d.open ? closeHub() : openHub(); }
    if (e.target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.toLowerCase() === "h" && !d.open) { e.preventDefault(); openHub(); }
  });
}
