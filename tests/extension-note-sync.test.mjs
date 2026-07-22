import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const background = await readFile(new URL("../extension/background.js", import.meta.url), "utf8");
const content = await readFile(new URL("../extension/content.js", import.meta.url), "utf8");
const storage = await readFile(new URL("../extension/storage.js", import.meta.url), "utf8");

test("extension service worker owns authenticated note transport and retry alarms", () => {
  assert.match(background, /Authorization[^\n]+Bearer/);
  assert.match(background, /starmate-note-changed/);
  assert.match(background, /starmate-sync-now/);
  assert.match(background, /starmate-note-sync-retry/);
  assert.match(background, /\/api\/notes\?cursor=/);
});

test("content UI asks the service worker to sync without reading its bearer token", () => {
  assert.match(content, /starmate-note-changed/);
  assert.match(content, /立即同步/);
  assert.match(content, /断开设备/);
  assert.match(content, /删除云端笔记/);
  assert.doesNotMatch(content, /starmate:sync:extension-token/);
});

test("extension storage persists a pull cursor and preserves pending operations", () => {
  assert.match(storage, /getNoteCursor/);
  assert.match(storage, /setNoteCursor/);
  assert.match(storage, /acknowledgeNotes/);
});
