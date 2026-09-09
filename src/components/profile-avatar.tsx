import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// Sous-ensemble de style commun à View et Image (expo-image), pas
// StyleProp<ViewStyle> : les deux types divergent sur `overflow` (ViewStyle
// accepte 'scroll', ImageStyle non), donc un style de View ne peut pas être
// passé tel quel à une Image — même contrainte et même solution que
// CoverStyle dans game-cover.tsx.
type AvatarStyle = {
  width: number;
  height: number;
  borderRadius: number;
  borderWidth: number;
  overflow: 'hidden';
};

// Photo de profil, avec repli sur l'initiale du nom quand aucune image
// n'est choisie (voir profile.ts) — le même rendu qu'avant l'ajout des
// images, jamais un cercle vide.
//
// Deux variantes de taille fixe plutôt qu'une prop `size` : même
// raisonnement que GameCover/GameCoverGrid/GameCoverFeatured (voir
// game-cover.tsx et ARCHITECTURE.md §2) — laisser chaque écran choisir sa
// taille avait fini par produire des tailles incohérentes d'un écran à
// l'autre.
function Avatar({
  uri,
  name,
  style,
  initialStyle,
}: {
  uri: string | undefined;
  name: string;
  style: AvatarStyle;
  initialStyle: { fontSize: number; lineHeight: number };
}) {
  const theme = useTheme();
  // Anneau à la couleur du fond de l'écran : détache l'avatar de l'image
  // d'arrière-plan (voir profile/index.tsx), qui peut être de n'importe
  // quelle couleur derrière lui.
  const ring = { borderColor: theme.background };

  if (uri) {
    return <Image source={{ uri }} style={[style, ring]} contentFit="cover" />;
  }

  return (
    <View style={[style, ring, styles.initialCircle, { backgroundColor: theme.backgroundSelected }]}>
      {/* includeFontPadding/lineHeight resserrés : une seule lettre centrée
          dans un cercle est rognée en haut avec le lineHeight par défaut de
          type="subtitle" (voir themed-text.tsx), d'autant plus avec la
          police custom. */}
      <ThemedText type="subtitle" style={[styles.initial, initialStyle]}>
        {name.charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
}

export function ProfileAvatar({ uri, name }: { uri: string | undefined; name: string }) {
  return <Avatar uri={uri} name={name} style={styles.avatar} initialStyle={styles.avatarInitial} />;
}

export function ProfileAvatarLarge({ uri, name }: { uri: string | undefined; name: string }) {
  return <Avatar uri={uri} name={name} style={styles.avatarLarge} initialStyle={styles.avatarLargeInitial} />;
}

const styles = StyleSheet.create({
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    borderWidth: 3,
    overflow: 'hidden',
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 3,
    overflow: 'hidden',
  },
  initialCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    includeFontPadding: false,
  },
  avatarInitial: {
    fontSize: 28,
    lineHeight: 32,
  },
  avatarLargeInitial: {
    fontSize: 36,
    lineHeight: 42,
  },
});
