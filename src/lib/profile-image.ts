import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

// Choix d'image pour le profil, isolé ici plutôt que dans l'écran
// d'édition : c'est le seul endroit qui connaît la différence de format de
// résultat entre le web et le natif (voir plus bas), et les deux images
// (photo de profil / arrière-plan) partagent exactement ce chemin — seul
// leur cadrage change.
export type ProfileImageKind = 'avatar' | 'background';

// Cadrages différents parce que les deux images n'ont pas le même rôle :
// carré pour la photo (affichée dans un cercle), large pour la bannière
// derrière elle. `aspect` ne s'applique qu'à Android, `allowsEditing`
// ouvre le recadrage sur iOS/Android (sans effet sur le web) — la
// compression `quality` reste le seul levier commun.
const ASPECT: Record<ProfileImageKind, [number, number]> = {
  avatar: [1, 1],
  background: [16, 9],
};

// Doit être appelée directement depuis une interaction utilisateur : sur le
// web, le navigateur bloque sinon l'ouverture du sélecteur de fichiers.
// Renvoie undefined si l'utilisateur annule — jamais une erreur, annuler
// n'est pas un échec.
export async function pickProfileImage(kind: ProfileImageKind): Promise<string | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: ASPECT[kind],
    quality: 0.7,
    // Coûteux (l'image entière en mémoire sous forme de chaîne) : demandé
    // uniquement sur le web, où c'est le seul moyen d'obtenir une valeur
    // persistable (voir ci-dessous).
    base64: Platform.OS === 'web',
  });

  if (result.canceled) return undefined;
  const asset = result.assets[0];
  if (!asset) return undefined;

  if (Platform.OS === 'web') {
    // Sur le web, `uri` est une URL `blob:` créée par URL.createObjectURL :
    // elle meurt au rechargement de la page, donc inutilisable telle quelle
    // dans un profil persisté (AsyncStorage = localStorage ici). On stocke
    // une data URI à la place. Limite connue : une photo lourde peut
    // dépasser le quota localStorage — l'écriture du store échoue alors
    // silencieusement (voir game-store.tsx) et l'image est perdue au
    // prochain lancement. Un vrai upload vers un backend (donc un compte,
    // voir ARCHITECTURE.md §9) est la seule vraie réponse.
    return asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
  }

  // Sur iOS/Android, expo-image-picker a déjà copié l'image choisie dans le
  // dossier de cache de l'app : `uri` (file://...) reste lisible d'un
  // lancement à l'autre, sans recopie de notre part.
  return asset.uri;
}
