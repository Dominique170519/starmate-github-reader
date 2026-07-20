(() => {
  const glossary = Object.freeze({
    agent: {
      term: "Agent",
      plain: "能围绕目标反复观察并采取行动的程序。",
      analogy: "像拿着任务清单、会自己查资料和执行步骤的助理。",
      role: "作者用它指代可以自主完成多步任务的系统。",
    },
    api: {
      term: "API",
      plain: "两个程序按照约定交换信息的入口。",
      analogy: "像餐厅菜单，写清能点什么以及怎样下单。",
      role: "作者用它说明不同软件怎样互相调用。",
    },
    json: {
      term: "JSON",
      plain: "用固定文本格式表达结构化数据的方法。",
      analogy: "像字段名称统一的电子表格。",
      role: "作者用它展示程序传递的数据形状。",
    },
    context: {
      term: "Context",
      plain: "模型完成当前任务时能看到的信息。",
      analogy: "像考试时桌面上允许翻看的资料。",
      role: "作者用它说明模型依据哪些信息判断下一步。",
    },
    prompt: {
      term: "Prompt",
      plain: "交给模型的任务说明和背景信息。",
      analogy: "像给同事的一张任务卡。",
      role: "作者用它描述如何告诉模型要做什么。",
    },
    token: {
      term: "Token",
      plain: "模型读取文字时使用的小块计量单位。",
      analogy: "像把句子切成便于机器处理的小积木。",
      role: "作者用它计算输入输出长度和成本。",
    },
    rag: {
      term: "RAG",
      plain: "先查找相关资料，再让模型依据资料回答。",
      analogy: "像先翻书找到证据，再写答案。",
      role: "作者用它说明如何减少脱离资料的回答。",
    },
    mcp: {
      term: "MCP",
      plain: "让模型以统一方式连接外部工具和资料的协议。",
      analogy: "像不同电器都能使用的统一插座标准。",
      role: "作者用它说明工具怎样接入智能体。",
    },
    "tool call": {
      term: "Tool Call",
      plain: "模型请求外部工具执行一次具体操作。",
      analogy: "像助理填好一张表，请同事按表办事。",
      role: "作者用它说明模型怎样把想法交给程序执行。",
    },
    embedding: {
      term: "Embedding",
      plain: "把文字转换成一组便于比较含义的数字。",
      analogy: "像给每段文字生成一张语义坐标。",
      role: "作者用它说明程序怎样按意思查找相近内容。",
    },
    "vector database": {
      term: "Vector Database",
      plain: "专门保存和查找语义坐标的数据库。",
      analogy: "像按内容相似度找书的图书馆。",
      role: "作者用它保存 Embedding 并快速找回相关资料。",
    },
    workflow: {
      term: "Workflow",
      plain: "把一项任务拆成按顺序执行的步骤。",
      analogy: "像照着菜谱一道工序一道工序做菜。",
      role: "作者用它展示系统完成任务的固定流程。",
    },
    "function calling": {
      term: "Function Calling",
      plain: "让模型按规定格式选择并填写一个程序功能。",
      analogy: "像从服务清单中选项目，再填写申请单。",
      role: "作者用它约束模型怎样调用代码功能。",
    },
    model: {
      term: "Model",
      plain: "从大量数据中学会识别规律并生成结果的程序。",
      analogy: "像经过大量练习、形成判断能力的学生。",
      role: "作者用它指代负责理解或生成内容的核心能力。",
    },
    framework: {
      term: "Framework",
      plain: "为开发某类软件准备好的结构和常用能力。",
      analogy: "像已经搭好承重结构的毛坯房。",
      role: "作者用它说明项目建立在哪套开发骨架上。",
    },
    dependency: {
      term: "Dependency",
      plain: "项目运行时依赖的其他代码或工具。",
      analogy: "像做菜时必须提前备好的原料。",
      role: "作者用它列出项目需要安装或调用的外部能力。",
    },
    repository: {
      term: "Repository",
      plain: "集中保存项目文件和修改记录的空间。",
      analogy: "像带完整修订历史的项目文件夹。",
      role: "作者用它指代 GitHub 上的整个项目。",
    },
    branch: {
      term: "Branch",
      plain: "从同一份代码分出去独立修改的一条版本线。",
      analogy: "像复制一份草稿单独修改，之后再合回正文。",
      role: "作者用它说明代码修改在哪条版本线上进行。",
    },
    commit: {
      term: "Commit",
      plain: "一次带说明的代码修改记录。",
      analogy: "像文档历史里可以随时查看的一次保存。",
      role: "作者用它标记项目在某个时刻发生的具体变化。",
    },
    docker: {
      term: "Docker",
      plain: "把程序和运行所需环境一起装进可搬运容器的工具。",
      analogy: "像把设备和配件装进标准集装箱，到哪都能开箱使用。",
      role: "作者用它减少不同电脑运行环境不一致的问题。",
    },
    http: {
      term: "HTTP",
      plain: "浏览器和服务器在网络上传递信息的一套约定。",
      analogy: "像寄信时统一的信封和地址格式。",
      role: "作者用它说明网页或接口怎样传送请求与结果。",
    },
    endpoint: {
      term: "Endpoint",
      plain: "一个接口可以被访问的具体网络地址。",
      analogy: "像机构里能办理某项业务的具体窗口。",
      role: "作者用它指出请求应发送到哪里。",
    },
    sdk: {
      term: "SDK",
      plain: "为某个平台准备好的开发工具和示例集合。",
      analogy: "像包含工具、说明书和样例的组装套件。",
      role: "作者用它帮助开发者更快接入某项能力。",
    },
    cache: {
      term: "Cache",
      plain: "暂时保存常用结果，避免重复计算或下载。",
      analogy: "像把常用物品放在手边的小抽屉。",
      role: "作者用它提高速度并减少重复请求。",
    },
  });

  const aliases = Object.freeze({
    agents: "agent",
    apis: "api",
    prompts: "prompt",
    tokens: "token",
    "tool calls": "tool call",
    embeddings: "embedding",
    workflows: "workflow",
    models: "model",
    frameworks: "framework",
    dependencies: "dependency",
    repositories: "repository",
    branches: "branch",
    commits: "commit",
    endpoints: "endpoint",
    sdks: "sdk",
    caches: "cache",
  });

  function normalizeConcept(value = "") {
    const normalized = String(value).trim().toLowerCase().replace(/[\s_-]+/g, " ");
    return aliases[normalized] || normalized;
  }

  function fingerprint(text = "") {
    let hash = 2166136261;
    for (const character of String(text)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function findKnownTerms(text = "", limit = 6) {
    const source = String(text).toLowerCase();
    return Object.entries(glossary)
      .map(([key, value]) => {
        const spellings = [key, ...Object.keys(aliases).filter((alias) => aliases[alias] === key)];
        const indices = spellings.map((spelling) => {
          const escaped = spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const match = new RegExp(`(^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`, "i").exec(source);
          return match ? match.index + match[1].length : -1;
        }).filter((index) => index >= 0);
        return { index: indices.length ? Math.min(...indices) : -1, value };
      })
      .filter((item) => item.index >= 0)
      .sort((left, right) => left.index - right.index)
      .slice(0, Math.max(0, limit))
      .map((item) => ({ ...item.value }));
  }

  function explainTerm(value = "") {
    const key = normalizeConcept(value);
    return glossary[key] ? { ...glossary[key] } : null;
  }

  function calculateProgress({
    scrollTop = 0,
    articleTop = 0,
    articleHeight = 0,
    viewportHeight = 0,
    remainingCharacters = 0,
  } = {}) {
    const readable = Math.max(1, articleHeight - viewportHeight);
    const percent = Math.max(
      0,
      Math.min(100, Math.round(((scrollTop - articleTop) / readable) * 100)),
    );
    return {
      percent,
      remainingMinutes: Math.ceil(Math.max(0, remainingCharacters) / 350),
    };
  }

  function diffSnapshots(previous, next) {
    const oldMap = new Map((previous?.sections || []).map((section) => [section.id, section]));
    const newMap = new Map((next?.sections || []).map((section) => [section.id, section]));
    return {
      added: [...newMap.keys()].filter((id) => !oldMap.has(id)),
      changed: [...newMap.keys()].filter(
        (id) => oldMap.has(id) && oldMap.get(id).fingerprint !== newMap.get(id).fingerprint,
      ),
      removed: [...oldMap.keys()].filter((id) => !newMap.has(id)),
    };
  }

  function updateEventId(documentId, commitSha) {
    return `update:${fingerprint(`${documentId}:${commitSha}`)}`;
  }

  function buildDocumentGraph(snapshot, terms = []) {
    const projectId = `project:${snapshot.projectId}`;
    const documentId = `document:${snapshot.documentId}`;
    const fallbackUrl = snapshot.sections?.[0]?.url || snapshot.url;
    const nodes = [
      { id: projectId, type: "project", label: snapshot.projectId },
      { id: documentId, type: "document", label: snapshot.documentId },
    ];
    const edges = [
      {
        from: projectId,
        to: documentId,
        type: "contains",
        evidence: { url: fallbackUrl },
      },
    ];

    for (const section of snapshot.sections || []) {
      const sectionNodeId = `section:${snapshot.documentId}:${section.id}`;
      nodes.push({ id: sectionNodeId, type: "section", label: section.title });
      edges.push({
        from: documentId,
        to: sectionNodeId,
        type: "contains",
        evidence: { url: section.url || fallbackUrl },
      });
    }

    for (const item of terms) {
      const conceptId = `concept:${normalizeConcept(item.term)}`;
      if (!nodes.some((node) => node.id === conceptId)) {
        nodes.push({ id: conceptId, type: "concept", label: item.term });
      }
      const section = (snapshot.sections || []).find((candidate) => candidate.id === item.sectionId);
      edges.push({
        from: `section:${snapshot.documentId}:${item.sectionId}`,
        to: conceptId,
        type: "explains",
        evidence: { url: section?.url || fallbackUrl, excerpt: item.excerpt || "" },
      });
    }

    return { nodes, edges };
  }

  function mergeGraphs(left = { nodes: [], edges: [] }, right = { nodes: [], edges: [] }) {
    const nodes = [];
    const seenNodes = new Set();
    for (const node of [...(left.nodes || []), ...(right.nodes || [])]) {
      const canonicalId = node.type === "concept"
        ? `concept:${normalizeConcept(node.label || node.id.replace(/^concept:/, ""))}`
        : node.id;
      if (seenNodes.has(canonicalId)) continue;
      seenNodes.add(canonicalId);
      nodes.push(canonicalId === node.id ? node : { ...node, id: canonicalId });
    }
    const edges = [];
    const seenEdges = new Set();
    for (const edge of [...(left.edges || []), ...(right.edges || [])]) {
      const key = `${edge.from}|${edge.type}|${edge.to}|${edge.evidence?.url || ""}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      edges.push(edge);
    }
    return { nodes, edges };
  }

  function linkSharedConcepts(graph) {
    const edges = (graph.edges || []).filter((edge) => edge.type !== "shared-concept");
    const documentBySection = new Map(
      edges
        .filter((edge) => edge.type === "contains" && edge.from.startsWith("document:") && edge.to.startsWith("section:"))
        .map((edge) => [edge.to, edge.from]),
    );
    const appearances = new Map();
    for (const edge of edges.filter((item) => item.type === "explains")) {
      const documentId = documentBySection.get(edge.from);
      if (!documentId) continue;
      const items = appearances.get(edge.to) || [];
      if (!items.some((item) => item.documentId === documentId)) {
        items.push({ documentId, evidence: edge.evidence });
      }
      appearances.set(edge.to, items);
    }
    for (const [conceptId, items] of appearances) {
      for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
          edges.push({
            from: items[leftIndex].documentId,
            to: items[rightIndex].documentId,
            type: "shared-concept",
            conceptId,
            evidence: {
              url: items[leftIndex].evidence?.url || items[rightIndex].evidence?.url,
              relatedUrl: items[rightIndex].evidence?.url || items[leftIndex].evidence?.url,
            },
          });
        }
      }
    }
    return { nodes: graph.nodes || [], edges };
  }

  function applyGraphDiff(graph, snapshot, diff, terms = []) {
    const changedSectionIds = new Set([...(diff.added || []), ...(diff.changed || [])]);
    const changedNodeIds = new Set(
      [...changedSectionIds].map((id) => `section:${snapshot.documentId}:${id}`),
    );
    const removedNodeIds = new Set(
      (diff.removed || []).map((id) => `section:${snapshot.documentId}:${id}`),
    );
    const nodes = (graph.nodes || [])
      .filter((node) => !changedNodeIds.has(node.id))
      .map((node) => removedNodeIds.has(node.id) ? { ...node, archived: true } : node);
    const edges = (graph.edges || []).filter(
      (edge) => !changedNodeIds.has(edge.from) && !changedNodeIds.has(edge.to),
    );
    const changedSnapshot = {
      ...snapshot,
      sections: (snapshot.sections || []).filter((section) => changedSectionIds.has(section.id)),
    };
    const changedTerms = terms.filter((term) => changedSectionIds.has(term.sectionId));
    return linkSharedConcepts(
      mergeGraphs({ nodes, edges }, buildDocumentGraph(changedSnapshot, changedTerms)),
    );
  }

  globalThis.StarMateCore = {
    glossary,
    normalizeConcept,
    fingerprint,
    findKnownTerms,
    explainTerm,
    calculateProgress,
    diffSnapshots,
    updateEventId,
    buildDocumentGraph,
    mergeGraphs,
    linkSharedConcepts,
    applyGraphDiff,
  };
})();
