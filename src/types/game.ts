export type FavoriteTrack = {
  title: string;
  artist: string;
};

export type Game = {
  id: string;
  title: string;
  platform: string;
  achievementsUnlocked: number;
  achievementsTotal: number;
  favoriteTrack?: FavoriteTrack;
};
