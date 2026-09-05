export type FavoriteTrack = {
  title: string;
  artist: string;
};

// Type composite assemblé par le hook useGame (src/hooks/use-game.ts) à
// partir de plusieurs sources, jamais stocké tel quel :
// - id/title/platform : catalogue IGDB (voir ARCHITECTURE.md §5.1), avec
//   title/platform en repli sur tracked-games.ts tant qu'IGDB n'a pas
//   répondu ou n'a pas trouvé le jeu.
// - achievementsUnlocked/Total : à terme Steam Web API (GetPlayerAchievements,
//   encore mocké dans tracked-games.ts), d'où le choix de stocker un compte
//   brut plutôt qu'un pourcentage déjà calculé — le pourcentage est dérivé à
//   l'affichage (voir library/[id].tsx) pour ne jamais désynchroniser les
//   deux valeurs.
// - favoriteTrack : à terme résultat d'une recherche Spotify choisi par
//   l'utilisateur (encore mocké), pas un stream — voir le commentaire dans
//   library/[id].tsx.
export type Game = {
  id: string;
  title: string;
  platform: string;
  achievementsUnlocked: number;
  achievementsTotal: number;
  favoriteTrack?: FavoriteTrack;
};
