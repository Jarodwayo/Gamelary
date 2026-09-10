import { slugify } from '@/lib/slug';

export type SeedAchievement = { name: string; unlocked: boolean };
export type SeedTrack = { title: string; artist: string };

// Id déterministe (pas de composant temporel, contrairement aux succès
// ajoutés à la main) : les pistes viennent toutes du seed, jamais ajoutées
// dynamiquement, donc pas besoin d'unicité au fil du temps — juste stable
// pour que game-store.tsx (résolution du favori par défaut) et useGame
// (construction de la liste) calculent toujours le même id pour un même
// titre.
export function trackId(gameId: string, title: string): string {
  return `${gameId}:${slugify(title)}`;
}

// Catalogue curaté de succès nommés et de bande originale pour des jeux
// connus à l'avance — jamais préchargé dans la bibliothèque d'un
// utilisateur (voir game-store.tsx : un compte se connecte sur une
// bibliothèque vide, il n'y a plus de mode démo à amorcer), seulement
// consulté quand l'utilisateur ajoute lui-même l'un de ces jeux (Explorer,
// recherche, ou résolution inverse Steam) : `useGame`
// (src/hooks/use-game.ts) y pioche les succès/pistes pré-remplis pour ces
// titres précis, le reste du catalogue venant réellement d'IGDB via
// `igdbTitle`. zelda-botw illustre volontairement le cas "aucun succès
// tracké" (jeu Switch, pas de succès Steam) pour tester l'état "Aucun
// succès suivi" de la fiche jeu plutôt qu'un simple 0%.
export type TrackedGame = {
  id: string;
  igdbTitle: string;
  achievements: SeedAchievement[];
  tracks: SeedTrack[];
  // Doit correspondre exactement au `title` d'une entrée de `tracks` :
  // pré-sélectionne un favori par défaut (l'utilisateur peut en choisir un
  // autre depuis la fiche jeu). Absent = aucun favori choisi.
  favoriteTrackTitle?: string;
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
    tracks: [
      { title: 'Dirtmouth', artist: 'Christopher Larkin' },
      { title: 'Hollow Knight', artist: 'Christopher Larkin' },
      { title: 'City of Tears', artist: 'Christopher Larkin' },
      { title: 'Greenpath', artist: 'Christopher Larkin' },
      { title: 'Resting Grounds', artist: 'Christopher Larkin' },
      { title: "Grimm's Theme", artist: 'Christopher Larkin' },
      { title: 'Hornet', artist: 'Christopher Larkin' },
      { title: 'Radiance', artist: 'Christopher Larkin' },
    ],
    favoriteTrackTitle: 'Dirtmouth',
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
    tracks: [
      { title: 'Main Theme', artist: 'Yuka Kitamura' },
      { title: 'Great Runes', artist: 'Yuka Kitamura' },
      { title: 'Leyndell, Royal Capital', artist: 'Yuka Kitamura' },
      { title: 'Malenia, Blade of Miquella', artist: 'Yuka Kitamura' },
      { title: 'Radagon and the Elden Beast', artist: 'Yuka Kitamura' },
      { title: 'Godrick the Grafted', artist: 'Shoi Miyazawa' },
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
    tracks: [
      { title: 'Reach for the Summit', artist: 'Lena Raine' },
      { title: 'First Steps', artist: 'Lena Raine' },
      { title: 'Resurrections', artist: 'Lena Raine' },
      { title: 'Anxiety', artist: 'Lena Raine' },
      { title: 'Confronting Myself', artist: 'Lena Raine' },
      { title: 'Golden', artist: 'Lena Raine' },
    ],
    favoriteTrackTitle: 'Reach for the Summit',
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
    tracks: [
      { title: 'In the Blood', artist: 'Darren Korb' },
      { title: 'God of the Dead', artist: 'Darren Korb' },
      { title: 'The Unseen Ones', artist: 'Darren Korb' },
      { title: 'Lament of Orpheus', artist: 'Darren Korb' },
      { title: 'Rally the Sirens', artist: 'Darren Korb' },
      { title: 'Good Riddance', artist: 'Darren Korb' },
    ],
    favoriteTrackTitle: 'In the Blood',
  },
  {
    id: 'zelda-botw',
    igdbTitle: 'The Legend of Zelda: Breath of the Wild',
    achievements: [],
    tracks: [
      { title: 'Main Theme', artist: 'Manaka Kataoka' },
      { title: 'Hyrule Field', artist: 'Manaka Kataoka' },
      { title: 'Rito Village', artist: 'Manaka Kataoka' },
      { title: "Kass' Theme", artist: 'Manaka Kataoka' },
      { title: 'Gerudo Town', artist: 'Manaka Kataoka' },
      { title: "Zelda's Lament", artist: 'Manaka Kataoka' },
    ],
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
    tracks: [
      { title: 'Stardew Valley Overture', artist: 'ConcernedApe' },
      { title: 'Pelican Town', artist: 'ConcernedApe' },
      { title: 'Spring (The Valley Comes Alive)', artist: 'ConcernedApe' },
      { title: "It's Rainin' Cats and Dogs...", artist: 'ConcernedApe' },
      { title: "The Ocean's Dreams", artist: 'ConcernedApe' },
      { title: 'The Smell of Fall Air', artist: 'ConcernedApe' },
    ],
  },
  {
    id: 'the-witcher-3-wild-hunt',
    igdbTitle: 'The Witcher 3: Wild Hunt',
    achievements: [],
    tracks: [
      { title: 'The Trail', artist: 'Percival' },
      { title: 'Geralt of Rivia', artist: 'Marcin Przybyłowicz' },
      { title: 'Silver for Monsters', artist: 'Percival' },
      { title: 'Steel for Humans', artist: 'Percival' },
      { title: 'Ladies of the Wood', artist: 'Percival' },
    ],
    favoriteTrackTitle: 'The Trail',
  },
  {
    id: 'undertale',
    igdbTitle: 'Undertale',
    achievements: [],
    tracks: [
      { title: 'Once Upon a Time', artist: 'Toby Fox' },
      { title: 'Megalovania', artist: 'Toby Fox' },
      { title: 'Snowdin Town', artist: 'Toby Fox' },
      { title: 'His Theme', artist: 'Toby Fox' },
      { title: 'Hopes and Dreams', artist: 'Toby Fox' },
    ],
    favoriteTrackTitle: 'Megalovania',
  },
  {
    id: 'cuphead',
    igdbTitle: 'Cuphead',
    achievements: [],
    tracks: [
      { title: "Don't Deal with the Devil", artist: 'Kristofer Maddigan' },
      { title: 'Floral Fury', artist: 'Kristofer Maddigan' },
      { title: 'Fiery Frolic', artist: 'Kristofer Maddigan' },
      { title: "Threatenin' Zeppelin", artist: 'Kristofer Maddigan' },
    ],
  },
  {
    id: 'journey',
    igdbTitle: 'Journey',
    achievements: [],
    tracks: [
      { title: 'Nascence', artist: 'Austin Wintory' },
      { title: 'The Call', artist: 'Austin Wintory' },
      { title: 'Apotheosis', artist: 'Austin Wintory' },
      { title: 'I Was Born for This', artist: 'Austin Wintory' },
    ],
    favoriteTrackTitle: 'I Was Born for This',
  },
];

export function getTrackedGameById(id: string): TrackedGame | undefined {
  return trackedGames.find((game) => game.id === id);
}

// Point de vérité unique pour dériver l'id d'un jeu découvert via IGDB
// (rangées Explorer, recherche) — utilisé par games+api.ts et
// library/search.tsx plutôt que d'appeler slugify() séparément à chaque
// endroit. Certains ids de tracked-games.ts sont volontairement plus courts
// que le titre IGDB (ex. zelda-botw vs "The Legend of Zelda: Breath of the
// Wild") : sans cette correspondance par titre, le même jeu vu dans
// Explorer aurait fini sous un second id slugifié, dupliqué dans la
// bibliothèque (démo avec succès/pistes déjà seedées d'un côté, entrée vide
// de l'autre) au lieu de rejoindre l'entrée existante.
export function resolveCatalogId(title: string): string {
  const normalized = title.trim().toLowerCase();
  const match = trackedGames.find((game) => game.igdbTitle.toLowerCase() === normalized);
  return match ? match.id : slugify(title);
}
