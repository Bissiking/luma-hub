// Synthetic catalogue: no personal or private repository data in test sources.
export function projectsFixture() {
  return {
    verification: { checkedOn: '2026-11-25' },
    entities: [{ id: 'demo', name: 'Identité de démonstration', description: 'Données synthétiques de recette.' }],
    divisions: [{ id: 'software', name: 'Division de démonstration' }],
    projects: [
      { id: 'demo-garage', name: 'Garage Démo', division: 'software', kind: 'application', function: 'Suivi automobile synthétique.', responsible: 'Compte de démonstration', repositories: [{ repository: 'example/garage', defaultBranch: 'main', visibility: 'private', sourceFiles: [{ version: '1.2.0' }] }] },
      { id: 'demo-agent', name: 'Agent Démo', kind: 'component', relatedProjectId: 'demo-garage', relationship: 'Composant du projet.', function: 'Agent de démonstration.', repositories: [{ repository: 'example/agent', archived: true }] },
      { id: 'demo-event', name: 'LAN Démo', kind: 'event', function: 'Événement de démonstration.', repositories: [], nameApproved: false, namingNote: 'Nom provisoire de recette.' },
    ],
  };
}
