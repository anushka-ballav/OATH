# Email OTP Server

This Express server sends one-time passwords through SMTP and is started automatically with `npm run dev`.

## Required `.env` values

- `SMTP_USER=apratimnandy99@gmail.com`
- `SMTP_PASS=your-gmail-app-password`
- `SMTP_FROM=apratimnandy99@gmail.com`

Optional:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `OTP_SERVER_PORT=8787`
