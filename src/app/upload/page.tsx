'use client'

import { useState, useRef } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { computeUrgency } from '@/lib/urgency'

// ── CSV parsing ──────────────────────────────────────────────────────────────
function parseCSVRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseCSVRow(lines[0]).map(h => h.trim())
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVRow(line)
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]))
  })
  return { headers, rows }
}

// ── Type detection ───────────────────────────────────────────────────────────
type CSVType = 'active-patients' | 'well-visits' | 'unknown'

function detectCSVType(headers: string[]): CSVType {
  if (headers.includes('Encounter')) return 'well-visits'
  if (headers.includes('Patient Identifier')) return 'active-patients'
  return 'unknown'
}

// ── Active Patients ──────────────────────────────────────────────────────────
type MappedPatient = {
  patient_identifier: string
  first_name: string
  middle_name: string
  last_name: string
  age: number
  date_of_birth: string | null
  most_recent_visit_date: string | null
  preferred_language: string
  sex: string
  home_phone: string
  mobile_phone: string
  email_address: string
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  postal_code: string
  active: string
  days_overdue: number
  urgency_label: string
  urgency_score: number
  clinic_id: string
  outreach_status: string
}

function parseMDY(str: string): Date | null {
  if (!str) return null
  const parts = str.split('/')
  if (parts.length === 3) {
    const [m, d, y] = parts
    const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`)
    return isNaN(dt.getTime()) ? null : dt
  }
  return null
}

function mdyToISO(str: string): string | null {
  if (!str) return null
  const parts = str.split('/')
  if (parts.length === 3) {
    const [m, d, y] = parts
    const s = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    return isNaN(Date.parse(s)) ? null : s
  }
  return null
}

function mapActivePatient(
  row: Record<string, string>,
  clinicId: string,
  clinicType: string | null,
): MappedPatient | null {
  const dobRaw = (row['Date of Birth'] ?? '').trim()
  if (!dobRaw) return null
  const ageRaw = (row['Age'] ?? '').replace(/\s*yrs?\.?/i, '').trim()
  const age = parseInt(ageRaw) || 0
  const visitDate = parseMDY(row['Most Recent Visit Date'] ?? '')
  let days_overdue = 0
  if (visitDate) {
    const daysSince = Math.floor((Date.now() - visitDate.getTime()) / 86400000)
    days_overdue = Math.max(0, daysSince - 365)
  }
  const { label: urgency_label, score: urgency_score } = computeUrgency(days_overdue, clinicType, age * 12)
  return {
    patient_identifier: row['Patient Identifier'] ?? '',
    first_name: row['Patient First Name'] ?? '',
    middle_name: row['Patient Middle Name'] ?? '',
    last_name: row['Patient Last Name'] ?? '',
    age,
    date_of_birth: mdyToISO(row['Date of Birth'] ?? ''),
    most_recent_visit_date: visitDate ? visitDate.toISOString().split('T')[0] : null,
    preferred_language: row['Preferred Language'] ?? '',
    sex: row['Sex'] ?? '',
    home_phone: row['Home Phone'] ?? '',
    mobile_phone: row['Mobile Phone'] ?? '',
    email_address: row['Email Address'] ?? row['Email address'] ?? '',
    address_line_1: row['Address Line 1'] ?? '',
    address_line_2: row['Address Line 2'] ?? '',
    city: row['City'] ?? '',
    state: row['State'] ?? '',
    postal_code: row['Postal Code'] ?? '',
    active: row['Active'] ?? 'Yes',
    days_overdue,
    urgency_label,
    urgency_score,
    clinic_id: clinicId,
    outreach_status: 'pending',
  }
}

// ── Well Visits ──────────────────────────────────────────────────────────────
const SNOMED_MAP: Record<string, { care_category: string; visit_type: string }> = {
  '185349003': { care_category: 'Office Visit', visit_type: 'Office Visit' },
  '410620009': { care_category: 'Well Child Visit', visit_type: 'Well Visit' },
  '444971000124105': { care_category: 'Annual Wellness', visit_type: 'Well Visit' },
  '73761001': { care_category: 'Well Baby Exam', visit_type: 'Well Visit' },
}
const ENC_REGEX = /Seen\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+for\s+(\d+)\s+\([^)]+\)\s+-\s+(.+)/i

type MappedEncounter = {
  patient_record_number: string
  encounter_date: string
  care_category: string
  visit_type: string
  diagnosis: string | null
  appointment_time: null
  attended: null
  notes: null
  showed_up: null
}

function mapWellVisitRows(rows: Record<string, string>[]): MappedEncounter[] {
  const result: MappedEncounter[] = []
  for (const row of rows) {
    const patientId = (row['Patient Identifier'] ?? row['Patient Record Number'] ?? '').trim()
    if (!patientId) continue
    const encParts = (row['Encounter'] ?? '').split(';').map(s => s.trim()).filter(Boolean)
    const diagParts = (row['Diagnosis'] ?? '').split(';').map(s => s.trim()).filter(Boolean)
    for (let i = 0; i < encParts.length; i++) {
      const m = ENC_REGEX.exec(encParts[i])
      if (!m) continue
      const [, dateStr, snomedCode, rest] = m
      const [mo, d, y] = dateStr.split('/')
      const encounter_date = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
      const visitText = (rest.split(' at ')[0] ?? rest).trim()
      const snomed = SNOMED_MAP[snomedCode]
      result.push({
        patient_record_number: patientId,
        encounter_date,
        care_category: snomed?.care_category ?? visitText,
        visit_type: snomed?.visit_type ?? visitText,
        diagnosis: diagParts[i] ?? null,
        appointment_time: null,
        attended: null,
        notes: null,
        showed_up: null,
      })
    }
  }
  return result
}

// ── Sample CSV data ──────────────────────────────────────────────────────────
const SAMPLE_ACTIVE_CSV = `# SAMPLE FILE - Replace with your real Practice Fusion export
Patient Identifier,Patient First Name,Patient Last Name,Age,DOB,Sex,Most Recent Visit Date,Preferred Language,Home Phone,Email Address
SAMPLE-001,Jane,Doe,35 yrs,01/01/1990,Female,01/01/2024,,( 555) 000-0001,sample1@example.com
SAMPLE-002,John,Doe,40 yrs,01/01/1985,Male,06/15/2023,,(555) 000-0002,sample2@example.com
SAMPLE-003,Sample,Patient,25 yrs,01/01/2000,Female,12/01/2022,,(555) 000-0003,sample3@example.com`

const SAMPLE_WELL_VISITS_CSV = `# SAMPLE FILE - Replace with your real Practice Fusion export
Patient Record Number,Patient First Name,Patient Last Name,Encounter,Diagnosis
SAMPLE-001,Jane,Doe,"Seen 01/01/2024 for 185349003 (SNOMED-CT) - Office Visit at Your Clinic Name","Z00.129 (Encounter for routine child health examination)"
SAMPLE-002,John,Doe,"Seen 01/01/2024 for 185349003 (SNOMED-CT) - Office Visit at Your Clinic Name","Z00.129 (Encounter for routine child health examination)"
SAMPLE-003,Sample,Patient,"Seen 01/01/2024 for 185349003 (SNOMED-CT) - Office Visit at Your Clinic Name","Z00.129 (Encounter for routine child health examination)"`

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Urgency badge ────────────────────────────────────────────────────────────
function UrgencyBadge({ label }: { label: string }) {
  const cls =
    label === 'Critical' ? 'bg-red-100 text-red-700'
    : label === 'High' ? 'bg-orange-100 text-orange-700'
    : label === 'Medium' ? 'bg-yellow-100 text-yellow-700'
    : 'bg-slate-100 text-slate-600'
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>{label}</span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const { clinicId, clinicName, clinicType, loading: clinicLoading } = useClinic()

  const [csvType, setCsvType] = useState<CSVType | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [patientRows, setPatientRows] = useState<MappedPatient[]>([])
  const [encounterRows, setEncounterRows] = useState<MappedEncounter[]>([])
  const [skippedNoDob, setSkippedNoDob] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; updated?: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setCsvType(null)
    setFileName(null)
    setPatientRows([])
    setEncounterRows([])
    setSkippedNoDob(0)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleFile(file: File) {
    reset()
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      const type = detectCSVType(headers)
      setCsvType(type)
      if (type === 'active-patients') {
        const mapped = rows
          .map(r => mapActivePatient(r, clinicId ?? '', clinicType))
        const valid = mapped.filter((r): r is MappedPatient => r !== null && !!r.patient_identifier)
        const noDob = mapped.filter(r => r === null).length
        setPatientRows(valid)
        setSkippedNoDob(noDob)
      } else if (type === 'well-visits') {
        setEncounterRows(mapWellVisitRows(rows))
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    setImporting(true)
    setError(null)
    try {
      if (csvType === 'active-patients') {
        const res = await fetch('/api/patients/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patients: patientRows }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Import failed'); return }
        setResult({ inserted: data.inserted, updated: data.updated, skipped: data.skipped })
      } else if (csvType === 'well-visits') {
        const res = await fetch('/api/encounters/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encounters: encounterRows }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Import failed'); return }
        setResult({ inserted: data.inserted, skipped: data.skipped })
      }
    } catch (err: any) {
      setError(err.message ?? 'Network error')
    } finally {
      setImporting(false)
    }
  }

  const isLoaded = csvType !== null
  const count = csvType === 'active-patients' ? patientRows.length : encounterRows.length
  const entity = csvType === 'active-patients' ? 'patients' : 'encounters'
  const canImport =
    isLoaded &&
    csvType !== 'unknown' &&
    !importing &&
    !result &&
    count > 0 &&
    (csvType === 'well-visits' || !!clinicId)

  if (clinicLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#9CA3AF] text-[13px]">
        Loading…
      </div>
    )
  }

  return (
    <div className="p-4 md:p-7 max-w-3xl flex flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="text-[26px] font-semibold text-[#111] tracking-tight">Upload CSV</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">
          Import patients or well visit encounters from Practice Fusion exports.
          {clinicName && <span className="ml-1 font-medium text-[#374151]">Clinic: {clinicName}</span>}
        </p>
      </div>

      {/* Sample downloads */}
      <div className="bg-white rounded-[6px] border border-[#e2e8f0] px-5 py-4">
        <p className="text-[11px] uppercase tracking-[.07em] font-semibold text-[#9CA3AF] mb-3">Sample files</p>
        <div className="flex items-start gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-[4px] px-3.5 py-2.5 mb-3">
          <svg className="h-4 w-4 text-[#D97706] shrink-0 mt-px" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-[12px] text-[#92400E]">
            <span className="font-semibold">Sample files contain placeholder data only.</span>{' '}
            Do not submit real patient information.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => downloadCSV('sample-active-patients.csv', SAMPLE_ACTIVE_CSV)}
            className="flex items-center gap-2 text-[12px] px-3.5 py-2 rounded-[4px] border border-[#E5E7EB] text-[#374151] hover:bg-[#f0f9ff] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10v1.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V10M7 2v7M4.5 6.5 7 9l2.5-2.5" stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download Sample: Active Patients CSV
          </button>
          <button
            onClick={() => downloadCSV('sample-well-visits.csv', SAMPLE_WELL_VISITS_CSV)}
            className="flex items-center gap-2 text-[12px] px-3.5 py-2 rounded-[4px] border border-[#E5E7EB] text-[#374151] hover:bg-[#f0f9ff] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10v1.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V10M7 2v7M4.5 6.5 7 9l2.5-2.5" stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download Sample: Well Visits CSV
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={[
          'border-2 border-dashed rounded-[6px] px-6 py-10 text-center cursor-pointer transition-colors',
          dragging
            ? 'border-[#028090] bg-[#e0fbfc]'
            : isLoaded
            ? 'border-[#028090] bg-[#e0fbfc]'
            : 'border-[#E5E7EB] hover:border-[#028090] hover:bg-[#e0fbfc]',
        ].join(' ')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {isLoaded ? (
          <div className="flex flex-col items-center gap-2.5">
            {csvType === 'active-patients' && (
              <div className="inline-flex items-center gap-1.5 bg-[#F0FBF7] border border-[#6EE7B7] text-[#065F46] text-[11px] font-semibold px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#028090] inline-block" />
                Active Patients CSV detected
              </div>
            )}
            {csvType === 'well-visits' && (
              <div className="inline-flex items-center gap-1.5 bg-[#F0FBF7] border border-[#6EE7B7] text-[#065F46] text-[11px] font-semibold px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] inline-block" />
                Well Visits CSV detected
              </div>
            )}
            {csvType === 'unknown' && (
              <div className="inline-flex items-center gap-1.5 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-[11px] font-semibold px-3 py-1 rounded-full">
                Unrecognised CSV format — headers must include &quot;Patient Identifier&quot; or &quot;Encounter&quot;
              </div>
            )}
            <p className="text-[13px] text-[#374151] font-medium">{fileName}</p>
            <button
              onClick={(e) => { e.stopPropagation(); reset() }}
              className="text-[11px] text-[#6B7280] underline hover:text-[#374151] transition-colors"
            >
              Choose a different file
            </button>
          </div>
        ) : (
          <>
            <svg className="mx-auto mb-3 h-9 w-9 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-[13px] text-[#6B7280]">
              Drop your CSV here or <span className="text-[#028090] font-medium">browse</span>
            </p>
            <p className="text-[11px] text-[#9CA3AF] mt-1">Active Patients or Well Visits — type is auto-detected from headers</p>
          </>
        )}
      </div>

      {/* No clinic warning for active-patients */}
      {csvType === 'active-patients' && !clinicId && (
        <div className="flex items-center gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] px-4 py-3">
          <svg className="h-4 w-4 text-[#D97706] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-[12px] text-[#92400E]">No clinic session — log in to assign patients to a clinic before importing.</span>
        </div>
      )}

      {/* Preview */}
      {isLoaded && csvType !== 'unknown' && count > 0 && (
        <div className="bg-white rounded-[6px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#F3F4F6] flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-[#374151]">Preview — first 5 rows</p>
            <div className="flex flex-col items-end gap-0.5">
              <p
                className="text-[12px] font-semibold shrink-0"
                style={{ color: csvType === 'active-patients' ? '#028090' : '#2563EB' }}
              >
                {count} {entity} will be imported
              </p>
              {csvType === 'active-patients' && skippedNoDob > 0 && (
                <p className="text-[11px] text-[#D97706] font-medium">
                  {skippedNoDob} {skippedNoDob === 1 ? 'patient' : 'patients'} skipped — missing date of birth
                </p>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-[#f0f9ff]">
                  {csvType === 'active-patients'
                    ? ['Patient ID', 'Name', 'Age', 'Last Visit', 'Language', 'Urgency'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-[#6B7280] border-b border-[#F3F4F6] whitespace-nowrap">{h}</th>
                      ))
                    : ['Patient ID', 'Date', 'Visit Type', 'Care Category', 'Diagnosis'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-[#6B7280] border-b border-[#F3F4F6] whitespace-nowrap">{h}</th>
                      ))
                  }
                </tr>
              </thead>
              <tbody>
                {csvType === 'active-patients'
                  ? patientRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-[#f0f9ff] last:border-0">
                        <td className="px-3 py-2 font-mono text-[#374151]">{row.patient_identifier}</td>
                        <td className="px-3 py-2 text-[#374151]">{row.first_name} {row.last_name}</td>
                        <td className="px-3 py-2 text-[#374151]">{row.age}</td>
                        <td className="px-3 py-2 text-[#374151]">{row.most_recent_visit_date ?? '—'}</td>
                        <td className="px-3 py-2 text-[#374151]">{row.preferred_language || '—'}</td>
                        <td className="px-3 py-2"><UrgencyBadge label={row.urgency_label} /></td>
                      </tr>
                    ))
                  : encounterRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-[#f0f9ff] last:border-0">
                        <td className="px-3 py-2 font-mono text-[#374151]">{row.patient_record_number}</td>
                        <td className="px-3 py-2 text-[#374151]">{row.encounter_date}</td>
                        <td className="px-3 py-2 text-[#374151]">{row.visit_type}</td>
                        <td className="px-3 py-2 text-[#374151]">{row.care_category}</td>
                        <td className="px-3 py-2 text-[#374151] max-w-[180px] truncate">{row.diagnosis ?? '—'}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
          {count > 5 && (
            <p className="text-[11px] text-[#9CA3AF] px-5 py-2 border-t border-[#F3F4F6]">
              …and {count - 5} more {entity}
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-center gap-3 bg-[#F0FBF7] border border-[#6EE7B7] rounded-[6px] px-5 py-4">
          <svg className="h-5 w-5 text-[#028090] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-[#065F46]">Import complete</p>
            <p className="text-[12px] text-[#028090] mt-0.5">
              {result.inserted} {entity} imported
              {result.updated !== undefined && ` · ${result.updated} updated`}
              {result.skipped > 0 && ` · ${result.skipped} skipped (duplicates)`}
              {skippedNoDob > 0 && ` · ${skippedNoDob} skipped (missing date of birth)`}
            </p>
          </div>
          <button
            onClick={reset}
            className="ml-auto text-[12px] text-[#028090] font-medium hover:underline shrink-0"
          >
            Import another
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] px-5 py-3">
          <svg className="h-4 w-4 text-[#DC2626] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-[12px] text-[#991B1B]">{error}</span>
        </div>
      )}

      {/* Import button */}
      {canImport && !result && (
        <div>
          <button
            onClick={handleImport}
            disabled={importing}
            className={[
              'flex items-center gap-2 text-[13px] font-medium px-5 py-2.5 rounded-[8px] text-white transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              csvType === 'active-patients'
                ? 'bg-[#028090] hover:bg-[#025f6b]'
                : 'bg-[#2563EB] hover:bg-[#1D4ED8]',
            ].join(' ')}
          >
            {importing && (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {importing ? 'Importing…' : `Import ${count} ${entity}`}
          </button>
        </div>
      )}

    </div>
  )
}
