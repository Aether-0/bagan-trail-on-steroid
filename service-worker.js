import { patchBundle } from "./patcher.js";

const STATE_KEY = "baganTrailEnabledTabs";
const MENU_SCRIPT_ID = "bagantrail-trail-kit-menu";
const GAME_MATCH = "https://bagantrail.com/play*";
const BRIDGE_SOURCE = `(() => {
  if (location.hostname !== "bagantrail.com" || !location.pathname.startsWith("/play")) return;
  if (window.__BT_EXTENSION_BRIDGE__) return;
  window.__BT_EXTENSION_BRIDGE__ = true;
  window.__BT_CHEAT__ = {
    enabled: true,
    speedMultiplier: null,
    staminaDrain: 0,
    stamina: 100,
    forceGallop: false,
    speedNow: 8,
    fly: false,
    flyHeight: 8,
    noclip: false
  };
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window || message?.source !== "bt-trail-kit-extension") return;
    if (message.type === "config" && message.config && typeof message.config === "object") {
      Object.assign(window.__BT_CHEAT__, message.config);
    }
    if (message.type === "stop" && window.__BT_PLAYER_STATE__) {
      window.__BT_PLAYER_STATE__.speed = 0;
      window.__BT_PLAYER_STATE__.requested = "walk";
      window.__BT_PLAYER_STATE__.gallopLatch = false;
    }
  });
  window.setInterval(() => window.postMessage({
    source: "bt-trail-kit-page",
    type: "status",
    hooksReady: Boolean(window.__BT_HOOKS_READY__),
    connected: Boolean(window.__BT_PLAYER_STATE__)
  }, "*"), 600);
})();`;

async function getStates() {
  const data = await chrome.storage.session.get({ [STATE_KEY]: {} });
  return data[STATE_KEY] || {};
}

async function setStates(states) {
  await chrome.storage.session.set({ [STATE_KEY]: states });
}

async function ensureMenuScript() {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [MENU_SCRIPT_ID] });
  if (registered.length) return;
  await chrome.scripting.registerContentScripts([{
    id: MENU_SCRIPT_ID,
    matches: [GAME_MATCH],
    js: ["menu.js"],
    css: ["menu.css"],
    runAt: "document_start",
    world: "ISOLATED",
    persistAcrossSessions: false
  }]);
}

async function enableTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || !/^https:\/\/bagantrail\.com\/play(?:[/?#]|$)/.test(tab.url)) {
    throw new Error("Open the BaganTrail game tab first.");
  }

  const states = await getStates();
  if (states[tabId]) {
    await chrome.tabs.reload(tabId);
    return { ok: true, message: "Already active; reloading the game." };
  }

  let attached = false;
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    attached = true;
    await chrome.debugger.sendCommand({ tabId }, "Page.enable");
    const bridge = await chrome.debugger.sendCommand({ tabId }, "Page.addScriptToEvaluateOnNewDocument", {
      source: BRIDGE_SOURCE
    });
    await chrome.debugger.sendCommand({ tabId }, "Fetch.enable", {
      patterns: [{ urlPattern: "*://bagantrail.com/assets/game-*.js*", requestStage: "Response" }]
    });
    await ensureMenuScript();
    states[tabId] = { bridgeIdentifier: bridge.identifier, enabledAt: Date.now(), lastPatch: "waiting" };
    await setStates(states);
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#C85E45" });
    await chrome.action.setBadgeText({ tabId, text: "ON" });
    await chrome.tabs.reload(tabId);
    return { ok: true, message: "Trail Kit is enabled. The game is reloading." };
  } catch (error) {
    if (attached) {
      try { await chrome.debugger.detach({ tabId }); } catch {}
    }
    throw error;
  }
}

async function disableTab(tabId, reload = true) {
  const states = await getStates();
  const state = states[tabId];
  if (state) {
    try { await chrome.debugger.sendCommand({ tabId }, "Fetch.disable"); } catch {}
    if (state.bridgeIdentifier) {
      try {
        await chrome.debugger.sendCommand({ tabId }, "Page.removeScriptToEvaluateOnNewDocument", {
          identifier: state.bridgeIdentifier
        });
      } catch {}
    }
    try { await chrome.debugger.detach({ tabId }); } catch {}
    delete states[tabId];
    await setStates(states);
  }

  if (!Object.keys(states).length) {
    try { await chrome.scripting.unregisterContentScripts({ ids: [MENU_SCRIPT_ID] }); } catch {}
  }
  await chrome.action.setBadgeText({ tabId, text: "" });
  if (reload) {
    try { await chrome.tabs.reload(tabId); } catch {}
  }
  return { ok: true, message: "Trail Kit is disabled. The game is reloading." };
}

async function getTabState(tabId) {
  const states = await getStates();
  const state = states[tabId];
  return { enabled: Boolean(state), lastPatch: state?.lastPatch || null };
}

function bytesToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function cleanHeaders(headers) {
  return (headers || []).filter(({ name }) =>
    !["content-length", "content-encoding", "transfer-encoding"].includes(name.toLowerCase())
  );
}

async function handlePausedRequest(debuggee, params) {
  const tabId = debuggee.tabId;
  if (tabId == null) return;
  const requestId = params.requestId;
  try {
    const response = await chrome.debugger.sendCommand(debuggee, "Fetch.getResponseBody", { requestId });
    const originalText = response.base64Encoded
      ? new TextDecoder().decode(Uint8Array.from(atob(response.body), (char) => char.charCodeAt(0)))
      : response.body;
    const result = patchBundle(originalText);
    const isPatched = result.ok;
    const body = isPatched ? bytesToBase64(result.source) :
      (response.base64Encoded ? response.body : bytesToBase64(originalText));
    const headers = cleanHeaders(params.responseHeaders);
    await chrome.debugger.sendCommand(debuggee, "Fetch.fulfillRequest", {
      requestId,
      responseCode: params.responseStatusCode || 200,
      responseHeaders: headers,
      body
    });

    if (isPatched) {
      const states = await getStates();
      if (states[tabId]) {
        states[tabId].lastPatch = "installed";
        await setStates(states);
      }
    }
  } catch (error) {
    try {
      await chrome.debugger.sendCommand(debuggee, "Fetch.continueResponse", { requestId });
    } catch {
      try { await chrome.debugger.sendCommand(debuggee, "Fetch.continueRequest", { requestId }); } catch {}
    }
    console.warn("Trail Kit bundle interception failed:", error);
  }
}

chrome.debugger.onEvent.addListener((debuggee, method, params) => {
  if (method === "Fetch.requestPaused") void handlePausedRequest(debuggee, params);
});

chrome.debugger.onDetach.addListener((debuggee) => {
  if (debuggee.tabId == null) return;
  void (async () => {
    const states = await getStates();
    if (!states[debuggee.tabId]) return;
    delete states[debuggee.tabId];
    await setStates(states);
    if (!Object.keys(states).length) {
      try { await chrome.scripting.unregisterContentScripts({ ids: [MENU_SCRIPT_ID] }); } catch {}
    }
    await chrome.action.setBadgeText({ tabId: debuggee.tabId, text: "" });
  })();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading") return;
  const currentUrl = changeInfo.url || tab.url;
  if (!currentUrl || /^https:\/\/bagantrail\.com\/play(?:[/?#]|$)/.test(currentUrl)) return;
  void getStates().then((states) => states[tabId] ? disableTab(tabId, false) : undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "bt-enable") {
    enableTab(message.tabId).then(sendResponse, (error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }
  if (message?.type === "bt-disable") {
    disableTab(message.tabId).then(sendResponse, (error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }
  if (message?.type === "bt-state") {
    getTabState(message.tabId).then(sendResponse, (error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }
  if (message?.type === "bt-content-state") {
    getTabState(_sender.tab?.id).then(sendResponse, (error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }
});
