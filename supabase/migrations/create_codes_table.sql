-- Create codes table for ICD-10 diagnosis codes per clinic type
CREATE TABLE IF NOT EXISTS codes (
  id         SERIAL PRIMARY KEY,
  clinic_type TEXT NOT NULL,
  code        TEXT NOT NULL,
  label       TEXT NOT NULL,
  UNIQUE (clinic_type, code)
);

-- Pediatrics codes
INSERT INTO codes (clinic_type, code, label) VALUES
  ('pediatrics', 'Z00.110', 'Newborn Exam (under 8 days)'),
  ('pediatrics', 'Z00.111', 'Newborn Exam (8–28 days)'),
  ('pediatrics', 'Z00.129', 'Routine Child Exam'),
  ('pediatrics', 'Z23',     'Immunization Visit'),
  ('pediatrics', 'Z13.4',   'Developmental Screening'),
  ('pediatrics', 'J06.9',   'Upper Respiratory Infection'),
  ('pediatrics', 'H66.90',  'Ear Infection'),
  ('pediatrics', 'R50.9',   'Fever'),
  ('pediatrics', 'J45.909', 'Asthma'),
  ('pediatrics', 'F90.9',   'ADHD')
ON CONFLICT (clinic_type, code) DO NOTHING;

-- Family Medicine codes
INSERT INTO codes (clinic_type, code, label) VALUES
  ('family_medicine', 'I10',    'Hypertension'),
  ('family_medicine', 'E11.9',  'Type 2 Diabetes'),
  ('family_medicine', 'Z00.00', 'Annual Wellness Exam'),
  ('family_medicine', 'J06.9',  'Upper Respiratory Infection'),
  ('family_medicine', 'M54.5',  'Back Pain'),
  ('family_medicine', 'J30.9',  'Allergic Rhinitis'),
  ('family_medicine', 'Z34.12', 'Prenatal Care')
ON CONFLICT (clinic_type, code) DO NOTHING;

-- Behavioral Health codes
INSERT INTO codes (clinic_type, code, label) VALUES
  ('behavioral_health', 'F32.9',   'Major Depression'),
  ('behavioral_health', 'F41.1',   'Generalized Anxiety'),
  ('behavioral_health', 'F43.10',  'PTSD'),
  ('behavioral_health', 'F20.9',   'Schizophrenia'),
  ('behavioral_health', 'F31.9',   'Bipolar Disorder'),
  ('behavioral_health', 'R45.851', 'Suicidal Ideation'),
  ('behavioral_health', 'F90.9',   'ADHD'),
  ('behavioral_health', 'F10.20',  'Alcohol Use Disorder')
ON CONFLICT (clinic_type, code) DO NOTHING;

-- General codes
INSERT INTO codes (clinic_type, code, label) VALUES
  ('general', 'Z00.00', 'Annual Wellness Exam'),
  ('general', 'I10',    'Hypertension'),
  ('general', 'E11.9',  'Type 2 Diabetes'),
  ('general', 'J06.9',  'Upper Respiratory Infection'),
  ('general', 'J30.9',  'Allergic Rhinitis')
ON CONFLICT (clinic_type, code) DO NOTHING;
