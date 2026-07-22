const SCRIPT_FILES = ["core.js", "adapters.js", "storage.js", "content.js"];
const STYLE_FILES = ["styles.css"];
const REGISTERED_PREFIX = "starmate-github-pages-";
const APP_ORIGIN = "https://windy3f3f3f3f-how-claude-code-works.vercel.app";
const EXTENSION_TOKEN_KEY = "starmate:sync:extension-token";
const NOTE_OPERATIONS_KEY = "starmate:reader:note-operations:v1";
const NOTES_KEY = "starmate:reader:notes:v1";
const NOTE_CURSOR_KEY = "starmate:reader:note-cursor:v1";
const SYNC_STATE_KEY = "starmate:sync:state";

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
  chrome.alarms.create("starmate-note-sync-retry", { periodInMinutes: 5 });
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

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function broadcastSyncStatus(status) {
  await chrome.storage.local.set({ [SYNC_STATE_KEY]: { status, updatedAt: Date.now() } });
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => tab.id
    ? chrome.tabs.sendMessage(tab.id, { type: "starmate-sync-status", status }).catch(() => undefined)
    : undefined));
}

function mergeStoredNotes(localNotes, remoteNotes) {
  const byId = new Map((localNotes || []).map((note) => [note.id, note]));
  for (const incoming of remoteNotes || []) {
    const current = byId.get(incoming.id);
    if (!current || incoming.version > current.version || (incoming.version === current.version && incoming.updatedAt >= current.updatedAt)) {
      byId.set(incoming.id, incoming);
    }
  }
  return [...byId.values()].slice(0, 2000);
}

async function authenticatedNotesRequest(path, token, init = {}) {
  return fetch(`${APP_ORIGIN}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}

async function syncExtensionNotes() {
  const stored = await chrome.storage.local.get([
    EXTENSION_TOKEN_KEY,
    NOTE_OPERATIONS_KEY,
    NOTES_KEY,
    NOTE_CURSOR_KEY,
  ]);
  const token = stored[EXTENSION_TOKEN_KEY];
  if (!token) {
    await broadcastSyncStatus("auth-required");
    return { synced: false, status: "auth-required" };
  }
  await broadcastSyncStatus("syncing");
  let notes = stored[NOTES_KEY] || [];
  let conflicts = 0;
  const pending = (stored[NOTE_OPERATIONS_KEY] || []).slice(0, 100);
  try {
    if (pending.length) {
      const pushed = await authenticatedNotesRequest("/api/notes", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations: pending }),
      });
      if (pushed.status === 401) {
        await broadcastSyncStatus("auth-required");
        return { synced: false, status: "auth-required" };
      }
      if (pushed.status === 503) {
        await broadcastSyncStatus("local");
        return { synced: false, status: "local" };
      }
      if (!pushed.ok) throw new Error("note-push-failed");
      const result = await pushed.json();
      const acknowledged = new Set(result.acknowledged || []);
      const submitted = new Map(pending.map((operation) => [operation.note?.id, JSON.stringify(operation)]));
      const latest = await chrome.storage.local.get([NOTES_KEY, NOTE_OPERATIONS_KEY]);
      notes = mergeStoredNotes(latest[NOTES_KEY] || notes, result.canonical || []);
      conflicts += Number(result.conflicts || 0);
      await chrome.storage.local.set({
        [NOTES_KEY]: notes,
        [NOTE_OPERATIONS_KEY]: (latest[NOTE_OPERATIONS_KEY] || []).filter((operation) => !acknowledged.has(operation.note?.id) || submitted.get(operation.note?.id) !== JSON.stringify(operation)),
      });
    }

    let cursor = String(stored[NOTE_CURSOR_KEY] || "0");
    for (let page = 0; page < 10; page += 1) {
      const pulled = await authenticatedNotesRequest(`/api/notes?cursor=${encodeURIComponent(cursor)}&limit=100`, token, { cache: "no-store" });
      if (pulled.status === 401) {
        await broadcastSyncStatus("auth-required");
        return { synced: false, status: "auth-required" };
      }
      if (pulled.status === 503) {
        await broadcastSyncStatus("local");
        return { synced: false, status: "local" };
      }
      if (!pulled.ok) throw new Error("note-pull-failed");
      const result = await pulled.json();
      const latest = await chrome.storage.local.get(NOTES_KEY);
      notes = mergeStoredNotes(latest[NOTES_KEY] || notes, (result.changes || []).map((change) => change.note));
      cursor = String(result.nextCursor || cursor);
      await chrome.storage.local.set({ [NOTES_KEY]: notes, [NOTE_CURSOR_KEY]: cursor });
      if (!result.hasMore) break;
    }
    const status = conflicts ? "conflict" : "synced";
    await broadcastSyncStatus(status);
    return { synced: true, status, conflicts };
  } catch {
    await broadcastSyncStatus("waiting");
    return { synced: false, status: "waiting" };
  }
}

async function connectExtension() {
  const challenge = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
  const created = await fetch(`${APP_ORIGIN}/api/auth/extension-connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge, deviceLabel: `Chrome · ${navigator.platform || "设备"}` }),
  });
  if (!created.ok) throw new Error("sync-unavailable");
  await chrome.tabs.create({ url: `${APP_ORIGIN}/?connectExtension=${encodeURIComponent(challenge)}` });
  await broadcastSyncStatus("connecting");

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await wait(2000);
    const response = await fetch(`${APP_ORIGIN}/api/auth/extension-connect?challenge=${encodeURIComponent(challenge)}`);
    if (response.status === 202) continue;
    if (!response.ok) throw new Error("connection-expired");
    const result = await response.json();
    if (!result.token) throw new Error("missing-token");
    await chrome.storage.local.set({
      [EXTENSION_TOKEN_KEY]: result.token,
      "starmate:sync:device-id": result.deviceId,
      "starmate:sync:enabled": true,
    });
    await syncExtensionNotes();
    return { connected: true };
  }
  throw new Error("connection-timeout");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "starmate-connect-github") {
    connectExtension()
      .then(sendResponse)
      .catch(async () => {
        await broadcastSyncStatus("error");
        sendResponse({ connected: false, error: "GitHub 连接失败或已过期。" });
      });
    return true;
  }
  if (message?.type === "starmate-note-changed") {
    chrome.alarms.create("starmate-note-sync-debounce", { delayInMinutes: 0.02 });
    sendResponse({ scheduled: true });
    return false;
  }
  if (message?.type === "starmate-sync-now") {
    syncExtensionNotes().then(sendResponse);
    return true;
  }
  if (message?.type === "starmate-sync-state") {
    chrome.storage.local.get(SYNC_STATE_KEY).then((result) => sendResponse(result[SYNC_STATE_KEY] || { status: "local" }));
    return true;
  }
  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "starmate-note-sync-retry" || alarm.name === "starmate-note-sync-debounce") syncExtensionNotes();
});

chrome.alarms.get("starmate-note-sync-retry").then((alarm) => {
  if (!alarm) chrome.alarms.create("starmate-note-sync-retry", { periodInMinutes: 5 });
});
