# 笔记同步运维手册

本手册用于把星伴读的可选跨设备笔记同步部署到 Vercel。缺少任一关键配置时，应用会返回 `localOnly: true`，用户仍可正常使用本地笔记。

## 1. 创建 Neon 数据库

1. 在 Neon 创建 PostgreSQL 项目和生产分支。
2. 复制带 TLS 的连接字符串作为 `DATABASE_URL`。
3. 在 Neon SQL Editor 中执行 `db/migrations/0001_notebook_sync.sql` 的完整内容。
4. 确认 `users`、`web_sessions`、`extension_devices`、`extension_connect_codes`、`notes`、`note_versions` 和 `sync_changes` 七张表存在。

迁移只新增同步表，不修改现有浏览器本地数据。不要把真实连接字符串提交到 Git。

## 2. 创建 GitHub OAuth App

在 GitHub Settings → Developer settings → OAuth Apps 创建应用：

- Homepage URL：`NEXT_PUBLIC_APP_URL` 的完整 HTTPS 地址
- Authorization callback URL：`${NEXT_PUBLIC_APP_URL}/api/auth/github/callback`

记录 Client ID 和新生成的 Client Secret。应用只请求 `read:user`，不需要 `repo` 权限，也不会保存 GitHub access token。

## 3. 配置 Vercel 环境变量

在 Production、Preview（如需）和对应开发环境中分别设置：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL 连接字符串 |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `AUTH_SECRET` | 签名 OAuth state 的随机密钥，至少 32 个字符 |
| `NEXT_PUBLIC_APP_URL` | 部署源站，不带末尾 `/` |

可用 `openssl rand -base64 48` 生成 `AUTH_SECRET`。设置后重新部署；不要在构建日志、截图或问题单中记录变量值。

如果部署域名变化，还要同时更新 GitHub OAuth 回调地址、`NEXT_PUBLIC_APP_URL`、`extension/background.js` 中的 `APP_ORIGIN`、`extension/content.js` 中的 `APP_URL` 与 `extension/manifest.json` 的精确 host permission，再重打插件 ZIP。

## 4. 发布前检查

在干净依赖环境运行：

```bash
npm ci
npm test
npm run lint
VERCEL=1 npx next build
git diff --check
unzip -l public/starmate-chrome-extension.zip
```

压缩包应只包含 `manifest.json`、`background.js`、`core.js`、`adapters.js`、`storage.js`、`content.js`、`styles.css` 和 `README.md`，每个文件恰好一次。

## 5. 预发布冒烟验证

使用专用测试 GitHub 账号，只记录通过/失败与测试账号 ID，不记录笔记正文或令牌：

1. Web GitHub 登录成功，页面显示正确账号。
2. 插件发起连接，网页批准后插件显示已同步。
3. Web 到插件、插件到 Web 分别验证新建、编辑和删除。
4. 离线编辑后恢复联网，待同步队列被保留并最终完成。
5. 两端编辑同一版本，当前内容可见且旧版本可恢复。
6. 手机页面可以创建和编辑卡片。
7. Web 端“断开设备”后旧插件令牌返回 401，本机卡片仍在。
8. 输入 `DELETE MY CLOUD NOTES` 后云端笔记被删除、插件设备被撤销，本机卡片仍在。

## 6. 故障与回滚

- OAuth 或数据库故障：先移除/暂时清空服务端同步变量并重新部署，产品会回滚到“仅保存在本设备”；不要清理客户端存储。
- 新版本前端异常：在 Vercel 回滚应用版本。数据库迁移为新增表，可保留；客户端待同步队列会在恢复后继续处理。
- 插件异常：回退到上一个已验证 ZIP。不要降低数据版本或清除 `chrome.storage.local`。
- 密钥泄露：轮换 `AUTH_SECRET`、GitHub Client Secret 和数据库凭证；这会使旧会话失效。随后在数据库中撤销全部 `extension_devices`。
- 数据库恢复：从 Neon 备份恢复到新分支，先用测试账号完成冒烟检查，再切换 `DATABASE_URL`。

云端删除是破坏性操作，只能由已认证用户明确输入确认短语触发；本机数据不由服务端删除。
