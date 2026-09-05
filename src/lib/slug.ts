// Identifiant partagé entre le catalogue IGDB (Explorer, recherche) et la
// bibliothèque suivie (tracked-games.ts, game-store.tsx) : dérivé du titre
// plutôt que de l'id numérique IGDB pour rester lisible dans les URLs
// (/library/hollow-knight) et stable même si IGDB retrouve un id différent
// d'une recherche à l'autre pour un même jeu.
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents détachés par normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
