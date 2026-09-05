// Route serveur (voir cover+api.ts pour l'explication de la convention
// "+api.ts") : recherche un jeu par titre sur IGDB et renvoie son nom et sa
// plateforme "canoniques". Sépare le catalogue (IGDB, ce fichier) des
// données propres à l'utilisateur (succès, musique préférée — voir
// src/data/tracked-games.ts) : voir ARCHITECTURE.md §5.1.

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const gamesCache = new Map<string, { result: GameLookupResult; expiresAt: number }>();

const IGDB_BASE = 'https://api.igdb.com/v4';

type GameLookupResult = { title: string | null; platform: string | null };
type IgdbGame = { name: string; platforms?: { name: string }[] };

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
  const title = new URL(request.url).searchParams.get('title');
  if (!title) {
    return Response.json({ error: 'Paramètre "title" requis' }, { status: 400 });
  }

  const cacheKey = title.trim().toLowerCase();
  const cached = gamesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.result);
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

  try {
    const result = await fetchGameFromIgdb(title, clientId, accessToken);
    gamesCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 502 }
    );
  }
}
