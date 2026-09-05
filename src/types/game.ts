export type FavoriteTrack = {
  title: string;
  artist: string;
};

// Forme volontairement proche de ce que renverront les vraies APIs :
// - id/title/platform : IGDB (catalogue multi-plateforme, jaquettes)
// - achievementsUnlocked/Total : Steam Web API (GetPlayerAchievements),
//   d'où le choix de stocker un compte brut plutôt qu'un pourcentage déjà
//   calculé — le pourcentage est dérivé à l'affichage (voir library/[id].tsx)
//   pour ne jamais désynchroniser les deux valeurs.
// - favoriteTrack : résultat d'une recherche Spotify choisi par l'utilisateur,
//   pas un stream — voir le commentaire dans library/[id].tsx.
export type Game = {
  id: string;
  title: string;
  platform: string;
  achievementsUnlocked: number;
  achievementsTotal: number;
  favoriteTrack?: FavoriteTrack;
};
