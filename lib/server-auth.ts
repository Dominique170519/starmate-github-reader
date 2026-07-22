import { and, eq, gt, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { extensionDevices, users, webSessions } from "@/db/notebook-schema";
import { hashToken, newOpaqueToken } from "@/lib/auth.mjs";

export const SESSION_COOKIE = "starmate_session";
export const OAUTH_NONCE_COOKIE = "starmate_oauth_nonce";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type Database = NonNullable<ReturnType<typeof getDatabase>>;

export type AuthIdentity = {
  userId: string;
  githubLogin: string;
  avatarUrl: string;
  source: "web" | "extension";
  deviceId?: string;
};

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function safeReturnTo(value: unknown) {
  const candidate = typeof value === "string" ? value : "/";
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/";
  return candidate.slice(0, 2000);
}

export function getAuthConfiguration() {
  const database = getDatabase();
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim() || "";
  const authSecret = process.env.AUTH_SECRET?.trim() || "";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "").replace(/\/$/, "");
  const syncAvailable = Boolean(database && clientId && clientSecret && authSecret.length >= 32 && appUrl);
  return { database, clientId, clientSecret, authSecret, appUrl, syncAvailable };
}

export function authCookie(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearAuthCookie(name: string) {
  return authCookie(name, "", 0);
}

export async function createWebSession(database: Database, userId: string) {
  const token = newOpaqueToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await database.insert(webSessions).values({
    id: newOpaqueToken(),
    userId,
    tokenHash,
    expiresAt,
  });
  return { token, expiresAt, cookie: authCookie(SESSION_COOKIE, token, SESSION_MAX_AGE_SECONDS) };
}

export async function resolveWebSession(request: Request): Promise<AuthIdentity | null> {
  const database = getDatabase();
  const token = readCookie(request, SESSION_COOKIE);
  if (!database || !token) return null;
  const tokenHash = await hashToken(token);
  const [row] = await database
    .select({ userId: users.id, githubLogin: users.githubLogin, avatarUrl: users.avatarUrl })
    .from(webSessions)
    .innerJoin(users, eq(webSessions.userId, users.id))
    .where(and(eq(webSessions.tokenHash, tokenHash), gt(webSessions.expiresAt, new Date())))
    .limit(1);
  return row ? { ...row, source: "web" } : null;
}

export async function resolveSyncIdentity(request: Request): Promise<AuthIdentity | null> {
  const webIdentity = await resolveWebSession(request);
  if (webIdentity) return webIdentity;

  const database = getDatabase();
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!database || !match) return null;
  const tokenHash = await hashToken(match[1]);
  const [row] = await database
    .select({
      userId: users.id,
      githubLogin: users.githubLogin,
      avatarUrl: users.avatarUrl,
      deviceId: extensionDevices.id,
    })
    .from(extensionDevices)
    .innerJoin(users, eq(extensionDevices.userId, users.id))
    .where(and(eq(extensionDevices.tokenHash, tokenHash), isNull(extensionDevices.revokedAt)))
    .limit(1);
  return row ? { ...row, source: "extension" } : null;
}

export function oauthNonce(request: Request) {
  return readCookie(request, OAUTH_NONCE_COOKIE);
}
