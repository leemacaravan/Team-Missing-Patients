'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { CLINICS, type ClinicType } from '@/lib/clinic'

type ClinicContextValue = {
  clinicId: string | null
  clinicName: string
  clinicEmoji: string
  clinicType: ClinicType | null
  loading: boolean
}

const ClinicContext = createContext<ClinicContextValue>({
  clinicId: null,
  clinicName: '',
  clinicEmoji: '',
  clinicType: null,
  loading: true,
})

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<ClinicContextValue>({
    clinicId: null,
    clinicName: '',
    clinicEmoji: '',
    clinicType: null,
    loading: true,
  })

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        const clinicId = (d.user?.clinicId as string | null) ?? null
        const config = clinicId ? CLINICS[clinicId] : null
        setValue({
          clinicId,
          clinicName: config?.name ?? '',
          clinicEmoji: config?.emoji ?? '',
          clinicType: config?.type ?? null,
          loading: false,
        })
      })
      .catch(() => setValue((v) => ({ ...v, loading: false })))
  }, [])

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic() {
  return useContext(ClinicContext)
}
