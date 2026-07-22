import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  githubUserId: text("github_user_id").notNull().unique(),
  githubLogin: text("github_login").notNull(),
  avatarUrl: text("avatar_url").notNull().default(""),
  ...timestamps,
});

export const webSessions = pgTable("web_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamps.createdAt,
}, (table) => [index("web_sessions_user_idx").on(table.userId)]);

export const extensionDevices = pgTable("extension_devices", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamps.createdAt,
}, (table) => [index("extension_devices_user_idx").on(table.userId)]);

export const extensionConnectCodes = pgTable("extension_connect_codes", {
  id: text("id").primaryKey(),
  challengeHash: text("challenge_hash").notNull().unique(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  deviceLabel: text("device_label").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamps.createdAt,
});

export const notes = pgTable("notes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noteId: text("note_id").notNull(),
  version: integer("version").notNull(),
  noteJson: jsonb("note_json").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("notes_user_note_unique").on(table.userId, table.noteId),
  index("notes_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const noteVersions = pgTable("note_versions", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noteId: text("note_id").notNull(),
  version: integer("version").notNull(),
  noteJson: jsonb("note_json").notNull(),
  createdAt: timestamps.createdAt,
}, (table) => [index("note_versions_user_note_idx").on(table.userId, table.noteId)]);

export const syncChanges = pgTable("sync_changes", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noteId: text("note_id").notNull(),
  operation: text("operation").notNull(),
  noteJson: jsonb("note_json").notNull(),
  createdAt: timestamps.createdAt,
}, (table) => [index("sync_changes_user_cursor_idx").on(table.userId, table.id)]);

export const notebookSyncTables = {
  users,
  webSessions,
  extensionDevices,
  extensionConnectCodes,
  notes,
  noteVersions,
  syncChanges,
};
