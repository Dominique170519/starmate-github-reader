export type KnowledgeGraphNode = {
  id: string;
  type: "project" | "document" | "section" | "concept";
  label: string;
  plain?: string;
  sourcePath?: string;
  url?: string;
};

export type KnowledgeGraphEdge = {
  from: string;
  to: string;
  type: "contains" | "explains" | "shared-concept";
  conceptId?: string;
  evidence: { url: string; relatedUrl?: string; excerpt?: string };
};

export type KnowledgeGraph = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  changes: Array<Record<string, unknown>>;
};

export function normalizeGraphConcept(value?: string): string;
export function buildKnowledgeGraph(packages?: unknown[]): KnowledgeGraph;
