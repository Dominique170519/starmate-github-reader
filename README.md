# 星伴读 Starmate

面向技术初学者的 GitHub 项目伴读产品。它把 README、Docs 和仓库结构整理为更容易开始、理解、练习和复习的学习体验，并提供 Web App 与 Chrome 侧栏。

## 已实现

- 从任意公开 GitHub 仓库动态生成文章大纲、无痛入门、学习路径和知识图谱
- 在 App 内阅读原文、切换章节、向伴读老师提问并保存上下文笔记
- 推荐有明确来源证据的实践案例，在 App 内完成复刻任务
- Chrome 插件支持 GitHub 与 Docsify / GitHub Pages：进度、术语解释、作者更新和当前文档图谱
- 独立笔记卡片：自由笔记、摘录、理解、疑问、术语、AI 回答和待复习
- 可选 GitHub OAuth 登录，在电脑网页、手机网页和插件之间同步笔记

笔记采用本地优先策略：创建和编辑总是先写入本机；未登录、关闭同步、断网或服务端未配置时仍能使用。同步默认关闭，只有用户主动开启后才上传笔记卡片、标签、版本和删除状态。当前使用 HTTPS 与托管数据库静态加密，不是端到端加密。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

完整检查：

```bash
npm test
npm run lint
VERCEL=1 npx next build
```

未配置云端变量时，应用会明确进入“仅保存在本设备”模式，构建与本地笔记仍可正常使用。

## 开启跨设备同步

复制 `.env.example` 并配置以下服务端变量：

- `DATABASE_URL`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`

随后执行 `db/migrations/0001_notebook_sync.sql`，并在 GitHub OAuth App 中把回调地址设为：

```text
${NEXT_PUBLIC_APP_URL}/api/auth/github/callback
```

完整部署、验证、设备撤销、云端数据删除和回滚流程见 [笔记同步运维手册](docs/notebook-sync-operations.md)。

## 数据与隐私边界

- 手动输入的 GitHub 用户名只用于读取公开收藏，不作为登录凭证。
- Web 会话与插件令牌只以哈希形式保存在服务端；插件令牌不会暴露给页面脚本。
- 服务端从会话或令牌推导用户身份，不信任客户端提交的 `userId`。
- 日志不应记录笔记正文、摘录、OAuth Token 或插件令牌。
- 用户可暂停同步、断开单个插件设备，或删除全部云端笔记；这些操作不会清除本机笔记。

## 技术栈

- Next.js 16 / React 19 / TypeScript
- vinext / Vite
- Drizzle ORM / Neon PostgreSQL
- Chrome Manifest V3
- Node test runner
