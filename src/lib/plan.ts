import { DailyTargets, GenderType, GoalType, MacroTargets, WorkoutPlan } from '../types';

const goalCalories: Record<GoalType, number> = {
  'Lose Fat': -350,
  'Gain Muscle': 250,
  Maintain: 0,
};

const genderCalorieOffset: Record<GenderType, number> = {
  Female: -161,
  Male: 5,
  Other: -78,
};

const genderHydrationMultiplier: Record<GenderType, number> = {
  Female: 0.033,
  Male: 0.038,
  Other: 0.035,
};

const workoutMetByGoal: Record<GoalType, number> = {
  'Lose Fat': 7.4,
  'Gain Muscle': 6.0,
  Maintain: 6.4,
};

const genderWorkoutBurnMultiplier: Record<GenderType, number> = {
  Female: 0.95,
  Male: 1,
  Other: 0.97,
};

const estimateWorkoutCaloriesBurned = ({
  goal,
  gender,
  weight,
  workoutMinutes,
}: {
  goal: GoalType;
  gender: GenderType;
  weight: number;
  workoutMinutes: number;
}) => {
  const met = workoutMetByGoal[goal];
  const caloriesPerMinute = (met * 3.5 * Math.max(35, weight)) / 200;
  return Math.max(
    120,
    Math.round(caloriesPerMinute * workoutMinutes * genderWorkoutBurnMultiplier[gender]),
  );
};

const buildWorkoutPlan = ({
  goal,
  workoutMinutes,
  estimatedCaloriesBurned,
}: {
  goal: GoalType;
  workoutMinutes: number;
  estimatedCaloriesBurned: number;
}): WorkoutPlan => {
  if (goal === 'Lose Fat') {
    return {
      title: 'Daily basic fat-loss workout',
      summary: `Use ${workoutMinutes} minutes today for simple cardio and full-body movement that helps burn calories without losing muscle. Finish the full plan to log about ${estimatedCaloriesBurned} kcal burned.`,
      dailyChecklist: [
        { id: 'warmup', label: '5 minutes warm-up walk or marching' },
        { id: 'strength', label: '15 minutes squats, push-ups, rows, and lunges' },
        { id: 'cardio', label: '15 minutes brisk walk, cycle, jog, or skipping' },
        { id: 'core', label: '5 minutes planks and stretching cooldown' },
      ],
      estimatedCaloriesBurned,
      recoveryTip: 'Keep rest periods short, aim for 8,000 to 10,000 daily steps, and protect sleep so recovery stays high.',
    };
  }

  if (goal === 'Gain Muscle') {
    return {
      title: 'Daily basic muscle workout',
      summary: `Use ${workoutMinutes} minutes today for controlled resistance work and steady progression. Finish the full plan to log about ${estimatedCaloriesBurned} kcal burned.`,
      dailyChecklist: [
        { id: 'warmup', label: '5 minutes mobility and warm-up' },
        { id: 'compound', label: '20 minutes compound lifts or bodyweight strength work' },
        { id: 'accessory', label: '10 minutes accessory reps for weak muscle groups' },
        { id: 'cooldown', label: '5 minutes cooldown and protein meal planning' },
      ],
      estimatedCaloriesBurned,
      recoveryTip: 'Prioritize protein, increase weights gradually, and leave at least 48 hours before training the same muscle hard again.',
    };
  }

  return {
    title: 'Daily basic maintenance workout',
    summary: `Aim for ${workoutMinutes} minutes today to maintain fitness, strength, and a balanced routine. Finish the full plan to log about ${estimatedCaloriesBurned} kcal burned.`,
    dailyChecklist: [
      { id: 'warmup', label: '5 minutes warm-up and joint mobility' },
      { id: 'strength', label: '15 minutes full-body strength movements' },
      { id: 'cardio', label: '10 minutes walking, cycling, or light cardio' },
      { id: 'cooldown', label: '5 minutes stretching and breathing' },
    ],
    estimatedCaloriesBurned,
    recoveryTip: 'Keep intensity moderate, stay active on non-gym days, and use consistency rather than extremes.',
  };
};

const buildMacroTargets = ({ goal, weight, calories }: { goal: GoalType; weight: number; calories: number }): MacroTargets => {
  const proteinPerKg = goal === 'Lose Fat' ? 2.0 : goal === 'Gain Muscle' ? 1.8 : 1.6;
  const proteinG = Math.max(80, Math.round(weight * proteinPerKg));

  const fatRatio = goal === 'Lose Fat' ? 0.3 : goal === 'Gain Muscle' ? 0.25 : 0.28;
  const fatG = Math.max(35, Math.round((calories * fatRatio) / 9));

  const remainingCalories = Math.max(0, calories - proteinG * 4 - fatG * 9);
  const carbsG = Math.max(60, Math.round(remainingCalories / 4));

  const sugarMaxG = goal === 'Lose Fat' ? 30 : goal === 'Gain Muscle' ? 45 : 40;
  const fiberMinG = goal === 'Lose Fat' ? 30 : goal === 'Gain Muscle' ? 25 : 28;
  const sodiumMaxMg = 2300;

  return {
    proteinG,
    carbsG,
    fatG,
    sugarMaxG,
    fiberMinG,
    sodiumMaxMg,
  };
};

export const generatePlan = ({
  gender,
  age,
  height,
  weight,
  goal,
  dailyAvailableHours,
}: {
  gender: GenderType;
  age: number;
  height: number;
  weight: number;
  goal: GoalType;
  dailyAvailableHours: number;
}): DailyTargets => {
  const baseCalories = 10 * weight + 6.25 * height - 5 * age + genderCalorieOffset[gender];
  const activityCalories = 260 + Math.round(Math.min(220, Math.max(40, dailyAvailableHours * 35)));
  const adjustedCalories = Math.round(baseCalories + activityCalories + goalCalories[goal]);
  const workoutMinutes = Math.min(60, Math.max(30, Math.round(dailyAvailableHours * 10)));
  const studyHours = Math.min(6, Math.max(2, Math.round(dailyAvailableHours * 0.75)));
  const baseWater = weight * genderHydrationMultiplier[gender];
  const activityWaterBonus = Math.min(0.5, Math.max(0.1, dailyAvailableHours * 0.04));
  const waterLiters = Number(Math.min(4.5, Math.max(2, baseWater + activityWaterBonus)).toFixed(1));
  const estimatedCaloriesBurned = estimateWorkoutCaloriesBurned({
    goal,
    gender,
    weight,
    workoutMinutes,
  });
  const workoutPlan = buildWorkoutPlan({
    goal,
    workoutMinutes,
    estimatedCaloriesBurned,
  });
  const macroTargets = buildMacroTargets({ goal, weight, calories: adjustedCalories });

  return {
    wakeUpGoal: '06:00',
    workoutMinutes,
    studyHours,
    waterLiters,
    calories: adjustedCalories,
    macroTargets,
    workoutPlan,
  };
};
