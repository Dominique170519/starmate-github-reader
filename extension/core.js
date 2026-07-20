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
  });

  function normalizeConcept(value = "") {
    return String(value).trim().toLowerCase().replace(/[\s_-]+/g, " ");
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
      .map(([key, value]) => ({ index: source.indexOf(key), value }))
      .filter((item) => item.index >= 0)
      .sort((left, right) => left.index - right.index)
      .slice(0, Math.max(0, limit))
      .map((item) => ({ ...item.value }));
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

  globalThis.StarMateCore = {
    glossary,
    normalizeConcept,
    fingerprint,
    findKnownTerms,
    calculateProgress,
    diffSnapshots,
    buildDocumentGraph,
  };
})();
