CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email            VARCHAR(255) NOT NULL UNIQUE,
    hashed_password  TEXT         NOT NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    relationship  VARCHAR(50)  NOT NULL,
    date_of_birth DATE,
    gender        VARCHAR(20),
    created_at    TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE records (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_type   VARCHAR(50)  NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'processing',
    file_url        TEXT,
    file_path       TEXT,
    raw_ocr_text    TEXT,
    doctor_name     VARCHAR(200),
    hospital_name   VARCHAR(200),
    document_date   DATE,
    specialty       VARCHAR(100),
    diagnosis       TEXT,
    recommendations TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE medicines (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id   UUID         NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    dosage      VARCHAR(100),
    frequency   VARCHAR(100),
    duration    VARCHAR(100)
);

CREATE TABLE record_edits (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id   UUID         NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_name  VARCHAR(100) NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    edited_at   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_user_id      ON profiles(user_id);
CREATE INDEX idx_records_profile_id    ON records(profile_id);
CREATE INDEX idx_records_status        ON records(status);
CREATE INDEX idx_records_doctor_name   ON records(doctor_name);
CREATE INDEX idx_records_document_date ON records(document_date);
CREATE INDEX idx_medicines_record_id   ON medicines(record_id);