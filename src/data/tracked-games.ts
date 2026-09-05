import type { FavoriteTrack } from '@/types/game';

// Bibliothèque personnelle de l'utilisateur : quels jeux il suit, et les
// données qui n'existent que localement (succès, morceau préféré). Reste en
// dur ici en l'absence de compte utilisateur/backend de persistance (voir
// ARCHITECTURE.md §9) — seul le catalogue (titre/plateforme) vient
// maintenant réellement d'IGDB, via `igdbTitle` et le hook `useGame`
// (src/hooks/use-game.ts) qui fait la jointure entre cette liste et
// /api/games. zelda-botw illustre volontairement le cas "0 succès trackés"
// (jeu Switch, pas de succès Steam) pour tester l'état "Aucun succès suivi"
// de la fiche jeu plutôt qu'un simple 0%.
export type TrackedGame = {
  id: string;
  igdbTitle: string;
  achievementsUnlocked: number;
  achievementsTotal: number;
  favoriteTrack?: FavoriteTrack;
};

export const trackedGames: TrackedGame[] = [
  {
    id: 'hollow-knight',
    igdbTitle: 'Hollow Knight',
    achievementsUnlocked: 63,
    achievementsTotal: 63,
    favoriteTrack: { title: 'Dirtmouth', artist: 'Christopher Larkin' },
  },
  {
    id: 'elden-ring',
    igdbTitle: 'Elden Ring',
    achievementsUnlocked: 28,
    achievementsTotal: 42,
  },
  {
    id: 'celeste',
    igdbTitle: 'Celeste',
    achievementsUnlocked: 17,
    achievementsTotal: 17,
    favoriteTrack: { title: 'Reach for the Summit', artist: 'Lena Raine' },
  },
  {
    id: 'hades',
    igdbTitle: 'Hades',
    achievementsUnlocked: 34,
    achievementsTotal: 49,
    favoriteTrack: { title: 'In the Blood', artist: 'Darren Korb' },
  },
  {
    id: 'zelda-botw',
    igdbTitle: 'The Legend of Zelda: Breath of the Wild',
    achievementsUnlocked: 0,
    achievementsTotal: 0,
  },
  {
    id: 'stardew-valley',
    igdbTitle: 'Stardew Valley',
    achievementsUnlocked: 21,
    achievementsTotal: 40,
  },
];

export function getTrackedGameById(id: string): TrackedGame | undefined {
  return trackedGames.find((game) => game.id === id);
}
