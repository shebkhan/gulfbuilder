-- 0009_id_encryption: tenant ID numbers are encrypted inside Postgres (D-011).
-- The key lives in Supabase Vault as `id_encryption_key`, so no client process holds it and
-- any client that may write a tenant can do so without ever seeing the secret.

create or replace function public.encrypt_id(p_plaintext text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_key text;
begin
  if p_plaintext is null then
    return null;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'id_encryption_key'
  limit 1;

  if v_key is null then
    raise exception 'id encryption key missing from vault' using errcode = '55000';
  end if;

  return encode(pgp_sym_encrypt(p_plaintext, v_key, 'cipher-algo=aes256'), 'base64');
end;
$$;

create or replace function public.decrypt_id(p_ciphertext text) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_key text;
  v_plain text;
begin
  if p_ciphertext is null then
    return null;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'id_encryption_key'
  limit 1;

  if v_key is null then
    raise exception 'id encryption key missing from vault' using errcode = '55000';
  end if;

  begin
    v_plain := pgp_sym_decrypt(decode(p_ciphertext, 'base64'), v_key);
  exception when others then
    raise exception 'invalid ciphertext' using errcode = '22023';
  end;

  return v_plain;
end;
$$;

-- encrypt_id is reachable by the app; decrypt_id is not, so plaintext is only ever produced
-- by a security-definer function that has already checked the caller's role.
revoke all on function public.encrypt_id(text) from public, anon, authenticated;
revoke all on function public.decrypt_id(text) from public, anon, authenticated;
grant execute on function public.encrypt_id(text) to authenticated;
