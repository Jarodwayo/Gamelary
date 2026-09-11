-- Complète le schéma des listes pour la synchronisation §9.5 (ARCHITECTURE.md)
-- — portée initialement laissée hors scope par 20260910120000_initial_schema.sql,
-- qui ne couvrait que `user_games`/`achievements`. Ne modifie jamais ce
-- fichier après application sur un projet réel : une nouvelle migration pour
-- tout changement ultérieur, comme pour n'importe quel schéma versionné.

-- `lists` n'avait ni description, ni visibilité, ni horodatage — impossible
-- jusqu'ici d'y appliquer l'arbitrage "le plus récent gagne" déjà en place
-- pour `rating`/`review` (voir §9.5). `hidden` reprend le nom du champ local
-- (`StoredList.hidden`, voir game-store.tsx) plutôt que "visibility" pour
-- rester un simple booléen aligné sur l'existant, pas une énumération qui
-- n'a pas lieu d'être tant qu'une seule notion de visibilité existe.
alter table lists add column description text;
alter table lists add column hidden      boolean not null default false;
alter table lists add column updated_at  timestamptz not null default now();

-- Identité de correspondance pour une liste CRÉÉE PAR L'UTILISATEUR : `id`
-- est généré côté serveur (`gen_random_uuid()`), donc inutilisable pour
-- apparier une ligne distante à une liste locale déjà existante (l'id local,
-- lui, est dérivé du nom + d'un timestamp, voir createList dans
-- game-store.tsx — need de matching de sync-service.ts). Même raisonnement
-- que `user_games.slug` à côté de son `id` distant : une colonne d'identité
-- choisie par le CLIENT, à côté de la clé primaire choisie par le serveur.
-- `builtin_key` (déjà présent) joue ce rôle pour Favoris/Wishlist ; les
-- listes créées par l'utilisateur n'ont pas de `builtin_key` (toujours null
-- pour elles) et utilisent `client_key` à la place — les deux colonnes ne
-- sont donc jamais renseignées en même temps pour une même ligne.
alter table lists add column client_key text;
create unique index on lists (user_id, client_key) where client_key is not null;

create trigger set_updated_at before update on lists
  for each row execute function set_updated_at();

-- Tombstone de suppression : une simple union de lignes `list_games` ne
-- peut pas représenter un retrait (voir §9.5) — sans marqueur, un appareil
-- qui retire un jeu d'une liste le verrait revenir dès la synchro suivante
-- tant que l'autre appareil ne l'a pas retiré lui aussi. `removed_at` renseigné
-- signifie "retiré à cette date-là" plutôt qu'une suppression pure de la
-- ligne, ce qui préserve l'information nécessaire à l'arbitrage
-- dernier-écrit-gagne face à un autre appareil qui, lui, aurait plutôt
-- (re)ajouté ce même jeu après coup.
alter table list_games add column removed_at timestamptz;
-- Sert à comparer "quel évènement est le plus récent" (ajout ou retrait)
-- entre deux appareils — `added_at` seul ne suffit pas puisqu'il ne bouge
-- plus une fois la ligne insérée, alors qu'un retrait doit pouvoir devenir
-- l'évènement le plus récent sans réinsertion.
alter table list_games add column updated_at timestamptz not null default now();

create trigger set_updated_at before update on list_games
  for each row execute function set_updated_at();
