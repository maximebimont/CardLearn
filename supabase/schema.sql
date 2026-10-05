-- CardLearn : progression de chaque personne (à exécuter une fois dans le SQL Editor de Supabase).
-- Une ligne par personne et par clé ; la valeur est le JSON enregistré par CardLearn.jsx.

create table if not exists public.progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 100),
  value text not null check (char_length(value) <= 500000),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.progress enable row level security;

-- Chacun ne lit et n'écrit que sa propre progression.
drop policy if exists "progress_select_own" on public.progress;
create policy "progress_select_own" on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "progress_insert_own" on public.progress;
create policy "progress_insert_own" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own" on public.progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "progress_delete_own" on public.progress;
create policy "progress_delete_own" on public.progress
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.progress from anon;
grant select, insert, update, delete on public.progress to authenticated;

-- Suppression de compte par la personne elle-même (bouton « Supprimer mon compte » du profil).
-- Ne peut supprimer que le compte connecté ; sa progression part avec (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Aucun compte connecté';
  end if;
  delete from public.progress where user_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Classement : chaque élève qui veut y apparaître choisit un pseudo (son e-mail n'est jamais montré).

-- La progression doit être du JSON valide, puisque le classement la lit.
alter table public.progress drop constraint if exists progress_value_json;
alter table public.progress add constraint progress_value_json check ((value::jsonb) is not null);

create table if not exists public.players (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  pseudo text not null check (char_length(btrim(pseudo)) between 2 and 20),
  joined_at timestamptz not null default now()
);
create unique index if not exists players_pseudo_unique on public.players (lower(btrim(pseudo)));

alter table public.players enable row level security;

drop policy if exists "players_select_own" on public.players;
create policy "players_select_own" on public.players
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "players_insert_own" on public.players;
create policy "players_insert_own" on public.players
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "players_update_own" on public.players;
create policy "players_update_own" on public.players
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "players_delete_own" on public.players;
create policy "players_delete_own" on public.players
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.players from anon;
grant select, insert, update, delete on public.players to authenticated;

-- Les 100 premiers, par nombre de cartes maîtrisées (niveau 5), calculé depuis la progression.
-- Ne renvoie que le rang, le pseudo et le score : ni adresse, ni progression détaillée.
create or replace function public.get_leaderboard()
returns table (rank bigint, pseudo text, mastered integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select
      p.user_id,
      p.pseudo,
      p.joined_at,
      coalesce((
        select count(*)::integer
        from jsonb_each(
          case
            when jsonb_typeof(pr.value::jsonb -> 'cards') = 'object' then pr.value::jsonb -> 'cards'
            else '{}'::jsonb
          end
        ) as c(card_id, card)
        where c.card_id ~ '^[med][0-9]{2}$'
          and jsonb_typeof(c.card -> 'b') = 'number'
          and (c.card ->> 'b')::numeric >= 5
      ), 0) as mastered
    from public.players p
    left join public.progress pr on pr.user_id = p.user_id and pr.key = 'vocab-progress'
  )
  select rank() over (order by s.mastered desc), s.pseudo, s.mastered, s.user_id = auth.uid()
  from scores s
  where auth.uid() is not null
  order by s.mastered desc, s.joined_at
  limit 100;
$$;

revoke all on function public.get_leaderboard() from public, anon;
grant execute on function public.get_leaderboard() to authenticated;
