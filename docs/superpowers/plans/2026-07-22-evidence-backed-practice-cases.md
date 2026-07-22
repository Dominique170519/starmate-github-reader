# Evidence-backed Practice Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth overview mode that recommends only official examples or external repositories with a verifiable reference to the current GitHub project.

**Architecture:** A pure ESM domain module owns case detection, evidence validation, and reproduction-task generation. A server route performs rate-limited GitHub search and README verification, while the page only renders normalized results and local task progress. Official cases remain usable when external search is empty or unavailable.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node test runner, GitHub REST API, browser localStorage

## Global Constraints

- Only `official` and `explicit-reference` evidence kinds are allowed.
- Similar language, topic, keyword, or description is never sufficient evidence.
- Every displayed case must include a source URL and `verifiedAt` timestamp.
- A missing or rate-limited external search must not remove verified official cases.
- No model API may invent or rewrite case facts.

---

### Task 1: Practice-case domain rules

**Files:**
- Create: `lib/practice-cases.mjs`
- Create: `lib/practice-cases.d.mts`
- Create: `tests/practice-cases.test.mjs`
- Create: `tests/fixtures/practice-packages.mjs`

**Interfaces:**
- Consumes: `RepositoryLearningPackage` fields `id`, `fullName`, `url`, `files`, `sections`, and `sourceUpdatedAt`.
- Produces: `extractOfficialCases(learningPackage)`, `hasExplicitReference(markdown, target)`, `buildReproductionTask(practiceCase)`, and the `PracticeCase` type.

- [ ] **Step 1: Write failing official-case and false-positive tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractOfficialCases, hasExplicitReference } from "../lib/practice-cases.mjs";
import { packageWithDemo, packageWithoutDemo } from "./fixtures/practice-packages.mjs";

test("extracts official demos with evidence", () => {
  const cases = extractOfficialCases(packageWithDemo);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].kind, "official");
  assert.match(cases[0].evidence.url, /tree\/main\/examples/);
});

test("does not treat ordinary tutorial prose as a practice case", () => {
  assert.deepEqual(extractOfficialCases(packageWithoutDemo), []);
});

test("requires a full repository identity for an external reference", () => {
  assert.equal(hasExplicitReference("Uses Windy3f3f3f3f/how-claude-code-works", packageWithDemo), true);
  assert.equal(hasExplicitReference("An agent loop works like this", packageWithDemo), false);
});
```

- [ ] **Step 2: Run the domain test and verify the missing-module failure**

Run: `node --test tests/practice-cases.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/practice-cases.mjs`.

- [ ] **Step 3: Implement the normalized case domain**

```js
const PRACTICE_SEGMENT = /(^|\/)(examples?|demos?|showcase|samples?|cookbook|quickstart)(\/|$)/i;

export function extractOfficialCases(pkg) {
  const groups = new Map();
  for (const file of pkg.files || []) {
    if (!PRACTICE_SEGMENT.test(file.path)) continue;
    const root = file.path.split("/").slice(0, 2).join("/");
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(file.path);
  }
  return [...groups.entries()].map(([root, paths]) => ({
    id: `${pkg.id}:official:${root.toLowerCase()}`,
    sourceRepository: pkg.fullName,
    title: root.split("/").at(-1),
    kind: "official",
    summary: `这是 ${pkg.fullName} 仓库中由作者提供的实践内容。`,
    recommendedEntry: paths.sort((a, b) => a.length - b.length)[0],
    estimatedMinutes: Math.min(30, Math.max(5, paths.length * 3)),
    verifiedAt: pkg.sourceUpdatedAt,
    evidence: { label: "查看官方实践", url: `${pkg.url}/tree/main/${root}` },
  }));
}

export function hasExplicitReference(markdown, target) {
  const value = String(markdown || "").toLowerCase();
  return value.includes(target.fullName.toLowerCase()) || value.includes(target.url.toLowerCase());
}

export function buildReproductionTask(practiceCase) {
  return {
    id: `reproduce:${practiceCase.id}`,
    caseId: practiceCase.id,
    completed: [],
    steps: [
      `先打开“${practiceCase.title}”，只观察它产生的结果。`,
      `回到 ${practiceCase.sourceRepository}，找出支撑这个结果的一个原理。`,
      "记录一次自己的修改、疑问或理解。",
    ],
  };
}
```

- [ ] **Step 4: Add matching declarations and fixtures, then rerun tests**

Run: `node --test tests/practice-cases.test.mjs`

Expected: PASS for all practice-case domain tests.

- [ ] **Step 5: Commit the domain module**

```bash
git add lib/practice-cases.mjs lib/practice-cases.d.mts tests/practice-cases.test.mjs tests/fixtures/practice-packages.mjs
git commit -m "Add evidence-backed practice case rules"
```

### Task 2: Verified GitHub case search API

**Files:**
- Create: `app/api/practice-cases/route.ts`
- Modify: `lib/practice-cases.mjs`
- Modify: `lib/practice-cases.d.mts`
- Modify: `tests/practice-cases.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `GET /api/practice-cases?repository=owner/name` and optional server-side `GITHUB_TOKEN`.
- Produces: `{ cases: PracticeCase[], status: "verified" | "empty" | "limited", checkedAt: string }`.

- [ ] **Step 1: Add failing validation and response-contract tests**

```js
test("normalizes only repositories whose README explicitly references the target", () => {
  const result = normalizeExternalCase(candidate, target, "See https://github.com/acme/source");
  assert.equal(result.kind, "explicit-reference");
  assert.equal(normalizeExternalCase(candidate, target, "Same topic, no citation"), null);
});
```

Add source assertions to `tests/rendered-html.test.mjs` for `export async function GET`, `GITHUB_TOKEN`, status `limited`, and a target repository parser restricted to two GitHub path segments.

- [ ] **Step 2: Run tests and confirm the new export is missing**

Run: `node --test tests/practice-cases.test.mjs tests/rendered-html.test.mjs`

Expected: FAIL because `normalizeExternalCase` and the API route do not exist.

- [ ] **Step 3: Implement external normalization in the domain module**

```js
export function normalizeExternalCase(candidate, target, readme, checkedAt = new Date().toISOString()) {
  if (!hasExplicitReference(readme, target)) return null;
  return {
    id: `${target.id}:reference:${candidate.full_name.toLowerCase()}`,
    sourceRepository: candidate.full_name,
    title: candidate.name,
    kind: "explicit-reference",
    summary: candidate.description || `这个仓库的 README 明确引用了 ${target.fullName}。`,
    recommendedEntry: "README.md",
    estimatedMinutes: 15,
    verifiedAt: checkedAt,
    evidence: { label: "查看引用证据", url: `${candidate.html_url}#readme` },
  };
}
```

- [ ] **Step 4: Implement the rate-limited GET route**

The route must validate `owner/name`, search repositories with an exact quoted identity, exclude the source repository, fetch at most five candidate READMEs, run `normalizeExternalCase`, and map GitHub `403`/`429` to HTTP 200 with `status: "limited"`. Other upstream failures return HTTP 502 with a short Chinese error. Set `Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600` only on verified or empty responses.

```ts
const query = `"${target.fullName}" in:readme fork:false archived:false`;
const search = await githubJson<SearchResponse>(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=6`);
const checkedAt = new Date().toISOString();
const cases = (await Promise.all(search.items.filter(notSource).slice(0, 5).map(readAndVerify)))
  .filter((item): item is PracticeCase => Boolean(item));
return Response.json({ cases, status: cases.length ? "verified" : "empty", checkedAt });
```

- [ ] **Step 5: Run domain, source-contract, lint, and build checks**

Run: `node --test tests/practice-cases.test.mjs tests/rendered-html.test.mjs && npm run lint && VERCEL=1 npx next build`

Expected: all tests pass, lint exits 0, and Next build completes.

- [ ] **Step 6: Commit the verified search API**

```bash
git add app/api/practice-cases/route.ts lib/practice-cases.mjs lib/practice-cases.d.mts tests/practice-cases.test.mjs tests/rendered-html.test.mjs
git commit -m "Search for verified GitHub practice cases"
```

### Task 3: Practice-case overview mode

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `extractOfficialCases`, `/api/practice-cases`, `buildReproductionTask`, and saved learning packages.
- Produces: overview mode `cases`, repository-grouped cards, explicit empty/error states, and task launch actions.

- [ ] **Step 1: Add a failing rendered-source test for the fifth mode**

```js
test("renders evidence-backed practice cases without speculative recommendations", async () => {
  const page = await readFile("app/page.tsx", "utf8");
  assert.match(page, /实践案例/);
  assert.match(page, /暂无可信案例/);
  assert.match(page, /官方实践/);
  assert.match(page, /明确使用/);
  assert.doesNotMatch(page, /猜你喜欢/);
});
```

- [ ] **Step 2: Run the rendered-source test and verify it fails**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL because the cases mode copy does not exist.

- [ ] **Step 3: Add state and deterministic loading**

Extend `OverviewMode` with `"cases"`. Derive official cases synchronously with `useMemo`; store external results by package id. Fetch external results only after the user opens cases mode. An API failure updates that repository group to `error` without clearing its official cases.

```ts
type CaseLoadState = { status: "idle" | "loading" | "verified" | "empty" | "limited" | "error"; cases: PracticeCase[] };
const officialCases = useMemo(() => knowledgePackages.flatMap(extractOfficialCases), [knowledgePackages]);
```

- [ ] **Step 4: Render repository groups and evidence cards**

Add the fifth button after knowledge graph. Each card must show its evidence badge, summary, recommended entry, time, evidence anchor with `target="_blank" rel="noreferrer"`, and a “开始复刻” button. The group-level empty state says “暂无可信案例” and links to the repository plus a quoted GitHub search URL.

- [ ] **Step 5: Add responsive styling**

Use a two-column card grid above 900px and one column below it. Keep badges text-labeled rather than color-only. Ensure buttons have visible focus styles and cards do not horizontally overflow at 360px.

- [ ] **Step 6: Run rendered-source tests, lint, and build**

Run: `node --test tests/rendered-html.test.mjs && npm run lint && VERCEL=1 npx next build`

Expected: tests pass, lint exits 0, and the Vercel build succeeds.

- [ ] **Step 7: Commit the overview mode**

```bash
git add app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "Add verified practice cases overview"
```

### Task 4: In-app reproduction tasks and refresh behavior

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/practice-cases.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `buildReproductionTask(practiceCase)`.
- Produces: persisted `starmate-practice-tasks:v1` tasks and a three-step in-app task surface.

- [ ] **Step 1: Add failing persistence and task-shape tests**

Assert that generated tasks have exactly three non-empty steps and that page source reads and writes `starmate-practice-tasks:v1`.

- [ ] **Step 2: Run tests and confirm persistence is absent**

Run: `node --test tests/practice-cases.test.mjs tests/rendered-html.test.mjs`

Expected: FAIL on the localStorage contract assertion.

- [ ] **Step 3: Implement task launch, progress, and completion**

Opening a task shows a panel inside cases mode. Store only task id, case id, step completion booleans, and update timestamp. Toggling a step persists immediately. The third step offers “写一张笔记” and opens the current note surface without inventing a completion artifact.

- [ ] **Step 4: Invalidate cases after a package source update**

Key cached external state by `${package.id}:${package.sourceSha}`. When `sourceSha` changes, discard the old group result and require a new verification; official cases recalculate immediately from the new files.

- [ ] **Step 5: Run the focused and full test suite**

Run: `node --test tests/practice-cases.test.mjs tests/rendered-html.test.mjs && npm test`

Expected: focused tests pass and the full build-backed test suite passes.

- [ ] **Step 6: Commit reproduction tasks**

```bash
git add app/page.tsx app/globals.css tests/practice-cases.test.mjs tests/rendered-html.test.mjs
git commit -m "Add in-app practice reproduction tasks"
```

### Task 5: Documentation and release verification

**Files:**
- Modify: `README.md`
- Modify: `extension/README.md`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: completed practice-case feature.
- Produces: user-facing evidence policy and verified release artifacts.

- [ ] **Step 1: Add a failing documentation assertion**

Require README text that states only official examples and explicit references are shown, and that zero results are acceptable.

- [ ] **Step 2: Add concise product and privacy documentation**

Document the evidence labels, GitHub API rate-limit behavior, no-model rule, and why related projects are not presented as applications.

- [ ] **Step 3: Run all verification commands from a clean command invocation**

Run: `npm test`

Expected: build succeeds and every Node test passes.

Run: `npm run lint`

Expected: exit 0 with no errors.

Run: `VERCEL=1 npx next build`

Expected: production Next build succeeds.

Run: `git diff --check`

Expected: no output and exit 0.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md extension/README.md tests/rendered-html.test.mjs
git commit -m "Document verified practice case recommendations"
```
