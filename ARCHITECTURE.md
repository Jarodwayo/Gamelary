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
- **Typographie** ✅ : Bricolage Grotesque (titres/UI) et IBM Plex Mono
  (nombres tabulaires — heures, note, stats) via `@expo-google-fonts/*` +
  `expo-font`. Une famille par poids chargée (`Fonts`, `src/constants/
  theme.ts`) plutôt qu'une seule famille combinée à `fontWeight` : une
  police custom chargée par nom ignore `fontWeight` (contrairement aux
  polices système), donc `ThemedText` choisit directement la bonne famille
  par variante. Chargement via `useFonts` dans `src/app/_layout.tsx`, qui
  ne rend rien tant que les polices ne sont pas prêtes — le splash natif
  reste affiché le temps du chargement plutôt que de montrer un flash de
  police système avant bascule sur la police custom.
- **Carte de jeu** (`src/components/game-cover.tsx`) : trois tailles fixes
  déclarées une seule fois, chacune sans prop `size`/`style` pour la
  moduler au cas par cas — ni ratio approximatif ni gabarits ad hoc par
  écran comme dans une itération précédente, qui avaient fini par produire
  des jaquettes incohérentes (démesurées sur certains écrans) faute d'un
  point de vérité unique par contexte. Les trois partagent la même logique
  de chargement/repli (`CoverImageOrPlaceholder`, factorisée une seule
  fois) : jaquette réelle si `/api/cover` en a trouvé une, sinon
  placeholder coloré + initiales (couleur dérivée d'un hash du titre) —
  avec repli automatique sur ce même placeholder si l'image trouvée existe
  bien mais échoue à charger (`onError`), pas seulement si elle est
  introuvable.
  - **`GameCover`** (56×74, coins 8px) — recherche, fiche jeu : la seule
    à garder une taille strictement fixe en pixels, ces deux écrans ne
    listant jamais plusieurs jeux côte à côte.
  - **`GameCoverGrid`** (`width: 100%`, ratio 2:3, coins 10px) — grille
    murale (`GameGrid`, voir plus bas) : pas de largeur fixe en pixels,
    c'est la grille (3 colonnes fixes partout où elle est utilisée) qui la
    détermine, jamais un appelant au cas par cas.
  - **`GameCoverFeatured`** (140×210, coins 12px) — rangée "Recommandé pour
    toi" d'Explorer (`FeaturedShelf`, voir plus bas), seule mise en avant
    plus grande que le reste.
- **Titres longs** (`formatGameTitle`, `src/lib/game-title.ts`) : beaucoup
  de titres suivent "Titre : Sous-titre" (éditions/remasters/AAA récents) ;
  le retour à la ligne naturel d'un `Text` (au premier espace qui déborde)
  tombait souvent au milieu du sous-titre plutôt qu'après les deux-points,
  illisible dans une carte étroite. Retour à la ligne forcé juste après le
  premier ":" rencontré plutôt que laissé au hasard — jamais de
  `numberOfLines` sur ces titres (un plafond de lignes fixe tronquait un
  sous-titre long en plein mot dès qu'il dépassait la limite), un titre
  long doit toujours se lire en entier.
- **Grille murale** (`GameGrid`, `src/components/game-grid.tsx`) —
  Bibliothèque (tous les onglets) et Explorer (sauf "Recommandé pour toi") :
  3 colonnes, largeur de carte calculée en JS (`useWindowDimensions`,
  pas en `%`) plutôt qu'un `FlatList numColumns` — évite le piège classique
  d'une dernière ligne incomplète qui étire ses 1-2 cartes restantes plus
  large que les autres ; chaque carte garde toujours exactement la même
  largeur, complète ou non. Un simple `View` en `flexWrap` plutôt qu'un
  `FlatList` virtualisé : une bibliothèque perso reste de taille modeste
  (quelques dizaines de jeux), pas besoin de virtualisation, et ça évite
  d'imbriquer un `FlatList` dans le `ScrollView` d'Explorer (avertissement
  React Native classique sur les listes virtualisées imbriquées de même
  orientation). Ni plateforme ni heures affichées sur les cartes Explorer
  (seulement le titre) — Bibliothèque garde les heures jouées quand elles
  sont non nulles, mais plus la plateforme non plus (retirée des deux
  écrans, contrairement à Profil qui la garde, voir plus bas).
- **Rangée horizontale** (`GameShelf`, `src/components/game-shelf.tsx`) —
  Profil ("Jeux joués"/"Jeux préférés") uniquement désormais : titre de
  section en gras, compteur de jeux **sous** le titre (petit texte
  secondaire, comme le ferait un sous-titre — pas à côté sur la même
  ligne : posé à côté, un total se lisait comme une seconde donnée au même
  niveau que le titre plutôt que comme la légende discrète qu'il est) +
  chevron "›" seul sur la droite + scroll horizontal sans indicateur
  visible, plateforme affichée sous le titre (seul contexte à la garder).
  `ScrollView horizontal` plutôt que `FlatList` : ces rangées n'affichent
  jamais qu'une poignée de jeux (aperçu du Profil, pas un parcours
  complet), donc rien à virtualiser — et une `FlatList` imbriquée dans le
  `ScrollView` vertical du Profil s'est révélée moins fiable au geste
  tactile qu'un `ScrollView` simple (voir §10, Bugs corrigés). Prop `size`
  ('small', par défaut — utilisée par "Jeux préférés' — ou 'large' —
  "Jeux joués") : cartes `LargeShelfCard` à la même largeur que `GameGrid`
  (`useGridItemWidth`, exportée depuis `game-grid.tsx` — un seul point de
  vérité pour cette taille, pas une valeur choisie à part), mais toujours
  dans un scroll horizontal, pas une grille qui retourne à la ligne (le
  Profil reste un aperçu) — jamais de scroll forcé quand le contenu tient
  déjà dans la largeur visible (ex. 2 favoris), comportement natif d'un
  `ScrollView` horizontal. `emptyAction` (optionnel) affiche un lien vers
  Explorer sous le message d'état vide — un nouvel utilisateur sans jeu
  joué/favori voit un vrai point de départ plutôt qu'un texte explicatif
  suivi de rien à faire. `FeaturedShelf` (même fichier, toujours une
  `FlatList` — Explorer, pas concerné par ce changement) est la
  variante utilisée par "Recommandé pour toi" sur Explorer : cartes
  `GameCoverFeatured` (plus grandes) avec un badge ("Recommandé") superposé
  sur la jaquette, jamais de plateforme — délibérément distincte de la
  grille des 4 autres rangées Explorer plutôt qu'une carte de plus parmi
  d'autres. Titres de section en accent (`FeaturedShelf`, et les 4 rangées
  génériques d'Explorer) plutôt que la couleur de texte par défaut :
  manquaient de contraste en sombre (blanc/gris clair sur fond quasi noir),
  et l'accent est déjà la couleur du badge "Recommandé"/du cœur favori —
  cohérence en plus de la lisibilité. Les titres de Profil ("Jeux joués"/
  "Jeux préférés") gardent la couleur par défaut, non concernés par ce
  changement.

**`<Link asChild>` et styles dynamiques — piège React Native/expo-router
récurrent** : `Link asChild` clone son enfant direct via `Slot`, qui ne
gère de façon fiable qu'un `style` **objet statique** sur ce enfant. Deux
variantes du même problème rencontrées ce round, sur des composants
différents :
- Un `style` sous forme de **tableau** (`[styles.x, condition && styles.y]`)
  fait planter le rendu web ("You are passing an array of styles to a
  child of `<Slot>`" — voir §10, `GameGrid`).
- Un `style` sous forme de **fonction** (`({pressed}) => ({...})`, même
  quand elle renvoie un objet propre, sans tableau) ne plante pas mais
  applique la largeur/le fond de façon incohérente selon la position de la
  carte dans une liste horizontale (`FlatList horizontal` à l'époque —
  `GameShelf` est passé à `ScrollView` depuis, voir plus haut, mais le
  piège concerne `<Link asChild>` lui-même, pas le conteneur qui l'entoure)
  — chaque carte affectée retombant sur la taille de son propre contenu.
  Trouvé sur
  `LargeShelfCard` (Profil, "Jeux joués" : les cartes rétrécissaient une
  par une après les deux premières) et sur la carte "Temps de jeu" du
  Profil (fond/coins/padding disparus, alors que "Jeux joués" juste à côté,
  un simple `ThemedView` non concerné par `Link asChild`, restait correct).

Le seul pattern vérifié fiable : un objet **littéral**, calculé à chaque
rendu si besoin (`{ ...styles.x, largeurDynamique }`), jamais enveloppé
dans un tableau ni dans une fonction — au prix de renoncer au retour
visuel "opacité au clic" (`pressed`) sur ces cartes précises, qui n'a pas
paru essentiel comparé à la fiabilité de la mise en page. `GameGridCard`
(`game-grid.tsx`) suit ce pattern depuis le début et n'a jamais eu ce
problème ; `ShelfCard`/`LargeShelfCard`/`FeaturedCard`
(`game-shelf.tsx`) et la carte "Temps de jeu" du Profil ont été alignés
dessus après coup.

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
  data/                accès aux données (tracked-games.ts = catalogue curaté, API pour le reste)
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
  canoniques des jeux curatés de `tracked-games.ts`, et par
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
URLs, cohérent avec les ids en dur de `tracked-games.ts`. `resolveCatalogId`
(`src/data/tracked-games.ts`) évite la duplication que ça pourrait
provoquer : un jeu découvert dans Explorer ou par recherche dont le titre
IGDB correspond (insensible à la casse) à l'`igdbTitle` d'une entrée
`tracked-games.ts` (ex. `zelda-botw`, dont le titre IGDB complet donnerait
un tout autre slug) rejoint l'id existant au lieu d'en créer un second —
utilisé à la fois par `games+api.ts` (rangées Explorer) et
`library/search.tsx`, seuls deux endroits qui dérivent un id depuis un
titre IGDB.

Chaque jeu retourné porte aussi `steamAppId` (voir §6.2) quand IGDB en
référence un, résolu via les `external_games` d'IGDB (source id 1 =
Steam, voir `GET /external_game_sources`) — c'est ce même champ qui sert de
correspondance exacte pour la jaquette SteamGridDB.

### 6.2 Jaquettes — SteamGridDB ✅

[SteamGridDB](https://www.steamgriddb.com/api/v2) plutôt que les covers
IGDB par défaut : base communautaire spécialisée dans l'artwork (grids,
covers, hero images) avec plusieurs styles par jeu et une meilleure qualité
moyenne que les jaquettes génériques d'IGDB.

Flux : `src/app/api/cover+api.ts` (route serveur — voir §7) essaie d'abord
une correspondance **exacte** par app id Steam quand `steamAppId` est fourni
(`/games/steam/:appid`, voir §6.1 pour sa résolution via IGDB), puis
retombe sur la recherche floue par titre (`/search/autocomplete`, premier
résultat) si l'app id est absent ou introuvable côté SteamGridDB (jeu hors
Steam, ex. exclusivité console). Les deux chemins récupèrent ensuite les
grids au format portrait 600×900 (`/grids/game/:id`) et renvoient l'URL de
la meilleure. `GameCover` (`src/components/game-cover.tsx`) appelle cette
route via le hook `useGameCover` et affiche l'image avec `expo-image` ; le
placeholder coloré (hash déterministe du titre + initiales) reste l'état de
repli permanent (chargement, jeu introuvable sur SteamGridDB, erreur
réseau) — pas juste une étape temporaire du projet.

Correspondance par id IGDB envisagée puis abandonnée après test en
direct : SteamGridDB ne l'expose pas (`/games/igdb/:id` renvoie
systématiquement "Game not found", y compris pour des jeux très populaires
comme Hollow Knight ou Elden Ring), malgré le nom de la route qui le
laisserait penser. En revanche IGDB référence lui-même l'app id Steam de
chaque jeu dans `external_games` (source id 1), et `/games/steam/:appid`
de SteamGridDB fonctionne de façon fiable (vérifié en direct) — d'où ce
détour par Steam plutôt qu'IGDB directement. Limite résiduelle : un jeu
sans app id Steam (exclusivité console) retombe toujours sur la recherche
floue par titre, sans désambiguïsation.

### 6.3 Succès — saisie manuelle ✅, pré-remplissage Steam ✅

`ISteamUserStats/GetPlayerAchievements` donne les succès débloqués, mais
**uniquement pour les jeux Steam PC** liés au compte Steam de l'utilisateur
(pas d'équivalent public pour PSN/Xbox) — donc pas suffisant comme unique
source pour une appli multi-plateforme. L'utilisateur reste donc libre de
construire lui-même sa liste de succès **nommés** sur la fiche jeu
(`+ Ajouter un succès`) et de les cocher au fur et à mesure : `Achievement`
(`src/types/game.ts`) est `{ id, name, unlocked }`, pas juste un ratio —
afficher *quel* succès manque est plus utile qu'un simple "28/42".
`achievementsUnlocked`/`achievementsTotal` restent exposés sur `Game`
(comptage de la liste, dérivé dans `useGame` — jamais stocké séparément,
donc jamais désynchronisable) pour les écrans qui n'ont besoin que du
total (Profil, Statistiques, filtres de bibliothèque).

**Pré-remplissage Steam** — [gamelary-api](https://github.com/Jarodwayo/gamelary-api),
un **second projet** Node.js/Express séparé de Gamelary, pas une route
`expo-router` de plus. Raison : contrairement à IGDB/SteamGridDB (en-tête
`Authorization: Bearer`/`Client-ID`), la Steam Web API n'accepte sa clé
**qu'en paramètre d'URL** (`?key=...`), un mode que le système
d'identifiants managés utilisé pour ce projet ne sait pas injecter —
d'où ce petit service à part, où `STEAM_API_KEY` est une variable
d'environnement classique lue par le code (voir le README de ce repo pour
le détail et le déploiement Render). `GET /api/steam/achievements?appid=&
steamid=` y fusionne `GetSchemaForGame` (noms/descriptions) et
`GetPlayerAchievements` (état débloqué) en la forme attendue par
`Achievement`, avec un cache Redis partagé (`REDIS_URL`, voir §8) — schéma
7 jours, succès du joueur 5 minutes — et repli automatique sur une `Map`
en mémoire si Redis est injoignable, jamais de requête en échec pour une
panne de cache.

Côté Gamelary : `store.settings.steamId64` (Profil, "Lier mon compte
Steam" — pas de vraie authentification, l'utilisateur colle lui-même son
SteamID64) et `Game.steamAppId` (§6.1) sont les deux informations
nécessaires pour appeler ce backend. `steamApiUrl` (`src/lib/
steam-api-url.ts`) résout son URL depuis `EXPO_PUBLIC_STEAM_API_URL`
(valeur publique — juste l'URL Render, jamais un secret) et renvoie `null`
tant qu'elle n'est pas configurée : le bouton "Pré-remplir depuis Steam"
de la fiche jeu ne s'affiche que si les trois conditions sont réunies
(app id Steam connu, compte lié, backend déployé), sinon la saisie
manuelle reste le seul chemin, exactement comme avant cette intégration.
`store.importAchievements` **remplace** entièrement la liste par celle de
Steam (source faisant autorité une fois le compte lié) plutôt que de la
fusionner avec les entrées manuelles, avec un id dérivé de l'`apiname`
Steam (stable) pour qu'un second import ne duplique rien. Remplacer étant
irréversible pour des succès cochés à la main, une confirmation
(`Alert.alert`) s'affiche avant l'import **seulement** si la liste actuelle
n'est pas vide — un premier import sur un jeu sans succès suivis n'a rien à
perdre, pas besoin de confirmer. Pendant l'import, un `ActivityIndicator`
accompagne le libellé déjà explicite du bouton (délai possible au réveil
du service, voir plus bas).

Statut réel : `gamelary-api` est poussé sur GitHub, déployé sur Render
(`https://gamelary-api.onrender.com`) et **vérifié fonctionnel de bout en
bout sur appareil réel** — `EXPO_PUBLIC_STEAM_API_URL` configurée côté
Gamelary (`.env` à la racine — valeur publique, pas un secret, voir
`src/lib/steam-api-url.ts`), import de vrais succès depuis un vrai compte
Steam confirmé. Seul point notable : le premier import après une période
d'inactivité peut prendre jusqu'à une minute (mise en veille de l'offre
gratuite Render, le service redémarre au premier appel) — signalé
explicitement dans le libellé du bouton pendant l'import plutôt que de
laisser l'utilisateur croire à un blocage. Ce comportement n'a pas pu être
observé depuis ce sandbox : son proxy réseau n'autorise que
`api.igdb.com`/`www.steamgriddb.com` en sortie, pas `onrender.com`.

### 6.4 Musique préférée — liste + sélection ✅, Spotify Web API ❌ abandonné

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
flow *Client Credentials*) aurait permis de peupler `tracks`
automatiquement depuis le vrai catalogue Spotify au lieu d'une liste
saisie en dur. Tentative faite puis abandonnée : la création d'app Spotify
Developer a été bloquée ("Your application is blocked from accessing the
Web API since you do not have a Spotify Premium subscription") malgré le
fait que seule l'API de recherche était visée, jamais la lecture — Spotify
semble désormais exiger Premium même pour ce flow, contrairement à ce qui
était attendu. Décision : abandonné plutôt que de dépendre d'un abonnement
payant pour une fonctionnalité annexe.

En remplacement : sélection **manuelle et curatée** — vrais titres/
compositeurs vérifiés (pas de placeholder du type "Track 1"), saisis à la
main dans `tracked-games.ts` pour chaque jeu couvert, plutôt qu'une API.
Limite assumée : ça ne peut couvrir que les jeux effectivement curatés là
(10 actuellement : Hollow Knight, Elden Ring, Celeste, Hades, Zelda BOTW,
Stardew Valley, The Witcher 3: Wild Hunt, Undertale, Cuphead, Journey,
choisis pour la fiabilité de leurs informations publiques), pas les jeux
découverts via Explorer/recherche en dehors de cette liste (`Game.tracks`
reste vide pour eux, voir `useGame`) — élargir cette liste reste une simple
question de temps de curation, pas un obstacle technique. Ces dix jeux
n'ont qu'une bande originale/des succès curatés prêts si l'utilisateur les
rencontre via Explorer/recherche — plus aucun n'est ajouté d'office à une
bibliothèque de démo : ce mécanisme (`demoSeed`) a été retiré avec le reste
du mode "essayer sans compte" (voir §9.7).

### 6.5 Explorer — 5 rangées IGDB ✅

IGDB n'expose ni "tendance" ni "recommandé" nativement : chaque rangée est
une requête apicalypse distincte, choisie et testée en direct contre l'API
avant intégration plutôt que devinée :

| Rangée | Tri / filtre | Pourquoi |
|---|---|---|
| Recommandé pour toi | `rating desc` avec `rating_count > 200`, filtré sur la plateforme la plus fréquente de la bibliothèque suivie quand elle est connue | Pas de compte/historique serveur (voir §10), mais la bibliothèque locale donne un vrai signal (voir plus bas) plutôt qu'un classement générique identique pour tout le monde |
| Jeux tendances | `total_rating_count desc`, sortis dans les 2 dernières années | "Populaire en ce moment", distinct de "populaire depuis toujours" et de "vient de sortir" |
| Nouveaux jeux | `first_release_date desc`, `rating_count > 20` | Le seuil `rating_count` écarte les sorties trop confidentielles sans exclure les vraies nouveautés |
| Jeux populaires | `total_rating_count desc`, `total_rating_count > 100` | Volume d'avis agrégés = meilleur proxy IGDB de la popularité toutes périodes que `rating` seul (qui favorise les jeux avec très peu d'avis mais tous excellents) |
| Jeux les plus attendus | `hypes desc`, `first_release_date` futur | `hypes` est le champ IGDB conçu spécifiquement pour ce classement (nombre de personnes ayant marqué leur attente) |

**Recommandation personnalisée** : sans compte/backend, pas d'historique
serveur à exploiter — mais `useExploreSection` calcule côté client la
plateforme la plus fréquente parmi les jeux suivis (`store.games`,
`inLibrary`) et la transmet en `?platform=` à `/api/games?section=
recommended`, qui l'ajoute au filtre apicalypse (`platforms.name = "..."`).
Repli sur le classement générique (sans filtre) si la bibliothèque est
vide/sans plateforme dominante, ou si le filtre ne renvoie aucun résultat
(plateforme trop confidentielle pour un jeu à la fois bien noté et
massivement commenté) — jamais de rangée vide. Testé en direct : filtrer
sur "Wii U" change effectivement le classement (titres Nintendo), la clé de
cache (serveur et client) intègre la plateforme pour ne jamais mélanger les
résultats de deux utilisateurs aux bibliothèques différentes.

"Jeux joués par tes amis" volontairement absent de cette liste : ça suppose
un système de comptes/amis qui n'existe pas encore.

Affichage : "Recommandé pour toi" seule à rester une rangée horizontale
mise en avant (`FeaturedShelf`), les 4 autres rejoignent une grille murale
(`GameGrid`) — voir §2 pour le détail des deux composants.

Chaque rangée (`useExploreSection`, `src/hooks/use-explore.ts`) enregistre
au passage les jeux reçus dans le store (`registerCatalogGame`) : un jeu vu
dans Explorer arrive déjà avec son titre/plateforme IGDB, sa fiche n'a donc
pas besoin d'un second aller-retour réseau pour les afficher (contrairement
aux jeux curatés de `tracked-games.ts`, qui eux n'ont qu'un titre de
recherche à résoudre — voir §6.1).

### 6.6 Bibliothèque, notes/avis, heures, listes — stockage local ✅

Pas de compte utilisateur/backend (voir §10) : tout ce qui est propre à
l'utilisateur (quels jeux sont dans sa bibliothèque, notes, avis, heures
jouées, appartenance aux listes) vit uniquement sur l'appareil, dans
`src/lib/game-store.tsx` — un contexte React (`GameStoreProvider`, monté à
la racine) persisté via `@react-native-async-storage/async-storage` en un
seul blob JSON, largement suffisant pour le volume de données d'un solo
(quelques dizaines de jeux) ; pas besoin d'une vraie base locale (SQLite)
pour l'instant.

`@react-native-async-storage/async-storage` est épinglé à **exactement**
`2.2.0` dans `package.json` (pas de `^`) : les 3.x cassent le module natif
sous Expo Go/SDK 57 sur appareil réel (`AsyncStorageError: Native module is
null, cannot access legacy storage`), un incompatibilité confirmée côté
Expo pour SDK 54+ — `2.2.0` est la version que `node_modules/expo/
bundledNativeModules.json` (la même source que lirait `expo install`) donne
comme compatible avec ce SDK. Ne pas remonter cette version, même vers une
release apparemment plus récente, sans avoir d'abord vérifié qu'Expo la
liste comme compatible avec le SDK alors utilisé par le projet.

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
  (`inLibrary: false`, `achievements` vide). Bascule directe pour `favoris`
  spécifiquement : icône cœur sur la fiche jeu (`toggleListMembership
  ('favoris', id)`), en plus de l'entrée générique "Ajouter à une liste" du
  menu ⋯ — sans ce bouton dédié, marquer un favori demandait de passer par
  le sélecteur de listes complet pour une action très fréquente.
- **`settings`** : réglages globaux, pas propres à un jeu — pour l'instant
  seulement `steamId64` (Profil, "Lier mon compte Steam"), utilisé pour
  appeler `gamelary-api` (voir §6.3). Pas une vraie authentification :
  l'utilisateur colle lui-même son SteamID64, jamais vérifié.
- Bibliothèque vide au premier lancement (avant toute écriture AsyncStorage) :
  plus de bibliothèque de démo préchargée depuis `tracked-games.ts` (voir
  §6.3 et §6.4) — retiré avec le reste du mode "essayer sans compte" (§9.7),
  la connexion étant désormais un prérequis pour atteindre cet écran. Clé
  de stockage versionnée (`gamelary/game-store/v5`) : un changement de forme
  du store (ex. le passage `achievementsUnlocked/Total` → `achievements[]`,
  l'ajout de `favoriteTrackId`, `steamAppId` ou `settings`) change la clé
  plutôt que de migrer l'ancien format — plus simple qu'un vrai système de
  migrations pour une appli sans utilisateurs existants à préserver ; à
  reconsidérer si l'app a de vrais utilisateurs un jour.

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
côté serveur). **Steam fait exception** : sa clé ne s'accepte qu'en
paramètre d'URL, incompatible avec les identifiants managés de cet
environnement, d'où un service Express séparé
([gamelary-api](https://github.com/Jarodwayo/gamelary-api), voir §6.3)
plutôt qu'une route `+api.ts` de plus. Spotify n'a pas de route et n'en
aura pas : l'intégration est abandonnée (voir §6.4).

### 7.1 Exposition de ces backends : CORS et rate limiting ✅

Ces routes n'ont **aucune authentification** — il n'y a pas de compte
(voir §9) — et acceptent toutes les origines. Sans autre garde-fou,
n'importe quel site tiers peut donc faire consommer le quota IGDB /
SteamGridDB / Steam de ce déploiement par ses propres visiteurs. Le
garde-fou retenu est une limite par IP, la même des deux côtés :

| Route | Limite | Implémentation |
|---|---|---|
| `/api/games` (IGDB) | 30 req/min par IP | `createRateLimiter` (`src/lib/rate-limit.ts`), seau dédié |
| `/api/cover` (SteamGridDB) | 120 req/min par IP | Même `createRateLimiter`, seau **séparé** et bien plus haut — voir plus bas |
| `/api/steam/*` (gamelary-api) | 30 req/min par IP | `express-rate-limit`, monté une seule fois sur le préfixe |

Quatre points appris en chemin, tous vérifiés par des tests :

- **Le limiteur monté sur chaque routeur plutôt que sur le préfixe compte
  double.** Monté deux fois sur `/api/steam`, une requête vers `/games`
  traversait les deux montages : bloquée à la 16ᵉ requête au lieu de la
  31ᵉ, pour une limite pourtant annoncée identique à celle
  d'`/achievements`.
- **`trust proxy` est indispensable derrière Render.** Sans lui,
  `express-rate-limit` lit l'IP du reverse proxy et met tous les visiteurs
  dans le même seau. Réglé à `1` (le premier hop uniquement), jamais à
  `true` : faire confiance à un `X-Forwarded-For` arbitraire laisserait
  n'importe qui se forger une IP et contourner la limite.
- **Le premier élément de `X-Forwarded-For` est contournable, côté
  `games+api.ts`/`cover+api.ts` cette fois.** Cet en-tête est une liste
  "client, proxy1, proxy2..." où le PREMIER élément est écrit par
  l'appelant lui-même — le lire revenait à offrir un compteur vierge à
  quiconque envoie une valeur au hasard. Le proxy le plus proche AJOUTE
  l'IP réellement vue à la **fin** : c'est le dernier élément qu'il faut
  lire (`clientIp`, `src/lib/rate-limit.ts`), même hypothèse d'un seul hop
  de confiance que `trust proxy: 1` côté gamelary-api.
- **Deux routes au profil d'usage différent ne doivent pas partager un
  seau.** `/api/cover` part en éventail depuis un seul écran (Explorer
  demande jusqu'à 50 jaquettes d'un coup) : la limite de `/api/games`
  (30/min) y aurait cassé l'écran au lieu de simplement le protéger, d'où
  un seau séparé et une limite plus haute (120/min) plutôt que la même
  valeur partout par défaut.

Limites assumées à ce stade : un compteur en mémoire ne tient pas derrière
plusieurs instances serverless (même limite que le cache, voir §8), et une
limite par IP ne remplace pas une limite par utilisateur — impossible
avant les comptes (voir §9.6).

## 8. Stratégie de cache 🚧 (partiel)

Le cache n'est pas uniforme : la volatilité des données diffère selon la
source, donc le TTL (durée de vie) diffère aussi.

| Donnée | Volatilité | Cache prévu |
|---|---|---|
| Recherche IGDB par titre | quasi statique | ✅ cache serveur (`Map`, TTL 30 jours, `games+api.ts`) + cache mémoire client (`useGame`) |
| Rangées Explorer | change modérément (classements, sorties) | ✅ cache serveur (`Map`, TTL 6h, `games+api.ts`) + cache mémoire client (`useExploreSection`), bien plus court que la recherche par titre |
| Jaquettes SteamGridDB | statique | ✅ cache serveur (`Map`, TTL 7 jours, `cover+api.ts`) + cache disque client via `expo-image` (déjà utilisé dans le projet, gère automatiquement mémoire + disque pour les images distantes) + cache mémoire client (`useGameCover`) |
| Bibliothèque/notes/heures/listes | change à chaque interaction utilisateur | ✅ pas un cache réseau — persistance locale directe (AsyncStorage, voir §6.6) |
| Schéma des succès Steam (noms/descriptions) | quasi statique | ✅ cache serveur Redis, TTL 7 jours (`gamelary-api`, voir §6.3) |
| Succès débloqués du joueur | change quand l'utilisateur joue | ✅ cache serveur Redis, TTL 5 minutes (`gamelary-api`, voir §6.3) |
| Bibliothèque Steam + temps de jeu du joueur | change quand l'utilisateur joue | ✅ cache serveur Redis, TTL 5 minutes (`gamelary-api`) — **même volatilité que les succès débloqués, donc même TTL** plutôt qu'une troisième valeur choisie séparément |
| Résolution inverse app id Steam → jeu IGDB | statique (la correspondance ne change pas) | ✅ cache serveur (`Map`, TTL 30 jours, `games+api.ts`, mode `?steamAppId=`) |

Règle transverse à tous ces caches : **une réponse en erreur n'est jamais
mise en cache** (l'écriture n'a lieu qu'après une réponse amont réussie),
sinon un incident passager côté Steam ou IGDB resterait collé pendant tout
le TTL. Corollaire assumé côté Steam : une réponse *légitimement* vide
(profil privé → `{ "games": [] }`, voir §6.3) est, elle, mise en cache comme
une réponse normale — repasser son profil en public reste donc sans effet
visible jusqu'à expiration du TTL de 5 minutes.

Limite assumée du cache serveur de Gamelary lui-même (`games+api.ts`/
`cover+api.ts`) : une simple `Map` en mémoire ne survit pas à un
redémarrage et ne serait pas partagée entre plusieurs instances si l'app
scale — suffisant pour une seule instance de dev/démo, mais à remplacer
par un vrai cache partagé (Redis/KV) avant une mise en production
sérieuse ; voir §10 pour le detail de ce qui bloque encore ça ici.
`gamelary-api` (repo séparé, voir §6.3) n'a plus cette limite : son cache
Redis est déjà branché et testé.

Côté client, [TanStack Query](https://tanstack.com/query) est envisagé pour
gérer le cache/refetch/état de chargement des appels au backend (pattern
stale-while-revalidate) de façon plus robuste que le `useState`/`useEffect`
actuel de `useGameCover`/`useGame`/`useExploreSection`, plutôt que de
réinventer cette logique à la main dans chaque hook.

## 9. Comptes, authentification et synchronisation 🚧

Toute la donnée utilisateur vit aujourd'hui sur l'appareil (AsyncStorage,
§6.6) : pas de sauvegarde, rien à récupérer en changeant de téléphone, et
aucune fonctionnalité sociale possible. C'est le manque structurant qui
sépare ce projet d'un vrai produit.

### 9.1 Décisions prises

- **Supabase** (Postgres managé + auth + Row Level Security). Retenu contre
  un backend maison pour arriver à quelque chose d'utilisable ; et contre
  Firebase parce que la donnée reste du **SQL standard**, donc portable si
  le service devient un jour un mauvais choix.
- **Trois méthodes, aucune vérification par téléphone** : Google OAuth,
  e-mail + mot de passe (n'importe quel fournisseur — Gmail, Outlook,
  Yahoo...), et lien magique par e-mail (voir §9.7 pour l'écran des trois,
  ajouté en session 4). Pas de téléphone : l'authentification Google
  fournit déjà une identité vérifiée et unique, le SMS coûte de l'argent
  chez tous les fournisseurs sérieux, ajoute de la friction à l'inscription,
  et ne protège de rien tant qu'il n'y a ni fonctionnalité sociale ni abus à
  contenir. À rouvrir si l'un des deux arrive.
- **L'offline-first est conservé.** AsyncStorage reste la copie de travail
  et la source de vérité de l'affichage ; Supabase est une **cible de
  synchronisation**, pas la source lue à chaque rendu. Sans ça, l'app
  cesserait de fonctionner hors réseau — une régression, pas une évolution.
  Ne pas confondre avec le point suivant : offline-first veut dire qu'un
  utilisateur **déjà connecté** reste fonctionnel sans réseau, pas qu'on
  peut utiliser l'app sans jamais se connecter.
- **La connexion est désormais un prérequis, plus une option.** Décision
  produit prise en session 3 (voir §9.7) : accéder aux onglets
  (Bibliothèque/Explorer/Profil) exige `signedIn`, ce qui a supprimé du
  même coup la bibliothèque de démonstration préchargée au premier
  lancement (`demoSeed`, `tracked-games.ts`) — elle n'a plus de raison
  d'être puisqu'il n'existe plus de mode "essayer sans compte" auquel
  l'amorcer. Conséquence assumée : une build **sans** clés Supabase
  configurées (`unconfigured`, voir §9.7) est désormais **entièrement
  inutilisable** (écran de chargement/message figé, jamais les onglets) —
  avant cette décision, cette même build restait pleinement fonctionnelle
  en local. C'est un changement de comportement volontaire, pas un oubli :
  à rouvrir si un mode démo/vitrine redevient nécessaire (ex. capture
  d'écran pour ce même dépôt public de démonstration).
- **Les trois méthodes de connexion sont visibles dès le premier affichage
  (session 4)** — aucune cachée derrière le Profil ou une option
  secondaire : Google (bouton plein), e-mail + mot de passe (ouvre un
  second temps avec bascule créer un compte / se connecter), lien magique
  par e-mail (inchangé, juste remonté au même niveau visuel que les deux
  autres). Détail en §9.7.
- **Réinitialisation de mot de passe (session 5), même mécanisme de lien
  profond que le lien magique** — pas un second système à maintenir :
  `resetPasswordForEmail` réutilise la même URL de redirection
  (`authRedirectUrl` -> `/profile/sign-in`) et le même intercepteur des
  deux côtés (`detectSessionInUrl` sur web, `completeSignInFromCode` sur
  natif). Le SDK distingue lui-même les deux liens à l'échange du code
  (`PASSWORD_RECOVERY` vs `SIGNED_IN`, décidé localement, jamais par ce
  code applicatif) — nouveau statut `passwordRecovery` dans `AuthStatus`
  pour ne pas laisser passer directement aux onglets sans le formulaire
  "nouveau mot de passe". Détail en §9.7.

### 9.2 Trois obstacles dans le modèle local actuel

Constats vérifiés dans le code, pas des hypothèses — et ce sont eux qui
dictent le schéma distant, pas l'inverse.

1. **Il n'existe aucune identité stable pour un jeu.** ✅ *corrigé, voir
   9.3.1.* L'id est un slug dérivé du titre (`resolveCatalogId`, §6.1) et
   l'**id numérique IGDB n'était ni lu ni stocké**. Précision apportée
   depuis, la première rédaction de ce point étant inexacte : IGDB renvoie
   `id` **systématiquement**, y compris quand le `fields` apicalypse ne le
   mentionne pas (vérifié en direct contre l'API). Il était donc déjà dans
   chaque réponse, simplement jamais typé, jamais lu, jamais persisté — le
   travail manquant était entièrement de notre côté, pas dans la requête.
   Conséquence tant que c'était le cas : deux appareils qui résolvent un
   titre légèrement différemment produisent deux ids pour le même jeu, et
   un renommage côté IGDB casse la correspondance.
2. **Aucune entité ne porte d'horodatage.** Ni `createdAt` ni `updatedAt`,
   nulle part. Une résolution de conflit "le plus récent gagne" est donc
   **littéralement impossible** sur les données déjà écrites : on ne peut
   arbitrer qu'en gros ("l'appareil gagne" ou "le serveur gagne").
3. **Les ids de succès manuels contiennent un timestamp**
   (`makeAchievementId` : `${gameId}:${slug}-${Date.now()}`). Le même succès
   saisi à la main sur deux appareils produit deux ids différents, donc des
   doublons à la fusion. Les succès importés de Steam, eux, ont un id
   déterministe (`${gameId}:steam:${apiname}`) : c'est le bon modèle, il
   n'est simplement pas appliqué au cas manuel.

S'ajoute la politique documentée en §6.6 : un changement de forme du store
**change la clé de version plutôt que de migrer** (`gamelary/game-store/v5`).
Acceptable pour une app sans utilisateurs ; avec des comptes, c'est une
perte de données silencieuse à chaque évolution du schéma.

### 9.3 Prérequis à poser avant tout compte ✅

Ces six points coûtaient peu tant qu'aucun compte n'existe et devenaient
**impossibles à rattraper** ensuite : une donnée écrite sans horodatage n'en
aura jamais un a posteriori, et un jeu enregistré sans id IGDB devrait être
re-résolu à l'aveugle depuis son titre. Ils sont faits — aucun n'apporte
quoi que ce soit de visible dans l'app aujourd'hui, c'est bien pour ça
qu'ils ont chacun leurs tests.

1. ✅ **Id numérique IGDB** stocké (`StoredGame.igdbId`, `CatalogGame.igdbId`),
   alimenté par les trois chemins qui enregistrent un jeu : rangées
   Explorer, recherche par titre, résolution inverse depuis un app id
   Steam. Transporté **à côté** du slug local, jamais à sa place — les ids
   de `tracked-games.ts` sont écrits en dur, et le schéma distant conserve
   lui aussi les deux (§9.4 : `igdb_id` et `slug`).
   Deux règles non évidentes, chacune testée : une résolution qui ne rapporte
   pas d'id **n'efface jamais** celui déjà connu, et la garde « rien n'a
   changé » de `registerCatalogGame` compare l'id **résultant** — sans quoi
   les jeux enregistrés avant l'introduction du champ ne l'auraient jamais
   obtenu.
2. ✅ **`updatedAt` par jeu**, posé par un unique chemin d'écriture
   (`updateGame`, `game-store.tsx`) plutôt que recopié dans chacune des
   neuf actions : l'oublier dans une seule ne ferait rien échouer, ça
   rendrait juste faux l'arbitrage de §9.5 bien plus tard. Symétriquement,
   une action qui ne change rien **n'horodate pas** — sinon un appareil qui
   se contente de relire sa bibliothèque gagnerait l'arbitrage « le plus
   récent gagne » face à un appareil ayant réellement modifié la donnée.
   Les listes ne sont volontairement pas horodatées : elles fusionnent par
   union (§9.5) et leur table distante ne porte pas d'`updated_at` (§9.4).
3. ✅ **Ids de succès manuels déterministes**, dérivés du nom normalisé
   comme le sont déjà ceux venant de Steam, avec un suffixe d'ordre dès la
   deuxième occurrence d'un même nom (deux succès homonymes dans un même
   jeu existent réellement — `addAchievement` n'impose aucune unicité).
4. ✅ **Migrations de forme** à la place du bump-de-clé destructif, avec la
   version stockée *dans* le blob (`store-migrations.ts`).
5. ✅ **`steamAppId` protégé au même titre que l'id IGDB** :
   `registerCatalogGame` remplaçait encore le `steamAppId` connu par
   `undefined` quand une résolution n'en rapportait pas (relevé en §9.6,
   laissé ouvert le temps du point 1 pour ne pas élargir ce chantier-là).
   Même correctif que pour `igdbId` — repli sur la valeur déjà connue,
   garde « rien n'a changé » comparée sur la valeur résultante — et pour
   la même raison : un rafraîchissement dégradé ne doit jamais faire
   perdre une identité externe déjà établie.
6. ✅ **`steam_id64` horodaté** (`Settings.steamId64UpdatedAt`,
   `game-store.tsx`), à côté du champ plutôt que via `updateGame` — ce
   dernier n'a aucune notion de « jeu » ici, la ligne `profiles` distante
   (§9.4) est une entité différente de `user_games`. Seul `steam_id64` en
   a besoin pour l'instant : `profile` (nom, identifiant, bio, photo,
   arrière-plan) et `titleArtwork` n'ont pas encore de colonne distante
   (§9.4), leur politique de fusion reste à trancher séparément — les
   horodater maintenant reviendrait à deviner un arbitrage que le schéma
   ne définit pas encore.

### 9.4 Schéma distant (Postgres / Supabase) ✅ écrit et vérifié

Row Level Security sur **les six tables** — c'est ce qui remplace la
logique d'autorisation qu'on écrirait à la main dans un backend classique.
Deux précisions qui ont leur importance, la première rédaction de cette
section étant fausse sur les deux points (elle affirmait que « toutes les
tables portent `user_id` » et n'activait RLS que sur `user_games`) :

- **Toutes ne portent pas `user_id`.** `achievements`, `play_sessions` et
  `list_games` pendent à un parent (`user_game_id`, `list_id`) ; leur
  politique doit donc remonter au parent, la comparaison directe
  `user_id = auth.uid()` ne s'y applique pas.
- **Oublier `enable row level security` sur une table ne la protège pas
  « par défaut » : ça la laisse grande ouverte.** Exposée via PostgREST,
  une table sans RLS est lisible ET modifiable par n'importe quel compte
  authentifié — donc par n'importe quel autre utilisateur de l'app. Cinq
  tables sur six étaient dans ce cas dans la version précédente de ce
  schéma.

Le SQL complet (tables, policies, et deux ajouts absents de la première
rédaction — voir plus bas) vit maintenant dans
[`supabase/migrations/20260910120000_initial_schema.sql`](supabase/migrations/20260910120000_initial_schema.sql)
plutôt que dupliqué ici : un schéma et sa documentation qui divergent
silencieusement est pire qu'une documentation absente — ce fichier est
l'unique source de vérité, celle-ci n'en donne que le résumé et le
raisonnement.

Deux manques que la première rédaction de cette section n'avait pas comblés
(elle citait l'indexation comme un « à faire », sans l'écrire ; l'autre
n'était même pas mentionné) :

- **Index sur les colonnes de rattachement des tables filles**
  (`achievements.user_game_id`, `play_sessions.user_game_id`,
  `list_games.user_game_id`) — sans eux, chaque ligne lue déclenche un scan
  complet de la table parent pour évaluer la policy RLS (le sous-select
  `exists (...)`), et chaque suppression en cascade fait de même.
- **`updated_at` n'avance jamais tout seul.** `default now()` ne s'applique
  qu'à l'INSERT ; sans trigger, la colonne resterait figée à la date de
  création pour toujours, rendant l'arbitrage « le plus récent gagne » du
  §9.5 systématiquement faux dès la première modification — un bug qu'aucune
  ligne de ce document ne signalait avant que le fichier de migration ne
  soit réellement écrit. Un trigger partagé (`set_updated_at`) couvre les
  trois tables concernées (`profiles`, `user_games`, `achievements` —
  `play_sessions`/`lists`/`list_games` n'ont pas cette colonne : append-only
  ou fusion par union, rien à arbitrer par date).

Un troisième ajout, qui ne comblait pas un manque documenté mais s'est
avéré nécessaire à l'usage : un trigger sur `auth.users` (`handle_new_user`,
`security definer` avec `search_path` figé) crée la ligne `profiles`
correspondante à l'inscription, plutôt que de compter sur un upsert
applicatif après coup qui pourrait échouer en silence et laisser un compte
sans profil.

**Vérifié pour de vrai, pas seulement relu** : ce fichier de migration a
été appliqué tel quel à un Postgres 16 local (schéma `auth` minimal simulé,
`auth.uid()` lisant une variable de session pour changer d'identité à
volonté), puis 20 vérifications ont tourné dessus — deux utilisateurs
simulés, chacun lisant/écrivant ses propres lignes sur les six tables, et
échouant (comme attendu) à lire ou modifier celles de l'autre, y compris en
tentant un INSERT côté table fille rattaché au jeu d'autrui (le cas que
`with check` existe pour bloquer) ; le trigger `updated_at` observé en train
d'avancer réellement après un UPDATE ; les suppressions en cascade et la
contrainte d'unicité `(user_id, igdb_id)` vérifiées de la même façon. Toutes
passent — le détail exact de ce qui a été testé est dans l'en-tête du
fichier de migration lui-même.

Ce qui n'est **pas** vérifié, faute d'un vrai projet Supabase à ce stade :
que les rôles `anon`/`authenticated` d'un projet réel reçoivent bien par
défaut les mêmes privilèges de table que ceux accordés à la main pour ce
test (Supabase les pose normalement automatiquement à la création du
projet, mais ce n'est pas observé directement ici) — à confirmer à la
première connexion réelle, en répétant l'esprit du test ci-dessus depuis
deux comptes qui existent pour de vrai, pas seulement simulés en local.

### 9.5 Synchronisation local ↔ distant

Le risque n'est pas l'authentification : c'est de **corrompre ou perdre une
bibliothèque déjà constituée**. Un dégât de ce type se voit tard et coûte
bien plus cher à réparer qu'à prévenir. D'où la politique de fusion
ci-dessous, conçue AVANT le code (session précédente), puis implémentée et
mutation-testée dans celle-ci — restreinte à `user_games` + `achievements`,
voir le détail du scope plus bas.

| Donnée | Politique de fusion | Pourquoi | Statut |
|---|---|---|---|
| `in_library`, `stopped` | **Union** | Ne jamais retirer ce que l'utilisateur a ajouté depuis un autre appareil | ✅ implémenté |
| `achievements` | Union par `(source, external_key)`, `unlocked` = **OU logique** | Un succès débloqué ne doit jamais se re-verrouiller | ✅ implémenté |
| `rating`, `review` | **Le plus récent gagne** (`updatedAt`), jamais arbitré si absent des deux côtés | Valeur unique : vrai conflit, arbitrage nécessaire | ✅ implémenté |
| appartenance aux listes | **Union** | Même raisonnement que `in_library` | 🚧 hors scope (voir plus bas) |
| `play_sessions` | **Union** par `client_key`, corrections comprises mais jamais rejouées | Journal append-only : fusion sans perte et sans double comptage | 🚧 hors scope (voir plus bas) |
| `steam_id64` | **Le plus récent gagne** (`steamId64UpdatedAt`) | Valeur unique, même arbitrage que rating/review | 🚧 hors scope (voir plus bas) |

**Implémenté cette session** (`user_games` + `achievements` uniquement) :

- **`src/lib/sync/merge-policy.ts`** — fonctions PURES : `gameMatchKey`
  (identité de correspondance, `igdb_id` sinon `slug` — mêmes deux index
  uniques partiels que le schéma, §9.4), `mergeGameFields` (union
  `inLibrary`/`stopped`, dernier-écrit-gagne `rating`/`review` gated sur
  `updatedAt`), `mergeAchievements` (union par `(source, external_key)`, OU
  logique sur `unlocked`). Mutation-testées : chaque règle a été
  délibérément inversée (OU → ET, garde `updatedAt` retirée, etc.) pour
  vérifier que la suite existante la détecte — voir
  `__tests__/merge-policy.test.ts`.
- **`src/lib/sync/sync-service.ts`** — orchestration IMPURE : lit
  `user_games`/`achievements` du compte, résout la correspondance EN
  MÉMOIRE (jamais via `ON CONFLICT`, voir la note ci-dessous), applique le
  verdict de merge-policy.ts par un INSERT (jeu nouveau) ou un UPDATE ciblé
  par id (jeu déjà apparié), jamais un upsert aveugle.
- **`applySyncedGames`** (`src/lib/game-store.tsx`) — nouveau chemin
  d'écriture DÉDIÉ au service de sync, séparé d'`updateGame` : celui-ci
  horodate systématiquement à `Date.now()`, ce qui ferait gagner à tort
  l'arbitrage à l'appareil qui vient de synchroniser, quel que soit le côté
  réellement le plus récent. `applySyncedGames` écrit tel quel
  l'`updatedAt` déjà tranché par la fusion (celui d'un des deux appareils,
  ou absent).
- **Déclenchement** : automatique à toute transition vers `'signedIn'`
  (`src/hooks/use-sign-in-sync.ts`, monté via `SignInSyncGate` dans
  `app/_layout.tsx`) — y compris la confirmation d'une session déjà
  persistée au démarrage de l'app, pas seulement un `signIn` tapé à
  l'instant (sans quoi rester connecté plusieurs semaines ne bénéficierait
  jamais de la synchro automatique). Et manuel, bouton "Synchroniser
  maintenant" dans Réglages (`src/app/profile/settings.tsx`), visible
  seulement `status === 'signedIn'`.
- **Portée** : seuls les jeux "trackés" (`inLibrary`, `stopped`, une note,
  un avis, ou au moins un succès) montent vers le distant — un jeu
  simplement aperçu dans Explorer (`registerCatalogGame` sans `updatedAt`)
  ne crée jamais de ligne `user_games`.
- **Mode hors-ligne préservé** : AsyncStorage reste l'unique source de
  lecture de l'app (`GameStoreProvider`) ; la sync est un aller-retour en
  tâche de fond qui écrit dans ce même store via `applySyncedGames`, jamais
  un chemin de lecture séparé.

**Une limite acceptée sciemment** : la correspondance jeu local ↔ ligne
distante est résolue EN MÉMOIRE (tous les `user_games` de l'utilisateur
sont chargés, puis appariés par `gameMatchKey`) plutôt que via un upsert
`ON CONFLICT`, parce que les deux index uniques distants sont **partiels**
(`(user_id, igdb_id) where igdb_id is not null` / `(user_id, slug) where
igdb_id is null`, voir §9.4) — un upsert PostgREST ne peut viser qu'une
seule contrainte nommée à la fois, pas les deux selon le cas. Deux appareils
qui créeraient la MÊME identité simultanément depuis zéro (aucun des deux
n'a encore de ligne distante) se heurteraient donc à la contrainte
d'unicité au lieu de fusionner — un vrai risque de concurrence à deux
appareils, non traité ici, qui recoupe la "Réconciliation d'identité
tardive" déjà listée en §9.6.

**Explicitement HORS SCOPE de cette session** (à reprendre séparément) :

- **`play_sessions`** — union par `client_key`, corrections jamais
  rejouées : demande sa propre logique de merge (append-only, pas un
  simple OR/LWW) et ses propres tests.
- **`lists`/`list_games`** — union de l'appartenance aux listes.
- **`steam_id64`** (ligne `profiles`) — même politique dernier-écrit-gagne
  que rating/review, mais sur une entité distante différente
  (`profiles`, pas `user_games`).
- **`profile`/`titleArtwork`** — non horodatés, politique de fusion pas
  encore décidée (voir §9.6, inchangé).
- **`favorite_track_title`/`favorite_track_artist`** — colonnes déjà
  présentes dans le schéma `user_games` (§9.4) mais sans politique de
  fusion documentée nulle part, y compris dans la table ci-dessus avant
  cette révision : ni lues ni écrites par `sync-service.ts` pour l'instant,
  plutôt que d'en inventer une à la volée.
- **La migration initiale « gros import unique »** décrite dans une
  révision précédente de cette section (instantané avant écriture, envoi
  atomique via une seule fonction RPC Postgres, bascule après accusé de
  réception) — un chantier différent de la synchro CONTINUE implémentée
  ici : utile pour le tout premier envoi d'une bibliothèque déjà volumineuse
  sans jamais la laisser à moitié partie côté serveur, mais pas ce que
  demandait cette session. `sync-service.ts` fait aujourd'hui plusieurs
  requêtes séquentielles (une par jeu divergent), acceptable pour le volume
  d'une bibliothèque solo (§9.3) mais pas atomique bout en bout.

### 9.6 Points encore ouverts

- **Réconciliation d'identité tardive** : un jeu envoyé avec `igdb_id` null
  puis résolu plus tard peut entrer en collision avec une ligne portant déjà
  cet `igdb_id`. Il faut une étape de fusion de lignes, pas un simple
  `update`.
- **Suppression de compte et export des données** (RGPD) : `on delete
  cascade` couvre l'effacement, l'export reste à concevoir.
- **Refus de migrer** : que fait l'app si l'utilisateur crée un compte mais
  décline l'envoi de sa bibliothèque locale ?
- **`profile`/`titleArtwork` non horodatés** : seul `steam_id64` l'est
  (prérequis 9.3.6) — les autres réglages (nom, identifiant, bio, photo,
  arrière-plan, mode d'affiche) n'ont pas encore de colonne distante
  (§9.4), donc pas encore d'arbitrage à leur appliquer. À reprendre
  ensemble quand cette table sera conçue, plutôt que d'horodater
  maintenant des champs dont la politique de fusion n'est pas encore
  décidée.
- **Quota et abus** : une limite par IP existe sur `/api/games`,
  `/api/cover` et `gamelary-api` (voir §7.1), mais **pas** de limite par
  utilisateur — impossible tant qu'il n'y a pas de compte, et c'est
  justement ce que les comptes rendront possible. À cadrer avant toute
  ouverture publique.
- **Rendu serveur (`web.output: "server"`) et code exécuté au montage :
  vigilance structurelle, pas ponctuelle.** Un vrai crash serveur a été
  trouvé et corrigé cette session (voir §9.7) — construire un client
  Supabase pendant le rendu SSR faisait tomber le processus Node entier,
  sur n'importe quelle page, parce qu'`AuthProvider` enveloppe toute l'app.
  La leçon dépasse ce seul cas : tout code qui s'exécute au montage d'un
  Provider global (pas seulement au clic) doit être vérifié en conditions
  réelles (`expo start --web`), pas seulement sous Jest — Jest ne l'aurait
  jamais révélé, puisqu'AsyncStorage n'y fonctionne de toute façon pas du
  tout (voir le commentaire de `supabase.test.ts`). À garder en tête pour
  toute future logique ajoutée à `AuthProvider` ou à un Provider similaire.
- **Grants par défaut du rôle `authenticated` sur un vrai projet Supabase**
  supposés identiques à ceux posés à la main pour le test local (voir
  §9.4), jamais observés directement sur un projet réel — à confirmer à la
  première connexion.

### 9.7 Authentification : implémentée ✅

Session distincte de la précédente (qui a écrit §9.3/§9.4) : client
Supabase, écrans de connexion, session câblée sur l'affichage. **À
l'écriture de cette section, la synchronisation (§9.5) n'était pas encore
commencée** — se connecter établissait une identité, rien de plus. Depuis,
`user_games`/`achievements` sont synchronisés (voir §9.5) ; `play_sessions`
et `lists`/`list_games` restent hors scope. Ne pas confondre « connecté »
et « entièrement synchronisé ».

**Client** (`src/lib/supabase.ts`, `src/lib/supabase-config.ts`) —
configuré via `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`
(voir `.env.example`), absent desquels l'app se comporte exactement comme
avant cette session (mode hors-ligne intégral, aucun bouton mort) plutôt
que d'échouer bruyamment — même philosophie que `steamApiUrl()`/`apiUrl()`.
Mémoïsé (une seule instance par process, jamais deux `GoTrueClient`
gérant la même session AsyncStorage en parallèle). PKCE (`flowType:
'pkce'`) plutôt que le flux implicite : le retour, natif comme web, se fait
par un `?code=` explicite à échanger, jamais par un fragment `#access_token`
exposé dans l'URL.

**Bug trouvé et corrigé en conditions réelles, pas en théorie** :
construire ce client pendant le rendu serveur (`web.output: "server"`,
voir §7) faisait planter tout le processus Node — `ReferenceError: window
is not defined`, provoqué par un chargement de session que GoTrueClient
déclenche lui-même dès sa construction, jamais attendu par l'appelant.
Comme `AuthProvider` enveloppe toute l'app (voir plus bas), ce n'était pas
un problème de l'écran de connexion : n'importe quelle page aurait fait
tomber le serveur, dès que des clés Supabase auraient été configurées en
production. Corrigé par un garde-fou qui distingue le rendu serveur du
bundle web (pas de `window`) de l'exécution native (jamais de `window` non
plus, mais jamais un problème là-bas) — voir le commentaire de
`getSupabaseClient()`. Un test Jest dédié retire `window` pour de vrai
plutôt que de supposer le garde-fou suffisant ; il aurait été impossible à
écrire en se fiant uniquement au mock d'AsyncStorage utilisé par les autres
tests de ce fichier, qui masque ce crash précis (voir le commentaire de
`supabase.test.ts` sur pourquoi AsyncStorage ne fonctionne pas du tout sous
Jest dans ce projet — une découverte de cette session, distincte du bug
lui-même).

**Provider** (`src/lib/auth-store.tsx`, `AuthProvider`/`useAuth`) — frère
de `GameStoreProvider` (voir `app/_layout.tsx`), pas imbriqué dedans :
l'identité Supabase est gérée et persistée par supabase-js lui-même, la
mélanger au blob AsyncStorage de la bibliothèque créerait deux sources de
vérité pour la même donnée. Quatre statuts : `unconfigured` (pas de clés —
distinct de `signedOut`, pour ne jamais proposer un bouton qui ne mène
nulle part), `loading`, `signedOut`, `signedIn`.

**Formulaire** (`src/components/sign-in-screen.tsx`) — Google OAuth en
bouton plein (un tap, mis en avant). Sur natif, Google ouvre un navigateur
in-app (`WebBrowser.openAuthSessionAsync`) qui capture lui-même son propre
retour ; sur web, `signInWithOAuth` fait naviguer la page. Le lien magique,
lui, revient toujours par un vrai lien profond ouvert depuis l'app Mail —
hors du contrôle de ce code, donc intercepté différemment par la route
`app/profile/sign-in.tsx` (qui lit `?code=` dans ses propres paramètres).
Troisième méthode (e-mail + mot de passe) et refonte de l'écran en
session 4, détaillées plus bas.

**Connexion obligatoire au lancement (session 3) ✅** — jusqu'ici, se
connecter n'était qu'une option proposée depuis le Profil (pastille « Se
connecter pour sauvegarder ta bibliothèque »), et rien n'empêchait
d'utiliser l'app indéfiniment sans compte. Décision produit : ce n'est
plus le cas. `src/components/auth-gate.tsx` (`AuthGate`) recouvre
désormais `AppTabs`/`SearchFab` (`app/_layout.tsx`, monté en dernier parmi
leurs frères) tant que `auth.status !== 'signedIn'`, affichant
`SignInScreen` (le même formulaire ci-dessus, réutilisé sans duplication —
`unconfigured`/`loading` y affichent déjà leurs propres écrans, `AuthGate`
n'a donc besoin de distinguer que « signedIn » de « tout le reste »).
Recouvre plutôt que démonte : `AppTabs` (et le routeur qu'il porte) reste
monté en permanence, y compris derrière l'écran de connexion — nécessaire
pour que le lien profond du lien magique natif continue d'être résolu par
le routeur même à froid, avant que l'utilisateur ne soit connecté. Une
déconnexion (menu « ⋯ » du Profil -> `signOut()`) fait donc réapparaître
ce verrou immédiatement, quel que soit l'onglet affiché à ce moment — le
statut change, `AuthGate` se re-rend, plus besoin de forcer un retour à un
onglet racine.

Deux conséquences directes :
- **La bibliothèque de démonstration a été retirée.** `seedStore`
  (`game-store.tsx`) préchargeait six jeux (`demoSeed: true` dans
  `tracked-games.ts`) au tout premier lancement, pour un mode "essayer sans
  compte" qui n'existe plus — un nouvel utilisateur connecté part
  désormais d'une bibliothèque vide. Le champ `demoSeed` a été retiré du
  type `TrackedGame` (plus aucun code ne le lit) ; `tracked-games.ts`
  reste un catalogue curaté (succès/bande originale) consulté quand
  l'utilisateur ajoute lui-même un de ces dix jeux, jamais préchargé (voir
  §6.3/§6.4).
- **Une build sans clés Supabase (`unconfigured`) est désormais
  inutilisable.** Avant cette session, l'app restait pleinement
  fonctionnelle hors ligne sans aucune clé configurée (voir §9.1) ;
  `AuthGate` bloque maintenant indistinctement `unconfigured` et
  `loading` derrière le même écran que `signedOut` (`SignInScreen` y
  affiche son message "pas configurée", pas un formulaire mort). Compromis
  assumé du prérequis "connexion obligatoire", pas un oubli — voir §9.1
  pour la décision et sa justification.
**Vérifications** : 32 tests Jest de la session précédente (config,
e-mail, redirection, client, provider), plus 6 nouveaux pour cette session
(`auth-gate.test.tsx` : formulaire affiché tant que `signedIn` n'est pas
atteint, verrou levé une fois connecté, redevient visible après
déconnexion ; `game-store-seed.test.tsx` : bibliothèque vide au premier
lancement, aucun des six anciens ids de démo présent) — tous
mutation-testés : chaque assertion a été confirmée capable d'échouer
(condition `signedIn` inversée, seed réintroduit), pas seulement de
passer, plus les 20 vérifications SQL de §9.4. Conditions réelles
vérifiées manuellement (`expo start --web`, Chromium headless) : build
`unconfigured` (message figé, aucun onglet visible même dans le DOM
sous-jacent, capture d'écran à l'appui), build avec clés (factices mais
valides) menant à `signedOut` (formulaire affiché, toujours aucun onglet
visible). **Non vérifié** : Google OAuth et lien magique de bout en bout
contre un vrai projet Supabase (aucun n'existe dans cet environnement de
développement) ; rendu natif (pas de simulateur disponible ici, limite
déjà documentée
ailleurs dans ce fichier).

**Étapes manuelles restantes côté Supabase** avant que ça fonctionne pour de
vrai (détail complet dans `.env.example`) : créer le projet, appliquer
`supabase/migrations/20260910120000_initial_schema.sql`, activer le
provider Google (Client ID/Secret depuis Google Cloud Console), renseigner
les Redirect URLs (`gamelary://profile/sign-in` + l'origine du déploiement
web) — sans cette dernière étape, Google et le lien magique refusent de
rediriger vers l'app après connexion.

**Troisième méthode et écran unique à trois options (session 4) ✅** —
jusqu'ici, e-mail ne voulait dire que « lien magique » ; ce n'est plus
suffisant pour quelqu'un qui préfère un mot de passe classique (n'importe
quel fournisseur — Gmail, Outlook, Yahoo... — contrairement à
`signInWithGoogle`, spécifique à ce provider OAuth). `signUpWithPassword`/
`signInWithPassword` (`auth-store.tsx`) enveloppent `supabase.auth.signUp`/
`signInWithPassword` : ni l'un ni l'autre ne mettent à jour
`status`/`session` eux-mêmes, exactement comme les deux méthodes
existantes — `onAuthStateChange` s'en charge dès que supabase-js reçoit une
session valide.

**Piège attendu, gardé explicitement** : `signUp()` ne renvoie de session
que si *Confirm email* est désactivé côté dashboard Supabase
(Authentication > Providers > Email) — sinon le compte est bien créé mais
`data.session` est `null` tant que le lien de confirmation envoyé par
e-mail n'a pas été cliqué, ce que le prérequis « connexion obligatoire »
(§9.1/plus haut) ne permet justement pas d'attendre. `signUpWithPassword`
détecte ce cas (`!data.session`) et renvoie une erreur explicite nommant le
réglage à changer, plutôt que de laisser croire à un succès pendant que
l'écran reste bloqué sur `signedOut` sans explication — mutation-testé
(inverser la condition fait échouer le test dédié).

**Écran** (`src/components/sign-in-screen.tsx`, entièrement redessiné) :
logo Gamelary centré sur un badge de couleur `accent` (le fond quasi blanc
de `gamelary-mark.png`, pensé pour l'aplat plein du splash natif, se
confondait avec le `background` clair du thème sans lui — vérifié à
l'écran, pas supposé), puis trois méthodes empilées en pilules, toutes
visibles dès le premier affichage — aucune cachée derrière le Profil ou
présentée comme secondaire sous une autre : Google (inchangé), « Créer un
compte avec e-mail et mot de passe » (ouvre un second écran, pas tout
affiché d'un coup), lien magique par e-mail (inchangé, juste remonté au
même niveau visuel). Le second écran porte le formulaire e-mail + mot de
passe avec bascule « Déjà un compte ? Se connecter » / « Pas de compte ?
Créer un compte » (un seul écran, deux modes plutôt que deux écrans
séparés) et un bouton « Retour ». Validation client avant tout appel réseau
(`src/lib/password.ts`, même principe que `isValidEmail`, email.ts) :
minimum 6 caractères (défaut Supabase), affiché en toutes lettres sous le
champ plutôt que deviné depuis un bouton simplement désactivé — Supabase
reste le seul juge final si ce minimum diffère côté dashboard, son message
d'erreur remonte alors tel quel (comme « e-mail déjà utilisé » ou « mauvais
mot de passe », jamais traduits, cohérent avec l'absence de couche i18n
déjà notée pour Google/lien magique).

**Vérifications** : 13 tests Jest nouveaux pour l'écran
(`sign-in-screen.test.tsx` : les trois méthodes visibles au premier rendu,
navigation vers le formulaire et retour, bascule créer un compte/se
connecter, bon appel (`signUpWithPassword` vs `signInWithPassword`) selon
le mode avec e-mail rogné, bouton désactivé si mot de passe trop court,
erreurs serveur affichées), plus 7 nouveaux dans `auth-store.test.tsx`
(transmission des arguments, erreur serveur relayée telle quelle, garde
« Confirm email », absence de client) — tous mutation-testés (mode
créer-compte/se-connecter interverti, garde `session` inversée, validation
du mot de passe retirée : chaque mutation fait échouer le test qui lui
correspond avant d'être restaurée). Conditions réelles vérifiées
manuellement (`expo start --web`, Chromium headless, clair **et** sombre) :
logo visible dans les deux thèmes (capture d'écran à l'appui — c'est cette
vérification qui a révélé le badge manquant), écran à trois options,
formulaire e-mail + mot de passe avec bouton désactivé tant qu'invalide.
Critère d'acceptation vérifié en conditions réelles avec une session
Supabase pré-écrite (même technique que `e2e/auth-helpers.ts`) : une
session valide déjà présente au démarrage saute directement aux onglets
(jamais l'écran de connexion, y compris après un rechargement complet
simulant un relancement) ; « Se déconnecter » depuis le menu « ⋯ » du
Profil y ramène immédiatement. **Non vérifié** : `signUp`/
`signInWithPassword` de bout en bout contre un vrai projet Supabase (aucun
n'existe dans cet environnement de développement, même limite que Google/
lien magique en session précédente) — seul le câblage (quel bouton appelle
quelle méthode, avec quels arguments, dans quel état) est couvert, pas le
comportement réel de l'API Supabase.

**Réinitialisation de mot de passe (session 5) ✅** — l'auth par mot de
passe (session 4) restait incomplète sans un moyen d'en récupérer un
oublié. Plutôt qu'un second mécanisme de lien profond à maintenir en
parallèle du lien magique, `resetPasswordForEmail` (`auth-store.tsx`)
réutilise **exactement** le même chemin : même URL de redirection
(`authRedirectUrl` -> `/profile/sign-in`), même intercepteur des deux
côtés (`detectSessionInUrl` sur web, `completeSignInFromCode` sur natif,
voir plus haut) — rien de spécifique à écrire pour ce nouveau lien à cet
endroit-là, `exchangeCodeForSession()` est déjà le même appel pour les
deux.

**Comment le SDK distingue les deux liens à l'échange du code** (pas
évident, vérifié dans le code source de `@supabase/auth-js` avant
d'écrire ce paragraphe, pas supposé) : `resetPasswordForEmail()` stocke
localement le vérifieur PKCE de la requête avec un marqueur `recovery`,
que `exchangeCodeForSession()` relit à l'échange pour émettre
`PASSWORD_RECOVERY` au lieu de `SIGNED_IN` — décidé par un état **local**
au device qui a demandé le lien, jamais par le contenu de l'URL ou du
lien lui-même. Nouveau statut `passwordRecovery` dans `AuthStatus` pour
ce cas précis : la session établie est réellement valide (comme pour un
lien magique), mais la laisser passer directement aux onglets
court-circuiterait le formulaire "nouveau mot de passe" — l'utilisateur
n'aurait alors jamais l'occasion de changer le mot de passe qu'il vient
de demander à réinitialiser.

**Écran** : lien « Mot de passe oublié ? » visible uniquement en mode
« Se connecter » (créer un compte n'a pas encore de mot de passe à
oublier) sur `sign-in-screen.tsx`, ouvrant un troisième step (saisie
d'e-mail, même pattern que le lien magique — confirmation « Ouvre-le
depuis cet appareil » après envoi). `auth.status === 'passwordRecovery'`
court-circuite tout ce step au profit d'un formulaire dédié "nouveau mot
de passe" (un seul champ, même validation client 6 caractères que
l'inscription, `password.ts`), affiché au même endroit que les branches
`unconfigured`/`loading` déjà existantes. `updatePassword` (`updateUser({
password })`) ne redirige nulle part explicitement : supabase-js émet
`USER_UPDATED` avec la session de récupération toujours valide, traité
par le même écouteur `onAuthStateChange` que tous les autres événements
porteurs d'une session — `status` repasse donc de lui-même à `signedIn`,
sans deuxième connexion à refaire (c'était le critère d'acceptation
explicite de cette session).

**Vérifications** : 6 tests Jest nouveaux dans `auth-store.test.tsx`
(transmission e-mail/URL de redirection identique à Google/lien magique,
erreur serveur relayée telle quelle pour les deux méthodes, absence de
client) plus 2 dédiés à la distinction d'événement (`PASSWORD_RECOVERY`
→ statut `passwordRecovery` malgré une session valide ; `USER_UPDATED`
après une récupération → repasse à `signedIn` de lui-même) ; 7 nouveaux
dans `sign-in-screen.test.tsx` (lien visible en mode connexion seulement,
navigation vers le formulaire et retour, appel `resetPasswordForEmail`
avec l'e-mail rogné, erreur affichée, formulaire "nouveau mot de passe"
affiché sous `passwordRecovery` à l'exclusion du formulaire de connexion,
appel `updatePassword`, mot de passe trop court bloqué) — tous
mutation-testés (condition d'événement inversée, garde de mode
« signin » inversée, statut de court-circuit inversé : chaque mutation
fait échouer exactement les tests qui lui correspondent). Conditions
réelles vérifiées manuellement (`expo start --web`, Chromium headless,
clair **et** sombre) : lien « Mot de passe oublié ? » et formulaire de
réinitialisation atteignables normalement (capture d'écran à l'appui) ;
le formulaire "nouveau mot de passe" n'étant reproductible qu'avec un
vrai clic sur un lien e-mail (aucun projet Supabase réel disponible ici),
vérifié en forçant temporairement `status` à `passwordRecovery` dans
`AuthProvider` pour la capture d'écran, retiré avant de committer — les
deux thèmes rendent correctement, sans surprise puisque cet écran
réutilise entièrement les mêmes styles déjà vérifiés pour le formulaire
mot de passe. **Non vérifié** : le flux complet contre un vrai projet
Supabase (envoi réel de l'e-mail, clic sur le lien, distinction
`PASSWORD_RECOVERY` observée en conditions réelles plutôt que déduite du
code source du SDK).

## 10. État actuel vs feuille de route

**Fait** : scaffold Expo + TypeScript, navigation complète (3 onglets +
piles imbriquées), design system clair/sombre (accent/success, voir §2),
jaquettes réelles via SteamGridDB avec repli automatique sur placeholder si
l'image échoue à charger (voir §2), catalogue réel via IGDB (recherche par
titre et 5 rangées Explorer), bibliothèque persistée localement
(AsyncStorage) avec suivi (`inLibrary`/"Arrêter de jouer"), Bibliothèque et
Explorer en **grille murale 3 colonnes** filtrable
(Tous/Wishlist/Pas commencé/En cours/Terminé — voir §2), rangée "Recommandé
pour toi" mise en avant à part de cette grille (plus grande, badge, voir
§6.5), titres longs ("Titre : Sous-titre") toujours lisibles en entier
(retour à la ligne forcé après les deux-points, jamais tronqués — voir §2),
notation sur 20 + avis texte par jeu, succès nommés et cochables (voir
§6.3), heures jouées **directement modifiables** (total éditable en un tap,
voir §6.6 — agrégées Semaine/Mois/Tout et par mois/plateforme sur l'écran
Statistiques, voir §6.7), bande originale par jeu avec sélection de piste
favorite (10 jeux curatés, voir §6.4) et bouton cœur dédié sur la fiche jeu
pour les favoris (voir §6.6), listes personnalisées (Favoris et Wishlist
intégrées + création libre) accessibles depuis le menu ⋯ de la fiche jeu,
recherche IGDB ponctuelle (`/library/search`, ouverte depuis un bouton
icône dédié en bas à droite, clavier ouvert automatiquement), icône
notification sur le Profil (écran toujours vide pour l'instant, voir §10),
typographie Bricolage Grotesque/IBM Plex Mono effectivement installée et
câblée (voir §2), jaquettes SteamGridDB matchées par app id Steam quand
IGDB le référence (voir §6.2, plus fiable qu'une recherche par titre),
déduplication du catalogue découvert avec `tracked-games.ts`
(`resolveCatalogId`, voir §6.1), champ "Lier mon compte Steam" sur le
Profil (modifiable/effaçable directement, pas besoin de tout
réinitialiser — vérifié en direct) et pré-remplissage des succès depuis
Steam sur la fiche jeu (spinner + confirmation avant d'écraser des succès
déjà cochés, voir §6.3), backend `gamelary-api` déployé sur Render et
vérifié fonctionnel de bout en bout sur appareil réel (voir §6.3), "Jeux
joués" du Profil (renommé depuis "Jeux suivis") à la même taille de carte
que Bibliothèque/Explorer, états vides avec lien vers Explorer ("Jeux
joués"/"Jeux préférés" du Profil), titres de section Explorer en accent
pour le contraste en sombre (voir §2), "Jeux préférés" du Profil à la même
taille de carte que "Jeux joués", troisième rangée Profil "Jeux terminés à
100%" (jeux dont tous les succès suivis sont cochés — voir §6.6), compteur
de jeux à côté du titre de chaque rangée du Profil (avant le chevron, même
motif que les apps de séries/films), menu "⋯" du Profil (`OverflowMenu`,
même composant que celui de la fiche jeu, désormais capable d'afficher une
icône par option et de marquer l'une d'elles `destructive`) symétrique à la
cloche de notification, avec ses 6 options (Partager le profil/
Paramètres/Modifier le profil/Créer une liste/Aide et idées/Se déconnecter,
ce dernier en rouge — nouvelle couleur `danger`, voir §2 — et séparé du
reste par une ligne), champ SteamID64 gardé
visible au-dessus du clavier pendant la saisie (`automaticallyAdjustKeyboardInsets`
sur le `ScrollView` du Profil) et validé au format 17 chiffres avant
enregistrement, **identité de profil personnalisable** : image
d'arrière-plan derrière la photo de profil (les deux images se choisissent
séparément via `expo-image-picker`, voir `src/lib/profile-image.ts`), écran
"Modifier le profil" (`/profile/edit` : photo, arrière-plan, nom,
identifiant, bio — identifiant normalisé à la frappe et validé, voir
`src/lib/profile.ts`) et "Partager le profil" qui copie le lien public
`/u/<identifiant>` dans le presse-papiers avec confirmation à l'écran
(`expo-clipboard`, base configurable via `EXPO_PUBLIC_PROFILE_BASE_URL` —
voir `src/lib/profile-link.ts`), écran **"Créer une liste"**
(`/profile/create-list` : nom obligatoire, description libre affichée sous
le titre de la rangée, et "Ne pas afficher sur le profil" qui garde la
liste utilisable depuis la fiche d'un jeu sans lui donner de rangée sur le
Profil — les listes créées apparaissent désormais en rangées, voir
`profile/index.tsx`), écran **"Aide et idées"** (`/profile/help` : demandes
de fonctionnalités, signalement de problème et contact, tous vers le suivi
d'issues du dépôt public — voir `src/lib/support-links.ts`, aucune adresse
personnelle codée en dur), et écran **Paramètres** (`/profile/settings`)
avec le réglage **"Affiche de la page titre"** : la fiche jeu s'ouvre soit
sur un bandeau large + le logo du jeu (illustrations `hero`/`logo` de
SteamGridDB, nouveau paramètre `kind` de `/api/cover`), soit sur la
jaquette portrait, avec repli automatique sur la jaquette quand le bandeau
n'existe pas ou ne charge pas (voir `game-title-header.tsx`), et
**authentification** (voir §9.7) : formulaire "Se connecter" (Google
OAuth en bouton plein, lien magique par e-mail en repli, ni téléphone ni
mot de passe), e-mail affiché et "Se déconnecter" réellement câblé dans le
menu "⋯" une fois connecté — à l'époque, sans qu'aucune donnée de jeu ne
soit encore synchronisée (`user_games`/`achievements` le sont depuis, voir
§9.5 ; `play_sessions` et `lists`/`list_games` restent à faire). Plus
aucun stub dans le menu "⋯". **Connexion désormais obligatoire** (session
3, voir §9.7) : `AuthGate` bloque l'accès aux onglets tant que `signedIn`
n'est pas atteint, ce qui a aussi retiré la bibliothèque de démonstration
préchargée au premier lancement — un nouvel utilisateur part d'une
bibliothèque vide.

**Bugs corrigés** :
- Les liens vers la fiche jeu (rangées Explorer, liste de bibliothèque,
  recherche) construisaient l'URL à la main (`` `/library/${id}` ``) — une
  erreur "Unmatched Route" pouvait en résulter selon l'id. Remplacé partout
  par la forme structurée `{ pathname: '/library/[id]', params: { id } }`,
  qu'expo-router encode et résout lui-même — plus robuste pour un segment
  dynamique.
- `GameCover` acceptait une taille et un style par consommateur (`size`,
  `style`), ce qui avait fini par produire des jaquettes de tailles très
  différentes selon l'écran. Corrigé en remplaçant ces props par trois
  composants séparés (`GameCover`/`GameCoverGrid`/`GameCoverFeatured`),
  chacun avec sa propre taille fixe non configurable, réutilisés
  exactement là où ils correspondent au bon agencement — voir §2.
- Sur `<Link asChild>`, un enfant direct (`Pressable`) avec un `style` sous
  forme de tableau (`[styles.card, { width }]`) fait planter le rendu web
  ("You are passing an array of styles to a child of `<Slot>`") — trouvé en
  testant la nouvelle grille dans un navigateur réel. Corrigé en fusionnant
  le style en un seul objet (`{ ...styles.card, width }`) plutôt qu'un
  tableau, dans `GameGrid`.
- Un titre affiché avec `numberOfLines` fixe (ex. 2 ou 3) pouvait tronquer
  un sous-titre long en plein mot dès qu'il dépassait le nombre de lignes
  autorisées, malgré le retour à la ligne forcé après les deux-points.
  Retiré des cartes de grille et de la rangée mise en avant : un titre long
  doit toujours se lire en entier.
- L'initiale de l'avatar (Profil) était rognée par le cercle qui la
  contient : `type="subtitle"` porte un `lineHeight` (44) pensé pour un
  vrai sous-titre multi-mots, pas pour une seule lettre centrée dans un
  cercle de 64px, ce que la police custom (Bricolage Grotesque, voir §2)
  a rendu plus visible qu'avec les polices système précédentes. Corrigé en
  resserrant le `lineHeight` de cette lettre au `fontSize` et en désactivant
  `includeFontPadding` (Android ajoute sinon un padding vertical au rendu
  du texte, avec le même effet).
- Toujours sur `<Link asChild>`, un `style` sous forme de fonction
  (`({ pressed }) => ({...})`) — donc pas un tableau, cette fois — ne fait
  pas planter le rendu mais s'applique de façon incohérente sur les cartes
  d'une liste horizontale (`FlatList` à l'époque — voir §2, `GameShelf` est
  passé à `ScrollView` depuis) : trouvé sur "Jeux joués" du Profil (cartes
  à des largeurs différentes selon le titre, retombant sur la taille de
  leur propre contenu) et sur la case "Temps de jeu" (fond/padding
  manquants, visible sur appareil réel à côté de "Jeux joués" qui lui en
  avait). Même famille de piège que le style en tableau ci-dessus, seul
  fix vérifié fiable dans les deux cas : un objet statique, sans callback
  ni retour visuel au tap — voir §2.
- Le champ de saisie du SteamID64 (Profil) se retrouvait caché sous le
  clavier numérique pendant la frappe : les chiffres tapés s'y affichaient
  bien (le `TextInput` est correctement contrôlé), mais le champ étant tout
  en bas d'un long `ScrollView`, rien ne le faisait remonter au-dessus du
  clavier — impossible de relire/corriger sans tout effacer. Corrigé avec
  `automaticallyAdjustKeyboardInsets` sur le `ScrollView` du Profil (décale
  et fait défiler automatiquement vers le champ actif, sans
  `KeyboardAvoidingView` manuel) et `autoFocus` sur le champ pour l'amener
  hors champ dès l'entrée en édition.
- Icône, splash et icône adaptative Android étaient encore le logo Expo par
  défaut (`expo-logo.png`, fond `#208AEF`) — repéré comme un `TODO` dans
  `splash-overlay.tsx` pendant la revue portfolio. Remplacés par une marque
  Gamelary (ruban de bibliothèque + triangle lecture découpé) dans les
  couleurs réelles de l'app (`accent`/`background`, voir §2), générée dans
  toutes les tailles requises (icône iOS/Android, favicon, icône adaptative
  Android + variante monochrome, splash). L'override `ios.icon` (bundle
  `.icon` "Liquid Glass" d'iOS 18, lui aussi le logo Expo par défaut) a été
  retiré plutôt que reconstruit dans le nouveau format : sans lui, iOS
  retombe automatiquement sur l'icône classique (`icon.png`, voir
  `withIosIcons.js` dans `@expo/prebuild-config`) — un bundle `.icon`
  correctement recréé resterait à faire si l'app vise iOS 18+.
- Le graphique "Activité" de l'écran Statistiques (`/profile/stats`)
  n'avait qu'une seule granularité (`hoursByMonthThisYear`, toujours 12
  barres mensuelles), réutilisée telle quelle pour les trois filtres
  Semaine/Mois/Tout — "Semaine" affichait donc un graphique sans aucun
  rapport avec les 7 derniers jours (les 12 barres de l'année, dont une
  seule correspond au mois en cours) plutôt qu'un résultat vide ou une
  vraie vue hebdomadaire ; le nombre d'heures au-dessus, lui, était déjà
  correctement filtré par `hoursInPeriod`. Ajouté `hoursByLast7Days`
  (`play-stats.ts`) : 7 buckets glissants se terminant aujourd'hui — pas la
  semaine calendaire Lundi-Dimanche, qui suivrait une convention différente
  de "Mois"/"Tout" (déjà des fenêtres glissantes 7j/30j côté
  `hoursInPeriod`, pas le mois calendaire). `stats.tsx` bascule entre les
  deux agrégations selon le filtre sélectionné (`chartBuckets`, un seul
  rendu de graphique paramétré par `label`/`hours`/`current` plutôt que
  deux blocs JSX dupliqués).
- Le compteur de jeux d'une rangée `GameShelf` (Profil) était affiché à
  côté du titre, sur la même ligne que le chevron "›" ("Séries 124 ›",
  motif emprunté aux apps de séries/films) — déplacé en dessous du titre,
  en petit texte secondaire, plus lisible comme le sous-titre discret qu'il
  est plutôt que comme une seconde donnée au même niveau que le titre. À
  cette occasion, la rangée horizontale (`FlatList horizontal`) est passée
  à un `ScrollView horizontal` : ces rangées n'affichent jamais qu'une
  poignée de jeux (aperçu, pas un parcours complet), la virtualisation de
  `FlatList` n'y apporte donc rien, seulement sa complexité de gestes en
  plus une fois imbriquée dans le `ScrollView` vertical du Profil — un
  geste de swipe horizontal s'y révélait moins fiable qu'avec un
  `ScrollView` simple. `FeaturedShelf` (Explorer) n'est pas concerné, elle
  garde `FlatList`.
- **Chevauchement barre d'onglets web sur bibliothèque vide** : un
  `paddingBottom: BottomTabInset` sur le contenu défilable du Profil
  (`styles.content`) ne protège que le DERNIER élément d'une page, et
  seulement quand elle déborde assez pour défiler jusqu'à lui — sur une
  bibliothèque vide (page trop courte pour défiler du tout), le lien
  "Explorer des jeux" de la rangée "Jeux préférés" (ni le premier ni le
  dernier élément de la page) tombait dans la bande que la barre recouvre
  en position absolue. Corrigé en réservant `BottomTabInset` sur le
  `ScrollView` lui-même (`styles.scrollView`, `marginBottom`) plutôt que
  sur son seul contenu : sa propre zone visible s'arrête alors
  `BottomTabInset` avant le bas réel de l'écran, quelle que soit la
  longueur du contenu — aucun élément, à n'importe quelle position, ne
  peut donc plus jamais être disposé dans cette bande. Repéré par
  `e2e/web-tab-bar-overlap.spec.ts`, contourné à l'origine en seedant un
  jeu suivi/favori pour éviter le cas plutôt que de le corriger — le seed
  a été retiré (la bibliothèque est vide par défaut pour un compte
  fraîchement connecté, voir plus haut) pour que le test couvre
  effectivement ce cas. Le fix introduit un `ScrollView` qui défile
  désormais sur sa propre hauteur plutôt que sur celle du document — le
  hit-testing du test (`elementFromPoint`) traitait un élément simplement
  scrollé hors de vue par ce nouveau `ScrollView` interne comme "recouvert
  par la barre" (faux positif géométrique : sa position non recadrée
  tombe dans le rectangle de la barre sans jamais y être réellement
  peinte — vérifié à la capture d'écran) ; corrigé en excluant du contrôle
  tout élément hors de la fenêtre visible d'un ancêtre défilable, avant le
  test de recouvrement proprement dit.
- **Pastille "Se connecter" du Profil, code mort depuis `AuthGate`** :
  signalée comme telle lors de la session précédente (§9.7) sans être
  retirée (hors scope à l'époque). `auth.status` ne peut plus valoir
  `signedOut` pendant que le Profil est affiché (`AuthGate` l'aurait déjà
  recouvert), sa condition ne s'évaluait donc plus jamais à vrai — bloc
  JSX et style associé (`signInPill`) retirés, aucun test ne les couvrait
  spécifiquement.

**Simplifications assumées pour cette itération** :
- Le menu "⋯" de la fiche jeu (Partager/Arrêter de jouer/Ajouter à une
  liste) et la modale de sélection de listes sont des `Modal` React Native
  positionnés approximativement, pas un vrai popover ancré dynamiquement
  (RN n'a pas d'équivalent direct du "clic en dehors pour fermer" du web
  sans mesure de layout supplémentaire). Le nouveau menu "⋯" du Profil
  réutilise ce même composant (`OverflowMenu`) ; ses 6 options ont
  désormais toutes un écran ou un effet réel (Partager le profil/
  Paramètres/Modifier le profil/Créer une liste/Aide et idées, voir plus
  haut ; "Se déconnecter" appelle le vrai `signOut()` depuis §9.7) — plus
  aucun stub.
- Le chevron "›" du Profil (`GameShelf`, Jeux joués/Jeux préférés) est
  pour l'instant purement visuel (pas d'écran "voir tout") — non demandé
  pour cette itération. Les rangées d'Explorer n'en ont plus du tout
  depuis leur passage en grille/mise en avant (voir §2, §6.5) — la grille
  affiche déjà plusieurs jeux à la fois, l'affordance "voir tout" a moins
  de sens qu'avant.
- "Plateformes les plus jouées" plutôt que "genres" sur l'écran
  Statistiques (voir §6.7) — la donnée existe déjà, pas besoin d'étendre
  les requêtes IGDB pour cette itération.
- Icône notification (Profil, en haut à gauche) : l'écran qu'elle ouvre
  est toujours vide ("Aucune notification") puisqu'il n'y a pas de système
  d'abonnés pour produire de vraies notifications (voir "Plus tard" ci-
  dessous) — ajoutée maintenant pour ne pas avoir à retoucher la
  navigation quand ce système arrivera. Limite connue, web uniquement : le
  fallback web de la barre d'onglets (`app-tabs.web.tsx`) est un bandeau
  `position: absolute` superposé en haut de chaque écran, qui recouvre
  cette icône (et plus généralement le tout début du contenu de tout
  écran) sur cette plateforme — sans effet sur natif (barre d'onglets
  réellement en bas, aucun élément ne recouvre le haut de l'écran), la
  plateforme visée en priorité (voir §1) ; non corrigé ici, la même
  superposition affecte déjà tous les titres de page sur web et
  dépasserait la portée de cette itération.

**Spotify Web API — abandonné** (voir §6.4) : Spotify bloque la création
de l'app Developer sans abonnement Premium, y compris pour le flow
recherche seule (pas de lecture prévue dans Gamelary). Décision : ne pas
dépendre d'un abonnement payant pour une fonctionnalité annexe — la liste
de pistes seedée à la main reste l'état définitif de cette itération.

**Cache serveur partagé (Redis)** : câblé côté
[gamelary-api](https://github.com/Jarodwayo/gamelary-api) (`src/cache.js`)
— `REDIS_URL` configurée sur Render, schéma des succès et succès du joueur
mis en cache dans Redis au lieu d'une `Map` locale au process, avec repli
automatique et silencieux sur cette même `Map` si Redis est injoignable
(jamais de requête en échec pour une panne de cache). Testé en local avec
un vrai serveur Redis avant déploiement (écriture/lecture/TTL, et bascule
propre en cas de connexion refusée).

Toujours **bloqué en attente de credentials** côté Gamelary lui-même : la
`Map` en mémoire de `games+api.ts`/`cover+api.ts` (voir §7-§8), qui ne
survit pas à un redémarrage et ne serait pas partagée si l'app scalait à
plusieurs instances (suffisant pour une démo solo), reste en l'état —
nécessite une instance Redis/KV et ses credentials de connexion pour CE
service-là, non injectés par le proxy réseau de cet environnement de dev
comme le sont IGDB/SteamGridDB. Le même mécanisme que `gamelary-api`
(repli sur la Map en mémoire) s'y transposerait directement le jour où ces
credentials seraient disponibles ici aussi.

**Images de profil, limite connue** : sans backend d'upload (donc sans
compte, voir §9), la photo et l'arrière-plan restent locaux à
l'appareil. Sur natif, on garde l'URI `file://` produite par
`expo-image-picker` (déjà une copie dans le cache de l'app) ; sur le web,
une `blob:` URL ne survivrait pas au rechargement, donc l'image est
stockée en data URI — ce qui peut dépasser le quota `localStorage` pour une
photo lourde, auquel cas l'écriture du store échoue silencieusement et
l'image est perdue au prochain lancement (voir `src/lib/profile-image.ts`).

**Barre d'onglets en bas sur les trois plateformes** : elle l'était déjà sur
mobile (`NativeTabs` délègue à `UITabBarController`/`BottomNavigationView`,
voir `app-tabs.tsx`), mais la réimplémentation web (`app-tabs.web.tsx`)
était restée en haut de l'écran. Elle est maintenant ancrée en bas
(`bottom: 0`), à portée de pouce comme sur mobile.

Elle reste en position absolue, donc superposée au contenu : c'est
`BottomTabInset` (`src/constants/theme.ts`) qui réserve sa hauteur — 50 dp
sur iOS, 80 sur Android, **110 sur le web** — et tout ce qui doit rester
atteignable au-dessus d'elle s'y réfère (bas des écrans scrollables, bouton
de recherche flottant). `WebTopBarInset` a disparu avec la barre du haut
qui le justifiait.

Le déplacement n'a donc pas fait disparaître le problème de recouvrement,
**il l'a déplacé en bas** — et ce piège est maintenant passé trois fois :
la cloche du Profil sous la barre haute, puis les cinq filtres de la
Bibliothèque (centrés à 65 px sous une barre de 76 px, masqués et
intapables dans les deux thèmes), puis le déménagement lui-même. Une
vérification écran par écran dans le navigateur l'avait déjà laissé passer
deux fois, d'où un test plutôt qu'une troisième relecture attentive.

`e2e/web-tab-bar-overlap.spec.ts` parcourt les onze écrans dans les deux
thèmes et fait un vrai hit-testing (`elementFromPoint`) au centre de chaque
élément interactif : il répond à « un utilisateur peut-il cliquer
dessus ? » plutôt que de comparer des pixels, et ne se casse pas au moindre
changement de mise en page. Il repère la barre par les liens d'onglets
qu'elle contient, pas par une position en dur — elle a déjà déménagé une
fois — et échoue bruyamment si elle devient introuvable, pour ne pas
passer au vert en ne vérifiant plus rien. Chaque écran est vérifié à
l'ouverture **puis après défilement jusqu'en bas**, là où vivent les
boutons principaux qu'une barre basse peut recouvrir.

**Prochaines étapes** (pas de blocage technique, juste pas encore fait) :
éventuellement un vrai popover ancré pour le menu "⋯"/sélecteur de listes
plutôt que le `Modal` positionné approximativement actuel, un écran "voir
tout" derrière le chevron "›" du Profil, la page publique `/u/<identifiant>`
vers laquelle pointe le lien de profil partagé (suppose des comptes
hébergés, voir §9), étendre les requêtes IGDB avec
`genres` pour afficher de vrais genres sur l'écran Statistiques plutôt que
les plateformes, étendre la bande originale curatée (§6.4) à davantage de
jeux.

**Plus tard (backlog, pas pour cette itération)** :
- **Système d'abonnés/abonnements entre utilisateurs** — condition
  préalable à de vraies notifications d'activité (l'icône du Profil,
  voir plus haut, et les compteurs "Abonnements"/"Abonné" figés à 0
  existent déjà côté UI, en attente de ce système) et à "Jeux joués par
  tes amis" sur Explorer (voir §6.5).
- **Connexion/création de compte** (Google, numéro de téléphone, ou email
  classique) — condition préalable à tout ce qui précède : sans compte,
  pas de notion d'"abonné à qui" ; c'est aussi ce qui manque pour que
  l'app cesse d'être mono-utilisateur (voir §9/§10, `DISPLAY_NAME`
  actuellement une constante) et pour que `store.settings.steamId64`
  devienne une vraie liaison de compte plutôt qu'un champ collé à la
  main.

## 11. Licence

Le dépôt est public à des fins de démonstration (recherche d'emploi) mais
sans licence open source : `LICENSE` place le code sous "tous droits
réservés" — consultable, mais pas réutilisable sans autorisation.
