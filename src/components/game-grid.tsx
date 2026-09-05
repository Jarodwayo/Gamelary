import { Link } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { useGame } from '@/hooks/use-game';
import { BottomTabInset, Spacing } from '@/constants/theme';

// asChild fait passer les props de navigation (onPress, href...) directement
// au Pressable enfant au lieu d'insérer un <a>/<Text> supplémentaire : la
// carte entière reste stylable comme un composant RN normal tout en restant
// un vrai lien (touch native + <a href> côté web, donc accessible/SEO-friendly).
function GameCard({ id }: { id: string }) {
  const { game } = useGame(id);
  if (!game) return null;

  return (
    <Link href={`/library/${id}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <GameCover title={game.title} />
        <ThemedText type="small" numberOfLines={1} style={styles.cardTitle}>
          {game.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {game.platform}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

type GameGridProps = {
  ids: string[];
  header?: ReactElement;
  emptyLabel?: string;
};

// Grille 2 colonnes, réutilisée par la bibliothèque, la wishlist et la vue
// "Pas commencé" — seule la liste d'ids passée en `ids` change d'un écran à
// l'autre, le rendu de chaque carte reste identique (voir useGame).
export function GameGrid({ ids, header, emptyLabel }: GameGridProps) {
  return (
    <FlatList
      data={ids}
      keyExtractor={(id) => id}
      numColumns={2}
      columnWrapperStyle={ids.length > 0 ? styles.row : undefined}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => <GameCard id={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        emptyLabel ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {emptyLabel}
          </ThemedText>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.three,
  },
  card: {
    flex: 1,
    gap: Spacing.one,
  },
  cardTitle: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    paddingTop: Spacing.four,
    textAlign: 'center',
  },
});
