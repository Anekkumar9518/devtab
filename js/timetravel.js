// Time travel: drag through the day and the live sky follows (dawn, noon,
// sunset, stars). Let go and it glides back to the real time.
import { dayGradient, sunAt } from "./scenes/sky.js";

const $ = (s) => document.querySelector(s);
let D = null, getS = null, anim = 0;

const fmt = (m) => {
  const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60);
  return new Date(2000, 0, 1, h, mm).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
const nowMin = () => {
  const wx = D.wx, off = wx && Number.isFinite(wx.off) ? wx.off : -new Date().getTimezoneOffset() * 60;
  return ((Date.now() / 60000 + off / 60) % 1440 + 1440) % 1440;
};
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

function paint(m, live) {
  const wx = D.wx, rise = wx ? wx.rise : 375, set = wx ? wx.set : 1080;
  const day = sunAt(m, rise, set).day;
  $("#ttIc").innerHTML = day ? SUN : MOON;
  $("#tt").classList.toggle("is-night", !day);
  $("#tt").classList.toggle("is-live", live);
  const S = getS();
  $("#ttLbl").innerHTML = live ? `<b>Live</b> · ${fmt(m)}${S.city ? " · " + S.city.name.replace(/[<>&]/g, "") : ""}` : `<b>${fmt(m)}</b> · time travel`;
  $("#ttRange").value = String(Math.round(m));
  $("#tt").style.setProperty("--k", (m / 1440).toFixed(4));
}

export function drawTimeTravel() {
  const S = getS(), on = S.fx.timeTravel && S[S.mode].bg === "sky";
  $("#tt").hidden = !on;
  if (!on) return;
  const wx = D.wx;
  $("#ttTrack").style.background = dayGradient(wx ? wx.rise : 375, wx ? wx.set : 1080);
  if (D.override == null) paint(nowMin(), true);
}

export function initTimeTravel(data, getSettings) {
  D = data; getS = getSettings;
  const r = $("#ttRange");
  r.addEventListener("input", () => { cancelAnimationFrame(anim); D.override = +r.value; paint(D.override, false); });
  const release = () => {
    if (D.override == null) return;
    // glide back to now along the shorter way round the clock
    const from = D.override, to = nowMin();
    let delta = to - from; if (delta > 720) delta -= 1440; if (delta < -720) delta += 1440;
    const t0 = performance.now(), dur = 1400;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      D.override = (from + delta * e + 1440) % 1440; paint(D.override, false);
      if (k < 1) anim = requestAnimationFrame(step); else { D.override = null; paint(nowMin(), true); }
    };
    anim = requestAnimationFrame(step);
  };
  r.addEventListener("pointerup", release);
  r.addEventListener("keyup", (e) => { if (!/Arrow|Page|Home|End/.test(e.key)) return; clearTimeout(r._t); r._t = setTimeout(release, 900); });
  r.addEventListener("touchend", release);
  setInterval(() => { if (D.override == null && !$("#tt").hidden) paint(nowMin(), true); }, 30000);
}
