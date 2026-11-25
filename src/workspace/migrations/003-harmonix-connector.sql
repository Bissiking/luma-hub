CREATE TABLE connector_secrets_v3 (
  user_id TEXT NOT NULL CHECK(length(user_id) BETWEEN 1 AND 200),
  provider TEXT NOT NULL CHECK(provider IN ('drivio', 'harmonix')),
  sealed_token TEXT NOT NULL,
  revision TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  PRIMARY KEY(user_id, provider)
);
INSERT INTO connector_secrets_v3 SELECT * FROM connector_secrets;
DROP TABLE connector_secrets;
ALTER TABLE connector_secrets_v3 RENAME TO connector_secrets;
