# Product

## Register

dual — `brand` for the landing page (`/`), `product` for all authenticated routes (dashboard, patients, encounters, reports, alerts, profile)

## Users

**Primary (product register):** Clinic staff — nurses, care coordinators, front desk leads — at community health clinics, pediatric clinics, FQHCs, and behavioral health centers. Fast-paced clinical settings, often managing 50–100 outreach calls per shift. They use the tool on clinic workstations or laptops, mid-workflow, time-pressured. Supported clinic types: pediatrics, family medicine, behavioral health, general.

**Secondary (product register):** Clinic administrators who configure the system, import/export data, and review aggregate reports.

**Tertiary (patient portal):** Patients viewing their own care records. Different context entirely — not managing outreach, not time-pressured, less familiar with clinical vocabulary. Interface should be clean, simple, and reassuring. Not clinic-staff-focused.

**Buyer (brand register):** Clinic administrators and healthcare operations leads evaluating the tool for their organization. Arrives via the landing page; converts through the request-access form.

## Product Purpose

Missing Patients identifies patients overdue for care across clinic types and helps staff re-engage them through AI-assisted, multilingual outreach. The tool ingests patient data, scores clinical urgency using clinic-type-specific rules, generates personalized phone scripts in any language, logs encounters, and tracks outreach status. Multi-clinic architecture isolates each clinic's data with custom urgency rules and AI behavior tuned to specialty.

Success means care gaps close: patients get called, appointments get scheduled, preventive visits happen.

## Brand Personality

Credible, precise, purposeful, calm.

## Anti-references

**Consumer health:** MyChart, Apple Health — too soft, rounded, wellness-y; not task-focused.

**Generic healthcare SaaS:** Any product using teal gradients, stock clinical imagery, or "wellness" visual language. Looks like every other health startup.

**Dev dashboards:** Grafana, Datadog, Kibana — clinical, not infrastructure tooling. Dark-mode-by-default reads as the wrong register.

**Consumer mental health apps:** Headspace, BetterHelp, Calm — meditation aesthetics, pastel palettes, soft rounded cards, affirmations, gentle illustration. This tool handles serious clinical data and must not feel like a mindfulness app.

**Loud dashboards:** Status cards in 5+ saturated colors, gradient fills on every stat, color used for decoration rather than meaning. Color should signal priority, not variety.

**Consumer wellness aesthetics broadly:** Anything that could appear in an App Store wellness category — organic shapes, warm gradients, friendly illustrations, encouraging copy tone.

## Design Principles

1. **Data over decoration** — every element earns its place by serving the task; nothing is decorative
2. **Urgency hierarchy is visible, not just labeled** — a critical patient must be visually distinct from a low-urgency patient at the row level, not only in the badge; hierarchy should be legible before reading
3. **Trust through precision** — clinical credibility requires exact values, monospaced numbers, no rounding; approximations erode trust in a clinical context
4. **Speed in the flow** — staff making 50 calls a shift need the tool to move at their pace; no choreography, no friction in the core outreach loop
5. **Professional register** — no emojis in clinical interfaces; clinic identity expressed through text, not decoration; this tool handles sensitive medical data and the interface must reflect that
6. **Consistent vocabulary** — same component for the same concept on every screen; familiarity is an affordance

## Accessibility & Inclusion

WCAG 2.1 AA minimum. Urgency indicators must use both color and text/shape — never color alone. Behavioral health surfaces must avoid language that could alarm or stigmatize. Interface must be usable at varying ambient light levels (clinic exam rooms to bright front desks). Support keyboard navigation for power users.
