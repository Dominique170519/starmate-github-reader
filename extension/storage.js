(() => {
  const PREFIX = "starmate:reader:";

  async function get(key, fallback = null) {
    const storageKey = `${PREFIX}${key}`;
    const result = await chrome.storage.local.get(storageKey);
    return result[storageKey] ?? fallback;
  }

  async function set(key, value) {
    await chrome.storage.local.set({ [`${PREFIX}${key}`]: value });
    return value;
  }

  async function getDocumentState(documentId) {
    return get(`state:${documentId}`, {
      progress: 0,
      activeSeconds: 0,
      lastSectionId: "",
      completed: false,
      reviewTerms: [],
      seenTerms: [],
    });
  }

  async function saveDocumentState(documentId, patch) {
    const current = await getDocumentState(documentId);
    return set(`state:${documentId}`, { ...current, ...patch, updatedAt: Date.now() });
  }

  async function getSnapshot(documentId) {
    return get(`snapshot:${documentId}`, null);
  }

  async function saveSnapshot(snapshot) {
    return set(`snapshot:${snapshot.documentId}`, {
      ...snapshot,
      savedAt: Date.now(),
    });
  }

  async function listSavedSnapshots() {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all)
      .filter(([key]) => key.startsWith(`${PREFIX}snapshot:`))
      .map(([, value]) => value)
      .sort((left, right) => (right.lastReadAt || right.savedAt || 0) - (left.lastReadAt || left.savedAt || 0))
      .slice(0, 50);
  }

  async function listUpdateEvents(documentId) {
    const events = await get(`updates:${documentId}`, []);
    return [...events].sort((left, right) => right.checkedAt - left.checkedAt);
  }

  async function saveUpdateEvent(event) {
    const current = await listUpdateEvents(event.documentId);
    const next = [event, ...current.filter((item) => item.id !== event.id)].slice(0, 100);
    await set(`updates:${event.documentId}`, next);
    return event;
  }

  globalThis.StarMateStorage = {
    get,
    set,
    getDocumentState,
    saveDocumentState,
    getSnapshot,
    saveSnapshot,
    listSavedSnapshots,
    listUpdateEvents,
    saveUpdateEvent,
  };
})();
