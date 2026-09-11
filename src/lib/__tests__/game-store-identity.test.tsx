// Couvre les deux prérequis restants de la §9.3 (ARCHITECTURE.md) :
// l'identité canonique IGDB stockée à côté du slug local, et l'horodatage
// posé à chaque mutation d'un jeu. Les deux ne servent à rien aujourd'hui —
// ils ne servent qu'à la synchronisation à venir (§9.5) — donc rien dans
// l'app ne casserait visiblement s'ils cessaient de fonctionner : c'est
// précisément pour ça qu'ils ont besoin de tests.
// Même harnais que game-store-batching.test.tsx : react-test-renderer, déjà
// présent via jest-expo, suffit pour piloter le provider.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create } from 'react-test-renderer';

import { GameStoreProvider, useGameStore } from '../game-store';

type Store = ReturnType<typeof useGameStore>;

function TestConsumer({ capture }: { capture: (store: Store) => void }) {
  const store = useGameStore();
  capture(store);
  return null;
}

// Date.now avance d'une seconde à chaque lecture. Sans ça, deux mutations
// successives tombent dans la même milliseconde et un test "l'horodatage a
// changé" passerait même contre un code qui ne l'écrit qu'une fois — le
// même piège que celui rencontré sur les tests d'idempotence de la
// migration (voir store-migrations.test.ts).
let now = 1_700_000_000_000;
let nowSpy: jest.SpyInstance;

beforeEach(() => {
  now = 1_700_000_000_000;
  nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
});

afterEach(() => {
  nowSpy.mockRestore();
});

async function mountStore(): Promise<() => Store> {
  let latest!: Store;
  act(() => {
    create(
      <GameStoreProvider>
        <TestConsumer capture={(s) => (latest = s)} />
      </GameStoreProvider>
    );
  });
  // Laisse le chargement AsyncStorage initial se résoudre (voir
  // game-store.tsx) avant que le test ne commence à muter l'état.
  await act(async () => {
    await Promise.resolve();
  });
  return () => latest;
}

const CATALOG_GAME = { id: 'jeu-test', title: 'Jeu Test', platform: 'PC', steamAppId: 42, igdbId: 1234 };

test("registerCatalogGame conserve l'id IGDB à la création", async () => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });

  expect(store().games['jeu-test'].igdbId).toBe(1234);
  // L'id local reste le slug : l'identité IGDB est transportée À CÔTÉ, pas à
  // la place (les ids de tracked-games.ts sont écrits en dur, et le schéma
  // distant garde lui aussi les deux — voir §9.4).
  expect(store().games['jeu-test'].id).toBe('jeu-test');
});

test("un jeu déjà stocké sans id IGDB le gagne quand une résolution le fournit", async () => {
  // Le vrai cas de bascule : toutes les bibliothèques existantes ont été
  // écrites avant l'introduction du champ. Si la garde "rien n'a changé" de
  // registerCatalogGame ne compare pas l'igdbId, elle court-circuite dès que
  // titre/plateforme/appid sont déjà à jour — et ces jeux-là n'obtiennent
  // JAMAIS leur identité canonique, sans que rien ne le signale.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame({ id: 'jeu-test', title: 'Jeu Test', platform: 'PC', steamAppId: 42 });
  });
  expect(store().games['jeu-test'].igdbId).toBeUndefined();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });

  expect(store().games['jeu-test'].igdbId).toBe(1234);
});

test("une résolution sans id IGDB n'efface pas celui déjà connu, et n'écrit rien", async () => {
  // Un jeu qui perd son identité canonique devrait être re-résolu à
  // l'aveugle depuis son titre (§9.3) : une réponse IGDB dégradée ne doit
  // jamais la faire disparaître. Et comme rien ne change réellement,
  // l'horodatage ne doit pas bouger non plus.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });
  const stampAfterCreate = store().games['jeu-test'].updatedAt;

  act(() => {
    store().registerCatalogGame({ id: 'jeu-test', title: 'Jeu Test', platform: 'PC', steamAppId: 42 });
  });

  expect(store().games['jeu-test'].igdbId).toBe(1234);
  expect(store().games['jeu-test'].updatedAt).toBe(stampAfterCreate);
});

test("un jeu déjà stocké sans app id Steam le gagne quand une résolution le fournit", async () => {
  // Même raisonnement que pour igdbId ci-dessus, appliqué à steamAppId :
  // un jeu enregistré via une résolution IGDB sans external_games Steam (ou
  // avant que cette correspondance existe côté IGDB) ne doit pas être
  // bloqué à jamais si une résolution ultérieure la fournit.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame({ id: 'jeu-test', title: 'Jeu Test', platform: 'PC', igdbId: 1234 });
  });
  expect(store().games['jeu-test'].steamAppId).toBeUndefined();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });

  expect(store().games['jeu-test'].steamAppId).toBe(42);
});

test("une résolution sans app id Steam n'efface pas celui déjà connu, et n'écrit rien", async () => {
  // Reproduit avant correction : registerCatalogGame écrivait `steamAppId:
  // game.steamAppId` sans repli sur `existing.steamAppId`, contrairement au
  // traitement déjà correct d'igdbId juste au-dessus. Un jeu d'abord
  // résolu AVEC son app id Steam (ex. via /api/games?steamAppId=), puis
  // rafraîchi par une résolution par titre qui n'en trouve pas (le jeu
  // n'apparaît pas dans les external_games retournés cette fois), perdait
  // silencieusement l'app id déjà connu — cassant au passage GameCover
  // (correspondance par app id, voir cover+api.ts) et un futur import de
  // bibliothèque Steam qui dépend de ce champ pour reconnaître le jeu.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });
  const stampAfterCreate = store().games['jeu-test'].updatedAt;

  act(() => {
    store().registerCatalogGame({ id: 'jeu-test', title: 'Jeu Test', platform: 'PC', igdbId: 1234 });
  });

  expect(store().games['jeu-test'].steamAppId).toBe(42);
  expect(store().games['jeu-test'].updatedAt).toBe(stampAfterCreate);
});

// Chaque mutation d'un jeu doit avancer son updatedAt. Écrit comme une table
// plutôt qu'en neuf tests copiés : une action ajoutée plus tard sans
// horodatage se repère en ajoutant sa ligne ici, et l'oubli devient visible
// au lieu de rester silencieux jusqu'à la première synchronisation.
const MUTATIONS: [string, (store: Store) => void][] = [
  ['addToLibrary', (s) => s.addToLibrary('jeu-test')],
  ['toggleStopped', (s) => s.toggleStopped('jeu-test')],
  ['setTotalHours', (s) => s.setTotalHours('jeu-test', 12)],
  ['setRating', (s) => s.setRating('jeu-test', 15)],
  ['setReview', (s) => s.setReview('jeu-test', 'Très bon')],
  ['addAchievement', (s) => s.addAchievement('jeu-test', 'Premier succès')],
  ['importAchievements', (s) => s.importAchievements('jeu-test', [{ apiname: 'ACH_1', name: 'Un', unlocked: true }])],
  ['setFavoriteTrack', (s) => s.setFavoriteTrack('jeu-test', 'piste-1')],
];

test.each(MUTATIONS)('%s horodate le jeu', async (_label, mutate) => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });
  // Enregistrer le jeu depuis le catalogue ne pose volontairement pas
  // d'horodatage (test dédié plus bas) : la référence de départ est donc
  // "aucun", et chaque action utilisateur doit en produire un.
  const before = store().games['jeu-test'].updatedAt;
  expect(before).toBeUndefined();

  act(() => {
    mutate(store());
  });

  expect(store().games['jeu-test'].updatedAt).toBeGreaterThan(0);
});

test('toggleAchievement horodate le jeu', async () => {
  // À part des autres : a besoin d'un succès existant, dont l'id n'est connu
  // qu'après coup (makeAchievementId). addAchievement pose déjà un
  // horodatage, d'où une vraie valeur de départ ici.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
    store().addAchievement('jeu-test', 'Premier succès');
  });
  const before = store().games['jeu-test'].updatedAt!;
  const achievementId = store().games['jeu-test'].achievements[0].id;

  act(() => {
    store().toggleAchievement('jeu-test', achievementId);
  });

  expect(store().games['jeu-test'].achievements[0].unlocked).toBe(true);
  expect(store().games['jeu-test'].updatedAt).toBeGreaterThan(before);
});

// L'autre moitié de la règle, et la plus facile à casser : une action qui
// ne change rien ne doit PAS horodater. Un appareil qui se contente de
// relire sa bibliothèque gagnerait sinon l'arbitrage "le plus récent gagne"
// (§9.5) face à un appareil qui, lui, a réellement modifié la donnée.
const NO_OPS: [string, (store: Store) => void][] = [
  ['addToLibrary sur un jeu déjà dans la bibliothèque', (s) => s.addToLibrary('jeu-test')],
  ['setTotalHours avec le total déjà atteint', (s) => s.setTotalHours('jeu-test', 12)],
  ['registerCatalogGame avec des données identiques', (s) => s.registerCatalogGame(CATALOG_GAME)],
];

test.each(NO_OPS)("%s n'horodate pas", async (_label, mutate) => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
    store().addToLibrary('jeu-test');
    store().setTotalHours('jeu-test', 12);
  });
  const before = store().games['jeu-test'].updatedAt!;

  act(() => {
    mutate(store());
  });

  expect(store().games['jeu-test'].updatedAt).toBe(before);
});

test("un rafraîchissement de catalogue n'horodate pas le jeu", async () => {
  // registerCatalogGame ne transporte que des métadonnées IGDB (titre,
  // plateforme, appid, id), re-dérivables à tout moment — jamais de donnée
  // utilisateur. Les horodater ferait gagner l'arbitrage "le plus récent
  // gagne" (§9.5) à un appareil qui a simplement ouvert Explorer.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
    store().setRating('jeu-test', 18);
  });
  const afterUserEdit = store().games['jeu-test'].updatedAt!;

  act(() => {
    // Vraie mise à jour de catalogue : la plateforme change côté IGDB.
    store().registerCatalogGame({ ...CATALOG_GAME, platform: 'PlayStation 5' });
  });

  expect(store().games['jeu-test'].platform).toBe('PlayStation 5');
  expect(store().games['jeu-test'].updatedAt).toBe(afterUserEdit);
});

test("un jeu seulement aperçu dans Explorer n'a pas d'updatedAt", async () => {
  // Absent = "jamais modifié par l'utilisateur" (voir store-migrations.ts).
  // En poser un ferait entrer dans l'arbitrage un jeu sur lequel
  // l'utilisateur n'a rien écrit.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });

  expect(store().games['jeu-test'].updatedAt).toBeUndefined();
});

test("le scénario de perte d'avis : ouvrir Explorer ne prend pas le dessus sur un avis écrit ailleurs", async () => {
  // Reproduit le cas concret que la règle ci-dessus empêche. Appareil A :
  // l'utilisateur note et commente un jeu. Appareil B, même compte, ouvre
  // seulement Explorer plus tard et reçoit une plateforme mise à jour par
  // IGDB. Si ce simple rafraîchissement horodatait, B gagnerait
  // l'arbitrage §9.5 sur rating/review — et effacerait l'avis de A alors
  // que B n'en a jamais eu.
  const appareilA = await mountStore();
  act(() => {
    appareilA().registerCatalogGame(CATALOG_GAME);
    appareilA().setRating('jeu-test', 18);
    appareilA().setReview('jeu-test', 'Un chef-d’œuvre.');
  });
  const horodatageA = appareilA().games['jeu-test'].updatedAt!;

  // Appareil B n'a jamais synchronisé avec A : sans ce clear, les deux
  // mountStore() de ce test partagent le même stockage en mémoire (voir
  // jest.async-storage-mock.js) et B lirait à tort l'avis déjà écrit par A.
  await AsyncStorage.clear();
  const appareilB = await mountStore();
  act(() => {
    appareilB().registerCatalogGame(CATALOG_GAME);
    appareilB().registerCatalogGame({ ...CATALOG_GAME, platform: 'PlayStation 5' });
  });
  const horodatageB = appareilB().games['jeu-test'].updatedAt;

  // B n'a aucune donnée utilisateur sur ce jeu : il ne doit porter aucun
  // horodatage, donc ne peut pas gagner l'arbitrage face à A.
  expect(appareilB().games['jeu-test'].review).toBeUndefined();
  expect(horodatageB).toBeUndefined();
  expect(horodatageA).toBeGreaterThan(0);
});

test("l'appartenance à une liste n'horodate pas le jeu", async () => {
  // Choix délibéré, pas un oubli : les listes fusionnent par UNION (§9.5),
  // jamais par récence — leur schéma distant ne porte d'ailleurs pas
  // d'updated_at (§9.4). Rien à arbitrer, donc rien à horodater.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });
  const before = store().games['jeu-test'].updatedAt!;

  act(() => {
    store().toggleListMembership('favoris', 'jeu-test');
  });

  expect(store().lists.favoris.gameIds).toContain('jeu-test');
  expect(store().games['jeu-test'].updatedAt).toBe(before);
});

// steamId64 est un réglage, pas un jeu : son horodatage vit dans
// settings.steamId64UpdatedAt, à côté du champ, plutôt que de passer par
// updateGame (qui n'a aucune notion de "jeu" ici). Même politique de fusion
// que rating/review pour un JEU (§9.5 : « le plus récent gagne »), mais
// appliquée à la ligne `profiles` distante (§9.4) plutôt qu'à `user_games`.
test('setSteamId64 horodate le réglage', async () => {
  const store = await mountStore();

  expect(store().settings.steamId64UpdatedAt).toBeUndefined();

  act(() => {
    store().setSteamId64('76561197960287930');
  });

  expect(store().settings.steamId64).toBe('76561197960287930');
  expect(store().settings.steamId64UpdatedAt).toBeGreaterThan(0);
});

test('re-confirmer le même SteamID64 (ou délier un compte déjà délié) n’horodate pas', async () => {
  // Même garde "rien n'a changé" que partout ailleurs (voir updateGame) :
  // l'écran de profil appelle setSteamId64 sur chaque confirmation, y
  // compris quand la valeur saisie est identique à celle déjà stockée
  // (voir confirmSteamId, profile/index.tsx) — ça ne doit pas faire gagner
  // l'arbitrage §9.5 à un appareil qui n'a rien changé.
  const store = await mountStore();

  act(() => {
    store().setSteamId64('76561197960287930');
  });
  const stampAfterFirstSave = store().settings.steamId64UpdatedAt;

  act(() => {
    store().setSteamId64('76561197960287930');
  });
  expect(store().settings.steamId64UpdatedAt).toBe(stampAfterFirstSave);

  act(() => {
    store().setSteamId64(undefined);
  });
  const stampAfterUnlink = store().settings.steamId64UpdatedAt;
  expect(stampAfterUnlink).toBeGreaterThan(stampAfterFirstSave!);

  act(() => {
    store().setSteamId64(undefined);
  });
  expect(store().settings.steamId64UpdatedAt).toBe(stampAfterUnlink);
});

test("modifier un autre réglage n'horodate pas steamId64", async () => {
  // steamId64UpdatedAt n'arbitre QUE steam_id64 (une seule colonne de la
  // ligne `profiles` distante) : une mutation d'un autre réglage ne doit
  // pas le faire bouger, sans quoi il cesserait de refléter la dernière
  // écriture réelle de ce champ précis.
  const store = await mountStore();

  act(() => {
    store().setSteamId64('76561197960287930');
  });
  const stamp = store().settings.steamId64UpdatedAt;

  act(() => {
    store().updateProfile({ displayName: 'Nouveau nom' });
    store().setTitleArtwork('poster');
  });

  expect(store().settings.steamId64UpdatedAt).toBe(stamp);
});
