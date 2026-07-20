(() => {
  const APP_URL = "https://windy3f3f3f3f-how-claude-code-works.vercel.app";
  const ROOT_ID = "starmate-extension-root";
  let lastRepository = "";

  function repositoryInfo() {
    const [owner, repository] = location.pathname.split("/").filter(Boolean);
    if (!owner || !repository || ["settings", "marketplace", "features", "topics", "collections"].includes(owner)) return null;
    return { owner, repository, fullName: `${owner}/${repository}`, url: `https://github.com/${owner}/${repository}` };
  }

  function readArticle() {
    const root = document.querySelector("article.markdown-body, .markdown-body, [data-testid='readme'] article") || document.querySelector("main");
    if (!root) return { root: null, headings: [], paragraphs: [] };
    const headings = [...root.querySelectorAll("h1, h2, h3")].map((element, index) => ({
      id: element.id || `starmate-heading-${index}`,
      title: element.textContent?.replace(/\s+/g, " ").trim() || `章节 ${index + 1}`,
      element,
    }));
    headings.forEach((heading) => { if (!heading.element.id) heading.element.id = heading.id; });
    const paragraphs = [...root.querySelectorAll("p, li, pre")].map((element) => ({
      text: element.textContent?.replace(/\s+/g, " ").trim() || "",
      element,
    })).filter((item) => item.text.length >= 18);
    return { root, headings, paragraphs };
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function scrollToSource(target) {
    document.querySelectorAll(".starmate-source-highlight").forEach((node) => node.classList.remove("starmate-source-highlight"));
    target.classList.add("starmate-source-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.classList.remove("starmate-source-highlight"), 2600);
  }

  function mount() {
    const repository = repositoryInfo();
    if (!repository) return;
    if (document.getElementById(ROOT_ID) && lastRepository === repository.fullName) return;
    document.getElementById(ROOT_ID)?.remove();
    lastRepository = repository.fullName;

    const article = readArticle();
    const shell = element("div", "starmate-extension-shell");
    shell.id = ROOT_ID;
    const launcher = element("button", "starmate-launcher", "✦ 伴读");
    launcher.setAttribute("aria-label", "打开星伴读侧栏");
    const panel = element("aside", "starmate-panel");
    panel.setAttribute("aria-label", "星伴读 GitHub 伴读侧栏");

    const header = element("header", "starmate-panel-header");
    const identity = element("div", "");
    identity.append(element("span", "", "正在阅读"), element("strong", "", repository.fullName));
    const close = element("button", "", "×");
    close.setAttribute("aria-label", "关闭伴读侧栏");
    header.append(identity, close);

    const intro = element("section", "starmate-intro");
    intro.append(element("span", "", article.headings.length ? `已识别 ${article.headings.length} 个原文章节` : "等待 GitHub 原文加载"), element("p", "", article.paragraphs[0]?.text.slice(0, 180) || "在当前 GitHub 页面查看目录、搜索原文并记录自己的理解。"));

    const tabs = element("nav", "starmate-tabs");
    const mapTab = element("button", "active", "文章地图");
    const searchTab = element("button", "", "原文搜索");
    const noteTab = element("button", "", "我的笔记");
    tabs.append(mapTab, searchTab, noteTab);

    const body = element("div", "starmate-panel-body");
    const mapView = element("section", "starmate-view active");
    const mapTitle = element("div", "starmate-view-heading");
    mapTitle.append(element("span", "", "README / Docs"), element("strong", "", "点击章节定位原文"));
    const outline = element("div", "starmate-outline");
    article.headings.slice(0, 40).forEach((heading, index) => {
      const button = element("button", "", "");
      button.append(element("span", "", String(index + 1).padStart(2, "0")), element("strong", "", heading.title));
      button.addEventListener("click", () => scrollToSource(heading.element));
      outline.append(button);
    });
    if (!article.headings.length) outline.append(element("p", "starmate-empty", "当前页面还没有读取到 Markdown 目录，可以稍后重新打开侧栏。"));
    mapView.append(mapTitle, outline);

    const searchView = element("section", "starmate-view");
    const searchInput = element("input", "starmate-search");
    searchInput.placeholder = "输入术语，例如 Context、API、工具…";
    searchInput.setAttribute("aria-label", "搜索当前 GitHub 原文");
    const searchResults = element("div", "starmate-search-results");
    searchResults.append(element("p", "starmate-empty", "输入关键词后，只搜索当前页面原文，不会编造答案。"));
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim().toLowerCase();
      searchResults.replaceChildren();
      if (query.length < 2) {
        searchResults.append(element("p", "starmate-empty", "至少输入两个字符。"));
        return;
      }
      const results = article.paragraphs.filter((item) => item.text.toLowerCase().includes(query)).slice(0, 12);
      results.forEach((result) => {
        const button = element("button", "", result.text.slice(0, 180));
        button.addEventListener("click", () => scrollToSource(result.element));
        searchResults.append(button);
      });
      if (!results.length) searchResults.append(element("p", "starmate-empty", "当前页面没有找到相关原文。"));
    });
    searchView.append(searchInput, searchResults);

    const noteView = element("section", "starmate-view");
    const noteHint = element("p", "starmate-note-hint", "笔记按仓库保存在浏览器中。可以把页面选中的原文追加进来。");
    const textarea = element("textarea", "starmate-note");
    textarea.placeholder = "写下自己的理解、疑问和下一步…";
    const addSelection = element("button", "starmate-secondary", "＋ 加入当前选中的原文");
    const noteStatus = element("small", "", "自动保存");
    const noteKey = `starmate-note:${repository.fullName}`;
    chrome.storage.local.get(noteKey, (value) => { textarea.value = value[noteKey] || ""; });
    textarea.addEventListener("input", () => chrome.storage.local.set({ [noteKey]: textarea.value }));
    addSelection.addEventListener("click", () => {
      const selection = window.getSelection()?.toString().replace(/\s+/g, " ").trim();
      if (!selection) { noteStatus.textContent = "请先在原文中选中一段文字"; return; }
      textarea.value = `${textarea.value}${textarea.value ? "\n\n" : ""}【原文】${selection}\n【我的理解】`;
      chrome.storage.local.set({ [noteKey]: textarea.value });
      noteStatus.textContent = "已加入原文";
    });
    noteView.append(noteHint, textarea, addSelection, noteStatus);

    body.append(mapView, searchView, noteView);
    const footer = element("footer", "starmate-panel-footer");
    const addButton = element("button", "starmate-primary", "加入星伴读知识库 →");
    addButton.addEventListener("click", () => window.open(`${APP_URL}/?repo=${encodeURIComponent(repository.url)}`, "_blank", "noopener"));
    footer.append(addButton, element("small", "", "无模型版：目录、搜索和笔记均基于当前原文"));
    panel.append(header, intro, tabs, body, footer);
    shell.append(launcher, panel);
    document.body.append(shell);

    function showView(activeTab, activeView) {
      [mapTab, searchTab, noteTab].forEach((tab) => tab.classList.toggle("active", tab === activeTab));
      [mapView, searchView, noteView].forEach((view) => view.classList.toggle("active", view === activeView));
    }
    mapTab.addEventListener("click", () => showView(mapTab, mapView));
    searchTab.addEventListener("click", () => showView(searchTab, searchView));
    noteTab.addEventListener("click", () => showView(noteTab, noteView));
    launcher.addEventListener("click", () => panel.classList.add("open"));
    close.addEventListener("click", () => panel.classList.remove("open"));
  }

  mount();
  let timer = 0;
  new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(mount, 500);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
