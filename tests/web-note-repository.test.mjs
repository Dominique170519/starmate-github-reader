import test from "node:test";
import assert from "node:assert/strict";
import { createNoteCard } from "../lib/notebook.mjs";
import { createWebNoteRepository } from "../lib/web-note-repository.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] || null; },
    get length() { return values.size; },
    dump() { return Object.fromEntries(values); },
  };
}

const NOW = "2026-07-22T10:00:00.000Z";

function note(overrides = {}) {
  return createNoteCard({
    id: "note-1",
    repositoryId: "acme/source",
    documentId: "README.md",
    body: "自己的理解",
    ...overrides,
  }, overrides.updatedAt || NOW);
}

test("saves locally and queues the same card for synchronization", () => {
  const storage = memoryStorage();
  const repository = createWebNoteRepository(storage);
  repository.save(note());

  assert.equal(repository.list().length, 1);
  assert.equal(repository.pendingBatch().length, 1);
  assert.equal(repository.pendingBatch()[0].kind, "upsert");
});

test("soft-deletes a card and keeps its tombstone in the queue", () => {
  const storage = memoryStorage();
  const repository = createWebNoteRepository(storage);
  repository.save(note());
  const deleted = repository.remove("note-1", "2026-07-22T11:00:00.000Z");

  assert.equal(repository.list().length, 0);
  assert.equal(repository.list({ includeDeleted: true })[0].deletedAt, "2026-07-22T11:00:00.000Z");
  assert.equal(repository.pendingBatch()[0].kind, "delete");
  assert.equal(deleted.version, 2);
});

test("applies remote cards and preserves a conflicting version", () => {
  const storage = memoryStorage();
  const repository = createWebNoteRepository(storage);
  repository.save(note({ body: "电脑理解", version: 2, updatedAt: "2026-07-22T12:00:00.000Z" }));
  const result = repository.applyRemoteBatch([
    note({ body: "手机理解", version: 2, updatedAt: "2026-07-22T11:30:00.000Z" }),
  ]);

  assert.equal(result.conflicts, 1);
  assert.equal(repository.list()[0].body, "电脑理解");
  assert.equal(repository.history("note-1")[0].body, "手机理解");
});

test("migrates old text only after the new card is readable", () => {
  const oldKey = "starmate-note-acme/source";
  const storage = memoryStorage({ [oldKey]: "旧内容" });
  const repository = createWebNoteRepository(storage);
  const migrated = repository.migrateLegacyKeys([{ key: oldKey, repositoryId: "acme/source", documentId: "README.md" }], NOW);

  assert.equal(migrated.length, 1);
  assert.equal(repository.list()[0].title, "历史笔记");
  assert.equal(storage.getItem(oldKey), "旧内容");
  assert.equal(storage.getItem("starmate-note-migration:v1"), "complete");
});
