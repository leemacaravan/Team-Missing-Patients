'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useClinic } from '@/context/ClinicContext'
import { useClinicConfig } from '@/hooks/useClinicConfig'
import { DIAGNOSIS_CODES } from '@/config/diagnosisCodes'

const LANGUAGES = ['English', 'Spanish', 'French', 'Portuguese', 'Mandarin', 'Cantonese', 'Vietnamese', 'Arabic', 'Haitian Creole', 'Other']

const VISIT_TYPES = [
  'Well Child',
  'Well Visit',
  'Office Visit',
  'Sick Visit',
  'Follow-up Visit',
  'Immunization Visit',
  'Developmental Screening',
  'Vision Screening',
  'Behavioral Screening',
  'Sports Physical',
  'Prenatal Visit',
  'Mental Health Visit',
  'Crisis Visit',
]

type CodeRow = {
  id: string
  code: string
  description: string
  careCategory: string
  visitType: string
  clinicTypes: string[]
}

const FALLBACK_CODES: CodeRow[] = Object.entries(DIAGNOSIS_CODES).map(([code, meta]) => ({
  id: code,
  code,
  description: meta.description,
  careCategory: meta.careCategory,
  visitType: meta.visitType,
  clinicTypes: meta.clinicTypes,
}))

function urgencyFromDays(days: number): { label: string; score: number } {
  if (days >= 180) return { label: 'Critical', score: 4 }
  if (days >= 90) return { label: 'High', score: 3 }
  if (days >= 30) return { label: 'Medium', score: 2 }
  return { label: 'Low', score: 1 }
}

export default function NewPatientPage() {
  const router = useRouter()
  const { clinicId, clinicType } = useClinic()
  const clinicConfig = useClinicConfig()
  const [checkedRole, setCheckedRole] = useState(false)
  const [tab, setTab] = useState<'patient' | 'encounter'>('patient')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [patient, setPatient] = useState({
    patient_identifier: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    sex: '',
    home_phone: '',
    mobile_phone: '',
    email_address: '',
    preferred_language: 'English',
  })

  const [encounter, setEncounter] = useState({
    encounter_date: new Date().toISOString().slice(0, 10),
    visit_type: '',
    icd_code: '',
    care_category: '',
    diagnosis_code_id: '',
    notes: '',
  })

  const [addEncounter, setAddEncounter] = useState(false)

  // Code combobox
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [codesLoading, setCodesLoading] = useState(true)
  const [codeQuery, setCodeQuery] = useState('')
  const [showCodeDrop, setShowCodeDrop] = useState(false)
  const codeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.user?.role !== 'admin') router.replace('/all-patients')
      setCheckedRole(true)
    })
  }, [router])

  useEffect(() => {
    setCodesLoading(true)
    supabase
      .from('codes')
      .select('id,code,description')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const merged: CodeRow[] = (data as { id: string; code: string; description: string }[]).map((row) => {
            const meta = DIAGNOSIS_CODES[row.code]
            return {
              id: row.id,
              code: row.code,
              description: row.description,
              careCategory: meta?.careCategory ?? 'General',
              visitType: meta?.visitType ?? 'Office Visit',
              clinicTypes: meta?.clinicTypes ?? ['general'],
            }
          })
          setCodes(merged)
        } else {
          setCodes(FALLBACK_CODES)
        }
        setCodesLoading(false)
      })
  }, [])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (codeRef.current && !codeRef.current.contains(e.target as Node)) {
        setShowCodeDrop(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filteredCodes = useMemo(() => {
    return codes.filter((c) => {
      const matchesClinic = !clinicType || c.clinicTypes.includes(clinicType)
      if (!codeQuery.trim()) return matchesClinic
      const q = codeQuery.toLowerCase()
      return matchesClinic && (c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    })
  }, [codes, codeQuery, clinicType])

  const groupedCodes = useMemo(() => {
    return filteredCodes.reduce<Record<string, CodeRow[]>>((acc, c) => {
      if (!acc[c.careCategory]) acc[c.careCategory] = []
      acc[c.careCategory].push(c)
      return acc
    }, {})
  }, [filteredCodes])

  function selectCode(c: CodeRow) {
    setEncounter((prev) => ({
      ...prev,
      icd_code: c.code,
      care_category: c.careCategory,
      visit_type: c.visitType,
      diagnosis_code_id: c.id,
    }))
    setCodeQuery(`${c.code} — ${c.description}`)
    setShowCodeDrop(false)
  }

  if (!checkedRole) return null

  function dobAgePreview(dob: string): string {
    if (!dob) return ''
    const d = new Date(dob + 'T00:00:00')
    if (isNaN(d.getTime())) return ''
    const today = new Date()
    const months = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth())
    if (months < 0) return ''
    if (months < 24) return `Age: ${months} month${months !== 1 ? 's' : ''}`
    return `Age: ${Math.floor(months / 12)} year${Math.floor(months / 12) !== 1 ? 's' : ''}`
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!patient.first_name.trim() || !patient.last_name.trim() || !patient.date_of_birth) {
      setToast('First name, last name, and date of birth are required.')
      return
    }

    setSaving(true)
    setToast(null)

    const ageDays = patient.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (1000 * 60 * 60 * 24))
      : 0
    const ageYears = Math.floor(ageDays / 365.25)

    let intervalDays = 365
    for (const rule of clinicConfig.overdueRules) {
      if (ageDays <= rule.maxAgeDays) { intervalDays = rule.intervalDays; break }
    }
    const daysOverdue = addEncounter && encounter.encounter_date ? 0 : intervalDays
    const { label: urgencyLabel, score: urgencyScore } = urgencyFromDays(daysOverdue)

    const patientId = patient.patient_identifier || `PT-${Date.now()}`

    const patientPayload = {
      patient_identifier: patientId,
      first_name: patient.first_name.trim(),
      last_name: patient.last_name.trim(),
      age: ageYears,
      date_of_birth: patient.date_of_birth || null,
      sex: patient.sex || null,
      home_phone: patient.home_phone || null,
      mobile_phone: patient.mobile_phone || null,
      email_address: patient.email_address || null,
      preferred_language: patient.preferred_language,
      active: 'Yes',
      outreach_status: 'pending',
      urgency_label: urgencyLabel,
      urgency_score: urgencyScore,
      days_overdue: daysOverdue,
      clinic_id: clinicId,
      most_recent_visit_date: addEncounter && encounter.encounter_date ? encounter.encounter_date : null,
    }

    const patientRes = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientPayload),
    })
    if (!patientRes.ok) {
      const d = await patientRes.json()
      setToast(`Error: ${d.error ?? 'Failed to add patient'}`)
      setSaving(false)
      return
    }

    if (addEncounter && encounter.encounter_date) {
      await fetch('/api/encounters/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounters: [{
            patient_record_number: patientId,
            encounter_date: encounter.encounter_date,
            visit_type: encounter.visit_type || 'Office Visit',
            diagnosis: encounter.icd_code || null,
            care_category: encounter.care_category || 'General',
            diagnosis_code_id: encounter.diagnosis_code_id || null,
            notes: encounter.notes || null,
            showed_up: true,
          }],
        }),
      })
    }

    setSaving(false)
    setToast(`Patient ${patient.first_name} ${patient.last_name} added successfully.`)
    setTimeout(() => router.replace('/all-patients'), 1500)
  }

  function setP(field: string, value: string) {
    setPatient((prev) => ({ ...prev, [field]: value }))
  }

  function setE(field: string, value: string) {
    setEncounter((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30">
      <div className="bg-white rounded-t-[16px] md:rounded-[6px] border border-[#e2e8f0] shadow-lg w-full md:max-w-[540px] h-[92dvh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] shrink-0">
          <div>
            <div className="text-[15px] font-semibold text-[#111]">Add Patient</div>
            <div className="text-[11px] text-[#9CA3AF] mt-0.5">{clinicConfig.displayName}</div>
          </div>
          <button
            onClick={() => router.back()}
            className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#F3F4F6] shrink-0">
          {(['patient', 'encounter'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-[#028090] text-[#028090]' : 'border-transparent text-[#6B7280] hover:text-[#374151]'
              }`}
            >
              {t === 'patient' ? 'Patient Info' : 'First Encounter'}
            </button>
          ))}
        </div>

        {/* Form body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto">
          {tab === 'patient' && (
            <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="First Name *" colSpan={1}>
                <input value={patient.first_name} onChange={(e) => setP('first_name', e.target.value)} required className={inputCls} placeholder="Jane" />
              </FormField>
              <FormField label="Last Name *" colSpan={1}>
                <input value={patient.last_name} onChange={(e) => setP('last_name', e.target.value)} required className={inputCls} placeholder="Smith" />
              </FormField>
              <FormField label="Patient ID" colSpan={1}>
                <input value={patient.patient_identifier} onChange={(e) => setP('patient_identifier', e.target.value)} className={inputCls} placeholder="Auto-generated if blank" />
              </FormField>
              <FormField label="Date of Birth *" colSpan={1}>
                <input type="date" value={patient.date_of_birth} onChange={(e) => setP('date_of_birth', e.target.value)} required className={inputCls} />
                {patient.date_of_birth && (
                  <div className="text-[10px] text-[#028090] mt-0.5">{dobAgePreview(patient.date_of_birth)}</div>
                )}
              </FormField>
              <FormField label="Sex" colSpan={1}>
                <select value={patient.sex} onChange={(e) => setP('sex', e.target.value)} className={inputCls}>
                  <option value="">— Select —</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="Other">Other</option>
                </select>
              </FormField>
              <FormField label="Language" colSpan={1}>
                <select value={patient.preferred_language} onChange={(e) => setP('preferred_language', e.target.value)} className={inputCls}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </FormField>
              <FormField label="Home Phone" colSpan={1}>
                <input value={patient.home_phone} onChange={(e) => setP('home_phone', e.target.value)} className={inputCls} placeholder="(518) 555-1234" />
              </FormField>
              <FormField label="Mobile Phone" colSpan={1}>
                <input value={patient.mobile_phone} onChange={(e) => setP('mobile_phone', e.target.value)} className={inputCls} placeholder="(518) 555-5678" />
              </FormField>
              <FormField label="Email" colSpan={2}>
                <input type="email" value={patient.email_address} onChange={(e) => setP('email_address', e.target.value)} className={inputCls} placeholder="jane@example.com" />
              </FormField>
            </div>
          )}

          {tab === 'encounter' && (
            <div className="px-6 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-2.5 p-3 rounded-[4px] bg-[#f0f9ff] border border-[#e2e8f0]">
                <input
                  id="add-enc"
                  type="checkbox"
                  checked={addEncounter}
                  onChange={(e) => setAddEncounter(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#028090] cursor-pointer"
                />
                <label htmlFor="add-enc" className="text-[13px] text-[#374151] cursor-pointer">
                  Add a first encounter for this patient
                </label>
              </div>

              {addEncounter && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Encounter Date" colSpan={1}>
                    <input type="date" value={encounter.encounter_date} onChange={(e) => setE('encounter_date', e.target.value)} className={inputCls} />
                  </FormField>

                  {/* Diagnosis Code — searchable combobox */}
                  <FormField label="Diagnosis Code" colSpan={1}>
                    <div className="relative" ref={codeRef}>
                      <input
                        type="text"
                        placeholder={codesLoading ? 'Loading…' : 'Search code…'}
                        value={codeQuery}
                        autoComplete="off"
                        onFocus={() => setShowCodeDrop(true)}
                        onChange={(e) => {
                          setCodeQuery(e.target.value)
                          setShowCodeDrop(true)
                          if (!e.target.value) {
                            setEncounter((prev) => ({
                              ...prev,
                              icd_code: '',
                              care_category: '',
                              visit_type: '',
                              diagnosis_code_id: '',
                            }))
                          }
                        }}
                        className={inputCls}
                      />
                      {encounter.icd_code && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                            <circle cx="4.5" cy="4.5" r="4.5" fill="#028090" />
                            <path d="M2.5 4.5l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="text-[10px] text-[#028090] font-medium">{encounter.care_category}</span>
                        </div>
                      )}
                      {showCodeDrop && (
                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-[#E5E7EB] rounded-[4px] shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                          {codesLoading ? (
                            <div className="px-3 py-3 text-[12px] text-[#9CA3AF]">Loading codes…</div>
                          ) : Object.keys(groupedCodes).length === 0 ? (
                            <div className="px-3 py-3 text-[12px] text-[#9CA3AF]">No matching codes</div>
                          ) : (
                            Object.entries(groupedCodes).map(([group, rows]) => (
                              <div key={group}>
                                <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-[.08em] text-[#9CA3AF] bg-[#f0f9ff] sticky top-0">
                                  {group}
                                </div>
                                {rows.map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onMouseDown={() => selectCode(c)}
                                    className="w-full text-left px-3 py-2 hover:bg-[#f0f9ff] transition-colors flex items-center gap-2.5"
                                  >
                                    <span className="font-mono text-[10px] text-[#6B7280] shrink-0 w-14">{c.code}</span>
                                    <span className="text-[12px] text-[#374151]">{c.description}</span>
                                  </button>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </FormField>

                  {/* Visit Type — auto-filled, overridable */}
                  <FormField label="Visit Type" colSpan={1}>
                    <select value={encounter.visit_type} onChange={(e) => setE('visit_type', e.target.value)} className={inputCls}>
                      <option value="">— Select —</option>
                      {VISIT_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </FormField>

                  {/* Care Category — auto-filled, read-only display */}
                  {encounter.care_category && (
                    <FormField label="Care Category" colSpan={1}>
                      <div className={`${inputCls} text-[#6B7280] bg-[#f0f9ff] cursor-default`}>
                        {encounter.care_category}
                      </div>
                    </FormField>
                  )}

                  <FormField label="Notes" colSpan={2}>
                    <textarea
                      value={encounter.notes}
                      onChange={(e) => setE('notes', e.target.value)}
                      rows={3}
                      className={`${inputCls} resize-none`}
                      placeholder="Optional clinical notes…"
                    />
                  </FormField>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F3F4F6] flex items-center justify-between shrink-0">
          {toast ? (
            <span className={`text-[12px] ${toast.startsWith('Error') ? 'text-[#DC2626]' : 'text-[#065F46]'}`}>{toast}</span>
          ) : (
            <span className="text-[11px] text-[#9CA3AF]">Fields marked * are required</span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-[12px] font-medium px-3 py-2 rounded-[4px] text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="text-[12px] font-medium px-4 py-2 rounded-[4px] bg-[#028090] text-white hover:bg-[#025f6b] transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {saving ? 'Saving…' : 'Add patient'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-[4px] border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#111] focus:outline-none focus:ring-1 focus:ring-[#028090] focus:border-[#028090] bg-white'

function FormField({ label, colSpan, children }: { label: string; colSpan: 1 | 2; children: React.ReactNode }) {
  return (
    <div className={colSpan === 2 ? 'col-span-1 sm:col-span-2' : ''}>
      <div className="text-[10px] uppercase tracking-[.07em] text-[#9CA3AF] font-medium mb-1">{label}</div>
      {children}
    </div>
  )
}
