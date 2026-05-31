INSERT INTO users (id, email, hashed_password) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'test@medivault.dev',
    '$2b$12$KIXejYAuSKyLLpzFbr3zCeV4F9L8DdJhiAm2HJk0ZwGJdRfN1oSWy'
);

INSERT INTO profiles (id, user_id, name, relationship) VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Test User',
    'Self'
);

INSERT INTO profiles (id, user_id, name, relationship, date_of_birth, gender) VALUES (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'Test Father',
    'Father',
    '1960-05-15',
    'Male'
);

INSERT INTO records (
    id, profile_id, document_type, status,
    file_url, doctor_name, hospital_name, document_date,
    specialty, diagnosis, recommendations
) VALUES (
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000010',
    'Prescription',
    'done',
    'https://placeholder.url/file.jpg',
    'Dr. A. Sharma',
    'City General Hospital',
    '2024-11-01',
    'General Medicine',
    'Viral fever',
    'Rest for 3 days. Plenty of fluids.'
);

INSERT INTO medicines (record_id, name, dosage, frequency, duration) VALUES
    ('00000000-0000-0000-0000-000000000100', 'Paracetamol', '500mg', 'Twice daily', '3 days'),
    ('00000000-0000-0000-0000-000000000100', 'Cetirizine', '10mg', 'Once at night', '5 days');

INSERT INTO records (id, profile_id, document_type, status) VALUES (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000010',
    'Lab Report',
    'processing'
);