const statusNode = document.getElementById("status");
const toggleButton = document.getElementById("toggle");
let currentTabId = null;
let enabled = false;

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id ?? null;
  if (!tab?.url || !/^https:\/\/bagantrail\.com\/play(?:[/?#]|$)/.test(tab.url)) {
    statusNode.textContent = "Open the BaganTrail game tab to use Trail Kit.";
    toggleButton.textContent = "Game tab required";
    toggleButton.disabled = true;
    return;
  }

  const state = await chrome.runtime.sendMessage({ type: "bt-state", tabId: currentTabId });
  enabled = Boolean(state?.enabled);
  if (enabled && state.lastPatch === "installed") {
    statusNode.textContent = "Hook installed on this tab.";
  } else if (enabled) {
    statusNode.textContent = "Active; waiting for the game bundle hook.";
  } else {
    statusNode.textContent = "Ready to enable on this game tab.";
  }
  toggleButton.textContent = enabled ? "Disable and restore" : "Enable and reload";
  toggleButton.disabled = false;
}

toggleButton.addEventListener("click", async () => {
  if (currentTabId == null) return;
  toggleButton.disabled = true;
  statusNode.textContent = enabled ? "Disabling and reloading…" : "Enabling and reloading…";
  const response = await chrome.runtime.sendMessage({
    type: enabled ? "bt-disable" : "bt-enable",
    tabId: currentTabId
  });
  statusNode.textContent = response?.message || (response?.ok ? "Done." : "Could not change this tab.");
  if (!response?.ok) toggleButton.disabled = false;
});

refresh().catch((error) => {
  statusNode.textContent = error.message || "Could not read this tab.";
  toggleButton.disabled = true;
  toggleButton.textContent = "Unavailable";
});
