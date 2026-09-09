// Destinations de l'écran "Aide et idées" (voir profile/help.tsx). Le
// projet n'a ni portail de vote de fonctionnalités ni boîte support dédiée
// (voir ARCHITECTURE.md §10) : les trois entrées pointent donc vers le
// suivi d'issues du dépôt public, qui existe réellement, plutôt que vers
// des URL inventées.
const REPO_URL = 'https://github.com/Jarodwayo/Gamelary';

export const FEATURE_REQUESTS_URL = `${REPO_URL}/issues?q=is%3Aissue+label%3Aenhancement`;
export const REPORT_PROBLEM_URL = `${REPO_URL}/issues/new?labels=bug`;

// Adresse de contact laissée configurable (EXPO_PUBLIC_*, juste une adresse
// publique, jamais un secret) : coder en dur l'e-mail personnel du
// mainteneur dans un dépôt public l'exposerait aux robots. Sans elle, on
// retombe sur une issue vierge — même canal, sans e-mail exposé.
// Type gabarit `${string}:${string}` plutôt que `string` : c'est ce
// qu'attend le `href` d'un lien externe côté expo-router (ExternalPathString),
// qui distingue ainsi une URL absolue d'une route interne de l'app.
export function supportContactUrl(): `${string}:${string}` {
  const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim();
  return email ? `mailto:${email}` : `${REPO_URL}/issues/new`;
}
