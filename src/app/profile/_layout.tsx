import { Stack } from 'expo-router';

// Même pattern que library/_layout.tsx : un Stack propre à l'onglet Profil
// pour pouvoir pousser Statistiques par-dessus, tout en gardant la barre
// d'onglets visible.
export default function ProfileLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="stats" options={{ title: 'Statistiques', headerBackTitle: 'Profil' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications', headerBackTitle: 'Profil' }} />
      <Stack.Screen name="edit" options={{ title: 'Modifier le profil', headerBackTitle: 'Profil' }} />
      <Stack.Screen name="sign-in" options={{ title: 'Se connecter', headerBackTitle: 'Profil' }} />
      <Stack.Screen name="create-list" options={{ title: 'Créer une liste', headerBackTitle: 'Profil' }} />
      {/* Titre par défaut, écrasé dynamiquement par l'écran lui-même (voir
          profile/list/[id].tsx) une fois la liste résolue — même motif que
          library/_layout.tsx pour la fiche jeu. */}
      <Stack.Screen name="list/[id]" options={{ title: 'Liste', headerBackTitle: 'Profil' }} />
      <Stack.Screen name="help" options={{ title: 'Aide et idées', headerBackTitle: 'Profil' }} />
      <Stack.Screen name="settings" options={{ title: 'Paramètres', headerBackTitle: 'Profil' }} />
      <Stack.Screen
        name="settings-artwork"
        options={{ title: 'Affiche de la page titre', headerBackTitle: 'Paramètres' }}
      />
    </Stack>
  );
}
