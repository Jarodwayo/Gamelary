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

// En l'absence d'API succès réelle (Steam Web API, voir ARCHITECTURE.md
// §6.3), l'utilisateur alimente lui-même sa liste de succès nommés et les
// coche au fur et à mesure — plutôt qu'un simple ratio "unlocked/total" qui
// ne dit pas CE QUI a été débloqué.
export type Achievement = {
  id: string;
  name: string;
  unlocked: boolean;
};

// Type composite assemblé par le hook useGame (src/hooks/use-game.ts) à
// partir de plusieurs sources, jamais stocké tel quel :
// - id/title/platform : catalogue IGDB (voir ARCHITECTURE.md §6.1), avec
//   title/platform en repli tant qu'IGDB n'a pas répondu ou n'a pas trouvé
//   le jeu.
// - achievements : liste persistée par game-store.tsx (voir ARCHITECTURE.md
//   §6.6) ; achievementsUnlocked/Total sont dérivés de cette liste (jamais
//   stockés séparément, pour ne jamais désynchroniser les deux).
// - favoriteTrack : à terme résultat d'une recherche Spotify choisi par
//   l'utilisateur (encore mocké), pas un stream — voir le commentaire dans
//   library/[id].tsx.
// - inLibrary/stopped/rating/review/playSessions : état propre à
//   l'utilisateur, persisté localement par src/lib/game-store.tsx. Un jeu
//   peut exister (vu dans Explorer, ajouté à une liste) sans être dans la
//   bibliothèque suivie — d'où inLibrary distinct de la simple présence de
//   l'id dans le store.
export type Game = {
  id: string;
  title: string;
  platform: string;
  inLibrary: boolean;
  stopped: boolean;
  achievements: Achievement[];
  achievementsUnlocked: number;
  achievementsTotal: number;
  favoriteTrack?: FavoriteTrack;
  // 0-20 (voir library/[id].tsx) : note personnelle, pas une moyenne
  // communautaire — pas besoin de décimales, contrairement à un agrégat.
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
