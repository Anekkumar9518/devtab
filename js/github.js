// Your real GitHub contribution calendar for the last year.
// In the extension it's read straight from github.com (after you allow it once);
// otherwise from github-contributions-api.jogruber.de, a free public mirror.

const ext = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
export const GH_ORIGIN = "https://github.com/*";
const TTL = 6 * 60 * 60 * 1000;

async function fromGitHub(user) {
  const r = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`, { credentials: "omit" });
  if (r.status === 404) throw new Error("notfound");
  if (!r.ok) throw new Error("http");
  const doc = new DOMParser().parseFromString(await r.text(), "text/html");
  const tips = {};
  doc.querySelectorAll("tool-tip[for]").forEach((t) => { tips[t.getAttribute("for")] = t.textContent; });
  return [...doc.querySelectorAll("td.ContributionCalendar-day[data-date]")].map((td) => {
    const m = /^(\d+)/.exec(tips[td.id] || ""); // "14 contributions on November 12th." / "No contributions on …"
    return { date: td.dataset.date, count: m ? +m[1] : 0, level: +td.dataset.level || 0 };
  });
}
async function fromMirror(user) {
  const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`);
  if (r.status === 404) throw new Error("notfound");
  if (!r.ok) throw new Error("http");
  const j = await r.json();
  if (!j.contributions) throw new Error("notfound");
  return j.contributions.map((d) => ({ date: d.date, count: d.count, level: d.level }));
}

export async function getContributions(user, force) {
  const key = "devtab:gh:" + user.toLowerCase();
  if (!force) { try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.at < TTL) return c; } catch (e) {} }
  let days, direct = false;
  if (ext && chrome.permissions && (await chrome.permissions.contains({ origins: [GH_ORIGIN] }))) { days = await fromGitHub(user); direct = true; }
  else days = await fromMirror(user);
  days = days.filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date));
  if (!days.length) throw new Error("notfound");
  const out = { user, days, total: days.reduce((s, d) => s + d.count, 0), max: Math.max(1, ...days.map((d) => d.count)), at: Date.now(), direct };
  try { localStorage.setItem(key, JSON.stringify(out)); } catch (e) {}
  return out;
}
