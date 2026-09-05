import type { Game } from '@/types/game';

// Données de démonstration en attendant l'intégration IGDB / Steam / Spotify.
export const mockGames: Game[] = [
  {
    id: 'hollow-knight',
    title: 'Hollow Knight',
    platform: 'PC',
    achievementsUnlocked: 63,
    achievementsTotal: 63,
    favoriteTrack: { title: 'Dirtmouth', artist: 'Christopher Larkin' },
  },
  {
    id: 'elden-ring',
    title: 'Elden Ring',
    platform: 'PC',
    achievementsUnlocked: 28,
    achievementsTotal: 42,
  },
  {
    id: 'celeste',
    title: 'Celeste',
    platform: 'PC',
    achievementsUnlocked: 17,
    achievementsTotal: 17,
    favoriteTrack: { title: 'Reach for the Summit', artist: 'Lena Raine' },
  },
  {
    id: 'hades',
    title: 'Hades',
    platform: 'PC',
    achievementsUnlocked: 34,
    achievementsTotal: 49,
    favoriteTrack: { title: 'In the Blood', artist: 'Darren Korb' },
  },
  {
    id: 'zelda-botw',
    title: 'The Legend of Zelda: Breath of the Wild',
    platform: 'Switch',
    achievementsUnlocked: 0,
    achievementsTotal: 0,
  },
  {
    id: 'stardew-valley',
    title: 'Stardew Valley',
    platform: 'PC',
    achievementsUnlocked: 21,
    achievementsTotal: 40,
  },
];

export function getGameById(id: string): Game | undefined {
  return mockGames.find((game) => game.id === id);
}
