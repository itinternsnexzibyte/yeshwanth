# Quotation Specification Coverage

## Implemented modules

- Secure login/logout, one-time bootstrap administrator, account lockout, HttpOnly session cookie, CSRF, rate limiting and Argon2id passwords.
- Roles: Administrator, Quotation User and Viewer, with API-side permission checks.
- Admin user creation, role/status maintenance and no public self-registration.
- Customer master, contacts, GSTIN, payment defaults and delivery defaults.
- Product master with eight controlled placeholders, activation state, MOQ, package, UOM and GST.
- Versioned price records with list price, unit price, discount and effective dates.
- Standard NexziByte quotation template with version control.
- Quotation creation with customer/contact/template selection, editable dates, subject, reference, inquiry, freight, payment/delivery terms and document wording.
- Server-authoritative Decimal calculations, CGST/SGST or IGST, freight and role-restricted price/discount overrides.
- Transaction-safe daily numbering, immutable line-item snapshots, revisions and status control.
- Search/filter by number, customer, subject, date, status and product.
- Template-faithful editable AcroForm PDF and editable DOCX output, customer/product/status reports and append-only audit history.
- Separate quotation data model with an integration health boundary for later payroll composition.

## Client inputs still required before production sign-off

The supplied specification explicitly marks these as pending. They cannot be safely invented by development:

1. Actual names/descriptions/package/UOM/MOQ for all eight products.
2. Approved list/unit prices, discounts, GST, freight rules and effective dates.
3. Any additional approved quotation template variations requested by the business.
4. Completed sample quotations for calculation and visual comparison.
5. Exact customer-facing numbering rule and reset/revision behaviour.
6. Final role matrix, approval process, report acceptance criteria and hosting/backup owner.

The eight placeholder products remain inactive so an unapproved zero price can never be used in an issued quotation.

## Production-completion additions in v2.6

- Configurable global, template and product pricing rules with discount caps, GST override and fixed freight.
- Final-format PDF preview endpoint, CSV register export and filtered audit history.
- Automated Decimal calculation tests and PostgreSQL backup/restore commands.
- Complete backend/frontend Docker definitions and reverse-proxy configuration.
- OpenAPI reference plus user, administrator and deployment/handover guides.

Product prices in the starter catalogue are sample values and should be reviewed and approved before issuing quotations.
