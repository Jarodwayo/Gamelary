import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Groupe de lignes en carte arrondie, motif commun aux écrans de réglages
// (Paramètres, Aide et idées) — mêmes séparateurs, mêmes pastilles
// d'icônes partout, plutôt que chaque écran redessinant sa propre liste.
//
// Les apps de référence colorent chaque pastille d'une couleur différente
// (bleu, rouge, orange...). Ici, l'accent reste l'unique couleur
// interactive du design system (voir ARCHITECTURE.md §2), donc les
// pastilles partagent la même couleur — sauf `destructive`, qui passe en
// `danger`, la seule autre couleur autorisée pour une action irréversible.
export type SettingsItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  // Valeur courante affichée à droite (ex. "Arrière-plan" en face de
  // "Affiche de la page titre"), avant le chevron.
  value?: string;
  // Exactement l'un des deux : `href` pour une URL externe (ouverte dans le
  // navigateur in-app sur mobile, voir external-link.tsx), `to` pour une
  // route interne. `onPress` reste possible pour une action sans navigation.
  href?: Href & string;
  to?: Href;
  onPress?: () => void;
  destructive?: boolean;
};

function RowContent({ item }: { item: SettingsItem }) {
  const theme = useTheme();
  const tint = item.destructive ? theme.danger : theme.accent;

  return (
    <View style={styles.row}>
      <View style={[styles.iconBadge, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={item.icon} size={18} color={tint} />
      </View>
      <ThemedText themeColor={item.destructive ? 'danger' : undefined} style={styles.label}>
        {item.label}
      </ThemedText>
      {item.value ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.value}>
          {item.value}
        </ThemedText>
      ) : null}
      {/* Flèche sortante pour un lien externe, chevron pour une navigation
          interne : la différence prévient qu'on quitte l'app. */}
      <Ionicons
        name={item.href ? 'open-outline' : 'chevron-forward'}
        size={16}
        color={theme.textSecondary}
      />
    </View>
  );
}

export function SettingsGroup({ items }: { items: SettingsItem[] }) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={styles.group}>
      {items.map((item, index) => (
        <View
          key={item.key}
          style={
            index > 0
              ? [styles.separated, { borderTopColor: theme.backgroundSelected }]
              : undefined
          }>
          {item.href ? (
            <ExternalLink href={item.href} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={item.label}>
                <RowContent item={item} />
              </Pressable>
            </ExternalLink>
          ) : item.to ? (
            <Link href={item.to} asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={item.label}>
                <RowContent item={item} />
              </Pressable>
            </Link>
          ) : (
            <Pressable onPress={item.onPress} accessibilityRole="button" accessibilityLabel={item.label}>
              <RowContent item={item} />
            </Pressable>
          )}
        </View>
      ))}
    </ThemedView>
  );
}

// Intitulé de section en capitales au-dessus d'un groupe (COMMUNAUTÉ,
// ASSISTANCE, AFFICHAGE...) — même motif que les libellés de champ des
// écrans de formulaire.
export function SettingsSectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  group: {
    marginHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  separated: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Le libellé prend la place restante pour pousser valeur et chevron à
  // droite ; la valeur se rétrécit si les deux sont longs.
  label: {
    flex: 1,
  },
  value: {
    flexShrink: 1,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
    marginHorizontal: Spacing.four,
  },
});
