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
