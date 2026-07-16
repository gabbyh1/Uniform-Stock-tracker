begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.staff_credentials (
  id smallint primary key default 1 check (id = 1),
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.temporary_credentials (
  id uuid primary key default extensions.gen_random_uuid(),
  username text not null check (char_length(username) between 3 and 100),
  password_hash text not null,
  note text not null default '',
  expires_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists temporary_credentials_active_username_idx
  on private.temporary_credentials (lower(username))
  where active;

create table if not exists private.staff_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  token_hash text not null unique,
  access_type text not null check (access_type in ('staff', 'temporary')),
  access_label text not null,
  username text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists staff_sessions_active_idx
  on private.staff_sessions (token_hash, expires_at)
  where revoked_at is null;

create table if not exists private.staff_login_attempts (
  id bigint generated always as identity primary key,
  client_key text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index if not exists staff_login_attempts_lookup_idx
  on private.staff_login_attempts (client_key, attempted_at desc);

create table if not exists private.public_request_attempts (
  id bigint generated always as identity primary key,
  client_key text not null,
  request_type text not null,
  requested_at timestamptz not null default now()
);

create index if not exists public_request_attempts_lookup_idx
  on private.public_request_attempts (client_key, request_type, requested_at desc);

create or replace function private.request_client_key(p_scope text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with headers as (
    select coalesce(
      nullif(current_setting('request.headers', true), ''),
      '{}'
    )::jsonb as value
  )
  select encode(
    extensions.digest(
      concat_ws(
        '|',
        p_scope,
        coalesce(
          nullif(split_part(headers.value->>'x-forwarded-for', ',', 1), ''),
          nullif(headers.value->>'cf-connecting-ip', ''),
          nullif(headers.value->>'x-real-ip', ''),
          'unknown'
        ),
        coalesce(headers.value->>'user-agent', 'unknown')
      ),
      'sha256'
    ),
    'hex'
  )
  from headers;
$$;

create or replace function private.request_session_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.headers', true), ''),
      '{}'
    )::jsonb->>'x-staff-session',
    ''
  );
$$;

create or replace function private.hash_password(p_password text)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select '$rafac-sha256$' || extensions.crypt(
    encode(extensions.digest(p_password, 'sha256'), 'hex'),
    extensions.gen_salt('bf', 12)
  );
$$;

create or replace function private.password_matches(p_password text, p_password_hash text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bcrypt_hash text;
begin
  if p_password is null or p_password_hash is null then return false; end if;

  if left(p_password_hash, 14) = '$rafac-sha256$' then
    v_bcrypt_hash := substring(p_password_hash from 15);
    return extensions.crypt(
      encode(extensions.digest(p_password, 'sha256'), 'hex'),
      v_bcrypt_hash
    ) = v_bcrypt_hash;
  end if;

  return extensions.crypt(p_password, p_password_hash) = p_password_hash;
end;
$$;

create or replace function private.has_valid_staff_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.staff_sessions session
    where session.token_hash = encode(
      extensions.digest(private.request_session_token(), 'sha256'),
      'hex'
    )
      and session.revoked_at is null
      and session.expires_at > now()
  );
$$;

create or replace function private.enforce_public_request_limit(p_request_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_key text := private.request_client_key('request:' || p_request_type);
  v_count integer;
begin
  delete from private.public_request_attempts
  where requested_at < now() - interval '1 day';

  select count(*)
  into v_count
  from private.public_request_attempts
  where client_key = v_client_key
    and request_type = p_request_type
    and requested_at > now() - interval '15 minutes';

  if v_count >= 10 then
    raise exception 'Too many requests. Please wait 15 minutes and try again.' using errcode = 'P0001';
  end if;

  insert into private.public_request_attempts (client_key, request_type)
  values (v_client_key, p_request_type);
end;
$$;

create or replace function public.authenticate_staff(
  p_password text,
  p_username text default null
)
returns table (
  session_token text,
  access_label text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := nullif(btrim(coalesce(p_username, '')), '');
  v_client_key text;
  v_account_key text;
  v_client_failures integer;
  v_account_failures integer;
  v_password_hash text;
  v_password_valid boolean := false;
  v_credential_expires timestamptz;
  v_access_type text;
  v_access_label text;
  v_session_expires timestamptz;
  v_token text;
begin
  v_client_key := private.request_client_key('login-client');
  v_account_key := private.request_client_key(
    'login-account:' || coalesce(lower(v_username), 'staff')
  );

  delete from private.staff_login_attempts
  where attempted_at < now() - interval '1 day';

  select count(*)
  into v_client_failures
  from private.staff_login_attempts
  where client_key = v_client_key
    and success = false
    and attempted_at > now() - interval '15 minutes';

  select count(*)
  into v_account_failures
  from private.staff_login_attempts
  where client_key = v_account_key
    and success = false
    and attempted_at > now() - interval '15 minutes';

  if v_account_failures >= 5 or v_client_failures >= 20 then
    raise exception 'Too many failed attempts. Please wait 15 minutes and try again.' using errcode = 'P0001';
  end if;

  if p_password is null or char_length(p_password) = 0 or char_length(p_password) > 200 then
    insert into private.staff_login_attempts (client_key, success)
    select key, false from unnest(array[v_client_key, v_account_key]) key;
    return;
  end if;

  if v_username is null then
    select credential.password_hash
    into v_password_hash
    from private.staff_credentials credential
    where credential.id = 1;

    v_access_type := 'staff';
    v_access_label := 'Staff Account';
    v_session_expires := now() + interval '8 hours';
  else
    update private.temporary_credentials
    set active = false
    where active = true and expires_at <= now();

    select credential.password_hash, credential.expires_at
    into v_password_hash, v_credential_expires
    from private.temporary_credentials credential
    where lower(credential.username) = lower(v_username)
      and credential.active = true
      and credential.expires_at > now()
    order by credential.created_at desc
    limit 1;

    v_access_type := 'temporary';
    v_access_label := 'Temporary Access: ' || v_username;
    v_session_expires := least(
      coalesce(v_credential_expires, now()),
      now() + interval '8 hours'
    );
  end if;

  if v_password_hash is null then
    perform private.hash_password(p_password);
  else
    v_password_valid := private.password_matches(p_password, v_password_hash);
  end if;

  if not v_password_valid or v_session_expires <= now() then
    insert into private.staff_login_attempts (client_key, success)
    select key, false from unnest(array[v_client_key, v_account_key]) key;
    return;
  end if;

  delete from private.staff_login_attempts
  where client_key in (v_client_key, v_account_key)
    and success = false;

  insert into private.staff_login_attempts (client_key, success)
  select key, true from unnest(array[v_client_key, v_account_key]) key;

  delete from private.staff_sessions
  where expires_at < now() - interval '1 day'
    or revoked_at < now() - interval '1 day';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into private.staff_sessions (
    token_hash,
    access_type,
    access_label,
    username,
    expires_at
  ) values (
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_access_type,
    v_access_label,
    v_username,
    v_session_expires
  );

  return query select v_token, v_access_label, v_session_expires;
end;
$$;

create or replace function public.validate_staff_session()
returns table (
  access_label text,
  username text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := private.request_session_token();
begin
  if v_token is null then return; end if;

  update private.staff_sessions session
  set last_seen_at = now()
  where session.token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
    and session.revoked_at is null
    and session.expires_at > now();

  return query
  select session.access_label, session.username, session.expires_at
  from private.staff_sessions session
  where session.token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
    and session.revoked_at is null
    and session.expires_at > now();
end;
$$;

create or replace function public.end_staff_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := private.request_session_token();
  v_updated integer;
begin
  if v_token is null then return false; end if;

  update private.staff_sessions session
  set revoked_at = now()
  where session.token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
    and session.revoked_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.set_staff_password(p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_password is null or char_length(p_password) < 10 or char_length(p_password) > 200 then
    raise exception 'The permanent staff password must contain between 10 and 200 characters.' using errcode = '22023';
  end if;

  insert into private.staff_credentials (id, password_hash, updated_at)
  values (1, private.hash_password(p_password), now())
  on conflict (id) do update
  set password_hash = excluded.password_hash,
      updated_at = excluded.updated_at;

  update private.staff_sessions
  set revoked_at = now()
  where revoked_at is null;
end;
$$;

create or replace function public.create_temporary_credential(
  p_username text,
  p_password text,
  p_note text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := btrim(coalesce(p_username, ''));
  v_id uuid;
begin
  if not private.has_valid_staff_session() then
    raise exception 'A valid staff session is required.' using errcode = '42501';
  end if;

  if char_length(v_username) < 3 or char_length(v_username) > 100 then
    raise exception 'Temporary usernames must contain between 3 and 100 characters.' using errcode = '22023';
  end if;

  if p_password is null or char_length(p_password) < 6 or char_length(p_password) > 200 then
    raise exception 'Temporary passwords must contain between 6 and 200 characters.' using errcode = '22023';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'The expiry must be in the future.' using errcode = '22023';
  end if;

  update private.temporary_credentials
  set active = false
  where active = true and expires_at <= now();

  if exists (
    select 1
    from private.temporary_credentials credential
    where lower(credential.username) = lower(v_username)
      and credential.active = true
  ) then
    raise exception 'That temporary username is already active.' using errcode = '23505';
  end if;

  insert into private.temporary_credentials (
    username,
    password_hash,
    note,
    expires_at
  ) values (
    v_username,
    private.hash_password(p_password),
    left(btrim(coalesce(p_note, '')), 250),
    p_expires_at
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.list_temporary_credentials()
returns table (
  id uuid,
  username text,
  note text,
  expires_at timestamptz,
  active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_valid_staff_session() then
    raise exception 'A valid staff session is required.' using errcode = '42501';
  end if;

  return query
  select
    credential.id,
    credential.username,
    credential.note,
    credential.expires_at,
    credential.active and credential.expires_at > now(),
    credential.created_at
  from private.temporary_credentials credential
  order by credential.expires_at desc;
end;
$$;

create or replace function public.disable_temporary_credential(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
  v_username text;
begin
  if not private.has_valid_staff_session() then
    raise exception 'A valid staff session is required.' using errcode = '42501';
  end if;

  update private.temporary_credentials
  set active = false
  where id = p_id and active = true
  returning username into v_username;

  get diagnostics v_updated = row_count;

  if v_username is not null then
    update private.staff_sessions
    set revoked_at = now()
    where access_type = 'temporary'
      and lower(username) = lower(v_username)
      and revoked_at is null;
  end if;

  return v_updated > 0;
end;
$$;

create or replace function public.get_uniform_catalog()
returns table (item text, size text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct stock.item::text, stock.size::text
  from public.uniform_stock stock
  where stock.item is not null and stock.size is not null
  order by stock.item::text, stock.size::text;
$$;

create or replace function public.submit_uniform_request(
  p_cadet_name text,
  p_item text,
  p_size text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_public_request_limit('uniform');

  if char_length(btrim(coalesce(p_cadet_name, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_item, ''))) not between 1 and 100
    or char_length(btrim(coalesce(p_size, ''))) not between 1 and 100
    or char_length(btrim(coalesce(p_reason, ''))) not between 2 and 500 then
    raise exception 'Complete all fields using valid values.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.uniform_stock stock
    where stock.item = btrim(p_item) and stock.size = btrim(p_size)
  ) then
    raise exception 'The selected uniform item is not available.' using errcode = '22023';
  end if;

  insert into public.uniform_requests (cadet_name, item, size, reason, status)
  values (
    btrim(p_cadet_name),
    btrim(p_item),
    btrim(p_size),
    btrim(p_reason),
    'Pending'
  );

  return true;
end;
$$;

create or replace function public.submit_at_kit_request(
  p_cadet_name text,
  p_activity_name text,
  p_requested_items text[],
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list_id text;
begin
  perform private.enforce_public_request_limit('at-kit');

  if char_length(btrim(coalesce(p_cadet_name, ''))) not between 2 and 100
    or char_length(btrim(coalesce(p_activity_name, ''))) not between 1 and 150
    or coalesce(cardinality(p_requested_items), 0) < 1
    or coalesce(cardinality(p_requested_items), 0) > 50
    or char_length(btrim(coalesce(p_reason, ''))) > 500 then
    raise exception 'Complete all fields using valid values.' using errcode = '22023';
  end if;

  select list.id::text
  into v_list_id
  from public.at_kit_lists list
  where list.activity_name = btrim(p_activity_name)
    and list.active = true
  limit 1;

  if v_list_id is null then
    raise exception 'The selected activity is not available.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_requested_items) requested(item)
    where not exists (
      select 1
      from public.at_kit_list_items list_item
      where list_item.kit_list_id::text = v_list_id
        and list_item.kit_type = requested.item
    )
  ) then
    raise exception 'One or more selected kit items are invalid.' using errcode = '22023';
  end if;

  insert into public.at_kit_requests (
    cadet_name,
    activity_name,
    kit_type,
    reason,
    status
  ) values (
    btrim(p_cadet_name),
    btrim(p_activity_name),
    array_to_string(p_requested_items, ', '),
    btrim(coalesce(p_reason, '')),
    'Pending'
  );

  return true;
end;
$$;

do $$
begin
  if to_regclass('public.temporary_passwords') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'temporary_passwords'
        and column_name = 'password'
    ) then
    execute $migration$
      insert into private.temporary_credentials (
        username,
        password_hash,
        note,
        expires_at,
        active,
        created_at
      )
      select
        left(
          coalesce(nullif(btrim(note), ''), 'temporary') || '-' ||
          row_number() over (order by expires_at nulls last, note),
          100
        ),
        private.hash_password(password),
        coalesce(note, ''),
        coalesce(expires_at, now()),
        coalesce(active, false) and coalesce(expires_at, now()) > now(),
        now()
      from public.temporary_passwords
      where nullif(password, '') is not null
    $migration$;

    alter table public.temporary_passwords drop column password;
  end if;
end;
$$;

do $$
declare
  v_table text;
  v_policy record;
  v_tables text[] := array[
    'uniform_stock',
    'uniform_issues',
    'uniform_requests',
    'at_kit',
    'at_kit_issues',
    'at_kit_lists',
    'at_kit_list_items',
    'serviceability_checks',
    'at_kit_requests'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Required table public.% does not exist.', v_table;
    end if;

    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all privileges on table public.%I from anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to anon', v_table);

    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy %I on public.%I', v_policy.policyname, v_table);
    end loop;

    execute format(
      'create policy staff_session_access on public.%I for all to anon using ((select private.has_valid_staff_session())) with check ((select private.has_valid_staff_session()))',
      v_table
    );
  end loop;
end;
$$;

create policy public_active_kit_lists
  on public.at_kit_lists
  for select
  to anon
  using (active = true);

create policy public_active_kit_list_items
  on public.at_kit_list_items
  for select
  to anon
  using (
    exists (
      select 1
      from public.at_kit_lists list
      where list.id = at_kit_list_items.kit_list_id
        and list.active = true
    )
  );

do $$
declare
  v_policy record;
begin
  if to_regclass('public.temporary_passwords') is not null then
    alter table public.temporary_passwords enable row level security;
    revoke all privileges on table public.temporary_passwords from anon, authenticated;

    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = 'temporary_passwords'
    loop
      execute format('drop policy %I on public.temporary_passwords', v_policy.policyname);
    end loop;
  end if;
end;
$$;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema private to anon;
grant execute on function private.has_valid_staff_session() to anon;

revoke all on function public.authenticate_staff(text, text) from public, anon, authenticated;
revoke all on function public.validate_staff_session() from public, anon, authenticated;
revoke all on function public.end_staff_session() from public, anon, authenticated;
revoke all on function public.set_staff_password(text) from public, anon, authenticated;
revoke all on function public.create_temporary_credential(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.list_temporary_credentials() from public, anon, authenticated;
revoke all on function public.disable_temporary_credential(uuid) from public, anon, authenticated;
revoke all on function public.get_uniform_catalog() from public, anon, authenticated;
revoke all on function public.submit_uniform_request(text, text, text, text) from public, anon, authenticated;
revoke all on function public.submit_at_kit_request(text, text, text[], text) from public, anon, authenticated;

grant execute on function public.authenticate_staff(text, text) to anon;
grant execute on function public.validate_staff_session() to anon;
grant execute on function public.end_staff_session() to anon;
grant execute on function public.create_temporary_credential(text, text, text, timestamptz) to anon;
grant execute on function public.list_temporary_credentials() to anon;
grant execute on function public.disable_temporary_credential(uuid) to anon;
grant execute on function public.get_uniform_catalog() to anon;
grant execute on function public.submit_uniform_request(text, text, text, text) to anon;
grant execute on function public.submit_at_kit_request(text, text, text[], text) to anon;
grant execute on function public.set_staff_password(text) to service_role;

notify pgrst, 'reload schema';

commit;
