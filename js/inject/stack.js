// Tech stack panel: shows what the detector found, grouped by category, with a
// one-line summary and a "Copy report" button for client and competitor notes.
(() => {
  const UI = window.__devtabUI;
  const COLOR = {
    WordPress: "#21759b", Shopify: "#95bf47", WooCommerce: "#7f54b3", Wix: "#0c6efc", Squarespace: "#111", Webflow: "#4353ff", Ghost: "#15171a", Drupal: "#0678be", Framer: "#0055ff", Magento: "#f46f25", Elementor: "#92003b",
    React: "#61dafb", "Next.js": "#000", "Vue.js": "#42b883", Nuxt: "#00dc82", Angular: "#dd0031", Svelte: "#ff3e00", SvelteKit: "#ff3e00", Gatsby: "#663399", Astro: "#ff5d01", jQuery: "#0769ad", "Alpine.js": "#77c1d2", GSAP: "#88ce02", "Three.js": "#049ef4",
    "Tailwind CSS": "#38bdf8", Bootstrap: "#7952b3", "Material UI": "#007fff", "Google Fonts": "#4285f4", "Font Awesome": "#528dd7",
    "Google Tag Manager": "#246fdb", "Google Analytics": "#f9ab00", "Google Ads": "#4285f4", "Google AdSense": "#4285f4", "Meta Pixel": "#0866ff", "TikTok Pixel": "#ff0050", "LinkedIn Insight": "#0a66c2", Hotjar: "#ff3c00", "Microsoft Clarity": "#0078d4", HubSpot: "#ff7a59",
    Razorpay: "#3395ff", Stripe: "#635bff", PayPal: "#003087", Cloudflare: "#f38020", Vercel: "#000", Netlify: "#00c7b7", "Amazon CloudFront": "#ff9900", Hostinger: "#673de6", Nginx: "#009639", Apache: "#d22128", LiteSpeed: "#ff6b00", PHP: "#777bb4", "Yoast SEO": "#a4286a", "Rank Math": "#7b3aec",
  };
  const ORDER = ["CMS", "E-commerce", "Page builder", "JavaScript framework", "JavaScript library", "UI framework", "Analytics", "Tag manager", "Advertising", "Marketing", "SEO", "Live chat", "Payments", "CDN & hosting", "Web server", "Language", "Fonts", "Animation", "3D / WebGL", "Maps", "Video", "Security", "Monitoring", "Performance"];
  const ICON = { CMS: "🧱", "E-commerce": "🛒", "Page builder": "🧩", "JavaScript framework": "⚛", "JavaScript library": "📦", "UI framework": "🎨", Analytics: "📊", "Tag manager": "🏷", Advertising: "📣", Marketing: "✉", SEO: "🔎", "Live chat": "💬", Payments: "💳", "CDN & hosting": "☁", "Web server": "🖥", Language: "⌨", Fonts: "🔤", Animation: "✨", "3D / WebGL": "🧊", Maps: "🗺", Video: "▶", Security: "🛡", Monitoring: "🩺", Performance: "⚡" };
  const light = (hex) => { const n = parseInt(hex.slice(1).padEnd(6, hex.slice(1)), 16); return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 160; };

  window.__devtabStack = (res) => {
    const { w } = UI.open(`
      .side { position: fixed; top: 12px; right: 12px; bottom: 12px; width: min(440px, calc(100vw - 24px)); display: flex; flex-direction: column; border-radius: 22px; background: var(--bg); border: 1px solid var(--ln); box-shadow: 0 30px 80px rgba(0,0,0,.6); backdrop-filter: blur(20px); pointer-events: auto; animation: sIn .35s cubic-bezier(.2,1.2,.35,1); overflow: hidden; }
      @keyframes sIn { from { transform: translateX(30px); opacity: 0; } }
      .w.hk .side { border-radius: 2px; border-color: var(--a); }
      .hd { position: relative; padding: 18px 18px 14px; border-bottom: 1px solid var(--ln); background: radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--a) 25%, transparent), transparent 60%); }
      .hd h3 { margin: 0; font-size: 17px; } .hd .host { font: 12px Consolas, monospace; color: var(--a); }
      .sum { margin: 10px 0 0; font-size: 14px; line-height: 1.5; color: var(--fg); }
      .sum b { color: var(--a); }
      .body { flex: 1; overflow: auto; padding: 8px 18px 16px; }
      .cat { margin-top: 14px; }
      .cat h4 { margin: 0 0 8px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--mu); }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .t { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border-radius: 12px; border: 1px solid var(--ln); background: rgba(255,255,255,.04); font-size: 13px; animation: pop .35s backwards; }
      @keyframes pop { from { opacity: 0; transform: scale(.9); } }
      .w.hk .t, .w.hk .lg { border-radius: 2px; }
      .lg { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font: 800 12px "Segoe UI", sans-serif; }
      .t small { font: 11px Consolas, monospace; color: var(--mu); }
      .empty { text-align: center; padding: 40px 10px; color: var(--mu); }
      .ft { display: flex; gap: 8px; align-items: center; padding: 12px 18px; border-top: 1px solid var(--ln); }
      .ft span { flex: 1; font-size: 12px; color: var(--mu); }`);
    const techs = res.techs, by = {};
    for (const t of techs) (by[t.cat] = by[t.cat] || []).push(t);
    const pick = (cats) => techs.filter((t) => cats.includes(t.cat)).map((t) => t.name);
    const built = pick(["CMS", "E-commerce", "JavaScript framework"]), host = pick(["CDN & hosting"]), track = pick(["Analytics", "Tag manager", "Advertising"]);
    const summary = techs.length
      ? `${built.length ? `Built with <b>${built.slice(0, 3).join("</b>, <b>")}</b>. ` : ""}${host.length ? `Served through <b>${host.slice(0, 2).join("</b> and <b>")}</b>. ` : ""}${track.length ? `Tracks visitors with <b>${track.slice(0, 4).join("</b>, <b>")}</b>.` : "No tracking tags found."}`
      : "Nothing recognisable: likely hand-written or server-rendered without common tools.";
    const side = document.createElement("div"); side.className = "side";
    let n = 0;
    side.innerHTML = `<div class="hd"><button class="x" data-q>×</button><h3>🧬 Tech stack</h3><span class="host">${UI.esc(res.host)}</span><p class="sum">${summary}</p></div>
      <div class="body">${techs.length ? ORDER.filter((c) => by[c]).map((c) => `<div class="cat"><h4>${ICON[c] || "•"} ${c}</h4><div class="chips">${by[c].map((t) => { const col = COLOR[t.name] || UI.accent; return `<span class="t" title="Found by: ${UI.esc(t.how)}" style="animation-delay:${(n++) * 25}ms"><span class="lg" style="background:${col};color:${light(col) ? "#111" : "#fff"}">${UI.esc(t.name[0])}</span>${UI.esc(t.name)}${t.version ? ` <small>${UI.esc(t.version)}</small>` : ""}</span>`; }).join("")}</div></div>`).join("") : `<p class="empty">No known technologies detected.</p>`}</div>
      <div class="ft"><span>${techs.length} technologies found</span><button class="btn g" data-q>Close</button><button class="btn" data-copy>Copy report</button></div>`;
    w.append(side);
    side.addEventListener("click", async (e) => {
      if (e.target.closest("[data-q]")) return UI.close();
      if (e.target.closest("[data-copy]")) {
        const txt = `Tech stack of ${res.host}\n${res.url}\n\n` + ORDER.filter((c) => by[c]).map((c) => `${c}: ${by[c].map((t) => t.name + (t.version ? " " + t.version : "")).join(", ")}`).join("\n") + "\n\nDetected with DevTab";
        await UI.copy(txt); UI.toast(w, "Report copied");
      }
    });
  };
})();
