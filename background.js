async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING_COLOR_PIPETTE" });
    return { ok: true };
  } catch (error) {
    const message = error?.message ?? "";

    if (!message.includes("Receiving end does not exist")) {
      return { ok: false, error: message || "Unable to reach the page." };
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });

    await chrome.tabs.sendMessage(tabId, { type: "PING_COLOR_PIPETTE" });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "This page does not allow the extension to run."
    };
  }
}

async function relayMessageToTab(tabId, payload) {
  const scriptReady = await ensureContentScript(tabId);

  if (!scriptReady.ok) {
    return scriptReady;
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, payload);
    return response ?? { ok: false, error: "No data received." };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Unable to communicate with the current page."
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = message?.tabId ?? sender.tab?.id;

  if (message?.type === "OPEN_COLOR_PICKER") {
    if (!tabId) {
      sendResponse({ ok: false, error: "No active tab found." });
      return true;
    }

    relayMessageToTab(tabId, { type: "START_COLOR_PICKER" }).then(sendResponse);
    return true;
  }

  if (message?.type === "GET_PAGE_COLORS") {
    if (!tabId) {
      sendResponse({ ok: false, error: "No active tab found." });
      return true;
    }

    relayMessageToTab(tabId, { type: "COLLECT_PAGE_COLORS" }).then(sendResponse);
    return true;
  }

  return false;
});
