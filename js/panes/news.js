// Hub pane: News. India, world, tech and AI headlines (Google News feeds),
// plus Hacker News, GitHub trending and dev.to. A slim ticker on the new tab
// can show one of them. Everything is cached for 15 minutes.
import { addPane, openHub } from "../hub.js";

const $ = (s, el = document) => el.querySelector(s);
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></svg>';
const GN = (path, lang) => `https://news.google.com/rss${path}${path.includes("?") ? "&" : "?"}hl=${lang === "hi" ? "hi" : "en-IN"}&gl=IN&ceid=IN:${lang === "hi" ? "hi" : "en"}`;
export const FEEDS = {
  india: { name: "India", emoji: "🇮🇳", gn: (l) => GN("", l) },
  world: { name: "World", emoji: "🌍", gn: (l) => GN("/headlines/section/topic/WORLD", l) },
  tech: { name: "Tech", emoji: "💻", gn: (l) => GN("/headlines/section/topic/TECHNOLOGY", l) },
  ai: { name: "AI", emoji: "🤖", gn: (l) => GN("/search?q=" + encodeURIComponent('"artificial intelligence" OR OpenAI OR Anthropic OR "Google Gemini" OR LLM when:2d'), l) },
  hn: { name: "Hacker News", emoji: "🟧" },
  github: { name: "GitHub trending", emoji: "⭐" },
  devto: { name: "dev.to", emoji: "👩‍💻" },
};
const TTL = 15 * 60 * 1000;
let C = null;

const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "now" : m < 60 ? m + "m" : m < 1440 ? Math.round(m / 60) + "h" : Math.round(m / 1440) + "d"; };

async function fetchFeed(id, lang = "en") {
  const key = `devtab:news:${id}:${lang}`;
  try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.at < TTL) return c.items; } catch (e) {}
  let items = [];
  if (FEEDS[id].gn) {
    const xml = new DOMParser().parseFromString(await (await fetch(FEEDS[id].gn(lang))).text(), "text/xml");
    items = [...xml.querySelectorAll("item")].slice(0, 25).map((it) => {
      const src = it.querySelector("source"), title = it.querySelector("title").textContent, sname = src ? src.textContent : "";
      return { t: sname && title.endsWith(" - " + sname) ? title.slice(0, -(sname.length + 3)) : title, u: it.querySelector("link").textContent, src: sname, srcUrl: src ? src.getAttribute("url") : "", at: Date.parse(it.querySelector("pubDate").textContent) };
    });
  } else if (id === "hn") {
    const ids = (await (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json")).json()).slice(0, 25);
    items = (await Promise.all(ids.map((i) => fetch(`https://hacker-news.firebaseio.com/v0/item/${i}.json`).then((r) => r.json()).catch(() => null)))).filter(Boolean).map((x) => ({ t: x.title, u: x.url || `https://news.ycombinator.com/item?id=${x.id}`, src: x.url ? new URL(x.url).hostname.replace(/^www\./, "") : "news.ycombinator.com", at: x.time * 1000, pts: x.score, cmt: x.descendants || 0, disc: `https://news.ycombinator.com/item?id=${x.id}` }));
  } else if (id === "github") {
    const d = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const j = await (await fetch(`https://api.github.com/search/repositories?q=created:>${d}&sort=stars&order=desc&per_page=25`)).json();
    items = (j.items || []).map((r) => ({ t: r.full_name, u: r.html_url, desc: r.description || "", stars: r.stargazers_count, lang: r.language || "", at: Date.parse(r.created_at), img: r.owner.avatar_url }));
  } else if (id === "devto") {
    const j = await (await fetch("https://dev.to/api/articles?top=2&per_page=25")).json();
    items = j.map((a) => ({ t: a.title, u: a.url, src: a.user.name, at: Date.parse(a.published_at), likes: a.public_reactions_count, cmt: a.comments_count, tags: a.tag_list.slice(0, 3), img: a.cover_image || "" }));
  }
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), items })); } catch (e) {}
  return items;
}

function row(id, x, i) {
  const meta = id === "hn" ? `<span>▲ ${x.pts}</span><a href="${C.esc(x.disc)}" target="_blank" rel="noopener">💬 ${x.cmt}</a><span>${C.esc(x.src)}</span>`
    : id === "github" ? `<span>★ ${x.stars.toLocaleString()}</span>${x.lang ? `<span>${C.esc(x.lang)}</span>` : ""}<span>new this week</span>`
    : id === "devto" ? `<span>❤ ${x.likes}</span><span>💬 ${x.cmt}</span><span>${C.esc(x.src)}</span>${x.tags.map((t) => `<span>#${C.esc(t)}</span>`).join("")}`
    : `${x.srcUrl && C.favicon(x.srcUrl) ? `<img src="${C.favicon(x.srcUrl, 32)}" alt="">` : ""}<span>${C.esc(x.src)}</span>`;
  return `<a class="nw__it${i === 0 ? " is-top" : ""}" href="${C.esc(x.u)}" target="_blank" rel="noopener">
    <span class="nw__n">${String(i + 1).padStart(2, "0")}</span>
    ${x.img && (id === "devto" || id === "github") ? `<img class="nw__img${id === "github" ? " is-av" : ""}" src="${C.esc(x.img)}" alt="" loading="lazy">` : ""}
    <span class="nw__b"><b>${C.esc(x.t)}</b>${x.desc ? `<small class="nw__d">${C.esc(x.desc)}</small>` : ""}<span class="nw__m">${meta}${x.at ? `<span>${ago(x.at)} ago</span>` : ""}</span></span></a>`;
}

async function render(el) {
  const S = C.S();
  let cur = S.news.tab in FEEDS ? S.news.tab : "india", lang = S.news.lang || "en";
  el.innerHTML = `<div class="nw">
    <div class="nw__tabs">${Object.entries(FEEDS).map(([k, f]) => `<button type="button" data-feed="${k}" aria-pressed="${k === cur}">${f.emoji} ${f.name}</button>`).join("")}</div>
    <div class="nw__bar"><span data-info></span><span class="nw__opts"><button type="button" class="ws__a" data-lang hidden></button><button type="button" class="ws__a" data-ticker></button><button type="button" class="ws__a" data-refresh>↻ Refresh</button></span></div>
    <div class="nw__list" data-list></div></div>`;
  const load = async (force) => {
    const list = $("[data-list]", el), gn = !!FEEDS[cur].gn;
    $("[data-lang]", el).hidden = !gn; $("[data-lang]", el).textContent = lang === "hi" ? "English" : "हिन्दी में";
    $("[data-ticker]", el).textContent = C.S().news.ticker && C.S().news.tickerFeed === cur ? "✓ In the ticker" : "Show in ticker";
    $("[data-info]", el).textContent = `${FEEDS[cur].emoji} ${FEEDS[cur].name}${gn ? " · Google News" : ""}`;
    list.innerHTML = `<div class="nw__skel">${"<i></i>".repeat(6)}</div>`;
    if (force) try { localStorage.removeItem(`devtab:news:${cur}:${lang}`); } catch (e) {}
    try { const items = await fetchFeed(cur, lang); list.innerHTML = items.map((x, i) => row(cur, x, i)).join("") || `<p class="note">Nothing here right now.</p>`; }
    catch (e) { list.innerHTML = `<p class="note">${gn && !(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) ? "Google News headlines work in the installed extension; on the demo, try Hacker News, GitHub or dev.to." : "Couldn't load this feed. Check your connection and try again."}</p>`; }
  };
  await load();
  el.addEventListener("click", async (e) => {
    const f = e.target.closest("[data-feed]");
    if (f) { cur = f.dataset.feed; el.querySelectorAll("[data-feed]").forEach((b) => b.setAttribute("aria-pressed", String(b === f))); C.S().news.tab = cur; C.persist(); return load(); }
    if (e.target.closest("[data-refresh]")) return load(true);
    if (e.target.closest("[data-lang]")) { lang = lang === "hi" ? "en" : "hi"; C.S().news.lang = lang; C.persist(); return load(); }
    if (e.target.closest("[data-ticker]")) { const N = C.S().news; const on = !(N.ticker && N.tickerFeed === cur); N.ticker = on; N.tickerFeed = cur; await C.persist(); drawTicker(); C.toast(on ? `${FEEDS[cur].name} headlines are in the ticker.` : "Ticker off."); return load(); }
  });
}

// the scrolling headline strip on the new tab
export async function drawTicker() {
  const N = C.S().news, el = $("#ticker");
  el.hidden = !N.ticker;
  if (!N.ticker) return;
  const id = N.tickerFeed || "india";
  try {
    const items = (await fetchFeed(id, N.lang || "en")).slice(0, 12);
    if (!items.length) { el.hidden = true; return; }
    const line = items.map((x) => `<a href="${C.esc(x.u)}" target="_blank" rel="noopener">${C.esc(x.t)}</a>`).join('<i>•</i>');
    el.innerHTML = `<button type="button" class="tk__lbl" data-open>${FEEDS[id].emoji} ${FEEDS[id].name}</button><div class="tk__win"><div class="tk__run" style="animation-duration:${Math.max(40, items.length * 9)}s">${line}<i>•</i>${line}<i>•</i></div></div>`;
    el.querySelector("[data-open]").onclick = () => openHub("news");
  } catch (e) { el.hidden = true; }
}

export function initNews(ctx) {
  C = ctx;
  addPane({ id: "news", label: "News", icon: ICON, title: "News", sub: "India, world, tech, AI and developer news", render: (el) => { render(el); } });
  drawTicker(); setInterval(drawTicker, TTL);
}
