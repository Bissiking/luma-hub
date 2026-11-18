import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((item) =>
      item.isDirectory()
        ? files(path.join(dir, item.name))
        : /\.(js|mjs)$/.test(item.name)
          ? [path.join(dir, item.name)]
          : [],
    );
}
const sources = [...files("src"), ...files("scripts"), ...files("test")];
for (const file of sources) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status) process.exit(result.status);
}
const pkg = JSON.parse(fs.readFileSync("package.json")),
  lock = JSON.parse(fs.readFileSync("package-lock.json"));
if (
  pkg.version !== lock.version ||
  pkg.version !== lock.packages[""].version ||
  fs.existsSync("VERSION")
)
  throw new Error("Version incohérente");
console.log(
  `${sources.length} fichiers JavaScript vérifiés ; versions cohérentes.`,
);
