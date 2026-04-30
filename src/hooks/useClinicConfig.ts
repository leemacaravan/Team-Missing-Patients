import { useClinic } from '@/context/ClinicContext'
import { CLINIC_TYPE_CONFIGS, type ClinicTypeConfig } from '@/config/clinicTypes'
import { CLINIC_ID_TO_TYPE } from '@/config/clinicMap'

export function useClinicConfig(): ClinicTypeConfig {
  const { clinicId } = useClinic()
  if (!clinicId) return CLINIC_TYPE_CONFIGS.general
  const clinicType = CLINIC_ID_TO_TYPE[clinicId]
  if (!clinicType) return CLINIC_TYPE_CONFIGS.general
  return CLINIC_TYPE_CONFIGS[clinicType]
}
