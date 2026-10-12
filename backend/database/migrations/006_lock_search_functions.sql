-- 006_lock_search_functions.sql
--
-- Defence in depth for the two vector-search functions. Safe to run more than
-- once; changes no data.
--
-- PostgREST exposes every function in the public schema as /rest/v1/rpc/<name>,
-- and Postgres grants EXECUTE on new functions to PUBLIC. Both functions run
-- with the caller's rights, so with deny-all RLS (002, 004) an anon caller
-- already gets nothing back. This removes the entry point as well: only the
-- backend's service role, which bypasses RLS anyway, may call them.
--
-- The backend is unaffected: it uses the service_role key.

revoke execute on function public.match_records(vector, uuid[], int, float) from public, anon, authenticated;
revoke execute on function public.match_chunks(vector, uuid[], int, float) from public, anon, authenticated;
grant execute on function public.match_records(vector, uuid[], int, float) to service_role;
grant execute on function public.match_chunks(vector, uuid[], int, float) to service_role;
