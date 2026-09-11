// Route serveur (voir cover+api.ts pour l'explication de la convention
// "+api.ts") : deux usages IGDB distincts sur le même endpoint.
// - ?title=  : recherche un jeu précis, renvoie son nom et sa plateforme
//   canoniques (catalogue vs données utilisateur : voir ARCHITECTURE.md §6.1).
// - ?section=: rangées de l'écran Explorer (voir ARCHITECTURE.md §6.5),
//   chacune sa propre requête apicalypse plutôt qu'un unique "top jeux" —
//   IGDB n'a pas de notion native de "tendance"/"recommandé", ce sont des
//   approximations documentées ci-dessous par section.

import { resolveCatalogId } from '@/data/tracked-games';
import { createRateLimiter } from '@/lib/rate-limit';
import type { CatalogGame } from '@/types/game';

const LOOKUP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const gamesCache = new Map<string, { result: GameLookupResult; expiresAt: number }>();
const sectionCache = new Map<string, { result: CatalogGame[]; expiresAt: number }>();
const steamAppIdCache = new Map<number, { result: SteamAppIdLookupResult; expiresAt: number }>();

// CORS ouvert (voir ARCHITECTURE.md §7.1) + aucune auth ici (pas de compte,
// §9) : sans ça, n'importe quel site tiers peut faire consommer le quota
// IGDB de ce déploiement par ses propres visiteurs. Compteur en mémoire par
// IP (fenêtre glissante simple) — même limite que côté gamelary-api
// (§7.1, express-rate-limit) : suffisant pour protéger le quota d'une
// instance solo, pas un vrai rate limiting distribué (ne tiendrait pas la
// route derrière plusieurs instances serverless, voir §8 pour la même
// limite déjà documentée sur le cache).
// Une requête = un jeu recherché ou une rangée Explorer : pas d'éventail,
// donc la même limite que côté gamelary-api (voir §7.1).
const rateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

const IGDB_BASE = 'https://api.igdb.com/v4';

// Répétée à l'identique par les sept requêtes apicalypse de ce fichier
// (cinq sections Explorer, la recherche par titre, la recherche par app id
// Steam) : extraite pour que l'ajout d'un champ soit une seule édition —
// oublier une occurrence produirait des jeux sans ce champ sur une seule
// rangée d'Explorer, sans la moindre erreur pour le signaler.
// `id` est listé explicitement bien qu'IGDB le renvoie de toute façon
// (vérifié en direct : une requête dont le `fields` ne le mentionne pas le
// renvoie quand même) — on en dépend désormais pour l'identité canonique
// (voir ARCHITECTURE.md §9.2), autant que la dépendance soit déclarée.
const GAME_FIELDS =
  'id,name,summary,platforms.name,external_games.uid,external_games.external_game_source';

type GameLookupResult = {
  title: string | null;
  platform: string | null;
  steamAppId: number | null;
  // Identité canonique IGDB (voir ARCHITECTURE.md §9.2) : null quand aucun
  // jeu n'a été trouvé, jamais fabriqué depuis le titre.
  igdbId: number | null;
  // Résumé IGDB (voir CatalogGame.summary) : null quand aucun jeu n'a été
  // trouvé, ou si IGDB n'a pas de résumé pour ce jeu.
  summary: string | null;
};
type SteamAppIdLookupResult = GameLookupResult & { ambiguous: boolean };
type IgdbExternalGame = { uid: string; external_game_source: number };
type IgdbGame = {
  id: number;
  name: string;
  summary?: string;
  platforms?: { name: string }[];
  external_games?: IgdbExternalGame[];
};

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
      return `sort rating desc; where rating_count > 200${platformClause}; fields ${GAME_FIELDS}; limit 10;`;
    }
    case 'trending':
      return (
        `sort total_rating_count desc; where first_release_date > ${nowSeconds - TWO_YEARS_SECONDS} ` +
        `& first_release_date <= ${nowSeconds} & total_rating_count > 30; fields ${GAME_FIELDS}; limit 10;`
      );
    case 'new':
      return (
        `sort first_release_date desc; where first_release_date <= ${nowSeconds} & rating_count > 20; ` +
        `fields ${GAME_FIELDS}; limit 10;`
      );
    case 'popular':
      return `sort total_rating_count desc; where total_rating_count > 100; fields ${GAME_FIELDS}; limit 10;`;
    case 'anticipated':
      return (
        `sort hypes desc; where first_release_date > ${nowSeconds} & hypes > 0; ` +
        `fields ${GAME_FIELDS}; limit 10;`
      );
    default:
      return null;
  }
}

// Requête POST partagée par les trois modes de cet endpoint (section/title/
// steamAppId) : même en-têtes d'auth IGDB (Client-ID + Bearer, voir
// fetchGameFromIgdb pour le détail du flow Twitch), seul le corps
// apicalypse change. errorLabel identifie le mode dans le message d'erreur
// (utile pour distinguer les 502 dans les logs), sans jamais y inclure
// clientId/accessToken.
async function queryIgdbGames(
  body: string,
  clientId: string,
  accessToken: string,
  errorLabel: string
): Promise<IgdbGame[]> {
  const response = await fetch(`${IGDB_BASE}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain',
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`${errorLabel} a échoué (${response.status})`);
  }
  return response.json();
}

async function fetchSectionFromIgdb(
  section: string,
  clientId: string,
  accessToken: string,
  platformFilter?: string
): Promise<CatalogGame[]> {
  const query = sectionQuery(section, Math.floor(Date.now() / 1000), platformFilter);
  if (!query) throw new Error(`Section Explorer inconnue : "${section}"`);

  const games = await queryIgdbGames(query, clientId, accessToken, `IGDB games (${section})`);
  return games.map((game) => ({
    // resolveCatalogId plutôt que l'id numérique IGDB : cohérent avec les
    // ids en dur de tracked-games.ts (rejoint la même entrée si le jeu y est
    // déjà suivi, au lieu d'en créer un doublon), lisible dans /library/:id.
    id: resolveCatalogId(game.name),
    igdbId: game.id,
    title: game.name,
    platform: game.platforms?.[0]?.name ?? 'Plateforme inconnue',
    steamAppId: extractSteamAppId(game) ?? undefined,
    summary: game.summary,
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
  // platforms.name : expansion de relation apicalypse pour éviter un second
  // aller-retour qui ne renverrait que des ids de plateforme. limit 10 (pas
  // 1) : le classement par pertinence d'IGDB fait souvent remonter une
  // édition/bundle/spin-off avant le jeu de base (ex. "Elden Ring
  // Nightreign" avant "Elden Ring") — on a besoin de candidats
  // supplémentaires pour la désambiguïsation ci-dessous.
  const body = `search "${escapeApicalypseString(title)}"; fields ${GAME_FIELDS}; limit 10;`;
  const games = await queryIgdbGames(body, clientId, accessToken, 'IGDB games');
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
  if (!bestMatch)
    return { title: null, platform: null, steamAppId: null, igdbId: null, summary: null };

  return {
    title: bestMatch.name,
    // Un même jeu a souvent plusieurs plateformes IGDB (PC, consoles...) ;
    // on affiche la première, cohérent avec le fait que l'app ne distingue
    // pas encore "sur quelle plateforme l'utilisateur possède le jeu".
    platform: bestMatch.platforms?.[0]?.name ?? null,
    steamAppId: extractSteamAppId(bestMatch),
    igdbId: bestMatch.id,
    summary: bestMatch.summary ?? null,
  };
}

// Résolution inverse : à partir d'un app id Steam (bibliothèque Steam
// importée côté app, voir gamelary-api /api/steam/games), retrouve l'entrée
// IGDB correspondante — contrairement à fetchGameFromIgdb (recherche par
// titre), on filtre directement sur external_games.uid plutôt que de
// chercher par nom, donc pas besoin de désambiguïser par correspondance
// exacte de titre : le uid Steam identifie déjà un jeu précis en théorie.
async function fetchGameBySteamAppId(
  appid: number,
  clientId: string,
  accessToken: string
): Promise<SteamAppIdLookupResult> {
  const body = `where external_games.uid = "${appid}" & external_games.external_game_source = ${STEAM_EXTERNAL_GAME_SOURCE}; fields ${GAME_FIELDS}; limit 10;`;
  const games = await queryIgdbGames(body, clientId, accessToken, 'IGDB games (steamAppId)');

  // En théorie un app id Steam ne référence qu'un seul jeu, mais la donnée
  // IGDB n'est pas garantie cohérente (plusieurs fiches revendiquant le même
  // uid externe) : dédoublonné par nom avant de juger d'une vraie
  // ambiguïté, pour ne pas signaler une fausse ambiguïté sur des lignes
  // redondantes du même jeu.
  const distinctNames = new Set(games.map((game) => game.name.trim().toLowerCase()));

  if (distinctNames.size === 0) {
    return {
      title: null,
      platform: null,
      steamAppId: null,
      igdbId: null,
      summary: null,
      ambiguous: false,
    };
  }
  if (distinctNames.size > 1) {
    // Deux jeux IGDB différents revendiquent le même app id Steam : plutôt
    // que de deviner lequel est le bon (et risquer de créer la mauvaise
    // entrée dans la bibliothèque de l'utilisateur), on ne retourne rien —
    // pas pire qu'une correspondance absente pour l'appelant.
    return {
      title: null,
      platform: null,
      steamAppId: null,
      igdbId: null,
      summary: null,
      ambiguous: true,
    };
  }

  const bestMatch = games[0];
  return {
    title: bestMatch.name,
    platform: bestMatch.platforms?.[0]?.name ?? null,
    steamAppId: appid,
    igdbId: bestMatch.id,
    summary: bestMatch.summary ?? null,
    ambiguous: false,
  };
}

export async function GET(request: Request) {
  if (rateLimiter.isLimited(request)) {
    return Response.json({ error: 'Trop de requêtes, réessaie dans une minute' }, { status: 429 });
  }

  const params = new URL(request.url).searchParams;
  const section = params.get('section');
  const title = params.get('title');
  const steamAppIdParam = params.get('steamAppId');

  if (!section && !title && !steamAppIdParam) {
    return Response.json(
      { error: 'Paramètre "title", "section" ou "steamAppId" requis' },
      { status: 400 }
    );
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

  if (steamAppIdParam) {
    const appid = Number(steamAppIdParam);
    if (!Number.isInteger(appid) || appid <= 0) {
      return Response.json({ error: 'Paramètre "steamAppId" invalide' }, { status: 400 });
    }

    const cached = steamAppIdCache.get(appid);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(cached.result);
    }

    try {
      const result = await fetchGameBySteamAppId(appid, clientId, accessToken);
      steamAppIdCache.set(appid, { result, expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS });
      return Response.json(result);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Erreur inconnue' },
        { status: 502 }
      );
    }
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
