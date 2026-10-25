-- =====================================================================
--  CAJA & STOCK — Esquema Supabase / PostgreSQL  (v2: MULTI-COMERCIO)
--  Una sola base para varios comercios: cada fila tiene comercio_id y las
--  políticas RLS hacen que cada usuario vea sólo lo de su comercio.
--
--  Instalación nueva:  SQL Editor → pegar este archivo completo → Run.
--  Base de un solo comercio (v1): correr ANTES migrar_a_multicomercio.sql.
--  Es idempotente: se puede volver a correr sin perder datos.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- COMERCIOS (clientes) y administración general
-- ---------------------------------------------------------------------
create table if not exists comercios (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  plan           text not null default 'basico' check (plan in ('basico', 'completo')),
  vence          date,                         -- último día de uso (null = sin vencimiento)
  activo         boolean not null default true, -- false = suspendido (modo consulta)
  contacto       text not null default '',     -- a quién llamar (aparece en los avisos de vencimiento)
  notas          text not null default '',     -- notas internas del superadmin
  ultimo_ticket  bigint not null default 0,    -- numeración de tickets propia de cada comercio
  creado         timestamptz not null default now()
);

-- Quiénes administran la plataforma (ven y gestionan todos los comercios, no sus datos)
create table if not exists superadmins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  creado   timestamptz not null default now()
);

-- Altas pendientes: al registrarse ese email, queda en ese comercio con ese rol
create table if not exists invitaciones (
  email        text primary key,               -- en minúsculas
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text not null default '',
  rol          text not null default 'vendedor' check (rol in ('admin', 'vendedor')),
  creado       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TABLAS DE CADA COMERCIO (comercio_id se agrega/valida más abajo)
-- ---------------------------------------------------------------------
create table if not exists perfiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  comercio_id  uuid,
  nombre       text not null,
  email        text not null,
  rol          text not null default 'vendedor' check (rol in ('admin','vendedor')),
  activo       boolean not null default false,
  creado       timestamptz not null default now()
);

create table if not exists config (
  comercio_id              uuid primary key,
  nombre                   text not null default 'Mi Drugstore',
  direccion                text not null default '',
  telefono                 text not null default '',
  cuit                     text not null default '',
  pie_ticket               text not null default '¡Gracias por su compra!',
  ancho_ticket             int  not null default 80 check (ancho_ticket in (58, 80)),
  permitir_stock_negativo  boolean not null default false,
  imprimir_automatico      boolean not null default false,
  categorias_producto      text[] not null default array[
    'Gaseosas','Aguas','Jugos','Energizantes','Cervezas','Vinos','Bebidas blancas',
    'Snacks','Golosinas','Chocolates','Galletitas','Helados','Cigarrillos','Almacén','Limpieza','Varios'],
  categorias_gasto         text[] not null default array[
    'Alquiler','Luz','Internet / Teléfono','Sueldos','Impuestos / ARCA','Comisiones bancarias / MP',
    'Mantenimiento','Limpieza','Bolsas / Insumos','Transporte / Fletes','Otros']
);

create table if not exists proveedores (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid,
  nombre       text not null,
  contacto     text not null default '',
  telefono     text not null default '',
  email        text not null default '',
  cuit         text not null default '',
  dias_visita  text not null default '',
  notas        text not null default '',
  creado       timestamptz not null default now()
);

create table if not exists productos (
  id            uuid primary key default gen_random_uuid(),
  comercio_id   uuid,
  nombre        text not null,
  codigo        text not null default '',
  categoria     text not null default 'Varios',
  marca         text not null default '',
  costo         numeric(14,2) not null default 0 check (costo >= 0),
  precio        numeric(14,2) not null default 0 check (precio >= 0),
  stock         numeric(14,3) not null default 0,
  stock_min     numeric(14,3) not null default 0,
  proveedor_id  uuid references proveedores(id) on delete set null,
  activo        boolean not null default true,
  favorito      boolean not null default false,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);
create index if not exists productos_nombre_idx on productos (lower(nombre));

create table if not exists cajas (
  id                  uuid primary key default gen_random_uuid(),
  comercio_id         uuid,
  estado              text not null default 'abierta' check (estado in ('abierta','cerrada')),
  apertura            timestamptz not null default now(),
  abierta_por         uuid references perfiles(id),
  abierta_por_nombre  text not null,
  monto_inicial       numeric(14,2) not null default 0,
  cierre              timestamptz,
  cerrada_por_nombre  text,
  total_ventas        numeric(14,2),
  cant_ventas         int,
  por_medio           jsonb,
  ingresos            numeric(14,2),
  egresos             numeric(14,2),
  efectivo_esperado   numeric(14,2),
  efectivo_contado    numeric(14,2),
  diferencia          numeric(14,2),
  observaciones       text
);

create table if not exists ventas (
  id                uuid primary key default gen_random_uuid(),
  comercio_id       uuid,
  numero            bigint not null,           -- correlativo por comercio (comercios.ultimo_ticket)
  fecha             timestamptz not null default now(),
  subtotal          numeric(14,2) not null default 0,
  descuento         numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0,
  costo_total       numeric(14,2) not null default 0,
  pagos             jsonb not null default '[]',
  recibido          numeric(14,2) not null default 0,
  vuelto            numeric(14,2) not null default 0,
  caja_id           uuid not null references cajas(id),
  usuario_id        uuid references perfiles(id),
  usuario_nombre    text not null,
  estado            text not null default 'completada' check (estado in ('completada','anulada')),
  motivo_anulacion  text,
  anulada_por       text,
  fecha_anulacion   timestamptz
);
create index if not exists ventas_caja_idx on ventas (caja_id);

create table if not exists venta_items (
  id           bigint generated always as identity primary key,
  comercio_id  uuid,
  venta_id     uuid not null references ventas(id) on delete cascade,
  producto_id  uuid references productos(id) on delete set null,
  nombre       text not null,
  codigo       text not null default '',
  categoria    text not null default 'Varios',
  cantidad     numeric(14,3) not null check (cantidad > 0),
  precio       numeric(14,2) not null,
  costo        numeric(14,2) not null default 0,
  subtotal     numeric(14,2) not null
);
create index if not exists venta_items_venta_idx on venta_items (venta_id);
create index if not exists venta_items_producto_idx on venta_items (producto_id);

create table if not exists movimientos_caja (
  id              uuid primary key default gen_random_uuid(),
  comercio_id     uuid,
  caja_id         uuid not null references cajas(id),
  tipo            text not null check (tipo in ('ingreso','egreso')),
  monto           numeric(14,2) not null check (monto > 0),
  concepto        text not null,
  fecha           timestamptz not null default now(),
  usuario_nombre  text not null,
  gasto_id        uuid,
  compra_id       uuid
);
create index if not exists movimientos_caja_caja_idx on movimientos_caja (caja_id);

create table if not exists movimientos_stock (
  id              bigint generated always as identity primary key,
  comercio_id     uuid,
  producto_id     uuid references productos(id) on delete cascade,
  nombre          text not null,
  tipo            text not null check (tipo in ('venta','compra','ajuste','merma','vencido','anulacion','alta')),
  cantidad        numeric(14,3) not null,
  stock_anterior  numeric(14,3) not null,
  stock_nuevo     numeric(14,3) not null,
  motivo          text,
  ref             text,
  fecha           timestamptz not null default now(),
  usuario_nombre  text not null
);

create table if not exists compras (
  id                 uuid primary key default gen_random_uuid(),
  comercio_id        uuid,
  fecha              timestamptz not null default now(),
  proveedor_id       uuid references proveedores(id) on delete set null,
  proveedor_nombre   text not null,
  comprobante        text not null default '',
  items              jsonb not null,
  total              numeric(14,2) not null,
  medio              text not null,
  pagado_desde_caja  boolean not null default false,
  usuario_nombre     text not null
);

create table if not exists gastos (
  id              uuid primary key default gen_random_uuid(),
  comercio_id     uuid,
  fecha           date not null default current_date,
  categoria       text not null,
  descripcion     text not null default '',
  monto           numeric(14,2) not null check (monto > 0),
  medio           text not null,
  caja_id         uuid references cajas(id),
  usuario_nombre  text not null,
  creado          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FACTURACIÓN ELECTRÓNICA ARCA
-- ---------------------------------------------------------------------
alter table productos   add column if not exists alicuota_iva numeric(5,2) not null default 21;
alter table venta_items add column if not exists alicuota_iva numeric(5,2) not null default 21;
do $$ begin
  alter table productos add constraint productos_alicuota_ck check (alicuota_iva in (0, 2.5, 5, 10.5, 21, 27));
exception when duplicate_object then null; end $$;

alter table config add column if not exists fiscal_condicion text not null default 'monotributo';
alter table config add column if not exists fiscal_cuit text not null default '';
alter table config add column if not exists fiscal_razon_social text not null default '';
alter table config add column if not exists fiscal_domicilio text not null default '';
alter table config add column if not exists fiscal_iibb text not null default '';
alter table config add column if not exists fiscal_inicio_actividades date;
alter table config add column if not exists fiscal_punto_venta int not null default 1;
alter table config add column if not exists fiscal_ambiente text not null default 'homologacion';
alter table config add column if not exists alicuota_varios numeric(5,2) not null default 21;
do $$ begin
  alter table config add constraint config_fiscal_ck check (fiscal_condicion in ('monotributo', 'responsable_inscripto')
    and fiscal_ambiente in ('homologacion', 'produccion'));
exception when duplicate_object then null; end $$;

alter table ventas add column if not exists facturando timestamptz;

create table if not exists comprobantes (
  id                  uuid primary key default gen_random_uuid(),
  comercio_id         uuid,
  venta_id            uuid not null references ventas(id),
  clase               text not null check (clase in ('factura', 'nota_credito')),
  letra               text not null check (letra in ('A', 'B', 'C')),
  tipo                int  not null,            -- código ARCA: 1/6/11 factura, 3/8/13 nota de crédito
  punto_venta         int  not null,
  numero              bigint not null,
  fecha               date not null,
  cae                 text not null,
  cae_vto             date not null,
  doc_tipo            int  not null,            -- 80 CUIT, 86 CUIL, 96 DNI, 99 sin identificar
  doc_nro             bigint not null default 0,
  receptor_nombre     text not null default '',
  receptor_domicilio  text not null default '',
  receptor_condicion  int  not null,            -- CondicionIVAReceptorId (RG 5616)
  imp_total           numeric(14,2) not null,
  imp_neto            numeric(14,2) not null,
  imp_iva             numeric(14,2) not null,
  iva                 jsonb not null default '[]',
  asociado_id         uuid references comprobantes(id),
  ambiente            text not null,
  emisor_cuit         text not null,
  emitido_por         text not null,
  observaciones       text,
  creado              timestamptz not null default now(),
  unique (ambiente, emisor_cuit, tipo, punto_venta, numero)
);
create index if not exists comprobantes_venta_idx on comprobantes (venta_id);
create unique index if not exists comprobantes_una_factura on comprobantes (venta_id, clase);

alter table compras add column if not exists fac_tipo text not null default 'sin_factura';
alter table compras add column if not exists fac_iva  numeric(14,2) not null default 0;
do $$ begin
  alter table compras add constraint compras_fac_ck check (fac_tipo in ('sin_factura', 'A', 'B', 'C') and fac_iva >= 0
    and (fac_tipo = 'A' or fac_iva = 0));
exception when duplicate_object then null; end $$;

-- Caché del ticket de acceso de WSAA (por CUIT). Sólo el servidor (sin políticas)
create table if not exists arca_ta (
  servicio  text not null,
  ambiente  text not null,
  cuit      text not null,
  token     text not null,
  sign      text not null,
  expira    timestamptz not null,
  primary key (servicio, ambiente, cuit)
);

-- ---------------------------------------------------------------------
-- COMERCIO DEL USUARIO Y PERMISOS
--   (plpgsql: el cuerpo se valida al ejecutar, así no importa el orden de creación)
-- ---------------------------------------------------------------------
-- Comercio del usuario logueado (null si no tiene perfil)
create or replace function mi_comercio() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  return (select comercio_id from perfiles where id = auth.uid());
end $$;

create or replace function es_activo() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from perfiles where id = auth.uid() and activo);
end $$;

create or replace function es_admin() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'admin');
end $$;

create or replace function es_superadmin() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from superadmins where user_id = auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- comercio_id en todas las tablas del comercio: obligatorio, con FK, índice
-- y por defecto el comercio del usuario (así ningún INSERT puede "olvidarlo")
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['perfiles','config','proveedores','productos','cajas','ventas','venta_items',
                           'movimientos_caja','movimientos_stock','compras','gastos','comprobantes'] loop
    execute format('alter table %I add column if not exists comercio_id uuid', t);
    if t not in ('perfiles', 'config') then
      execute format('alter table %I alter column comercio_id set default mi_comercio()', t);
    end if;
    execute format('alter table %I alter column comercio_id set not null', t);
    if not exists (select 1 from pg_constraint where conname = t || '_comercio_fk') then
      execute format('alter table %I add constraint %I foreign key (comercio_id) references comercios(id) on delete cascade',
                     t, t || '_comercio_fk');
    end if;
    execute format('create index if not exists %I on %I (comercio_id)', t || '_comercio_idx', t);
  end loop;
end $$;

-- Únicos POR COMERCIO (dos kioscos pueden tener el mismo código de barras, cada uno su ticket #1, su caja abierta)
create unique index if not exists productos_codigo_uk2 on productos (comercio_id, codigo) where codigo <> '';
create unique index if not exists cajas_una_abierta2 on cajas (comercio_id) where estado = 'abierta';
create unique index if not exists ventas_numero_uk on ventas (comercio_id, numero);
create index if not exists ventas_fecha_idx2 on ventas (comercio_id, fecha desc);
create index if not exists movimientos_stock_fecha_idx2 on movimientos_stock (comercio_id, fecha desc);
create index if not exists compras_fecha_idx2 on compras (comercio_id, fecha desc);
create index if not exists gastos_fecha_idx2 on gastos (comercio_id, fecha desc);

-- ---------------------------------------------------------------------
-- PLAN Y VENCIMIENTO (por comercio)
--   'completo' = todo; 'basico' = POS, caja, ventas, productos, stock, usuarios y configuración.
--   Vencido o suspendido: modo consulta (se ve todo y se puede cerrar la caja abierta).
-- ---------------------------------------------------------------------
create or replace function modulo_habilitado(p_modulo text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((select plan = 'completo' from comercios where id = mi_comercio()), false)
      or p_modulo in ('pos', 'caja', 'ventas', 'productos', 'stock', 'usuarios', 'configuracion');
end $$;

create or replace function _exigir_modulo(p_modulo text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not modulo_habilitado(p_modulo) then
    raise exception 'Esta función no está incluida en el plan básico';
  end if;
end $$;

-- ¿El comercio del usuario puede operar? (para las políticas de edición directa)
create or replace function licencia_activa() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((select activo and (vence is null or (now() at time zone 'America/Argentina/Buenos_Aires')::date <= vence)
                   from comercios where id = mi_comercio()), false);
end $$;

-- Corta si el comercio está suspendido o venció (se usa hasta el día de vencimiento inclusive, hora Argentina)
create or replace function _licencia_vigente() returns void
language plpgsql stable security definer set search_path = public as $$
declare c comercios;
begin
  select * into c from comercios where id = mi_comercio();
  if not found then raise exception 'Usuario sin comercio asignado'; end if;
  if not c.activo then
    raise exception 'El sistema está suspendido para este comercio. Contactá a % para reactivarlo.',
      coalesce(nullif(c.contacto, ''), 'tu proveedor del sistema');
  end if;
  if c.vence is not null and (now() at time zone 'America/Argentina/Buenos_Aires')::date > c.vence then
    raise exception 'El período de uso venció el %. El sistema quedó en modo consulta: contactá a % para seguir usándolo.',
      to_char(c.vence, 'DD/MM/YYYY'), coalesce(nullif(c.contacto, ''), 'tu proveedor del sistema');
  end if;
end $$;

-- Perfil activo sin mirar la licencia (sólo para cerrar la caja aunque haya vencido)
create or replace function _perfil_base() returns perfiles
language plpgsql stable security definer set search_path = public as $$
declare v perfiles;
begin
  select * into v from perfiles where id = auth.uid() and activo;
  if not found then raise exception 'Usuario no habilitado'; end if;
  return v;
end $$;

-- Devuelve el perfil activo o corta con error (también si la licencia venció)
create or replace function _perfil_activo() returns perfiles
language plpgsql stable security definer set search_path = public as $$
declare v perfiles;
begin
  v := _perfil_base();
  perform _licencia_vigente();
  return v;
end $$;

create or replace function _exigir_admin() returns perfiles
language plpgsql stable security definer set search_path = public as $$
declare v perfiles;
begin
  v := _perfil_activo();
  if v.rol <> 'admin' then raise exception 'Sólo un administrador puede hacer esto'; end if;
  return v;
end $$;

create or replace function _exigir_superadmin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_superadmin() then raise exception 'Sólo el administrador general puede hacer esto'; end if;
end $$;

-- ¿Ya está creado el administrador general? (la pantalla de login lo usa para la configuración inicial)
create or replace function sistema_inicializado() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from superadmins);
end $$;

-- Crea un comercio con su configuración (uso interno)
create or replace function _crear_comercio(p_nombre text, p_plan text, p_vence date, p_contacto text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Indicá el nombre del comercio'; end if;
  if p_plan not in ('basico', 'completo') then raise exception 'Plan inválido'; end if;
  insert into comercios (nombre, plan, vence, contacto) values (trim(p_nombre), p_plan, p_vence, coalesce(p_contacto, ''))
  returning id into v_id;
  insert into config (comercio_id, nombre) values (v_id, trim(p_nombre));
  return v_id;
end $$;

-- Al registrarse un usuario:
--   * el PRIMERO de toda la base es el administrador general: gestiona clientes, NO tiene comercio
--     (si quiere vender, crea su propio comercio desde Clientes con otro email);
--   * si su email tiene una invitación, queda activo en ese comercio con ese rol;
--   * si no, no se le crea perfil (ve "usuario sin acceso").
create or replace function _nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv invitaciones; v_com uuid; v_nombre text;
begin
  perform pg_advisory_xact_lock(424242);
  v_nombre := coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), split_part(new.email, '@', 1));
  if not exists (select 1 from superadmins) then
    insert into superadmins (user_id) values (new.id);
    return new;
  end if;
  select * into inv from invitaciones where email = lower(new.email);
  if found then
    insert into perfiles (id, comercio_id, email, nombre, rol, activo)
    values (new.id, inv.comercio_id, new.email, coalesce(nullif(inv.nombre, ''), v_nombre), inv.rol, true);
    delete from invitaciones where email = inv.email;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function _nuevo_usuario();

-- Registra la invitación; si el email ya tenía cuenta (sin comercio), lo agrega directamente.
-- Devuelve true si la cuenta ya existía (no hace falta crearla).
create or replace function _invitar(p_comercio uuid, p_email text, p_nombre text, p_rol text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email)); v_user uuid; v_otro uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email inválido'; end if;
  if p_rol not in ('admin', 'vendedor') then raise exception 'Rol inválido'; end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is not null then
    if exists (select 1 from superadmins where user_id = v_user) then
      raise exception 'Ese email es del administrador general: para un comercio usá otro email';
    end if;
    select comercio_id into v_otro from perfiles where id = v_user;
    if v_otro is not null then raise exception 'Ese email ya tiene cuenta en otro comercio (o en este)'; end if;
    insert into perfiles (id, comercio_id, email, nombre, rol, activo)
    values (v_user, p_comercio, v_email, coalesce(nullif(trim(p_nombre), ''), split_part(v_email, '@', 1)), p_rol, true);
    return true;
  end if;
  if exists (select 1 from invitaciones where email = v_email and comercio_id <> p_comercio) then
    raise exception 'Ese email ya tiene una invitación pendiente en otro comercio';
  end if;
  insert into invitaciones (email, comercio_id, nombre, rol) values (v_email, p_comercio, coalesce(trim(p_nombre), ''), p_rol)
  on conflict (email) do update set comercio_id = excluded.comercio_id, nombre = excluded.nombre, rol = excluded.rol, creado = now();
  return false;
end $$;

-- El admin de un comercio da de alta un usuario en SU comercio (después la app crea la cuenta con signUp)
create or replace function invitar_usuario(p_email text, p_nombre text, p_rol text) returns boolean
language plpgsql security definer set search_path = public as $$
declare u perfiles;
begin
  u := _exigir_admin();
  return _invitar(u.comercio_id, p_email, p_nombre, p_rol);
end $$;

-- Cambio de contraseña.
--   * La propia: cualquiera, indicando la contraseña actual.
--   * La de otro: el admin, sólo de usuarios de SU comercio; el administrador general, de cualquier usuario de comercio.
--   Al cambiar la de otro se cierran sus sesiones abiertas.
create or replace function cambiar_clave(p_email text, p_nueva text, p_actual text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_hash text; v_obj perfiles; v_yo perfiles;
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  if length(coalesce(p_nueva, '')) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres'; end if;
  select id, encrypted_password into v_uid, v_hash from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'Usuario inexistente'; end if;

  if v_uid = auth.uid() then
    if v_hash is null or v_hash <> crypt(coalesce(p_actual, ''), v_hash) then
      raise exception 'La contraseña actual no es correcta';
    end if;
  else
    if exists (select 1 from superadmins where user_id = v_uid) then
      raise exception 'No se puede cambiar la contraseña del administrador general';
    end if;
    select * into v_obj from perfiles where id = v_uid;
    if not found then raise exception 'Usuario inexistente'; end if;
    if not es_superadmin() then
      v_yo := _perfil_base();
      if v_yo.rol <> 'admin' then raise exception 'Sólo un administrador puede cambiar la contraseña de otro usuario'; end if;
      if v_yo.comercio_id <> v_obj.comercio_id then raise exception 'Sólo podés cambiar contraseñas de usuarios de tu comercio'; end if;
    end if;
  end if;

  update auth.users set encrypted_password = crypt(p_nueva, gen_salt('bf')), updated_at = now() where id = v_uid;

  -- a otro usuario: cerrar sus sesiones (vuelve a ingresar con la nueva)
  if v_uid <> auth.uid() then
    if to_regclass('auth.sessions') is not null then
      execute 'delete from auth.sessions where user_id = $1' using v_uid;
    end if;
    if to_regclass('auth.refresh_tokens') is not null then
      execute 'delete from auth.refresh_tokens where user_id = $1::text' using v_uid;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- PANEL DEL ADMINISTRADOR GENERAL (superadmin)
--   Gestiona comercios (plan, vencimiento, suspensión). No ve ventas ni productos de otros.
-- ---------------------------------------------------------------------
create or replace function admin_comercios() returns table (
  id uuid, nombre text, plan text, vence date, activo boolean, contacto text, notas text, creado timestamptz,
  usuarios bigint, dueno text, ventas_30d bigint, total_30d numeric, ultima_venta timestamptz, productos bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform _exigir_superadmin();
  return query
  select c.id, c.nombre, c.plan, c.vence, c.activo, c.contacto, c.notas, c.creado,
         (select count(*) from perfiles p where p.comercio_id = c.id and p.activo),
         (select p.email from perfiles p where p.comercio_id = c.id and p.rol = 'admin' order by p.creado limit 1),
         (select count(*) from ventas v where v.comercio_id = c.id and v.estado = 'completada' and v.fecha > now() - interval '30 days'),
         (select coalesce(sum(v.total), 0) from ventas v where v.comercio_id = c.id and v.estado = 'completada' and v.fecha > now() - interval '30 days'),
         (select max(v.fecha) from ventas v where v.comercio_id = c.id),
         (select count(*) from productos pr where pr.comercio_id = c.id)
  from comercios c
  order by c.creado;
end $$;

-- Crea el comercio e invita al dueño (admin). Devuelve {id, ya_existia}.
create or replace function admin_crear_comercio(
  p_nombre text, p_plan text, p_vence date, p_contacto text, p_dueno_email text, p_dueno_nombre text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_existia boolean;
begin
  perform _exigir_superadmin();
  v_id := _crear_comercio(p_nombre, p_plan, p_vence, p_contacto);
  v_existia := _invitar(v_id, p_dueno_email, p_dueno_nombre, 'admin');
  return jsonb_build_object('id', v_id, 'ya_existia', v_existia);
end $$;

create or replace function admin_actualizar_comercio(
  p_id uuid, p_nombre text, p_plan text, p_vence date, p_activo boolean, p_contacto text, p_notas text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_superadmin();
  if p_plan not in ('basico', 'completo') then raise exception 'Plan inválido'; end if;
  update comercios set nombre = coalesce(nullif(trim(p_nombre), ''), nombre), plan = p_plan, vence = p_vence,
         activo = coalesce(p_activo, true), contacto = coalesce(p_contacto, ''), notas = coalesce(p_notas, '')
  where id = p_id;
  if not found then raise exception 'Comercio inexistente'; end if;
end $$;

-- Invita otro administrador a un comercio (ej: el dueño perdió el acceso)
create or replace function admin_invitar(p_comercio uuid, p_email text, p_nombre text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_superadmin();
  if not exists (select 1 from comercios where id = p_comercio) then raise exception 'Comercio inexistente'; end if;
  return _invitar(p_comercio, p_email, p_nombre, 'admin');
end $$;

-- ---------------------------------------------------------------------
-- VENTAS
-- ---------------------------------------------------------------------
-- p_items: [{producto_id, cantidad} | {producto_id:null, nombre, precio, cantidad}]
-- p_pagos: [{medio, monto}]  (la suma debe coincidir con el total)
-- Precios y costos se toman de la base, no del navegador.
create or replace function registrar_venta(
  p_items jsonb, p_descuento numeric, p_pagos jsonb, p_recibido numeric, p_vuelto numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u perfiles; cfg config; v_caja uuid; v_id uuid; v_num bigint;
  it jsonb; p productos; v_cant numeric; v_precio numeric;
  v_sub numeric := 0; v_costo_total numeric := 0; v_total numeric; v_pagado numeric; v_nuevo numeric;
  r record;
begin
  u := _perfil_activo();
  select * into cfg from config where comercio_id = u.comercio_id;
  select id into v_caja from cajas where comercio_id = u.comercio_id and estado = 'abierta';
  if v_caja is null then raise exception 'La caja está cerrada'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'El ticket está vacío'; end if;

  -- Bloquea los productos involucrados (orden fijo para evitar deadlocks) y valida stock
  for r in
    select pr.id, pr.nombre, pr.stock, sum((e->>'cantidad')::numeric) as cant
    from jsonb_array_elements(p_items) e
    join productos pr on pr.id = (e->>'producto_id')::uuid and pr.comercio_id = u.comercio_id
    group by pr.id, pr.nombre, pr.stock
    order by pr.id
  loop
    perform 1 from productos where id = r.id for update;
    if not cfg.permitir_stock_negativo and (select stock from productos where id = r.id) < r.cant then
      raise exception 'Stock insuficiente de "%" (disponible: %)', r.nombre, trim_scale((select stock from productos where id = r.id));
    end if;
  end loop;

  -- 1) Calcula el total con precios de la base y valida el cobro ANTES de numerar el ticket
  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := (it->>'cantidad')::numeric;
    if v_cant is null or v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    if nullif(it->>'producto_id', '') is not null then
      select precio into v_precio from productos where id = (it->>'producto_id')::uuid and comercio_id = u.comercio_id;
      if not found then raise exception 'Un producto del ticket ya no existe'; end if;
    else
      v_precio := (it->>'precio')::numeric;
      if v_precio is null or v_precio <= 0 then raise exception 'Precio inválido en ítem varios'; end if;
    end if;
    v_sub := v_sub + round(v_cant * v_precio, 2);
  end loop;

  p_descuento := greatest(0, least(coalesce(p_descuento, 0), v_sub));
  v_total := v_sub - p_descuento;
  select coalesce(sum((x->>'monto')::numeric), 0) into v_pagado
  from jsonb_array_elements(coalesce(p_pagos, '[]')) x where (x->>'monto')::numeric > 0;
  if abs(v_pagado - v_total) > 0.01 then
    raise exception 'Los precios cambiaron: el total actual es %. Revisá el ticket y cobrá de nuevo.', v_total;
  end if;

  -- 2) Registra la venta con el próximo número de ticket DEL COMERCIO (el UPDATE bloquea la fila: sin saltos ni repetidos)
  update comercios set ultimo_ticket = ultimo_ticket + 1 where id = u.comercio_id returning ultimo_ticket into v_num;
  insert into ventas (comercio_id, numero, caja_id, usuario_id, usuario_nombre, subtotal, descuento, total, recibido, vuelto, pagos)
  values (u.comercio_id, v_num, v_caja, u.id, u.nombre, v_sub, p_descuento, v_total, coalesce(p_recibido, 0), coalesce(p_vuelto, 0),
          (select coalesce(jsonb_agg(jsonb_build_object('medio', x->>'medio', 'monto', round((x->>'monto')::numeric, 2))), '[]')
           from jsonb_array_elements(p_pagos) x where (x->>'monto')::numeric > 0))
  returning id into v_id;

  -- 3) Ítems, descuento de stock y movimientos
  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := (it->>'cantidad')::numeric;
    if nullif(it->>'producto_id', '') is not null then
      select * into p from productos where id = (it->>'producto_id')::uuid and comercio_id = u.comercio_id;
      insert into venta_items (venta_id, producto_id, nombre, codigo, categoria, cantidad, precio, costo, subtotal, alicuota_iva)
      values (v_id, p.id, p.nombre, p.codigo, p.categoria, v_cant, p.precio, p.costo, round(v_cant * p.precio, 2), p.alicuota_iva);
      v_costo_total := v_costo_total + v_cant * p.costo;

      update productos set stock = stock - v_cant, actualizado = now() where id = p.id returning stock into v_nuevo;
      insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, ref, usuario_nombre)
      values (p.id, p.nombre, 'venta', -v_cant, v_nuevo + v_cant, v_nuevo, 'Venta #' || v_num, u.nombre);
    else
      insert into venta_items (venta_id, producto_id, nombre, categoria, cantidad, precio, costo, subtotal, alicuota_iva)
      values (v_id, null, coalesce(nullif(it->>'nombre', ''), 'Varios'), 'Varios', v_cant, (it->>'precio')::numeric, 0,
              round(v_cant * (it->>'precio')::numeric, 2), cfg.alicuota_varios);
    end if;
  end loop;

  update ventas set costo_total = round(v_costo_total, 2) where id = v_id;

  return (select to_jsonb(v) || jsonb_build_object('venta_items', (select jsonb_agg(to_jsonb(i) order by i.id) from venta_items i where i.venta_id = v.id))
          from ventas v where v.id = v_id);
end $$;

create or replace function anular_venta(p_venta uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare u perfiles; v ventas; i venta_items; v_nuevo numeric;
begin
  u := _exigir_admin();
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indicá el motivo'; end if;
  select * into v from ventas where id = p_venta and comercio_id = u.comercio_id for update;
  if not found then raise exception 'La venta no existe'; end if;
  if v.estado = 'anulada' then raise exception 'La venta ya estaba anulada'; end if;
  if exists (select 1 from comprobantes where venta_id = p_venta and clase = 'factura')
     and not exists (select 1 from comprobantes where venta_id = p_venta and clase = 'nota_credito') then
    raise exception 'La venta está facturada: primero hay que emitir la nota de crédito';
  end if;

  update ventas set estado = 'anulada', motivo_anulacion = p_motivo, anulada_por = u.nombre, fecha_anulacion = now() where id = p_venta;

  for i in select * from venta_items where venta_id = p_venta and producto_id is not null order by producto_id loop
    update productos set stock = stock + i.cantidad, actualizado = now() where id = i.producto_id and comercio_id = u.comercio_id returning stock into v_nuevo;
    if found then
      insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, ref, motivo, usuario_nombre)
      values (i.producto_id, i.nombre, 'anulacion', i.cantidad, v_nuevo - i.cantidad, v_nuevo, 'Anulación venta #' || v.numero, p_motivo, u.nombre);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- PRODUCTOS / STOCK
-- ---------------------------------------------------------------------
create or replace function crear_producto(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare u perfiles; v_id uuid; v_stock numeric := coalesce((p->>'stock')::numeric, 0);
begin
  u := _exigir_admin();
  insert into productos (nombre, codigo, categoria, marca, costo, precio, stock, stock_min, proveedor_id, activo, favorito, alicuota_iva)
  values (trim(p->>'nombre'), coalesce(trim(p->>'codigo'), ''), coalesce(nullif(p->>'categoria', ''), 'Varios'), coalesce(p->>'marca', ''),
          coalesce((p->>'costo')::numeric, 0), coalesce((p->>'precio')::numeric, 0), v_stock,
          coalesce((p->>'stock_min')::numeric, 0), nullif(p->>'proveedor_id', '')::uuid,
          coalesce((p->>'activo')::boolean, true), coalesce((p->>'favorito')::boolean, false),
          coalesce((p->>'alicuota_iva')::numeric, 21))
  returning id into v_id;
  if v_stock <> 0 then
    insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_nombre)
    values (v_id, trim(p->>'nombre'), 'alta', v_stock, 0, v_stock, 'Stock inicial', u.nombre);
  end if;
  return v_id;
end $$;

-- p_tipo: 'ajuste' (p_valor = stock real contado) | 'compra' (suma) | 'merma' | 'vencido' (resta)
create or replace function mover_stock(p_producto uuid, p_tipo text, p_valor numeric, p_motivo text) returns numeric
language plpgsql security definer set search_path = public as $$
declare u perfiles; p productos; v_nuevo numeric;
begin
  u := _exigir_admin();
  select * into p from productos where id = p_producto and comercio_id = u.comercio_id for update;
  if not found then raise exception 'Producto inexistente'; end if;
  v_nuevo := case p_tipo
    when 'ajuste' then p_valor
    when 'compra' then p.stock + p_valor
    when 'merma' then p.stock - abs(p_valor)
    when 'vencido' then p.stock - abs(p_valor)
    else null end;
  if v_nuevo is null then raise exception 'Tipo de movimiento inválido'; end if;
  update productos set stock = v_nuevo, actualizado = now() where id = p_producto;
  insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_nombre)
  values (p.id, p.nombre, p_tipo, v_nuevo - p.stock, p.stock, v_nuevo, nullif(p_motivo, ''), u.nombre);
  return v_nuevo;
end $$;

-- Elimina un producto. Si ya tuvo ventas, compras o ajustes, NO lo borra: lo desactiva
-- (sale de la caja y de las listas, pero los reportes y tickets viejos lo siguen mostrando).
-- Devuelve 'eliminado' o 'desactivado'.
create or replace function eliminar_producto(p_producto uuid) returns text
language plpgsql security definer set search_path = public as $$
declare u perfiles; p productos;
begin
  u := _exigir_admin();
  select * into p from productos where id = p_producto and comercio_id = u.comercio_id for update;
  if not found then raise exception 'Producto inexistente'; end if;
  if exists (select 1 from venta_items where producto_id = p.id)
     or exists (select 1 from movimientos_stock where producto_id = p.id and tipo <> 'alta') then
    update productos set activo = false, favorito = false, actualizado = now() where id = p.id;
    return 'desactivado';
  end if;
  delete from productos where id = p.id;  -- sin historia: se borra (y su movimiento de alta)
  return 'eliminado';
end $$;

-- Aumento/baja masiva por porcentaje. p_aplicar: 'precio' | 'costo' | 'ambos'
create or replace function aumentar_precios(p_porcentaje numeric, p_categoria text, p_redondeo numeric, p_aplicar text) returns int
language plpgsql security definer set search_path = public as $$
declare u perfiles; n int; f numeric := 1 + p_porcentaje / 100;
begin
  u := _exigir_admin();
  update productos set
    precio = case when p_aplicar in ('precio','ambos') then
               case when coalesce(p_redondeo, 0) > 0 then ceil(precio * f / p_redondeo) * p_redondeo else round(precio * f, 2) end
             else precio end,
    costo  = case when p_aplicar in ('costo','ambos') then round(costo * f, 2) else costo end,
    actualizado = now()
  where comercio_id = u.comercio_id and activo and (coalesce(p_categoria, '') = '' or categoria = p_categoria);
  get diagnostics n = row_count;
  return n;
end $$;

-- Importación CSV: si el código existe actualiza datos; si no, crea.
create or replace function importar_productos(p_filas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u perfiles; f jsonb; v_id uuid; creados int := 0; actualizados int := 0; v_stock numeric;
begin
  u := _exigir_admin();
  for f in select * from jsonb_array_elements(p_filas) loop
    v_id := null;
    if coalesce(f->>'codigo', '') <> '' then
      update productos set nombre = f->>'nombre', categoria = coalesce(nullif(f->>'categoria', ''), categoria),
        marca = coalesce(f->>'marca', marca), costo = coalesce((f->>'costo')::numeric, costo),
        precio = coalesce((f->>'precio')::numeric, precio), stock_min = coalesce((f->>'stock_min')::numeric, stock_min),
        activo = coalesce((f->>'activo')::boolean, activo),
        alicuota_iva = coalesce((f->>'alicuota_iva')::numeric, alicuota_iva), actualizado = now()
      where comercio_id = u.comercio_id and codigo = f->>'codigo' returning id into v_id;
    end if;
    if v_id is not null then
      actualizados := actualizados + 1;
    else
      v_stock := coalesce((f->>'stock')::numeric, 0);
      insert into productos (nombre, codigo, categoria, marca, costo, precio, stock, stock_min, activo, alicuota_iva)
      values (f->>'nombre', coalesce(f->>'codigo', ''), coalesce(nullif(f->>'categoria', ''), 'Varios'), coalesce(f->>'marca', ''),
              coalesce((f->>'costo')::numeric, 0), coalesce((f->>'precio')::numeric, 0), v_stock,
              coalesce((f->>'stock_min')::numeric, 0), coalesce((f->>'activo')::boolean, true),
              coalesce((f->>'alicuota_iva')::numeric, 21))
      returning id into v_id;
      if v_stock <> 0 then
        insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_nombre)
        values (v_id, f->>'nombre', 'alta', v_stock, 0, v_stock, 'Importación CSV', u.nombre);
      end if;
      creados := creados + 1;
    end if;
  end loop;
  return jsonb_build_object('creados', creados, 'actualizados', actualizados);
end $$;

-- ---------------------------------------------------------------------
-- COMPRAS
-- ---------------------------------------------------------------------
-- p: {proveedor_id, comprobante, medio, pagado_desde_caja, actualizar_costo, mantener_margen,
--     fac_tipo ('sin_factura'|'A'|'B'|'C'), fac_iva, items:[{producto_id, cantidad, costo}]}
create or replace function registrar_compra(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  u perfiles; prov proveedores; v_id uuid; v_caja uuid; it jsonb; pr productos;
  v_items jsonb := '[]'; v_total numeric := 0; v_cant numeric; v_costo numeric; v_nuevo numeric;
  v_desde_caja boolean := coalesce((p->>'pagado_desde_caja')::boolean, false) and p->>'medio' = 'efectivo';
  v_fac_tipo text := coalesce(nullif(p->>'fac_tipo', ''), 'sin_factura');
  v_fac_iva numeric := coalesce((p->>'fac_iva')::numeric, 0);
begin
  u := _exigir_admin();
  perform _exigir_modulo('compras');
  select * into prov from proveedores where id = (p->>'proveedor_id')::uuid and comercio_id = u.comercio_id;
  if not found then raise exception 'Elegí el proveedor'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) = 0 then raise exception 'La compra no tiene productos'; end if;
  if v_desde_caja then
    select id into v_caja from cajas where comercio_id = u.comercio_id and estado = 'abierta';
    if v_caja is null then raise exception 'No hay caja abierta para pagar en efectivo'; end if;
  end if;

  v_id := gen_random_uuid();
  for it in select * from jsonb_array_elements(p->'items') order by (value->>'producto_id') loop
    v_cant := (it->>'cantidad')::numeric;
    v_costo := coalesce((it->>'costo')::numeric, 0);
    if v_cant is null or v_cant <= 0 then continue; end if;
    select * into pr from productos where id = (it->>'producto_id')::uuid and comercio_id = u.comercio_id for update;
    if not found then continue; end if;

    update productos set
      stock = stock + v_cant,
      proveedor_id = prov.id,
      costo = case when coalesce((p->>'actualizar_costo')::boolean, true) and v_costo > 0 then v_costo else costo end,
      precio = case when coalesce((p->>'actualizar_costo')::boolean, true) and coalesce((p->>'mantener_margen')::boolean, false)
                         and v_costo > 0 and pr.costo > 0 and v_costo <> pr.costo
                    then ceil(pr.precio * (v_costo / pr.costo) / 10) * 10 else precio end,
      actualizado = now()
    where id = pr.id returning stock into v_nuevo;

    insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, ref, usuario_nombre)
    values (pr.id, pr.nombre, 'compra', v_cant, v_nuevo - v_cant, v_nuevo,
            'Compra ' || prov.nombre || coalesce(' ' || nullif(p->>'comprobante', ''), ''), u.nombre);

    v_items := v_items || jsonb_build_object('producto_id', pr.id, 'nombre', pr.nombre, 'cantidad', v_cant,
                                             'costo', v_costo, 'subtotal', round(v_cant * v_costo, 2));
    v_total := v_total + round(v_cant * v_costo, 2);
  end loop;

  if v_fac_tipo not in ('sin_factura', 'A', 'B', 'C') then raise exception 'Tipo de factura inválido'; end if;
  if v_fac_tipo <> 'A' then v_fac_iva := 0; end if;
  if v_fac_iva < 0 or (v_fac_iva > 0 and v_fac_iva >= v_total) then raise exception 'El IVA de la factura no es válido'; end if;

  insert into compras (id, proveedor_id, proveedor_nombre, comprobante, items, total, medio, pagado_desde_caja, usuario_nombre, fac_tipo, fac_iva)
  values (v_id, prov.id, prov.nombre, coalesce(p->>'comprobante', ''), v_items, v_total, p->>'medio', v_desde_caja, u.nombre,
          v_fac_tipo, round(v_fac_iva, 2));

  if v_desde_caja and v_total > 0 then
    insert into movimientos_caja (caja_id, tipo, monto, concepto, usuario_nombre, compra_id)
    values (v_caja, 'egreso', v_total, 'Pago a proveedor: ' || prov.nombre, u.nombre, v_id);
  end if;
  return v_id;
end $$;

-- Cargar o corregir después los datos de la factura del proveedor (llega días después, se cargó mal, etc.)
create or replace function datos_factura_compra(p_compra uuid, p_tipo text, p_numero text, p_iva numeric) returns void
language plpgsql security definer set search_path = public as $$
declare u perfiles; c compras; v_iva numeric := case when p_tipo = 'A' then round(coalesce(p_iva, 0), 2) else 0 end;
begin
  u := _exigir_admin();
  perform _exigir_modulo('compras');
  select * into c from compras where id = p_compra and comercio_id = u.comercio_id for update;
  if not found then raise exception 'Compra inexistente'; end if;
  if p_tipo not in ('sin_factura', 'A', 'B', 'C') then raise exception 'Tipo de factura inválido'; end if;
  if v_iva < 0 or (v_iva > 0 and v_iva >= c.total) then raise exception 'El IVA de la factura no es válido'; end if;
  update compras set fac_tipo = p_tipo, fac_iva = v_iva, comprobante = coalesce(p_numero, '') where id = p_compra;
end $$;

-- ---------------------------------------------------------------------
-- GASTOS
-- ---------------------------------------------------------------------
create or replace function registrar_gasto(
  p_fecha date, p_categoria text, p_descripcion text, p_monto numeric, p_medio text, p_desde_caja boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare u perfiles; v_id uuid; v_caja uuid;
begin
  u := _perfil_activo();
  perform _exigir_modulo('gastos');
  if coalesce(p_monto, 0) <= 0 then raise exception 'Monto inválido'; end if;
  -- los vendedores sólo pueden cargar gastos pagados con efectivo de la caja
  if u.rol <> 'admin' and not (p_desde_caja and p_medio = 'efectivo') then
    raise exception 'Sólo podés registrar gastos pagados desde la caja';
  end if;
  if p_desde_caja and p_medio = 'efectivo' then
    select id into v_caja from cajas where comercio_id = u.comercio_id and estado = 'abierta';
    if v_caja is null then raise exception 'La caja está cerrada'; end if;
  end if;
  insert into gastos (fecha, categoria, descripcion, monto, medio, caja_id, usuario_nombre)
  values (coalesce(p_fecha, (now() at time zone 'America/Argentina/Buenos_Aires')::date), p_categoria, coalesce(p_descripcion, ''), round(p_monto, 2), p_medio, v_caja, u.nombre)
  returning id into v_id;
  if v_caja is not null then
    insert into movimientos_caja (caja_id, tipo, monto, concepto, usuario_nombre, gasto_id)
    values (v_caja, 'egreso', round(p_monto, 2), 'Gasto: ' || p_categoria || coalesce(' - ' || nullif(p_descripcion, ''), ''), u.nombre, v_id);
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- CAJA
-- ---------------------------------------------------------------------
create or replace function abrir_caja(p_monto numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare u perfiles; v_id uuid;
begin
  u := _perfil_activo();
  if exists (select 1 from cajas where comercio_id = u.comercio_id and estado = 'abierta') then raise exception 'Ya hay una caja abierta'; end if;
  insert into cajas (abierta_por, abierta_por_nombre, monto_inicial)
  values (u.id, u.nombre, round(coalesce(p_monto, 0), 2)) returning id into v_id;
  return v_id;
end $$;

create or replace function movimiento_caja(p_tipo text, p_monto numeric, p_concepto text) returns uuid
language plpgsql security definer set search_path = public as $$
declare u perfiles; v_caja uuid; v_id uuid;
begin
  u := _perfil_activo();
  select id into v_caja from cajas where comercio_id = u.comercio_id and estado = 'abierta';
  if v_caja is null then raise exception 'La caja está cerrada'; end if;
  insert into movimientos_caja (caja_id, tipo, monto, concepto, usuario_nombre)
  values (v_caja, p_tipo, round(p_monto, 2), coalesce(nullif(trim(p_concepto), ''), case p_tipo when 'ingreso' then 'Ingreso de efectivo' else 'Retiro de efectivo' end), u.nombre)
  returning id into v_id;
  return v_id;
end $$;

create or replace function cerrar_caja(p_caja uuid, p_contado numeric, p_obs text) returns cajas
language plpgsql security definer set search_path = public as $$
declare u perfiles; c cajas; v_por_medio jsonb; v_total numeric; v_cant int; v_ing numeric; v_egr numeric; v_esp numeric;
begin
  u := _perfil_base(); -- sin chequear licencia: si vence con la caja abierta, igual se puede cerrar
  select * into c from cajas where id = p_caja and comercio_id = u.comercio_id for update;
  if not found or c.estado <> 'abierta' then raise exception 'La caja no está abierta'; end if;

  select coalesce(sum(total), 0), count(*) into v_total, v_cant from ventas where caja_id = p_caja and estado = 'completada';
  select coalesce(jsonb_object_agg(medio, monto), '{}') into v_por_medio from (
    select x->>'medio' as medio, sum((x->>'monto')::numeric) as monto
    from ventas v, jsonb_array_elements(v.pagos) x
    where v.caja_id = p_caja and v.estado = 'completada' group by 1) t;
  select coalesce(sum(monto) filter (where tipo = 'ingreso'), 0), coalesce(sum(monto) filter (where tipo = 'egreso'), 0)
    into v_ing, v_egr from movimientos_caja where caja_id = p_caja;
  v_esp := c.monto_inicial + coalesce((v_por_medio->>'efectivo')::numeric, 0) + v_ing - v_egr;

  update cajas set estado = 'cerrada', cierre = now(), cerrada_por_nombre = u.nombre,
    total_ventas = v_total, cant_ventas = v_cant, por_medio = v_por_medio, ingresos = v_ing, egresos = v_egr,
    efectivo_esperado = v_esp, efectivo_contado = round(p_contado, 2), diferencia = round(p_contado - v_esp, 2),
    observaciones = nullif(p_obs, '')
  where id = p_caja returning * into c;
  return c;
end $$;


-- ---------------------------------------------------------------------
-- CERTIFICADOS ARCA POR COMERCIO (cifrados en Supabase Vault)
--   Sólo los usa el servidor con la clave secreta (service_role); el navegador nunca los ve.
-- ---------------------------------------------------------------------
create or replace function arca_guardar_credenciales(p_comercio uuid, p_cert text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nombre text; v_valor text;
begin
  foreach v_nombre in array array['arca_cert_' || p_comercio, 'arca_key_' || p_comercio] loop
    v_valor := case when v_nombre like 'arca_cert_%' then p_cert else p_key end;
    select id into v_id from vault.secrets where name = v_nombre;
    if v_id is null then
      perform vault.create_secret(v_valor, v_nombre, 'Caja & Stock: certificado ARCA');
    else
      perform vault.update_secret(v_id, v_valor, v_nombre);
    end if;
  end loop;
end $$;

create or replace function arca_credenciales(p_comercio uuid) returns table (cert text, key text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query select
    (select decrypted_secret from vault.decrypted_secrets where name = 'arca_cert_' || p_comercio),
    (select decrypted_secret from vault.decrypted_secrets where name = 'arca_key_' || p_comercio);
end $$;

-- ---------------------------------------------------------------------
-- SEGURIDAD (Row Level Security)
--   Toda lectura filtra por el comercio del usuario. Las escrituras sensibles
--   SÓLO por las funciones de arriba. (select f()) = se evalúa una vez por consulta.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['comercios','superadmins','invitaciones','perfiles','config','proveedores','productos','cajas',
                           'ventas','venta_items','movimientos_caja','movimientos_stock','compras','gastos','comprobantes','arca_ta'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- comercios: el propio (plan, vencimiento) y el superadmin todos. Se modifican sólo por funciones.
create policy comercios_sel on comercios for select using (id = (select mi_comercio()) or (select es_superadmin()));
-- superadmins, invitaciones, arca_ta: sin políticas a propósito (sólo funciones / servidor)

create policy perfiles_sel on perfiles for select using (
  id = auth.uid() or ((select es_admin()) and comercio_id = (select mi_comercio())));
create policy perfiles_upd on perfiles for update
  using ((select es_admin()) and comercio_id = (select mi_comercio()) and id <> auth.uid())
  with check ((select es_admin()) and comercio_id = (select mi_comercio()) and id <> auth.uid());

create policy config_sel on config for select using (comercio_id = (select mi_comercio()) and (select es_activo()));
create policy config_upd on config for update
  using (comercio_id = (select mi_comercio()) and (select es_admin()) and (select licencia_activa()))
  with check (comercio_id = (select mi_comercio()) and (select es_admin()) and (select licencia_activa()));

create policy proveedores_all on proveedores for all
  using (comercio_id = (select mi_comercio()) and (select es_admin()) and (select modulo_habilitado('proveedores')))
  with check (comercio_id = (select mi_comercio()) and (select es_admin()) and (select modulo_habilitado('proveedores')));

create policy productos_sel on productos for select using (comercio_id = (select mi_comercio()) and (select es_activo()));
-- el admin edita datos; el stock sólo cambia por funciones (ver trigger abajo)
create policy productos_upd on productos for update
  using (comercio_id = (select mi_comercio()) and (select es_admin()) and (select licencia_activa()))
  with check (comercio_id = (select mi_comercio()) and (select es_admin()) and (select licencia_activa()));
create policy productos_del on productos for delete
  using (comercio_id = (select mi_comercio()) and (select es_admin()) and (select licencia_activa()));

create policy cajas_sel on cajas for select using (comercio_id = (select mi_comercio()) and (select es_activo()));
-- vendedor: ventas de hoy (hora Argentina) y las de la caja abierta
create policy ventas_sel on ventas for select using (
  comercio_id = (select mi_comercio()) and ((select es_admin()) or ((select es_activo()) and (
    fecha >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
    or caja_id in (select id from cajas where estado = 'abierta')))));
create policy venta_items_sel on venta_items for select using (
  comercio_id = (select mi_comercio()) and exists (select 1 from ventas v where v.id = venta_id));
create policy movcaja_sel on movimientos_caja for select using (comercio_id = (select mi_comercio()) and (select es_activo()));
create policy movstock_sel on movimientos_stock for select using (comercio_id = (select mi_comercio()) and (select es_admin()));
create policy compras_sel on compras for select
  using (comercio_id = (select mi_comercio()) and (select es_admin()) and (select modulo_habilitado('compras')));
create policy gastos_sel on gastos for select
  using (comercio_id = (select mi_comercio()) and (select es_admin()) and (select modulo_habilitado('gastos')));
create policy gastos_del on gastos for delete
  using (comercio_id = (select mi_comercio()) and (select es_admin()) and caja_id is null and (select modulo_habilitado('gastos')));
create policy comprobantes_sel on comprobantes for select using (
  comercio_id = (select mi_comercio()) and exists (select 1 from ventas v where v.id = venta_id));

-- Evita que un UPDATE directo desde el cliente toque el stock o cambie una fila de comercio
create or replace function _proteger_stock() returns trigger
language plpgsql as $$
begin
  -- las funciones security definer corren como su dueño; un UPDATE directo del navegador corre como 'authenticated'
  if new.stock is distinct from old.stock and current_user in ('authenticated', 'anon') then
    new.stock := old.stock;
  end if;
  return new;
end $$;
drop trigger if exists proteger_stock on productos;
create trigger proteger_stock before update on productos for each row execute function _proteger_stock();

-- ---------------------------------------------------------------------
-- PERMISOS DE EJECUCIÓN
-- ---------------------------------------------------------------------
-- Internas: nadie las llama directo desde el navegador
revoke all on function _perfil_activo, _perfil_base, _exigir_admin, _exigir_superadmin, _exigir_modulo, _licencia_vigente,
  _crear_comercio, _invitar, _nuevo_usuario from public, anon, authenticated;
-- Credenciales ARCA: sólo el servidor
revoke all on function arca_guardar_credenciales, arca_credenciales from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function arca_guardar_credenciales, arca_credenciales, mi_comercio to service_role;
  end if;
end $$;

revoke all on function registrar_venta, anular_venta, crear_producto, eliminar_producto, mover_stock, aumentar_precios, importar_productos,
  registrar_compra, datos_factura_compra, registrar_gasto, abrir_caja, movimiento_caja, cerrar_caja, invitar_usuario,
  admin_comercios, admin_crear_comercio, admin_actualizar_comercio, admin_invitar, cambiar_clave from public, anon;
grant execute on function registrar_venta, anular_venta, crear_producto, eliminar_producto, mover_stock, aumentar_precios, importar_productos,
  registrar_compra, datos_factura_compra, registrar_gasto, abrir_caja, movimiento_caja, cerrar_caja, invitar_usuario,
  admin_comercios, admin_crear_comercio, admin_actualizar_comercio, admin_invitar, cambiar_clave,
  es_activo, es_admin, es_superadmin, mi_comercio, modulo_habilitado, licencia_activa to authenticated;
grant execute on function sistema_inicializado to anon, authenticated;

-- ---------------------------------------------------------------------
-- TIEMPO REAL (la caja y el stock se actualizan solos; cada usuario recibe sólo lo de su comercio por RLS)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['productos','ventas','cajas','movimientos_caja','config','perfiles','gastos','compras',
                           'movimientos_stock','proveedores','comprobantes','comercios'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
