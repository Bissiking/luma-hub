export const KIND_LABELS = { project: 'Projet', application: 'Application', game: 'Jeu', component: 'Composant', utility: 'Utilitaire', event: 'Événement', unspecified: 'À préciser' };
export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
export function filterProjects(catalogue, filters) {
  const divisions = new Map(catalogue.divisions.map(d => [d.id, d.name]));
  const words = normalize(filters.query).trim().split(/\s+/).filter(Boolean);
  return catalogue.projects.filter(p => {
    if (filters.division && (filters.division === 'unclassified' ? p.division !== null : p.division !== filters.division)) return false;
    if (filters.kind && p.kind !== filters.kind) return false;
    if (filters.archive === 'archived' && !p.archived || filters.archive === 'current' && p.archived) return false;
    const haystack = normalize([p.name, p.alias, p.function, divisions.get(p.division), p.responsible, p.software, ...p.repositories.map(r => r.name)].join(' '));
    return words.every(word => haystack.includes(word));
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}
