import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import WakeUpTracker from '../components/WakeUpTracker';
import StudyTracker from '../components/StudyTracker';
import WaterTracker from '../components/WaterTracker';
import HabitTracker from '../components/HabitTracker';
import GoalsPanel from '../components/GoalsPanel';
import { dailyLogAPI, goalsAPI } from '../services/api';

export default function Dashboard() {
  const [log, setLog] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const logRes = await dailyLogAPI.getDailyLog(dateStr);
      setLog(logRes.data.log);

      const goalsRes = await goalsAPI.getGoals();
      setGoals(goalsRes.data.goals);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (type, data, date) => {
    try {
      const dateStr = date ? new Date(date).toISOString().split('T')[0] : selectedDate.toISOString().split('T')[0];

      if (type === 'wakeup') {
        await dailyLogAPI.updateWakeUpTime(data, dateStr);
      } else if (type === 'study') {
        await dailyLogAPI.updateStudyHours(data.session, data.hours, dateStr);
      } else if (type === 'water') {
        await dailyLogAPI.addWater(data, dateStr);
      } else if (type === 'habit') {
        await dailyLogAPI.updateHabit(data.habit, data.value, dateStr);
      }

      await fetchData();
    } catch (error) {
      console.error('Error updating data:', error);
    }
  };

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isToday = new Date().toDateString() === selectedDate.toDateString();

  const dateStr = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Dashboard</h1>

          {/* Date selector */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>

            <div className="flex items-center gap-3 text-center">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-lg font-semibold dark:text-white">{dateStr}</p>
                {isToday && <p className="text-sm text-blue-600 font-semibold">Today</p>}
              </div>
            </div>

            <button
              onClick={() => changeDate(1)}
              disabled={selectedDate.toDateString() === new Date().toDateString()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <WakeUpTracker log={log} onUpdate={handleUpdate} date={selectedDate.toISOString().split('T')[0]} />
            <StudyTracker log={log} onUpdate={handleUpdate} date={selectedDate.toISOString().split('T')[0]} />
            <WaterTracker log={log} onUpdate={handleUpdate} date={selectedDate.toISOString().split('T')[0]} />
            <HabitTracker log={log} onUpdate={handleUpdate} date={selectedDate.toISOString().split('T')[0]} />
          </div>

          {/* Sidebar */}
          <div>
            <GoalsPanel goals={goals} onGoalsChange={fetchData} />
          </div>
        </div>
      </div>
    </div>
  );
}
