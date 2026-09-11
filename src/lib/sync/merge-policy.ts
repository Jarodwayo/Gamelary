import type { Achievement, PlaySession } from '@/types/game';

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

// --- play_sessions (§9.5) ---------------------------------------------
//
// Registre historique IMMUABLE : une session ne se modifie jamais après
// coup, elle s'ajoute seulement (y compris les sessions "correctrices" de
// setTotalHours, voir game-store.tsx). La fusion est donc une simple UNION
// par `clientKey`/`client_key` — jamais un rating/review où un même champ
// peut légitimement changer de valeur des deux côtés. Contrairement à
// mergeAchievements, aucun champ à arbitrer une fois la correspondance
// trouvée : une session déjà connue des deux côtés est, par construction,
// identique des deux côtés (elle décrit le même évènement passé).

export type RemotePlaySessionRow = {
  client_key: string;
  played_at: string;
  hours: number;
};

export type PlaySessionMergeResult = {
  // État local final : les sessions locales dans leur ordre d'origine,
  // suivies des sessions distantes sans correspondance locale.
  sessions: PlaySession[];
  // true si des sessions distantes ont été importées (jamais vrai pour un
  // simple envoi de sessions locales : rien ne change alors CHEZ SOI).
  changed: boolean;
  // Sessions locales absentes côté distant : à envoyer.
  remoteInserts: { client_key: string; played_at: string; hours: number }[];
};

export function mergePlaySessions(local: PlaySession[], remote: RemotePlaySessionRow[]): PlaySessionMergeResult {
  const remoteKeys = new Set(remote.map((row) => row.client_key));
  const localKeys = new Set(local.map((session) => session.clientKey));

  const remoteInserts = local
    .filter((session) => !remoteKeys.has(session.clientKey))
    .map((session) => ({ client_key: session.clientKey, played_at: session.date, hours: session.hours }));

  const imported: PlaySession[] = remote
    .filter((row) => !localKeys.has(row.client_key))
    .map((row) => ({ clientKey: row.client_key, date: row.played_at, hours: row.hours }));

  return {
    sessions: imported.length > 0 ? [...local, ...imported] : local,
    changed: imported.length > 0,
    remoteInserts,
  };
}

// --- listes : métadonnées (§9.5) ---------------------------------------
//
// Même principe exact que rating/review (mergeGameFields) : dernier-écrit-
// gagne sur `updatedAt`, jamais arbitré si le LOCAL n'en a pas — une liste
// jamais modifiée depuis l'introduction du champ (créée avant cette
// session, ou restaurée par une migration) n'a rien à arbitrer, deviner un
// gagnant serait justement le "dernier arrivé écrase tout" que la
// politique exclut. Les trois champs (nom, description, visibilité)
// basculent ENSEMBLE, comme rating/review : ils décrivent un seul état de
// metadata à un instant donné, pas trois valeurs indépendantes.

export type RemoteListRow = {
  name: string;
  description: string | null;
  hidden: boolean;
  updated_at: string;
};

type LocalListMetadata = {
  name: string;
  description: string | undefined;
  hidden: boolean | undefined;
  updatedAt: number | undefined;
};

export type MergedListMetadata = {
  name: string;
  description: string | undefined;
  hidden: boolean | undefined;
  updatedAt: number | undefined;
};

export function mergeListMetadata(local: LocalListMetadata, remote: RemoteListRow): MergedListMetadata {
  if (local.updatedAt == null) {
    return { name: local.name, description: local.description, hidden: local.hidden, updatedAt: local.updatedAt };
  }

  const remoteUpdatedAtMs = Date.parse(remote.updated_at);
  if (remoteUpdatedAtMs > local.updatedAt) {
    return {
      name: remote.name,
      description: remote.description ?? undefined,
      hidden: remote.hidden,
      updatedAt: remoteUpdatedAtMs,
    };
  }
  return { name: local.name, description: local.description, hidden: local.hidden, updatedAt: local.updatedAt };
}

// --- listes : appartenance des jeux (§9.5) ------------------------------
//
// Une simple union de lignes ne peut pas représenter un RETRAIT (voir
// ARCHITECTURE.md §9.5, demande explicite) : sans marqueur, un jeu retiré
// d'une liste sur un appareil reviendrait dès la synchro suivante tant que
// l'autre appareil ne l'a pas retiré lui aussi. Chaque côté connaît donc
// CHAQUE jeu dans l'un de trois états : actif, retiré (tombstone), ou
// jamais vu. Un jeu jamais vu d'un côté n'entre en conflit avec rien
// (union pure, comme achievements) ; actif d'un côté et retiré de l'autre
// EST un vrai conflit, arbitré par `updatedAt` — gated sur sa présence côté
// LOCAL, même garde que mergeListMetadata/mergeGameFields.
export type LocalListMembership = { removed?: boolean; updatedAt?: number };

// `gameId` est déjà résolu par l'appelant (sync-service.ts, impur) depuis
// `user_game_id` (uuid distant) vers l'id local — cette fonction, pure,
// raisonne uniquement en identité locale, comme toutes les autres ici.
export type RemoteListMembershipRow = {
  gameId: string;
  removedAt: string | null;
  updatedAt: string;
};

export type ListMembershipMergeResult = {
  // Membres actifs finaux (remplace StoredList.gameIds tel quel).
  gameIds: string[];
  // Remplace StoredList.memberships tel quel — jamais fusionné champ par
  // champ par l'appelant, un gameId absent d'ici doit rester absent.
  memberships: Record<string, LocalListMembership>;
  changed: boolean;
  // Écritures distantes nécessaires (nouvelles lignes, ou correction d'un
  // état distant que le local vient de faire perdre l'arbitrage).
  remoteUpserts: { gameId: string; removed: boolean }[];
};

export function mergeListMembership(
  localGameIds: string[],
  localMemberships: Record<string, LocalListMembership>,
  remote: RemoteListMembershipRow[]
): ListMembershipMergeResult {
  const localActive = new Set(localGameIds);
  const remoteByGameId = new Map(remote.map((row) => [row.gameId, row]));
  const allGameIds = new Set<string>([...localActive, ...Object.keys(localMemberships), ...remote.map((r) => r.gameId)]);

  const nextActive = new Set<string>();
  const nextMemberships: Record<string, LocalListMembership> = {};
  const remoteUpserts: { gameId: string; removed: boolean }[] = [];
  let changed = false;

  for (const gameId of allGameIds) {
    const localMembership = localMemberships[gameId];
    const localKnown = localActive.has(gameId) || localMembership !== undefined;
    const localRemoved = localMembership?.removed === true;
    const localUpdatedAt = localMembership?.updatedAt;

    const remoteRow = remoteByGameId.get(gameId);
    const remoteKnown = remoteRow !== undefined;
    const remoteRemoved = remoteRow?.removedAt != null;
    const remoteUpdatedAtMs = remoteRow ? Date.parse(remoteRow.updatedAt) : undefined;

    let finalRemoved: boolean;
    let finalMembership: LocalListMembership;
    let needsRemoteWrite = false;

    if (!remoteKnown) {
      // Connu seulement localement : rien à fusionner, première écriture
      // distante (nouvelle ligne, ou tombstone jamais encore envoyé).
      finalRemoved = localRemoved;
      finalMembership = localMembership ?? {};
      needsRemoteWrite = true;
    } else if (!localKnown) {
      // Connu seulement à distance : import pur, une vraie union.
      finalRemoved = remoteRemoved;
      finalMembership = { removed: remoteRemoved || undefined, updatedAt: remoteUpdatedAtMs };
      changed = true;
    } else if (localRemoved === remoteRemoved) {
      // Les deux côtés s'accordent : rien à arbitrer.
      finalRemoved = localRemoved;
      finalMembership = localMembership ?? {};
    } else if (localUpdatedAt == null) {
      // Vrai conflit (actif d'un côté, retiré de l'autre), mais le LOCAL
      // n'a pas d'horodatage pour trancher : on ne devine jamais un
      // gagnant — ni le local ni le distant ne bougent (même garde que
      // mergeGameFields sur rating/review).
      finalRemoved = localRemoved;
      finalMembership = localMembership ?? {};
    } else if (remoteUpdatedAtMs! > localUpdatedAt) {
      finalRemoved = remoteRemoved;
      finalMembership = { removed: remoteRemoved || undefined, updatedAt: remoteUpdatedAtMs };
      changed = true;
    } else {
      // Vrai conflit tranché en faveur du LOCAL (plus récent) : le distant
      // doit être corrigé pour refléter ce verdict.
      finalRemoved = localRemoved;
      finalMembership = localMembership ?? {};
      needsRemoteWrite = true;
    }

    if (!finalRemoved) nextActive.add(gameId);
    if (Object.keys(finalMembership).length > 0) nextMemberships[gameId] = finalMembership;
    if (needsRemoteWrite) remoteUpserts.push({ gameId, removed: finalRemoved });
  }

  return { gameIds: [...nextActive], memberships: nextMemberships, changed, remoteUpserts };
}
