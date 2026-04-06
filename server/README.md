# Email OTP Server

This Express server handles OTP login, reminder emails, and the API routes used by the app.

## Supported email providers

- `EMAIL_PROVIDER=brevo` with `BREVO_API_KEY`, `BREVO_FROM`, and optional `BREVO_BASE_URL`
- `EMAIL_PROVIDER=resend` with `RESEND_API_KEY` and `RESEND_FROM`
- `EMAIL_PROVIDER=gmail` with `EMAIL_USER`, `EMAIL_PASS`, and optional `EMAIL_FROM`

If `EMAIL_PROVIDER` is left empty, the server auto-detects Brevo first, then Resend, then Gmail from the credentials you provide.

## Demo fallback

- `ALLOW_DEMO_OTP=true` lets the hosted app return a visible demo OTP when no live provider is configured or delivery fails
- In local development, demo OTP fallback stays available by default

## Other useful env values

- `OTP_SERVER_PORT=8787`
- `APP_URL=http://localhost:5173`
- `TASK_REMINDER_CRON=0 20 * * *`
- `TASK_REMINDER_TIMEZONE=Asia/Kolkata`
