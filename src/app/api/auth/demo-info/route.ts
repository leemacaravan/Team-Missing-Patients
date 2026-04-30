import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    clinics: [
      {
        name: process.env.DEMO_CLINIC_1_NAME ?? 'General Demo Clinic',
        email: process.env.DEMO_CLINIC_1_EMAIL ?? 'general@missingpatients.demo',
        password: process.env.DEMO_CLINIC_1_PASSWORD ?? 'general123',
      },
      {
        name: process.env.DEMO_CLINIC_2_NAME ?? 'Riverside Pediatric Clinic',
        email: process.env.DEMO_CLINIC_2_EMAIL ?? 'pediatrics@missingpatients.demo',
        password: process.env.DEMO_CLINIC_2_PASSWORD ?? 'pediatrics123',
      },
    ],
  })
}
