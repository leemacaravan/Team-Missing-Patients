'use client'

import { useState, useRef, useEffect } from 'react'
import { useClinic } from '@/context/ClinicContext'

// ── SNOMED → care_category / visit_type ─────────────────────────────────────
const SNOMED_MAP: Record<string, { care_category: string; visit_type: string }> = {
  '185349003': { care_category: 'Office Visit', visit_type: 'Office Visit' },
  '410620009': { care_category: 'Well Child Visit', visit_type: 'Well Visit' },
  '444971000124105': { care_category: 'Annual Wellness', visit_type: 'Well Visit' },
  '73761001': { care_category: 'Well Baby Exam', visit_type: 'Well Visit' },
}

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

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseCSVRow(lines[0]).map((h) => h.trim())
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const values = parseCSVRow(line)
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]))
  })
}

// ── Patient row mapper ───────────────────────────────────────────────────────
function mapPatientRow(row: Record<string, string>, clinicId: string) {
  const dob = row['DOB (MM/DD/YYYY)'] ?? ''
  let date_of_birth = ''
  if (dob) {
    const parts = dob.split('/')
    if (parts.length === 3) {
      const [m, d, y] = parts
      date_of_birth = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  const ageRaw = parseInt(row['Age'] ?? '')
  return {
    patient_identifier: row['Patient Record Number'] ?? '',
    first_name: row['First name'] ?? '',
    middle_name: row['Middle name'] ?? '',
    last_name: row['Last name'] ?? '',
    date_of_birth,
    age: isNaN(ageRaw) ? null : ageRaw,
    sex: row['Sex'] ?? '',
    preferred_contact: row['Preferred contact'] ?? '',
    active: (row['Status'] ?? '').toLowerCase() === 'active' ? 'Yes' : 'No',
    address_line_1: row['Address Line 1'] ?? '',
    address_line_2: row['Address Line 2'] ?? '',
    city: row['City'] ?? '',
    state: row['State'] ?? '',
    postal_code: row['Postal Code'] ?? '',
    home_phone: row['Home Phone'] ?? '',
    mobile_phone: row['Mobile Phone'] ?? '',
    email_address: row['Email address'] ?? '',
    clinic_id: clinicId,
    outreach_status: 'pending',
  }
}

// ── Encounter string parser ──────────────────────────────────────────────────
const ENC_REGEX = /Seen (\d{2}\/\d{2}\/\d{4}) for .+ - (.+?) at (.+)/i
const SNOMED_REGEX = /for (\d+) \(/

function parseEncounterString(str: string) {
  const m = ENC_REGEX.exec(str ?? '')
  if (!m) return null
  const [, dateStr, visitText] = m
  const parts = dateStr.split('/')
  const encounter_date = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  const snomedMatch = SNOMED_REGEX.exec(str)
  const snomed = SNOMED_MAP[snomedMatch?.[1] ?? '']
  return {
    encounter_date,
    care_category: snomed?.care_category ?? visitText,
    visit_type: snomed?.visit_type ?? visitText,
  }
}

function mapEncounterRow(row: Record<string, string>, clinicId: string) {
  const parsed = parseEncounterString(row['Encounter'] ?? '')
  if (!parsed) return null

  const patient_record_number = (row['Patient Record Number'] ?? '').trim()
  const first_name = (row['First name'] ?? '').trim() || null
  const diagnosisRaw = (row['Diagnosis'] ?? '').trim()
  const icd_code = diagnosisRaw.split(' ')[0] || ''

  if (!patient_record_number || !parsed.encounter_date || !icd_code || !parsed.visit_type || !parsed.care_category || !clinicId) {
    return null
  }

  return {
    patient_record_number,
    first_name,
    encounter_date: parsed.encounter_date,
    icd_code,
    diagnosis: diagnosisRaw,
    visit_type: parsed.visit_type,
    care_category: parsed.care_category,
    clinic_id: clinicId,
  }
}

// ── Import log (localStorage) ────────────────────────────────────────────────
type ImportLog = {
  timestamp: string
  type: 'patients' | 'encounters'
  imported: number
  updated?: number
  skipped: number
  clinicId: string
}

function loadLog(): ImportLog[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('importLog') ?? '[]') } catch { return [] }
}

function saveToLog(entry: ImportLog) {
  const logs = loadLog()
  logs.unshift(entry)
  localStorage.setItem('importLog', JSON.stringify(logs.slice(0, 5)))
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ImportClient() {
  const { clinicId, clinicName, loading: clinicLoading } = useClinic()

  // Section A — patients
  const [patientRows, setPatientRows] = useState<Record<string, string>[]>([])
  const [patientImporting, setPatientImporting] = useState(false)
  const [patientResult, setPatientResult] = useState<{ inserted: number; updated: number; skipped: number } | null>(null)
  const [patientError, setPatientError] = useState<string | null>(null)
  const patientInputRef = useRef<HTMLInputElement>(null)

  // Section B — encounters
  const [encounterRawRows, setEncounterRawRows] = useState<Record<string, string>[]>([])
  const [encounterImporting, setEncounterImporting] = useState(false)
  const [encounterResult, setEncounterResult] = useState<{ inserted: number; skipped: number; failed: number } | null>(null)
  const [encounterError, setEncounterError] = useState<string | null>(null)
  const encounterInputRef = useRef<HTMLInputElement>(null)

  // Section C — log
  const [importLog, setImportLog] = useState<ImportLog[]>([])

  useEffect(() => {
    setImportLog(loadLog())
  }, [])

  function refreshLog() {
    setImportLog(loadLog())
  }

  // ── Patient file handler ─────────────────────────────────────────────────
  function handlePatientFile(file: File) {
    setPatientResult(null)
    setPatientError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      setPatientRows(rows)
    }
    reader.readAsText(file)
  }

  async function importPatients() {
    if (!clinicId || patientRows.length === 0) return
    setPatientImporting(true)
    setPatientError(null)
    try {
      const mapped = patientRows.map((r) => mapPatientRow(r, clinicId)).filter((r) => r.patient_identifier)
      const res = await fetch('/api/patients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients: mapped }),
      })
      const data = await res.json()
      if (!res.ok) { setPatientError(data.error ?? 'Import failed'); return }
      setPatientResult(data)
      saveToLog({ timestamp: new Date().toISOString(), type: 'patients', imported: data.inserted, updated: data.updated, skipped: data.skipped, clinicId: clinicId ?? '' })
      refreshLog()
    } catch (err: any) {
      setPatientError(err.message ?? 'Network error')
    } finally {
      setPatientImporting(false)
    }
  }

  // ── Encounter file handler ───────────────────────────────────────────────
  function handleEncounterFile(file: File) {
    setEncounterResult(null)
    setEncounterError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      setEncounterRawRows(rows)
    }
    reader.readAsText(file)
  }

  async function importEncounters() {
    if (!clinicId || encounterRawRows.length === 0) return
    setEncounterImporting(true)
    setEncounterError(null)
    try {
      const mapped = encounterRawRows.map((r) => mapEncounterRow(r, clinicId))
      const valid = mapped.filter((r): r is NonNullable<typeof r> => r !== null)
      const failed = mapped.length - valid.length

      if (valid.length === 0) {
        setEncounterResult({ inserted: 0, skipped: 0, failed })
        return
      }

      const res = await fetch('/api/encounters/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounters: valid, clinicId }),
      })
      const data = await res.json()
      if (!res.ok) { setEncounterError(data.error ?? 'Import failed'); return }
      setEncounterResult({ inserted: data.inserted, skipped: data.skipped, failed })
      saveToLog({ timestamp: new Date().toISOString(), type: 'encounters', imported: data.inserted, skipped: data.skipped, clinicId: clinicId ?? '' })
      refreshLog()
    } catch (err: any) {
      setEncounterError(err.message ?? 'Network error')
    } finally {
      setEncounterImporting(false)
    }
  }

  if (clinicLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#9CA3AF] text-[13px]">
        Loading clinic context…
      </div>
    )
  }

  return (
    <div className="p-4 md:p-7 max-w-3xl flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-[26px] font-semibold text-[#111] tracking-tight">Import Data</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">
          Import patients and encounter history from Practice Fusion CSV exports.
          {clinicName && <span className="ml-1 font-medium text-[#374151]">Clinic: {clinicName}</span>}
        </p>
      </div>

      {/* Section A — Patients */}
      <section className="bg-white rounded-[6px] border border-[#e2e8f0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#f0f9ff] flex items-center justify-center text-[12px] font-bold text-[#028090]">A</div>
            <h2 className="text-[14px] font-semibold text-[#111]">Import Patients</h2>
          </div>
          <p className="text-[12px] text-[#6B7280] mt-1 ml-8">
            Upload a Practice Fusion patient export CSV. Existing patients are updated; new ones are inserted.
          </p>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-[#E5E7EB] rounded-[8px] px-6 py-8 text-center cursor-pointer hover:border-[#028090] hover:bg-[#f0f9ff] transition-colors"
            onClick={() => patientInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handlePatientFile(file)
            }}
          >
            <input
              ref={patientInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePatientFile(f) }}
            />
            <svg className="mx-auto mb-2 h-8 w-8 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-[13px] text-[#6B7280]">
              {patientRows.length > 0
                ? <span className="font-medium text-[#028090]">{patientRows.length} rows loaded</span>
                : <>Drop CSV here or <span className="text-[#028090] font-medium">browse</span></>}
            </p>
          </div>

          {/* Preview */}
          {patientRows.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[.07em] font-semibold text-[#9CA3AF] mb-2">Preview (first 5 rows)</div>
              <div className="overflow-x-auto rounded-[4px] border border-[#F3F4F6]">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#f0f9ff]">
                      {['Patient Record #', 'Name', 'DOB', 'Age', 'Status', 'Phone', 'Email'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-[#6B7280] border-b border-[#F3F4F6] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patientRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-[#f0f9ff] last:border-0">
                        <td className="px-3 py-2 font-mono text-[#374151]">{row['Patient Record Number']}</td>
                        <td className="px-3 py-2 text-[#374151]">{row['First name']} {row['Last name']}</td>
                        <td className="px-3 py-2 text-[#374151]">{row['DOB (MM/DD/YYYY)']}</td>
                        <td className="px-3 py-2 text-[#374151]">{row['Age']}</td>
                        <td className="px-3 py-2 text-[#374151]">{row['Status']}</td>
                        <td className="px-3 py-2 text-[#374151]">{row['Home Phone']}</td>
                        <td className="px-3 py-2 text-[#374151]">{row['Email address']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {patientRows.length > 5 && (
                <p className="text-[11px] text-[#9CA3AF] mt-1.5">…and {patientRows.length - 5} more rows</p>
              )}
            </div>
          )}

          {/* Result badge */}
          {patientResult && (
            <div className="flex items-center gap-3 bg-[#F0FBF7] border border-[#6EE7B7] rounded-[4px] px-4 py-3">
              <svg className="h-4 w-4 text-[#028090] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="text-[12px] font-medium text-[#065F46]">
                {patientResult.inserted} imported · {patientResult.updated} updated · {patientResult.skipped} skipped
              </span>
            </div>
          )}

          {/* Error */}
          {patientError && (
            <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-[4px] px-4 py-3">
              <span className="text-[12px] text-[#991B1B]">{patientError}</span>
            </div>
          )}

          {/* Import button */}
          <button
            onClick={importPatients}
            disabled={patientRows.length === 0 || patientImporting || !clinicId}
            className="w-full sm:w-auto sm:self-start text-[13px] font-medium px-4 py-2.5 rounded-[4px] bg-[#028090] text-white hover:bg-[#025f6b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {patientImporting && (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {patientImporting ? 'Importing…' : `Import ${patientRows.length > 0 ? patientRows.length + ' ' : ''}patients`}
          </button>
        </div>
      </section>

      {/* Section B — Encounters */}
      <section className="bg-white rounded-[6px] border border-[#e2e8f0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#f0f9ff] flex items-center justify-center text-[12px] font-bold text-[#2563EB]">B</div>
            <h2 className="text-[14px] font-semibold text-[#111]">Import Encounters</h2>
          </div>
          <p className="text-[12px] text-[#6B7280] mt-1 ml-8">
            Upload a Practice Fusion encounter export CSV. Duplicate encounters (same patient + date + diagnosis) are skipped.
          </p>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-[#E5E7EB] rounded-[8px] px-6 py-8 text-center cursor-pointer hover:border-[#2563EB] hover:bg-[#f0f9ff] transition-colors"
            onClick={() => encounterInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleEncounterFile(file)
            }}
          >
            <input
              ref={encounterInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEncounterFile(f) }}
            />
            <svg className="mx-auto mb-2 h-8 w-8 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-[13px] text-[#6B7280]">
              {encounterRawRows.length > 0
                ? <span className="font-medium text-[#2563EB]">{encounterRawRows.length} encounters parsed</span>
                : <>Drop CSV here or <span className="text-[#2563EB] font-medium">browse</span></>}
            </p>
          </div>

          {/* Preview */}
          {encounterRawRows.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[.07em] font-semibold text-[#9CA3AF] mb-2">Preview (first 5 rows)</div>
              <div className="overflow-x-auto rounded-[4px] border border-[#F3F4F6]">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#f0f9ff]">
                      {['Patient #', 'Date', 'Visit Type', 'Care Category', 'Diagnosis'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-[#6B7280] border-b border-[#F3F4F6] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {encounterRawRows.slice(0, 5).map((row, i) => {
                      const enc = parseEncounterString(row['Encounter'] ?? '')
                      return (
                        <tr key={i} className="border-b border-[#f0f9ff] last:border-0">
                          <td className="px-3 py-2 font-mono text-[#374151]">{row['Patient Record Number']}</td>
                          <td className="px-3 py-2 text-[#374151]">{enc?.encounter_date ?? '—'}</td>
                          <td className="px-3 py-2 text-[#374151]">{enc?.visit_type ?? '—'}</td>
                          <td className="px-3 py-2 text-[#374151]">{enc?.care_category ?? '—'}</td>
                          <td className="px-3 py-2 text-[#374151]">{(row['Diagnosis'] ?? '').trim()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {encounterRawRows.length > 5 && (
                <p className="text-[11px] text-[#9CA3AF] mt-1.5">…and {encounterRawRows.length - 5} more rows</p>
              )}
            </div>
          )}

          {/* Result badge */}
          {encounterResult && (
            <div className="flex items-center gap-3 bg-[#F0FBF7] border border-[#6EE7B7] rounded-[4px] px-4 py-3">
              <svg className="h-4 w-4 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="text-[12px] font-medium text-[#065F46]">
                {encounterResult.inserted} encounters imported · {encounterResult.skipped} skipped (duplicates)
                {encounterResult.failed > 0 && ` · ${encounterResult.failed} failed (missing required fields)`}
              </span>
            </div>
          )}

          {/* Error */}
          {encounterError && (
            <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-[4px] px-4 py-3">
              <span className="text-[12px] text-[#991B1B]">{encounterError}</span>
            </div>
          )}

          {/* Import button */}
          <button
            onClick={importEncounters}
            disabled={encounterRawRows.length === 0 || encounterImporting || !clinicId}
            className="w-full sm:w-auto sm:self-start text-[13px] font-medium px-4 py-2.5 rounded-[4px] bg-[#028090] text-white hover:bg-[#025f6b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {encounterImporting && (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {encounterImporting ? 'Importing…' : `Import ${encounterRawRows.length > 0 ? encounterRawRows.length + ' ' : ''}encounters`}
          </button>
        </div>
      </section>

      {/* Section C — History */}
      <section className="bg-white rounded-[6px] border border-[#e2e8f0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#f0f9ff] flex items-center justify-center text-[12px] font-bold text-[#6B7280]">C</div>
            <h2 className="text-[14px] font-semibold text-[#111]">Import History</h2>
          </div>
          <p className="text-[12px] text-[#6B7280] mt-1 ml-8">Last 5 imports for this browser session.</p>
        </div>

        <div className="px-5 py-4">
          {importLog.length === 0 ? (
            <p className="text-[12px] text-[#9CA3AF] py-4 text-center">No imports yet this session.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {importLog.map((entry, i) => {
                const date = new Date(entry.timestamp)
                const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                const typeLabel = entry.type === 'patients' ? 'Patients' : 'Encounters'
                return (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 rounded-[4px] bg-[#f0f9ff] border border-[#F3F4F6]">
                    <div>
                      <span className="text-[12px] font-medium text-[#374151]">{typeLabel}</span>
                      <span className="text-[11px] text-[#9CA3AF] ml-2">{label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                      <span className="text-[#065F46] bg-[#D1FAE5] px-2 py-0.5 rounded-full font-medium">
                        {entry.imported} imported
                      </span>
                      {entry.updated !== undefined && (
                        <span className="text-[#065F46] bg-[#D1FAE5] px-2 py-0.5 rounded-full font-medium">
                          {entry.updated} updated
                        </span>
                      )}
                      {entry.skipped > 0 && (
                        <span className="text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full font-medium">
                          {entry.skipped} skipped
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
