import assert from "node:assert/strict";
import test from "node:test";
import { buildKnowledgeGraph } from "../lib/knowledge-graph.mjs";
import { onePackage, twoPackages } from "./fixtures/repository-packages.mjs";

test("one repository creates document section and concept edges", () => {
  const graph = buildKnowledgeGraph([onePackage]);
  assert.equal(graph.nodes.some((node) => node.type === "project"), true);
  assert.equal(graph.nodes.some((node) => node.type === "document"), true);
  assert.equal(graph.nodes.some((node) => node.type === "section"), true);
  assert.equal(graph.edges.some((edge) => edge.type === "explains"), true);
  assert.equal(graph.edges.every((edge) => Boolean(edge.evidence?.url)), true);
});

test("two repositories share normalized concepts", () => {
  const graph = buildKnowledgeGraph(twoPackages);
  assert.equal(graph.nodes.filter((node) => node.id === "concept:api").length, 1);
  assert.equal(graph.edges.some((edge) => edge.type === "shared-concept"), true);
});

test("returns an empty graph only for an empty package list", () => {
  assert.deepEqual(buildKnowledgeGraph([]), { nodes: [], edges: [], changes: [] });
  assert.equal(buildKnowledgeGraph([onePackage]).nodes.length > 0, true);
});

test("keeps author update history available to the graph timeline", () => {
  const graph = buildKnowledgeGraph([{
    ...onePackage,
    changeHistory: [{
      status: "updated",
      added: ["New chapter"],
      changed: [],
      removed: [],
      sourceSha: "next123",
      sourceUpdatedAt: "2026-07-20T12:00:00.000Z",
      checkedAt: "2026-07-20T13:00:00.000Z",
    }],
  }]);
  assert.equal(graph.changes.length, 1);
  assert.equal(graph.changes[0].added[0], "New chapter");
});
