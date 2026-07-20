"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EMBEDDED_READMES } from "./embedded-readmes";
import type { RepositoryLearningPackage } from "@/lib/repository-learning";

type View = "home" | "beginner" | "overview" | "reader" | "review";
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

type BeginnerTrack = {
  id: string;
  repository: string;
  owner: string;
  label: string;
  role: string;
  title: string;
  promise: string;
  hook: string;
  mission: string;
  outcome: string;
  stages: { title: string; duration: string; action: string; result: string }[];
  mentalModel: { title: string; detail: string }[];
  terms: { term: string; plain: string; example: string }[];
  transfer: string;
  packageId?: string;
  challenge?: string;
};

type PackageChangeSummary = {
  status: "added" | "updated" | "unchanged";
  added: string[];
  changed: string[];
  removed: string[];
  previousSha?: string;
};

type LibraryPackage = RepositoryLearningPackage & { changeSummary?: PackageChangeSummary };

const beginnerTracks: BeginnerTrack[] = [
  {
    id: "how",
    repository: "how-claude-code-works",
    owner: "Windy3f3f3f3f",
    label: "先看懂 Agent 全局",
    role: "产品原理入门",
    title: "亲眼看见 Agent Loop 跑完一轮",
    promise: "这篇文章适合先建立系统直觉。你会看到模型为什么不是“一次回答完”，而是不断行动、观察和继续判断。",
    hook: "普通聊天像给建议，Agent 更像真的去办事：它会读资料、使用工具、检查结果，直到任务完成。",
    mission: "给 Agent 一个真实阅读任务，逐步观察模型、工具、结果和下一轮决策。",
    outcome: "能用自己的话画出用户、模型、工具与上下文的关系。",
    stages: [
      { title: "30 秒兴趣", duration: "先知道价值", action: "看 Agent 与普通聊天的差别", result: "愿意继续读" },
      { title: "3 分钟体验", duration: "在 App 内完成", action: "运行一次 Agent Loop", result: "亲眼看到四步循环" },
      { title: "5 分钟全局", duration: "建立系统地图", action: "连接模型、工具和上下文", result: "抓住文章主线" },
      { title: "2 分钟挑战", duration: "回到原文验证", action: "解释工具结果为何要回传", result: "带着问题进入原文" },
    ],
    mentalModel: [
      { title: "用户目标", detail: "说明最终想完成什么" },
      { title: "模型判断", detail: "决定回答还是调用工具" },
      { title: "工具行动", detail: "真实读取、搜索或修改" },
      { title: "结果回传", detail: "把新观察放回上下文" },
    ],
    terms: [
      { term: "Agent Loop", plain: "做一步、看结果、再决定", example: "像实习生查完一份表，再决定要不要继续找资料。" },
      { term: "Tool", plain: "模型可以使用的行动能力", example: "模型负责判断，读取文件工具负责真正打开文件。" },
      { term: "Context", plain: "模型此刻能看到的工作台", example: "任务、历史消息和工具结果都放在这张工作台上。" },
    ],
    transfer: "适合继续探索 AI 产品经理、AI 解决方案和 Agent 产品设计。",
  },
  {
    id: "scratch",
    repository: "claude-code-from-scratch",
    owner: "Windy3f3f3f3f",
    label: "动手拼出最小 Agent",
    role: "实现案例入门",
    title: "不用先学语法，先拼出一个能工作的 Agent",
    promise: "这篇文章适合把抽象原理对应到代码结构。你会先组装最小骨架，再去原文寻找每个部件。",
    hook: "复杂 Coding Agent 看起来有很多功能，但最小版本只需要模型请求、工具、循环和结束条件。",
    mission: "在 App 内组装三个必要部件，生成自己的最小 Agent 蓝图。",
    outcome: "看见每段代码属于哪一步，并知道少一个部件会发生什么。",
    stages: [
      { title: "30 秒兴趣", duration: "拆掉神秘感", action: "把完整产品缩成四个部件", result: "知道代码并非黑盒" },
      { title: "3 分钟组装", duration: "在 App 内完成", action: "连接模型、工具和循环", result: "得到最小蓝图" },
      { title: "5 分钟对照", duration: "寻找代码位置", action: "把蓝图映射到教程章节", result: "知道原文怎么读" },
      { title: "2 分钟挑战", duration: "预测运行结果", action: "判断程序何时继续或结束", result: "开始形成实现直觉" },
    ],
    mentalModel: [
      { title: "发给模型", detail: "提交目标与历史消息" },
      { title: "解析决定", detail: "读取回答或工具调用" },
      { title: "执行工具", detail: "得到外部世界的结果" },
      { title: "判断结束", detail: "继续循环或交付答案" },
    ],
    terms: [
      { term: "Tool Call", plain: "模型提交的一张行动申请单", example: "申请读取 README，并给出文件路径参数。" },
      { term: "Tool Result", plain: "行动完成后的回执", example: "程序把读取到的文件内容交回模型。" },
      { term: "Stop Condition", plain: "什么时候停止循环", example: "模型不再请求工具、开始给出最终答案时结束。" },
    ],
    transfer: "适合继续做第一个 AI 小工具，并逐步补齐 TypeScript 或 Python。",
  },
  {
    id: "reverse",
    repository: "claude-code-reverse",
    owner: "Yuyz0112",
    label: "像研究员一样找证据",
    role: "逆向分析入门",
    title: "从一条真实日志，判断什么能证明、什么只是猜测",
    promise: "这篇文章适合训练证据思维。你不需要记住请求字段，只要学会把现象、推断和未知分开。",
    hook: "逆向分析不是破解秘密，而是从请求、日志和行为中寻找可以重复验证的线索。",
    mission: "判断一句关于 Claude Code 的结论，是直接证据、合理推断，还是目前无法证明。",
    outcome: "能制作一条“结论—证据—可信度”记录，不再把作者推测当成事实。",
    stages: [
      { title: "30 秒兴趣", duration: "进入侦探视角", action: "从表面结果寻找幕后线索", result: "理解逆向价值" },
      { title: "3 分钟判断", duration: "在 App 内完成", action: "给结论标注证据等级", result: "避免过度推断" },
      { title: "5 分钟追踪", duration: "理解证据链", action: "连接请求、工具与行为", result: "看懂仓库主线" },
      { title: "2 分钟挑战", duration: "回到日志验证", action: "找出一条能支撑结论的记录", result: "开始像研究员一样阅读" },
    ],
    mentalModel: [
      { title: "提出问题", detail: "先写清想验证什么" },
      { title: "捕获记录", detail: "保存请求与运行日志" },
      { title: "比较变化", detail: "一次只改变一个条件" },
      { title: "标注可信度", detail: "区分证据、推断与未知" },
    ],
    terms: [
      { term: "Request", plain: "程序实际发出去的请求记录", example: "可以看到消息、工具定义和部分运行上下文。" },
      { term: "Log", plain: "系统按时间留下的行动轨迹", example: "能帮助还原某次工具调用前后发生了什么。" },
      { term: "Inference", plain: "由证据支持、但仍需注明边界的推断", example: "一次日志能说明这次发生了什么，不一定代表所有情况。" },
    ],
    transfer: "适合继续发展技术调研、解决方案分析和 AI 产品评测能力。",
  },
];

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

function buildGrowingRepositoryLayers(repoUrl: string): LearningPathLayer[] {
  return [
    { type: "地图", title: "README、目录与项目定位", learn: "知道这个仓库解决什么问题、适合谁，以及主要内容放在哪里。", method: "第一遍只扫标题、示例和目录，先写下一句自己的理解。", proof: "不用原文，能在 60 秒内说清项目价值。", links: [{ label: "打开仓库", url: repoUrl }] },
    { type: "原理", title: "找到 3 个核心概念", learn: "从文档中识别最重要的概念，以及它们之间的因果关系。", method: "遇到术语先翻译成生活语言，再回到原文确认是否准确。", proof: "能用一个例子解释三个概念怎样协同。", links: [{ label: "查看 README", url: `${repoUrl}#readme` }] },
    { type: "实验", title: "运行最小示例", learn: "亲眼看到输入、过程和输出，而不是只停留在文字理解。", method: "先预测结果，再运行官方最小示例；只改变一个变量观察差异。", proof: "能说明哪项改动导致了哪项结果。", links: [{ label: "寻找示例", url: `${repoUrl}/search?q=example&type=code` }] },
    { type: "实现", title: "沿一次调用追代码", learn: "找到入口、核心处理和结果返回的连接方式。", method: "只追一条主链路，不要求第一遍读懂整个源码树。", proof: "能指出最值得修改的一个文件或函数。", links: [{ label: "搜索入口", url: `${repoUrl}/search?q=main&type=code` }] },
    { type: "证据", title: "用测试、日志或作品验证", learn: "区分“看起来懂了”和真正能够复现、修改与说明。", method: "保留一张结果截图、一条测试或一段自己的解释。", proof: "能展示一个可重复的学习成果。", links: [{ label: "查看测试", url: `${repoUrl}/search?q=test&type=code` }] },
  ];
}

function compareLearningPackages(previous: LibraryPackage | undefined, next: RepositoryLearningPackage): PackageChangeSummary {
  if (!previous) return { status: "added", added: next.sections.map((section) => section.title).slice(0, 8), changed: [], removed: [] };
  if (previous.sourceSha === next.sourceSha) return { status: "unchanged", added: [], changed: [], removed: [], previousSha: previous.sourceSha };
  const previousByKey = new Map(previous.sections.map((section) => [`${section.sourcePath}:${section.title}`, section]));
  const nextByKey = new Map(next.sections.map((section) => [`${section.sourcePath}:${section.title}`, section]));
  const added = [...nextByKey.entries()].filter(([key]) => !previousByKey.has(key)).map(([, section]) => section.title);
  const removed = [...previousByKey.entries()].filter(([key]) => !nextByKey.has(key)).map(([, section]) => section.title);
  const changed = [...nextByKey.entries()].filter(([key, section]) => {
    const old = previousByKey.get(key);
    return old && `${old.excerpt}${old.keyPoints.join("")}` !== `${section.excerpt}${section.keyPoints.join("")}`;
  }).map(([, section]) => section.title);
  return { status: "updated", added: added.slice(0, 10), changed: changed.slice(0, 10), removed: removed.slice(0, 10), previousSha: previous.sourceSha };
}

function createLibraryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `library_${crypto.randomUUID().replace(/-/g, "")}`;
  return `library_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 18)}`;
}

const DEVICE_LIBRARY_PREFIX = "starmate-knowledge-packages:";

function readDeviceLibrary(libraryId: string): LibraryPackage[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(`${DEVICE_LIBRARY_PREFIX}${libraryId}`) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeDeviceLibrary(libraryId: string, packages: LibraryPackage[]) {
  try {
    window.localStorage.setItem(`${DEVICE_LIBRARY_PREFIX}${libraryId}`, JSON.stringify(packages.slice(0, 20)));
  } catch {
    // A full browser storage area should not interrupt reading or updating.
  }
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [repoUrl, setRepoUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [libraryId, setLibraryId] = useState("");
  const [knowledgePackages, setKnowledgePackages] = useState<LibraryPackage[]>([]);
  const [refreshingPackageId, setRefreshingPackageId] = useState<string | null>(null);
  const [syncingLibrary, setSyncingLibrary] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryStorage, setLibraryStorage] = useState<"checking" | "cloud" | "device">("checking");
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
  const [beginnerTrackId, setBeginnerTrackId] = useState<BeginnerTrack["id"]>("how");
  const [beginnerStage, setBeginnerStage] = useState(0);
  const [beginnerLabStep, setBeginnerLabStep] = useState(0);
  const [beginnerLabComplete, setBeginnerLabComplete] = useState(false);
  const [beginnerArtifactSaved, setBeginnerArtifactSaved] = useState(false);
  const [agentTask, setAgentTask] = useState("读取这篇 README，告诉我 Agent 为什么需要反复调用工具");
  const [makerProblem, setMakerProblem] = useState("模型：判断下一步是回答还是调用工具");
  const [makerInput, setMakerInput] = useState("工具：读取文件并返回真实内容");
  const [makerOutput, setMakerOutput] = useState("循环：没有工具调用时交付最终答案");
  const [evidenceChoice, setEvidenceChoice] = useState<"evidence" | "inference" | "unknown">("inference");

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
    const existing = window.localStorage.getItem("starmate-library-id");
    const id = existing || createLibraryId();
    if (!existing) window.localStorage.setItem("starmate-library-id", id);
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- initialize the anonymous durable library after mount */
    setLibraryId(id);
  }, []);

  useEffect(() => {
    if (!libraryId) return;
    let cancelled = false;
    const devicePackages = readDeviceLibrary(libraryId);
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- restore this device's repository library before checking cloud storage */
    setKnowledgePackages(devicePackages);
    fetch(`/api/repository?libraryId=${encodeURIComponent(libraryId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { packages?: RepositoryLearningPackage[]; error?: string; storage?: "cloud" | "device" };
        if (!response.ok) throw new Error(result.error || "知识库读取失败");
        if (!cancelled) {
          const cloudPackages = result.packages || [];
          const merged = [...cloudPackages, ...devicePackages.filter((item) => !cloudPackages.some((cloud) => cloud.id === item.id))];
          setKnowledgePackages(merged);
          setLibraryStorage(result.storage || "device");
          writeDeviceLibrary(libraryId, merged);
        }
      })
      .catch(() => { if (!cancelled) setLibraryStorage("device"); })
      .finally(() => { if (!cancelled) setLibraryLoading(false); });
    return () => { cancelled = true; };
  }, [libraryId]);

  useEffect(() => {
    if (!libraryId) return;
    const incomingRepository = new URLSearchParams(window.location.search).get("repo") || "";
    if (!incomingRepository.startsWith("https://github.com/")) return;
    const sessionKey = `starmate-extension-import:${incomingRepository}`;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate a repository link sent by the Chrome extension */
    setRepoUrl(incomingRepository);
    setImportMessage("已收到 Chrome 伴读侧栏中的仓库，正在生成学习包…");
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!window.sessionStorage.getItem(sessionKey)) {
      window.sessionStorage.setItem(sessionKey, "true");
      void generateLearningPackage(incomingRepository);
    }
    // The import should run only when the durable library identity becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId]);

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
  const selectedRepos = useMemo(() => starredRepos.filter((repo) => savedRepoIds.includes(repo.id)), [starredRepos, savedRepoIds]);
  const graphRepos = selectedRepos.slice(0, 6);
  const dynamicBeginnerTracks = useMemo<BeginnerTrack[]>(() => knowledgePackages.map((learningPackage) => ({
    id: `repo:${learningPackage.id}`,
    packageId: learningPackage.id,
    repository: learningPackage.fullName,
    owner: learningPackage.owner,
    label: learningPackage.beginner.label,
    role: learningPackage.kindLabel,
    title: `用 10 分钟进入 ${learningPackage.name}`,
    promise: learningPackage.summary,
    hook: learningPackage.beginner.hook,
    mission: learningPackage.beginner.mission,
    outcome: learningPackage.beginner.outcome,
    stages: [
      { title: "30 秒兴趣", duration: "先判断价值", action: learningPackage.beginner.hook, result: "知道为什么值得读" },
      { title: "3 分钟地图", duration: "查看真实大纲", action: learningPackage.recommendedStart, result: "抓住阅读顺序" },
      { title: "5 分钟任务", duration: "完成仓库挑战", action: learningPackage.beginner.mission, result: "留下学习成果" },
      { title: "2 分钟原文", duration: "带问题阅读", action: learningPackage.beginner.challenge, result: "进入真实章节" },
    ],
    mentalModel: learningPackage.beginner.mentalModel,
    terms: learningPackage.concepts.slice(0, 3).map((concept) => ({ term: concept.name, plain: concept.plain, example: concept.evidence })),
    transfer: learningPackage.beginner.outcome,
    challenge: learningPackage.beginner.challenge,
  })), [knowledgePackages]);
  const availableBeginnerTracks = useMemo(() => [...beginnerTracks, ...dynamicBeginnerTracks], [dynamicBeginnerTracks]);
  const currentBeginnerTrack = availableBeginnerTracks.find((track) => track.id === beginnerTrackId) || availableBeginnerTracks[0];
  const currentDynamicPackage = currentBeginnerTrack.packageId ? knowledgePackages.find((item) => item.id === currentBeginnerTrack.packageId) : undefined;
  const conceptGroups = useMemo(() => {
    const groups = new Map<string, { plain: string; repositories: string[]; evidence: string }>();
    knowledgePackages.forEach((learningPackage) => learningPackage.concepts.forEach((concept) => {
      const current = groups.get(concept.name) || { plain: concept.plain, repositories: [], evidence: concept.evidence };
      if (!current.repositories.includes(learningPackage.fullName)) current.repositories.push(learningPackage.fullName);
      groups.set(concept.name, current);
    }));
    return [...groups.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.repositories.length - a.repositories.length || a.name.localeCompare(b.name));
  }, [knowledgePackages]);
  const packageRelations = useMemo(() => {
    const relations: { from: string; to: string; concepts: string[] }[] = [];
    knowledgePackages.forEach((from, index) => knowledgePackages.slice(index + 1).forEach((to) => {
      const concepts = from.concepts.map((concept) => concept.name).filter((name) => to.concepts.some((concept) => concept.name === name));
      if (concepts.length) relations.push({ from: from.fullName, to: to.fullName, concepts });
    }));
    return relations.sort((a, b) => b.concepts.length - a.concepts.length).slice(0, 12);
  }, [knowledgePackages]);
  const evidenceResult = {
    evidence: { label: "直接证据", verdict: "选择偏强：日志能证明出现了 Read 工具调用，但不能单独证明全部内部架构。", confidence: "高可信地描述本次行为，低可信地外推所有场景。" },
    inference: { label: "合理推断", verdict: "判断正确：现有记录支持这个解释，但“内部一定如此实现”仍需要更多场景或源码证据。", confidence: "保留边界，继续用不同任务的日志交叉验证。" },
    unknown: { label: "目前未知", verdict: "过于保守：日志已经提供了一部分行为证据，只是证据还不足以证明唯一实现。", confidence: "可以形成暂定结论，但需要明确写出可信度。" },
  }[evidenceChoice];
  const beginnerArtifact = currentDynamicPackage
    ? `${currentDynamicPackage.fullName} 入门成果｜${currentDynamicPackage.beginner.mission}｜挑战：${currentDynamicPackage.beginner.challenge}`
    : beginnerTrackId === "how"
    ? `how-claude-code-works 入门成果｜任务：${agentTask}｜我画出了目标—模型—工具—结果回传的 Agent Loop。`
    : beginnerTrackId === "scratch"
      ? `claude-code-from-scratch 入门成果｜${makerProblem}｜${makerInput}｜${makerOutput}`
      : `claude-code-reverse 入门成果｜我的判断：${evidenceResult.label}｜阅读原则：一次日志能证明行为，不能自动证明唯一内部实现。`;
  const growingLibraryCount = knowledgePackages.length || selectedRepos.length || sourceDocuments.length;
  const pathRepositories = useMemo(() => knowledgePackages.length ? knowledgePackages.slice(0, 8).map((learningPackage) => ({
    name: learningPackage.name,
    owner: learningPackage.owner,
    role: `${learningPackage.kindLabel} · 动态学习包`,
    summary: learningPackage.summary,
    duration: learningPackage.readingTime,
    layers: buildGrowingRepositoryLayers(learningPackage.url),
  })) : selectedRepos.length ? selectedRepos.slice(0, 6).map((repo) => ({
    name: repo.name,
    owner: repo.full_name.split("/")[0] || "GitHub",
    role: repo.language ? `${repo.language} · 我的收藏` : "我的收藏",
    summary: repo.description || "从 README 建立全局地图，再逐步走到示例、源码和验证。",
    duration: "按自己的节奏",
    layers: buildGrowingRepositoryLayers(repo.html_url),
  })) : repositoryLearningPaths, [knowledgePackages, selectedRepos]);
  const topicGroups = useMemo(() => {
    if (knowledgePackages.length) {
      const groups = new Map<string, string[]>();
      knowledgePackages.forEach((learningPackage) => {
        const labels = [learningPackage.kindLabel, learningPackage.language, ...learningPackage.concepts.slice(0, 4).map((concept) => concept.name)].filter(Boolean);
        labels.forEach((label) => groups.set(label, [...new Set([...(groups.get(label) || []), learningPackage.fullName])]));
      });
      return [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([name, repos]) => ({ name, repos, note: `由已保存学习包的原文结构与概念词典持续生成。` }));
    }
    if (!selectedRepos.length) return [
      { name: "AI Agent 基础", repos: sourceDocuments.map((document) => document.name), note: "内置示范主题，帮助你第一次体验跨文档学习。" },
      { name: "工具与上下文", repos: [sourceDocuments[0].name, sourceDocuments[2].name], note: "观察模型怎样行动，以及信息怎样在任务中流动。" },
      { name: "实现与验证", repos: [sourceDocuments[1].name, sourceDocuments[2].name], note: "把解释、代码和真实证据放在一起对照。" },
    ];
    const groups = new Map<string, string[]>();
    selectedRepos.forEach((repo) => {
      const labels = [repo.language || "其他技术", ...(repo.topics || []).slice(0, 2)];
      labels.forEach((label) => groups.set(label, [...(groups.get(label) || []), repo.full_name]));
    });
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([name, repos]) => ({ name, repos, note: `由你的收藏自动聚合，新增相关仓库后会继续扩展。` }));
  }, [knowledgePackages, selectedRepos]);
  const activeKnowledgePackage = knowledgePackages.find((learningPackage) => learningPackage.fullName === activeDocumentName);
  const activeDocument = sourceDocuments.find((document) => document.name === activeDocumentName) || (activeKnowledgePackage ? {
    name: activeKnowledgePackage.fullName,
    owner: activeKnowledgePackage.owner,
    role: activeKnowledgePackage.kindLabel,
    summary: activeKnowledgePackage.summary,
    concepts: activeKnowledgePackage.concepts.map((concept) => concept.name),
    outline: activeKnowledgePackage.sections.slice(0, 8).map((section) => section.title),
    readingTime: activeKnowledgePackage.readingTime,
    focus: activeKnowledgePackage.beginner.outcome,
    sections: activeKnowledgePackage.sections.slice(0, 20).map((section) => ({ title: section.title, purpose: section.purpose, points: section.keyPoints })),
    url: activeKnowledgePackage.url,
  } : sourceDocuments[2]);
  const readerDocuments = useMemo(() => [...sourceDocuments.map((document) => ({ key: document.name, label: document.name })), ...knowledgePackages.map((learningPackage) => ({ key: learningPackage.fullName, label: learningPackage.name }))], [knowledgePackages]);
  const readmeText = useMemo(() => {
    if (activeKnowledgePackage) return activeKnowledgePackage.readmeMarkdown;
    try { return decodeBase64Utf8(EMBEDDED_READMES[activeDocument.name] || ""); } catch { return ""; }
  }, [activeDocument.name, activeKnowledgePackage]);
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

  async function generateLearningPackage(url: string) {
    if (!url || !libraryId) {
      setImportMessage("请粘贴一个完整的 GitHub 仓库链接");
      return;
    }
    setImporting(true);
    setImportMessage("");
    try {
      const response = await fetch("/api/repository", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, libraryId }),
      });
      const result = (await response.json()) as { package?: RepositoryLearningPackage; error?: string; cacheStatus?: string; storage?: "cloud" | "device" };
      if (!response.ok || !result.package) throw new Error(result.error || "学习包生成失败");
      const learningPackage = result.package;
      const previous = knowledgePackages.find((item) => item.id === learningPackage.id);
      const next: LibraryPackage = { ...learningPackage, changeSummary: compareLearningPackages(previous, learningPackage) };
      updateKnowledgePackages((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      setLibraryStorage(result.storage || "device");
      setBeginnerTrackId(`repo:${learningPackage.id}`);
      setRepoUrl(learningPackage.url);
      setImportMessage(`已生成 ${learningPackage.fullName} 的学习包：${learningPackage.sections.length} 个章节、${learningPackage.concepts.length} 个概念。`);
      setView("beginner");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "生成学习包失败，请稍后再试");
    } finally {
      setImporting(false);
    }
  }

  async function importRepo(event: React.FormEvent) {
    event.preventDefault();
    if (!repoName) {
      setImportMessage("请粘贴一个完整的 GitHub 仓库链接");
      return;
    }
    await generateLearningPackage(repoUrl);
  }

  async function refreshLearningPackage(learningPackage: LibraryPackage, quiet = false) {
    if (!libraryId) return;
    setRefreshingPackageId(learningPackage.id);
    try {
      const response = await fetch("/api/repository", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: learningPackage.url, libraryId, force: true }),
      });
      const result = (await response.json()) as { package?: RepositoryLearningPackage; error?: string; storage?: "cloud" | "device" };
      if (!response.ok || !result.package) throw new Error(result.error || "更新检查失败");
      const next: LibraryPackage = { ...result.package, changeSummary: compareLearningPackages(learningPackage, result.package) };
      updateKnowledgePackages((current) => current.map((item) => item.id === next.id ? next : item));
      setLibraryStorage(result.storage || "device");
      if (!quiet) setImportMessage(next.changeSummary?.status === "unchanged" ? `${next.fullName} 暂无原文变化。` : `${next.fullName} 已更新，并生成了章节变化记录。`);
    } catch (error) {
      if (!quiet) setImportMessage(error instanceof Error ? error.message : "更新检查失败");
    } finally {
      setRefreshingPackageId(null);
    }
  }

  async function refreshWholeLibrary() {
    if (!knowledgePackages.length) return;
    setSyncingLibrary(true);
    setImportMessage("");
    for (const learningPackage of knowledgePackages) await refreshLearningPackage(learningPackage, true);
    setSyncingLibrary(false);
    setImportMessage(`已检查 ${knowledgePackages.length} 个仓库的最新版本。`);
  }

  async function removeLearningPackage(learningPackage: LibraryPackage) {
    if (!libraryId) return;
    try {
      const response = await fetch("/api/repository", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: learningPackage.url, libraryId, action: "remove" }),
      });
      if (!response.ok) throw new Error();
      updateKnowledgePackages((current) => current.filter((item) => item.id !== learningPackage.id));
      if (activeDocumentName === learningPackage.fullName) setActiveDocumentName(sourceDocuments[0].name);
    } catch {
      setImportMessage("暂时无法从知识库移除，请稍后再试。");
    }
  }

  function updateKnowledgePackages(updater: (current: LibraryPackage[]) => LibraryPackage[]) {
    setKnowledgePackages((current) => {
      const next = updater(current);
      if (libraryId) writeDeviceLibrary(libraryId, next);
      return next;
    });
  }

  function finishLesson() {
    setLessonComplete(true);
    window.localStorage.setItem("starmate-lesson-complete", "true");
  }

  function rateCard() {
    setCardIndex((index) => (index + 1) % reviewCards.length);
    setCardRevealed(false);
  }

  function chooseBeginnerTrack(id: string) {
    setBeginnerTrackId(id);
    setBeginnerStage(0);
    setBeginnerLabStep(0);
    setBeginnerLabComplete(false);
    setBeginnerArtifactSaved(false);
  }

  function openBeginnerExperience(repository = activeDocument.name) {
    const track = availableBeginnerTracks.find((item) => item.repository === repository) || availableBeginnerTracks[0];
    chooseBeginnerTrack(track.id);
    setView("beginner");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startBeginnerReading() {
    openDocument(currentBeginnerTrack.repository);
    setReaderMode("guide");
  }

  function finishBeginnerLab() {
    setBeginnerLabComplete(true);
    setBeginnerStage(currentBeginnerTrack.stages.length - 1);
    setBeginnerArtifactSaved(false);
  }

  function saveBeginnerArtifact() {
    window.localStorage.setItem("starmate-beginner-artifact", beginnerArtifact);
    setBeginnerArtifactSaved(true);
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
      <div className="mentor-context"><span>当前上下文 · 实时跟随</span><strong>{activeDocument.name}</strong><small>第 {activeSourceSection + 1} 节 · {currentSectionTitle}</small>{selectedText && <blockquote>“{selectedText.slice(0, 120)}{selectedText.length > 120 ? "…" : ""}”</blockquote>}<div className="mentor-context-actions"><button onClick={() => { setReaderMode("original"); setMobileReaderSurface("document"); goToSourceSection(activeSourceSection); }}>定位当前原文</button>{selectedText && <button onClick={() => addToNotes()}>+ 加入笔记</button>}</div></div>
      <div className="mentor-conversation" aria-live="polite">{mentorMessages.map((message) => <article className={`mentor-bubble ${message.role} ${message.pending ? "pending" : ""} ${message.error ? "error" : ""}`} key={message.id}>{message.title && <strong>{message.title}</strong>}{message.quote && <blockquote>“{message.quote.slice(0, 110)}{message.quote.length > 110 ? "…" : ""}”</blockquote>}<p>{message.content}</p>{message.source && <button className="mentor-source-link" onClick={() => { setReaderMode("original"); setMobileReaderSurface("document"); goToSourceSection(activeSourceSection); }}>依据：{message.source} · 定位原文 ↗</button>}{message.check && <div className="mentor-check"><b>{message.check.question}</b>{message.check.options.map((option, index) => <button className={mentorCheckChoice === index ? (index === message.check?.correct ? "correct" : "wrong") : ""} key={option} onClick={() => setMentorCheckChoice(index)}>{String.fromCharCode(65 + index)}. {option}</button>)}{mentorCheckChoice !== null && <em>{mentorCheckChoice === message.check.correct ? `回答正确：${message.check.feedback}` : "再想一步：回到这一节的核心问题，区分原文证据与无关细节。"}</em>}</div>}</article>)}</div>
      <div className="mentor-actions"><button disabled={mentorLoading} onClick={() => askMentor("解释当前内容", "explain")}><span>译</span>小白解释</button><button disabled={mentorLoading} onClick={() => askMentor("通过提问引导我", "guide")}><span>问</span>引导思考</button><button disabled={mentorLoading} onClick={() => askMentor("举一个容易理解的例子", "example")}><span>例</span>举个例子</button><button disabled={mentorLoading} onClick={() => askMentor("检查我是否理解", "check")}><span>测</span>理解检查</button></div>
      <div className="mentor-input"><input disabled={mentorLoading} aria-label="向伴读老师提问" value={mentorQuestion} onChange={(event) => setMentorQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !mentorLoading) askMentor(); }} placeholder={mentorLoading ? "GPT 正在回答…" : "围绕当前章节提问…"} /><button disabled={mentorLoading} aria-label="发送问题" onClick={() => askMentor()}>{mentorLoading ? "…" : "↑"}</button></div>
      <p className="grounding-note">回答绑定当前仓库与章节，并可一键定位原文；API Key 始终留在服务端</p>
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
          <button className={view === "beginner" ? "active" : ""} onClick={() => setView("beginner")}>无痛入门</button>
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

          <section className="knowledge-inbox">
            <div className="knowledge-inbox-heading"><div><p className="overline">阶段 1 + 2 · 动态知识收件箱</p><h2>新增文章会自动生成学习包，更新时只记录变化</h2><p>粘贴任意公开 GitHub 仓库链接。系统会读取 README、Docs 与目录，用规则生成专属大纲、概念、无痛入门和阅读挑战。</p></div><button onClick={refreshWholeLibrary} disabled={!knowledgePackages.length || syncingLibrary}>{syncingLibrary ? "正在检查全部更新…" : "检查全部仓库更新"}</button></div>
            {libraryLoading ? <div className="knowledge-empty">正在读取你的持久知识库…</div> : knowledgePackages.length === 0 ? <div className="knowledge-empty"><span>＋</span><div><strong>还没有动态学习包</strong><p>在上方粘贴一个 GitHub 仓库链接，第一个学习包会保存在这里。</p></div></div> : <div className="knowledge-package-grid">
              {knowledgePackages.map((learningPackage) => <article key={learningPackage.id}>
                <header><span>{learningPackage.kindLabel}</span><small>{learningPackage.language || "GitHub 文档"} · ★ {learningPackage.stars.toLocaleString()}</small></header>
                <h3>{learningPackage.fullName}</h3><p>{learningPackage.summary}</p>
                <div className="package-stats"><span><b>{learningPackage.sections.length}</b> 个章节</span><span><b>{learningPackage.concepts.length}</b> 个概念</span><span><b>{learningPackage.files.length}</b> 个文件索引</span></div>
                {learningPackage.changeSummary && <div className={`package-change ${learningPackage.changeSummary.status}`}><strong>{learningPackage.changeSummary.status === "added" ? "首次加入知识库" : learningPackage.changeSummary.status === "unchanged" ? "原文暂无变化" : "发现原文更新"}</strong>{learningPackage.changeSummary.status === "updated" && <p>新增 {learningPackage.changeSummary.added.length} 节 · 修改 {learningPackage.changeSummary.changed.length} 节 · 删除 {learningPackage.changeSummary.removed.length} 节</p>}</div>}
                <div className="package-concepts">{learningPackage.concepts.slice(0, 5).map((concept) => <span key={concept.name}>{concept.name}</span>)}</div>
                <footer><button onClick={() => openBeginnerExperience(learningPackage.fullName)}>专属无痛入门</button><button onClick={() => openDocument(learningPackage.fullName)}>App 内阅读</button><button onClick={() => refreshLearningPackage(learningPackage)} disabled={refreshingPackageId === learningPackage.id}>{refreshingPackageId === learningPackage.id ? "检查中…" : "检查更新"}</button><button className="remove-package" onClick={() => removeLearningPackage(learningPackage)}>移除</button></footer>
              </article>)}
            </div>}
          </section>

          <section className="living-knowledge-base">
            <div className="knowledge-inbox-heading"><div><p className="overline">阶段 3 · 不断生长的知识库</p><h2>仓库越多，共同概念和文档关系越清楚</h2><p>关系来自文章实际出现的概念与技术标签；每条关系都会说明因为什么相连。</p></div><button onClick={() => { setOverviewMode("graph"); setView("overview"); }}>打开完整知识图谱 →</button></div>
            {knowledgePackages.length ? <div className="living-knowledge-grid"><div><span>{libraryStorage === "cloud" ? "已保存到云端" : "已保存到当前设备"}</span><strong>{knowledgePackages.length}</strong><small>个仓库学习包</small></div><div><span>已识别</span><strong>{conceptGroups.length}</strong><small>个可解释概念</small></div><div><span>已建立</span><strong>{packageRelations.length}</strong><small>条跨仓库关系</small></div><aside>{conceptGroups.slice(0, 6).map((concept) => <span key={concept.name}>{concept.name}<b>{concept.repositories.length}</b></span>)}</aside></div> : <div className="knowledge-empty"><span>◎</span><div><strong>加入两个以上仓库后，关系会自动出现</strong><p>相同概念会合并，不同仓库会根据解释、实现或证据角色建立关系。</p></div></div>}
          </section>

          <section className="extension-download">
            <div><p className="overline">阶段 4 · Chrome 伴读侧栏实验版</p><h2>不离开 GitHub，也能看目录、搜原文和记笔记</h2><p>插件读取当前页面真实内容，不使用模型生成答案。点击“加入星伴读”后，仓库会回到 Web App 自动生成并保存学习包。</p><div><span>✓ 原文章节定位</span><span>✓ 当前页面搜索</span><span>✓ 仓库独立笔记</span><span>✓ 一键加入知识库</span></div></div><aside><a href="/starmate-chrome-extension.zip" download>下载 Chrome 插件实验版</a><small>下载并解压后，在 Chrome 扩展程序页面选择“加载已解压的扩展程序”</small></aside>
          </section>

          <section className="beginner-entry">
            <div className="beginner-entry-copy"><p className="overline">每个仓库一套入口 · 10 分钟</p><h2>先喜欢上技术，再慢慢学技术。</h2><p>不再重复同一套简单科普。根据当前 GitHub 文章生成兴趣钩子、互动体验、全局地图和原文挑战。</p><button onClick={() => openBeginnerExperience(beginnerTracks[0].repository)}>选择一篇开始 <span>→</span></button></div>
            <div className="beginner-entry-steps" aria-label="无痛入门四步"><div><span>01</span><b>选兴趣</b><small>从真实目标出发</small></div><i>→</i><div><span>02</span><b>先体验</b><small>三分钟看到结果</small></div><i>→</i><div><span>03</span><b>懂原理</b><small>术语翻译成人话</small></div><i>→</i><div><span>04</span><b>得成果</b><small>留下第一份作品</small></div></div>
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
                <div><p className="overline">持续生长的学习库</p><h2>{selectedRepos.length ? `已加入 ${selectedRepos.length} 个收藏仓库` : "先从示范资料建立学习方法"}</h2></div>
                <span className="course-badge">{selectedRepos.length ? "我的收藏" : "新手示范包"}</span>
              </div>
              <div className="course-progress">
                <div className="progress-copy"><span>学习进度</span><strong>{progress}%</strong></div>
                <div className="progress-track"><span style={{ width: `${progress}%` }}></span></div>
              </div>
              <button className="current-lesson" onClick={() => selectedRepos.length ? setView("overview") : setView("beginner")}>
                <span className="lesson-number">{selectedRepos.length ? "★" : "01"}</span>
                <span className="lesson-info"><small>{selectedRepos.length ? "下一步 · 自动整理主题与关系" : "第一次体验 · 约 15 分钟"}</small><strong>{selectedRepos.length ? "查看我的动态学习地图" : "从无痛入门开始"}</strong></span>
                <span className="play-button">→</span>
              </button>
              <div className="course-stats">
                <span><strong>{growingLibraryCount}</strong> 篇学习资料</span>
                <span><strong>{topicGroups.length}</strong> 个主题簇</span>
                <span><strong>{savedRepoIds.length}</strong> 个新增收藏</span>
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
              <button className="feature-card" onClick={() => setView("beginner")}><span>01</span><div className="feature-symbol coral">♡</div><h3>无痛式入门</h3><p>从兴趣和成就感开始，不要求技术基础。</p><b>选择我的目标 →</b></button>
              <button className="feature-card" onClick={() => setView("overview")}><span>02</span><div className="feature-symbol purple">◎</div><h3>动态学习地图</h3><p>收藏越多，主题、关系和路线会一起生长。</p><b>打开地图 →</b></button>
              <button className="feature-card" onClick={() => openLesson(2)}><span>03</span><div className="feature-symbol yellow">≋</div><h3>一次讲透一点</h3><p>原文、小白解释和生活类比放在一起。</p><b>进入伴读 →</b></button>
              <button className="feature-card" onClick={() => setView("review")}><span>04</span><div className="feature-symbol green">↗</div><h3>在遗忘前复习</h3><p>根据你的掌握度，安排真正需要的回忆题。</p><b>开始复习 →</b></button>
            </div>
          </section>
        </div>
      )}

      {view === "beginner" && (
        <div className="page beginner-page">
          <button className="back-link" onClick={() => setView("home")}>← 返回学习台</button>
          <header className="beginner-hero"><div><p className="kicker">仓库专属 · 无痛式入门</p><h1>不是同一套科普，<br /><em>每篇文章都有自己的入口。</em></h1><p>先选择一篇 GitHub 文章。系统会根据它的内容生成不同的兴趣钩子、互动体验、全局地图和阅读挑战。</p></div><div className="beginner-promise"><span>这一轮不需要</span><p>安装环境</p><p>背诵语法</p><p>读完整仓库</p><b>先用 10 分钟抓住这篇文章。</b></div></header>

          <section className="beginner-track-section"><div className="section-heading"><div><p className="overline">第一步 · 选择当前文章</p><h2>你今天想读懂哪一个仓库？</h2></div><span>新增仓库后，会自动出现在这里</span></div><div className="beginner-track-grid">{availableBeginnerTracks.slice(0, 12).map((track, index) => <button className={beginnerTrackId === track.id ? "active" : ""} key={track.id} onClick={() => chooseBeginnerTrack(track.id)}><span>{String(index + 1).padStart(2, "0")} · {track.role}</span><strong>{track.repository}</strong><small>{track.owner}</small><p>{track.promise}</p></button>)}</div></section>

          <section className="beginner-journey">
            <div className="journey-heading"><div><p className="overline">{currentBeginnerTrack.repository} · 专属体验</p><h2>{currentBeginnerTrack.title}</h2><p>{currentBeginnerTrack.promise}</p></div><aside><span>完成后你能够</span><strong>{currentBeginnerTrack.outcome}</strong></aside></div>
            <div className="journey-progress">{currentBeginnerTrack.stages.map((stage, index) => <button className={`${index === beginnerStage ? "active" : ""} ${index < beginnerStage ? "done" : ""}`} key={stage.title} onClick={() => setBeginnerStage(index)}><span>{index < beginnerStage ? "✓" : `0${index + 1}`}</span><b>{stage.title}</b><small>{stage.duration}</small></button>)}</div>

            <div className="repo-hook-card"><div><span>30 秒兴趣钩子</span><h3>{currentBeginnerTrack.hook}</h3></div><aside><small>今天的小任务</small><p>{currentBeginnerTrack.mission}</p></aside></div>

            <section className="repo-mental-map"><div className="repo-section-heading"><div><p className="overline">先看全局地图</p><h3>这篇文章最重要的一条主线</h3></div><span>内容随仓库切换</span></div><div>{currentBeginnerTrack.mentalModel.map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong><p>{item.detail}</p></article>)}</div></section>

            {beginnerTrackId === "how" && <article className="beginner-lab">
              <header><div><p className="overline">当前仓库实践 · Agent Loop</p><h3>在 App 内观察一次完整循环</h3></div><span className="lab-status">{beginnerLabComplete ? "已形成全局直觉" : "对应 README 的核心主线"}</span></header>
              <div className="lab-workspace">
                <label className="lab-field"><span>交给 Agent 的任务</span><textarea value={agentTask} onChange={(event) => { setAgentTask(event.target.value); setBeginnerLabComplete(false); }} /></label>
                <div className="agent-runner">
                  {["模型理解目标", "模型申请 Read 工具", "程序返回 README 内容", "模型基于新观察继续判断"].map((step, index) => <div className={beginnerLabStep > index || beginnerLabComplete ? "done" : beginnerLabStep === index ? "active" : ""} key={step}><span>{beginnerLabStep > index || beginnerLabComplete ? "✓" : index + 1}</span><p><b>{step}</b><small>{index === 0 ? "目标进入当前上下文" : index === 1 ? "模型决定下一步行动" : index === 2 ? "工具结果成为新信息" : "继续调用工具或交付答案"}</small></p></div>)}
                </div>
                {!beginnerLabComplete && <button className="lab-primary" onClick={() => { if (beginnerLabStep < 3) { setBeginnerLabStep((step) => step + 1); setBeginnerStage((stage) => Math.min(stage + 1, 2)); } else finishBeginnerLab(); }}>{beginnerLabStep === 0 ? "让 Agent 开始工作 →" : beginnerLabStep < 3 ? "观察下一步 →" : "查看 Agent 的结果 →"}</button>}
              </div>
              {beginnerLabComplete && <div className="lab-result"><span>how-claude-code-works · 你的第一张系统地图</span><h4>Agent 不是一次回答，而是一段由新观察推动的循环</h4><ol><li>模型负责判断，但不会自己打开文件。</li><li>工具负责行动，并把结果重新送回上下文。</li><li>模型看到结果后，才能决定继续行动还是结束。</li></ol><p><b>带入原文的问题：</b>如果 Tool Result 没有回到模型，循环会在哪一步断掉？</p></div>}
            </article>}

            {beginnerTrackId === "scratch" && <article className="beginner-lab">
              <header><div><p className="overline">当前仓库实践 · 最小实现</p><h3>组装一个最小 Agent 蓝图</h3></div><span className="lab-status">对应 from-scratch 教程结构</span></header>
              <div className="maker-builder">
                <label className="lab-field"><span>模型负责什么</span><input value={makerProblem} onChange={(event) => { setMakerProblem(event.target.value); setBeginnerLabComplete(false); }} /></label><b>→</b>
                <label className="lab-field"><span>工具负责什么</span><input value={makerInput} onChange={(event) => { setMakerInput(event.target.value); setBeginnerLabComplete(false); }} /></label><b>→</b>
                <label className="lab-field"><span>循环何时结束</span><input value={makerOutput} onChange={(event) => { setMakerOutput(event.target.value); setBeginnerLabComplete(false); }} /></label>
              </div>
              <button className="lab-primary" onClick={finishBeginnerLab}>生成最小 Agent 蓝图 →</button>
              {beginnerLabComplete && <div className="lab-result tool-blueprint"><span>claude-code-from-scratch · 最小实现蓝图</span><h4>模型判断与程序执行，通过循环连接起来</h4><div><p><small>模型</small>{makerProblem}</p><b>Tool Call → Tool Result</b><p><small>工具与循环</small>{makerInput}<br />{makerOutput}</p></div><p><b>带入原文的问题：</b>工具定义、工具执行和 Tool Result，为什么少一个都不能形成 Agent Loop？</p></div>}
            </article>}

            {beginnerTrackId === "reverse" && <article className="beginner-lab">
              <header><div><p className="overline">当前仓库实践 · 证据推理</p><h3>给一条逆向结论标注可信度</h3></div><span className="lab-status">不需要读懂全部请求字段</span></header>
              <div className="scenario-card"><span>日志里实际观察到</span><h4>一次任务的请求记录里出现了 Read 工具调用，随后文件内容作为 Tool Result 进入了下一轮消息。</h4><p><b>待判断结论：</b>“Claude Code 内部一定只用这一种方式读取所有文件。”这属于哪一类？</p></div>
              <div className="role-picker">{([ ["evidence", "直接证据", "日志已经足以完整证明这句话"], ["inference", "合理推断", "有证据支持，但结论范围比证据更大"], ["unknown", "目前未知", "这些记录完全无法提供任何线索"] ] as const).map(([id, name, detail]) => <button className={evidenceChoice === id ? "active" : ""} key={id} onClick={() => { setEvidenceChoice(id); setBeginnerLabComplete(false); }}><strong>{name}</strong><span>{detail}</span></button>)}</div>
              <button className="lab-primary" onClick={finishBeginnerLab}>提交判断，查看证据边界 →</button>
              {beginnerLabComplete && <div className="lab-result career-result"><span>claude-code-reverse · 证据判断结果</span><h4>{evidenceResult.verdict}</h4><p><b>下一步：</b>{evidenceResult.confidence}</p></div>}
            </article>}

            {currentDynamicPackage && <article className="beginner-lab dynamic-repo-lab">
              <header><div><p className="overline">动态学习包 · {currentDynamicPackage.kindLabel}</p><h3>{currentDynamicPackage.beginner.mission}</h3></div><span className="lab-status">来自 {currentDynamicPackage.sections.length} 个真实章节</span></header>
              <div className="dynamic-outline-preview">
                {currentDynamicPackage.sections.slice(0, 4).map((section, index) => <button className={beginnerStage === index ? "active" : ""} key={section.id} onClick={() => setBeginnerStage(index)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{section.title}</strong><small>{section.purpose}</small><p>{section.excerpt}</p></div></button>)}
              </div>
              <div className="dynamic-challenge"><span>带入原文的挑战</span><h4>{currentDynamicPackage.beginner.challenge}</h4><p>推荐顺序：{currentDynamicPackage.recommendedStart}</p></div>
              <button className="lab-primary" onClick={finishBeginnerLab}>生成我的仓库阅读任务 →</button>
              {beginnerLabComplete && <div className="lab-result"><span>{currentDynamicPackage.fullName} · 已生成</span><h4>{currentDynamicPackage.beginner.outcome}</h4><ol>{currentDynamicPackage.sections.slice(0, 3).map((section) => <li key={section.id}>{section.title}：{section.purpose}</li>)}</ol><p><b>学习成果：</b>完成挑战后，把自己的答案保存到文档笔记。</p></div>}
            </article>}

            {beginnerLabComplete && <div className="artifact-actions"><div><span>本次体验已留下一份可见成果</span><strong>{beginnerArtifact}</strong></div><button onClick={saveBeginnerArtifact}>{beginnerArtifactSaved ? "✓ 已保存到学习成果" : "保存到我的学习成果"}</button></div>}
            <div className="beginner-to-reading"><div><span>下一步 · 带着地图进入原文</span><strong>{currentBeginnerTrack.transfer}</strong><p>伴读侧栏会自动跟随当前章节；每条回答都可以定位回对应原文。</p></div><button onClick={startBeginnerReading}>开始伴读 {currentBeginnerTrack.repository} →</button></div>
          </section>

          <section className="plain-language"><div><p className="overline">{currentBeginnerTrack.repository} · 术语翻译</p><h2>只解释这篇文章马上会用到的词</h2></div><div className="plain-grid">{currentBeginnerTrack.terms.map((item) => <article key={item.term}><span>{item.term}</span><strong>{item.plain}</strong><p>{item.example}</p></article>)}</div></section>
        </div>
      )}

      {view === "overview" && (
        <div className="page overview-page">
          <button className="back-link" onClick={() => setView("home")}>← 返回学习台</button>
          <header className="overview-hero">
            <div><p className="kicker">收藏持续增长，地图持续更新</p><h1>我的技术收藏<br /><em>动态学习地图</em></h1></div>
            <p>当前学习库包含 {growingLibraryCount} 篇资料。内置的三篇文章只是第一次使用的示范；同步和加入新收藏后，主题、关系与学习路径会围绕你的资料重新组织。</p>
          </header>

          <section className="takeaway-grid">
            <article><span>01</span><strong>{growingLibraryCount} 篇资料</strong><p>收藏库是主内容来源，示范资料只用于帮助第一次体验。</p></article>
            <article><span>02</span><strong>{topicGroups.length} 个主题簇</strong><p>根据语言和仓库主题自动聚合，新收藏会加入已有主题或形成新主题。</p></article>
            <article><span>03</span><strong>一套通用学法</strong><p>每个仓库都按地图、原理、实验、实现和证据逐层推进。</p></article>
          </section>

          <nav className="overview-modes" aria-label="学习方式">
            <button className={overviewMode === "documents" ? "active" : ""} onClick={() => setOverviewMode("documents")}><span>01</span><strong>按文档阅读</strong><small>保留每篇原文结构</small></button>
            <button className={overviewMode === "topic" ? "active" : ""} onClick={() => setOverviewMode("topic")}><span>02</span><strong>按主题学习</strong><small>AI 综合多篇资料</small></button>
            <button className={overviewMode === "path" ? "active" : ""} onClick={() => setOverviewMode("path")}><span>03</span><strong>仓库学习路径</strong><small>从 README 走到实践</small></button>
            <button className={overviewMode === "graph" ? "active" : ""} onClick={() => setOverviewMode("graph")}><span>04</span><strong>探索知识图谱</strong><small>查看文档与概念关系</small></button>
          </nav>

          {overviewMode === "documents" && (
            <section className="mode-panel">
              <div className="mode-heading"><div><p className="overline">我的收藏库 · 持续增长</p><h2>一篇文档，一套独立大纲</h2></div><p>同步并加入伴读的仓库会出现在这里。下面三篇是内置示范资料，用来展示完整的 App 内阅读体验。</p></div>
              <div className="document-list">
                {sourceDocuments.map((document, index) => (
                  <article className={`document-card ${expandedDocument === document.name ? "expanded" : ""}`} key={document.name}>
                    <div className="document-number">0{index + 1}</div>
                    <div className="document-main"><span className="relation-badge">示范 · {document.role}</span><h3>{document.name}</h3><small>{document.owner}</small><p>{document.summary}</p><div className="concept-tags">{document.concepts.map((concept) => <span key={concept}>{concept}</span>)}</div></div>
                    <div className="document-outline"><strong>原文大纲</strong><ol>{document.outline.map((item) => <li key={item}>{item}</li>)}</ol><div className="document-actions"><button className="beginner-inside" onClick={() => openBeginnerExperience(document.name)}>先无痛入门</button><button className="read-inside" onClick={() => openDocument(document.name)}>在 App 内阅读</button><button aria-expanded={expandedDocument === document.name} onClick={() => setExpandedDocument(expandedDocument === document.name ? null : document.name)}>{expandedDocument === document.name ? "收起详细大纲" : "查看详细大纲"}</button><a href={document.url} target="_blank" rel="noreferrer">GitHub ↗</a></div></div>
                    {expandedDocument === document.name && <div className="detailed-outline"><div className="outline-heading"><div><span>完整原文大纲</span><strong>{document.sections.length} 个章节层级</strong></div><a href={document.url} target="_blank" rel="noreferrer">前往完整原文 ↗</a></div><div className="reading-guide"><div><span>预计阅读</span><strong>{document.readingTime}</strong></div><div><span>阅读建议</span><strong>{document.focus}</strong></div></div><ol>{document.sections.map((section, sectionIndex) => <li key={section.title}><span>{String(sectionIndex + 1).padStart(2, "0")}</span><div><h4>{section.title}</h4><p><b>本章解决的问题</b>{section.purpose}</p><div className="section-points"><b>章节内部重点</b>{section.points.map((point) => <em key={point}>{point}</em>)}</div></div></li>)}</ol><a className="start-original" href={document.url} target="_blank" rel="noreferrer">前往完整原文 ↗</a></div>}
                  </article>
                ))}
                {knowledgePackages.map((learningPackage, index) => (
                  <article className={`document-card dynamic-package ${expandedDocument === learningPackage.fullName ? "expanded" : ""}`} key={learningPackage.id}>
                    <div className="document-number">K{index + 1}</div>
                    <div className="document-main"><span className="relation-badge">动态 · {learningPackage.kindLabel}</span><h3>{learningPackage.fullName}</h3><small>{learningPackage.sourceSha.slice(0, 8)} · {learningPackage.readingTime}</small><p>{learningPackage.summary}</p><div className="concept-tags">{learningPackage.concepts.slice(0, 6).map((concept) => <span key={concept.name}>{concept.name}</span>)}</div></div>
                    <div className="document-outline"><strong>真实文档大纲</strong><ol>{learningPackage.sections.slice(0, 4).map((section) => <li key={section.id}>{section.title}</li>)}</ol><div className="document-actions"><button className="beginner-inside" onClick={() => openBeginnerExperience(learningPackage.fullName)}>先无痛入门</button><button className="read-inside" onClick={() => openDocument(learningPackage.fullName)}>在 App 内阅读</button><button onClick={() => setExpandedDocument(expandedDocument === learningPackage.fullName ? null : learningPackage.fullName)}>{expandedDocument === learningPackage.fullName ? "收起完整大纲" : "查看完整大纲"}</button></div></div>
                    {expandedDocument === learningPackage.fullName && <div className="detailed-outline"><div className="outline-heading"><div><span>由 README 与 Docs 自动生成</span><strong>{learningPackage.sections.length} 个真实章节</strong></div><a href={learningPackage.url} target="_blank" rel="noreferrer">GitHub 原文 ↗</a></div><div className="reading-guide"><div><span>推荐起点</span><strong>{learningPackage.recommendedStart}</strong></div><div><span>更新版本</span><strong>{learningPackage.sourceSha.slice(0, 12)}</strong></div></div><ol>{learningPackage.sections.slice(0, 20).map((section, sectionIndex) => <li key={section.id}><span>{String(sectionIndex + 1).padStart(2, "0")}</span><div><h4>{section.title}</h4><p><b>本章解决的问题</b>{section.purpose}</p><div className="section-points"><b>原文来源</b><em>{section.sourcePath}</em>{section.keyPoints.slice(0, 2).map((point) => <em key={point}>{point}</em>)}</div></div></li>)}</ol></div>}
                  </article>
                ))}
                {graphRepos.map((repo) => <article className={`document-card imported ${expandedDocument === repo.full_name ? "expanded" : ""}`} key={repo.id}><div className="document-number">★</div><div className="document-main"><span className="relation-badge">我的收藏</span><h3>{repo.full_name}</h3><p>{repo.description || "尚未提供简介"}</p></div><div className="document-outline"><strong>README 大纲</strong><p>点击后读取这个仓库 README 的真实标题。</p><div className="document-actions"><button onClick={() => { const opening = expandedDocument !== repo.full_name; setExpandedDocument(opening ? repo.full_name : null); if (opening && !repoOutlines[repo.id]?.length) loadRepoOutline(repo); }}>{expandedDocument === repo.full_name ? "收起详细大纲" : "读取详细大纲"}</button><a href={repo.html_url} target="_blank" rel="noreferrer">查看原文 ↗</a></div></div>{expandedDocument === repo.full_name && <div className="detailed-outline imported-detail">{outlineLoading === repo.id ? <p>正在读取 README…</p> : <ol>{(repoOutlines[repo.id] || ["暂未读取到目录"]).map((heading, headingIndex) => <li key={`${heading}-${headingIndex}`}><span>{String(headingIndex + 1).padStart(2, "0")}</span><div><h4>{heading}</h4><p>原文 README 章节</p></div></li>)}</ol>}<a className="start-original" href={repo.html_url} target="_blank" rel="noreferrer">打开完整 README →</a></div>}</article>)}
              </div>
            </section>
          )}

          {overviewMode === "topic" && (
            <section className="mode-panel">
              <div className="mode-heading"><div><p className="overline">按收藏自动聚类</p><h2>{selectedRepos.length ? "你的资料正在形成这些主题" : "先用示范包体验跨文档主题"}</h2></div><p>这里不再绑定固定的三篇文章。加入新收藏后，系统会根据语言与仓库主题自动扩充或生成新的学习主题。</p></div>
              <div className="dynamic-topic-grid">{topicGroups.map((group, index) => <article key={group.name}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{group.repos.length} 篇相关资料</small><h3>{group.name}</h3><p>{group.note}</p><div>{group.repos.slice(0, 4).map((repo) => <em key={repo}>{repo}</em>)}</div></div><button onClick={() => selectedRepos.length ? setOverviewMode("documents") : openLesson(2)}>{selectedRepos.length ? "查看资料 →" : "体验示范 →"}</button></article>)}</div>
            </section>
          )}

          {overviewMode === "path" && (
            <section className="mode-panel learning-path-panel">
              <div className="mode-heading"><div><p className="overline">适用于每个新收藏</p><h2>从“读过”走到“能解释、能运行、能验证”</h2></div><p>不再为三篇文章写死课程。每个加入伴读的仓库都会套用五层学习法，再根据 README、示例、源码和测试生成具体任务。</p></div>
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
                {pathRepositories.map((repository, repositoryIndex) => (
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
              <aside className="path-finish"><span>最终检验</span><div><strong>能解释</strong><p>不用照着 README，也能讲清项目解决什么问题。</p></div><div><strong>能修改</strong><p>能对示例、配置或代码完成一次小改动。</p></div><div><strong>能验证</strong><p>能用运行结果、测试或作品证明自己学会。</p></div></aside>
            </section>
          )}

          {overviewMode === "graph" && (
            <section className="mode-panel graph-panel">
              <div className="mode-heading"><div><p className="overline">可解释知识图谱</p><h2>每条关系都说明“为什么相连”</h2></div><p>黄色是文档，紫色是概念；中间标签是关系类型。下面先展示文档之间的关系，再展示文档与概念的关系。</p></div>
              <div className="graph-legend"><span className="legend-document">文档</span><span className="legend-concept">概念</span><span className="legend-relation">关系说明</span></div>
              <h3 className="graph-subtitle">文档之间</h3>
              <div className="relation-list">
                {knowledgePackages.length >= 2 ? packageRelations.length ? packageRelations.map((relation) => <div className="relation-row" key={`${relation.from}-${relation.to}`}><strong>{relation.from}</strong><span>共同概念 · {relation.concepts.slice(0, 2).join(" / ")}</span><strong>{relation.to}</strong><p>两篇原文都出现并解释了 {relation.concepts.join("、")}，适合放在同一主题下对照阅读；点击文档可以继续查看各自证据。</p></div>) : <div className="growing-empty"><span>◎</span><div><strong>已有多个仓库，但暂未发现可靠共同概念</strong><p>系统不会为了让图谱热闹而强行连线；加入更多相关资料后会重新计算。</p></div></div> : graphRepos.length >= 2 ? graphRepos.slice(0, -1).map((repo, index) => { const next = graphRepos[index + 1]; const shared = (repo.topics || []).find((topic) => (next.topics || []).includes(topic)); return <div className="relation-row" key={`${repo.id}-${next.id}`}><strong>{repo.full_name}</strong><span>{shared ? `共同主题 · ${shared}` : repo.language && repo.language === next.language ? `同为 ${repo.language}` : "学习互补"}</span><strong>{next.full_name}</strong><p>{shared ? `它们都覆盖 ${shared}，适合放在同一条主题路线中对照阅读。` : "系统根据仓库主题、语言和简介形成临时关系；加入更多收藏后会继续调整。"}</p></div>; }) : <div className="growing-empty"><span>✦</span><div><strong>加入至少两个仓库后，这里会生成真实关系</strong><p>关系来自原文出现的概念、仓库主题与技术标签，不再预先写死连线。</p></div></div>}
              </div>
              <h3 className="graph-subtitle">文档与核心概念</h3>
              <div className="concept-relation-grid">
                {knowledgePackages.length ? knowledgePackages.map((learningPackage) => <div className="concept-relation" key={learningPackage.id}><strong>{learningPackage.fullName}</strong><span>{learningPackage.kindLabel} · 动态提取</span><div>{learningPackage.concepts.slice(0, 6).map((concept) => <b key={concept.name}>{concept.name}</b>)}</div><p>{learningPackage.summary}</p><button onClick={() => openDocument(learningPackage.fullName)}>查看原文证据 →</button></div>) : graphRepos.length ? graphRepos.map((repo) => <div className="concept-relation" key={repo.id}><strong>{repo.full_name}</strong><span>我的收藏</span><div>{[repo.language || "其他技术", ...(repo.topics || []).slice(0, 3)].map((concept) => <b key={concept}>{concept}</b>)}</div><p>{repo.description || "等待从 README 提取更详细的概念。"}</p></div>) : sourceDocuments.map((document) => <div className="concept-relation starter" key={document.name}><strong>{document.name}</strong><span>内置示范</span><div>{document.concepts.map((concept) => <b key={concept}>{concept}</b>)}</div><p>{document.summary}</p></div>)}
              </div>
              {conceptGroups.length > 0 && <section className="concept-dictionary"><div className="mode-heading"><div><p className="overline">合并后的概念词典</p><h2>同一个概念，只保留一个入口</h2></div><p>概念会记录出现在哪些仓库，避免知识库随着收藏增长而产生大量重复卡片。</p></div><div>{conceptGroups.slice(0, 16).map((concept) => <article key={concept.name}><span>{concept.repositories.length} 个仓库</span><strong>{concept.name}</strong><p>{concept.plain}</p><small>{concept.repositories.slice(0, 3).join(" · ")}</small></article>)}</div></section>}
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
            <div className="notebook-doc-switch" aria-label="切换文章">{readerDocuments.slice(0, 12).map((document, index) => <button className={document.key === activeDocumentName ? "active" : ""} key={document.key} title={document.label} onClick={() => openDocument(document.key)}>{index + 1}</button>)}</div>
            <p className="sidebar-label">README 真实目录 · {readmeHeadings.length} 节</p>
            <div className="lesson-list">
              {readmeHeadings.map((heading, index) => <button key={`${heading.text}-${index}`} className={`lesson-item ${activeSourceSection === index ? "selected" : ""}`} onClick={() => readerMode === "guide" ? goToGuideSection(index) : goToSourceSection(index)}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{readerMode === "guide" ? "当前讲解章节" : "README 原文章节"}</small><strong>{heading.text}</strong></div></button>)}
            </div>
            <button className="sidebar-beginner-button" onClick={() => openBeginnerExperience(activeDocument.name)}>♡ 先看这篇的 10 分钟入门</button>
            <button className="sidebar-guide-button" onClick={() => { setReaderMode("guide"); setSelectedAnswer(null); }}>✦ 打开当前章节讲解</button>
          </aside>

          <div className="reader-center">
            <nav className="reader-mobile-tabs" aria-label="伴读工作区"><button className={mobileReaderSurface === "document" ? "active" : ""} onClick={() => setMobileReaderSurface("document")}>原文</button><button className={mobileReaderSurface === "mentor" ? "active" : ""} onClick={() => setMobileReaderSurface("mentor")}>AI 伴读</button><button className={mobileReaderSurface === "notes" ? "active" : ""} onClick={() => setMobileReaderSurface("notes")}>笔记</button></nav>
            <article className={`reading-pane ${mobileReaderSurface !== "document" ? "mobile-hidden" : ""}`}>
              <div className="notebook-toolbar"><div><span className="live-dot"></span><strong>浏览器伴读原型 · 正在跟随 {activeDocument.owner}/{activeDocument.name}</strong></div><div className="reader-mode-switch"><button className={readerMode === "original" ? "active" : ""} onClick={() => setReaderMode("original")}>原文全文</button><button className={readerMode === "guide" ? "active" : ""} onClick={() => { setReaderMode("guide"); setSelectedAnswer(null); }}>小白讲解</button></div></div>

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
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><span>⌂</span>学习台</button>
        <button className={view === "beginner" ? "active" : ""} onClick={() => setView("beginner")}><span>♡</span>入门</button>
        <button className={view === "reader" ? "active" : ""} onClick={() => setView("reader")}><span>▤</span>伴读</button>
        <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}><span>↻</span>复习</button>
      </nav>
    </main>
  );
}
