import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { SearchFab } from '@/components/search-fab';
import { AnimatedSplashOverlay } from '@/components/splash-overlay';
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
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <GameStoreProvider>
        <AnimatedSplashOverlay />
        <AppTabs />
        <SearchFab />
      </GameStoreProvider>
    </ThemeProvider>
  );
}
