// Backend Steam séparé (gamelary-api, projet Node/Express distinct — voir
// ARCHITECTURE.md §6.3) : contrairement à apiUrl (src/lib/api-url.ts, qui
// résout NOTRE PROPRE backend expo-router via le serveur Metro en dev),
// celui-ci vit sur un autre service déployé séparément (Render). Son URL
// n'est connue qu'une fois ce service déployé, d'où EXPO_PUBLIC_* (valeur
// publique, juste une URL — jamais la clé Steam elle-même, qui ne quitte
// jamais gamelary-api) plutôt qu'une résolution automatique.
export function steamApiUrl(path: string): string | null {
  const base = process.env.EXPO_PUBLIC_STEAM_API_URL;
  if (!base) return null;
  return `${base}${path}`;
}
