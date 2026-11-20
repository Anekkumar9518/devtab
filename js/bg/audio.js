// Keeps the hidden audio page open while there's something to hear (a ringing
// reminder or the ambient mix) and tells it what to play.
export const AMBIENT = "devtab:ambient"; // { on, levels: { rain: 0.6, ... }, stopAt }

export async function setRinging(on) {
  await chrome.storage.session.set({ ringing: !!on });
  await sync();
}

let busy = Promise.resolve();
export function sync() {
  busy = busy.then(doSync, doSync);
  return busy;
}
async function doSync() {
  const { ringing = false } = await chrome.storage.session.get("ringing");
  const amb = (await chrome.storage.local.get(AMBIENT))[AMBIENT] || { on: false, levels: {} };
  const playing = amb.on && Object.values(amb.levels || {}).some((v) => v > 0);
  const has = chrome.offscreen.hasDocument ? await chrome.offscreen.hasDocument() : false;
  if (!ringing && !playing) { if (has) await chrome.offscreen.closeDocument().catch(() => {}); return; }
  if (!has) await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["AUDIO_PLAYBACK"], justification: "Plays the reminder ringtone and the ambient sounds you turn on." }).catch(() => {});
  chrome.runtime.sendMessage({ target: "offscreen", type: "state", ringing, on: amb.on, levels: amb.levels || {} }).catch(() => {});
}

chrome.runtime.onMessage.addListener((m) => { if (m && m.type === "offscreen-ready") sync(); });
chrome.storage.onChanged.addListener(async (ch, area) => {
  if (area !== "local" || !ch[AMBIENT]) return;
  const amb = ch[AMBIENT].newValue || {};
  await chrome.alarms.clear("ambient:stop");
  if (amb.on && amb.stopAt) chrome.alarms.create("ambient:stop", { when: Math.max(amb.stopAt, Date.now() + 1000) });
  sync();
});
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== "ambient:stop") return;
  const amb = (await chrome.storage.local.get(AMBIENT))[AMBIENT];
  if (amb) { amb.on = false; delete amb.stopAt; await chrome.storage.local.set({ [AMBIENT]: amb }); }
});
