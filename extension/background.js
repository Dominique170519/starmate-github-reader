const SCRIPT_FILES = ["core.js", "adapters.js", "storage.js", "content.js"];
const STYLE_FILES = ["styles.css"];
const REGISTERED_PREFIX = "starmate-github-pages-";

function registrationId(hostname) {
  return `${REGISTERED_PREFIX}${hostname.replace(/[^a-z0-9]/gi, "-")}`;
}

async function registerOrigin(origin, hostname) {
  const id = registrationId(hostname);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length) return;
  await chrome.scripting.registerContentScripts([{
    id,
    matches: [`${origin}/*`],
    js: SCRIPT_FILES,
    css: STYLE_FILES,
    runAt: "document_idle",
    persistAcrossSessions: true,
  }]);
}

async function enableOnTab(tab) {
  if (!tab?.id || !tab.url) return;
  const url = new URL(tab.url);
  if (!url.hostname.endsWith(".github.io")) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    return;
  }
  const originPattern = `${url.origin}/*`;
  const granted = await chrome.permissions.request({ origins: [originPattern] });
  if (!granted) {
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#b42318" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    return;
  }
  await registerOrigin(url.origin, url.hostname);
  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: STYLE_FILES });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: SCRIPT_FILES });
  await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
}

chrome.action.onClicked.addListener((tab) => {
  enableOnTab(tab).catch(() => {
    if (tab?.id) chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("starmate-daily-update", { periodInMinutes: 1440 });
});
