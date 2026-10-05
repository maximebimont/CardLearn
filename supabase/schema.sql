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
