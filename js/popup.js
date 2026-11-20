// The toolbar popup: start a page tool on the current tab, see a running focus
// session, or jump to the Hub.
import { load } from "./store.js";
import { getFocus } from "./focus-core.js";

const $ = (s) => document.querySelector(s);
const S = await load();
document.body.dataset.mode = S.mode;
document.body.style.setProperty("--a", S[S.mode].accent);

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
try { $("#sub").textContent = new URL(tab.url).hostname.replace(/^www\./, "") || "this page"; } catch (e) {}

const f = await getFocus();
if (f && Date.now() < f.endsAt) {
  const left = Math.ceil((f.endsAt - Date.now()) / 60000);
  $("#focus").hidden = false; $("#focus").innerHTML = `🎯 Focus mode is on<b>${left} min left</b>`;
}

document.querySelector(".tools").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-tool]"); if (!b) return;
  const r = await chrome.runtime.sendMessage({ type: "tool", tool: b.dataset.tool, tabId: tab.id });
  if (r && r.ok) window.close();
  else { $("#err").hidden = false; $("#err").textContent = (r && r.error) || "Something went wrong."; }
});
$("#hub").addEventListener("click", () => { chrome.tabs.create({ url: "newtab.html#hub" }); window.close(); });
