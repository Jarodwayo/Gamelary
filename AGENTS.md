# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
## Revue de code : substitution de Liskov et ségrégation des interfaces

Ces deux principes sont sous-couverts par les vérifications habituelles — à
contrôler explicitement à chaque revue de code, en plus des points déjà
couverts (duplication, nommage, couplage, sens des dépendances).

### Substitution de Liskov (LSP)
Toute implémentation d'une interface, tout membre d'un type union, ou toute
variante doit pouvoir remplacer les autres sans que l'appelant ait besoin de
le savoir ou de se comporter différemment selon le cas.

- Un appelant fait-il un `if (x.type === ...)` ou un type-narrowing pour
  contourner le cas particulier d'une variante ? C'est un signe que
  l'abstraction fuit.
- Une implémentation renvoie-t-elle `null`/`undefined`, ou lève-t-elle une
  erreur, là où le type/l'interface ne le prévoit pas pour les autres
  implémentations ?
- Un composant qui reçoit un type union (ex: plusieurs variantes de jeu ou
  de liste) est-il traité de façon uniforme par tous ses appelants, sans cas
  particulier caché pour l'une des variantes ?

### Ségrégation des interfaces (ISP)
Un composant ou une fonction ne doit dépendre que des champs/méthodes qu'il
utilise réellement, jamais d'une interface fourre-tout partagée par
commodité.

- Un composant reçoit-il tout un objet store/props alors qu'il n'en utilise
  que 2-3 champs ? Préférer un hook/sélecteur plus étroit, ou un type de
  props dédié.
- Avant d'ajouter un champ à un type partagé "au cas où" : un type plus
  spécifique pour ce cas d'usage précis serait-il plus propre qu'un
  élargissement du type existant ?
