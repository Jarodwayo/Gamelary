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
  section en gras + chevron "›" + scroll horizontal sans indicateur
  visible, plateforme affichée sous le titre (seul contexte à la garder).
  Prop `size` ('small', par défaut — utilisée par "Jeux préférés' — ou
  'large' — "Jeux joués") : cartes `LargeShelfCard` à la même largeur que
  `GameGrid` (`useGridItemWidth`, exportée depuis `game-grid.tsx` — un seul
  point de vérité pour cette taille, pas une valeur choisie à part), mais
  toujours dans un scroll horizontal, pas une grille qui retourne à la
  ligne (le Profil reste un aperçu). `emptyAction` (optionnel) affiche un
  lien vers Explorer sous le message d'état vide — un nouvel utilisateur
  sans jeu joué/favori voit un vrai point de départ plutôt qu'un texte
  explicatif suivi de rien à faire. `FeaturedShelf` (même fichier) est la
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
  carte dans une liste horizontale (`FlatList horizontal`) — chaque carte
  affectée retombant sur la taille de son propre contenu. Trouvé sur
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
(10 actuellement — les 6 jeux de démo + The Witcher 3: Wild Hunt, Undertale,
Cuphead, Journey, choisis pour la fiabilité de leurs informations
publiques), pas les jeux découverts via Explorer/recherche en dehors de
cette liste (`Game.tracks` reste vide pour eux, voir `useGame`) — élargir
cette liste reste une simple question de temps de curation, pas un
obstacle technique. `demoSeed` (voir `tracked-games.ts`) distingue les jeux
ajoutés d'office à la bibliothèque de démo (les 6 premiers) de ceux qui
n'ont qu'une bande originale curatée prête si l'utilisateur les rencontre
autrement.

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
  (`inLibrary: false`, `achievements` vide). Bascule directe pour `favoris`
  spécifiquement : icône cœur sur la fiche jeu (`toggleListMembership
  ('favoris', id)`), en plus de l'entrée générique "Ajouter à une liste" du
  menu ⋯ — sans ce bouton dédié, marquer un favori demandait de passer par
  le sélecteur de listes complet pour une action très fréquente.
- **`settings`** : réglages globaux, pas propres à un jeu — pour l'instant
  seulement `steamId64` (Profil, "Lier mon compte Steam"), utilisé pour
  appeler `gamelary-api` (voir §6.3). Pas une vraie authentification :
  l'utilisateur colle lui-même son SteamID64, jamais vérifié.
- Seedé une seule fois (premier lancement, avant toute écriture
  AsyncStorage) à partir des jeux `demoSeed: true` de `tracked-games.ts`
  (voir §6.3 et §6.4) — les autres entrées curatées n'y sont que pour leur
  bande originale, pas ajoutées d'office à la bibliothèque de démo. Clé
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
- **Google OAuth + email.** Pas de vérification par téléphone :
  l'authentification Google fournit déjà une identité vérifiée et unique,
  le SMS coûte de l'argent chez tous les fournisseurs sérieux, ajoute de la
  friction à l'inscription, et ne protège de rien tant qu'il n'y a ni
  fonctionnalité sociale ni abus à contenir. À rouvrir si l'un des deux
  arrive.
- **L'offline-first est conservé.** AsyncStorage reste la copie de travail
  et la source de vérité de l'affichage ; Supabase est une **cible de
  synchronisation**, pas la source lue à chaque rendu. Sans ça, l'app
  cesserait de fonctionner hors réseau — une régression, pas une évolution.

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

Ces quatre points coûtaient peu tant qu'aucun compte n'existe et devenaient
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

### 9.4 Schéma distant (Postgres / Supabase)

Toutes les tables portent `user_id` et sont protégées par Row Level
Security — c'est ce qui remplace la logique d'autorisation qu'on écrirait à
la main dans un backend classique :

```sql
alter table user_games enable row level security;
create policy "propriétaire uniquement" on user_games
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

```sql
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  steam_id64   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Un jeu tel que CET utilisateur le suit (jamais le catalogue lui-même :
-- titre/plateforme restent dérivés d'IGDB, voir §6.1).
create table user_games (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users on delete cascade,
  igdb_id              bigint,       -- identité canonique ; null si non résolue
  slug                 text not null,-- id local historique, conservé pour la reprise
  title                text not null,
  platform             text,
  steam_app_id         integer,
  in_library           boolean not null default false,
  stopped              boolean not null default false,
  rating               smallint check (rating between 0 and 20),
  review               text,
  -- Le favori local pointe vers un id issu d'un fichier statique
  -- (tracked-games.ts) : stocké ici en clair, sinon la référence pend dès
  -- que ce fichier change.
  favorite_track_title text,
  favorite_track_artist text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Identité : l'id IGDB fait foi quand il est connu, le slug sert de repli.
create unique index on user_games (user_id, igdb_id) where igdb_id is not null;
create unique index on user_games (user_id, slug)    where igdb_id is null;

create table achievements (
  id            uuid primary key default gen_random_uuid(),
  user_game_id  uuid not null references user_games on delete cascade,
  source        text not null check (source in ('manual', 'steam')),
  external_key  text not null,  -- apiname Steam, ou nom normalisé si manuel
  name          text not null,
  unlocked      boolean not null default false,
  updated_at    timestamptz not null default now(),
  -- Rend l'import Steam idempotent par construction, et supprime les
  -- doublons dus aux ids horodatés (voir 9.2.3).
  unique (user_game_id, source, external_key)
);

create table play_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_game_id uuid not null references user_games on delete cascade,
  played_at    timestamptz not null,
  hours        numeric(6,2) not null,
  -- setTotalHours (§6.6) enregistre une session CORRECTRICE égale à l'écart,
  -- pas du temps réellement joué ce jour-là. Sans cette distinction, fusionner
  -- deux appareils rejouerait les corrections et gonflerait les totaux.
  kind         text not null default 'logged' check (kind in ('logged', 'correction')),
  client_key   text not null,  -- déterministe : rend un ré-upload idempotent
  unique (user_game_id, client_key)
);

create table lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  builtin_key text,             -- 'favoris' | 'wishlist' | null si liste créée
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, builtin_key)
);

create table list_games (
  list_id      uuid not null references lists on delete cascade,
  user_game_id uuid not null references user_games on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (list_id, user_game_id)
);
```

### 9.5 Migration local → distant

Le risque n'est pas l'authentification : c'est de **corrompre ou perdre une
bibliothèque déjà constituée**. Un dégât de ce type se voit tard et coûte
bien plus cher à réparer qu'à prévenir.

1. **Instantané avant toute écriture.** Le blob local est copié sous une clé
   dédiée (`gamelary/game-store/pre-migration-<ts>`) qui n'est jamais
   écrasée ni migrée. Rien d'autre ne commence tant qu'elle n'est pas écrite.
2. **Résolution d'identité.** Les jeux sans `igdb_id` sont re-résolus par
   titre ; ceux qui échouent partent quand même, avec `igdb_id` à null et
   leur slug comme identité de repli — jamais abandonnés silencieusement.
3. **Envoi atomique.** Toute la bibliothèque part dans **une seule fonction
   RPC Postgres** (tout ou rien) plutôt qu'en N insertions : un envoi
   interrompu ne doit jamais laisser une demi-bibliothèque côté serveur.
4. **Bascule après accusé de réception.** Le local n'est marqué "synchronisé"
   qu'une fois le serveur confirmé, et l'instantané de l'étape 1 est
   conservé plusieurs jours après ça.
5. **Fusion si le compte contient déjà des données** (2ᵉ appareil) : par
   type, jamais un "dernier arrivé écrase tout" global.

| Donnée | Politique de fusion | Pourquoi |
|---|---|---|
| `in_library`, `stopped`, appartenance aux listes | **Union** | Ne jamais retirer ce que l'utilisateur a ajouté depuis un autre appareil |
| `play_sessions` | **Union** par `client_key`, corrections comprises mais jamais rejouées | Journal append-only : fusion sans perte et sans double comptage |
| `achievements` | Union par `(source, external_key)`, `unlocked` = **OU logique** | Un succès débloqué ne doit jamais se re-verrouiller |
| `rating`, `review` | **Le plus récent gagne** (`updated_at`) | Valeur unique : vrai conflit, arbitrage nécessaire — **dépend du prérequis 9.3.2** |
| `steam_id64` | Le plus récent gagne | Simple réglage, enjeu faible |

### 9.6 Points encore ouverts

- **Réconciliation d'identité tardive** : un jeu envoyé avec `igdb_id` null
  puis résolu plus tard peut entrer en collision avec une ligne portant déjà
  cet `igdb_id`. Il faut une étape de fusion de lignes, pas un simple
  `update`.
- **Suppression de compte et export des données** (RGPD) : `on delete
  cascade` couvre l'effacement, l'export reste à concevoir.
- **Refus de migrer** : que fait l'app si l'utilisateur crée un compte mais
  décline l'envoi de sa bibliothèque locale ?
- **Réglages non horodatés** : §9.3.2 ne portait que sur les jeux, et
  c'est ce qui a été implémenté. Or la table de fusion de §9.5 promet « le
  plus récent gagne » pour `steam_id64`, arbitrage aussi impossible sans
  horodatage que pour `rating`/`review`. À trancher : ajouter un
  `updatedAt` aux réglages, ou se contenter de l'`updated_at` posé côté
  serveur à l'écriture (suffisant tant qu'un seul appareil écrit à la
  fois, faux dès qu'un appareil hors ligne renvoie une valeur ancienne).
- **`steamAppId` écrasable par une absence** : contrairement à `igdbId`,
  `registerCatalogGame` remplace encore le `steamAppId` connu par
  `undefined` si une résolution n'en rapporte pas. Comportement antérieur,
  laissé tel quel pour ne pas élargir le sujet, mais c'est la même classe
  de perte silencieuse.
- **Quota et abus** : aucune limite par utilisateur aujourd'hui. À cadrer
  avant toute ouverture publique, en même temps que l'absence de rate
  limiting sur les routes existantes (`games+api.ts`, `gamelary-api`), qui
  n'est elle non plus documentée nulle part pour l'instant.

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
n'existe pas ou ne charge pas (voir `game-title-header.tsx`). Seul "Se
déconnecter" reste un stub dans le menu "⋯", faute de compte à
déconnecter.

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
  d'une `FlatList` horizontale : trouvé sur "Jeux joués" du Profil (cartes
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

**Simplifications assumées pour cette itération** :
- Le menu "⋯" de la fiche jeu (Partager/Arrêter de jouer/Ajouter à une
  liste) et la modale de sélection de listes sont des `Modal` React Native
  positionnés approximativement, pas un vrai popover ancré dynamiquement
  (RN n'a pas d'équivalent direct du "clic en dehors pour fermer" du web
  sans mesure de layout supplémentaire). Le nouveau menu "⋯" du Profil
  réutilise ce même composant (`OverflowMenu`) ; ses 6 options (Partager le
  profil/Paramètres/Modifier le profil/Créer une liste/Aide et idées/Se
  déconnecter) sont pour l'instant des entrées sans effet (pas d'écran
  associé, pas de compte à déconnecter) — seule l'interface du menu était
  demandée pour cette itération.
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
sur iOS, 80 sur Android, 76 sur le web — et tout ce qui doit rester
atteignable au-dessus d'elle s'y réfère (bas des écrans scrollables, bouton
de recherche flottant). Le déplacement n'a donc pas fait disparaître le
problème de recouvrement, il l'a déplacé en bas : vérifié écran par écran
dans le navigateur, défilé jusqu'en bas, qu'aucun élément interactif ne
passe sous la barre (Bibliothèque, Explorer, Profil, fiche jeu, Créer une
liste, Modifier le profil, Paramètres, Aide, Statistiques). `WebTopBarInset`
a disparu avec la barre du haut qui le justifiait.

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
