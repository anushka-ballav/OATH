import { GymPlan, UserProfile } from '../types';

export interface AdminUserListItem {
  userId: string;
  name: string;
  email: string;
  lastActive: string | null;
  streak: number;
  bmi: number | null;
  disciplineScore: number;
  gymModeEnabled: boolean;
  gymPlan: GymPlan | null;
}

export interface AdminUserDetails {
  userId: string;
  profile: UserProfile | null;
  tasks: unknown[];
  logs: unknown[];
  bmiHistory: unknown[];
  gymPlan: GymPlan | null;
}

const safeJson = async <T,>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const withAdminHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export const adminLogin = async ({
  adminId,
  password,
}: {
  adminId: string;
  password: string;
}): Promise<{ token: string }> => {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId, password }),
  });

  const payload = await safeJson<{ token?: string; message?: string }>(response);

  if (!response.ok || !payload?.token) {
    throw new Error(payload?.message || 'Invalid admin credentials.');
  }

  return { token: payload.token };
};

export const fetchAdminUsers = async (token: string): Promise<{
  users: AdminUserListItem[];
  summary: {
    totalUsers: number;
    activeUsersToday: number;
    averageDisciplineScore: number;
  };
}> => {
  const response = await fetch('/api/admin/users', {
    method: 'GET',
    headers: withAdminHeaders(token),
  });

  const payload = await safeJson<{
    message?: string;
    users?: AdminUserListItem[];
    summary?: {
      totalUsers: number;
      activeUsersToday: number;
      averageDisciplineScore: number;
    };
  }>(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to load admin users.');
  }

  return {
    users: Array.isArray(payload?.users) ? payload.users : [],
    summary: payload?.summary ?? {
      totalUsers: 0,
      activeUsersToday: 0,
      averageDisciplineScore: 0,
    },
  };
};

export const fetchAdminUserDetails = async (token: string, userId: string): Promise<AdminUserDetails> => {
  const response = await fetch(`/api/admin/user/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: withAdminHeaders(token),
  });

  const payload = await safeJson<{ message?: string; user?: AdminUserDetails }>(response);

  if (!response.ok || !payload?.user) {
    throw new Error(payload?.message || 'Unable to load user details.');
  }

  return payload.user;
};

export const deleteAdminUser = async (token: string, userId: string): Promise<void> => {
  const response = await fetch(`/api/admin/user/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: withAdminHeaders(token),
  });

  const payload = await safeJson<{ message?: string }>(response);
  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to delete user.');
  }
};
