// Camera guard: decides from the face data when to raise the Shoulder-surfer
// shield (a second face appears) and Away mode (no face for a while), tells
// every tab, and mutes/unmutes tabs for Away mode.
const SETTINGS = "devtab:settings";
let fx = {}, state = { shield: false, away: false };
let twoSince = 0, oneSince = 0, goneSince = 0, backSince = 0, muted = [];

async function loadFx() { fx = (((await chrome.storage.local.get(SETTINGS))[SETTINGS] || {}).fx) || {}; }
loadFx();
chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[SETTINGS]) { loadFx().then(() => { if (!fx.shield && state.shield) set({ shield: false }); if (!fx.away && state.away) set({ away: false }); }); } });

async function broadcast() {
  const msg = { type: "cam-state", ...state };
  chrome.runtime.sendMessage(msg).catch(() => {});
  for (const t of await chrome.tabs.query({ url: ["https://*/*", "http://*/*"] })) chrome.tabs.sendMessage(t.id, msg).catch(() => {});
}
async function set(patch) {
  const was = { ...state };
  Object.assign(state, patch);
  if (was.away !== state.away) {
    if (state.away) { // mute whatever is playing, and remember it
      muted = [];
      for (const t of await chrome.tabs.query({ audible: true })) if (!t.mutedInfo || !t.mutedInfo.muted) { await chrome.tabs.update(t.id, { muted: true }).catch(() => {}); muted.push(t.id); }
    } else { for (const id of muted) chrome.tabs.update(id, { muted: false }).catch(() => {}); muted = []; }
  }
  if (was.shield !== state.shield || was.away !== state.away) broadcast();
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m) return;
  if (m.type === "cam-state?") { reply(state); return; }
  if (m.type !== "air") return;
  if (m.status === "off") { twoSince = oneSince = goneSince = backSince = 0; if (state.shield || state.away) set({ shield: false, away: false }); return; }
  const f = m.face; if (!f) return; // faces come every other frame
  const now = Date.now();
  // Shield: a second face that's a real person (not a tiny face far away) for half a second
  const people = f.ok ? 1 + (f.others || []).filter((s) => s > Math.max(0.07, f.size * 0.35)).length : 0;
  if (fx.shield) {
    if (people >= 2) { oneSince = 0; twoSince = twoSince || now; if (!state.shield && now - twoSince > 450) set({ shield: true }); }
    else { twoSince = 0; oneSince = oneSince || now; if (state.shield && now - oneSince > 1200) set({ shield: false }); }
  }
  // Away: nobody in front of the camera for a while; back as soon as a face returns
  if (fx.away) {
    const secs = Math.max(10, fx.awaySecs || 60);
    if (!f.ok) { backSince = 0; goneSince = goneSince || now; if (!state.away && now - goneSince > secs * 1000) set({ away: true }); }
    else { goneSince = 0; backSince = backSince || now; if (state.away && now - backSince > 400) set({ away: false }); }
  }
});
