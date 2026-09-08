/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';

// Voir ARCHITECTURE.md §2 (identité visuelle) : bibliothèque de jeux vue
// comme une étagère plutôt qu'un tableau de données. accent (or "trophée
// débloqué") est l'unique couleur interactive (onglet actif, liens,
// notation) ; success (vert sauge) ne sert qu'au sens "terminé"/"vu" — les
// deux ne doivent jamais se substituer l'un à l'autre.
export const Colors = {
  light: {
    text: '#1C1A1F',
    background: '#FBF8F4',
    backgroundElement: '#F0EAE2',
    backgroundSelected: '#E3DAD0',
    textSecondary: '#6B6470',
    accent: '#C97F1B',
    // Couleur de contenu (icône/texte) posée sur un fond `accent` plein —
    // jamais un texte/icône ordinaire sur le fond normal de l'écran.
    accentInk: '#ffffff',
    success: '#3F8A5D',
  },
  dark: {
    text: '#F5F1EC',
    background: '#121014',
    backgroundElement: '#1E1B22',
    backgroundSelected: '#2A2530',
    textSecondary: '#9C94A3',
    accent: '#E8A33D',
    accentInk: '#17130A',
    success: '#5FAE7B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Bricolage Grotesque (titres/UI) + IBM Plex Mono (nombres tabulaires —
// heures, notes, stats), chargées via expo-font/@expo-google-fonts (voir
// FontsToLoad ci-dessous et src/app/_layout.tsx). Une famille par poids :
// contrairement aux polices système, une police custom chargée par nom ne
// se réinterprète pas selon `fontWeight`, donc ThemedText choisit
// directement la bonne famille plutôt que de poser fontWeight à côté.
export const Fonts = {
  sans: {
    regular: 'BricolageGrotesque_400Regular',
    medium: 'BricolageGrotesque_500Medium',
    semiBold: 'BricolageGrotesque_600SemiBold',
    bold: 'BricolageGrotesque_700Bold',
  },
  mono: {
    regular: 'IBMPlexMono_400Regular',
    medium: 'IBMPlexMono_500Medium',
    semiBold: 'IBMPlexMono_600SemiBold',
  },
} as const;

// Passé tel quel à useFonts() dans le layout racine — un seul point de
// vérité pour la liste des polices à charger, pour ne pas la dupliquer/
// désynchroniser des noms de famille utilisés ci-dessus (les clés doivent
// correspondre exactement aux valeurs de `Fonts`).
export const FontsToLoad = {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
