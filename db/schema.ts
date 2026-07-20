import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const repositoryPackages = sqliteTable("repository_packages", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  sourceSha: text("source_sha").notNull(),
  packageJson: text("package_json").notNull(),
  syncedAt: integer("synced_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const libraryRepositories = sqliteTable("library_repositories", {
  libraryId: text("library_id").notNull(),
  repositoryId: text("repository_id").notNull(),
  addedAt: integer("added_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.libraryId, table.repositoryId] }),
  index("library_repositories_library_idx").on(table.libraryId, table.addedAt),
]);
