-- =====================================================================
--  DATOS DE PRUEBA — Caja & Stock
--  Correr en Supabase → SQL Editor DESPUÉS de schema.sql y de haber
--  creado tu usuario administrador en la app.
--  MULTI-COMERCIO: carga los datos en el comercio que pongas en v_comercio
--  (por defecto, el del administrador general).
--
--  Carga: 8 proveedores, 70 artículos con precio/costo/stock, y 30 días
--  de historia (cajas cerradas, ventas, gastos y compras) para que los
--  reportes, el inicio y las alertas de stock tengan datos.
--  No deja ninguna caja abierta: la abrís vos desde la app.
--
--  Los artículos tienen códigos PRB-0001… para identificarlos.
--  Para borrar todo lo de prueba usá limpiar_datos.sql
-- =====================================================================

do $$
declare
  v_comercio text := null;   -- nombre exacto del comercio, o null = el del administrador general
  v_com uuid;
  v_admin perfiles;
  v_dia date;
  v_caja uuid;
  v_venta uuid;
  v_num bigint;
  v_cant_ventas int;
  v_items int;
  p productos;
  v_q numeric;
  v_sub numeric;
  v_costo numeric;
  v_hora timestamptz;
  v_medio text;
  v_efectivo numeric;
  v_ini numeric := 20000;
  v_ingresos numeric;
  v_egresos numeric;
  v_total_dia numeric;
  v_contado numeric;
  r record;
begin
  perform setseed(0.42);

  if v_comercio is null then
    select pf.comercio_id into v_com from superadmins s join perfiles pf on pf.id = s.user_id order by s.creado limit 1;
  else
    select id into v_com from comercios where nombre = v_comercio;
  end if;
  if v_com is null then
    raise exception 'No encuentro el comercio. Primero creá tu usuario administrador desde la app (pantalla de login)';
  end if;
  select * into v_admin from perfiles where comercio_id = v_com and rol = 'admin' and activo order by creado limit 1;
  if v_admin.id is null then raise exception 'Ese comercio no tiene un administrador activo'; end if;
  -- Todo lo que se inserte queda en ese comercio (comercio_id toma el valor por defecto del "usuario" actual)
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin.id)::text, true);

  if exists (select 1 from productos where comercio_id = v_com and codigo like 'PRB-%') then
    raise exception 'Los datos de prueba ya están cargados. Si querés recargarlos, corré antes limpiar_datos.sql';
  end if;
  if exists (select 1 from cajas where comercio_id = v_com and estado = 'abierta') then
    raise exception 'Cerrá la caja abierta antes de cargar los datos de prueba';
  end if;

  -- ---------------- Proveedores ----------------
  insert into proveedores (nombre, contacto, telefono, dias_visita, notas) values
    ('Distribuidora Gaseosas Norte', 'Preventista Martín', '5493880000001', 'martes y viernes', 'PRUEBA'),
    ('Cervecería Mayorista', 'Lucas', '5493880000002', 'lunes', 'PRUEBA'),
    ('Golosinas del Centro', 'Carla', '5493880000003', 'miércoles', 'PRUEBA'),
    ('Snacks y Más', 'Diego', '5493880000004', 'jueves', 'PRUEBA'),
    ('Aguas y Jugos SRL', 'Pablo', '5493880000005', 'martes', 'PRUEBA'),
    ('Vinoteca Mayorista', 'Sofía', '5493880000006', 'quincenal', 'PRUEBA'),
    ('Tabacalera Distribución', 'Raúl', '5493880000007', 'lunes y jueves', 'PRUEBA'),
    ('Almacén Mayorista', 'Ana', '5493880000008', 'viernes', 'PRUEBA');

  -- ---------------- Artículos (nombre, categoría, costo, precio, stock inicial, mínimo, proveedor, favorito) ----------------
  create temp table _art (nombre text, categoria text, costo numeric, precio numeric, stock numeric, minimo numeric, prov text, fav boolean) on commit drop;
  insert into _art values
    ('Gaseosa cola 500ml',            'Gaseosas',        900, 1400, 120, 24, 'Distribuidora Gaseosas Norte', true),
    ('Gaseosa cola 1,5L',             'Gaseosas',       1700, 2600,  60, 12, 'Distribuidora Gaseosas Norte', true),
    ('Gaseosa cola 2,25L',            'Gaseosas',       2200, 3300,  48, 12, 'Distribuidora Gaseosas Norte', false),
    ('Gaseosa cola zero 500ml',       'Gaseosas',        900, 1400,  60, 12, 'Distribuidora Gaseosas Norte', false),
    ('Gaseosa lima-limón 500ml',      'Gaseosas',        850, 1300,  60, 12, 'Distribuidora Gaseosas Norte', false),
    ('Gaseosa naranja 500ml',         'Gaseosas',        850, 1300,  48, 12, 'Distribuidora Gaseosas Norte', false),
    ('Gaseosa pomelo 1,5L',           'Gaseosas',       1500, 2300,  36,  8, 'Distribuidora Gaseosas Norte', false),
    ('Tónica 500ml',                  'Gaseosas',        950, 1500,  24,  6, 'Distribuidora Gaseosas Norte', false),
    ('Agua sin gas 500ml',            'Aguas',           450,  800, 120, 24, 'Aguas y Jugos SRL', true),
    ('Agua sin gas 1,5L',             'Aguas',           700, 1200,  60, 12, 'Aguas y Jugos SRL', false),
    ('Agua con gas 500ml',            'Aguas',           480,  850,  48, 12, 'Aguas y Jugos SRL', false),
    ('Agua saborizada pomelo 500ml',  'Aguas',           700, 1150,  48, 12, 'Aguas y Jugos SRL', false),
    ('Agua saborizada manzana 1,5L',  'Aguas',          1100, 1800,  36,  8, 'Aguas y Jugos SRL', false),
    ('Jugo naranja 1L',               'Jugos',          1300, 2100,  30,  6, 'Aguas y Jugos SRL', false),
    ('Jugo durazno 200ml',            'Jugos',           450,  750,  60, 12, 'Aguas y Jugos SRL', false),
    ('Bebida isotónica 500ml',        'Jugos',          1000, 1600,  36,  8, 'Aguas y Jugos SRL', false),
    ('Energizante lata 250ml',        'Energizantes',   1100, 1800,  72, 12, 'Distribuidora Gaseosas Norte', true),
    ('Energizante lata 473ml',        'Energizantes',   1600, 2600,  36,  8, 'Distribuidora Gaseosas Norte', false),
    ('Energizante sin azúcar 250ml',  'Energizantes',   1150, 1900,  24,  6, 'Distribuidora Gaseosas Norte', false),
    ('Cerveza rubia lata 473ml',      'Cervezas',       1200, 1900, 144, 24, 'Cervecería Mayorista', true),
    ('Cerveza rubia botella 1L',      'Cervezas',       2000, 3100,  72, 12, 'Cervecería Mayorista', true),
    ('Cerveza negra lata 473ml',      'Cervezas',       1350, 2100,  48, 12, 'Cervecería Mayorista', false),
    ('Cerveza IPA lata 473ml',        'Cervezas',       1700, 2700,  36,  8, 'Cervecería Mayorista', false),
    ('Cerveza roja lata 473ml',       'Cervezas',       1350, 2100,  36,  8, 'Cervecería Mayorista', false),
    ('Cerveza sin alcohol lata 473ml','Cervezas',       1250, 2000,  24,  6, 'Cervecería Mayorista', false),
    ('Vino tinto malbec 750ml',       'Vinos',          3500, 5800,  24,  6, 'Vinoteca Mayorista', false),
    ('Vino blanco torrontés 750ml',   'Vinos',          3200, 5300,  18,  4, 'Vinoteca Mayorista', false),
    ('Vino tinto caja 1L',            'Vinos',          1800, 2900,  36,  8, 'Vinoteca Mayorista', false),
    ('Espumante 750ml',               'Vinos',          4500, 7500,  12,  3, 'Vinoteca Mayorista', false),
    ('Fernet 750ml',                  'Bebidas blancas',9000,13500,  24,  6, 'Vinoteca Mayorista', true),
    ('Fernet 450ml',                  'Bebidas blancas',5800, 8800,  18,  4, 'Vinoteca Mayorista', false),
    ('Vodka 700ml',                   'Bebidas blancas',5500, 8500,  12,  3, 'Vinoteca Mayorista', false),
    ('Gin 700ml',                     'Bebidas blancas',9500,14500,  10,  3, 'Vinoteca Mayorista', false),
    ('Aperitivo rojo 750ml',          'Bebidas blancas',4200, 6500,  12,  3, 'Vinoteca Mayorista', false),
    ('Papas fritas clásicas 80g',     'Snacks',         1000, 1600,  60, 12, 'Snacks y Más', true),
    ('Papas fritas clásicas 150g',    'Snacks',         1700, 2700,  36,  8, 'Snacks y Más', false),
    ('Papas fritas jamón 80g',        'Snacks',         1050, 1700,  36,  8, 'Snacks y Más', false),
    ('Palitos salados 100g',          'Snacks',          700, 1150,  48, 12, 'Snacks y Más', false),
    ('Chizitos 80g',                  'Snacks',          800, 1300,  48, 12, 'Snacks y Más', false),
    ('Maní salado 120g',              'Snacks',          750, 1250,  48, 12, 'Snacks y Más', false),
    ('Nachos queso 100g',             'Snacks',         1200, 1950,  24,  6, 'Snacks y Más', false),
    ('Mix frutos secos 100g',         'Snacks',         1500, 2400,  24,  6, 'Snacks y Más', false),
    ('Alfajor triple chocolate',      'Golosinas',       600, 1000, 120, 24, 'Golosinas del Centro', true),
    ('Alfajor simple dulce de leche', 'Golosinas',       400,  700, 120, 24, 'Golosinas del Centro', false),
    ('Alfajor de maicena',            'Golosinas',       450,  800,  60, 12, 'Golosinas del Centro', false),
    ('Chicles menta x10',             'Golosinas',       250,  450, 100, 20, 'Golosinas del Centro', true),
    ('Caramelos masticables x5',      'Golosinas',       150,  300, 150, 30, 'Golosinas del Centro', false),
    ('Gomitas frutales 50g',          'Golosinas',       500,  850,  60, 12, 'Golosinas del Centro', false),
    ('Pastillas de menta',            'Golosinas',       350,  600,  60, 12, 'Golosinas del Centro', false),
    ('Chupetín',                      'Golosinas',       120,  250, 150, 30, 'Golosinas del Centro', false),
    ('Chocolate con leche 80g',       'Chocolates',     1300, 2100,  48, 12, 'Golosinas del Centro', false),
    ('Chocolate con almendras 80g',   'Chocolates',     1500, 2400,  36,  8, 'Golosinas del Centro', false),
    ('Bombón relleno',                'Chocolates',      300,  550, 100, 20, 'Golosinas del Centro', false),
    ('Barrita de cereal',             'Chocolates',      450,  750,  60, 12, 'Golosinas del Centro', false),
    ('Galletitas dulces 150g',        'Galletitas',      800, 1300,  48, 12, 'Almacén Mayorista', false),
    ('Galletitas rellenas chocolate', 'Galletitas',      900, 1450,  48, 12, 'Almacén Mayorista', false),
    ('Galletitas de agua 200g',       'Galletitas',      700, 1150,  36,  8, 'Almacén Mayorista', false),
    ('Obleas 100g',                   'Galletitas',      600, 1000,  36,  8, 'Almacén Mayorista', false),
    ('Helado palito agua',            'Helados',         400,  800,  40, 10, 'Golosinas del Centro', false),
    ('Helado bombón',                 'Helados',         800, 1400,  30,  8, 'Golosinas del Centro', false),
    ('Cigarrillos 20u box',           'Cigarrillos',    3000, 3600, 100, 20, 'Tabacalera Distribución', true),
    ('Cigarrillos 10u',               'Cigarrillos',    1600, 1950,  60, 12, 'Tabacalera Distribución', false),
    ('Encendedor',                    'Cigarrillos',     400,  800,  48, 12, 'Tabacalera Distribución', false),
    ('Hielo bolsa 2kg',               'Almacén',         600, 1200,  30, 10, 'Almacén Mayorista', true),
    ('Vasos descartables x10',        'Almacén',         500,  900,  30,  8, 'Almacén Mayorista', false),
    ('Servilletas x50',               'Almacén',         450,  800,  24,  6, 'Almacén Mayorista', false),
    ('Pan lactal',                    'Almacén',        1800, 2700,  15,  5, 'Almacén Mayorista', false),
    ('Yerba 500g',                    'Almacén',        2200, 3300,  24,  6, 'Almacén Mayorista', false),
    ('Pilas AA x2',                   'Varios',         1200, 2200,  24,  6, 'Almacén Mayorista', false),
    ('Carbón 3kg',                    'Varios',         2500, 4200,  12,  4, 'Almacén Mayorista', false);

  insert into productos (nombre, codigo, categoria, costo, precio, stock, stock_min, proveedor_id, favorito, creado)
  select a.nombre, 'PRB-' || lpad(row_number() over (order by a.categoria, a.nombre)::text, 4, '0'),
         a.categoria, a.costo, a.precio, a.stock, a.minimo,
         (select id from proveedores where comercio_id = v_com and nombre = a.prov and notas = 'PRUEBA' limit 1), a.fav, now() - interval '31 days'
  from _art a;

  insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, motivo, fecha, usuario_nombre)
  select id, nombre, 'alta', stock, 0, stock, 'Stock inicial (datos de prueba)', now() - interval '31 days', v_admin.nombre
  from productos where comercio_id = v_com and codigo like 'PRB-%';

  -- ---------------- 30 días de historia ----------------
  for v_dia in select generate_series(current_date - 30, current_date - 1, interval '1 day')::date loop
    insert into cajas (estado, apertura, abierta_por, abierta_por_nombre, monto_inicial, observaciones)
    values ('abierta', (v_dia + time '08:00') at time zone 'America/Argentina/Buenos_Aires', v_admin.id, v_admin.nombre, v_ini, 'PRUEBA')
    returning id into v_caja;

    -- más movimiento viernes y sábado
    v_cant_ventas := 18 + floor(random() * 15)::int + case when extract(dow from v_dia) in (5, 6) then 15 else 0 end;

    for i in 1..v_cant_ventas loop
      -- horario con picos al mediodía y a la noche
      v_hora := (v_dia + make_time(
                  (array[9,10,11,12,12,13,13,14,17,18,19,19,20,20,21,21,22])[1 + floor(random() * 17)::int],
                  floor(random() * 60)::int, 0)) at time zone 'America/Argentina/Buenos_Aires';
      v_medio := (array['efectivo','efectivo','efectivo','efectivo','debito','debito','qr','qr','transferencia','credito'])[1 + floor(random() * 10)::int];

      update comercios set ultimo_ticket = ultimo_ticket + 1 where id = v_com returning ultimo_ticket into v_num;
      insert into ventas (numero, fecha, caja_id, usuario_id, usuario_nombre, pagos)
      values (v_num, v_hora, v_caja, v_admin.id, v_admin.nombre, '[]')
      returning id into v_venta;

      v_sub := 0; v_costo := 0;
      v_items := 1 + floor(random() * 3.5)::int;
      for r in
        select * from productos where comercio_id = v_com and codigo like 'PRB-%' and stock > 3
        order by random() * (case when favorito then 0.35 else 1 end) limit v_items
      loop
        v_q := least(r.stock - 1, case when random() < 0.75 then 1 when random() < 0.7 then 2 else 6 end);
        insert into venta_items (venta_id, producto_id, nombre, codigo, categoria, cantidad, precio, costo, subtotal)
        values (v_venta, r.id, r.nombre, r.codigo, r.categoria, v_q, r.precio, r.costo, v_q * r.precio);
        update productos set stock = stock - v_q where id = r.id;
        insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, ref, fecha, usuario_nombre)
        values (r.id, r.nombre, 'venta', -v_q, r.stock, r.stock - v_q, 'Venta #' || v_num, v_hora, v_admin.nombre);
        v_sub := v_sub + v_q * r.precio;
        v_costo := v_costo + v_q * r.costo;
      end loop;

      update ventas set subtotal = v_sub, total = v_sub, costo_total = v_costo,
        pagos = jsonb_build_array(jsonb_build_object('medio', v_medio, 'monto', v_sub)),
        recibido = case when v_medio = 'efectivo' then ceil(v_sub / 1000) * 1000 else 0 end,
        vuelto   = case when v_medio = 'efectivo' then ceil(v_sub / 1000) * 1000 - v_sub else 0 end
      where id = v_venta;
    end loop;

    -- una anulación cada tanto
    if random() < 0.25 then
      select id, numero into v_venta, v_num from ventas where caja_id = v_caja order by random() limit 1;
      update ventas set estado = 'anulada', motivo_anulacion = 'Cobro duplicado (prueba)', anulada_por = v_admin.nombre,
        fecha_anulacion = fecha + interval '5 minutes'
      where id = v_venta;
      for r in select i.*, pr.stock as stock_actual from venta_items i join productos pr on pr.id = i.producto_id where i.venta_id = v_venta loop
        update productos set stock = stock + r.cantidad where id = r.producto_id;
        insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, ref, motivo, usuario_nombre,
                                       fecha)
        values (r.producto_id, r.nombre, 'anulacion', r.cantidad, r.stock_actual, r.stock_actual + r.cantidad,
                'Anulación venta #' || v_num, 'Cobro duplicado (prueba)', v_admin.nombre,
                (v_dia + time '22:00') at time zone 'America/Argentina/Buenos_Aires');
      end loop;
    end if;

    -- retiro del dueño al mediodía
    insert into movimientos_caja (caja_id, tipo, monto, concepto, fecha, usuario_nombre)
    values (v_caja, 'egreso', 15000, 'Retiro del dueño', (v_dia + time '14:00') at time zone 'America/Argentina/Buenos_Aires', v_admin.nombre);

    -- cierre con arqueo (diferencias chicas para ver faltantes/sobrantes)
    select coalesce(sum((x->>'monto')::numeric), 0) into v_efectivo
    from ventas v, jsonb_array_elements(v.pagos) x
    where v.caja_id = v_caja and v.estado = 'completada' and x->>'medio' = 'efectivo';
    select coalesce(sum(total), 0) into v_total_dia from ventas where caja_id = v_caja and estado = 'completada';
    select coalesce(sum(monto) filter (where tipo = 'ingreso'), 0), coalesce(sum(monto) filter (where tipo = 'egreso'), 0)
      into v_ingresos, v_egresos from movimientos_caja where caja_id = v_caja;
    v_contado := v_ini + v_efectivo + v_ingresos - v_egresos
                 + (array[0,0,0,0,0,-100,-500,200,-1000,50])[1 + floor(random() * 10)::int];

    update cajas set estado = 'cerrada',
      cierre = (v_dia + time '22:30') at time zone 'America/Argentina/Buenos_Aires',
      cerrada_por_nombre = v_admin.nombre,
      total_ventas = v_total_dia,
      cant_ventas = (select count(*) from ventas where caja_id = v_caja and estado = 'completada'),
      por_medio = (select coalesce(jsonb_object_agg(m, t), '{}') from (
                     select x->>'medio' m, sum((x->>'monto')::numeric) t
                     from ventas v, jsonb_array_elements(v.pagos) x
                     where v.caja_id = v_caja and v.estado = 'completada' group by 1) s),
      ingresos = v_ingresos, egresos = v_egresos,
      efectivo_esperado = v_ini + v_efectivo + v_ingresos - v_egresos,
      efectivo_contado = v_contado,
      diferencia = v_contado - (v_ini + v_efectivo + v_ingresos - v_egresos)
    where id = v_caja;

    -- reposición: dos veces por semana entra mercadería de lo que quedó bajo
    if extract(dow from v_dia) in (2, 5) then
      for r in
        select pr.*, pv.nombre as prov_nombre from productos pr join proveedores pv on pv.id = pr.proveedor_id
        where pr.comercio_id = v_com and pr.codigo like 'PRB-%' and pr.stock <= pr.stock_min * 2
        order by pr.stock / greatest(pr.stock_min, 1) limit 25
      loop
        v_q := greatest(r.stock_min * 3 - r.stock, 6);
        update productos set stock = stock + v_q where id = r.id;
        insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, ref, fecha, usuario_nombre)
        values (r.id, r.nombre, 'compra', v_q, r.stock, r.stock + v_q, 'Compra ' || r.prov_nombre,
                (v_dia + time '10:00') at time zone 'America/Argentina/Buenos_Aires', v_admin.nombre);
        insert into compras (fecha, proveedor_id, proveedor_nombre, comprobante, items, total, medio, pagado_desde_caja, usuario_nombre)
        values ((v_dia + time '10:00') at time zone 'America/Argentina/Buenos_Aires', r.proveedor_id, r.prov_nombre,
                'PRUEBA-' || to_char(v_dia, 'MMDD'),
                jsonb_build_array(jsonb_build_object('producto_id', r.id, 'nombre', r.nombre, 'cantidad', v_q, 'costo', r.costo, 'subtotal', v_q * r.costo)),
                v_q * r.costo, 'transferencia', false, v_admin.nombre);
      end loop;
    end if;
  end loop;

  -- ---------------- Gastos del período ----------------
  insert into gastos (fecha, categoria, descripcion, monto, medio, usuario_nombre) values
    (current_date - 28, 'Alquiler',                  'Alquiler local (prueba)',        450000, 'transferencia', v_admin.nombre),
    (current_date - 25, 'Luz',                       'Factura luz (prueba)',            68000, 'transferencia', v_admin.nombre),
    (current_date - 22, 'Internet / Teléfono',       'Internet (prueba)',               28000, 'debito',        v_admin.nombre),
    (current_date - 20, 'Impuestos / ARCA',          'Monotributo (prueba)',            62000, 'transferencia', v_admin.nombre),
    (current_date - 15, 'Sueldos',                   'Quincena empleado (prueba)',     250000, 'transferencia', v_admin.nombre),
    (current_date - 12, 'Comisiones bancarias / MP', 'Comisiones Mercado Pago (prueba)', 18500, 'transferencia', v_admin.nombre),
    (current_date - 10, 'Bolsas / Insumos',          'Bolsas y rollos de ticket (prueba)', 15000, 'efectivo',   v_admin.nombre),
    (current_date -  7, 'Mantenimiento',             'Arreglo heladera (prueba)',       45000, 'efectivo',      v_admin.nombre),
    (current_date -  5, 'Limpieza',                  'Artículos de limpieza (prueba)',   9000, 'efectivo',      v_admin.nombre),
    (current_date -  1, 'Sueldos',                   'Quincena empleado (prueba)',     250000, 'transferencia', v_admin.nombre);

  -- ---------------- Algunos productos en alerta y una merma ----------------
  for r in select * from productos where comercio_id = v_com and codigo like 'PRB-%' and nombre in ('Gin 700ml', 'Espumante 750ml', 'Pan lactal', 'Helado bombón') loop
    update productos set stock = case when r.nombre in ('Gin 700ml', 'Pan lactal') then 0 else 2 end where id = r.id;
    insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_nombre)
    values (r.id, r.nombre, 'ajuste', (case when r.nombre in ('Gin 700ml', 'Pan lactal') then 0 else 2 end) - r.stock, r.stock,
            case when r.nombre in ('Gin 700ml', 'Pan lactal') then 0 else 2 end, 'Inventario (prueba)', v_admin.nombre);
  end loop;
  for r in select * from productos where comercio_id = v_com and codigo like 'PRB-%' and nombre = 'Cerveza rubia botella 1L' loop
    update productos set stock = stock - 2 where id = r.id;
    insert into movimientos_stock (producto_id, nombre, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_nombre)
    values (r.id, r.nombre, 'merma', -2, r.stock, r.stock - 2, 'Se rompieron al acomodar (prueba)', v_admin.nombre);
  end loop;

  -- ---------------- Factura del proveedor: ~6 de cada 10 compras con factura A ----------------
  update compras set fac_tipo = 'A', fac_iva = round(total - total / 1.21, 2),
         comprobante = '0003-' || lpad((10000 + (random() * 89999)::int)::text, 8, '0')
  where comercio_id = v_com and comprobante like 'PRUEBA-%' and random() < 0.6;

  update productos set actualizado = now() where comercio_id = v_com and codigo like 'PRB-%';
  raise notice 'Datos de prueba cargados: % artículos, % ventas', (select count(*) from productos where comercio_id = v_com and codigo like 'PRB-%'), (select count(*) from ventas where comercio_id = v_com);
end $$;
