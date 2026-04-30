import type { ClinicType } from './clinicTypes'

export const CLINIC_ID_TO_TYPE: Record<string, ClinicType> = {
  clinic_pediatrics: 'pediatrics',
  clinic_1: 'general',
  clinic_familymedicine: 'family_medicine',
  clinic_behavioral: 'behavioral_health',
}
