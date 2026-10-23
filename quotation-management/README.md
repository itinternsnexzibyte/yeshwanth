# NexziByte Quotation Management

Production-oriented quotation module built from the supplied quotation development specification. Payroll is intentionally not implemented. The project exposes clean integration boundaries so both products can later share authentication, navigation and audit conventions without mixing business data.

## Implemented

- Secure first-run administrator setup; no built-in username or password.
- Argon2id password hashing, HttpOnly session cookie, CSRF protection, account lockout and login rate limiting.
- Admin, Quotation User and Viewer role model with server-side enforcement.
- Customer/contact and product/approved-price masters.
- Word-style in-app quotation editor with editable dates, customer details, subject, reference, line items, terms and notes.
- Post-generation revision workflow: issued quotations create a controlled revision, open it in the editor, and retain the replaced record for audit history.
- Server-authoritative Decimal calculations with editable authorised price/discount values.
- GST breakup as CGST 9% + SGST 9%, or IGST 18%, plus freight and grand total.
- Transaction-safe daily quotation numbering: `QT/NBS/YYYYMMDD/0001`.
- Immutable product/pricing snapshots inside quotation items.
- DOCX download and A4 AcroForm PDF generation using the supplied quotation layout, NexziByte company header and authorised signatory. The downloaded PDF is directly editable without an external conversion service, while the database record remains protected by the revision workflow.
- NexLekha wordmark in the quotation application UI; generated DOCX/PDF quotations retain the official NexziByte company identity and do not show NexLekha branding.
- Supplied authorised signature image embedded in generated DOCX and PDF quotations, controlled by `QUOTATION_SIGNATURE_PATH`.
- Login-page switch to the separate Sales Management application; accounts, registration emails, passwords and PostgreSQL databases remain separate.
- Grand total displayed in Indian currency words in the editor, DOCX and PDF (for example, `Rupees Ten Thousand Only`).
- Bundled approved company brochure, appended inside every generated Word and PDF quotation.
- Branded SaaS dashboard, searchable register, audit trail and responsive desktop/tablet/mobile UI.
- Integration health contract for later composition with the payroll module.
- Configurable global, template and product pricing rules enforced by the backend.
- Final-format PDF preview, filtered audit history and CSV quotation-register export.
- Automated calculation tests, PostgreSQL backup/restore commands and full Docker deployment.
- OpenAPI reference and complete user, administrator and deployment guides under `docs`.
- Personal profile settings with authenticated profile-picture upload, current-password verification, password change and secure logout.
- Consistent dark lime SaaS interface based on the approved visual reference, covering login, dashboard, forms, registers, reports and mobile navigation.

## Local setup on Windows

### 1. PostgreSQL

Create the database and user in pgAdmin or use Docker Compose:

```cmd
docker compose up -d postgres
```

If Docker is unavailable, create `nexzibyte_quotations` in PostgreSQL and place the correct username/password in `backend\.env`.

### 2. Backend

```cmd
cd backend
copy .env.example .env
notepad .env
cd ..
npm install
cd backend
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npm run dev
```

Generate three different secure secrets:

```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use different results for `JWT_SECRET`, `BOOTSTRAP_TOKEN` and `INTEGRATION_API_KEY`. Do not commit `.env`.

To enable the dashboard brochure button, copy the approved PDF into `backend\assets` and set:

```env
COMPANY_BROCHURE_PATH="assets/company-brochure.png"
COMPANY_LOGO_PATH="assets/nexzibyte-logo.png"
COMPANY_PROFILE_CARD_PATH="assets/company-profile-card.png"
```

### 3. Frontend

Open a second terminal:

```cmd
cd frontend
npm install
npm run dev
```

Open the Sales Management application at `http://localhost:5173` and Quotation Management at `http://localhost:5174`. The login-page switch opens the other platform in the configured browser URL. On the first visit, create the administrator using the `BOOTSTRAP_TOKEN` stored in the backend `.env`. The token is used only for first-run setup and never becomes the password.

## First functional test

1. Create the first administrator and sign in.
2. For an existing database, load the two template slots and eight controlled product placeholders once with `npm run db:seed` from `backend`.
3. In Products & pricing, edit each pending product with client-approved details and activate it.
4. Add a customer and contact.
5. Open New quotation, select customer, template and product.
6. Enter quantity, dates, terms and freight; select Recalculate.
7. Verify subtotal, discount, taxable amount, CGST, SGST and grand total.
8. Issue the quotation and open Quotation register.
9. Download Word and **Editable PDF**; click the highlighted/form values in the PDF to edit customer, project, price, tax, total, terms or signatory text, save a copy, and then confirm the audit trail.
10. Select **Revise & edit** for the issued quotation. Change its wording, dates, items or pricing, then select **Save & generate**.
11. Confirm that a revision number such as `-R1` is retained, the previous record is marked `REVISED`, and the updated PDF downloads successfully.

## Important production notes

- Run reviewed Prisma migrations (`prisma migrate deploy`) instead of `db push` in production.
- Use HTTPS and `NODE_ENV=production` so cookies are Secure.
- Put the backend behind a reverse proxy and store generated files in approved object storage rather than local disk.
- Confirm real client numbering rules, template wording, logos, GST place-of-supply rules and rounding samples before go-live.
- The generated standard A4 layout is based on the provided sample. Castrol/Tegutec pixel matching remains a UAT gate when the actual approved source templates are supplied.
- Back up PostgreSQL daily and test restoration.

## Verification commands

```cmd
cd backend
npx prisma generate
npx prisma db push
npm test
npm run build
cd ..\frontend
npm run build
```

Backup and restore:

```cmd
cd backend
npm run db:backup -- backups\quotation.backup
npm run db:restore -- backups\quotation.backup
```
