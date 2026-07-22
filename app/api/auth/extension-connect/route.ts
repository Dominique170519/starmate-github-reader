import { and, eq, gt, isNull } from "drizzle-orm";
import { extensionConnectCodes, extensionDevices } from "@/db/notebook-schema";
import { hashToken, newOpaqueToken } from "@/lib/auth.mjs";
import { getAuthConfiguration, resolveWebSession } from "@/lib/server-auth";

const CONNECT_TTL_MS = 10 * 60 * 1000;

function validChallenge(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{24,200}$/.test(value) ? value : "";
}

export async function POST(request: Request) {
  const config = getAuthConfiguration();
  if (!config.syncAvailable || !config.database) return Response.json({ localOnly: true }, { status: 503 });
  const body = await request.json() as { challenge?: string; deviceLabel?: string };
  const challenge = validChallenge(body.challenge);
  if (!challenge) return Response.json({ error: "无效的插件连接请求。" }, { status: 400 });
  const challengeHash = await hashToken(challenge);
  await config.database.insert(extensionConnectCodes).values({
    id: newOpaqueToken(),
    challengeHash,
    deviceLabel: String(body.deviceLabel || "Chrome 伴读插件").slice(0, 80),
    expiresAt: new Date(Date.now() + CONNECT_TTL_MS),
  }).onConflictDoUpdate({
    target: extensionConnectCodes.challengeHash,
    set: { expiresAt: new Date(Date.now() + CONNECT_TTL_MS), consumedAt: null, approvedAt: null, userId: null },
  });
  return Response.json({ pending: true, expiresIn: CONNECT_TTL_MS / 1000 }, { status: 201 });
}

export async function PATCH(request: Request) {
  const config = getAuthConfiguration();
  const identity = await resolveWebSession(request);
  if (!config.database) return Response.json({ localOnly: true }, { status: 503 });
  if (!identity) return Response.json({ error: "请先登录 GitHub。" }, { status: 401 });
  const body = await request.json() as { challenge?: string };
  const challenge = validChallenge(body.challenge);
  if (!challenge) return Response.json({ error: "无效的插件连接请求。" }, { status: 400 });
  const challengeHash = await hashToken(challenge);
  const approved = await config.database.update(extensionConnectCodes).set({
    userId: identity.userId,
    approvedAt: new Date(),
  }).where(and(
    eq(extensionConnectCodes.challengeHash, challengeHash),
    gt(extensionConnectCodes.expiresAt, new Date()),
    isNull(extensionConnectCodes.consumedAt),
  )).returning({ id: extensionConnectCodes.id });
  if (!approved.length) return Response.json({ error: "连接码已失效。" }, { status: 410 });
  return Response.json({ approved: true });
}

export async function GET(request: Request) {
  const config = getAuthConfiguration();
  if (!config.database) return Response.json({ localOnly: true }, { status: 503 });
  const challenge = validChallenge(new URL(request.url).searchParams.get("challenge"));
  if (!challenge) return Response.json({ error: "无效的插件连接请求。" }, { status: 400 });
  const challengeHash = await hashToken(challenge);
  const [code] = await config.database.select().from(extensionConnectCodes)
    .where(eq(extensionConnectCodes.challengeHash, challengeHash)).limit(1);
  if (!code || code.expiresAt <= new Date() || code.consumedAt) {
    return Response.json({ error: "连接码已失效。" }, { status: 410 });
  }
  if (!code.userId || !code.approvedAt) return Response.json({ pending: true }, { status: 202 });

  const token = newOpaqueToken();
  const tokenHash = await hashToken(token);
  const deviceId = newOpaqueToken();
  const consumed = await config.database.update(extensionConnectCodes).set({ consumedAt: new Date() })
    .where(and(eq(extensionConnectCodes.id, code.id), isNull(extensionConnectCodes.consumedAt)))
    .returning({ id: extensionConnectCodes.id });
  if (!consumed.length) return Response.json({ error: "连接码已被兑换。" }, { status: 410 });
  await config.database.insert(extensionDevices).values({
    id: deviceId,
    userId: code.userId,
    label: code.deviceLabel,
    tokenHash,
    lastSeenAt: new Date(),
  });
  return Response.json({ connected: true, token, deviceId });
}
