import React, { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { dailyLogAPI } from '../services/api';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('weekly');

  useEffect(() => {
    const fetchAnalytics = async () => {
      const endDate = new Date();
      const startDate = new Date();

      if (timeRange === 'weekly') {
        startDate.setDate(endDate.getDate() - 7);
      } else if (timeRange === 'monthly') {
        startDate.setMonth(endDate.getMonth() - 1);
      }

      try {
        const response = await dailyLogAPI.getAnalytics(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );
        setData(response.data.analytics);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  if (loading) return <div className="text-center py-8">Loading analytics...</div>;

  const chartData = data?.logs?.map(log => ({
    date: new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    studyHours: log.studyHours?.totalHours || 0,
    waterIntake: (log.waterIntake?.actual || 0) / 1000,
    wakeUpOnTime: log.wakeUpTime?.status === 'on-time' ? 1 : 0
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-indigo-600" />
          <h1 className="text-3xl font-bold dark:text-white">Analytics</h1>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-semibold mb-2">DAYS TRACKED</p>
          <p className="text-3xl font-bold dark:text-white">{data?.totalDays || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-semibold mb-2">ON-TIME WAKE UPS</p>
          <p className="text-3xl font-bold dark:text-white">{data?.wakeUpOnTime || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-semibold mb-2">AVG STUDY HOURS</p>
          <p className="text-3xl font-bold dark:text-white">{data?.averageStudyHours?.toFixed(1) || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-semibold mb-2">HABIT STREAK</p>
          <p className="text-3xl font-bold dark:text-white">{data?.habitStreak || 0} days</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Study Hours Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4 dark:text-white">Study Hours</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="studyHours" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
          )}
        </div>

        {/* Water Intake Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4 dark:text-white">Water Intake (Liters)</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="waterIntake" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
