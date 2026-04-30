# Missing Patients
### An AI-Powered Clinical Outreach Information System for Federally Qualified Health Centers

> *"Because care doesn't speak one language."*

---

**Course:** Xinformatics 2026 — Health Informatics  
**Instructor:** Dr. Thilanka Munasinghe  
**Institution:** Lally School of Management, Rensselaer Polytechnic Institute  
**Sprint:** Lally AI Academy 30-Day Sprint  
**Submitted:** April 30, 2026  

---

## Team 5

| Name | Email |
|------|-------|
| Leema Caravan | caravl@rpi.edu |
| Alex Litchfield | |
| Joydip Paul | |
| Ryan Tedaldi | |
| Sirajam Munira | |

---

## Live Demo

**https://missing-patients.vercel.app**

### Demo Credentials

| Clinic | Email | Password |
|--------|-------|----------|
| General Demo Clinic | general@missingpatients.demo | general123 |
| Riverside Pediatric Clinic | pediatrics@missingpatients.demo | pediatrics123 |

> All patient data is synthetically generated. No real patient information is stored or displayed.

---

## The Problem

Every year, millions of patients at Federally Qualified Health Centers (FQHCs) miss their annual well visits — not from unwillingness, but from a systemic failure of outreach infrastructure. FQHCs serve over 30 million Americans regardless of ability to pay, yet clinic staff managing panels of hundreds of overdue patients have no intelligent tooling to prioritize who to contact, what to say, or in what language to say it.

**Missing Patients was inspired by firsthand observation of immigrant physicians running small community practices** — lean, understaffed clinics serving patients who speak little English, with a single care coordinator responsible for hundreds of overdue patients and no automated tools to help them.

EHR systems like Practice Fusion and Epic store visit records but offer zero intelligent outreach capability. The gap between data and action falls entirely on people.

---

## What We Built

A full-stack clinical outreach information system that applies informatics theory to a real-world clinical workflow problem:

### Core Features

- **Urgency-Based Patient Prioritization** — Domain-aware algorithm scores patients by days overdue relative to their clinic-type-specific expected visit interval. A 60-day-old infant (30-day interval) is Critical; a teenager who missed their annual by 60 days (365-day interval) is Low. Clinical knowledge encoded directly into the model.

- **AI Multilingual Script Generation** — Anthropic Claude API generates personalized outreach scripts in English, Spanish, Arabic, Mandarin, French, and Haitian Creole. Tone adapts per clinic type: pediatric scripts address the parent/guardian; behavioral health scripts never mention diagnoses.

- **Multi-Tenant Clinic Architecture** — Separate data environments for Pediatrics, Family Medicine, and Behavioral Health. Supabase Row Level Security enforces clinic_id isolation at the database layer — not just the application layer.

- **Practice Fusion EHR Import** — CSV pipeline parses SNOMED-CT encoded encounters and semicolon-delimited ICD-10 diagnoses from real EHR exports. Auto-detects CSV type from column headers.

- **AI Clinical Summary** — Per-patient anonymized clinical summaries generated using de-identified data only. No patient names, DOB, phone, or email sent to AI.

- **Patient Portal** — Secure patient-facing view with email + date of birth authentication (matching Epic MyChart standard) and SMS OTP via Twilio Verify.

- **Real-Time Outreach Tracking** — Mark contacted, unmark, bulk actions. Dashboard updates live after every action.

- **Add Patient & Edit Patient** — Manual patient entry with date of birth validation and age-aware urgency calculation.

- **Encounter Management** — Add visits, edit attendance (Attended/No Show/Upcoming), appointment time tracking, diagnosis code selection from clinical reference table.

---

## Informatics Frameworks Applied

This project directly applies informatics theory from Xinformatics 2026:

### Information Entropy Reduction
Raw EHR data (visit dates, ICD-10 codes) carries high uncertainty. The detection engine resolves entropy by computing days overdue relative to AAP/USPSTF visit intervals per clinic type — collapsing a continuous high-entropy variable into four actionable urgency tiers (Critical/High/Medium/Low).

### Semiotics
ICD-10 codes are clinical signs efficient for trained clinicians but opaque to administrative staff. The system implements a code-to-plain-English mapping layer (Z00.129 → "Routine Child Health Exam"), translating clinical syntax into natural language semantics appropriate for the outreach context. Color-coded urgency badges (red/amber/blue/gray) serve as iconic signs conveying severity without requiring text interpretation.

### Cognitive Load Reduction
Progressive disclosure (Dashboard → Alerts → Patient Panel), urgency-sorted default views, and AI-generated scripts collectively minimize working memory demands at every step of the outreach workflow. The AI eliminates the most cognitively demanding task: composing a culturally appropriate message in a language the staff member may not speak.

### Multi-Tenant Information Architecture
clinic_id scoping enforced at both the application layer (query filters) and database layer (Supabase Row Level Security policies). Data isolation is architectural, not trust-dependent.

---

## Conceptual Data Model

Four primary entities:

### patients
```
patient_identifier  clinic_id           first_name
last_name           date_of_birth       age
sex                 preferred_language  home_phone
mobile_phone        email_address       most_recent_visit_date
days_overdue        urgency_label       urgency_score
outreach_status     active
```

### encounters
```
patient_record_number  encounter_date    icd_code
diagnosis              visit_type        care_category
attended               appointment_time  notes
clinic_id
```

### codes (clinical reference)
```
code              description       full_display
coding_system     clinic_type       care_category
visit_type        is_active
(ICD-10 and SNOMED-CT codes scoped by clinic type)
```

### clinic_requests (onboarding)
```
clinic_name    clinic_type    admin_name
email          ehr_system     status
```

---

## System Architecture

```
┌─────────────────────────────────────────────┐
│           PRESENTATION LAYER                 │
│     Next.js 16 + React + Tailwind CSS        │
│   (Patient Alerts, Dashboard, Encounters)    │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│           APPLICATION LAYER                  │
│        Next.js API Routes (Server-Side)      │
│   Auth · AI Scripts · CSV Import · Reports  │
└──────┬──────────────────────────┬───────────┘
       │                          │
┌──────▼──────┐          ┌────────▼────────┐
│  SUPABASE   │          │  ANTHROPIC API  │
│ PostgreSQL  │          │  Claude Sonnet  │
│ + Row Level │          │  (Server-side   │
│  Security   │          │   only, no PII) │
└─────────────┘          └─────────────────┘
       │
┌──────▼──────┐
│   TWILIO    │
│ Verify API  │
│ (SMS OTP)   │
└─────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend Framework | Next.js 16, TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Custom session + Clerk (planned) |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| SMS Verification | Twilio Verify |
| Deployment | Vercel |
| EHR Integration | Practice Fusion CSV export |
| Design System | Impeccable (clinical color psychology) |

---

## Security Design

- **Supabase Row Level Security** enforces clinic_id isolation at the database layer
- **Anthropic API key** is server-side only — never exposed to the browser
- **AI clinical summaries** use anonymized data only — no patient names, DOB, phone, or email sent to AI model
- **Patient portal** authenticates via email + date of birth (Epic MyChart standard)
- **SMS OTP** via Twilio Verify for patient verification
- **Session expiry** and rate limiting on all auth endpoints
- **Demo environment watermarking** — all synthetic data clearly labeled

### Production Security Roadmap
- HIPAA Business Associate Agreements with Supabase and Vercel
- Field-level encryption for PHI (AES-256)
- Formal penetration testing
- Audit logging for all data access
- Patient consent management system
- Data retention policies per HIPAA requirements

---

## Running Locally

```bash
git clone https://github.com/leemacaravan/Team-Missing-Patients.git
cd Team-Missing-Patients
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
TWILIO_VERIFY_SERVICE_SID=your_verify_sid
```

```bash
npm run dev
```

Open http://localhost:3000

---

## Use Case

**Actor:** Front desk staff at an FQHC  
**Goal:** Identify and contact patients overdue for annual well visit  
**Trigger:** Staff opens dashboard at start of shift  

**Main Flow:**
1. Staff logs in → Patient Alerts page sorted by urgency score
2. Clicks Critical patient → side panel shows demographics + ICD-10 history in plain English
3. Clicks Generate AI Script → Claude produces script in patient's preferred language
4. Staff reads by phone OR clicks Send via Email
5. Clicks Mark Contacted → outreach_status updated in Supabase in real time
6. Dashboard stat cards update immediately

**Functional Requirements:**
- Urgency detection using age-adjusted well-visit intervals
- Practice Fusion CSV ingestion — zero reformatting required
- Multilingual AI script generation (6 languages)
- ICD-10 and SNOMED-CT to plain English mapping
- Real-time outreach status tracking
- Row Level Security — HIPAA-conscious design
- Multi-tenant clinic support
- Patient portal with secure authentication
- Birthday detection for personalized outreach

---

## Clinic Types Supported

| Clinic Type | Overdue Threshold | AI Script Tone | Address Mode |
|-------------|------------------|----------------|--------------|
| Pediatrics | Age-aware (30–365 days) | Warm, reassuring | Parent/Guardian |
| Family Medicine | 180–365 days | Professional, direct | Patient |
| Behavioral Health | 14–90 days | Calm, non-stigmatizing | Patient (no diagnosis) |
| General Demo | 365 days | Professional | Patient |

---

## Future Work

- **Practice Fusion Live API Sync** — Replace CSV upload with real-time EHR data sync via FHIR API
- **Automated SMS/Email Outreach** — Direct patient messaging with consent tracking via Twilio
- **Predictive Care Gap Modeling** — Train on historical encounter data to predict dropout risk
- **Clerk Authentication** — Production-ready user management with MFA
- **Federated Multi-Clinic Network** — Connect clinic networks with shared anonymized insights
- **Epic/Athena FHIR Integration** — Expand beyond Practice Fusion

---

## Deliverables

- ✅ Live Product: https://missing-patients.vercel.app
- ✅ GitHub Repository: https://github.com/leemacaravan/Team-Missing-Patients
- ✅ Video Podcast: [link]
- ✅ Product Walkthrough Video: [link]

---

## References

1. HRSA. Health Center Program: Impact and Growth, 2024. bphc.hrsa.gov
2. American Academy of Pediatrics. Bright Futures Periodicity Schedule, 2024.
3. Anthropic. Claude API Documentation. docs.anthropic.com
4. Supabase. Row Level Security. supabase.com/docs
5. Shannon, C.E. A Mathematical Theory of Communication. 1948.
6. Norman, D.A. The Design of Everyday Things. Basic Books, 2013.
7. WHO. ICD-10: International Classification of Diseases, 10th Revision. 2019.
8. SNOMED International. SNOMED CT Clinical Terms. snomed.org
9. CMS. ICD-10-CM Official Guidelines FY 2024. cms.gov
10. Shortliffe, E.H. & Cimino, J.J. Biomedical Informatics. Springer, 2021.

---

## Acknowledgements

This project was built as part of the **Lally AI Academy 30-Day Sprint** under the guidance of **Dr. Thilanka Munasinghe**, Xinformatics 2026, Lally School of Management at Rensselaer Polytechnic Institute.

We thank Dr. Munasinghe for the opportunity to apply informatics theory to a real-world clinical problem that affects millions of underserved Americans.

---

*Built in 30 days. Deployed and live.*  
*The patients who fall through the cracks are often the ones who can least afford to.*  
*This system was built to make sure fewer of them do.*

---

**Missing Patients** | Team 5 | Xinformatics 2026 | Lally School of Management, RPI
