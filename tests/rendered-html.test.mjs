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
  assert.match(html, /<title>星伴读｜让 GitHub 收藏持续生长<\/title>/i);
  assert.match(html, /你的 GitHub 收藏，不再吃灰/);
  assert.match(html, /同步你的 GitHub Stars/);
  assert.match(html, /动态学习地图/);
  assert.match(html, /无痛式入门/);
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
  assert.match(page, /适用于每个新收藏/);
  assert.match(page, /地图.*原理.*实验.*实现.*证据/s);
  assert.match(page, /学什么/);
  assert.match(page, /怎么学/);
  assert.match(page, /学会标准/);
  assert.match(page, /steps\/canonical\/ts/);
  assert.match(page, /results\/prompts\/system-workflow\.prompt\.md/);
  assert.match(page, /test\/TEST-GUIDE\.md/);
});

test("grows the learning map from saved repositories", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /持续生长的学习库/);
  assert.match(page, /收藏持续增长，地图持续更新/);
  assert.match(page, /selectedRepos/);
  assert.match(page, /topicGroups/);
  assert.match(page, /buildGrowingRepositoryLayers/);
  assert.match(page, /加入至少两个仓库后/);
  assert.match(page, /内置的三篇文章只是第一次使用的示范/);
});

test("offers a painless beginner path for nontechnical readers", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /仓库专属 · 无痛式入门/);
  assert.match(page, /先喜欢上技术，再慢慢学技术/);
  assert.match(page, /how-claude-code-works/);
  assert.match(page, /claude-code-from-scratch/);
  assert.match(page, /claude-code-reverse/);
  assert.match(page, /内容随仓库切换/);
  assert.match(page, /只解释这篇文章马上会用到的词/);
  assert.match(page, /30 秒兴趣.*3 分钟体验.*5 分钟全局.*2 分钟挑战/s);
});

test("lets beginners complete and save real practice inside the app", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /在 App 内观察一次完整循环/);
  assert.match(page, /组装一个最小 Agent 蓝图/);
  assert.match(page, /给一条逆向结论标注可信度/);
  assert.match(page, /保存到我的学习成果/);
  assert.match(page, /localStorage\.setItem\("starmate-beginner-artifact"/);
  assert.match(page, /一次日志能证明行为，不能自动证明唯一内部实现/);
  assert.match(page, /开始伴读 \{currentBeginnerTrack\.repository\}/);
});

test("keeps contextual answers anchored to the current GitHub section", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/mentor/route.ts", import.meta.url), "utf8");

  assert.match(page, /当前上下文 · 实时跟随/);
  assert.match(page, /定位当前原文/);
  assert.match(page, /定位原文 ↗/);
  assert.match(page, /浏览器伴读原型/);
  assert.match(route, /直白结论—为什么—原文位置—下一步/);
});

test("builds durable rule-based learning packages for arbitrary GitHub repositories", async () => {
  const [page, route, learning, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/repository/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/repository-learning.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /动态知识收件箱/);
  assert.match(page, /compareLearningPackages/);
  assert.match(page, /检查全部仓库更新/);
  assert.match(page, /不断生长的知识库/);
  assert.match(route, /repository_packages/);
  assert.match(route, /library_repositories/);
  assert.match(route, /force: true|body\.force/);
  assert.match(learning, /buildRepositoryPackage/);
  assert.match(learning, /教程型仓库/);
  assert.match(learning, /研究／逆向型仓库/);
  assert.match(hosting, /"d1": "DB"/);
});

test("keeps repository learning usable on Vercel without Cloudflare D1", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/repository/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /process\.env\.VERCEL/);
  assert.match(route, /storage: db \? "cloud" : "device"/);
  assert.match(page, /DEVICE_LIBRARY_PREFIX/);
  assert.match(page, /writeDeviceLibrary/);
  assert.match(page, /已保存到当前设备/);
});

test("ships a no-model Chrome reading companion", async () => {
  const [page, manifest, content] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"),
    readFile(new URL("../extension/content.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Chrome 伴读侧栏实验版/);
  assert.match(page, /starmate-chrome-extension\.zip/);
  assert.match(manifest, /"manifest_version": 3/);
  assert.match(content, /文章地图/);
  assert.match(content, /原文搜索/);
  assert.match(content, /加入星伴读知识库/);
  assert.match(content, /chrome\.storage\.local/);
});
