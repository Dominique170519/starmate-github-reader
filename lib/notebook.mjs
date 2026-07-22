export const NOTE_TYPES = [
  "freeform",
  "quote",
  "understanding",
  "question",
  "term",
  "mentor-answer",
  "review",
];

const MAX_TITLE = 120;
const MAX_BODY = 20_000;
const MAX_QUOTE = 8_000;
const MAX_TAGS = 20;
const MAX_BATCH = 100;

function uniqueId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

function normalizeTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean))].slice(0, MAX_TAGS);
}

export function createNoteCard(input, now = new Date().toISOString()) {
  if (!input?.repositoryId || !input?.documentId) {
    throw new TypeError("repositoryId and documentId are required");
  }
  const type = NOTE_TYPES.includes(input.type) ? input.type : "freeform";
  return {
    id: String(input.id || uniqueId()),
    repositoryId: String(input.repositoryId),
    documentId: String(input.documentId),
    sectionId: String(input.sectionId || ""),
    sourceUrl: String(input.sourceUrl || ""),
    anchor: String(input.anchor || ""),
    type,
    title: String(input.title || "").slice(0, MAX_TITLE),
    body: String(input.body || "").slice(0, MAX_BODY),
    quote: String(input.quote || "").slice(0, MAX_QUOTE),
    tags: normalizeTags(input.tags),
    pinned: Boolean(input.pinned),
    resolved: Boolean(input.resolved),
    reviewNeeded: Boolean(input.reviewNeeded),
    createdAt: String(input.createdAt || now),
    updatedAt: String(input.updatedAt || now),
    version: Math.max(1, Number(input.version || 1)),
    deletedAt: input.deletedAt ? String(input.deletedAt) : null,
  };
}

export function migrateLegacyNote(input, now = new Date().toISOString()) {
  const body = String(input?.body || "").trim();
  if (!body) return null;
  const legacyKey = String(input.key || `${input.repositoryId}:${input.documentId}`)
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .slice(0, 100);
  return createNoteCard({
    id: `legacy-${legacyKey}`,
    repositoryId: input.repositoryId,
    documentId: input.documentId,
    type: "freeform",
    title: "历史笔记",
    body,
    tags: ["旧笔记"],
  }, now);
}

function sameNote(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeNoteVersions(local, remote) {
  if (!local) return { current: remote, history: [], conflicted: false };
  if (!remote) return { current: local, history: [], conflicted: false };
  if (local.id !== remote.id) throw new TypeError("Cannot merge notes with different ids");
  if (sameNote(local, remote)) return { current: local, history: [], conflicted: false };
  if (local.version !== remote.version) {
    return {
      current: local.version > remote.version ? local : remote,
      history: [],
      conflicted: false,
    };
  }
  const localIsNewer = String(local.updatedAt) >= String(remote.updatedAt);
  return {
    current: localIsNewer ? local : remote,
    history: [localIsNewer ? remote : local],
    conflicted: true,
  };
}

export function matchesNoteFilters(note, filters = {}) {
  if (!filters.includeDeleted && note.deletedAt) return false;
  if (filters.repositoryId && note.repositoryId !== filters.repositoryId) return false;
  if (filters.documentId && note.documentId !== filters.documentId) return false;
  if (filters.type && note.type !== filters.type) return false;
  if (filters.tag && !(note.tags || []).includes(filters.tag)) return false;
  if (typeof filters.reviewNeeded === "boolean" && note.reviewNeeded !== filters.reviewNeeded) return false;
  if (filters.query) {
    const haystack = [note.title, note.body, note.quote, ...(note.tags || [])].join("\n").toLowerCase();
    if (!haystack.includes(String(filters.query).trim().toLowerCase())) return false;
  }
  return true;
}

function validOperation(operation) {
  return operation &&
    (operation.kind === "upsert" || operation.kind === "delete") &&
    operation.note &&
    typeof operation.note.id === "string" &&
    typeof operation.note.repositoryId === "string" &&
    typeof operation.note.documentId === "string" &&
    NOTE_TYPES.includes(operation.note.type) &&
    typeof operation.note.version === "number";
}

export function serializeNoteBatch(operations) {
  if (!Array.isArray(operations)) throw new TypeError("operations must be an array");
  const batch = operations.slice(0, MAX_BATCH);
  if (!batch.every(validOperation)) throw new TypeError("Invalid note operation");
  return batch.map((operation) => ({ kind: operation.kind, note: { ...operation.note } }));
}
