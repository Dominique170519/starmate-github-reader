(() => {
  const APP_URL = "https://windy3f3f3f3f-how-claude-code-works.vercel.app";
  // StarMateStorage keeps notes and reading state in chrome.storage.local.
  const ROOT_ID = "starmate-extension-root";
  if (document.getElementById(ROOT_ID)) return;

  const adapter = globalThis.StarMateAdapters?.fromLocation(location);
  if (!adapter) return;
  const article = adapter.read(document);
  if (!article.root) return;

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
  const noteHint = create("p", "starmate-note-hint", "笔记按文档保存在浏览器中，也可以把选中的原文追加进来。");
  const textarea = create("textarea", "starmate-note");
  textarea.placeholder = "写下自己的理解、疑问和下一步…";
  const addSelection = create("button", "starmate-secondary", "＋ 加入当前选中的原文");
  addSelection.type = "button";
  const noteStatus = create("small", "", "自动保存");
  const noteKey = `note:${adapter.documentId}`;
  globalThis.StarMateStorage.get(noteKey, "").then((value) => { textarea.value = value; });
  textarea.addEventListener("input", () => globalThis.StarMateStorage.set(noteKey, textarea.value));
  addSelection.addEventListener("click", () => {
    const selection = window.getSelection()?.toString().replace(/\s+/g, " ").trim();
    if (!selection) {
      noteStatus.textContent = "请先在原文中选中一段文字";
      return;
    }
    textarea.value = `${textarea.value}${textarea.value ? "\n\n" : ""}【原文】${selection}\n【我的理解】`;
    globalThis.StarMateStorage.set(noteKey, textarea.value);
    noteStatus.textContent = "已加入原文";
  });
  noteView.append(noteHint, textarea, addSelection, noteStatus);

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

  body.append(chapterView, mapView, searchView, noteView);
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
      progress: forceComplete ? 100 : Math.max(state.completed ? 100 : 0, metrics.percent),
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
    target.addEventListener(eventName, scheduleProgress, { passive: true });
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
  });

  window.addEventListener("pagehide", () => {
    window.clearInterval(activeTimer);
    globalThis.StarMateStorage.saveDocumentState(adapter.documentId, state);
  });

  globalThis.StarMateStorage.getDocumentState(adapter.documentId).then((saved) => {
    state = { ...state, ...saved };
    renderProgress(state.completed);
    annotateTerms();
  });
})();
