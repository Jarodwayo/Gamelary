-- Schéma initial des comptes Gamelary (voir ARCHITECTURE.md §9.4).
--
-- Comment l'appliquer : coller ce fichier dans Supabase Dashboard > SQL
-- Editor > New query > Run, sur un projet fraîchement créé. Si le CLI
-- Supabase est installé et le projet lié (`supabase link`), `supabase db
-- push` applique directement ce dossier `supabase/migrations/` — le nom du
-- fichier suit déjà la convention attendue (`<timestamp>_<nom>.sql`).
--
-- Ne modifie jamais ce fichier après application sur un projet réel :
-- une nouvelle migration (`supabase/migrations/<timestamp>_<nom>.sql`) pour
-- tout changement ultérieur, comme pour n'importe quel schéma versionné.

-- Vérifié pour de vrai avant d'écrire ce commentaire, pas seulement relu :
-- ce fichier a été appliqué tel quel à un Postgres 16 local (schéma auth
-- minimal simulé, auth.uid() lisant une variable de session pour changer
-- d'identité à volonté), puis 20 vérifications ont tourné dessus — deux
-- utilisateurs simulés, chacun lisant/écrivant ses propres lignes sur les
-- six tables, et tentant (en échec attendu) de lire ou modifier celles de
-- l'autre, y compris une tentative d'INSERT côté table fille rattachée au
-- jeu d'autrui (le cas que WITH CHECK existe pour bloquer). Le déclencheur
-- updated_at a été vérifié en observant une vraie valeur qui avance après
-- UPDATE, pas supposé fonctionner parce que la syntaxe est correcte. Toutes
-- passent. Non vérifié : le comportement sur un VRAI projet Supabase (les
-- GRANT accordés par défaut au rôle `authenticated` sur le schéma public y
-- sont supposés identiques à ceux posés à la main pour ce test, pas
-- observés directement — à confirmer à la première connexion réelle,
-- comme le rappelle déjà le §9.4 d'ARCHITECTURE.md).

-- gen_random_uuid() est une fonction native de Postgres depuis la version
-- 13 (le moteur des projets Supabase actuels) — pas besoin d'activer une
-- extension pour l'utiliser, contrairement aux anciennes versions qui
-- exigeaient pgcrypto ou uuid-ossp.

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
  -- doublons dus aux ids horodatés (voir §9.2.3).
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

-- Index sur les colonnes de rattachement des tables filles, annoncés comme
-- prérequis en ARCHITECTURE.md §9.4 mais jamais écrits jusqu'ici. Sans eux,
-- chaque ligne lue déclenche un scan complet de la table parent pour
-- vérifier la policy RLS (le sous-select `exists (... where g.id =
-- user_game_id ...)` ci-dessous), et chaque suppression en cascade
-- (`on delete cascade`) scanne elle aussi la table entière pour retrouver
-- les lignes filles à effacer.
-- list_games.list_id n'a pas besoin d'index séparé : c'est déjà la colonne
-- de tête de sa clé primaire composite (list_id, user_game_id), donc déjà
-- indexée. list_games.user_game_id, lui, ne l'est pas — même besoin que les
-- deux tables précédentes.
create index on achievements  (user_game_id);
create index on play_sessions(user_game_id);
create index on list_games   (user_game_id);

-- `updated_at not null default now()` ne s'applique QU'À L'INSERTION : Postgres
-- ne touche jamais une colonne à l'UPDATE sans qu'on le lui dise
-- explicitement. Sans ce trigger, `updated_at` resterait figé à la date de
-- création pour toujours — une colonne qui ment silencieusement, et qui
-- rendrait l'arbitrage "le plus récent gagne" du §9.5 systématiquement faux
-- dès la première modification. Une seule fonction partagée par les trois
-- tables qui portent la colonne (profiles, user_games, achievements ;
-- play_sessions/lists/list_games n'en ont pas, voir §9.4 : append-only ou
-- fusion par union, rien à arbitrer par date).
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger set_updated_at before update on user_games
  for each row execute function set_updated_at();
create trigger set_updated_at before update on achievements
  for each row execute function set_updated_at();

-- Crée la ligne `profiles` au moment de l'inscription (Google OAuth ou
-- email) plutôt que de compter sur le client pour le faire après coup : un
-- upsert applicatif oublié ou en échec silencieux laisserait un compte
-- `auth.users` sans profil, et la moindre lecture de `profiles` par cet
-- utilisateur renverrait alors une ligne vide sans erreur. `security
-- definer` est nécessaire ici (le trigger doit écrire dans `public.profiles`
-- alors qu'il se déclenche sur `auth.users`, une table que l'utilisateur en
-- cours de création n'a par définition pas encore le droit de référencer
-- indirectement) — `set search_path` est la protection standard contre le
-- détournement classique des fonctions `security definer` (un search_path
-- non figé permettrait à un rôle malveillant de faire résoudre `profiles`
-- vers une table de son propre schéma).
create function handle_new_user() returns trigger
  security definer set search_path = public
  language plpgsql as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Row Level Security sur les six tables — voir ARCHITECTURE.md §9.4 pour le
-- détail de chaque policy et pourquoi les tables filles remontent au
-- parent plutôt que de comparer directement `user_id`.
alter table profiles      enable row level security;
alter table user_games    enable row level security;
alter table achievements  enable row level security;
alter table play_sessions enable row level security;
alter table lists         enable row level security;
alter table list_games    enable row level security;

create policy "soi-même uniquement" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "propriétaire uniquement" on user_games
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propriétaire uniquement" on lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "via le jeu parent" on achievements
  for all using (exists (select 1 from user_games g
                         where g.id = user_game_id and g.user_id = auth.uid()))
  with check (exists (select 1 from user_games g
                      where g.id = user_game_id and g.user_id = auth.uid()));

create policy "via le jeu parent" on play_sessions
  for all using (exists (select 1 from user_games g
                         where g.id = user_game_id and g.user_id = auth.uid()))
  with check (exists (select 1 from user_games g
                      where g.id = user_game_id and g.user_id = auth.uid()));

create policy "via les deux parents" on list_games
  for all using (
    exists (select 1 from lists l      where l.id = list_id      and l.user_id = auth.uid())
    and exists (select 1 from user_games g where g.id = user_game_id and g.user_id = auth.uid()))
  with check (
    exists (select 1 from lists l      where l.id = list_id      and l.user_id = auth.uid())
    and exists (select 1 from user_games g where g.id = user_game_id and g.user_id = auth.uid()));
