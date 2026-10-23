# Deployment and Handover Guide

## Production prerequisites

- Approved domain and TLS certificate
- PostgreSQL credentials and independent random application secrets
- Client-approved templates, products, prices, formulas and numbering examples
- Persistent storage for generated documents and backups

## Docker deployment

1. Copy `backend/.env.example` to `backend/.env` and replace placeholders.
2. Change the PostgreSQL password in `docker-compose.yml` and matching connection URL.
3. Run `docker compose build` and `docker compose up -d`.
4. Apply reviewed migrations with `docker compose exec backend npx prisma migrate deploy`.
5. Run `docker compose exec backend npm run db:seed`.
6. Open `http://localhost:8080` and complete the first-admin setup.

## Release checks

- Health endpoint is healthy and calculation tests pass.
- Crafted requests cannot override restricted prices.
- Concurrent saves produce unique numbers.
- PDFs match approved client originals.
- Backup restoration succeeds in a test database.
- UAT, smoke test, monitoring and rollback owners are documented.
