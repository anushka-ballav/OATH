import React, { useState } from 'react';
import { Droplet } from 'lucide-react';

export default function WaterTracker({ log, onUpdate, date }) {
  const waterIntake = log?.waterIntake?.actual || 0;
  const goal = 6000; // ml
  const percentage = Math.min((waterIntake / goal) * 100, 100);

  const waterOptions = [
    { label: '250ml', amount: 250 },
    { label: '500ml', amount: 500 },
    { label: '1L', amount: 1000 }
  ];

  const handleAddWater = async (amount) => {
    await onUpdate('water', amount, date);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Droplet className="w-6 h-6 text-cyan-600" />
        <h2 className="text-2xl font-bold dark:text-white">Water Intake</h2>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-semibold dark:text-gray-300">
            {(waterIntake / 1000).toFixed(1)}L / {(goal / 1000)}L
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{Math.round(percentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              percentage >= 100 ? 'bg-cyan-500' : 'bg-blue-400'
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>

      {/* Quick add buttons */}
      <div className="flex gap-2 flex-wrap">
        {waterOptions.map(option => (
          <button
            key={option.amount}
            onClick={() => handleAddWater(option.amount)}
            className="flex-1 min-w-24 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            +{option.label}
          </button>
        ))}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-200 text-sm">
        <p>💧 Tip: Drink water regularly throughout the day to stay hydrated!</p>
      </div>
    </div>
  );
}
