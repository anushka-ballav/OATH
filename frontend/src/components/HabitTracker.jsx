import React, { useState } from 'react';
import { Heart, Shield } from 'lucide-react';

export default function HabitTracker({ log, onUpdate, date }) {
  const isNoMasturbation = log?.habits?.noMasturbation || false;

  const handleToggle = async () => {
    await onUpdate('habit', { habit: 'noMasturbation', value: !isNoMasturbation }, date);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-6 h-6 text-green-600" />
        <h2 className="text-2xl font-bold dark:text-white">Habits</h2>
      </div>

      {/* Habit toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center gap-3">
            <Heart className={`w-5 h-5 ${isNoMasturbation ? 'text-green-600 fill-green-600' : 'text-gray-400'}`} />
            <div>
              <h3 className="font-semibold dark:text-white">No Masturbation</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Keep discipline today</p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              isNoMasturbation ? 'bg-green-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                isNoMasturbation ? 'translate-x-7' : 'translate-x-1'
              }`}
            ></span>
          </button>
        </div>
      </div>

      {/* Motivational message */}
      {isNoMasturbation && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900 rounded text-green-700 dark:text-green-200 text-sm">
          <p>🎯 Great job maintaining discipline today!</p>
        </div>
      )}
    </div>
  );
}
