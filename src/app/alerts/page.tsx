import { Suspense } from 'react'
import AlertsClient from './AlertsClient'

export default function AlertsPage() {
  return (
    <Suspense>
      <AlertsClient />
    </Suspense>
  )
}
