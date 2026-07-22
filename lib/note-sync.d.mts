import type { NoteCard, NoteOperation } from "./notebook.mjs";

export type ServerMergeDecision = {
  action: "insert" | "update" | "noop";
  current: NoteCard;
  history: NoteCard[];
  conflicted: boolean;
};

export function normalizeSyncOperation(operation: NoteOperation): NoteOperation;
export function decideServerMerge(current: NoteCard | null, incoming: NoteCard): ServerMergeDecision;
