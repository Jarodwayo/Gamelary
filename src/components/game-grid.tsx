import { Link } from 'expo-router';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { GameCoverGrid } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatGameTitle } from '@/lib/game-title';
import { formatHours } from '@/lib/hours';

const NUM_COLUMNS = 3;

// Item générique plutôt qu'un id + lookup interne (comme GameList) : la
// grille est utilisée aussi bien pour la Bibliothèque (jeux déjà dans le
// store, avec des heures jouées à afficher) que pour Explorer (résultats
// IGDB bruts, `useExploreSection`, sans heures) — chaque appelant construit
// déjà les données dont il a besoin, la grille n'a donc pas à savoir d'où
// elles viennent. `hours` absent = pas affiché (Explorer) ; présent mais à
// 0 = pas affiché non plus (rien à montrer). Pas de `platform` : retiré
// volontairement des cartes de grille (Bibliothèque/Explorer), contrairement
// aux rangées horizontales de Profil (GameShelf) qui elles le gardent.
export type GridItem = { id: string; title: string; steamAppId?: number; hours?: number };

// Largeur calculée en JS (pas en %) plutôt que flex:1 par carte : une
// dernière ligne incomplète (ex. 7 jeux sur 3 colonnes) ne doit pas étirer
// les 1-2 cartes restantes plus larges que les autres — chaque carte garde
// toujours exactement la même largeur, complète ou non. Exportée : la
// rangée "Jeux joués" du Profil (GameShelf, voir game-shelf.tsx) réutilise
// ce même calcul pour que ses cartes fassent exactement la même taille que
// la grille de Bibliothèque/Explorer, plutôt qu'une largeur choisie à part.
export function useGridItemWidth() {
  const { width } = useWindowDimensions();
  const totalGap = Spacing.three * (NUM_COLUMNS - 1);
  const totalPadding = Spacing.three * 2;
  return (width - totalPadding - totalGap) / NUM_COLUMNS;
}

function GameGridCard({ item, itemWidth }: { item: GridItem; itemWidth: number }) {
  return (
    // Link asChild clone son enfant direct via Slot, qui refuse un style
    // passé sous forme de tableau (`[styles.card, {...}]`) — un objet fusionné
    // à la main plutôt qu'un StyleSheet.flatten, pour rester cohérent avec le
    // seul champ variable ici (itemWidth, calculé par la grille, pas figé
    // dans le StyleSheet).
    <Link href={{ pathname: '/library/[id]', params: { id: item.id } }} asChild>
      <Pressable style={{ ...styles.card, width: itemWidth }}>
        <GameCoverGrid title={item.title} steamAppId={item.steamAppId} />
        {/* Pas de numberOfLines : un titre long doit toujours se lire en
            entier (voir formatGameTitle) plutôt que d'être tronqué — une
            limite de lignes fixe coupait "Breath of the Wild" en plein mot
            dès que le sous-titre dépassait le nombre de lignes autorisées. */}
        <ThemedText type="small" style={styles.title}>
          {formatGameTitle(item.title)}
        </ThemedText>
        {item.hours ? (
          <ThemedText type="small" themeColor="textSecondary">
            {formatHours(item.hours)}
          </ThemedText>
        ) : null}
      </Pressable>
    </Link>
  );
}

type GameGridProps = {
  items: GridItem[];
  emptyLabel?: string;
  header?: ReactElement;
};

// Grille murale (Bibliothèque, Explorer — voir ARCHITECTURE.md §2) : un
// simple View en flexWrap plutôt qu'un FlatList numColumns, à la fois pour
// éviter les pièges classiques de numColumns (dernière ligne incomplète qui
// s'étire) et parce qu'une bibliothèque perso reste de taille modeste
// (quelques dizaines de jeux, voir game-store.tsx) — pas besoin de
// virtualisation. Utilisée aussi bien comme contenu principal (Bibliothèque,
// dans son propre ScrollView) qu'imbriquée dans le ScrollView d'Explorer.
export function GameGrid({ items, emptyLabel, header }: GameGridProps) {
  const itemWidth = useGridItemWidth();

  return (
    <View>
      {header}
      {items.length === 0 && emptyLabel ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          {emptyLabel}
        </ThemedText>
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <GameGridCard key={item.id} item={item} itemWidth={itemWidth} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.one,
  },
  title: {
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
});
