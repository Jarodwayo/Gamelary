import { slugify } from '@/lib/slug';
// Types importés du store (import de TYPE uniquement : effacé à la
// compilation, donc pas de cycle de modules à l'exécution) plutôt que
// redéfinis ici — un seul point de vérité pour la forme du store.
import type { StoredGame, StoreShape } from '@/lib/game-store';
import type { Achievement } from '@/types/game';

// Version de FORME du store, stockée dans le blob lui-même — pas dans la clé
// AsyncStorage (voir ARCHITECTURE.md §9.3). Historiquement, un changement de
// forme changeait la clé (`gamelary/game-store/v5`), ce qui revenait à
// effacer silencieusement la bibliothèque de l'utilisateur. La clé reste donc
// figée : son suffixe `/v5` n'est plus qu'un nom, la vraie version est ici.
export const STORE_VERSION = 6;

// Un id de succès manuel contenait un timestamp (`${gameId}:${slug}-${Date
// .now().toString(36)}`), donc deux appareils produisaient deux ids pour la
// même saisie — doublons garantis à la fusion. On le rend déterministe.
// `addAchievement` n'impose aucune unicité de nom : deux succès homonymes
// dans un même jeu existent réellement, et un id dérivé du seul nom les
// ferait fusionner (perte silencieuse d'une entrée). D'où le suffixe d'ordre
// à partir de la deuxième occurrence — stable tant que l'ordre l'est, ce qui
// est le cas puisque la liste n'est jamais réordonnée.
function normalizeAchievementIds(gameId: string, achievements: Achievement[]): Achievement[] {
  const seen = new Map<string, number>();

  return achievements.map((achievement) => {
    // Les succès importés de Steam ont déjà un id déterministe dérivé de
    // l'apiname : on n'y touche pas.
    if (achievement.id.startsWith(`${gameId}:steam:`)) return achievement;
    if (achievement.id.startsWith(`${gameId}:manual:`)) return achievement;

    const base = `${gameId}:manual:${slugify(achievement.name)}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);

    return { ...achievement, id: occurrence === 0 ? base : `${base}-${occurrence + 1}` };
  });
}

// Frontière système (voir game-store.tsx) : ce qui sort d'AsyncStorage n'est
// jamais garanti conforme. La migration est donc aussi le point de
// normalisation défensive — un champ absent ou corrompu ne doit jamais faire
// planter un écran plus loin.
function migrateGame(id: string, raw: Record<string, unknown>): StoredGame {
  const achievements = Array.isArray(raw.achievements) ? (raw.achievements as Achievement[]) : [];

  return {
    ...(raw as unknown as StoredGame),
    id: (raw.id as string) ?? id,
    achievements: normalizeAchievementIds(id, achievements),
    playSessions: Array.isArray(raw.playSessions)
      ? (raw.playSessions as { date: string; hours: number }[])
      : [],
  };
}

// Idempotente par construction : elle n'ajoute que des champs absents et ne
// réécrit un id de succès que s'il n'est pas déjà sous forme normalisée.
// Rejouer la migration sur un blob déjà migré doit rendre exactement le même
// objet (vérifié par un test dédié).
export function migrateStore(raw: unknown): StoreShape {
  const parsed = (raw ?? {}) as Partial<StoreShape>;

  const games: Record<string, StoredGame> = {};
  for (const [id, game] of Object.entries(parsed.games ?? {})) {
    games[id] = migrateGame(id, game as unknown as Record<string, unknown>);
  }

  return {
    version: STORE_VERSION,
    games,
    lists: parsed.lists ?? {},
    settings: parsed.settings ?? {},
  };
}
