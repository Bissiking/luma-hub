CREATE TABLE workspaces (
  user_id TEXT NOT NULL CHECK(length(user_id) BETWEEN 1 AND 200),
  space_id TEXT NOT NULL CHECK(space_id = 'personal'),
  revision INTEGER NOT NULL CHECK(revision > 0),
  state_json TEXT NOT NULL CHECK(json_valid(state_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, space_id)
);
