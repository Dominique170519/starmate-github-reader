import test from "node:test";
import assert from "node:assert/strict";
import { hashToken, newOpaqueToken, signState, verifyState } from "../lib/auth.mjs";

const SECRET = "test-secret-with-at-least-thirty-two-characters";
const NOW = 1_784_700_000_000;

test("signs and verifies a short-lived OAuth state", async () => {
  const token = await signState({ nonce: "nonce-1", returnTo: "/?open=notebook", expiresAt: NOW + 60_000 }, SECRET);
  const payload = await verifyState(token, SECRET, NOW);
  assert.equal(payload.nonce, "nonce-1");
  assert.equal(payload.returnTo, "/?open=notebook");
});

test("rejects tampered and expired OAuth state", async () => {
  const token = await signState({ nonce: "nonce-1", returnTo: "/", expiresAt: NOW - 1 }, SECRET);
  await assert.rejects(() => verifyState(token, SECRET, NOW), /expired/i);
  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  await assert.rejects(() => verifyState(tampered, SECRET, NOW), /signature/i);
});

test("creates opaque credentials and stores only stable hashes", async () => {
  const token = newOpaqueToken();
  assert.equal(token.length >= 43, true);
  assert.equal(await hashToken(token), await hashToken(token));
  assert.notEqual(await hashToken(token), token);
});
