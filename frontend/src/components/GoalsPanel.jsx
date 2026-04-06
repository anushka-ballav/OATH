import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { goalsAPI } from '../services/api';

export default function GoalsPanel({ goals, onGoalsChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'daily',
    category: 'personal',
    priority: 'medium'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await goalsAPI.updateGoal(editingId, formData);
      } else {
        await goalsAPI.createGoal(formData);
      }
      setFormData({ title: '', description: '', type: 'daily', category: 'personal', priority: 'medium' });
      setEditingId(null);
      setShowForm(false);
      onGoalsChange();
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const handleEdit = (goal) => {
    setFormData(goal);
    setEditingId(goal._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this goal?')) {
      try {
        await goalsAPI.deleteGoal(id);
        onGoalsChange();
      } catch (error) {
        console.error('Error deleting goal:', error);
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold dark:text-white">Custom Goals</h3>
        <button
          onClick={() => {
            setFormData({ title: '', description: '', type: 'daily', category: 'personal', priority: 'medium' });
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Goal title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            rows="2"
          ></textarea>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            >
              <option>health</option>
              <option>study</option>
              <option>habit</option>
              <option>fitness</option>
              <option>personal</option>
            </select>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            >
              <option>low</option>
              <option>medium</option>
              <option>high</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </form>
      )}

      {/* Goals list */}
      <div className="space-y-2">
        {goals && goals.length > 0 ? (
          goals.map(goal => (
            <div
              key={goal._id}
              className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <div className="flex-1">
                <h4 className="font-semibold dark:text-white">{goal.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {goal.category} • {goal.priority} priority
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(goal)}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-600 rounded transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(goal._id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-gray-600 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">No custom goals yet</p>
        )}
      </div>
    </div>
  );
}
