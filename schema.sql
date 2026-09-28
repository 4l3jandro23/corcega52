-- Córcega 52 · esquema para Supabase
-- Pégalo entero en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.

-- ---------- Tablas ----------

-- Configuración compartida (una sola fila, id = 'main')
create table if not exists public.config (
  id         text primary key default 'main' check (id = 'main'),
  epoch      date not null default '2026-09-14' check (extract(isodow from epoch) = 1),
  updated_at timestamptz not null default now()
);
insert into public.config (id, epoch) values ('main', '2026-09-14') on conflict (id) do nothing;

-- Tareas hechas: UNA fila por semana y tarea (marcar = insertar, desmarcar = borrar).
-- Así dos personas marcando tareas distintas a la vez nunca se pisan.
create table if not exists public.checks (
  week     date not null check (extract(isodow from week) = 1),   -- lunes de la semana
  task     text not null check (task in ('A','B','lavabo','basura')),
  done_by  text not null check (done_by in ('Alejandro','Ana','Natalia','Rocío')),
  done_at  timestamptz not null default now(),
  primary key (week, task)
);

-- Cambios de turno: UNA fila por semana y tarea
create table if not exists public.swaps (
  week     date not null check (extract(isodow from week) = 1),
  task     text not null check (task in ('A','B','lavabo','basura')),
  person   text not null check (person in ('Alejandro','Ana','Natalia','Rocío')),
  primary key (week, task),
  check (task <> 'lavabo' or person in ('Alejandro','Rocío'))
);

-- Lista "Falta en casa": una fila por cosa
create table if not exists public.compra (
  id         uuid primary key default gen_random_uuid(),
  text       text not null check (char_length(text) between 1 and 60),
  added_by   text not null check (added_by in ('Alejandro','Ana','Natalia','Rocío')),
  created_at timestamptz not null default now()
);

-- ---------- Permisos (la app entra con la anon/publishable key) ----------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.config, public.checks, public.swaps, public.compra to anon, authenticated;

alter table public.config enable row level security;
alter table public.checks enable row level security;
alter table public.swaps  enable row level security;
alter table public.compra enable row level security;

drop policy if exists "piso lee config"     on public.config;
drop policy if exists "piso escribe config" on public.config;
create policy "piso lee config"     on public.config for select to anon, authenticated using (true);
create policy "piso escribe config" on public.config for update to anon, authenticated using (id = 'main') with check (id = 'main');
-- (config no admite insert ni delete desde la app: la fila ya existe)

drop policy if exists "piso checks" on public.checks;
create policy "piso checks" on public.checks for all to anon, authenticated using (true) with check (true);

drop policy if exists "piso swaps" on public.swaps;
create policy "piso swaps" on public.swaps for all to anon, authenticated using (true) with check (true);

drop policy if exists "piso compra" on public.compra;
create policy "piso compra" on public.compra for all to anon, authenticated using (true) with check (true);

-- ---------- Realtime ----------
-- Añade las tablas a la publicación de Realtime (si ya estaban, no hace nada).
do $$
declare t text;
begin
  foreach t in array array['config','checks','swaps','compra'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Limpieza opcional: borra marcas y cambios de hace más de 6 meses.
-- (No se ejecuta sola; lánzala a mano si algún día quieres.)
-- delete from public.checks where week < current_date - interval '6 months';
-- delete from public.swaps  where week < current_date - interval '6 months';
