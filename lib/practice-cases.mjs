const PRACTICE_SEGMENTS = new Set([
  "example",
  "examples",
  "demo",
  "demos",
  "showcase",
  "sample",
  "samples",
  "cookbook",
  "quickstart",
]);

function encodeGitHubPath(path) {
  return String(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function practiceRoot(path) {
  const parts = String(path).split("/").filter(Boolean);
  const markerIndex = parts.findIndex((part) => PRACTICE_SEGMENTS.has(part.toLowerCase()));
  if (markerIndex < 0) return "";
  const next = parts[markerIndex + 1];
  const end = next && !next.includes(".") ? markerIndex + 2 : markerIndex + 1;
  return parts.slice(0, end).join("/");
}

function preferredEntry(paths) {
  return [...paths].sort((left, right) => {
    const leftReadme = /(^|\/)readme(?:\.[^.]+)?$/i.test(left) ? 0 : 1;
    const rightReadme = /(^|\/)readme(?:\.[^.]+)?$/i.test(right) ? 0 : 1;
    return leftReadme - rightReadme || left.length - right.length || left.localeCompare(right);
  })[0];
}

export function extractOfficialCases(pkg) {
  const groups = new Map();
  for (const file of pkg?.files || []) {
    const root = practiceRoot(file?.path);
    if (!root) continue;
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(file.path);
  }

  return [...groups.entries()].map(([root, paths]) => {
    const title = root.split("/").at(-1) || "官方实践";
    return {
      id: `${pkg.id}:official:${root.toLowerCase()}`,
      sourceRepository: pkg.fullName,
      targetRepository: pkg.fullName,
      title,
      kind: "official",
      summary: `这是 ${pkg.fullName} 仓库中由作者提供的实践内容，可以先观察结果，再回到原文理解原理。`,
      recommendedEntry: preferredEntry(paths),
      estimatedMinutes: Math.min(30, Math.max(5, paths.length * 3)),
      verifiedAt: pkg.sourceUpdatedAt,
      evidence: {
        label: "查看官方实践",
        url: `${pkg.url}/tree/main/${encodeGitHubPath(root)}`,
      },
    };
  });
}

export function hasExplicitReference(markdown, target) {
  const value = String(markdown || "").toLowerCase();
  const fullName = String(target?.fullName || "").toLowerCase();
  const url = String(target?.url || "").replace(/\/$/, "").toLowerCase();
  return Boolean(
    (fullName && value.includes(fullName)) ||
      (url && value.includes(url)),
  );
}

export function normalizeExternalCase(candidate, target, readme, checkedAt = new Date().toISOString()) {
  if (!candidate?.full_name || !candidate?.html_url) return null;
  if (!hasExplicitReference(readme, target)) return null;

  return {
    id: `${target.id}:reference:${candidate.full_name.toLowerCase()}`,
    sourceRepository: candidate.full_name,
    targetRepository: target.fullName,
    title: candidate.name || candidate.full_name,
    kind: "explicit-reference",
    summary:
      candidate.description ||
      `这个仓库的 README 明确引用了 ${target.fullName}。`,
    recommendedEntry: "README.md",
    estimatedMinutes: 15,
    verifiedAt: checkedAt,
    evidence: {
      label: "查看引用证据",
      url: `${String(candidate.html_url).replace(/\/$/, "")}#readme`,
    },
  };
}

export function buildReproductionTask(practiceCase) {
  if (!practiceCase?.id) throw new TypeError("practiceCase.id is required");
  return {
    id: `reproduce:${practiceCase.id}`,
    caseId: practiceCase.id,
    completed: [],
    steps: [
      `先打开“${practiceCase.title}”，只观察它产生的结果。`,
      `回到 ${practiceCase.targetRepository || practiceCase.sourceRepository}，找出支撑这个结果的一个原理。`,
      "记录一次自己的修改、疑问或理解。",
    ],
  };
}

export function parseRepositoryIdentity(value) {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(String(value || "").trim());
  if (!match || match[1] === "." || match[1] === ".." || match[2] === "." || match[2] === "..") return null;
  const owner = match[1];
  const repository = match[2].replace(/\.git$/i, "");
  if (!repository) return null;
  return {
    owner,
    repository,
    fullName: `${owner}/${repository}`,
    url: `https://github.com/${owner}/${repository}`,
  };
}

export function buildVerifiedCaseSearchQuery(fullName) {
  const parsed = parseRepositoryIdentity(fullName);
  if (!parsed) throw new TypeError("A valid owner/repository is required");
  return `"${parsed.fullName}" in:readme fork:false archived:false`;
}
