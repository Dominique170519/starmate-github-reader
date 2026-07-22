const DEFAULT_DEBOUNCE = 800;
const DEFAULT_MAX_PULL_PAGES = 10;

function body(response) {
  return response.json().catch(() => ({}));
}

export function createWebNoteSyncController({
  repository,
  request = globalThis.fetch?.bind(globalThis),
  onStatus = () => {},
  setTimer = globalThis.setTimeout?.bind(globalThis),
  clearTimer = globalThis.clearTimeout?.bind(globalThis),
  debounceMs = DEFAULT_DEBOUNCE,
  maxPullPages = DEFAULT_MAX_PULL_PAGES,
} = {}) {
  if (!repository || !request) throw new TypeError("repository and request are required");
  let timer = null;
  let running = null;
  let state = {
    status: "local",
    conflicts: 0,
    lastSyncedAt: null,
    localOnly: false,
    user: null,
  };

  function publish(patch) {
    state = { ...state, ...patch };
    onStatus({ ...state });
    return state;
  }

  function schedule() {
    if (timer !== null && clearTimer) clearTimer(timer);
    publish({ status: "waiting" });
    if (setTimer) timer = setTimer(() => {
      timer = null;
      syncNow();
    }, debounceMs);
  }

  function save(note) {
    const saved = repository.save(note);
    schedule();
    return saved;
  }

  function remove(noteId, now) {
    const removed = repository.remove(noteId, now);
    if (removed) schedule();
    return removed;
  }

  function restoreVersion(noteId, index, now) {
    const restored = repository.restoreVersion(noteId, index, now);
    if (restored) schedule();
    return restored;
  }

  async function handleUnavailable(response) {
    if (response.status === 401) {
      publish({ status: "auth-required", user: null });
      return true;
    }
    if (response.status === 503) {
      publish({ status: "local", localOnly: true });
      return true;
    }
    return false;
  }

  async function performSync() {
    publish({ status: "syncing", conflicts: 0 });
    let conflicts = 0;
    const pending = repository.pendingBatch();
    if (pending.length) {
      const pushed = await request("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations: pending }),
      });
      if (await handleUnavailable(pushed)) return state;
      if (!pushed.ok) throw new Error("note-push-failed");
      const result = await body(pushed);
      repository.applyRemoteBatch(result.canonical || []);
      repository.acknowledge(result.acknowledged || [], pending);
      conflicts += Number(result.conflicts || 0);
    }

    for (let page = 0; page < maxPullPages; page += 1) {
      const pulled = await request(`/api/notes?cursor=${encodeURIComponent(repository.cursor())}&limit=100`, {
        cache: "no-store",
      });
      if (await handleUnavailable(pulled)) return state;
      if (!pulled.ok) throw new Error("note-pull-failed");
      const result = await body(pulled);
      const applied = repository.applyRemoteBatch((result.changes || []).map((change) => change.note));
      conflicts += Number(applied.conflicts || 0);
      repository.setCursor(result.nextCursor || repository.cursor());
      if (!result.hasMore) break;
    }

    return publish({
      status: conflicts ? "conflict" : "synced",
      conflicts,
      localOnly: false,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  async function syncNow() {
    if (running) return running;
    running = performSync().catch(() => publish({ status: "waiting" })).finally(() => { running = null; });
    return running;
  }

  async function refreshSession() {
    try {
      const response = await request("/api/auth/session", { cache: "no-store" });
      const session = await body(response);
      if (session.localOnly) return publish({ status: "local", localOnly: true, user: null });
      if (!session.authenticated) return publish({ status: "auth-required", localOnly: false, user: null });
      publish({ user: session.user || null, localOnly: false });
      return syncNow();
    } catch {
      return publish({ status: repository.pendingBatch().length ? "waiting" : "local" });
    }
  }

  function dispose() {
    if (timer !== null && clearTimer) clearTimer(timer);
    timer = null;
  }

  return {
    save,
    remove,
    restoreVersion,
    schedule,
    syncNow,
    refreshSession,
    snapshot: () => ({ ...state }),
    dispose,
  };
}
