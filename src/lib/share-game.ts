// Contenu partagé pour un jeu (menu ⋯ de la fiche jeu, voir
// app/library/[id].tsx) : extrait en pur pour être testable sans monter
// tout l'écran (useGame/useGameStore, lourds à mocker). Aucun lien de fiche
// Gamelary à partager — la bibliothèque reste strictement locale (voir
// ARCHITECTURE.md §6.6) — seulement le lien Steam quand le jeu en a un.
export function steamStoreLink(steamAppId: number | undefined): string | null {
  return steamAppId != null ? `https://store.steampowered.com/app/${steamAppId}` : null;
}

export function gameShareMessage(title: string, steamAppId: number | undefined): string {
  const link = steamStoreLink(steamAppId);
  return link ? `${title} sur Gamelary\n${link}` : `${title} sur Gamelary`;
}
