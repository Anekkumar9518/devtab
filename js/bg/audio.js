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
  const { ringing = false, offReasons = [] } = await chrome.storage.session.get(["ringing", "offReasons"]);
  const local = await chrome.storage.local.get([AMBIENT, "devtab:settings"]);
  const amb = local[AMBIENT] || { on: false, levels: {} };
  const air = !!((local["devtab:settings"] || {}).fx || {}).air;
  const playing = amb.on && Object.values(amb.levels || {}).some((v) => v > 0);
  let has = chrome.offscreen.hasDocument ? await chrome.offscreen.hasDocument() : false;
  if (!ringing && !playing && !air) { if (has) await chrome.offscreen.closeDocument().catch(() => {}); return; }
  // the camera needs the USER_MEDIA reason; a page opened for sound alone gets reopened with it
  const reasons = air ? ["USER_MEDIA", "AUDIO_PLAYBACK"] : ["AUDIO_PLAYBACK"];
  if (has && reasons.some((r) => !offReasons.includes(r))) { await chrome.offscreen.closeDocument().catch(() => {}); has = false; }
  if (!has) {
    await chrome.offscreen.createDocument({ url: "offscreen.html", reasons, justification: "Plays reminder ringtones and ambient sounds, and reads the webcam for Air control's hand tracking when you turn it on." }).catch(() => {});
    await chrome.storage.session.set({ offReasons: reasons });
  }
  chrome.runtime.sendMessage({ target: "offscreen", type: "state", ringing, on: amb.on, levels: amb.levels || {}, air }).catch(() => {});
}

chrome.runtime.onMessage.addListener((m) => { if (m && m.type === "offscreen-ready") sync(); });
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local" || !ch["devtab:settings"]) return;
  const o = ((ch["devtab:settings"].oldValue || {}).fx || {}).air, n = ((ch["devtab:settings"].newValue || {}).fx || {}).air;
  if (o !== n) sync();
});
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
