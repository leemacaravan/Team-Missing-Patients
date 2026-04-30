# Missing Patients
### AI-Powered Clinical Outreach for Community Health Clinics

> *"Because care doesn't speak one language."*

**Live at:** https://missing-patients.vercel.app

---

## What We Do

Missing Patients helps community health clinics identify and re-engage patients who are overdue for their annual well visits. Built for the clinics nobody builds for — immigrant physicians running lean, understaffed practices serving patients who speak little English, with a single care coordinator responsible for hundreds of overdue patients and no automated tools to help them.

EHR systems store data. We act on it.

---

## Demo

| Clinic | Email | Password |
|--------|-------|----------|
| General Demo Clinic | general@missingpatients.demo | general123 |
| Riverside Pediatric Clinic | pediatrics@missingpatients.demo | pediatrics123 |

> All demo patient data is synthetically generated.

---

## Features

- **Urgency Scoring** — Ranks overdue patients by days overdue relative to their clinic-type-specific visit interval. Clinical knowledge encoded directly into the prioritization model.
- **AI Multilingual Scripts** — Generates personalized outreach scripts via Anthropic Claude in English, Spanish, Arabic, Mandarin, French, and Haitian Creole.
- **Multi-Tenant Architecture** — Separate data environments for Pediatrics, Family Medicine, and Behavioral Health with database-level isolation via Supabase RLS.
- **Practice Fusion EHR Import** — CSV pipeline parsing SNOMED-CT and ICD-10 coded encounters from real EHR exports.
- **Patient Portal** — Secure patient-facing view with email + DOB authentication and SMS OTP via Twilio.
- **AI Clinical Summary** — Per-patient summaries generated from de-identified data only. No PII sent to AI.
- **Real-Time Outreach Tracking** — Mark contacted, bulk actions, live dashboard updates.

---

## Tech Stack

| | |
|-|-|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Database | Supabase (PostgreSQL + Row Level Security) |
| AI | Anthropic Claude API |
| SMS | Twilio Verify |
| Deployment | Vercel |
| EHR | Practice Fusion CSV |

---

## Running Locally

```bash
git clone https://github.com/leemacaravan/Team-Missing-Patients.git
cd Team-Missing-Patients
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_VERIFY_SERVICE_SID=
```

```bash
npm run dev
```

---

## Security

- Supabase RLS enforces clinic_id isolation at the database layer
- Anthropic API key is server-side only — never exposed to browser
- AI summaries use anonymized data only — no names, DOB, or contact info sent to AI
- Patient portal uses email + date of birth authentication
- SMS OTP via Twilio Verify

---

## Acknowledgements

Built during the **Lally AI Academy 30-Day Sprint** — a rapid product development program at the Lally School of Management, Rensselaer Polytechnic Institute, under the mentorship of **Dr. Thilanka Munasinghe**.

The sprint challenges teams to conceive, build, and deploy a production-ready AI product in 30 days. Missing Patients was built in response to a real gap in clinical outreach infrastructure affecting underserved communities across the United States.

---

*The patients who fall through the cracks are often the ones who can least afford to.*  
*This was built to make sure fewer of them do.*
