import { DailyLog, StreakRecord } from '../types';

export const computeUserScore = (log: DailyLog, streakHistory: StreakRecord[]) => {
  const streakPoints = (streakHistory[streakHistory.length - 1]?.streak ?? 0) * 10;
  const studyPoints = Math.round(log.studyMinutes / 30) * 5;
  const taskPoints = log.completedWorkoutTasks.length * 8;
  const caloriePoints = Math.round(log.caloriesBurned / 50) * 2;

  return streakPoints + studyPoints + taskPoints + caloriePoints;
};
