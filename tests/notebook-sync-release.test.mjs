import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
const readme = await readFile("README.md", "utf8");
const extensionReadme = await readFile("extension/README.md", "utf8");
const operations = await readFile("docs/notebook-sync-operations.md", "utf8").catch(() => "");

test("release manifest limits sync access to the deployed app origin", () => {
  assert.equal(manifest.version, "0.3.0");
  assert.ok(manifest.host_permissions.includes("https://windy3f3f3f3f-how-claude-code-works.vercel.app/*"));
  assert.ok(!manifest.host_permissions.includes("https://*/*"));
  assert.deepEqual(manifest.content_scripts[0].js, ["core.js", "adapters.js", "storage.js", "content.js"]);
});

test("operator documentation names every required secret and migration command", () => {
  for (const name of ["DATABASE_URL", "GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET", "AUTH_SECRET", "NEXT_PUBLIC_APP_URL"]) {
    assert.match(`${readme}\n${operations}`, new RegExp(name));
  }
  assert.match(operations, /api\/auth\/github\/callback/);
  assert.match(operations, /0001_notebook_sync\.sql/);
  assert.match(operations, /DELETE MY CLOUD NOTES/);
  assert.match(operations, /回滚/);
});

test("user documentation explains opt-in local-only behavior and device revocation", () => {
  assert.match(extensionReadme, /默认关闭/);
  assert.match(extensionReadme, /仅保存在本设备/);
  assert.match(extensionReadme, /断开设备/);
  assert.match(extensionReadme, /删除云端笔记/);
  assert.match(readme, /端到端加密/);
});
