import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const CARD_WIDTH = 110;

export type ShelfItem = { id: string; title: string; platform?: string };

function ShelfCard({ item }: { item: ShelfItem }) {
  return (
    // Objet { pathname, params } plutôt qu'une chaîne `/library/${id}`
    // construite à la main : plus robuste pour un segment dynamique, expo-
    // router gère lui-même l'encodage — une chaîne mal formée était la cause
    // de l'erreur "Unmatched Route" au tap sur une carte.
    <Link href={{ pathname: '/library/[id]', params: { id: item.id } }} asChild>
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
  onSeeAll?: () => void;
};

// Rangée horizontale réutilisée par Explorer et Profil (Jeux suivis/Jeux
// préférés) — motif "titre en gras + chevron + scroll horizontal" décidé
// dans le style guide (voir ARCHITECTURE.md §2), distinct de la liste
// compacte de la bibliothèque (GameList) qui elle défile verticalement.
export function GameShelf({ title, items, emptyLabel, onSeeAll }: GameShelfProps) {
  return (
    <ThemedView style={styles.shelf}>
      <Pressable
        onPress={onSeeAll}
        disabled={!onSeeAll}
        style={styles.shelfHead}
        accessibilityRole={onSeeAll ? 'button' : undefined}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </Pressable>
      {items.length === 0 && emptyLabel ? (
        <View style={styles.emptyWrap}>
          <ThemedText type="small" themeColor="textSecondary">
            {emptyLabel}
          </ThemedText>
        </View>
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
  shelfHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  emptyWrap: {
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
