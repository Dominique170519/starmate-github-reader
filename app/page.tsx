"use client";

import { useEffect, useMemo, useState } from "react";

type View = "home" | "overview" | "reader" | "review";
type OverviewMode = "documents" | "topic" | "graph";

type Lesson = {
  id: number;
  title: string;
  eyebrow: string;
  minutes: number;
  status: "done" | "current" | "locked";
};

type StarredRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics?: string[];
  updated_at: string;
};

type LessonContent = {
  title: string;
  eyebrow: string;
  minutes: number;
  quote: string;
  source: string;
  thesis: string;
  explanation: string;
  analogyTitle: string;
  analogy: string;
  flow: { title: string; detail: string }[];
  question: string;
  answers: string[];
  correct: number;
  feedback: string;
};

const lessons: Lesson[] = [
  { id: 1, title: "为什么要观察 API 请求？", eyebrow: "逆向思路", minutes: 8, status: "done" },
  { id: 2, title: "Claude Code 的 Agent Loop", eyebrow: "核心概念", minutes: 12, status: "current" },
  { id: 3, title: "上下文如何不断增长", eyebrow: "上下文", minutes: 10, status: "locked" },
  { id: 4, title: "Compact 为什么像存档点", eyebrow: "记忆管理", minutes: 9, status: "locked" },
  { id: 5, title: "Todo 与短期记忆", eyebrow: "任务管理", minutes: 8, status: "locked" },
  { id: 6, title: "子 Agent 如何隔离脏上下文", eyebrow: "多 Agent", minutes: 12, status: "locked" },
];

const sourceDocuments = [
  {
    name: "how-claude-code-works",
    owner: "Windy3f3f3f3f",
    role: "入门解释",
    summary: "从产品视角解释 Claude Code 的整体运行方式，适合先建立直觉。",
    concepts: ["整体架构", "Agent Loop", "工具调用"],
    outline: ["Claude Code 是什么", "一次任务如何运行", "工具如何参与", "上下文如何变化"],
    url: "https://github.com/Windy3f3f3f3f/how-claude-code-works",
  },
  {
    name: "claude-code-from-scratch",
    owner: "Windy3f3f3f3f",
    role: "实现案例",
    summary: "通过从零实现一个简化版本，把抽象机制落实到代码结构。",
    concepts: ["最小实现", "Agent Loop", "消息结构"],
    outline: ["最小 Agent 结构", "发送模型请求", "定义与执行工具", "循环与结束条件"],
    url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch",
  },
  {
    name: "claude-code-reverse",
    owner: "Yuyz0112",
    role: "逆向证据",
    summary: "从真实请求和行为还原 Claude Code，补充上下文与记忆管理细节。",
    concepts: ["API 请求", "Context", "Compact", "Todo"],
    outline: ["逆向方法", "核心 Agent 流程", "Context 增长", "Compact 与 Todo", "子 Agent"],
    url: "https://github.com/Yuyz0112/claude-code-reverse",
  },
];

const lessonContents: Record<number, LessonContent> = {
  1: {
    title: "为什么要观察 API 请求？", eyebrow: "逆向思路", minutes: 8,
    quote: "先观察真实请求和返回，再根据证据还原系统行为，比只阅读界面更接近产品的工作原理。",
    source: "claude-code-reverse · 逆向方法",
    thesis: "观察 API 请求，就像查看系统留下的“行动记录”。",
    explanation: "界面只能告诉我们用户看见了什么，请求却会暴露模型收到的上下文、工具如何被描述，以及程序怎样把结果送回模型。这些证据能帮助我们把猜测变成可以验证的结论。",
    analogyTitle: "它像研究餐厅的后厨小票",
    analogy: "只看端上桌的菜，很难知道制作过程；查看每一张后厨小票，就能看到下单、备料、制作和出餐的先后关系。API 请求就是软件的“小票”。",
    flow: [{ title: "触发操作", detail: "在界面发起任务" }, { title: "记录请求", detail: "观察输入与工具" }, { title: "对照结果", detail: "验证行为规律" }],
    question: "为什么不能只看产品界面来理解 Agent？",
    answers: ["界面隐藏了上下文、工具描述和中间结果", "因为界面的颜色会影响模型", "因为 API 一定比界面运行得更快"],
    correct: 0,
    feedback: "界面展示的是结果，API 请求提供了还原工作流程所需的过程证据。",
  },
  2: {
    title: "Claude Code 的 Agent Loop", eyebrow: "核心概念", minutes: 12,
    quote: "当 context 足够时，会持续在当前 context 中不断 append message。定义 Agent 工作流程的核心流程的是 system workflow prompt。",
    source: "README.zh_CN.md · 核心 Agent 流程",
    thesis: "Agent Loop 就是让模型能够“做一步、看结果、再决定下一步”的循环。",
    explanation: "普通聊天机器人通常回答一次就结束。Coding Agent 不一样：当它发现需要读取文件时，会请求一个工具；程序执行工具后，把文件内容重新交给模型；模型看到新信息，再判断是继续搜索、修改代码，还是结束任务。",
    analogyTitle: "它更像一位会主动查资料的实习生",
    analogy: "你说“帮我分析这份报告”。他先打开报告，发现缺少销售数据，于是去查表格；拿到数据后继续分析，最后才向你汇报。每次“行动—获得反馈—继续判断”，就是循环的一轮。",
    flow: [{ title: "理解任务", detail: "用户想做什么？" }, { title: "调用工具", detail: "读取、搜索、修改" }, { title: "观察结果", detail: "发生了什么？" }],
    question: "为什么工具执行后，要把结果重新发给模型？",
    answers: ["为了让模型知道外部世界发生了什么，并继续判断", "因为每次调用工具都必须重新登录", "只是为了把执行记录展示给用户"],
    correct: 0,
    feedback: "模型不能直接看到文件或终端。工具结果就是它的新观察，只有放回上下文，模型才能继续推理。",
  },
};

const reviewCards = [
  {
    concept: "Agent Loop",
    question: "Coding Agent 和普通聊天机器人的关键区别是什么？",
    answer: "Agent 不只生成文本，还能调用工具，并根据工具返回的结果继续判断下一步，直到任务完成。",
    source: "claude-code-reverse · 核心 Agent 流程",
  },
  {
    concept: "Tool Result",
    question: "为什么工具执行后，还要把结果重新发送给模型？",
    answer: "模型无法直接看到外部世界。工具结果是它的新观察，只有放回上下文，模型才能基于结果继续决策。",
    source: "claude-code-from-scratch · Agent Loop",
  },
  {
    concept: "Context Compact",
    question: "上下文压缩为什么不能只删除旧消息？",
    answer: "直接删除可能丢失目标和进度。压缩需要保留用户目标、已完成工作、关键文件和下一步计划。",
    source: "claude-code-reverse · Compact",
  },
];

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [repoUrl, setRepoUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [lessonComplete, setLessonComplete] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [githubUser, setGithubUser] = useState("");
  const [starredRepos, setStarredRepos] = useState<StarredRepo[]>([]);
  const [syncingStars, setSyncingStars] = useState(false);
  const [starMessage, setStarMessage] = useState("");
  const [savedRepoIds, setSavedRepoIds] = useState<number[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState(2);
  const [repoOutlines, setRepoOutlines] = useState<Record<number, string[]>>({});
  const [outlineLoading, setOutlineLoading] = useState<number | null>(null);
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("documents");

  useEffect(() => {
    const saved = window.localStorage.getItem("starmate-lesson-complete");
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate browser-only saved progress after mount */
    setLessonComplete(saved === "true");
    setGithubUser(window.localStorage.getItem("starmate-github-user") || "");
    setSavedRepoIds(JSON.parse(window.localStorage.getItem("starmate-saved-repos") || "[]"));
    setStarredRepos(JSON.parse(window.localStorage.getItem("starmate-starred-repos") || "[]"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const completedCount = lessonComplete ? 2 : 1;
  const progress = Math.round((completedCount / lessons.length) * 100);
  const currentCard = reviewCards[cardIndex];
  const currentLesson = lessonContents[currentLessonId] || lessonContents[2];
  const graphRepos = starredRepos.filter((repo) => savedRepoIds.includes(repo.id)).slice(0, 4);

  const repoName = useMemo(() => {
    try {
      const url = new URL(repoUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : "";
    } catch {
      return "";
    }
  }, [repoUrl]);

  function importRepo(event: React.FormEvent) {
    event.preventDefault();
    if (!repoName) {
      setImportMessage("请粘贴一个完整的 GitHub 仓库链接");
      return;
    }
    setImporting(true);
    setImportMessage("");
    window.setTimeout(() => {
      setImporting(false);
      setImportMessage(`已识别 ${repoName}。演示版将用示例课程展示完整伴读流程。`);
    }, 900);
  }

  function finishLesson() {
    setLessonComplete(true);
    window.localStorage.setItem("starmate-lesson-complete", "true");
  }

  function rateCard() {
    setCardIndex((index) => (index + 1) % reviewCards.length);
    setCardRevealed(false);
  }

  async function syncGithubStars(event: React.FormEvent) {
    event.preventDefault();
    const username = githubUser.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) {
      setStarMessage("请输入正确的 GitHub 用户名，例如 Dominique170519");
      return;
    }

    setSyncingStars(true);
    setStarMessage("");
    try {
      const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/starred?per_page=30&sort=created&direction=desc`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (response.status === 404) throw new Error("没有找到这个 GitHub 用户");
      if (response.status === 403) throw new Error("GitHub 访问次数暂时用完了，请稍后再试");
      if (!response.ok) throw new Error("同步失败，请稍后再试");
      const repos = (await response.json()) as StarredRepo[];
      setStarredRepos(repos);
      window.localStorage.setItem("starmate-starred-repos", JSON.stringify(repos));
      window.localStorage.setItem("starmate-github-user", username);
      setStarMessage(repos.length ? `已同步 ${repos.length} 个最近收藏的仓库` : "这个账号还没有公开收藏的仓库");
    } catch (error) {
      setStarredRepos([]);
      setStarMessage(error instanceof Error ? error.message : "同步失败，请稍后再试");
    } finally {
      setSyncingStars(false);
    }
  }

  function toggleSavedRepo(repoId: number) {
    setSavedRepoIds((current) => {
      const next = current.includes(repoId) ? current.filter((id) => id !== repoId) : [...current, repoId];
      window.localStorage.setItem("starmate-saved-repos", JSON.stringify(next));
      return next;
    });
  }

  function openLesson(id: number) {
    if (!lessonContents[id]) return;
    setCurrentLessonId(id);
    setSelectedAnswer(null);
    setView("reader");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadRepoOutline(repo: StarredRepo) {
    if (repoOutlines[repo.id]) {
      setRepoOutlines((current) => ({ ...current, [repo.id]: [] }));
      return;
    }
    setOutlineLoading(repo.id);
    try {
      const response = await fetch(`https://api.github.com/repos/${repo.full_name}/readme`, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { content: string };
      const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, "")), (character) => character.charCodeAt(0));
      const markdown = new TextDecoder().decode(bytes);
      const headings = markdown.split("\n").map((line) => line.match(/^#{1,4}\s+(.+?)\s*#*$/)?.[1]?.trim()).filter((heading): heading is string => Boolean(heading)).slice(0, 12);
      setRepoOutlines((current) => ({ ...current, [repo.id]: headings.length ? headings : ["项目简介", "核心能力", "安装与使用", "延伸阅读"] }));
    } catch {
      setRepoOutlines((current) => ({ ...current, [repo.id]: ["项目简介", "核心概念", "使用方法", "进一步探索"] }));
    } finally {
      setOutlineLoading(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="回到首页">
          <span className="brand-mark">✦</span>
          <span>星伴读</span>
          <span className="beta">BETA</span>
        </button>
        <nav className="desktop-nav" aria-label="主导航">
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>学习台</button>
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>全局地图</button>
          <button className={view === "reader" ? "active" : ""} onClick={() => setView("reader")}>伴读</button>
          <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}>复习</button>
        </nav>
        <div className="streak"><span>连续学习</span><strong>3 天</strong></div>
      </header>

      {view === "home" && (
        <div className="page home-page">
          <section className="hero-card">
            <div className="hero-copy">
              <p className="kicker">你的 GitHub 收藏，不再吃灰</p>
              <h1>把一篇难懂的技术文章，<br /><em>变成真正学会的课程。</em></h1>
              <p className="hero-sub">AI 帮你拆解原文、解释概念、检查理解，并在恰当的时候带你复习。</p>
              <form className="import-form" onSubmit={importRepo}>
                <span className="github-icon">⌘</span>
                <input
                  aria-label="GitHub 仓库链接"
                  placeholder="粘贴 GitHub 仓库链接…"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
                <button type="submit" disabled={importing}>{importing ? "正在识别…" : "生成学习路线"}</button>
              </form>
              {importMessage && <p className="import-message" role="status">{importMessage}</p>}
              <div className="hero-meta">
                <span>✓ 公开仓库即可</span><span>✓ 无需配置</span><span>✓ 自动保存进度</span>
              </div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one"></div>
              <div className="orbit orbit-two"></div>
              <div className="book-shape">
                <div className="book-page left"><span>README</span><i></i><i></i><i></i></div>
                <div className="book-page right"><b>✦</b><i></i><i></i><i></i></div>
              </div>
              <div className="floating-chip chip-one">不懂就问</div>
              <div className="floating-chip chip-two">循序渐进</div>
            </div>
          </section>

          <section className="github-source">
            <div className="source-intro">
              <p className="overline">技术文章主来源</p>
              <h2>同步你的 GitHub Stars</h2>
              <p>输入用户名即可读取公开收藏。先从仓库介绍、README 和文档中挑选值得伴读的内容。</p>
            </div>
            <form className="stars-form" onSubmit={syncGithubStars}>
              <label htmlFor="github-user">GitHub 用户名</label>
              <div>
                <span>@</span>
                <input id="github-user" value={githubUser} onChange={(event) => setGithubUser(event.target.value)} placeholder="Dominique170519" autoComplete="username" />
                <button type="submit" disabled={syncingStars}>{syncingStars ? "同步中…" : "同步收藏"}</button>
              </div>
              <small>只读取公开数据，不需要访问令牌。未登录接口有访问频率限制。</small>
              {starMessage && <p className="stars-message" role="status">{starMessage}</p>}
            </form>
            {starredRepos.length > 0 && (
              <div className="repo-library">
                <div className="library-heading"><strong>最近收藏</strong><span>已加入伴读 {savedRepoIds.length} 篇</span></div>
                <div className="repo-grid">
                  {starredRepos.map((repo) => {
                    const saved = savedRepoIds.includes(repo.id);
                    return (
                      <article className="repo-card" key={repo.id}>
                        <div className="repo-card-top"><span>{repo.language || "技术文章"}</span><span>★ {repo.stargazers_count.toLocaleString()}</span></div>
                        <h3><a href={repo.html_url} target="_blank" rel="noreferrer">{repo.full_name}</a></h3>
                        <p>{repo.description || "这个仓库还没有简介，可以打开 README 进一步了解。"}</p>
                        <div className="repo-card-actions">
                          <a href={repo.html_url} target="_blank" rel="noreferrer">查看原文 ↗</a>
                          <button onClick={() => loadRepoOutline(repo)}>{outlineLoading === repo.id ? "拆解中…" : repoOutlines[repo.id] ? "收起大纲" : "拆解大纲"}</button>
                          <button className={saved ? "saved" : ""} onClick={() => toggleSavedRepo(repo.id)}>{saved ? "✓ 已加入" : "+ 加入伴读"}</button>
                        </div>
                        {repoOutlines[repo.id]?.length > 0 && <ol className="repo-outline">{repoOutlines[repo.id].map((heading, index) => <li key={`${heading}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{heading}</li>)}</ol>}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="dashboard-grid">
            <article className="continue-card">
              <div className="section-heading">
                <div><p className="overline">继续学习</p><h2>Claude Code 是怎么工作的？</h2></div>
                <span className="course-badge">AI Agent 入门</span>
              </div>
              <div className="course-progress">
                <div className="progress-copy"><span>学习进度</span><strong>{progress}%</strong></div>
                <div className="progress-track"><span style={{ width: `${progress}%` }}></span></div>
              </div>
              <button className="current-lesson" onClick={() => openLesson(2)}>
                <span className="lesson-number">02</span>
                <span className="lesson-info"><small>下一节 · 约 12 分钟</small><strong>Claude Code 的 Agent Loop</strong></span>
                <span className="play-button">→</span>
              </button>
              <div className="course-stats">
                <span><strong>{completedCount}</strong> / 6 节</span>
                <span><strong>4</strong> 个概念已掌握</span>
                <span><strong>28</strong> 分钟已投入</span>
              </div>
            </article>

            <aside className="review-widget">
              <div className="review-top"><span className="review-icon">↻</span><div><p className="overline">今日复习</p><h2>3 个概念</h2></div></div>
              <p>趁记忆还热，再用 5 分钟巩固一下。</p>
              <div className="mini-concepts"><span>Agent Loop</span><span>Tool Result</span><span>Context</span></div>
              <button onClick={() => setView("review")}>开始复习 <span>→</span></button>
            </aside>
          </section>

          <section className="how-section">
            <div className="section-heading"><div><p className="overline">伴读不是总结</p><h2>每一步，都让你更接近“真正理解”</h2></div></div>
            <div className="feature-row">
              <button className="feature-card" onClick={() => setView("overview")}><span>01</span><div className="feature-symbol coral">◎</div><h3>先看全局地图</h3><p>先看重点、知识关系和完整大纲，再决定从哪里开始。</p><b>打开地图 →</b></button>
              <button className="feature-card" onClick={() => openLesson(2)}><span>02</span><div className="feature-symbol purple">≋</div><h3>一次讲透一点</h3><p>原文、小白解释和生活类比放在一起。</p><b>进入伴读 →</b></button>
              <button className="feature-card" onClick={() => openLesson(1)}><span>03</span><div className="feature-symbol yellow">?</div><h3>提问检查理解</h3><p>答错就换一种说法，答对再逐步加深。</p><b>试一道题 →</b></button>
              <button className="feature-card" onClick={() => setView("review")}><span>04</span><div className="feature-symbol green">↗</div><h3>在遗忘前复习</h3><p>根据你的掌握度，安排真正需要的回忆题。</p><b>开始复习 →</b></button>
            </div>
          </section>
        </div>
      )}

      {view === "overview" && (
        <div className="page overview-page">
          <button className="back-link" onClick={() => setView("home")}>← 返回学习台</button>
          <header className="overview-hero">
            <div><p className="kicker">先总览，再深入</p><h1>Claude Code<br /><em>全局学习地图</em></h1></div>
            <p>这门课不是六篇互不相干的笔记。它围绕一条主线展开：Agent 如何观察环境、循环行动、管理记忆，并在复杂任务中保持方向。</p>
          </header>

          <section className="takeaway-grid">
            <article><span>01</span><strong>核心机制</strong><p>Agent Loop 让模型能调用工具、观察结果，再决定下一步。</p></article>
            <article><span>02</span><strong>关键限制</strong><p>上下文会持续增长，因此需要 Compact、Todo 和子 Agent 管理信息。</p></article>
            <article><span>03</span><strong>阅读目标</strong><p>最终能用“输入—行动—观察—记忆”解释一个 Coding Agent。</p></article>
          </section>

          <nav className="overview-modes" aria-label="学习方式">
            <button className={overviewMode === "documents" ? "active" : ""} onClick={() => setOverviewMode("documents")}><span>01</span><strong>按文档阅读</strong><small>保留每篇原文结构</small></button>
            <button className={overviewMode === "topic" ? "active" : ""} onClick={() => setOverviewMode("topic")}><span>02</span><strong>按主题学习</strong><small>AI 综合多篇资料</small></button>
            <button className={overviewMode === "graph" ? "active" : ""} onClick={() => setOverviewMode("graph")}><span>03</span><strong>探索知识图谱</strong><small>查看文档与概念关系</small></button>
          </nav>

          {overviewMode === "documents" && (
            <section className="mode-panel">
              <div className="mode-heading"><div><p className="overline">原文视角</p><h2>一篇文档，一套独立大纲</h2></div><p>这里不混合多篇资料。每张卡片展示该仓库自己的定位、概念和 README 结构。</p></div>
              <div className="document-list">
                {sourceDocuments.map((document, index) => (
                  <article className="document-card" key={document.name}>
                    <div className="document-number">0{index + 1}</div>
                    <div className="document-main"><span className="relation-badge">{document.role}</span><h3>{document.name}</h3><small>{document.owner}</small><p>{document.summary}</p><div className="concept-tags">{document.concepts.map((concept) => <span key={concept}>{concept}</span>)}</div></div>
                    <div className="document-outline"><strong>原文大纲</strong><ol>{document.outline.map((item) => <li key={item}>{item}</li>)}</ol><a href={document.url} target="_blank" rel="noreferrer">查看原文 ↗</a></div>
                  </article>
                ))}
                {graphRepos.map((repo) => <article className="document-card imported" key={repo.id}><div className="document-number">★</div><div className="document-main"><span className="relation-badge">我的收藏</span><h3>{repo.full_name}</h3><p>{repo.description || "尚未提供简介"}</p></div><div className="document-outline"><strong>个性化拆解</strong><p>回到学习台点击“拆解大纲”，即可读取这篇 README 的真实目录。</p><a href={repo.html_url} target="_blank" rel="noreferrer">查看原文 ↗</a></div></article>)}
              </div>
            </section>
          )}

          {overviewMode === "topic" && (
            <section className="mode-panel">
              <div className="mode-heading"><div><p className="overline">AI 生成 · 跨 3 篇资料</p><h2>主题路线：Claude Code 如何工作</h2></div><p>这不是任何一篇文章的原目录。AI 按学习顺序重组内容，每节都标明引用来源。</p></div>
              <div className="topic-legend"><span>路线逻辑</span><b>观察证据</b><i>→</i><b>理解行动</b><i>→</i><b>理解记忆</b><i>→</i><b>管理复杂度</b></div>
              <div className="course-outline topic-outline">
                {lessons.map((lesson, index) => {
                  const sources = index === 0 ? ["reverse"] : index === 1 ? ["works", "from-scratch", "reverse"] : index < 4 ? ["works", "reverse"] : ["from-scratch", "reverse"];
                  return <button key={lesson.id} onClick={() => openLesson(lesson.id)} disabled={!lessonContents[lesson.id]}><span>{String(lesson.id).padStart(2, "0")}</span><div><small>{index < 2 ? "第一章 · Agent 如何行动" : index < 4 ? "第二章 · 上下文与记忆" : "第三章 · 复杂任务治理"}</small><strong>{lesson.title}</strong><p>{["从真实请求找到逆向证据。", "理解工具调用与观察结果的循环。", "解释消息为什么持续积累。", "理解压缩如何保留目标与进度。", "看懂任务列表怎样维持方向。", "理解隔离上下文如何降低干扰。"][index]}</p><div className="source-tags">来源：{sources.map((source) => <em key={source}>{source}</em>)}</div></div><b>{lessonContents[lesson.id] ? "开始阅读 →" : "即将开放"}</b></button>;
                })}
              </div>
            </section>
          )}

          {overviewMode === "graph" && (
            <section className="mode-panel graph-panel">
              <div className="mode-heading"><div><p className="overline">可解释知识图谱</p><h2>每条关系都说明“为什么相连”</h2></div><p>黄色是文档，紫色是概念；中间标签是关系类型。下面先展示文档之间的关系，再展示文档与概念的关系。</p></div>
              <div className="graph-legend"><span className="legend-document">文档</span><span className="legend-concept">概念</span><span className="legend-relation">关系说明</span></div>
              <h3 className="graph-subtitle">文档之间</h3>
              <div className="relation-list">
                <div className="relation-row"><strong>how-claude-code-works</strong><span>理论 → 实现</span><strong>claude-code-from-scratch</strong><p>前者建立整体直觉，后者用最小代码验证机制。</p></div>
                <div className="relation-row"><strong>claude-code-reverse</strong><span>证据补充</span><strong>how-claude-code-works</strong><p>逆向请求为入门文章中的流程解释提供真实证据。</p></div>
                <div className="relation-row"><strong>claude-code-reverse</strong><span>机制验证</span><strong>claude-code-from-scratch</strong><p>一个观察真实产品，一个实现简化版本，可相互对照。</p></div>
              </div>
              <h3 className="graph-subtitle">文档与核心概念</h3>
              <div className="concept-relation-grid">
                {sourceDocuments.map((document) => <div className="concept-relation" key={document.name}><strong>{document.name}</strong><span>主要讲解</span><div>{document.concepts.map((concept) => <b key={concept}>{concept}</b>)}</div><p>{document.summary}</p></div>)}
              </div>
            </section>
          )}
        </div>
      )}

      {view === "reader" && (
        <div className="reader-layout">
          <aside className="lesson-sidebar">
            <button className="back-link" onClick={() => setView("home")}>← 返回学习台</button>
            <p className="overline">当前课程</p>
            <h2>Claude Code<br />是怎么工作的？</h2>
            <div className="side-progress"><span style={{ width: `${progress}%` }}></span></div>
            <div className="lesson-list">
              {lessons.map((lesson) => {
                const done = lesson.id === 2 ? lessonComplete : lesson.status === "done";
                return (
                  <button key={lesson.id} className={`lesson-item ${lesson.id === currentLessonId ? "selected" : ""}`} disabled={!lessonContents[lesson.id]} onClick={() => openLesson(lesson.id)}>
                    <span>{done ? "✓" : String(lesson.id).padStart(2, "0")}</span>
                    <div><small>{lesson.eyebrow} · {lesson.minutes} 分钟</small><strong>{lesson.title}</strong></div>
                  </button>
                );
              })}
            </div>
          </aside>

          <article className="reading-pane">
            <div className="reading-header">
              <div><p className="kicker">第 {currentLessonId} 节 · {currentLesson.eyebrow}</p><h1>{currentLesson.title}</h1></div>
              <span className="reading-time">约 {currentLesson.minutes} 分钟</span>
            </div>

            <div className="source-card">
              <div className="source-label"><span>原文说</span><a href="https://github.com/Yuyz0112/claude-code-reverse" target="_blank" rel="noreferrer">查看 GitHub ↗</a></div>
              <blockquote>{currentLesson.quote}</blockquote>
              <p>来源：{currentLesson.source}</p>
            </div>

            <section className="explain-section">
              <p className="overline">先用一句话理解</p>
              <h2>{currentLesson.thesis}</h2>
              <p>{currentLesson.explanation}</p>
              <div className="loop-diagram" aria-label="Agent Loop 流程图">
                {currentLesson.flow.map((step, index) => <div key={step.title}><span>{index + 1}</span><strong>{step.title}</strong><small>{step.detail}</small></div>)}
              </div>
            </section>

            <aside className="analogy-card">
              <span className="analogy-emoji">☕</span>
              <div><p className="overline">换个生活中的例子</p><h3>{currentLesson.analogyTitle}</h3><p>{currentLesson.analogy}</p></div>
            </aside>

            <section className="checkpoint">
              <div className="checkpoint-title"><span>?</span><div><p className="overline">理解检查</p><h2>{currentLesson.question}</h2></div></div>
              <div className="answers">
                {currentLesson.answers.map((answer, index) => (
                  <button
                    key={answer}
                    className={`${selectedAnswer === index ? "chosen" : ""} ${selectedAnswer !== null && index === currentLesson.correct ? "correct" : ""}`}
                    onClick={() => setSelectedAnswer(index)}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>{answer}
                  </button>
                ))}
              </div>
              {selectedAnswer !== null && (
                <div className={`feedback ${selectedAnswer === currentLesson.correct ? "good" : "retry"}`}>
                  <strong>{selectedAnswer === currentLesson.correct ? "答对了！" : "再想一步"}</strong>
                  <p>{selectedAnswer === currentLesson.correct ? currentLesson.feedback : "回到上面的“一句话理解”，找出界面背后真正缺少的那部分信息。"}</p>
                </div>
              )}
            </section>

            <div className="lesson-navigation">
              <button onClick={() => openLesson(currentLessonId - 1)} disabled={!lessonContents[currentLessonId - 1]}>← 上一节</button>
              {currentLessonId === 2 ? <button className="finish-button" onClick={finishLesson} disabled={lessonComplete}>{lessonComplete ? "✓ 本节已完成" : "我理解了，完成本节"}</button> : <button className="finish-button" onClick={() => openLesson(2)}>下一节：Agent Loop →</button>}
            </div>
          </article>

          <aside className="mentor-panel">
            <div className="mentor-heading"><span className="mentor-avatar">✦</span><div><strong>伴读老师</strong><small>围绕当前原文回答</small></div></div>
            <div className="mentor-message">读到这里有哪里卡住吗？你可以让我换个例子，或者继续追问。</div>
            <div className="prompt-chips"><button>再简单一点</button><button>举一个产品例子</button><button>这和 RAG 有什么关系？</button></div>
            <div className="mentor-input"><input aria-label="向伴读老师提问" placeholder="输入你的问题…" /><button aria-label="发送问题">↑</button></div>
            <p className="grounding-note">回答将优先引用当前仓库原文</p>
          </aside>
        </div>
      )}

      {view === "review" && (
        <div className="page review-page">
          <div className="review-header">
            <div><p className="kicker">今日复习 · 约 5 分钟</p><h1>趁记忆还热，<em>主动想一次。</em></h1><p>先在心里回答，再查看答案。回忆比重读更能帮助你记住。</p></div>
            <div className="review-count"><strong>{cardIndex + 1}</strong><span>/ {reviewCards.length}</span></div>
          </div>
          <div className={`flashcard ${cardRevealed ? "revealed" : ""}`}>
            <div className="flashcard-top"><span>{currentCard.concept}</span><small>{currentCard.source}</small></div>
            <div className="flashcard-body">
              <p className="overline">请回忆</p>
              <h2>{currentCard.question}</h2>
              {!cardRevealed ? (
                <button className="reveal-button" onClick={() => setCardRevealed(true)}>查看答案</button>
              ) : (
                <div className="answer-reveal"><p className="overline">参考答案</p><p>{currentCard.answer}</p></div>
              )}
            </div>
          </div>
          {cardRevealed && (
            <div className="confidence-row">
              <p>刚才想起来了吗？</p>
              <div><button onClick={rateCard}>没想起来 <small>明天再问</small></button><button onClick={rateCard}>有点模糊 <small>3 天后</small></button><button onClick={rateCard}>很清楚 <small>7 天后</small></button></div>
            </div>
          )}
          <div className="review-progress"><span style={{ width: `${((cardIndex + (cardRevealed ? 0.5 : 0)) / reviewCards.length) * 100}%` }}></span></div>
        </div>
      )}

      <nav className="mobile-nav" aria-label="手机导航">
        <button className={view === "home" || view === "overview" ? "active" : ""} onClick={() => setView("home")}><span>⌂</span>学习台</button>
        <button className={view === "reader" ? "active" : ""} onClick={() => setView("reader")}><span>▤</span>伴读</button>
        <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}><span>↻</span>复习</button>
      </nav>
    </main>
  );
}
