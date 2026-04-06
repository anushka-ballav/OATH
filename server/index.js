import cors from 'cors';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');
const distPath = path.resolve(__dirname, '..', 'dist');
const distIndexPath = path.join(distPath, 'index.html');

dotenv.config({ path: envPath });

const app = express();
const port = Number(process.env.PORT || process.env.OTP_SERVER_PORT || 8787);
const otpStore = new Map();
const refreshEnv = () => dotenv.config({ path: envPath, override: true });
const isGroqConfigured = () => Boolean(process.env.GROQ_API_KEY);
const isResendConfigured = () => Boolean(process.env.RESEND_API_KEY);
const isGmailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const isSmtpConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
// Prefer Resend in production because many hosts block outbound SMTP ports. Allow override via EMAIL_PROVIDER.
const getEmailProvider = () => {
  const forced = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();

  if (forced) {
    if (forced === 'resend') return isResendConfigured() ? 'resend' : 'none';
    if (forced === 'gmail') return isGmailConfigured() ? 'gmail' : 'none';
    if (forced === 'smtp') return isSmtpConfigured() ? 'smtp' : 'none';
    if (forced === 'none' || forced === 'demo') return 'none';
  }

  if (isResendConfigured()) return 'resend';
  if (isGmailConfigured()) return 'gmail';
  if (isSmtpConfigured()) return 'smtp';
  return 'none';
};
const getEmailSender = () =>
  process.env.RESEND_FROM ||
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM ||
  process.env.EMAIL_USER ||
  process.env.SMTP_USER ||
  'OATH <onboarding@resend.dev>';
const getGroqModel = (kind = 'general') =>
  process.env[kind === 'vision' ? 'GROQ_VISION_MODEL' : 'GROQ_MODEL'] ||
  process.env.GROQ_MODEL ||
  (kind === 'vision' ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile');

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '12mb' }));

const createTransporter = (provider = getEmailProvider()) => {
  if (provider === 'gmail' && isGmailConfigured()) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  if (provider === 'smtp' && isSmtpConfigured()) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return null;
};

const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const DEFAULT_STORE = {
  users: {},
  profiles: {},
  tasks: {},
  dailyLogs: {},
  bmi: {},
  reminders: {},
  friendships: {},
  leaderboardInvites: {},
};

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeStore = (store) => ({
  ...DEFAULT_STORE,
  ...(store && typeof store === 'object' ? store : {}),
  users: store?.users && typeof store.users === 'object' ? store.users : {},
  profiles: store?.profiles && typeof store.profiles === 'object' ? store.profiles : {},
  tasks: store?.tasks && typeof store.tasks === 'object' ? store.tasks : {},
  dailyLogs: store?.dailyLogs && typeof store.dailyLogs === 'object' ? store.dailyLogs : {},
  bmi: store?.bmi && typeof store.bmi === 'object' ? store.bmi : {},
  reminders: store?.reminders && typeof store.reminders === 'object' ? store.reminders : {},
  friendships: store?.friendships && typeof store.friendships === 'object' ? store.friendships : {},
  leaderboardInvites:
    store?.leaderboardInvites && typeof store.leaderboardInvites === 'object'
      ? store.leaderboardInvites
      : {},
});

const readStore = async () => {
  ensureDataDir();

  if (!fs.existsSync(STORE_PATH)) {
    return normalizeStore(DEFAULT_STORE);
  }

  const raw = await fs.promises.readFile(STORE_PATH, 'utf8').catch(() => '');
  const parsed = safeJsonParse(raw);
  return normalizeStore(parsed);
};

const writeStore = async (store) => {
  ensureDataDir();
  const payload = JSON.stringify(store, null, 2);
  const tmp = `${STORE_PATH}.tmp`;
  await fs.promises.writeFile(tmp, payload, 'utf8');

  try {
    await fs.promises.rename(tmp, STORE_PATH);
  } catch {
    await fs.promises.rm(STORE_PATH, { force: true });
    await fs.promises.rename(tmp, STORE_PATH);
  }
};

let storeQueue = Promise.resolve();
const updateStore = async (updater) => {
  const run = async () => {
    const store = await readStore();
    const result = await updater(store);
    await writeStore(store);
    return result;
  };

  const next = storeQueue.then(run, run);
  storeQueue = next.catch((error) => {
    console.error('Store update failed', error);
  });
  return next;
};

const getReminderTimeZone = () => process.env.TASK_REMINDER_TIMEZONE || 'Asia/Kolkata';
const toDateKey = (date = new Date(), timeZone = getReminderTimeZone()) =>
  date.toLocaleDateString('en-CA', { timeZone });

const buildOtpEmailText = (code) => `OATH login code: ${code}. It expires in 10 minutes.`;

const buildOtpEmailHtml = (code) => `
  <div style="margin:0; padding:32px 16px; background:#050505;
    background-image:
    radial-gradient(circle at top left, rgba(249,115,22,0.18), transparent 24%),
    radial-gradient(circle at top right, rgba(59,130,246,0.14), transparent 18%),
    linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #120c06 100%);
    font-family:'Segoe UI', Arial, sans-serif; color:#f5f5f5;">

    <div style="max-width:620px; margin:0 auto;">

      <!-- Logo -->
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:22px;">
        <div style="height:48px; width:48px; border-radius:16px;
          display:flex; align-items:center; justify-content:center;
          font-size:20px; font-weight:700; color:#fff;
          background:linear-gradient(135deg, #f97316, #fbbf24, #3b82f6);
          box-shadow:0 10px 25px rgba(249,115,22,0.35);">
          O
        </div>
        <div>
          <div style="font-size:26px; font-weight:700; letter-spacing:0.28em;">OATH</div>
          <div style="font-size:10px; letter-spacing:0.2em; color:rgba(255,237,213,0.7);">
            Discipline AI Tracker
          </div>
        </div>
      </div>

      <!-- Glass Card -->
      <div style="
        border-radius:28px;
        padding:26px;
        background:rgba(255,255,255,0.05);
        backdrop-filter:blur(14px);
        -webkit-backdrop-filter:blur(14px);
        border:1px solid rgba(255,255,255,0.12);
        box-shadow:0 20px 50px rgba(0,0,0,0.5);
      ">

        <div style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase;
          color:rgba(255,237,213,0.7);">
          Secure Login
        </div>

        <h2 style="margin:12px 0 8px; font-size:34px; font-weight:700;">
          Your OTP is ready
        </h2>

        <p style="margin:0; font-size:15px; line-height:1.6; color:#d4d4d8;">
          Use the verification code below to sign in and continue your discipline streak.
        </p>

        <!-- Glass OTP Box -->
        <div style="
          margin:20px 0 16px;
          border-radius:18px;
          padding:14px 18px;
          background:rgba(255,255,255,0.06);
          backdrop-filter:blur(10px);
          -webkit-backdrop-filter:blur(10px);
          border:1px solid rgba(255,255,255,0.15);
          text-align:center;
        ">
          <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase;
            color:rgba(255,237,213,0.75);">
            One-Time Password
          </div>

          <div style="margin-top:10px; font-size:28px; font-weight:800;
            letter-spacing:0.3em; color:#ffffff;">
            ${code}
          </div>
        </div>

        <!-- Info Pills -->
        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:14px;">
          <div style="border-radius:999px; padding:8px 12px;
            background:rgba(249,115,22,0.15);
            font-size:12px; color:#fed7aa;">
            Expires in 10 minutes
          </div>

          <div style="border-radius:999px; padding:8px 12px;
            background:rgba(59,130,246,0.15);
            font-size:12px; color:#bfdbfe;">
            Ignore if not you
          </div>
        </div>

      </div>

      <!-- Footer -->
      <p style="margin:14px 6px 0; font-size:11px; color:rgba(255,255,255,0.5);">
        This code is for your OATH account. Never share it with anyone.
      </p>

    </div>
  </div>
`;

const sendOtpWithSmtp = async ({ identifier, code, transporter }) =>
  transporter.sendMail({
    from: getEmailSender(),
    to: identifier,
    subject: 'Your OATH OTP Code',
    text: buildOtpEmailText(code),
    html: buildOtpEmailHtml(code),
  });

const sendOtpWithResend = async ({ identifier, code }) => {
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: getEmailSender(),
      to: [identifier],
      subject: 'Your OATH OTP Code',
      text: buildOtpEmailText(code),
      html: buildOtpEmailHtml(code),
    }),
  });

  const payload = await resendResponse.json().catch(() => null);

  if (!resendResponse.ok) {
    const detail =
      payload?.message ||
      payload?.error?.message ||
      payload?.name ||
      `Resend email request failed with status ${resendResponse.status}.`;
    const error = new Error(detail);
    error.code = 'RESEND_API_ERROR';
    throw error;
  }

  return payload;
};

const round1 = (value) => Math.round(value * 10) / 10;

const formatStudy = (hours) => {
  const safe = Math.max(0, Number(hours) || 0);
  return `${round1(safe)}h`;
};

const formatWater = (liters) => {
  const safe = Math.max(0, Number(liters) || 0);
  return `${round1(safe)}L`;
};

const buildGoalStatus = ({ profileTargets, dailyLog }) => {
  if (!profileTargets || !dailyLog) return null;

  const waterTarget = Math.max(0, Number(profileTargets.waterLiters) || 0);
  const waterConsumed = Math.max(0, Number(dailyLog.waterIntakeMl || 0) / 1000);
  const waterRemaining = Math.max(0, waterTarget - waterConsumed);

  const studyTarget = Math.max(0, Number(profileTargets.studyHours) || 0);
  const studyDone = Math.max(0, Number(dailyLog.studyMinutes || 0) / 60);
  const studyRemaining = Math.max(0, studyTarget - studyDone);

  const checklist = Array.isArray(profileTargets?.workoutPlan?.dailyChecklist) ? profileTargets.workoutPlan.dailyChecklist : [];
  const completed = Array.isArray(dailyLog.completedWorkoutTasks) ? dailyLog.completedWorkoutTasks : [];
  const completedSet = new Set(completed);
  const remainingWorkout = checklist.filter((task) => task?.id && !completedSet.has(task.id));

  const workoutTotal = checklist.length;
  const workoutDone = workoutTotal ? workoutTotal - remainingWorkout.length : completed.length;
  const workoutRemainingCount = workoutTotal ? remainingWorkout.length : 0;

  const hasMissing =
    (waterTarget > 0 && waterRemaining > 0.05) ||
    (studyTarget > 0 && studyRemaining > 0.05) ||
    (workoutTotal > 0 && workoutRemainingCount > 0);

  return {
    water: {
      targetLiters: round1(waterTarget),
      consumedLiters: round1(waterConsumed),
      remainingLiters: round1(waterRemaining),
    },
    study: {
      targetHours: round1(studyTarget),
      doneHours: round1(studyDone),
      remainingHours: round1(studyRemaining),
    },
    workout: {
      totalTasks: workoutTotal,
      doneTasks: workoutDone,
      remainingTasks: workoutRemainingCount,
      remainingLabels: remainingWorkout.map((task) => task.label).slice(0, 8),
    },
    hasMissing,
  };
};

const buildReminderEmailText = ({ name, tasks, goalStatus }) => {
  const safeName = name ? String(name).trim() : 'there';
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const list = safeTasks.map((task) => `- ${task.title}`).join('\n');
  const goalLines = goalStatus
    ? [
        '',
        "Today's goals not finished:",
        `- Water: ${formatWater(goalStatus.water.consumedLiters)} / ${formatWater(goalStatus.water.targetLiters)} (left ${formatWater(goalStatus.water.remainingLiters)})`,
        `- Study: ${formatStudy(goalStatus.study.doneHours)} / ${formatStudy(goalStatus.study.targetHours)} (left ${formatStudy(goalStatus.study.remainingHours)})`,
        goalStatus.workout.totalTasks
          ? `- Workout: ${goalStatus.workout.doneTasks}/${goalStatus.workout.totalTasks} tasks (left ${goalStatus.workout.remainingTasks})`
          : `- Workout: ${goalStatus.workout.remainingTasks} tasks left`,
        goalStatus.workout.remainingLabels?.length
          ? `  Remaining: ${goalStatus.workout.remainingLabels.join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  const motivation = [
    'Finish one small task now to keep the chain alive.',
    'Momentum beats motivation. Close one loop tonight.',
    'Small wins compound fast. One task done is progress.',
  ][Math.floor(Math.random() * 3)];

  const taskIntro = safeTasks.length
    ? `You still have ${safeTasks.length} incomplete task${safeTasks.length === 1 ? '' : 's'}:\n${list}`
    : `You have no custom tasks pending, but your daily goals still need attention.`;

  return `Hi ${safeName},\n\n${taskIntro}\n${goalLines}\n\n${motivation}\n\nOATH`;
};

const buildReminderEmailHtml = ({ name, tasks, appUrl, goalStatus }) => {
  const safeName = name ? String(name).trim() : 'there';
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeAppUrl = String(appUrl || '').trim() || 'https://example.com';

  const items = safeTasks
    .slice(0, 12)
    .map(
      (task) => `
      <li style="margin:10px 0; padding:12px 14px; border-radius:16px; background:rgba(255,255,255,0.06);
        border:1px solid rgba(255,255,255,0.12);">
        <div style="font-size:14px; color:#ffffff; font-weight:600;">${String(task.title || '').replace(/</g, '&lt;')}</div>
        <div style="margin-top:6px; font-size:12px; color:rgba(255,237,213,0.7); letter-spacing:0.12em; text-transform:uppercase;">
          Due ${task.dueDate || 'today'}
        </div>
      </li>
    `,
    )
    .join('');

  const goalsHtml = goalStatus
    ? `
        <div style="margin-top:22px;">
          <div style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,237,213,0.7);">
            Remaining Goals
          </div>
          <div style="margin-top:12px; display:grid; grid-template-columns:1fr; gap:10px;">
            <div style="border-radius:18px; padding:14px 16px; background:rgba(59,130,246,0.14); border:1px solid rgba(255,255,255,0.10);">
              <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(191,219,254,0.9);">Water</div>
              <div style="margin-top:8px; font-size:16px; font-weight:700; color:#ffffff;">
                Left ${formatWater(goalStatus.water.remainingLiters)} ( ${formatWater(goalStatus.water.consumedLiters)} / ${formatWater(goalStatus.water.targetLiters)} )
              </div>
            </div>
            <div style="border-radius:18px; padding:14px 16px; background:rgba(249,115,22,0.14); border:1px solid rgba(255,255,255,0.10);">
              <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(254,215,170,0.9);">Study</div>
              <div style="margin-top:8px; font-size:16px; font-weight:700; color:#ffffff;">
                Left ${formatStudy(goalStatus.study.remainingHours)} ( ${formatStudy(goalStatus.study.doneHours)} / ${formatStudy(goalStatus.study.targetHours)} )
              </div>
            </div>
            <div style="border-radius:18px; padding:14px 16px; background:rgba(168,85,247,0.14); border:1px solid rgba(255,255,255,0.10);">
              <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(233,213,255,0.9);">Workout</div>
              <div style="margin-top:8px; font-size:16px; font-weight:700; color:#ffffff;">
                ${goalStatus.workout.totalTasks ? `Left ${goalStatus.workout.remainingTasks} task${goalStatus.workout.remainingTasks === 1 ? '' : 's'} ( ${goalStatus.workout.doneTasks}/${goalStatus.workout.totalTasks} )` : `Left ${goalStatus.workout.remainingTasks} tasks`}
              </div>
              ${
                goalStatus.workout.remainingLabels?.length
                  ? `<div style="margin-top:10px; font-size:13px; color:rgba(255,255,255,0.65); line-height:1.5;">
                      ${goalStatus.workout.remainingLabels.map((label) => `• ${String(label || '').replace(/</g, '&lt;')}`).join('<br/>')}
                    </div>`
                  : ''
              }
            </div>
          </div>
        </div>
    `
    : '';

  return `
  <div style="margin:0; padding:32px 16px; background:#050505;
    background-image:
    radial-gradient(circle at top left, rgba(249,115,22,0.18), transparent 24%),
    radial-gradient(circle at top right, rgba(168,85,247,0.16), transparent 22%),
    radial-gradient(circle at bottom right, rgba(59,130,246,0.12), transparent 20%),
    linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #120c06 100%);
    font-family:'Segoe UI', Arial, sans-serif; color:#f5f5f5;">

    <div style="max-width:620px; margin:0 auto;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:22px;">
        <div style="height:48px; width:48px; border-radius:16px;
          display:flex; align-items:center; justify-content:center;
          font-size:20px; font-weight:700; color:#fff;
          background:linear-gradient(135deg, #f97316, #fbbf24, #3b82f6);
          box-shadow:0 10px 25px rgba(249,115,22,0.35);">
          O
        </div>
        <div>
          <div style="font-size:26px; font-weight:700; letter-spacing:0.28em;">OATH</div>
          <div style="font-size:10px; letter-spacing:0.2em; color:rgba(255,237,213,0.7);">
            Discipline AI Tracker
          </div>
        </div>
      </div>

      <div style="
        border-radius:28px;
        padding:26px;
        background:rgba(255,255,255,0.05);
        backdrop-filter:blur(14px);
        -webkit-backdrop-filter:blur(14px);
        border:1px solid rgba(255,255,255,0.12);
        box-shadow:0 20px 50px rgba(0,0,0,0.5);
      ">
        <div style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase;
          color:rgba(255,237,213,0.7);">
          Daily Reminder
        </div>

        <h2 style="margin:12px 0 8px; font-size:32px; font-weight:800;">
          Keep the chain alive, ${safeName}.
        </h2>

        <p style="margin:0; font-size:15px; line-height:1.6; color:#d4d4d8;">
          ${
            safeTasks.length
              ? `You still have ${safeTasks.length} incomplete task${safeTasks.length === 1 ? '' : 's'} waiting for you.`
              : `You have no custom tasks pending, but your daily goals still need attention.`
          }
        </p>

        <ul style="margin:18px 0 0; padding:0; list-style:none;">
          ${items || '<li style=\"margin:10px 0; color:#d4d4d8;\">You are all caught up.</li>'}
        </ul>

        ${goalsHtml}

        <div style="margin-top:20px; text-align:center;">
          <a href="${safeAppUrl}" style="display:inline-block; padding:12px 18px; border-radius:16px;
            background:linear-gradient(135deg, #f97316, #fbbf24, #3b82f6);
            color:#050505; font-weight:800; text-decoration:none; letter-spacing:0.08em;">
            Open OATH
          </a>
        </div>

        <p style="margin:16px 0 0; font-size:12px; line-height:1.6; color:rgba(255,255,255,0.55);">
          Small wins compound. Finish one task now and tomorrow becomes easier.
        </p>
      </div>

      <p style="margin:14px 6px 0; font-size:11px; color:rgba(255,255,255,0.5);">
        You received this reminder because task emails are enabled for your OATH account.
      </p>
    </div>
  </div>
  `;
};

const sendReminderWithTransporter = async ({ identifier, subject, text, html, transporter }) =>
  transporter.sendMail({
    from: getEmailSender(),
    to: identifier,
    subject,
    text,
    html,
  });

const sendReminderWithResend = async ({ identifier, subject, text, html }) => {
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: getEmailSender(),
      to: [identifier],
      subject,
      text,
      html,
    }),
  });

  const payload = await resendResponse.json().catch(() => null);

  if (!resendResponse.ok) {
    const detail =
      payload?.message ||
      payload?.error?.message ||
      payload?.name ||
      `Resend email request failed with status ${resendResponse.status}.`;
    const error = new Error(detail);
    error.code = 'RESEND_API_ERROR';
    throw error;
  }

  return payload;
};

const getEmailErrorDetail = (error, provider) => {
  const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  if (provider === 'resend') {
    return error instanceof Error ? error.message : 'Failed to send OTP email through Resend.';
  }

  if (errorCode === 'EAUTH') {
    return 'SMTP authentication failed. Verify your Gmail App Password, 2-Step Verification, and SMTP sender settings.';
  }

  if (errorCode === 'ETIMEDOUT' || errorCode === 'ESOCKET' || errorCode === 'ECONNECTION') {
    return 'SMTP connection failed. Use a cloud-friendly email API like Resend or verify your SMTP provider allows this host.';
  }

  return 'Failed to send OTP email from the SMTP provider.';
};

const buildOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;

app.get('/api/health', (_request, response) => {
  refreshEnv();
  response.json({
    ok: true,
    resendConfigured: isResendConfigured(),
    gmailConfigured: isGmailConfigured(),
    smtpConfigured: isSmtpConfigured(),
    emailProvider: getEmailProvider(),
    groqConfigured: isGroqConfigured(),
    sender: getEmailProvider() === 'none' ? null : getEmailSender(),
    taskReminderTimezone: getReminderTimeZone(),
  });
});

const buildLocalCompanionReply = ({ message, profile, dailyLog, recentMessages }) => {
  const normalized = String(message || '').toLowerCase();
  const completedTasks = dailyLog?.completedWorkoutTasks?.length || 0;
  const studyHours = Number(((dailyLog?.studyMinutes || 0) / 60).toFixed(1));
  const variants = {
    study: [
      `You are at ${studyHours} study hours today. Start one 45-minute focus block right now, then take a short break and repeat.`,
      `Your study target is ${profile?.dailyTargets?.studyHours || 0} hours. The fastest win is one distraction-free session before checking anything else.`,
    ],
    workout: [
      `You have completed ${completedTasks} workout tasks so far. Finish the next task before looking at the full plan again.`,
      `Today's workout target is ${profile?.dailyTargets?.workoutMinutes || 0} minutes. Start with the easiest checklist item to build momentum.`,
    ],
    calories: [
      `You are at ${dailyLog?.caloriesConsumed || 0} kcal today with a target of ${profile?.dailyTargets?.calories || 0} kcal. Keep the next meal simple and protein-focused.`,
      `Calories gained today: ${dailyLog?.caloriesConsumed || 0}. Calories burned today: ${dailyLog?.caloriesBurned || 0}. Balance the next choice, don't chase perfection.`,
    ],
    water: [
      `Hydration is at ${Number(((dailyLog?.waterIntakeMl || 0) / 1000).toFixed(2))}L. Drink a glass now and another after your next task block.`,
      `Your water target is ${profile?.dailyTargets?.waterLiters || 0}L. Keep the bottle next to you so the habit happens automatically.`,
    ],
    general: [
      `Your next best move is simple: finish one workout task, complete one study block, and log your next meal right away.`,
      `Momentum beats motivation. Pick the smallest unfinished task and finish it before starting something new.`,
      `You already asked ${recentMessages.length} things today. Don't collect more advice until you complete one action.`,
    ],
  };

  const pick = (items) => items[Math.floor(Math.random() * items.length)];

  if (normalized.includes('study')) return pick(variants.study);
  if (normalized.includes('workout') || normalized.includes('exercise') || normalized.includes('gym')) return pick(variants.workout);
  if (normalized.includes('calorie') || normalized.includes('food') || normalized.includes('eat')) return pick(variants.calories);
  if (normalized.includes('water') || normalized.includes('drink')) return pick(variants.water);
  return pick(variants.general);
};

const extractJsonObject = (text) => {
  const trimmed = String(text || '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found.');
  }

  return JSON.parse(trimmed.slice(start, end + 1));
};

const extractGroqResponseText = (data) => {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const outputText = Array.isArray(data?.output)
    ? data.output
        .flatMap((item) => {
          if (typeof item?.text === 'string') return [item.text];
          if (typeof item?.content === 'string') return [item.content];
          if (!Array.isArray(item?.content)) return [];

          return item.content.flatMap((contentItem) => {
            if (typeof contentItem === 'string') return [contentItem];
            if (typeof contentItem?.text === 'string') return [contentItem.text];
            if (typeof contentItem?.content === 'string') return [contentItem.content];
            return [];
          });
        })
        .map((value) => String(value).trim())
        .filter(Boolean)
        .join('\n')
        .trim()
    : '';

  if (outputText) {
    return outputText;
  }

  const choicesText = data?.choices
    ?.flatMap((choice) => {
      const messageContent = choice?.message?.content;
      if (typeof messageContent === 'string') return [messageContent];
      if (Array.isArray(messageContent)) {
        return messageContent
          .map((item) => (typeof item?.text === 'string' ? item.text : ''))
          .filter(Boolean);
      }
      return [];
    })
    .join('\n')
    .trim();

  if (choicesText) {
    return choicesText;
  }

  return '';
};

const sanitizeAssistantText = (text) =>
  String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\r\n/g, '\n')
    .trim();

const extractGroqChatText = (data) => {
  const messageContent = data?.choices?.[0]?.message?.content;

  if (typeof messageContent === 'string') {
    return sanitizeAssistantText(messageContent);
  }

  if (Array.isArray(messageContent)) {
    return sanitizeAssistantText(
      messageContent
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        return '';
      })
      .filter(Boolean)
      .join('\n')
    );
  }

  return '';
};

const buildCompanionRequestBody = (model, messages, maxCompletionTokens = 320) => {
  const base = {
    model,
    messages,
    temperature: 0.7,
    stream: false,
    max_completion_tokens: maxCompletionTokens,
  };

  if (String(model).startsWith('openai/gpt-oss')) {
    return {
      ...base,
      include_reasoning: false,
    };
  }

  return base;
};

const sendOtpHandler = async (request, response) => {
  refreshEnv();
  const identifier = String(request.body?.identifier || '').trim().toLowerCase();
  const emailProvider = getEmailProvider();
  const transporter =
    emailProvider === 'smtp' || emailProvider === 'gmail' ? createTransporter(emailProvider) : null;

  if (!identifier || !identifier.includes('@')) {
    return response.status(400).json({ message: 'A valid email address is required.' });
  }

  if (emailProvider === 'none') {
    return response.status(503).json({ message: 'No email OTP provider is configured.' });
  }

  const code = buildOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  otpStore.set(identifier, {
    code,
    expiresAt,
  });

  try {
    if (emailProvider === 'resend') {
      await sendOtpWithResend({ identifier, code });
    } else if (transporter) {
      await sendOtpWithSmtp({ identifier, code, transporter });
    }

    return response.json({
      sent: true,
      provider: emailProvider,
      message: emailProvider === 'resend' ? 'OTP sent to your email through Resend.' : 'OTP sent to your email.',
    });
  } catch (error) {
    console.error('Failed to send OTP email', error);
    otpStore.delete(identifier);
    const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    const detail = getEmailErrorDetail(error, emailProvider);

    return response.status(500).json({
      message: 'Failed to send OTP email.',
      detail,
      code: errorCode || undefined,
      provider: emailProvider,
    });
  }
};

app.post('/api/auth/send-otp', sendOtpHandler);
app.post('/send-otp', sendOtpHandler);

const verifyOtpHandler = async (request, response) => {
  const identifier = String(request.body?.identifier || '').trim().toLowerCase();
  const code = String(request.body?.code || '').trim();
  const pending = otpStore.get(identifier);

  if (!pending || pending.expiresAt < Date.now() || pending.code !== code) {
    return response.status(401).json({ verified: false });
  }

  otpStore.delete(identifier);
  const userId = `user-${identifier.replace(/[^a-z0-9]/gi, '').slice(0, 18) || 'email'}`;
  const now = new Date().toISOString();

  await updateStore((store) => {
    const previous = store.users[userId] ?? null;
    store.users[userId] = {
      userId,
      email: identifier,
      name: previous?.name || null,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
  });

  return response.json({
    verified: true,
    userId,
  });
};

app.post('/api/auth/verify-otp', verifyOtpHandler);
app.post('/verify-otp', verifyOtpHandler);

const upsertUserInStore = (store, { userId, email, name }) => {
  if (!userId) return;
  const now = new Date().toISOString();
  const previous = store.users[userId] ?? null;

  store.users[userId] = {
    userId,
    email: typeof email === 'string' && email.includes('@') ? email : previous?.email || null,
    name: typeof name === 'string' && name.trim() ? name.trim() : previous?.name || null,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
};

const normalizeDateKey = (value) => {
  const raw = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
};

const normalizeDueDateKey = (dueAt, fallback = '') => {
  if (dueAt) {
    const parsed = new Date(dueAt);
    if (!Number.isNaN(parsed.getTime())) {
      return toDateKey(parsed);
    }
  }

  const safeFallback = normalizeDateKey(fallback);
  return safeFallback || toDateKey();
};

const parseNumber = (value, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(\.\d+)?/);
    if (!match) return fallback;
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeGender = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'female') return 'Female';
  if (normalized === 'male') return 'Male';
  return 'Other';
};

const computeBmi = (heightCm, weightKg) => {
  const heightM = Math.max(0.5, parseNumber(heightCm, 0) / 100);
  const weight = Math.max(0, parseNumber(weightKg, 0));
  const bmi = weight > 0 ? weight / (heightM * heightM) : 0;

  const category =
    bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';

  return {
    bmi: Math.round(bmi * 10) / 10,
    category,
  };
};

const normalizeWorkoutChecklist = (workoutPlan) => {
  if (!workoutPlan || typeof workoutPlan !== 'object') return [];
  const checklist = Array.isArray(workoutPlan.dailyChecklist) ? workoutPlan.dailyChecklist : [];

  return checklist
    .map((task) => ({
      id: typeof task?.id === 'string' ? task.id.slice(0, 64) : '',
      label: typeof task?.label === 'string' ? task.label.slice(0, 120) : '',
    }))
    .filter((task) => task.id && task.label);
};

const normalizeDailyTargets = (dailyTargets) => {
  if (!dailyTargets || typeof dailyTargets !== 'object') return null;

  const wakeUpGoal = typeof dailyTargets.wakeUpGoal === 'string' ? dailyTargets.wakeUpGoal : '06:00';
  const workoutMinutes = Math.max(0, Math.round(parseNumber(dailyTargets.workoutMinutes, 0)));
  const studyHours = Math.max(0, parseNumber(dailyTargets.studyHours, 0));
  const waterLiters = Math.max(0, parseNumber(dailyTargets.waterLiters, 0));
  const calories = Math.max(0, Math.round(parseNumber(dailyTargets.calories, 0)));
  const workoutPlan = dailyTargets.workoutPlan && typeof dailyTargets.workoutPlan === 'object' ? dailyTargets.workoutPlan : {};

  return {
    wakeUpGoal,
    workoutMinutes,
    studyHours,
    waterLiters,
    calories,
    workoutPlan: {
      title: typeof workoutPlan.title === 'string' ? workoutPlan.title.slice(0, 120) : 'Daily workout',
      dailyChecklist: normalizeWorkoutChecklist(workoutPlan),
      estimatedCaloriesBurned: Math.max(0, Math.round(parseNumber(workoutPlan.estimatedCaloriesBurned, 0))),
    },
  };
};

const pruneDailyLogs = (store, userId, maxDays = 45) => {
  const bucket = store.dailyLogs?.[userId];
  if (!bucket || typeof bucket !== 'object') return;

  const keys = Object.keys(bucket).sort();
  const excess = keys.length - maxDays;
  if (excess <= 0) return;

  for (const key of keys.slice(0, excess)) {
    delete bucket[key];
  }
};

const syncProfileHandler = async (request, response) => {
  const userId = String(request.body?.userId || '').trim();
  const identifier = String(request.body?.identifier || '').trim().toLowerCase();
  const name = String(request.body?.name || '').trim();
  const gender = normalizeGender(request.body?.gender);
  const age = Math.max(0, Math.round(parseNumber(request.body?.age, 0)));
  const height = Math.max(0, Math.round(parseNumber(request.body?.height, 0)));
  const weight = Math.max(0, Math.round(parseNumber(request.body?.weight, 0)));
  const goal = String(request.body?.goal || '').trim() || 'Maintain';
  const dailyAvailableHours = Math.max(0, parseNumber(request.body?.dailyAvailableHours, 0));
  const dailyTargets = normalizeDailyTargets(request.body?.dailyTargets);

  if (!userId) return response.status(400).json({ message: 'userId is required.' });
  if (!identifier || !identifier.includes('@')) return response.status(400).json({ message: 'identifier is required.' });
  if (!dailyTargets) return response.status(400).json({ message: 'dailyTargets is required.' });

  const now = new Date().toISOString();

  await updateStore((store) => {
    store.profiles[userId] = {
      userId,
      identifier,
      name: name || store.users?.[userId]?.name || null,
      gender,
      age,
      height,
      weight,
      goal,
      dailyAvailableHours,
      dailyTargets,
      updatedAt: now,
    };

    upsertUserInStore(store, { userId, email: identifier, name });
  });

  return response.json({ ok: true });
};

const syncDailyLogHandler = async (request, response) => {
  const userId = String(request.body?.userId || '').trim();
  const identifier = String(request.body?.identifier || '').trim().toLowerCase();
  const name = String(request.body?.name || '').trim();
  const date = normalizeDateKey(request.body?.date) || toDateKey();
  const log = request.body?.log && typeof request.body.log === 'object' ? request.body.log : null;

  if (!userId) return response.status(400).json({ message: 'userId is required.' });
  if (!identifier || !identifier.includes('@')) return response.status(400).json({ message: 'identifier is required.' });
  if (!log) return response.status(400).json({ message: 'log is required.' });

  const customWorkoutEntries = Array.isArray(log.customWorkoutEntries)
    ? log.customWorkoutEntries
        .map((entry) => ({
          id: typeof entry?.id === 'string' ? entry.id.slice(0, 64) : randomUUID(),
          name:
            typeof entry?.name === 'string' && entry.name.trim()
              ? entry.name.trim().slice(0, 120)
              : 'Custom workout',
          durationMinutes: Math.max(1, Math.round(parseNumber(entry?.durationMinutes, 0))),
          caloriesBurned: Math.max(0, Math.round(parseNumber(entry?.caloriesBurned, 0))),
          createdAt:
            typeof entry?.createdAt === 'string' && entry.createdAt
              ? entry.createdAt
              : new Date().toISOString(),
        }))
        .filter((entry) => entry.caloriesBurned > 0)
    : [];
  const hasBurnBreakdown =
    log.manualCaloriesBurned !== undefined ||
    log.workoutPlanCaloriesBurned !== undefined ||
    customWorkoutEntries.length > 0;
  const manualCaloriesBurned = Math.max(
    0,
    Math.round(
      parseNumber(
        log.manualCaloriesBurned,
        hasBurnBreakdown ? 0 : Math.max(0, Math.round(parseNumber(log.caloriesBurned, 0))),
      ),
    ),
  );
  const workoutPlanCaloriesBurned = Math.max(0, Math.round(parseNumber(log.workoutPlanCaloriesBurned, 0)));
  const totalCustomWorkoutCalories = customWorkoutEntries.reduce(
    (total, entry) => total + entry.caloriesBurned,
    0,
  );
  const entry = {
    date,
    wakeUpTime: typeof log.wakeUpTime === 'string' ? log.wakeUpTime : null,
    studyMinutes: Math.max(0, Math.round(parseNumber(log.studyMinutes, 0))),
    waterIntakeMl: Math.max(0, Math.round(parseNumber(log.waterIntakeMl, 0))),
    caloriesBurned: Math.max(
      0,
      manualCaloriesBurned + workoutPlanCaloriesBurned + totalCustomWorkoutCalories,
    ),
    manualCaloriesBurned,
    workoutPlanCaloriesBurned,
    caloriesConsumed: Math.max(0, Math.round(parseNumber(log.caloriesConsumed, 0))),
    completedWorkoutTasks: Array.isArray(log.completedWorkoutTasks)
      ? log.completedWorkoutTasks.filter((task) => typeof task === 'string').slice(0, 60)
      : [],
    customWorkoutEntries,
    updatedAt: new Date().toISOString(),
  };

  await updateStore((store) => {
    store.dailyLogs[userId] = store.dailyLogs?.[userId] && typeof store.dailyLogs[userId] === 'object' ? store.dailyLogs[userId] : {};
    store.dailyLogs[userId][date] = entry;
    pruneDailyLogs(store, userId);
    upsertUserInStore(store, { userId, email: identifier, name });
  });

  return response.json({ ok: true });
};

app.post('/api/sync/profile', syncProfileHandler);
app.post('/sync/profile', syncProfileHandler);
app.post('/api/sync/daily-log', syncDailyLogHandler);
app.post('/sync/daily-log', syncDailyLogHandler);

const LEADERBOARD_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LEADERBOARD_LEVEL_XP = 120;
const LEADERBOARD_LEAGUES = [
  { min: 900, label: 'Mythic' },
  { min: 700, label: 'Diamond' },
  { min: 500, label: 'Gold' },
  { min: 300, label: 'Silver' },
  { min: 0, label: 'Bronze' },
];

const resolveLeaderboardLeague = (points) =>
  LEADERBOARD_LEAGUES.find((league) => points >= league.min) || LEADERBOARD_LEAGUES[LEADERBOARD_LEAGUES.length - 1];

const shiftDateKey = (dateKey, deltaDays) => {
  const date = new Date(`${String(dateKey || '').trim()}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + deltaDays);
  return toDateKey(date);
};

const getSortedLogKeys = (bucket) =>
  Object.keys(bucket && typeof bucket === 'object' ? bucket : {}).sort((first, second) =>
    first.localeCompare(second),
  );

const getWorkoutTargetCount = (dailyTargets) =>
  Array.isArray(dailyTargets?.workoutPlan?.dailyChecklist) ? dailyTargets.workoutPlan.dailyChecklist.length : 0;

const getQuestSummary = (dailyTargets, log) => {
  const workoutTargetCount = getWorkoutTargetCount(dailyTargets);
  const completedWorkoutCount = Array.isArray(log?.completedWorkoutTasks) ? log.completedWorkoutTasks.length : 0;

  const questCount = 5;
  const questsCompleted = [
    Boolean(log?.wakeUpTime),
    (Number(log?.studyMinutes) || 0) >= Math.max(0, parseNumber(dailyTargets?.studyHours, 0) * 60),
    (Number(log?.waterIntakeMl) || 0) >= Math.max(0, parseNumber(dailyTargets?.waterLiters, 0) * 1000),
    workoutTargetCount > 0 ? completedWorkoutCount >= workoutTargetCount : completedWorkoutCount > 0,
    (Number(log?.caloriesConsumed) || 0) > 0 &&
      (Number(log?.caloriesConsumed) || 0) <= Math.max(0, parseNumber(dailyTargets?.calories, 0)),
  ].filter(Boolean).length;

  return {
    questCount,
    questsCompleted,
  };
};

const isPerfectDay = (dailyTargets, log) => {
  const { questCount, questsCompleted } = getQuestSummary(dailyTargets, log);
  return questCount > 0 && questsCompleted >= questCount;
};

const computeCurrentStreak = (dailyTargets, bucket) => {
  if (!dailyTargets || !bucket || typeof bucket !== 'object') return 0;

  const keys = getSortedLogKeys(bucket);
  let streak = 0;
  let cursor = keys[keys.length - 1] || '';

  while (cursor && bucket[cursor] && isPerfectDay(dailyTargets, bucket[cursor])) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
};

const computeActivityPoints = (dailyTargets, log) => {
  if (!log || typeof log !== 'object') return 0;

  const workoutTargetCount = getWorkoutTargetCount(dailyTargets);
  const completedWorkoutCount = Array.isArray(log.completedWorkoutTasks) ? log.completedWorkoutTasks.length : 0;

  const studyPoints = Math.round(Math.max(0, parseNumber(log.studyMinutes, 0)) / 30) * 5;
  const workoutPoints = completedWorkoutCount * 8;
  const caloriePoints = Math.round(Math.max(0, parseNumber(log.caloriesBurned, 0)) / 50) * 2;
  const wakeBonus = log.wakeUpTime ? 12 : 0;
  const focusBonus =
    (Number(log.studyMinutes) || 0) >= Math.max(0, parseNumber(dailyTargets?.studyHours, 0) * 60) ? 14 : 0;
  const waterBonus =
    (Number(log.waterIntakeMl) || 0) >= Math.max(0, parseNumber(dailyTargets?.waterLiters, 0) * 1000) ? 12 : 0;
  const workoutBonus = workoutTargetCount > 0 && completedWorkoutCount >= workoutTargetCount ? 16 : 0;
  const calorieBonus =
    (Number(log.caloriesConsumed) || 0) > 0 &&
    (Number(log.caloriesConsumed) || 0) <= Math.max(0, parseNumber(dailyTargets?.calories, 0))
      ? 10
      : 0;

  return (
    studyPoints +
    workoutPoints +
    caloriePoints +
    wakeBonus +
    focusBonus +
    waterBonus +
    workoutBonus +
    calorieBonus
  );
};

const getLastSeenForUser = (store, userId, bucket) => {
  const userUpdatedAt = store.users?.[userId]?.updatedAt || null;
  const profileUpdatedAt = store.profiles?.[userId]?.updatedAt || null;
  const latestLogKey = getSortedLogKeys(bucket)[getSortedLogKeys(bucket).length - 1] || '';
  const latestLogUpdatedAt = latestLogKey ? bucket?.[latestLogKey]?.updatedAt || null : null;

  return [userUpdatedAt, profileUpdatedAt, latestLogUpdatedAt]
    .filter(Boolean)
    .sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0] || null;
};

const isUserOnline = (lastSeen) => {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
};

const buildBadges = ({ points, streakDays, latestLog, questSummary }) => {
  const badges = [];

  if (streakDays >= 7) badges.push('7-day streak');
  if (questSummary.questCount > 0 && questSummary.questsCompleted >= questSummary.questCount) badges.push('Perfect day');
  if ((Number(latestLog?.studyMinutes) || 0) >= 180) badges.push('Focus beast');
  if ((Number(latestLog?.waterIntakeMl) || 0) >= 3000) badges.push('Hydration hero');
  if (points >= 700) badges.push('Arena elite');

  return badges.slice(0, 3);
};

const buildLeaderboardEntry = (store, userId, friendLookup = {}) => {
  const profile = store.profiles?.[userId] ?? null;
  const user = store.users?.[userId] ?? null;
  const bucket = store.dailyLogs?.[userId] ?? {};
  const sortedKeys = getSortedLogKeys(bucket);
  const latestKey = sortedKeys[sortedKeys.length - 1] || '';
  const previousKey = sortedKeys.length > 1 ? sortedKeys[sortedKeys.length - 2] : '';
  const latestLog = latestKey ? bucket[latestKey] : null;
  const previousLog = previousKey ? bucket[previousKey] : null;
  const dailyTargets = profile?.dailyTargets ?? null;

  if (!profile && !latestLog) return null;

  const streakDays = computeCurrentStreak(dailyTargets, bucket);
  const lastSevenKeys = sortedKeys.slice(-7);
  const rollingPoints = lastSevenKeys.reduce(
    (total, key) => total + computeActivityPoints(dailyTargets, bucket[key]),
    0,
  );
  const points = rollingPoints + streakDays * 18;
  const trendPoints = computeActivityPoints(dailyTargets, latestLog) - computeActivityPoints(dailyTargets, previousLog);
  const questSummary = getQuestSummary(dailyTargets, latestLog);
  const league = resolveLeaderboardLeague(points);
  const level = Math.max(1, Math.floor(points / LEADERBOARD_LEVEL_XP) + 1);
  const xpProgress = points % LEADERBOARD_LEVEL_XP;
  const xpProgressPercent = Math.round((xpProgress / LEADERBOARD_LEVEL_XP) * 100);
  const xpToNextLevel = xpProgress === 0 ? LEADERBOARD_LEVEL_XP : LEADERBOARD_LEVEL_XP - xpProgress;
  const weeklyWins = lastSevenKeys.filter((key) => {
    const summary = getQuestSummary(dailyTargets, bucket[key]);
    return summary.questsCompleted >= 4;
  }).length;
  const lastSeen = getLastSeenForUser(store, userId, bucket);

  return {
    id: userId,
    userId,
    name: profile?.name || user?.name || String(user?.email || 'Player').split('@')[0],
    identifier: user?.email || profile?.identifier || undefined,
    points,
    lastSeen: lastSeen || undefined,
    isOnline: isUserOnline(lastSeen),
    streakDays,
    level,
    league: league.label,
    xpToNextLevel,
    xpProgressPercent,
    questsCompleted: questSummary.questsCompleted,
    questCount: questSummary.questCount,
    trendPoints,
    badges: buildBadges({ points, streakDays, latestLog, questSummary }),
    isFriend: Boolean(friendLookup[userId]),
    friendsSince: friendLookup[userId]?.createdAt || undefined,
    activityDate: latestKey || undefined,
    weeklyWins,
  };
};

const ensureFriendshipBucket = (store, userId) => {
  store.friendships[userId] =
    store.friendships?.[userId] && typeof store.friendships[userId] === 'object' ? store.friendships[userId] : {};
  return store.friendships[userId];
};

const areFriends = (store, firstUserId, secondUserId) =>
  Boolean(store.friendships?.[firstUserId]?.[secondUserId] || store.friendships?.[secondUserId]?.[firstUserId]);

const linkFriends = (store, firstUserId, secondUserId, inviteCode) => {
  if (!firstUserId || !secondUserId || firstUserId === secondUserId) return;

  const now = new Date().toISOString();
  const firstBucket = ensureFriendshipBucket(store, firstUserId);
  const secondBucket = ensureFriendshipBucket(store, secondUserId);
  const existingSince = firstBucket[secondUserId]?.createdAt || secondBucket[firstUserId]?.createdAt || now;

  firstBucket[secondUserId] = {
    userId: secondUserId,
    createdAt: existingSince,
    inviteCode: inviteCode || firstBucket[secondUserId]?.inviteCode || null,
  };
  secondBucket[firstUserId] = {
    userId: firstUserId,
    createdAt: existingSince,
    inviteCode: inviteCode || secondBucket[firstUserId]?.inviteCode || null,
  };
};

const resolveInviteStatus = (invite) => {
  if (!invite) return 'expired';
  if (invite.acceptedByUserId) return 'accepted';
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) return 'expired';
  return invite.status === 'expired' ? 'expired' : 'pending';
};

const buildInviteUrl = (request, inviteCode) =>
  `${request.protocol}://${request.get('host')}/?invite=${encodeURIComponent(inviteCode)}`;

const getLatestInviteForUser = (store, userId) =>
  Object.values(store.leaderboardInvites || {})
    .filter((invite) => invite?.inviterUserId === userId)
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())[0] || null;

const serializeInvite = (request, invite) => {
  if (!invite) return null;

  return {
    code: invite.code,
    inviteUrl: buildInviteUrl(request, invite.code),
    inviterUserId: invite.inviterUserId,
    inviterName: invite.inviterName,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    status: resolveInviteStatus(invite),
    acceptedByUserId: invite.acceptedByUserId || null,
  };
};

const buildInvitePreview = (store, request, inviteCode, currentUserId = '') => {
  const invite = store.leaderboardInvites?.[inviteCode] ?? null;
  if (!invite) return null;

  const inviterEntry = buildLeaderboardEntry(store, invite.inviterUserId);
  const alreadyFriends = currentUserId ? areFriends(store, invite.inviterUserId, currentUserId) : false;
  const status = resolveInviteStatus(invite);
  const canJoin = Boolean(
    currentUserId &&
      invite.inviterUserId !== currentUserId &&
      status === 'pending' &&
      !alreadyFriends,
  );

  return {
    code: invite.code,
    inviteUrl: buildInviteUrl(request, invite.code),
    inviterUserId: invite.inviterUserId,
    inviterName: inviterEntry?.name || invite.inviterName || 'OATH Player',
    inviterPoints: inviterEntry?.points || 0,
    inviterLeague: inviterEntry?.league || 'Bronze',
    inviterLevel: inviterEntry?.level || 1,
    status,
    alreadyFriends,
    canJoin,
    acceptedByUserId: invite.acceptedByUserId || null,
  };
};

const listLeaderboardHandler = async (request, response) => {
  const userId = String(request.query?.userId || '').trim();
  if (!userId) return response.status(400).json({ message: 'userId is required.' });

  const store = await readStore();
  const friendLookup = store.friendships?.[userId] && typeof store.friendships[userId] === 'object' ? store.friendships[userId] : {};
  const candidateUserIds = Array.from(
    new Set([...Object.keys(store.profiles || {}), ...Object.keys(store.dailyLogs || {}), userId]),
  );

  const globalEntries = candidateUserIds
    .map((candidateUserId) => buildLeaderboardEntry(store, candidateUserId, friendLookup))
    .filter(Boolean)
    .sort((first, second) => second.points - first.points);

  const friendEntries = Object.keys(friendLookup)
    .map((friendUserId) =>
      buildLeaderboardEntry(store, friendUserId, {
        [friendUserId]: friendLookup[friendUserId],
      }),
    )
    .filter(Boolean)
    .sort((first, second) => second.points - first.points);

  return response.json({
    globalEntries,
    friendEntries,
    activeInvite: serializeInvite(request, getLatestInviteForUser(store, userId)),
  });
};

const createInviteHandler = async (request, response) => {
  const userId = String(request.body?.userId || '').trim();
  const identifier = String(request.body?.identifier || '').trim().toLowerCase();
  const name = String(request.body?.name || '').trim();
  const force = Boolean(request.body?.force);

  if (!userId) return response.status(400).json({ message: 'userId is required.' });

  let invite = null;

  await updateStore((store) => {
    upsertUserInStore(store, { userId, email: identifier, name });
    store.leaderboardInvites =
      store.leaderboardInvites && typeof store.leaderboardInvites === 'object' ? store.leaderboardInvites : {};

    const existingPending = Object.values(store.leaderboardInvites)
      .filter((entry) => entry?.inviterUserId === userId && resolveInviteStatus(entry) === 'pending')
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())[0];

    if (existingPending && !force) {
      invite = existingPending;
      return;
    }

    if (force) {
      Object.values(store.leaderboardInvites).forEach((entry) => {
        if (entry?.inviterUserId === userId && resolveInviteStatus(entry) === 'pending') {
          entry.status = 'expired';
        }
      });
    }

    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + LEADERBOARD_INVITE_TTL_MS).toISOString();
    const code = randomUUID().replace(/-/g, '').slice(0, 12);

    invite = {
      code,
      inviterUserId: userId,
      inviterName: name || store.users?.[userId]?.name || 'OATH Player',
      createdAt,
      expiresAt,
      status: 'pending',
      acceptedByUserId: null,
    };

    store.leaderboardInvites[code] = invite;
  });

  return response.status(201).json({ invite: serializeInvite(request, invite) });
};

const getInviteHandler = async (request, response) => {
  const inviteCode = String(request.params?.inviteCode || '').trim();
  const userId = String(request.query?.userId || '').trim();

  if (!inviteCode) return response.status(400).json({ message: 'inviteCode is required.' });

  const store = await readStore();
  const invite = buildInvitePreview(store, request, inviteCode, userId);

  if (!invite) {
    return response.status(404).json({ message: 'Invite not found.' });
  }

  return response.json({ invite });
};

const joinInviteHandler = async (request, response) => {
  const inviteCode = String(request.body?.inviteCode || '').trim();
  const userId = String(request.body?.userId || '').trim();
  const identifier = String(request.body?.identifier || '').trim().toLowerCase();
  const name = String(request.body?.name || '').trim();

  if (!inviteCode) return response.status(400).json({ message: 'inviteCode is required.' });
  if (!userId) return response.status(400).json({ message: 'userId is required.' });

  let failureMessage = '';
  let inviterUserId = '';

  await updateStore((store) => {
    upsertUserInStore(store, { userId, email: identifier, name });

    const invite = store.leaderboardInvites?.[inviteCode] ?? null;
    if (!invite) {
      failureMessage = 'Invite not found.';
      return;
    }

    inviterUserId = invite.inviterUserId;

    if (invite.inviterUserId === userId) {
      failureMessage = 'You cannot join your own invite.';
      return;
    }

    const status = resolveInviteStatus(invite);
    if (status === 'expired') {
      failureMessage = 'This invite has expired. Ask your friend for a new link.';
      return;
    }

    if (status === 'accepted' && invite.acceptedByUserId !== userId) {
      failureMessage = 'This invite link was already used by another friend.';
      return;
    }

    linkFriends(store, invite.inviterUserId, userId, inviteCode);
    invite.acceptedByUserId = userId;
    invite.acceptedAt = new Date().toISOString();
    invite.status = 'accepted';
  });

  if (failureMessage) {
    return response.status(409).json({ message: failureMessage });
  }

  const store = await readStore();
  const invite = buildInvitePreview(store, request, inviteCode, userId);
  const friend = buildLeaderboardEntry(store, inviterUserId);

  return response.json({
    invite,
    friend,
  });
};

app.get('/api/leaderboard', listLeaderboardHandler);
app.get('/leaderboard', listLeaderboardHandler);
app.post('/api/leaderboard/invite', createInviteHandler);
app.post('/leaderboard/invite', createInviteHandler);
app.get('/api/leaderboard/invite/:inviteCode', getInviteHandler);
app.get('/leaderboard/invite/:inviteCode', getInviteHandler);
app.post('/api/leaderboard/join', joinInviteHandler);
app.post('/leaderboard/join', joinInviteHandler);

const listTasksHandler = async (request, response) => {
  const userId = String(request.query?.userId || '').trim();
  if (!userId) return response.status(400).json({ message: 'userId is required.' });

  const store = await readStore();
  const tasks = Array.isArray(store.tasks[userId]) ? store.tasks[userId] : [];
  return response.json({ tasks });
};

const createTaskHandler = async (request, response) => {
  const userId = String(request.body?.userId || '').trim();
  const email = String(request.body?.identifier || request.body?.email || '').trim().toLowerCase();
  const name = String(request.body?.name || '').trim();
  const title = String(request.body?.title || '').trim();
  const dueAt = request.body?.dueAt ? String(request.body.dueAt).trim() : '';
  const dueDate = normalizeDueDateKey(dueAt, request.body?.dueDate);

  if (!userId) return response.status(400).json({ message: 'userId is required.' });
  if (!title) return response.status(400).json({ message: 'Task title is required.' });

  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    title: title.slice(0, 160),
    dueDate,
    dueAt: dueAt || null,
    completed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await updateStore((store) => {
    store.tasks[userId] = Array.isArray(store.tasks[userId]) ? store.tasks[userId] : [];
    store.tasks[userId].unshift(task);
    upsertUserInStore(store, { userId, email, name });
  });

  return response.status(201).json({ task });
};

const updateTaskHandler = async (request, response) => {
  const userId = String(request.body?.userId || '').trim();
  const email = String(request.body?.identifier || request.body?.email || '').trim().toLowerCase();
  const name = String(request.body?.name || '').trim();
  const taskId = String(request.params?.taskId || '').trim();

  if (!userId) return response.status(400).json({ message: 'userId is required.' });
  if (!taskId) return response.status(400).json({ message: 'taskId is required.' });

  const patch = request.body?.patch && typeof request.body.patch === 'object' ? request.body.patch : {};
  const nextTitle = typeof patch.title === 'string' ? patch.title.trim().slice(0, 160) : null;
  const nextCompleted = typeof patch.completed === 'boolean' ? patch.completed : null;
  const nextDueAt = typeof patch.dueAt === 'string' ? patch.dueAt.trim() : null;
  const nextDueDate = patch.dueDate ? normalizeDateKey(patch.dueDate) : '';

  let updatedTask = null;

  await updateStore((store) => {
    const tasks = Array.isArray(store.tasks[userId]) ? store.tasks[userId] : [];
    const index = tasks.findIndex((item) => item?.id === taskId);
    if (index === -1) return;

    const now = new Date().toISOString();
    const current = tasks[index];
    const dueDate = nextDueAt !== null ? normalizeDueDateKey(nextDueAt) : nextDueDate || current.dueDate;

    const next = {
      ...current,
      title: nextTitle ?? current.title,
      completed: nextCompleted ?? current.completed,
      completedAt:
        nextCompleted === null
          ? current.completedAt
          : nextCompleted
            ? current.completedAt || now
            : null,
      dueAt: nextDueAt !== null ? (nextDueAt || null) : current.dueAt,
      dueDate,
      updatedAt: now,
    };

    tasks[index] = next;
    store.tasks[userId] = tasks;
    updatedTask = next;
    upsertUserInStore(store, { userId, email, name });
  });

  if (!updatedTask) {
    return response.status(404).json({ message: 'Task not found.' });
  }

  return response.json({ task: updatedTask });
};

const deleteTaskHandler = async (request, response) => {
  const userId = String(request.query?.userId || request.body?.userId || '').trim();
  const taskId = String(request.params?.taskId || '').trim();

  if (!userId) return response.status(400).json({ message: 'userId is required.' });
  if (!taskId) return response.status(400).json({ message: 'taskId is required.' });

  let removed = false;

  await updateStore((store) => {
    const tasks = Array.isArray(store.tasks[userId]) ? store.tasks[userId] : [];
    const nextTasks = tasks.filter((item) => item?.id !== taskId);
    removed = nextTasks.length !== tasks.length;
    store.tasks[userId] = nextTasks;
  });

  if (!removed) {
    return response.status(404).json({ message: 'Task not found.' });
  }

  return response.json({ deleted: true });
};

app.get('/api/tasks', listTasksHandler);
app.get('/tasks', listTasksHandler);
app.post('/api/tasks', createTaskHandler);
app.post('/tasks', createTaskHandler);
app.patch('/api/tasks/:taskId', updateTaskHandler);
app.patch('/tasks/:taskId', updateTaskHandler);
app.delete('/api/tasks/:taskId', deleteTaskHandler);
app.delete('/tasks/:taskId', deleteTaskHandler);

const listBmiHandler = async (request, response) => {
  const userId = String(request.query?.userId || '').trim();
  if (!userId) return response.status(400).json({ message: 'userId is required.' });

  const store = await readStore();
  const history = Array.isArray(store.bmi[userId]) ? store.bmi[userId] : [];
  return response.json({ history });
};

const createBmiHandler = async (request, response) => {
  const userId = String(request.body?.userId || '').trim();
  const email = String(request.body?.identifier || request.body?.email || '').trim().toLowerCase();
  const name = String(request.body?.name || '').trim();
  const heightCm = parseNumber(request.body?.heightCm, 0);
  const weightKg = parseNumber(request.body?.weightKg, 0);

  if (!userId) return response.status(400).json({ message: 'userId is required.' });
  if (!heightCm || !weightKg) return response.status(400).json({ message: 'heightCm and weightKg are required.' });

  const now = new Date().toISOString();
  const computed = computeBmi(heightCm, weightKg);
  const entry = {
    id: randomUUID(),
    measuredAt: now,
    heightCm,
    weightKg,
    bmi: computed.bmi,
    category: computed.category,
  };

  await updateStore((store) => {
    store.bmi[userId] = Array.isArray(store.bmi[userId]) ? store.bmi[userId] : [];
    store.bmi[userId].unshift(entry);
    store.bmi[userId] = store.bmi[userId].slice(0, 90);
    upsertUserInStore(store, { userId, email, name });
  });

  return response.status(201).json({ entry });
};

app.get('/api/bmi', listBmiHandler);
app.get('/bmi', listBmiHandler);
app.post('/api/bmi', createBmiHandler);
app.post('/bmi', createBmiHandler);

const statsHandler = async (request, response) => {
  const userId = String(request.query?.userId || '').trim();
  const range = String(request.query?.range || 'weekly').trim().toLowerCase();
  const days = range === 'daily' ? 1 : range === 'monthly' ? 30 : 7;

  if (!userId) return response.status(400).json({ message: 'userId is required.' });

  const store = await readStore();
  const tasks = Array.isArray(store.tasks[userId]) ? store.tasks[userId] : [];
  const history = Array.isArray(store.bmi[userId]) ? store.bmi[userId] : [];

  const today = toDateKey();
  const dateKeys = Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return toDateKey(date);
  });

  const taskSeries = dateKeys.map((key) => {
    const dueToday = tasks.filter((task) => task?.dueDate === key);
    const completed = dueToday.filter((task) => task?.completed).length;
    const pending = dueToday.filter((task) => !task?.completed).length;
    return { day: key.slice(5), completed, pending };
  });

  const pendingOverdue = tasks.filter((task) => !task?.completed && task?.dueDate && task.dueDate <= today).length;

  return response.json({
    range,
    days,
    taskSeries,
    pendingOverdue,
    latestBmi: history[0] ?? null,
    bmiCount: history.length,
  });
};

app.get('/api/stats', statsHandler);
app.get('/stats', statsHandler);

app.post('/api/reset', async (request, response) => {
  const userId = String(request.body?.userId || '').trim();
  if (!userId) return response.status(400).json({ message: 'userId is required.' });

  await updateStore((store) => {
    delete store.tasks[userId];
    delete store.bmi[userId];
    delete store.reminders[userId];
  });

  return response.json({ ok: true });
});

app.post('/api/ai/companion', async (request, response) => {
  const message = String(request.body?.message || '').trim();
  const profile = request.body?.profile ?? null;
  const dailyLog = request.body?.dailyLog ?? null;
  const conversation = Array.isArray(request.body?.conversation) ? request.body.conversation : [];

  if (!message) {
    return response.status(400).json({ message: 'Message is required.' });
  }

  refreshEnv();

  if (!isGroqConfigured()) {
    return response.json({
      reply: buildLocalCompanionReply({
        message,
        profile,
        dailyLog,
        recentMessages: conversation,
      }),
      source: 'local-fallback',
    });
  }

  try {
    const contextSummary = [
      `Name: ${profile?.name || 'User'}`,
      `Goal: ${profile?.goal || 'Unknown'}`,
      `Workout target: ${profile?.dailyTargets?.workoutMinutes || 0} minutes`,
      `Study target: ${profile?.dailyTargets?.studyHours || 0} hours`,
      `Water target: ${profile?.dailyTargets?.waterLiters || 0} liters`,
      `Calories target: ${profile?.dailyTargets?.calories || 0} kcal`,
      `Today's study: ${dailyLog?.studyMinutes || 0} minutes`,
      `Today's water: ${dailyLog?.waterIntakeMl || 0} ml`,
      `Today's calories consumed: ${dailyLog?.caloriesConsumed || 0} kcal`,
      `Today's calories burned: ${dailyLog?.caloriesBurned || 0} kcal`,
      `Completed workout tasks: ${(dailyLog?.completedWorkoutTasks || []).join(', ') || 'none'}`,
    ].join('\n');

    const recentConversation = conversation
      .slice(-6)
      .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.text}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content:
          'You are a disciplined, supportive AI fitness and productivity companion. Give practical, non-repetitive guidance tailored to the user. Prefer action-oriented coaching over generic motivational quotes. Do not reveal chain-of-thought, hidden reasoning, notes, or planning. Never use markdown tables, long separators, or dense formatting. Give a complete answer and never stop mid-sentence. Use either a short paragraph or 2 to 5 short bullet points when helpful.',
      },
      {
        role: 'system',
        content: `User context:\n${contextSummary}`,
      },
      ...conversation.slice(-6).map((entry) => ({
        role: entry.role,
        content: entry.text,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    const preferredModel = getGroqModel('general');
    const modelCandidates = [...new Set([preferredModel, 'llama-3.3-70b-versatile'])];
    const tokenCandidates = [320, 640];
    let reply = '';
    let lastData = null;
    let lastFinishReason = null;

    for (const model of modelCandidates) {
      for (const maxCompletionTokens of tokenCandidates) {
        const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify(buildCompanionRequestBody(model, messages, maxCompletionTokens)),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          throw new Error(errorText || 'Groq request failed');
        }

        const data = await aiResponse.json();
        lastData = data;
        lastFinishReason = data?.choices?.[0]?.finish_reason ?? null;
        reply = extractGroqChatText(data) || extractGroqResponseText(data);

        if (reply && lastFinishReason !== 'length') {
          break;
        }
      }

      if (reply && lastFinishReason !== 'length') {
        break;
      }
    }

    if (!reply) {
      console.error('Groq companion response missing text', {
        status: lastData?.status,
        keys: Object.keys(lastData || {}),
        outputTypes: Array.isArray(lastData?.output) ? lastData.output.map((item) => item?.type || 'unknown') : [],
        choiceCount: Array.isArray(lastData?.choices) ? lastData.choices.length : 0,
        choicePreview: JSON.stringify(lastData?.choices?.[0] ?? null)?.slice(0, 1200),
        finishReason: lastFinishReason,
      });
      throw new Error('No AI response text returned');
    }

    return response.json({
      reply,
      source: 'groq',
    });
  } catch (error) {
    console.error('Groq companion request failed', error);
    return response.status(502).json({
      source: 'groq-error',
      message: 'Groq companion request failed.',
      detail: error instanceof Error ? error.message : 'Unknown Groq error.',
    });
  }
});

app.post('/api/ai/scan-food', async (request, response) => {
  const imageDataUrl = String(request.body?.imageDataUrl || '').trim();
  const fileName = String(request.body?.fileName || '').trim();
  const attempt = Number(request.body?.attempt || 0);

  if (!imageDataUrl.startsWith('data:image/')) {
    return response.status(400).json({ message: 'A valid image is required.' });
  }

  refreshEnv();

  if (!isGroqConfigured()) {
    return response.status(503).json({ message: 'Groq is not configured.' });
  }

  try {
    const avoidGuessInstruction =
      attempt > 0
        ? 'The previous guess was wrong. Re-evaluate carefully and do not reuse the same mistake.'
        : 'Be careful and prefer broad, correct food names over overly specific but wrong guesses.';

    const aiResponse = await fetch('https://api.groq.com/openai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: getGroqModel('vision'),
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'You identify food from meal images and estimate nutrition. Return only strict JSON with keys: name, calories, proteinG, carbsG, fatG, sugarG, fiberG, sodiumMg, confidence. Use a practical food label like "Pizza" or "Vegetable Sandwich". Calories and macros must be for the visible serving (not per 100g). Units: calories=kcal, macros=grams, sodium=mg. Confidence is 0-1. If unsure, prefer safer broad labels and reasonable macro estimates.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Analyze this meal image from file "${fileName || 'upload'}". ${avoidGuessInstruction} If uncertain, choose a safer broad label like "Pizza", "Burger", "Rice Meal", "Pasta", or "Salad Bowl".`,
              },
              {
                type: 'input_image',
                image_url: imageDataUrl,
              },
            ],
          },
        ],
        max_output_tokens: 260,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(errorText || 'Groq food scan request failed');
    }

    const data = await aiResponse.json();
    const outputText = extractGroqResponseText(data);

    if (!outputText) {
      console.error('Groq food scan response missing text', {
        status: data?.status,
        keys: Object.keys(data || {}),
        outputTypes: Array.isArray(data?.output) ? data.output.map((item) => item?.type || 'unknown') : [],
      });
      throw new Error('Groq food scan returned no readable text.');
    }

    const parsed = extractJsonObject(outputText);
    const safeName = String(parsed.name || 'Detected Meal').trim();

    const readKey = (obj, keys) => {
      for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
          return obj[key];
        }
      }
      return undefined;
    };

    const toNumber = (value) => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
      }

      if (typeof value === 'string') {
        const match = value.match(/-?\d+(\.\d+)?/);
        if (!match) return 0;
        const num = Number(match[0]);
        return Number.isFinite(num) ? num : 0;
      }

      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    const round1 = (value) => Math.round(value * 10) / 10;

    const safeCalories = Math.max(
      1,
      Math.round(toNumber(readKey(parsed, ['calories', 'caloriesKcal', 'kcal', 'energyKcal'])) || 250),
    );
    const safeProteinG = round1(Math.max(0, toNumber(readKey(parsed, ['proteinG', 'protein_g', 'protein']))));
    const safeCarbsG = round1(Math.max(0, toNumber(readKey(parsed, ['carbsG', 'carbs_g', 'carbs']))));
    const safeFatG = round1(Math.max(0, toNumber(readKey(parsed, ['fatG', 'fat_g', 'fat']))));
    const safeSugarG = round1(Math.max(0, toNumber(readKey(parsed, ['sugarG', 'sugar_g', 'sugar']))));
    const safeFiberG = round1(Math.max(0, toNumber(readKey(parsed, ['fiberG', 'fiber_g', 'fiber']))));
    const safeSodiumMg = Math.round(Math.max(0, toNumber(readKey(parsed, ['sodiumMg', 'sodium_mg', 'sodium']))));
    const safeConfidence = Math.max(0, Math.min(1, toNumber(readKey(parsed, ['confidence', 'score'])) || 0.7));

    return response.json({
      name: safeName,
      calories: safeCalories,
      proteinG: safeProteinG,
      carbsG: safeCarbsG,
      fatG: safeFatG,
      sugarG: safeSugarG,
      fiberG: safeFiberG,
      sodiumMg: safeSodiumMg,
      confidence: safeConfidence,
      source: 'groq',
    });
  } catch (error) {
    console.error('Groq food scan request failed', error);
    return response.status(502).json({
      source: 'groq-error',
      message: 'AI food scan failed.',
      detail: error instanceof Error ? error.message : 'Unknown Groq error.',
    });
  }
});

const sendTaskReminderEmail = async ({ identifier, name, tasks, goalStatus, transporter }) => {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const provider = getEmailProvider();

  if (provider === 'none') {
    throw new Error('No email provider is configured.');
  }

  const hasGoals = Boolean(goalStatus?.hasMissing);
  const subject = safeTasks.length
    ? `OATH reminder: ${safeTasks.length} task${safeTasks.length === 1 ? '' : 's'}${hasGoals ? ' + goals' : ''} left today`
    : `OATH reminder: goals left today`;
  const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
  const text = buildReminderEmailText({ name, tasks: safeTasks, goalStatus });
  const html = buildReminderEmailHtml({ name, tasks: safeTasks, appUrl, goalStatus });

  if (provider === 'resend') {
    return sendReminderWithResend({ identifier, subject, text, html });
  }

  const activeTransporter = transporter || createTransporter(provider);
  if (!activeTransporter) {
    throw new Error('Email transporter is not available.');
  }

  return sendReminderWithTransporter({
    identifier,
    subject,
    text,
    html,
    transporter: activeTransporter,
  });
};

const runTaskReminderJob = async () => {
  refreshEnv();

  const provider = getEmailProvider();
  if (provider === 'none') {
    return;
  }

  const today = toDateKey();
  const store = await readStore();
  const transporter = provider === 'resend' ? null : createTransporter(provider);

  const candidateUserIds = new Set([
    ...Object.keys(store.users || {}),
    ...Object.keys(store.profiles || {}),
    ...Object.keys(store.tasks || {}),
    ...Object.keys(store.dailyLogs || {}),
  ]);

  for (const userId of candidateUserIds) {
    const user = store.users?.[userId] ?? null;
    const email = user?.email || store.profiles?.[userId]?.identifier || null;

    if (!email || !String(email).includes('@')) {
      continue;
    }

    const lastSentDate = store.reminders?.[userId]?.lastSentDate || '';
    if (lastSentDate === today) {
      continue;
    }

    const tasks = Array.isArray(store.tasks?.[userId]) ? store.tasks[userId] : [];
    const pending = tasks.filter((task) => !task?.completed && task?.dueDate && task.dueDate <= today);

    const profileTargets = store.profiles?.[userId]?.dailyTargets ?? null;
    const dailyLog = store.dailyLogs?.[userId]?.[today] ?? null;
    const goalStatus = buildGoalStatus({ profileTargets, dailyLog });

    if (!pending.length && !goalStatus?.hasMissing) {
      continue;
    }

    const recipientName =
      store.profiles?.[userId]?.name || user?.name || String(email).split('@')[0];

    try {
      await sendTaskReminderEmail({
        identifier: email,
        name: recipientName,
        tasks: pending,
        goalStatus,
        transporter,
      });

      await updateStore((storeUpdate) => {
        storeUpdate.reminders[userId] = {
          lastSentDate: today,
          lastSentAt: new Date().toISOString(),
          pendingCount: pending.length,
          goalRemaining: goalStatus?.hasMissing ? goalStatus : null,
        };
      });
    } catch (error) {
      console.error('Failed to send task reminder email', error);
    }
  }
};

const scheduleTaskReminders = () => {
  const enabled = String(process.env.ENABLE_TASK_REMINDERS || 'true').trim().toLowerCase() !== 'false';
  if (!enabled) return;

  const cronExpression = String(process.env.TASK_REMINDER_CRON || '0 20 * * *').trim();
  const timeZone = getReminderTimeZone();

  if (!cron.validate(cronExpression)) {
    console.warn('Invalid TASK_REMINDER_CRON expression, skipping scheduler:', cronExpression);
    return;
  }

  cron.schedule(
    cronExpression,
    () => {
      void runTaskReminderJob();
    },
    { timezone: timeZone },
  );
};

scheduleTaskReminders();

if (fs.existsSync(distIndexPath)) {
  app.use(express.static(distPath));

  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(distIndexPath);
  });
}

app.listen(port, () => {
  console.log(`OATH server listening on http://localhost:${port}`);
});
