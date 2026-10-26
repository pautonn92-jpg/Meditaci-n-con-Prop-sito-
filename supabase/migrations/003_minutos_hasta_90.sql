-- Las grabaciones de los vivos pueden pasar los 45 minutos.
alter table public.meditaciones drop constraint meditaciones_minutos_check;
alter table public.meditaciones add constraint meditaciones_minutos_check check (minutos between 1 and 90);
