-- 009_medicine_names.sql
--
-- A list of real medicine names, so the app can tell whether a medicine it read
-- off a page is spelled like a real one. Safe to run more than once; changes no
-- existing data. Undo with 009_rollback.sql.
--
-- WHAT IT ADDS
--   medicine_products  every product from a loaded list (brand, strength, form,
--                      maker), one row per (source, source_code)
--   medicine_brands    one row per brand name, what names are matched against
--   medicine_generics  one row per generic (salt) name, e.g. amoxycillin
--   generic_synonyms   other spellings of a generic: the lists say
--                      "amoxycillin", doctors write "amoxicillin"
--   user_medicines     names a person confirmed by hand, so a name that is in
--                      no list still shows as found the next time
--   check_medicine_names(jsonb, uuid)  green, amber or red for each name, in
--                      one call per document
--
-- The tables start empty except generic_synonyms. Fill them with
-- backend/scripts/load_medicines.py after running this.
--
-- Same lock-down as the rest of the schema: row level security on, nothing
-- granted to anon or authenticated, the function callable only by the
-- backend's service role.

create extension if not exists pg_trgm;
create extension if not exists fuzzystrmatch;   -- levenshtein(): typos, for ranking suggestions

create table if not exists public.medicine_products (
    id            bigserial primary key,
    source        text not null,            -- 'indian_medicine_dataset', later 'cdci'
    source_code   text not null,            -- the id in that list
    name          text not null,            -- as the list writes it: 'Pantocid 40 Tablet'
    name_clean    text not null,            -- 'pantocid 40'
    brand_clean   text not null,            -- 'pantocid'
    generic       text,                     -- 'Pantoprazole (40mg)'
    manufacturer  text,
    pack          text,
    discontinued  boolean not null default false,
    unique (source, source_code)
);
create index if not exists idx_medicine_products_brand on public.medicine_products(brand_clean);

create table if not exists public.medicine_brands (
    brand_clean   text primary key,         -- 'pantocid'
    first_token   text not null,            -- 'pantocid'; 'sinarest' for 'sinarest lp new'
    display       text not null,            -- 'Pantocid'
    generic       text,                     -- the generic of its most common product
    products      int  not null default 0
);
create index if not exists idx_medicine_brands_first on public.medicine_brands(first_token);
create index if not exists idx_medicine_brands_trgm on public.medicine_brands using gin (brand_clean gin_trgm_ops);

create table if not exists public.medicine_generics (
    name_clean    text primary key,         -- 'amoxycillin'
    first_token   text not null,            -- 'cefpodoxime' for 'cefpodoxime proxetil'
    display       text not null,            -- 'Amoxycillin'
    products      int  not null default 0
);
create index if not exists idx_medicine_generics_first on public.medicine_generics(first_token);
create index if not exists idx_medicine_generics_trgm on public.medicine_generics using gin (name_clean gin_trgm_ops);

create table if not exists public.generic_synonyms (
    alias         text primary key,         -- 'amoxicillin'
    canonical     text not null             -- 'amoxycillin', the spelling the list uses
);

create table if not exists public.user_medicines (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references public.users(id) on delete cascade,
    name          text not null,            -- as the person confirmed it
    brand_clean   text not null,
    created_at    timestamp not null default now(),
    unique (user_id, brand_clean)
);

-- Spellings checked against the Indian Medicine Dataset on 18 Nov 2026: the
-- right-hand side is what the list uses, the left is the other common spelling.
insert into public.generic_synonyms (alias, canonical) values
    ('amoxicillin', 'amoxycillin'),
    ('cephalexin', 'cefalexin'),
    ('acetaminophen', 'paracetamol'),
    ('albuterol', 'salbutamol'),
    ('frusemide', 'furosemide'),
    ('lignocaine', 'lidocaine'),
    ('levothyroxine', 'thyroxine'),
    ('dicycloverine', 'dicyclomine'),
    ('glyburide', 'glibenclamide'),
    ('epinephrine', 'adrenaline'),
    ('cholecalciferol', 'vitamin d3'),
    ('mecobalamin', 'methylcobalamin'),
    ('sulphamethoxazole', 'sulfamethoxazole'),
    ('aluminum hydroxide', 'aluminium hydroxide'),
    ('rifampin', 'rifampicin'),
    ('cyclosporine', 'ciclosporin'),
    ('oestradiol', 'estradiol'),
    ('phenobarbital', 'phenobarbitone'),
    ('isoproterenol', 'isoprenaline'),
    ('noradrenaline', 'norepinephrine'),
    ('meperidine', 'pethidine'),
    ('beclomethasone', 'beclometasone'),
    ('cromolyn', 'sodium cromoglycate')
on conflict (alias) do nothing;

-- p_items: one object per medicine, already cleaned by the backend
-- (app/services/medicine_names.py), in the order they appear on the page:
--   {"brand": "pantocid", "first": "pantocid", "generics": ["pantoprazole"]}
-- Returns one row per item, same order (idx starts at 1).
--   green  the brand, a generic, or a name this person confirmed is known
--   amber  not known, but a known brand or generic is close (score >= p_amber)
--   red    nothing close
-- suggestions: up to 3 {name, generic, score, distance}, best first, for amber
-- and red. Best first means fewest typos (levenshtein distance), then highest
-- trigram similarity: for 'pantocd', Pantocid (1 typo) comes before Panto.
-- A name one typo from a known name (two typos from 8 letters up) is amber
-- even when its similarity is below p_amber.
create or replace function public.check_medicine_names(
    p_items jsonb, p_user_id uuid, p_amber real default 0.5
) returns table (idx int, status text, matched text, generic text, score real, suggestions jsonb)
language plpgsql stable
set search_path = public
as $$
declare
    item   jsonb;
    i      int := 0;
    v_brand text;
    v_first text;
    v_gens  text[];
    v_hit   record;
    v_all   boolean;
    v_g     text;
begin
    for item in select * from jsonb_array_elements(p_items) loop
        i := i + 1;
        v_brand := coalesce(item->>'brand', '');
        v_first := coalesce(item->>'first', '');
        v_gens  := coalesce(array(select jsonb_array_elements_text(item->'generics')), '{}');
        idx := i; status := null; matched := null; generic := null; score := null; suggestions := '[]'::jsonb;

        if v_brand = '' then
            status := 'red';
            return next; continue;
        end if;

        -- 1. The brand exactly.
        select b.display, b.generic into v_hit from medicine_brands b where b.brand_clean = v_brand;
        if found then
            status := 'green'; matched := v_hit.display; generic := v_hit.generic; score := 1;
            return next; continue;
        end if;

        -- 2. Written as a generic ('Amoxicillin 500', 'Paracetamol + Caffeine').
        if array_length(v_gens, 1) > 0 then
            v_all := true;
            foreach v_g in array v_gens loop
                v_g := coalesce((select s.canonical from generic_synonyms s where s.alias = v_g), v_g);
                if not exists (select 1 from medicine_generics g
                                where g.name_clean = v_g
                                   or (length(v_g) >= 5 and g.first_token = v_g)) then
                    v_all := false; exit;
                end if;
            end loop;
            if v_all then
                status := 'green'; matched := null; score := 1;
                generic := array_to_string(v_gens, ' + ');
                return next; continue;
            end if;
        end if;

        -- 3. Its first word is a brand on its own ('sinarest' for 'Sinarest LP New').
        --    Checked after generics, or 'vitamin d3' would match a brand that starts
        --    with 'vitamin'. Short words ('t', 'd3') are too ambiguous to count.
        if length(v_first) >= 4 then
            select b.display, b.generic into v_hit from medicine_brands b
             where b.first_token = v_first order by b.products desc limit 1;
            if found then
                status := 'green'; matched := v_hit.display; generic := v_hit.generic; score := 1;
                return next; continue;
            end if;
        end if;

        -- 4. A name this person confirmed before.
        if p_user_id is not null then
            select u.name into v_hit from user_medicines u
             where u.user_id = p_user_id and u.brand_clean = v_brand;
            if found then
                status := 'green'; matched := v_hit.name; score := 1;
                return next; continue;
            end if;
        end if;

        -- 5. Not known: the closest brands and generics.
        -- (Column aliases differ from the output names on purpose: inside
        -- plpgsql a bare "score" or "generic" would mean the output variable.)
        select coalesce(jsonb_agg(jsonb_build_object('name', s.nm, 'generic', s.gen,
                                                     'score', s.sc, 'distance', s.dist)
                                  order by s.dist, s.sc desc), '[]'::jsonb) into suggestions
          from (
            select * from (
                select b.display as nm, b.generic as gen, similarity(b.brand_clean, v_brand)::real as sc,
                       levenshtein(left(b.brand_clean, 255), left(v_brand, 255)) as dist
                  from medicine_brands b
                 where b.brand_clean % v_brand
                 order by sc desc, b.products desc
                 limit 20
            ) brands
            union all
            select * from (
                select g.display as nm, null::text as gen, similarity(g.name_clean, v_brand)::real as sc,
                       levenshtein(left(g.name_clean, 255), left(v_brand, 255)) as dist
                  from medicine_generics g
                 where g.name_clean % v_brand
                 order by sc desc, g.products desc
                 limit 5
            ) generics
            order by dist, sc desc
            limit 3
          ) s;

        score := coalesce((suggestions->0->>'score')::real, 0);
        -- Names under 4 letters ('liv') are never amber: three letters are
        -- close to too many different medicines to suggest one.
        status := case
            when length(v_brand) < 4 then 'red'
            when score >= p_amber then 'amber'
            when (suggestions->0->>'distance')::int <= case when length(v_brand) >= 8 then 2 else 1 end then 'amber'
            else 'red'
        end;
        return next;
    end loop;
end;
$$;

alter table public.medicine_products enable row level security;
alter table public.medicine_brands   enable row level security;
alter table public.medicine_generics enable row level security;
alter table public.generic_synonyms  enable row level security;
alter table public.user_medicines    enable row level security;
revoke all on public.medicine_products from anon, authenticated;
revoke all on public.medicine_brands   from anon, authenticated;
revoke all on public.medicine_generics from anon, authenticated;
revoke all on public.generic_synonyms  from anon, authenticated;
revoke all on public.user_medicines    from anon, authenticated;

revoke execute on function public.check_medicine_names(jsonb, uuid, real) from public, anon, authenticated;
grant execute on function public.check_medicine_names(jsonb, uuid, real) to service_role;
