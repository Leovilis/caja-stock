-- =====================================================================
--  CAJA & STOCK — Esquema Supabase / PostgreSQL
--  Ejecutar completo en: Supabase → SQL Editor → New query → Run
--  Es idempotente en funciones/políticas; las tablas se crean si no existen.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- TABLAS
-- ---------------------------------------------------------------------
create table if not exists perfiles (
  id      uuid primary key references auth.users(id) on delete cascade,
  nombre  text not null,
  email   text not null,
  rol     text not null default 'vendedor' check (rol in ('admin','vendedor')),
  activo  boolean not null default false,
  creado  timestamptz not null default now()
);

create table if not exists config (
  id                       int primary key default 1 check (id = 1),
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
insert into config (id) values (1) on conflict do nothing;

create table if not exists proveedores (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  contacto    text not null default '',
  telefono    text not null default '',
  email       text not null default '',
  cuit        text not null default '',
  dias_visita text not null default '',
  notas       text not null default '',
  creado      timestamptz not null default now()
);

create table if not exists productos (
  id            uuid primary key default gen_random_uuid(),
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
create unique index if not exists productos_codigo_uk on productos (codigo) where codigo <> '';
create index if not exists productos_nombre_idx on productos (lower(nombre));

create table if not exists cajas (
  id                  uuid primary key default gen_random_uuid(),
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
-- Sólo una caja abierta a la vez
create unique index if not exists cajas_una_abierta on cajas ((true)) where estado = 'abierta';

create sequence if not exists ventas_numero_seq;

create table if not exists ventas (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint not null unique default nextval('ventas_numero_seq'),
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
create index if not exists ventas_fecha_idx on ventas (fecha desc);
create index if not exists ventas_caja_idx on ventas (caja_id);

create table if not exists venta_items (
  id           bigint generated always as identity primary key,
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
create index if not exists movimientos_stock_fecha_idx on movimientos_stock (fecha desc);

create table if not exists compras (
  id                 uuid primary key default gen_random_uuid(),
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
create index if not exists compras_fecha_idx on compras (fecha desc);

create table if not exists gastos (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null default current_date,
  categoria       text not null,
  descripcion     text not null default '',
  monto           numeric(14,2) not null check (monto > 0),
  medio           text not null,
  caja_id         uuid references cajas(id),
  usuario_nombre  text not null,
  creado          timestamptz not null default now()
);
create index if not exists gastos_fecha_idx on gastos (fecha desc);

-- ---------------------------------------------------------------------
-- FACTURACIÓN ELECTRÓNICA ARCA (agregado v1.1)
-- ---------------------------------------------------------------------
-- Alícuota de IVA de cada artículo (los precios son finales, IVA incluido)
alter table productos   add column if not exists alicuota_iva numeric(5,2) not null default 21;
alter table venta_items add column if not exists alicuota_iva numeric(5,2) not null default 21;
do $$ begin
  alter table productos add constraint productos_alicuota_ck check (alicuota_iva in (0, 2.5, 5, 10.5, 21, 27));
exception when duplicate_object then null; end $$;

-- Datos fiscales del emisor (no secretos; el certificado va en variables de entorno del servidor)
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

-- Marca de "facturación en curso" para que dos pedidos simultáneos no facturen la misma venta
alter table ventas add column if not exists facturando timestamptz;

-- Comprobantes autorizados por ARCA (facturas y notas de crédito)
create table if not exists comprobantes (
  id                  uuid primary key default gen_random_uuid(),
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
  iva                 jsonb not null default '[]',   -- [{alicuota, base, importe}]
  asociado_id         uuid references comprobantes(id),
  ambiente            text not null,
  emisor_cuit         text not null,
  emitido_por         text not null,
  observaciones       text,
  creado              timestamptz not null default now(),
  unique (ambiente, emisor_cuit, tipo, punto_venta, numero)
);
create index if not exists comprobantes_venta_idx on comprobantes (venta_id);
-- una sola factura y una sola nota de crédito por venta
create unique index if not exists comprobantes_una_factura on comprobantes (venta_id, clase);

-- Caché del ticket de acceso de WSAA (vale ~12 h). Sólo lo usa el servidor (sin políticas = invisible para el navegador)
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
-- HELPERS DE PERMISOS
-- ---------------------------------------------------------------------
create or replace function es_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo);
$$;

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'admin');
$$;

-- Devuelve el perfil activo o corta con error
create or replace function _perfil_activo() returns perfiles
language plpgsql stable security definer set search_path = public as $$
declare v perfiles;
begin
  select * into v from perfiles where id = auth.uid() and activo;
  if not found then raise exception 'Usuario no habilitado'; end if;
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

-- ¿Ya hay usuarios? (la pantalla de login lo usa para ofrecer "crear administrador")
create or replace function sistema_inicializado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles);
$$;

-- Al registrarse un usuario: el PRIMERO queda como admin activo;
-- los demás quedan como vendedor INACTIVO hasta que un admin los habilite.
create or replace function _nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare primero boolean;
begin
  perform pg_advisory_xact_lock(424242);
  primero := not exists (select 1 from perfiles);
  insert into perfiles (id, email, nombre, rol, activo)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), split_part(new.email, '@', 1)),
          case when primero then 'admin' else 'vendedor' end,
          primero);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function _nuevo_usuario();

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
  select * into cfg from config where id = 1;
  select id into v_caja from cajas where estado = 'abierta';
  if v_caja is null then raise exception 'La caja está cerrada'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'El ticket está vacío'; end if;

  -- Bloquea los productos involucrados (orden fijo para evitar deadlocks) y valida stock
  for r in
    select pr.id, pr.nombre, pr.stock, sum((e->>'cantidad')::numeric) as cant
    from jsonb_array_elements(p_items) e
    join productos pr on pr.id = (e->>'producto_id')::uuid
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
      select precio into v_precio from productos where id = (it->>'producto_id')::uuid;
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

  -- 2) Registra la venta
  insert into ventas (caja_id, usuario_id, usuario_nombre, subtotal, descuento, total, recibido, vuelto, pagos)
  values (v_caja, u.id, u.nombre, v_sub, p_descuento, v_total, coalesce(p_recibido, 0), coalesce(p_vuelto, 0),
          (select coalesce(jsonb_agg(jsonb_build_object('medio', x->>'medio', 'monto', round((x->>'monto')::numeric, 2))), '[]')
           from jsonb_array_elements(p_pagos) x where (x->>'monto')::numeric > 0))
  returning id, numero into v_id, v_num;

  -- 3) Ítems, descuento de stock y movimientos
  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := (it->>'cantidad')::numeric;
    if nullif(it->>'producto_id', '') is not null then
      select * into p from productos where id = (it->>'producto_id')::uuid;
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
  select * into v from ventas where id = p_venta for update;
  if not found then raise exception 'La venta no existe'; end if;
  if v.estado = 'anulada' then raise exception 'La venta ya estaba anulada'; end if;
  if exists (select 1 from comprobantes where venta_id = p_venta and clase = 'factura')
     and not exists (select 1 from comprobantes where venta_id = p_venta and clase = 'nota_credito') then
    raise exception 'La venta está facturada: primero hay que emitir la nota de crédito';
  end if;

  update ventas set estado = 'anulada', motivo_anulacion = p_motivo, anulada_por = u.nombre, fecha_anulacion = now() where id = p_venta;

  for i in select * from venta_items where venta_id = p_venta and producto_id is not null order by producto_id loop
    update productos set stock = stock + i.cantidad, actualizado = now() where id = i.producto_id returning stock into v_nuevo;
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
  select * into p from productos where id = p_producto for update;
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

-- Aumento/baja masiva por porcentaje. p_aplicar: 'precio' | 'costo' | 'ambos'
create or replace function aumentar_precios(p_porcentaje numeric, p_categoria text, p_redondeo numeric, p_aplicar text) returns int
language plpgsql security definer set search_path = public as $$
declare n int; f numeric := 1 + p_porcentaje / 100;
begin
  perform _exigir_admin();
  update productos set
    precio = case when p_aplicar in ('precio','ambos') then
               case when coalesce(p_redondeo, 0) > 0 then ceil(precio * f / p_redondeo) * p_redondeo else round(precio * f, 2) end
             else precio end,
    costo  = case when p_aplicar in ('costo','ambos') then round(costo * f, 2) else costo end,
    actualizado = now()
  where activo and (coalesce(p_categoria, '') = '' or categoria = p_categoria);
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
      where codigo = f->>'codigo' returning id into v_id;
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
--     items:[{producto_id, cantidad, costo}]}
create or replace function registrar_compra(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  u perfiles; prov proveedores; v_id uuid; v_caja uuid; it jsonb; pr productos;
  v_items jsonb := '[]'; v_total numeric := 0; v_cant numeric; v_costo numeric; v_nuevo numeric;
  v_desde_caja boolean := coalesce((p->>'pagado_desde_caja')::boolean, false) and p->>'medio' = 'efectivo';
begin
  u := _exigir_admin();
  select * into prov from proveedores where id = (p->>'proveedor_id')::uuid;
  if not found then raise exception 'Elegí el proveedor'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) = 0 then raise exception 'La compra no tiene productos'; end if;
  if v_desde_caja then
    select id into v_caja from cajas where estado = 'abierta';
    if v_caja is null then raise exception 'No hay caja abierta para pagar en efectivo'; end if;
  end if;

  v_id := gen_random_uuid();
  for it in select * from jsonb_array_elements(p->'items') order by (value->>'producto_id') loop
    v_cant := (it->>'cantidad')::numeric;
    v_costo := coalesce((it->>'costo')::numeric, 0);
    if v_cant is null or v_cant <= 0 then continue; end if;
    select * into pr from productos where id = (it->>'producto_id')::uuid for update;
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

  insert into compras (id, proveedor_id, proveedor_nombre, comprobante, items, total, medio, pagado_desde_caja, usuario_nombre)
  values (v_id, prov.id, prov.nombre, coalesce(p->>'comprobante', ''), v_items, v_total, p->>'medio', v_desde_caja, u.nombre);

  if v_desde_caja and v_total > 0 then
    insert into movimientos_caja (caja_id, tipo, monto, concepto, usuario_nombre, compra_id)
    values (v_caja, 'egreso', v_total, 'Pago a proveedor: ' || prov.nombre, u.nombre, v_id);
  end if;
  return v_id;
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
  if coalesce(p_monto, 0) <= 0 then raise exception 'Monto inválido'; end if;
  -- los vendedores sólo pueden cargar gastos pagados con efectivo de la caja
  if u.rol <> 'admin' and not (p_desde_caja and p_medio = 'efectivo') then
    raise exception 'Sólo podés registrar gastos pagados desde la caja';
  end if;
  if p_desde_caja and p_medio = 'efectivo' then
    select id into v_caja from cajas where estado = 'abierta';
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
  if exists (select 1 from cajas where estado = 'abierta') then raise exception 'Ya hay una caja abierta'; end if;
  insert into cajas (abierta_por, abierta_por_nombre, monto_inicial)
  values (u.id, u.nombre, round(coalesce(p_monto, 0), 2)) returning id into v_id;
  return v_id;
end $$;

create or replace function movimiento_caja(p_tipo text, p_monto numeric, p_concepto text) returns uuid
language plpgsql security definer set search_path = public as $$
declare u perfiles; v_caja uuid; v_id uuid;
begin
  u := _perfil_activo();
  select id into v_caja from cajas where estado = 'abierta';
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
  u := _perfil_activo();
  select * into c from cajas where id = p_caja for update;
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
-- SEGURIDAD (Row Level Security)
--   Lecturas por políticas; las escrituras sensibles SÓLO por las funciones de arriba.
-- ---------------------------------------------------------------------
alter table perfiles          enable row level security;
alter table config            enable row level security;
alter table proveedores       enable row level security;
alter table productos         enable row level security;
alter table cajas             enable row level security;
alter table ventas            enable row level security;
alter table venta_items       enable row level security;
alter table movimientos_caja  enable row level security;
alter table movimientos_stock enable row level security;
alter table compras           enable row level security;
alter table gastos            enable row level security;
alter table comprobantes      enable row level security;
alter table arca_ta           enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

create policy perfiles_sel on perfiles for select using (id = auth.uid() or es_admin());
create policy perfiles_upd on perfiles for update using (es_admin() and id <> auth.uid()) with check (es_admin() and id <> auth.uid());

create policy config_sel on config for select using (es_activo());
create policy config_upd on config for update using (es_admin()) with check (es_admin());

create policy proveedores_all on proveedores for all using (es_admin()) with check (es_admin());

create policy productos_sel on productos for select using (es_activo());
-- el admin edita datos; el stock sólo cambia por funciones (ver trigger abajo)
create policy productos_upd on productos for update using (es_admin()) with check (es_admin());
create policy productos_del on productos for delete using (es_admin());

create policy cajas_sel on cajas for select using (es_activo());
-- vendedor: ventas de hoy (hora Argentina) y las de la caja abierta
create policy ventas_sel on ventas for select using (
  es_admin() or (es_activo() and (
    fecha >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
    or caja_id in (select id from cajas where estado = 'abierta'))));
create policy venta_items_sel on venta_items for select using (exists (select 1 from ventas v where v.id = venta_id));
create policy movcaja_sel on movimientos_caja for select using (es_activo());
create policy movstock_sel on movimientos_stock for select using (es_admin());
create policy compras_sel on compras for select using (es_admin());
create policy gastos_sel on gastos for select using (es_admin());
create policy comprobantes_sel on comprobantes for select using (exists (select 1 from ventas v where v.id = venta_id));
-- arca_ta: sin políticas a propósito (sólo el servidor con la clave secreta)
create policy gastos_del on gastos for delete using (es_admin() and caja_id is null);

-- Evita que un UPDATE directo desde el cliente toque el stock (sólo funciones con movimiento)
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

-- Permisos de ejecución
revoke all on function registrar_venta, anular_venta, crear_producto, mover_stock, aumentar_precios, importar_productos,
  registrar_compra, registrar_gasto, abrir_caja, movimiento_caja, cerrar_caja, _perfil_activo, _exigir_admin from public, anon;
grant execute on function registrar_venta, anular_venta, crear_producto, mover_stock, aumentar_precios, importar_productos,
  registrar_compra, registrar_gasto, abrir_caja, movimiento_caja, cerrar_caja, es_activo, es_admin to authenticated;
grant execute on function sistema_inicializado to anon, authenticated;

-- ---------------------------------------------------------------------
-- TIEMPO REAL (la caja y el stock se actualizan solos en todas las pantallas)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['productos','ventas','cajas','movimientos_caja','config','perfiles','gastos','compras','movimientos_stock','proveedores','comprobantes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
