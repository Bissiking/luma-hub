// Documentary inventory, kept outside the public checkout and static assets.
import { readFile, stat } from 'node:fs/promises';

const text = (value, limit = 6000) => typeof value === 'string' ? value.slice(0, limit) : null;
const list = value => Array.isArray(value) ? value.slice(0, 1000) : [];
function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function repository(raw) {
  const name = text(raw?.repository, 200);
  if (!/^[\w.-]+\/[\w.-]+$/.test(name || '')) return null;
  return {
    name, url: `https://github.com/${name}`, branch: text(raw.defaultBranch, 200),
    visibility: raw.visibility === 'private' ? 'private' : raw.visibility === 'public' ? 'public' : null,
    archived: raw.archived === true,
    versions: [...new Set(list(raw.sourceFiles).map(s => text(s?.version, 100)).filter(Boolean))],
  };
}
export function projectCatalogue(raw) {
  if (!raw || !Array.isArray(raw.projects) || raw.projects.length > 1000 || !Array.isArray(raw.divisions)) throw new Error('invalid_catalogue');
  const ids = new Set();
  const divisions = list(raw.divisions).filter(d => /^[a-z0-9-]+$/.test(d?.id)).map(d => ({ id: d.id, name: text(d.name, 200) }));
  const projects = raw.projects.map(p => {
    if (!p || !/^[a-z0-9-]{1,100}$/.test(p.id) || ids.has(p.id) || !text(p.name, 200)) throw new Error('invalid_catalogue');
    ids.add(p.id);
    const repositories = list(p.repositories).map(repository).filter(Boolean);
    return {
      id: p.id, name: text(p.name, 200), alias: text(p.alias, 200),
      division: divisions.some(d => d.id === p.division) ? p.division : null,
      kind: text(p.kind, 100) || 'project', function: text(p.function),
      qualification: text(p.functionQualification), status: text(p.status, 200),
      productionStatus: text(p.productionStatus, 200), responsible: text(p.responsible, 200),
      observation: text(p.observation), serviceUrl: httpsUrl(p.serviceUrl),
      temporaryName: p.nameApproved === false, namingNote: text(p.namingNote),
      software: text(p.underlyingSoftware, 200), supportedBy: list(p.supportedBy).map(x => text(x, 100)).filter(Boolean),
      relatedProjectId: text(p.relatedProjectId, 100), relationship: text(p.relationship),
      affiliation: text(p.declaredAffiliation), repositories,
      relatedRepositories: list(p.relatedRepositoriesToConfirm).map(repository).filter(Boolean),
      archived: repositories.some(r => r.archived),
      sources: list(p.evidence).map(s => ({
        label: s?.type === 'user_message' ? 'Précision de Mathéo' : text(s?.path, 200) || 'Source GitHub',
        url: httpsUrl(s?.url),
      })),
    };
  });
  return {
    checkedOn: text(raw.verification?.checkedOn, 30), divisions, projects,
    entities: list(raw.entities).map(e => ({ id: text(e?.id, 100), name: text(e?.name, 200), description: text(e?.description) })),
  };
}
export async function readProjectCatalogue(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size > 5 * 1024 * 1024) throw new Error('invalid_catalogue');
  return projectCatalogue(JSON.parse(await readFile(file, 'utf8')));
}
