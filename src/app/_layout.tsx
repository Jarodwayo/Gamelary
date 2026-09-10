import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { SearchFab } from '@/components/search-fab';
import { SignInSyncGate } from '@/components/sign-in-sync-gate';
import { AnimatedSplashOverlay } from '@/components/splash-overlay';
import { FontsToLoad } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth-store';
import { GameStoreProvider } from '@/lib/game-store';

// Empêche Expo de masquer le splash natif tant que le JS n'a pas fini de
// monter : sans ça on aurait un flash de contenu non stylé avant l'app.
SplashScreen.preventAutoHideAsync();

// Layout racine du router (app/_layout.tsx = point d'entrée de toute
// l'appli). AppTabs remplace le composant Tabs habituel : ce n'est pas un
// Stack qui contiendrait des onglets, ce sont les onglets eux-mêmes qui
// forment la racine de la navigation (voir app-tabs.tsx pour le détail
// natif vs web). SearchFab est un frère d'AppTabs, pas un onglet : NativeTabs
// ne permet pas d'insérer un bouton flottant dans sa barre, donc il est
// superposé ici pour rester visible au-dessus de tous les onglets (voir
// search-fab.tsx).
export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(FontsToLoad);

  // Ne rend rien tant que Bricolage Grotesque/IBM Plex Mono ne sont pas
  // prêtes : le splash natif reste affiché (preventAutoHideAsync ci-dessus)
  // le temps du chargement, plutôt que de montrer un flash de police
  // système avant que le texte ne bascule sur la police custom.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* AuthProvider est un FRÈRE de GameStoreProvider, pas imbriqué à
          l'intérieur : l'identité Supabase (session, tokens) est gérée et
          persistée par supabase-js lui-même (voir lib/supabase.ts), sans
          rapport avec le blob AsyncStorage de la bibliothèque de jeux — les
          mélanger créerait deux sources de vérité pour la même donnée (voir
          le commentaire d'AuthProvider, lib/auth-store.tsx). */}
      <AuthProvider>
        <GameStoreProvider>
          <SignInSyncGate />
          <AnimatedSplashOverlay />
          <AppTabs />
          <SearchFab />
        </GameStoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
