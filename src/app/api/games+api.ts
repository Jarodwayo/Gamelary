// Route serveur (voir cover+api.ts pour l'explication de la convention
// "+api.ts") : deux usages IGDB distincts sur le même endpoint.
// - ?title=  : recherche un jeu précis, renvoie son nom et sa plateforme
//   canoniques (catalogue vs données utilisateur : voir ARCHITECTURE.md §5.1).
// - ?section=: rangées de l'écran Explorer (voir ARCHITECTURE.md §5.6),
//   chacune sa propre requête apicalypse plutôt qu'un unique "top jeux" —
//   IGDB n'a pas de notion native de "tendance"/"recommandé", ce sont des
//   approximations documentées ci-dessous par section.

import { resolveCatalogId } from '@/data/tracked-games';
import type { CatalogGame } from '@/types/game';

const LOOKUP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const gamesCache = new Map<string, { result: GameLookupResult; expiresAt: number }>();
const sectionCache = new Map<string, { result: CatalogGame[]; expiresAt: number }>();

const IGDB_BASE = 'https://api.igdb.com/v4';

type GameLookupResult = { title: string | null; platform: string | null; steamAppId: number | null };
type IgdbExternalGame = { uid: string; external_game_source: number };
type IgdbGame = { name: string; platforms?: { name: string }[]; external_games?: IgdbExternalGame[] };

// Source externe IGDB pour Steam (voir GET /external_game_sources) : fixe
// et documentée par IGDB, pas besoin de la résoudre dynamiquement à chaque
// requête.
const STEAM_EXTERNAL_GAME_SOURCE = 1;

// SteamGridDB n'expose pas de correspondance directe par id IGDB (vérifié
// en direct : `/games/igdb/{id}` renvoie systématiquement "Game not found",
// y compris pour des jeux très populaires) — en revanche `/games/steam/
// {appid}` fonctionne de façon fiable (voir cover+api.ts). Ce détour par
// external_games (uid Steam d'IGDB) est donc le vrai chemin exploitable
// pour une correspondance exacte, plutôt qu'une recherche par titre.
function extractSteamAppId(game: IgdbGame): number | null {
  const steamEntry = game.external_games?.find(
    (entry) => entry.external_game_source === STEAM_EXTERNAL_GAME_SOURCE
  );
  if (!steamEntry) return null;
  const appId = Number(steamEntry.uid);
  return Number.isFinite(appId) ? appId : null;
}

const DAY_SECONDS = 24 * 60 * 60;
const TWO_YEARS_SECONDS = 2 * 365 * DAY_SECONDS;

// Requêtes apicalypse par section, testées en direct contre IGDB avant
// intégration (résultats pertinents et non vides) :
// - populaire : total_rating_count = volume d'avis agrégés, meilleur proxy
//   IGDB de la popularité "toutes périodes" que rating seul (qui favorise
//   les jeux avec très peu d'avis mais tous excellents).
// - nouveaux : sortis (first_release_date <= maintenant), rating_count > 20
//   pour écarter les sorties trop confidentielles.
// - tendances : sortis dans les 2 dernières années, triés par
//   total_rating_count : "populaire en ce moment" plutôt que "populaire
//   depuis toujours" (populaire) ou "vient de sortir" (nouveaux).
// - attendus : first_release_date dans le futur, triés par hypes (nombre
//   de personnes ayant marqué leur attente sur IGDB/Twitter) — le champ
//   IGDB conçu pour exactement ce classement.
// - recommandé : pas de compte/historique serveur (voir ARCHITECTURE.md
//   §9), mais le client connaît la plateforme la plus jouée de
//   l'utilisateur (bibliothèque locale, voir use-explore.ts) et la transmet
//   en `platform` : filtre "bien noté avec un volume d'avis significatif"
//   sur CETTE plateforme plutôt qu'un classement générique identique pour
//   tout le monde. Repli sur le classement générique si aucune plateforme
//   n'est fournie (bibliothèque vide, première utilisation).
function sectionQuery(section: string, nowSeconds: number, platformFilter?: string): string | null {
  switch (section) {
    case 'recommended': {
      const platformClause = platformFilter
        ? ` & platforms.name = "${escapeApicalypseString(platformFilter)}"`
        : '';
      return `sort rating desc; where rating_count > 200${platformClause}; fields name,platforms.name,external_games.uid,external_games.external_game_source; limit 10;`;
    }
    case 'trending':
      return (
        `sort total_rating_count desc; where first_release_date > ${nowSeconds - TWO_YEARS_SECONDS} ` +
        `& first_release_date <= ${nowSeconds} & total_rating_count > 30; fields name,platforms.name,external_games.uid,external_games.external_game_source; limit 10;`
      );
    case 'new':
      return (
        `sort first_release_date desc; where first_release_date <= ${nowSeconds} & rating_count > 20; ` +
        'fields name,platforms.name,external_games.uid,external_games.external_game_source; limit 10;'
      );
    case 'popular':
      return 'sort total_rating_count desc; where total_rating_count > 100; fields name,platforms.name,external_games.uid,external_games.external_game_source; limit 10;';
    case 'anticipated':
      return (
        `sort hypes desc; where first_release_date > ${nowSeconds} & hypes > 0; ` +
        'fields name,platforms.name,external_games.uid,external_games.external_game_source; limit 10;'
      );
    default:
      return null;
  }
}

async function fetchSectionFromIgdb(
  section: string,
  clientId: string,
  accessToken: string,
  platformFilter?: string
): Promise<CatalogGame[]> {
  const query = sectionQuery(section, Math.floor(Date.now() / 1000), platformFilter);
  if (!query) throw new Error(`Section Explorer inconnue : "${section}"`);

  const response = await fetch(`${IGDB_BASE}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain',
    },
    body: query,
  });
  if (!response.ok) {
    throw new Error(`IGDB games (${section}) a échoué (${response.status})`);
  }

  const games: IgdbGame[] = await response.json();
  return games.map((game) => ({
    // resolveCatalogId plutôt que l'id numérique IGDB : cohérent avec les
    // ids en dur de tracked-games.ts (rejoint la même entrée si le jeu y est
    // déjà suivi, au lieu d'en créer un doublon), lisible dans /library/:id.
    id: resolveCatalogId(game.name),
    title: game.name,
    platform: game.platforms?.[0]?.name ?? 'Plateforme inconnue',
    steamAppId: extractSteamAppId(game) ?? undefined,
  }));
}

function escapeApicalypseString(value: string): string {
  // Le body IGDB est écrit dans le mini-langage de requête "apicalypse", où
  // le titre recherché est injecté dans une chaîne entre guillemets : un
  // titre contenant un guillemet casserait la requête (voire changerait sa
  // sémantique) sans cet échappement.
  return value.replace(/"/g, '\\"');
}

async function fetchGameFromIgdb(
  title: string,
  clientId: string,
  accessToken: string
): Promise<GameLookupResult> {
  // IGDB (auth Twitch "Client Credentials") exige les deux en-têtes : le
  // Client-ID identifie l'application, le Bearer est le token d'accès
  // obtenu séparément via ce flow. Contrairement à SteamGridDB, ce token
  // n'est pas permanent (durée de vie ~60 jours côté Twitch) : on le stocke
  // tel quel dans IGDB_ACCESS_TOKEN plutôt que de refaire l'échange
  // client_id/client_secret à chaque appel, donc il faudra un renouvellement
  // périodique (job planifié) une fois en production — voir ARCHITECTURE.md.
  const response = await fetch(`${IGDB_BASE}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain',
    },
    // platforms.name : expansion de relation apicalypse pour éviter un
    // second aller-retour qui ne renverrait que des ids de plateforme.
    // limit 10 (pas 1) : le classement par pertinence d'IGDB fait souvent
    // remonter une édition/bundle/spin-off avant le jeu de base (ex.
    // "Elden Ring Nightreign" avant "Elden Ring") — on a besoin de
    // candidats supplémentaires pour la désambiguïsation ci-dessous.
    body: `search "${escapeApicalypseString(title)}"; fields name,platforms.name,external_games.uid,external_games.external_game_source; limit 10;`,
  });
  if (!response.ok) {
    throw new Error(`IGDB games a échoué (${response.status})`);
  }

  const games: IgdbGame[] = await response.json();
  // Le champ `category` IGDB (main_game/dlc/bundle...) n'est pas fiable pour
  // filtrer : de nombreuses fiches (y compris le jeu de base) ne l'ont pas
  // renseigné. Un match exact sur le nom (recherche insensible à la casse
  // dans nos titres suivis) est un signal bien plus robuste pour retrouver
  // le jeu de base parmi les éditions/bundles/spin-offs. On ne retombe sur
  // le premier résultat du ranking IGDB que si aucun titre ne correspond
  // exactement — cas des jeux dont le nom IGDB diffère légèrement du nôtre.
  const normalizedTitle = title.trim().toLowerCase();
  const bestMatch =
    games.find((game) => game.name.trim().toLowerCase() === normalizedTitle) ?? games[0];
  if (!bestMatch) return { title: null, platform: null, steamAppId: null };

  return {
    title: bestMatch.name,
    // Un même jeu a souvent plusieurs plateformes IGDB (PC, consoles...) ;
    // on affiche la première, cohérent avec le fait que l'app ne distingue
    // pas encore "sur quelle plateforme l'utilisateur possède le jeu".
    platform: bestMatch.platforms?.[0]?.name ?? null,
    steamAppId: extractSteamAppId(bestMatch),
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const section = params.get('section');
  const title = params.get('title');

  if (!section && !title) {
    return Response.json({ error: 'Paramètre "title" ou "section" requis' }, { status: 400 });
  }

  const clientId = process.env.IGDB_CLIENT_ID;
  const accessToken = process.env.IGDB_ACCESS_TOKEN;
  if (!clientId || !accessToken) {
    // Ne doit arriver qu'en dehors de cet environnement de dev (où les
    // identifiants sont injectés par le proxy réseau, jamais exposés en
    // variable d'environnement) : sur un vrai déploiement, IGDB_CLIENT_ID et
    // IGDB_ACCESS_TOKEN doivent être configurés comme secrets serveur.
    return Response.json(
      { error: 'IGDB_CLIENT_ID/IGDB_ACCESS_TOKEN non configurées côté serveur' },
      { status: 500 }
    );
  }

  if (section) {
    // platform ne sert qu'à personnaliser "recommended" (voir sectionQuery)
    // mais fait partie de la clé de cache dans tous les cas : un paramètre
    // ignoré ne doit jamais partager son entrée de cache avec un autre appel
    // qui l'aurait omis.
    const platform = params.get('platform') ?? undefined;
    const cacheKey = `${section}:${platform ?? ''}`;
    const cached = sectionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(cached.result);
    }
    try {
      let result = await fetchSectionFromIgdb(section, clientId, accessToken, platform);
      // Filtre plateforme trop restrictif (peu de jeux bien notés dessus) ->
      // repli sur le classement générique plutôt que de renvoyer une
      // rangée Explorer vide.
      if (result.length === 0 && platform) {
        result = await fetchSectionFromIgdb(section, clientId, accessToken);
      }
      sectionCache.set(cacheKey, { result, expiresAt: Date.now() + SECTION_CACHE_TTL_MS });
      return Response.json(result);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Erreur inconnue' },
        { status: 502 }
      );
    }
  }

  if (!title) {
    return Response.json({ error: 'Paramètre "title" requis' }, { status: 400 });
  }

  const cacheKey = title.trim().toLowerCase();
  const cached = gamesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.result);
  }

  try {
    const result = await fetchGameFromIgdb(title, clientId, accessToken);
    gamesCache.set(cacheKey, { result, expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 502 }
    );
  }
}
