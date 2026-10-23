# v4.0 - PDF terms fix, rotating outline colour, SaaS theme and quotation navigation

## PDF (nothing else in the layout changed)
- The last line of "Terms & Conditions" was clipped because the terms box was too short for five lines.
  The box is now taller (38 -> 48 pt) and the Payment / Delivery / Validity rows, signature line and footer move down by 10 pt.
- Outline/accent colour now rotates per quotation: purple -> blue -> red -> green -> orange -> teal -> magenta -> brown.
  The colour is stored on the quotation (`accentColor`), so preview and download always match. Revisions keep the original's colour.
  Older quotations without a stored colour get a stable hash-based colour. The logo image is never recoloured.

## Interface
- New light blue SaaS theme (sidebar groups, top search bar, "New quotation" button, blue metric cards).
- Quotation section: top navigation with "Quotation register" and "New quotation" tabs plus status chips (All / Draft / Issued / Revised / Cancelled) with live counts.
- Top-bar search jumps to the register with the search pre-filled.

## Upgrade steps
1. `cd backend && npx prisma db push` (adds the nullable `accentColor` column - no data loss).
2. Rebuild backend and frontend.
