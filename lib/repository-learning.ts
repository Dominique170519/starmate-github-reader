export type RepositoryKind = "tutorial" | "source" | "research" | "tool" | "case";

export type RepositorySection = {
  id: string;
  title: string;
  level: number;
  sourcePath: string;
  excerpt: string;
  purpose: string;
  keyPoints: string[];
};

export type RepositoryConcept = {
  name: string;
  plain: string;
  evidence: string;
  sourcePath: string;
};

export type RepositoryBeginnerExperience = {
  label: string;
  hook: string;
  mission: string;
  outcome: string;
  mentalModel: { title: string; detail: string }[];
  challenge: string;
};

export type RepositoryLearningPackage = {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  language: string;
  topics: string[];
  stars: number;
  kind: RepositoryKind;
  kindLabel: string;
  sourceSha: string;
  sourceUpdatedAt: string;
  syncedAt: string;
  summary: string;
  readingTime: string;
  recommendedStart: string;
  readmeMarkdown: string;
  files: { path: string; sha: string }[];
  sections: RepositorySection[];
  concepts: RepositoryConcept[];
  beginner: RepositoryBeginnerExperience;
};

type MarkdownSource = { path: string; content: string };

const conceptDictionary = [
  { name: "Agent Loop", aliases: ["agent loop", "agentic loop", "主循环", "循环"], plain: "做一步、看结果、再决定下一步的工作循环" },
  { name: "Tool Call", aliases: ["tool call", "tool use", "工具调用"], plain: "模型向程序提交的一张行动申请单" },
  { name: "Tool Result", aliases: ["tool result", "工具结果", "结果回传"], plain: "程序执行行动后交还给模型的新观察" },
  { name: "Context", aliases: ["context", "上下文", "上下文工程"], plain: "模型当前能够看到的任务、历史和资料" },
  { name: "System Prompt", aliases: ["system prompt", "system workflow", "系统提示词"], plain: "规定助手角色、边界和工作方式的长期说明" },
  { name: "Memory", aliases: ["memory", "记忆", "compact", "压缩"], plain: "在长任务中保存重要信息并控制上下文体积的方法" },
  { name: "API", aliases: ["api", "request", "请求"], plain: "软件之间按约定交换信息的接口" },
  { name: "Permission", aliases: ["permission", "权限", "security", "安全"], plain: "决定哪些行动可以直接执行、哪些需要确认的规则" },
  { name: "Sub-agent", aliases: ["sub-agent", "subagent", "子 agent", "子代理"], plain: "拥有独立任务和上下文的辅助执行者" },
  { name: "MCP", aliases: ["mcp", "model context protocol"], plain: "让模型以统一方式连接外部工具和数据的协议" },
  { name: "RAG", aliases: ["rag", "retrieval", "检索增强"], plain: "先检索相关资料，再让模型依据资料回答的方法" },
  { name: "Test", aliases: ["test", "testing", "测试", "验证"], plain: "用可重复结果证明实现符合预期" },
];

const kindProfiles: Record<RepositoryKind, {
  label: string;
  purpose: string;
  starter: Omit<RepositoryBeginnerExperience, "label">;
}> = {
  tutorial: {
    label: "教程型仓库",
    purpose: "先运行最小步骤，再把操作对应到原理",
    starter: {
      hook: "这不是一本需要从头背到尾的教材。先完成最小步骤，再回头理解每个部件为什么存在。",
      mission: "从目录中找出最小可运行路径，并预测它会产生什么结果。",
      outcome: "能说清教程的起点、关键步骤和完成标准。",
      mentalModel: [{ title: "找到入口", detail: "确认最短开始路径" }, { title: "预测结果", detail: "运行前先猜会发生什么" }, { title: "动手验证", detail: "一次只改变一个变量" }, { title: "回到原理", detail: "解释结果为什么出现" }],
      challenge: "如果只能读三个章节，你会保留哪三个？请用学习目标说明理由。",
    },
  },
  source: {
    label: "源码型仓库",
    purpose: "先找入口与主链路，不在第一遍读完所有文件",
    starter: {
      hook: "源码不需要从第一个文件读到最后一个文件。找到一次真实调用怎样穿过系统，会更快建立全局地图。",
      mission: "沿着入口、核心处理和结果返回，画出一条最短调用链。",
      outcome: "能指出系统入口、核心模块和最值得继续追踪的文件。",
      mentalModel: [{ title: "入口", detail: "用户或程序从哪里开始" }, { title: "调度", detail: "谁决定下一步" }, { title: "核心处理", detail: "主要能力在哪里发生" }, { title: "结果返回", detail: "输出怎样回到调用者" }],
      challenge: "如果要修改一个最小行为，你认为应该先检查哪个文件或模块？",
    },
  },
  research: {
    label: "研究／逆向型仓库",
    purpose: "区分观察、推断与仍然未知的部分",
    starter: {
      hook: "研究型仓库的价值不只是结论，更在于作者怎样从日志、请求和实验一步步形成结论。",
      mission: "选一条结论，为它找到原始证据，并标注当前可信度。",
      outcome: "能制作一条“结论—证据—边界”记录。",
      mentalModel: [{ title: "提出问题", detail: "先明确要验证什么" }, { title: "收集记录", detail: "保存请求、日志或行为" }, { title: "比较变化", detail: "一次只改变一个条件" }, { title: "标注边界", detail: "说明证据仍不能证明什么" }],
      challenge: "找一条作者结论，分别写出它能证明什么，以及还不能证明什么。",
    },
  },
  tool: {
    label: "工具型仓库",
    purpose: "先体验一个真实使用场景，再理解配置与实现",
    starter: {
      hook: "先别从安装命令开始。先弄清它替谁解决了什么麻烦，以及结果是否值得你继续投入时间。",
      mission: "选择一个最贴近自己的使用场景，整理输入、操作和预期输出。",
      outcome: "能判断这个工具是否适合自己，并知道最短体验路径。",
      mentalModel: [{ title: "用户问题", detail: "原来哪里费时间" }, { title: "输入", detail: "工具需要什么材料" }, { title: "核心能力", detail: "它替你完成什么" }, { title: "输出", detail: "怎样判断结果有用" }],
      challenge: "写出一个你会真实使用的场景，以及判断工具好不好用的标准。",
    },
  },
  case: {
    label: "案例型仓库",
    purpose: "沿问题、方案、取舍与结果理解案例",
    starter: {
      hook: "案例最值得学习的不是最后答案，而是作者面对限制时做了哪些选择。",
      mission: "把案例整理成问题、方案、取舍和结果四格卡片。",
      outcome: "能把案例经验迁移到一个自己的问题中。",
      mentalModel: [{ title: "问题", detail: "为什么需要这个项目" }, { title: "方案", detail: "作者选择了什么做法" }, { title: "取舍", detail: "为了什么放弃了什么" }, { title: "结果", detail: "用什么证据判断有效" }],
      challenge: "如果约束发生变化，原方案中最先需要调整的部分是什么？",
    },
  },
};

function cleanMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[\*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
}

function firstUsefulParagraph(markdown: string) {
  return markdown
    .split(/\n\s*\n/)
    .map(cleanMarkdown)
    .find((item) => item.length >= 35 && !item.startsWith("#") && !/^https?:/i.test(item)) || "";
}

function classifyRepository(text: string, paths: string[]): RepositoryKind {
  const value = `${text} ${paths.join(" ")}`.toLowerCase();
  if (/reverse|逆向|request log|traffic|抓包|analysis result|research/.test(value)) return "research";
  if (/from[- ]scratch|tutorial|教程|quick start|step by step|learn|course/.test(value)) return "tutorial";
  if (/case study|案例|showcase|example app|demo project/.test(value)) return "case";
  if (paths.some((path) => /(^|\/)(src|lib|packages)\//.test(path)) && /architecture|implementation|源码|source/.test(value)) return "source";
  return "tool";
}

function sectionPurpose(title: string, kind: RepositoryKind) {
  const normalized = title.toLowerCase();
  if (/install|安装|setup|quick start|开始/.test(normalized)) return "帮助你完成第一次可运行或可观察的体验";
  if (/architecture|架构|design|设计|结构/.test(normalized)) return "建立模块、边界和信息流的全局地图";
  if (/example|示例|usage|使用/.test(normalized)) return "通过具体输入与输出理解如何使用";
  if (/test|验证|benchmark|评测/.test(normalized)) return "说明如何用可重复结果判断是否学会或实现正确";
  if (/api|request|请求|log|日志/.test(normalized)) return "从真实接口或运行记录理解系统行为";
  return kindProfiles[kind].purpose;
}

export function buildRepositoryPackage(input: {
  repository: {
    owner: string;
    name: string;
    url: string;
    description: string;
    language: string;
    topics: string[];
    stars: number;
    updatedAt: string;
  };
  sourceSha: string;
  files: { path: string; sha: string }[];
  markdownSources: MarkdownSource[];
}): RepositoryLearningPackage {
  const { repository, sourceSha, files, markdownSources } = input;
  const readme = markdownSources.find((item) => /(^|\/)readme(\.[^.]+)?$/i.test(item.path)) || markdownSources[0];
  const combinedText = markdownSources.map((source) => `${source.path}\n${source.content}`).join("\n");
  const kind = classifyRepository(`${repository.name} ${repository.description} ${combinedText.slice(0, 35_000)}`, files.map((file) => file.path));
  const rawSections: RepositorySection[] = [];

  markdownSources.forEach((source) => {
    const lines = source.content.split("\n");
    let current: { title: string; level: number; content: string[] } | null = null;
    const flush = () => {
      if (!current) return;
      const paragraphs = current.content.map(cleanMarkdown).filter((item) => item.length >= 15 && !/^https?:/i.test(item));
      rawSections.push({
        id: `${stableId(source.path)}-${stableId(current.title)}`,
        title: cleanMarkdown(current.title),
        level: current.level,
        sourcePath: source.path,
        excerpt: (paragraphs[0] || `本节围绕“${cleanMarkdown(current.title)}”展开。`).slice(0, 320),
        purpose: sectionPurpose(current.title, kind),
        keyPoints: paragraphs.slice(0, 3).map((item) => item.slice(0, 180)),
      });
    };
    lines.forEach((line) => {
      const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
      if (heading) {
        flush();
        current = { title: heading[2], level: heading[1].length, content: [] };
      } else if (current && line.trim()) current.content.push(line);
    });
    flush();
  });

  const sections = rawSections.filter((section, index, list) => list.findIndex((item) => item.title === section.title && item.sourcePath === section.sourcePath) === index).slice(0, 60);
  if (!sections.length) {
    sections.push({ id: "overview", title: "项目简介", level: 1, sourcePath: readme?.path || "README.md", excerpt: firstUsefulParagraph(readme?.content || repository.description), purpose: kindProfiles[kind].purpose, keyPoints: [] });
  }

  const concepts = conceptDictionary
    .filter((concept) => concept.aliases.some((alias) => combinedText.toLowerCase().includes(alias.toLowerCase())))
    .slice(0, 12)
    .map((concept) => {
      const section = sections.find((item) => concept.aliases.some((alias) => `${item.title} ${item.excerpt}`.toLowerCase().includes(alias.toLowerCase()))) || sections[0];
      return { name: concept.name, plain: concept.plain, evidence: section.excerpt, sourcePath: section.sourcePath };
    });

  [repository.language, ...repository.topics].filter(Boolean).forEach((name) => {
    if (!concepts.some((concept) => concept.name.toLowerCase() === name.toLowerCase()) && concepts.length < 12) {
      concepts.push({ name, plain: `这个仓库的重要技术标签：${name}`, evidence: repository.description || sections[0].excerpt, sourcePath: readme?.path || "README.md" });
    }
  });

  const summary = (repository.description || firstUsefulParagraph(readme?.content || "") || sections[0].excerpt).slice(0, 360);
  const profile = kindProfiles[kind];
  const totalCharacters = markdownSources.reduce((sum, item) => sum + item.content.length, 0);

  return {
    id: `${repository.owner.toLowerCase()}/${repository.name.toLowerCase()}`,
    owner: repository.owner,
    name: repository.name,
    fullName: `${repository.owner}/${repository.name}`,
    url: repository.url,
    description: repository.description,
    language: repository.language,
    topics: repository.topics,
    stars: repository.stars,
    kind,
    kindLabel: profile.label,
    sourceSha,
    sourceUpdatedAt: repository.updatedAt,
    syncedAt: new Date().toISOString(),
    summary,
    readingTime: `约 ${Math.max(5, Math.ceil(totalCharacters / 900))} 分钟`,
    recommendedStart: sections.slice(0, 3).map((section) => section.title).join(" → "),
    readmeMarkdown: (readme?.content || "").slice(0, 180_000),
    files,
    sections,
    concepts,
    beginner: { label: profile.label, ...profile.starter },
  };
}
