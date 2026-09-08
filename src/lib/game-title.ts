// Beaucoup de titres suivent le format "Titre : Sous-titre" (jeux
// "remaster"/collection/AAA récents — ex. "Clair Obscur : Expedition 33",
// "A Plague Tale : Requiem"). Le retour à la ligne naturel d'un Text (au
// premier espace qui déborde) tombe souvent au milieu du sous-titre plutôt
// qu'après les deux-points, illisible dans une carte étroite (grille — voir
// game-grid.tsx). On force donc le retour à la ligne juste après le premier
// ":" rencontré (espace ou non autour), jamais au milieu d'un mot ; les
// titres sans ":" ne sont pas modifiés, le retour à la ligne naturel
// (par mot entier, jamais par mot coupé) reste celui de React Native.
export function formatGameTitle(title: string): string {
  return title.replace(/\s*:\s*/, ' :\n');
}
