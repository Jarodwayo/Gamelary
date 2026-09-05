import type { PlaySession } from '@/types/game';

export type StatsPeriod = 'week' | 'month' | 'all';

const PERIOD_MS: Record<Exclude<StatsPeriod, 'all'>, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

// Sessions datées (voir types/game.ts) plutôt qu'un seul total par jeu :
// c'est ce qui permet à Semaine/Mois/Tout (écran Statistiques) de refléter
// de vraies heures plutôt que le même nombre recopié trois fois.
export function hoursInPeriod(sessions: PlaySession[], period: StatsPeriod): number {
  if (period === 'all') return sessions.reduce((sum, session) => sum + session.hours, 0);
  const cutoff = Date.now() - PERIOD_MS[period];
  return sessions
    .filter((session) => new Date(session.date).getTime() >= cutoff)
    .reduce((sum, session) => sum + session.hours, 0);
}

export function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return minutes === 0 ? `${wholeHours}h` : `${wholeHours}h ${String(minutes).padStart(2, '0')}m`;
}
