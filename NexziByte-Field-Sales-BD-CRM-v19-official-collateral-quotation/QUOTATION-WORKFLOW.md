# Quotation to Won/Lost workflow

## First-time update

Run these commands inside `backend` after completing `.env`:

```cmd
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open a second terminal inside `frontend`:

```cmd
npm install
npm run dev
```

## Workflow

1. A completed **YES** visit creates a qualified requirement and opportunity.
2. A completed **MAYBE** visit creates a nurture opportunity and requires a follow-up within seven days.
3. A completed **NO** visit stores the reason and selected revisit plan.
4. In **Pipeline**, Admin, Sales Head, BD Manager or Technical Team creates a versioned quotation by entering line items, quantities, prices, discount, GST, validity, payment terms and delivery timeline.
5. Clicking **Generate quotation PDF** calculates all totals, creates a professionally formatted PDF, stores it in the backend and adds a **Preview PDF** link. No manual PDF upload or document URL is required.
6. Move it through **Draft → Pending Approval → Approved → Sent**. Sending automatically attaches the generated PDF.
7. The client receives the quotation PDF and a private budget-response form by email.
8. The client selects:
   - **YES**: opportunity becomes **Won** and a kickoff/payment follow-up is created.
   - **MAYBE**: a specific reason is mandatory, the opportunity becomes **Decision Pending**, and an urgent quotation follow-up is assigned.
   - **NO**: a specific reason is mandatory, the opportunity becomes **Lost**, and an urgent commercial follow-up is assigned.

Admin, Sales, BD Management, the opportunity owner and Technical Team receive automatic email and in-app notifications. A YES response triggers the Won celebration automatically. MAYBE and NO responses trigger a hot quotation alert so budget, scope or commercial objections can be discussed quickly.

Won and Lost cannot be selected manually from the opportunity stage list; closure must be recorded through the client quotation decision so the audit history remains complete.

Won celebrations and hot quotation alerts are displayed once per new notification and are not replayed merely because the dashboard was refreshed.
