import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  signup: (email, password, name) => api.post('/auth/signup', { email, password, name }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me')
};

// Daily Log API
export const dailyLogAPI = {
  getDailyLog: (date) => api.get('/logs/log', { params: { date } }),
  updateWakeUpTime: (actualTime, date) => api.put('/logs/wake-up', { actualTime, date }),
  addWater: (amount, date) => api.post('/logs/water', { amount, date }),
  updateStudyHours: (session, hours, date) => api.put('/logs/study', { session, hours, date }),
  updateHabit: (habit, value, date) => api.put('/logs/habit', { habit, value, date }),
  getAnalytics: (startDate, endDate) => api.get('/logs/analytics', { params: { startDate, endDate } }),
  updateDailyLog: (data) => api.put('/logs/log', data)
};

// Goals API
export const goalsAPI = {
  createGoal: (goalData) => api.post('/goals', goalData),
  getGoals: () => api.get('/goals'),
  updateGoal: (id, updates) => api.put(`/goals/${id}`, updates),
  deleteGoal: (id) => api.delete(`/goals/${id}`)
};

export default api;
