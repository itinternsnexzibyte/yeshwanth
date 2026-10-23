# v4.1 - Product catalogue with pictures and specifications

Castrol and Tegutec templates are intentionally not part of this build. Nothing built earlier was removed.

## Products (Flipkart / Amazon style)
- Product cards: picture, name, price with list-price strike-through and "% off", highlights, package/UOM/MOQ, "Specifications" button.
- Specification pop-up with description, highlights and a full specification table. Cards/Table toggle and product search.
- Pictures are matched automatically (laptop -> laptop picture, monitor -> monitor, SSD -> SSD ...) and can be changed per product by an administrator.
- Administrators edit highlights ("one per line") and specifications ("Label: Value" per line) in the product form.
- Starter content for the 12 catalogue SKUs is filled in once at startup, only where a product has no content yet. Specs are indicative: verify against approved datasheets.
- 13 pictures live in `backend/assets/products` (used by the PDF) and `frontend/public/assets/products` (used by the website).

## Quotation form
- Selecting a product shows its picture and top highlights under the line item.

## Quotation PDF
- Page 1 keeps the approved layout. Extra "PRODUCT SPECIFICATIONS" pages (picture, description, highlights, specification table, accent colour of the quotation) follow it.
- Product content is snapshotted into each quotation item, so later catalogue edits never change issued quotations.
- The terms box now grows with the amount of terms text, so long terms are never cut off.

## Upgrade
1. `cd backend && npx prisma generate && npx prisma db push` (adds nullable columns only).
2. Rebuild and restart backend and frontend.

## v4.2 fix - terms & conditions fully visible
- Terms & Conditions are now drawn as plain page text instead of a form field, measured before drawing, so all lines (e.g. 8 terms) always show. Payment/Delivery/Validity rows, signature and footer shift down by exactly the extra height.

## v4.3 - remaining items
- **Own product pictures:** administrators can upload a PNG/JPG/WebP from their computer in the product form (auto-resized, validated server-side, stored content-addressed in `storage/product-images`). Shown on cards, the pop-up, the quotation form and the PDF specification pages. "Use built-in picture" reverts. Each quotation snapshots the picture it was issued with.
- **PDF MOQ column** now prints the product's MOQ (snapshotted per quotation item). Older quotations show "-".
- **PDF Landing Price column** = price per unit after discount, before GST (taxable amount / quantity). Assumption: confirm the client's rule in Phase 1.
- **Stored PDFs:** a quotation's generated PDF is saved and served again unchanged on download (layout version 2026.10.3). Editing a quotation, or a layout version bump, rebuilds it from the saved snapshot. Admins can force a rebuild with `?regenerate=true`.
- **Tests:** `npm test` (calculation + product content) and `npm run test:api` (live checks: RBAC, price tampering, 10 concurrent numbers, snapshot integrity, anonymous access).
- **Upgrade:** `npx prisma generate && npx prisma db push` (nullable columns only), rebuild, restart.
