# Combined project fixes and Windows startup

## Correct local ports

- Sales frontend: http://localhost:5173
- Sales backend: http://localhost:4000
- NexLekha frontend: http://localhost:5174
- NexLekha backend: http://localhost:4001

The quotation backend config defaults and example environment are corrected to port 4001, the quotation frontend API fallback is corrected to port 4001, and the quotation frontend `.env.example` has real line breaks. The Sales frontend `ChevronRight` icon import is present.

## Configure environment files

Do not share or combine the two apps' `.env` files. In each backend folder, run `copy .env.example .env` if `.env` does not exist, then edit `.env` and replace placeholders with real credentials and long random secrets. Preserve existing working database URLs and mail credentials.

In `quotation-management/backend/.env`, verify these settings:

```env
PORT=4001
FRONTEND_URL="http://localhost:5174"
```

In `quotation-management/frontend/.env`, verify:

```env
VITE_API_URL="http://localhost:4001/api"
VITE_SALES_APP_URL="http://localhost:5173"
```

In the Sales frontend `.env`, verify:

```env
VITE_QUOTATION_APP_URL="http://localhost:5174"
```

Vite environment changes require restarting that frontend dev server. Backend changes require restarting the backend.

## Start each app in its own terminal

Run the backend and frontend commands in separate Command Prompt windows, following each app's README. Keep all four processes running while testing. Do not use the same port for both backend servers.

The archive intentionally does not contain populated `.env` files because database passwords, mail credentials, and API secrets are private and machine-specific. The sample values are placeholders, not production credentials.
