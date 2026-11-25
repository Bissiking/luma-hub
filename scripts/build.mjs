// Client ESM sans transpilation : contrôle de tous les imports et assets locaux.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("src/public");
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(file);
      continue;
    }
    if (!/\.(html|js|css)$/.test(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    const refs = file.endsWith(".js")
      ? [...content.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)].map(
          (m) => m[1],
        )
      : file.endsWith(".html")
        ? [...content.matchAll(/(?:src|href)="(\/[^"#?]*)"/g)].map((m) => m[1])
        : [];
    for (const ref of refs) {
      const target = ref.startsWith("/")
        ? path.join(root, ref)
        : path.resolve(path.dirname(file), ref);
      if (ref === "/" || ref.startsWith("/auth/")) continue;
      if (!target.startsWith(root + path.sep) || !fs.existsSync(target))
        throw new Error(`Asset/import absent : ${file} → ${ref}`);
    }
  }
}
scan(root);
JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
console.log(
  "Client ESM prêt à servir ; imports, assets et manifeste vérifiés. Aucune transpilation requise.",
);
