import React, { useState } from 'react';
import { Book, Zap } from 'lucide-react';

export default function StudyTracker({ log, onUpdate, date }) {
  const [session1, setSession1] = useState(log?.studyHours?.session1?.actual || 0);
  const [session2, setSession2] = useState(log?.studyHours?.session2?.actual || 0);

  const totalHours = session1 + session2;
  const goal = 8;
  const percentage = Math.min((totalHours / goal) * 100, 100);

  const handleUpdateSession = async (sessionNum, hours) => {
    if (sessionNum === 1) {
      setSession1(hours);
      await onUpdate('study', { session: 1, hours }, date);
    } else {
      setSession2(hours);
      await onUpdate('study', { session: 2, hours }, date);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Book className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold dark:text-white">Study Hours</h2>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-semibold dark:text-gray-300">{totalHours.toFixed(1)}h / {goal}h</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{Math.round(percentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              percentage >= 100 ? 'bg-green-500' : 'bg-purple-500'
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>

      {/* Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Session 1 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold dark:text-white">Session 1 (Morning)</h3>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="12"
              step="0.5"
              value={session1}
              onChange={(e) => handleUpdateSession(1, parseFloat(e.target.value) || 0)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <span className="text-gray-600 dark:text-gray-400">/ 4 hours</span>
            {session1 >= 4 && <span className="text-green-600 font-semibold">✓</span>}
          </div>
        </div>

        {/* Session 2 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold dark:text-white">Session 2 (Evening)</h3>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="12"
              step="0.5"
              value={session2}
              onChange={(e) => handleUpdateSession(2, parseFloat(e.target.value) || 0)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <span className="text-gray-600 dark:text-gray-400">/ 4 hours</span>
            {session2 >= 4 && <span className="text-green-600 font-semibold">✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
