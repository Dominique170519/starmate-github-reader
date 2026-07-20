(() => {
  function compactText(value = "") {
    return String(value).replace(/\s+/g, " ").trim();
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function makeFingerprint(value) {
    return globalThis.StarMateCore?.fingerprint(value) || compactText(value).length.toString(16);
  }

  function makeHeadingId(title, index) {
    const slug = compactText(title)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    return slug || `section-${index + 1}`;
  }

  function readArticle(article, url, adapter) {
    if (!article) {
      return {
        projectId: adapter.projectId,
        documentId: adapter.documentId,
        documentPath: adapter.documentPath,
        url: url.href,
        root: null,
        sections: [],
        paragraphs: [],
        characterCount: 0,
      };
    }

    const excluded = "script, style, nav, textarea, .giscus, .giscus-frame, [data-starmate-ignore]";
    const headings = [...article.querySelectorAll("h1, h2, h3, h4")].filter(
      (heading) => !heading.closest(excluded),
    );
    const usedIds = new Set();
    const sectionElements = headings.map((heading, index) => {
      const base = heading.id || makeHeadingId(heading.textContent, index);
      let id = base;
      let suffix = 2;
      while (usedIds.has(id)) id = `${base}-${suffix++}`;
      usedIds.add(id);
      if (!heading.id) heading.id = id;
      return { id, title: compactText(heading.textContent) || `章节 ${index + 1}`, element: heading };
    });

    if (!sectionElements.length) {
      sectionElements.push({
        id: "document-start",
        title: compactText(article.querySelector("h1")?.textContent) || "正文",
        element: article,
      });
    }

    const paragraphs = [...article.querySelectorAll("p, li, blockquote, pre")]
      .filter((element) => !element.closest(excluded))
      .map((element) => {
        const text = compactText(element.textContent);
        let section = sectionElements[0];
        for (const candidate of sectionElements) {
          if (candidate.element === article) continue;
          const position = candidate.element.compareDocumentPosition(element);
          if (position & 4) section = candidate;
        }
        return { text, element, sectionId: section.id };
      })
      .filter((item) => item.text.length >= 2);

    const sections = sectionElements.map((section) => {
      const text = paragraphs
        .filter((paragraph) => paragraph.sectionId === section.id)
        .map((paragraph) => paragraph.text)
        .join("\n");
      const sectionUrl = new URL(url.href);
      sectionUrl.hash = section.id === "document-start" ? url.hash : section.id;
      return {
        id: section.id,
        title: section.title,
        url: sectionUrl.href,
        text,
        fingerprint: makeFingerprint(`${section.title}\n${text}`),
        element: section.element,
      };
    });

    return {
      projectId: adapter.projectId,
      documentId: adapter.documentId,
      documentPath: adapter.documentPath,
      url: url.href,
      root: article,
      sections,
      paragraphs,
      characterCount: paragraphs.reduce((total, paragraph) => total + paragraph.text.length, 0),
    };
  }

  function createGitHubAdapter(url) {
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, repository] = parts;
    if (!owner || !repository) return null;
    const marker = parts[2];
    const documentPath = marker === "blob" || marker === "tree"
      ? parts.slice(4).join("/") || "README.md"
      : "README.md";
    const projectId = `${owner}/${repository}`;
    return {
      kind: "github",
      owner,
      repository,
      projectId,
      repositoryUrl: `https://github.com/${projectId}`,
      documentPath,
      documentId: `${projectId}:${documentPath}`,
      read(doc) {
        const article = doc.querySelector(
          "article.markdown-body, .markdown-body, [data-testid='readme'] article",
        );
        return readArticle(article, url, this);
      },
      watch(onChange) {
        const observer = new MutationObserver(onChange);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        globalThis.addEventListener?.("popstate", onChange);
        return () => {
          observer.disconnect();
          globalThis.removeEventListener?.("popstate", onChange);
        };
      },
    };
  }

  function createDocsifyAdapter(url) {
    const owner = url.hostname.split(".")[0];
    const [repository] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repository) return null;
    const rawRoute = safeDecode(url.hash.replace(/^#\/?(?:\.\/)?/, ""));
    const route = rawRoute.split("?")[0].replace(/^\.\//, "").replace(/^\//, "");
    const documentPath = /\.md$/i.test(route) ? route : `${route || "README"}.md`;
    const projectId = `${owner}/${repository}`;
    return {
      kind: "docsify",
      owner,
      repository,
      projectId,
      repositoryUrl: `https://github.com/${projectId}`,
      documentPath,
      documentId: `${projectId}:${documentPath}`,
      read(doc) {
        return readArticle(doc.querySelector("article.markdown-section"), url, this);
      },
      watch(onChange) {
        globalThis.addEventListener?.("hashchange", onChange);
        return () => globalThis.removeEventListener?.("hashchange", onChange);
      },
    };
  }

  function fromLocation(locationLike) {
    const url = new URL(locationLike.href || String(locationLike));
    if (url.hostname === "github.com") return createGitHubAdapter(url);
    if (url.hostname.endsWith(".github.io")) return createDocsifyAdapter(url);
    return null;
  }

  globalThis.StarMateAdapters = { fromLocation, readArticle };
})();
