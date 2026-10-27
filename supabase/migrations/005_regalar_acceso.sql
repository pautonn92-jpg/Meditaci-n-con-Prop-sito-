-- Dar acceso a quienes ya pagaron por fuera de la app (antes de que existiera).
-- Paula carga los mails; si la persona todavía no entró nunca, el acceso la espera hasta que entre.

create table public.accesos_por_mail (
  email text not null,
  meditacion_id uuid not null references public.meditaciones(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (email, meditacion_id)
);
alter table public.accesos_por_mail enable row level security;
create policy "accesos por mail: solo admin" on public.accesos_por_mail for all using (is_admin()) with check (is_admin());

-- Paula pega una lista de mails (separados por comas, espacios o renglones) y elige la meditación.
create function public.dar_acceso(mails text, meditacion uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not is_admin() then raise exception 'Solo Paula puede dar acceso.'; end if;
  with lista as (
    select distinct lower(trim(m)) as email from regexp_split_to_table(mails, '[\s,;]+') m where trim(m) like '%_@_%'
  ), nuevos as (
    insert into accesos_por_mail (email, meditacion_id) select email, meditacion from lista on conflict do nothing returning email
  )
  select count(*) into n from lista;
  -- Quienes ya tienen cuenta lo ven en el momento.
  insert into meditaciones_compradas (user_id, meditacion_id)
    select u.id, meditacion from auth.users u join accesos_por_mail a on a.email = lower(u.email) and a.meditacion_id = meditacion
    on conflict do nothing;
  return n;
end $$;

-- Cuando alguien entra por primera vez, recibe lo que Paula le dejó.
create function public.recibir_accesos_por_mail() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into meditaciones_compradas (user_id, meditacion_id)
    select new.id, a.meditacion_id from accesos_por_mail a where a.email = lower(new.email)
    on conflict do nothing;
  return new;
end $$;
create trigger recibir_accesos_por_mail after insert on auth.users
  for each row execute function public.recibir_accesos_por_mail();
