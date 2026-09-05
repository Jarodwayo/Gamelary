import { Redirect } from 'expo-router';

// Il n'y a pas d'onglet "/" : "library" et "profile" sont les deux seules
// routes déclarées dans AppTabs (voir app-tabs.tsx). Ce fichier existe
// uniquement pour que la racine du site web ne renvoie pas un 404 —
// il redirige immédiatement vers l'onglet Bibliothèque. Sur natif, ce
// choix n'a pas d'impact : le premier <NativeTabs.Trigger> est déjà
// sélectionné par défaut.
export default function RootIndex() {
  return <Redirect href="/library" />;
}
