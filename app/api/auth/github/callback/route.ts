import { eq } from "drizzle-orm";
import { users } from "@/db/notebook-schema";
import { hashToken, newOpaqueToken, verifyState } from "@/lib/auth.mjs";
import {
  OAUTH_NONCE_COOKIE,
  clearAuthCookie,
  createWebSession,
  getAuthConfiguration,
  oauthNonce,
  safeReturnTo,
} from "@/lib/server-auth";

type GitHubTokenResponse = { access_token?: string; error?: string };
type GitHubUser = { id: number; login: string; avatar_url?: string };

function redirectWithCookies(location: string, cookies: string[]) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export async function GET(request: Request) {
  const config = getAuthConfiguration();
  if (!config.syncAvailable || !config.database) {
    return Response.json({ authenticated: false, syncAvailable: false, localOnly: true }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") || "";
    const stateToken = url.searchParams.get("state") || "";
    const state = await verifyState(stateToken, config.authSecret);
    const cookieNonce = oauthNonce(request);
    if (!code || !cookieNonce || await hashToken(cookieNonce) !== await hashToken(state.nonce)) {
      throw new Error("OAuth state mismatch");
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: `${config.appUrl}/api/auth/github/callback`,
      }),
    });
    const token = await tokenResponse.json() as GitHubTokenResponse;
    if (!tokenResponse.ok || !token.access_token) throw new Error("GitHub token exchange failed");

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token.access_token}`,
        "User-Agent": "StarMate-GitHub-Reader",
      },
    });
    const profile = await profileResponse.json() as GitHubUser;
    if (!profileResponse.ok || !profile.id || !profile.login) throw new Error("GitHub profile failed");

    const githubUserId = String(profile.id);
    const existing = await config.database.select({ id: users.id }).from(users).where(eq(users.githubUserId, githubUserId)).limit(1);
    const userId = existing[0]?.id || newOpaqueToken();
    await config.database.insert(users).values({
      id: userId,
      githubUserId,
      githubLogin: profile.login,
      avatarUrl: profile.avatar_url || "",
    }).onConflictDoUpdate({
      target: users.githubUserId,
      set: { githubLogin: profile.login, avatarUrl: profile.avatar_url || "", updatedAt: new Date() },
    });

    const session = await createWebSession(config.database, userId);
    return redirectWithCookies(`${config.appUrl}${safeReturnTo(state.returnTo)}`, [
      session.cookie,
      clearAuthCookie(OAUTH_NONCE_COOKIE),
    ]);
  } catch {
    return redirectWithCookies(`${config.appUrl}/?auth=failed`, [clearAuthCookie(OAUTH_NONCE_COOKIE)]);
  }
}
