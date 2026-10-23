# Administrator Guide

## Initial configuration

Create the first administrator with `BOOTSTRAP_TOKEN`. Create staff accounts in **Users & roles** and never share administrator credentials.

Every user can open **Profile & security** to upload a profile picture or change their password. A password change requires the current password and signs the user out for a fresh login.

## Master data and pricing

- Replace all eight inactive placeholders with approved client data before activation.
- A changed price creates a new effective-dated version.
- Configure global, template or product-specific limits under **Pricing rules**.
- Product rules override template rules; template rules override global rules.
- Review the generated quotation PDF and confirm all product pricing before issuing.

## Backup and restore

```cmd
npm run db:backup -- backups\quotation.backup
npm run db:restore -- backups\quotation.backup
```

Run backups daily and complete a restore test before production.
