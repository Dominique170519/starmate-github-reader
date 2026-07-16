"use client";

import { useEffect, useMemo, useState } from "react";

type View = "home" | "reader" | "review";

type Lesson = {
  id: number;
  title: string;
  eyebrow: string;
  minutes: number;
  status: "done" | "current" | "locked";
};

const lessons: Lesson[] = [
  { id: 1, title: "为什么要观察 API 请求？", eyebrow: "逆向思路", minutes: 8, status: "done" },
  { id: 2, title: "Claude Code 的 Agent Loop", eyebrow: "核心概念", minutes: 12, status: "current" },
  { id: 3, title: "上下文如何不断增长", eyebrow: "上下文", minutes: 10, status: "locked" },
  { id: 4, title: "Compact 为什么像存档点", eyebrow: "记忆管理", minutes: 9, status: "locked" },
  { id: 5, title: "Todo 与短期记忆", eyebrow: "任务管理", minutes: 8, status: "locked" },
  { id: 6, title: "子 Agent 如何隔离脏上下文", eyebrow: "多 Agent", minutes: 12, status: "locked" },
];

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

  useEffect(() => {
    const saved = window.localStorage.getItem("starmate-lesson-complete");
    setLessonComplete(saved === "true");
  }, []);

  const completedCount = lessonComplete ? 2 : 1;
  const progress = Math.round((completedCount / lessons.length) * 100);
  const currentCard = reviewCards[cardIndex];

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
              <button className="current-lesson" onClick={() => setView("reader")}>
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
              <div className="feature-card"><span>01</span><div className="feature-symbol coral">◎</div><h3>先看全局地图</h3><p>知道为什么读、先学什么，不在文件树里迷路。</p></div>
              <div className="feature-card"><span>02</span><div className="feature-symbol purple">≋</div><h3>一次讲透一点</h3><p>原文、小白解释和生活类比放在一起。</p></div>
              <div className="feature-card"><span>03</span><div className="feature-symbol yellow">?</div><h3>提问检查理解</h3><p>答错就换一种说法，答对再逐步加深。</p></div>
              <div className="feature-card"><span>04</span><div className="feature-symbol green">↗</div><h3>在遗忘前复习</h3><p>根据你的掌握度，安排真正需要的回忆题。</p></div>
            </div>
          </section>
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
                  <button key={lesson.id} className={`lesson-item ${lesson.id === 2 ? "selected" : ""}`} disabled={lesson.status === "locked" && !done}>
                    <span>{done ? "✓" : String(lesson.id).padStart(2, "0")}</span>
                    <div><small>{lesson.eyebrow} · {lesson.minutes} 分钟</small><strong>{lesson.title}</strong></div>
                  </button>
                );
              })}
            </div>
          </aside>

          <article className="reading-pane">
            <div className="reading-header">
              <div><p className="kicker">第 2 节 · 核心概念</p><h1>Claude Code 的 Agent Loop</h1></div>
              <span className="reading-time">约 12 分钟</span>
            </div>

            <div className="source-card">
              <div className="source-label"><span>原文说</span><a href="https://github.com/Yuyz0112/claude-code-reverse" target="_blank" rel="noreferrer">查看 GitHub ↗</a></div>
              <blockquote>当 context 足够时，会持续在当前 context 中不断 append message。定义 Agent 工作流程的核心流程的是 system workflow prompt。</blockquote>
              <p>来源：README.zh_CN.md · 核心 Agent 流程</p>
            </div>

            <section className="explain-section">
              <p className="overline">先用一句话理解</p>
              <h2>Agent Loop 就是让模型能够“做一步、看结果、再决定下一步”的循环。</h2>
              <p>普通聊天机器人通常回答一次就结束。Coding Agent 不一样：当它发现需要读取文件时，会请求一个工具；程序执行工具后，把文件内容重新交给模型；模型看到新信息，再判断是继续搜索、修改代码，还是结束任务。</p>
              <div className="loop-diagram" aria-label="Agent Loop 流程图">
                <div><span>1</span><strong>理解任务</strong><small>用户想做什么？</small></div><b>→</b>
                <div><span>2</span><strong>调用工具</strong><small>读取、搜索、修改</small></div><b>→</b>
                <div><span>3</span><strong>观察结果</strong><small>发生了什么？</small></div><b>↻</b>
              </div>
            </section>

            <aside className="analogy-card">
              <span className="analogy-emoji">☕</span>
              <div><p className="overline">换个生活中的例子</p><h3>它更像一位会主动查资料的实习生</h3><p>你说“帮我分析这份报告”。他先打开报告，发现缺少销售数据，于是去查表格；拿到数据后继续分析，最后才向你汇报。每次“行动—获得反馈—继续判断”，就是循环的一轮。</p></div>
            </aside>

            <section className="checkpoint">
              <div className="checkpoint-title"><span>?</span><div><p className="overline">理解检查</p><h2>为什么工具执行后，要把结果重新发给模型？</h2></div></div>
              <div className="answers">
                {["为了让模型知道外部世界发生了什么，并继续判断", "因为每次调用工具都必须重新登录", "只是为了把执行记录展示给用户"].map((answer, index) => (
                  <button
                    key={answer}
                    className={`${selectedAnswer === index ? "chosen" : ""} ${selectedAnswer !== null && index === 0 ? "correct" : ""}`}
                    onClick={() => setSelectedAnswer(index)}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>{answer}
                  </button>
                ))}
              </div>
              {selectedAnswer !== null && (
                <div className={`feedback ${selectedAnswer === 0 ? "good" : "retry"}`}>
                  <strong>{selectedAnswer === 0 ? "答对了！" : "再想一步"}</strong>
                  <p>{selectedAnswer === 0 ? "模型不能直接看到文件或终端。工具结果就是它的新观察，只有放回上下文，模型才能继续推理。" : "模型无法直接观察电脑中的变化。想想它怎样才能知道刚才读取到了什么。"}</p>
                </div>
              )}
            </section>

            <button className="finish-button" onClick={finishLesson} disabled={lessonComplete}>
              {lessonComplete ? "✓ 本节已完成" : "我理解了，完成本节"}
            </button>
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
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><span>⌂</span>学习台</button>
        <button className={view === "reader" ? "active" : ""} onClick={() => setView("reader")}><span>▤</span>伴读</button>
        <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}><span>↻</span>复习</button>
      </nav>
    </main>
  );
}
