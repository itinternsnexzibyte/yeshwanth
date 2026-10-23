# Payroll and Quotation Integration Contract

The payroll and quotation applications remain independent business modules. They may be placed behind one gateway and reuse a shared identity provider later, but neither module reads or writes the other's business tables.

## Stable boundaries

- Shared concepts: user identity, role names, organisation identity, audit event envelope and UI shell.
- Quotation-owned data: customers, contacts, products, price versions, quotation sequences, quotations, snapshots and generated documents.
- Payroll-owned data: employees, salary data, payroll runs, payslips and payroll reports.
- A future gateway can mount quotation routes under `/quotation/api` and payroll routes under `/payroll/api`.
- `GET /api/integration/health` provides a machine-readable contract check and requires `x-integration-key`.

## Security rules

- Never share raw passwords between services.
- Use one identity provider or signed service-to-service claims when the products are merged.
- Keep pricing and payroll permissions separate even when a person uses both applications.
- Do not place salary or pricing values in gateway logs.
- Keep audit records append-only and include the originating module.
