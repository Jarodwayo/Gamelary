import { hoursByLast7Days } from '../play-stats';
import type { StoredGame } from '../game-store';

function makeGame(playSessions: { date: string; hours: number }[]): StoredGame {
  return {
    id: 'g',
    title: 'Jeu',
    platform: 'PC',
    inLibrary: true,
    stopped: false,
    achievements: [],
    playSessions,
  };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 3600_000).toISOString();
}

describe('hoursByLast7Days', () => {
  test('7 jours glissants se terminant aujourd’hui, avec des sessions connues dans la fenêtre', () => {
    // Le bug : l'écran Statistiques n'avait qu'une seule agrégation par
    // granularité (hoursByMonthThisYear, toujours 12 barres mensuelles),
    // réutilisée telle quelle pour "Semaine" — qui affichait donc un
    // graphique sans aucun rapport avec les 7 derniers jours plutôt qu'un
    // résultat vide. Ce test verrouille qu'une agrégation dédiée à la
    // semaine existe et retourne un résultat non vide pour des sessions
    // connues dans la fenêtre.
    const games = [makeGame([{ date: daysAgo(1), hours: 2 }, { date: daysAgo(6), hours: 1.5 }])];

    const buckets = hoursByLast7Days(games);

    expect(buckets).toHaveLength(7);
    const totalHours = buckets.reduce((sum, bucket) => sum + bucket.hours, 0);
    expect(totalHours).toBe(3.5);
    // Au moins un jour porte des heures non nulles : le résultat n'est pas
    // silencieusement vide, contrairement au bug.
    expect(buckets.some((bucket) => bucket.hours > 0)).toBe(true);
  });

  test('le dernier bucket est toujours aujourd’hui', () => {
    const games = [makeGame([{ date: new Date().toISOString(), hours: 4 }])];

    const buckets = hoursByLast7Days(games);

    const today = new Date().toISOString().slice(0, 10);
    expect(buckets[6].date).toBe(today);
    expect(buckets[6].hours).toBe(4);
  });

  test('une session hors fenêtre (8+ jours) ne compte dans aucun bucket', () => {
    const games = [makeGame([{ date: daysAgo(8), hours: 10 }])];

    const buckets = hoursByLast7Days(games);

    expect(buckets.reduce((sum, bucket) => sum + bucket.hours, 0)).toBe(0);
  });

  test('aucun jeu ne donne 7 buckets à 0h, jamais NaN', () => {
    const buckets = hoursByLast7Days([]);

    expect(buckets).toHaveLength(7);
    expect(buckets.every((bucket) => bucket.hours === 0)).toBe(true);
  });
});
