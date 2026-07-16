# 星伴读 Starmate

面向技术初学者的 GitHub 文章伴读产品原型。它把收藏的技术仓库变成更容易开始、理解和复习的学习体验。

## 已实现

- 输入 GitHub 用户名，同步最近 30 个公开 Star
- 浏览仓库简介、语言和收藏量，并跳转查看原文
- 把感兴趣的仓库加入伴读列表，本地保存选择
- 分节伴读、生活化解释、理解检查和复习卡片
- 桌面端和手机端响应式界面

GitHub Stars 通过公开 REST API 读取，不需要访问令牌。匿名请求受 GitHub 访问频率限制；当前版本的学习进度保存在浏览器本地。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

代码检查：

```bash
npm run build
npm run lint
```

## 技术栈

- Next.js / React / TypeScript
- vinext / Vite
- CSS 响应式布局

## 下一步

- 接入 GitHub OAuth，提高接口配额并免输用户名
- 解析 README 和仓库文档，自动生成个性化学习路线
- 增加云端账号、跨设备进度同步与间隔复习
