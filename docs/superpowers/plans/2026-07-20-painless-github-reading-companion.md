# Painless GitHub Reading Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Chrome extension and Web App into a no-model reading companion with lightweight term explanations, progress tracking, Docsify support, author update history, and evidence-backed dynamic knowledge graphs.

**Architecture:** Split the extension into pure core rules, page adapters, storage/update services, and a UI controller while preserving the current no-build Manifest V3 packaging. The extension stores device-local reading state and shows a local document graph; the Web App continues to generate repository learning packages and derives the full graph from them. All graph edges and updates retain source evidence.

**Tech Stack:** Manifest V3, plain JavaScript content scripts, Chrome Storage/Alarms/Scripting APIs, React 19, Next.js 16, Vinext, TypeScript 5, Node test runner.

## Global Constraints

- Do not require a model API for basic reading, terminology, updates, or graph generation.
- Preserve the existing article map, source search, notes, and “add to StarMate” behaviors.
- Mark at most six terms per chapter and only the first occurrence of each term.
- Never create a term explanation or graph relation without a known rule or source evidence.
- Support `github.com` automatically; enable a GitHub Pages origin only after a user action grants that origin.
- Keep user notes, selected text, and reading history device-local unless a declared Web App sync action is used.
- A single document must generate a useful project—document—section—concept graph.
- All user-facing controls must work with keyboard and touch input.

---

## File Structure

- Create `extension/core.js`: pure terminology, progress, snapshot diff, and graph rules exposed as `globalThis.StarMateCore`.
- Create `extension/adapters.js`: GitHub and Docsify URL/content adapters exposed as `globalThis.StarMateAdapters`.
- Create `extension/storage.js`: promise-based Chrome storage facade and retention limits.
- Create `extension/background.js`: GitHub Pages permission/injection and daily stale-document checks.
- Modify `extension/content.js`: lifecycle controller and UI composition only.
- Modify `extension/styles.css`: progress bar, term card, reading detail, update, and mini-graph styles.
- Modify `extension/manifest.json`: ordered scripts, service worker, alarms/scripting permissions, and optional GitHub Pages origins.
- Modify `extension/README.md`: supported pages, privacy, and updated installation/usage.
- Create `tests/extension-core.test.mjs`: pure rule tests through a VM sandbox.
- Create `tests/extension-adapters.test.mjs`: GitHub and Docsify route mapping tests.
- Create `lib/knowledge-graph.mjs`: Web App graph derivation from repository packages.
- Modify `app/page.tsx`: star-to-package ingestion, single-document graph rendering, update-on-open, and update timeline.
- Modify `app/globals.css`: full graph and update timeline presentation.
- Modify `tests/rendered-html.test.mjs`: Web App integration assertions.
- Modify `tests/fixtures/repository-packages.mjs`: deterministic package fixtures for graph tests.
- Modify `public/starmate-chrome-extension.zip`: regenerated release archive.

---

### Task 1: Pure Extension Core and Test Harness

**Files:**
- Create: `extension/core.js`
- Create: `tests/extension-core.test.mjs`

**Interfaces:**
- Produces: `StarMateCore.findKnownTerms(text, limit)`, `calculateProgress(metrics)`, `fingerprint(text)`, `diffSnapshots(previous, next)`, `normalizeConcept(name)`, `buildDocumentGraph(snapshot, terms)`.
- Consumes: no browser APIs; all inputs are plain objects.

- [ ] **Step 1: Write the failing VM-based core tests**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadCore() {
  const source = await readFile(new URL("../extension/core.js", import.meta.url), "utf8");
  const context = vm.createContext({ globalThis: {} });
  vm.runInContext(source, context);
  return context.globalThis.StarMateCore;
}

test("finds only known first-occurrence terms", async () => {
  const core = await loadCore();
  const terms = core.findKnownTerms("Agent 使用 API 调用工具，API 返回 JSON。", 6);
  assert.deepEqual(Array.from(terms, item => item.term), ["Agent", "API", "JSON"]);
  assert.equal(terms[0].plain.length > 0, true);
});

test("diffs added changed and removed sections", async () => {
  const core = await loadCore();
  const diff = core.diffSnapshots(
    { sections: [{ id: "a", fingerprint: "1" }, { id: "b", fingerprint: "2" }] },
    { sections: [{ id: "a", fingerprint: "9" }, { id: "c", fingerprint: "3" }] },
  );
  assert.deepEqual(JSON.parse(JSON.stringify(diff)), { added: ["c"], changed: ["a"], removed: ["b"] });
});

test("builds an evidence-backed graph for one document", async () => {
  const core = await loadCore();
  const graph = core.buildDocumentGraph({ projectId: "o/r", documentId: "README", sections: [{ id: "intro", title: "Intro", url: "https://example/#intro" }] }, [{ term: "Agent", sectionId: "intro", excerpt: "Agent 调用工具" }]);
  assert.equal(graph.nodes.some(node => node.type === "concept"), true);
  assert.equal(graph.edges.every(edge => edge.evidence?.url), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/extension-core.test.mjs`

Expected: FAIL because `extension/core.js` does not exist.

- [ ] **Step 3: Implement the pure core API**

Create `extension/core.js` as an IIFE with a frozen glossary and deterministic rules:

```js
(() => {
  const glossary = Object.freeze({
    agent: { term: "Agent", plain: "能围绕目标反复观察并采取行动的程序。", analogy: "像拿着任务清单、会自己查资料和执行步骤的助理。", role: "作者用它指代可以自主完成多步任务的系统。" },
    api: { term: "API", plain: "两个程序按照约定交换信息的入口。", analogy: "像餐厅菜单，写清能点什么以及怎样下单。", role: "作者用它说明不同软件怎样互相调用。" },
    json: { term: "JSON", plain: "用固定文本格式表达结构化数据的方法。", analogy: "像字段名称统一的电子表格。", role: "作者用它展示程序传递的数据形状。" },
    context: { term: "Context", plain: "模型完成当前任务时能看到的信息。", analogy: "像考试时桌面上允许翻看的资料。", role: "作者用它说明模型依据哪些信息判断下一步。" },
    prompt: { term: "Prompt", plain: "交给模型的任务说明和背景信息。", analogy: "像给同事的一张任务卡。", role: "作者用它描述如何告诉模型要做什么。" },
    token: { term: "Token", plain: "模型读取文字时使用的小块计量单位。", analogy: "像把句子切成便于机器处理的小积木。", role: "作者用它计算输入输出长度和成本。" },
    rag: { term: "RAG", plain: "先查找相关资料，再让模型依据资料回答。", analogy: "像先翻书找到证据，再写答案。", role: "作者用它说明如何减少脱离资料的回答。" },
    mcp: { term: "MCP", plain: "让模型以统一方式连接外部工具和资料的协议。", analogy: "像不同电器都能使用的统一插座标准。", role: "作者用它说明工具怎样接入智能体。" },
  });

  function normalizeConcept(value = "") { return value.trim().toLowerCase().replace(/[\s_-]+/g, " ").replace(/s$/, ""); }
  function fingerprint(text = "") { let hash = 2166136261; for (const char of text) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); }
  function findKnownTerms(text = "", limit = 6) {
    const lower = text.toLowerCase();
    return Object.entries(glossary).filter(([key]) => new RegExp(`\\b${key}\\b`, "i").test(lower)).slice(0, limit).map(([, value]) => value);
  }
  function calculateProgress({ scrollTop, articleTop, articleHeight, viewportHeight, remainingCharacters }) {
    const readable = Math.max(1, articleHeight - viewportHeight);
    const percent = Math.max(0, Math.min(100, Math.round(((scrollTop - articleTop) / readable) * 100)));
    return { percent, remainingMinutes: Math.max(1, Math.ceil(Math.max(0, remainingCharacters) / 350)) };
  }
  function diffSnapshots(previous, next) {
    const oldMap = new Map((previous?.sections || []).map(section => [section.id, section]));
    const newMap = new Map((next?.sections || []).map(section => [section.id, section]));
    return {
      added: [...newMap.keys()].filter(id => !oldMap.has(id)),
      changed: [...newMap.keys()].filter(id => oldMap.has(id) && oldMap.get(id).fingerprint !== newMap.get(id).fingerprint),
      removed: [...oldMap.keys()].filter(id => !newMap.has(id)),
    };
  }
  function buildDocumentGraph(snapshot, terms) {
    const nodes = [{ id: `project:${snapshot.projectId}`, type: "project", label: snapshot.projectId }, { id: `document:${snapshot.documentId}`, type: "document", label: snapshot.documentId }];
    const edges = [{ from: nodes[0].id, to: nodes[1].id, type: "contains", evidence: { url: snapshot.sections[0]?.url || snapshot.url } }];
    for (const section of snapshot.sections) {
      const id = `section:${snapshot.documentId}:${section.id}`;
      nodes.push({ id, type: "section", label: section.title });
      edges.push({ from: `document:${snapshot.documentId}`, to: id, type: "contains", evidence: { url: section.url } });
    }
    for (const item of terms) {
      const conceptId = `concept:${normalizeConcept(item.term)}`;
      if (!nodes.some(node => node.id === conceptId)) nodes.push({ id: conceptId, type: "concept", label: item.term });
      edges.push({ from: `section:${snapshot.documentId}:${item.sectionId}`, to: conceptId, type: "explains", evidence: { url: snapshot.sections.find(section => section.id === item.sectionId)?.url, excerpt: item.excerpt } });
    }
    return { nodes, edges };
  }
  globalThis.StarMateCore = { glossary, normalizeConcept, fingerprint, findKnownTerms, calculateProgress, diffSnapshots, buildDocumentGraph };
})();
```

- [ ] **Step 4: Run the core tests**

Run: `node --test tests/extension-core.test.mjs`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/core.js tests/extension-core.test.mjs
git commit -m "Add reading companion core rules"
```

---

### Task 2: GitHub and Docsify Page Adapters

**Files:**
- Create: `extension/adapters.js`
- Create: `tests/extension-adapters.test.mjs`
- Modify: `extension/manifest.json`
- Create: `extension/background.js`

**Interfaces:**
- Consumes: `StarMateCore.fingerprint(text)`.
- Produces: `StarMateAdapters.fromLocation(locationLike)`, adapter method `read(documentLike)`, and `adapter.watch(onChange)`.

- [ ] **Step 1: Write failing route-mapping tests**

```js
test("maps a GitHub repository URL", async () => {
  const adapters = await loadAdapters();
  const adapter = adapters.fromLocation(new URL("https://github.com/openai/openai-node/blob/master/README.md"));
  assert.equal(adapter.kind, "github");
  assert.equal(adapter.projectId, "openai/openai-node");
});

test("maps the Datawhale Docsify hash to markdown", async () => {
  const adapters = await loadAdapters();
  const adapter = adapters.fromLocation(new URL("https://datawhalechina.github.io/hello-agents/#/./chapter15/%E7%AC%AC%E5%8D%81%E4%BA%94%E7%AB%A0%20%E6%9E%84%E5%BB%BA%E8%B5%9B%E5%8D%9A%E5%B0%8F%E9%95%87"));
  assert.equal(adapter.kind, "docsify");
  assert.equal(adapter.projectId, "datawhalechina/hello-agents");
  assert.match(adapter.documentPath, /^chapter15\/.+\.md$/);
});
```

- [ ] **Step 2: Run adapter tests and observe failure**

Run: `node --test tests/extension-adapters.test.mjs`

Expected: FAIL because `StarMateAdapters` is undefined.

- [ ] **Step 3: Implement URL mapping and DOM readers**

`extension/adapters.js` must expose exactly this factory shape:

```js
function fromLocation(locationLike) {
  const url = new URL(locationLike.href || String(locationLike));
  if (url.hostname === "github.com") return createGitHubAdapter(url);
  if (url.hostname.endsWith(".github.io")) return createDocsifyAdapter(url);
  return null;
}

function createDocsifyAdapter(url) {
  const owner = url.hostname.split(".")[0];
  const [repository] = url.pathname.split("/").filter(Boolean);
  const route = decodeURIComponent(url.hash.replace(/^#\/?(?:\.\/)?/, ""));
  const documentPath = /\.md$/i.test(route) ? route : `${route || "README"}.md`;
  return {
    kind: "docsify",
    projectId: `${owner}/${repository}`,
    documentPath,
    read(doc) { return readArticle(doc.querySelector("article.markdown-section"), url, this); },
    watch(onChange) { addEventListener("hashchange", onChange); return () => removeEventListener("hashchange", onChange); },
  };
}
```

`readArticle` returns `{ projectId, documentId, url, sections, paragraphs, characterCount }`. It skips `script`, `style`, navigation, comments, and Giscus content.

- [ ] **Step 4: Add least-privilege GitHub Pages enablement**

Modify `manifest.json`:

```json
{
  "permissions": ["storage", "alarms", "scripting", "activeTab"],
  "host_permissions": ["https://github.com/*"],
  "optional_host_permissions": ["https://*.github.io/*"],
  "background": { "service_worker": "background.js" },
  "action": { "default_title": "在当前页面启用星伴读" },
  "content_scripts": [{
    "matches": ["https://github.com/*/*"],
    "js": ["core.js", "adapters.js", "storage.js", "content.js"],
    "css": ["styles.css"],
    "run_at": "document_idle"
  }]
}
```

Implement `background.js` so an action click requests only the current GitHub Pages origin, injects CSS/scripts once, and registers a persistent content script for that origin. Use `chrome.permissions.request({ origins: [`${origin}/*`] })`; if denied, set the action badge to `!` and do not inject.

- [ ] **Step 5: Run adapter and existing tests**

Run: `node --test tests/extension-adapters.test.mjs && npm test`

Expected: adapter tests PASS; existing suite PASS.

- [ ] **Step 6: Commit**

```bash
git add extension/adapters.js extension/background.js extension/manifest.json tests/extension-adapters.test.mjs
git commit -m "Support GitHub and Docsify reading adapters"
```

---

### Task 3: Storage, Progress, and Reading Detail

**Files:**
- Create: `extension/storage.js`
- Modify: `extension/content.js`
- Modify: `extension/styles.css`
- Modify: `tests/extension-core.test.mjs`

**Interfaces:**
- Consumes: adapter `read()`, `StarMateCore.calculateProgress()`.
- Produces: `StarMateStorage.getDocumentState(documentId)`, `saveDocumentState(documentId, patch)`, `saveSnapshot(snapshot)`, `listSavedSnapshots()`.

- [ ] **Step 1: Add failing progress boundary tests**

```js
test("clamps progress and estimates remaining minutes", async () => {
  const core = await loadCore();
  assert.deepEqual(JSON.parse(JSON.stringify(core.calculateProgress({ scrollTop: 50, articleTop: 100, articleHeight: 2000, viewportHeight: 800, remainingCharacters: 700 }))), { percent: 0, remainingMinutes: 2 });
  assert.equal(core.calculateProgress({ scrollTop: 5000, articleTop: 0, articleHeight: 1000, viewportHeight: 500, remainingCharacters: 0 }).percent, 100);
});
```

- [ ] **Step 2: Implement the storage facade**

```js
(() => {
  const PREFIX = "starmate:reader:";
  async function get(key, fallback) { const result = await chrome.storage.local.get(`${PREFIX}${key}`); return result[`${PREFIX}${key}`] ?? fallback; }
  async function set(key, value) { await chrome.storage.local.set({ [`${PREFIX}${key}`]: value }); return value; }
  async function getDocumentState(id) { return get(`state:${id}`, { progress: 0, activeSeconds: 0, lastSectionId: "", reviewTerms: [], seenTerms: [] }); }
  async function saveDocumentState(id, patch) { const current = await getDocumentState(id); return set(`state:${id}`, { ...current, ...patch, updatedAt: Date.now() }); }
  async function saveSnapshot(snapshot) { return set(`snapshot:${snapshot.documentId}`, snapshot); }
  async function listSavedSnapshots() { const all = await chrome.storage.local.get(null); return Object.entries(all).filter(([key]) => key.startsWith(`${PREFIX}snapshot:`)).map(([, value]) => value).slice(-50); }
  globalThis.StarMateStorage = { getDocumentState, saveDocumentState, saveSnapshot, listSavedSnapshots, get, set };
})();
```

- [ ] **Step 3: Add the top progress UI and active-time tracker**

In `content.js`, create one `ReadingSession` per adapter document. Update progress on a requestAnimationFrame-throttled scroll handler. Increment `activeSeconds` every 15 seconds only when `document.visibilityState === "visible"` and the user scrolled, selected, or focused within the last 60 seconds. Save state at most once every 15 seconds and on `pagehide`.

The progress markup must be:

```html
<div class="starmate-reading-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100">
  <span class="starmate-reading-progress-fill"></span>
  <small class="starmate-reading-progress-copy"></small>
</div>
```

Add a “本章” view containing current section, percentage, remaining minutes, active reading time, and “标记已完成”.

- [ ] **Step 4: Style without covering the host navigation**

Use a 3px fixed progress fill with a 28px translucent copy pill on the right. The bar uses `pointer-events:none`; the copy pill appears only when the panel is open or progress changes. Add `@media (prefers-reduced-motion: reduce)` to remove transitions.

- [ ] **Step 5: Run lint and tests**

Run: `npm run lint && npm test`

Expected: all tests PASS and no lint errors.

- [ ] **Step 6: Commit**

```bash
git add extension/storage.js extension/content.js extension/styles.css tests/extension-core.test.mjs
git commit -m "Track document reading progress"
```

---

### Task 4: Lightweight Term Explanations

**Files:**
- Modify: `extension/core.js`
- Modify: `extension/content.js`
- Modify: `extension/styles.css`
- Modify: `tests/extension-core.test.mjs`

**Interfaces:**
- Consumes: adapter paragraphs and `StarMateCore.findKnownTerms()`.
- Produces: term marks with `data-starmate-term`, explanation card actions “我懂了” and “需要回看”.

- [ ] **Step 1: Add a failing limit and unknown-term test**

```js
test("limits annotations and refuses unknown explanations", async () => {
  const core = await loadCore();
  const found = core.findKnownTerms("Agent API JSON Context Prompt Token RAG MCP", 6);
  assert.equal(found.length, 6);
  assert.equal(core.explainTerm("quantum-wombat"), null);
});
```

- [ ] **Step 2: Implement exact explanation lookup**

Add `explainTerm(value)` to `StarMateCore`; it returns `{ term, plain, analogy, role }` only for a normalized glossary key. Extend the glossary with `tool call`, `embedding`, `vector database`, `workflow`, `function calling`, `model`, `framework`, `dependency`, `repository`, `branch`, `commit`, `Docker`, `HTTP`, `endpoint`, `SDK`, and `cache`.

- [ ] **Step 3: Annotate only safe text nodes**

In `content.js`, use `document.createTreeWalker(article, NodeFilter.SHOW_TEXT)`. Skip nodes inside `A`, `CODE`, `PRE`, `SCRIPT`, `STYLE`, `TEXTAREA`, existing `.starmate-term`, and the extension root. Wrap only the first occurrence of each selected term in the current chapter:

```js
const mark = document.createElement("button");
mark.type = "button";
mark.className = "starmate-term";
mark.dataset.starmateTerm = explanation.term;
mark.textContent = matchText;
mark.addEventListener("click", () => showTermCard(mark, explanation, paragraphText));
```

Do not rewrite `innerHTML`; split text nodes so host event listeners survive.

- [ ] **Step 4: Build the three-part term card**

The card shows labels “简单解释”, “生活类比”, and “在这段话里的作用”. The third value is the glossary role followed by a trimmed source sentence. “我懂了” appends the term to `seenTerms`; “需要回看” appends it to `reviewTerms`. Escape by setting `textContent`, not HTML strings.

- [ ] **Step 5: Verify tests and keyboard behavior**

Run: `node --test tests/extension-core.test.mjs && npm run lint`

Expected: tests PASS. Manually tab to a marked term, press Enter, then Escape; focus returns to the term.

- [ ] **Step 6: Commit**

```bash
git add extension/core.js extension/content.js extension/styles.css tests/extension-core.test.mjs
git commit -m "Add lightweight technical term explanations"
```

---

### Task 5: Author Updates and Background Checks

**Files:**
- Modify: `extension/core.js`
- Modify: `extension/background.js`
- Modify: `extension/content.js`
- Modify: `extension/storage.js`
- Modify: `tests/extension-core.test.mjs`

**Interfaces:**
- Consumes: adapter snapshot and GitHub repository/file path.
- Produces: `UpdateEvent { id, documentId, commitSha, checkedAt, added, changed, removed, author, committedAt, message, commitUrl }`.

- [ ] **Step 1: Add failing idempotency test**

```js
test("uses commit and document as a stable update id", async () => {
  const core = await loadCore();
  assert.equal(core.updateEventId("o/r:README", "abc123"), core.updateEventId("o/r:README", "abc123"));
  assert.notEqual(core.updateEventId("o/r:README", "abc123"), core.updateEventId("o/r:README", "def456"));
});
```

- [ ] **Step 2: Add snapshot comparison on document open**

After an adapter reads the document, create section fingerprints from normalized heading plus paragraph text. Load the previous snapshot, call `diffSnapshots`, and store one event only when any array is non-empty. Fetch `https://api.github.com/repos/{owner}/{repo}/commits?path={path}&per_page=1` for author/time/message/link; cache the response for six hours.

- [ ] **Step 3: Schedule one daily stale check**

In `background.js`:

```js
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("starmate-daily-update", { periodInMinutes: 1440 }));
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== "starmate-daily-update") return;
  const snapshots = await readSnapshotsFromStorage();
  for (const snapshot of snapshots.slice(0, 20)) await markIfRemoteVersionChanged(snapshot);
});
```

The background worker compares only remote SHA values and sets `pendingRemoteSha`; full section diff runs next time the document is opened. On `403` or `429`, store `retryAfter` and leave old data untouched.

- [ ] **Step 4: Add the update timeline view**

Show “新增 N / 修改 N / 删除 N”, latest author/time/message, a commit link, and section buttons that scroll to surviving sections. Deleted sections are labeled “已归档” and keep notes/read state.

- [ ] **Step 5: Run tests**

Run: `node --test tests/extension-core.test.mjs && npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add extension/core.js extension/background.js extension/content.js extension/storage.js tests/extension-core.test.mjs
git commit -m "Track author document updates"
```

---

### Task 6: Dynamic Extension Knowledge Graph

**Files:**
- Modify: `extension/core.js`
- Modify: `extension/content.js`
- Modify: `extension/styles.css`
- Modify: `extension/storage.js`
- Modify: `tests/extension-core.test.mjs`

**Interfaces:**
- Consumes: `DocumentSnapshot`, explained terms, prior graph, update diff.
- Produces: local graph with node types `project|document|section|concept` and evidence-backed edge types `contains|explains|shared-concept`.

- [ ] **Step 1: Add failing single-document and merge tests**

```js
test("keeps one concept node when two documents share an alias", async () => {
  const core = await loadCore();
  const merged = core.mergeGraphs(
    { nodes: [{ id: "concept:api", type: "concept", label: "API" }], edges: [] },
    { nodes: [{ id: "concept:api", type: "concept", label: "APIs" }], edges: [{ from: "document:b", to: "concept:api", type: "explains", evidence: { url: "https://b" } }] },
  );
  assert.equal(merged.nodes.filter(node => node.id === "concept:api").length, 1);
  assert.equal(merged.edges.length, 1);
});
```

- [ ] **Step 2: Implement graph merge and incremental update**

Add `mergeGraphs(left, right)` that deduplicates nodes by ID and edges by `from|type|to|evidence.url`. Add `applyGraphDiff(graph, snapshot, diff, terms)` that archives removed section nodes, rebuilds changed section edges, and leaves unaffected node object identity unchanged.

- [ ] **Step 3: Persist the local graph**

Store at `starmate:reader:graph`. Limit to 50 documents and 500 concept nodes; evict the least recently read document graph first. Never evict notes or reading history with the graph cache.

- [ ] **Step 4: Add an accessible mini-graph**

Render the current project, document, up to six sections, and up to eight concepts. Use HTML buttons and CSS connectors rather than canvas so nodes remain keyboard accessible. Selecting an edge opens an evidence card; selecting a section scrolls to source.

- [ ] **Step 5: Verify graph tests and existing behaviors**

Run: `node --test tests/extension-core.test.mjs && npm test`

Expected: graph tests PASS; article map, source search, and notes assertions remain present.

- [ ] **Step 6: Commit**

```bash
git add extension/core.js extension/content.js extension/styles.css extension/storage.js tests/extension-core.test.mjs
git commit -m "Generate dynamic document knowledge graphs"
```

---

### Task 7: Lifecycle Controller and Docsify Chapter Switching

**Files:**
- Modify: `extension/content.js`
- Modify: `extension/adapters.js`
- Modify: `tests/extension-adapters.test.mjs`

**Interfaces:**
- Consumes: adapters, core, storage, and all panel views.
- Produces: exactly one mounted shell per tab and one refreshed reading session per document route.

- [ ] **Step 1: Add failing Docsify route identity tests**

```js
test("uses the hash route in Docsify document identity", async () => {
  const adapters = await loadAdapters();
  const first = adapters.fromLocation(new URL("https://datawhalechina.github.io/hello-agents/#/chapter1/a"));
  const second = adapters.fromLocation(new URL("https://datawhalechina.github.io/hello-agents/#/chapter2/b"));
  assert.notEqual(first.documentId, second.documentId);
});
```

- [ ] **Step 2: Replace repository-only mount gating**

Use `adapter.documentId`, not `owner/repository`, as the lifecycle key. On route change: flush prior session, remove term marks/cards, read the new article after its heading appears, restore state, and refresh all four panel views. Keep the outer shell and notes storage alive.

- [ ] **Step 3: Wait by condition, not a fixed delay**

Create `waitForArticle(adapter, timeoutMs = 8000)` using `MutationObserver`. Resolve when `adapter.read(document).sections.length > 0`; disconnect on resolve/timeout. On timeout display “正文尚未加载，重新打开侧栏后会再次尝试.”

- [ ] **Step 4: Verify target page and GitHub lifecycle**

Run: `node --test tests/extension-adapters.test.mjs && npm test`

Expected: tests PASS. Manual check: navigate between two Datawhale hash chapters; panel count, progress, terms, and graph change without duplicate launchers.

- [ ] **Step 5: Commit**

```bash
git add extension/content.js extension/adapters.js tests/extension-adapters.test.mjs
git commit -m "Refresh companion on Docsify navigation"
```

---

### Task 8: Web App Single-Document Graph and Automatic Ingestion

**Files:**
- Create: `lib/knowledge-graph.mjs`
- Create: `tests/fixtures/repository-packages.mjs`
- Create: `tests/knowledge-graph.test.mjs`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `RepositoryLearningPackage[]`.
- Produces: `buildKnowledgeGraph(packages) -> { nodes, edges, changes }`.

- [ ] **Step 1: Write failing Web App graph tests**

```js
import { buildKnowledgeGraph } from "../lib/knowledge-graph.mjs";
import { onePackage, twoPackages } from "./fixtures/repository-packages.mjs";

test("one repository creates document section and concept edges", () => {
  const graph = buildKnowledgeGraph([onePackage]);
  assert.equal(graph.nodes.some(node => node.type === "section"), true);
  assert.equal(graph.edges.some(edge => edge.type === "explains"), true);
});

test("two repositories share normalized concepts", () => {
  const graph = buildKnowledgeGraph(twoPackages);
  assert.equal(graph.edges.some(edge => edge.type === "shared-concept"), true);
});
```

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test tests/knowledge-graph.test.mjs`

Expected: FAIL because the graph module does not exist.

- [ ] **Step 3: Implement deterministic graph derivation**

`buildKnowledgeGraph` creates project/document/section/concept nodes for every package, includes section source paths and URLs as evidence, normalizes concept labels, and creates cross-document edges only through a shared concept node. Return an empty graph only for an empty package array.

- [ ] **Step 4: Make “加入伴读” generate a package**

Change `toggleSavedRepo(repoId)` to accept a `StarredRepo`. When adding, persist the ID and call `generateLearningPackage(repo.html_url)`; when removing, remove only the saved marker and leave the generated package until the user explicitly removes it from the knowledge inbox.

Replace the button handler with:

```tsx
onClick={() => void toggleSavedRepo(repo)}
```

- [ ] **Step 5: Render single-document and cross-document graph views**

Replace the `knowledgePackages.length >= 2` gate. For one package, show its document—section—concept relationships. For multiple packages, add a separate “跨文档关系” group. Every edge row includes an “查看原文证据” action.

- [ ] **Step 6: Check stale packages once per day on App open**

Store `starmate-last-library-check`. After packages hydrate, if older than 24 hours, refresh at most the first 20 packages sequentially and update the timestamp after completion. A failed package does not abort the remaining queue.

- [ ] **Step 7: Run graph and App tests**

Run: `node --test tests/knowledge-graph.test.mjs && npm run lint && npm test && VERCEL=1 npx next build`

Expected: graph tests PASS, full suite PASS, both Vinext and Vercel builds succeed.

- [ ] **Step 8: Commit**

```bash
git add lib/knowledge-graph.mjs tests/fixtures/repository-packages.mjs tests/knowledge-graph.test.mjs app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "Generate dynamic Web App knowledge graphs"
```

---

### Task 9: Release Archive, Documentation, and End-to-End Verification

**Files:**
- Modify: `extension/README.md`
- Modify: `public/starmate-chrome-extension.zip`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: all prior extension and Web App features.
- Produces: installable extension ZIP and a verified Vercel-compatible site build.

- [ ] **Step 1: Add release-content assertions**

Extend the extension test to assert `background.js`, `optional_host_permissions`, `article.markdown-section`, `starmate-reading-progress`, the three explanation labels, `chrome.alarms`, and `buildDocumentGraph` are present.

- [ ] **Step 2: Update the extension documentation**

Document GitHub automatic activation, one-click GitHub Pages authorization, term explanation privacy, active reading time, update cadence, graph evidence, device-local storage, and how to reset companion data.

- [ ] **Step 3: Regenerate the archive from exact sources**

Run:

```bash
cd extension
zip -FS -r ../public/starmate-chrome-extension.zip manifest.json core.js adapters.js storage.js background.js content.js styles.css README.md
```

Expected: archive contains exactly the eight listed files.

- [ ] **Step 4: Run the complete verification matrix**

Run:

```bash
npm run lint
node --test tests/extension-core.test.mjs tests/extension-adapters.test.mjs tests/knowledge-graph.test.mjs
npm test
VERCEL=1 npx next build
git diff --check
```

Expected: every command exits 0; the Node test count increases; both deployment builds succeed.

- [ ] **Step 5: Perform focused manual acceptance**

Check one GitHub README and the approved Datawhale chapter. Verify: one launcher, progress restoration, six-or-fewer term marks, keyboard term card, route refresh, reading details, update empty state, one-document graph, evidence navigation, notes, search, and Web App import.

- [ ] **Step 6: Commit the release artifacts**

```bash
git add extension/README.md public/starmate-chrome-extension.zip tests/rendered-html.test.mjs
git commit -m "Package painless reading companion extension"
```

- [ ] **Step 7: Publish only after the branch is reviewed**

Push the feature branch, update the existing pull request, deploy the validated commit to Vercel production, and verify these public endpoints return 200:

- `/`
- `/api/repository?libraryId=library_1234567890abcdef`
- `/starmate-chrome-extension.zip`

Do not claim Chrome Web Store publication; this task ships an installable experimental ZIP.
