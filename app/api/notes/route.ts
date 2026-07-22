import { getTransactionalDatabase } from "@/db/transaction-client";
import {
  deleteUserCloudNotes,
  pullNoteChanges,
  pushNoteOperations,
  restoreNoteVersion,
} from "@/lib/note-sync-server";
import { resolveSyncIdentity } from "@/lib/server-auth";

function parseCursor(value: string | null) {
  try {
    const cursor = BigInt(value || "0");
    return cursor >= BigInt(0) ? cursor : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

async function authenticated(request: Request) {
  const database = getTransactionalDatabase();
  if (!database) return { response: Response.json({ localOnly: true }, { status: 503 }) };
  const identity = await resolveSyncIdentity(request);
  if (!identity) return { response: Response.json({ error: "请先连接 GitHub。" }, { status: 401 }) };
  return { database, identity };
}

export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const result = await pullNoteChanges(
    auth.database,
    auth.identity.userId,
    parseCursor(url.searchParams.get("cursor")),
    Number(url.searchParams.get("limit") || 100),
  );
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await authenticated(request);
  if (auth.response) return auth.response;
  const body = await request.json() as { operations?: unknown[] };
  if (!Array.isArray(body.operations) || body.operations.length > 100) {
    return Response.json({ error: "一次最多同步 100 条笔记变化。" }, { status: 400 });
  }
  try {
    return Response.json(await pushNoteOperations(auth.database, auth.identity.userId, body.operations as never[]));
  } catch {
    return Response.json({ error: "笔记数据格式不正确。" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticated(request);
  if (auth.response) return auth.response;
  const body = await request.json() as { noteId?: string; historyId?: string };
  if (!body.noteId || !body.historyId) return Response.json({ error: "缺少要恢复的版本。" }, { status: 400 });
  const restored = await restoreNoteVersion(auth.database, auth.identity.userId, body.noteId, parseCursor(body.historyId));
  if (!restored) return Response.json({ error: "没有找到这个历史版本。" }, { status: 404 });
  return Response.json(restored);
}

export async function DELETE(request: Request) {
  const auth = await authenticated(request);
  if (auth.response) return auth.response;
  const scope = new URL(request.url).searchParams.get("scope");
  const body = await request.json() as { confirm?: string };
  if (scope !== "cloud" || body.confirm !== "DELETE MY CLOUD NOTES") {
    return Response.json({ error: "需要明确确认删除云端笔记。" }, { status: 400 });
  }
  return Response.json(await deleteUserCloudNotes(auth.database, auth.identity.userId));
}
