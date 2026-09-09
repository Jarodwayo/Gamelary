import Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';

// Source unique des onglets, partagée par les deux implémentations de la
// barre (app-tabs.tsx sur mobile, app-tabs.web.tsx sur le web) : même
// ordre, mêmes libellés, mêmes icônes par construction. C'est ce qui les
// empêche de diverger — l'écart précédent (le web affichait un onglet
// "Gamelary" et aucune icône) venait justement de deux listes tenues
// séparément.
//
// `name` doit correspondre au fichier/dossier de src/app (voir
// app-tabs.tsx) ; `href` ne sert qu'au web, où TabTrigger a besoin d'une
// URL explicite.
export type AppTab = {
  name: string;
  href: Href;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const APP_TABS: AppTab[] = [
  { name: 'library', href: '/library', label: 'Bibliothèque', icon: 'albums' },
  { name: 'explorer', href: '/explorer', label: 'Explorer', icon: 'compass' },
  { name: 'profile', href: '/profile', label: 'Profil', icon: 'person-circle' },
];
