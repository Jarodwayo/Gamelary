// Mode d'affichage de l'en-tête d'une fiche jeu (réglage "Affiche de la
// page titre", voir profile/settings-artwork.tsx) :
// - background : bandeau large en fond + logo du jeu détouré par-dessus
//   (illustrations `hero`/`logo` de SteamGridDB, voir cover+api.ts) ;
// - poster : la jaquette portrait, l'affichage historique de la fiche.
export type TitleArtwork = 'background' | 'poster';

// Par défaut le bandeau, comme l'app de référence : c'est le mode le plus
// riche, et il retombe tout seul sur la jaquette quand SteamGridDB n'a pas
// de bandeau pour le jeu (voir library/[id].tsx) — jamais un en-tête vide.
export const DEFAULT_TITLE_ARTWORK: TitleArtwork = 'background';

export const TITLE_ARTWORK_OPTIONS: { value: TitleArtwork; label: string }[] = [
  { value: 'background', label: 'Arrière-plan' },
  { value: 'poster', label: 'Affiche' },
];

export function titleArtworkLabel(value: TitleArtwork): string {
  return TITLE_ARTWORK_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
