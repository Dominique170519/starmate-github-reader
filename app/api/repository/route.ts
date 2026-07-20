import { buildRepositoryPackage, type RepositoryLearningPackage } from "@/lib/repository-learning";

type D1Database = NonNullable<
  (typeof import("cloudflare:workers"))["env"]["DB"]
>;

type GitHubRepository = {
  name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  default_branch: string;
  updated_at: string;
};

type GitHubContent = { content?: string; encoding?: string; sha?: string; path?: string; size?: number };
type GitHubTree = { sha?: string; tree?: Array<{ path?: string; type?: string; sha?: string; size?: number }> };
type StoredPackage = { package_json: string; synced_at: number };

const MAX_REPOSITORIES_PER_HOUR = 30;
const WINDOW_MS = 60 * 60 * 1000;
const CACHE_MS = 6 * 60 * 60 * 1000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REPOSITORIES_PER_HOUR;
}

function parseRepositoryUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
    const [owner, repository] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repository || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repository)) return null;
    return { owner, repository: repository.replace(/\.git$/i, ""), url: `https://github.com/${owner}/${repository.replace(/\.git$/i, "")}` };
  } catch {
    return null;
  }
}

function validLibraryId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(value) ? value : "";
}

function decodeContent(content = "") {
  const binary = atob(content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "StarMate-GitHub-Reader",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
}

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders() });
  if (response.status === 404) throw Object.assign(new Error("没有找到这个公开仓库或文档。"), { status: 404 });
  if (response.status === 403 || response.status === 429) throw Object.assign(new Error("GitHub 读取次数暂时用完了，请稍后再试。"), { status: 429 });
  if (!response.ok) throw Object.assign(new Error("GitHub 内容暂时读取失败。"), { status: 502 });
  return response.json() as Promise<T>;
}

async function ensureTables() {
  // Load the Cloudflare binding only when this API is called. This keeps the
  // page renderable in Node-based previews and tests.
  const { env } = await import("cloudflare:workers");
  const db = env.DB;
  if (!db) throw Object.assign(new Error("知识库暂时没有连接到持久存储。"), { status: 503 });
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS repository_packages (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      source_sha TEXT NOT NULL,
      package_json TEXT NOT NULL,
      synced_at INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS library_repositories (
      library_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (library_id, repository_id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS library_repositories_library_idx ON library_repositories (library_id, added_at DESC)"),
  ]);
  return db;
}

async function fetchRepositoryPackage(owner: string, repository: string) {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepository = encodeURIComponent(repository);
  const base = `https://api.github.com/repos/${encodedOwner}/${encodedRepository}`;
  const metadata = await githubJson<GitHubRepository>(base);
  const [readme, tree] = await Promise.all([
    githubJson<GitHubContent>(`${base}/readme`),
    githubJson<GitHubTree>(`${base}/git/trees/${encodeURIComponent(metadata.default_branch)}?recursive=1`),
  ]);

  const treeFiles = (tree.tree || [])
    .filter((item) => item.type === "blob" && item.path && item.sha)
    .map((item) => ({ path: item.path || "", sha: item.sha || "", size: item.size || 0 }));
  const markdownCandidates = treeFiles
    .filter((file) => /\.mdx?$/i.test(file.path) && file.size < 180_000 && !/(^|\/)(node_modules|vendor|dist|build)\//.test(file.path))
    .filter((file) => !/(^|\/)readme(\.[^.]+)?$/i.test(file.path))
    .sort((a, b) => {
      const priority = (path: string) => path.startsWith("docs/") ? 0 : path.split("/").length === 1 ? 1 : 2;
      return priority(a.path) - priority(b.path) || a.path.localeCompare(b.path);
    })
    .slice(0, 8);

  const markdownSources = [{ path: readme.path || "README.md", content: decodeContent(readme.content) }];
  const extraSources = await Promise.all(markdownCandidates.map(async (file) => {
    try {
      const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
      const content = await githubJson<GitHubContent>(`${base}/contents/${encodedPath}`);
      return { path: file.path, content: decodeContent(content.content).slice(0, 120_000) };
    } catch {
      return null;
    }
  }));
  markdownSources.push(...extraSources.filter((item): item is { path: string; content: string } => Boolean(item?.content)));

  return buildRepositoryPackage({
    repository: {
      owner: metadata.owner.login,
      name: metadata.name,
      url: metadata.html_url,
      description: metadata.description || "",
      language: metadata.language || "",
      topics: metadata.topics || [],
      stars: metadata.stargazers_count,
      updatedAt: metadata.updated_at,
    },
    sourceSha: tree.sha || readme.sha || metadata.updated_at,
    files: treeFiles.slice(0, 500).map(({ path, sha }) => ({ path, sha })),
    markdownSources,
  });
}

async function getStoredPackage(db: D1Database, id: string) {
  const stored = await db.prepare("SELECT package_json, synced_at FROM repository_packages WHERE id = ?").bind(id).first<StoredPackage>();
  if (!stored) return null;
  try {
    return { package: JSON.parse(stored.package_json) as RepositoryLearningPackage, syncedAt: stored.synced_at };
  } catch {
    return null;
  }
}

async function savePackage(db: D1Database, libraryId: string, learningPackage: RepositoryLearningPackage) {
  const now = Date.now();
  await db.batch([
    db.prepare(`INSERT INTO repository_packages (id, owner, name, source_sha, package_json, synced_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET source_sha = excluded.source_sha, package_json = excluded.package_json, synced_at = excluded.synced_at, updated_at = excluded.updated_at`)
      .bind(learningPackage.id, learningPackage.owner, learningPackage.name, learningPackage.sourceSha, JSON.stringify(learningPackage), now, learningPackage.sourceUpdatedAt),
    db.prepare(`INSERT INTO library_repositories (library_id, repository_id, added_at) VALUES (?, ?, ?)
      ON CONFLICT(library_id, repository_id) DO UPDATE SET added_at = excluded.added_at`)
      .bind(libraryId, learningPackage.id, now),
  ]);
}

export async function GET(request: Request) {
  try {
    const libraryId = validLibraryId(new URL(request.url).searchParams.get("libraryId"));
    if (!libraryId) return Response.json({ error: "缺少有效的知识库标识。" }, { status: 400 });
    const db = await ensureTables();
    const result = await db.prepare(`SELECT p.package_json FROM repository_packages p
      JOIN library_repositories l ON l.repository_id = p.id
      WHERE l.library_id = ? ORDER BY l.added_at DESC LIMIT 80`).bind(libraryId).all<{ package_json: string }>();
    const packages = (result.results || []).flatMap((row) => {
      try { return [JSON.parse(row.package_json) as RepositoryLearningPackage]; } catch { return []; }
    });
    return Response.json({ packages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 500;
    return Response.json({ error: error instanceof Error ? error.message : "知识库读取失败。" }, { status });
  }
}

export async function POST(request: Request) {
  try {
    if (isRateLimited(request)) return Response.json({ error: "添加得太快了，请稍后再试。" }, { status: 429 });
    const body = await request.json() as { url?: string; libraryId?: string; force?: boolean; action?: "remove" };
    const libraryId = validLibraryId(body.libraryId);
    const parsed = parseRepositoryUrl(body.url || "");
    if (!libraryId || !parsed) return Response.json({ error: "请提供完整的 GitHub 仓库链接。" }, { status: 400 });
    const db = await ensureTables();
    const id = `${parsed.owner.toLowerCase()}/${parsed.repository.toLowerCase()}`;

    if (body.action === "remove") {
      await db.prepare("DELETE FROM library_repositories WHERE library_id = ? AND repository_id = ?").bind(libraryId, id).run();
      return Response.json({ removed: true, id });
    }

    const stored = await getStoredPackage(db, id);
    let learningPackage = stored?.package || null;
    let cacheStatus: "cached" | "refreshed" = "cached";
    if (!learningPackage || body.force || Date.now() - (stored?.syncedAt || 0) > CACHE_MS) {
      learningPackage = await fetchRepositoryPackage(parsed.owner, parsed.repository);
      cacheStatus = "refreshed";
    }
    await savePackage(db, libraryId, learningPackage);
    return Response.json({ package: learningPackage, cacheStatus }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 500;
    return Response.json({ error: error instanceof Error ? error.message : "生成学习包失败，请稍后再试。" }, { status });
  }
}
