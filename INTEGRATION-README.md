# NexziByte dual-platform bundle

This bundle contains two separate applications with login-page navigation between them:

- **Sales Management** — `NexziByte-Field-Sales-BD-CRM-v19-official-collateral-quotation/`
- **NexLekha Quotation Management** — `quotation-management/`

## Local development

1. Create each `.env` from its own `.env.example` (`copy .env.example .env` in Windows Command Prompt), then replace placeholder values with your actual configuration. Keep PostgreSQL URLs, passwords, mail settings, and secrets separate. If you already created the quotation backend `.env`, update its `PORT` to `4001` and `FRONTEND_URL` to `http://localhost:5174`.
2. Start Sales Management using its existing instructions. Its Vite frontend defaults to `http://localhost:5173`.
3. Start Quotation Management's backend using its existing instructions (API: `http://localhost:4001/api`). Its `.env` must use `PORT=4001` and `FRONTEND_URL="http://localhost:5174"`.
4. Start Quotation Management's frontend. It now defaults to `http://localhost:5174`.
5. The Sales login switch opens `VITE_QUOTATION_APP_URL` (default `http://localhost:5174`); the Quotation login switch opens `VITE_SALES_APP_URL` (default `http://localhost:5173`).

Set those `VITE_*_APP_URL` values to the externally reachable login URLs before building for a deployed environment. Vite variables are build-time configuration.

## Signature and quotation numbering

- The supplied signature is bundled at `quotation-management/backend/assets/signatures/authorised-signature.png`.
- `QUOTATION_SIGNATURE_PATH` defaults to that path and can be overridden in the Quotation Management backend `.env`.
- The signature is inserted into generated PDF and DOCX quotations. The generated quotation retains the NexziByte company logo/name; **NexLekha is only the Quotation Management application UI brand**.
- Quotation numbering already uses a PostgreSQL transaction-backed daily sequence, formatted as `QT/NBS/YYYYMMDD/0001` by default, with a unique database constraint on `quotationNumber`. That mechanism is preserved.
- Sales Management registration, verification, password reset, mail configuration, and database behavior were not changed; only its login-page platform switch and associated styling/configuration were added.

## Deployment note

The two products are linked by browser navigation, not by shared authentication. Users may need to sign in separately to each application. Do not merge the two `.env` files, database schemas, or secrets.
