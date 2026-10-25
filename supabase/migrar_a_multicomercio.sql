-- =====================================================================
--  CAJA & STOCK — Migrar una base de UN comercio (v1) a MULTI-COMERCIO (v2)
--
--  1) Hacé un backup antes (Database → Backups, o exportá las tablas a CSV).
--  2) SQL Editor → pegar ESTE archivo → Run.
--  3) Después pegar supabase/schema.sql completo → Run.
--
--  Todos los datos actuales (productos, ventas, cajas, usuarios…) pasan a un
--  comercio con el nombre de tu configuración, plan completo y sin vencimiento.
--  Tus usuarios siguen igual (el admin sigue siendo admin de ese comercio).
--  El ADMINISTRADOR GENERAL (gestiona clientes, no vende) se crea después desde
--  la pantalla de login, con OTRO email (ej: tuemail+admin@gmail.com).
--  Si algo falla no se cambia nada (todo corre en una transacción).
-- =====================================================================

begin;

do $$
declare
  v_com uuid;
  v_nombre text;
  v_plan text := 'completo';
  v_vence date;
  v_contacto text := '';
  v_ultimo bigint;
  t text;
begin
  if to_regclass('public.comercios') is not null then
    raise exception 'Esta base ya es multi-comercio: no hace falta migrar. Corré sólo schema.sql.';
  end if;
  if to_regclass('public.config') is null or to_regclass('public.ventas') is null then
    raise exception 'No encuentro las tablas de la versión anterior. Para una instalación nueva corré sólo schema.sql.';
  end if;

  -- Datos del comercio actual
  execute 'select nombre from config limit 1' into v_nombre;
  if to_regclass('public.licencia') is not null then
    execute 'select plan, vence, contacto from licencia where id = 1' into v_plan, v_vence, v_contacto;
  end if;
  execute 'select coalesce(max(numero), 0) from ventas' into v_ultimo;

  create table comercios (
    id             uuid primary key default gen_random_uuid(),
    nombre         text not null,
    plan           text not null default 'basico' check (plan in ('basico', 'completo')),
    vence          date,
    activo         boolean not null default true,
    contacto       text not null default '',
    notas          text not null default '',
    ultimo_ticket  bigint not null default 0,
    creado         timestamptz not null default now()
  );
  insert into comercios (nombre, plan, vence, contacto, ultimo_ticket)
  values (coalesce(nullif(v_nombre, ''), 'Mi comercio'), coalesce(v_plan, 'completo'), v_vence, coalesce(v_contacto, ''), v_ultimo)
  returning id into v_com;

  -- comercio_id en todas las tablas, apuntando al comercio actual
  foreach t in array array['perfiles','config','proveedores','productos','cajas','ventas','venta_items',
                           'movimientos_caja','movimientos_stock','compras','gastos','comprobantes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table %I add column if not exists comercio_id uuid', t);
      execute format('update %I set comercio_id = %L where comercio_id is null', t, v_com);
    end if;
  end loop;

  -- config: la clave pasa a ser el comercio
  alter table config drop constraint if exists config_pkey;
  alter table config drop constraint if exists config_id_check;
  alter table config drop column if exists id;
  alter table config add primary key (comercio_id);

  -- Numeración de tickets: de la secuencia global a un contador por comercio
  alter table ventas alter column numero drop default;
  alter table ventas drop constraint if exists ventas_numero_key;
  drop sequence if exists ventas_numero_seq;

  -- Índices únicos globales que pasan a ser por comercio (schema.sql crea los nuevos)
  drop index if exists productos_codigo_uk;
  drop index if exists cajas_una_abierta;

  -- Usuarios que se registraron solos y nunca fueron habilitados: quedan sin comercio
  delete from perfiles where not activo and rol = 'vendedor'
    and not exists (select 1 from ventas v where v.usuario_id = perfiles.id)
    and not exists (select 1 from cajas c where c.abierta_por = perfiles.id);

  -- Administrador general: se crea después desde el login (la tabla queda vacía)
  create table superadmins (
    user_id  uuid primary key references auth.users(id) on delete cascade,
    creado   timestamptz not null default now()
  );

  -- La tabla licencia (plan básico v1.2) queda reemplazada por comercios
  drop table if exists licencia cascade;
  drop function if exists sistema_inicializado();

  raise notice 'Migración lista: comercio "%" (%). Ahora corré schema.sql y después creá el administrador general desde el login.', coalesce(nullif(v_nombre, ''), 'Mi comercio'), v_com;
end $$;

commit;
