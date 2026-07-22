(() => {
  const APP_URL = "https://windy3f3f3f3f-how-claude-code-works.vercel.app";
  // StarMateStorage keeps notes and reading state in chrome.storage.local.
  const ROOT_ID = "starmate-extension-root";
  let currentDocumentId = "";
  let currentSignature = "";
  let cleanupSession = () => {};
  let stopWatchingRoute = () => {};
  let refreshGeneration = 0;

  function create(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return `${seconds} 秒`;
    return `${minutes} 分钟`;
  }

  function scrollToSource(target) {
    document.querySelectorAll(".starmate-source-highlight").forEach((node) => {
      node.classList.remove("starmate-source-highlight");
    });
    target.classList.add("starmate-source-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.classList.remove("starmate-source-highlight"), 2600);
  }

  function waitForArticle(adapter, previousSignature = "", timeoutMs = 8000) {
    return new Promise((resolve) => {
      let settled = false;
      let observer;
      let timeout;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        observer?.disconnect();
        window.clearTimeout(timeout);
        resolve(value);
      };
      const check = () => {
        const candidate = adapter.read(document);
        const signature = candidate.root
          ? globalThis.StarMateCore.fingerprint(candidate.root.textContent || "")
          : "";
        const routeContentChanged = adapter.kind !== "docsify"
          || !previousSignature
          || signature !== previousSignature;
        if (candidate.root && candidate.sections.length > 0 && routeContentChanged) {
          finish({ article: candidate, signature });
        }
      };
      observer = new MutationObserver(check);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      timeout = window.setTimeout(() => finish(null), timeoutMs);
      requestAnimationFrame(check);
    });
  }

  function showWaitingShell(adapter) {
    document.getElementById(ROOT_ID)?.remove();
    const waitingShell = create("div", "starmate-extension-shell");
    waitingShell.id = ROOT_ID;
    const waitingLauncher = create("button", "starmate-launcher", "✦ 重试伴读");
    waitingLauncher.type = "button";
    waitingLauncher.setAttribute("aria-label", "重新尝试读取正文");
    const waitingPanel = create("aside", "starmate-panel open");
    const waitingBody = create("section", "starmate-view active");
    waitingBody.append(
      create("strong", "", adapter.projectId),
      create("p", "starmate-empty", "正文尚未加载，重新打开侧栏后会再次尝试。"),
    );
    waitingPanel.append(waitingBody);
    waitingLauncher.addEventListener("click", () => refreshForLocation(true));
    waitingShell.append(waitingLauncher, waitingPanel);
    document.body.append(waitingShell);
  }

  function mount(adapter, article) {
    document.getElementById(ROOT_ID)?.remove();
    const controller = new AbortController();
    let disposed = false;

  const shell = create("div", "starmate-extension-shell");
  shell.id = ROOT_ID;

  const progress = create("div", "starmate-reading-progress");
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  const progressFill = create("span", "starmate-reading-progress-fill");
  const progressCopy = create("small", "starmate-reading-progress-copy", "本章 0%");
  progress.append(progressFill, progressCopy);

  const launcher = create("button", "starmate-launcher", "✦ 伴读");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "打开星伴读侧栏");
  const panel = create("aside", "starmate-panel");
  panel.setAttribute("aria-label", "星伴读阅读侧栏");

  const header = create("header", "starmate-panel-header");
  const identity = create("div");
  identity.append(create("span", "", adapter.kind === "docsify" ? "正在阅读技术文档" : "正在阅读 GitHub"));
  identity.append(create("strong", "", adapter.projectId));
  const close = create("button", "", "×");
  close.type = "button";
  close.setAttribute("aria-label", "关闭伴读侧栏");
  header.append(identity, close);

  const intro = create("section", "starmate-intro");
  intro.append(
    create("span", "", `已识别 ${article.sections.length} 个原文章节`),
    create("p", "", article.paragraphs[0]?.text.slice(0, 180) || "阅读记录仅保存在这台设备。"),
  );

  const tabs = create("nav", "starmate-tabs");
  const tabItems = [
    ["本章", "chapter"],
    ["文章地图", "map"],
    ["知识图谱", "graph"],
    ["作者更新", "updates"],
    ["原文搜索", "search"],
    ["我的笔记", "note"],
  ].map(([label, id], index) => {
    const button = create("button", index === 0 ? "active" : "", label);
    button.type = "button";
    button.dataset.view = id;
    tabs.append(button);
    return button;
  });

  const body = create("div", "starmate-panel-body");
  const chapterView = create("section", "starmate-view active");
  chapterView.dataset.view = "chapter";
  const chapterHeading = create("div", "starmate-view-heading");
  chapterHeading.append(create("span", "", "阅读明细"), create("strong", "", "这次读到哪里了"));
  const detailGrid = create("div", "starmate-reading-detail");
  const detailSection = create("strong", "", article.sections[0]?.title || "正文");
  const detailProgress = create("span", "", "0%");
  const detailRemaining = create("span", "", "预计剩余 0 分钟");
  const detailActive = create("span", "", "专注阅读 0 秒");
  detailGrid.append(
    create("small", "", "当前章节"), detailSection,
    create("small", "", "本章进度"), detailProgress,
    create("small", "", "预计时间"), detailRemaining,
    create("small", "", "阅读用时"), detailActive,
  );
  const completeButton = create("button", "starmate-secondary", "✓ 标记已完成");
  completeButton.type = "button";
  chapterView.append(chapterHeading, detailGrid, completeButton);

  const mapView = create("section", "starmate-view");
  mapView.dataset.view = "map";
  const mapHeading = create("div", "starmate-view-heading");
  mapHeading.append(create("span", "", article.documentPath), create("strong", "", "点击章节定位原文"));
  const outline = create("div", "starmate-outline");
  article.sections.slice(0, 50).forEach((section, index) => {
    const button = create("button");
    button.type = "button";
    button.append(
      create("span", "", String(index + 1).padStart(2, "0")),
      create("strong", "", section.title),
    );
    button.addEventListener("click", () => scrollToSource(section.element));
    outline.append(button);
  });
  mapView.append(mapHeading, outline);

  const graphView = create("section", "starmate-view");
  graphView.dataset.view = "graph";
  const graphHeading = create("div", "starmate-view-heading");
  graphHeading.append(create("span", "", "单篇也有图谱"), create("strong", "", "项目 → 文档 → 章节 → 概念"));
  const miniGraph = create("div", "starmate-mini-graph");
  miniGraph.append(create("p", "starmate-empty", "正在从当前原文生成关系…"));
  const graphEvidence = create("div", "starmate-graph-evidence");
  graphEvidence.hidden = true;
  const graphEvidenceCopy = create("p");
  const graphEvidenceLink = create("a", "starmate-evidence-link", "查看原文证据 ↗");
  graphEvidenceLink.target = "_blank";
  graphEvidenceLink.rel = "noopener";
  graphEvidence.append(graphEvidenceCopy, graphEvidenceLink);
  graphView.append(graphHeading, miniGraph, graphEvidence);

  const updatesView = create("section", "starmate-view");
  updatesView.dataset.view = "updates";
  const updatesHeading = create("div", "starmate-view-heading");
  updatesHeading.append(create("span", "", "作者更新明细"), create("strong", "", "只显示有原文证据的变化"));
  const updatesTimeline = create("div", "starmate-update-timeline");
  updatesTimeline.append(create("p", "starmate-empty", "正在读取当前版本…"));
  updatesView.append(updatesHeading, updatesTimeline);

  const searchView = create("section", "starmate-view");
  searchView.dataset.view = "search";
  const searchInput = create("input", "starmate-search");
  searchInput.placeholder = "输入术语，例如 Context、API、工具…";
  searchInput.setAttribute("aria-label", "搜索当前原文");
  const searchResults = create("div", "starmate-search-results");
  searchResults.append(create("p", "starmate-empty", "输入关键词后，只搜索当前页面原文。"));
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    searchResults.replaceChildren();
    if (query.length < 2) {
      searchResults.append(create("p", "starmate-empty", "至少输入两个字符。"));
      return;
    }
    const results = article.paragraphs
      .filter((item) => item.text.toLowerCase().includes(query))
      .slice(0, 12);
    for (const result of results) {
      const button = create("button", "", result.text.slice(0, 180));
      button.type = "button";
      button.addEventListener("click", () => scrollToSource(result.element));
      searchResults.append(button);
    }
    if (!results.length) searchResults.append(create("p", "starmate-empty", "当前页面没有找到相关原文。"));
  });
  searchView.append(searchInput, searchResults);

  const noteView = create("section", "starmate-view");
  noteView.dataset.view = "note";
  const noteHint = create("p", "starmate-note-hint", "可以直接新建空白笔记，也可以把原文、自己的理解、疑问或术语保存成独立卡片。");
  const noteToolbar = create("div", "starmate-note-toolbar");
  const newNote = create("button", "starmate-primary", "＋ 新建笔记");
  const addSelection = create("button", "starmate-secondary", "摘录选中原文");
  const connectGitHub = create("button", "starmate-secondary", "连接 GitHub");
  const syncNow = create("button", "starmate-secondary", "立即同步");
  newNote.type = "button";
  addSelection.type = "button";
  connectGitHub.type = "button";
  syncNow.type = "button";
  noteToolbar.append(newNote, addSelection, connectGitHub, syncNow);

  const composer = create("section", "starmate-note-composer");
  composer.hidden = true;
  const typeSelect = create("select");
  [
    ["freeform", "自由笔记"],
    ["quote", "原文摘录"],
    ["understanding", "自己的理解"],
    ["question", "疑问"],
    ["term", "术语"],
    ["mentor-answer", "AI 回答"],
    ["review", "待复习"],
  ].forEach(([value, label]) => {
    const option = create("option", "", label);
    option.value = value;
    typeSelect.append(option);
  });
  const titleInput = create("input");
  titleInput.placeholder = "标题（可选）";
  const quotePreview = create("blockquote", "starmate-note-quote");
  quotePreview.hidden = true;
  const bodyInput = create("textarea");
  bodyInput.placeholder = "不需要先选择原文，直接记下现在的想法…";
  const tagsInput = create("input");
  tagsInput.placeholder = "标签，用逗号分隔";
  const composerActions = create("div");
  const cancelNote = create("button", "", "取消");
  const saveNote = create("button", "starmate-primary", "保存笔记卡片");
  cancelNote.type = "button";
  saveNote.type = "button";
  composerActions.append(cancelNote, saveNote);
  composer.append(typeSelect, titleInput, quotePreview, bodyInput, tagsInput, composerActions);

  const noteStatus = create("small", "starmate-note-status", "仅保存在本设备");
  const noteList = create("div", "starmate-note-list");
  const openNotebook = create("a", "starmate-open-notebook", "在网页中管理全部笔记 →");
  openNotebook.href = `${APP_URL}/?open=notebook`;
  openNotebook.target = "_blank";
  openNotebook.rel = "noopener";
  let editingNote = null;
  let draftQuote = "";

  function requestNoteSync() {
    noteStatus.textContent = "已在本地保存 · 等待同步";
    chrome.runtime.sendMessage({ type: "starmate-note-changed" });
  }

  function resetComposer() {
    editingNote = null;
    draftQuote = "";
    typeSelect.value = "freeform";
    titleInput.value = "";
    bodyInput.value = "";
    tagsInput.value = "";
    quotePreview.textContent = "";
    quotePreview.hidden = true;
    composer.hidden = true;
  }

  function openComposer(note = null, quote = "") {
    editingNote = note;
    draftQuote = quote || note?.quote || "";
    typeSelect.value = note?.type || (draftQuote ? "quote" : "freeform");
    titleInput.value = note?.title || "";
    bodyInput.value = note?.body || "";
    tagsInput.value = (note?.tags || []).join("，");
    quotePreview.textContent = draftQuote ? `“${draftQuote}”` : "";
    quotePreview.hidden = !draftQuote;
    composer.hidden = false;
    bodyInput.focus();
  }

  async function renderNotes() {
    const notes = await globalThis.StarMateStorage.listNotes({ documentId: adapter.documentId });
    noteList.replaceChildren();
    if (!notes.length) {
      noteList.append(create("p", "starmate-empty", "这篇文章还没有笔记。可以直接新建，不必先选择原文。"));
      return;
    }
    const labels = { freeform: "自由笔记", quote: "原文摘录", understanding: "自己的理解", question: "疑问", term: "术语", "mentor-answer": "AI 回答", review: "待复习" };
    for (const note of notes) {
      const card = create("article", `starmate-note-card${note.pinned ? " pinned" : ""}`);
      const cardHeader = create("header");
      cardHeader.append(create("span", "", labels[note.type] || "自由笔记"), create("small", "", new Date(note.updatedAt).toLocaleDateString("zh-CN")));
      if (note.title) card.append(create("strong", "", note.title));
      if (note.quote) card.append(create("blockquote", "", `“${note.quote}”`));
      card.append(cardHeader, create("p", "", note.body || "这张卡片只保存了原文摘录。"));
      const tags = create("div", "starmate-note-tags");
      (note.tags || []).forEach((tag) => tags.append(create("span", "", `#${tag}`)));
      const actions = create("footer");
      const pin = create("button", note.pinned ? "active" : "", note.pinned ? "已置顶" : "置顶");
      const review = create("button", note.reviewNeeded ? "active" : "", "待复习");
      const edit = create("button", "", "编辑");
      const remove = create("button", "danger", "删除");
      [pin, review, edit, remove].forEach((button) => { button.type = "button"; actions.append(button); });
      pin.addEventListener("click", async () => {
        await globalThis.StarMateStorage.saveNote({ ...note, pinned: !note.pinned, version: note.version + 1, updatedAt: new Date().toISOString() });
        requestNoteSync();
        renderNotes();
      });
      review.addEventListener("click", async () => {
        await globalThis.StarMateStorage.saveNote({ ...note, reviewNeeded: !note.reviewNeeded, version: note.version + 1, updatedAt: new Date().toISOString() });
        requestNoteSync();
        renderNotes();
      });
      edit.addEventListener("click", () => openComposer(note));
      remove.addEventListener("click", async () => {
        await globalThis.StarMateStorage.removeNote(note.id);
        requestNoteSync();
        renderNotes();
      });
      card.append(tags, actions);
      noteList.append(card);
    }
  }

  newNote.addEventListener("click", () => openComposer());
  connectGitHub.addEventListener("click", () => {
    noteStatus.textContent = "等待网页端批准插件连接…";
    chrome.runtime.sendMessage({ type: "starmate-connect-github" }, (result) => {
      noteStatus.textContent = result?.connected ? "已连接 GitHub · 等待同步" : result?.error || "连接失败，请重试";
    });
  });
  syncNow.addEventListener("click", () => {
    noteStatus.textContent = "正在安全同步…";
    chrome.runtime.sendMessage({ type: "starmate-sync-now" }, (result) => {
      if (!result) noteStatus.textContent = "网络暂时不可用，笔记仍在本地";
    });
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "starmate-sync-status") return;
    const labels = {
      connecting: "等待网页端批准插件连接…",
      waiting: "网络暂时不可用 · 笔记仍在本地等待同步",
      syncing: "正在安全同步…",
      synced: "已同步 · 网页端和其他设备可见",
      conflict: "发现版本差异 · 已保留历史版本",
      "auth-required": "需要连接 GitHub 才能跨设备同步",
      local: "云端暂不可用 · 笔记仍保存在本设备",
      error: "连接失败，请重试",
    };
    noteStatus.textContent = labels[message.status] || "仅保存在本设备";
    if (message.status === "synced" || message.status === "conflict") renderNotes();
  });
  addSelection.addEventListener("click", () => {
    const selection = window.getSelection()?.toString().replace(/\s+/g, " ").trim();
    if (!selection) {
      noteStatus.textContent = "请先在原文中选中一段文字";
      return;
    }
    openComposer(null, selection.slice(0, 8000));
  });
  cancelNote.addEventListener("click", resetComposer);
  saveNote.addEventListener("click", async () => {
    if (!bodyInput.value.trim() && !draftQuote) {
      noteStatus.textContent = "请先写一点内容";
      return;
    }
    const section = currentSection();
    const now = new Date().toISOString();
    const note = globalThis.StarMateCore.createNoteCard({
      ...editingNote,
      repositoryId: article.projectId,
      documentId: adapter.documentId,
      sectionId: section?.id || "",
      sourceUrl: section?.url || article.url,
      type: typeSelect.value,
      title: titleInput.value,
      body: bodyInput.value,
      quote: draftQuote,
      tags: tagsInput.value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean),
      reviewNeeded: typeSelect.value === "review" || Boolean(editingNote?.reviewNeeded),
      version: editingNote ? editingNote.version + 1 : 1,
      updatedAt: now,
    }, now);
    await globalThis.StarMateStorage.saveNote(note);
    resetComposer();
    requestNoteSync();
    renderNotes();
  });
  globalThis.StarMateStorage.migrateLegacyNote(adapter.documentId, {
    repositoryId: article.projectId,
    sourceUrl: article.url,
  }).then(renderNotes);
  chrome.runtime.sendMessage({ type: "starmate-sync-state" }, (state) => {
    const labels = { syncing: "正在安全同步…", synced: "已同步 · 网页端和其他设备可见", conflict: "发现版本差异 · 已保留历史版本", waiting: "已在本地保存 · 等待同步", "auth-required": "需要连接 GitHub 才能跨设备同步", local: "仅保存在本设备" };
    noteStatus.textContent = labels[state?.status] || "仅保存在本设备";
  });
  noteView.append(noteHint, noteToolbar, composer, noteStatus, noteList, openNotebook);

  const termCard = create("section", "starmate-term-card");
  termCard.setAttribute("role", "dialog");
  termCard.setAttribute("aria-modal", "false");
  termCard.setAttribute("aria-label", "专业名词解释");
  termCard.hidden = true;
  const termCardHeader = create("header");
  const termCardTitle = create("strong", "", "名词解释");
  const termCardClose = create("button", "", "×");
  termCardClose.type = "button";
  termCardClose.setAttribute("aria-label", "关闭名词解释");
  termCardHeader.append(termCardTitle, termCardClose);
  const termPlain = create("p");
  const termAnalogy = create("p");
  const termRole = create("p");
  const termActions = create("div", "starmate-term-actions");
  const understoodButton = create("button", "starmate-primary", "我懂了");
  const reviewButton = create("button", "starmate-secondary", "需要回看");
  understoodButton.type = "button";
  reviewButton.type = "button";
  termActions.append(understoodButton, reviewButton);
  termCard.append(termCardHeader, termPlain, termAnalogy, termRole, termActions);

  body.append(chapterView, mapView, graphView, updatesView, searchView, noteView);
  const footer = create("footer", "starmate-panel-footer");
  const addButton = create("button", "starmate-primary", "加入星伴读知识库 →");
  addButton.type = "button";
  addButton.addEventListener("click", () => {
    window.open(`${APP_URL}/?repo=${encodeURIComponent(adapter.repositoryUrl)}`, "_blank", "noopener");
  });
  footer.append(addButton, create("small", "", "无模型版 · 阅读数据默认只保存在当前设备"));
  panel.append(header, intro, tabs, body, footer);
  shell.append(progress, launcher, panel, termCard);
  document.body.append(shell);

  function showView(id) {
    tabItems.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === id));
    body.querySelectorAll(".starmate-view").forEach((view) => {
      view.classList.toggle("active", view.dataset.view === id);
    });
  }
  tabItems.forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.view)));
  launcher.addEventListener("click", () => panel.classList.add("open"));
  close.addEventListener("click", () => panel.classList.remove("open"));

  let state = {
    progress: 0,
    activeSeconds: 0,
    lastSectionId: article.sections[0]?.id || "",
    completed: false,
  };
  let lastActivityAt = Date.now();
  let saveTimer = 0;
  let frame = 0;
  let activeTerm = "";
  let lastTermButton = null;
  const termEvidence = [];

  function addUnique(items, value) {
    return [...new Set([...(items || []), value])];
  }

  function hideTermCard() {
    termCard.hidden = true;
    lastTermButton?.focus();
  }

  function showTermCard(button, explanation, sourceText) {
    activeTerm = explanation.term;
    lastTermButton = button;
    termCardTitle.textContent = explanation.term;
    termPlain.replaceChildren(create("strong", "", "简单解释"), document.createTextNode(explanation.plain));
    termAnalogy.replaceChildren(create("strong", "", "生活类比"), document.createTextNode(explanation.analogy));
    termRole.replaceChildren(
      create("strong", "", "在这段话里的作用"),
      document.createTextNode(`${explanation.role} 原文位置：“${sourceText.slice(0, 120)}”`),
    );
    termCard.hidden = false;
    termCardClose.focus();
  }

  function wrapFirstKnownTerm(container, explanation, sectionId, sourceText) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const escaped = explanation.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^a-z0-9])(${escaped}s?)(?=$|[^a-z0-9])`, "i");
    let textNode = walker.nextNode();
    while (textNode) {
      const parent = textNode.parentElement;
      if (
        parent
        && !parent.closest("a, code, pre, script, style, textarea, .starmate-term, #starmate-extension-root")
      ) {
        const match = pattern.exec(textNode.nodeValue || "");
        if (match) {
          const index = match.index + match[1].length;
          const matchNode = textNode.splitText(index);
          matchNode.splitText(match[2].length);
          const mark = create("button", "starmate-term", match[2]);
          mark.type = "button";
          mark.dataset.starmateTerm = explanation.term;
          mark.dataset.starmateSection = sectionId;
          mark.addEventListener("click", () => showTermCard(mark, explanation, sourceText));
          matchNode.replaceWith(mark);
          termEvidence.push({
            term: explanation.term,
            sectionId,
            excerpt: sourceText.slice(0, 180),
          });
          return true;
        }
      }
      textNode = walker.nextNode();
    }
    return false;
  }

  function annotateTerms() {
    for (const section of article.sections) {
      const explanations = globalThis.StarMateCore.findKnownTerms(section.text, 6);
      const paragraphs = article.paragraphs.filter((item) => item.sectionId === section.id);
      for (const explanation of explanations) {
        for (const paragraph of paragraphs) {
          if (wrapFirstKnownTerm(paragraph.element, explanation, section.id, paragraph.text)) break;
        }
      }
    }
  }

  function plainSnapshot(remoteSha = "") {
    return {
      projectId: article.projectId,
      documentId: article.documentId,
      documentPath: article.documentPath,
      url: article.url,
      owner: adapter.owner,
      repository: adapter.repository,
      remoteSha,
      lastReadAt: Date.now(),
      sections: article.sections.map((section) => ({
        id: section.id,
        title: section.title,
        url: section.url,
        fingerprint: section.fingerprint,
      })),
    };
  }

  async function latestCommit() {
    const cacheKey = `commit:${adapter.projectId}:${adapter.documentPath}`;
    const cached = await globalThis.StarMateStorage.get(cacheKey, null);
    if (cached?.cachedAt > Date.now() - 6 * 60 * 60 * 1000) return cached.value;
    const query = new URLSearchParams({ path: adapter.documentPath, per_page: "1" });
    try {
      const response = await fetch(
        `https://api.github.com/repos/${adapter.owner}/${adapter.repository}/commits?${query}`,
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!response.ok) return null;
      const [item] = await response.json();
      if (!item) return null;
      const value = {
        sha: item.sha,
        author: item.author?.login || item.commit?.author?.name || "GitHub 作者",
        committedAt: item.commit?.author?.date || "",
        message: item.commit?.message?.split("\n")[0] || "更新文档",
        commitUrl: item.html_url || "",
      };
      await globalThis.StarMateStorage.set(cacheKey, { cachedAt: Date.now(), value });
      return value;
    } catch {
      return null;
    }
  }

  function renderUpdateEvents(events, hasSnapshot) {
    updatesTimeline.replaceChildren();
    if (!events.length) {
      updatesTimeline.append(create(
        "p",
        "starmate-empty",
        hasSnapshot ? "当前没有检测到章节变化。" : "已记录当前版本；从现在开始追踪作者更新。",
      ));
      return;
    }
    for (const event of events.slice(0, 12)) {
      const card = create("article", "starmate-update-card");
      const summary = create("strong", "", `新增 ${event.added.length} · 修改 ${event.changed.length} · 删除 ${event.removed.length}`);
      const meta = create("small", "", `${event.author || "GitHub 作者"} · ${event.committedAt ? new Date(event.committedAt).toLocaleDateString("zh-CN") : "最近检查"}`);
      const message = create("p", "", event.message || "文档内容发生变化");
      const sections = create("div", "starmate-update-sections");
      for (const id of [...event.added, ...event.changed]) {
        const section = article.sections.find((item) => item.id === id);
        const button = create("button", "", section?.title || id);
        button.type = "button";
        button.addEventListener("click", () => {
          if (section) scrollToSource(section.element);
        });
        sections.append(button);
      }
      for (const id of event.removed) {
        sections.append(create("span", "", `${event.removedTitles?.[id] || id} · 已归档`));
      }
      card.append(summary, meta, message, sections);
      if (event.commitUrl) {
        const link = create("a", "starmate-evidence-link", "查看这次提交 ↗");
        link.href = event.commitUrl;
        link.target = "_blank";
        link.rel = "noopener";
        card.append(link);
      }
      updatesTimeline.append(card);
    }
  }

  async function compareAndSaveSnapshot() {
    const previous = await globalThis.StarMateStorage.getSnapshot(adapter.documentId);
    const commit = await latestCommit();
    const next = plainSnapshot(commit?.sha || previous?.pendingRemoteSha || previous?.remoteSha || "");
    const diff = previous
      ? globalThis.StarMateCore.diffSnapshots(previous, next)
      : { added: next.sections.map((section) => section.id), changed: [], removed: [] };
    if (previous) {
      if (diff.added.length || diff.changed.length || diff.removed.length) {
        const removedTitles = Object.fromEntries(
          (previous.sections || []).filter((section) => diff.removed.includes(section.id)).map((section) => [section.id, section.title]),
        );
        await globalThis.StarMateStorage.saveUpdateEvent({
          id: globalThis.StarMateCore.updateEventId(
            adapter.documentId,
            commit?.sha || globalThis.StarMateCore.fingerprint(JSON.stringify(next.sections)),
          ),
          documentId: adapter.documentId,
          commitSha: commit?.sha || "",
          checkedAt: Date.now(),
          added: diff.added,
          changed: diff.changed,
          removed: diff.removed,
          removedTitles,
          author: commit?.author || "",
          committedAt: commit?.committedAt || "",
          message: commit?.message || "检测到文档章节变化",
          commitUrl: commit?.commitUrl || "",
        });
      }
    }
    const currentGraph = await globalThis.StarMateStorage.getGraph();
    const hasCurrentDocumentGraph = currentGraph.nodes.some(
      (node) => node.id === `document:${adapter.documentId}`,
    );
    const nextGraph = previous && hasCurrentDocumentGraph
      ? globalThis.StarMateCore.applyGraphDiff(currentGraph, next, diff, termEvidence)
      : globalThis.StarMateCore.linkSharedConcepts(
        globalThis.StarMateCore.mergeGraphs(
          currentGraph,
          globalThis.StarMateCore.buildDocumentGraph(next, termEvidence),
        ),
      );
    const savedGraph = await globalThis.StarMateStorage.saveGraph(
      nextGraph,
      adapter.documentId,
      Date.now(),
    );
    renderMiniGraph(savedGraph);
    await globalThis.StarMateStorage.saveSnapshot(next);
    const events = await globalThis.StarMateStorage.listUpdateEvents(adapter.documentId);
    renderUpdateEvents(events, Boolean(previous));
  }

  function renderMiniGraph(graph) {
    miniGraph.replaceChildren();
    const projectNode = graph.nodes.find((node) => node.id === `project:${adapter.projectId}`);
    const documentNode = graph.nodes.find((node) => node.id === `document:${adapter.documentId}`);
    const sectionPrefix = `section:${adapter.documentId}:`;
    const sectionNodes = graph.nodes
      .filter((node) => node.id.startsWith(sectionPrefix) && !node.archived)
      .slice(0, 6);
    const sectionIds = new Set(sectionNodes.map((node) => node.id));
    const conceptIds = new Set(
      graph.edges
        .filter((edge) => edge.type === "explains" && sectionIds.has(edge.from))
        .map((edge) => edge.to),
    );
    const conceptNodes = graph.nodes.filter((node) => conceptIds.has(node.id)).slice(0, 8);

    const projectRow = create("div", "starmate-graph-layer");
    projectRow.append(create("span", "starmate-graph-node project", projectNode?.label || adapter.projectId));
    const documentRow = create("div", "starmate-graph-layer");
    documentRow.append(create("span", "starmate-graph-node document", documentNode?.label || adapter.documentPath));
    const sectionRow = create("div", "starmate-graph-layer wrap");
    for (const node of sectionNodes) {
      const button = create("button", "starmate-graph-node section", node.label);
      button.type = "button";
      button.addEventListener("click", () => {
        const id = node.id.slice(sectionPrefix.length);
        const section = article.sections.find((item) => item.id === id);
        if (section) scrollToSource(section.element);
      });
      sectionRow.append(button);
    }
    const conceptRow = create("div", "starmate-graph-layer wrap");
    for (const node of conceptNodes) {
      const button = create("button", "starmate-graph-node concept", node.label);
      button.type = "button";
      button.addEventListener("click", () => {
        const evidence = graph.edges.find(
          (edge) => edge.type === "explains" && edge.to === node.id && sectionIds.has(edge.from),
        )?.evidence;
        graphEvidenceCopy.textContent = evidence?.excerpt || `“${node.label}”来自当前文档的章节内容。`;
        graphEvidenceLink.href = evidence?.url || article.url;
        graphEvidence.hidden = false;
      });
      conceptRow.append(button);
    }
    miniGraph.append(projectRow, create("i", "starmate-graph-connector", "↓"), documentRow);
    if (sectionNodes.length) miniGraph.append(create("i", "starmate-graph-connector", "↓ 章节"), sectionRow);
    if (conceptNodes.length) miniGraph.append(create("i", "starmate-graph-connector", "↓ 解释"), conceptRow);
    const sharedCount = graph.edges.filter(
      (edge) => edge.type === "shared-concept"
        && (edge.from === documentNode?.id || edge.to === documentNode?.id),
    ).length;
    if (sharedCount) {
      miniGraph.append(create("p", "starmate-graph-shared", `还通过共同概念连接了 ${sharedCount} 篇已读文档。`));
    }
    if (!sectionNodes.length) {
      miniGraph.append(create("p", "starmate-empty", "当前页面还没有可生成关系的章节。"));
    }
  }

  function currentSection() {
    const marker = window.scrollY + window.innerHeight * 0.28;
    let current = article.sections[0];
    for (const section of article.sections) {
      const top = section.element.getBoundingClientRect().top + window.scrollY;
      if (top <= marker) current = section;
    }
    return current;
  }

  function saveState() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      globalThis.StarMateStorage.saveDocumentState(adapter.documentId, state);
    }, 250);
  }

  function renderProgress(forceComplete = false) {
    const rect = article.root.getBoundingClientRect();
    const articleTop = rect.top + window.scrollY;
    const roughPercent = Math.max(
      0,
      Math.min(1, (window.scrollY - articleTop) / Math.max(1, rect.height - window.innerHeight)),
    );
    const metrics = globalThis.StarMateCore.calculateProgress({
      scrollTop: window.scrollY,
      articleTop,
      articleHeight: rect.height,
      viewportHeight: window.innerHeight,
      remainingCharacters: article.characterCount * (1 - roughPercent),
    });
    const section = currentSection();
    state = {
      ...state,
      progress: forceComplete ? 100 : Math.max(state.completed ? 100 : state.progress || 0, metrics.percent),
      lastSectionId: section?.id || state.lastSectionId,
    };
    progress.setAttribute("aria-valuenow", String(state.progress));
    progressFill.style.width = `${state.progress}%`;
    progressCopy.textContent = `本章 ${state.progress}% · 约 ${forceComplete ? 0 : metrics.remainingMinutes} 分钟`;
    detailSection.textContent = section?.title || "正文";
    detailProgress.textContent = `${state.progress}%`;
    detailRemaining.textContent = `预计剩余 ${forceComplete ? 0 : metrics.remainingMinutes} 分钟`;
    detailActive.textContent = `专注阅读 ${formatDuration(state.activeSeconds)}`;
    completeButton.textContent = state.completed ? "✓ 已完成，可继续回看" : "✓ 标记已完成";
    saveState();
  }

  function scheduleProgress() {
    lastActivityAt = Date.now();
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderProgress();
    });
  }

  ["scroll", "pointerdown", "keydown", "selectionchange"].forEach((eventName) => {
    const target = eventName === "selectionchange" ? document : window;
    target.addEventListener(eventName, scheduleProgress, { passive: true, signal: controller.signal });
  });

  const activeTimer = window.setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - lastActivityAt < 60000) {
      state.activeSeconds += 15;
      renderProgress();
    }
  }, 15000);

  completeButton.addEventListener("click", () => {
    state.completed = true;
    state.progress = 100;
    renderProgress(true);
  });

  termCardClose.addEventListener("click", hideTermCard);
  understoodButton.addEventListener("click", () => {
    state.seenTerms = addUnique(state.seenTerms, activeTerm);
    state.reviewTerms = (state.reviewTerms || []).filter((term) => term !== activeTerm);
    globalThis.StarMateStorage.saveDocumentState(adapter.documentId, state);
    hideTermCard();
  });
  reviewButton.addEventListener("click", () => {
    state.reviewTerms = addUnique(state.reviewTerms, activeTerm);
    globalThis.StarMateStorage.saveDocumentState(adapter.documentId, state);
    hideTermCard();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !termCard.hidden) hideTermCard();
  }, { signal: controller.signal });

  window.addEventListener("pagehide", () => {
    window.clearInterval(activeTimer);
    globalThis.StarMateStorage.saveDocumentState(adapter.documentId, state);
  }, { signal: controller.signal });

  globalThis.StarMateStorage.getDocumentState(adapter.documentId).then((saved) => {
    if (disposed) return;
    state = { ...state, ...saved };
    renderProgress(state.completed);
    annotateTerms();
    compareAndSaveSnapshot();
  });

    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(activeTimer);
      window.clearTimeout(saveTimer);
      if (frame) cancelAnimationFrame(frame);
      globalThis.StarMateStorage.saveDocumentState(adapter.documentId, state);
      document.querySelectorAll(".starmate-term").forEach((mark) => {
        const parent = mark.parentNode;
        mark.replaceWith(document.createTextNode(mark.textContent || ""));
        parent?.normalize();
      });
      document.getElementById(ROOT_ID)?.remove();
    };
  }

  async function refreshForLocation(force = false) {
    const adapter = globalThis.StarMateAdapters?.fromLocation(location);
    if (!adapter) return;
    if (!force && adapter.documentId === currentDocumentId && document.getElementById(ROOT_ID)) return;
    const generation = ++refreshGeneration;
    const previousSignature = currentSignature;
    cleanupSession();
    stopWatchingRoute();
    currentDocumentId = adapter.documentId;
    const result = await waitForArticle(adapter, previousSignature);
    if (generation !== refreshGeneration) return;
    if (!result) {
      currentSignature = "";
      showWaitingShell(adapter);
      stopWatchingRoute = adapter.watch(() => refreshForLocation());
      return;
    }
    currentSignature = result.signature;
    cleanupSession = mount(adapter, result.article);
    stopWatchingRoute = adapter.watch(() => refreshForLocation());
  }

  refreshForLocation(Boolean(document.getElementById(ROOT_ID)));
})();
