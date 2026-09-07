import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useGameCover } from '@/hooks/use-game-cover';

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

// Taille fixe, unique dans toute l'app (Explorer, Bibliothèque, Profil,
// recherche, fiche jeu) : plusieurs écrans avaient fini par styliser leur
// propre gabarit de jaquette (préréglages small/large + dérogations de
// style au cas par cas), ce qui a fini par produire des tailles
// incohérentes d'un écran à l'autre. Un seul composant, une seule taille,
// pas de prop pour la moduler : la meilleure garantie que ça ne se
// reproduise pas.
const COVER_WIDTH = 56;
const COVER_HEIGHT = 74;

// Jaquette réelle (SteamGridDB, via /api/cover) avec repli sur un
// placeholder coloré (couleur + initiales) pendant le chargement, si aucune
// jaquette n'a été trouvée, ou si le jeu n'a pas encore été recherché. Le
// placeholder n'est donc pas juste une étape temporaire du projet : il reste
// l'état d'erreur/chargement permanent du composant.
export function GameCover({ title }: { title: string }) {
  const { url, loading } = useGameCover(title);

  const initials = title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  if (url) {
    // expo-image gère lui-même le cache mémoire + disque des images
    // distantes : pas besoin de logique de cache supplémentaire côté client
    // pour éviter de retélécharger la même jaquette à chaque affichage.
    return <Image source={{ uri: url }} style={styles.cover} contentFit="cover" />;
  }

  return (
    <ThemedView
      style={[styles.cover, { backgroundColor: colorForTitle(title) }]}
      accessibilityLabel={loading ? `Chargement de la jaquette de ${title}` : undefined}>
      <ThemedText style={styles.text}>{initials}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
