@AGENTS.md

# Clinic Accountant — Project Specification

> Single source of truth for all AI-assisted development on this project.
> Read this file fully before making any change.

---

## 1. Project Overview

A **bilingual (Arabic/English) clinic financial management SaaS** for doctors in Egypt.
Doctors register, create clinics, add patients, log transactions (manual or OCR scan), and track earnings. An admin panel exists for platform-level management.

**Primary market:** Egyptian doctors → default locale is **Arabic (`ar`)**, RTL layout.

---

## 2. Tech Stack (exact versions — do not upgrade without explicit instruction)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.1 |
| Runtime | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Database | PostgreSQL via Prisma ORM | 5.22.0 |
| Auth | NextAuth v5 (beta) | 5.0.0-beta.30 |
| i18n | next-intl | ^4.8.3 |
| Validation | Zod | ^4.3.6 |
| UI Components | Radix UI primitives + shadcn/ui pattern | various |
| Styling | Tailwind CSS | ^4 |
| Charts | Recharts | ^3.8.1 |
| Icons | lucide-react | ^1.7.0 |
| Rate Limiting | Upstash Ratelimit + Redis | ^2.0.8 |
| Bundler | Turbopack (dev) | built-in |

---

## 3. Project Structure

```
src/
├── app/
│   ├── (auth)/          # login, register pages + SessionProvider layout
│   ├── (dashboard)/     # all authenticated doctor pages
│   │   ├── page.tsx              # dashboard
│   │   ├── clinics/              # clinic list + [id]/patients/[patientId]
│   │   ├── transactions/         # transaction history + add
│   │   ├── tickets/              # support tickets
│   │   └── settings/             # profile, password, language
│   ├── (admin)/         # admin panel (role=ADMIN only)
│   │   └── admin/
│   └── api/             # all API routes
│       ├── auth/
│       ├── clinics/[id]/
│       │   ├── patients/[patientId]/
│       │   │   ├── route.ts             # GET/PUT/DELETE patient
│       │   │   ├── profile/route.ts     # GET aggregated profile + financials
│       │   │   ├── notes/route.ts       # GET/POST patient notes
│       │   │   ├── notes/[noteId]/route.ts  # DELETE note
│       │   │   └── transactions/route.ts    # GET paginated patient txns
│       │   ├── transactions/[transactionId]/route.ts
│       │   ├── transactions/scan/route.ts   # OCR AI extraction
│       │   └── columns/route.ts             # custom columns
│       ├── dashboard/
│       ├── tickets/
│       ├── admin/
│       ├── profile/
│       └── tags/
├── components/
│   ├── layout/          # Header, LanguageToggle
│   ├── transactions/    # PatientSearch
│   └── ui/              # shadcn-style primitives (Button, Card, Input…)
├── lib/
│   ├── auth.ts          # NextAuth config
│   ├── auth-guard.ts    # requireAuth(), requireAdmin(), verifyClinicOwnership()
│   ├── prisma.ts        # singleton Prisma client
│   ├── audit.ts         # createAuditLog(), getClientInfo()
│   ├── rate-limit.ts    # Upstash rate limiters
│   ├── drive-embed.ts   # getDriveEmbedUrl(), isDriveUrl()
│   └── validators/      # Zod schemas per domain
│       ├── auth.ts
│       ├── clinic.ts
│       ├── patient.ts
│       ├── patient-note.ts
│       ├── ticket.ts
│       └── transaction.ts
├── messages/
│   ├── en.json          # English translations
│   └── ar.json          # Arabic translations (primary)
└── i18n/
    └── request.ts       # locale detection from cookie
```

---

## 4. Database Models (Prisma)

```
Doctor        → has many Clinics, Tickets, AuditLogs
Clinic        → belongs to Doctor; has many Patients, Transactions, CustomColumns
Patient       → belongs to Clinic; has many Transactions, PatientTags, PatientNotes
PatientNote   → belongs to Patient (content, createdAt)
PatientTag    → join table Patient ↔ Tag
Tag           → global per doctor (not per clinic)
Transaction   → belongs to Clinic; optionally linked to Patient
               fields: date, patientName, paid, notes, extra, paidFromExtra,
                       customColumns (JSON), source (manual|scan)
CustomColumn  → belongs to Clinic (name, type, order)
Ticket        → belongs to Doctor; has many TicketReplies
TicketReply   → belongs to Ticket; isAdmin flag
AuditLog      → append-only log of all mutations
```

**Key conventions:**
- All IDs: `cuid()` — never use auto-increment integers
- Soft deletes are NOT used — use hard deletes with `onDelete: Cascade`
- `treatmentPlanLink` on Patient is a plain URL string (Google Drive preferred)
- `extra` = money held in account; `paidFromExtra` = portion withdrawn from that held amount; `heldAmount = extra - paidFromExtra`
- `customColumns` on Transaction is `Json?` (arbitrary key-value per clinic config)

**DB scripts:**
```bash
npm run db:push       # apply schema changes (dev, no migration history)
npm run db:migrate    # create named migration (prod)
npm run db:seed       # seed admin user
npm run db:studio     # open Prisma Studio
```

---

## 5. Authentication & Authorization

### Flow
- Phone + password authentication via NextAuth v5 `CredentialsProvider`
- Session stored as JWT; user object includes `id`, `role` (`DOCTOR` | `ADMIN`)
- Account lockout: 5 failed attempts → locked for 15 minutes (stored in DB)

### Guards — always use these in API routes:

```ts
// Require any authenticated user
const { error, session } = await requireAuth();
if (error) return error;

// Require admin role (returns 404, not 403, to prevent role enumeration)
const { error, session } = await requireAdmin();
if (error) return error;

// Verify clinic ownership (always use — prevents IDOR attacks)
const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
if (!clinic) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

**CRITICAL:** Always return `404` (not `403`) when a resource is not found OR not owned. This prevents enumeration attacks.

### Admin credentials (seed)
- Phone: `01025356175`
- Password: `Admin@123`

---

## 6. Security Patterns

### Rate Limiting (Upstash Redis)
```ts
import { generalRateLimit, checkRateLimit } from "@/lib/rate-limit";

const { success } = await checkRateLimit(generalRateLimit, session!.user.id);
if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
```

**Limiters:**
| Limiter | Limit | Window | Used for |
|---|---|---|---|
| `loginRateLimit` | 5 requests | 15 min | Login endpoint |
| `registerRateLimit` | 3 requests | 1 hour | Registration |
| `scanRateLimit` | 10 requests | 1 hour | OCR scan |
| `generalRateLimit` | 100 requests | 1 min | All other mutations |

Rate limiting is **no-op in development** if Redis env vars are not set.

### Audit Logging
Every mutation (create/update/delete) must log to `AuditLog`:
```ts
import { createAuditLog, getClientInfo } from "@/lib/audit";

const { ip, userAgent } = getClientInfo(request);
await createAuditLog({
  action: "entity.verb",      // e.g. "patient.create", "transaction.delete"
  entity: "ModelName",        // e.g. "Patient"
  entityId: record.id,
  details: { ...relevantData },
  doctorId: session!.user.id,
  ip,
  userAgent,
});
```

Audit logging failures are **silently swallowed** — they must never break the main request flow.

---

## 7. Validation (Zod)

All request bodies must be validated with Zod before touching the database.

**Pattern:**
```ts
import { mySchema } from "@/lib/validators/my-entity";

const body = await request.json();
const parsed = mySchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: "Validation failed", details: parsed.error.flatten() },
    { status: 400 }
  );
}
```

**Validation rules:**
- Names: `min(1).max(100).trim()`
- Passwords: min 8, max 128, must have uppercase + lowercase + digit
- Phone: min 8, max 20, regex `^[\d+\-\s()]+$`
- URLs: `.url().max(2000)` — allow empty with `.or(z.literal(""))`
- Notes/content: `min(1).max(1000).trim()`
- IDs (foreign keys in arrays): `.array(z.string().cuid()).max(20)`

**All validators live in `src/lib/validators/` — one file per domain.**

---

## 8. API Route Conventions

Every API route follows this exact structure:

```ts
export async function METHOD(request: Request, { params }: RouteParams) {
  try {
    // 1. Auth check
    const { error, session } = await requireAuth();
    if (error) return error;

    // 2. Rate limit (mutations only)
    const { success } = await checkRateLimit(generalRateLimit, session!.user.id);
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    // 3. Resolve params
    const { id: clinicId, ... } = await params;  // params is always a Promise in Next.js 16

    // 4. Ownership verification
    const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
    if (!clinic) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 5. Validate body (mutations)
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

    // 6. Database operation
    const result = await prisma.model.action({ ... });

    // 7. Audit log (mutations)
    await createAuditLog({ ... });

    // 8. Return
    return NextResponse.json(result, { status: 201 }); // 201 for creates, 200 default
  } catch (err) {
    console.error("METHOD /path error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Route params are always a `Promise` in Next.js 16:**
```ts
interface RouteParams {
  params: Promise<{ id: string }>;
}
const { id } = await params; // always await
```

---

## 9. Localization (i18n)

### Setup
- Library: `next-intl` v4
- Locale stored in cookie `locale` (set by language toggle)
- Server reads it in `src/i18n/request.ts`
- Default locale: **`ar`** (Arabic, RTL)
- Supported: `ar`, `en`

### HTML Direction
Set on `<html>` in `src/app/layout.tsx`:
```tsx
<html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
```
`suppressHydrationWarning` is required because browser extensions can modify `<html>` attributes.

### Translation Files
- `src/messages/en.json` — English
- `src/messages/ar.json` — Arabic (always update both together)

**Structure (namespaced):**
```json
{
  "common": { "save": "Save", "cancel": "Cancel", ... },
  "auth": { ... },
  "validation": { ... },
  "patients": { ... },
  "patientProfile": { ... },
  "transactions": { ... },
  "tickets": { ... },
  "settings": { ... },
  "admin": { ... }
}
```

**Usage in client components:**
```tsx
const t = useTranslations("patients");
const tc = useTranslations("common");
// <p>{t("addPatient")}</p>
```

**Rules:**
- Every user-visible string must be in both translation files
- Never hardcode English text in JSX — always use translation keys
- RTL-aware CSS: use `start`/`end` instead of `left`/`right` (e.g., `text-start`, `ms-4`, `ps-3`)
- For LTR-forced elements (phone numbers, IPs, code): add `dir="ltr"` inline

### Tailwind RTL Classes
Use logical properties throughout:
- `ms-*` / `me-*` instead of `ml-*` / `mr-*`
- `ps-*` / `pe-*` instead of `pl-*` / `pr-*`
- `text-start` / `text-end` instead of `text-left` / `text-right`

---

## 10. UI Component Conventions

### Component Library
shadcn/ui pattern — components live in `src/components/ui/`. All use Radix UI primitives under the hood.

**Available components:** Button, Input, Label, Card (+ CardContent/Header/Title), Badge, Dialog, Select, Separator, Tabs, Avatar, Checkbox, Popover, Toast.

**Color system (Tailwind):**
| Usage | Color |
|---|---|
| Primary actions, success | `teal-600` / `teal-700` |
| Warning / held amounts | `amber-500` / `amber-600` |
| Destructive / delete | `red-600` |
| Secondary text | `gray-500` |
| Borders | `gray-200` |
| Page background | `gray-50/50` |

### Page Layout Pattern
Every page follows this shell:
```tsx
"use client";
export default function SomePage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header title={t("title")}>
        {/* optional header actions */}
      </Header>
      <div className="p-4 lg:p-6 space-y-6">
        {/* content */}
      </div>
    </div>
  );
}
```

### Data Fetching Pattern
All pages fetch data client-side in `useEffect` — there is no SSR data fetching on page components.
```tsx
const [data, setData] = useState<Type | null>(null);
const [loading, setLoading] = useState(true);

const fetchData = useCallback(async () => { ... }, [deps]);
useEffect(() => { fetchData(); }, [fetchData]);
```

Show `<Loader2 className="h-8 w-8 animate-spin text-teal-600" />` while loading.

### Charts
Recharts is used for all data visualization:
- Dashboard: `BarChart` for monthly earnings
- Patient profile: `PieChart` (donut) for paid vs held
- Always wrap in `<ResponsiveContainer width="100%" height="...">`.

### Drive Embed Viewer
For `treatmentPlanLink` fields:
```ts
import { getDriveEmbedUrl, isDriveUrl } from "@/lib/drive-embed";

const embedUrl = getDriveEmbedUrl(url); // returns /preview URL or null
// Render: <iframe src={embedUrl} style={{ height: "480px" }} />
```
Works for Google Drive PDFs, PPTs (Slides), Docs. Requires file sharing set to "Anyone with the link".

---

## 11. Hydration

`suppressHydrationWarning` is required on:
- `<html>` tag (locale/dir attributes change based on cookie)
- Any element rendering `toLocaleString()` / `toLocaleDateString()` / `toLocaleTimeString()` that could be server-rendered

Since all pages are `"use client"` and fetch data client-side, most formatted dates/numbers are hydration-safe (they only render post-mount). Add `suppressHydrationWarning` on the specific element as needed.

---

## 12. AI Model Preferences

- **Sonnet** → implementation (writing code, edits, bug fixes)
- **Opus** → planning (architecture, multi-step feature design, trade-off analysis)

---

## 13. Key Business Logic

### Financial Calculations
```
totalPaid      = SUM(Transaction.paid)          per patient/clinic
heldAmount     = SUM(extra) - SUM(paidFromExtra) per patient/clinic
                 (clamped to 0 if negative)
```

### Transaction Sources
- `"manual"` — entered by hand
- `"scan"` — extracted via AI OCR from uploaded image

### Ticket System
- Doctors create tickets; admin responds
- `isAdmin: true` on `TicketReply` = admin message
- In **doctor view**: own messages = "Your Reply", admin messages = "Admin Reply"
- In **admin view**: own messages = "You", doctor messages = doctor's actual name

### Patient Notes
- Append-only timeline (no editing, only deletion)
- Ordered newest first
- Max 1000 characters per note

---

## 14. Environment Variables

```env
DATABASE_URL=                    # PostgreSQL connection string
NEXTAUTH_SECRET=                 # NextAuth JWT signing secret
NEXTAUTH_URL=                    # Base URL (http://localhost:3000 in dev)
UPSTASH_REDIS_REST_URL=          # Optional: rate limiting (no-op without it)
UPSTASH_REDIS_REST_TOKEN=        # Optional: rate limiting
OPENAI_API_KEY=                  # Required for OCR scan feature
```

---

## 15. Common Patterns Quick Reference

```ts
// Auth in API route
const { error, session } = await requireAuth();
if (error) return error;

// Clinic ownership check
const clinic = await verifyClinicOwnership(clinicId, session!.user.id);
if (!clinic) return NextResponse.json({ error: "Not found" }, { status: 404 });

// Validate body
const parsed = schema.safeParse(await request.json());
if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

// Audit log
await createAuditLog({ action: "entity.verb", entity: "Model", entityId: id, details: {}, doctorId: session!.user.id, ...getClientInfo(request) });

// Rate limit
const { success } = await checkRateLimit(generalRateLimit, session!.user.id);
if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

// Paginated query
const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
const [items, total] = await Promise.all([
  prisma.model.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
  prisma.model.count({ where }),
]);
return NextResponse.json({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
```
