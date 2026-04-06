import React, { useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

export default function WakeUpTracker({ log, onUpdate, date }) {
  const [timeInput, setTimeInput] = useState(log?.wakeUpTime?.actualTime || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (timeInput) {
      await onUpdate('wakeup', timeInput, date);
      setIsEditing(false);
    }
  };

  const status = log?.wakeUpTime?.status || 'not-marked';
  const lateMinutes = log?.wakeUpTime?.lateMinutes || 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold dark:text-white">Wake Up Time</h2>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
          status === 'on-time' ? 'bg-green-100 text-green-800' :
          status === 'late' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {status === 'on-time' ? '✓ On Time' : status === 'late' ? `Late ${lateMinutes}m` : 'Not Set'}
        </div>
      </div>

      {status === 'late' && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 rounded text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>You woke up {lateMinutes} minutes late</span>
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Actual Wake Up Time
            </label>
            <input
              type="time"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Target: 6:00 AM</p>
            {timeInput && <p className="text-lg font-semibold dark:text-white mt-1">Actual: {timeInput}</p>}
          </div>
          <button
            onClick={() => {
              setTimeInput(log?.wakeUpTime?.actualTime || '');
              setIsEditing(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {timeInput ? 'Edit' : 'Mark Time'}
          </button>
        </div>
      )}
    </div>
  );
}
