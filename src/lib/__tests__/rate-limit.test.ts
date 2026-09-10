import { clientIp, createRateLimiter } from '../rate-limit';

function req(forwardedFor?: string): Request {
  return new Request('http://localhost/api/games?title=x', {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  });
}

test('bloque au-delà du quota, pour une même IP', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });

  expect([1, 2, 3].map(() => limiter.isLimited(req('9.9.9.9')))).toEqual([false, false, false]);
  expect(limiter.isLimited(req('9.9.9.9'))).toBe(true);
});

test('deux IP distinctes ont chacune leur seau', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });

  limiter.isLimited(req('1.1.1.1'));
  limiter.isLimited(req('1.1.1.1'));
  expect(limiter.isLimited(req('1.1.1.1'))).toBe(true);
  // L'autre visiteur ne doit pas payer pour le premier.
  expect(limiter.isLimited(req('2.2.2.2'))).toBe(false);
});

test('deux limiteurs ne partagent pas leur compteur', () => {
  // /api/games et /api/cover ont des profils d'usage très différents (voir
  // cover+api.ts) : un seau commun ferait épuiser l'un par l'autre.
  const a = createRateLimiter({ windowMs: 60_000, max: 1 });
  const b = createRateLimiter({ windowMs: 60_000, max: 1 });

  expect(a.isLimited(req('3.3.3.3'))).toBe(false);
  expect(a.isLimited(req('3.3.3.3'))).toBe(true);
  expect(b.isLimited(req('3.3.3.3'))).toBe(false);
});

test("un X-Forwarded-For forgé par l'appelant ne donne pas un seau neuf", () => {
  // LE test qui compte. Le proxy le plus proche AJOUTE l'IP réellement vue
  // à la FIN de l'en-tête ; tout ce qui précède a pu être écrit par
  // l'appelant. Lire le premier élément revenait à offrir un compteur
  // vierge à quiconque envoie une valeur au hasard — donc à ne rien
  // limiter, ce qui est exactement ce que ce limiteur existe pour éviter.
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });

  const forge = (n: number) => req(`10.0.0.${n}, 203.0.113.7`);

  expect(limiter.isLimited(forge(1))).toBe(false);
  expect(limiter.isLimited(forge(2))).toBe(false);
  // Même visiteur réel (203.0.113.7), en-tête forgé différent à chaque coup.
  expect(limiter.isLimited(forge(3))).toBe(true);
});

test('clientIp retient le dernier hop, pas le premier', () => {
  expect(clientIp(req('10.0.0.1, 10.0.0.2, 203.0.113.7'))).toBe('203.0.113.7');
  expect(clientIp(req('203.0.113.7'))).toBe('203.0.113.7');
  // Absent (dev Metro, Jest) : un seul seau partagé plutôt que rien.
  expect(clientIp(req())).toBe('unknown');
});

test('la fenêtre repart à zéro une fois expirée', () => {
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(1_000_000);
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });

  expect(limiter.isLimited(req('4.4.4.4'))).toBe(false);
  expect(limiter.isLimited(req('4.4.4.4'))).toBe(true);

  now.mockReturnValue(1_000_000 + 60_001);
  expect(limiter.isLimited(req('4.4.4.4'))).toBe(false);
  now.mockRestore();
});

test('le suivi purge les entrées expirées au lieu de grossir indéfiniment', () => {
  // La clé vient de l'extérieur : sans purge, un appelant qui fait varier
  // l'en-tête fait grossir la Map sans limite dans un process serveur qui,
  // lui, ne redémarre pas. L'assertion porte sur le nombre réellement
  // suivi — observer qu'un compteur repart à zéro ne prouverait rien, la
  // fenêtre ayant de toute façon expiré.
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(2_000_000);
  const limiter = createRateLimiter({ windowMs: 1_000, max: 5, maxTrackedClients: 100 });

  for (let i = 0; i < 100; i += 1) limiter.isLimited(req(`198.51.100.${i}`));
  expect(limiter.trackedClients()).toBe(100);

  // Toutes les fenêtres sont expirées : le prochain appel doit purger.
  now.mockReturnValue(2_000_000 + 5_000);
  limiter.isLimited(req('203.0.113.1'));

  expect(limiter.trackedClients()).toBe(1);
  now.mockRestore();
});

test('la purge ne jette pas les fenêtres encore actives', () => {
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(3_000_000);
  const limiter = createRateLimiter({ windowMs: 60_000, max: 5, maxTrackedClients: 10 });

  for (let i = 0; i < 10; i += 1) limiter.isLimited(req(`198.51.100.${i}`));
  // Rien n'a expiré : la purge ne doit rien supprimer, le suivi continue.
  limiter.isLimited(req('203.0.113.2'));

  expect(limiter.trackedClients()).toBe(11);
  now.mockRestore();
});
