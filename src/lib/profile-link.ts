import * as Linking from 'expo-linking';

import { isValidProfileBaseUrl, profileLink } from '@/lib/profile';

// Résolution de la base du lien de profil, séparée des helpers purs de
// profile.ts (testables sans runtime Expo) : c'est la seule partie qui
// dépend de l'environnement d'exécution.
//
// EXPO_PUBLIC_* (valeur publique, juste une URL — même raisonnement que
// steam-api-url.ts) : renseignée, elle donne le vrai domaine public une
// fois l'app déployée. Sinon, repli sur l'URL de l'app elle-même
// (`Linking.createURL`) : origine web en dev/déploiement web, lien profond
// `gamelary://` sur mobile. Toujours un lien qui existe réellement, jamais
// un domaine inventé en dur pour faire joli.
//
// À n'appeler que depuis un gestionnaire d'événement (au clic), jamais
// pendant le rendu : `web.output: "server"` (voir app.json) rend aussi ces
// écrans côté serveur, où createURL renvoie '' faute de `window`.
export function publicProfileLink(username: string): string {
  const base = process.env.EXPO_PUBLIC_PROFILE_BASE_URL?.trim();
  // Vide (le cas du .env.example recopié tel quel) ou pas une URL absolue :
  // repli, plutôt qu'un lien copié que personne ne pourra ouvrir.
  if (base && isValidProfileBaseUrl(base)) return profileLink(username, base);
  return Linking.createURL(`/u/${encodeURIComponent(username)}`);
}
