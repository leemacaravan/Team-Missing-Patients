export type ClinicType = 'pediatrics' | 'family_medicine' | 'behavioral_health' | 'general'

export type DashboardStatQuery =
  | 'total'
  | 'overdue'
  | 'critical'
  | 'contacted'
  | 'under2overdue'
  | 'chronic_overdue'
  | 'crisis_patients'
  | 'missed_session'

export interface ClinicTypeConfig {
  clinicType: ClinicType
  displayName: string
  emoji: string
  overdueRules: { label: string; maxAgeDays: number; intervalDays: number }[]
  dashboardStats: { key: string; label: string; query: DashboardStatQuery; color?: string }[]
  relevantIcdCodes: Record<string, string>
  visitScheduleGuidance: { condition: (patientAgeMonths: number) => boolean; message: string }[]
  aiScriptInstructions: string
  addressMode: 'patient' | 'guardian'
  encounterGrouping: 'by_date' | 'by_month' | 'by_type'
  flags: {
    showAgeInMonths: boolean
    showChronicConditionBadges: boolean
    showCrisisWarning: boolean
    collapseRepeatedEncounters: boolean
  }
}

export const CLINIC_TYPE_CONFIGS: Record<ClinicType, ClinicTypeConfig> = {
  pediatrics: {
    clinicType: 'pediatrics',
    displayName: 'Riverside Pediatric Clinic',
    emoji: '🧸',
    overdueRules: [
      { label: 'Newborn (≤28 days)', maxAgeDays: 28, intervalDays: 14 },
      { label: 'Infant (1–6 mos)', maxAgeDays: 180, intervalDays: 30 },
      { label: 'Infant (6–12 mos)', maxAgeDays: 365, intervalDays: 60 },
      { label: 'Toddler (1–2 yrs)', maxAgeDays: 730, intervalDays: 90 },
      { label: 'Child (2–5 yrs)', maxAgeDays: 1825, intervalDays: 180 },
      { label: 'School age & teen', maxAgeDays: Infinity, intervalDays: 365 },
    ],
    dashboardStats: [
      { key: 'total', label: 'Total pediatric patients', query: 'total' },
      { key: 'overdue', label: 'Pediatric patients overdue', query: 'overdue', color: 'text-[#B45309]' },
      { key: 'under2overdue', label: 'Under 2 years overdue', query: 'under2overdue', color: 'text-[#B45309]' },
      { key: 'critical', label: 'Critical', query: 'critical', color: 'text-[#B91C1C]' },
      { key: 'contacted', label: 'Total contacted', query: 'contacted', color: 'text-[#0F766E]' },
    ],
    relevantIcdCodes: {
      'Z00.110': 'Newborn Exam (under 8 days)',
      'Z00.111': 'Newborn Exam (8–28 days)',
      'Z00.129': 'Routine Child Exam',
      'Z23': 'Immunization Visit',
      'Z13.4': 'Developmental Screening',
      'J06.9': 'Upper Respiratory Infection',
      'H66.90': 'Ear Infection',
      'R50.9': 'Fever',
      'J45.909': 'Asthma',
      'F90.9': 'ADHD',
    },
    visitScheduleGuidance: [
      { condition: (m) => m < 1, message: 'Newborn visit within first 2 weeks required' },
      { condition: (m) => m < 2, message: 'Should be seen every 2–4 weeks' },
      { condition: (m) => m < 6, message: 'Should be seen every 1–2 months' },
      { condition: (m) => m < 12, message: 'Should be seen every 2–3 months' },
      { condition: (m) => m < 24, message: 'Should be seen every 3–6 months' },
      { condition: (m) => m < 60, message: 'Annual well-child visit required' },
      { condition: () => true, message: 'Annual well visit required' },
    ],
    aiScriptInstructions:
      'Address the parent or guardian. Mention the child by first name. Emphasize the importance of well-child visits for development and vaccinations. Be warm and family-centered.',
    addressMode: 'guardian',
    encounterGrouping: 'by_date',
    flags: {
      showAgeInMonths: true,
      showChronicConditionBadges: false,
      showCrisisWarning: false,
      collapseRepeatedEncounters: false,
    },
  },

  family_medicine: {
    clinicType: 'family_medicine',
    displayName: 'Family Medicine Clinic',
    emoji: '🏥',
    overdueRules: [
      { label: 'Chronic condition patients', maxAgeDays: 180, intervalDays: 90 },
      { label: 'Annual wellness', maxAgeDays: Infinity, intervalDays: 365 },
    ],
    dashboardStats: [
      { key: 'total', label: 'Total active patients', query: 'total' },
      { key: 'overdue', label: 'Overdue for well visit', query: 'overdue', color: 'text-[#B45309]' },
      { key: 'chronic_overdue', label: 'Chronic condition overdue', query: 'chronic_overdue', color: 'text-[#B45309]' },
      { key: 'contacted', label: 'Total contacted', query: 'contacted', color: 'text-[#0F766E]' },
    ],
    relevantIcdCodes: {
      'I10': 'Hypertension',
      'E11.9': 'Type 2 Diabetes',
      'Z00.00': 'Annual Wellness Exam',
      'J06.9': 'Upper Respiratory Infection',
      'M54.5': 'Back Pain',
      'J30.9': 'Allergic Rhinitis',
      'Z34.12': 'Prenatal Care',
    },
    visitScheduleGuidance: [
      { condition: () => true, message: 'Annual wellness visit recommended' },
    ],
    aiScriptInstructions:
      'Address the patient directly. Reference their ongoing care relationship with the clinic. Emphasize the value of preventive care and chronic disease management.',
    addressMode: 'patient',
    encounterGrouping: 'by_type',
    flags: {
      showAgeInMonths: false,
      showChronicConditionBadges: true,
      showCrisisWarning: false,
      collapseRepeatedEncounters: false,
    },
  },

  behavioral_health: {
    clinicType: 'behavioral_health',
    displayName: 'Behavioral Health Clinic',
    emoji: '🧠',
    overdueRules: [
      { label: 'Therapy sessions', maxAgeDays: Infinity, intervalDays: 30 },
    ],
    dashboardStats: [
      { key: 'total', label: 'Total active patients', query: 'total' },
      { key: 'overdue', label: 'Overdue for session', query: 'overdue', color: 'text-[#B45309]' },
      { key: 'missed_session', label: 'Missed sessions', query: 'missed_session', color: 'text-[#B45309]' },
      { key: 'crisis_patients', label: 'Crisis patients', query: 'crisis_patients', color: 'text-[#B91C1C]' },
      { key: 'contacted', label: 'Total contacted', query: 'contacted', color: 'text-[#0F766E]' },
    ],
    relevantIcdCodes: {
      'F32.9': 'Major Depression',
      'F41.1': 'Generalized Anxiety',
      'F43.10': 'PTSD',
      'F20.9': 'Schizophrenia',
      'F31.9': 'Bipolar Disorder',
      'R45.851': 'Suicidal Ideation',
      'F90.9': 'ADHD',
      'F10.20': 'Alcohol Use Disorder',
    },
    visitScheduleGuidance: [
      {
        condition: () => true,
        message: 'Regular therapy sessions recommended — contact if more than 30 days since last visit',
      },
    ],
    aiScriptInstructions:
      'Use a calm, non-judgmental tone. Do not mention specific diagnoses. Emphasize the clinic cares about their wellbeing and wants to reconnect. If the patient seems in crisis, provide the 988 Suicide & Crisis Lifeline.',
    addressMode: 'patient',
    encounterGrouping: 'by_month',
    flags: {
      showAgeInMonths: false,
      showChronicConditionBadges: false,
      showCrisisWarning: true,
      collapseRepeatedEncounters: true,
    },
  },

  general: {
    clinicType: 'general',
    displayName: 'General Demo Clinic',
    emoji: '🏥',
    overdueRules: [
      { label: 'Annual wellness', maxAgeDays: Infinity, intervalDays: 365 },
    ],
    dashboardStats: [
      { key: 'total', label: 'Total active patients', query: 'total' },
      { key: 'overdue', label: 'Overdue for well visit', query: 'overdue', color: 'text-[#B45309]' },
      { key: 'critical', label: 'Critical', query: 'critical', color: 'text-[#B91C1C]' },
      { key: 'contacted', label: 'Total contacted', query: 'contacted', color: 'text-[#0F766E]' },
    ],
    relevantIcdCodes: {
      'Z00.00': 'Annual Wellness Exam',
      'I10': 'Hypertension',
      'E11.9': 'Type 2 Diabetes',
      'J06.9': 'Upper Respiratory Infection',
      'J30.9': 'Allergic Rhinitis',
    },
    visitScheduleGuidance: [
      { condition: () => true, message: 'Annual well visit recommended' },
    ],
    aiScriptInstructions:
      'Address the patient directly. Be professional and warm. Emphasize the importance of staying current with preventive care.',
    addressMode: 'patient',
    encounterGrouping: 'by_date',
    flags: {
      showAgeInMonths: false,
      showChronicConditionBadges: false,
      showCrisisWarning: false,
      collapseRepeatedEncounters: false,
    },
  },
}
