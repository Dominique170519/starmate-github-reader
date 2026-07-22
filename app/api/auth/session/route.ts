import { and, eq, isNull } from "drizzle-orm";
import { extensionDevices } from "@/db/notebook-schema";
import { getAuthConfiguration, resolveSyncIdentity, resolveWebSession } from "@/lib/server-auth";

export async function GET(request: Request) {
  const config = getAuthConfiguration();
  if (!config.syncAvailable || !config.database) {
    return Response.json({ authenticated: false, user: null, devices: [], syncAvailable: false, localOnly: true });
  }
  const identity = await resolveWebSession(request);
  if (!identity) return Response.json({ authenticated: false, user: null, devices: [], syncAvailable: true, localOnly: false });
  const devices = await config.database.select({
    id: extensionDevices.id,
    label: extensionDevices.label,
    lastSeenAt: extensionDevices.lastSeenAt,
    createdAt: extensionDevices.createdAt,
  }).from(extensionDevices).where(and(eq(extensionDevices.userId, identity.userId), isNull(extensionDevices.revokedAt)));
  return Response.json({
    authenticated: true,
    user: { login: identity.githubLogin, avatarUrl: identity.avatarUrl },
    devices,
    syncAvailable: true,
    localOnly: false,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const config = getAuthConfiguration();
  const identity = await resolveSyncIdentity(request);
  if (!config.database) return Response.json({ localOnly: true }, { status: 503 });
  if (!identity) return Response.json({ error: "请先登录 GitHub。" }, { status: 401 });
  const body = await request.json() as { deviceId?: string };
  const deviceId = identity.source === "extension" ? identity.deviceId : body.deviceId;
  if (!deviceId) return Response.json({ error: "缺少设备标识。" }, { status: 400 });
  await config.database.update(extensionDevices).set({ revokedAt: new Date() }).where(and(
    eq(extensionDevices.id, deviceId),
    eq(extensionDevices.userId, identity.userId),
  ));
  return Response.json({ revoked: true });
}
