import type { Achievement } from '@/types/game';

// Politique de fusion §9.5 (ARCHITECTURE.md), restreinte cette session à
// `user_games` + `achievements` (voir sync-service.ts pour le reste :
// `play_sessions`/`lists`/`list_games` sont hors scope). Fonctions PURES
// uniquement ici — aucun appel réseau, aucun accès à AsyncStorage — c'est ce
// qui permet de simuler un vrai conflit à deux appareils (même jeu modifié
// différemment des deux côtés) et de vérifier la fusion sans mocker quoi que
// ce soit (voir __tests__/merge-policy.test.ts).

export type GameMatchKey = string;

// Identité canonique : l'id IGDB quand il est connu, le slug local sinon —
// mêmes deux index uniques partiels que côté schéma distant (voir
// supabase/migrations/20260910120000_initial_schema.sql). Préfixé pour
// qu'un igdbId numérique et un slug qui ressemblerait à un nombre ne
// collisionnent jamais dans la table de correspondance du service de sync.
export function gameMatchKey(igdbId: number | undefined, slug: string): GameMatchKey {
  return igdbId != null ? `igdb:${igdbId}` : `slug:${slug}`;
}

export type RemoteUserGameRow = {
  id: string;
  igdb_id: number | null;
  slug: string;
  title: string;
  platform: string | null;
  steam_app_id: number | null;
  in_library: boolean;
  stopped: boolean;
  rating: number | null;
  review: string | null;
  // Toujours renseigné côté distant (`not null default now()`, voir la
  // migration) : jamais besoin d'un repli ici, contrairement au local.
  updated_at: string;
};

type LocalGameSyncFields = {
  inLibrary: boolean;
  stopped: boolean;
  rating: number | undefined;
  review: string | undefined;
  updatedAt: number | undefined;
};

export type MergedGameFields = {
  inLibrary: boolean;
  stopped: boolean;
  rating: number | undefined;
  review: string | undefined;
  updatedAt: number | undefined;
};

// Fusionne les champs d'un jeu déjà présent DES DEUX côtés (le cas "aucune
// correspondance en face" est un simple envoi/import, géré par
// sync-service.ts, pas par cette fonction).
//
// `inLibrary`/`stopped` : union — jamais de retrait silencieux, un jeu
// ajouté ou marqué arrêté depuis un autre appareil le reste après fusion.
//
// `rating`/`review` : dernier-écrit-gagne sur `updatedAt`, MAIS seulement
// quand l'appareil local en a un. Un jeu jamais modifié localement
// (`updatedAt` absent — seedStore, ou catalogue simplement consulté via
// registerCatalogGame) n'a rien à arbitrer : sans horodatage des deux côtés,
// deviner un gagnant serait justement le "dernier arrivé écrase tout"
// que la politique §9.5 exclut explicitement. Ses rating/review restent
// alors inchangés tels quels, ni gagnants ni perdants.
export function mergeGameFields(local: LocalGameSyncFields, remote: RemoteUserGameRow): MergedGameFields {
  const inLibrary = local.inLibrary || remote.in_library;
  const stopped = local.stopped || remote.stopped;

  if (local.updatedAt == null) {
    return { inLibrary, stopped, rating: local.rating, review: local.review, updatedAt: local.updatedAt };
  }

  const remoteUpdatedAtMs = Date.parse(remote.updated_at);
  if (remoteUpdatedAtMs > local.updatedAt) {
    return {
      inLibrary,
      stopped,
      rating: remote.rating ?? undefined,
      review: remote.review ?? undefined,
      updatedAt: remoteUpdatedAtMs,
    };
  }
  return { inLibrary, stopped, rating: local.rating, review: local.review, updatedAt: local.updatedAt };
}

export type AchievementSource = 'manual' | 'steam';

type ParsedAchievementId = { gameId: string; source: AchievementSource; externalKey: string };

// Format local (voir game-store.tsx) : import Steam -> `${gameId}:steam:
// ${apiname}` (exactement deux ':'), saisie manuelle -> `${gameId}:
// ${slug-ts36}` (un seul ':' — slugify() ne produit jamais ':', voir
// slug.ts, et les ids de jeu non plus). La distinction tient donc au nombre
// de segments, pas à un marqueur explicite "manual" qui n'existe pas dans le
// format réel.
export function parseAchievementId(id: string): ParsedAchievementId | null {
  const parts = id.split(':');
  if (parts.length === 3 && parts[1] === 'steam') {
    return { gameId: parts[0], source: 'steam', externalKey: parts[2] };
  }
  if (parts.length === 2) {
    return { gameId: parts[0], source: 'manual', externalKey: parts[1] };
  }
  return null;
}

export function buildAchievementId(gameId: string, source: AchievementSource, externalKey: string): string {
  return source === 'steam' ? `${gameId}:steam:${externalKey}` : `${gameId}:${externalKey}`;
}

export type RemoteAchievementRow = {
  source: AchievementSource;
  external_key: string;
  name: string;
  unlocked: boolean;
};

export type AchievementMergeResult = {
  // État local final : même ordre que `local`, succès distants sans
  // correspondance ajoutés à la suite.
  achievements: Achievement[];
  // true si `achievements` diffère réellement de `local` (nouveau succès
  // importé, ou un `unlocked` qui passe à true) — permet à l'appelant de ne
  // jamais réécrire le store ni le distant pour un jeu où rien n'a changé.
  changed: boolean;
  // Lignes à écrire côté distant : succès locaux absents côté distant, ou
  // dont le `unlocked` fusionné diffère de celui déjà stocké.
  remoteUpserts: RemoteAchievementRow[];
};

// Union par (source, external_key), `unlocked` = OU LOGIQUE (§9.5) : un
// succès débloqué ne peut jamais redevenir verrouillé par la fusion, quel
// que soit le sens dans lequel elle circule.
export function mergeAchievements(
  gameId: string,
  local: Achievement[],
  remote: RemoteAchievementRow[]
): AchievementMergeResult {
  const remoteByKey = new Map(remote.map((row) => [`${row.source}:${row.external_key}`, row]));
  const seenKeys = new Set<string>();
  const achievements: Achievement[] = [];
  const remoteUpserts: RemoteAchievementRow[] = [];
  let changed = false;

  for (const achievement of local) {
    const parsed = parseAchievementId(achievement.id);
    if (!parsed) {
      // Id dans un format inattendu (ne devrait jamais arriver en pratique) :
      // laissé tel quel, jamais synchronisé plutôt que de deviner une clé.
      achievements.push(achievement);
      continue;
    }
    const key = `${parsed.source}:${parsed.externalKey}`;
    seenKeys.add(key);
    const remoteMatch = remoteByKey.get(key);
    const unlocked = achievement.unlocked || (remoteMatch?.unlocked ?? false);

    if (unlocked === achievement.unlocked) {
      achievements.push(achievement);
    } else {
      achievements.push({ ...achievement, unlocked });
      changed = true;
    }

    if (!remoteMatch || remoteMatch.unlocked !== unlocked) {
      remoteUpserts.push({ source: parsed.source, external_key: parsed.externalKey, name: achievement.name, unlocked });
    }
  }

  for (const remoteAchievement of remote) {
    const key = `${remoteAchievement.source}:${remoteAchievement.external_key}`;
    if (seenKeys.has(key)) continue;
    achievements.push({
      id: buildAchievementId(gameId, remoteAchievement.source, remoteAchievement.external_key),
      name: remoteAchievement.name,
      unlocked: remoteAchievement.unlocked,
    });
    changed = true;
  }

  return { achievements, changed, remoteUpserts };
}
