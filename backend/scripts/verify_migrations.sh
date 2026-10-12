#!/usr/bin/env bash
# Apply every migration to a throwaway Postgres (with pgvector) and check the
# result. Uses NO real data and never connects to Supabase.
#
#   Requires Docker running. From the repository root:
#     bash backend/scripts/verify_migrations.sh
#
# Two databases:
#   upgrade: the schema as it was at the first commit that had migrations, then
#            001..006 in order, then 005 and 006 again (each must be a no-op).
#   fresh:   today's schema.sql on its own, as a new install would run it.
# Both are then checked for what the migrations are meant to guarantee: the
# bill columns and indexes from 005, deny-all RLS on every table, and no
# EXECUTE on the search functions for the public roles. The container is
# removed at the end either way.
set -euo pipefail

NAME=medivault-migration-check
IMAGE=pgvector/pgvector:pg16
DB_DIR="$(cd "$(dirname "$0")/../database" && pwd)"
MIGRATIONS="$DB_DIR/migrations"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=check -e POSTGRES_DB=postgres "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
sleep 2

psql_on() { local db="$1"; shift; docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -q "$@"; }

echo "-> roles (as Supabase has them)"
psql_on postgres -c "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;"
psql_on postgres -c "CREATE DATABASE upgrade;"
psql_on postgres -c "CREATE DATABASE fresh;"

check() {
  local db="$1"
  echo "-> checks on $db"
  psql_on "$db" -c "\d records" | grep -E "bill_(title|category|number)" >/dev/null || { echo "FAIL $db: bill columns"; exit 1; }
  local open
  open=$(psql_on "$db" -At -c "SELECT string_agg(relname, ',') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;")
  [ -z "$open" ] || { echo "FAIL $db: tables without RLS: $open"; exit 1; }
  local granted
  granted=$(psql_on "$db" -At -c "SELECT string_agg(table_name || ':' || grantee, ',') FROM information_schema.role_table_grants
                                   WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');")
  [ -z "$granted" ] || { echo "FAIL $db: table grants left for public roles: $granted"; exit 1; }
  for fn in match_records; do
    for role in anon authenticated; do
      [ "$(psql_on "$db" -At -c "SELECT has_function_privilege('$role', 'public.$fn(vector, uuid[], int, float)', 'EXECUTE');")" = "f" ] \
        || { echo "FAIL $db: $role may execute $fn"; exit 1; }
    done
  done
  echo "   OK: RLS on every table, no public grants, search functions locked"
}

echo "-> upgrade path: original schema, then every migration"
FIRST=$(git log --diff-filter=A --format=%H -- backend/database/migrations/001_semantic_search.sql | tail -1)
git show "$FIRST:backend/database/schema.sql" | psql_on upgrade
for f in 001_semantic_search 002_security_advisor_fixes 003_private_document_urls 004_document_passages \
         005_bill_details_and_upload_dedup 006_lock_search_functions \
         005_bill_details_and_upload_dedup 006_lock_search_functions; do
  echo "   $f.sql"
  psql_on upgrade < "$MIGRATIONS/$f.sql"
done
check upgrade
for role in anon authenticated; do
  [ "$(psql_on upgrade -At -c "SELECT has_function_privilege('$role', 'public.match_chunks(vector, uuid[], int, float)', 'EXECUTE');")" = "f" ] \
    || { echo "FAIL upgrade: $role may execute match_chunks"; exit 1; }
done
[ "$(psql_on upgrade -At -c "SELECT has_function_privilege('service_role', 'public.match_chunks(vector, uuid[], int, float)', 'EXECUTE');")" = "t" ] \
  || { echo "FAIL upgrade: the backend's role lost match_chunks"; exit 1; }

echo "-> fresh install: schema.sql alone"
psql_on fresh < "$DB_DIR/schema.sql"
check fresh

echo "OK: every migration applies, 005 and 006 are idempotent, and both paths end locked down."
