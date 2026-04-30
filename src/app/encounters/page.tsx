'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, fetchAllPatients, type Patient } from '@/lib/supabase'
import { computeUrgency, getPatientAgeMonths } from '@/lib/urgency'
import { useClinic } from '@/context/ClinicContext'
import { useClinicConfig } from '@/hooks/useClinicConfig'
import PatientDrawer from '@/components/PatientDrawer'
import { DIAGNOSIS_CODES } from '@/config/diagnosisCodes'

type EncounterRow = {
  id?: string
  patient_record_number: string
  encounter_date: string
  visit_type: string
  care_category: string
  icd_code?: string | null
  diagnosis: string
  notes?: string | null
  showed_up?: boolean | null
  appointment_time?: string | null
  attended?: string | null
}

type EncounterWithPatient = EncounterRow & { patient: Patient }

type CodeRow = {
  id: string
  code: string
  description: string
  careCategory: string
  visitType: string
  clinicTypes: string[]
}

const VISIT_BADGE: Record<string, string> = {
  'Well visit': 'bg-[#D1FAE5] text-[#065F46]',
  'Well Child': 'bg-[#D1FAE5] text-[#065F46]',
  'Office visit': 'bg-[#D1FAE5] text-[#065F46]',
  'Office Visit': 'bg-[#D1FAE5] text-[#065F46]',
  'Follow-up': 'bg-[#FEF3C7] text-[#92400E]',
  'Follow-up Visit': 'bg-[#FEF3C7] text-[#92400E]',
  'Prenatal': 'bg-[#FCE7F3] text-[#9D174D]',
  'Prenatal Visit': 'bg-[#FCE7F3] text-[#9D174D]',
  'Emergency': 'bg-[#FEE2E2] text-[#991B1B]',
  'Sick Visit': 'bg-[#FEF3C7] text-[#92400E]',
  'Mental Health Visit': 'bg-[#EDE9FE] text-[#5B21B6]',
  'Immunization Visit': 'bg-[#F0FBF7] text-[#065F46]',
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

const ATTENDED_BADGE: Record<string, string> = {
  yes: 'bg-[#D1FAE5] text-[#065F46]',
  no: 'bg-[#FEE2E2] text-[#991B1B]',
  na: 'bg-[#F3F4F6] text-[#6B7280]',
}

const ATTENDED_LABEL: Record<string, string> = {
  yes: 'Attended',
  no: 'No Show',
  na: 'Upcoming',
}

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

const CARE_CATEGORIES = [
  'Preventive',
  'Acute',
  'Chronic',
  'Mental Health',
  'Developmental',
  'Immunization',
  'Prenatal',
  'General',
]

const FALLBACK_CODES: CodeRow[] = Object.entries(DIAGNOSIS_CODES).map(([code, meta]) => ({
  id: code,
  code,
  description: meta.description,
  careCategory: meta.careCategory,
  visitType: meta.visitType,
  clinicTypes: meta.clinicTypes,
}))

function diagnosisLabel(code: string): string {
  if (!code) return '—'
  const t = code.trim()
  return DIAGNOSIS_CODES[t]?.description ?? t
}


function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatApptTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

const PAGE_SIZE = 50

const EMPTY_VISIT = {
  patient_record_number: '',
  patient_name: '',
  first_name: '',
  encounter_date: today(),
  appointment_time: '',
  visit_type: '',
  care_category: '',
  icd_code: '',
  diagnosis_description: '',
  notes: '',
}

export default function EncountersPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientMap, setPatientMap] = useState<Map<string, Patient>>(new Map())
  const [pageEncounters, setPageEncounters] = useState<EncounterWithPatient[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [visitFilter, setVisitFilter] = useState('All visit types')
  const [careFilter, setCareFilter] = useState('All care categories')
  const [sortDesc, setSortDesc] = useState(true)
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [codesLoading, setCodesLoading] = useState(true)
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [showedUp, setShowedUp] = useState<boolean | null>(null)

  const [newVisit, setNewVisit] = useState(EMPTY_VISIT)

  // Edit encounter modal
  const [editEncounter, setEditEncounter] = useState<EncounterWithPatient | null>(null)
  const [editForm, setEditForm] = useState<{
    appointment_time: string
    attended: string
    icd_code: string
    diagnosis_description: string
    visit_type: string
    notes: string
  } | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editCodeQuery, setEditCodeQuery] = useState('')
  const [showEditCodeDrop, setShowEditCodeDrop] = useState(false)
  const editCodeRef = useRef<HTMLDivElement>(null)

  // Patient combobox
  const [patientQuery, setPatientQuery] = useState('')
  const [showPatientDrop, setShowPatientDrop] = useState(false)
  const patientRef = useRef<HTMLDivElement>(null)

  // Code combobox
  const [codeQuery, setCodeQuery] = useState('')
  const [showCodeDrop, setShowCodeDrop] = useState(false)
  const codeRef = useRef<HTMLDivElement>(null)

  const [drawerPatientId, setDrawerPatientId] = useState<string | null>(null)
  const { clinicId, clinicType, loading: clinicLoading } = useClinic()
  useClinicConfig()

  // Load codes from Supabase, merge with DIAGNOSIS_CODES metadata
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

  async function loadPage(
    page: number,
    map?: Map<string, Patient>,
    cid?: string | null,
    vf?: string,
    cf?: string,
  ) {
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const pmap = map ?? patientMap
    const currentClinicId = cid !== undefined ? cid : clinicId
    const currentVF = vf !== undefined ? vf : visitFilter
    const currentCF = cf !== undefined ? cf : careFilter

    let query = supabase
      .from('encounters')
      .select('*', { count: 'exact' })
      .eq('clinic_id', currentClinicId)
      .order('encounter_date', { ascending: false })
      .range(from, to)

    if (currentVF && currentVF !== 'All visit types') {
      query = query.eq('visit_type', currentVF)
    }
    if (currentCF && currentCF !== 'All care categories') {
      query = query.eq('care_category', currentCF)
    }

    const { data, error, count } = await query

    if (!error && data) {
      const joined = (data as EncounterRow[])
        .map((enc) => {
          const patient = pmap.get(enc.patient_record_number)
          if (!patient) return null
          return { ...enc, patient }
        })
        .filter((e): e is EncounterWithPatient => e !== null)
      setPageEncounters(joined)
      setTotalCount(count ?? 0)
    }
    setCurrentPage(page)
    setLoading(false)
  }

  // Load patients then first page of encounters
  useEffect(() => {
    if (clinicLoading || !clinicId) return
    setLoading(true)
    fetchAllPatients(clinicId).then(async (data) => {
      setPatients(data)
      const map = new Map(data.map((p) => [p.patient_identifier, p]))
      setPatientMap(map)
      await loadPage(1, map, clinicId)
    })
  }, [clinicId, clinicLoading])

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setShowPatientDrop(false)
      }
      if (codeRef.current && !codeRef.current.contains(e.target as Node)) {
        setShowCodeDrop(false)
      }
      if (editCodeRef.current && !editCodeRef.current.contains(e.target as Node)) {
        setShowEditCodeDrop(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Auto-clear success message after 5s
  useEffect(() => {
    if (!formMsg || formMsg.type !== 'ok') return
    const t = setTimeout(() => setFormMsg(null), 5000)
    return () => clearTimeout(t)
  }, [formMsg])

  // Patient suggestions: filter from already-loaded patients list
  const patientSuggestions = useMemo(() => {
    const q = patientQuery.toLowerCase().trim()
    if (!q) return []
    return patients
      .filter(
        (p) =>
          p.patient_identifier.toLowerCase().includes(q) ||
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q),
      )
      .slice(0, 10)
  }, [patients, patientQuery])

  // Filtered + grouped codes for the add visit combobox
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

  // Filtered + grouped codes for the edit modal combobox
  const editFilteredCodes = useMemo(() => {
    return codes.filter((c) => {
      const matchesClinic = !clinicType || c.clinicTypes.includes(clinicType)
      if (!editCodeQuery.trim()) return matchesClinic
      const q = editCodeQuery.toLowerCase()
      return matchesClinic && (c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    })
  }, [codes, editCodeQuery, clinicType])

  const editGroupedCodes = useMemo(() => {
    return editFilteredCodes.reduce<Record<string, CodeRow[]>>((acc, c) => {
      if (!acc[c.careCategory]) acc[c.careCategory] = []
      acc[c.careCategory].push(c)
      return acc
    }, {})
  }, [editFilteredCodes])

  // Client-side search filter on the current page (visit/care filters handled server-side)
  const filtered = useMemo(() => {
    return pageEncounters
      .filter((enc) => {
        const name = `${enc.patient.first_name} ${enc.patient.last_name}`.toLowerCase()
        return (
          search === '' ||
          name.includes(search.toLowerCase()) ||
          enc.patient.patient_identifier.toLowerCase().includes(search.toLowerCase())
        )
      })
      .sort((a, b) => {
        const da = a.encounter_date ?? ''
        const db = b.encounter_date ?? ''
        return sortDesc ? db.localeCompare(da) : da.localeCompare(db)
      })
  }, [pageEncounters, search, sortDesc])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function selectPatient(p: Patient) {
    setNewVisit((prev) => ({
      ...prev,
      patient_record_number: p.patient_identifier,
      patient_name: `${p.first_name} ${p.last_name}`,
      first_name: p.first_name,
    }))
    setPatientQuery(p.patient_identifier)
    setShowPatientDrop(false)
  }

  function selectCode(c: CodeRow) {
    setNewVisit((prev) => ({
      ...prev,
      icd_code: c.code,
      diagnosis_description: c.description,
      visit_type: c.visitType,
      care_category: c.careCategory,
    }))
    setCodeQuery(`${c.code}: ${c.description}`)
    setShowCodeDrop(false)
  }

  function selectEditCode(c: CodeRow) {
    setEditForm((prev) => prev ? {
      ...prev,
      icd_code: c.code,
      diagnosis_description: c.description,
      visit_type: c.visitType,
    } : prev)
    setEditCodeQuery(`${c.code}: ${c.description}`)
    setShowEditCodeDrop(false)
  }

  function resetForm() {
    setNewVisit({ ...EMPTY_VISIT, encounter_date: today() })
    setPatientQuery('')
    setCodeQuery('')
    setShowPatientDrop(false)
    setShowCodeDrop(false)
    setSubmitAttempted(false)
    setShowedUp(null)
  }

  function openEditEncounter(enc: EncounterWithPatient) {
    const descFromCode = enc.icd_code ? (DIAGNOSIS_CODES[enc.icd_code]?.description ?? '') : ''
    setEditEncounter(enc)
    setEditForm({
      appointment_time: enc.appointment_time ?? '',
      attended: enc.attended ?? 'na',
      icd_code: enc.icd_code ?? '',
      diagnosis_description: descFromCode,
      visit_type: enc.visit_type ?? '',
      notes: enc.notes ?? '',
    })
    setEditCodeQuery(enc.icd_code ? `${enc.icd_code}: ${descFromCode}` : '')
    setDeleteConfirm(false)
    setShowEditCodeDrop(false)
  }

  async function saveEditEncounter() {
    if (!editEncounter || !editForm) return
    setEditSubmitting(true)
    try {
      const diagnosisDisplay = editForm.icd_code && editForm.diagnosis_description
        ? `${editForm.icd_code} (${editForm.diagnosis_description})`
        : editForm.icd_code || editEncounter.diagnosis

      const { error } = await supabase
        .from('encounters')
        .update({
          appointment_time: editForm.appointment_time || null,
          attended: editForm.attended || null,
          icd_code: editForm.icd_code || null,
          diagnosis: diagnosisDisplay,
          visit_type: editForm.visit_type || editEncounter.visit_type,
          notes: editForm.notes || null,
        })
        .eq('id', editEncounter.id)

      if (error) throw error

      // Update row in local state immediately
      setPageEncounters((prev) =>
        prev.map((e) =>
          e.id === editEncounter.id
            ? {
                ...e,
                appointment_time: editForm.appointment_time || null,
                attended: editForm.attended || null,
                icd_code: editForm.icd_code,
                visit_type: editForm.visit_type || e.visit_type,
                notes: editForm.notes || null,
                diagnosis: diagnosisDisplay,
              }
            : e,
        ),
      )

      // If attendance changed to 'yes', recalculate urgency
      if (editForm.attended === 'yes' && editEncounter.attended !== 'yes' && clinicId) {
        const patient = editEncounter.patient
        const encDate = new Date(editEncounter.encounter_date + 'T00:00:00')
        const nowDate = new Date()
        const daysOverdue = Math.max(
          0,
          Math.floor((nowDate.getTime() - encDate.getTime()) / (1000 * 60 * 60 * 24)),
        )
        const { label, score } = computeUrgency(
          daysOverdue,
          clinicType ?? undefined,
          getPatientAgeMonths(patient),
        )
        await supabase
          .from('patients')
          .update({
            most_recent_visit_date: editEncounter.encounter_date,
            days_overdue: daysOverdue,
            urgency_label: label,
            urgency_score: score,
          })
          .eq('patient_identifier', patient.patient_identifier)
          .eq('clinic_id', clinicId)
      }

      setFormMsg({ type: 'ok', text: 'Encounter updated.' })
      setEditEncounter(null)
      setEditForm(null)
      setDeleteConfirm(false)
    } catch (err) {
      const supaErr = err as { message?: string }
      setFormMsg({ type: 'err', text: `Failed: ${supaErr?.message ?? 'Please try again.'}` })
    } finally {
      setEditSubmitting(false)
    }
  }

  async function deleteEncounter() {
    if (!editEncounter || !clinicId) return
    setEditSubmitting(true)
    try {
      const { error } = await supabase
        .from('encounters')
        .delete()
        .eq('id', editEncounter.id)
        .eq('clinic_id', clinicId)

      console.log('Delete error:', error)
      if (error) throw error

      // Only remove from local state after confirmed DB delete
      setPageEncounters((prev) => prev.filter((e) => e.id !== editEncounter.id))
      setTotalCount((c) => c - 1)
      setFormMsg({ type: 'ok', text: 'Encounter deleted.' })
      setEditEncounter(null)
      setEditForm(null)
      setDeleteConfirm(false)
    } catch (err) {
      const supaErr = err as { message?: string }
      setFormMsg({ type: 'err', text: `Delete failed: ${supaErr?.message ?? 'Please try again.'}` })
    } finally {
      setEditSubmitting(false)
    }
  }

  async function addVisit(e: React.FormEvent) {
    e.preventDefault()
    setFormMsg(null)
    setSubmitAttempted(true)

    console.log('=== ADD VISIT DEBUG ===')
    console.log('Patient:', newVisit.patient_record_number, newVisit.patient_name)
    console.log('Date:', newVisit.encounter_date)
    console.log('ICD code:', newVisit.icd_code)
    console.log('Diagnosis:', newVisit.diagnosis_description)
    console.log('Visit type:', newVisit.visit_type)
    console.log('Care category:', newVisit.care_category)
    console.log('Clinic ID:', clinicId)

    if (!newVisit.patient_record_number) {
      console.error('MISSING: patient')
      setFormMsg({ type: 'err', text: 'Please select a patient.' })
      return
    }
    if (!newVisit.icd_code) {
      console.error('MISSING: diagnosis code')
      setFormMsg({ type: 'err', text: 'Please select a diagnosis code.' })
      return
    }
    if (!newVisit.encounter_date) {
      console.error('MISSING: date')
      setFormMsg({ type: 'err', text: 'Please select an encounter date.' })
      return
    }

    setSubmitting(true)
    try {
      const diagnosisDisplay = newVisit.diagnosis_description
        ? `${newVisit.icd_code} (${newVisit.diagnosis_description})`
        : newVisit.icd_code

      const attendedValue =
        showedUp === true ? 'yes' : showedUp === false ? 'no' : 'na'

      const insertData = {
        clinic_id: clinicId,
        patient_record_number: newVisit.patient_record_number,
        first_name: newVisit.first_name || null,
        encounter_date: newVisit.encounter_date,
        icd_code: newVisit.icd_code || null,
        diagnosis: diagnosisDisplay || null,
        visit_type: newVisit.visit_type || null,
        care_category: newVisit.care_category || null,
        appointment_time: newVisit.appointment_time || null,
        attended: attendedValue || null,
        notes: newVisit.notes || null,
        showed_up: showedUp,
      }
      console.log('Inserting to Supabase:', insertData)

      const { data, error } = await supabase.from('encounters').insert(insertData).select()
      console.log('Supabase response data:', data)
      console.log('Supabase response error:', error)

      if (error) {
        console.error('SUPABASE ERROR:', error.message, '| Details:', error.details, '| Hint:', error.hint, '| Code:', error.code)
        throw error
      }

      const patient = patients.find((p) => p.patient_identifier === newVisit.patient_record_number)
      if (patient && clinicId) {
        const encDate = new Date(newVisit.encounter_date + 'T00:00:00')
        const nowDate = new Date()
        const daysOverdue = Math.max(0, Math.floor((nowDate.getTime() - encDate.getTime()) / (1000 * 60 * 60 * 24)))
        const { label, score } = computeUrgency(daysOverdue, clinicType ?? undefined, getPatientAgeMonths(patient))

        const { error: updateErr } = await supabase
          .from('patients')
          .update({
            most_recent_visit_date: newVisit.encounter_date,
            days_overdue: daysOverdue,
            urgency_label: label,
            urgency_score: score,
          })
          .eq('patient_identifier', newVisit.patient_record_number)
          .eq('clinic_id', clinicId)

        if (updateErr) console.error('Patient update error:', updateErr)
      }

      const name = newVisit.patient_name
      resetForm()
      setFormMsg({ type: 'ok', text: `Visit added for ${name}.` })
      console.log('SUCCESS — encounter added')

      // Refresh patients and jump to page 1 so new encounter appears at top
      fetchAllPatients(clinicId).then(async (freshPatients) => {
        setPatients(freshPatients)
        const map = new Map(freshPatients.map((p) => [p.patient_identifier, p]))
        setPatientMap(map)
        await loadPage(1, map, clinicId)
      })
    } catch (err) {
      console.error('addVisit caught error:', err)
      const supaErr = err as { message?: string }
      const detail = supaErr?.message ?? 'Please try again.'
      setFormMsg({ type: 'err', text: `Failed: ${detail}` })
    } finally {
      setSubmitting(false)
    }
  }

  const drawerPatient = drawerPatientId
    ? patients.find((p) => p.patient_identifier === drawerPatientId) ?? null
    : null

  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(currentPage * PAGE_SIZE, totalCount)

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-[26px] font-semibold text-[#111] tracking-tight">Encounters</h1>
        <p className="text-[12px] text-[#6B7280] mt-0.5">
          {loading
            ? '…'
            : `${totalCount.toLocaleString()} total visit records across ${patients.length} active patients`}
        </p>
      </div>

      {/* Filter controls */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-[4px] bg-white px-3 py-2 w-full md:w-72">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="#9CA3AF" strokeWidth="1.3" />
            <path d="M10 10l2.5 2.5" stroke="#9CA3AF" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search by patient name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[#374151] placeholder-[#9CA3AF] text-[13px]"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={visitFilter}
            onChange={(e) => {
              const v = e.target.value
              setVisitFilter(v)
              if (clinicId) loadPage(1, undefined, undefined, v, careFilter)
            }}
            className="flex-1 md:flex-none px-3 py-[7px] rounded-[4px] border border-[#E5E7EB] bg-white text-[12px] text-[#374151] cursor-pointer outline-none"
          >
            <option>All visit types</option>
            {VISIT_TYPES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            value={careFilter}
            onChange={(e) => {
              const c = e.target.value
              setCareFilter(c)
              if (clinicId) loadPage(1, undefined, undefined, visitFilter, c)
            }}
            className="flex-1 md:flex-none px-3 py-[7px] rounded-[4px] border border-[#E5E7EB] bg-white text-[12px] text-[#374151] cursor-pointer outline-none"
          >
            <option>All care categories</option>
            {CARE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => setSortDesc((s) => !s)}
            className="md:ml-auto flex items-center gap-1.5 px-3 py-[7px] rounded-[4px] border border-[#E5E7EB] bg-white text-[12px] text-[#374151] hover:bg-[#f0f9ff] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 4h9M4 6.5h5M6 9h1" stroke="#374151" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Sort by date {sortDesc ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* ── Add Visit form ── */}
      <form
        onSubmit={addVisit}
        className="bg-white border border-[#e2e8f0] rounded-[6px] p-4 flex flex-col gap-3"
      >
        <div className="text-[11px] font-semibold text-[#374151] uppercase tracking-[.07em]">
          Add Visit
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">

          {/* ── Field 1: Patient (searchable combobox) ── */}
          <div className="relative" ref={patientRef}>
            <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1">
              Patient <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              placeholder={loading ? 'Loading patients…' : 'Search name or ID…'}
              value={patientQuery}
              autoComplete="off"
              onFocus={() => {
                if (patientSuggestions.length > 0) setShowPatientDrop(true)
              }}
              onChange={(e) => {
                setPatientQuery(e.target.value)
                setShowPatientDrop(true)
                if (!e.target.value) {
                  setNewVisit((p) => ({ ...p, patient_record_number: '', patient_name: '' }))
                }
              }}
              className="w-full border border-[#E5E7EB] rounded-[4px] px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#028090] placeholder-[#9CA3AF]"
            />
            {newVisit.patient_name && (
              <div className="flex items-center gap-1 mt-0.5">
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <circle cx="4.5" cy="4.5" r="4.5" fill="#028090" />
                  <path d="M2.5 4.5l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[10px] text-[#028090] font-medium truncate">{newVisit.patient_name}</span>
              </div>
            )}
            {showPatientDrop && patientSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-[#E5E7EB] rounded-[4px] shadow-lg overflow-hidden">
                {patientSuggestions.map((p) => (
                  <button
                    key={p.patient_identifier}
                    type="button"
                    onMouseDown={() => selectPatient(p)}
                    className="w-full text-left px-3 py-2 hover:bg-[#f0f9ff] transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="text-[12px] font-semibold text-[#111]">
                      {p.first_name} {p.last_name}
                    </span>
                    <span className="text-[10px] font-mono text-[#9CA3AF] shrink-0">
                      {p.patient_identifier}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {showPatientDrop && patientQuery.trim() && patientSuggestions.length === 0 && !loading && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-[#E5E7EB] rounded-[4px] shadow-lg px-3 py-2.5 text-[12px] text-[#9CA3AF]">
                No patients found
              </div>
            )}
          </div>

          {/* ── Field 2: Encounter Date ── */}
          <div>
            <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1">
              Date <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="date"
              value={newVisit.encounter_date}
              onChange={(e) => setNewVisit((p) => ({ ...p, encounter_date: e.target.value }))}
              className="w-full border border-[#E5E7EB] rounded-[4px] px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#028090]"
            />
          </div>

          {/* ── Field 3: Appointment Time (optional) ── */}
          <div>
            <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1">
              Appt. time <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="time"
              value={newVisit.appointment_time}
              onChange={(e) => setNewVisit((p) => ({ ...p, appointment_time: e.target.value }))}
              className="w-full border border-[#E5E7EB] rounded-[4px] px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#028090]"
            />
          </div>

          {/* ── Field 4: Diagnosis Code (searchable combobox) ── */}
          <div className="relative" ref={codeRef}>
            <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1">
              Diagnosis Code <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              placeholder={codesLoading ? 'Loading codes…' : 'Search code or description…'}
              value={codeQuery}
              autoComplete="off"
              onFocus={() => setShowCodeDrop(true)}
              onChange={(e) => {
                setCodeQuery(e.target.value)
                setShowCodeDrop(true)
                if (!e.target.value) {
                  setNewVisit((p) => ({
                    ...p,
                    icd_code: '',
                    diagnosis_description: '',
                    visit_type: '',
                    care_category: '',
                  }))
                }
              }}
              className={`w-full border rounded-[4px] px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 placeholder-[#9CA3AF] ${
                submitAttempted && !newVisit.icd_code
                  ? 'border-[#DC2626] ring-1 ring-[#DC2626]'
                  : 'border-[#E5E7EB] focus:ring-[#028090]'
              }`}
            />
            {newVisit.icd_code ? (
              <div className="flex items-center gap-1 mt-0.5">
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <circle cx="4.5" cy="4.5" r="4.5" fill="#028090" />
                  <path d="M2.5 4.5l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[10px] font-mono text-[#028090] font-semibold">{newVisit.icd_code}</span>
                {newVisit.diagnosis_description && (
                  <span className="text-[10px] text-[#6B7280]">{newVisit.diagnosis_description}</span>
                )}
              </div>
            ) : submitAttempted ? (
              <p className="text-[10px] text-[#DC2626] mt-0.5">Select a diagnosis code before submitting.</p>
            ) : null}
            {showCodeDrop && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-[#E5E7EB] rounded-[4px] shadow-lg overflow-hidden max-h-64 overflow-y-auto">
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
                          <span className="font-mono text-[10px] text-[#6B7280] shrink-0 w-16">{c.code}</span>
                          <span className="text-[12px] text-[#374151]">{c.description}</span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Field 5: Visit Type (auto-filled, overridable) ── */}
          <div>
            <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1">
              Visit Type
            </label>
            <select
              value={newVisit.visit_type}
              onChange={(e) => setNewVisit((p) => ({ ...p, visit_type: e.target.value }))}
              className="w-full border border-[#E5E7EB] rounded-[4px] px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#028090] bg-white"
            >
              <option value="">Select type</option>
              {VISIT_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* ── Field 6: Notes (optional) ── */}
          <div>
            <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1">
              Notes <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Parent called back, interpreter needed…"
              value={newVisit.notes}
              onChange={(e) => setNewVisit((p) => ({ ...p, notes: e.target.value }))}
              className="w-full border border-[#E5E7EB] rounded-[4px] px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#028090] placeholder-[#9CA3AF]"
            />
          </div>

          {/* ── Field 7: Showed up toggle ── */}
          <div>
            <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1">
              Showed up
            </label>
            <div className="flex rounded-[4px] border border-[#E5E7EB] overflow-hidden text-[12px]">
              {([['Yes', true], ['No', false], ['Not yet', null]] as [string, boolean | null][]).map(([label, val]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => setShowedUp(showedUp === val ? null : val)}
                  className={`flex-1 py-1.5 text-center transition-colors ${
                    showedUp === val
                      ? val === true
                        ? 'bg-[#D1FAE5] text-[#065F46] font-medium'
                        : val === false
                          ? 'bg-[#FEE2E2] text-[#991B1B] font-medium'
                          : 'bg-[#F3F4F6] text-[#374151] font-medium'
                      : 'text-[#9CA3AF] hover:bg-[#f0f9ff]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Field 8: Submit ── */}
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#028090] text-white rounded-[4px] px-3 py-2 text-[12px] font-medium hover:bg-[#025f6b] transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {submitting ? 'Saving…' : 'Add visit'}
            </button>
          </div>
        </div>
      </form>

      {formMsg && (
        <div
          className={`text-[12px] px-3 py-2 rounded-[4px] flex items-center gap-2 ${
            formMsg.type === 'ok' ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEE2E2] text-[#991B1B]'
          }`}
        >
          {formMsg.type === 'ok' ? '✓' : '✕'} {formMsg.text}
        </div>
      )}

      {/* ── Encounters table ── */}
      <div className="bg-white rounded-[6px] border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#F3F4F6]">
          <div className="text-[12px] text-[#6B7280]">
            {loading ? (
              '…'
            ) : (
              <>
                Showing{' '}
                <strong className="text-[#111] font-medium">
                  {pageStart}–{pageEnd}
                </strong>{' '}
                of{' '}
                <strong className="text-[#111] font-medium">
                  {totalCount.toLocaleString()}
                </strong>{' '}
                encounters
              </>
            )}
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            {!loading && totalPages > 1 ? `Page ${currentPage} of ${totalPages}` : ''}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[13px] text-[#9CA3AF]">
            <svg className="h-5 w-5 animate-spin text-[#028090] mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#9CA3AF]">
            <span className="text-[13px]">No encounters match your filters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f0f9ff]">
                  {[
                    ['Patient', ''],
                    ['Encounter date', ''],
                    ['Visit type', ''],
                    ['Appt. attended', 'hidden md:table-cell'],
                    ['Diagnosis / care category', 'hidden md:table-cell'],
                    ['ICD code', 'hidden md:table-cell'],
                    ['Patient urgency', 'hidden md:table-cell'],
                    ['Action', 'hidden md:table-cell'],
                  ].map(([h, extra]) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-left text-[11px] font-medium text-[#6B7280] uppercase tracking-[.06em] border-b border-[#F3F4F6] whitespace-nowrap${extra ? ' ' + extra : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((enc, i) => {
                  const { patient } = enc
                  const initials = `${patient.first_name[0]}${patient.last_name[0]}`
                  const visitBadge =
                    VISIT_BADGE[enc.visit_type] ?? 'bg-[#F3F4F6] text-[#374151]'
                  const urgencyBadge =
                    URGENCY_BADGE[patient.urgency_label] ?? 'bg-[#F3F4F6] text-[#374151]'
                  const dateLabel = enc.encounter_date
                    ? new Date(enc.encounter_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'
                  const attendedKey = enc.attended ?? 'na'
                  const attendedBadge = ATTENDED_BADGE[attendedKey] ?? 'bg-[#F3F4F6] text-[#6B7280]'
                  const attendedText = ATTENDED_LABEL[attendedKey] ?? 'Upcoming'

                  const urgencyRowBg = URGENCY_ROW[patient.urgency_label] ?? 'hover:bg-[#FAFFFE]'
                  return (
                    <tr
                      key={i}
                      className={`border-b border-[#f0f9ff] last:border-0 transition-colors ${urgencyRowBg}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => setDrawerPatientId(patient.patient_identifier)}
                            className="w-[34px] h-[34px] rounded-full bg-[#f0f9ff] flex items-center justify-center text-[11px] font-semibold text-[#028090] shrink-0 cursor-pointer hover:ring-2 hover:ring-[#028090] hover:ring-offset-1 transition-all"
                          >
                            {initials}
                          </button>
                          <div>
                            <div className="text-[13px] font-semibold text-[#111]">
                              {patient.first_name} {patient.last_name}
                            </div>
                            <div className="text-[10px] text-[#9CA3AF] font-mono mt-px">
                              {patient.patient_identifier}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[12px] font-mono text-[#374151]">
                          {dateLabel}{enc.appointment_time ? ` · ${formatApptTime(enc.appointment_time)}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center text-[11px] font-medium px-2.5 py-[3px] rounded-full ${visitBadge}`}
                        >
                          {enc.visit_type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span
                          className={`inline-flex items-center text-[11px] font-medium px-2.5 py-[3px] rounded-full ${attendedBadge}`}
                        >
                          {attendedText}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-[12px] text-[#374151] max-w-[200px]">
                          {diagnosisLabel(enc.diagnosis)}
                        </div>
                        {enc.care_category && (
                          <div className="text-[10px] text-[#9CA3AF] font-mono mt-0.5">
                            {enc.care_category}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="font-mono text-[11px] text-[#6B7280]">
                          {enc.icd_code || enc.diagnosis || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span
                          className={`inline-flex items-center text-[11px] font-medium px-2.5 py-[3px] rounded-full ${urgencyBadge}`}
                        >
                          {patient.urgency_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <button
                          onClick={() => openEditEncounter(enc)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-[5px] rounded-[5px] border border-[#e2e8f0] bg-[#f0f9ff] text-[#05668d] hover:bg-[#caf0f8] transition-colors"
                        >
                          Edit encounter
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 py-4 flex-wrap">
            <button
              onClick={() => loadPage(currentPage - 1, undefined, undefined, visitFilter, careFilter)}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-md border border-[#E5E7EB] bg-white text-[13px] text-[#6B7280] flex items-center justify-center hover:bg-[#f0f9ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ‹
            </button>
            {getPageNumbers(currentPage, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="text-[13px] text-[#9CA3AF] px-1">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => loadPage(p as number, undefined, undefined, visitFilter, careFilter)}
                  className={`w-8 h-8 rounded-md border text-[13px] flex items-center justify-center transition-colors ${
                    currentPage === p
                      ? 'border-[#028090] bg-[#028090] text-white font-medium'
                      : 'border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#f0f9ff]'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => loadPage(currentPage + 1, undefined, undefined, visitFilter, careFilter)}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-md border border-[#E5E7EB] bg-white text-[13px] text-[#6B7280] flex items-center justify-center hover:bg-[#f0f9ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Patient drawer */}
      {drawerPatientId && clinicId && (
        <PatientDrawer
          patient_identifier={drawerPatientId}
          clinic_id={clinicId}
          onClose={() => setDrawerPatientId(null)}
          onPatientUpdated={() => {
            setDrawerPatientId(null)
            fetchAllPatients(clinicId).then(async (freshPatients) => {
              setPatients(freshPatients)
              const map = new Map(freshPatients.map((p) => [p.patient_identifier, p]))
              setPatientMap(map)
              await loadPage(currentPage, map, clinicId)
            })
          }}
        />
      )}

      {/* Edit Encounter modal */}
      {editEncounter && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditEncounter(null)
              setEditForm(null)
              setDeleteConfirm(false)
            }
          }}
        >
          <div className="bg-white rounded-[6px] shadow-lg w-full max-w-lg mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
              <div>
                <div className="text-[14px] font-semibold text-[#111]">Edit encounter</div>
                <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                  {editEncounter.patient.first_name} {editEncounter.patient.last_name} &middot;{' '}
                  {editEncounter.encounter_date
                    ? new Date(editEncounter.encounter_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditEncounter(null)
                  setEditForm(null)
                  setDeleteConfirm(false)
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 flex flex-col gap-4">

              {/* Appointment Time */}
              <div>
                <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1.5">
                  Appointment time <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="time"
                  value={editForm.appointment_time}
                  onChange={(e) => setEditForm((p) => p ? { ...p, appointment_time: e.target.value } : p)}
                  className="w-full border border-[#E5E7EB] rounded-[4px] px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#028090]"
                />
              </div>

              {/* Attendance Status */}
              <div>
                <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1.5">
                  Attendance status
                </label>
                <div className="flex rounded-[4px] border border-[#E5E7EB] overflow-hidden text-[12px]">
                  {([
                    ['Upcoming', 'na'],
                    ['Attended', 'yes'],
                    ['No Show', 'no'],
                  ] as [string, string][]).map(([label, val]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditForm((p) => p ? { ...p, attended: val } : p)}
                      className={`flex-1 py-2 text-center transition-colors ${
                        editForm.attended === val
                          ? val === 'yes'
                            ? 'bg-[#D1FAE5] text-[#065F46] font-medium'
                            : val === 'no'
                              ? 'bg-[#FEE2E2] text-[#991B1B] font-medium'
                              : 'bg-[#F3F4F6] text-[#374151] font-medium'
                          : 'text-[#9CA3AF] hover:bg-[#f0f9ff]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diagnosis Code */}
              <div className="relative" ref={editCodeRef}>
                <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1.5">
                  Diagnosis code
                </label>
                <input
                  type="text"
                  placeholder="Search code or description…"
                  value={editCodeQuery}
                  autoComplete="off"
                  onFocus={() => setShowEditCodeDrop(true)}
                  onChange={(e) => {
                    setEditCodeQuery(e.target.value)
                    setShowEditCodeDrop(true)
                    if (!e.target.value) {
                      setEditForm((p) => p ? { ...p, icd_code: '', diagnosis_description: '' } : p)
                    }
                  }}
                  className="w-full border border-[#E5E7EB] rounded-[4px] px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#028090] placeholder-[#9CA3AF]"
                />
                {editForm.icd_code && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] font-mono text-[#028090] font-semibold">{editForm.icd_code}</span>
                    {editForm.diagnosis_description && (
                      <span className="text-[10px] text-[#6B7280]">{editForm.diagnosis_description}</span>
                    )}
                  </div>
                )}
                {showEditCodeDrop && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-[#E5E7EB] rounded-[4px] shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {codesLoading ? (
                      <div className="px-3 py-3 text-[12px] text-[#9CA3AF]">Loading codes…</div>
                    ) : Object.keys(editGroupedCodes).length === 0 ? (
                      <div className="px-3 py-3 text-[12px] text-[#9CA3AF]">No matching codes</div>
                    ) : (
                      Object.entries(editGroupedCodes).map(([group, rows]) => (
                        <div key={group}>
                          <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-[.08em] text-[#9CA3AF] bg-[#f0f9ff] sticky top-0">
                            {group}
                          </div>
                          {rows.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => selectEditCode(c)}
                              className="w-full text-left px-3 py-2 hover:bg-[#f0f9ff] transition-colors flex items-center gap-2.5"
                            >
                              <span className="font-mono text-[10px] text-[#6B7280] shrink-0 w-16">{c.code}</span>
                              <span className="text-[12px] text-[#374151]">{c.description}</span>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Visit Type */}
              <div>
                <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1.5">
                  Visit type
                </label>
                <select
                  value={editForm.visit_type}
                  onChange={(e) => setEditForm((p) => p ? { ...p, visit_type: e.target.value } : p)}
                  className="w-full border border-[#E5E7EB] rounded-[4px] px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#028090] bg-white"
                >
                  <option value="">Select type</option>
                  {VISIT_TYPES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-medium text-[#6B7280] uppercase tracking-[.06em] mb-1.5">
                  Notes <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => p ? { ...p, notes: e.target.value } : p)}
                  placeholder="Add clinical notes or context…"
                  rows={3}
                  className="w-full border border-[#E5E7EB] rounded-[4px] px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#028090] placeholder-[#9CA3AF] resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#F3F4F6] bg-[#FAFAFA]">
              {/* Delete side */}
              <div>
                {deleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#991B1B]">Delete this encounter?</span>
                    <button
                      type="button"
                      onClick={deleteEncounter}
                      disabled={editSubmitting}
                      className="text-[11px] font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] px-2.5 py-1 rounded-[5px] transition-colors disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="text-[11px] text-[#6B7280] hover:text-[#374151] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="text-[11px] font-medium text-[#DC2626] hover:text-[#B91C1C] transition-colors"
                  >
                    Delete encounter
                  </button>
                )}
              </div>

              {/* Save / Cancel side */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditEncounter(null)
                    setEditForm(null)
                    setDeleteConfirm(false)
                  }}
                  className="px-3 py-1.5 text-[12px] text-[#374151] border border-[#E5E7EB] rounded-[6px] hover:bg-[#F3F4F6] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditEncounter}
                  disabled={editSubmitting}
                  className="px-4 py-1.5 text-[12px] font-medium text-white bg-[#028090] hover:bg-[#025f6b] rounded-[6px] transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  {editSubmitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suppress unused warning */}
      {drawerPatient && null}
    </div>
  )
}
