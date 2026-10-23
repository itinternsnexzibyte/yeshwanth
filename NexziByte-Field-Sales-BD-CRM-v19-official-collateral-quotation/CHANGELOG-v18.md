# Version 18 — brochure, email correction and quotation sign-off

## Visit follow-up

- Sends the NexziByte company brochure after every completed visit outcome: YES, NO, MAYBE or COLLABORATION.
- Attaches the brochure and provides a browser link in the client email.
- Performs immediate email syntax and mail-domain validation before checkout.
- Records delivery failures against the visit and alerts the responsible salesperson.
- Allows the salesperson or a manager to correct the company/contact email after checkout.
- Automatically resends the brochure after a valid correction.
- Attaches the supplied sales brochure, company profile and visiting card to every post-visit client email.

## Quotation

- Adds an Acceptance & Sign-off section for NexziByte and the client.
- Supports an approved authorized-signatory image and company-stamp image through environment variables.
- Includes safe signature-line fallbacks until approved assets are configured.
- Adds a Regenerate PDF action for historical quotation records whose generated file was not copied during an upgrade.
- Generates a structured commercial quotation and uses the authorized signature extracted from the supplied management quotation.

## Operations

- Email delivery queue is processed every minute.
- Delivery failure handling is linked to the originating visit.
- The approved brochure, signature and stamp can be configured without modifying source code.

## Important delivery limitation

Syntax mistakes and invalid email domains are rejected immediately. A valid domain with a nonexistent mailbox can only be confirmed after the SMTP/email provider reports a bounce. Configure the email delivery webhook so such bounces produce the in-app correction alert promptly.
