# GitHub Notebook Cards and Cross-device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-textarea notes with manageable note cards and optionally synchronize them between the extension, desktop Web App, and mobile Web App through an authenticated GitHub account.

**Architecture:** Both clients use the same versioned note schema and save locally before attempting network sync. GitHub OAuth creates a Web session; a polling-based one-time connection flow issues a restricted extension token. A managed PostgreSQL database stores users, devices, notes, tombstones, and prior versions, while clients exchange cursor-based batches through `/api/notes`.

**Tech Stack:** Next.js 16, React 19, TypeScript, browser localStorage, Chrome `storage.local`, GitHub OAuth, Drizzle ORM, Neon serverless PostgreSQL, Node test runner

## Global Constraints

- Sync is opt-in and local note creation must work without login or network.
- A manually entered GitHub username is never an authentication credential.
- Transport uses HTTPS and managed storage encryption; the product must not claim end-to-end encryption.
- Clients never trust a submitted `userId`; the server derives identity from the session or bearer token.
- Logs never contain note bodies, quotes, OAuth tokens, or extension tokens.
- Missing OAuth or database configuration must visibly fall back to “仅保存在本设备”.
- Existing textarea notes must remain recoverable until migration succeeds.

---

### Task 1: Versioned note-card domain

**Files:**
- Create: `lib/notebook.mjs`
- Create: `lib/notebook.d.mts`
- Create: `tests/notebook.test.mjs`

**Interfaces:**
- Produces: `NOTE_TYPES`, `createNoteCard(input, now)`, `migrateLegacyNote(input, now)`, `mergeNoteVersions(local, remote)`, `serializeNoteBatch(notes)`, and `matchesNoteFilters(note, filters)`.
- Consumed by: Web local repository, extension core wrapper, and API validation.

- [x] **Step 1: Write failing schema, migration, conflict, and filter tests**

```js
test("creates a freeform note without requiring a quote", () => {
  const note = createNoteCard({ repositoryId: "a/b", documentId: "README.md", body: "我的理解" }, NOW);
  assert.equal(note.type, "freeform");
  assert.equal(note.quote, "");
  assert.equal(note.version, 1);
});

test("migrates a legacy textarea into one history card", () => {
  const note = migrateLegacyNote({ key: "starmate-note-a/b", body: "旧笔记", repositoryId: "a/b", documentId: "README.md" }, NOW);
  assert.equal(note.title, "历史笔记");
  assert.equal(note.body, "旧笔记");
});

test("keeps the newest current value and the losing version", () => {
  const result = mergeNoteVersions(localNote, remoteNote);
  assert.equal(result.current.id, localNote.id);
  assert.equal(result.history.length, 1);
});
```

- [x] **Step 2: Run the test and verify the missing-module failure**

Run: `node --test tests/notebook.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [x] **Step 3: Implement immutable note creation and validation**

```js
export const NOTE_TYPES = ["freeform", "quote", "understanding", "question", "term", "mentor-answer", "review"];

export function createNoteCard(input, now = new Date().toISOString()) {
  if (!input.repositoryId || !input.documentId) throw new TypeError("repositoryId and documentId are required");
  const type = NOTE_TYPES.includes(input.type) ? input.type : "freeform";
  return {
    id: input.id || crypto.randomUUID(),
    repositoryId: input.repositoryId,
    documentId: input.documentId,
    sectionId: input.sectionId || "",
    sourceUrl: input.sourceUrl || "",
    anchor: input.anchor || "",
    type,
    title: String(input.title || "").slice(0, 120),
    body: String(input.body || "").slice(0, 20000),
    quote: String(input.quote || "").slice(0, 8000),
    tags: [...new Set((input.tags || []).map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 20),
    pinned: Boolean(input.pinned),
    resolved: Boolean(input.resolved),
    reviewNeeded: Boolean(input.reviewNeeded),
    createdAt: input.createdAt || now,
    updatedAt: now,
    version: Number(input.version || 1),
    deletedAt: input.deletedAt || null,
  };
}
```

- [x] **Step 4: Implement migration, merge, batch limits, and filters**

Migration returns `null` for blank legacy content. Merge compares version then ISO `updatedAt`, returns `{ current, history, conflicted }`, and never discards a distinct same-version body. Batch serialization caps one request at 100 notes and rejects malformed items. Filters support repository, document, type, tag, review state, and case-insensitive body/title/quote search.

- [x] **Step 5: Run focused tests**

Run: `node --test tests/notebook.test.mjs`

Expected: all notebook domain tests pass.

- [x] **Step 6: Commit the note domain**

```bash
git add lib/notebook.mjs lib/notebook.d.mts tests/notebook.test.mjs
git commit -m "Add versioned notebook card domain"
```

### Task 2: Web local-first note repository and legacy migration

**Files:**
- Create: `lib/web-note-repository.ts`
- Create: `tests/web-note-repository.test.mjs`
- Modify: `app/page.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: note-domain functions.
- Produces: `createWebNoteRepository(storage)` with `list`, `save`, `remove`, `restoreVersion`, `pendingBatch`, `applyRemoteBatch`, and `migrateLegacyKeys`.

- [x] **Step 1: Write a failing storage-adapter test**

Use an in-memory `Storage` fixture and assert that saving a note writes `starmate-notes:v1`, writes a pending operation, and emits a tombstone rather than hard-deleting. Assert migration preserves the old key until the new card is readable.

- [x] **Step 2: Run the focused test and confirm the repository is missing**

Run: `node --test tests/web-note-repository.test.mjs`

Expected: FAIL with module-not-found.

- [x] **Step 3: Implement a storage-injected repository**

```ts
export function createWebNoteRepository(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
  const read = (): NoteCard[] => JSON.parse(storage.getItem("starmate-notes:v1") || "[]");
  const write = (notes: NoteCard[]) => storage.setItem("starmate-notes:v1", JSON.stringify(notes));
  const readQueue = (): NoteOperation[] => JSON.parse(storage.getItem("starmate-note-operations:v1") || "[]");
  const enqueue = (operation: NoteOperation) => {
    const queue = [...readQueue().filter((item) => item.note.id !== operation.note.id), operation];
    storage.setItem("starmate-note-operations:v1", JSON.stringify(queue));
  };
  const upsert = (notes: NoteCard[], note: NoteCard) => [note, ...notes.filter((item) => item.id !== note.id)];
  return {
    list(filters: NoteFilters = {}) { return read().filter((note) => matchesNoteFilters(note, filters)); },
    save(note: NoteCard) { write(upsert(read(), note)); enqueue({ kind: "upsert", note }); return note; },
    remove(id: string, now = new Date().toISOString()) {
      const current = read().find((note) => note.id === id);
      if (!current) return null;
      const tombstone = { ...current, deletedAt: now, updatedAt: now, version: current.version + 1 };
      write(upsert(read(), tombstone));
      enqueue({ kind: "delete", note: tombstone });
      return tombstone;
    },
    pendingBatch() { return readQueue().slice(0, 100); },
    applyRemoteBatch(remote: NoteCard[]) {
      const histories: NoteCard[] = [];
      let notes = read();
      for (const incoming of remote) {
        const local = notes.find((note) => note.id === incoming.id);
        const merged = local ? mergeNoteVersions(local, incoming) : { current: incoming, history: [] };
        histories.push(...merged.history);
        notes = upsert(notes, merged.current);
      }
      write(notes);
      const previousHistory = JSON.parse(storage.getItem("starmate-note-history:v1") || "[]");
      storage.setItem("starmate-note-history:v1", JSON.stringify([...histories, ...previousHistory]));
      return notes;
    },
    migrateLegacyKeys(keys: LegacyKey[]) {
      const migrated = keys.flatMap((legacy) => {
        const note = migrateLegacyNote(legacy);
        return note ? [note] : [];
      });
      write([...migrated, ...read().filter((note) => !migrated.some((item) => item.id === note.id))]);
      storage.setItem("starmate-note-migration:v1", "complete");
      return migrated;
    },
  };
}
```

- [x] **Step 4: Replace direct Web textarea storage access**

Initialize the repository only in the browser. On first load, migrate `starmate-note-${documentName}` keys. Replace `saveNote(value)` with card actions; keep a temporary compatibility reader until the migration marker exists.

- [x] **Step 5: Run repository and rendered-source tests**

Run: `node --test tests/web-note-repository.test.mjs tests/rendered-html.test.mjs`

Expected: tests pass and page source no longer writes active notes directly to `starmate-note-*`.

- [x] **Step 6: Commit local-first Web storage**

```bash
git add lib/web-note-repository.ts tests/web-note-repository.test.mjs app/page.tsx tests/rendered-html.test.mjs
git commit -m "Store Web notes as local-first cards"
```

### Task 3: Web notebook card interface

**Files:**
- Create: `app/notebook-workspace.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `NoteCard[]`, current repository/document context, and callbacks `onCreate`, `onUpdate`, `onDelete`, `onRestore`, `onOpenSource`.
- Produces: compact reader notes, full “我的笔记” workspace, mobile layout, and source-aware card creation.

- [x] **Step 1: Add failing UI contract assertions**

Assert the source contains all seven note types, “新建空白笔记”, article/tag/type/search filters, “待复习”, “恢复上一版本”, and sync state text.

- [x] **Step 2: Run the rendered-source test and verify it fails**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL for the new notebook controls.

- [x] **Step 3: Build the focused notebook component**

Define `NotebookWorkspaceProps` explicitly. Render a compact mode for the reading sidebar and a full mode for the dedicated workspace. Creation defaults to freeform and does not require selected text. When quote, term, or mentor context is supplied, preselect the matching type and retain source location.

- [x] **Step 4: Integrate capture actions**

Change “加入笔记” to open a small composer with quote preview and editable personal body. Add actions beside term explanations and mentor answers. All actions call one `createContextNote(type, context)` function so source metadata is consistent.

- [x] **Step 5: Add article-first and cross-article navigation**

Reader sidebar filters current document. Dedicated workspace defaults to repository/article groups and exposes tag/type/review/search filters. A source button reopens the correct document and section. Soft-deleted items are hidden except in a short “最近删除” recovery view.

- [x] **Step 6: Add 360px mobile styles and keyboard focus states**

At narrow widths use a single-column card list, sticky create button, full-width filter drawer, and non-truncated body preview. Inputs and buttons must retain visible `:focus-visible` outlines.

- [x] **Step 7: Run tests, lint, and build**

Run: `node --test tests/rendered-html.test.mjs && npm run lint && VERCEL=1 npx next build`

Expected: tests pass, lint exits 0, and build succeeds.

- [x] **Step 8: Commit the Web notebook UI**

```bash
git add app/notebook-workspace.tsx app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "Add manageable Web notebook cards"
```

### Task 4: Extension note-card storage and interface

**Files:**
- Modify: `extension/core.js`
- Modify: `extension/storage.js`
- Modify: `extension/content.js`
- Modify: `extension/styles.css`
- Modify: `extension/README.md`
- Modify: `tests/extension-core.test.mjs`

**Interfaces:**
- Consumes: the same serialized `NoteCard` shape used by Web.
- Produces: `StarMateStorage.listNotes`, `saveNote`, `removeNote`, `pendingNoteBatch`, `applyRemoteNotes`, and card-based extension UI.

- [x] **Step 1: Add failing extension-domain tests**

Test freeform note creation, quote capture with section/source URL, legacy `note:${documentId}` migration, tombstone deletion, and a 100-operation pending batch limit.

- [x] **Step 2: Run extension tests and confirm missing functions**

Run: `node --test tests/extension-core.test.mjs`

Expected: FAIL because note-card helpers do not exist.

- [x] **Step 3: Port the note schema into the extension core wrapper**

Keep field names and limits identical to `lib/notebook.mjs`. Expose helpers through `globalThis.StarMateCore`. Do not import ESM from the content script because the manifest currently injects classic scripts.

- [x] **Step 4: Add note repository methods and safe migration**

Use keys `notes:v1`, `note-operations:v1`, and `note-migration:v1`. Read the old `note:${documentId}` value, create one “历史笔记” card, verify it is stored, then record the migration marker without deleting the old key in this release.

- [x] **Step 5: Replace the textarea with cards and composer**

The note view starts with “新建笔记”. Current-document cards show type, body preview, tags, review state, edit/delete actions, and “在网页中管理全部笔记”. Selection capture opens the composer rather than appending raw text. Term and reading-detail views can create typed cards.

- [x] **Step 6: Update privacy copy**

State that notes remain local unless the user explicitly connects GitHub and enables sync. Describe how to disconnect a device and retain or delete local notes.

- [x] **Step 7: Run extension tests and package checks**

Run: `node --test tests/extension-core.test.mjs && git diff --check -- extension`

Expected: tests pass and diff check is clean.

- [x] **Step 8: Commit extension note cards**

```bash
git add extension/core.js extension/storage.js extension/content.js extension/styles.css extension/README.md tests/extension-core.test.mjs
git commit -m "Add manageable extension note cards"
```

### Task 5: PostgreSQL schema and authenticated session primitives

**Files:**
- Modify: `package.json`
- Create: `db/schema.ts`
- Create: `db/client.ts`
- Create: `db/migrations/0001_notebook_sync.sql`
- Create: `lib/auth.mjs`
- Create: `lib/auth.d.mts`
- Create: `tests/auth.test.mjs`
- Modify: `.env.example`

**Interfaces:**
- Produces database tables `users`, `web_sessions`, `extension_devices`, `extension_connect_codes`, `notes`, `note_versions`, and `sync_changes`.
- Produces `hashToken`, `signState`, `verifyState`, `newOpaqueToken`, and server database access through Neon HTTP.

- [x] **Step 1: Add failing auth primitive tests**

Test signed OAuth state expiry and tamper detection, opaque token hashing, and constant-time token comparison. Tests must use injected secrets and timestamps, not environment variables.

- [x] **Step 2: Run auth tests and confirm the module is missing**

Run: `node --test tests/auth.test.mjs`

Expected: FAIL with module-not-found.

- [x] **Step 3: Add Neon and Drizzle dependencies**

Run: `npm install @neondatabase/serverless@latest`

Expected: `package.json` and lockfile add the Neon driver without removing existing packages.

- [x] **Step 4: Define exact relational constraints**

Use GitHub numeric id as a unique external identity. Hash all sessions and extension tokens before storage. Notes have unique `(user_id, note_id)`, integer version, timestamps, and `deleted_at`. Versions preserve the full previous note JSON. Sync changes have a monotonically increasing bigint id used as the pull cursor. Connect codes expire after ten minutes and have a nullable single-use `consumed_at`.

- [x] **Step 5: Implement configuration-safe database access**

`getDatabase()` returns `null` when `DATABASE_URL` is absent and never attempts a network connection during module import. API routes use this to return explicit local-only capability responses instead of throwing.

- [x] **Step 6: Implement and test auth primitives**

Use Web Crypto HMAC-SHA-256 for signed state and SHA-256 for stored token hashes. Opaque tokens contain at least 32 random bytes. Reject expired or malformed state before JSON parsing is trusted.

- [x] **Step 7: Document exact environment variables**

Add `DATABASE_URL`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `AUTH_SECRET`, and `NEXT_PUBLIC_APP_URL`, with descriptions but no real values.

- [x] **Step 8: Run tests, lint, and build without secrets**

Run: `node --test tests/auth.test.mjs && npm run lint && VERCEL=1 npx next build`

Expected: auth tests pass and production build succeeds in local-only mode.

- [x] **Step 9: Commit schema and primitives**

```bash
git add package.json package-lock.json db lib/auth.mjs lib/auth.d.mts tests/auth.test.mjs .env.example
git commit -m "Add notebook sync database and auth primitives"
```

### Task 6: GitHub OAuth and extension connection flow

**Files:**
- Create: `app/api/auth/github/start/route.ts`
- Create: `app/api/auth/github/callback/route.ts`
- Create: `app/api/auth/session/route.ts`
- Create: `app/api/auth/extension-connect/route.ts`
- Create: `lib/server-auth.ts`
- Modify: `app/page.tsx`
- Modify: `extension/background.js`
- Modify: `extension/content.js`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: Web cookie `starmate_session`; `GET /api/auth/session`; connect-code `POST`, authenticated approval `PATCH`, and one-time polling `GET`; revocable bearer tokens for extension notes only.

- [x] **Step 1: Add failing source-contract tests**

Assert OAuth routes request only `read:user`, state is verified, cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, extension codes expire and are single-use, and database-missing responses say `localOnly: true`.

- [x] **Step 2: Implement GitHub OAuth start and callback**

Start signs `{ returnTo, nonce, expiresAt }`, stores nonce in an HttpOnly cookie, and redirects to GitHub. Callback verifies state and nonce, exchanges the code server-side, calls GitHub `/user`, upserts the user, creates a hashed Web session, clears the nonce cookie, and redirects only to a safe relative path. Never return the GitHub access token to either client and do not persist it after fetching identity.

- [x] **Step 3: Implement session capability response**

`GET /api/auth/session` returns `{ authenticated, user, syncAvailable, localOnly }`. When configuration is missing it returns HTTP 200 with `syncAvailable: false`, allowing the UI to explain local-only mode.

- [x] **Step 4: Implement polling-based extension connection**

The extension creates a random challenge, POSTs it to create a pending code, and opens `${APP_URL}/?connectExtension=<challenge>`. An authenticated Web user approves it with PATCH. The extension polls GET every two seconds for at most ten minutes. The first successful GET returns an opaque extension token and marks the code consumed; later GET calls return 410. Store only the token hash and device label server-side.

- [x] **Step 5: Add disconnect and revoke behavior**

The session route can revoke a device belonging to the current user. The extension clears its local token only after revoke succeeds or when the user confirms local-only disconnect. Revocation never deletes local notes.

- [x] **Step 6: Run source tests, lint, and build**

Run: `node --test tests/rendered-html.test.mjs && npm run lint && VERCEL=1 npx next build`

Expected: tests pass, lint exits 0, and build succeeds without live credentials.

- [x] **Step 7: Commit OAuth and connection flow**

```bash
git add app/api/auth lib/server-auth.ts app/page.tsx extension/background.js extension/content.js tests/rendered-html.test.mjs
git commit -m "Connect notebook sync with GitHub identity"
```

### Task 7: Cursor-based notes sync API

**Files:**
- Create: `app/api/notes/route.ts`
- Create: `lib/note-sync-server.ts`
- Create: `tests/note-sync.test.mjs`
- Modify: `lib/notebook.mjs`
- Modify: `lib/notebook.d.mts`

**Interfaces:**
- Consumes: Web session or extension bearer token.
- Produces: `GET /api/notes?cursor=<id>&limit=100`, `POST /api/notes` batch upserts/tombstones, `PATCH /api/notes` version restoration, and authenticated `DELETE /api/notes?scope=cloud`.

- [x] **Step 1: Write failing pure sync-decision tests**

Cover new note, higher-version update, same-version identical retry, same-version conflicting bodies, tombstone propagation, and another user's note id. Assert the server returns a new cursor and retains the losing conflict version.

- [x] **Step 2: Run the focused test and confirm missing sync functions**

Run: `node --test tests/note-sync.test.mjs`

Expected: FAIL with module-not-found.

- [x] **Step 3: Implement authenticated identity resolution**

Prefer a valid Web session cookie; otherwise accept `Authorization: Bearer`. Hash the bearer value before lookup. Return 401 for invalid credentials and 503 `{ localOnly: true }` when database configuration is absent. Never accept a body `userId`.

- [x] **Step 4: Implement transactional batch push**

Validate at most 100 operations and domain field limits. For each note, lock or conditionally compare the current version, write the previous JSON to `note_versions` when contents differ, upsert current state, and append one `sync_changes` row. Identical retries are idempotent and do not create new changes.

- [x] **Step 5: Implement cursor pull and restoration**

Pull returns changes strictly greater than cursor, ordered ascending, limited to 100, plus `nextCursor` and `hasMore`. Restoration creates a new current version rather than overwriting version history.

- [x] **Step 6: Implement explicit cloud-data deletion**

`DELETE /api/notes?scope=cloud` requires a fresh authenticated session or valid extension token plus body `{ confirm: "DELETE MY CLOUD NOTES" }`. In one transaction, delete the user's note versions, current notes, and sync changes, then revoke all extension devices. Do not delete browser or extension local storage. Return `{ deleted: true, localDataRetained: true }` and cover cross-user isolation in the sync tests.

- [x] **Step 7: Run sync tests, lint, and build**

Run: `node --test tests/notebook.test.mjs tests/note-sync.test.mjs && npm run lint && VERCEL=1 npx next build`

Expected: all tests pass and build succeeds.

- [x] **Step 8: Commit the sync API**

```bash
git add app/api/notes/route.ts lib/note-sync-server.ts lib/notebook.mjs lib/notebook.d.mts tests/note-sync.test.mjs
git commit -m "Synchronize versioned notebook cards"
```

### Task 8: Web and extension sync controllers

**Files:**
- Create: `lib/web-note-sync.ts`
- Modify: `app/page.tsx`
- Modify: `app/notebook-workspace.tsx`
- Modify: `extension/background.js`
- Modify: `extension/storage.js`
- Modify: `extension/content.js`
- Modify: `tests/web-note-repository.test.mjs`
- Modify: `tests/extension-core.test.mjs`

**Interfaces:**
- Consumes: local pending queues and `/api/notes`.
- Produces: debounced push, cursor pull, offline retry, sync status, and manual “立即同步”.

- [x] **Step 1: Add failing controller tests with mocked fetch**

Assert local save happens before fetch, failed fetch keeps the queue, successful push removes only acknowledged operations, pull updates the cursor after applying changes, 401 pauses and requests reconnection, and 503 selects local-only mode.

- [x] **Step 2: Implement the Web controller**

Schedule a push 800ms after local change, run pull on startup/focus/manual refresh, and drain paginated pulls until `hasMore` is false with a ten-page safety cap. Use `online` events for retry. Expose `local`, `waiting`, `syncing`, `synced`, `conflict`, and `auth-required` states.

- [x] **Step 3: Implement extension background synchronization**

Keep bearer tokens only in `chrome.storage.local`. The content script sends sync requests to the service worker; the service worker attaches authorization and calls the App API. Use alarms for periodic retry and message current status back to every connected content script.

- [x] **Step 4: Add visible opt-in and status controls**

Both clients default to “仅保存在本设备”. The first connect action shows the synced data categories. After connection show GitHub login, last sync time, “立即同步”, “断开设备”, “删除云端笔记”, and an error explanation without exposing raw server messages. Cloud deletion requires typing the exact confirmation phrase and then returns both clients to local-only mode without clearing local cards.

- [x] **Step 5: Run controller, extension, lint, and build checks**

Run: `node --test tests/web-note-repository.test.mjs tests/extension-core.test.mjs && npm run lint && VERCEL=1 npx next build`

Expected: tests pass, lint exits 0, and build succeeds.

- [x] **Step 6: Commit sync controllers**

```bash
git add lib/web-note-sync.ts app/page.tsx app/notebook-workspace.tsx extension/background.js extension/storage.js extension/content.js tests/web-note-repository.test.mjs tests/extension-core.test.mjs
git commit -m "Sync notebook cards across Web and extension"
```

### Task 9: Release migration, packaging, and operational documentation

**Files:**
- Modify: `README.md`
- Modify: `extension/README.md`
- Modify: `extension/manifest.json`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `public/starmate-chrome-extension.zip`
- Create: `docs/notebook-sync-operations.md`

**Interfaces:**
- Consumes: complete note-card and sync implementation.
- Produces: deploy checklist, privacy explanation, database migration procedure, OAuth setup, updated extension package.

- [x] **Step 1: Add failing release-source assertions**

Assert the manifest permits only the App API origin required for sync, documentation names all environment variables, local-only behavior is explicit, and cloud deletion/device revocation steps exist.

- [x] **Step 2: Write the operator runbook**

Include exact GitHub OAuth callback URL `${NEXT_PUBLIC_APP_URL}/api/auth/github/callback`, Neon creation and `DATABASE_URL`, migration command, secret generation, Vercel environment configuration, device revocation check, cloud-data deletion check, and rollback behavior. Do not include real secrets.

- [x] **Step 3: Update the extension manifest and rebuild the zip**

Increment the extension version, add only the deployed Vercel origin to optional host permissions if needed, keep the two existing content adapters, and rebuild the archive with the expected eight runtime files plus any new required script. Verify the archive list explicitly.

- [x] **Step 4: Run complete fresh verification**

Run: `npm test`

Expected: the build-backed test suite passes.

Run: `npm run lint`

Expected: exit 0.

Run: `VERCEL=1 npx next build`

Expected: Vercel production build succeeds in local-only mode.

Run: `git diff --check`

Expected: no output.

Run: `unzip -l public/starmate-chrome-extension.zip`

Expected: every referenced manifest script exists exactly once and no development files are bundled.

- [ ] **Step 5: Perform configured staging smoke tests** *(等待部署方提供 Neon 与 GitHub OAuth 环境变量；不得用未配置的本地模式冒充通过)*

After OAuth and database environment variables exist, verify: Web GitHub login, extension connect, Web-to-extension create/update/delete, extension-to-Web create/update/delete, offline edit then reconnect, conflict history restore, mobile note creation, device revoke, and cloud deletion. Record only pass/fail and test account id; never record note contents or tokens.

- [x] **Step 6: Commit release artifacts**

```bash
git add README.md extension/README.md extension/manifest.json public/starmate-chrome-extension.zip docs/notebook-sync-operations.md tests/rendered-html.test.mjs
git commit -m "Prepare notebook sync release"
```
