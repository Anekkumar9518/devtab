// The "it's time" card: used by the extension's alert window and, on the web
// demo, by an in-page alert. onAction(action, minutes) is called with
// "start", "complete" or "snooze".
import { when } from "./tasks.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bell = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

function late(at) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m <= 0) return "due now";
  if (m < 60) return m + " min late";
  const h = Math.floor(m / 60); return h + " h " + (m % 60) + " min late";
}

export function renderAlert(el, task, mode, onAction) {
  const hacker = mode === "hacker";
  el.innerHTML = `
    <div class="al ${hacker ? "al--hacker" : ""}" role="alertdialog" aria-labelledby="alT" aria-describedby="alD">
      <div class="al__ring">${bell}</div>
      <p class="al__k">${hacker ? "> incoming task" : "Reminder"}</p>
      <h1 class="al__t" id="alT">${esc(task.text)}</h1>
      <p class="al__d" id="alD">${task.at ? `Set for ${esc(when(task.at))} · <span data-late>${late(task.at)}</span>` : "No time set"}${task.snoozes ? ` · snoozed ${task.snoozes}×` : ""}</p>
      <div class="al__main">
        <button type="button" class="al__btn al__btn--go" data-a="start" autofocus>▶ Start now</button>
        <button type="button" class="al__btn" data-a="complete">✓ Complete</button>
      </div>
      <p class="al__k al__k--sm">Remind me again in</p>
      <div class="al__snz">${[5, 10, 15, 30, 60].map((m) => `<button type="button" data-snz="${m}">${m < 60 ? m + " min" : "1 hour"}</button>`).join("")}</div>
      <form class="al__custom" data-custom><input type="number" min="1" max="1440" placeholder="Custom" aria-label="Custom minutes"><span>min</span><button type="submit">Snooze</button></form>
      <p class="al__foot">Closing this ${onAction.inPage ? "alert" : "window"} snoozes it for 5 minutes.</p>
    </div>`;
  let done = false;
  const go = (a, m) => { if (done) return; done = true; el.querySelectorAll("button").forEach((b) => (b.disabled = true)); onAction(a, m); };
  el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]"); if (a) return go(a.dataset.a);
    const s = e.target.closest("[data-snz]"); if (s) return go("snooze", +s.dataset.snz);
  });
  el.querySelector("[data-custom]").addEventListener("submit", (e) => {
    e.preventDefault(); const v = +e.target.querySelector("input").value;
    if (v >= 1 && v <= 1440) go("snooze", v); else e.target.querySelector("input").focus();
  });
  const iv = setInterval(() => { const l = el.querySelector("[data-late]"); if (l && task.at) l.textContent = late(task.at); }, 15000);
  return () => clearInterval(iv);
}
