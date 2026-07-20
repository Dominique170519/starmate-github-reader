import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadAdapters() {
  const source = await readFile(new URL("../extension/adapters.js", import.meta.url), "utf8");
  const sandbox = { URL, decodeURIComponent };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  return sandbox.StarMateAdapters;
}

test("maps a GitHub repository URL", async () => {
  const adapters = await loadAdapters();
  const adapter = adapters.fromLocation(
    new URL("https://github.com/openai/openai-node/blob/master/README.md"),
  );
  assert.equal(adapter.kind, "github");
  assert.equal(adapter.projectId, "openai/openai-node");
  assert.equal(adapter.documentPath, "README.md");
});

test("maps the Datawhale Docsify hash to markdown", async () => {
  const adapters = await loadAdapters();
  const adapter = adapters.fromLocation(
    new URL(
      "https://datawhalechina.github.io/hello-agents/#/./chapter15/%E7%AC%AC%E5%8D%81%E4%BA%94%E7%AB%A0%20%E6%9E%84%E5%BB%BA%E8%B5%9B%E5%8D%9A%E5%B0%8F%E9%95%87",
    ),
  );
  assert.equal(adapter.kind, "docsify");
  assert.equal(adapter.projectId, "datawhalechina/hello-agents");
  assert.match(adapter.documentPath, /^chapter15\/.+\.md$/);
});

test("uses the hash route in Docsify document identity", async () => {
  const adapters = await loadAdapters();
  const first = adapters.fromLocation(
    new URL("https://datawhalechina.github.io/hello-agents/#/chapter1/a"),
  );
  const second = adapters.fromLocation(
    new URL("https://datawhalechina.github.io/hello-agents/#/chapter2/b"),
  );
  assert.notEqual(first.documentId, second.documentId);
});
