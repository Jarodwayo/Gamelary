# Architecture — Gamelary

Ce document résume les décisions techniques du projet et pourquoi elles ont
été prises. Objectif : pouvoir expliquer le projet en entretien sans relire
tout le code. Il est tenu à jour à chaque changement structurant (voir
`CLAUDE.md`).

Légende : ✅ implémenté · 🚧 prévu, pas encore codé.

## 1. Vue d'ensemble

Gamelary est une application mobile (iOS + Android, + web en bonus) façon
"Letterboxd pour les jeux vidéo" : bibliothèque de jeux suivis, succès
100%, et musique préférée de la bande originale par jeu (référence, pas de
lecture audio dans l'app).

## 2. Expo (managé) plutôt que React Native CLI (bare) ✅

| Critère | Expo managé | Bare RN CLI |
|---|---|---|
| Build iOS sans Mac | ✅ via EAS Build (cloud) | ❌ nécessite Xcode |
| Mises à jour OTA (JS only, sans repasser par les stores) | ✅ `expo-updates` | à mettre en place soi-même |
| Setup natif (Xcode/Android Studio) en local | pas nécessaire pour développer | requis dès le premier run |
| Accès au code natif custom | limité sauf via config plugins / `expo prebuild` | total |

Pour un projet solo, sans besoin de module natif exotique, l'itération
rapide et le build cloud l'emportent largement sur le contrôle natif total.
Si un besoin natif spécifique apparaît plus tard, `expo prebuild` reste une
porte de sortie vers du code natif sans tout réécrire.

## 3. expo-router plutôt qu'une navigation configurée à la main ✅

- **File-based routing** : l'arborescence dans `src/app/` *est* le plan de
  navigation (comme Next.js côté web). Un nouveau fichier = une nouvelle
  route, sans registre de routes à maintenir à part.
- **Deep linking gratuit** : chaque écran a une URL (`/library/hollow-knight`)
  utilisable aussi bien sur web que comme lien profond natif.
- **`NativeTabs`** (`expo-router/unstable-native-tabs`, nouveau en SDK 57) :
  la barre d'onglets est le vrai composant natif (`UITabBarController` /
  `BottomNavigationView`) plutôt qu'une barre redessinée en JS — rendu,
  gestes et transitions natifs "gratuits". Contrepartie : cette API ne
  fonctionne pas sur web, d'où une implémentation web séparée
  (`app-tabs.web.tsx`, primitives `expo-router/ui`) qui garde les mêmes
  noms de route pour que la navigation reste identique entre plateformes.
- **Tabs avec pile de navigation propre** : l'onglet Bibliothèque a son
  propre `Stack` imbriqué (`src/app/library/_layout.tsx`) pour pouvoir
  pousser la fiche jeu par-dessus la liste avec un bouton retour natif, tout
  en gardant la barre d'onglets visible — le pattern standard des apps à
  onglets (Instagram, Twitter...).

## 4. Structure du projet

```
src/
  app/                 routes (expo-router) — la navigation elle-même
    _layout.tsx          layout racine (thème + splash + NativeTabs)
    index.tsx             redirige "/" vers "/library" (pas d'onglet racine)
    api/
      cover+api.ts          route serveur : proxy + cache vers SteamGridDB
    library/
      _layout.tsx          Stack imbriqué (liste -> fiche jeu)
      index.tsx             bibliothèque (grille de jeux)
      [id].tsx               fiche jeu (succès, musique préférée)
    profile.tsx           écran profil (stats)
  components/          UI réutilisable, découplée des routes
  constants/theme.ts   couleurs/espacements clair-sombre, source unique du design system
  data/                accès aux données (mock aujourd'hui, API demain)
  hooks/               logique réutilisable côté client (ex. useGameCover)
  lib/                 utilitaires transverses (ex. résolution d'URL d'API)
  types/               types partagés (Game, FavoriteTrack)
```

Découplage volontaire : les écrans (`app/`) ne connaissent que le type
`Game` et les fonctions de `data/` (ex. `getGameById`) — jamais la source
réelle des données. Remplacer les mocks par de vrais appels API ne devrait
toucher que `src/data/`, pas les écrans.

## 5. Sources de données par fonctionnalité

### 5.1 Catalogue de jeux (nom, plateformes) — IGDB 🚧

[IGDB](https://api-docs.igdb.com/) (propriété Twitch) plutôt que l'API
Steam seule : couvre toutes les plateformes (PC, PlayStation, Xbox,
Switch...), pas seulement les jeux Steam — nécessaire pour une appli façon
Backloggd qui ne se limite pas à une seule plateforme. Auth via
Client Credentials Twitch (pas de connexion utilisateur requise, juste des
identifiants d'app).

### 5.2 Jaquettes — SteamGridDB ✅

[SteamGridDB](https://www.steamgriddb.com/api/v2) plutôt que les covers
IGDB par défaut : base communautaire spécialisée dans l'artwork (grids,
covers, hero images) avec plusieurs styles par jeu et une meilleure qualité
moyenne que les jaquettes génériques d'IGDB.

Flux : `src/app/api/cover+api.ts` (route serveur — voir §6) recherche le
jeu par titre (`/search/autocomplete`), prend le premier résultat, récupère
ses grids au format portrait 600×900 (`/grids/game/:id`) et renvoie l'URL
de la meilleure. `GameCover` (`src/components/game-cover.tsx`) appelle
cette route via le hook `useGameCover` et affiche l'image avec `expo-image` ;
le placeholder coloré (hash déterministe du titre + initiales) reste l'état
de repli permanent (chargement, jeu introuvable sur SteamGridDB, erreur
réseau) — pas juste une étape temporaire du projet.

Limite connue : le matching prend le premier résultat de l'autocomplete
sans désambiguïsation (ex. risque de confondre un jeu et son remake/DLC).
Une fois IGDB branché, on pourra matcher par id plutôt que par nom pour
fiabiliser ça.

### 5.3 Succès / 100% — Steam Web API 🚧

`ISteamUserStats/GetPlayerAchievements` donne les succès débloqués et leur
détail, mais **uniquement pour les jeux Steam PC** liés au compte Steam de
l'utilisateur (il n'existe pas d'API publique équivalente pour PSN/Xbox).
D'où le choix dans `Game` (`src/types/game.ts`) de stocker
`achievementsUnlocked`/`achievementsTotal` séparément plutôt qu'un
pourcentage déjà calculé : le pourcentage est dérivé à l'affichage
(`library/[id].tsx`), et `achievementsTotal === 0` sert de signal explicite
"pas de succès trackés pour ce jeu" (jeu non-Steam) plutôt qu'un 0% trompeur.

### 5.4 Musique préférée — Spotify Web API (recherche uniquement) 🚧

Décision produit importante : l'app ne **joue pas** la musique, elle stocke
juste une référence (titre + artiste) choisie par l'utilisateur dans la BO
du jeu. Conséquence technique : pas besoin de Spotify Premium ni du SDK de
lecture (qui impose des contraintes fortes côté mobile) — seule l'API de
recherche (`/v1/search`) est nécessaire, avec un flow *Client Credentials*
(pas de connexion utilisateur Spotify requise). Le lien "Chercher sur
Spotify" actuel (`library/[id].tsx`) ouvre l'app/le site Spotify pour que
l'utilisateur trouve son morceau ; l'étape suivante est un écran de
recherche in-app qui persiste juste `{ title, artist }` sur le jeu.

## 6. Secrets API : pourquoi un petit backend est nécessaire ✅ (partiel)

IGDB (client secret Twitch), SteamGridDB, Steam Web API et Spotify exigent
tous une clé/secret d'application. Une clé embarquée dans le bundle JS
d'une app mobile publique est extractible (l'app est un fichier
téléchargeable) — donc **aucun de ces secrets ne doit vivre dans le client
Gamelary**.

Plutôt qu'un service séparé (Cloudflare Worker, Vercel...), le backend est
les **routes API d'expo-router** (`src/app/api/*+api.ts`, convention
`+api.ts`) : ces fichiers tournent uniquement côté serveur (dev server
Metro, ou le serveur Node une fois déployé) et ne sont jamais inclus dans
le bundle client — pas de service ni de dépôt séparé à maintenir pour un
projet solo. Contrepartie : `app.json` doit déclarer `web.output: "server"`
(et non `"static"`) pour que ces routes existent aussi en production, ce
qui impose un hébergeur qui exécute du Node (ex. EAS Hosting) plutôt qu'un
CDN statique classique.

Implémenté pour SteamGridDB (`/api/cover`, lit `STEAMGRIDDB_API_KEY` côté
serveur). À répliquer pour IGDB (`/api/games`), Steam (`/api/achievements`)
et Spotify (`/api/music/search`) une fois ces intégrations branchées.

## 7. Stratégie de cache 🚧

Le cache n'est pas uniforme : la volatilité des données diffère selon la
source, donc le TTL (durée de vie) diffère aussi.

| Donnée | Volatilité | Cache prévu |
|---|---|---|
| Catalogue IGDB (nom, plateformes) | quasi statique | cache serveur long (jours/semaines) 🚧 |
| Jaquettes SteamGridDB | statique | ✅ cache serveur (`Map` en mémoire, TTL 7 jours, dans `cover+api.ts`) + cache disque client via `expo-image` (déjà utilisé dans le projet, gère automatiquement mémoire + disque pour les images distantes — rien à coder en plus côté client) + petit cache mémoire côté client (`useGameCover`) pour éviter un aller-retour réseau à chaque montage du composant |
| Succès Steam | change quand l'utilisateur joue | cache court (quelques minutes) ou rafraîchissement manuel, jamais de cache long 🚧 |
| Recherche Spotify | éphémère, propre à la session de recherche | pas de cache — seule la sélection finale (`{ title, artist }`) est persistée sur le jeu 🚧 |

Limite assumée du cache serveur actuel : une simple `Map` en mémoire ne
survit pas à un redémarrage et ne serait pas partagée entre plusieurs
instances si l'app scale — suffisant pour une seule instance de dev/démo,
mais à remplacer par un vrai cache partagé (Redis/KV) avant une mise en
production sérieuse.

Côté client, [TanStack Query](https://tanstack.com/query) est envisagé pour
gérer le cache/refetch/état de chargement des appels au backend (pattern
stale-while-revalidate) de façon plus robuste que le `useState`/`useEffect`
actuel de `useGameCover`, plutôt que de réinventer cette logique à la main
dans chaque écran.

## 8. Licence

Le dépôt est public à des fins de démonstration (recherche d'emploi) mais
sans licence open source : `LICENSE` place le code sous "tous droits
réservés" — consultable, mais pas réutilisable sans autorisation.

## 9. État actuel vs feuille de route

**Fait** : scaffold Expo + TypeScript, navigation complète (onglets +
pile imbriquée), écrans Bibliothèque/Fiche jeu/Profil sur données mock,
design system clair/sombre partagé (`ThemedText`/`ThemedView`/`theme.ts`),
jaquettes réelles via SteamGridDB (route serveur + cache + composant client).

**Prochaines étapes** : intégration IGDB (catalogue — les identifiants
configurés renvoient actuellement une erreur 401 côté IGDB, à vérifier),
Steam Web API (succès, nécessite un flow de connexion du compte Steam de
l'utilisateur), recherche Spotify in-app pour la musique préférée, cache
serveur partagé (Redis/KV) en remplacement de la `Map` en mémoire.
