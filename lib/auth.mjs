const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(`${normalized}${padding}`);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value, secret) {
  if (String(secret).length < 32) throw new TypeError("AUTH_SECRET must contain at least 32 characters");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(token)));
  return toBase64Url(new Uint8Array(digest));
}

export function newOpaqueToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function signState(payload, secret) {
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = toBase64Url(await hmac(encoded, secret));
  return `${encoded}.${signature}`;
}

export async function verifyState(token, secret, now = Date.now()) {
  try {
    const [encoded, signature, extra] = String(token || "").split(".");
    if (!encoded || !signature || extra) throw new Error("Invalid state signature");
    const expected = await hmac(encoded, secret);
    if (!equalBytes(expected, fromBase64Url(signature))) throw new Error("Invalid state signature");
    const payload = JSON.parse(decoder.decode(fromBase64Url(encoded)));
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= now) throw new Error("OAuth state expired");
    return payload;
  } catch (error) {
    if (error instanceof Error && /expired/i.test(error.message)) throw error;
    throw new Error("Invalid state signature");
  }
}
