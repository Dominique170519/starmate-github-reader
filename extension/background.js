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

const STORAGE_PREFIX = "starmate:reader:";

async function readSnapshotsFromStorage() {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith(`${STORAGE_PREFIX}snapshot:`))
    .map(([key, value]) => ({ key, value }))
    .sort((left, right) => (right.value.lastReadAt || 0) - (left.value.lastReadAt || 0));
}

async function markIfRemoteVersionChanged({ key, value: snapshot }) {
  if (!snapshot.owner || !snapshot.repository || !snapshot.documentPath) return;
  if (snapshot.retryAfter && snapshot.retryAfter > Date.now()) return;
  const query = new URLSearchParams({ path: snapshot.documentPath, per_page: "1" });
  const response = await fetch(
    `https://api.github.com/repos/${snapshot.owner}/${snapshot.repository}/commits?${query}`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (response.status === 403 || response.status === 429) {
    const retrySeconds = Number(response.headers.get("retry-after")) || 3600;
    await chrome.storage.local.set({
      [key]: { ...snapshot, retryAfter: Date.now() + retrySeconds * 1000 },
    });
    return;
  }
  if (!response.ok) return;
  const [latest] = await response.json();
  if (!latest?.sha || latest.sha === snapshot.remoteSha) return;
  await chrome.storage.local.set({
    [key]: {
      ...snapshot,
      pendingRemoteSha: latest.sha,
      lastRemoteCheckAt: Date.now(),
      retryAfter: 0,
    },
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "starmate-daily-update") return;
  const snapshots = await readSnapshotsFromStorage();
  for (const snapshot of snapshots.slice(0, 20)) {
    try {
      await markIfRemoteVersionChanged(snapshot);
    } catch {
      // A temporary network error must not erase the last known version.
    }
  }
});

chrome.alarms.get("starmate-daily-update").then((alarm) => {
  if (!alarm) chrome.alarms.create("starmate-daily-update", { periodInMinutes: 1440 });
});
