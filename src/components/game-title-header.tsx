import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGameCover } from '@/hooks/use-game-cover';
import { useTheme } from '@/hooks/use-theme';
import type { TitleArtwork } from '@/lib/title-artwork';

// En-tête de la fiche jeu, dans l'un des deux modes du réglage "Affiche de
// la page titre" (voir profile/settings-artwork.tsx) : jaquette portrait
// (l'affichage historique) ou bandeau large + logo.
//
// Les deux modes vivent dans deux composants distincts plutôt que dans une
// suite de ternaires : le mode bandeau a besoin de ses propres appels à
// useGameCover (hero et logo), qui ne doivent pas être déclenchés du tout
// en mode affiche — impossible avec des hooks conditionnels dans un seul
// composant.

type HeaderProps = {
  title: string;
  steamAppId?: number;
  // Ligne sous le titre (plateforme, "Chargement…", "· Arrêté") : composée
  // par l'écran, qui seul connaît l'état du jeu.
  subtitle: string;
  // Bouton favori de la fiche jeu, passé tel quel pour que l'en-tête n'ait
  // pas à connaître le store.
  action: ReactNode;
};

// Texte clair fixe : posé sur une photo arbitraire assombrie par un voile,
// donc jamais une couleur de thème — même raisonnement que la bannière du
// Profil (voir profile/index.tsx).
const BANNER_INK = '#F5F1EC';
const BANNER_HEIGHT = 200;

function PosterHeader({ title, steamAppId, subtitle, action }: HeaderProps) {
  return (
    <ThemedView style={styles.poster}>
      <GameCover title={title} steamAppId={steamAppId} />
      <ThemedView style={styles.posterText}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
      </ThemedView>
      {action}
    </ThemedView>
  );
}

function BackgroundHeader({ title, steamAppId, subtitle, action }: HeaderProps) {
  const theme = useTheme();
  const { url: heroUrl, loading } = useGameCover(title, steamAppId, 'hero');
  const { url: logoUrl } = useGameCover(title, steamAppId, 'logo');
  // onError, même raisonnement que GameCover (voir game-cover.tsx) :
  // SteamGridDB a bien renvoyé une URL, mais l'image distante peut échouer
  // à charger (lien mort, CDN injoignable). Sans ça, le bandeau resterait
  // un rectangle vide — pire que la jaquette qu'il remplace.
  const [heroFailed, setHeroFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Aucun bandeau chez SteamGridDB pour ce jeu (fréquent hors jeux Steam),
  // ou bandeau impossible à charger : on retombe sur la jaquette plutôt que
  // d'afficher un aplat vide. On attend d'être fixé (loading terminé) pour
  // basculer, sinon l'en-tête sauterait d'un mode à l'autre à chaque
  // ouverture de fiche.
  if ((!heroUrl && !loading) || heroFailed) {
    return <PosterHeader title={title} steamAppId={steamAppId} subtitle={subtitle} action={action} />;
  }

  return (
    <View style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
      {heroUrl ? (
        <Image
          source={{ uri: heroUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setHeroFailed(true)}
          accessibilityLabel={`Image de ${title}`}
        />
      ) : null}
      {/* Voile sombre : un logo clair ou du texte posé directement sur une
          image très claire deviendrait illisible. */}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={styles.bannerContent}>
        {logoUrl && !logoFailed ? (
          <Image
            source={{ uri: logoUrl }}
            style={styles.logo}
            contentFit="contain"
            contentPosition="left"
            onError={() => setLogoFailed(true)}
            accessibilityLabel={title}
          />
        ) : (
          // Pas de logo détouré disponible (ou impossible à charger) : le
          // titre en texte joue le même rôle, plutôt qu'un bandeau anonyme.
          <ThemedText type="subtitle" style={styles.bannerTitle}>
            {title}
          </ThemedText>
        )}
        <View style={styles.bannerFooter}>
          <ThemedText style={styles.bannerSubtitle}>{subtitle}</ThemedText>
          {action}
        </View>
      </View>
    </View>
  );
}

export function GameTitleHeader({ mode, ...props }: HeaderProps & { mode: TitleArtwork }) {
  return mode === 'background' ? <BackgroundHeader {...props} /> : <PosterHeader {...props} />;
}

const styles = StyleSheet.create({
  poster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  posterText: {
    flex: 1,
    gap: Spacing.one,
  },
  banner: {
    height: BANNER_HEIGHT,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  scrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  bannerContent: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  logo: {
    width: '75%',
    height: 64,
  },
  bannerTitle: {
    color: BANNER_INK,
  },
  bannerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerSubtitle: {
    color: BANNER_INK,
  },
});
