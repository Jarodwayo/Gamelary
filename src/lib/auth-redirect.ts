import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Où Supabase renvoie l'utilisateur après Google OAuth ou un clic sur un
// lien magique : même chemin des deux côtés (/profile/sign-in), pour n'
// avoir qu'un seul point d'atterrissage à gérer (voir ce fichier + l'écran
// lui-même, qui échange le `code` PKCE reçu contre une session).
//
// webAuthRedirectUrl est séparée et pure (prend l'origine en paramètre au
// lieu de lire `window` elle-même) précisément pour rester testable sans
// un DOM — même raisonnement que profile-link.ts, qui distingue déjà la
// logique pure (profile.ts) de sa résolution dépendante de l'environnement.
export function webAuthRedirectUrl(origin: string | undefined): string {
  return origin ? `${origin}/profile/sign-in` : '';
}

function nativeAuthRedirectUrl(): string {
  return Linking.createURL('/profile/sign-in');
}

// À n'appeler que depuis un gestionnaire d'événement (au clic), jamais
// pendant le rendu : `web.output: "server"` (voir app.json) rend aussi cet
// écran côté serveur, où `window` n'existe pas — même piège que
// publicProfileLink (profile-link.ts). `typeof window !== 'undefined'` ne
// suffit pas à lui seul (vérifié : sous Jest, `window` existe mais
// `window.location` non — un rendu serveur pourrait tout aussi bien
// exposer un `window` partiel plutôt qu'une vraie absence), d'où la
// vérification explicite de `window.location` en plus.
export function authRedirectUrl(): string {
  if (Platform.OS === 'web') {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : undefined;
    return webAuthRedirectUrl(origin);
  }
  return nativeAuthRedirectUrl();
}
