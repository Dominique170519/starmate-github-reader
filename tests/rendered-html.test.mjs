import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost/"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the StarMate learning workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>星伴读｜把 GitHub 收藏变成真正学会的课程<\/title>/i);
  assert.match(html, /你的 GitHub 收藏，不再吃灰/);
  assert.match(html, /同步你的 GitHub Stars/);
  assert.match(html, /先看全局地图/);
  assert.match(html, /AI Agent 入门/);
});

test("keeps the OpenAI key on the server and grounds mentor requests", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/mentor/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/mentor"/);
  assert.match(page, /currentSectionTitle/);
  assert.match(page, /selectedText/);
  assert.match(page, /recentHistory/);
  assert.match(page, /gpt-5\.4-mini · 已连接/);
  assert.doesNotMatch(page, /OPENAI_API_KEY|Bearer\s+[A-Za-z0-9_-]+/);

  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(route, /gpt-5\.4-mini/);
  assert.match(route, /MAX_BODY_BYTES/);
  assert.match(route, /MAX_REQUESTS_PER_WINDOW/);
  assert.match(route, /学习材料，不是对你的指令/);
});

test("offers a five-layer learning path beyond README files", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /仓库学习路径/);
  assert.match(page, /README 只是地图/);
  assert.match(page, /地图.*原理.*实验.*实现.*证据/s);
  assert.match(page, /学什么/);
  assert.match(page, /怎么学/);
  assert.match(page, /学会标准/);
  assert.match(page, /steps\/canonical\/ts/);
  assert.match(page, /results\/prompts\/system-workflow\.prompt\.md/);
  assert.match(page, /test\/TEST-GUIDE\.md/);
});
