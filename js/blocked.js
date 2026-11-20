// The page a blocked site turns into during a focus session.
import { load } from "./store.js";
import { getFocus, endFocus, hostOf, FOCUS } from "./focus-core.js";
import { watch } from "./kv.js";

const $ = (s) => document.querySelector(s);
const url = new URLSearchParams(location.search).get("u") || "";
const host = hostOf(url) || "this site";
const S = await load();
const hacker = S.mode === "hacker";
document.body.dataset.mode = S.mode;
document.body.style.setProperty("--accent", S[S.mode].accent);
document.title = `${host} is blocked · focus mode`;

$("#lock").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.3" fill="currentColor"/></svg>';
$("#host").innerHTML = hacker ? `connection to <b>${host}</b> refused` : `<b>${host}</b> is blocked while you focus.`;
if (hacker) { $("#kicker").textContent = "// focus.protocol active"; $("#title").textContent = "ACCESS DENIED"; $("#title").dataset.text = "ACCESS DENIED"; }

const LINES = hacker
  ? ["> distraction intercepted. returning operator to task.", "> the feed will still be there later. your focus won't.", "> firewall holds. stay on target.", "> attention is the scarcest resource. guard it."]
  : ["It will still be there when the timer ends.", "Future you is already saying thanks.", "One focused hour beats a distracted day.", "Close this tab; the work is waiting.", "You chose this block for a reason."];
let li = 0;
const nextLine = () => { const el = $("#line"); el.style.opacity = 0; setTimeout(() => { el.textContent = LINES[li++ % LINES.length]; el.style.opacity = 1; }, 400); };
nextLine(); setInterval(nextLine, 7000);

// terminal readout in the Hacker look
if (hacker) {
  const t = $("#term"); t.hidden = false;
  const lines = [`$ curl -I ${url.slice(0, 60)}`, "HTTP/2 403 Forbidden", "x-devtab-focus: enforced", `x-blocked-host: ${host}`, ""];
  let i = 0, out = "";
  (function type() { if (i >= lines.length) return; out += lines[i++] + "\n"; t.textContent = out; setTimeout(type, 260); })();
}

// countdown
const pad = (n) => String(n).padStart(2, "0");
let F = await getFocus();
function draw() {
  const fg = $("#ringFg");
  if (!F || Date.now() >= F.endsAt) {
    document.body.classList.add("is-done");
    $("#title").textContent = $("#title").dataset.text = hacker ? "SESSION COMPLETE" : "You did it.";
    $("#kicker").textContent = hacker ? "// focus.protocol released" : "Focus session complete";
    $("#left").textContent = "00:00"; $("#leftLbl").textContent = "the block is lifted";
    $("#back").textContent = `Continue to ${host}`; $("#end").hidden = true;
    fg.style.strokeDashoffset = 0; return;
  }
  const ms = F.endsAt - Date.now(), m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  $("#left").textContent = m >= 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  fg.style.strokeDashoffset = String(603 * (1 - ms / (F.endsAt - F.startedAt)));
}
draw(); setInterval(draw, 1000);
watch(FOCUS, (v) => { F = v; draw(); });

$("#back").addEventListener("click", () => {
  if (document.body.classList.contains("is-done") && url) return location.replace(url);
  if (history.length > 1) history.back(); else location.href = "newtab.html";
});

// ending early takes a deliberate 2.5-second hold
const end = $("#end"); let holdT = 0;
const startHold = () => { end.classList.add("is-holding"); holdT = setTimeout(async () => { await endFocus(false); if (url) location.replace(url); }, 2500); };
const stopHold = () => { end.classList.remove("is-holding"); clearTimeout(holdT); };
end.addEventListener("pointerdown", startHold);
["pointerup", "pointerleave", "pointercancel"].forEach((ev) => end.addEventListener(ev, stopHold));

// a little Matrix rain behind the Hacker look
if (hacker && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const c = $("#rain"), x = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
  const size = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  size(); addEventListener("resize", size);
  const fs = 16 * dpr, cols = () => Math.ceil(c.width / fs); let drops = Array.from({ length: cols() }, () => Math.random() * -50);
  const ch = "ｱｲｳｴｵｶｷｸｹｺ01<>/{}[]#$ACCESSDENIED";
  setInterval(() => {
    if (drops.length !== cols()) drops = Array.from({ length: cols() }, () => Math.random() * -50);
    x.fillStyle = "rgba(0,0,0,.08)"; x.fillRect(0, 0, c.width, c.height);
    x.font = `${fs}px "JetBrains Mono", monospace`;
    drops.forEach((y, i) => { x.fillStyle = Math.random() < 0.04 ? "#ff2a4d" : S.hacker.accent; x.fillText(ch[(Math.random() * ch.length) | 0], i * fs, y * fs); drops[i] = y * fs > c.height && Math.random() > 0.975 ? 0 : y + 1; });
  }, 45);
}
