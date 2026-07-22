function makePackage(overrides = {}) {
  return {
    id: "owner/alpha",
    owner: "owner",
    name: "alpha",
    fullName: "owner/alpha",
    url: "https://github.com/owner/alpha",
    sourceSha: "abc123",
    sourceUpdatedAt: "2026-07-20T00:00:00.000Z",
    summary: "An Agent uses an API.",
    sections: [
      {
        id: "intro",
        title: "Introduction",
        level: 1,
        sourcePath: "README.md",
        excerpt: "The Agent calls an API.",
        purpose: "Explain the project.",
        keyPoints: ["Agent and API work together."],
      },
    ],
    concepts: [
      {
        name: "API",
        plain: "A software interface.",
        evidence: "The Agent calls an API.",
        sourcePath: "README.md",
      },
    ],
    ...overrides,
  };
}

export const onePackage = makePackage();

export const twoPackages = [
  onePackage,
  makePackage({
    id: "owner/beta",
    name: "beta",
    fullName: "owner/beta",
    url: "https://github.com/owner/beta",
    sourceSha: "def456",
    sections: [
      {
        id: "start",
        title: "Start",
        level: 1,
        sourcePath: "docs/start.md",
        excerpt: "This API returns JSON.",
        purpose: "Start using the project.",
        keyPoints: ["Call the API."],
      },
    ],
    concepts: [
      {
        name: "APIs",
        plain: "Software interfaces.",
        evidence: "This API returns JSON.",
        sourcePath: "docs/start.md",
      },
    ],
  }),
];
