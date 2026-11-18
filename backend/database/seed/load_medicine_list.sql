-- Load the medicine list into the tables from migration 009, straight from
-- GitHub, inside the Supabase SQL editor. No keys or local setup needed.
-- Run 009_medicine_names.sql first. Safe to run again (rows are updated).
--
-- The two .tsv files next to this one were made by
-- backend/scripts/load_medicines.py --to-csv from the Indian Medicine Dataset
-- (github.com/junioralive/Indian-Medicine-Dataset, MIT licence), so names are
-- cleaned exactly the way the backend cleans what it reads off a page.
-- They live on the medicine-seed branch to keep 11 MB of data out of main.

create extension if not exists http with schema extensions;
select extensions.http_set_curlopt('CURLOPT_TIMEOUT', '120');

with r as (
    select content from extensions.http_get(
        'https://raw.githubusercontent.com/Afkar085/MediVault/medicine-seed/backend/database/seed/medicine_brands.tsv')
)
insert into public.medicine_brands (brand_clean, first_token, display, generic, products)
select f[1], f[2], f[3], nullif(f[4], ''), f[5]::int
from r, lateral (select string_to_array(line, E'\t') as f
                 from regexp_split_to_table(rtrim(r.content, E'\n'), E'\n') as line) x
on conflict (brand_clean) do update
    set first_token = excluded.first_token, display = excluded.display,
        generic = excluded.generic, products = excluded.products;

with r as (
    select content from extensions.http_get(
        'https://raw.githubusercontent.com/Afkar085/MediVault/medicine-seed/backend/database/seed/medicine_generics.tsv')
)
insert into public.medicine_generics (name_clean, first_token, display, products)
select f[1], f[2], f[3], f[4]::int
from r, lateral (select string_to_array(line, E'\t') as f
                 from regexp_split_to_table(rtrim(r.content, E'\n'), E'\n') as line) x
on conflict (name_clean) do update
    set first_token = excluded.first_token, display = excluded.display, products = excluded.products;

-- Expect about 183,941 and 1,707.
select (select count(*) from public.medicine_brands) as brands,
       (select count(*) from public.medicine_generics) as generics;
