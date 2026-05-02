# OATH - Smart Discipline and Fitness Tracking System

Mobile-first discipline tracker for workouts, study, hydration, wake-up routine, calories, BMI, tasks, and AI guidance.

## Key features

- Email OTP login (Brevo / Resend / Gmail) with demo fallback
- First-time onboarding with generated daily targets
- Daily workout + study + water + wake-up tracking
- AI companion (Groq) + food scan (Groq Vision / Spoonacular fallback)
<<<<<<< HEAD
- Gym Mode with equipment onboarding + weekly split generation
- Admin panel with secure JWT login + user analytics
=======
>>>>>>> 7ade9159b0a7e870779814dd17c8f0b01cc4cc1d
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

<<<<<<< HEAD
Groq is also used by Gym Mode plan generation when available. If not configured, the app falls back to rule-based gym plan logic.

### Custom food model (optional)

If you have your own trained food-recognition model, configure:

```env
FOOD_MODEL_PYTHON_BIN=python
CUSTOM_FOOD_MODEL_URL=
CUSTOM_FOOD_MODEL_API_KEY=
CUSTOM_FOOD_MODEL_AUTH_HEADER=Authorization
```

When `Custom Model` is selected in Food Scan:
- The server first tries local inference using `food_dataset/predict.py`, `food_dataset/food_model.h5`, `food_dataset/classes.json`, and `food_dataset/nutrition.csv`.
- If local inference fails and `CUSTOM_FOOD_MODEL_URL` is set, it falls back to that remote endpoint.

The app user can choose `Groq Model` or `Custom Model` from the Food Scan page.

### Python dependencies for custom model

Install once for local development:

```bash
pip install -r food_dataset/requirements.txt
```

### Admin credentials (required for Admin Panel)

```env
ADMIN_ID=admin
ADMIN_PASSWORD=change-this-password
ADMIN_JWT_SECRET=change-this-jwt-secret
```

=======
>>>>>>> 7ade9159b0a7e870779814dd17c8f0b01cc4cc1d
### Reminder scheduling

```env
ENABLE_TASK_REMINDERS=true
TASK_REMINDER_CRON=0 20 * * *
TASK_REMINDER_TIMEZONE=Asia/Kolkata
APP_URL=http://localhost:5173
OTP_SERVER_PORT=8787
```

<<<<<<< HEAD
### Background push notifications (for reminders when app is closed)

```env
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:support@oath.app
```

Generate VAPID keys once:

```bash
npx web-push generate-vapid-keys
```

## Scripts

- `npm run dev` - run client + server together
- `npm run dev:client` - run Vite client
- `npm run dev:server` - run Express server with watch mode
- `npm run build` - production build
- `npm run start` - run server in production mode

## Docker deployment (Custom Model ready)

This repo now includes a production `Dockerfile` that packages:
- Vite build output (`dist`)
- Express server
- Python 3 + TensorFlow CPU runtime
- `food_dataset` model files (`food_model.h5`, `classes.json`, `nutrition.csv`, `predict.py`)

### Build locally

```bash
docker build -t oath-app .
```

### Run locally

```bash
docker run --rm -p 10000:10000 --env-file .env oath-app
```

Open `http://localhost:10000`.

## Render deploy (Docker)

`render.yaml` is configured for Docker runtime and points to `./Dockerfile`.

1. Push this repo to GitHub.
2. In Render, create service from `render.yaml` (Blueprint) or connect repo manually.
3. Set all required environment variables (Firebase, email provider, Groq, admin credentials).
4. Set `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY`.
5. Keep `FOOD_MODEL_PYTHON_BIN=python3`.
6. Deploy.

After deploy, selecting `Custom Model` in Food Scan uses your trained model inside the container.

## Mobile reliability improvements included

- Login persistence fallback now stores session in cookie + local storage.
- App requests persistent storage where the browser supports it.
- Profile includes a direct `Install app` PWA action.
- Notification enable flow also registers background web push for this device.

## Real-time sync notes

- Sync works when Firebase env vars are configured and user is signed in.
- Home shell shows sync status badge:
  - `Live Sync Connected`
  - `Live Sync Connecting`
- If Firestore Data tab is empty, verify:
  - You are on **Firestore** (not Realtime Database)
  - Project ID in `.env` matches Firebase console project
  - You performed at least one app action after login

Gym mode data synced in profile:

- `gymModeEnabled`
- `gymEquipment`
- `gymOtherEquipment`
- `gymPlan`
- `gymBaseWorkoutPlan`

## New APIs

### Gym Mode

- `POST /api/gym/generate-plan`
  - Body: `userId`, `identifier`, `equipment[]`, `otherEquipment`
  - Returns generated weekly split + today workout projection
- `GET /api/gym/plan?userId=...&identifier=...`
  - Returns current gym plan + today workout projection
- `POST /api/gym/progress`
  - Body: `userId`, `identifier`, `day`, `completed`
  - Marks/unmarks a day and updates gym streak

### Admin Panel

- `POST /api/admin/login`
  - Body: `adminId`, `password`
  - Returns JWT token
- `GET /api/admin/users` (Bearer token required)
  - Returns user list + summary metrics
- `GET /api/admin/user/:userId` (Bearer token required)
  - Returns detailed profile/log/task/BMI/gym data for one user
- `DELETE /api/admin/user/:userId` (Bearer token required)
  - Deletes a user and associated data

## Data storage behavior

- Local fallback/cache: browser local storage
- Firestore: cross-device real-time state and logs
- Server JSON store: `server/data/store.json` (tasks/BMI APIs and fallback persistence)

=======
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

>>>>>>> 7ade9159b0a7e870779814dd17c8f0b01cc4cc1d
For cloud deployment, attach persistent disk for `server/data/store.json` if you rely on server-side JSON persistence.
