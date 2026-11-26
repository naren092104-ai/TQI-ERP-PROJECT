# SMTP Setup

Gmail SMTP authentication was verified successfully and a test message was accepted for delivery to the authorized mailbox.

## Server variables
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER`: Gmail account
- `SMTP_PASS`: Gmail app password, server-side only
- `SMTP_FROM`: approved sender address
- `SMTP_TEST_RECIPIENT`: authorized test recipient

## Verification commands
```powershell
cd e:\TQI_ERP-main
npm --prefix backend run mail:verify
```

The test recipient is set only for explicit delivery tests. Remove or unset it after verification if the script will run routinely.

Rotate the exposed Gmail app password immediately before production. App passwords must never be placed in `VITE_*`, frontend files, public repository files, or browser-visible configuration.
