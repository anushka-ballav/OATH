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

const distributeMinutes = (totalMinutes: number, ratios: number[]) => {
  const safeTotal = Math.max(ratios.length, Math.round(totalMinutes));
  const ratioSum = ratios.reduce((sum, ratio) => sum + Math.max(0, ratio), 0) || 1;
  const raw = ratios.map((ratio) => (safeTotal * Math.max(0, ratio)) / ratioSum);
  const minutes = raw.map((value) => Math.floor(value));
  let remainder = safeTotal - minutes.reduce((sum, value) => sum + value, 0);

  const orderByFraction = raw
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value),
    }))
    .sort((first, second) => second.fraction - first.fraction);

  for (let index = 0; index < orderByFraction.length && remainder > 0; index += 1) {
    minutes[orderByFraction[index].index] += 1;
    remainder -= 1;
  }

  return minutes;
};

const withMinutesLabel = (minutes: number, text: string) =>
  `${minutes} minute${minutes === 1 ? '' : 's'} ${text}`;

const buildWorkoutPlan = ({
  goal,
  workoutMinutes,
  estimatedCaloriesBurned,
}: {
  goal: GoalType;
  workoutMinutes: number;
  estimatedCaloriesBurned: number;
}): WorkoutPlan => {
  const durations = distributeMinutes(workoutMinutes, [0.1, 0.35, 0.4, 0.15]);

  if (goal === 'Lose Fat') {
    return {
      title: 'Daily basic fat-loss workout',
      summary: `Use ${workoutMinutes} minutes today for simple cardio and full-body movement that helps burn calories without losing muscle. Finish the full plan to log about ${estimatedCaloriesBurned} kcal burned.`,
      dailyChecklist: [
        { id: 'warmup', label: withMinutesLabel(durations[0], 'warm-up walk or marching') },
        { id: 'strength', label: withMinutesLabel(durations[1], 'squats, push-ups, rows, and lunges') },
        { id: 'cardio', label: withMinutesLabel(durations[2], 'brisk walk, cycle, jog, or skipping') },
        { id: 'core', label: withMinutesLabel(durations[3], 'planks and stretching cooldown') },
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
        { id: 'warmup', label: withMinutesLabel(durations[0], 'mobility and warm-up') },
        { id: 'compound', label: withMinutesLabel(durations[1], 'compound lifts or bodyweight strength work') },
        { id: 'accessory', label: withMinutesLabel(durations[2], 'accessory reps for weak muscle groups') },
        { id: 'cooldown', label: withMinutesLabel(durations[3], 'cooldown and protein meal planning') },
      ],
      estimatedCaloriesBurned,
      recoveryTip: 'Prioritize protein, increase weights gradually, and leave at least 48 hours before training the same muscle hard again.',
    };
  }

  return {
    title: 'Daily basic maintenance workout',
    summary: `Aim for ${workoutMinutes} minutes today to maintain fitness, strength, and a balanced routine. Finish the full plan to log about ${estimatedCaloriesBurned} kcal burned.`,
    dailyChecklist: [
      { id: 'warmup', label: withMinutesLabel(durations[0], 'warm-up and joint mobility') },
      { id: 'strength', label: withMinutesLabel(durations[1], 'full-body strength movements') },
      { id: 'cardio', label: withMinutesLabel(durations[2], 'walking, cycling, or light cardio') },
      { id: 'cooldown', label: withMinutesLabel(durations[3], 'stretching and breathing') },
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
  dailyStudyHours,
  dailyWorkoutMinutes,
}: {
  gender: GenderType;
  age: number;
  height: number;
  weight: number;
  goal: GoalType;
  dailyAvailableHours?: number;
  dailyStudyHours?: number;
  dailyWorkoutMinutes?: number;
}): DailyTargets => {
  const fallbackAvailableHours = Math.min(12, Math.max(1, Number(dailyAvailableHours) || 4));
  const numericStudyHours = Number(dailyStudyHours);
  const numericWorkoutMinutes = Number(dailyWorkoutMinutes);
  const studyHours = Number.isFinite(dailyStudyHours)
    ? Math.min(10, Math.max(1, numericStudyHours))
    : Math.min(6, Math.max(2, Math.round(fallbackAvailableHours * 0.75)));
  const workoutMinutes = Number.isFinite(dailyWorkoutMinutes)
    ? Math.min(180, Math.max(15, Math.round(numericWorkoutMinutes)))
    : Math.min(60, Math.max(30, Math.round(fallbackAvailableHours * 10)));
  const effectiveAvailableHours = Math.min(12, Math.max(1, studyHours + workoutMinutes / 60));

  const baseCalories = 10 * weight + 6.25 * height - 5 * age + genderCalorieOffset[gender];
  const activityCalories = 260 + Math.round(Math.min(220, Math.max(40, effectiveAvailableHours * 35)));
  const adjustedCalories = Math.round(baseCalories + activityCalories + goalCalories[goal]);
  const baseWater = weight * genderHydrationMultiplier[gender];
  const activityWaterBonus = Math.min(0.5, Math.max(0.1, effectiveAvailableHours * 0.04));
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
