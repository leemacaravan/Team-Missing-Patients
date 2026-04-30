-- Assign pediatric patients to clinic_pediatrics
UPDATE patients
SET clinic_id = 'clinic_pediatrics'
WHERE age <= 18;

-- Recalculate urgency labels for pediatric patients using age-appropriate visit frequency norms:
--   age < 1:   Critical >= 120d, High >= 60d, Medium >= 30d
--   age 1-3:   Critical >= 240d, High >= 120d, Medium >= 60d
--   age 4-18:  Critical >= 730d, High >= 365d, Medium >= 180d
UPDATE patients
SET
  urgency_label = CASE
    WHEN age < 1 THEN
      CASE
        WHEN days_overdue >= 120 THEN 'Critical'
        WHEN days_overdue >= 60  THEN 'High'
        WHEN days_overdue >= 30  THEN 'Medium'
        ELSE 'Low'
      END
    WHEN age <= 3 THEN
      CASE
        WHEN days_overdue >= 240 THEN 'Critical'
        WHEN days_overdue >= 120 THEN 'High'
        WHEN days_overdue >= 60  THEN 'Medium'
        ELSE 'Low'
      END
    ELSE
      CASE
        WHEN days_overdue >= 730 THEN 'Critical'
        WHEN days_overdue >= 365 THEN 'High'
        WHEN days_overdue >= 180 THEN 'Medium'
        ELSE 'Low'
      END
  END,
  urgency_score = CASE
    WHEN age < 1 THEN
      CASE
        WHEN days_overdue >= 120 THEN 4 * days_overdue
        WHEN days_overdue >= 60  THEN 3 * days_overdue
        WHEN days_overdue >= 30  THEN 2 * days_overdue
        ELSE days_overdue
      END
    WHEN age <= 3 THEN
      CASE
        WHEN days_overdue >= 240 THEN 4 * days_overdue
        WHEN days_overdue >= 120 THEN 3 * days_overdue
        WHEN days_overdue >= 60  THEN 2 * days_overdue
        ELSE days_overdue
      END
    ELSE
      CASE
        WHEN days_overdue >= 730 THEN 4 * days_overdue
        WHEN days_overdue >= 365 THEN 3 * days_overdue
        WHEN days_overdue >= 180 THEN 2 * days_overdue
        ELSE days_overdue
      END
  END
WHERE clinic_id = 'clinic_pediatrics';
