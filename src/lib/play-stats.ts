import type { StoredGame } from '@/lib/game-store';

// Tous les agrégats ci-dessous dérivent des vraies sessions de jeu datées
// (voir ARCHITECTURE.md §6.6) — aucun chiffre inventé pour "faire joli" sur
// l'écran Statistiques, y compris les streaks (peuvent légitimement valoir 0
// sur une installation fraîche sans historique).

export function completionPercent(games: StoredGame[]): number {
  const totals = games.reduce(
    (acc, game) => ({
      unlocked: acc.unlocked + game.achievements.filter((a) => a.unlocked).length,
      total: acc.total + game.achievements.length,
    }),
    { unlocked: 0, total: 0 }
  );
  return totals.total === 0 ? 0 : Math.round((totals.unlocked / totals.total) * 100);
}

function sessionDays(games: StoredGame[]): Set<string> {
  const days = new Set<string>();
  for (const game of games) {
    for (const session of game.playSessions) days.add(session.date.slice(0, 10));
  }
  return days;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Streak "actuel" : jours consécutifs jusqu'à aujourd'hui OU hier (on ne
// casse pas le streak si l'utilisateur n'a pas encore joué aujourd'hui,
// juste s'il a sauté un jour complet avant).
export function currentStreakDays(games: StoredGame[]): number {
  const days = sessionDays(games);
  const cursor = new Date();
  if (!days.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(toDateKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function longestStreakDays(games: StoredGame[]): number {
  const sorted = Array.from(sessionDays(games)).sort();
  if (sorted.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round(
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86_400_000
    );
    current = diffDays === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

export type MonthBucket = { month: number; hours: number };

// 12 mois de l'année en cours (pas une fenêtre glissante) : correspond aux
// libellés J F M A M J J A S O N D affichés sous le graphique.
export function hoursByMonthThisYear(games: StoredGame[]): MonthBucket[] {
  const buckets: MonthBucket[] = Array.from({ length: 12 }, (_, month) => ({ month, hours: 0 }));
  const year = new Date().getFullYear();
  for (const game of games) {
    for (const session of game.playSessions) {
      const date = new Date(session.date);
      if (date.getFullYear() === year) buckets[date.getMonth()].hours += session.hours;
    }
  }
  return buckets;
}

export type PlatformStat = { platform: string; hours: number };

export function hoursByPlatform(games: StoredGame[]): PlatformStat[] {
  const totals = new Map<string, number>();
  for (const game of games) {
    const hours = game.playSessions.reduce((sum, session) => sum + session.hours, 0);
    if (hours <= 0) continue;
    totals.set(game.platform, (totals.get(game.platform) ?? 0) + hours);
  }
  return Array.from(totals.entries())
    .map(([platform, hours]) => ({ platform, hours }))
    .sort((a, b) => b.hours - a.hours);
}
