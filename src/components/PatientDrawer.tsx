'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, type Patient, type Encounter } from '@/lib/supabase'
import { computeUrgency } from '@/lib/urgency'
import { useClinicConfig } from '@/hooks/useClinicConfig'

const PEDIATRIC_ICD10: Record<string, string> = {
  'Z00.110': 'Newborn Exam (under 8 days)',
  'Z00.111': 'Newborn Exam (8–28 days)',
  'Z00.121': 'Routine Child Exam (with abnormal findings)',
  'Z00.129': 'Routine Child Exam (no abnormal findings)',
  'Z23': 'Immunization Visit',
  'Z13.4': 'Developmental Screening',
  'Z13.5': 'Vision Screening',
  'Z13.89': 'Behavioral/Other Screening',
  'J06.9': 'Upper Respiratory Infection',
  'H66.90': 'Ear Infection (Otitis Media)',
  'J02.9': 'Sore Throat',
  'R50.9': 'Fever',
  'K52.9': 'Gastroenteritis',
  'J45.909': 'Asthma',
  'F90.9': 'ADHD',
  'L20.9': 'Eczema',
  'Z38.00': 'Newborn (Liveborn Infant)',
  'P07.30': 'Preterm Birth',
  'P59.9': 'Neonatal Jaundice',
}

const ICD10_DESCRIPTIONS: Record<string, string> = {
  'Z00.00': 'Annual wellness exam',
  'Z00.129': 'Well child visit',
  'E11.9': 'Type 2 diabetes management',
  'I10': 'Hypertension follow-up',
  'J06.9': 'Upper respiratory infection',
  'Z34.12': 'Prenatal care',
  'M54.5': 'Back pain',
  'J30.9': 'Allergic rhinitis',
  'F32.9': 'Major Depression',
  'F41.1': 'Generalized Anxiety',
  'F43.10': 'PTSD',
  'R45.851': 'Suicidal Ideation',
}

const URGENCY_BADGE: Record<string, string> = {
  Critical: 'bg-[#FEE2E2] text-[#991B1B]',
  High: 'bg-[#FEF3C7] text-[#92400E]',
  Medium: 'bg-[#DBEAFE] text-[#1E40AF]',
  Low: 'bg-[#F1F5F9] text-[#475569]',
}

function diagnosisLabel(code: string): string {
  if (!code) return '—'
  const trimmed = code.trim()
  return PEDIATRIC_ICD10[trimmed] ?? ICD10_DESCRIPTIONS[trimmed] ?? trimmed
}

function visitBadgeClass(visitType: string): string {
  const lower = (visitType ?? '').toLowerCase()
  if (lower.includes('well')) return 'bg-[#D1FAE5] text-[#065F46]'
  if (lower.includes('follow')) return 'bg-[#FEF3C7] text-[#92400E]'
  return 'bg-[#D1FAE5] text-[#065F46]'
}

function daysSince(dateStr: string): number {
  if (!dateStr) return 0
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)))
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function ageDisplay(patient: { age: number; date_of_birth?: string }): string {
  if (patient.date_of_birth) {
    const dob = new Date(patient.date_of_birth)
    const today = new Date()
    const totalMonths =
      (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth())
    if (totalMonths < 24) return `${Math.max(0, totalMonths)} mos`
  }
  return `${patient.age} yrs`
}

function getPatientAgeMonths(patient: { age: number; date_of_birth?: string }): number {
  if (patient.date_of_birth) {
    const dob = new Date(patient.date_of_birth)
    const today = new Date()
    return (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth())
  }
  return patient.age * 12
}

const VISIT_TYPES = ['Well Visit', 'Follow-up', 'Sick Visit', 'Telehealth', 'Immunization', 'Preventive Care', 'Mental Health', 'Specialist Referral']
const LANGUAGES = ['English', 'Spanish', 'French', 'Portuguese', 'Mandarin', 'Cantonese', 'Vietnamese', 'Arabic', 'Haitian Creole', 'Other']

type ScriptModal = { open: boolean; patientName: string; script: string; loading: boolean; preferredLanguage: string; patientEmail: string }
type DeleteConfirm = { open: boolean }
type AddVisitForm = { encounter_date: string; visit_type: string; diagnosis: string; notes: string }
type EditForm = {
  first_name: string
  last_name: string
  date_of_birth: string
  sex: string
  home_phone: string
  mobile_phone: string
  email_address: string
  preferred_language: string
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  postal_code: string
  active: string
}

function dobToAgePreview(dob: string): string {
  if (!dob) return ''
  const d = new Date(dob + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  const months = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth())
  if (months < 0) return ''
  if (months < 24) return `Age: ${months} month${months !== 1 ? 's' : ''}`
  return `Age: ${Math.floor(months / 12)} year${Math.floor(months / 12) !== 1 ? 's' : ''}`
}

interface PatientDrawerProps {
  patient_identifier: string
  clinic_id: string
  onClose: () => void
  onPatientUpdated?: () => void
}


export default function PatientDrawer({ patient_identifier, clinic_id, onClose, onPatientUpdated }: PatientDrawerProps) {
  const clinicConfig = useClinicConfig()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [loading, setLoading] = useState(true)
  const [contacting, setContacting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [scriptModal, setScriptModal] = useState<ScriptModal>({ open: false, patientName: '', script: '', loading: false, preferredLanguage: 'English', patientEmail: '' })
  const [scriptView, setScriptView] = useState<'original' | 'english'>('original')
  const [scriptEnglish, setScriptEnglish] = useState('')
  const [scriptTranslating, setScriptTranslating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm>({ open: false })
  const [showAddVisit, setShowAddVisit] = useState(false)
  const [addVisitForm, setAddVisitForm] = useState<AddVisitForm>({
    encounter_date: new Date().toISOString().slice(0, 10),
    visit_type: '',
    diagnosis: '',
    notes: '',
  })
  const [addingVisit, setAddingVisit] = useState(false)
  const [visitToast, setVisitToast] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    first_name: '', last_name: '', date_of_birth: '', sex: '',
    home_phone: '', mobile_phone: '', email_address: '', preferred_language: 'English',
    address_line_1: '', address_line_2: '', city: '', state: '', postal_code: '', active: 'Yes',
  })
  const [editSaving, setEditSaving] = useState(false)
  const [summaryText, setSummaryText] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setSummaryText(null)
    setSummaryLoading(false)
    Promise.all([
      supabase
        .from('patients')
        .select('*')
        .eq('patient_identifier', patient_identifier)
        .eq('clinic_id', clinic_id)
        .single(),
      supabase
        .from('encounters')
        .select('*')
        .eq('patient_record_number', patient_identifier)
        .order('encounter_date', { ascending: false }),
    ]).then(([{ data: patientData }, { data: encData }]) => {
      setPatient(patientData as Patient | null)
      setEncounters((encData ?? []) as Encounter[])
      setLoading(false)
    })
  }, [patient_identifier, clinic_id])

  const handleMarkContacted = useCallback(async () => {
    if (!patient || contacting) return
    setContacting(true)
    const nextStatus = patient.outreach_status === 'contacted' ? 'pending' : 'contacted'
    setPatient((p) => p ? { ...p, outreach_status: nextStatus } : p)
    const res = await fetch('/api/patients/outreach', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: patient.id, status: nextStatus }),
    })
    if (!res.ok) {
      setPatient((p) => p ? { ...p, outreach_status: patient.outreach_status } : p)
      setVisitToast('Failed to update status. Please try again.')
      setTimeout(() => setVisitToast(null), 4000)
    } else {
      onPatientUpdated?.()
    }
    setContacting(false)
  }, [patient, contacting, onPatientUpdated])

  const handleGenerateScript = useCallback(async () => {
    if (!patient) return
    const name = `${patient.first_name} ${patient.last_name}`
    setScriptModal({ open: true, patientName: name, script: '', loading: true, preferredLanguage: patient.preferred_language ?? 'English', patientEmail: patient.email_address ?? '' })
    setScriptView('original')
    setScriptEnglish('')
    setScriptTranslating(false)
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: patient.first_name,
          last_name: patient.last_name,
          days_overdue: patient.days_overdue,
          preferred_language: patient.preferred_language,
          clinic_type: clinicConfig.clinicType,
          ai_instructions: clinicConfig.aiScriptInstructions,
        }),
      })
      const data = await res.json()
      setScriptModal((prev) => ({
        ...prev,
        script: data.script ?? data.error ?? 'Failed to generate script.',
        loading: false,
      }))
    } catch {
      setScriptModal((prev) => ({
        ...prev,
        script: 'Network error. Check your connection and try again.',
        loading: false,
      }))
    }
  }, [patient, clinicConfig])

  const handleDelete = useCallback(async () => {
    if (!patient || deleting) return
    setDeleting(true)
    await supabase.from('encounters').delete().eq('patient_record_number', patient.patient_identifier)
    await supabase.from('patients').delete().eq('id', patient.id).eq('clinic_id', clinic_id)
    setDeleting(false)
    onPatientUpdated?.()
    onClose()
  }, [patient, deleting, clinic_id, onPatientUpdated, onClose])

  const handleAddVisit = useCallback(async () => {
    if (!patient || addingVisit) return
    setAddingVisit(true)
    setVisitToast(null)
    const { error } = await supabase.from('encounters').insert({
      clinic_id,
      patient_record_number: patient.patient_identifier,
      encounter_date: addVisitForm.encounter_date,
      visit_type: addVisitForm.visit_type || 'Visit',
      diagnosis: addVisitForm.diagnosis || null,
      care_category: addVisitForm.visit_type || 'General',
    })
    if (error) {
      setVisitToast('Failed to add visit.')
      setAddingVisit(false)
      return
    }
    const encDate = new Date(addVisitForm.encounter_date + 'T00:00:00')
    const nowDate = new Date()
    const newDaysOverdue = Math.max(0, Math.floor((nowDate.getTime() - encDate.getTime()) / (1000 * 60 * 60 * 24)))
    const { label: newUrgency, score: newScore } = computeUrgency(newDaysOverdue, clinicConfig.clinicType, getPatientAgeMonths(patient))
    await supabase.from('patients').update({
      most_recent_visit_date: addVisitForm.encounter_date,
      days_overdue: newDaysOverdue,
      urgency_label: newUrgency,
      urgency_score: newScore,
    }).eq('id', patient.id)
    const { data: newEncs } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_record_number', patient.patient_identifier)
      .order('encounter_date', { ascending: false })
    setEncounters((newEncs ?? []) as Encounter[])
    setPatient((p) => p ? { ...p, days_overdue: newDaysOverdue, urgency_label: newUrgency as Patient['urgency_label'], urgency_score: newScore } : p)
    setAddVisitForm({ encounter_date: new Date().toISOString().slice(0, 10), visit_type: '', diagnosis: '', notes: '' })
    setShowAddVisit(false)
    setVisitToast('Visit added.')
    setAddingVisit(false)
    onPatientUpdated?.()
    setTimeout(() => setVisitToast(null), 3000)
  }, [patient, addingVisit, addVisitForm, clinicConfig, clinic_id, onPatientUpdated])

  const handleGenerateSummary = useCallback(async () => {
    if (!patient || summaryLoading) return
    setSummaryLoading(true)
    setSummaryText(null)
    try {
      const res = await fetch('/api/patient-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patient.id, clinic_id: patient.clinic_id }),
      })
      const data = await res.json()
      setSummaryText(data.summary ?? data.error ?? 'Failed to generate summary.')
    } catch {
      setSummaryText('Network error. Check your connection and try again.')
    } finally {
      setSummaryLoading(false)
    }
  }, [patient, summaryLoading])

  function openEdit() {
    if (!patient) return
    setEditForm({
      first_name: patient.first_name ?? '',
      last_name: patient.last_name ?? '',
      date_of_birth: patient.date_of_birth ?? '',
      sex: patient.sex ?? '',
      home_phone: patient.home_phone ?? '',
      mobile_phone: patient.mobile_phone ?? '',
      email_address: patient.email_address ?? '',
      preferred_language: patient.preferred_language ?? 'English',
      address_line_1: patient.address_line_1 ?? '',
      address_line_2: patient.address_line_2 ?? '',
      city: patient.city ?? '',
      state: patient.state ?? '',
      postal_code: patient.postal_code ?? '',
      active: patient.active ?? 'Yes',
    })
    setShowEdit(true)
  }

  async function handleSaveEdit() {
    if (!patient || editSaving) return
    if (!editForm.first_name.trim() || !editForm.last_name.trim() || !editForm.date_of_birth) {
      setVisitToast('First name, last name, and date of birth are required.')
      setTimeout(() => setVisitToast(null), 4000)
      return
    }
    setEditSaving(true)
    const dob = editForm.date_of_birth
    const ageDays = dob ? Math.floor((Date.now() - new Date(dob + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) : 0
    const ageYears = Math.max(0, Math.floor(ageDays / 365.25))
    const res = await fetch(`/api/patients/${patient.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, age: ageYears, clinic_id: patient.clinic_id }),
    })
    if (!res.ok) {
      const d = await res.json()
      setVisitToast(`Failed to save: ${d.error ?? 'Unknown error'}`)
      setTimeout(() => setVisitToast(null), 4000)
      setEditSaving(false)
      return
    }
    const { patient: updated } = await res.json()
    setPatient((p) => p ? { ...p, ...updated } : p)
    setShowEdit(false)
    setVisitToast('Patient updated successfully.')
    setTimeout(() => setVisitToast(null), 3000)
    onPatientUpdated?.()
    setEditSaving(false)
  }

  if (loading) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
        <div className="fixed right-0 top-0 h-full w-full md:w-[380px] z-50 bg-white shadow-md border-l border-[#e2e8f0] flex items-center justify-center">
          <svg className="h-5 w-5 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      </>
    )
  }

  if (!patient) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
        <div className="fixed right-0 top-0 h-full w-full md:w-[380px] z-50 bg-white shadow-md border-l border-[#e2e8f0] flex flex-col items-center justify-center gap-2 text-[#9CA3AF]">
          <span className="text-[13px]">Patient not found</span>
          <button onClick={onClose} className="text-[12px] text-[#028090] hover:underline mt-2">Close</button>
        </div>
      </>
    )
  }

  const isContacted = patient.outreach_status === 'contacted'
  const badge = URGENCY_BADGE[patient.urgency_label] ?? 'bg-[#F3F4F6] text-[#374151]'
  const daysClass =
    patient.days_overdue >= 180 ? 'font-mono font-bold text-[14px] text-[#B91C1C]'
    : patient.days_overdue >= 90 ? 'font-mono font-bold text-[14px] text-[#B45309]'
    : patient.days_overdue >= 45 ? 'font-mono font-medium text-[13px] text-[#1D4ED8]'
    : 'font-mono font-medium text-[13px] text-[#6B7280]'

  const ageMonths = getPatientAgeMonths(patient)
  const guidance = clinicConfig.visitScheduleGuidance.find((g) => g.condition(ageMonths))
  const isCrisis = clinicConfig.flags.showCrisisWarning && patient.urgency_label === 'Critical'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:w-[380px] z-50 bg-white shadow-md border-l border-[#e2e8f0] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[#F3F4F6] shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 ${badge}`}>
              {patient.first_name[0]}{patient.last_name[0]}
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[#111] leading-tight">
                {patient.first_name} {patient.last_name}
              </div>
              <div className="text-[11px] text-[#9CA3AF] font-mono mt-0.5">
                {patient.patient_identifier ?? `ID-${patient.id.slice(0, 6)}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={openEdit}
              title="Edit patient"
              className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[#9CA3AF] hover:bg-[#f0f9ff] hover:text-[#028090] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M9 2l2 2-7 7H2V9l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Edit form overlay */}
        {showEdit && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {visitToast && (
                <div className="text-[11px] text-[#991B1B] bg-[#FEF2F2] rounded-[4px] px-3 py-1.5">{visitToast}</div>
              )}
              <EditField label="First Name *">
                <input value={editForm.first_name} onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))} required className={editInputCls} placeholder="Jane" />
              </EditField>
              <EditField label="Last Name *">
                <input value={editForm.last_name} onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))} required className={editInputCls} placeholder="Smith" />
              </EditField>
              <EditField label="Date of Birth *">
                <input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm((p) => ({ ...p, date_of_birth: e.target.value }))} required className={editInputCls} />
                {editForm.date_of_birth && (
                  <div className="text-[10px] text-[#028090] mt-0.5">{dobToAgePreview(editForm.date_of_birth)}</div>
                )}
              </EditField>
              <EditField label="Sex">
                <select value={editForm.sex} onChange={(e) => setEditForm((p) => ({ ...p, sex: e.target.value }))} className={editInputCls}>
                  <option value="">— Select —</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="Other">Other</option>
                </select>
              </EditField>
              <EditField label="Language">
                <select value={editForm.preferred_language} onChange={(e) => setEditForm((p) => ({ ...p, preferred_language: e.target.value }))} className={editInputCls}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </EditField>
              <EditField label="Home Phone">
                <input value={editForm.home_phone} onChange={(e) => setEditForm((p) => ({ ...p, home_phone: e.target.value }))} className={editInputCls} placeholder="(518) 555-1234" />
              </EditField>
              <EditField label="Mobile Phone">
                <input value={editForm.mobile_phone} onChange={(e) => setEditForm((p) => ({ ...p, mobile_phone: e.target.value }))} className={editInputCls} placeholder="(518) 555-5678" />
              </EditField>
              <EditField label="Email">
                <input type="email" value={editForm.email_address} onChange={(e) => setEditForm((p) => ({ ...p, email_address: e.target.value }))} className={editInputCls} placeholder="jane@example.com" />
              </EditField>
              <EditField label="Address Line 1">
                <input value={editForm.address_line_1} onChange={(e) => setEditForm((p) => ({ ...p, address_line_1: e.target.value }))} className={editInputCls} placeholder="123 Main St" />
              </EditField>
              <EditField label="Address Line 2">
                <input value={editForm.address_line_2} onChange={(e) => setEditForm((p) => ({ ...p, address_line_2: e.target.value }))} className={editInputCls} placeholder="Apt 4" />
              </EditField>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <EditField label="City">
                    <input value={editForm.city} onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))} className={editInputCls} placeholder="Albany" />
                  </EditField>
                </div>
                <div className="col-span-1">
                  <EditField label="State">
                    <input value={editForm.state} onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))} className={editInputCls} placeholder="NY" maxLength={2} />
                  </EditField>
                </div>
                <div className="col-span-1">
                  <EditField label="Zip">
                    <input value={editForm.postal_code} onChange={(e) => setEditForm((p) => ({ ...p, postal_code: e.target.value }))} className={editInputCls} placeholder="12208" />
                  </EditField>
                </div>
              </div>
              <EditField label="Active">
                <select value={editForm.active} onChange={(e) => setEditForm((p) => ({ ...p, active: e.target.value }))} className={editInputCls}>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </EditField>
              <div className="text-[10px] text-[#9CA3AF] pt-1">
                Patient ID: <span className="font-mono">{patient.patient_identifier}</span> · Urgency score is recalculated automatically.
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#F3F4F6] flex gap-2 shrink-0">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 text-[12px] font-medium px-3 py-2.5 rounded-[4px] border border-[#E5E7EB] text-[#374151] hover:bg-[#f0f9ff] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="flex-1 text-[12px] font-medium px-3 py-2.5 rounded-[4px] bg-[#028090] text-white hover:bg-[#025f6b] transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        )}

        {/* Body */}
        {!showEdit && <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-[3px] rounded-full ${badge}`}>
              {patient.urgency_label}
            </span>
            <span className={daysClass}>
              {patient.days_overdue} days overdue
            </span>
          </div>

          {isCrisis && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[8px] px-3.5 py-3 text-[12px] text-[#991B1B]">
              <div className="font-semibold mb-0.5">Crisis risk flagged</div>
              <div>If patient is in crisis, refer to <span className="font-semibold">988 Suicide & Crisis Lifeline</span> (call or text 988).</div>
            </div>
          )}

          <div className="bg-[#f0f9ff] rounded-[8px] p-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <InfoField label={clinicConfig.flags.showAgeInMonths ? 'Age' : 'Age'} value={ageDisplay(patient)} />
            <InfoField label="Language" value={patient.preferred_language ?? '—'} />
            <InfoField label="Phone" value={patient.home_phone ?? '—'} />
            <InfoField label="Email" value={patient.email_address ?? '—'} wide />
            {guidance && (
              <div className="col-span-2 pt-1 border-t border-[#e2e8f0]">
                <div className="text-[9px] uppercase tracking-[.06em] text-[#9CA3AF] font-medium mb-0.5">Visit Schedule</div>
                <div className="text-[11px] text-[#374151]">{guidance.message}</div>
              </div>
            )}
          </div>

          {/* Clinical Summary */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[.08em] font-semibold text-[#9CA3AF]">
                Clinical Summary
              </div>
              {!summaryText && !summaryLoading && (
                <button
                  onClick={handleGenerateSummary}
                  className="text-[10px] font-medium text-[#028090] hover:text-[#025f6b] transition-colors flex items-center gap-0.5"
                >
                  ✦ Generate
                </button>
              )}
              {summaryText && !summaryLoading && (
                <button
                  onClick={() => { setSummaryText(null) }}
                  className="text-[10px] text-[#9CA3AF] hover:text-[#028090] transition-colors"
                >
                  ↻ Regenerate
                </button>
              )}
            </div>
            {summaryLoading && (
              <div className="flex items-center gap-2 py-3 text-[#9CA3AF]">
                <svg className="h-3.5 w-3.5 animate-spin text-[#028090] shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-[12px]">Analyzing…</span>
              </div>
            )}
            {summaryText && (
              <div className="bg-[#f0f9ff] border border-[#e2e8f0] rounded-[8px] px-3.5 py-3">
                <p className="text-[12px] text-[#374151] leading-relaxed">{summaryText}</p>
              </div>
            )}
            {!summaryText && !summaryLoading && (
              <p className="text-[11px] text-[#9CA3AF]">
                AI-generated overview based on anonymized clinical data.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[.08em] font-semibold text-[#9CA3AF]">
                Encounter History
              </div>
              <button
                onClick={() => setShowAddVisit((v) => !v)}
                className="text-[10px] font-medium text-[#028090] hover:text-[#025f6b] transition-colors flex items-center gap-0.5"
              >
                {showAddVisit ? '✕ Cancel' : '＋ Add visit'}
              </button>
            </div>

            {visitToast && (
              <div className="mb-2 text-[11px] text-[#065F46] bg-[#D1FAE5] rounded-[4px] px-3 py-1.5">{visitToast}</div>
            )}

            {showAddVisit && (
              <div className="mb-3 bg-[#f0f9ff] border border-[#e2e8f0] rounded-[8px] p-3 flex flex-col gap-2">
                <div>
                  <div className="text-[9px] uppercase tracking-[.07em] text-[#9CA3AF] font-medium mb-0.5">Date</div>
                  <input
                    type="date"
                    value={addVisitForm.encounter_date}
                    onChange={(e) => setAddVisitForm((p) => ({ ...p, encounter_date: e.target.value }))}
                    className="w-full rounded-[4px] border border-[#e2e8f0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#028090]"
                  />
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[.07em] text-[#9CA3AF] font-medium mb-0.5">Visit Type</div>
                  <select
                    value={addVisitForm.visit_type}
                    onChange={(e) => setAddVisitForm((p) => ({ ...p, visit_type: e.target.value }))}
                    className="w-full rounded-[4px] border border-[#e2e8f0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#028090] bg-white"
                  >
                    <option value="">Select type</option>
                    {VISIT_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[.07em] text-[#9CA3AF] font-medium mb-0.5">Diagnosis Code</div>
                  <select
                    value={addVisitForm.diagnosis}
                    onChange={(e) => setAddVisitForm((p) => ({ ...p, diagnosis: e.target.value }))}
                    className="w-full rounded-[4px] border border-[#e2e8f0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#028090] bg-white"
                  >
                    <option value="">Select code</option>
                    {Object.entries(clinicConfig.relevantIcdCodes).map(([code, label]) => (
                      <option key={code} value={code}>{code}: {label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[.07em] text-[#9CA3AF] font-medium mb-0.5">Notes</div>
                  <textarea
                    value={addVisitForm.notes}
                    onChange={(e) => setAddVisitForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    placeholder="Optional notes…"
                    className="w-full rounded-[4px] border border-[#e2e8f0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#028090] resize-none"
                  />
                </div>
                <button
                  onClick={handleAddVisit}
                  disabled={addingVisit || !addVisitForm.encounter_date}
                  className="w-full text-[11px] font-medium py-2 rounded-[4px] bg-[#028090] text-white hover:bg-[#025f6b] transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  {addingVisit ? 'Saving…' : 'Save visit'}
                </button>
              </div>
            )}

            {encounters.length === 0 ? (
              <div className="text-center py-8 text-[#9CA3AF] text-[12px]">No encounters found</div>
            ) : (
              <div className="flex flex-col gap-2">
                {encounters.map((enc, i) => {
                  const days = daysSince(enc.encounter_date)
                  const badgeCls = visitBadgeClass(enc.visit_type)
                  return (
                    <div key={i} className="bg-white border border-[#F3F4F6] rounded-[4px] px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1.5">
                            <span className={`text-[10px] font-medium px-2 py-[2px] rounded-full ${badgeCls}`}>
                              {enc.visit_type ?? 'Visit'}
                            </span>
                          </div>
                          <div className="text-[12px] text-[#374151] font-medium leading-snug">
                            {diagnosisLabel(enc.diagnosis)}
                          </div>
                          {enc.diagnosis && diagnosisLabel(enc.diagnosis) !== enc.diagnosis.trim() && (
                            <div className="text-[10px] text-[#9CA3AF] font-mono mt-0.5">{enc.diagnosis.trim()}</div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] text-[#6B7280]">{formatDate(enc.encounter_date)}</div>
                          <div className="text-[10px] text-[#9CA3AF] mt-0.5">{days}d ago</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>}

        {/* Footer actions */}
        {!showEdit && <div className="px-5 py-4 border-t border-[#F3F4F6] flex flex-col gap-2 shrink-0">
          <button
            onClick={handleGenerateScript}
            disabled={isContacted}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2.5 rounded-[4px] border border-[#e2e8f0] bg-[#f0f9ff] text-[#05668d] hover:bg-[#dbeafe] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✦ Generate AI script
          </button>
          <button
            onClick={handleMarkContacted}
            disabled={contacting}
            className={`group w-full text-[12px] font-medium px-3 py-2.5 rounded-[4px] transition-colors ${
              contacting
                ? 'bg-[#028090]/50 text-white cursor-wait'
                : isContacted
                ? 'bg-[#D1FAE5] border border-[#6EE7B7] text-[#065F46] hover:bg-[#FEF2F2] hover:border-[#FECACA] hover:text-[#DC2626]'
                : 'bg-[#028090] text-white hover:bg-[#025f6b]'
            }`}
          >
            {contacting ? '…' : isContacted ? (
              <>
                <span className="group-hover:hidden">✓ Contacted</span>
                <span className="hidden group-hover:inline">Unmark</span>
              </>
            ) : 'Mark contacted'}
          </button>
          {!deleteConfirm.open ? (
            <button
              onClick={() => setDeleteConfirm({ open: true })}
              className="w-full text-[12px] font-medium px-3 py-2 rounded-[4px] text-[#DC2626] hover:bg-[#FEF2F2] border border-[#FECACA] transition-colors mt-1"
            >
              Delete patient
            </button>
          ) : (
            <div className="mt-1 bg-[#FEF2F2] border border-[#FECACA] rounded-[4px] px-3 py-2.5 flex flex-col gap-2">
              <div className="text-[11px] text-[#DC2626] font-medium text-center">
                Delete {patient.first_name} {patient.last_name} and all their encounter history?
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm({ open: false })}
                  className="flex-1 text-[11px] font-medium px-2 py-1.5 rounded-[5px] border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#f0f9ff] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 text-[11px] font-medium px-2 py-1.5 rounded-[5px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Confirm delete'}
                </button>
              </div>
            </div>
          )}
        </div>}
      </div>

      {/* AI Script modal */}
      {scriptModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-none md:rounded-[6px] shadow-lg w-full md:max-w-[480px] flex flex-col overflow-hidden max-h-screen">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
              <div className="text-[14px] font-semibold text-[#111]">
                AI Script: {scriptModal.patientName}
              </div>
              <button
                onClick={() => setScriptModal((p) => ({ ...p, open: false }))}
                className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 flex-1 overflow-y-auto">
              {scriptModal.loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-[#9CA3AF]">
                  <svg className="h-4 w-4 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span className="text-[13px]">Generating script…</span>
                </div>
              ) : (() => {
                const isEnglish = !scriptModal.preferredLanguage || scriptModal.preferredLanguage.toLowerCase() === 'english'
                const displayed = scriptView === 'english' ? scriptEnglish : scriptModal.script
                return (
                  <>
                    {!isEnglish && (
                      <div className="mb-3">
                        <div className="flex rounded-[4px] border border-[#e2e8f0] overflow-hidden text-[12px] mb-2">
                          <button
                            onClick={() => setScriptView('original')}
                            className={`flex-1 py-1.5 px-3 flex items-center justify-center gap-1 transition-colors border-r border-[#E5E7EB] ${
                              scriptView === 'original' ? 'bg-[#f0f9ff] text-[#05668d] font-medium' : 'text-[#6B7280] hover:bg-[#f0f9ff]'
                            }`}
                          >
                            🌍 Original ({scriptModal.preferredLanguage})
                          </button>
                          <button
                            onClick={async () => {
                              if (scriptEnglish) { setScriptView('english'); return }
                              setScriptView('english')
                              setScriptTranslating(true)
                              try {
                                const res = await fetch('/api/translate-script', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ script: scriptModal.script }),
                                })
                                const d = await res.json()
                                setScriptEnglish(d.translation ?? 'Translation failed.')
                              } catch {
                                setScriptEnglish('Translation failed. Please try again.')
                              } finally {
                                setScriptTranslating(false)
                              }
                            }}
                            className={`flex-1 py-1.5 px-3 flex items-center justify-center gap-1 transition-colors ${
                              scriptView === 'english' ? 'bg-[#f0f9ff] text-[#05668d] font-medium' : 'text-[#6B7280] hover:bg-[#f0f9ff]'
                            }`}
                          >
                            EN English
                          </button>
                        </div>
                        <p className="text-[11px] text-[#9CA3AF]">Script generated in patient's preferred language. Toggle to English for reference.</p>
                      </div>
                    )}
                    {scriptView === 'english' && scriptTranslating ? (
                      <div className="flex items-center justify-center py-10 gap-2 text-[#9CA3AF]">
                        <svg className="h-4 w-4 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        <span className="text-[13px]">Translating…</span>
                      </div>
                    ) : (
                      <pre className="text-[13px] text-[#374151] whitespace-pre-wrap leading-relaxed font-sans">
                        {displayed}
                      </pre>
                    )}
                  </>
                )
              })()}
            </div>
            {!scriptModal.loading && scriptModal.script && (
              <div className="px-5 py-3 border-t border-[#F3F4F6] flex items-center justify-end gap-2 shrink-0">
                <button
                  onClick={() => {
                    const subject = encodeURIComponent(`Appointment Reminder - ${scriptModal.patientName}`)
                    const body = encodeURIComponent(scriptView === 'english' ? scriptEnglish : scriptModal.script)
                    window.open(`mailto:${scriptModal.patientEmail}?subject=${subject}&body=${body}`)
                  }}
                  disabled={!scriptModal.patientEmail || scriptTranslating}
                  title={!scriptModal.patientEmail ? 'No email address on file' : undefined}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-[4px] border border-[#e2e8f0] bg-[#f0f9ff] text-[#05668d] hover:bg-[#dbeafe] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                    <rect x="0.65" y="0.65" width="11.7" height="8.7" rx="1.1" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M1 2l5.5 3.5L12 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Send via email
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(scriptView === 'english' ? scriptEnglish : scriptModal.script)}
                  disabled={scriptTranslating}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-[4px] bg-[#028090] text-white hover:bg-[#025f6b] transition-colors disabled:opacity-50"
                >
                  Copy script
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function InfoField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="text-[9px] uppercase tracking-[.06em] text-[#9CA3AF] font-medium mb-0.5">{label}</div>
      <div className="text-[12px] text-[#374151] font-medium break-words">{value}</div>
    </div>
  )
}

const editInputCls = 'w-full rounded-[4px] border border-[#E5E7EB] px-2.5 py-1.5 text-[12px] text-[#111] focus:outline-none focus:ring-1 focus:ring-[#028090] focus:border-[#028090] bg-white'

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[.07em] text-[#9CA3AF] font-medium mb-1">{label}</div>
      {children}
    </div>
  )
}
