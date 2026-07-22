import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("defines the complete PostgreSQL notebook sync schema", async () => {
  const schema = await readFile("db/notebook-schema.ts", "utf8");
  const migration = await readFile("db/migrations/0001_notebook_sync.sql", "utf8");

  for (const table of [
    "users",
    "web_sessions",
    "extension_devices",
    "extension_connect_codes",
    "notes",
    "note_versions",
    "sync_changes",
  ]) {
    assert.match(schema, new RegExp(`pgTable\\(\\\"${table}\\\"`));
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }

  assert.match(schema, /githubUserId.*unique/si);
  assert.match(schema, /userId.*noteId/si);
  assert.match(schema, /consumedAt/);
  assert.match(schema, /bigserial/);
});

test("keeps database access configuration-safe", async () => {
  const client = await readFile("db/client.ts", "utf8");
  assert.match(client, /if \(!process\.env\.DATABASE_URL\) return null/);
  assert.match(client, /@neondatabase\/serverless/);
  assert.match(client, /drizzle-orm\/neon-http/);
});

test("documents every required notebook sync environment variable", async () => {
  const env = await readFile(".env.example", "utf8");
  for (const name of [
    "DATABASE_URL",
    "GITHUB_OAUTH_CLIENT_ID",
    "GITHUB_OAUTH_CLIENT_SECRET",
    "AUTH_SECRET",
    "NEXT_PUBLIC_APP_URL",
  ]) {
    assert.match(env, new RegExp(`^${name}=`, "m"));
  }
});
