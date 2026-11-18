-- 009_rollback.sql
-- Undo 009_medicine_names.sql. Deletes the medicine list and the names people
-- confirmed by hand. Records and their medicines are not touched.
-- pg_trgm is left installed: other things may use it.

drop function if exists public.check_medicine_names(jsonb, uuid, real);
drop table if exists public.user_medicines;
drop table if exists public.generic_synonyms;
drop table if exists public.medicine_generics;
drop table if exists public.medicine_brands;
drop table if exists public.medicine_products;
