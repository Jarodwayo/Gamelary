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

async function fetchCoverFromSteamGridDb(title: string, apiKey: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${apiKey}` };

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
  // "Hollow Knight") — un vrai matching passerait par l'id IGDB une fois
  // cette intégration en place.
  const bestMatch = searchJson.data[0];
  if (!bestMatch) return null;

  // Format portrait 600x900 = le format "grid" standard des bibliothèques
  // de jeux (Steam, GOG Galaxy...), donc celui qu'on veut pour nos cartes
  // de jeu. nsfw/humor à false pour rester sur des jaquettes officielles.
  const gridsResponse = await fetch(
    `${STEAMGRIDDB_BASE}/grids/game/${bestMatch.id}?dimensions=600x900&nsfw=false&humor=false`,
    { headers }
  );
  if (!gridsResponse.ok) {
    throw new Error(`SteamGridDB grids a échoué (${gridsResponse.status})`);
  }
  const gridsJson: { data: SteamGridDbGrid[] } = await gridsResponse.json();
  return gridsJson.data[0]?.url ?? null;
}

export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get('title');
  if (!title) {
    return Response.json({ error: 'Paramètre "title" requis' }, { status: 400 });
  }

  const cacheKey = title.trim().toLowerCase();
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

  try {
    const url = await fetchCoverFromSteamGridDb(title, apiKey);
    coverCache.set(cacheKey, { url, expiresAt: Date.now() + CACHE_TTL_MS });
    return Response.json({ url });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 502 }
    );
  }
}
