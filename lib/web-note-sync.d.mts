import type { NoteCard } from "./notebook.mjs";

export type NoteSyncStatus = "local" | "waiting" | "syncing" | "synced" | "conflict" | "auth-required";
export type NoteSyncState = {
  status: NoteSyncStatus;
  conflicts: number;
  lastSyncedAt: string | null;
  localOnly: boolean;
  user: { login: string; avatarUrl: string } | null;
};

export type NoteSyncController = {
  save(note: NoteCard): NoteCard;
  remove(noteId: string, now?: string): NoteCard | null;
  restoreVersion(noteId: string, index?: number, now?: string): NoteCard | null;
  schedule(): void;
  syncNow(): Promise<NoteSyncState>;
  refreshSession(): Promise<NoteSyncState>;
  snapshot(): NoteSyncState;
  dispose(): void;
};

export function createWebNoteSyncController(options: {
  repository: {
    save(note: NoteCard): NoteCard;
    remove(noteId: string, now?: string): NoteCard | null;
    restoreVersion(noteId: string, index?: number, now?: string): NoteCard | null;
    pendingBatch(): Array<{ kind: "upsert" | "delete"; note: NoteCard }>;
    acknowledge(noteIds: string[], submittedOperations?: Array<{ kind: "upsert" | "delete"; note: NoteCard }>): void;
    applyRemoteBatch(notes: NoteCard[]): { notes: NoteCard[]; conflicts: number };
    cursor(): string;
    setCursor(cursor: string): void;
  };
  request?: typeof fetch;
  onStatus?: (state: NoteSyncState) => void;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
  debounceMs?: number;
  maxPullPages?: number;
}): NoteSyncController;
