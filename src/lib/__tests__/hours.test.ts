import { formatHours, hoursInPeriod } from '../hours';

describe('formatHours', () => {
  test('cas courants', () => {
    expect(formatHours(0)).toBe('0h');
    expect(formatHours(1)).toBe('1h');
    expect(formatHours(1.5)).toBe('1h 30m');
    expect(formatHours(12.25)).toBe('12h 15m');
  });

  test("n'affiche jamais 60 minutes", () => {
    // Le bug : en prenant la partie entière d'abord, le reste de 1,999 h
    // s'arrondissait à 60 minutes et s'affichait "1h 60m". Un total non
    // rond n'a rien d'exotique — setTotalHours enregistre des écarts entre
    // sessions (voir game-store.tsx), donc la somme flotte.
    expect(formatHours(1.999)).toBe('2h');
    expect(formatHours(0.9999)).toBe('1h');
    expect(formatHours(2.9999)).toBe('3h');
    // Juste en dessous du basculement : reste bien à 59 minutes.
    expect(formatHours(1.99)).toBe('1h 59m');
  });

  test('les minutes sont toujours sur deux chiffres', () => {
    expect(formatHours(1.05)).toBe('1h 03m');
  });

  test('un temps de jeu Steam (minutes entières) retombe juste', () => {
    // playtimeMinutes / 60, la conversion faite à l'import (profile/index.tsx).
    expect(formatHours(119 / 60)).toBe('1h 59m');
    expect(formatHours(120 / 60)).toBe('2h');
    expect(formatHours(1 / 60)).toBe('0h 01m');
  });
});

describe('hoursInPeriod', () => {
  const sessions = [
    { date: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(), hours: 3, clientKey: 'k0' },
    { date: new Date(Date.now() - 10 * 24 * 3600_000).toISOString(), hours: 5, clientKey: 'k1' },
    { date: new Date(Date.now() - 200 * 24 * 3600_000).toISOString(), hours: 7, clientKey: 'k2' },
  ];

  test('"tout" additionne sans filtrer', () => {
    expect(hoursInPeriod(sessions, 'all')).toBe(15);
  });

  test('"semaine" ne garde que les 7 derniers jours', () => {
    expect(hoursInPeriod(sessions, 'week')).toBe(3);
  });

  test('"mois" ne garde que les 30 derniers jours', () => {
    expect(hoursInPeriod(sessions, 'month')).toBe(8);
  });

  test('une liste vide vaut 0, jamais NaN', () => {
    expect(hoursInPeriod([], 'all')).toBe(0);
    expect(hoursInPeriod([], 'week')).toBe(0);
  });
});
