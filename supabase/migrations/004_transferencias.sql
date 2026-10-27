-- Pago por transferencia al alias de Paula: la persona sube el comprobante y Paula lo aprueba en el Panel.

create table public.ajustes (
  clave text primary key check (clave in ('alias', 'titular')),
  valor text not null default ''
);
alter table public.ajustes enable row level security;
create policy "ajustes: todos leen" on public.ajustes for select using (true);
create policy "ajustes: admin edita" on public.ajustes for update using (is_admin()) with check (is_admin());
insert into public.ajustes (clave) values ('alias'), ('titular');

alter table public.ordenes add column metodo text not null default 'mp' check (metodo in ('mp', 'transferencia'));
-- Una transferencia queda "en revisión" cuando sigue pendiente y ya tiene comprobante.
alter table public.ordenes add column comprobante text;

-- Comprobantes: cada persona sube en su carpeta (<user_id>/...), y solo ella y Paula los ven.
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false);
create policy "comprobantes: cada uno sube el suyo" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes: dueño y admin ven" on storage.objects for select
  using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- Habilita lo comprado en una orden. Es lo mismo que hace el aviso de Mercado Pago.
create function public.habilitar_orden(o public.ordenes) returns void
language plpgsql security definer set search_path = public as $$
declare
  prod text := split_part(o.producto, ':', 1);
  ref text := split_part(o.producto, ':', 2);
begin
  if prod = 'med' then
    insert into meditaciones_compradas (user_id, meditacion_id, orden_id) values (o.user_id, ref::uuid, o.id) on conflict do nothing;
  elsif prod = 'vivo' then
    insert into accesos (user_id, vivo_id, orden_id) values (o.user_id, ref::uuid, o.id) on conflict do nothing;
  elsif prod = 'pack' then
    insert into accesos (user_id, vivo_id, orden_id) select o.user_id, v.id, o.id from vivos v where v.mes = ref on conflict do nothing;
    insert into packs_comprados (user_id, mes, orden_id) values (o.user_id, ref, o.id) on conflict do nothing;
  end if;
  update ordenes set estado = 'aprobada' where id = o.id;
end $$;
revoke execute on function public.habilitar_orden(public.ordenes) from public, anon, authenticated;

-- La persona avisa que ya transfirió y adjunta el comprobante.
create function public.adjuntar_comprobante(orden uuid, ruta text) returns boolean
language sql security definer set search_path = public as $$
  with u as (
    update ordenes set comprobante = ruta
    where id = orden and user_id = auth.uid() and metodo = 'transferencia' and estado = 'pendiente'
      and split_part(ruta, '/', 1) = auth.uid()::text
    returning 1
  ) select exists (select 1 from u);
$$;

-- Paula aprueba o rechaza una transferencia.
create function public.revisar_transferencia(orden uuid, aprobar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare o ordenes;
begin
  if not is_admin() then raise exception 'Solo Paula puede revisar transferencias.'; end if;
  select * into o from ordenes where id = orden and metodo = 'transferencia' and estado = 'pendiente';
  if not found then raise exception 'No existe esa transferencia.'; end if;
  if aprobar then perform habilitar_orden(o);
  else update ordenes set estado = 'rechazada' where id = orden;
  end if;
end $$;

-- Transferencias esperando revisión, con el correo de quien compró.
create function public.transferencias_por_revisar()
returns table (id uuid, email text, producto text, monto integer, comprobante text, creada timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, u.email::text, o.producto, o.monto, o.comprobante, o.creada
  from ordenes o join auth.users u on u.id = o.user_id
  where is_admin() and o.metodo = 'transferencia' and o.estado = 'pendiente' and o.comprobante is not null
  order by o.creada;
$$;
