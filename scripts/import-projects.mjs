import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { readProjectCatalogue } from '../src/projects/catalogue.js';

const source = process.argv[2];
if (!source) throw new Error('Usage : npm run catalogue:import -- /chemin/catalogue.json');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(process.env.HUB_PROJECT_CATALOGUE_PATH || path.join(root, 'data/project-catalogue.json'));
const publicDir = path.join(root, 'src/public');
const relative = path.relative(publicDir, destination);
if (relative === '' || !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) throw new Error('Le catalogue doit rester hors de src/public.');
const catalogue = await readProjectCatalogue(source);
await fs.mkdir(path.dirname(destination), { recursive: true });
const temporary = destination + '.' + crypto.randomUUID() + '.tmp';
try {
  await fs.copyFile(source, temporary);
  await fs.rename(temporary, destination);
} finally { await fs.rm(temporary, { force: true }); }
console.log(`${catalogue.projects.length} fiches importées. Le catalogue sera relu à la prochaine consultation.`);
