import { Suspense } from 'react'
import AllPatientsClient from './AllPatientsClient'

export default function AllPatientsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-[13px] text-[#9CA3AF]">
          <svg className="h-5 w-5 animate-spin text-[#028090] mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading…
        </div>
      }
    >
      <AllPatientsClient />
    </Suspense>
  )
}
