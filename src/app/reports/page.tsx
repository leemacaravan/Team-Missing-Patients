'use client'

import { useEffect, useState } from 'react'
import { supabase, fetchAllPatients, type Patient } from '@/lib/supabase'
import { useClinic } from '@/context/ClinicContext'

type EncounterRow = {
  patient_record_number: string
  encounter_date: string
  care_category: string
}

type CareEntry = {
  name: string
  contacted: number
  overdue: number
  total: number
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NOW = new Date()
const MONTH_YEAR = NOW.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

const CUTOFF_24M = new Date(NOW.getFullYear(), NOW.getMonth() - 23, 1).toISOString().slice(0, 10)

async function fetchEncountersForPatients(identifiers: string[]): Promise<EncounterRow[]> {
  if (identifiers.length === 0) return []
  const BATCH = 500
  const all: EncounterRow[] = []
  for (let i = 0; i < identifiers.length; i += BATCH) {
    const batch = identifiers.slice(i, i + BATCH)
    const { data } = await supabase
      .from('encounters')
      .select('patient_record_number, encounter_date, care_category')
      .in('patient_record_number', batch)
      .gte('encounter_date', CUTOFF_24M)
    if (data) all.push(...(data as EncounterRow[]))
  }
  return all
}

export default function ReportsPage() {
  const { clinicId, clinicName, loading: clinicLoading } = useClinic()
  const [patients, setPatients] = useState<Patient[]>([])
  const [encounters, setEncounters] = useState<EncounterRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clinicLoading) return
    setLoading(true)
    fetchAllPatients(clinicId).then(async (data) => {
      setPatients(data)
      const identifiers = data.map((p) => p.patient_identifier).filter(Boolean)
      const encs = await fetchEncountersForPatients(identifiers)
      setEncounters(encs)
      setLoading(false)
    })
  }, [clinicId, clinicLoading])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const contacted = patients.filter((p) => p.outreach_status === 'contacted').length
  const totalOverdue = patients.filter((p) => p.days_overdue > 0).length
  const stillOverdue = patients.filter((p) => p.days_overdue > 0 && p.outreach_status !== 'contacted').length
  const outreachRate = totalOverdue > 0 ? Math.round((contacted / totalOverdue) * 100) : 0

  const overduePatients = patients.filter((p) => p.days_overdue > 0)
  const avgDaysOverdue =
    overduePatients.length > 0
      ? Math.round(overduePatients.reduce((s, p) => s + p.days_overdue, 0) / overduePatients.length)
      : 0

  // ── Urgency donut ──────────────────────────────────────────────────────────
  const critical = patients.filter((p) => p.urgency_label === 'Critical').length
  const high = patients.filter((p) => p.urgency_label === 'High').length
  const medium = patients.filter((p) => p.urgency_label === 'Medium').length
  const low = patients.filter((p) => p.urgency_label === 'Low').length
  const urgencyTotal = critical + high + medium + low

  const circumference = 2 * Math.PI * 45
  const criticalArc = urgencyTotal > 0 ? (critical / urgencyTotal) * circumference : 0
  const highArc = urgencyTotal > 0 ? (high / urgencyTotal) * circumference : 0
  const mediumArc = urgencyTotal > 0 ? (medium / urgencyTotal) * circumference : 0
  const lowArc = urgencyTotal > 0 ? (low / urgencyTotal) * circumference : 0

  // ── Care type breakdown ────────────────────────────────────────────────────
  const patientMap = new Map(patients.map((p) => [p.patient_identifier, p]))
  const carePatientMap = new Map<string, { contactedSet: Set<string>; overdueSet: Set<string> }>()

  for (const enc of encounters) {
    if (!enc.care_category) continue
    const patient = patientMap.get(enc.patient_record_number)
    if (!patient) continue
    if (!carePatientMap.has(enc.care_category)) {
      carePatientMap.set(enc.care_category, { contactedSet: new Set(), overdueSet: new Set() })
    }
    const entry = carePatientMap.get(enc.care_category)!
    if (patient.outreach_status === 'contacted') {
      entry.contactedSet.add(patient.patient_identifier)
    } else if (patient.days_overdue > 0) {
      entry.overdueSet.add(patient.patient_identifier)
    }
  }

  const careBreakdown: CareEntry[] = [...carePatientMap.entries()]
    .map(([name, { contactedSet, overdueSet }]) => ({
      name,
      contacted: contactedSet.size,
      overdue: overdueSet.size,
      total: contactedSet.size + overdueSet.size,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // ── Encounters per month (fixed 24-month window) ────────────────────────────
  const nowKey = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`
  const monthKeys: string[] = []
  for (let i = 23; i >= 0; i--) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const monthCounts: Record<string, number> = Object.fromEntries(monthKeys.map((k) => [k, 0]))
  for (const enc of encounters) {
    const key = enc.encounter_date?.slice(0, 7)
    if (key && key in monthCounts) monthCounts[key]++
  }
  const monthData = monthKeys.map((key) => {
    const [y, m] = key.split('-').map(Number)
    return {
      label: MONTHS_SHORT[m - 1],
      shortYear: `'${String(y).slice(2)}`,
      monthIdx: m - 1,
      isFirst: key === monthKeys[0],
      count: monthCounts[key],
      isCurrent: key === nowKey,
    }
  })
  const maxMonthCount = Math.max(...monthData.map((m) => m.count), 1)
  const hasEncounterTrend = monthData.some((m) => m.count > 0)

  // ── Language distribution ──────────────────────────────────────────────────
  const langCounts: Record<string, number> = {}
  for (const p of patients.filter((p) => p.days_overdue > 0)) {
    const lang = p.preferred_language ?? 'Unknown'
    langCounts[lang] = (langCounts[lang] ?? 0) + 1
  }
  const langBreakdown = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const langTotal = langBreakdown.reduce((s, [, n]) => s + n, 0)

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[26px] font-semibold text-[#111] tracking-tight">Reports</h1>
          <p className="text-[12px] text-[#6B7280] mt-0.5">
            Outreach performance · snapshot as of {MONTH_YEAR}
            {clinicName && !clinicLoading && (
              <span className="ml-1 font-medium text-[#374151]">· {clinicName}</span>
            )}
          </p>
        </div>
        <button
          disabled
          title="PDF export not yet available"
          className="flex items-center gap-1.5 px-3.5 py-[7px] border border-[#E5E7EB] rounded-[4px] text-[12px] text-[#9CA3AF] bg-white font-medium cursor-not-allowed opacity-60"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 10v1.5a1 1 0 001 1h7a1 1 0 001-1V10M6.5 1.5v7M4 6l2.5 2.5L9 6" stroke="#9CA3AF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export PDF
        </button>
      </div>

      {/* Stats panel */}
      <div className="bg-white rounded-[6px] border border-[#e2e8f0] divide-y divide-[#F3F4F6]">
        <MetricRow
          label="Patients contacted"
          value={loading ? '…' : contacted}
          sub={`of ${loading ? '…' : totalOverdue} overdue`}
          color="text-[#475569]"
        />
        <MetricRow
          label="Outreach rate"
          value={loading ? '…' : `${outreachRate}%`}
          sub="contacted / overdue"
          color="text-[#028090]"
        />
        <MetricRow
          label="Still overdue"
          value={loading ? '…' : stillOverdue}
          sub="not yet contacted"
          color="text-[#B45309]"
        />
        <MetricRow
          label="Avg days overdue"
          value={loading ? '…' : avgDaysOverdue}
          sub="among overdue patients"
          color="text-[#374151]"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Encounters per month bar chart — real data */}
        <div className="bg-white rounded-[6px] border border-[#e2e8f0] p-5">
          <div className="text-[14px] font-semibold text-[#111] mb-1">Encounters per month</div>
          <div className="text-[11px] text-[#9CA3AF] mb-4">
            {loading ? 'Loading…' : `Last 24 months · ${encounters.length.toLocaleString()} encounters`}
          </div>
          {loading ? (
            <div className="h-36 flex items-center justify-center">
              <svg className="h-4 w-4 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : !hasEncounterTrend ? (
            <div className="h-36 flex flex-col items-center justify-center gap-2 text-[#9CA3AF]">
              <svg className="h-7 w-7 text-[#E5E7EB]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              <span className="text-[12px]">No encounter records for this clinic yet</span>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-36 pb-5 border-b border-[#F3F4F6]">
                {monthData.map(({ label, count, isCurrent }, i) => (
                  <div key={i} className="flex items-end flex-1" title={`${label}: ${count} encounters`}>
                    <div
                      className="rounded-t-[3px] w-full transition-all"
                      style={{
                        height: `${count > 0 ? Math.max((count / maxMonthCount) * 100, 3) : 0}%`,
                        background: isCurrent ? '#475569' : '#028090',
                        opacity: count === 0 ? 0 : 1,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex mt-2">
                {monthData.map(({ shortYear, monthIdx, isFirst }, i) => (
                  <div key={i} className="flex-1 text-center text-[9px] text-[#9CA3AF] font-mono">
                    {monthIdx === 0 || isFirst ? shortYear : ''}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Language distribution — real data */}
        <div className="bg-white rounded-[6px] border border-[#e2e8f0] p-5">
          <div className="text-[14px] font-semibold text-[#111] mb-1">Language distribution</div>
          <div className="text-[11px] text-[#9CA3AF] mb-4">
            {loading ? 'Loading…' : 'Overdue patients by preferred language'}
          </div>
          {loading ? (
            <div className="h-36 flex items-center justify-center">
              <svg className="h-4 w-4 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : langBreakdown.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-[13px] text-[#9CA3AF]">No overdue patients found.</div>
          ) : (
            <div className="flex flex-col gap-2.5 pt-1">
              {langBreakdown.map(([lang, count]) => {
                const pct = langTotal > 0 ? Math.round((count / langTotal) * 100) : 0
                return (
                  <div key={lang}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[11px] text-[#6B7280] truncate max-w-[180px]">{lang}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-mono shrink-0 ml-2">{count} · {pct}%</div>
                    </div>
                    <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-full bg-[#028090] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Care type horizontal bars — real encounter data */}
        <div className="bg-white rounded-[6px] border border-[#e2e8f0] p-5">
          <div className="text-[14px] font-semibold text-[#111] mb-1">Outreach by care type</div>
          <div className="text-[11px] text-[#9CA3AF] mb-3">
            {loading
              ? 'Loading…'
              : careBreakdown.length > 0
              ? `Top ${careBreakdown.length} categories · unique patients`
              : 'Care type breakdown'}
          </div>
          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <svg className="h-4 w-4 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : careBreakdown.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-[#9CA3AF]">
              <svg className="h-7 w-7 text-[#E5E7EB]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <span className="text-[12px]">No encounter records found for this clinic</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3.5 mb-4">
                <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                  <div className="w-2 h-2 rounded-full bg-[#028090]" />Contacted
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                  <div className="w-2 h-2 rounded-full bg-[#FDE68A]" />Still overdue
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {careBreakdown.map((ct) => {
                  const cPct = ct.total > 0 ? Math.round((ct.contacted / ct.total) * 100) : 0
                  const oPct = ct.total > 0 ? Math.round((ct.overdue / ct.total) * 100) : 0
                  return (
                    <div key={ct.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[11px] text-[#6B7280] truncate max-w-[180px]" title={ct.name}>
                          {ct.name}
                        </div>
                        <div className="text-[10px] text-[#9CA3AF] font-mono shrink-0 ml-2">
                          {ct.total} patients
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div className="h-full bg-[#028090] rounded-full" style={{ width: `${cPct}%` }} />
                        </div>
                        <span className="font-mono text-[11px] text-[#374151] w-8 text-right">{ct.contacted}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div className="h-full bg-[#FDE68A] border border-[#FCD34D] rounded-full" style={{ width: `${oPct}%` }} />
                        </div>
                        <span className="font-mono text-[11px] text-[#374151] w-8 text-right">{ct.overdue}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Urgency donut — real data */}
        <div className="bg-white rounded-[6px] border border-[#e2e8f0] p-5">
          <div className="text-[14px] font-semibold text-[#111] mb-1">Current urgency breakdown</div>
          <div className="text-[11px] text-[#9CA3AF] mb-4">
            {loading ? 'Loading…' : `Distribution of ${urgencyTotal} patients by severity`}
          </div>
          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <svg className="h-4 w-4 animate-spin text-[#028090]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : urgencyTotal === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#9CA3AF]">No patient data available.</div>
          ) : (
            <div className="flex items-center gap-5 mt-2">
              <svg viewBox="0 0 120 120" width="120" height="120" className="shrink-0">
                <circle cx="60" cy="60" r="45" fill="none" stroke="#F3F4F6" strokeWidth="18" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="#FCA5A5" strokeWidth="18"
                  strokeDasharray={`${criticalArc} ${circumference}`} strokeDashoffset="0" transform="rotate(-90 60 60)" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="#FDE68A" strokeWidth="18"
                  strokeDasharray={`${highArc} ${circumference}`} strokeDashoffset={`${-criticalArc}`} transform="rotate(-90 60 60)" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="#BFDBFE" strokeWidth="18"
                  strokeDasharray={`${mediumArc} ${circumference}`} strokeDashoffset={`${-(criticalArc + highArc)}`} transform="rotate(-90 60 60)" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="#BFDBFE" strokeWidth="18"
                  strokeDasharray={`${lowArc} ${circumference}`} strokeDashoffset={`${-(criticalArc + highArc + mediumArc)}`} transform="rotate(-90 60 60)" />
                <text x="60" y="56" textAnchor="middle" fontSize="14" fontWeight="600" fill="#1A2420" fontFamily="monospace">
                  {urgencyTotal}
                </text>
                <text x="60" y="68" textAnchor="middle" fontSize="8" fill="#9CA3AF">patients</text>
              </svg>
              <div className="flex flex-col gap-2 flex-1">
                {[
                  { label: 'Critical', count: critical, pct: Math.round((critical / urgencyTotal) * 100), color: '#FCA5A5' },
                  { label: 'High', count: high, pct: Math.round((high / urgencyTotal) * 100), color: '#FDE68A' },
                  { label: 'Medium', count: medium, pct: Math.round((medium / urgencyTotal) * 100), color: '#BFDBFE' },
                  { label: 'Low', count: low, pct: Math.round((low / urgencyTotal) * 100), color: '#BFDBFE' },
                ].map(({ label, count, pct, color }) => (
                  <div key={label} className="flex items-center gap-2 text-[12px] text-[#374151]">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="flex-1">{label}</span>
                    <span className="font-mono font-medium">{count}</span>
                    <span className="text-[#9CA3AF] font-normal ml-3">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricRow({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 gap-4">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[#374151]">{label}</div>
        <div className="text-[11px] text-[#9CA3AF] mt-0.5">{sub}</div>
      </div>
      <div className={`text-[20px] font-semibold font-mono tracking-tight tabular-nums shrink-0 ${color}`}>{value}</div>
    </div>
  )
}
