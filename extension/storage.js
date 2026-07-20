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

  async function getGraph() {
    return get("graph", { nodes: [], edges: [], documents: [] });
  }

  function removeDocument(graph, documentId) {
    const documentNodeId = `document:${documentId}`;
    const sectionPrefix = `section:${documentId}:`;
    const removed = new Set(
      (graph.nodes || [])
        .filter((node) => node.id === documentNodeId || node.id.startsWith(sectionPrefix))
        .map((node) => node.id),
    );
    const edges = (graph.edges || []).filter(
      (edge) => !removed.has(edge.from) && !removed.has(edge.to),
    );
    const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
    const nodes = (graph.nodes || []).filter(
      (node) => !removed.has(node.id) && (node.type !== "concept" || connected.has(node.id)),
    );
    return { ...graph, nodes, edges };
  }

  async function saveGraph(nextGraph, documentId, lastReadAt = Date.now()) {
    const previous = await getGraph();
    let documents = [
      ...(previous.documents || []).filter((item) => item.documentId !== documentId),
      { documentId, lastReadAt },
    ].sort((left, right) => right.lastReadAt - left.lastReadAt);
    let graph = { ...nextGraph, documents };
    for (const stale of documents.slice(50)) graph = removeDocument(graph, stale.documentId);
    documents = documents.slice(0, 50);

    const conceptIds = graph.nodes
      .filter((node) => node.type === "concept")
      .slice(500)
      .map((node) => node.id);
    if (conceptIds.length) {
      const removedConcepts = new Set(conceptIds);
      graph = {
        ...graph,
        nodes: graph.nodes.filter((node) => !removedConcepts.has(node.id)),
        edges: graph.edges.filter(
          (edge) => !removedConcepts.has(edge.from) && !removedConcepts.has(edge.to),
        ),
      };
    }
    return set("graph", { ...graph, documents });
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
    getGraph,
    saveGraph,
  };
})();
