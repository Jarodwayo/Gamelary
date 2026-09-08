import { Link, type Href } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { GameCover, GameCoverFeatured, GameCoverGrid } from '@/components/game-cover';
import { useGridItemWidth } from '@/components/game-grid';
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

// Link asChild clone son enfant direct via Slot, qui gère mal un style
// dynamique par carte dès qu'il passe par la forme fonction
// `({pressed}) => ({...})` — pas seulement les tableaux (voir game-grid.tsx) :
// dans une liste horizontale, ça a fini par appliquer une largeur différente
// (voire aucune) selon la position de la carte, chaque carte retombant sur
// la taille de son propre contenu. Un objet statique, sans callback ni
// retour sur pression, est le seul pattern vérifié fiable ici — même choix
// que GameGridCard (game-grid.tsx), qui n'a jamais eu ce problème.
function ShelfCard({ item }: { item: ShelfItem }) {
  return (
    // Objet { pathname, params } plutôt qu'une chaîne `/library/${id}`
    // construite à la main : plus robuste pour un segment dynamique, expo-
    // router gère lui-même l'encodage — une chaîne mal formée était la cause
    // de l'erreur "Unmatched Route" au tap sur une carte.
    <Link href={{ pathname: '/library/[id]', params: { id: item.id } }} asChild>
      <Pressable style={styles.card}>
        <GameCover title={item.title} steamAppId={item.steamAppId} />
        {/* Pas de numberOfLines, même raison que GameGrid (game-grid.tsx) :
            un titre long doit toujours se lire en entier, jamais tronqué en
            plein mot ("The Witcher 3 : Wild Hunt" par ex.). */}
        <ThemedText type="small" style={styles.cardTitle}>
          {formatGameTitle(item.title)}
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

// Carte large : mêmes proportions que GameGrid (Bibliothèque/Explorer,
// largeur calculée via useGridItemWidth — un seul point de vérité pour
// cette taille, pas une valeur choisie à part ici) mais toujours dans un
// scroll horizontal, pas une grille qui retourne à la ligne — le Profil
// reste un aperçu, pas un écran de parcours complet.
function LargeShelfCard({ item, itemWidth }: { item: ShelfItem; itemWidth: number }) {
  return (
    <Link href={{ pathname: '/library/[id]', params: { id: item.id } }} asChild>
      <Pressable style={{ width: itemWidth, gap: Spacing.one }}>
        <GameCoverGrid title={item.title} steamAppId={item.steamAppId} />
        <ThemedText type="small" style={styles.cardTitle}>
          {formatGameTitle(item.title)}
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
  // Bouton optionnel sous emptyLabel (ex. "Explorer" vers Explorer) — un
  // nouvel utilisateur sans jeu suivi/favori voit un vrai point de départ
  // plutôt qu'un simple texte explicatif suivi de rien à faire.
  emptyAction?: { label: string; href: Href };
  onSeeAll?: () => void;
  // 'large' : cartes à la taille de GameGrid (voir "Jeux joués" du Profil,
  // profile/index.tsx) — sinon la petite taille historique du Profil
  // ("Jeux préférés", volontairement inchangée).
  size?: 'small' | 'large';
};

// Rangée horizontale du Profil (Jeux joués/Jeux préférés) — motif "titre en
// gras + chevron + scroll horizontal" décidé dans le style guide (voir
// ARCHITECTURE.md §2), distinct de la grille murale (GameGrid) de
// Bibliothèque/Explorer qui elle retourne à la ligne.
export function GameShelf({ title, items, emptyLabel, emptyAction, onSeeAll, size = 'small' }: GameShelfProps) {
  const itemWidth = useGridItemWidth();

  return (
    <ThemedView style={styles.shelf}>
      <Pressable
        onPress={onSeeAll}
        disabled={!onSeeAll}
        style={styles.shelfHead}
        accessibilityRole={onSeeAll ? 'button' : undefined}>
        <ThemedText type="smallBold">{title}</ThemedText>
        {/* Compteur avant le chevron, même motif que les apps de séries/
            films pour une catégorie ("Séries    124 ›") : le nombre de jeux
            de la rangée plutôt qu'un simple chevron nu. */}
        <View style={styles.shelfHeadCount}>
          <ThemedText type="small" themeColor="textSecondary">
            {items.length}
          </ThemedText>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </View>
      </Pressable>
      {items.length === 0 && emptyLabel ? (
        <View style={styles.emptyWrap}>
          <ThemedText type="small" themeColor="textSecondary">
            {emptyLabel}
          </ThemedText>
          {emptyAction ? (
            <Link href={emptyAction.href} asChild>
              <Pressable style={styles.emptyAction}>
                <ThemedText type="linkPrimary">{emptyAction.label}</ThemedText>
              </Pressable>
            </Link>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          renderItem={({ item }) =>
            size === 'large' ? <LargeShelfCard item={item} itemWidth={itemWidth} /> : <ShelfCard item={item} />
          }
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
      <Pressable style={styles.featuredCard}>
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
        {/* Couleur accent plutôt que le texte par défaut : ces titres de
            section manquaient de contraste en sombre (blanc/gris clair sur
            fond quasi noir) — l'accent est déjà la couleur du badge
            "Recommandé" et du cœur favori, donc cohérent en plus d'être
            plus lisible. */}
        <ThemedText type="smallBold" themeColor="accent">
          {title}
        </ThemedText>
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
  shelfHeadCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  emptyWrap: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  emptyAction: {
    alignSelf: 'flex-start',
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
});
