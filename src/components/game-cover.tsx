import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useGameCover } from '@/hooks/use-game-cover';

// Sous-ensemble de ViewStyle/ImageStyle plutôt qu'un des deux types complets
// : Image (expo-image) et ThemedView (View) ont chacun leur propre type de
// style incompatible sur certains champs (ex. `overflow`), alors que les
// trois variantes ci-dessous n'ont besoin que de ces propriétés de mise en
// forme communes — pas la peine d'élargir le type juste pour satisfaire
// TypeScript sur des champs qu'on n'utilise jamais.
type CoverStyle = {
  width?: number | `${number}%`;
  height?: number;
  aspectRatio?: number;
  borderRadius?: number;
  alignItems?: 'center';
  justifyContent?: 'center';
};

const PLACEHOLDER_COLORS = ['#5B4B8A', '#2E6E5E', '#8A4B4B', '#4B6B8A', '#8A7A4B', '#6B4B8A'];

// Hash déterministe (djb2-like) du titre -> même jeu = toujours la même
// couleur, sans avoir besoin de stocker cette couleur nulle part. C'est
// juste un moyen de différencier les jaquettes placeholder visuellement ;
// pas besoin de cryptographiquement solide, juste stable et bien réparti.
function colorForTitle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

function initialsFor(title: string) {
  return title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

// Rendu partagé jaquette réelle / placeholder, factorisé une seule fois :
// les variantes exportées plus bas (GameCover, GameCoverGrid,
// GameCoverFeatured) ne diffèrent QUE par leur taille (voir leurs styles
// respectifs, toujours fixes) — même logique de chargement/repli partout,
// pour ne jamais désynchroniser leur comportement d'un contexte à l'autre.
// expo-image gère lui-même le cache mémoire + disque des images distantes :
// pas besoin de logique de cache supplémentaire ici pour éviter de
// retélécharger la même jaquette à chaque affichage.
function CoverImageOrPlaceholder({
  title,
  steamAppId,
  style,
  textStyle,
}: {
  title: string;
  steamAppId?: number;
  style: CoverStyle;
  textStyle?: object;
}) {
  const { url, loading } = useGameCover(title, steamAppId);
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    // onError : /api/cover a bien renvoyé une URL, mais l'image distante
    // elle-même peut échouer à charger côté client (lien CDN mort, coupure
    // réseau) — sans repli explicite ici, le composant restait juste vide,
    // contrairement à toutes les autres pannes déjà couvertes (jeu
    // introuvable, chargement, erreur serveur) qui retombent sur le
    // placeholder.
    return <Image source={{ uri: url }} style={style} contentFit="cover" onError={() => setFailed(true)} />;
  }

  return (
    <ThemedView
      style={[style, { backgroundColor: colorForTitle(title) }]}
      accessibilityLabel={loading ? `Chargement de la jaquette de ${title}` : undefined}>
      <ThemedText style={[styles.text, textStyle]}>{initialsFor(title)}</ThemedText>
    </ThemedView>
  );
}

type CoverProps = { title: string; steamAppId?: number };

// Taille fixe, unique pour ce contexte précis (liste bibliothèque en mode
// texte, recherche, fiche jeu) dans toute l'app : plusieurs écrans avaient
// fini par styliser leur propre gabarit de jaquette (préréglages
// small/large + dérogations de style au cas par cas), ce qui a fini par
// produire des tailles incohérentes d'un écran à l'autre. Un seul
// composant par contexte, une seule taille chacun, pas de prop pour la
// moduler : la meilleure garantie que ça ne se reproduise pas. Voir
// GameCoverGrid (grille Bibliothèque/Explorer) et GameCoverFeatured
// (rangée "Recommandé pour toi") pour les deux autres tailles déclarées,
// elles aussi fixes et non modulables.
export function GameCover({ title, steamAppId }: CoverProps) {
  return <CoverImageOrPlaceholder title={title} steamAppId={steamAppId} style={styles.cover} textStyle={styles.text} />;
}

// Carte de grille (GameGrid, voir game-grid.tsx) : pas de largeur fixe en
// pixels — `width: '100%'` occupe toute la colonne que la grille lui donne
// (calculée par flex, pas par ce composant), avec un ratio 2:3 (même format
// que les grids portrait SteamGridDB) pour que la hauteur suive. Toujours
// une seule taille de fait : c'est la grille (nombre de colonnes fixe,
// identique partout où GameGrid est utilisé) qui la détermine, jamais un
// appelant au cas par cas.
export function GameCoverGrid({ title, steamAppId }: CoverProps) {
  return (
    <CoverImageOrPlaceholder
      title={title}
      steamAppId={steamAppId}
      style={styles.coverGrid}
      textStyle={styles.textGrid}
    />
  );
}

// Rangée "Recommandé pour toi" d'Explorer (voir explorer.tsx) : seule
// section à garder une mise en avant différente du reste (plus grande,
// avec un badge — voir FeaturedShelf, game-shelf.tsx) plutôt que de
// rejoindre la grille comme les autres sections. Taille fixe elle aussi,
// juste plus grande que GameCover — pas une prop modulable de plus.
export function GameCoverFeatured({ title, steamAppId }: CoverProps) {
  return (
    <CoverImageOrPlaceholder
      title={title}
      steamAppId={steamAppId}
      style={styles.coverFeatured}
      textStyle={styles.textFeatured}
    />
  );
}

const styles = StyleSheet.create({
  cover: {
    width: 56,
    height: 74,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverGrid: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFeatured: {
    width: 140,
    height: 210,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  textGrid: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  textFeatured: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
});
