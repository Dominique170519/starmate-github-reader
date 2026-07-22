import {
  buildVerifiedCaseSearchQuery,
  normalizeExternalCase,
  parseRepositoryIdentity,
  type PracticeCase,
} from "@/lib/practice-cases.mjs";

type SearchItem = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
};

type SearchResponse = { items?: SearchItem[] };
type ReadmeResponse = { content?: string; encoding?: string };

const MAX_REQUESTS_PER_WINDOW = 20;
const WINDOW_MS = 60 * 60 * 1000;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

class GitHubResponseError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function clientKey(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "StarMate-GitHub-Reader",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
}

async function githubJson<T>(url: string) {
  const response = await fetch(url, { headers: githubHeaders() });
  if (response.status === 403 || response.status === 429) {
    throw new GitHubResponseError(response.status, "GitHub 搜索次数暂时用完了。请稍后再试。");
  }
  if (response.status === 404) throw new GitHubResponseError(404, "GitHub 内容不存在。");
  if (!response.ok) throw new GitHubResponseError(response.status, "GitHub 案例搜索暂时不可用。");
  return response.json() as Promise<T>;
}

function decodeReadme(readme: ReadmeResponse) {
  if (!readme.content || readme.encoding !== "base64") return "";
  const binary = atob(readme.content.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export async function GET(request: Request) {
  const parsed = parseRepositoryIdentity(new URL(request.url).searchParams.get("repository") || "");
  if (!parsed) return Response.json({ error: "请提供 owner/repository 格式的仓库名称。" }, { status: 400 });
  if (isRateLimited(request)) {
    return Response.json({ cases: [], status: "limited", checkedAt: new Date().toISOString() });
  }

  const target = { ...parsed, id: parsed.fullName.toLowerCase() };
  const checkedAt = new Date().toISOString();

  try {
    const query = buildVerifiedCaseSearchQuery(parsed.fullName);
    const search = await githubJson<SearchResponse>(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=6`,
    );
    const candidates = (search.items || [])
      .filter((candidate) => candidate.full_name.toLowerCase() !== parsed.fullName.toLowerCase())
      .slice(0, 5);

    const results = await Promise.all(candidates.map(async (candidate) => {
      try {
        const readme = await githubJson<ReadmeResponse>(
          `https://api.github.com/repos/${candidate.full_name.split("/").map(encodeURIComponent).join("/")}/readme`,
        );
        return normalizeExternalCase(candidate, target, decodeReadme(readme), checkedAt);
      } catch (error) {
        if (error instanceof GitHubResponseError && error.status === 404) return null;
        throw error;
      }
    }));
    const cases = results.filter((item): item is PracticeCase => Boolean(item));

    return Response.json(
      { cases, status: cases.length ? "verified" : "empty", checkedAt },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    if (error instanceof GitHubResponseError && (error.status === 403 || error.status === 429)) {
      return Response.json({ cases: [], status: "limited", checkedAt });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "GitHub 案例搜索暂时不可用。" },
      { status: 502 },
    );
  }
}
