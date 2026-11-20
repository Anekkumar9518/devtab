// Shared bits for the page tools (colour picker, image size finder, font
// finder). Injected into the page you're on only when you start a tool; the UI
// lives in a shadow root so the site's CSS can't touch it, and vice versa.
(() => {
  if (window.__devtabUI) return;
  const UI = (window.__devtabUI = { cleanup: [], accent: "#7c9cff", hacker: false });

  try {
    chrome.storage.local.get("devtab:settings").then((r) => {
      const s = r["devtab:settings"]; if (!s) return;
      UI.hacker = s.mode === "hacker"; UI.accent = (s[s.mode] && s[s.mode].accent) || UI.accent;
      document.querySelectorAll("devtab-tool").forEach((h) => UI.paint(h.shadowRoot));
    });
  } catch (e) {}

  UI.CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
  .w { --a: #7c9cff; --bg: rgba(14,16,26,.94); --fg: #eef0f6; --mu: rgba(238,240,246,.62); --ln: rgba(255,255,255,.12); --r: 16px; color: var(--fg); }
  .w.hk { --bg: rgba(0,8,2,.95); --fg: color-mix(in srgb, var(--a) 85%, white); --mu: color-mix(in srgb, var(--a) 60%, transparent); --ln: color-mix(in srgb, var(--a) 35%, transparent); --r: 2px; }
  .w.hk * { font-family: "JetBrains Mono", Consolas, ui-monospace, monospace; }
  .hud { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; border-radius: 999px; background: var(--bg); border: 1px solid var(--a); box-shadow: 0 0 30px -8px var(--a), 0 18px 40px rgba(0,0,0,.5); backdrop-filter: blur(16px); pointer-events: auto; font-size: 13px; white-space: nowrap; animation: d .35s cubic-bezier(.2,1.4,.4,1); }
  .w.hk .hud { border-radius: 2px; }
  @keyframes d { from { opacity: 0; transform: translate(-50%, -12px); } }
  .hud b { font-size: 14px; } .hud span { color: var(--mu); }
  .btn { all: unset; cursor: pointer; padding: 7px 14px; border-radius: 999px; background: var(--a); color: #0a0a0a; font-weight: 700; font-size: 12.5px; }
  .btn.g { background: none; color: var(--fg); border: 1px solid var(--ln); }
  .btn:hover { filter: brightness(1.1); }
  .w.hk .btn { border-radius: 2px; }
  .panel { position: fixed; width: 330px; max-height: calc(100vh - 32px); overflow: auto; padding: 18px; border-radius: 22px; background: var(--bg); border: 1px solid var(--ln); box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset; backdrop-filter: blur(20px); pointer-events: auto; animation: p .3s cubic-bezier(.2,1.3,.4,1); }
  .w.hk .panel { border-radius: 2px; border-color: var(--a); box-shadow: 0 0 30px -10px var(--a); }
  @keyframes p { from { opacity: 0; transform: scale(.95) translateY(8px); } }
  .panel h3 { margin: 0 0 4px; font-size: 16px; } .panel p { margin: 0; color: var(--mu); font-size: 12.5px; }
  .row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--ln); font-size: 13px; }
  .row:last-child { border: 0; }
  .row .k { width: 92px; flex: none; color: var(--mu); font-size: 12px; }
  .row .v { flex: 1; min-width: 0; overflow-wrap: anywhere; font-family: "JetBrains Mono", Consolas, monospace; font-size: 12.5px; }
  .cp { all: unset; cursor: pointer; padding: 3px 8px; border-radius: 7px; border: 1px solid var(--ln); font-size: 11px; color: var(--mu); }
  .cp:hover { color: var(--fg); border-color: var(--a); }
  .x { all: unset; cursor: pointer; position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; color: var(--mu); font-size: 18px; }
  .x:hover { background: rgba(255,255,255,.08); color: var(--fg); }
  .acts { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  .toast { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 16px); opacity: 0; padding: 10px 18px; border-radius: 999px; background: var(--bg); border: 1px solid var(--a); font-size: 13.5px; transition: .2s; pointer-events: none; }
  .toast.on { opacity: 1; transform: translate(-50%, 0); }
  .w.hk .toast, .w.hk .cp { border-radius: 2px; }
  .box { position: fixed; pointer-events: none; border: 2px solid var(--a); border-radius: 6px; background: color-mix(in srgb, var(--a) 12%, transparent); box-shadow: 0 0 0 9999px rgba(0,0,0,.18), 0 0 24px var(--a); transition: all .08s ease-out; }
  .tag { position: fixed; pointer-events: none; padding: 10px 12px; border-radius: 12px; background: var(--bg); border: 1px solid var(--a); box-shadow: 0 10px 30px rgba(0,0,0,.5); font-size: 12px; color: var(--mu); white-space: nowrap; }
  .tag b { display: block; color: var(--fg); font-size: 18px; margin-bottom: 2px; }
  .w.hk .box, .w.hk .tag { border-radius: 2px; }
  `;
  UI.paint = (root) => { const w = root && root.querySelector(".w"); if (!w) return; w.classList.toggle("hk", UI.hacker); w.style.setProperty("--a", UI.accent); };

  // One tool at a time: starting a tool closes the last one.
  UI.open = (css = "") => {
    UI.close();
    const h = document.createElement("devtab-tool");
    h.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    document.documentElement.append(h);
    const root = h.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${UI.CSS}${css}</style><div class="w"></div>`;
    UI.paint(root);
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); UI.close(); } };
    addEventListener("keydown", onKey, true);
    UI.cleanup.push(() => removeEventListener("keydown", onKey, true));
    return { host: h, root, w: root.querySelector(".w") };
  };
  UI.close = () => { UI.cleanup.splice(0).forEach((f) => { try { f(); } catch (e) {} }); document.querySelectorAll("devtab-tool").forEach((e) => e.remove()); };
  UI.on = (target, ev, fn, opt) => { target.addEventListener(ev, fn, opt); UI.cleanup.push(() => target.removeEventListener(ev, fn, opt)); };

  UI.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const t = document.createElement("textarea"); t.value = text; t.style.cssText = "position:fixed;opacity:0;top:0;left:0"; document.body.append(t); t.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) {} t.remove(); return ok;
  };
  UI.toast = (w, msg) => {
    let t = w.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; w.append(t); }
    t.textContent = msg; t.classList.add("on"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 1800);
  };
  UI.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // put a panel near (x, y) but fully on screen
  UI.place = (el, x, y) => { const W = el.offsetWidth, H = el.offsetHeight; /* layout size: ignores the pop-in scale */ el.style.left = Math.max(12, Math.min(innerWidth - W - 12, x + 18)) + "px"; el.style.top = Math.max(12, Math.min(innerHeight - H - 12, y - 30)) + "px"; };
})();
