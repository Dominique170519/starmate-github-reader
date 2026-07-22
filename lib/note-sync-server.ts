import { and, asc, eq, gt } from "drizzle-orm";
import { extensionDevices, notes, noteVersions, syncChanges } from "@/db/notebook-schema";
import { getTransactionalDatabase } from "@/db/transaction-client";
import type { NoteCard, NoteOperation } from "@/lib/notebook.mjs";
import { decideServerMerge, normalizeSyncOperation } from "@/lib/note-sync.mjs";

export type SyncDatabase = NonNullable<ReturnType<typeof getTransactionalDatabase>>;

function operationFor(note: NoteCard) {
  return note.deletedAt ? "delete" : "upsert";
}

export async function pushNoteOperations(database: SyncDatabase, userId: string, rawOperations: NoteOperation[]) {
  const operations = rawOperations.slice(0, 100).map(normalizeSyncOperation);
  return database.transaction(async (transaction) => {
    const acknowledged: string[] = [];
    const canonical: NoteCard[] = [];
    let nextCursor = BigInt(0);
    let conflicts = 0;

    for (const operation of operations) {
      const [stored] = await transaction.select({ noteJson: notes.noteJson })
        .from(notes)
        .where(and(eq(notes.userId, userId), eq(notes.noteId, operation.note.id)))
        .limit(1);
      const current = (stored?.noteJson || null) as NoteCard | null;
      const decision = decideServerMerge(current, operation.note);
      acknowledged.push(operation.note.id);
      canonical.push(decision.current);
      if (decision.action === "noop") continue;
      if (decision.conflicted) conflicts += 1;

      for (const history of decision.history) {
        await transaction.insert(noteVersions).values({
          userId,
          noteId: history.id,
          version: history.version,
          noteJson: history,
        });
      }

      if (decision.action === "insert") {
        await transaction.insert(notes).values({
          userId,
          noteId: decision.current.id,
          version: decision.current.version,
          noteJson: decision.current,
          deletedAt: decision.current.deletedAt ? new Date(decision.current.deletedAt) : null,
        });
      } else {
        await transaction.update(notes).set({
          version: decision.current.version,
          noteJson: decision.current,
          deletedAt: decision.current.deletedAt ? new Date(decision.current.deletedAt) : null,
          updatedAt: new Date(),
        }).where(and(eq(notes.userId, userId), eq(notes.noteId, decision.current.id)));
      }

      const [change] = await transaction.insert(syncChanges).values({
        userId,
        noteId: decision.current.id,
        operation: operationFor(decision.current),
        noteJson: decision.current,
      }).returning({ id: syncChanges.id });
      if (change?.id && change.id > nextCursor) nextCursor = change.id;
    }

    return { acknowledged, canonical, conflicts, nextCursor: nextCursor.toString() };
  });
}

export async function pullNoteChanges(database: SyncDatabase, userId: string, cursor: bigint, limit = 100) {
  const pageSize = Math.min(100, Math.max(1, limit));
  const rows = await database.select({
    id: syncChanges.id,
    kind: syncChanges.operation,
    note: syncChanges.noteJson,
  }).from(syncChanges).where(and(eq(syncChanges.userId, userId), gt(syncChanges.id, cursor)))
    .orderBy(asc(syncChanges.id)).limit(pageSize + 1);
  const page = rows.slice(0, pageSize);
  return {
    changes: page.map((row) => ({ id: row.id.toString(), kind: row.kind, note: row.note as NoteCard })),
    nextCursor: (page.at(-1)?.id || cursor).toString(),
    hasMore: rows.length > pageSize,
  };
}

export async function restoreNoteVersion(database: SyncDatabase, userId: string, noteId: string, historyId: bigint) {
  return database.transaction(async (transaction) => {
    const [history] = await transaction.select({ noteJson: noteVersions.noteJson })
      .from(noteVersions)
      .where(and(eq(noteVersions.id, historyId), eq(noteVersions.userId, userId), eq(noteVersions.noteId, noteId)))
      .limit(1);
    const [stored] = await transaction.select({ noteJson: notes.noteJson })
      .from(notes).where(and(eq(notes.userId, userId), eq(notes.noteId, noteId))).limit(1);
    if (!history || !stored) return null;
    const current = stored.noteJson as NoteCard;
    const restored = {
      ...(history.noteJson as NoteCard),
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    await transaction.insert(noteVersions).values({ userId, noteId, version: current.version, noteJson: current });
    await transaction.update(notes).set({
      version: restored.version,
      noteJson: restored,
      deletedAt: restored.deletedAt ? new Date(restored.deletedAt) : null,
      updatedAt: new Date(),
    }).where(and(eq(notes.userId, userId), eq(notes.noteId, noteId)));
    const [change] = await transaction.insert(syncChanges).values({
      userId,
      noteId,
      operation: operationFor(restored),
      noteJson: restored,
    }).returning({ id: syncChanges.id });
    return { note: restored, nextCursor: change.id.toString() };
  });
}

export async function deleteUserCloudNotes(database: SyncDatabase, userId: string) {
  return database.transaction(async (transaction) => {
    await transaction.delete(noteVersions).where(eq(noteVersions.userId, userId));
    await transaction.delete(syncChanges).where(eq(syncChanges.userId, userId));
    await transaction.delete(notes).where(eq(notes.userId, userId));
    await transaction.update(extensionDevices).set({ revokedAt: new Date() }).where(eq(extensionDevices.userId, userId));
    return { deleted: true, localDataRetained: true };
  });
}
