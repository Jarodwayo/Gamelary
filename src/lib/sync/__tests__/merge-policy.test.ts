import {
  buildAchievementId,
  gameMatchKey,
  mergeAchievements,
  mergeGameFields,
  mergeListMembership,
  mergeListMetadata,
  mergePlaySessions,
  parseAchievementId,
  type RemoteAchievementRow,
  type RemoteListMembershipRow,
  type RemoteListRow,
  type RemotePlaySessionRow,
  type RemoteUserGameRow,
} from '../merge-policy';

function remoteGame(overrides: Partial<RemoteUserGameRow> = {}): RemoteUserGameRow {
  return {
    id: 'remote-uuid',
    igdb_id: 42,
    slug: 'hollow-knight',
    title: 'Hollow Knight',
    platform: 'PC',
    steam_app_id: 367520,
    in_library: false,
    stopped: false,
    rating: null,
    review: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('gameMatchKey', () => {
  test('utilise igdbId quand connu', () => {
    expect(gameMatchKey(42, 'hollow-knight')).toBe('igdb:42');
  });

  test('replie sur le slug quand igdbId absent', () => {
    expect(gameMatchKey(undefined, 'hollow-knight')).toBe('slug:hollow-knight');
  });

  test('un igdbId et un slug numériquement identique ne collisionnent jamais', () => {
    expect(gameMatchKey(42, 'hollow-knight')).not.toBe(gameMatchKey(undefined, '42'));
  });
});

describe('mergeGameFields — union inLibrary/stopped', () => {
  test('local true, distant false -> reste true (jamais de retrait silencieux)', () => {
    const merged = mergeGameFields(
      { inLibrary: true, stopped: false, rating: undefined, review: undefined, updatedAt: undefined },
      remoteGame({ in_library: false })
    );
    expect(merged.inLibrary).toBe(true);
  });

  test('local false, distant true -> devient true (ajouté sur un autre appareil)', () => {
    const merged = mergeGameFields(
      { inLibrary: false, stopped: false, rating: undefined, review: undefined, updatedAt: undefined },
      remoteGame({ in_library: true })
    );
    expect(merged.inLibrary).toBe(true);
  });

  test('stopped suit la même règle d’union que inLibrary', () => {
    const merged = mergeGameFields(
      { inLibrary: false, stopped: true, rating: undefined, review: undefined, updatedAt: undefined },
      remoteGame({ stopped: false })
    );
    expect(merged.stopped).toBe(true);
  });
});

describe('mergeGameFields — dernier-écrit-gagne sur rating/review', () => {
  // Scénario de conflit réel à deux appareils : le MÊME jeu, noté
  // différemment des deux côtés, chacun avec son propre horodatage. La
  // fusion doit choisir le plus récent, pas juste "compiler" en gardant une
  // valeur au hasard.
  test('local plus récent que le distant -> le rating/review LOCAL gagne des deux côtés', () => {
    const localUpdatedAt = Date.parse('2026-02-01T00:00:00.000Z');
    const merged = mergeGameFields(
      { inLibrary: true, stopped: false, rating: 18, review: 'Excellent, écrit après le distant', updatedAt: localUpdatedAt },
      remoteGame({ rating: 5, review: 'Vieux avis', updated_at: '2026-01-01T00:00:00.000Z' })
    );
    expect(merged.rating).toBe(18);
    expect(merged.review).toBe('Excellent, écrit après le distant');
    expect(merged.updatedAt).toBe(localUpdatedAt);
  });

  test('distant plus récent que le local -> le rating/review DISTANT gagne des deux côtés', () => {
    const localUpdatedAt = Date.parse('2026-01-01T00:00:00.000Z');
    const remoteUpdatedAt = '2026-02-01T00:00:00.000Z';
    const merged = mergeGameFields(
      { inLibrary: true, stopped: false, rating: 5, review: 'Avis écrit avant', updatedAt: localUpdatedAt },
      remoteGame({ rating: 18, review: 'Avis plus récent, un autre appareil', updated_at: remoteUpdatedAt })
    );
    expect(merged.rating).toBe(18);
    expect(merged.review).toBe('Avis plus récent, un autre appareil');
    expect(merged.updatedAt).toBe(Date.parse(remoteUpdatedAt));
  });

  test('updatedAt local absent -> ni gagnant ni perdant, rating/review locaux inchangés', () => {
    const merged = mergeGameFields(
      { inLibrary: true, stopped: false, rating: undefined, review: undefined, updatedAt: undefined },
      remoteGame({ rating: 15, review: 'Avis distant', updated_at: '2026-02-01T00:00:00.000Z' })
    );
    expect(merged.rating).toBeUndefined();
    expect(merged.review).toBeUndefined();
    expect(merged.updatedAt).toBeUndefined();
  });

  test('égalité stricte des horodatages -> le local est conservé (pas de bascule inutile)', () => {
    const sameInstant = '2026-01-01T00:00:00.000Z';
    const merged = mergeGameFields(
      { inLibrary: false, stopped: false, rating: 12, review: 'Local', updatedAt: Date.parse(sameInstant) },
      remoteGame({ rating: 9, review: 'Distant', updated_at: sameInstant })
    );
    expect(merged.rating).toBe(12);
    expect(merged.review).toBe('Local');
  });

  test('rating/review distants absents (null) mais plus récents -> le local est bien effacé', () => {
    const localUpdatedAt = Date.parse('2026-01-01T00:00:00.000Z');
    const merged = mergeGameFields(
      { inLibrary: false, stopped: false, rating: 10, review: 'À effacer', updatedAt: localUpdatedAt },
      remoteGame({ rating: null, review: null, updated_at: '2026-02-01T00:00:00.000Z' })
    );
    expect(merged.rating).toBeUndefined();
    expect(merged.review).toBeUndefined();
  });
});

describe('parseAchievementId / buildAchievementId', () => {
  test('succès importé depuis Steam (deux ":") -> source steam, external_key = apiname', () => {
    expect(parseAchievementId('hollow-knight:steam:ACH_FIRST_BOSS')).toEqual({
      gameId: 'hollow-knight',
      source: 'steam',
      externalKey: 'ACH_FIRST_BOSS',
    });
  });

  test('succès manuel (un seul ":") -> source manual', () => {
    expect(parseAchievementId('hollow-knight:vaincre-le-boss-final-abc123')).toEqual({
      gameId: 'hollow-knight',
      source: 'manual',
      externalKey: 'vaincre-le-boss-final-abc123',
    });
  });

  test('id sans ":" -> format invalide, null', () => {
    expect(parseAchievementId('malforme')).toBeNull();
  });

  test('build puis parse fait l’aller-retour pour les deux sources', () => {
    const steamId = buildAchievementId('zelda-botw', 'steam', 'ACH_X');
    expect(parseAchievementId(steamId)).toEqual({ gameId: 'zelda-botw', source: 'steam', externalKey: 'ACH_X' });

    const manualId = buildAchievementId('zelda-botw', 'manual', 'battre-ganon-abc123');
    expect(parseAchievementId(manualId)).toEqual({ gameId: 'zelda-botw', source: 'manual', externalKey: 'battre-ganon-abc123' });
  });
});

describe('mergeAchievements — union par (source, external_key), unlocked = OU logique', () => {
  test('succès local absent côté distant -> conservé tel quel, poussé vers le distant', () => {
    const local = [{ id: 'g:steam:A', name: 'Premier pas', unlocked: true }];
    const result = mergeAchievements('g', local, []);
    expect(result.achievements).toEqual(local);
    expect(result.changed).toBe(false);
    expect(result.remoteUpserts).toEqual([{ source: 'steam', external_key: 'A', name: 'Premier pas', unlocked: true }]);
  });

  test('succès distant absent localement -> importé, jamais poussé en retour', () => {
    const remote: RemoteAchievementRow[] = [{ source: 'steam', external_key: 'B', name: 'Second pas', unlocked: true }];
    const result = mergeAchievements('g', [], remote);
    expect(result.achievements).toEqual([{ id: 'g:steam:B', name: 'Second pas', unlocked: true }]);
    expect(result.changed).toBe(true);
    expect(result.remoteUpserts).toEqual([]);
  });

  // Le scénario de conflit demandé explicitement : le même succès, débloqué
  // seulement d'un côté -> jamais un retour en arrière, dans aucun des deux
  // sens.
  test('débloqué localement, verrouillé côté distant -> reste débloqué, distant mis à jour', () => {
    const local = [{ id: 'g:steam:A', name: 'Premier pas', unlocked: true }];
    const remote: RemoteAchievementRow[] = [{ source: 'steam', external_key: 'A', name: 'Premier pas', unlocked: false }];
    const result = mergeAchievements('g', local, remote);
    expect(result.achievements).toEqual([{ id: 'g:steam:A', name: 'Premier pas', unlocked: true }]);
    expect(result.changed).toBe(false);
    expect(result.remoteUpserts).toEqual([{ source: 'steam', external_key: 'A', name: 'Premier pas', unlocked: true }]);
  });

  test('verrouillé localement, débloqué côté distant -> devient débloqué localement (jamais reverrouillé)', () => {
    const local = [{ id: 'g:steam:A', name: 'Premier pas', unlocked: false }];
    const remote: RemoteAchievementRow[] = [{ source: 'steam', external_key: 'A', name: 'Premier pas', unlocked: true }];
    const result = mergeAchievements('g', local, remote);
    expect(result.achievements).toEqual([{ id: 'g:steam:A', name: 'Premier pas', unlocked: true }]);
    expect(result.changed).toBe(true);
    expect(result.remoteUpserts).toEqual([]);
  });

  test('verrouillé des deux côtés -> reste verrouillé, aucune écriture distante', () => {
    const local = [{ id: 'g:steam:A', name: 'Premier pas', unlocked: false }];
    const remote: RemoteAchievementRow[] = [{ source: 'steam', external_key: 'A', name: 'Premier pas', unlocked: false }];
    const result = mergeAchievements('g', local, remote);
    expect(result.achievements[0].unlocked).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.remoteUpserts).toEqual([]);
  });

  test('rien ne change des deux côtés -> changed=false et les mêmes références sont conservées', () => {
    const local = [{ id: 'g:steam:A', name: 'Premier pas', unlocked: true }];
    const remote: RemoteAchievementRow[] = [{ source: 'steam', external_key: 'A', name: 'Premier pas', unlocked: true }];
    const result = mergeAchievements('g', local, remote);
    expect(result.achievements[0]).toBe(local[0]);
    expect(result.changed).toBe(false);
  });

  test('id local dans un format inattendu -> laissé tel quel, jamais synchronisé', () => {
    const local = [{ id: 'sans-deux-points', name: 'Mystère', unlocked: false }];
    const result = mergeAchievements('g', local, []);
    expect(result.achievements).toEqual(local);
    expect(result.remoteUpserts).toEqual([]);
  });
});

describe('mergePlaySessions — union par clientKey/client_key, registre immuable', () => {
  test('session locale absente côté distant -> conservée telle quelle, poussée vers le distant', () => {
    const local = [{ date: '2026-01-01T00:00:00.000Z', hours: 3, clientKey: 'k1' }];
    const result = mergePlaySessions(local, []);
    expect(result.sessions).toEqual(local);
    expect(result.changed).toBe(false);
    expect(result.remoteInserts).toEqual([{ client_key: 'k1', played_at: '2026-01-01T00:00:00.000Z', hours: 3 }]);
  });

  test('session distante absente localement -> importée, jamais poussée en retour', () => {
    const remote: RemotePlaySessionRow[] = [{ client_key: 'k2', played_at: '2026-01-02T00:00:00.000Z', hours: 5 }];
    const result = mergePlaySessions([], remote);
    expect(result.sessions).toEqual([{ date: '2026-01-02T00:00:00.000Z', hours: 5, clientKey: 'k2' }]);
    expect(result.changed).toBe(true);
    expect(result.remoteInserts).toEqual([]);
  });

  test('même clientKey des deux côtés -> aucun doublon, aucune écriture', () => {
    const local = [{ date: '2026-01-01T00:00:00.000Z', hours: 3, clientKey: 'k1' }];
    const remote: RemotePlaySessionRow[] = [{ client_key: 'k1', played_at: '2026-01-01T00:00:00.000Z', hours: 3 }];
    const result = mergePlaySessions(local, remote);
    expect(result.sessions).toEqual(local);
    expect(result.changed).toBe(false);
    expect(result.remoteInserts).toEqual([]);
  });

  test('mélange réel à deux appareils : chacun garde ses propres sessions, plus celles importées de l’autre', () => {
    const local = [
      { date: '2026-01-01T00:00:00.000Z', hours: 3, clientKey: 'a-local-1' },
      { date: '2026-01-03T00:00:00.000Z', hours: 1, clientKey: 'shared' },
    ];
    const remote: RemotePlaySessionRow[] = [
      { client_key: 'shared', played_at: '2026-01-03T00:00:00.000Z', hours: 1 },
      { client_key: 'b-remote-1', played_at: '2026-01-02T00:00:00.000Z', hours: 2 },
    ];
    const result = mergePlaySessions(local, remote);
    expect(result.sessions).toEqual([
      ...local,
      { date: '2026-01-02T00:00:00.000Z', hours: 2, clientKey: 'b-remote-1' },
    ]);
    expect(result.changed).toBe(true);
    // Seule la session vraiment absente côté distant est poussée.
    expect(result.remoteInserts).toEqual([
      { client_key: 'a-local-1', played_at: '2026-01-01T00:00:00.000Z', hours: 3 },
    ]);
  });

  test('rien des deux côtés -> résultat vide, aucune écriture', () => {
    const result = mergePlaySessions([], []);
    expect(result.sessions).toEqual([]);
    expect(result.changed).toBe(false);
    expect(result.remoteInserts).toEqual([]);
  });
});

function remoteList(overrides: Partial<RemoteListRow> = {}): RemoteListRow {
  return {
    name: 'Favoris',
    description: null,
    hidden: false,
    deleted_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('mergeListMetadata — dernier-écrit-gagne sur updatedAt, comme rating/review', () => {
  test('local plus récent -> nom/description/visibilité LOCAUX gagnent des deux côtés', () => {
    const localUpdatedAt = Date.parse('2026-02-01T00:00:00.000Z');
    const merged = mergeListMetadata(
      {
        name: 'À finir (local)',
        description: 'Écrit après le distant',
        hidden: true,
        deletedAt: undefined,
        updatedAt: localUpdatedAt,
      },
      remoteList({ name: 'À finir (distant)', description: 'Vieille description', hidden: false })
    );
    expect(merged).toEqual({
      name: 'À finir (local)',
      description: 'Écrit après le distant',
      hidden: true,
      deletedAt: undefined,
      updatedAt: localUpdatedAt,
    });
  });

  test('distant plus récent -> nom/description/visibilité DISTANTS gagnent des deux côtés', () => {
    const localUpdatedAt = Date.parse('2026-01-01T00:00:00.000Z');
    const remoteUpdatedAt = '2026-02-01T00:00:00.000Z';
    const merged = mergeListMetadata(
      {
        name: 'Ancien nom',
        description: 'Ancienne description',
        hidden: false,
        deletedAt: undefined,
        updatedAt: localUpdatedAt,
      },
      remoteList({ name: 'Nouveau nom', description: 'Nouvelle description', hidden: true, updated_at: remoteUpdatedAt })
    );
    expect(merged).toEqual({
      name: 'Nouveau nom',
      description: 'Nouvelle description',
      hidden: true,
      deletedAt: undefined,
      updatedAt: Date.parse(remoteUpdatedAt),
    });
  });

  test('updatedAt local absent -> ni gagnant ni perdant, métadonnées locales inchangées', () => {
    const merged = mergeListMetadata(
      { name: 'Favoris', description: undefined, hidden: false, deletedAt: undefined, updatedAt: undefined },
      remoteList({ name: 'Nom distant plus récent', hidden: true, updated_at: '2026-02-01T00:00:00.000Z' })
    );
    expect(merged).toEqual({
      name: 'Favoris',
      description: undefined,
      hidden: false,
      deletedAt: undefined,
      updatedAt: undefined,
    });
  });

  test('égalité stricte des horodatages -> le local est conservé (pas de bascule inutile)', () => {
    const sameInstant = '2026-01-01T00:00:00.000Z';
    const merged = mergeListMetadata(
      { name: 'Nom local', description: undefined, hidden: false, deletedAt: undefined, updatedAt: Date.parse(sameInstant) },
      remoteList({ name: 'Nom distant', updated_at: sameInstant })
    );
    expect(merged.name).toBe('Nom local');
  });

  test('description distante à null mais plus récente -> la description locale est bien effacée', () => {
    const localUpdatedAt = Date.parse('2026-01-01T00:00:00.000Z');
    const merged = mergeListMetadata(
      { name: 'Nom', description: 'À effacer', hidden: false, deletedAt: undefined, updatedAt: localUpdatedAt },
      remoteList({ description: null, updated_at: '2026-02-01T00:00:00.000Z' })
    );
    expect(merged.description).toBeUndefined();
  });

  // Suppression d'une liste (§9.5, ARCHITECTURE.md « Suppression et
  // renommage d'une liste ») : bascule avec les trois autres champs sur le
  // MÊME updatedAt, jamais un horodatage à part — même arbitrage, mêmes
  // gardes, un champ de plus du même état.
  test('local supprime plus récemment -> deletedAt LOCAL gagne (le distant doit être corrigé)', () => {
    const localUpdatedAt = Date.parse('2026-02-01T00:00:00.000Z');
    const merged = mergeListMetadata(
      { name: 'À finir', description: undefined, hidden: false, deletedAt: localUpdatedAt, updatedAt: localUpdatedAt },
      remoteList({ name: 'À finir', deleted_at: null, updated_at: '2026-01-01T00:00:00.000Z' })
    );
    expect(merged.deletedAt).toBe(localUpdatedAt);
  });

  test('distant supprimé plus récemment -> deletedAt DISTANT adopté localement', () => {
    const localUpdatedAt = Date.parse('2026-01-01T00:00:00.000Z');
    const remoteDeletedAt = '2026-02-01T00:00:00.000Z';
    const merged = mergeListMetadata(
      { name: 'À finir', description: undefined, hidden: false, deletedAt: undefined, updatedAt: localUpdatedAt },
      remoteList({ name: 'À finir', deleted_at: remoteDeletedAt, updated_at: remoteDeletedAt })
    );
    expect(merged.deletedAt).toBe(Date.parse(remoteDeletedAt));
  });

  test('local plus récent mais SANS suppression -> deletedAt distant (plus ancien) n’est pas adopté', () => {
    const localUpdatedAt = Date.parse('2026-02-01T00:00:00.000Z');
    const merged = mergeListMetadata(
      { name: 'À finir (renommée après)', description: undefined, hidden: false, deletedAt: undefined, updatedAt: localUpdatedAt },
      remoteList({ name: 'À finir', deleted_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' })
    );
    expect(merged.deletedAt).toBeUndefined();
  });
});

describe('mergeListMembership — union par jeu, tombstone gated sur updatedAt', () => {
  test('jeu actif seulement local (jamais synchronisé) -> reste actif, poussé au distant', () => {
    const result = mergeListMembership(['hollow-knight'], {}, []);
    expect(result.gameIds).toEqual(['hollow-knight']);
    expect(result.changed).toBe(false);
    expect(result.remoteUpserts).toEqual([{ gameId: 'hollow-knight', removed: false }]);
  });

  test('tombstone seulement local (jamais synchronisé) -> absent des membres actifs, poussé au distant', () => {
    const result = mergeListMembership(
      [],
      { 'hollow-knight': { removed: true, updatedAt: Date.parse('2026-01-01T00:00:00.000Z') } },
      []
    );
    expect(result.gameIds).toEqual([]);
    expect(result.remoteUpserts).toEqual([{ gameId: 'hollow-knight', removed: true }]);
  });

  test('jeu actif seulement distant -> importé (union), jamais repoussé', () => {
    const remote: RemoteListMembershipRow[] = [
      { gameId: 'zelda-botw', removedAt: null, updatedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const result = mergeListMembership([], {}, remote);
    expect(result.gameIds).toEqual(['zelda-botw']);
    expect(result.changed).toBe(true);
    expect(result.remoteUpserts).toEqual([]);
  });

  test('tombstone seulement distant -> importé (le jeu reste retiré localement), jamais repoussé', () => {
    const remote: RemoteListMembershipRow[] = [
      { gameId: 'zelda-botw', removedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const result = mergeListMembership([], {}, remote);
    expect(result.gameIds).toEqual([]);
    expect(result.memberships['zelda-botw']).toEqual({ removed: true, updatedAt: Date.parse('2026-01-01T00:00:00.000Z') });
  });

  test('les deux côtés actifs -> aucune écriture, aucun changement', () => {
    const remote: RemoteListMembershipRow[] = [
      { gameId: 'hollow-knight', removedAt: null, updatedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const result = mergeListMembership(
      ['hollow-knight'],
      { 'hollow-knight': { updatedAt: Date.parse('2026-01-05T00:00:00.000Z') } },
      remote
    );
    expect(result.gameIds).toEqual(['hollow-knight']);
    expect(result.changed).toBe(false);
    expect(result.remoteUpserts).toEqual([]);
  });

  test('les deux côtés retirés -> aucune écriture, aucun changement', () => {
    const remote: RemoteListMembershipRow[] = [
      { gameId: 'hollow-knight', removedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const result = mergeListMembership(
      [],
      { 'hollow-knight': { removed: true, updatedAt: Date.parse('2026-01-05T00:00:00.000Z') } },
      remote
    );
    expect(result.gameIds).toEqual([]);
    expect(result.changed).toBe(false);
    expect(result.remoteUpserts).toEqual([]);
  });

  // Le scénario de conflit demandé explicitement : actif d'un côté, retiré
  // de l'autre — jamais un simple "compiler les deux", un vrai arbitrage.
  test('conflit réel : actif localement (plus récent), retiré à distance -> le local gagne, le distant est corrigé', () => {
    const remote: RemoteListMembershipRow[] = [
      { gameId: 'hollow-knight', removedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const result = mergeListMembership(
      ['hollow-knight'],
      { 'hollow-knight': { removed: false, updatedAt: Date.parse('2026-02-01T00:00:00.000Z') } },
      remote
    );
    expect(result.gameIds).toEqual(['hollow-knight']);
    expect(result.changed).toBe(false);
    expect(result.remoteUpserts).toEqual([{ gameId: 'hollow-knight', removed: false }]);
  });

  test('conflit réel : retiré localement, actif à distance (plus récent) -> le distant gagne, réintégré localement', () => {
    const remote: RemoteListMembershipRow[] = [
      { gameId: 'hollow-knight', removedAt: null, updatedAt: '2026-02-01T00:00:00.000Z' },
    ];
    const result = mergeListMembership(
      [],
      { 'hollow-knight': { removed: true, updatedAt: Date.parse('2026-01-01T00:00:00.000Z') } },
      remote
    );
    expect(result.gameIds).toEqual(['hollow-knight']);
    expect(result.changed).toBe(true);
    expect(result.remoteUpserts).toEqual([]);
  });

  test('conflit réel mais sans updatedAt local -> ni gagnant ni perdant, rien ne bouge nulle part', () => {
    const remote: RemoteListMembershipRow[] = [
      { gameId: 'hollow-knight', removedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ];
    // Membre actif hérité (gameIds), jamais passé par toggleListMembership
    // depuis l'introduction de `memberships` -> pas d'entrée du tout.
    const result = mergeListMembership(['hollow-knight'], {}, remote);
    expect(result.gameIds).toEqual(['hollow-knight']);
    expect(result.changed).toBe(false);
    expect(result.remoteUpserts).toEqual([]);
  });

  test('égalité stricte des horodatages -> le local est conservé (pas de bascule inutile)', () => {
    const sameInstant = '2026-01-01T00:00:00.000Z';
    const remote: RemoteListMembershipRow[] = [
      { gameId: 'hollow-knight', removedAt: sameInstant, updatedAt: sameInstant },
    ];
    const result = mergeListMembership(
      ['hollow-knight'],
      { 'hollow-knight': { removed: false, updatedAt: Date.parse(sameInstant) } },
      remote
    );
    expect(result.gameIds).toEqual(['hollow-knight']);
  });
});
