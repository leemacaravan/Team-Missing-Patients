---
# Missing Patients — Design System
register: dual (brand: `/`, product: all authenticated routes)
generated: 2026-04-28
updated: 2026-04-28
---

## Color

### Product register

Strategy: **Restrained** — tinted neutrals with a single green accent ≤10% surface area.

#### Base palette

| Token | Value | Use |
|---|---|---|
| `--color-surface` | `#F4F6F8` | App content background |
| `--color-panel` | `#FFFFFF` | Cards, tables, panels |
| `--color-sidebar` | `#111A17` | Left navigation |
| `--color-border` | `#E8EAED` | Dividers, card outlines |
| `--color-border-subtle` | `#F3F4F6` | Row dividers, subtle splits |

#### Text

| Token | Value | Use |
|---|---|---|
| `--color-text-primary` | `#111827` | Headings, names, primary values |
| `--color-text-secondary` | `#374151` | Body, table cells |
| `--color-text-tertiary` | `#6B7280` | Labels, meta, captions |
| `--color-text-muted` | `#9CA3AF` | Placeholders, empty states |
| `--color-text-inverse` | `#F5F9F7` | Text on dark backgrounds |

#### Accent (green)

| Token | Value | Use |
|---|---|---|
| `--color-accent` | `#1D9E75` | Primary CTA, active nav, links |
| `--color-accent-bright` | `#4ECFA0` | Icons on dark, hover indicators |
| `--color-accent-subtle` | `rgba(29,158,117,0.08)` | Icon backgrounds, hover tints |
| `--color-accent-text` | `#065F46` | Text on light green surfaces |

#### Urgency semantic colors

| Level | Background | Text | Row tint |
|---|---|---|---|
| Critical | `#FEE2E2` | `#991B1B` | `#FFF7F7` |
| High | `#FEF3C7` | `#92400E` | `#FFFBF4` |
| Medium | `#DBEAFE` | `#1E40AF` | none |
| Low | `#D1FAE5` | `#065F46` | none |

Row tint is a full-row background applied to table rows — not a border-left stripe. Critical and High rows are visually distinct at a glance; Medium and Low rows are neutral white.

#### Status badges

| Status | Background | Text |
|---|---|---|
| contacted | `#D1FAE5` | `#065F46` |
| pending | `#FEF3C7` | `#92400E` |

#### Days overdue coloring (table cells)

| Threshold | Color | Weight |
|---|---|---|
| ≥ 180 days | `#B91C1C` | `font-bold text-[14px]` |
| ≥ 90 days | `#B45309` | `font-bold text-[14px]` |
| < 90 days | `#1D4ED8` | `font-medium text-[13px]` |

Weight increases with severity to create visual hierarchy independent of color.

#### Visit type badges

| Visit type | Background | Text |
|---|---|---|
| Well visit / Well child | `#D1FAE5` | `#065F46` |
| Follow-up | `#FEF3C7` | `#92400E` |
| Office visit | `#DBEAFE` | `#1E40AF` |
| Mental health | `#EDE9FE` | `#5B21B6` |
| Prenatal | `#FCE7F3` | `#9D174D` |
| Emergency | `#FEE2E2` | `#991B1B` |
| Other / default | `#DBEAFE` | `#1E40AF` |

#### Stat card value colors

Use at most 3 semantic value colors per dashboard. Assign by meaning, not by variety:

| Semantic role | Color | Use |
|---|---|---|
| Neutral | `#111` | Total counts, non-urgent metrics |
| At-risk / overdue | `#B45309` | Overdue count, missed sessions, chronic overdue |
| Critical / crisis | `#B91C1C` | Critical patient count, crisis count |
| Positive | `#0F766E` | Contacted, outreach rate |

Do not use purple (`#7C3AED`) or blue for stat card values. Color signals clinical meaning — a purple "chronic overdue" card reads as arbitrary decoration.

### Brand register (landing page `/` only)

Strategy: **Committed** — dark surface, single green accent as the primary identity color.

| Token | Value | Use |
|---|---|---|
| `--color-dark-bg` | `#0A0A0A` | Hero, footer backgrounds |
| `--color-dark-surface` | `rgba(255,255,255,0.04)` | Feature cards on dark |
| `--color-dark-border` | `rgba(255,255,255,0.08)` | Card borders on dark |
| `--color-dark-text-primary` | `#F5F9F7` | Headlines |
| `--color-dark-text-secondary` | `#7D9E95` | Body on dark |
| `--color-dark-text-muted` | `#4A6560` | Captions on dark |

The dark-to-light transition between hero and features section uses: `linear-gradient(to bottom, #0A0A0A, #F8FAF9)` over 80px.

---

## Typography

Font stack: `system-ui, -apple-system, sans-serif` (Geist Sans when available)
Mono stack: `ui-monospace, 'SF Mono', monospace` (Geist Mono when available)

### Scale

| Level | Size | Weight | Use |
|---|---|---|---|
| Page title | `26px` | 600 | Dashboard, page h1 |
| Section title | `16px` | 600 | Table headers, panel titles |
| Body | `14px` | 400 | Table cells, form inputs |
| Small | `13px` | 400 | Secondary content, descriptions |
| Caption | `12px` | 400 | Timestamps, IDs, meta |
| Label | `11px` | 500 | Badges, column headers (uppercase + tracking) |
| Mono value | `13–26px` | 600 | Days overdue, stat counts |

### Column headers
Always: `text-[11px] font-medium uppercase tracking-[.06em] text-[#6B7280]`

### Table cells
Primary cell: `text-[13px] font-medium text-[#111]`
Secondary cell: `text-[13px] text-[#374151]`

---

## Spacing

Base unit: `4px`. Use multiples.

| Token | Value | Use |
|---|---|---|
| `--space-xs` | `4px` | Inner badge padding |
| `--space-sm` | `8px` | Tight inline gaps |
| `--space-md` | `12–16px` | Card inner padding vertical |
| `--space-lg` | `18–24px` | Card inner padding horizontal |
| `--space-xl` | `32–40px` | Section gaps |
| `--space-2xl` | `48–64px` | Page section padding |

---

## Border radius

| Element | Radius |
|---|---|
| Cards, panels | `10px` |
| Buttons, inputs, selects | `7px` |
| Badges | `9999px` (full round) |
| Avatar circles | `9999px` |
| Icon containers | `9px` |
| Clinic monogram | `6px` |

---

## Components

### Buttons

**Primary** (green fill):
```
bg-[#1D9E75] text-white hover:bg-[#178a65] shadow-sm
text-[12px] font-medium px-3 py-2.5 rounded-[7px] transition-colors
```

**Destructive** (hover reveal on contacted state):
```
group bg-[#DCFCE7] border border-[#6EE7B7] text-[#065F46]
hover:bg-[#FEF2F2] hover:border-[#FECACA] hover:text-[#DC2626]
// Child: <span className="group-hover:hidden">Contacted</span>
// Child: <span className="hidden group-hover:inline">Unmark</span>
```

**Ghost / secondary**:
```
border border-[#E5E7EB] text-[#374151] bg-white hover:bg-[#F9FAFB]
text-[12px] font-medium px-3 py-1.5 rounded-[7px]
```

### Urgency badges

```
inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full
+ urgency color class
```
Prefix: `●` bullet character (not emoji)

### Status badges

```
inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize
```

### Tables

- No zebra striping
- Critical rows: `bg-[#FFF7F7]` (full row background — not a border-left stripe)
- High rows: `bg-[#FFFBF4]`
- Medium/Low rows: `bg-white`
- Row hover: `hover:bg-[rgba(0,0,0,0.025)] transition-colors` (applies over urgency tint)
- Row divider: `border-b border-[#F9FAFB] last:border-0`
- Header background: `bg-[#F9FAFB]`
- Header cell: `px-4 py-2.5 text-left text-[11px] font-medium text-[#6B7280] uppercase tracking-[.06em] border-b border-[#F3F4F6]`
- Body cell: `px-4 py-3`

**Patient name cell:** always `text-[13px] font-medium text-[#111]` — name is the primary anchor, not the badge.

**Days overdue cell:** monospaced, weight and size scale with urgency per the days overdue coloring table above. This creates a second visual hierarchy signal independent of badge color.

### Cards / panels

```
bg-white rounded-[10px] border border-[#E8EAED] overflow-hidden
```

Panel header:
```
flex items-center justify-between px-5 py-3.5 border-b border-[#F3F4F6]
text-[14px] font-medium text-[#111]
```

### Stat cards

```
bg-white rounded-[10px] border border-[#E8EAED] px-[18px] py-4
// Label: text-[11px] text-[#6B7280] uppercase tracking-[.07em] mb-1.5
// Value: text-[26px] font-semibold font-mono tracking-tight
// Sub: text-[11px] text-[#9CA3AF] mt-0.5
```

Value color comes from the stat card color table above. Max 3 distinct colors per dashboard grid. Do not add a new color for each metric — assign the closest semantic role.

### Form inputs

```
w-full rounded-[7px] border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#111] bg-white
focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]
```

### Selects

```
rounded-[7px] border border-[#E5E7EB] px-2.5 py-1.5 text-[12px] bg-white text-[#374151]
cursor-pointer
```

### Avatar circles (patient initials)

```
w-8 h-8 rounded-full bg-[#F0FBF7] flex items-center justify-center
text-[11px] font-semibold text-[#0F6E56] shrink-0 cursor-pointer
hover:ring-2 hover:ring-[#059669] hover:ring-offset-1 transition-all
```

---

## Motion

- Duration: `150ms` for interactive states, `200ms` for reveals, `250ms` for panel entries
- Easing: `ease-out` or `transition-colors` (Tailwind default)
- No bounce, no elastic, no spring
- Sidebar panel slide: `translate-x-full` → `translate-x-0` with `duration-200`

---

## Sidebar

Background: `#111A17`
Width: `260px` fixed, hidden off-screen on mobile (slide in via `translate-x`)
Border right: `1px solid #1A2B24`

### Clinic header

No emoji. Clinic identity uses a 2-letter text monogram:

```
// Monogram square
w-7 h-7 rounded-[6px] bg-[rgba(29,158,117,0.2)] flex items-center justify-center
text-[11px] font-bold text-[#4ECFA0] shrink-0

// Clinic name
text-[11px] font-semibold text-[#4ECFA0] leading-tight

// "Active clinic" label
text-[9px] uppercase tracking-[.06em] text-[#2E5048] mt-px
```

The monogram is derived from the clinic display name (e.g., "Riverside Pediatric" → "RP", "Behavioral Health" → "BH"). Never use the clinicEmoji field in the sidebar UI.

### Nav links

Active: `bg-[rgba(29,158,117,0.15)] text-[#4ECFA0] font-medium`
Inactive: `text-[#5A8A7E] hover:bg-[#1A2B24] hover:text-[#8DC4B8]`
All links: `px-2.5 py-2 rounded-[7px] text-[13px] transition-colors`
Icons: SVG only, no emoji anywhere in the sidebar

Section labels: `text-[9px] uppercase tracking-[.1em] text-[#2E5048]`

---

## Login page

Clean, cohesive with the app shell. Not a generic centered card.

**Layout:** Split screen on desktop. Dark left panel (matching sidebar background) + light right form panel.

**Left panel** (40% width on desktop, hidden on mobile):
```
bg-[#0D1412] flex flex-col justify-between p-10 h-full
```
Content: Missing Patients logotype (green square icon + wordmark), a one-line value prop, and a muted tagline. Nothing else. No illustration, no decoration.

**Right panel** (60% on desktop, full-width on mobile):
```
bg-[#F4F6F8] flex items-center justify-center p-8
```
Centered form card:
```
bg-white rounded-[12px] border border-[#E8EAED] p-8 w-full max-w-[360px] shadow-sm
```
Contents: `h2` "Sign in" in `text-[20px] font-semibold`, email input, password input, primary CTA button, demo access link below in `text-[12px] text-[#9CA3AF]`.

No social login buttons. No "forgot password" unless auth supports it. No decorative elements on the form card.

---

## Patient portal

Secondary surface — different register from the clinic app. Patients, not staff.

**Principles:** Breathable, simple, reassuring. No clinical jargon in labels. No sidebar. No urgency badges visible to the patient.

**Layout:** Centered single-column, max-width `520px`. White background. Top strip in `#111A17` with the Missing Patients wordmark.

**Typography:** Slightly looser than the app — `text-[14px]` body, `text-[24px]` for patient name heading.

**Color:** Same green accent, but no urgency reds or ambers. Status information uses neutral language and neutral colors.

---

## Anti-patterns to avoid

- Side-stripe `border-left` accents on cards or list items (rewrite with background tint or nothing)
- Gradient text (`background-clip: text`)
- Glassmorphism decoratively
- Hero-metric template (big number + gradient accent)
- Identical icon+heading+text card grids
- Emojis anywhere in authenticated app UI — sidebar, stat cards, page headings, table cells, badges
- Zebra striping in tables
- Generic teal/blue healthcare palette
- Display fonts for UI labels
- Reinventing standard affordances (use `<select>` not custom dropdowns for simple lists)
- Purple stat card values — purple carries no clinical meaning in this system
- Five or more distinct value colors in a single dashboard grid
- Consumer wellness aesthetics in any authenticated screen — soft palettes, rounded-everything, warm gradients
