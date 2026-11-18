import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function readConnectorKey(filename, { create = false } = {}) {
  if (create) {
    fs.mkdirSync(path.dirname(path.resolve(filename)), {
      recursive: true,
      mode: 0o700,
    });
    try {
      fs.writeFileSync(filename, crypto.randomBytes(32), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || (stat.mode & 0o077) !== 0)
    throw new Error(
      "La clé des connecteurs doit être un fichier privé (chmod 600).",
    );
  const key = fs.readFileSync(filename);
  if (key.length !== 32)
    throw new Error(
      "Clé des connecteurs invalide. Restaurer la clé existante, ne pas la remplacer.",
    );
  return key;
}
const aad = (userId) =>
  Buffer.from(JSON.stringify(["luma-connectors", 1, "drivio", userId]));
export function sealToken(token, userId, key) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(userId));
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}
export function openToken(sealed, userId, key) {
  const [version, iv, tag, data, extra] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data || extra)
    throw new Error("Secret chiffré invalide.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(aad(userId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
