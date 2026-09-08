// Route API expo-router (convention "+api.ts") : ce fichier tourne UNIQUEMENT
// côté serveur (dev server Metro en local, ou le serveur Node une fois
// déployé — ex. EAS Hosting) et n'est jamais inclus dans le bundle client.
// C'est le seul endroit où la clé SteamGridDB peut vivre en toute sécurité :
// si on appelait SteamGridDB directement depuis le composant React Native,
// la clé finirait embarquée dans l'app et donc extractible par n'importe
// qui (voir ARCHITECTURE.md §6).
//
// Cache en mémoire : simple Map avec TTL, suffisant pour un seul process de
// dev. En production (plusieurs instances serverless, redémarrages), ça ne
// tient pas la route et il faudra un vrai cache partagé (Redis/KV) — voir
// ARCHITECTURE.md §7. Le TTL long (7 jours) reflète le fait qu'une jaquette
// ne change quasiment jamais pour un jeu donné.

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const coverCache = new Map<string, { url: string | null; expiresAt: number }>();

const STEAMGRIDDB_BASE = 'https://www.steamgriddb.com/api/v2';

type SteamGridDbSearchResult = { id: number; name: string };
type SteamGridDbGrid = { url: string; thumb: string };
type SteamGridDbGame = { id: number; name: string };

async function fetchGridUrl(steamGridDbId: number, headers: HeadersInit): Promise<string | null> {
  // Format portrait 600x900 = le format "grid" standard des bibliothèques
  // de jeux (Steam, GOG Galaxy...), donc celui qu'on veut pour nos cartes
  // de jeu. nsfw/humor à false pour rester sur des jaquettes officielles.
  const gridsResponse = await fetch(
    `${STEAMGRIDDB_BASE}/grids/game/${steamGridDbId}?dimensions=600x900&nsfw=false&humor=false`,
    { headers }
  );
  if (!gridsResponse.ok) {
    throw new Error(`SteamGridDB grids a échoué (${gridsResponse.status})`);
  }
  const gridsJson: { data: SteamGridDbGrid[] } = await gridsResponse.json();
  return gridsJson.data[0]?.url ?? null;
}

// Correspondance exacte par app id Steam (résolu côté client depuis les
// external_games d'IGDB, voir games+api.ts) : SteamGridDB expose bien
// `/games/steam/{appid}` (vérifié en direct), contrairement à `/games/igdb/
// {id}` qui n'existe pas côté SteamGridDB malgré son nom — donc ce détour
// par Steam est le seul chemin fiable pour éviter la recherche floue.
async function fetchCoverBySteamAppId(steamAppId: number, headers: HeadersInit): Promise<string | null> {
  const gameResponse = await fetch(`${STEAMGRIDDB_BASE}/games/steam/${steamAppId}`, { headers });
  if (gameResponse.status === 404) return null;
  if (!gameResponse.ok) {
    throw new Error(`SteamGridDB games/steam a échoué (${gameResponse.status})`);
  }
  const gameJson: { success: boolean; data?: SteamGridDbGame } = await gameResponse.json();
  if (!gameJson.success || !gameJson.data) return null;
  return fetchGridUrl(gameJson.data.id, headers);
}

// Repli par recherche floue sur le titre, pour les jeux sans app id Steam
// (exclusivités console) ou pas encore résolus côté IGDB.
async function fetchCoverByTitle(title: string, headers: HeadersInit): Promise<string | null> {
  const searchResponse = await fetch(
    `${STEAMGRIDDB_BASE}/search/autocomplete/${encodeURIComponent(title)}`,
    { headers }
  );
  if (!searchResponse.ok) {
    throw new Error(`SteamGridDB search a échoué (${searchResponse.status})`);
  }
  const searchJson: { data: SteamGridDbSearchResult[] } = await searchResponse.json();
  // On prend le premier résultat : l'autocomplete de SteamGridDB trie déjà
  // par pertinence. Limite connue : pas de désambiguïsation (ex. "Hollow" vs
  // "Hollow Knight") — d'où la préférence pour fetchCoverBySteamAppId quand
  // l'app id Steam est disponible.
  const bestMatch = searchJson.data[0];
  if (!bestMatch) return null;
  return fetchGridUrl(bestMatch.id, headers);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = params.get('title');
  const steamAppIdParam = params.get('steamAppId');
  const steamAppId = steamAppIdParam ? Number(steamAppIdParam) : null;

  if (!title) {
    return Response.json({ error: 'Paramètre "title" requis' }, { status: 400 });
  }

  // steamAppId (précis) l'emporte sur le titre dans la clé de cache : deux
  // titres différents partageant un app id (rare) doivent pointer vers la
  // même jaquette ; à défaut, on retombe sur le titre normalisé.
  const cacheKey =
    steamAppId && Number.isFinite(steamAppId) ? `steam:${steamAppId}` : `title:${title.trim().toLowerCase()}`;
  const cached = coverCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json({ url: cached.url });
  }

  const apiKey = process.env.STEAMGRIDDB_API_KEY;
  if (!apiKey) {
    // Ne doit arriver qu'en dehors de cet environnement de dev (où la clé
    // est injectée par le proxy réseau, jamais exposée en variable
    // d'environnement) : sur un vrai déploiement, STEAMGRIDDB_API_KEY doit
    // être configurée comme secret serveur.
    return Response.json({ error: 'STEAMGRIDDB_API_KEY non configurée côté serveur' }, { status: 500 });
  }
  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    const url =
      steamAppId && Number.isFinite(steamAppId)
        ? (await fetchCoverBySteamAppId(steamAppId, headers)) ?? (await fetchCoverByTitle(title, headers))
        : await fetchCoverByTitle(title, headers);
    coverCache.set(cacheKey, { url, expiresAt: Date.now() + CACHE_TTL_MS });
    return Response.json({ url });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 502 }
    );
  }
}
