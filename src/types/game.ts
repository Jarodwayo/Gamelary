export type FavoriteTrack = {
  title: string;
  artist: string;
};

// Une entrée = "l'utilisateur a joué N heures à telle date", ajoutée à la
// main (pas de tracking automatique, voir ARCHITECTURE.md §5.3). Stocker
// des sessions datées plutôt qu'un seul total permet de dériver Semaine/
// Mois/Tout à l'affichage (Statistiques) sans données inventées.
export type PlaySession = {
  date: string; // ISO 8601
  hours: number;
};

// Type composite assemblé par le hook useGame (src/hooks/use-game.ts) à
// partir de plusieurs sources, jamais stocké tel quel :
// - id/title/platform : catalogue IGDB (voir ARCHITECTURE.md §5.1), avec
//   title/platform en repli tant qu'IGDB n'a pas répondu ou n'a pas trouvé
//   le jeu.
// - achievementsUnlocked/Total : à terme Steam Web API (GetPlayerAchievements,
//   encore mocké), d'où le choix de stocker un compte brut plutôt qu'un
//   pourcentage déjà calculé — le pourcentage est dérivé à l'affichage
//   (voir library/[id].tsx) pour ne jamais désynchroniser les deux valeurs.
// - favoriteTrack : à terme résultat d'une recherche Spotify choisi par
//   l'utilisateur (encore mocké), pas un stream — voir le commentaire dans
//   library/[id].tsx.
// - inLibrary/stopped/rating/review/playSessions : état propre à
//   l'utilisateur, persisté localement par src/lib/game-store.tsx (voir
//   ARCHITECTURE.md §5.5). Un jeu peut exister (vu dans Explorer, ajouté à
//   une liste) sans être dans la bibliothèque suivie — d'où inLibrary
//   distinct de la simple présence de l'id dans le store.
export type Game = {
  id: string;
  title: string;
  platform: string;
  inLibrary: boolean;
  stopped: boolean;
  achievementsUnlocked: number;
  achievementsTotal: number;
  favoriteTrack?: FavoriteTrack;
  rating?: number;
  review?: string;
  playSessions: PlaySession[];
};

// Résultat brut du catalogue IGDB (Explorer, recherche) : pas encore un
// Game complet tant que l'utilisateur ne l'a pas ouvert (ce qui l'enregistre
// dans le store, voir useGame) — uniquement ce qu'IGDB renvoie déjà,
// aucun aller-retour supplémentaire nécessaire pour afficher une rangée.
export type CatalogGame = {
  id: string;
  title: string;
  platform: string;
};
