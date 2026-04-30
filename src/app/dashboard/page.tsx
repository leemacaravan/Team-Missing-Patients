'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, fetchAllPatients, type Patient } from '@/lib/supabase'
import { useClinic } from '@/context/ClinicContext'
import { useClinicConfig } from '@/hooks/useClinicConfig'
import PatientDrawer from '@/components/PatientDrawer'

const URGENCY_BADGE: Record<string, string> = {
  Critical: 'bg-[#FEE2E2] text-[#991B1B]',
  High: 'bg-[#FEF3C7] text-[#92400E]',
  Medium: 'bg-[#DBEAFE] text-[#1E40AF]',
  Low: 'bg-[#F1F5F9] text-[#475569]',
}

const URGENCY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const URGENCY_ROW: Record<string, string> = {
  Critical: 'bg-[#FFF7F7] hover:bg-[#FFECEA]',
  High: 'bg-[#FFFBF4] hover:bg-[#FFF5E9]',
}
const URGENCY_BAR: Record<string, string> = {
  Critical: '#DC2626',
  High: '#F59E0B',
  Medium: '#3B82F6',
  Low: '#6B7280',
}

function computeStat(query: string, patients: Patient[]): number {
  switch (query) {
    case 'total': return patients.length
    case 'overdue': return patients.filter((p) => p.days_overdue > 0).length
    case 'critical': return patients.filter((p) => p.urgency_label === 'Critical').length
    case 'contacted': return patients.filter((p) => p.outreach_status === 'contacted').length
    case 'under2overdue': return patients.filter((p) => p.age < 2 && p.days_overdue > 0).length
    case 'chronic_overdue': return patients.filter((p) => p.days_overdue > 90).length
    case 'crisis_patients': return patients.filter((p) => p.urgency_label === 'Critical').length
    case 'missed_session': return patients.filter((p) => p.days_overdue > 30).length
    default: return 0
  }
}

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [contactingId, setContactingId] = useState<string | null>(null)
  const [drawerPatientId, setDrawerPatientId] = useState<string | null>(null)
  const { clinicId, loading: clinicLoading } = useClinic()
  const clinicConfig = useClinicConfig()

  useEffect(() => {
    if (clinicLoading) return
    fetchAllPatients(clinicId).then((data) => {
      setPatients(data)
      setLoading(false)
    })
  }, [clinicId, clinicLoading])

  const handleMarkContacted = useCallback(async (patient: Patient) => {
    if (contactingId) return
    setContactingId(patient.id)
    const nextStatus = patient.outreach_status === 'contacted' ? 'pending' : 'contacted'
    const { error } = await supabase
      .from('patients')
      .update({ outreach_status: nextStatus })
      .eq('id', patient.id)
    if (!error) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patient.id ? { ...p, outreach_status: nextStatus } : p))
      )
    }
    setContactingId(null)
  }, [contactingId])

  const overdue = patients.filter((p) => p.days_overdue > 0).length
  const total = patients.length
  const contacted = patients.filter((p) => p.outreach_status === 'contacted').length
  const panelPct = total > 0 ? ((overdue / total) * 100).toFixed(1) : '0'
  const outreachPct = overdue > 0 ? ((contacted / overdue) * 100).toFixed(0) : '0'

  const topPatients = [...patients.filter((p) => p.days_overdue > 0)]
    .sort((a, b) => {
      const uDiff = (URGENCY_ORDER[a.urgency_label] ?? 3) - (URGENCY_ORDER[b.urgency_label] ?? 3)
      return uDiff !== 0 ? uDiff : b.days_overdue - a.days_overdue
    })
    .slice(0, 6)
  const mostOverdue = [...patients]
    .sort((a, b) => b.days_overdue - a.days_overdue)
    .slice(0, 5)

  function statSub(query: string, value: number): string {
    if (query === 'overdue') return `${loading ? '…' : panelPct}% of panel`
    if (query === 'contacted') return `${loading ? '…' : outreachPct}% outreach rate`
    if (query === 'under2overdue') return 'infants & toddlers'
    if (query === 'critical' || query === 'crisis_patients') return 'urgency label = Critical'
    if (query === 'chronic_overdue') return 'overdue > 90 days'
    if (query === 'missed_session') return 'overdue > 30 days'
    if (query === 'total') return ''
    return `${value.toLocaleString()} patients`
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5">
      <div>
        <h1 className="text-[26px] font-semibold text-[#111] tracking-tight">Dashboard</h1>
      </div>

      {/* Stats row */}
      <div className={`grid gap-3 grid-cols-2 lg:grid-cols-${clinicConfig.dashboardStats.length}`}>
        {clinicConfig.dashboardStats.map((stat) => {
          const value = loading ? '—' : computeStat(stat.query, patients).toLocaleString()
          return (
            <StatCard
              key={stat.key}
              label={stat.label}
              value={value}
              sub={loading ? '…' : statSub(stat.query, computeStat(stat.query, patients))}
              valueClass={stat.color ?? 'text-[#111]'}
            />
          )
        })}
      </div>

      {/* Overdue patients table */}
      <div className="bg-white rounded-[6px] border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F4F6]">
          <div className="text-[14px] font-semibold text-[#111]">
            {clinicConfig.clinicType === 'pediatrics' ? 'Overdue pediatric patients' : 'Overdue patients'}
          </div>
          <Link href="/all-patients" className="text-[12px] text-[#028090] font-medium hover:underline">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[13px] text-[#9CA3AF]">Loading…</div>
        ) : topPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#9CA3AF]">
            <span className="text-[13px]">No overdue patients found.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f0f9ff]">
                  {['Patient', 'Age', 'Days Overdue', 'Urgency', 'Status', 'Action'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-left text-[11px] font-medium text-[#6B7280] uppercase tracking-[.06em] border-b border-[#F3F4F6]${
                        h === 'Age' || h === 'Status' || h === 'Action' ? ' hidden md:table-cell' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topPatients.map((p) => {
                  const initials = `${p.first_name[0]}${p.last_name[0]}`
                  const isContacted = p.outreach_status === 'contacted'
                  const isContacting = contactingId === p.id
                  const daysClass =
                    p.days_overdue >= 180
                      ? 'font-mono font-bold text-[14px] text-[#B91C1C]'
                      : p.days_overdue >= 90
                      ? 'font-mono font-bold text-[14px] text-[#B45309]'
                      : 'font-mono font-medium text-[13px] text-[#1D4ED8]'
                  const badge = URGENCY_BADGE[p.urgency_label] ?? 'bg-[#F3F4F6] text-[#374151]'
                  const statusBadge = isContacted
                    ? 'bg-[#D1FAE5] text-[#065F46]'
                    : 'bg-[#FEF3C7] text-[#92400E]'
                  return (
                    <tr key={p.id} className={`border-b border-[#f0f9ff] last:border-0 transition-colors ${URGENCY_ROW[p.urgency_label] ?? 'bg-white hover:bg-[#F8FAFC]'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => setDrawerPatientId(p.patient_identifier)}
                            className="w-8 h-8 rounded-full bg-[#f0f9ff] flex items-center justify-center text-[11px] font-semibold text-[#05668d] shrink-0 cursor-pointer hover:ring-2 hover:ring-[#028090] hover:ring-offset-1 transition-all"
                          >
                            {initials}
                          </button>
                          <div className="text-[13px] font-semibold text-[#111]">
                            {p.first_name} {p.last_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#374151] hidden md:table-cell">{p.age}</td>
                      <td className="px-4 py-3">
                        <span className={daysClass}>
                          {p.days_overdue} days
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full ${badge}`}>
                          {p.urgency_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize ${statusBadge}`}>
                          {p.outreach_status ?? 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <button
                          onClick={() => handleMarkContacted(p)}
                          disabled={isContacting}
                          className={`group flex items-center justify-center w-[140px] whitespace-nowrap text-sm font-medium py-1.5 rounded-[5px] transition-colors ${
                            isContacting
                              ? 'bg-[#028090]/50 text-white cursor-wait'
                              : isContacted
                              ? 'bg-[#D1FAE5] border border-[#6EE7B7] text-[#065F46] hover:bg-[#FEF2F2] hover:border-[#FECACA] hover:text-[#DC2626]'
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
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Urgency breakdown */}
        <div className="bg-white rounded-[6px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F3F4F6]">
            <div className="text-[14px] font-semibold text-[#111]">Patients overdue by urgency</div>
          </div>
          <div>
            {loading ? (
              <div className="px-5 py-6 text-[13px] text-[#9CA3AF]">Loading…</div>
            ) : patients.length === 0 ? (
              <div className="px-5 py-6 text-[13px] text-[#9CA3AF]">No data available.</div>
            ) : (
              (() => {
                const totals: Record<string, number> = {}
                for (const p of patients) totals[p.urgency_label] = (totals[p.urgency_label] ?? 0) + 1
                return Object.entries(totals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => {
                    const pct = Math.round((count / patients.length) * 100)
                    return (
                      <div key={name} className="flex items-center gap-3 px-5 py-2.5 border-b border-[#f0f9ff] last:border-0">
                        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 w-[76px] justify-center ${URGENCY_BADGE[name] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                          ● {name}
                        </span>
                        <div className="flex-1 h-[3px] bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: URGENCY_BAR[name] ?? '#9CA3AF' }}
                          />
                        </div>
                        <span className="text-[11px] text-[#9CA3AF] font-mono shrink-0 w-9 text-right">{pct}%</span>
                        <span className="font-mono font-semibold text-[13px] text-[#111] shrink-0 w-8 text-right">{count}</span>
                      </div>
                    )
                  })
              })()
            )}
          </div>
        </div>

        {/* Most overdue */}
        <div className="bg-white rounded-[6px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F3F4F6]">
            <div className="text-[14px] font-semibold text-[#111]">Most overdue patients</div>
          </div>
          <div>
            {loading ? (
              <div className="px-5 py-6 text-[13px] text-[#9CA3AF]">Loading…</div>
            ) : mostOverdue.length === 0 ? (
              <div className="px-5 py-6 text-[13px] text-[#9CA3AF]">No patients found.</div>
            ) : (
              mostOverdue.map((p, i) => {
                const initials = `${p.first_name[0]}${p.last_name[0]}`
                const badge = URGENCY_BADGE[p.urgency_label] ?? 'bg-[#F3F4F6] text-[#374151]'
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-5 py-2.5 text-[13px] ${
                      i < mostOverdue.length - 1 ? 'border-b border-[#f0f9ff]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setDrawerPatientId(p.patient_identifier)}
                        className="w-7 h-7 rounded-full bg-[#caf0f8] flex items-center justify-center text-[10px] font-semibold text-[#05668d] shrink-0 cursor-pointer hover:ring-2 hover:ring-[#028090] hover:ring-offset-1 transition-all"
                      >
                        {initials}
                      </button>
                      <div>
                        <div className="text-[13px] font-semibold text-[#111]">{p.first_name} {p.last_name}</div>
                        <div className="text-[11px] text-[#6B7280]"><span className="font-mono tabular-nums">{p.days_overdue}</span> days overdue</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full ${badge}`}>
                      {p.urgency_label}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {drawerPatientId && clinicId && (
        <PatientDrawer
          patient_identifier={drawerPatientId}
          clinic_id={clinicId}
          onClose={() => setDrawerPatientId(null)}
          onPatientUpdated={() => {
            setDrawerPatientId(null)
            fetchAllPatients(clinicId).then((data) => setPatients(data))
          }}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  valueClass = 'text-[#111]',
}: {
  label: string
  value: string
  sub: string
  valueClass?: string
}) {
  return (
    <div className="bg-white rounded-[6px] border border-[#e2e8f0] px-[18px] py-4">
      <div className="text-[11px] text-[#6B7280] uppercase tracking-[.07em] mb-1.5">{label}</div>
      <div className={`text-[26px] font-semibold font-mono tracking-tight ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-[#9CA3AF] mt-0.5">{sub}</div>
    </div>
  )
}
