CREATE TABLE connector_secrets (
  user_id TEXT NOT NULL CHECK(length(user_id) BETWEEN 1 AND 200),
  provider TEXT NOT NULL CHECK(provider = 'drivio'),
  sealed_token TEXT NOT NULL,
  revision TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  PRIMARY KEY(user_id, provider)
);
