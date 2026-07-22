import type { NoteCard, NoteFilters, NoteOperation } from "./notebook.mjs";

export type NoteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type WebNoteRepository = {
  list(filters?: NoteFilters): NoteCard[];
  save(note: NoteCard): NoteCard;
  remove(id: string, now?: string): NoteCard | null;
  pendingBatch(): NoteOperation[];
  acknowledge(noteIds: string[]): void;
  applyRemoteBatch(remoteNotes: NoteCard[]): { notes: NoteCard[]; conflicts: number };
  history(id: string): NoteCard[];
  restoreVersion(id: string, index?: number, now?: string): NoteCard | null;
  migrateLegacyKeys(keys: Array<{ key: string; repositoryId: string; documentId: string }>, now?: string): NoteCard[];
  cursor(): string;
  setCursor(cursor: string): void;
};

export function createWebNoteRepository(storage: NoteStorage): WebNoteRepository;
