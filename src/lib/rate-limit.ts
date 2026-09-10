// Limiteur par IP partagé par les routes serveur d'expo-router
// (`src/app/api/*+api.ts`). Extrait de games+api.ts, où il vivait en
// double emploi avec le besoin identique de cover+api.ts — voir
// ARCHITECTURE.md §7.1 : ces routes n'ont aucune authentification et
// consomment un quota tiers, donc rien n'empêche autrement un site
// tiers de le faire brûler par ses propres visiteurs.

type Bucket = { count: number; resetAt: number };

// Au-delà, on purge les entrées expirées. La borne existe parce que la
// clé est une IP fournie par l'extérieur : sans elle, une Map indexée par
// une valeur que l'appelant influence grossit indéfiniment dans un
// process serveur qui, lui, ne redémarre pas. Réglable uniquement pour
// que le test puisse déclencher la purge sans créer 10 000 entrées.
const DEFAULT_MAX_TRACKED_CLIENTS = 10_000;

// Le proxy le plus proche AJOUTE l'IP qu'il a réellement vue à la fin de
// X-Forwarded-For. Le dernier élément est donc le seul que l'on n'a pas
// laissé écrire à l'appelant ; le PREMIER est au contraire entièrement
// sous son contrôle (il lui suffit d'envoyer lui-même l'en-tête). Lire le
// premier revenait à offrir un seau neuf à chaque requête à qui prend la
// peine d'envoyer une valeur au hasard — donc à ne rien limiter du tout.
// Même hypothèse qu'`app.set('trust proxy', 1)` côté gamelary-api : un
// seul hop de confiance devant l'application.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return 'unknown';
  const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean);
  // Absent en dev (Metro) et sous Jest : repli sur un seul seau partagé,
  // qui limite quand même le total plutôt que de ne rien limiter.
  return hops[hops.length - 1] ?? 'unknown';
}

export type RateLimiter = {
  isLimited: (request: Request) => boolean;
  // Nombre de clients actuellement suivis. Exposé pour que la borne
  // mémoire soit vérifiable directement plutôt que devinée : un test qui
  // se contente d'observer qu'un compteur repart à zéro passerait tout
  // aussi bien sans purge (la fenêtre ayant de toute façon expiré).
  trackedClients: () => number;
};

// Une instance = un seau indépendant. Deux routes au profil d'usage très
// différent (voir cover+api.ts, qui part en éventail) ne doivent pas
// partager un compteur, sinon la plus bavarde épuise le quota de l'autre.
export function createRateLimiter({
  windowMs,
  max,
  maxTrackedClients = DEFAULT_MAX_TRACKED_CLIENTS,
}: {
  windowMs: number;
  max: number;
  maxTrackedClients?: number;
}): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    trackedClients: () => buckets.size,

    isLimited(request: Request): boolean {
      const now = Date.now();

      if (buckets.size >= maxTrackedClients) {
        for (const [key, bucket] of buckets) {
          if (bucket.resetAt <= now) buckets.delete(key);
        }
      }

      const ip = clientIp(request);
      const bucket = buckets.get(ip);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(ip, { count: 1, resetAt: now + windowMs });
        return false;
      }
      bucket.count += 1;
      return bucket.count > max;
    },
  };
}
