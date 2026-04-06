export type GoalType = 'Lose Fat' | 'Gain Muscle' | 'Maintain';
export type GenderType = 'Female' | 'Male' | 'Other';

export type AppTab = 'home' | 'progress' | 'correlation' | 'leaderboard' | 'companion' | 'scan' | 'profile';

export interface DailyTargets {
  wakeUpGoal: string;
  workoutMinutes: number;
  studyHours: number;
  waterLiters: number;
  calories: number;
  macroTargets: MacroTargets;
  workoutPlan: WorkoutPlan;
}

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarMaxG: number;
  fiberMinG: number;
  sodiumMaxMg: number;
}

export interface WorkoutPlan {
  title: string;
  summary: string;
  dailyChecklist: WorkoutTask[];
  estimatedCaloriesBurned: number;
  recoveryTip: string;
}

export interface WorkoutTask {
  id: string;
  label: string;
}

export interface UserProfile {
  userId: string;
  name: string;
  gender: GenderType;
  age: number;
  height: number;
  weight: number;
  goal: GoalType;
  dailyAvailableHours: number;
  dailyTargets: DailyTargets;
}

export interface UserSession {
  userId: string;
  identifier: string;
  verifiedAt: string;
  provider: 'simulated-otp' | 'firebase-auth' | 'email-smtp' | 'email-otp';
}

export interface CustomWorkoutEntry {
  id: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  createdAt: string;
}

export interface DailyLog {
  date: string;
  wakeUpTime?: string;
  studyMinutes: number;
  waterIntakeMl: number;
  caloriesBurned: number;
  manualCaloriesBurned?: number;
  workoutPlanCaloriesBurned?: number;
  caloriesConsumed: number;
  foodEntries: FoodEntry[];
  completedWorkoutTasks: string[];
  customWorkoutEntries?: CustomWorkoutEntry[];
}

export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  sugarG?: number;
  fiberG?: number;
  sodiumMg?: number;
  source: 'spoonacular' | 'mock' | 'groq';
  createdAt: string;
  imageName?: string;
}

export type BMICategory = 'Underweight' | 'Normal' | 'Overweight' | 'Obese';

export interface BMIEntry {
  id: string;
  measuredAt: string;
  heightCm: number;
  weightKg: number;
  bmi: number;
  category: BMICategory;
}

export interface TaskItem {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueAt: string | null; // ISO string (optional)
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StreakRecord {
  date: string;
  streak: number;
}

export interface NotificationItem {
  id: string;
  label: string;
  time: string;
  enabled: boolean;
}

export interface LeaderboardEntry {
  id: string;
  userId?: string;
  name: string;
  points: number;
  identifier?: string;
  lastSeen?: string;
  isOnline?: boolean;
  streakDays?: number;
  level?: number;
  league?: string;
  xpToNextLevel?: number;
  xpProgressPercent?: number;
  questsCompleted?: number;
  questCount?: number;
  trendPoints?: number;
  badges?: string[];
  isFriend?: boolean;
  friendsSince?: string;
  activityDate?: string;
  weeklyWins?: number;
}

export interface LeaderboardInvite {
  code: string;
  inviteUrl: string;
  inviterUserId: string;
  inviterName: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
  acceptedByUserId?: string | null;
}

export interface LeaderboardInvitePreview {
  code: string;
  inviteUrl: string;
  inviterUserId: string;
  inviterName: string;
  inviterPoints: number;
  inviterLeague: string;
  inviterLevel: number;
  status: 'pending' | 'accepted' | 'expired';
  alreadyFriends: boolean;
  canJoin: boolean;
  acceptedByUserId?: string | null;
}

export interface LeaderboardSnapshot {
  globalEntries: LeaderboardEntry[];
  friendEntries: LeaderboardEntry[];
  activeInvite: LeaderboardInvite | null;
}

export interface AppState {
  session: UserSession | null;
  profile: UserProfile | null;
  logs: DailyLog[];
  tasks: TaskItem[];
  bmiHistory: BMIEntry[];
  streakHistory: StreakRecord[];
  notifications: NotificationItem[];
  leaderboard: LeaderboardEntry[];
  darkMode: boolean;
}
