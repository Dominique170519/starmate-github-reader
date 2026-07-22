import test from "node:test";
import assert from "node:assert/strict";
import {
  createNoteCard,
  matchesNoteFilters,
  mergeNoteVersions,
  migrateLegacyNote,
  serializeNoteBatch,
} from "../lib/notebook.mjs";

const NOW = "2026-07-22T09:00:00.000Z";

function makeNote(overrides = {}) {
  return createNoteCard({
    id: "note-1",
    repositoryId: "acme/source",
    documentId: "README.md",
    body: "Agent 会先调用工具",
    tags: ["Agent"],
    ...overrides,
  }, overrides.updatedAt || NOW);
}

test("creates a freeform card without requiring selected text", () => {
  const note = createNoteCard({
    id: "note-freeform",
    repositoryId: "acme/source",
    documentId: "README.md",
    body: "这是我自己的理解",
  }, NOW);

  assert.equal(note.type, "freeform");
  assert.equal(note.quote, "");
  assert.equal(note.version, 1);
  assert.equal(note.updatedAt, NOW);
});

test("normalizes tags and limits untrusted note fields", () => {
  const note = createNoteCard({
    id: "note-limits",
    repositoryId: "acme/source",
    documentId: "README.md",
    type: "not-real",
    title: "x".repeat(140),
    body: "b".repeat(20050),
    tags: [" Agent ", "Agent", "工具"],
  }, NOW);

  assert.equal(note.type, "freeform");
  assert.equal(note.title.length, 120);
  assert.equal(note.body.length, 20000);
  assert.deepEqual(note.tags, ["Agent", "工具"]);
});

test("migrates a legacy textarea into one recoverable history card", () => {
  const note = migrateLegacyNote({
    key: "starmate-note-acme/source",
    body: "旧笔记内容",
    repositoryId: "acme/source",
    documentId: "README.md",
  }, NOW);

  assert.equal(note.title, "历史笔记");
  assert.equal(note.body, "旧笔记内容");
  assert.equal(note.type, "freeform");
  assert.equal(migrateLegacyNote({ key: "empty", body: "   ", repositoryId: "a", documentId: "b" }, NOW), null);
});

test("keeps the newer card and preserves a conflicting version", () => {
  const local = makeNote({ body: "本地理解", version: 2, updatedAt: "2026-07-22T10:00:00.000Z" });
  const remote = makeNote({ body: "手机理解", version: 2, updatedAt: "2026-07-22T09:30:00.000Z" });
  const result = mergeNoteVersions(local, remote);

  assert.equal(result.current.body, "本地理解");
  assert.equal(result.history[0].body, "手机理解");
  assert.equal(result.conflicted, true);
});

test("treats an identical retry as no conflict", () => {
  const note = makeNote({ version: 2 });
  const result = mergeNoteVersions(note, { ...note });
  assert.equal(result.current.body, note.body);
  assert.deepEqual(result.history, []);
  assert.equal(result.conflicted, false);
});

test("filters cards by article, tag, type, review state, and text", () => {
  const note = makeNote({ type: "question", reviewNeeded: true, quote: "Tool Result 回到上下文" });
  assert.equal(matchesNoteFilters(note, { repositoryId: "acme/source", documentId: "README.md" }), true);
  assert.equal(matchesNoteFilters(note, { tag: "Agent", type: "question", reviewNeeded: true }), true);
  assert.equal(matchesNoteFilters(note, { query: "tool result" }), true);
  assert.equal(matchesNoteFilters(note, { tag: "上下文" }), false);
});

test("serializes at most one hundred valid operations", () => {
  const operations = Array.from({ length: 105 }, (_, index) => ({
    kind: "upsert",
    note: makeNote({ id: `note-${index}` }),
  }));
  assert.equal(serializeNoteBatch(operations).length, 100);
  assert.throws(() => serializeNoteBatch([{ kind: "upsert", note: { id: "broken" } }]));
});
