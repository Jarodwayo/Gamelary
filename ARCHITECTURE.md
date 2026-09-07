# Architecture — Gamelary

Ce document résume les décisions techniques du projet et pourquoi elles ont
été prises. Objectif : pouvoir expliquer le projet en entretien sans relire
tout le code. Il est tenu à jour à chaque changement structurant.

Légende : ✅ implémenté · 🚧 prévu, pas encore codé.

## 1. Vue d'ensemble

Gamelary est une application mobile (iOS + Android, + web en bonus) façon
"Letterboxd pour les jeux vidéo" : bibliothèque de jeux suivis, wishlist,
listes personnalisées, notes/avis, succès 100%, musique préférée de la
bande originale par jeu (référence, pas de lecture audio dans l'app), et un
onglet Explorer pour découvrir de nouveaux jeux.

## 2. Identité visuelle ✅ (partiel)

Bibliothèque de jeux vue comme une étagère qu'on parcourt (rangées
horizontales de jaquettes), pas un tableau de données — décision prise
avant de coder Explorer/Profil/Statistiques pour éviter de styliser chaque
écran séparément sans cohérence d'ensemble.

- **Couleur** (`src/constants/theme.ts`) : fond quasi noir à sous-teinte
  violette en sombre (`#121014`, plus riche qu'un noir pur) plutôt qu'un
  gris neutre. `accent` (or "trophée débloqué") est l'**unique** couleur
  interactive : onglet actif, liens, notation, boutons principaux.
  `success` (vert sauge) ne sert **qu'au** sens "terminé" (100%) — les deux
  ne se substituent jamais l'un à l'autre. `accentInk` est la couleur de
  contenu (texte/icône) posée sur un fond `accent` plein, jamais réutilisée
  sur le fond normal de l'écran.
- **Typographie** 🚧 : polices système actuelles conservées pour l'instant
  (Bricolage Grotesque + IBM Plex Mono avaient été retenues à l'étape
  maquette pour les titres/l'UI et les nombres tabulaires respectivement,
  mais pas encore installées/câblées — voir §10, ce n'est pas ce qui
  bloquait le reste des écrans).
- **Carte de jeu** : `GameCover` (`src/components/game-cover.tsx`) rend la
  jaquette à une **taille fixe unique dans toute l'app** (56×74, coins 8px),
  sans prop `size`/`style` pour la moduler — ni ratio 2:3 approximatif ni
  gabarits `small`/`large` comme dans une itération précédente, qui avaient
  fini par produire des jaquettes incohérentes (démesurées sur certains
  écrans) faute d'un point de vérité unique. Deux agencements réutilisent
  cette même jaquette sans jamais la redimensionner :
  - **Rangée horizontale** (`GameShelf`, `src/components/game-shelf.tsx`) —
    Explorer, Profil (Jeux suivis/Jeux préférés) : titre de section en gras
    + chevron "›" + scroll horizontal sans indicateur visible ; la colonne
    de chaque carte (84px) est un peu plus large que la jaquette pour que
    le titre en dessous reste lisible, sans agrandir la jaquette elle-même.
  - **Liste verticale compacte** (`GameList`, `src/components/game-list.tsx`)
    — Bibliothèque : une ligne par jeu (jaquette + titre + plateforme +
    heures jouées si non nulles + indicateur de complétion à droite),
    densité d'information élevée plutôt que de grandes jaquettes empilées.

## 3. Expo (managé) plutôt que React Native CLI (bare) ✅

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

## 4. expo-router plutôt qu'une navigation configurée à la main ✅

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
  Trois onglets : Bibliothèque, Explorer, Profil.
- **Tabs avec pile de navigation propre** : Bibliothèque et Profil ont
  chacun leur `Stack` imbriqué (`library/_layout.tsx`, `profile/_layout.tsx`)
  pour pousser un sous-écran (fiche jeu, wishlist, recherche / statistiques)
  par-dessus tout en gardant la barre d'onglets visible — le pattern
  standard des apps à onglets (Instagram, Twitter...). Explorer n'a pas
  (encore) de navigation imbriquée, c'est un simple fichier.
- **Bouton recherche flottant** (`src/components/search-fab.tsx`) : rendu
  en frère de `<AppTabs />` dans le layout racine, pas dans la barre
  d'onglets elle-même — `NativeTabs` ne permet pas d'insérer un bouton
  personnalisé dans sa barre native. Il pousse toujours vers
  `/library/search` (voir §6.1), quel que soit l'onglet actif : pousser dans
  la pile d'un *autre* onglet est un mécanisme standard d'expo-router, plus
  sûr ici qu'un écran modal à la racine puisque `NativeTabs` occupe déjà
  toute la racine sans `Stack` englobant.

## 5. Structure du projet

```
src/
  app/                 routes (expo-router) — la navigation elle-même
    _layout.tsx          layout racine (thème + splash + store + NativeTabs + SearchFab)
    index.tsx             redirige "/" vers "/library" (pas d'onglet racine)
    explorer.tsx           écran Explorer (5 rangées IGDB)
    api/
      cover+api.ts          route serveur : proxy + cache vers SteamGridDB
      games+api.ts          route serveur : proxy + cache vers IGDB (recherche ET rangées Explorer)
    library/
      _layout.tsx          Stack imbriqué (liste -> fiche jeu / recherche)
      index.tsx             bibliothèque : liste compacte + filtres (Tous/Wishlist/Pas commencé/En cours/Terminé)
      [id].tsx               fiche jeu (note/20, succès nommés, heures, musique préférée)
      search.tsx             recherche IGDB à la volée (barre flottante)
    profile/
      _layout.tsx          Stack imbriqué (profil -> statistiques)
      index.tsx             écran profil (identité, temps de jeu, jeux suivis/préférés)
      stats.tsx              statistiques détaillées (Semaine/Mois/Tout)
  components/          UI réutilisable, découplée des routes
  constants/theme.ts   couleurs/espacements clair-sombre, source unique du design system
  data/                accès aux données (tracked-games.ts = seed initial, API pour le reste)
  hooks/               logique réutilisable côté client (ex. useGameCover, useGame, useExploreSection)
  lib/                 utilitaires transverses + game-store.tsx (état local persisté)
  types/               types partagés (Game, CatalogGame, PlaySession, Achievement)
```

Découplage volontaire : les écrans (`app/`) ne connaissent que le type
`Game`/`CatalogGame` et le hook `useGame` (`src/hooks/use-game.ts`) — jamais
la source réelle des données (IGDB pour le catalogue, `game-store.tsx` pour
tout ce qui est propre à l'utilisateur).

## 6. Sources de données par fonctionnalité

### 6.1 Catalogue de jeux (nom, plateformes, découverte) — IGDB ✅

[IGDB](https://api-docs.igdb.com/) (propriété Twitch) plutôt que l'API
Steam seule : couvre toutes les plateformes (PC, PlayStation, Xbox,
Switch...), pas seulement les jeux Steam — nécessaire pour une appli façon
Backloggd qui ne se limite pas à une seule plateforme. Auth via
Client Credentials Twitch (pas de connexion utilisateur requise, juste des
identifiants d'app) : IGDB exige à la fois un en-tête `Client-ID` et un
`Authorization: Bearer <token>`.

`src/app/api/games+api.ts` sert deux usages sur le même endpoint :

- **`?title=`** — recherche un jeu précis (`POST /games`, apicalypse
  `search "..."; fields name,platforms.name;`, 10 candidats). Le classement
  par pertinence d'IGDB fait souvent remonter une édition/bundle/spin-off
  avant le jeu de base (ex. "Elden Ring Nightreign" avant "Elden Ring") : on
  préfère donc, parmi les candidats, celui dont le nom correspond
  exactement (insensible à la casse) au titre recherché, et on ne retombe
  sur le premier résultat du ranking IGDB que si aucun ne correspond
  exactement. Utilisé par `useGame` pour résoudre le titre/plateforme
  canoniques des jeux de démonstration de `tracked-games.ts`, et par
  `/library/search` pour une recherche ponctuelle.
- **`?section=`** — les 5 rangées de l'écran Explorer (§6.5), une requête
  apicalypse dédiée par section (IGDB n'a pas de notion native de
  "tendance" ou "recommandé").

Contrairement à SteamGridDB (clé d'API stable), le token Twitch obtenu via
Client Credentials a une durée de vie limitée (~60 jours) : plutôt que de
refaire l'échange `client_id`/`client_secret` à chaque requête (flow non
testable dans cet environnement de dev, `id.twitch.tv` n'étant pas sur la
liste des hôtes autorisés par le proxy), le serveur lit directement
`IGDB_CLIENT_ID` et `IGDB_ACCESS_TOKEN` déjà obtenu. Implication assumée :
`IGDB_ACCESS_TOKEN` doit être renouvelé périodiquement en production (job
planifié ou renouvellement manuel), sans quoi IGDB renverra un 401 après
expiration.

Un jeu est identifié par un slug dérivé de son titre (`src/lib/slug.ts`,
ex. `hollow-knight`) plutôt que par son id numérique IGDB — lisible dans les
URLs, cohérent avec les ids en dur de `tracked-games.ts`. Limite connue : un
jeu découvert dans Explorer peut ne pas correspondre à un id
`tracked-games.ts` existant dont le slug diffère du titre IGDB (ex.
`zelda-botw`, dont le titre IGDB complet donnerait un tout autre slug) — pas
de vraie déduplication tant qu'on ne matche pas par id IGDB plutôt que par
slug de titre.

### 6.2 Jaquettes — SteamGridDB ✅

[SteamGridDB](https://www.steamgriddb.com/api/v2) plutôt que les covers
IGDB par défaut : base communautaire spécialisée dans l'artwork (grids,
covers, hero images) avec plusieurs styles par jeu et une meilleure qualité
moyenne que les jaquettes génériques d'IGDB.

Flux : `src/app/api/cover+api.ts` (route serveur — voir §7) recherche le
jeu par titre (`/search/autocomplete`), prend le premier résultat, récupère
ses grids au format portrait 600×900 (`/grids/game/:id`) et renvoie l'URL
de la meilleure. `GameCover` (`src/components/game-cover.tsx`) appelle
cette route via le hook `useGameCover` et affiche l'image avec `expo-image` ;
le placeholder coloré (hash déterministe du titre + initiales) reste l'état
de repli permanent (chargement, jeu introuvable sur SteamGridDB, erreur
réseau) — pas juste une étape temporaire du projet.

Limite connue : le matching prend le premier résultat de l'autocomplete
sans désambiguïsation (ex. risque de confondre un jeu et son remake/DLC).
IGDB étant maintenant branché (§6.1), une amélioration possible serait de
matcher par id IGDB plutôt que par nom pour fiabiliser ça — pas encore fait,
`cover+api.ts` continue de chercher par titre indépendamment de `/api/games`.

### 6.3 Succès — saisie manuelle ✅, Steam Web API 🚧

`ISteamUserStats/GetPlayerAchievements` donnerait les succès débloqués,
mais **uniquement pour les jeux Steam PC** liés au compte Steam de
l'utilisateur (pas d'équivalent public pour PSN/Xbox) — donc pas suffisant
comme unique source pour une appli multi-plateforme. En attendant (et pour
rester utile même sur les plateformes sans API succès), l'utilisateur
construit lui-même sa liste de succès **nommés** sur la fiche jeu
(`+ Ajouter un succès`) et les coche au fur et à mesure : `Achievement`
(`src/types/game.ts`) est `{ id, name, unlocked }`, pas juste un ratio —
afficher *quel* succès manque est plus utile qu'un simple "28/42".
`achievementsUnlocked`/`achievementsTotal` restent exposés sur `Game`
(comptage de la liste, dérivé dans `useGame` — jamais stocké séparément,
donc jamais désynchronisable) pour les écrans qui n'ont besoin que du
total (Profil, Statistiques, filtres de bibliothèque).

Quand l'intégration Steam existera, elle pourra pré-remplir cette même
liste (noms + état) au lieu de la remplacer par un modèle différent — la
saisie manuelle n'est donc pas qu'un bouche-trou temporaire, elle reste
utile pour les jeux hors Steam.

### 6.4 Musique préférée — liste + sélection ✅, Spotify Web API 🚧

Décision produit importante : l'app ne **joue pas** la musique, elle stocke
juste une référence (titre + artiste) à un morceau choisi par l'utilisateur.
`Track` (`src/types/game.ts`) sépare deux choses : `Game.tracks` est la
bande originale complète du jeu (statique, seedée depuis `tracked-games.ts`
— même principe que les succès, voir §6.3), `Game.favoriteTrack` est
**la** piste que l'utilisateur a choisie dans cette liste (son id persisté
dans le store, résolu dans `useGame`). La fiche jeu affiche la sélection en
tête (avec un lien "ouvrir sur Spotify" pour l'écouter) puis la liste
complète en dessous pour en choisir une autre — un vrai sélecteur, pas
seulement un lien de recherche externe.

Pas de SDK de lecture (contraintes fortes côté mobile, licence Premium) ni
de streaming dans l'app — seule l'API de recherche Spotify (`/v1/search`,
flow *Client Credentials*) permettrait, plus tard, de peupler `tracks`
automatiquement depuis le vrai catalogue Spotify au lieu d'une liste
saisie en dur ; la pochette affichée reste en attendant un simple repère
visuel (icône), pas une vraie jaquette récupérée.

### 6.5 Explorer — 5 rangées IGDB ✅

IGDB n'expose ni "tendance" ni "recommandé" nativement : chaque rangée est
une requête apicalypse distincte, choisie et testée en direct contre l'API
avant intégration plutôt que devinée :

| Rangée | Tri / filtre | Pourquoi |
|---|---|---|
| Recommandé pour toi | `rating desc` avec `rating_count > 200` | Pas de profil utilisateur/historique exploitable (voir §10) → approximation "bien noté avec un volume d'avis significatif", à remplacer par une vraie recommandation personnalisée plus tard |
| Jeux tendances | `total_rating_count desc`, sortis dans les 2 dernières années | "Populaire en ce moment", distinct de "populaire depuis toujours" et de "vient de sortir" |
| Nouveaux jeux | `first_release_date desc`, `rating_count > 20` | Le seuil `rating_count` écarte les sorties trop confidentielles sans exclure les vraies nouveautés |
| Jeux populaires | `total_rating_count desc`, `total_rating_count > 100` | Volume d'avis agrégés = meilleur proxy IGDB de la popularité toutes périodes que `rating` seul (qui favorise les jeux avec très peu d'avis mais tous excellents) |
| Jeux les plus attendus | `hypes desc`, `first_release_date` futur | `hypes` est le champ IGDB conçu spécifiquement pour ce classement (nombre de personnes ayant marqué leur attente) |

"Jeux joués par tes amis" volontairement absent de cette liste : ça suppose
un système de comptes/amis qui n'existe pas encore.

Chaque rangée (`useExploreSection`, `src/hooks/use-explore.ts`) enregistre
au passage les jeux reçus dans le store (`registerCatalogGame`) : un jeu vu
dans Explorer arrive déjà avec son titre/plateforme IGDB, sa fiche n'a donc
pas besoin d'un second aller-retour réseau pour les afficher (contrairement
aux jeux de démonstration de `tracked-games.ts`, qui eux n'ont qu'un titre
de recherche à résoudre — voir §6.1).

### 6.6 Bibliothèque, notes/avis, heures, listes — stockage local ✅

Pas de compte utilisateur/backend (voir §10) : tout ce qui est propre à
l'utilisateur (quels jeux sont dans sa bibliothèque, notes, avis, heures
jouées, appartenance aux listes) vit uniquement sur l'appareil, dans
`src/lib/game-store.tsx` — un contexte React (`GameStoreProvider`, monté à
la racine) persisté via `@react-native-async-storage/async-storage` en un
seul blob JSON, largement suffisant pour le volume de données d'un solo
(quelques dizaines de jeux) ; pas besoin d'une vraie base locale (SQLite)
pour l'instant.

- **`games`** : un jeu par id, `inLibrary` (suivi ou simplement vu/en liste),
  `stopped`, `achievements` (liste nommée, voir §6.3), `favoriteTrackId`
  (référence vers une piste de `tracked-games.ts`, voir §6.4 — jamais la
  piste elle-même dupliquée dans le store), `rating` (0-20, saisi via
  `+`/`−` — pas de demi-point, une note personnelle n'a pas besoin de la
  précision d'une moyenne communautaire) et `review`, et `playSessions` —
  des sessions **datées** (`{ date, hours }`) plutôt qu'un seul total
  cumulé : c'est ce qui permet à l'écran Statistiques de dériver
  Semaine/Mois/Tout (`hoursInPeriod`, `src/lib/hours.ts`) et l'historique
  mensuel/les streaks (`src/lib/play-stats.ts`) à partir de vraies données
  plutôt que d'inventer des chiffres différents pour la même métrique.
  L'action `setTotalHours(id, total)` (le total affiché/modifiable sur la
  fiche jeu, voir §6.6 plus bas) n'écrase pas `playSessions` : elle y
  ajoute une session "correctrice" égale à l'écart avec le total actuel,
  ce qui garde l'historique daté exploitable même quand l'utilisateur
  corrige son total au lieu d'ajouter du temps au fil de l'eau.
- **`lists`** : deux listes intégrées non supprimables (`favoris`,
  `wishlist`) plus les listes créées par l'utilisateur
  (`ListPickerSheet`, depuis le menu ⋯ de la fiche jeu). "Jeux préférés" sur
  le Profil est simplement la liste `favoris` résolue en jeux ; la Wishlist
  est volontairement une liste à part, distincte de la bibliothèque suivie
  — un jeu peut y figurer sans jamais avoir été ajouté à la bibliothèque
  (`inLibrary: false`, `achievements` vide).
- Seedé une seule fois (premier lancement, avant toute écriture
  AsyncStorage) à partir des 6 jeux de `tracked-games.ts` (voir §6.3). Clé
  de stockage versionnée (`gamelary/game-store/v3`) : un changement de forme
  du store (ex. le passage `achievementsUnlocked/Total` → `achievements[]`,
  ou l'ajout de `favoriteTrackId`) change la clé plutôt que de migrer
  l'ancien format — plus simple qu'un vrai système de migrations pour une
  appli sans utilisateurs existants à préserver ; à reconsidérer si l'app a
  de vrais utilisateurs un jour.

`useGame` (`src/hooks/use-game.ts`) fait la jointure entre ce store et IGDB
(titre/plateforme canoniques, §6.1) : le store est la seule source de
vérité pour le rendu, IGDB ne fait qu'y écrire une fois résolu
(`registerCatalogGame`), jamais lu directement par un écran.

### 6.7 Statistiques — dérivées des sessions de jeu ✅

`src/lib/play-stats.ts` calcule, à partir des mêmes `playSessions` que
§6.6 (aucune donnée séparée à maintenir en cohérence) :

- **Complétion** : succès débloqués / total sur tous les jeux suivis.
- **Streak actuel / record** : jours consécutifs avec au moins une session
  enregistrée (n'importe quel jeu), calculés sur l'ensemble des dates
  distinctes — légitimement à 0 sur une installation fraîche, jamais un
  chiffre de démonstration inventé.
- **Répartition mensuelle** : heures par mois de l'année en cours (12
  cases, pas une fenêtre glissante) pour le graphique en barres de
  l'écran Statistiques.
- **Répartition par plateforme** : heures cumulées par `platform` (le champ
  déjà stocké sur chaque jeu) — remplace "genres" (non disponible : IGDB
  fournit bien un champ `genres`, mais il n'est pas encore demandé dans les
  requêtes de `games+api.ts`, et le regrouper aurait demandé un aller-retour
  IGDB supplémentaire par jeu suivi).

## 7. Secrets API : pourquoi un petit backend est nécessaire ✅ (partiel)

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
serveur) et IGDB (`/api/games`, lit `IGDB_CLIENT_ID`/`IGDB_ACCESS_TOKEN`
côté serveur). À répliquer pour Steam (`/api/achievements`) et Spotify
(`/api/music/search`) une fois ces intégrations branchées.

## 8. Stratégie de cache 🚧 (partiel)

Le cache n'est pas uniforme : la volatilité des données diffère selon la
source, donc le TTL (durée de vie) diffère aussi.

| Donnée | Volatilité | Cache prévu |
|---|---|---|
| Recherche IGDB par titre | quasi statique | ✅ cache serveur (`Map`, TTL 30 jours, `games+api.ts`) + cache mémoire client (`useGame`) |
| Rangées Explorer | change modérément (classements, sorties) | ✅ cache serveur (`Map`, TTL 6h, `games+api.ts`) + cache mémoire client (`useExploreSection`), bien plus court que la recherche par titre |
| Jaquettes SteamGridDB | statique | ✅ cache serveur (`Map`, TTL 7 jours, `cover+api.ts`) + cache disque client via `expo-image` (déjà utilisé dans le projet, gère automatiquement mémoire + disque pour les images distantes) + cache mémoire client (`useGameCover`) |
| Bibliothèque/notes/heures/listes | change à chaque interaction utilisateur | ✅ pas un cache réseau — persistance locale directe (AsyncStorage, voir §6.6) |
| Succès Steam | change quand l'utilisateur joue | cache court (quelques minutes) ou rafraîchissement manuel, jamais de cache long 🚧 |
| Recherche Spotify | éphémère, propre à la session de recherche | pas de cache — seule la sélection finale (`{ title, artist }`) sera persistée sur le jeu 🚧 |

Limite assumée du cache serveur actuel : une simple `Map` en mémoire ne
survit pas à un redémarrage et ne serait pas partagée entre plusieurs
instances si l'app scale — suffisant pour une seule instance de dev/démo,
mais à remplacer par un vrai cache partagé (Redis/KV) avant une mise en
production sérieuse.

Côté client, [TanStack Query](https://tanstack.com/query) est envisagé pour
gérer le cache/refetch/état de chargement des appels au backend (pattern
stale-while-revalidate) de façon plus robuste que le `useState`/`useEffect`
actuel de `useGameCover`/`useGame`/`useExploreSection`, plutôt que de
réinventer cette logique à la main dans chaque hook.

## 9. Licence

Le dépôt est public à des fins de démonstration (recherche d'emploi) mais
sans licence open source : `LICENSE` place le code sous "tous droits
réservés" — consultable, mais pas réutilisable sans autorisation.

## 10. État actuel vs feuille de route

**Fait** : scaffold Expo + TypeScript, navigation complète (3 onglets +
piles imbriquées), design system clair/sombre (accent/success, voir §2),
jaquettes réelles via SteamGridDB affichées via un unique composant
`GameCover` de taille fixe (56×74, voir §2 — plus de variation de taille
d'un écran à l'autre), catalogue réel via IGDB (recherche par titre et 5
rangées Explorer), bibliothèque persistée localement (AsyncStorage) avec
suivi (`inLibrary`/"Arrêter de jouer"), bibliothèque en liste compacte
filtrable (Tous/Wishlist/Pas commencé/En cours/Terminé — voir §2), notation
sur 20 + avis texte par jeu, succès nommés et cochables (voir §6.3), heures
jouées **directement modifiables** (total éditable en un tap, voir §6.6 —
agrégées Semaine/Mois/Tout et par mois/plateforme sur l'écran Statistiques,
voir §6.7), bande originale complète par jeu avec sélection de la piste
favorite depuis un vrai sélecteur en liste sur la fiche jeu (voir §6.4),
listes personnalisées (Favoris et Wishlist intégrées + création libre)
accessibles depuis le menu ⋯ de la fiche jeu, recherche IGDB ponctuelle
(`/library/search`, ouverte depuis un bouton icône dédié en bas à droite,
clavier ouvert automatiquement).

**Bugs corrigés** :
- Les liens vers la fiche jeu (rangées Explorer, liste de bibliothèque,
  recherche) construisaient l'URL à la main (`` `/library/${id}` ``) — une
  erreur "Unmatched Route" pouvait en résulter selon l'id. Remplacé partout
  par la forme structurée `{ pathname: '/library/[id]', params: { id } }`,
  qu'expo-router encode et résout lui-même — plus robuste pour un segment
  dynamique.
- `GameCover` acceptait une taille et un style par consommateur (`size`,
  `style`), ce qui avait fini par produire des jaquettes de tailles très
  différentes selon l'écran (Explorer et l'onglet "En cours" de la
  Bibliothèque affichaient des jaquettes plein écran au lieu du format
  compact de la fiche jeu). Corrigé en supprimant ces props : `GameCover`
  n'a plus qu'une seule taille fixe (56×74, rayon 8), non configurable —
  et tous ses consommateurs (`GameList`, `GameShelf`, recherche, fiche jeu)
  ont été audités pour ne plus lui passer d'override.

**Simplifications assumées pour cette itération** :
- Le menu "⋯" de la fiche jeu (Partager/Arrêter de jouer/Ajouter à une
  liste) et la modale de sélection de listes sont des `Modal` React Native
  positionnés approximativement, pas un vrai popover ancré dynamiquement
  (RN n'a pas d'équivalent direct du "clic en dehors pour fermer" du web
  sans mesure de layout supplémentaire).
- Le chevron "›" des rangées Explorer/Profil est pour l'instant purement
  visuel (pas d'écran "voir tout" par section) — non demandé pour cette
  itération.
- Pas de vraie recommandation personnalisée (§6.5) ni de déduplication par
  id IGDB entre le catalogue découvert et `tracked-games.ts` (§6.1).
- "Plateformes les plus jouées" plutôt que "genres" sur l'écran
  Statistiques (voir §6.7) — la donnée existe déjà, pas besoin d'étendre
  les requêtes IGDB pour cette itération.

**Prochaines étapes** : Steam Web API (pré-remplir les succès plutôt que de
remplacer la saisie manuelle, voir §6.3), recherche Spotify in-app pour la
musique préférée (et une vraie pochette au lieu du repère visuel actuel),
cache serveur partagé (Redis/KV) en remplacement de la `Map` en mémoire,
installation effective de Bricolage Grotesque/IBM Plex Mono (`expo-font` +
`@expo-google-fonts/*`, voir §2), éventuellement matcher les jaquettes
SteamGridDB par id IGDB plutôt que par titre (§6.2).
