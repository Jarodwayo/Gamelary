// Destinations de l'écran "Aide et idées" (voir profile/help.tsx). Le
// projet n'a ni portail de vote de fonctionnalités ni boîte support dédiée
// (voir ARCHITECTURE.md §10) : les trois entrées pointent donc vers le
// suivi d'issues du dépôt public, qui existe réellement, plutôt que vers
// des URL inventées.
const REPO_URL = 'https://github.com/Jarodwayo/Gamelary';

export const FEATURE_REQUESTS_URL = `${REPO_URL}/issues?q=is%3Aissue+label%3Aenhancement`;
export const REPORT_PROBLEM_URL = `${REPO_URL}/issues/new?labels=bug`;

// Une variable d'environnement est une frontière système : sa valeur vient
// d'un fichier .env édité à la main, pas du code. Une valeur mal formée
// (placeholder laissé en l'état, adresse tronquée) donnerait un
// `mailto:à-remplir` qui s'ouvre sans mener nulle part — un lien cassé est
// pire que pas de lien du tout. Vérifié ici, comme le SteamID64 l'est
// avant d'atteindre l'API Steam (voir profile/index.tsx).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Adresse de contact laissée configurable (EXPO_PUBLIC_*, juste une adresse
// publique, jamais un secret) : coder en dur l'e-mail personnel du
// mainteneur dans un dépôt public l'exposerait aux robots. Absente, vide
// (le cas du .env.example recopié tel quel) ou mal formée, on retombe sur
// une issue vierge — la ligne "Contacter l'assistance" garde donc toujours
// une destination valide plutôt que d'être masquée : le canal existe dans
// tous les cas, seul son point d'arrivée change.
// Type gabarit `${string}:${string}` plutôt que `string` : c'est ce
// qu'attend le `href` d'un lien externe côté expo-router (ExternalPathString),
// qui distingue ainsi une URL absolue d'une route interne de l'app.
export function supportContactUrl(): `${string}:${string}` {
  const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim();
  return email && EMAIL_PATTERN.test(email) ? `mailto:${email}` : `${REPO_URL}/issues/new`;
}
