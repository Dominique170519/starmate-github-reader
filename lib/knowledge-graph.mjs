const conceptAliases = Object.freeze({
  agents: "agent",
  apis: "api",
  prompts: "prompt",
  tokens: "token",
  "tool calls": "tool call",
  embeddings: "embedding",
  workflows: "workflow",
  models: "model",
  frameworks: "framework",
  dependencies: "dependency",
  repositories: "repository",
  branches: "branch",
  commits: "commit",
  endpoints: "endpoint",
  sdks: "sdk",
  caches: "cache",
});

export function normalizeGraphConcept(value = "") {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
  return conceptAliases[normalized] || normalized;
}

function pathId(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}

function sourceUrl(learningPackage, sourcePath = "README.md", sectionId = "") {
  const encodedPath = sourcePath.split("/").map(encodeURIComponent).join("/");
  const base = `${learningPackage.url}/blob/${learningPackage.sourceSha}/${encodedPath}`;
  return sectionId ? `${base}#${encodeURIComponent(sectionId)}` : base;
}

export function buildKnowledgeGraph(packages = []) {
  if (!packages.length) return { nodes: [], edges: [], changes: [] };
  const nodes = new Map();
  const edges = [];
  const edgeKeys = new Set();
  const conceptAppearances = new Map();

  function addNode(node) {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  }

  function addEdge(edge) {
    const key = `${edge.from}|${edge.type}|${edge.to}|${edge.conceptId || ""}|${edge.evidence?.url || ""}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(edge);
  }

  for (const learningPackage of packages) {
    const projectId = `project:${learningPackage.id}`;
    addNode({
      id: projectId,
      type: "project",
      label: learningPackage.fullName,
      packageId: learningPackage.id,
    });

    const paths = new Set([
      ...(learningPackage.sections || []).map((section) => section.sourcePath || "README.md"),
      ...(learningPackage.concepts || []).map((concept) => concept.sourcePath || "README.md"),
    ]);
    if (!paths.size) paths.add("README.md");
    const documentByPath = new Map();
    for (const path of paths) {
      const documentId = `document:${learningPackage.id}:${pathId(path) || "readme"}`;
      documentByPath.set(path, documentId);
      const url = sourceUrl(learningPackage, path);
      addNode({
        id: documentId,
        type: "document",
        label: path,
        projectId,
        packageId: learningPackage.id,
        sourcePath: path,
        url,
      });
      addEdge({ from: projectId, to: documentId, type: "contains", evidence: { url } });
    }

    for (const section of learningPackage.sections || []) {
      const path = section.sourcePath || "README.md";
      const documentId = documentByPath.get(path);
      const sectionId = `section:${learningPackage.id}:${section.id}`;
      const url = sourceUrl(learningPackage, path, section.id);
      addNode({
        id: sectionId,
        type: "section",
        label: section.title,
        documentId,
        packageId: learningPackage.id,
        sourcePath: path,
        excerpt: section.excerpt,
        url,
      });
      addEdge({ from: documentId, to: sectionId, type: "contains", evidence: { url } });
    }

    for (const concept of learningPackage.concepts || []) {
      const normalized = normalizeGraphConcept(concept.name);
      const conceptId = `concept:${normalized}`;
      const path = concept.sourcePath || "README.md";
      const section = (learningPackage.sections || []).find(
        (candidate) => candidate.sourcePath === path
          && `${candidate.title} ${candidate.excerpt} ${candidate.keyPoints?.join(" ") || ""}`
            .toLowerCase()
            .includes(normalized),
      ) || (learningPackage.sections || []).find((candidate) => candidate.sourcePath === path)
        || learningPackage.sections?.[0];
      const documentId = documentByPath.get(path) || documentByPath.values().next().value;
      const sectionId = section ? `section:${learningPackage.id}:${section.id}` : documentId;
      const url = sourceUrl(learningPackage, path, section?.id || "");
      addNode({ id: conceptId, type: "concept", label: concept.name, plain: concept.plain });
      addEdge({
        from: sectionId,
        to: conceptId,
        type: "explains",
        evidence: { url, excerpt: concept.evidence, sourcePath: path },
      });
      const appearances = conceptAppearances.get(conceptId) || [];
      if (!appearances.some((item) => item.documentId === documentId)) {
        appearances.push({ documentId, projectId, url, excerpt: concept.evidence });
      }
      conceptAppearances.set(conceptId, appearances);
    }
  }

  for (const [conceptId, appearances] of conceptAppearances) {
    for (let left = 0; left < appearances.length; left += 1) {
      for (let right = left + 1; right < appearances.length; right += 1) {
        if (appearances[left].projectId === appearances[right].projectId) continue;
        addEdge({
          from: appearances[left].documentId,
          to: appearances[right].documentId,
          type: "shared-concept",
          conceptId,
          evidence: {
            url: appearances[left].url,
            relatedUrl: appearances[right].url,
            excerpt: appearances[left].excerpt,
          },
        });
      }
    }
  }

  const changes = packages
    .filter((learningPackage) => learningPackage.changeSummary)
    .map((learningPackage) => ({
      packageId: learningPackage.id,
      fullName: learningPackage.fullName,
      sourceSha: learningPackage.sourceSha,
      sourceUpdatedAt: learningPackage.sourceUpdatedAt,
      ...learningPackage.changeSummary,
      evidence: { url: learningPackage.url },
    }));

  return { nodes: [...nodes.values()], edges, changes };
}
