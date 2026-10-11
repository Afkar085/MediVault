#!/usr/bin/env bash
# Apply every migration to a throwaway Postgres (with pgvector) and check the
# result. Uses NO real data and never connects to Supabase.
#
#   Requires Docker running. From the repository root:
#     bash backend/scripts/verify_migrations.sh
#
# Steps: start pgvector/pgvector:pg16 -> create the Supabase roles the
# migrations grant/revoke on -> load the schema as it was BEFORE this branch
# (git HEAD) -> apply 001..005 in order -> apply 005 a second time (must be a
# no-op) -> print the columns and indexes 005 is meant to create -> remove the
# container.
set -euo pipefail

NAME=medivault-migration-check
IMAGE=pgvector/pgvector:pg16
DIR="$(cd "$(dirname "$0")/../database" && pwd)"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=check -e POSTGRES_DB=medivault "$IMAGE" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$NAME" pg_isready -U postgres -d medivault >/dev/null 2>&1 && break
  sleep 1
done

psql() { docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -d medivault -q "$@"; }

echo "-> roles"
psql -c "CREATE ROLE anon; CREATE ROLE authenticated;"

echo "-> schema before this branch (git HEAD)"
git show HEAD:backend/database/schema.sql | psql

for f in 001_semantic_search 002_security_advisor_fixes 003_private_document_urls 004_document_passages \
         005_bill_details_and_upload_dedup 005_bill_details_and_upload_dedup; do
  echo "-> $f.sql"
  psql < "$DIR/$f.sql"
done

echo "-> result"
psql -c "\d records" | grep -E "bill_(title|category|number)"
psql -c "\di" | grep -E "uq_record_files_file_path|idx_records_profile_status_updated|idx_record_files_file_path"
echo "OK: all migrations applied, and 005 is idempotent."
