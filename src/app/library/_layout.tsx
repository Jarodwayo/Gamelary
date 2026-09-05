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
    </Stack>
  );
}
