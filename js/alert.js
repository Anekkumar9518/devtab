// The alert window the background worker opens when a task is due.
import { getTasks } from "./tasks.js";
import { renderAlert } from "./alertui.js";

const id = new URLSearchParams(location.search).get("id");
const root = document.getElementById("root");
const settings = (await chrome.storage.local.get("devtab:settings"))["devtab:settings"] || {};
const mode = settings.mode || "dev";
const look = settings[mode] || {};
document.body.dataset.mode = mode;
document.body.style.setProperty("--accent", look.accent || (mode === "hacker" ? "#00ff66" : "#7c9cff"));

const task = (await getTasks()).find((t) => t.id === id);
if (!task) { window.close(); }
else {
  document.title = "⏰ " + task.text;
  const onAction = (action, minutes) => chrome.runtime.sendMessage({ type: "task", id, action, minutes });
  renderAlert(root, task, mode, onAction);
}
