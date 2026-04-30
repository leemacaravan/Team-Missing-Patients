'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase, fetchAllPatients, type Patient, type Encounter } from '@/lib/supabase'
import { PEDIATRIC_ICD10 } from '@/lib/clinic'
import { useClinic } from '@/context/ClinicContext'
import { useClinicConfig } from '@/hooks/useClinicConfig'
import type { ClinicTypeConfig } from '@/config/clinicTypes'

const ICD10_DESCRIPTIONS: Record<string, string> = {
  'Z00.00': 'Annual wellness exam',
  'Z00.129': 'Well child visit',
  'E11.9': 'Type 2 diabetes management',
  'I10': 'Hypertension follow-up',
  'J06.9': 'Upper respiratory infection',
  'Z34.12': 'Prenatal care',
  'M54.5': 'Back pain',
  'J30.9': 'Allergic rhinitis',
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
  const date = new Date(dateStr)
  const today = new Date()
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)))
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function ageDisplay(patient: { age: number; date_of_birth?: string }): string {
  if (patient.date_of_birth) {
    const dob = new Date(patient.date_of_birth)
    const today = new Date()
    const totalMonths =
      (today.getFullYear() - dob.getFullYear()) * 12 +
      (today.getMonth() - dob.getMonth())
    if (totalMonths < 24) return `${Math.max(0, totalMonths)} mos`
  }
  return `${patient.age} yrs`
}

const URGENCY_BADGE: Record<string, string> = {
  Critical: 'bg-[#FEE2E2] text-[#991B1B]',
  High: 'bg-[#FEF3C7] text-[#92400E]',
  Medium: 'bg-[#DBEAFE] text-[#1E40AF]',
  Low: 'bg-[#F1F5F9] text-[#475569]',
}

const URGENCY_ROW: Record<string, string> = {
  Critical: 'bg-[#FFF7F7] hover:bg-[#FFECEA]',
  High: 'bg-[#FFFBF4] hover:bg-[#FFF5E9]',
}

const STATUS_BADGE: Record<string, string> = {
  contacted: 'bg-[#D1FAE5] text-[#065F46]',
  pending: 'bg-[#FEF3C7] text-[#92400E]',
  scheduled: 'bg-[#D1FAE5] text-[#065F46]',
}

type ScriptModal = { open: boolean; patientName: string; script: string; loading: boolean; preferredLanguage: string; patientEmail: string }
type DeleteModal = { open: boolean; patientIds: string[]; patientNames: string[] }

export default function AllPatientsClient() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [contactedFilter, setContactedFilter] = useState<'all' | 'contacted' | 'not_contacted'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'Critical' | 'High' | 'Medium' | 'Low'>('all')
  const [missingFilter, setMissingFilter] = useState<'all' | 'missing' | 'up_to_date'>('all')
  const [sortBy, setSortBy] = useState<'urgency_desc' | 'urgency_asc' | 'days_desc' | 'days_asc' | 'name_asc'>('urgency_desc')
  const [session, setSession] = useState<{ role: 'admin' | 'patient'; patientIdentifier?: string } | null>(null)
  const [contactingId, setContactingId] = useState<string | null>(null)
  const [modal, setModal] = useState<ScriptModal>({ open: false, patientName: '', script: '', loading: false, preferredLanguage: 'English', patientEmail: '' })
  const [scriptView, setScriptView] = useState<'original' | 'english'>('original')
  const [scriptEnglish, setScriptEnglish] = useState('')
  const [scriptTranslating, setScriptTranslating] = useState(false)
  const [deleteModal, setDeleteModal] = useState<DeleteModal>({ open: false, patientIds: [], patientNames: [] })
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [encountersLoading, setEncountersLoading] = useState(false)

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [bulkContacting, setBulkContacting] = useState(false)
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const { clinicId, clinicType, loading: clinicLoading } = useClinic()
  const clinicConfig = useClinicConfig()

  const selectedPatient = selectedPatientId ? (patients.find((p) => p.id === selectedPatientId) ?? null) : null

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : Promise.resolve({ user: null })))
      .then((d) => setSession(d.user ?? null))
  }, [])

  useEffect(() => {
    if (clinicLoading) return
    fetchAllPatients(clinicId).then((data) => {
      setPatients(data)
      setLoading(false)
    })
  }, [clinicId, clinicLoading])

  const filtered = !loading
    ? patients
      .filter((p) => {
        if (session?.role === 'patient' && session.patientIdentifier) {
          return p.patient_identifier === session.patientIdentifier
        }
        return true
      })
      .filter((p) => search === '' || `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => contactedFilter === 'all' ? true : contactedFilter === 'contacted' ? p.outreach_status === 'contacted' : p.outreach_status !== 'contacted')
      .filter((p) => priorityFilter === 'all' ? true : p.urgency_label === priorityFilter)
      .filter((p) => missingFilter === 'all' ? true : missingFilter === 'missing' ? p.days_overdue > 0 : p.days_overdue <= 0)
      .sort((a, b) => {
        if (sortBy === 'urgency_desc') return b.urgency_score - a.urgency_score
        if (sortBy === 'urgency_asc') return a.urgency_score - b.urgency_score
        if (sortBy === 'days_desc') return b.days_overdue - a.days_overdue
        if (sortBy === 'days_asc') return a.days_overdue - b.days_overdue
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      })
    : []

  const allChecked = filtered.length > 0 && filtered.every((p) => selectedRows.has(p.id))
  const someChecked = filtered.some((p) => selectedRows.has(p.id))

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someChecked && !allChecked
    }
  }, [someChecked, allChecked])

  function toggleAll() {
    if (allChecked) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filtered.map((p) => p.id)))
    }
  }

  function toggleRow(id: string) {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkMarkContacted() {
    const ids = [...selectedRows]
    setBulkContacting(true)
    setPatients((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, outreach_status: 'contacted' } : p))
    const res = await fetch('/api/patients/outreach', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status: 'contacted' }),
    })
    if (!res.ok) {
      setPatients((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, outreach_status: 'pending' } : p))
      setToast('Bulk update failed — please try again.')
      setTimeout(() => setToast(null), 4000)
    }
    setSelectedRows(new Set())
    setBulkContacting(false)
  }

  const handleMarkContacted = useCallback(async (patient: Patient) => {
    if (contactingId) return
    setContactingId(patient.id)
    const nextStatus = patient.outreach_status === 'contacted' ? 'pending' : 'contacted'
    setPatients((prev) => prev.map((p) => p.id === patient.id ? { ...p, outreach_status: nextStatus } : p))
    const res = await fetch('/api/patients/outreach', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: patient.id, status: nextStatus }),
    })
    if (!res.ok) {
      setPatients((prev) => prev.map((p) => p.id === patient.id ? { ...p, outreach_status: patient.outreach_status } : p))
      setToast('Failed to update status — please try again.')
      setTimeout(() => setToast(null), 4000)
    }
    setContactingId(null)
  }, [contactingId])

  const handleGenerateScript = useCallback(async (patient: Patient) => {
    setModal({ open: true, patientName: `${patient.first_name} ${patient.last_name}`, script: '', loading: true, preferredLanguage: patient.preferred_language ?? 'English', patientEmail: patient.email_address ?? '' })
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
      setModal((prev) => ({ ...prev, script: data.script ?? data.error ?? 'Failed to generate script.', loading: false }))
    } catch {
      setModal((prev) => ({ ...prev, script: 'Network error — please check your connection and try again.', loading: false }))
    }
  }, [clinicConfig])

  const openPatientPanel = useCallback(async (patient: Patient) => {
    setSelectedPatientId(patient.id)
    setEncounters([])
    setEncountersLoading(true)
    const { data } = await supabase
      .from('encounters')
      .select('*')
      .eq('patient_record_number', patient.patient_identifier)
      .order('encounter_date', { ascending: false })
    setEncounters((data ?? []) as Encounter[])
    setEncountersLoading(false)
  }, [])

  const closePatientPanel = useCallback(() => {
    setSelectedPatientId(null)
    setEncounters([])
  }, [])

  function requestDelete(ids: string[], names: string[]) {
    setDeleteModal({ open: true, patientIds: ids, patientNames: names })
  }

  async function handleDeletePatients() {
    const { patientIds, patientNames } = deleteModal
    if (patientIds.length === 0) return
    setDeleting(true)
    const identifiers = patients
      .filter((p) => patientIds.includes(p.id))
      .map((p) => p.patient_identifier)
      .filter(Boolean)

    if (identifiers.length > 0) {
      await supabase.from('encounters').delete().in('patient_record_number', identifiers)
    }
    await supabase.from('patients').delete().in('id', patientIds).eq('clinic_id', clinicId ?? '')

    setPatients((prev) => prev.filter((p) => !patientIds.includes(p.id)))
    setSelectedPatientId(null)
    setSelectedRows(new Set())
    setDeleteModal({ open: false, patientIds: [], patientNames: [] })
    setDeleting(false)

    const label =
      patientNames.length === 1
        ? `${patientNames[0]} and their encounter history have been deleted`
        : `${patientNames.length} patients and their encounter history have been deleted`
    setToast(label)
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="p-4 md:p-7 flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[26px] font-semibold text-[#111] tracking-tight">All Patients</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">Complete patient roster sorted by urgency</p>
        </div>
        {session?.role === 'admin' && (
          <Link
            href="/patients/new"
            className="flex items-center gap-1.5 text-[12px] font-medium px-3.5 py-2 rounded-[4px] bg-[#028090] text-white hover:bg-[#025f6b] transition-colors shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Add Patient
          </Link>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-[4px] bg-white px-3 py-2 text-[13px] text-[#9CA3AF] flex-1 md:w-80 md:flex-none">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="#9CA3AF" strokeWidth="1.3" />
              <path d="M10 10l2.5 2.5" stroke="#9CA3AF" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[#374151] placeholder-[#9CA3AF] text-[13px]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          {!loading && (
            <span className="text-[12px] text-[#9CA3AF] hidden md:block shrink-0">
              {filtered.length} of {patients.length} patients
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={contactedFilter} onChange={(e) => setContactedFilter(e.target.value as typeof contactedFilter)} className="rounded-[4px] border border-[#E5E7EB] px-2 py-2 text-[12px] bg-white flex-1 md:flex-none">
            <option value="all">All Contacted Status</option>
            <option value="contacted">Contacted</option>
            <option value="not_contacted">Not Contacted</option>
          </select>
          <select value={missingFilter} onChange={(e) => setMissingFilter(e.target.value as typeof missingFilter)} className="rounded-[4px] border border-[#E5E7EB] px-2 py-2 text-[12px] bg-white flex-1 md:flex-none">
            <option value="all">All Missing Status</option>
            <option value="missing">Missing</option>
            <option value="up_to_date">Up to Date</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-[4px] border border-[#E5E7EB] px-2 py-2 text-[12px] bg-white w-full md:w-auto">
            <option value="urgency_desc">Sort by: Priority High-Low</option>
            <option value="urgency_asc">Sort by: Priority Low-High</option>
            <option value="days_desc">Sort by: Days Overdue Desc</option>
            <option value="days_asc">Sort by: Days Overdue Asc</option>
            <option value="name_asc">Sort by: Name</option>
          </select>
        </div>
      </div>

      {/* Urgency filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 flex-nowrap md:flex-wrap">
        {(['all', 'Critical', 'High', 'Medium', 'Low'] as const).map((v) => {
          const count = v === 'all' ? patients.length : patients.filter((p) => p.urgency_label === v).length
          const active = priorityFilter === v
          const pillColors: Record<string, string> = {
            Critical: active ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]' : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#FECACA] hover:text-[#991B1B]',
            High: active ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#FDE68A] hover:text-[#92400E]',
            Medium: active ? 'bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]' : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#BFDBFE] hover:text-[#1E40AF]',
            Low: active ? 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]' : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#CBD5E1] hover:text-[#475569]',
            all: active ? 'bg-[#f0f9ff] text-[#028090] border-[#e2e8f0]' : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#f0f9ff]',
          }
          return (
            <button
              key={v}
              onClick={() => setPriorityFilter(v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${pillColors[v]}`}
            >
              {v === 'all' ? 'All urgency' : v}
              {!loading && <span className="font-mono text-[10px] opacity-70">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[6px] border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center justify-between px-[18px] py-[11px] border-b border-[#F3F4F6]">
          <div className="text-[12px] text-[#6B7280]">
            Showing <strong className="text-[#111] font-medium">{loading ? '…' : `${filtered.length} patients`}</strong>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#9CA3AF]">
            <svg className="h-5 w-5 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-[13px]">Loading patients…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-[#9CA3AF]">
            <svg className="h-8 w-8 text-[#E5E7EB]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <span className="text-[13px]">No patients match your search.</span>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f0f9ff]">
                <th className="w-9 px-4 py-2.5 border-b border-[#F3F4F6]">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-[#D1D5DB] accent-[#028090] cursor-pointer"
                  />
                </th>
                {['Patient', 'Age', 'Days Overdue', 'Last Well Visit', 'Urgency', 'Status', 'Action', ''].map((h) => (
                  <th
                    key={h}
                    className={[
                      'px-4 py-2.5 text-left text-[11px] font-medium text-[#6B7280] uppercase tracking-[.06em] border-b border-[#F3F4F6] whitespace-nowrap',
                      h === 'Action' ? 'min-w-[260px]' : '',
                      (h === 'Age' || h === 'Last Well Visit' || h === 'Status' || h === 'Action' || h === '') ? 'hidden md:table-cell' : '',
                    ].join(' ')}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((patient) => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  isContacting={contactingId === patient.id}
                  isSelected={selectedPatientId === patient.id}
                  isChecked={selectedRows.has(patient.id)}
                  onMarkContacted={handleMarkContacted}
                  onGenerateScript={handleGenerateScript}
                  onRowClick={openPatientPanel}
                  onCheckChange={toggleRow}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedRows.size > 0 && (
        <div className="fixed bottom-0 left-0 md:left-[220px] right-0 z-30 flex items-center justify-between px-4 md:px-7 py-3 bg-white border-t border-[#e2e8f0] shadow-lg">
          <span className="text-[13px] text-[#374151]">
            <strong className="font-semibold text-[#111]">{selectedRows.size}</strong>{' '}
            patient{selectedRows.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-[12px] text-[#6B7280] hover:text-[#374151] transition-colors"
            >
              Clear selection
            </button>
            <button
              onClick={() => {
                const ids = [...selectedRows]
                const names = patients.filter((p) => ids.includes(p.id)).map((p) => `${p.first_name} ${p.last_name}`)
                requestDelete(ids, names)
              }}
              className="text-[12px] font-medium px-4 py-2 rounded-[4px] border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
            >
              Delete selected
            </button>
            <button
              onClick={handleBulkMarkContacted}
              disabled={bulkContacting}
              className="text-[12px] font-medium px-4 py-2 rounded-[4px] bg-[#028090] text-white hover:bg-[#025f6b] transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {bulkContacting ? '…' : 'Mark all as contacted'}
            </button>
          </div>
        </div>
      )}

      {/* Patient side panel */}
      {selectedPatient && (
        <PatientPanel
          patient={selectedPatient}
          encounters={encounters}
          encountersLoading={encountersLoading}
          isContacting={contactingId === selectedPatient.id}
          clinicConfig={clinicConfig}
          onClose={closePatientPanel}
          onGenerateScript={handleGenerateScript}
          onMarkContacted={handleMarkContacted}
          onDeleteRequest={(p) => requestDelete([p.id], [`${p.first_name} ${p.last_name}`])}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteModal({ open: false, patientIds: [], patientNames: [] })} />
          <div className="relative w-full max-w-md rounded-[6px] bg-white p-6 shadow-lg ring-1 ring-[#e2e8f0]">
            <h2 className="text-[15px] font-semibold text-[#111] mb-1">
              Delete {deleteModal.patientNames.length === 1 ? deleteModal.patientNames[0] : `${deleteModal.patientNames.length} patients`}?
            </h2>
            <p className="text-[13px] text-[#6B7280] mb-5">
              This will permanently delete {deleteModal.patientNames.length === 1 ? 'this patient' : 'these patients'} and all their encounter history. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal({ open: false, patientIds: [], patientNames: [] })}
                className="flex-1 text-[13px] font-medium px-3 py-2.5 rounded-[4px] border border-[#E5E7EB] text-[#374151] hover:bg-[#f0f9ff] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePatients}
                disabled={deleting}
                className="flex-1 text-[13px] font-medium px-3 py-2.5 rounded-[4px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#111] text-white text-[13px] font-medium px-4 py-2.5 rounded-[8px] shadow-md whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* AI Script modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModal((m) => ({ ...m, open: false }))} />
          <div className="relative w-full max-w-lg rounded-[6px] bg-white p-6 shadow-lg ring-1 ring-[#e2e8f0]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f0f9ff]">
                    <svg className="h-3.5 w-3.5 text-[#028090]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-semibold text-[#111]">AI Phone Script</h2>
                </div>
                <p className="text-xs text-[#6B7280] ml-8">{modal.patientName}</p>
              </div>
              <button
                onClick={() => setModal((m) => ({ ...m, open: false }))}
                className="rounded-[4px] p-1.5 text-[#9CA3AF] hover:bg-[#f0f9ff] hover:text-[#374151] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {modal.loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#9CA3AF]">
                <svg className="h-5 w-5 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-sm">Generating script…</span>
              </div>
            ) : (() => {
              const isEnglish = !modal.preferredLanguage || modal.preferredLanguage.toLowerCase() === 'english'
              const displayed = scriptView === 'english' ? scriptEnglish : modal.script
              return (
                <>
                  {!isEnglish && (
                    <div className="mb-3">
                      <div className="flex rounded-[4px] border border-[#E5E7EB] overflow-hidden text-[12px] mb-2">
                        <button
                          onClick={() => setScriptView('original')}
                          className={`flex-1 py-1.5 px-3 flex items-center justify-center gap-1 transition-colors border-r border-[#E5E7EB] ${
                            scriptView === 'original' ? 'bg-[#f0f9ff] text-[#05668d] font-medium' : 'text-[#6B7280] hover:bg-[#f0f9ff]'
                          }`}
                        >
                          🌍 Original ({modal.preferredLanguage})
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
                                body: JSON.stringify({ script: modal.script }),
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
                      <span className="text-sm">Translating…</span>
                    </div>
                  ) : (
                    <div className="rounded-[6px] bg-[#f0f9ff] p-4 text-sm leading-relaxed text-[#374151] whitespace-pre-wrap max-h-72 overflow-y-auto ring-1 ring-[#e2e8f0]">
                      {displayed}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        const subject = encodeURIComponent(`Appointment Reminder - ${modal.patientName}`)
                        const body = encodeURIComponent(displayed)
                        window.open(`mailto:${modal.patientEmail}?subject=${subject}&body=${body}`)
                      }}
                      disabled={!modal.patientEmail || scriptTranslating}
                      title={!modal.patientEmail ? 'No email address on file' : undefined}
                      className="flex-1 rounded-[4px] border border-[#e2e8f0] bg-[#f0f9ff] py-2.5 text-sm font-medium text-[#05668d] hover:bg-[#dbeafe] transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                      Send via email
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(displayed)}
                      disabled={scriptTranslating}
                      className="flex-1 rounded-[4px] bg-[#028090] py-2.5 text-sm font-medium text-white hover:bg-[#025f6b] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                      Copy to clipboard
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

function PatientRow({
  patient,
  isContacting,
  isSelected,
  isChecked,
  onMarkContacted,
  onGenerateScript,
  onRowClick,
  onCheckChange,
}: {
  patient: Patient
  isContacting: boolean
  isSelected: boolean
  isChecked: boolean
  onMarkContacted: (p: Patient) => void
  onGenerateScript: (p: Patient) => void
  onRowClick: (p: Patient) => void
  onCheckChange: (id: string) => void
}) {
  const isContacted = patient.outreach_status === 'contacted'
  const initials = `${patient.first_name[0]}${patient.last_name[0]}`
  const urgencyBadge = URGENCY_BADGE[patient.urgency_label] ?? 'bg-[#F3F4F6] text-[#374151]'
  const statusBadge = STATUS_BADGE[patient.outreach_status] ?? 'bg-[#F3F4F6] text-[#6B7280]'
  const daysClass =
    patient.days_overdue >= 180 ? 'font-mono font-bold text-[14px] text-[#B91C1C]'
    : patient.days_overdue >= 90 ? 'font-mono font-bold text-[14px] text-[#B45309]'
    : patient.days_overdue >= 45 ? 'font-mono font-medium text-[13px] text-[#1D4ED8]'
    : 'font-mono font-medium text-[13px] text-[#6B7280]'
  const urgencyRowBg = URGENCY_ROW[patient.urgency_label] ?? 'hover:bg-[#F8FAFC]'

  return (
    <tr
      className={`border-b border-[#f0f9ff] last:border-0 transition-colors cursor-pointer ${
        isSelected ? 'bg-[#F8FBFC]' : isChecked ? 'bg-[#F8FBFC]' : urgencyRowBg
      }`}
      onClick={() => onRowClick(patient)}
    >
      <td className="w-9 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onCheckChange(patient.id)}
          className="w-4 h-4 rounded border-[#D1D5DB] accent-[#028090] cursor-pointer"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 cursor-pointer hover:ring-2 hover:ring-[#028090] hover:ring-offset-1 transition-all ${urgencyBadge}`}>
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-semibold text-[#111]">{patient.first_name} {patient.last_name}</span>
              {!patient.date_of_birth && (
                <span title="Missing date of birth — urgency estimate only" className="cursor-help">
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" className="text-[#D97706]">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                  </svg>
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#9CA3AF] font-mono mt-px">
              {patient.patient_identifier ?? `ID-${patient.id.slice(0, 6)}`}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[13px] text-[#374151] hidden md:table-cell">{ageDisplay(patient)}</td>
      <td className="px-4 py-3">
        <span className={daysClass}>{patient.days_overdue} days</span>
      </td>
      <td className="px-4 py-3 text-[12px] text-[#6B7280] hidden md:table-cell">—</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-[3px] rounded-full ${urgencyBadge}`}>
          {patient.urgency_label}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-[3px] rounded-full capitalize ${statusBadge}`}>
          {patient.outreach_status ?? 'pending'}
        </span>
      </td>
      <td className="px-4 py-3 min-w-[260px] hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onGenerateScript(patient)}
            disabled={isContacted}
            className="inline-flex items-center justify-center gap-1 w-[100px] whitespace-nowrap text-[11px] font-medium px-2.5 py-[5px] rounded-[5px] border border-[#e2e8f0] bg-[#f0f9ff] text-[#05668d] hover:bg-[#dbeafe] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✦ AI script
          </button>
          <button
            onClick={() => onMarkContacted(patient)}
            disabled={isContacting}
            className={`group flex items-center justify-center w-[140px] whitespace-nowrap text-sm font-medium py-1.5 rounded-[5px] transition-colors ${
              isContacting
                ? 'bg-[#028090]/50 text-white cursor-wait'
                : isContacted
                ? 'bg-[#00a896] text-white hover:bg-[#007a6e]'
                : 'bg-[#028090] text-white hover:bg-[#025f6b]'
            }`}
          >
            {isContacting ? '…' : isContacted ? (
              <>
                <span className="group-hover:hidden">✓ Contacted</span>
                <span className="hidden group-hover:inline">Unmark</span>
              </>
            ) : 'Mark contacted'}
          </button>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center w-7 h-7 rounded-[5px] text-[#9CA3AF] cursor-pointer hover:bg-[#F3F4F6] text-[16px] tracking-wider">···</div>
      </td>
    </tr>
  )
}

function getPatientAgeMonths(patient: Patient): number {
  if (patient.date_of_birth) {
    const dob = new Date(patient.date_of_birth)
    const today = new Date()
    return (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth())
  }
  return patient.age * 12
}

function PatientPanel({
  patient,
  encounters,
  encountersLoading,
  isContacting,
  clinicConfig,
  onClose,
  onGenerateScript,
  onMarkContacted,
  onDeleteRequest,
}: {
  patient: Patient
  encounters: Encounter[]
  encountersLoading: boolean
  isContacting: boolean
  clinicConfig: ClinicTypeConfig
  onClose: () => void
  onGenerateScript: (p: Patient) => void
  onMarkContacted: (p: Patient) => void
  onDeleteRequest: (p: Patient) => void
}) {
  const isContacted = patient.outreach_status === 'contacted'
  const badge = URGENCY_BADGE[patient.urgency_label] ?? 'bg-[#F3F4F6] text-[#374151]'
  const daysClass =
    patient.days_overdue >= 180 ? 'font-mono font-bold text-[14px] text-[#B91C1C]'
    : patient.days_overdue >= 90 ? 'font-mono font-bold text-[14px] text-[#B45309]'
    : patient.days_overdue >= 45 ? 'font-mono font-medium text-[13px] text-[#1D4ED8]'
    : 'font-mono font-medium text-[13px] text-[#6B7280]'
  const visitGuidance = clinicConfig.visitScheduleGuidance.find((g) => g.condition(getPatientAgeMonths(patient)))

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:w-[380px] z-50 bg-white shadow-md border-l border-[#e2e8f0] flex flex-col overflow-hidden">
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
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-[3px] rounded-full ${badge}`}>
              {patient.urgency_label}
            </span>
            <span className={daysClass}>
              {patient.days_overdue} days overdue
            </span>
          </div>

          <div className="bg-[#f0f9ff] rounded-[8px] p-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <InfoField label="Age" value={ageDisplay(patient)} />
            <InfoField label="Language" value={patient.preferred_language ?? '—'} />
            <InfoField label="Phone" value={patient.home_phone ?? '—'} />
            <InfoField label="Email" value={patient.email_address ?? '—'} wide />
            {visitGuidance && (
              <div className="col-span-2 pt-1 border-t border-[#e2e8f0]">
                <div className="text-[9px] uppercase tracking-[.06em] text-[#9CA3AF] font-medium mb-0.5">Visit Schedule</div>
                <div className="text-[11px] text-[#374151]">{visitGuidance.message}</div>
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[.08em] font-semibold text-[#9CA3AF] mb-3">
              Encounter History
            </div>
            {encountersLoading ? (
              <div className="flex items-center justify-center py-8 text-[#9CA3AF] gap-2">
                <svg className="h-4 w-4 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-[12px]">Loading encounters…</span>
              </div>
            ) : encounters.length === 0 ? (
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
        </div>

        <div className="px-5 py-4 border-t border-[#F3F4F6] flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onGenerateScript(patient)}
            disabled={isContacted}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2.5 rounded-[4px] border border-[#e2e8f0] bg-[#f0f9ff] text-[#05668d] hover:bg-[#dbeafe] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✦ Generate AI script
          </button>
          <button
            onClick={() => onMarkContacted(patient)}
            disabled={isContacting}
            className={`group w-full text-[12px] font-medium px-3 py-2.5 rounded-[4px] transition-colors ${
              isContacting
                ? 'bg-[#028090]/50 text-white cursor-wait'
                : isContacted
                ? 'bg-[#00a896] text-white hover:bg-[#007a6e]'
                : 'bg-[#028090] text-white hover:bg-[#025f6b]'
            }`}
          >
            {isContacting ? '…' : isContacted ? (
              <>
                <span className="group-hover:hidden">✓ Contacted</span>
                <span className="hidden group-hover:inline">Unmark</span>
              </>
            ) : 'Mark contacted'}
          </button>
          <button
            onClick={() => onDeleteRequest(patient)}
            className="w-full text-[12px] font-medium px-3 py-2 rounded-[4px] text-[#DC2626] hover:bg-[#FEF2F2] border border-[#FECACA] transition-colors mt-1"
          >
            Delete patient
          </button>
        </div>
      </div>
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
