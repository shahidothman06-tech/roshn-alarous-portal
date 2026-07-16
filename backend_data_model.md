# Backend data model — ROSHN Alarous villa progress tracker

This describes the real backend a team would build to replace the demo
storage layer in the artifact with live data from ROSHN's systems.

## 1. Entities

### Buyer
| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| full_name | string | |
| email | string | login identity |
| phone | string | for SMS/WhatsApp notifications |
| national_id_or_iqama | string (encrypted) | for KYC / Wafi linkage |

### Project
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| name | string | e.g. "Alarous" |
| city | string | e.g. "Jeddah" |
| developer | string | "ROSHN" |

### Unit (villa)
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| unit_code | string | e.g. "ALR-114", shown to buyer |
| project_id | uuid (FK) | |
| block | string | e.g. "Block 14, Cluster C" |
| villa_type | string | e.g. "Type C — 4BR Detached Villa" |
| plot_area_sqm | decimal | |
| built_up_area_sqm | decimal | |
| floors | string | |
| orientation | string | |
| buyer_id | uuid (FK) | current owner |
| purchase_date | date | |
| estimated_handover_date | date | |
| actual_handover_date | date, nullable | set once handed over |
| wafi_registration_no | string | off-plan sale program registration |

### ConstructionPhase (template, shared across units of a project/type)
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| project_id | uuid (FK) | |
| key | string | stable slug, e.g. "mep" |
| label | string | display name |
| sequence | int | build order |
| weight_pct | int | contribution to overall %, sums to 100 per project |

### UnitPhaseProgress (per-unit instance of a phase)
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| unit_id | uuid (FK) | |
| phase_id | uuid (FK) | |
| percent_complete | int (0–100) | |
| status | enum | derived or stored: upcoming / active / done |
| started_at | date, nullable | |
| target_date | date, nullable | |
| completed_at | date, nullable | |
| last_updated_by | uuid (FK → site engineer / PM) | |
| last_updated_at | timestamp | |

### SiteUpdate (log entry / photo)
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| unit_id | uuid (FK) | or project_id for shared updates across a block |
| phase_id | uuid (FK), nullable | which phase this relates to |
| title | string | |
| note | text | |
| photo_urls | string[] | stored in object storage (S3-compatible) |
| posted_by | uuid (FK) | site engineer / PM |
| posted_at | timestamp | |

### PaymentMilestone (optional, ties to Wafi-style installment schedule)
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| unit_id | uuid (FK) | |
| phase_id | uuid (FK) | milestone unlocked at this phase |
| amount_due | decimal | |
| due_status | enum | pending / invoiced / paid |
| invoiced_at | timestamp, nullable | |
| paid_at | timestamp, nullable | |

## 2. Relationships

```
Project 1---* Unit
Project 1---* ConstructionPhase
Unit    1---* UnitPhaseProgress *---1 ConstructionPhase
Unit    1---* SiteUpdate
Unit    1---* PaymentMilestone
Buyer   1---* Unit
```

## 3. API contract (REST, buyer-facing)

All buyer-facing endpoints are scoped to the authenticated buyer's own unit(s) — never expose another buyer's data by unit_code alone; authorize by the logged-in buyer_id.

```
GET  /api/v1/me/units
     -> [{ unit_code, project, villaType, plot, builtUp, ... }]

GET  /api/v1/units/{unit_code}/progress
     -> {
          overall_percent: 62,
          phases: [
            { key, label, percent_complete, status, target_date, completed_at }
          ]
        }

GET  /api/v1/units/{unit_code}/updates?limit=20&before=<timestamp>
     -> [{ title, note, photo_urls, posted_at }]

GET  /api/v1/units/{unit_code}/payments
     -> [{ phase_key, amount_due, due_status, invoiced_at, paid_at }]
```

## 4. API contract (site team / internal, write access)

Requires site-engineer or PM role; every write is audited (who/when).

```
PATCH /api/v1/internal/units/{unit_code}/phases/{phase_key}
      body: { percent_complete }
      -> recalculates overall_percent, updates status, logs audit entry

POST  /api/v1/internal/units/{unit_code}/updates
      body: { title, note, photo_urls[], phase_key? }

PATCH /api/v1/internal/units/{unit_code}
      body: partial unit fields (buyer_name, estimated_handover_date, ...)
```

## 5. Notifications (recommended, not required for v1)

- On `percent_complete` crossing a phase boundary (e.g. reaching 100%), trigger:
  - Push/SMS/email to buyer: "Foundation & Structure is now complete."
  - If a PaymentMilestone is tied to that phase, trigger an invoice event.
- Webhook out to ROSHN's CRM (or Wafi reporting, if required by REGA) whenever
  `actual_handover_date` is set.

## 6. Auth & data protection

- Buyers authenticate via national ID/Iqama + OTP (aligns with how ROSHN's
  existing app likely verifies buyers) or SSO from ROSHN's main account system.
- Encrypt national_id_or_iqama and any payment data at rest.
- Rate-limit and audit every internal write endpoint — this data represents
  a legal/contractual construction record and may be referenced in disputes.

## 7. Mapping to the current artifact

The artifact's storage keys map directly onto this model as a working stand-in:

| Artifact storage key | Maps to |
|---|---|
| `unit:{unitId}` | `Unit` (+ denormalized `Buyer`, `Project` fields) |
| `phases:{unitId}` | `UnitPhaseProgress` joined with `ConstructionPhase` |
| `updates:{unitId}` | `SiteUpdate` |

To go live: replace the `storageGet`/`storageSet` helper functions in the
React app with `fetch()` calls against the endpoints above, and swap the
"Site Team" panel's storage writes for the internal `PATCH`/`POST` calls.
