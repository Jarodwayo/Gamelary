// Identité affichée du profil (nom, identifiant, bio, photo, arrière-plan).
// Pas de compte utilisateur (voir ARCHITECTURE.md §9) : ces
// champs vivent dans le store local au même titre que le SteamID64, et rien
// n'est vérifié côté serveur — un identifiant n'est donc pas réservé ni
// unique, seulement bien formé.

export type StoredProfile = {
  displayName?: string;
  username?: string;
  bio?: string;
  // URI d'image locale (voir pickProfileImage, src/lib/profile-image.ts) :
  // jamais une URL distante tant qu'il n'y a pas de backend d'upload.
  avatarUri?: string;
  // Distinct d'avatarUri : les deux images se choisissent séparément (une
  // photo de profil ronde, une bannière large), jamais dérivées l'une de
  // l'autre.
  backgroundUri?: string;
};

export const DEFAULT_DISPLAY_NAME = 'Joueur';
export const DEFAULT_USERNAME = 'joueur';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const DISPLAY_NAME_MAX_LENGTH = 40;
export const BIO_MAX_LENGTH = 160;

// Les valeurs par défaut remplacent un champ vide plutôt que d'afficher un
// blanc : avant cet écran d'édition, le profil était déjà affiché avec ces
// deux constantes en dur (DISPLAY_NAME/DISPLAY_HANDLE), on garde donc
// exactement le même rendu tant que l'utilisateur n'a rien saisi.
export function displayNameOf(profile: StoredProfile | undefined): string {
  return profile?.displayName?.trim() || DEFAULT_DISPLAY_NAME;
}

export function usernameOf(profile: StoredProfile | undefined): string {
  return profile?.username?.trim() || DEFAULT_USERNAME;
}

// Affiché partout avec le "@" (jamais stocké avec) — un seul endroit décide
// de ce préfixe, pour ne pas se retrouver avec des "@@joueur" selon l'écran.
export function handleOf(profile: StoredProfile | undefined): string {
  return `@${usernameOf(profile)}`;
}

// Saisie libre -> identifiant utilisable dans une URL : minuscules, sans
// "@" collé au début, et uniquement [a-z0-9_] (les espaces et la
// ponctuation sautent au lieu d'être transformés en tirets, contrairement à
// slugify — un identifiant n'est pas un slug de titre).
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, USERNAME_MAX_LENGTH);
}

export function isValidUsername(value: string): boolean {
  return new RegExp(`^[a-z0-9_]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`).test(value);
}

// Même frontière système que l'adresse de contact (voir support-links.ts) :
// la base vient d'un .env édité à la main. Une valeur qui n'est pas une URL
// absolue ("gamelary.app" sans schéma, un placeholder laissé en l'état)
// produirait un lien impossible à ouvrir une fois copié — on préfère alors
// le repli sur l'URL de l'app (voir profile-link.ts).
export function isValidProfileBaseUrl(value: string): boolean {
  return /^https?:\/\/[^\s/]+/.test(value.trim());
}

// Lien partageable vers le profil public. La page publique elle-même
// n'existe pas encore (elle suppose des comptes hébergés, voir
// ARCHITECTURE.md §9) : c'est bien la forme finale de l'URL, pas une page
// déjà servie — d'où une base configurable (EXPO_PUBLIC_PROFILE_BASE_URL,
// voir profile-link.ts) plutôt qu'un domaine inventé en dur ici.
export function profileLink(username: string, baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  return `${base}/u/${encodeURIComponent(username)}`;
}
