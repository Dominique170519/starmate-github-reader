"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EMBEDDED_READMES } from "./embedded-readmes";

type View = "home" | "overview" | "reader" | "review";
type OverviewMode = "documents" | "topic" | "path" | "graph";

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

type MentorMessage = {
  id: number;
  role: "user" | "teacher";
  title?: string;
  content: string;
  quote?: string;
  source?: string;
  pending?: boolean;
  error?: boolean;
  check?: { question: string; options: string[]; correct: number; feedback: string };
};

type MentorStatus = "checking" | "ready" | "unconfigured" | "error";

type LearningPathLayer = {
  type: "地图" | "原理" | "实验" | "实现" | "证据";
  title: string;
  learn: string;
  method: string;
  proof: string;
  links: { label: string; url: string }[];
};

type RepositoryLearningPath = {
  name: string;
  owner: string;
  role: string;
  summary: string;
  duration: string;
  layers: LearningPathLayer[];
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
    readingTime: "约 18 分钟",
    focus: "先建立整体直觉，不需要提前理解代码实现。",
    sections: [
      { title: "Claude Code 是什么", purpose: "认识 Coding Agent 与普通聊天机器人的差别", points: ["从回答问题到执行任务", "模型、工具和运行环境"] },
      { title: "一次任务如何运行", purpose: "抓住输入—行动—观察的主循环", points: ["任务如何进入模型", "模型何时决定继续或结束"] },
      { title: "工具如何参与", purpose: "理解模型为什么能读文件和执行命令", points: ["工具定义", "工具调用", "结果回传"] },
      { title: "上下文如何变化", purpose: "为后续理解 Compact 建立前置知识", points: ["消息持续追加", "上下文窗口限制"] },
    ],
    url: "https://github.com/Windy3f3f3f3f/how-claude-code-works",
  },
  {
    name: "claude-code-from-scratch",
    owner: "Windy3f3f3f3f",
    role: "实现案例",
    summary: "通过从零实现一个简化版本，把抽象机制落实到代码结构。",
    concepts: ["最小实现", "Agent Loop", "消息结构"],
    outline: ["最小 Agent 结构", "发送模型请求", "定义与执行工具", "循环与结束条件"],
    readingTime: "约 25 分钟",
    focus: "带着“每段代码属于循环的哪一步”这个问题阅读。",
    sections: [
      { title: "最小 Agent 结构", purpose: "看清一个 Agent 最少需要哪些模块", points: ["模型客户端", "工具注册表", "循环控制器"] },
      { title: "发送模型请求", purpose: "理解消息如何进入模型", points: ["System Prompt", "用户消息", "历史上下文"] },
      { title: "定义与执行工具", purpose: "把模型决策转换成真实行动", points: ["工具参数", "本地执行", "错误处理"] },
      { title: "循环与结束条件", purpose: "将请求、行动和观察串成完整 Agent Loop", points: ["追加 Tool Result", "继续推理", "返回最终答案"] },
    ],
    url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch",
  },
  {
    name: "claude-code-reverse",
    owner: "Yuyz0112",
    role: "逆向证据",
    summary: "从真实请求和行为还原 Claude Code，补充上下文与记忆管理细节。",
    concepts: ["API 请求", "Context", "Compact", "Todo"],
    outline: ["逆向方法", "核心 Agent 流程", "Context 增长", "Compact 与 Todo", "子 Agent"],
    readingTime: "约 35 分钟",
    focus: "重点看证据与结论如何对应，不必记住所有请求字段。",
    sections: [
      { title: "逆向方法", purpose: "学习怎样从真实请求还原产品行为", points: ["捕获 API 请求", "区分事实与推测"] },
      { title: "核心 Agent 流程", purpose: "用请求记录验证 Agent Loop", points: ["System Workflow Prompt", "消息追加", "工具结果"] },
      { title: "Context 增长", purpose: "理解长任务为什么越来越消耗上下文", points: ["历史消息", "文件内容", "工具输出"] },
      { title: "Compact 与 Todo", purpose: "看懂长期记忆与短期方向如何配合", points: ["压缩保留什么", "Todo 解决什么"] },
      { title: "子 Agent", purpose: "理解复杂任务中的上下文隔离", points: ["独立上下文", "结果汇总", "降低干扰"] },
    ],
    url: "https://github.com/Yuyz0112/claude-code-reverse",
  },
];

const repositoryLearningPaths: RepositoryLearningPath[] = [
  {
    name: "how-claude-code-works",
    owner: "Windy3f3f3f3f",
    role: "先建立系统认知",
    summary: "先抓住 Agent Loop、工具、上下文和安全四条主线，再进入进阶能力，不需要机械读完所有章节。",
    duration: "建议 5～7 天",
    layers: [
      {
        type: "地图", title: "README + 10 分钟快速入门",
        learn: "知道系统由哪些模块组成，以及每个模块解决什么问题。",
        method: "第一遍只扫结构并记录陌生概念，不追逐实现细节。",
        proof: "不看文章，能画出用户、模型、工具与上下文的关系。",
        links: [
          { label: "README", url: "https://github.com/Windy3f3f3f3f/how-claude-code-works" },
          { label: "快速入门", url: "https://github.com/Windy3f3f3f3f/how-claude-code-works/blob/main/docs/quick-start.md" },
        ],
      },
      {
        type: "原理", title: "概述 → Loop → 工具 → 上下文",
        learn: "理解 Agent 如何行动、工具结果为什么要回到模型，以及长任务为什么需要压缩。",
        method: "每章只回答：解决什么问题、没有它会怎样、它位于循环哪一步。",
        proof: "能用自己的话解释一次任务如何从用户输入走到最终答案。",
        links: [
          { label: "Agent Loop", url: "https://github.com/Windy3f3f3f3f/how-claude-code-works/blob/main/docs/02-agent-loop.md" },
          { label: "工具系统", url: "https://github.com/Windy3f3f3f3f/how-claude-code-works/blob/main/docs/04-tool-system.md" },
          { label: "上下文", url: "https://github.com/Windy3f3f3f3f/how-claude-code-works/blob/main/docs/03-context-engineering.md" },
        ],
      },
      {
        type: "实验", title: "把机制画成数据流",
        learn: "把抽象名词变成可以追踪的输入、行动、结果和下一轮决策。",
        method: "选择一个“读取并修改文件”的任务，手动画出每轮消息和工具结果。",
        proof: "能指出任意一步缺失后，Agent 会在哪里失去信息或停止工作。",
        links: [{ label: "主循环章节", url: "https://github.com/Windy3f3f3f3f/how-claude-code-works/blob/main/docs/02-agent-loop.md" }],
      },
      {
        type: "实现", title: "七个最小必要组件",
        learn: "区分 Agent 的本质复杂性与生产系统为了可靠性增加的复杂性。",
        method: "先读七个组件，再去 from-scratch 找对应代码，不直接钻进大型源码。",
        proof: "能说清最小 Agent 为什么至少需要循环、工具注册、文件操作与交互层。",
        links: [{ label: "最小组件", url: "https://github.com/Windy3f3f3f3f/how-claude-code-works/blob/main/docs/13-minimal-components.md" }],
      },
      {
        type: "证据", title: "安全与可观测性",
        learn: "理解“能运行”不等于“可上线”，生产 Agent 还需要权限、日志与恢复。",
        method: "为每项设计写下它防止的具体故障，不背层数和术语。",
        proof: "面对危险命令或长任务，能说明系统应该记录什么、拦截什么。",
        links: [
          { label: "权限安全", url: "https://github.com/Windy3f3f3f3f/how-claude-code-works/blob/main/docs/11-permission-security.md" },
          { label: "可观测性", url: "https://github.com/Windy3f3f3f3f/how-claude-code-works/blob/main/docs/16-observability.md" },
        ],
      },
    ],
  },
  {
    name: "claude-code-from-scratch",
    owner: "Windy3f3f3f3f",
    role: "再把原理运行起来",
    summary: "重点使用 steps 的逐章快照：先运行，再看本章 diff，最后做一个小修改，而不是通读巨型成品文件。",
    duration: "建议 10～14 天",
    layers: [
      {
        type: "地图", title: "README + 教程目录",
        learn: "知道 15 章分别给最小 Agent 增加了什么能力。",
        method: "选择 TypeScript 或 Python 一条主线，不在第一遍同时学两个版本。",
        proof: "能把章节分成核心循环、上下文能力、扩展能力三组。",
        links: [
          { label: "README", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch" },
          { label: "教程目录", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/tree/main/docs" },
        ],
      },
      {
        type: "原理", title: "先读循环、工具、提示词",
        learn: "理解一次模型请求怎样变成多轮工具调用，而不是只记函数名。",
        method: "每读完一章，先预测程序输出，再运行验证。",
        proof: "能解释工具定义、工具执行与 Tool Result 为什么缺一不可。",
        links: [
          { label: "Agent Loop", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/blob/main/docs/01-agent-loop.md" },
          { label: "工具", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/blob/main/docs/02-tools.md" },
          { label: "提示词", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/blob/main/docs/03-system-prompt.md" },
        ],
      },
      {
        type: "实验", title: "运行 steps，不需要 API Key",
        learn: "亲眼观察每章新增能力带来的行为变化。",
        method: "依次运行 run.mjs N 和 run.mjs N --diff，一次只推进一个步骤。",
        proof: "不看答案，也能预测本章会产生哪个工具调用或状态变化。",
        links: [
          { label: "运行说明", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/blob/main/steps/README.md" },
          { label: "场景脚本", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/tree/main/steps/scenarios" },
        ],
      },
      {
        type: "实现", title: "读 canonical，而不是巨型成品",
        learn: "找到 agent、tools、context、permissions、memory 与 subagent 的连接点。",
        method: "先看当前步骤 diff，再回到 canonical 找完整上下文；自己增加一个小工具。",
        proof: "可以新增工具、让模型调用它，并把结果送回下一轮。",
        links: [
          { label: "TypeScript", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/tree/main/steps/canonical/ts" },
          { label: "Python", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/tree/main/steps/canonical/py" },
        ],
      },
      {
        type: "证据", title: "用测试证明不是“看起来能跑”",
        learn: "验证权限阻断、上下文压缩、子 Agent 隔离和 MCP 调用。",
        method: "先读一个 scenario，再读对应测试断言；修改代码后重新跑测试。",
        proof: "能为自己新增的工具补一条可重复、无真实模型依赖的测试。",
        links: [
          { label: "测试指南", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/blob/main/test/TEST-GUIDE.md" },
          { label: "集成测试", url: "https://github.com/Windy3f3f3f3f/claude-code-from-scratch/tree/main/test/integration" },
        ],
      },
    ],
  },
  {
    name: "claude-code-reverse",
    owner: "Yuyz0112",
    role: "最后训练证据思维",
    summary: "不要先读 v1 的超大反编译文件。优先读 prompts、tools、logs，并区分真实请求证据与作者推断。",
    duration: "建议 5～7 天",
    layers: [
      {
        type: "地图", title: "README 的分析结果部分",
        learn: "知道仓库观察了主循环、Compact、Todo、IDE 与子 Agent 等场景。",
        method: "先选择一个研究问题，例如“子 Agent 如何隔离上下文”。",
        proof: "能写出一个明确、可以被日志验证的研究问题。",
        links: [{ label: "README 中文", url: "https://github.com/Yuyz0112/claude-code-reverse/blob/main/README.zh_CN.md" }],
      },
      {
        type: "原理", title: "Workflow Prompt + Tools",
        learn: "理解模型被要求怎样工作，以及工具暴露了哪些能力和约束。",
        method: "先读 workflow，再只挑 Read、Edit、Bash、TodoWrite、Task 五个工具。",
        proof: "能区分提示词规定的行为与程序代码强制执行的行为。",
        links: [
          { label: "Workflow", url: "https://github.com/Yuyz0112/claude-code-reverse/blob/main/results/prompts/system-workflow.prompt.md" },
          { label: "Tools", url: "https://github.com/Yuyz0112/claude-code-reverse/tree/main/results/tools" },
        ],
      },
      {
        type: "实验", title: "对比三类运行日志",
        learn: "观察 basic、compact、sub-agent 场景中的请求和上下文结构变化。",
        method: "一次只比较一个变量，用可视化工具定位新增或消失的内容。",
        proof: "能从日志中标出一条直接支持结论的请求或 Tool Result。",
        links: [
          { label: "Logs", url: "https://github.com/Yuyz0112/claude-code-reverse/tree/main/logs" },
          { label: "可视化", url: "https://yuyz0112.github.io/claude-code-reverse/visualize.html" },
        ],
      },
      {
        type: "实现", title: "读 parser.js 的结构化逻辑",
        learn: "理解原始日志怎样被拆成 conversation、prompt 与 tool definition。",
        method: "沿着 parseConversationLog 追踪一条输入，观察注册、去重与归类。",
        proof: "能说明 prompts、tool_defs 与 conversations 分别来自哪里。",
        links: [{ label: "parser.js", url: "https://github.com/Yuyz0112/claude-code-reverse/blob/main/parser.js" }],
      },
      {
        type: "证据", title: "制作结论—证据—可信度表",
        learn: "避免把一次观察、作者解释和真实内部实现混成同一种事实。",
        method: "每个结论记录证据位置、其他可能解释与当前可信度。",
        proof: "能明确说出一条日志可以证明什么，以及仍然不能证明什么。",
        links: [
          { label: "Prompts", url: "https://github.com/Yuyz0112/claude-code-reverse/tree/main/results/prompts" },
          { label: "Tool 定义", url: "https://github.com/Yuyz0112/claude-code-reverse/tree/main/results/tools" },
        ],
      },
    ],
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

type MarkdownBlock = { type: "heading" | "paragraph" | "list" | "quote" | "code"; text: string; level?: number; section?: number };

type SectionGuide = {
  title: string;
  eyebrow: string;
  minutes: number;
  quote: string;
  source: string;
  thesis: string;
  explanation: string;
  flow: { title: string; detail: string }[];
  keyPoints: string[];
  analogyEmoji: string;
  analogyTitle: string;
  analogy: string;
  question: string;
  answers: string[];
  correct: number;
  feedback: string;
};

const guideProfiles: Record<string, {
  eyebrow: string;
  lens: string;
  flow: { title: string; detail: string }[];
  fallbackAnalogy: { emoji: string; title: string; text: string };
}> = {
  "how-claude-code-works": {
    eyebrow: "产品原理视角",
    lens: "先看全局，再把模型、工具和运行环境连成一条数据流",
    flow: [{ title: "看全局", detail: "这一节位于系统的哪一层" }, { title: "找模块", detail: "谁负责判断，谁负责行动" }, { title: "连流程", detail: "信息怎样进入下一轮" }],
    fallbackAnalogy: { emoji: "🗺️", title: "像先看商场导览图", text: "先知道楼层、区域和动线，再进入某家店看细节。理解系统也是先建立地图，再研究局部。" },
  },
  "claude-code-from-scratch": {
    eyebrow: "动手实现视角",
    lens: "把抽象概念对应到可以运行的代码、输入和输出",
    flow: [{ title: "找到代码", detail: "这一节新增了什么结构" }, { title: "运行观察", detail: "输入后实际发生了什么" }, { title: "对应原理", detail: "它属于 Agent Loop 哪一步" }],
    fallbackAnalogy: { emoji: "🧩", title: "像照着图纸拼积木", text: "每章只增加一个能运行的小零件，最终把模型请求、工具和循环拼成完整系统。" },
  },
  "claude-code-reverse": {
    eyebrow: "运行证据视角",
    lens: "从 API 请求和运行日志出发，区分真实证据与作者推断",
    flow: [{ title: "捕获行为", detail: "先记录真实请求或日志" }, { title: "对比变化", detail: "观察不同任务里的共同结构" }, { title: "形成结论", detail: "用证据解释产品机制" }],
    fallbackAnalogy: { emoji: "🧾", title: "像根据后厨小票还原流程", text: "不进入后厨，也能通过每张小票的时间和内容，还原下单、制作与出餐的顺序。" },
  },
};

const guideIntents = [
  { match: /architecture|架构|结构/i, purpose: "看清系统由哪些部分组成，以及它们怎样协作", focus: "模块、边界和信息流", analogy: { emoji: "🏗️", title: "像看一栋楼的结构图", text: "先分清承重结构、管线和房间用途，才能理解一个局部改动会影响哪里。" } },
  { match: /quick start|快速开始|每章代码|教程|tutorial/i, purpose: "知道怎样开始动手，并验证示例确实可以运行", focus: "前置条件、执行步骤和可观察结果", analogy: { emoji: "🧪", title: "像第一次做实验", text: "先按步骤搭好环境，再观察结果是否符合预期；跑通比一次记住全部原理更重要。" } },
  { match: /monkey patch|api request|请求/i, purpose: "理解怎样截获模型请求，并把黑盒行为变成可观察证据", focus: "拦截位置、请求内容和记录方式", analogy: { emoji: "📮", title: "像在邮局中转站复印信件", text: "不改变信件的目的地，只在中途留下副本，就能研究双方实际交换了什么。" } },
  { match: /log|日志|visualization|可视化/i, purpose: "把冗长运行记录整理成可以比较和追踪的过程", focus: "时间顺序、重复内容和关键差异", analogy: { emoji: "🎬", title: "像把监控录像剪成事件时间线", text: "删去长时间没有变化的画面，只保留关键动作，流程就会变得清楚。" } },
  { match: /analysis|关键设计|核心能力|专题/i, purpose: "从材料中提炼真正值得迁移的机制，而不是停留在功能清单", focus: "现象、机制和适用条件", analogy: { emoji: "🔬", title: "像从实验结果归纳规律", text: "一次现象只能提供线索，多组证据共同出现时，才更有把握判断背后的机制。" } },
  { match: /对比|comparison/i, purpose: "通过差异理解简化实现保留了什么、暂时省略了什么", focus: "共同核心、实现差异和能力边界", analogy: { emoji: "⚖️", title: "像比较教学模型与真飞机", text: "教学模型不会拥有全部零件，但会保留最能解释飞行原理的结构。" } },
  { match: /worth|为什么|谁应该|阅读建议|路线图|roadmap/i, purpose: "判断阅读价值、适合人群和最省力的学习顺序", focus: "学习目标、阅读优先级和预期收获", analogy: { emoji: "🧭", title: "像出发前选择旅行路线", text: "先确定目的地和体力，再决定走完整路线还是只看最关键的景点。" } },
  { match: /data|数据|star history|license|贡献|致谢|交流|相关项目/i, purpose: "识别项目的补充信息，并判断它与核心技术内容的关系", focus: "可信度、生态信息和使用边界", analogy: { emoji: "🗂️", title: "像阅读一本书的附录", text: "它不一定解释核心原理，却能告诉你资料来源、使用边界和继续探索的方向。" } },
];

function shorten(text: string, max = 150) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function buildSectionGuide(documentName: string, blocks: MarkdownBlock[], headings: MarkdownBlock[], sectionIndex: number): SectionGuide {
  const profile = guideProfiles[documentName] || guideProfiles["how-claude-code-works"];
  const heading = headings[sectionIndex] || headings[0] || { type: "heading", text: "文章开头", section: 0 };
  const start = Math.max(0, blocks.findIndex((block) => block.type === "heading" && block.section === heading.section));
  const nextOffset = blocks.slice(start + 1).findIndex((block) => block.type === "heading" && (block.level || 1) <= 2);
  const end = nextOffset < 0 ? blocks.length : start + 1 + nextOffset;
  const sectionText = blocks.slice(start + 1, end)
    .filter((block) => block.type === "paragraph" || block.type === "list" || block.type === "quote")
    .map((block) => shorten(block.text, 180))
    .filter((text) => text.length >= 12 && !/^https?:/i.test(text));
  const intent = guideIntents.find((item) => item.match.test(heading.text)) || {
    purpose: `弄清「${heading.text}」在整篇文章中承担什么作用`,
    focus: "作者提出的问题、给出的做法和最终结论",
    analogy: profile.fallbackAnalogy,
  };
  const quote = sectionText[0] || `本节围绕「${heading.text}」展开。`;
  const keyPoints = sectionText.slice(0, 3);
  while (keyPoints.length < 3) keyPoints.push([
    `先用一句话复述「${heading.text}」要解决的问题。`,
    `再从原文中找出与“${intent.focus}”有关的证据。`,
    "最后把这一节与上一篇或下一节连接起来。",
  ][keyPoints.length]);
  const correct = sectionIndex % 3;
  const correctAnswer = `${intent.purpose}，并能指出原文依据`;
  const wrongAnswers = ["记住所有英文术语，不需要理解它们之间的关系", "只浏览代码或链接数量，跳过作者的论证过程"];
  const answers = [...wrongAnswers];
  answers.splice(correct, 0, correctAnswer);
  const minutes = Math.max(4, Math.min(12, 4 + Math.ceil(sectionText.join("").length / 900)));

  return {
    title: heading.text,
    eyebrow: profile.eyebrow,
    minutes,
    quote,
    source: `${documentName} · ${heading.text}`,
    thesis: `这一节真正要解决的是：${intent.purpose}。`,
    explanation: `这篇文章采用“${profile.lens}”的方式展开。读「${heading.text}」时，不必先记住所有细节，先抓住${intent.focus}。原文中的具体描述会作为证据，帮助你判断作者为什么得出这一结论。`,
    flow: profile.flow,
    keyPoints,
    analogyEmoji: intent.analogy.emoji,
    analogyTitle: intent.analogy.title,
    analogy: intent.analogy.text,
    question: `读完「${heading.text}」，你最应该先确认哪件事？`,
    answers,
    correct,
    feedback: `这一节的目标不是背诵，而是${intent.purpose}。你还应该能回到原文，指出支持这一理解的句子。`,
  };
}

function cleanMarkdown(text: string) {
  return text.replace(/!\[[^\]]*\]\([^)]+\)/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[\*_`]/g, "").trim();
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let inCode = false;
  let section = 0;
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim().startsWith("```")) { inCode = !inCode; continue; }
    if (inCode) { if (line.trim()) blocks.push({ type: "code", text: line }); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
    if (heading) { blocks.push({ type: "heading", level: heading[1].length, section: section++, text: cleanMarkdown(heading[2]) }); continue; }
    if (/^[-*+]\s+/.test(line)) { blocks.push({ type: "list", text: cleanMarkdown(line.replace(/^[-*+]\s+/, "")) }); continue; }
    if (/^>\s?/.test(line)) { blocks.push({ type: "quote", text: cleanMarkdown(line.replace(/^>\s?/, "")) }); continue; }
    const text = cleanMarkdown(line);
    if (text && !/^<[!/]/.test(text) && !/^\|[-:| ]+\|$/.test(text)) blocks.push({ type: "paragraph", text });
  }
  return blocks;
}

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
  const [repoOutlines, setRepoOutlines] = useState<Record<number, string[]>>({});
  const [outlineLoading, setOutlineLoading] = useState<number | null>(null);
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("documents");
  const [expandedDocument, setExpandedDocument] = useState<string | null>(null);
  const [activeDocumentName, setActiveDocumentName] = useState("claude-code-reverse");
  const [readerMode, setReaderMode] = useState<"original" | "guide">("original");
  const [companionTab, setCompanionTab] = useState<"mentor" | "notes">("mentor");
  const [noteText, setNoteText] = useState("");
  const [mentorQuestion, setMentorQuestion] = useState("");
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorStatus, setMentorStatus] = useState<MentorStatus>("checking");
  const [selectedText, setSelectedText] = useState("");
  const [mentorCheckChoice, setMentorCheckChoice] = useState<number | null>(null);
  const [mentorMessages, setMentorMessages] = useState<MentorMessage[]>([{ id: 1, role: "teacher", title: "开始伴读", content: "我会跟随你当前阅读的文章和章节。选中一段原文，或直接告诉我哪里没看懂。" }]);
  const mentorMessageId = useRef(2);
  const [mobileReaderSurface, setMobileReaderSurface] = useState<"document" | "mentor" | "notes">("document");
  const [activeSourceSection, setActiveSourceSection] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem("starmate-lesson-complete");
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate browser-only saved progress after mount */
    setLessonComplete(saved === "true");
    setGithubUser(window.localStorage.getItem("starmate-github-user") || "");
    setSavedRepoIds(JSON.parse(window.localStorage.getItem("starmate-saved-repos") || "[]"));
    setStarredRepos(JSON.parse(window.localStorage.getItem("starmate-starred-repos") || "[]"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mentor", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = (await response.json()) as { configured?: boolean };
        if (!cancelled) setMentorStatus(result.configured ? "ready" : "unconfigured");
      })
      .catch(() => { if (!cancelled) setMentorStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const completedCount = lessonComplete ? 2 : 1;
  const progress = Math.round((completedCount / lessons.length) * 100);
  const currentCard = reviewCards[cardIndex];
  const graphRepos = starredRepos.filter((repo) => savedRepoIds.includes(repo.id)).slice(0, 4);
  const activeDocument = sourceDocuments.find((document) => document.name === activeDocumentName) || sourceDocuments[2];
  const readmeText = useMemo(() => { try { return decodeBase64Utf8(EMBEDDED_READMES[activeDocument.name] || ""); } catch { return ""; } }, [activeDocument.name]);
  const readmeLoading = false;
  const readmeError = !readmeText;
  const markdownBlocks = useMemo(() => parseMarkdown(readmeText), [readmeText]);
  const readmeHeadings = useMemo(() => markdownBlocks.filter((block) => block.type === "heading" && (block.level || 1) <= 2), [markdownBlocks]);
  const currentSectionTitle = readmeHeadings[activeSourceSection]?.text || "文章开头";
  const currentGuide = useMemo(() => buildSectionGuide(activeDocument.name, markdownBlocks, readmeHeadings, activeSourceSection), [activeDocument.name, markdownBlocks, readmeHeadings, activeSourceSection]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- restore device-local notebook content when switching documents */
    setNoteText(window.localStorage.getItem(`starmate-note-${activeDocument.name}`) || "");
  }, [activeDocument.name]);

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
    setActiveDocumentName("claude-code-reverse");
    setActiveSourceSection(id === 1 ? 0 : 2);
    setReaderMode("guide");
    setMobileReaderSurface("document");
    setSelectedText("");
    setSelectedAnswer(null);
    setView("reader");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openDocument(name: string) {
    setActiveDocumentName(name);
    setActiveSourceSection(0);
    setSelectedAnswer(null);
    setSelectedText("");
    setMentorMessages([{ id: mentorMessageId.current++, role: "teacher", title: "文章已切换", content: `我已经开始跟随「${name}」。选中原文或点击快捷动作，我们从当前章节继续。` }]);
    setReaderMode("original");
    setMobileReaderSurface("document");
    setView("reader");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToSourceSection(index: number) {
    const target = Math.max(0, Math.min(index, readmeHeadings.length - 1));
    setActiveSourceSection(target);
    setSelectedAnswer(null);
    const section = readmeHeadings[target];
    window.setTimeout(() => document.getElementById(`source-section-${section?.section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function goToGuideSection(index: number) {
    const target = Math.max(0, Math.min(index, readmeHeadings.length - 1));
    setActiveSourceSection(target);
    setSelectedAnswer(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveNote(value: string) {
    setNoteText(value);
    window.localStorage.setItem(`starmate-note-${activeDocument.name}`, value);
  }

  function captureSelection() {
    const text = window.getSelection()?.toString().replace(/\s+/g, " ").trim() || "";
    if (text.length < 4) return;
    setSelectedText(text.slice(0, 500));
    setCompanionTab("mentor");
    if (window.innerWidth <= 760) setMobileReaderSurface("mentor");
  }

  function addToNotes(text = selectedText) {
    if (!text.trim()) return;
    const entry = `\n\n【${currentSectionTitle}】\n原文：${text.trim()}\n我的理解：`;
    saveNote(`${noteText}${entry}`.trimStart());
    setCompanionTab("notes");
    setMobileReaderSurface("notes");
  }

  async function askMentor(question = mentorQuestion, action: "explain" | "example" | "guide" | "check" | "ask" = "ask") {
    if (mentorLoading) return;
    const prompt = question.trim() || (selectedText ? "请解释我选中的这段原文" : "请带我理解当前章节");
    const id = mentorMessageId.current;
    mentorMessageId.current += 2;
    const fallbackReplies = {
      explain: `${currentGuide.thesis}${currentGuide.explanation}`,
      example: `${currentGuide.analogyTitle}：${currentGuide.analogy}`,
      guide: `先别急着记术语。请先回答：${currentGuide.question} 然后回到原文，找出支持你答案的句子。`,
      check: `先不要回看原文，试着回答关于「${currentGuide.title}」的问题。选完后再回到当前章节确认。`,
      ask: prompt.includes("简单") ? currentGuide.thesis : `我会按「${currentGuide.eyebrow}」来回答。先看当前章节要解决的问题，再用原文证据解释；当前最值得关注的是：${currentGuide.keyPoints[0]}`,
    };
    const title = action === "check" ? "理解检查" : action === "example" ? "换个例子" : action === "guide" ? "苏格拉底引导" : "小白解释";
    const pendingTeacher: MentorMessage = { id: id + 1, role: "teacher", title: "GPT 正在思考", content: "正在结合当前文章、章节和选中原文组织回答…", pending: true };
    const recentHistory = mentorMessages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMentorMessages((messages) => [...messages, { id, role: "user", content: prompt }, pendingTeacher]);
    setMentorCheckChoice(null);
    setMentorQuestion("");
    setCompanionTab("mentor");
    setMentorLoading(true);

    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          question: prompt,
          document: { name: activeDocument.name, owner: activeDocument.owner },
          section: {
            title: currentSectionTitle,
            source: currentGuide.source,
            quote: currentGuide.quote,
            thesis: currentGuide.thesis,
            explanation: currentGuide.explanation,
            keyPoints: currentGuide.keyPoints,
          },
          selectedText,
          note: prompt.includes("笔记") ? noteText : "",
          history: recentHistory,
        }),
      });
      const result = (await response.json()) as { answer?: string; error?: string; code?: string };
      if (!response.ok || !result.answer) throw Object.assign(new Error(result.error || "模型没有返回内容"), { code: result.code });

      setMentorStatus("ready");
      setMentorMessages((messages) => messages.map((message) => message.id === id + 1 ? {
        ...message,
        title,
        content: result.answer || "",
        quote: selectedText || undefined,
        source: currentGuide.source,
        pending: false,
        check: action === "check" ? { question: currentGuide.question, options: currentGuide.answers, correct: currentGuide.correct, feedback: currentGuide.feedback } : undefined,
      } : message));
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const unconfigured = code === "MODEL_NOT_CONFIGURED";
      setMentorStatus(unconfigured ? "unconfigured" : "error");
      setMentorMessages((messages) => messages.map((message) => message.id === id + 1 ? {
        ...message,
        title: unconfigured ? "本地讲解 · GPT 待启用" : "本地讲解 · GPT 暂时不可用",
        content: `${fallbackReplies[action]}\n\n${unconfigured ? "真实模型接口已经接好，服务端配置 API Key 后会自动切换为 GPT 回答。" : "这次模型请求没有成功，先用当前章节生成的本地讲解继续阅读。"}`,
        quote: selectedText || undefined,
        source: currentGuide.source,
        pending: false,
        error: true,
        check: action === "check" ? { question: currentGuide.question, options: currentGuide.answers, correct: currentGuide.correct, feedback: currentGuide.feedback } : undefined,
      } : message));
    } finally {
      setMentorLoading(false);
    }
  }

  function renderMentorWorkspace() {
    return <>
      <div className="mentor-heading"><span className="mentor-avatar">✦</span><div><strong>伴读老师</strong><small className={`mentor-model-status ${mentorStatus}`}>{mentorLoading ? "gpt-5.4-mini · 正在生成" : mentorStatus === "ready" ? "gpt-5.4-mini · 已连接" : mentorStatus === "unconfigured" ? "gpt-5.4-mini · 等待密钥" : mentorStatus === "checking" ? "正在检查模型连接" : "模型连接暂时异常"}</small></div></div>
      <div className="mentor-context"><span>当前上下文</span><strong>{activeDocument.name}</strong><small>{currentSectionTitle}</small>{selectedText && <><blockquote>“{selectedText.slice(0, 120)}{selectedText.length > 120 ? "…" : ""}”</blockquote><button onClick={() => addToNotes()}>+ 加入笔记</button></>}</div>
      <div className="mentor-conversation" aria-live="polite">{mentorMessages.map((message) => <article className={`mentor-bubble ${message.role} ${message.pending ? "pending" : ""} ${message.error ? "error" : ""}`} key={message.id}>{message.title && <strong>{message.title}</strong>}{message.quote && <blockquote>“{message.quote.slice(0, 110)}{message.quote.length > 110 ? "…" : ""}”</blockquote>}<p>{message.content}</p>{message.source && <small>依据：{message.source}</small>}{message.check && <div className="mentor-check"><b>{message.check.question}</b>{message.check.options.map((option, index) => <button className={mentorCheckChoice === index ? (index === message.check?.correct ? "correct" : "wrong") : ""} key={option} onClick={() => setMentorCheckChoice(index)}>{String.fromCharCode(65 + index)}. {option}</button>)}{mentorCheckChoice !== null && <em>{mentorCheckChoice === message.check.correct ? `回答正确：${message.check.feedback}` : "再想一步：回到这一节的核心问题，区分原文证据与无关细节。"}</em>}</div>}</article>)}</div>
      <div className="mentor-actions"><button disabled={mentorLoading} onClick={() => askMentor("解释当前内容", "explain")}><span>译</span>小白解释</button><button disabled={mentorLoading} onClick={() => askMentor("通过提问引导我", "guide")}><span>问</span>引导思考</button><button disabled={mentorLoading} onClick={() => askMentor("举一个容易理解的例子", "example")}><span>例</span>举个例子</button><button disabled={mentorLoading} onClick={() => askMentor("检查我是否理解", "check")}><span>测</span>理解检查</button></div>
      <div className="mentor-input"><input disabled={mentorLoading} aria-label="向伴读老师提问" value={mentorQuestion} onChange={(event) => setMentorQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !mentorLoading) askMentor(); }} placeholder={mentorLoading ? "GPT 正在回答…" : "围绕当前章节提问…"} /><button disabled={mentorLoading} aria-label="发送问题" onClick={() => askMentor()}>{mentorLoading ? "…" : "↑"}</button></div>
      <p className="grounding-note">只发送当前文章、章节、选中原文与最近对话；API Key 始终留在服务端</p>
    </>;
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
            <button className={overviewMode === "path" ? "active" : ""} onClick={() => setOverviewMode("path")}><span>03</span><strong>仓库学习路径</strong><small>从 README 走到实践</small></button>
            <button className={overviewMode === "graph" ? "active" : ""} onClick={() => setOverviewMode("graph")}><span>04</span><strong>探索知识图谱</strong><small>查看文档与概念关系</small></button>
          </nav>

          {overviewMode === "documents" && (
            <section className="mode-panel">
              <div className="mode-heading"><div><p className="overline">原文视角</p><h2>一篇文档，一套独立大纲</h2></div><p>这里不混合多篇资料。每张卡片展示该仓库自己的定位、概念和 README 结构。</p></div>
              <div className="document-list">
                {sourceDocuments.map((document, index) => (
                  <article className={`document-card ${expandedDocument === document.name ? "expanded" : ""}`} key={document.name}>
                    <div className="document-number">0{index + 1}</div>
                    <div className="document-main"><span className="relation-badge">{document.role}</span><h3>{document.name}</h3><small>{document.owner}</small><p>{document.summary}</p><div className="concept-tags">{document.concepts.map((concept) => <span key={concept}>{concept}</span>)}</div></div>
                    <div className="document-outline"><strong>原文大纲</strong><ol>{document.outline.map((item) => <li key={item}>{item}</li>)}</ol><div className="document-actions"><button className="read-inside" onClick={() => openDocument(document.name)}>在 App 内阅读</button><button aria-expanded={expandedDocument === document.name} onClick={() => setExpandedDocument(expandedDocument === document.name ? null : document.name)}>{expandedDocument === document.name ? "收起详细大纲" : "查看详细大纲"}</button><a href={document.url} target="_blank" rel="noreferrer">GitHub ↗</a></div></div>
                    {expandedDocument === document.name && <div className="detailed-outline"><div className="outline-heading"><div><span>完整原文大纲</span><strong>{document.sections.length} 个章节层级</strong></div><a href={document.url} target="_blank" rel="noreferrer">前往完整原文 ↗</a></div><div className="reading-guide"><div><span>预计阅读</span><strong>{document.readingTime}</strong></div><div><span>阅读建议</span><strong>{document.focus}</strong></div></div><ol>{document.sections.map((section, sectionIndex) => <li key={section.title}><span>{String(sectionIndex + 1).padStart(2, "0")}</span><div><h4>{section.title}</h4><p><b>本章解决的问题</b>{section.purpose}</p><div className="section-points"><b>章节内部重点</b>{section.points.map((point) => <em key={point}>{point}</em>)}</div></div></li>)}</ol><a className="start-original" href={document.url} target="_blank" rel="noreferrer">前往完整原文 ↗</a></div>}
                  </article>
                ))}
                {graphRepos.map((repo) => <article className={`document-card imported ${expandedDocument === repo.full_name ? "expanded" : ""}`} key={repo.id}><div className="document-number">★</div><div className="document-main"><span className="relation-badge">我的收藏</span><h3>{repo.full_name}</h3><p>{repo.description || "尚未提供简介"}</p></div><div className="document-outline"><strong>README 大纲</strong><p>点击后读取这个仓库 README 的真实标题。</p><div className="document-actions"><button onClick={() => { const opening = expandedDocument !== repo.full_name; setExpandedDocument(opening ? repo.full_name : null); if (opening && !repoOutlines[repo.id]?.length) loadRepoOutline(repo); }}>{expandedDocument === repo.full_name ? "收起详细大纲" : "读取详细大纲"}</button><a href={repo.html_url} target="_blank" rel="noreferrer">查看原文 ↗</a></div></div>{expandedDocument === repo.full_name && <div className="detailed-outline imported-detail">{outlineLoading === repo.id ? <p>正在读取 README…</p> : <ol>{(repoOutlines[repo.id] || ["暂未读取到目录"]).map((heading, headingIndex) => <li key={`${heading}-${headingIndex}`}><span>{String(headingIndex + 1).padStart(2, "0")}</span><div><h4>{heading}</h4><p>原文 README 章节</p></div></li>)}</ol>}<a className="start-original" href={repo.html_url} target="_blank" rel="noreferrer">打开完整 README →</a></div>}</article>)}
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

          {overviewMode === "path" && (
            <section className="mode-panel learning-path-panel">
              <div className="mode-heading"><div><p className="overline">README 只是地图</p><h2>从“读过”走到“能解释、能运行、能验证”</h2></div><p>三个仓库不需要逐文件通读。按五层推进：先建立地图，再理解原理、运行实验、定位实现，最后用日志和测试验证。</p></div>
              <div className="learning-layer-map" aria-label="五层仓库学习法">
                {[
                  ["01", "地图", "知道学什么"],
                  ["02", "原理", "理解为什么"],
                  ["03", "实验", "亲眼看见"],
                  ["04", "实现", "找到代码"],
                  ["05", "证据", "证明学会"],
                ].map(([number, title, note]) => <div key={number}><span>{number}</span><strong>{title}</strong><small>{note}</small></div>)}
              </div>
              <div className="repository-path-list">
                {repositoryLearningPaths.map((repository, repositoryIndex) => (
                  <article className="repository-path-card" key={repository.name}>
                    <header><div className="path-repo-number">0{repositoryIndex + 1}</div><div><span>{repository.role}</span><h3>{repository.name}</h3><small>{repository.owner} · {repository.duration}</small></div><p>{repository.summary}</p></header>
                    <div className="repository-layer-list">
                      {repository.layers.map((layer, layerIndex) => (
                        <section className="repository-layer" key={`${repository.name}-${layer.type}`}>
                          <div className="layer-identity"><span>{String(layerIndex + 1).padStart(2, "0")}</span><b>{layer.type}</b></div>
                          <div className="layer-main"><h4>{layer.title}</h4><p><b>学什么</b>{layer.learn}</p><div className="layer-links">{layer.links.map((link) => <a href={link.url} key={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</div></div>
                          <div className="layer-action"><p><b>怎么学</b>{layer.method}</p><p className="mastery-proof"><b>学会标准</b>{layer.proof}</p></div>
                        </section>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <aside className="path-finish"><span>最终检验</span><div><strong>能解释</strong><p>不看文章讲清一次 Agent 任务怎样运行。</p></div><div><strong>能修改</strong><p>给最小 Agent 增加一个工具并成功调用。</p></div><div><strong>能验证</strong><p>用测试或日志区分事实、推断与类比。</p></div></aside>
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
            <button className="back-link" onClick={() => setView("overview")}>← 返回文档地图</button>
            <p className="overline">笔记式伴读</p>
            <h2>{activeDocument.name}</h2>
            <div className="notebook-doc-switch" aria-label="切换文章">{sourceDocuments.map((document, index) => <button className={document.name === activeDocument.name ? "active" : ""} key={document.name} title={document.name} onClick={() => openDocument(document.name)}>{index + 1}</button>)}</div>
            <p className="sidebar-label">README 真实目录 · {readmeHeadings.length} 节</p>
            <div className="lesson-list">
              {readmeHeadings.map((heading, index) => <button key={`${heading.text}-${index}`} className={`lesson-item ${activeSourceSection === index ? "selected" : ""}`} onClick={() => readerMode === "guide" ? goToGuideSection(index) : goToSourceSection(index)}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{readerMode === "guide" ? "当前讲解章节" : "README 原文章节"}</small><strong>{heading.text}</strong></div></button>)}
            </div>
            <button className="sidebar-guide-button" onClick={() => { setReaderMode("guide"); setSelectedAnswer(null); }}>✦ 打开当前章节讲解</button>
          </aside>

          <div className="reader-center">
            <nav className="reader-mobile-tabs" aria-label="伴读工作区"><button className={mobileReaderSurface === "document" ? "active" : ""} onClick={() => setMobileReaderSurface("document")}>原文</button><button className={mobileReaderSurface === "mentor" ? "active" : ""} onClick={() => setMobileReaderSurface("mentor")}>AI 伴读</button><button className={mobileReaderSurface === "notes" ? "active" : ""} onClick={() => setMobileReaderSurface("notes")}>笔记</button></nav>
            <article className={`reading-pane ${mobileReaderSurface !== "document" ? "mobile-hidden" : ""}`}>
              <div className="notebook-toolbar"><div><span className="live-dot"></span><strong>正在阅读 {activeDocument.owner}/{activeDocument.name}</strong></div><div className="reader-mode-switch"><button className={readerMode === "original" ? "active" : ""} onClick={() => setReaderMode("original")}>原文全文</button><button className={readerMode === "guide" ? "active" : ""} onClick={() => { setReaderMode("guide"); setSelectedAnswer(null); }}>小白讲解</button></div></div>

              {readerMode === "original" ? <>
                <div className="reading-header"><div><p className="kicker">GitHub README · App 内阅读</p><h1>{activeDocument.name}</h1><p className="document-deck">{activeDocument.summary}</p></div><span className="reading-time">{activeDocument.readingTime}</span></div>
                <div className="inline-companion"><span>✦</span><div><strong>伴读提示</strong><p>{activeDocument.focus} 遇到不懂的段落，可以切到右侧 AI 伴读，不会离开当前页面。</p></div></div>
                {selectedText && <div className="selection-toolbar"><div><small>已选中原文</small><p>“{selectedText.slice(0, 90)}{selectedText.length > 90 ? "…" : ""}”</p></div><div><button onClick={() => { askMentor("解释这段原文", "explain"); setMobileReaderSurface("mentor"); }}>解释这段</button><button onClick={() => askMentor("为这段举一个例子", "example")}>举个例子</button><button onClick={() => addToNotes()}>加入笔记</button><button aria-label="清除选中原文" onClick={() => setSelectedText("")}>×</button></div></div>}
                <div className="markdown-reader" aria-live="polite" onMouseUp={captureSelection} onTouchEnd={captureSelection}>
                  {readmeLoading && <div className="reader-loading">正在把 GitHub 原文带进阅读器…</div>}
                  {readmeError && <div className="reader-loading">原文暂时没有加载成功，先按下面的结构伴读。</div>}
                  {!readmeLoading && markdownBlocks.length > 0 ? markdownBlocks.map((block, index) => {
                    if (block.type === "heading") { const Heading = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4"; return <Heading id={`source-section-${block.section}`} key={`${block.type}-${index}`}>{block.text}</Heading>; }
                    if (block.type === "list") return <div className="md-list" key={`${block.type}-${index}`}><span>•</span><p>{block.text}</p></div>;
                    if (block.type === "quote") return <blockquote key={`${block.type}-${index}`}>{block.text}</blockquote>;
                    if (block.type === "code") return <code key={`${block.type}-${index}`}>{block.text}</code>;
                    return <p key={`${block.type}-${index}`}>{block.text}</p>;
                  }) : !readmeLoading && activeDocument.sections.map((section, index) => <section id={`source-section-${index}`} className="fallback-source-section" key={section.title}><span>0{index + 1}</span><h2>{section.title}</h2><p>{section.purpose}</p><div>{section.points.map((point) => <em key={point}>{point}</em>)}</div></section>)}
                </div>
                <div className="source-navigation"><button onClick={() => goToSourceSection(activeSourceSection - 1)} disabled={activeSourceSection === 0}>← 上一节</button><span>{readmeHeadings.length ? `${activeSourceSection + 1} / ${readmeHeadings.length}` : "读取目录中"}</span><button onClick={() => goToSourceSection(activeSourceSection + 1)} disabled={!readmeHeadings.length || activeSourceSection >= readmeHeadings.length - 1}>下一节 →</button></div>
              </> : <>
                <div className="reading-header"><div><p className="kicker">第 {activeSourceSection + 1} / {readmeHeadings.length} 节 · {currentGuide.eyebrow}</p><h1>{currentGuide.title}</h1><p className="document-deck">这份讲解来自当前 README 章节，不会与其他文章共用固定课程内容。</p></div><span className="reading-time">约 {currentGuide.minutes} 分钟</span></div>
                <div className="source-card"><div className="source-label"><span>本节原文证据</span><button onClick={() => { setReaderMode("original"); goToSourceSection(activeSourceSection); }}>回到这一节原文</button></div><blockquote>{currentGuide.quote}</blockquote><p>来源：{currentGuide.source}</p></div>
                <section className="explain-section"><p className="overline">先用一句话理解</p><h2>{currentGuide.thesis}</h2><p>{currentGuide.explanation}</p><div className="loop-diagram" aria-label={`${currentGuide.eyebrow}阅读步骤`}>{currentGuide.flow.map((step, index) => <div key={step.title}><span>{index + 1}</span><strong>{step.title}</strong><small>{step.detail}</small></div>)}</div></section>
                <section className="guide-key-points"><div><p className="overline">根据这一节原文提取</p><h2>本节需要抓住的 3 个点</h2></div>{currentGuide.keyPoints.map((point, index) => <article key={`${point}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{point}</p></article>)}</section>
                <aside className="analogy-card"><span className="analogy-emoji">{currentGuide.analogyEmoji}</span><div><p className="overline">换个生活中的例子</p><h3>{currentGuide.analogyTitle}</h3><p>{currentGuide.analogy}</p></div></aside>
                <section className="checkpoint"><div className="checkpoint-title"><span>?</span><div><p className="overline">当前章节理解检查</p><h2>{currentGuide.question}</h2></div></div><div className="answers">{currentGuide.answers.map((answer, index) => <button key={answer} className={`${selectedAnswer === index ? "chosen" : ""} ${selectedAnswer !== null && index === currentGuide.correct ? "correct" : ""}`} onClick={() => setSelectedAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{answer}</button>)}</div>{selectedAnswer !== null && <div className={`feedback ${selectedAnswer === currentGuide.correct ? "good" : "retry"}`}><strong>{selectedAnswer === currentGuide.correct ? "答对了！" : "再想一步"}</strong><p>{selectedAnswer === currentGuide.correct ? currentGuide.feedback : "回到上面的核心问题，找出与当前章节真正相关的原文证据。"}</p>{selectedAnswer === currentGuide.correct && <button className="guide-complete" onClick={finishLesson} disabled={lessonComplete}>{lessonComplete ? "✓ 已记录学习进度" : "记录为已理解"}</button>}</div>}</section>
                <div className="source-navigation"><button onClick={() => goToGuideSection(activeSourceSection - 1)} disabled={activeSourceSection === 0}>← 上一节讲解</button><span>{activeSourceSection + 1} / {readmeHeadings.length}</span><button onClick={() => goToGuideSection(activeSourceSection + 1)} disabled={activeSourceSection >= readmeHeadings.length - 1}>下一节讲解 →</button></div>
              </>}
            </article>

            {mobileReaderSurface !== "document" && <section className="mobile-companion-panel">{mobileReaderSurface === "mentor" ? renderMentorWorkspace() : <><p className="overline">我的笔记</p><h2>{activeDocument.name}</h2><textarea value={noteText} onChange={(event) => saveNote(event.target.value)} placeholder="记下自己的理解、疑问和例子…" /><small>已自动保存在这台设备</small></>}</section>}
          </div>

          <aside className="mentor-panel">
            <div className="companion-tabs"><button className={companionTab === "mentor" ? "active" : ""} onClick={() => setCompanionTab("mentor")}>AI 伴读</button><button className={companionTab === "notes" ? "active" : ""} onClick={() => setCompanionTab("notes")}>我的笔记</button></div>
            {companionTab === "mentor" ? renderMentorWorkspace() : <div className="notes-panel"><p className="overline">文档笔记</p><h3>{activeDocument.name}</h3><textarea value={noteText} onChange={(event) => saveNote(event.target.value)} placeholder="记下自己的理解、疑问和例子…" /><small>内容已自动保存在这台设备</small><button onClick={() => askMentor("帮我把当前笔记整理成要点")}>✦ 请 AI 帮我整理</button></div>}
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
