import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const CARD_WIDTH = 110;

export type ShelfItem = { id: string; title: string; platform?: string };

function ShelfCard({ item }: { item: ShelfItem }) {
  return (
    <Link href={`/library/${item.id}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <GameCover title={item.title} />
        <ThemedText type="small" numberOfLines={1} style={styles.cardTitle}>
          {item.title}
        </ThemedText>
        {item.platform ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {item.platform}
          </ThemedText>
        ) : null}
      </Pressable>
    </Link>
  );
}

type GameShelfProps = {
  title: string;
  items: ShelfItem[];
  emptyLabel?: string;
};

// Rangée horizontale réutilisée par Explorer, Profil (Jeux suivis/Jeux
// préférés) et Wishlist — motif "titre en gras + scroll horizontal" décidé
// dans le style guide (voir ARCHITECTURE.md §2), distinct de la grille
// 2 colonnes de la bibliothèque (library/index.tsx) qui reste une grille.
export function GameShelf({ title, items, emptyLabel }: GameShelfProps) {
  return (
    <ThemedView style={styles.shelf}>
      <ThemedText type="smallBold" style={styles.shelfTitle}>
        {title}
      </ThemedText>
      {items.length === 0 && emptyLabel ? (
        <ThemedText type="small" themeColor="textSecondary">
          {emptyLabel}
        </ThemedText>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          renderItem={({ item }) => <ShelfCard item={item} />}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  shelf: {
    gap: Spacing.two,
  },
  shelfTitle: {
    paddingHorizontal: Spacing.three,
  },
  row: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    width: CARD_WIDTH,
    gap: Spacing.one,
  },
  cardTitle: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
