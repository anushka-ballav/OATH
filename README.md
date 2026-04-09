# Discipline AI Tracker (OATH)

Mobile-first discipline tracker for workouts, study, hydration, wake-up routine, calories, BMI, tasks, and AI guidance.

## Key features

- Email OTP login (Brevo / Resend / Gmail) with demo fallback
- First-time onboarding with generated daily targets
- Daily workout + study + water + wake-up tracking
- AI companion (Groq) + food scan (Groq Vision / Spoonacular fallback)
- Progress analytics (daily / weekly / monthly) with streak insights
- BMI history + task system + reminder notifications
- Firestore real-time sync across devices (same account)
- In-app connection indicator: `Live Sync Connected`

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- Firebase Firestore
- Express OTP/reminder server
- Recharts

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Start app + server:

```bash
npm run dev
```

4. Open the Vite URL shown in terminal (usually `http://localhost:5173`).

## Required environment setup

### Firebase (for cross-device real-time sync)

Set these in `.env`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Then in Firebase Console:

1. Create/select project
2. Enable **Cloud Firestore**
3. Register web app and copy config values
4. Ensure app points to the same `VITE_FIREBASE_PROJECT_ID`

Firestore collections used by this app:

- `users`
- `dailyLogs`
- `userSnapshots`
- `leaderboard`

### Email OTP provider (choose one)

**Brevo**

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=
BREVO_FROM=OATH <verified@domain.com>
BREVO_BASE_URL=https://api.brevo.com/v3
```

**Resend**

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=
RESEND_FROM=OATH <verified@domain.com>
```

**Gmail**

```env
EMAIL_PROVIDER=gmail
EMAIL_USER=you@gmail.com
EMAIL_PASS=app_password
EMAIL_FROM=OATH <you@gmail.com>
```

**Demo fallback**

```env
ALLOW_DEMO_OTP=true
```

### Groq (optional but recommended)

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

### Reminder scheduling

```env
ENABLE_TASK_REMINDERS=true
TASK_REMINDER_CRON=0 20 * * *
TASK_REMINDER_TIMEZONE=Asia/Kolkata
APP_URL=http://localhost:5173
OTP_SERVER_PORT=8787
```

## Scripts

- `npm run dev` - run client + server together
- `npm run dev:client` - run Vite client
- `npm run dev:server` - run Express server with watch mode
- `npm run build` - production build
- `npm run start` - run server in production mode

## Real-time sync notes

- Sync works when Firebase env vars are configured and user is signed in.
- Home shell shows sync status badge:
  - `Live Sync Connected`
  - `Live Sync Connecting`
- If Firestore Data tab is empty, verify:
  - You are on **Firestore** (not Realtime Database)
  - Project ID in `.env` matches Firebase console project
  - You performed at least one app action after login

## Data storage behavior

- Local fallback/cache: browser local storage
- Firestore: cross-device real-time state and logs
- Server JSON store: `server/data/store.json` (tasks/BMI APIs and fallback persistence)

For cloud deployment, attach persistent disk for `server/data/store.json` if you rely on server-side JSON persistence.
