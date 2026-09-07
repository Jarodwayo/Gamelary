import type { FavoriteTrack } from '@/types/game';

export type SeedAchievement = { name: string; unlocked: boolean };

// Bibliothèque personnelle de l'utilisateur : quels jeux il suit, et les
// données qui n'existent que localement (succès, morceau préféré). Reste en
// dur ici en l'absence de compte utilisateur/backend de persistance (voir
// ARCHITECTURE.md §10) — seul le catalogue (titre/plateforme) vient
// réellement d'IGDB, via `igdbTitle` et le hook `useGame`
// (src/hooks/use-game.ts). N'est lu qu'une fois, pour amorcer
// src/lib/game-store.tsx au tout premier lancement — voir ce fichier pour
// l'état réellement mutable/persisté (succès cochés, heures, notes...).
// zelda-botw illustre volontairement le cas "aucun succès tracké" (jeu
// Switch, pas de succès Steam) pour tester l'état "Aucun succès suivi" de
// la fiche jeu plutôt qu'un simple 0%.
export type TrackedGame = {
  id: string;
  igdbTitle: string;
  achievements: SeedAchievement[];
  favoriteTrack?: FavoriteTrack;
};

export const trackedGames: TrackedGame[] = [
  {
    id: 'hollow-knight',
    igdbTitle: 'Hollow Knight',
    achievements: [
      { name: 'Old Nail', unlocked: true },
      { name: 'Sharpened Nail', unlocked: true },
      { name: 'Channelled Nail', unlocked: true },
      { name: 'Coiled Nail', unlocked: true },
      { name: 'Pure Nail', unlocked: true },
      { name: 'Void Heart', unlocked: true },
      { name: 'Godmaster', unlocked: true },
      { name: 'Embrace the Void', unlocked: true },
    ],
    favoriteTrack: { title: 'Dirtmouth', artist: 'Christopher Larkin' },
  },
  {
    id: 'elden-ring',
    igdbTitle: 'Elden Ring',
    achievements: [
      { name: 'Age of Fracture', unlocked: true },
      { name: 'Age of Order', unlocked: true },
      { name: 'Age of Duskborn', unlocked: false },
      { name: 'Age of the Stars', unlocked: false },
      { name: 'Lord of Frenzied Flame', unlocked: false },
      { name: 'Elden Lord', unlocked: true },
      { name: 'Godslayer', unlocked: true },
      { name: 'Remembrance Collector', unlocked: true },
      { name: 'Great Rune Restored', unlocked: true },
      { name: 'Legendary Weapon Found', unlocked: false },
    ],
  },
  {
    id: 'celeste',
    igdbTitle: 'Celeste',
    achievements: [
      { name: 'Forsaken City', unlocked: true },
      { name: 'Old Site', unlocked: true },
      { name: 'Celestial Resort', unlocked: true },
      { name: 'Golden Ridge', unlocked: true },
      { name: 'Mirror Temple', unlocked: true },
      { name: 'Reflection', unlocked: true },
    ],
    favoriteTrack: { title: 'Reach for the Summit', artist: 'Lena Raine' },
  },
  {
    id: 'hades',
    igdbTitle: 'Hades',
    achievements: [
      { name: 'First Escape Attempt', unlocked: true },
      { name: 'Meet the Family', unlocked: true },
      { name: 'Weapon Aspect Unlocked', unlocked: true },
      { name: 'Prophecy Fulfilled', unlocked: true },
      { name: 'Pact of Punishment Raised', unlocked: true },
      { name: 'True Ending Achieved', unlocked: true },
      { name: 'Codex Complete', unlocked: false },
      { name: 'Keepsake Collector', unlocked: false },
      { name: 'Heat Run Cleared', unlocked: false },
    ],
    favoriteTrack: { title: 'In the Blood', artist: 'Darren Korb' },
  },
  {
    id: 'zelda-botw',
    igdbTitle: 'The Legend of Zelda: Breath of the Wild',
    achievements: [],
  },
  {
    id: 'stardew-valley',
    igdbTitle: 'Stardew Valley',
    achievements: [
      { name: 'Greenhorn', unlocked: true },
      { name: 'Cowpoke', unlocked: true },
      { name: 'Fisherman', unlocked: true },
      { name: 'Popular', unlocked: true },
      { name: 'Master Angler', unlocked: false },
      { name: 'Full Shipment', unlocked: false },
      { name: 'Polyculture', unlocked: false },
      { name: 'Craft Master', unlocked: false },
    ],
  },
];

export function getTrackedGameById(id: string): TrackedGame | undefined {
  return trackedGames.find((game) => game.id === id);
}
