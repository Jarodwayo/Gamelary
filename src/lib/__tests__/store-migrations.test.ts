import { migrateStore, STORE_VERSION } from '../store-migrations';

// Blob tel qu'écrit par la version actuelle de l'app (pas de `version`, pas
// d'`igdbId`, pas d'`updatedAt`, ids de succès horodatés) — volontairement
// riche : chaque champ ci-dessous doit ressortir identique de la migration.
function legacyBlob() {
  return {
    games: {
      'hollow-knight': {
        id: 'hollow-knight',
        title: 'Hollow Knight',
        platform: 'PC',
        steamAppId: 367520,
        inLibrary: true,
        stopped: false,
        achievements: [
          { id: 'hollow-knight:old-nail-mtttnm88', name: 'Old Nail', unlocked: true },
          { id: 'hollow-knight:pure-nail-mtttnm89', name: 'Pure Nail', unlocked: false },
        ],
        favoriteTrackId: 'hollow-knight:dirtmouth',
        rating: 18,
        review: 'Excellent metroidvania.',
        playSessions: [{ date: '2024-01-01T00:00:00.000Z', hours: 12.5 }],
      },
    },
    lists: {
      favoris: { id: 'favoris', name: 'Favoris', builtin: true, gameIds: ['hollow-knight'] },
      wishlist: { id: 'wishlist', name: 'Wishlist', builtin: true, gameIds: [] },
    },
    settings: { steamId64: '76561197960287930' },
  };
}

describe('non-destruction : rien d’écrasé, seulement des ajouts', () => {
  test('tous les champs existants d’un jeu ressortent identiques', () => {
    const before = legacyBlob().games['hollow-knight'];

    const after = migrateStore(legacyBlob()).games['hollow-knight'];

    expect(after.id).toBe(before.id);
    expect(after.title).toBe(before.title);
    expect(after.platform).toBe(before.platform);
    expect(after.steamAppId).toBe(before.steamAppId);
    expect(after.inLibrary).toBe(before.inLibrary);
    expect(after.stopped).toBe(before.stopped);
    expect(after.favoriteTrackId).toBe(before.favoriteTrackId);
    expect(after.rating).toBe(before.rating);
    expect(after.review).toBe(before.review);
    // Journal de jeu : aucune session ajoutée, retirée ni modifiée.
    expect(after.playSessions).toEqual(before.playSessions);
  });

  test('le contenu des succès est préservé — seul l’id est normalisé', () => {
    const before = legacyBlob().games['hollow-knight'].achievements;

    const after = migrateStore(legacyBlob()).games['hollow-knight'].achievements;

    expect(after).toHaveLength(before.length);
    // name/unlocked identiques, dans le même ordre.
    expect(after.map((a) => [a.name, a.unlocked])).toEqual(before.map((a) => [a.name, a.unlocked]));
    // L'id, lui, ne doit plus contenir de timestamp : c'est le correctif.
    for (const achievement of after) {
      expect(achievement.id).not.toMatch(/-[a-z0-9]{8}$/);
    }
  });

  test('listes et réglages ressortent identiques', () => {
    const before = legacyBlob();

    const after = migrateStore(legacyBlob());

    expect(after.lists).toEqual(before.lists);
    expect(after.settings).toEqual(before.settings);
  });

  test('les nouveaux champs attendus sont ajoutés, sans valeur inventée', () => {
    const after = migrateStore(legacyBlob());

    expect(after.version).toBe(STORE_VERSION);
    // igdbId inconnu à ce stade : la migration ne le devine pas.
    expect(after.games['hollow-knight'].igdbId).toBeUndefined();
    // updatedAt volontairement absent : on n'a aucun horodatage réel pour
    // une donnée écrite avant l'existence du champ, et en inventer un
    // fausserait un arbitrage "le plus récent gagne" plus tard.
    expect(after.games['hollow-knight'].updatedAt).toBeUndefined();
  });
});

describe('idempotence : rejouer la migration ne change plus rien', () => {
  // Le temps DOIT avancer entre les deux exécutions. Sans ça, une migration
  // boguée qui dérive une valeur de Date.now() produirait le même résultat
  // deux fois de suite (même milliseconde) et le test passerait par chance —
  // vérifié : sans ce mock, une implémentation ré-aléatoirisant les ids
  // passait ces deux tests.
  let clock: number;

  beforeEach(() => {
    clock = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => (clock += 60_000));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('migrer deux fois donne exactement le même résultat', () => {
    const once = migrateStore(legacyBlob());
    const twice = migrateStore(once);

    expect(twice).toEqual(once);
  });

  test('aucun succès dupliqué après une seconde exécution', () => {
    const once = migrateStore(legacyBlob());
    const twice = migrateStore(once);

    const ids = twice.games['hollow-knight'].achievements.map((a) => a.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toEqual(once.games['hollow-knight'].achievements.map((a) => a.id));
  });

  test('une troisième exécution ne change toujours rien', () => {
    const thrice = migrateStore(migrateStore(migrateStore(legacyBlob())));

    expect(thrice).toEqual(migrateStore(legacyBlob()));
  });
});

describe('non-régression : des données déjà migrées ne sont pas réécrasées', () => {
  test('un igdbId et un updatedAt déjà présents survivent à la migration', () => {
    const alreadyMigrated = {
      version: STORE_VERSION,
      games: {
        celeste: {
          id: 'celeste',
          title: 'Celeste',
          platform: 'PC',
          igdbId: 7788,
          updatedAt: 1700000000000,
          inLibrary: true,
          stopped: false,
          achievements: [{ id: 'celeste:manual:sommet', name: 'Sommet', unlocked: true }],
          playSessions: [],
        },
      },
      lists: {},
      settings: {},
    };

    const after = migrateStore(alreadyMigrated);

    expect(after.games.celeste.igdbId).toBe(7788);
    expect(after.games.celeste.updatedAt).toBe(1700000000000);
    expect(after.games.celeste.achievements[0].id).toBe('celeste:manual:sommet');
  });
});

describe('collision de noms : deux succès homonymes ne doivent jamais fusionner', () => {
  test('deux succès manuels du même nom restent deux entrées distinctes', () => {
    // addAchievement n'impose aucune unicité de nom (voir game-store.tsx) :
    // ce cas existe donc réellement en base locale. Un id déterministe naïf
    // dérivé du seul nom les ferait fusionner — perte silencieuse.
    const blob = {
      games: {
        hades: {
          id: 'hades',
          title: 'Hades',
          platform: 'PC',
          inLibrary: true,
          stopped: false,
          achievements: [
            { id: 'hades:boss-vaincu-aaa11111', name: 'Boss vaincu', unlocked: true },
            { id: 'hades:boss-vaincu-bbb22222', name: 'Boss vaincu', unlocked: false },
          ],
          playSessions: [],
        },
      },
      lists: {},
      settings: {},
    };

    const after = migrateStore(blob);
    const achievements = after.games.hades.achievements;

    expect(achievements).toHaveLength(2);
    expect(new Set(achievements.map((a) => a.id)).size).toBe(2);
    // Les deux états distincts sont conservés, pas écrasés l'un par l'autre.
    expect(achievements.map((a) => a.unlocked)).toEqual([true, false]);
  });
});
