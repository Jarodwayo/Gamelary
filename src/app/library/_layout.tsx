import { Stack } from 'expo-router';

// Navigateur imbriqué propre à l'onglet Bibliothèque. NativeTabs affiche
// une seule route par onglet ; en mettant un Stack ici, on peut pousser
// la fiche jeu ([id]) par-dessus la liste (index) avec un vrai bouton
// retour natif, tout en gardant la barre d'onglets visible en permanence
// — exactement le pattern "tab avec sa propre pile" d'Instagram/Twitter.
// headerShown: false sur "index" : la liste a son propre titre "Bibliothèque"
// dans le contenu de la page, pas besoin d'un header natif en plus.
export default function LibraryLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerBackTitle: 'Bibliothèque' }} />
      <Stack.Screen name="wishlist" options={{ title: 'Wishlist', headerBackTitle: 'Bibliothèque' }} />
      <Stack.Screen
        name="not-started"
        options={{ title: 'Pas commencé', headerBackTitle: 'Bibliothèque' }}
      />
      {/* Le bouton de recherche flottant (voir search-fab.tsx) est visible sur
          tous les onglets mais pousse toujours ici : plus simple et plus sûr
          qu'un écran modal à la racine (NativeTabs occupe déjà toute la
          racine, sans Stack englobant) — pousser dans la pile d'un onglet
          existant est un cas déjà éprouvé (voir [id] ci-dessus). */}
      <Stack.Screen name="search" options={{ title: 'Rechercher', headerBackTitle: 'Bibliothèque' }} />
    </Stack>
  );
}
