CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  github_user_id text NOT NULL UNIQUE,
  github_login text NOT NULL,
  avatar_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS web_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_sessions_user_idx ON web_sessions(user_id);

CREATE TABLE IF NOT EXISTS extension_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extension_devices_user_idx ON extension_devices(user_id);

CREATE TABLE IF NOT EXISTS extension_connect_codes (
  id text PRIMARY KEY,
  challenge_hash text NOT NULL UNIQUE,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  device_label text NOT NULL,
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id text NOT NULL,
  version integer NOT NULL,
  note_json jsonb NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, note_id)
);
CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON notes(user_id, updated_at);

CREATE TABLE IF NOT EXISTS note_versions (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id text NOT NULL,
  version integer NOT NULL,
  note_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS note_versions_user_note_idx ON note_versions(user_id, note_id);

CREATE TABLE IF NOT EXISTS sync_changes (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id text NOT NULL,
  operation text NOT NULL,
  note_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_changes_user_cursor_idx ON sync_changes(user_id, id);
