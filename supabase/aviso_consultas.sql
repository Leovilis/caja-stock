-- =====================================================================
--  AVISO DE SOLICITUDES DE DEMO (tabla consultas)
--  Cada vez que alguien deja una consulta en mikiosko.com.ar te llega:
--    * un mensaje de Telegram, y/o
--    * un mail (con Resend).
--  Funciona solo desde la base: no hay que tocar la app ni hacer deploy.
--
--  1) Supabase → SQL Editor → pegar este archivo → Run.
--  2) Cargar los datos del canal que quieras usar (ver al final).
--  3) Probar con:  select probar_aviso_consulta();
--
--  Si el aviso falla, la consulta se guarda igual (nunca se pierde).
-- =====================================================================

create extension if not exists pg_net;

-- Lee un dato guardado en Vault (o null si no está)
create or replace function _aviso_secreto(p_nombre text) returns text
language sql stable security definer set search_path = public as $$
  select nullif(trim(decrypted_secret), '') from vault.decrypted_secrets where name = p_nombre limit 1;
$$;

-- Manda el aviso de una consulta por los canales configurados
create or replace function _avisar_consulta(c consultas) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_tg_token text := _aviso_secreto('aviso_telegram_token');
  v_tg_chat  text := _aviso_secreto('aviso_telegram_chat');
  v_rs_key   text := _aviso_secreto('aviso_resend_key');
  v_mail     text := _aviso_secreto('aviso_email_para');
  v_de       text := coalesce(_aviso_secreto('aviso_email_de'), 'Mostrador <onboarding@resend.dev>');
  v_tel      text := regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g');
  v_texto    text;
  v_canales  text[] := '{}';
begin
  v_texto := '🔔 Nueva solicitud de demo' || E'\n\n'
    || 'Nombre: ' || c.nombre || E'\n'
    || case when c.negocio  <> '' then 'Negocio: '  || c.negocio  || E'\n' else '' end
    || case when c.telefono <> '' then 'Teléfono: ' || c.telefono || E'\n' else '' end
    || case when c.email    <> '' then 'Email: '    || c.email    || E'\n' else '' end
    || case when c.plan     <> '' then 'Plan: '     || c.plan     || E'\n' else '' end
    || case when c.mensaje  <> '' then E'\nMensaje:\n' || left(c.mensaje, 1500) || E'\n' else '' end
    || E'\nFecha: ' || to_char(c.creado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI')
    || case when length(v_tel) >= 8 then E'\nWhatsApp: https://wa.me/' || v_tel else '' end;

  -- Telegram (texto plano: lo que escribió el cliente no se interpreta como formato)
  if v_tg_token is not null and v_tg_chat is not null then
    perform net.http_post(
      url     := 'https://api.telegram.org/bot' || v_tg_token || '/sendMessage',
      body    := jsonb_build_object('chat_id', v_tg_chat, 'text', v_texto, 'disable_web_page_preview', true),
      headers := '{"Content-Type": "application/json"}'::jsonb);
    v_canales := array_append(v_canales, 'Telegram');
  end if;

  -- Mail con Resend
  if v_rs_key is not null and v_mail is not null then
    perform net.http_post(
      url     := 'https://api.resend.com/emails',
      body    := jsonb_build_object(
                   'from', v_de,
                   'to', jsonb_build_array(v_mail),
                   'subject', 'Nueva solicitud de demo: ' || c.nombre || coalesce(' — ' || nullif(c.negocio, ''), ''),
                   'text', v_texto)
                 || case when c.email <> '' then jsonb_build_object('reply_to', c.email) else '{}'::jsonb end,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_rs_key));
    v_canales := array_append(v_canales, 'mail');
  end if;

  return case when cardinality(v_canales) = 0 then 'No hay ningún canal configurado (faltan los datos en Vault)'
              else 'Aviso enviado por ' || array_to_string(v_canales, ' y ') end;
end $$;

-- Trigger: al entrar una consulta nueva
create or replace function _trg_aviso_consulta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform _avisar_consulta(new);
  exception when others then
    raise warning 'No se pudo enviar el aviso de la consulta %: %', new.id, sqlerrm;  -- la consulta se guarda igual
  end;
  return new;
end $$;

drop trigger if exists aviso_consulta on consultas;
create trigger aviso_consulta after insert on consultas
  for each row execute function _trg_aviso_consulta();

-- Prueba: manda un aviso de ejemplo SIN guardar nada en consultas
create or replace function probar_aviso_consulta() returns text
language plpgsql security definer set search_path = public as $$
declare c consultas;
begin
  c.id := gen_random_uuid(); c.creado := now();
  c.nombre := 'Prueba de aviso'; c.negocio := 'Kiosco de prueba'; c.telefono := '';
  c.email := ''; c.plan := 'Completo'; c.mensaje := 'Si te llegó esto, los avisos funcionan.';
  return _avisar_consulta(c);
end $$;

-- Nadie las llama desde el navegador
revoke all on function _aviso_secreto, _avisar_consulta, _trg_aviso_consulta, probar_aviso_consulta from public, anon, authenticated;

-- =====================================================================
--  CONFIGURACIÓN (correr una sola vez, con TUS datos; quedan cifrados en Vault)
--
--  TELEGRAM (recomendado: llega al instante al celular, gratis)
--   1. En Telegram buscá @BotFather → /newbot → elegí un nombre → te da un TOKEN.
--   2. Abrí tu bot nuevo y mandale cualquier mensaje (ej: "hola").
--   3. En el navegador: https://api.telegram.org/botTU_TOKEN/getUpdates
--      buscá  "chat":{"id":123456789  → ese número es tu CHAT ID.
--   4. Corré:
--      select vault.create_secret('TU_TOKEN',   'aviso_telegram_token');
--      select vault.create_secret('TU_CHAT_ID', 'aviso_telegram_chat');
--
--  MAIL (con Resend, gratis hasta 3.000 mails por mes)
--   1. Creá una cuenta en https://resend.com con el mail donde querés recibir los avisos.
--   2. API Keys → Create API Key (permiso "Sending access") → copiala (empieza con re_).
--   3. Corré:
--      select vault.create_secret('re_TU_API_KEY',  'aviso_resend_key');
--      select vault.create_secret('tu@email.com',   'aviso_email_para');
--   Sin dominio verificado, Resend sólo deja mandar al mail con el que te registraste
--   (alcanza para avisarte a vos). Si después verificás mikiosko.com.ar en Resend:
--      select vault.create_secret('Mostrador <avisos@mikiosko.com.ar>', 'aviso_email_de');
--
--  PROBAR:   select probar_aviso_consulta();
--  Si no llega, mirá la respuesta del servicio (status 200 = ok):
--      select status_code, content from net._http_response order by created desc limit 5;
--
--  Cambiar un dato:  select vault.update_secret((select id from vault.secrets where name = 'aviso_telegram_chat'), 'NUEVO_VALOR');
--  Desactivar todo:  drop trigger aviso_consulta on consultas;
-- =====================================================================
