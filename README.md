# Discipline AI Tracker

A mobile-friendly React + Tailwind application for tracking wake-up routines, study time, hydration, calories, and food scans with Firebase-ready persistence plus local fallbacks.

## Features

- Email OTP login through Brevo API (or Resend/Gmail) plus safe demo fallback
- First-time onboarding with generated daily targets
- Home dashboard with cards, streak counter, and weekly chart
- Wake-up logging, study timer, water tracker, calories burned input
- BMI calculator with saved BMI history per user
- Daily task tracker with an 8 PM reminder email for incomplete tasks
- Food recognition flow with Groq vision support, Spoonacular fallback, and manual correction
- AI companion powered by Groq with a safe local fallback
- Progress page with Daily / Weekly / Monthly charts + streak history
- Profile editing, dark mode, notifications toggle, and reset option

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Firebase-ready Auth + Firestore setup
- Recharts for graphs

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Copy environment values if you want Firebase, Groq AI, Spoonacular, or real email OTP enabled:

```bash
cp .env.example .env
```

3. For Brevo OTP, add your Brevo API credentials to `.env`:

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=your-brevo-api-key
BREVO_FROM=OATH <your-verified-sender@yourdomain.com>
BREVO_BASE_URL=https://api.brevo.com/v3
```

4. If you prefer Resend instead, add:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=OATH <your-verified-sender@yourdomain.com>
```

5. For Gmail-based sending during local development, add:

```env
EMAIL_PROVIDER=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=OATH <your_email@gmail.com>
```

6. If you want the hosted app to stay usable without a live email provider, enable demo OTP fallback:

```env
EMAIL_PROVIDER=demo
ALLOW_DEMO_OTP=true
```

7. Task reminder emails run daily at 8 PM by default (time zone is configurable):

```env
ENABLE_TASK_REMINDERS=true
TASK_REMINDER_CRON=0 20 * * *
TASK_REMINDER_TIMEZONE=Asia/Kolkata
APP_URL=http://localhost:5173
```

8. Add your Groq key if you want AI companion and AI food scanning:

```env
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=openai/gpt-oss-20b
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

9. Start the app:

```bash
npm run dev
```

10. Open the local Vite URL shown in the terminal.

## Notes

- `npm run dev` starts both the React client and the OTP email server.
- Email provider selection:
  - Set `EMAIL_PROVIDER=brevo` to force Brevo.
  - Set `EMAIL_PROVIDER=resend` to force Resend.
  - Set `EMAIL_PROVIDER=gmail` to force Gmail.
  - If not set, the server prefers Brevo, then Resend, then Gmail.
- The app works without Firebase and without Spoonacular.
- If Groq is not configured or unavailable, AI companion falls back locally and food scan falls back to Spoonacular/mock/manual entry.
- Set `ALLOW_DEMO_OTP=true` if you want hosted deployments like Render to show a demo OTP on-screen when email is not configured or temporarily fails.
- Leaving `EMAIL_PROVIDER` unset is safest on Render because the server can auto-detect Brevo, Resend, or Gmail from whichever credentials you actually provide.
- Firebase config enables the Firestore sync layer.
- Browser notifications are simulated with the Notification API when permission is granted.

## Data storage

- Tasks + BMI history are stored server-side in `server/data/store.json` by default.
- On cloud hosts, use a persistent disk if you want to keep tasks/BMI between deploys.
