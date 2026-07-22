import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createNoteCard } from "../lib/notebook.mjs";
import { decideServerMerge, normalizeSyncOperation } from "../lib/note-sync.mjs";

const EARLY = "2026-07-22T09:00:00.000Z";
const LATE = "2026-07-22T10:00:00.000Z";

function note(overrides = {}) {
  return createNoteCard({
    id: "note-1",
    repositoryId: "acme/source",
    documentId: "README.md",
    body: "第一版",
    ...overrides,
  }, overrides.updatedAt || EARLY);
}

test("inserts a new note and keeps no artificial history", () => {
  const incoming = note();
  const decision = decideServerMerge(null, incoming);
  assert.equal(decision.action, "insert");
  assert.equal(decision.current.id, incoming.id);
  assert.deepEqual(decision.history, []);
});

test("accepts a higher version and preserves the previous version", () => {
  const current = note({ version: 1 });
  const incoming = note({ version: 2, body: "第二版", updatedAt: LATE });
  const decision = decideServerMerge(current, incoming);
  assert.equal(decision.action, "update");
  assert.equal(decision.current.body, "第二版");
  assert.equal(decision.history[0].body, "第一版");
});

test("treats an identical same-version retry as idempotent", () => {
  const current = note({ version: 2 });
  const decision = decideServerMerge(current, { ...current });
  assert.equal(decision.action, "noop");
  assert.deepEqual(decision.history, []);
});

test("retains the losing body when two devices edit the same version", () => {
  const current = note({ version: 2, body: "电脑版本", updatedAt: EARLY });
  const incoming = note({ version: 2, body: "手机版本", updatedAt: LATE });
  const decision = decideServerMerge(current, incoming);
  assert.equal(decision.action, "update");
  assert.equal(decision.conflicted, true);
  assert.equal(decision.current.body, "手机版本");
  assert.equal(decision.current.version, 3);
  assert.equal(decision.history[0].body, "电脑版本");
});

test("propagates a tombstone without trusting a submitted user id", () => {
  const deleted = note({ version: 2, deletedAt: LATE, updatedAt: LATE });
  const operation = normalizeSyncOperation({ kind: "delete", note: { ...deleted, userId: "another-user" } });
  assert.equal(operation.note.deletedAt, LATE);
  assert.equal("userId" in operation.note, false);
});

test("exposes authenticated cursor pull, push, restore, and cloud deletion", async () => {
  const [route, server] = await Promise.all([
    readFile("app/api/notes/route.ts", "utf8"),
    readFile("lib/note-sync-server.ts", "utf8"),
  ]);
  assert.match(route, /resolveSyncIdentity/);
  assert.match(route, /cursor/);
  assert.match(server, /nextCursor/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /DELETE MY CLOUD NOTES/);
  assert.doesNotMatch(route, /body\.userId/);
  assert.match(server, /noteVersions/);
  assert.match(server, /syncChanges/);
  assert.match(server, /transaction/);
});
