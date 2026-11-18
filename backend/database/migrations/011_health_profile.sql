-- 011_health_profile.sql
--
-- What a doctor asks first, kept with each family member: allergies, ongoing
-- conditions (sugar, BP, heart and so on) and medicines taken every day. Asked
-- when a member is added or edited, all of it optional. No birthday.
-- Safe to run more than once; changes no existing data. Undo with 011_rollback.sql.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS allergies TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS conditions TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS long_term_medicines JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS blood_group TEXT;

COMMENT ON COLUMN public.profiles.allergies IS 'What this person is allergic to, as they wrote it.';
COMMENT ON COLUMN public.profiles.conditions IS 'Ongoing conditions, e.g. Sugar (diabetes), BP, Heart disease.';
COMMENT ON COLUMN public.profiles.long_term_medicines IS
    'Medicines taken every day: [{name, dosage, frequency, for_what}]. Listed under Taking now until removed.';
