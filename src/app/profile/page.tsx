'use client'
import { useEffect, useState } from 'react'
import { useClinic } from '@/context/ClinicContext'

type UserInfo = { role: 'admin' | 'patient'; patientIdentifier?: string; name: string; email: string }

function loadClinicContact(clinicId: string) {
  try {
    const raw = localStorage.getItem(`clinic_contact_${clinicId}`)
    return raw ? JSON.parse(raw) : { phone: '', address: '', contactEmail: '' }
  } catch {
    return { phone: '', address: '', contactEmail: '' }
  }
}

function saveClinicContact(clinicId: string, data: { phone: string; address: string; contactEmail: string }) {
  localStorage.setItem(`clinic_contact_${clinicId}`, JSON.stringify(data))
}

export default function ProfilePage() {
  const { clinicId, clinicName, clinicType } = useClinic()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [clinicPhone, setClinicPhone] = useState('')
  const [clinicAddress, setClinicAddress] = useState('')
  const [clinicEmail, setClinicEmail] = useState('')
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      setUser(d.user)
      setName(d.user?.name ?? '')
      setEmail(d.user?.email ?? '')
    })
  }, [])

  useEffect(() => {
    if (!clinicId) return
    const contact = loadClinicContact(clinicId)
    setClinicPhone(contact.phone)
    setClinicAddress(contact.address)
    setClinicEmail(contact.contactEmail)
  }, [clinicId])

  async function save() {
    setSaveMsg(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUser(data.user ?? user)
      if (clinicId) {
        saveClinicContact(clinicId, { phone: clinicPhone, address: clinicAddress, contactEmail: clinicEmail })
      }
      setSaveMsg({ type: 'ok', text: 'Profile saved.' })
    } catch {
      setSaveMsg({ type: 'err', text: 'Failed to save. Please try again.' })
    }
  }

  if (!user) return <div className="p-7 text-sm text-[#6B7280]">Loading profile...</div>

  const clinicTypeLabel: Record<string, string> = {
    pediatrics: 'Pediatrics',
    family_medicine: 'Family Medicine',
    behavioral_health: 'Behavioral Health',
    general: 'General',
  }

  return (
    <div className="p-7 flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="text-[22px] font-semibold text-[#111] tracking-tight">Admin Profile</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">Manage your account and clinic contact information.</p>
      </div>

      {/* Clinic info (read-only) */}
      <div className="bg-white rounded-[6px] border border-[#e2e8f0] p-5">
        <div className="text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] font-medium mb-4">Clinic</div>
        <div className="grid grid-cols-2 gap-4">
          <ReadField label="Clinic Name" value={clinicName || '—'} />
          <ReadField label="Clinic Type" value={clinicType ? (clinicTypeLabel[clinicType] ?? clinicType) : '—'} />
          <ReadField label="Clinic ID" value={clinicId ?? '—'} />
        </div>
      </div>

      {/* Admin info */}
      <div className="bg-white rounded-[6px] border border-[#e2e8f0] p-5">
        <div className="text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] font-medium mb-4">Admin Account</div>
        <div className="grid grid-cols-2 gap-4">
          <EditField label="Admin Name" value={name} onChange={setName} />
          <EditField label="Admin Email" value={email} onChange={setEmail} />
          <ReadField label="Role" value={user.role === 'admin' ? 'Admin' : 'Patient'} />
        </div>
      </div>

      {/* Clinic contact info */}
      <div className="bg-white rounded-[6px] border border-[#e2e8f0] p-5">
        <div className="text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] font-medium mb-4">Clinic Contact Info</div>
        <div className="grid grid-cols-2 gap-4">
          <EditField label="Clinic Phone" value={clinicPhone} onChange={setClinicPhone} placeholder="e.g. (518) 555-1234" />
          <EditField label="Clinic Email" value={clinicEmail} onChange={setClinicEmail} placeholder="e.g. info@clinic.org" />
          <div className="col-span-2">
            <EditField label="Clinic Address" value={clinicAddress} onChange={setClinicAddress} placeholder="e.g. 123 Main St, Albany, NY 12205" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="rounded-[4px] bg-[#028090] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#025f6b] transition-colors"
        >
          Save changes
        </button>
        {saveMsg && (
          <span className={`text-[12px] ${saveMsg.type === 'ok' ? 'text-[#4A6080]' : 'text-[#991B1B]'}`}>
            {saveMsg.text}
          </span>
        )}
      </div>
    </div>
  )
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[.07em] text-[#9CA3AF] font-medium mb-1">{label}</div>
      <div className="w-full rounded-[4px] border border-[#F3F4F6] bg-[#f0f9ff] px-3 py-2 text-[13px] text-[#374151]">
        {value}
      </div>
    </div>
  )
}

function EditField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[.07em] text-[#9CA3AF] font-medium mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[4px] border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#111] focus:outline-none focus:ring-1 focus:ring-[#028090] focus:border-[#028090]"
      />
    </div>
  )
}
