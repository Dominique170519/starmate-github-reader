function makePackage(overrides = {}) {
  return {
    id: "acme/source",
    owner: "acme",
    name: "source",
    fullName: "acme/source",
    url: "https://github.com/acme/source",
    sourceSha: "sha-source",
    sourceUpdatedAt: "2026-07-22T00:00:00.000Z",
    files: [
      { path: "README.md", sha: "readme" },
      { path: "docs/concepts.md", sha: "concepts" },
    ],
    sections: [],
    ...overrides,
  };
}

export const packageWithDemo = makePackage({
  files: [
    { path: "README.md", sha: "readme" },
    { path: "examples/chat-app/README.md", sha: "demo-readme" },
    { path: "examples/chat-app/index.ts", sha: "demo-code" },
  ],
});

export const packageWithoutDemo = makePackage();

export const externalCandidate = {
  name: "reader-app",
  full_name: "someone/reader-app",
  html_url: "https://github.com/someone/reader-app",
  description: "A small reader application.",
};
