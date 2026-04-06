# Discipline AI Tracker

A mobile-friendly React + Tailwind application for tracking wake-up routines, study time, hydration, calories, and food scans with Firebase-ready persistence plus local fallbacks.

## Features

- Email OTP login through Gmail SMTP (or Resend) plus safe demo fallback
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

3. For Gmail OTP (recommended locally), add Gmail App Password values to `.env`:

```env
EMAIL_PROVIDER=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=OKRA <your_email@gmail.com>
```

4. For hosted deployments (Render commonly blocks SMTP), prefer Resend email API:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=OKRA <your-verified-sender@yourdomain.com>
```

5. Task reminder emails run daily at 8 PM by default (time zone is configurable):

```env
ENABLE_TASK_REMINDERS=true
TASK_REMINDER_CRON=0 20 * * *
TASK_REMINDER_TIMEZONE=Asia/Kolkata
APP_URL=http://localhost:5173
```

6. Add your Groq key if you want AI companion and AI food scanning:

```env
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=openai/gpt-oss-20b
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

7. Start the app:

```bash
npm run dev
```

8. Open the local Vite URL shown in the terminal.

## Notes

- `npm run dev` starts both the React client and the OTP email server.
- Email provider selection:
  - Set `EMAIL_PROVIDER=gmail` to force Gmail SMTP.
  - Set `EMAIL_PROVIDER=resend` to force Resend.
  - If not set, the server prefers Resend, then Gmail, then generic SMTP.
- The app works without Firebase and without Spoonacular.
- If Groq is not configured or unavailable, AI companion falls back locally and food scan falls back to Spoonacular/mock/manual entry.
- If SMTP is missing or unavailable, the app falls back to demo OTP `123456`.
- Firebase config enables the Firestore sync layer.
- Browser notifications are simulated with the Notification API when permission is granted.

## Data storage

- Tasks + BMI history are stored server-side in `server/data/store.json` by default.
- On cloud hosts, use a persistent disk if you want to keep tasks/BMI between deploys.
"# OATH" 
