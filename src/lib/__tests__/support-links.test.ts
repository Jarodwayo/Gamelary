// Destination de "Contacter l'assistance" selon EXPO_PUBLIC_SUPPORT_EMAIL
// (voir support-links.ts). La variable est facultative et documentée dans
// .env.example : ce fichier verrouille le fait qu'aucune de ses valeurs
// possibles ne produit de lien cassé, et que la ligne garde toujours une
// destination — jamais masquée, jamais morte.
import { REPORT_PROBLEM_URL, FEATURE_REQUESTS_URL, supportContactUrl } from '@/lib/support-links';

const GITHUB_FALLBACK = 'https://github.com/Jarodwayo/Gamelary/issues/new';
const originalEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

afterEach(() => {
  if (originalEmail === undefined) delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
  else process.env.EXPO_PUBLIC_SUPPORT_EMAIL = originalEmail;
});

test('adresse valide : ouvre un e-mail', () => {
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL = 'support@gamelary.example';
  expect(supportContactUrl()).toBe('mailto:support@gamelary.example');
});

test('variable absente : retombe sur une issue GitHub, pas sur un mailto vide', () => {
  delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
  expect(supportContactUrl()).toBe(GITHUB_FALLBACK);
});

test('variable présente mais vide (.env.example recopié tel quel) : même repli', () => {
  // Le cas le plus probable en pratique : .env.example livre la ligne
  // `EXPO_PUBLIC_SUPPORT_EMAIL=` sans valeur.
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL = '';
  expect(supportContactUrl()).toBe(GITHUB_FALLBACK);

  process.env.EXPO_PUBLIC_SUPPORT_EMAIL = '   ';
  expect(supportContactUrl()).toBe(GITHUB_FALLBACK);
});

test('valeur mal formée : repli plutôt qu’un lien mailto: cassé', () => {
  for (const value of ['à-remplir', 'support@', '@gamelary.example', 'support@gamelary', 'deux adresses@a.b c@d.e']) {
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL = value;
    expect(supportContactUrl()).toBe(GITHUB_FALLBACK);
  }
});

test('les espaces autour d’une adresse valide sont tolérés', () => {
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL = '  support@gamelary.example  ';
  expect(supportContactUrl()).toBe('mailto:support@gamelary.example');
});

test('les deux autres entrées de l’écran d’aide ne dépendent d’aucune variable', () => {
  delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
  expect(FEATURE_REQUESTS_URL).toContain('github.com/Jarodwayo/Gamelary/issues');
  expect(REPORT_PROBLEM_URL).toContain('labels=bug');
});
