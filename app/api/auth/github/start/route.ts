import { newOpaqueToken, signState } from "@/lib/auth.mjs";
import { OAUTH_NONCE_COOKIE, authCookie, getAuthConfiguration, safeReturnTo } from "@/lib/server-auth";

export async function GET(request: Request) {
  const config = getAuthConfiguration();
  if (!config.syncAvailable) {
    return Response.json({ authenticated: false, syncAvailable: false, localOnly: true }, { status: 503 });
  }

  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const nonce = newOpaqueToken();
  const state = await signState({ returnTo, nonce, expiresAt: Date.now() + 10 * 60 * 1000 }, config.authSecret);
  const github = new URL("https://github.com/login/oauth/authorize");
  github.searchParams.set("client_id", config.clientId);
  github.searchParams.set("redirect_uri", `${config.appUrl}/api/auth/github/callback`);
  github.searchParams.set("scope", "read:user");
  github.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: github.toString(),
      "Set-Cookie": authCookie(OAUTH_NONCE_COOKIE, nonce, 10 * 60),
      "Cache-Control": "no-store",
    },
  });
}
