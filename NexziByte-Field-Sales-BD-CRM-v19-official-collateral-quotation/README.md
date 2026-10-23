# NexziByte Field Sales & BD CRM — Management Edition

A full-stack starter implementation based on the supplied Field Sales & BD CRM architecture.

## Version 14 alerts, duplicate protection and celebrations

- Company mobile numbers are normalized so formats such as `+91 98765 43210` and `9876543210` are treated as the same number.
- Duplicate company submissions are blocked, audited and shown to authorized managers under **Companies → Spam & duplicate protection**.
- New unread notifications are checked every 15 seconds and produce an unread badge, short alert sound and supported-device vibration.
- Moving an opportunity to **WON** displays a polished congratulations animation with a success tone and vibration.
- All existing desktop/tablet sidebar behavior, mobile interface, booking workflow, automatic emails, reminders and voice-call integration remain available.

Run `npx prisma db push` once after upgrading because this version adds normalized company-phone data and the duplicate-attempt log.

## Version 12 realistic follow-up workflow

- Assigned follow-ups require the receiving salesperson to accept or decline.
- An accepted assignee can email a secure, expiring booking link with multiple time slots to the client.
- The client chooses a slot without creating a CRM account.
- Booking confirmation updates the follow-up and emails the client, assigned salesperson, original owner and active administrators.
- Email and consent-controlled call reminders are rebuilt for the client-confirmed schedule.
- Meeting completion can request quotation preparation and move the opportunity into the quotation stage.
- `voice-service` is a Python FastAPI service for ElevenLabs or fallback TTS. Twilio remains the telephone carrier.

Run `npx prisma db push` once after upgrading an existing database because this version adds acceptance and booking fields.

### Test the mentor scenario

1. Admin assigns Rahul's company to Salesperson A and Salesperson A records the visit.
2. Salesperson A creates a follow-up assigned to Mohammed. Mohammed receives an email.
3. Mohammed signs in and clicks **Accept**.
4. Mohammed clicks **Request client time**, offers at least two future slots, and the CRM emails Rahul a private booking link.
5. Rahul opens the link and selects a slot. The CRM updates the follow-up and emails Rahul, Mohammed, the original owner and every active administrator.
6. Scheduled reminders are queued for the client, Mohammed and the original owner. If consent-controlled calls are enabled, the call queue is rebuilt for Rahul's selected time.
7. Mohammed completes the meeting and selects **Request quotation preparation**. The opportunity moves to `QUOTATION` and administrators are notified.

For a client outside the developer computer, `PUBLIC_APP_URL` must be the deployed frontend HTTPS URL rather than `localhost`.

### Python natural-voice service

The optional service is under `voice-service`. Run it separately with Python 3.11+ and expose it through public HTTPS so Twilio can fetch its TwiML/audio. Configure the same `VOICE_SERVICE_TOKEN` in both services. ElevenLabs requires its own API key, voice ID, billing and documented speaker consent. A voice-generation service does not replace a licensed telephone carrier.

## SaaS workspace update
- v11 adds two responsive product shells (new sidebar workspace for tablets/laptops and the latest horizontal experience for phones), signed reply-enabled business emails with configurable CC, and a consent-controlled AI reminder-call queue with delivery logs and Twilio activation settings
- v10 refines the premium interface with a logo-only header, no hamburger, compact command-bar navigation, functional dashboard actions, a tighter executive hero and richer live-performance presentation
- v9 completely replaces the sidebar layout with a premium horizontal product shell, editorial command dashboard, minimal corporate authentication, refined tables, forms, modals and responsive mobile navigation
- v8 removes duplicate settings navigation and the SalesOS label, adds functional workspace search, admin company deletion/archiving, and a dedicated one-click Project Requirements workspace
- v7 replaces the original dark dashboard shell with a new light enterprise SaaS interface, command top bar, SalesOS navigation and bento-style command dashboard
- Modern SaaS-style workspace, navigation, cards, tables, filters and responsive states
- Separate visit outcome views for Project Required, No Requirement and Collaboration
- Collaboration-specific contact, partnership details and follow-up workflow
- Searchable Activity Center with company, event, module and date-range filters
- Existing legacy `MAYBE` records remain readable, while new check-outs use YES, NO or COLLABORATION

## Stack
- Frontend: React + TypeScript + Vite + Tailwind CSS + React Hook Form + Zod + TanStack Query + Recharts
- Backend: Node.js + Express + TypeScript + Zod
- Database: PostgreSQL + Prisma
- Auth: HttpOnly secure-cookie JWT sessions + refresh-token rotation support + RBAC + email verification + password reset
- Email: durable PostgreSQL queue + SMTP worker, retries, delivery webhook and email history

## Run locally

### 1. Database
Copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL`, and add the SMTP values. For Gmail, use the 16-character Google App Password as `SMTP_PASSWORD` (remove spaces).

For local PostgreSQL you can use Docker:

```bash
docker compose up -d db
```

### 2. Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend defaults to `http://localhost:5173`, API to `http://localhost:4000`.

## Sharing the project with its PostgreSQL data

The ZIP normally contains source code and the Prisma schema only. PostgreSQL records (companies, users, visits, assignments, requirements and logs) remain inside the database server and are not automatically included in a ZIP.

On the original computer, create a portable backup from `backend`:

```bash
npm run db:backup -- backups/nexzibyte-crm.backup
```

Share `backups/nexzibyte-crm.backup` together with the project. On the colleague's computer, create `backend/.env` with that computer's PostgreSQL credentials, ensure the empty `nexzibyte_crm` database exists, and run:

```bash
npm install
npm run db:restore -- backups/nexzibyte-crm.backup
npx prisma generate
npm run dev
```

Restoring replaces matching CRM tables/data in the selected database. Back up an existing database before restoring. Never share `backend/.env`; the scripts use each computer's local `DATABASE_URL`. `pg_dump` and `pg_restore` are installed with PostgreSQL and must be available on Windows PATH.

## Simultaneous Admin and Sales testing

Authentication uses secure HttpOnly cookies. Browsers intentionally share cookies between tabs on the same site, so signing in as Sales in a second tab replaces the Admin cookie. Use a normal browser window for Admin and an Incognito window, another browser, or a separate browser profile for Sales. The UI now detects an account replacement and blocks silent role switching. Admin approval counts/lists and the registrant approval screen refresh automatically every five seconds.

## Seed accounts
Password for all seeded accounts: `NexziByte@123`

- admin@nexzibyte.local — Admin
- head@nexzibyte.local — Sales Head
- manager@nexzibyte.local — BD Manager
- executive@nexzibyte.local — Sales/BD Executive
- viewer@nexzibyte.local — Management/Viewer

Change these credentials before production use.

## Included
- Login, 6-digit email verification, forgot-password reset and administrator approval/rejection
- No demo credentials embedded in frontend code; authentication tokens are never returned to or stored by frontend JavaScript
- Four role experiences: Admin, BD Manager, Sales Executive and Management Viewer
- Admin-controlled roles, active status and sales-team membership
- Company master creation/edit permissions and work assignment to approved sales users
- My Day with assigned work, GPS-based Start Visit, check-in and check-out
- Hourly field activity updates and live team activity monitoring
- Mandatory company proof pictures before visit completion, with multi-image selection (up to six) and admin-only gallery review
- Settings page with profile-picture upload/removal, display-name and phone updates, secure password change and logout
- Color-coded lead priorities: Hot (red), Warm (yellow), Cold (blue), Not Qualified and Negative
- Compact live executive check-in/check-out monitor on the Admin dashboard
- YES/NO/MAYBE project outcome capture
- Mandatory contact, phone, email, industry, company location and project requirement fields when Project Required is YES
- Admin-only full requirement review showing company, connected person, contact details, industry, location, project details, priority and visit proof
- Separate Follow-Up System for scheduled client actions, salesperson-to-salesperson delegation, completion notes and automatic return to the original owner
- Leads, requirements and opportunities created automatically from qualified visits
- Role-scoped dashboards, visit register, reports and audit logging
- Atomic YES flow: Visit → Lead → Requirement → Opportunity → Follow-up → queued email → activity timeline
- NO outcome reason and 30/90/180-day, partnership or staffing re-engagement scheduling
- MAYBE outcome enforcement with a mandatory follow-up within seven days
- Follow-up reminders every 15 minutes, overdue alerts, and automatic closure of stale 12-hour visits
- Opportunity stage pipeline, quotation drafting/approval/status tracking and company timelines
- Email communication center with QUEUED, SENT, DELIVERED, OPENED, BOUNCED and FAILED states
- Automatic email retry (three attempts), signed provider webhook, notifications and management activity logs
- Immediate meeting-confirmation email plus an automatic email reminder within 24 hours for F2F, Teams, Zoom and demo meetings
- Verified field-location feed with direct Google Maps links
- Server-side RBAC, Zod validation, strict credentialed CORS, Helmet headers and authentication rate limiting

## Important setup note
After replacing an earlier project version, back up PostgreSQL, then run `npx prisma generate` and `npx prisma db push` inside `backend`. If Prisma reports that a new required column cannot be applied to existing data, do not use `--force-reset` on a production database; create a migration with a temporary nullable/default value and backfill it. Then run `npm run seed`.

## Automatic email and scheduled jobs

Add valid SMTP credentials to `backend/.env`. Gmail requires a 16-character App Password, not the normal account password. Completed visits create queued email records in the same database transaction as their CRM records. The built-in email worker processes the queue at startup and every minute, retries failures up to three times, records the provider message ID and writes an `EMAIL_SENT` activity event. Follow-up reminder scheduling continues to run every 15 minutes.

Providers can update delivery state through `POST /api/webhooks/email` with the `x-webhook-secret` header and JSON `{ "providerMessageId": "...", "status": "DELIVERED" }`. Supported states are `DELIVERED`, `OPENED`, `BOUNCED` and `FAILED`.

## Production notes

- Replace both JWT secrets and the email webhook secret with long random values.
- Use HTTPS and `NODE_ENV=production` so authentication cookies are Secure and HttpOnly.
- The local build stores proof images as data URLs for demonstration. Before production, replace this with private Google Cloud Storage signed uploads and serve proof through an authorized admin endpoint.
- WhatsApp automation remains a Phase 2 integration because it requires an approved Meta Business account, templates, consent and webhook verification.

## Brochure, email correction and quotation signatures

- Every completed visit queues the management-supplied sales brochure, company profile and visiting card for the client for YES, NO, MAYBE and COLLABORATION outcomes.
- The approved assets are bundled in `backend/storage/collateral`. Optional `COMPANY_BROCHURE_PATH`, `COMPANY_PROFILE_PATH` and `COMPANY_VISITING_CARD_PATH` values can replace them without source-code changes.
- Email domains are checked during checkout. Provider bounce/failed events sent to `POST /api/webhooks/email` flag the visit, notify the salesperson and enable **Visits → Correct email**. Saving a corrected address automatically resends the brochure.
- Email delivery processing runs every minute. Exact mailbox verification still depends on the SMTP/email provider reporting a bounce to the configured webhook.
- Quotation PDFs follow the supplied commercial quotation structure and include executive summary, business understanding, proposed scope, architecture, pricing, exclusions, timeline, terms, warranty, client acceptance and NexziByte authorization. The supplied authorized signature is bundled in `backend/storage/signatures`; environment values can replace it when management issues an update.
