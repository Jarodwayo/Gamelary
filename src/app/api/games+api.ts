// Route serveur (voir cover+api.ts pour l'explication de la convention
// "+api.ts") : deux usages IGDB distincts sur le même endpoint.
// - ?title=  : recherche un jeu précis, renvoie son nom et sa plateforme
//   canoniques (catalogue vs données utilisateur : voir ARCHITECTURE.md §5.1).
// - ?section=: rangées de l'écran Explorer (voir ARCHITECTURE.md §5.6),
//   chacune sa propre requête apicalypse plutôt qu'un unique "top jeux" —
//   IGDB n'a pas de notion native de "tendance"/"recommandé", ce sont des
//   approximations documentées ci-dessous par section.

import { slugify } from '@/lib/slug';
import type { CatalogGame } from '@/types/game';

const LOOKUP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const gamesCache = new Map<string, { result: GameLookupResult; expiresAt: number }>();
const sectionCache = new Map<string, { result: CatalogGame[]; expiresAt: number }>();

const IGDB_BASE = 'https://api.igdb.com/v4';

type GameLookupResult = { title: string | null; platform: string | null };
type IgdbGame = { name: string; platforms?: { name: string }[] };

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
// - recommandé : pas de profil utilisateur/historique à exploiter (voir
//   ARCHITECTURE.md §9) -> approximation par "bien noté avec un volume
//   d'avis significatif", à remplacer par une vraie recommandation
//   personnalisée une fois un historique de jeu disponible.
function sectionQuery(section: string, nowSeconds: number): string | null {
  switch (section) {
    case 'recommended':
      return 'sort rating desc; where rating_count > 200; fields name,platforms.name; limit 10;';
    case 'trending':
      return (
        `sort total_rating_count desc; where first_release_date > ${nowSeconds - TWO_YEARS_SECONDS} ` +
        `& first_release_date <= ${nowSeconds} & total_rating_count > 30; fields name,platforms.name; limit 10;`
      );
    case 'new':
      return (
        `sort first_release_date desc; where first_release_date <= ${nowSeconds} & rating_count > 20; ` +
        'fields name,platforms.name; limit 10;'
      );
    case 'popular':
      return 'sort total_rating_count desc; where total_rating_count > 100; fields name,platforms.name; limit 10;';
    case 'anticipated':
      return (
        `sort hypes desc; where first_release_date > ${nowSeconds} & hypes > 0; ` +
        'fields name,platforms.name; limit 10;'
      );
    default:
      return null;
  }
}

async function fetchSectionFromIgdb(
  section: string,
  clientId: string,
  accessToken: string
): Promise<CatalogGame[]> {
  const query = sectionQuery(section, Math.floor(Date.now() / 1000));
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
    // slugify plutôt que l'id numérique IGDB : cohérent avec les ids en dur
    // de tracked-games.ts, lisible dans /library/:id. Limite connue : un jeu
    // découvert ici peut ne pas correspondre à un id tracked-games.ts dont
    // le slug diffère du titre IGDB (ex. zelda-botw) — voir ARCHITECTURE.md.
    id: slugify(game.name),
    title: game.name,
    platform: game.platforms?.[0]?.name ?? 'Plateforme inconnue',
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
    body: `search "${escapeApicalypseString(title)}"; fields name,platforms.name; limit 10;`,
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
  if (!bestMatch) return { title: null, platform: null };

  return {
    title: bestMatch.name,
    // Un même jeu a souvent plusieurs plateformes IGDB (PC, consoles...) ;
    // on affiche la première, cohérent avec le fait que l'app ne distingue
    // pas encore "sur quelle plateforme l'utilisateur possède le jeu".
    platform: bestMatch.platforms?.[0]?.name ?? null,
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
    const cached = sectionCache.get(section);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(cached.result);
    }
    try {
      const result = await fetchSectionFromIgdb(section, clientId, accessToken);
      sectionCache.set(section, { result, expiresAt: Date.now() + SECTION_CACHE_TTL_MS });
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
