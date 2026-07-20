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
