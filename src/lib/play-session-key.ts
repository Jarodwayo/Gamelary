// Module dédié pour une seule raison : évitait un cycle d'import réel entre
// game-store.tsx et store-migrations.ts (qui n'échange aujourd'hui que des
// TYPES entre les deux, effacés à la compilation — voir le commentaire en
// tête de store-migrations.ts). Les deux ont besoin de la même génération de
// `clientKey` : game-store.tsx pour une NOUVELLE session (setTotalHours),
// store-migrations.ts pour combler celles qui datent d'avant l'existence de
// ce champ (voir migratePlaySessions).

// Identité de LA SESSION elle-même (voir types/game.ts, PlaySession.clientKey
// et ARCHITECTURE.md §9.5), volontairement non dérivée de `date`/`hours` :
// deux sessions au même total ne désignent pas le même évènement, à la
// différence d'un succès identifiable par son nom. Le suffixe aléatoire
// évite une collision entre deux sessions créées à la même milliseconde.
export function makePlaySessionClientKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
