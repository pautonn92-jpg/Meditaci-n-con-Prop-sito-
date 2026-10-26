-- Meditación con propósito: tablas, permisos y almacenamiento.

-- Quién puede administrar (Paula). Se carga a mano con su correo.
create table public.admins (
  email text primary key
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;

-- Precios en pesos argentinos. Se cambian sin tocar código.
create table public.precios (
  clave text primary key check (clave in ('vivo', 'pack_por_vivo')),
  monto integer not null check (monto > 0)
);
insert into public.precios (clave, monto) values ('vivo', 25000), ('pack_por_vivo', 20000);

-- Cada vivo de los viernes.
create table public.vivos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  empieza timestamptz not null,
  mes text not null,            -- 'YYYY-MM' en hora argentina, lo completa el trigger
  duracion_min integer not null default 40
);

create or replace function public.poner_mes_vivo() returns trigger language plpgsql set search_path = public as $$
begin
  new.mes := to_char(new.empieza at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM');
  return new;
end $$;
create trigger vivos_mes before insert or update of empieza on public.vivos
  for each row execute function public.poner_mes_vivo();

-- Link de la videollamada, aparte para que solo lo vea quien pagó.
create table public.links_vivos (
  vivo_id uuid primary key references public.vivos(id) on delete cascade,
  link text not null
);

-- Meditaciones grabadas: gratis, la corta de la semana de un vivo, o un regalo del pack de un mes.
create table public.meditaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  minutos integer not null check (minutos between 1 and 45),
  tipo text not null check (tipo in ('gratis', 'semana', 'pack')),
  vivo_id uuid references public.vivos(id) on delete set null,
  mes_pack text check (mes_pack ~ '^\d{4}-\d{2}$'),  -- para tipo 'pack': 'YYYY-MM'
  archivo text,                -- ruta dentro del bucket "meditaciones"
  formato text not null default 'audio' check (formato in ('audio', 'video')),
  publicada boolean not null default false,
  creada timestamptz not null default now(),
  check (tipo = 'gratis' or (tipo = 'semana' and vivo_id is not null) or (tipo = 'pack' and mes_pack is not null))
);

-- Lo que cada persona tiene habilitado. Una fila por vivo pagado.
create table public.accesos (
  user_id uuid not null references auth.users(id) on delete cascade,
  vivo_id uuid not null references public.vivos(id) on delete cascade,
  orden_id uuid,
  creado timestamptz not null default now(),
  primary key (user_id, vivo_id)
);

-- Packs del mes comprados. Habilitan los regalos de ese pack.
create table public.packs_comprados (
  user_id uuid not null references auth.users(id) on delete cascade,
  mes text not null,
  orden_id uuid,
  primary key (user_id, mes)
);

-- Cada intento de compra. Lo escribe solo el servidor.
create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  producto text not null,      -- 'vivo:<id>' o 'pack:<YYYY-MM>'
  monto integer not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  mp_pago_id text,
  creada timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.precios enable row level security;
alter table public.vivos enable row level security;
alter table public.links_vivos enable row level security;
alter table public.meditaciones enable row level security;
alter table public.accesos enable row level security;
alter table public.packs_comprados enable row level security;
alter table public.ordenes enable row level security;

create policy "precios: todos leen" on public.precios for select using (true);
create policy "precios: admin edita" on public.precios for update using (is_admin());

create policy "vivos: todos leen" on public.vivos for select using (true);
create policy "vivos: admin edita" on public.vivos for all using (is_admin()) with check (is_admin());

create policy "meditaciones: todos ven las publicadas" on public.meditaciones for select using (publicada or is_admin());
create policy "meditaciones: admin edita" on public.meditaciones for all using (is_admin()) with check (is_admin());

create policy "accesos: cada uno ve los suyos" on public.accesos for select using (user_id = auth.uid() or is_admin());
create policy "packs: cada uno ve los suyos" on public.packs_comprados for select using (user_id = auth.uid() or is_admin());
create policy "ordenes: cada uno ve las suyas" on public.ordenes for select using (user_id = auth.uid() or is_admin());

create policy "links: quien pagó ese vivo" on public.links_vivos for select using (
  is_admin() or exists (select 1 from public.accesos a where a.vivo_id = links_vivos.vivo_id and a.user_id = auth.uid())
);
create policy "links: admin edita" on public.links_vivos for all using (is_admin()) with check (is_admin());

-- Archivos de audio y video: privados. Se escuchan con un link firmado
-- que solo se puede pedir si la meditación es gratis o si la persona pagó ese vivo.
insert into storage.buckets (id, name, public) values ('meditaciones', 'meditaciones', false);

create policy "audio: escuchar si corresponde" on storage.objects for select using (
  bucket_id = 'meditaciones' and (
    is_admin() or exists (
      select 1 from public.meditaciones m
      where m.archivo = storage.objects.name and m.publicada and (
        m.tipo = 'gratis' or exists (
          select 1 from public.accesos a where a.vivo_id = m.vivo_id and a.user_id = auth.uid()
        ) or exists (
          select 1 from public.packs_comprados p where p.mes = m.mes_pack and p.user_id = auth.uid()
        )
      )
    )
  )
);
create policy "audio: admin sube" on storage.objects for insert with check (bucket_id = 'meditaciones' and is_admin());
create policy "audio: admin borra" on storage.objects for delete using (bucket_id = 'meditaciones' and is_admin());
