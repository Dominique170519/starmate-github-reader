import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(path, "utf8");
}

test("starts GitHub OAuth with minimal scope and hardened nonce cookie", async () => {
  const [route, auth] = await Promise.all([
    source("app/api/auth/github/start/route.ts"),
    source("lib/server-auth.ts"),
  ]);
  assert.match(route, /signState/);
  assert.match(route, /scope.*read:user/s);
  assert.doesNotMatch(route, /repo(?!sitory)/);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /Secure/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(route, /localOnly:\s*true/);
});

test("verifies callback state and creates a server-side session", async () => {
  const route = await source("app/api/auth/github/callback/route.ts");
  assert.match(route, /verifyState/);
  assert.match(route, /OAUTH_NONCE_COOKIE/);
  assert.match(route, /https:\/\/api\.github\.com\/user/);
  assert.match(route, /createWebSession/);
  assert.match(route, /safeReturnTo/);
  assert.doesNotMatch(route, /authCookie\([^\n]*access_token/i);
  assert.doesNotMatch(route, /Set-Cookie[^\n]*access_token/i);
});

test("reports local-only capability and supports device revocation", async () => {
  const route = await source("app/api/auth/session/route.ts");
  assert.match(route, /authenticated/);
  assert.match(route, /syncAvailable/);
  assert.match(route, /localOnly/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /revokedAt/);
  assert.match(route, /resolveSyncIdentity/);
});

test("uses a ten-minute single-use extension connection", async () => {
  const route = await source("app/api/auth/extension-connect/route.ts");
  assert.match(route, /10 \* 60 \* 1000/);
  assert.match(route, /challengeHash/);
  assert.match(route, /consumedAt/);
  assert.match(route, /status:\s*410/);
  assert.match(route, /newOpaqueToken/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function GET/);
});

test("keeps server auth tokens hashed and derives identity from credentials", async () => {
  const auth = await source("lib/server-auth.ts");
  assert.match(auth, /hashToken/);
  assert.match(auth, /starmate_session/);
  assert.match(auth, /Authorization/);
  assert.match(auth, /Bearer/);
  assert.match(auth, /getDatabase/);
  assert.doesNotMatch(auth, /body\.userId/);
});

test("lets the extension request and poll a one-time Web approval", async () => {
  const [background, content, page] = await Promise.all([
    source("extension/background.js"),
    source("extension/content.js"),
    source("app/page.tsx"),
  ]);
  assert.match(background, /extension-connect/);
  assert.match(background, /connectExtension/);
  assert.match(background, /chrome\.tabs\.create/);
  assert.match(background, /setTimeout/);
  assert.match(content, /连接 GitHub/);
  assert.match(page, /connectExtension/);
  assert.match(page, /批准插件连接/);
});
