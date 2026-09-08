import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { GameCover, GameCoverFeatured } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatGameTitle } from '@/lib/game-title';

// Un peu plus large que la jaquette (56px, fixe — voir GameCover) pour que
// le titre en dessous reste lisible, sans faire varier la taille de la
// jaquette elle-même d'un écran à l'autre.
const CARD_WIDTH = 84;

export type ShelfItem = { id: string; title: string; platform?: string; steamAppId?: number };

function ShelfCard({ item }: { item: ShelfItem }) {
  return (
    // Objet { pathname, params } plutôt qu'une chaîne `/library/${id}`
    // construite à la main : plus robuste pour un segment dynamique, expo-
    // router gère lui-même l'encodage — une chaîne mal formée était la cause
    // de l'erreur "Unmatched Route" au tap sur une carte.
    <Link href={{ pathname: '/library/[id]', params: { id: item.id } }} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <GameCover title={item.title} steamAppId={item.steamAppId} />
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

const FEATURED_CARD_WIDTH = 140;

function FeaturedCard({ item, badge }: { item: ShelfItem; badge: string }) {
  const theme = useTheme();
  return (
    <Link href={{ pathname: '/library/[id]', params: { id: item.id } }} asChild>
      <Pressable style={({ pressed }) => [styles.featuredCard, pressed && styles.pressed]}>
        <View>
          <GameCoverFeatured title={item.title} steamAppId={item.steamAppId} />
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <ThemedText type="small" themeColor="accentInk" style={styles.badgeText}>
              {badge}
            </ThemedText>
          </View>
        </View>
        {/* Pas de numberOfLines, même raison que GameGrid (game-grid.tsx) :
            un titre long doit toujours se lire en entier. */}
        <ThemedText type="smallBold">{formatGameTitle(item.title)}</ThemedText>
      </Pressable>
    </Link>
  );
}

type FeaturedShelfProps = {
  title: string;
  badge: string;
  items: ShelfItem[];
  emptyLabel?: string;
};

// Mise en avant d'Explorer ("Recommandé pour toi" — voir explorer.tsx),
// volontairement distincte de la grille murale (GameGrid) des 4 autres
// rangées : cartes plus grandes (GameCoverFeatured), défilement horizontal
// conservé, et un badge ("Recommandé"/"Tendance") superposé sur la
// jaquette — jamais de plateforme affichée ici (retirée d'Explorer, voir
// GameGrid), contrairement à GameShelf qui la garde pour le Profil.
export function FeaturedShelf({ title, badge, items, emptyLabel }: FeaturedShelfProps) {
  return (
    <ThemedView style={styles.shelf}>
      <View style={styles.shelfHead}>
        <ThemedText type="smallBold">{title}</ThemedText>
      </View>
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
          renderItem={({ item }) => <FeaturedCard item={item} badge={badge} />}
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
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    gap: Spacing.two,
  },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  badgeText: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
