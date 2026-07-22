import {
  matchesNoteFilters,
  mergeNoteVersions,
  migrateLegacyNote,
  serializeNoteBatch,
} from "./notebook.mjs";

const NOTES_KEY = "starmate-notes:v1";
const OPERATIONS_KEY = "starmate-note-operations:v1";
const HISTORY_KEY = "starmate-note-history:v1";
const MIGRATION_KEY = "starmate-note-migration:v1";
const CURSOR_KEY = "starmate-note-cursor:v1";

function readArray(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function upsert(notes, note) {
  return [note, ...notes.filter((item) => item.id !== note.id)];
}

export function createWebNoteRepository(storage) {
  const readNotes = () => readArray(storage, NOTES_KEY);
  const writeNotes = (notes) => storage.setItem(NOTES_KEY, JSON.stringify(notes));
  const readOperations = () => readArray(storage, OPERATIONS_KEY);
  const writeOperations = (operations) => storage.setItem(OPERATIONS_KEY, JSON.stringify(operations));

  function enqueue(operation) {
    const next = [operation, ...readOperations().filter((item) => item.note?.id !== operation.note.id)];
    writeOperations(next);
  }

  const repository = {
    list(filters = {}) {
      return readNotes().filter((note) => matchesNoteFilters(note, filters));
    },
    save(note) {
      writeNotes(upsert(readNotes(), note));
      enqueue({ kind: note.deletedAt ? "delete" : "upsert", note });
      return note;
    },
    remove(id, now = new Date().toISOString()) {
      const current = readNotes().find((note) => note.id === id);
      if (!current) return null;
      const tombstone = {
        ...current,
        deletedAt: now,
        updatedAt: now,
        version: current.version + 1,
      };
      writeNotes(upsert(readNotes(), tombstone));
      enqueue({ kind: "delete", note: tombstone });
      return tombstone;
    },
    pendingBatch() {
      return serializeNoteBatch(readOperations());
    },
    acknowledge(noteIds, submittedOperations = null) {
      const ids = new Set(noteIds || []);
      const submitted = submittedOperations
        ? new Map(submittedOperations.map((operation) => [operation.note?.id, JSON.stringify(operation)]))
        : null;
      writeOperations(readOperations().filter((operation) => {
        if (!ids.has(operation.note?.id)) return true;
        if (!submitted) return false;
        return submitted.get(operation.note?.id) !== JSON.stringify(operation);
      }));
    },
    applyRemoteBatch(remoteNotes) {
      let notes = readNotes();
      const history = readArray(storage, HISTORY_KEY);
      let conflicts = 0;
      for (const incoming of remoteNotes || []) {
        const local = notes.find((note) => note.id === incoming.id);
        if (!local) {
          notes = upsert(notes, incoming);
          continue;
        }
        const merged = mergeNoteVersions(local, incoming);
        notes = upsert(notes, merged.current);
        if (merged.conflicted) conflicts += 1;
        history.unshift(...merged.history.map((note) => ({ note, savedAt: new Date().toISOString() })));
      }
      writeNotes(notes);
      storage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 500)));
      return { notes, conflicts };
    },
    history(id) {
      return readArray(storage, HISTORY_KEY)
        .map((item) => item.note)
        .filter((note) => note?.id === id);
    },
    restoreVersion(id, index = 0, now = new Date().toISOString()) {
      const previous = repository.history(id)[index];
      const current = readNotes().find((note) => note.id === id);
      if (!previous || !current) return null;
      return repository.save({ ...previous, updatedAt: now, version: current.version + 1, deletedAt: null });
    },
    migrateLegacyKeys(keys, now = new Date().toISOString()) {
      if (storage.getItem(MIGRATION_KEY) === "complete") return [];
      const migrated = [];
      for (const descriptor of keys || []) {
        const note = migrateLegacyNote({
          ...descriptor,
          body: storage.getItem(descriptor.key) || "",
        }, now);
        if (!note) continue;
        repository.save(note);
        migrated.push(note);
      }
      const storedIds = new Set(readNotes().map((note) => note.id));
      if (migrated.every((note) => storedIds.has(note.id))) storage.setItem(MIGRATION_KEY, "complete");
      return migrated;
    },
    cursor() {
      return storage.getItem(CURSOR_KEY) || "0";
    },
    setCursor(cursor) {
      storage.setItem(CURSOR_KEY, String(cursor || "0"));
    },
  };

  return repository;
}
