begin;

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
    update private.temporary_credentials credential
    set active = false
    where credential.active = true
      and credential.expires_at <= now();

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

  delete from private.staff_sessions session
  where session.expires_at < now() - interval '1 day'
    or session.revoked_at < now() - interval '1 day';

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

revoke all on function public.authenticate_staff(text, text) from public, anon, authenticated;
grant execute on function public.authenticate_staff(text, text) to anon;

notify pgrst, 'reload schema';

commit;
