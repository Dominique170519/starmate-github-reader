import { createNoteCard } from "./notebook.mjs";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function sameNote(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export function normalizeSyncOperation(operation) {
  if (!operation || !["upsert", "delete"].includes(operation.kind) || !operation.note) {
    throw new TypeError("Invalid note operation");
  }
  const input = { ...operation.note };
  delete input.userId;
  const updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString();
  const note = createNoteCard(input, updatedAt);
  if (operation.kind === "delete" && !note.deletedAt) throw new TypeError("Delete operation requires a tombstone");
  return { kind: note.deletedAt ? "delete" : "upsert", note };
}

export function decideServerMerge(current, incoming) {
  if (!current) return { action: "insert", current: incoming, history: [], conflicted: false };
  if (sameNote(current, incoming)) return { action: "noop", current, history: [], conflicted: false };
  if (incoming.version > current.version) {
    return { action: "update", current: incoming, history: [current], conflicted: false };
  }
  if (incoming.version < current.version) {
    return { action: "noop", current, history: [], conflicted: false };
  }

  const incomingWins = String(incoming.updatedAt) > String(current.updatedAt);
  const winner = incomingWins ? incoming : current;
  const loser = incomingWins ? current : incoming;
  return {
    action: "update",
    current: { ...winner, version: current.version + 1 },
    history: [loser],
    conflicted: true,
  };
}
