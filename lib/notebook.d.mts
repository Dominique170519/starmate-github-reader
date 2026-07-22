export type NoteType = "freeform" | "quote" | "understanding" | "question" | "term" | "mentor-answer" | "review";

export type NoteCard = {
  id: string;
  repositoryId: string;
  documentId: string;
  sectionId: string;
  sourceUrl: string;
  anchor: string;
  type: NoteType;
  title: string;
  body: string;
  quote: string;
  tags: string[];
  pinned: boolean;
  resolved: boolean;
  reviewNeeded: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt: string | null;
};

export type NoteFilters = {
  repositoryId?: string;
  documentId?: string;
  type?: NoteType;
  tag?: string;
  reviewNeeded?: boolean;
  includeDeleted?: boolean;
  query?: string;
};

export type NoteOperation = { kind: "upsert" | "delete"; note: NoteCard };

export const NOTE_TYPES: NoteType[];
export function createNoteCard(input: Partial<NoteCard> & Pick<NoteCard, "repositoryId" | "documentId">, now?: string): NoteCard;
export function migrateLegacyNote(input: { key: string; body: string; repositoryId: string; documentId: string }, now?: string): NoteCard | null;
export function mergeNoteVersions(local: NoteCard | null, remote: NoteCard | null): { current: NoteCard; history: NoteCard[]; conflicted: boolean };
export function matchesNoteFilters(note: NoteCard, filters?: NoteFilters): boolean;
export function serializeNoteBatch(operations: NoteOperation[]): NoteOperation[];
