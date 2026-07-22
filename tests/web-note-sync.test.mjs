import test from "node:test";
import assert from "node:assert/strict";
import { createNoteCard } from "../lib/notebook.mjs";
import { createWebNoteRepository } from "../lib/web-note-repository.mjs";
import { createWebNoteSyncController } from "../lib/web-note-sync.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function note(overrides = {}) {
  return createNoteCard({
    id: "note-1",
    repositoryId: "acme/project",
    documentId: "README.md",
    body: "先保存到本地",
    ...overrides,
  }, overrides.updatedAt || "2026-07-22T10:00:00.000Z");
}

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("saves locally before scheduling its debounced network push", () => {
  const repository = createWebNoteRepository(memoryStorage());
  let scheduled = null;
  const requests = [];
  const controller = createWebNoteSyncController({
    repository,
    request: async (...args) => { requests.push(args); return response(200, {}); },
    setTimer(callback, delay) { scheduled = { callback, delay }; return 1; },
    clearTimer() {},
  });

  controller.save(note());

  assert.equal(repository.list()[0].body, "先保存到本地");
  assert.equal(requests.length, 0);
  assert.equal(scheduled.delay, 800);
  assert.equal(controller.snapshot().status, "waiting");
});

test("keeps failed operations and only removes acknowledged note ids", async () => {
  const repository = createWebNoteRepository(memoryStorage());
  repository.save(note());
  repository.save(note({ id: "note-2", body: "第二张" }));
  let fail = true;
  const controller = createWebNoteSyncController({
    repository,
    request: async (url, init = {}) => {
      if (fail) throw new Error("offline");
      if (init.method === "POST") return response(200, { acknowledged: ["note-1"], canonical: [], conflicts: 0 });
      return response(200, { changes: [], nextCursor: "0", hasMore: false });
    },
  });

  await controller.syncNow();
  assert.equal(repository.pendingBatch().length, 2);
  assert.equal(controller.snapshot().status, "waiting");

  fail = false;
  await controller.syncNow();
  assert.deepEqual(repository.pendingBatch().map((item) => item.note.id), ["note-2"]);
});

test("does not acknowledge a newer edit made while the previous version is uploading", async () => {
  const repository = createWebNoteRepository(memoryStorage());
  repository.save(note({ version: 1 }));
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const controller = createWebNoteSyncController({
    repository,
    request: async (_url, init = {}) => {
      if (init.method === "POST") {
        await gate;
        return response(200, { acknowledged: ["note-1"], canonical: [], conflicts: 0 });
      }
      return response(200, { changes: [], nextCursor: "0", hasMore: false });
    },
  });

  const syncing = controller.syncNow();
  repository.save(note({ body: "上传时又修改了", version: 2 }));
  release();
  await syncing;

  assert.equal(repository.pendingBatch().length, 1);
  assert.equal(repository.pendingBatch()[0].note.version, 2);
});

test("pulls cursor pages in order and advances only after applying each page", async () => {
  const repository = createWebNoteRepository(memoryStorage());
  const cursors = [];
  const controller = createWebNoteSyncController({
    repository,
    request: async (url) => {
      const cursor = new URL(url, "https://example.test").searchParams.get("cursor");
      cursors.push(cursor);
      if (cursor === "0") return response(200, {
        changes: [{ id: "4", kind: "upsert", note: note({ body: "手机内容", version: 2 }) }],
        nextCursor: "4",
        hasMore: true,
      });
      return response(200, { changes: [], nextCursor: "5", hasMore: false });
    },
  });

  await controller.syncNow();

  assert.deepEqual(cursors, ["0", "4"]);
  assert.equal(repository.list()[0].body, "手机内容");
  assert.equal(repository.cursor(), "5");
  assert.equal(controller.snapshot().status, "synced");
});

test("pauses on authentication errors and falls back to local-only on unavailable cloud", async () => {
  const repository = createWebNoteRepository(memoryStorage());
  let status = 401;
  const controller = createWebNoteSyncController({
    repository,
    request: async () => response(status, status === 401 ? {} : { localOnly: true }),
  });

  await controller.syncNow();
  assert.equal(controller.snapshot().status, "auth-required");

  status = 503;
  await controller.syncNow();
  assert.equal(controller.snapshot().status, "local");
  assert.equal(controller.snapshot().localOnly, true);
});

test("reports a conflict after applying the canonical server version", async () => {
  const repository = createWebNoteRepository(memoryStorage());
  repository.save(note({ version: 2 }));
  const controller = createWebNoteSyncController({
    repository,
    request: async (_url, init = {}) => init.method === "POST"
      ? response(200, { acknowledged: ["note-1"], canonical: [note({ body: "服务器合并版", version: 3 })], conflicts: 1 })
      : response(200, { changes: [], nextCursor: "1", hasMore: false }),
  });

  await controller.syncNow();

  assert.equal(repository.list()[0].body, "服务器合并版");
  assert.equal(controller.snapshot().status, "conflict");
  assert.equal(controller.snapshot().conflicts, 1);
});
