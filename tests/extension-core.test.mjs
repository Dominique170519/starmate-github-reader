import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadCore() {
  const source = await readFile(new URL("../extension/core.js", import.meta.url), "utf8");
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  return sandbox.StarMateCore;
}

async function loadExtensionStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const sandbox = {
    chrome: {
      storage: {
        local: {
          async get(key) {
            if (key === null) return Object.fromEntries(values);
            if (typeof key === "string") return values.has(key) ? { [key]: values.get(key) } : {};
            return {};
          },
          async set(entries) {
            Object.entries(entries).forEach(([key, value]) => values.set(key, value));
          },
        },
      },
    },
  };
  sandbox.globalThis = sandbox;
  for (const path of ["../extension/core.js", "../extension/storage.js"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    vm.runInNewContext(source, sandbox);
  }
  return { core: sandbox.StarMateCore, storage: sandbox.StarMateStorage, values };
}

test("finds only known first-occurrence terms", async () => {
  const core = await loadCore();
  const terms = core.findKnownTerms("Agent 使用 API 调用工具，API 返回 JSON。", 6);
  assert.deepEqual(Array.from(terms, (item) => item.term), ["Agent", "API", "JSON"]);
  assert.equal(terms[0].plain.length > 0, true);
});

test("diffs added changed and removed sections", async () => {
  const core = await loadCore();
  const diff = core.diffSnapshots(
    { sections: [{ id: "a", fingerprint: "1" }, { id: "b", fingerprint: "2" }] },
    { sections: [{ id: "a", fingerprint: "9" }, { id: "c", fingerprint: "3" }] },
  );
  assert.deepEqual(JSON.parse(JSON.stringify(diff)), {
    added: ["c"],
    changed: ["a"],
    removed: ["b"],
  });
});

test("builds an evidence-backed graph for one document", async () => {
  const core = await loadCore();
  const graph = core.buildDocumentGraph(
    {
      projectId: "o/r",
      documentId: "README",
      url: "https://example/README",
      sections: [{ id: "intro", title: "Intro", url: "https://example/#intro" }],
    },
    [{ term: "Agent", sectionId: "intro", excerpt: "Agent 调用工具" }],
  );
  assert.equal(graph.nodes.some((node) => node.type === "concept"), true);
  assert.equal(graph.edges.every((edge) => edge.evidence?.url), true);
});

test("clamps progress and estimates remaining minutes", async () => {
  const core = await loadCore();
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.calculateProgress({
      scrollTop: 50,
      articleTop: 100,
      articleHeight: 2000,
      viewportHeight: 800,
      remainingCharacters: 700,
    }))),
    { percent: 0, remainingMinutes: 2 },
  );
  assert.equal(core.calculateProgress({
    scrollTop: 5000,
    articleTop: 0,
    articleHeight: 1000,
    viewportHeight: 500,
    remainingCharacters: 0,
  }).percent, 100);
  assert.equal(core.calculateProgress({
    scrollTop: 0,
    articleTop: 0,
    articleHeight: 1000,
    viewportHeight: 500,
    remainingCharacters: 0,
  }).remainingMinutes, 0);
});

test("limits annotations and refuses unknown explanations", async () => {
  const core = await loadCore();
  const found = core.findKnownTerms("Agent API JSON Context Prompt Token RAG MCP", 6);
  assert.equal(found.length, 6);
  assert.equal(core.explainTerm("quantum-wombat"), null);
  assert.equal(core.explainTerm("APIs").term, "API");
});

test("creates extension note cards without requiring a quote", async () => {
  const core = await loadCore();
  const note = core.createNoteCard({
    id: "note-1",
    repositoryId: "acme/source",
    documentId: "README.md",
    body: "自己的理解",
  }, "2026-07-22T10:00:00.000Z");
  assert.equal(note.type, "freeform");
  assert.equal(note.quote, "");
  assert.equal(note.version, 1);
});

test("migrates old extension text only after storing a card", async () => {
  const prefix = "starmate:reader:";
  const { storage, values } = await loadExtensionStorage({ [`${prefix}note:doc-1`]: "旧插件笔记" });
  const migrated = await storage.migrateLegacyNote("doc-1", {
    repositoryId: "acme/source",
    sourceUrl: "https://github.com/acme/source",
  });

  assert.equal(migrated.title, "历史笔记");
  assert.equal((await storage.listNotes({ documentId: "doc-1" })).length, 1);
  assert.equal(values.get(`${prefix}note:doc-1`), "旧插件笔记");
  assert.equal(values.get(`${prefix}note-migration:doc-1`), "complete");
});

test("soft-deletes extension notes and keeps one pending operation", async () => {
  const { core, storage } = await loadExtensionStorage();
  const note = core.createNoteCard({
    id: "note-delete",
    repositoryId: "acme/source",
    documentId: "doc-1",
    body: "稍后删除",
  }, "2026-07-22T10:00:00.000Z");
  await storage.saveNote(note);
  await storage.removeNote(note.id, "2026-07-22T11:00:00.000Z");

  assert.equal((await storage.listNotes()).length, 0);
  assert.equal((await storage.listNotes({ includeDeleted: true }))[0].version, 2);
  assert.equal((await storage.pendingNoteBatch())[0].kind, "delete");
});

test("uses commit and document as a stable update id", async () => {
  const core = await loadCore();
  assert.equal(
    core.updateEventId("o/r:README", "abc123"),
    core.updateEventId("o/r:README", "abc123"),
  );
  assert.notEqual(
    core.updateEventId("o/r:README", "abc123"),
    core.updateEventId("o/r:README", "def456"),
  );
});

test("keeps one concept node when two documents share an alias", async () => {
  const core = await loadCore();
  const merged = core.mergeGraphs(
    { nodes: [{ id: "concept:api", type: "concept", label: "API" }], edges: [] },
    {
      nodes: [{ id: "concept:api", type: "concept", label: "APIs" }],
      edges: [{
        from: "document:b",
        to: "concept:api",
        type: "explains",
        evidence: { url: "https://b" },
      }],
    },
  );
  assert.equal(merged.nodes.filter((node) => node.id === "concept:api").length, 1);
  assert.equal(merged.edges.length, 1);
});

test("archives removed sections while preserving unaffected graph nodes", async () => {
  const core = await loadCore();
  const stableNode = { id: "concept:api", type: "concept", label: "API" };
  const graph = {
    nodes: [
      stableNode,
      { id: "section:o/r:README:old", type: "section", label: "Old" },
    ],
    edges: [],
  };
  const updated = core.applyGraphDiff(
    graph,
    {
      projectId: "o/r",
      documentId: "o/r:README",
      url: "https://example",
      sections: [],
    },
    { added: [], changed: [], removed: ["old"] },
    [],
  );
  assert.equal(updated.nodes.find((node) => node.id.endsWith(":old")).archived, true);
  assert.equal(updated.nodes.find((node) => node.id === "concept:api"), stableNode);
});

test("links two documents through a shared concept with evidence", async () => {
  const core = await loadCore();
  const graph = core.linkSharedConcepts({
    nodes: [
      { id: "document:a", type: "document", label: "a" },
      { id: "document:b", type: "document", label: "b" },
      { id: "section:a:intro", type: "section", label: "Intro" },
      { id: "section:b:intro", type: "section", label: "Intro" },
      { id: "concept:api", type: "concept", label: "API" },
    ],
    edges: [
      { from: "document:a", to: "section:a:intro", type: "contains", evidence: { url: "https://a" } },
      { from: "document:b", to: "section:b:intro", type: "contains", evidence: { url: "https://b" } },
      { from: "section:a:intro", to: "concept:api", type: "explains", evidence: { url: "https://a" } },
      { from: "section:b:intro", to: "concept:api", type: "explains", evidence: { url: "https://b" } },
    ],
  });
  const shared = graph.edges.find((edge) => edge.type === "shared-concept");
  assert.equal(Boolean(shared), true);
  assert.equal(Boolean(shared.evidence.url), true);
});
