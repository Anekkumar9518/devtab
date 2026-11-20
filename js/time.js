// Website time machine. Asks the Internet Archive for every month a site was
// saved (the CDX index, the same data behind the Wayback Machine's calendar),
// draws one bar per year, and shows the snapshot nearest mid-year. Years before
// the site's first capture say it didn't exist yet; years with no capture say so.
import { load } from "./store.js";

const $ = (s) => document.querySelector(s);
const S = await load();
document.body.dataset.mode = S.mode;
if (S.mode === "hacker") document.body.style.setProperty("--a", S.hacker.accent);

const raw = new URLSearchParams(location.search).get("u") || "https://www.google.com";
const target = (() => { try { return new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw).hostname.replace(/^www\./, ""); } catch (e) { return raw; } })();
const NOW = new Date().getFullYear(), FIRST = 1996;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FACTS = {
  1996: "Hotmail launched, and two Stanford students began the project that became Google.", 1997: "Netflix was founded and google.com was registered.", 1998: "Google was founded.",
  1999: "Napster launched and changed music forever.", 2000: "The dot-com bubble burst.", 2001: "Wikipedia went online and the first iPod shipped.", 2002: "Firefox's first version (then called Phoenix) was released.",
  2003: "Skype and MySpace launched.", 2004: "Facebook and Gmail launched.", 2005: "YouTube launched.", 2006: "Twitter launched.", 2007: "The first iPhone launched, and Flipkart was founded.",
  2008: "Google Chrome and the first Android phone arrived.", 2009: "WhatsApp was founded and Bitcoin went live.", 2010: "Instagram launched and the first iPad shipped.", 2011: "Snapchat launched.",
  2012: "Facebook passed one billion users.", 2013: "React was open-sourced.", 2014: "Apple released the Swift language.", 2015: "Windows 10 was released.", 2016: "Jio launched and mobile data in India became cheap.",
  2017: "The Transformer paper, \"Attention Is All You Need\", was published.", 2018: "GDPR came into force in Europe.", 2019: "Disney+ launched.", 2020: "The world moved online during the pandemic.",
  2021: "GitHub Copilot was previewed.", 2022: "ChatGPT launched.", 2023: "GPT-4 and Claude were released.", 2024: "Apple Vision Pro went on sale.",
};

$("#host").textContent = target;
$("#fav").src = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent("https://" + target)}&size=64`);
document.title = `${target} through the years · DevTab`;
$("#other").value = "";
$("#go").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#other").value.trim(); if (v) location.search = "?u=" + encodeURIComponent(v); });

const fmt = (ts) => `${+ts.slice(6, 8)} ${MONTHS[+ts.slice(4, 6) - 1]} ${ts.slice(0, 4)}`;
const snap = (ts) => `https://web.archive.org/web/${ts}if_/http://${target}/`;
let byYear = {}, born = null, latest = null, cur = NOW, view = "one", playing = 0;

// the archive's index of captures, one per month
async function index() {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
  const r = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&fl=timestamp&collapse=timestamp:6&filter=statuscode:200`, { signal: ctl.signal });
  clearTimeout(t);
  const rows = (await r.json()).slice(1).map((x) => x[0]);
  for (const ts of rows) (byYear[ts.slice(0, 4)] = byYear[ts.slice(0, 4)] || []).push(ts);
  born = rows[0] || null; latest = rows[rows.length - 1] || null;
  return rows.length;
}

function drawBars() {
  const bornY = born ? +born.slice(0, 4) : NOW + 1;
  let html = "";
  for (let y = FIRST; y <= NOW; y++) {
    const n = (byYear[y] || []).length, cls = y < bornY ? "is-none" : !n ? "is-gap" : "";
    html += `<button type="button" class="yb ${cls}${y === bornY ? " is-born" : ""}${y === cur ? " is-on" : ""}" data-y="${y}" title="${y}: ${y < bornY ? "didn't exist yet" : n ? n + " month" + (n === 1 ? "" : "s") + " saved" : "not saved"}"><i style="height:${Math.max(4, (n / 12) * 100)}%"></i><span>${y % 2 === 0 || y === NOW ? "'" + String(y).slice(2) : ""}</span></button>`;
  }
  $("#bars").innerHTML = html;
}

function frame(n, src, label, year) {
  const i = $(`#i${n}`), l = $(`#l${n}`);
  $(`#a${n}`).textContent = `${target} · ${label}`; $(`#y${n}`).textContent = year;
  if (src && i.dataset.src !== src) {
    l.classList.remove("is-out"); i.dataset.src = src; i.src = src;
    const show = () => l.classList.add("is-out");
    i.onload = show; clearTimeout(i._t); i._t = setTimeout(show, 5000); // old pages trickle in; show what's there
  }
  else if (!src) l.classList.add("is-out");
}

let loadT = 0;
function select(y, now) {
  cur = y; $("#year").value = y;
  document.querySelectorAll(".yb").forEach((b) => b.classList.toggle("is-on", +b.dataset.y === y));
  $("#fact").innerHTML = FACTS[y] ? `<b>${y}</b> · ${FACTS[y]}` : "";
  $("#wb").href = `https://web.archive.org/web/${y}0701000000*/${target}`;
  clearTimeout(loadT);
  loadT = setTimeout(() => {
    const bornY = born ? +born.slice(0, 4) : NOW + 1, list = byYear[y] || [], msg = $("#m1");
    if (y < bornY || !list.length) {
      const nearest = Object.keys(byYear).map(Number).sort((a, b) => Math.abs(a - y) - Math.abs(b - y))[0];
      msg.hidden = false; $("#i1").removeAttribute("src"); $("#i1").dataset.src = "";
      msg.innerHTML = y < bornY
        ? `<div class="egg">🥚</div><h2>In ${y}, ${target} didn't exist yet</h2><p>${born ? `It first appeared on the web on <b>${fmt(born)}</b>, ${bornY - y} year${bornY - y === 1 ? "" : "s"} later.` : "The Internet Archive has never saved this site."}</p>${born ? `<button class="btn" data-jump="${bornY}">Jump to its first year</button>` : ""}`
        : `<div class="egg">📭</div><h2>No snapshot from ${y}</h2><p>${target} was around, but the Internet Archive didn't save it that year.</p>${nearest ? `<button class="btn" data-jump="${nearest}">Go to ${nearest}</button>` : ""}`;
      frame(1, null, String(y), y);
    } else {
      msg.hidden = true;
      const ts = list.slice().sort((a, b) => Math.abs(+a.slice(4, 6) - 7) - Math.abs(+b.slice(4, 6) - 7))[0]; // nearest to mid-year
      frame(1, snap(ts), `saved ${fmt(ts)}`, y);
    }
    if (view === "vs" && latest) frame(2, snap(latest), `latest, ${fmt(latest)}`, "Now");
  }, now ? 0 : 320);
}

$("#bars").addEventListener("click", (e) => { const b = e.target.closest("[data-y]"); if (b) { stop(); select(+b.dataset.y); } });
$("#year").addEventListener("input", (e) => { stop(); select(+e.target.value); });
$("#stage").addEventListener("click", (e) => { const j = e.target.closest("[data-jump]"); if (j) select(+j.dataset.jump, true); });
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
  view = b.dataset.view; document.querySelectorAll("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  $("#f2").hidden = view !== "vs"; select(cur, true);
}));
document.addEventListener("keydown", (e) => { if (e.target.closest("input")) return; if (e.key === "ArrowLeft") select(Math.max(FIRST, cur - 1)); if (e.key === "ArrowRight") select(Math.min(NOW, cur + 1)); });

// play through every saved year like a time-lapse
function stop() { clearInterval(playing); playing = 0; $("#play").textContent = "▶ Play the years"; }
$("#play").addEventListener("click", () => {
  if (playing) return stop();
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b); if (!years.length) return;
  let i = Math.max(0, years.indexOf(cur) + 1); if (i >= years.length) i = 0;
  $("#play").textContent = "❚❚ Pause";
  select(years[i++], true);
  playing = setInterval(() => { if (i >= years.length) return stop(); select(years[i++], true); }, 3500);
});

$("#year").min = FIRST; $("#year").max = NOW;
try {
  const n = await index();
  const yrs = Object.keys(byYear).length;
  $("#born").innerHTML = born ? `First saved <b>${fmt(born)}</b> · saved in ${n} months across ${yrs} year${yrs === 1 ? "" : "s"}` : "The Internet Archive has never saved this site.";
  drawBars();
  // start in its very first year: the most fun place to begin
  select(born ? +born.slice(0, 4) : NOW, true);
} catch (e) {
  $("#born").textContent = "The Internet Archive is slow or busy right now. Try again in a minute.";
  drawBars(); select(NOW, true);
}
