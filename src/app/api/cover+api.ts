// Route API expo-router (convention "+api.ts") : ce fichier tourne UNIQUEMENT
// côté serveur (dev server Metro en local, ou le serveur Node une fois
// déployé — ex. EAS Hosting) et n'est jamais inclus dans le bundle client.
// C'est le seul endroit où la clé SteamGridDB peut vivre en toute sécurité :
// si on appelait SteamGridDB directement depuis le composant React Native,
// la clé finirait embarquée dans l'app et donc extractible par n'importe
// qui (voir ARCHITECTURE.md §7).
//
// Cache en mémoire : simple Map avec TTL, suffisant pour un seul process de
// dev. En production (plusieurs instances serverless, redémarrages), ça ne
// tient pas la route et il faudra un vrai cache partagé (Redis/KV) — voir
// ARCHITECTURE.md §8. Le TTL long (7 jours) reflète le fait qu'une jaquette
// ne change quasiment jamais pour un jeu donné.

import { createRateLimiter } from '@/lib/rate-limit';

// Même exposition que /api/games (aucune auth, quota tiers — voir
// ARCHITECTURE.md §7.1), donc même garde-fou. La limite est en revanche
// bien plus haute : un seul écran part en éventail sur cette route, une
// requête par jaquette distincte. Explorer en demande jusqu'à 50 d'un
// coup (5 rangées x 10 jeux) sur un cache client froid — une limite à 30
// casserait l'écran au lieu de protéger quoi que ce soit. 120/min laisse
// de la marge pour Explorer + Bibliothèque + les rangées du Profil dans
// la même minute.
const coverRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 });

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const coverCache = new Map<string, { url: string | null; expiresAt: number }>();

const STEAMGRIDDB_BASE = 'https://www.steamgriddb.com/api/v2';

type SteamGridDbSearchResult = { id: number; name: string };
type SteamGridDbGrid = { url: string; thumb: string };
type SteamGridDbGame = { id: number; name: string };

// Trois formats d'illustration du même jeu chez SteamGridDB, chacun son
// endpoint : `grid` (jaquette portrait, l'usage historique de cette route),
// `hero` (bandeau large) et `logo` (titre détouré sur fond transparent).
// Les deux derniers servent le mode "Arrière-plan" de la fiche jeu (voir le
// réglage "Affiche de la page titre", profile/settings-artwork.tsx).
export type ArtworkKind = 'grid' | 'hero' | 'logo';

const ARTWORK_ENDPOINT: Record<ArtworkKind, string> = {
  // Portrait 600x900 = format "grid" standard des bibliothèques de jeux
  // (Steam, GOG Galaxy...). nsfw/humor à false pour rester sur des visuels
  // officiels, quel que soit le format.
  grid: 'grids/game/{id}?dimensions=600x900&nsfw=false&humor=false',
  hero: 'heroes/game/{id}?dimensions=1920x620&nsfw=false&humor=false',
  // Pas de `dimensions` pour les logos : contrairement aux grids/heroes,
  // SteamGridDB n'y expose pas de tailles normalisées (chaque logo a son
  // ratio propre), un filtre sur une dimension précise ne renverrait donc
  // presque rien.
  logo: 'logos/game/{id}?nsfw=false&humor=false',
};

async function fetchArtworkUrl(
  steamGridDbId: number,
  headers: HeadersInit,
  kind: ArtworkKind
): Promise<string | null> {
  const path = ARTWORK_ENDPOINT[kind].replace('{id}', String(steamGridDbId));
  const response = await fetch(`${STEAMGRIDDB_BASE}/${path}`, { headers });
  if (!response.ok) {
    throw new Error(`SteamGridDB ${kind} a échoué (${response.status})`);
  }
  const json: { data: SteamGridDbGrid[] } = await response.json();
  return json.data[0]?.url ?? null;
}

// Correspondance exacte par app id Steam (résolu côté client depuis les
// external_games d'IGDB, voir games+api.ts) : SteamGridDB expose bien
// `/games/steam/{appid}` (vérifié en direct), contrairement à `/games/igdb/
// {id}` qui n'existe pas côté SteamGridDB malgré son nom — donc ce détour
// par Steam est le seul chemin fiable pour éviter la recherche floue.
async function fetchCoverBySteamAppId(
  steamAppId: number,
  headers: HeadersInit,
  kind: ArtworkKind
): Promise<string | null> {
  const gameResponse = await fetch(`${STEAMGRIDDB_BASE}/games/steam/${steamAppId}`, { headers });
  if (gameResponse.status === 404) return null;
  if (!gameResponse.ok) {
    throw new Error(`SteamGridDB games/steam a échoué (${gameResponse.status})`);
  }
  const gameJson: { success: boolean; data?: SteamGridDbGame } = await gameResponse.json();
  if (!gameJson.success || !gameJson.data) return null;
  return fetchArtworkUrl(gameJson.data.id, headers, kind);
}

// Repli par recherche floue sur le titre, pour les jeux sans app id Steam
// (exclusivités console) ou pas encore résolus côté IGDB.
async function fetchCoverByTitle(
  title: string,
  headers: HeadersInit,
  kind: ArtworkKind
): Promise<string | null> {
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
  return fetchArtworkUrl(bestMatch.id, headers, kind);
}

function parseArtworkKind(raw: string | null): ArtworkKind | null {
  if (!raw) return 'grid';
  return raw === 'grid' || raw === 'hero' || raw === 'logo' ? raw : null;
}

export async function GET(request: Request) {
  if (coverRateLimiter.isLimited(request)) {
    return Response.json({ error: 'Trop de requêtes, réessaie dans une minute' }, { status: 429 });
  }

  const params = new URL(request.url).searchParams;
  const title = params.get('title');
  const steamAppIdParam = params.get('steamAppId');
  const steamAppId = steamAppIdParam ? Number(steamAppIdParam) : null;
  const kind = parseArtworkKind(params.get('kind'));

  if (!title) {
    return Response.json({ error: 'Paramètre "title" requis' }, { status: 400 });
  }
  // Valeur inconnue rejetée plutôt que silencieusement ramenée à "grid" :
  // un appelant qui se trompe de format doit le voir, pas recevoir une
  // jaquette là où il attendait un bandeau.
  if (!kind) {
    return Response.json({ error: 'Paramètre "kind" invalide' }, { status: 400 });
  }

  // steamAppId (précis) l'emporte sur le titre dans la clé de cache : deux
  // titres différents partageant un app id (rare) doivent pointer vers la
  // même jaquette ; à défaut, on retombe sur le titre normalisé. Le format
  // fait partie de la clé : les trois illustrations d'un même jeu ne
  // doivent jamais se partager une entrée.
  const cacheKey =
    steamAppId && Number.isFinite(steamAppId)
      ? `${kind}:steam:${steamAppId}`
      : `${kind}:title:${title.trim().toLowerCase()}`;
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
        ? (await fetchCoverBySteamAppId(steamAppId, headers, kind)) ??
          (await fetchCoverByTitle(title, headers, kind))
        : await fetchCoverByTitle(title, headers, kind);
    coverCache.set(cacheKey, { url, expiresAt: Date.now() + CACHE_TTL_MS });
    return Response.json({ url });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 502 }
    );
  }
}
