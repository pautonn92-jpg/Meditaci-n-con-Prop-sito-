-- Meditaciones que se venden solas, cada una con su precio.

alter table public.meditaciones drop constraint meditaciones_tipo_check;
alter table public.meditaciones add constraint meditaciones_tipo_check check (tipo in ('gratis', 'semana', 'pack', 'individual'));
alter table public.meditaciones add column precio integer check (precio > 0);
alter table public.meditaciones drop constraint meditaciones_check;
alter table public.meditaciones add constraint meditaciones_check check (
  tipo = 'gratis'
  or (tipo = 'semana' and vivo_id is not null)
  or (tipo = 'pack' and mes_pack is not null)
  or (tipo = 'individual' and precio is not null)
);

create table public.meditaciones_compradas (
  user_id uuid not null references auth.users(id) on delete cascade,
  meditacion_id uuid not null references public.meditaciones(id) on delete cascade,
  orden_id uuid,
  primary key (user_id, meditacion_id)
);
alter table public.meditaciones_compradas enable row level security;
create policy "compradas: cada uno ve las suyas" on public.meditaciones_compradas for select using (user_id = auth.uid() or is_admin());

drop policy "audio: escuchar si corresponde" on storage.objects;
create policy "audio: escuchar si corresponde" on storage.objects for select using (
  bucket_id = 'meditaciones' and (
    is_admin() or exists (
      select 1 from public.meditaciones m
      where m.archivo = storage.objects.name and m.publicada and (
        m.tipo = 'gratis' or exists (
          select 1 from public.accesos a where a.vivo_id = m.vivo_id and a.user_id = auth.uid()
        ) or exists (
          select 1 from public.packs_comprados p where p.mes = m.mes_pack and p.user_id = auth.uid()
        ) or exists (
          select 1 from public.meditaciones_compradas c where c.meditacion_id = m.id and c.user_id = auth.uid()
        )
      )
    )
  )
);
