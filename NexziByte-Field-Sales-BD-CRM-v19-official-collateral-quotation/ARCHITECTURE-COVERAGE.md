# Architecture coverage

This release maps the supplied 16-page architecture to executable modules.

| Document area | Implementation |
|---|---|
| Relational CRM flow | Transactional visit checkout creates Lead, Requirement, Opportunity, Follow-up, queued EmailLog and ActivityLog records. |
| YES / NO / MAYBE outcomes | Server-enforced conditional validation, re-engagement scheduling and seven-day MAYBE follow-up rule. |
| Follow-up engine | Delegation, ownership history, completion with next action or explicit close, 15-minute reminders and overdue notifications. |
| Email automation | PostgreSQL queue, eight seeded templates, immediate meeting confirmations, automatic 24-hour meeting reminders, SMTP worker, three retries, provider message IDs, signed delivery webhook and communication history. |
| Security | HttpOnly JWT cookies, refresh revocation, RBAC, Zod validation, Helmet, strict CORS, authentication throttling, audit logs and admin-only proof photos. |
| Dashboards and analytics | Role-scoped summary, executive check-in monitor, reports, pipeline, communications, notifications, field map and activity-log screens. |
| Opportunity and quotation | Stage-controlled pipeline plus quotation items and status workflow. |
| Company 360 | Company/contact/visit/requirement/opportunity/follow-up/email/activity timeline API. |
| Field proof | GPS check-in/check-out, hourly updates, required company photo and administrator review. |
| Scheduled operations | Reminder, overdue, email retry and stale-visit auto-close jobs. |

## External services requiring organization credentials

- SMTP requires the organization email account and App Password/API credential.
- Production proof-image storage should use private Google Cloud Storage signed uploads; the local demonstration continues to accept a compressed data URL so it runs without cloud credentials.
- WhatsApp remains Phase 2 as specified in the architecture, because Meta Business verification, approved templates, customer consent and webhook credentials are prerequisites.

## Validation performed

- Prisma schema formatting and client generation
- Backend TypeScript production build
- Frontend TypeScript and Vite production build
- Source archive excludes generated `node_modules` and `dist` folders
