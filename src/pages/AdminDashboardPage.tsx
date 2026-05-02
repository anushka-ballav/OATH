import { useEffect, useMemo, useState } from 'react';
import { Eye, LogOut, Shield, Trash2, Users } from 'lucide-react';
import {
  AdminUserDetails,
  AdminUserListItem,
  deleteAdminUser,
  fetchAdminUserDetails,
  fetchAdminUsers,
} from '../services/admin';
import { CardShell } from '../components/CardShell';

interface AdminDashboardPageProps {
  token: string;
  onLogout: () => void;
}

export const AdminDashboardPage = ({ token, onLogout }: AdminDashboardPageProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsersToday: 0,
    averageDisciplineScore: 0,
  });
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteLoadingUserId, setDeleteLoadingUserId] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchAdminUsers(token);
      setUsers(payload.users);
      setSummary(payload.summary);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load admin data.';
      setError(message);
      if (/token|unauthorized|forbidden/i.test(message)) {
        onLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [token]);

  const averageStreak = useMemo(() => {
    if (!users.length) return 0;
    return Math.round(users.reduce((sum, user) => sum + (user.streak || 0), 0) / users.length);
  }, [users]);

  const handleView = async (userId: string) => {
    setDetailLoading(true);
    try {
      const details = await fetchAdminUserDetails(token, userId);
      setSelectedUser(details);
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : 'Unable to load user details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    const approved = window.confirm('Delete this user and related data?');
    if (!approved) return;
    setDeleteLoadingUserId(userId);
    try {
      await deleteAdminUser(token, userId);
      await loadUsers();
      if (selectedUser?.userId === userId) {
        setSelectedUser(null);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete user.');
    } finally {
      setDeleteLoadingUserId('');
    }
  };

  return (
    <div className="space-y-5 pb-16">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-orange-100/70">Secure Admin</p>
          <h1 className="mt-1 text-3xl font-semibold text-orange-50">Admin Dashboard</h1>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 rounded-2xl border border-orange-300/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/20"
        >
          <LogOut size={16} />
          Logout
        </button>
      </header>

      {error ? (
        <p className="rounded-2xl border border-rose-300/35 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardShell className="bg-[#140f0a]">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-100/70">Total Users</p>
          <p className="mt-2 text-3xl font-semibold text-orange-50">{summary.totalUsers}</p>
        </CardShell>
        <CardShell className="bg-[#140f0a]">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-100/70">Active Today</p>
          <p className="mt-2 text-3xl font-semibold text-orange-50">{summary.activeUsersToday}</p>
        </CardShell>
        <CardShell className="bg-[#140f0a]">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-100/70">Avg Discipline</p>
          <p className="mt-2 text-3xl font-semibold text-orange-50">{summary.averageDisciplineScore}</p>
        </CardShell>
        <CardShell className="bg-[#140f0a]">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-100/70">Avg Streak</p>
          <p className="mt-2 text-3xl font-semibold text-orange-50">{averageStreak}</p>
        </CardShell>
      </div>

      <CardShell className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={16} />
          <p className="text-sm uppercase tracking-[0.2em] text-black">Users</p>
        </div>
        {loading ? (
          <p className="text-sm text-black/70 dark:text-orange-100/70">Loading users...</p>
        ) : users.length ? (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.userId}
                className="soft-surface flex flex-col gap-2 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-black">{user.name || 'Unnamed User'}</p>
                  <p className="truncate text-xs text-black/70 dark:text-orange-100/70">{user.email}</p>
                  <p className="mt-1 text-xs text-black/70 dark:text-orange-100/70">
                    Last active: {user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Unknown'} •
                    Streak: {user.streak} • BMI: {user.bmi ?? '--'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleView(user.userId)}
                    disabled={detailLoading}
                    className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-100 px-3 py-2 text-xs font-semibold text-black transition hover:bg-blue-200 disabled:opacity-60 dark:border-orange-300/30 dark:bg-orange-500/20 dark:text-orange-50 dark:hover:bg-orange-500/30"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(user.userId)}
                    disabled={deleteLoadingUserId === user.userId}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                    {deleteLoadingUserId === user.userId ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/70 dark:text-orange-100/70">No users found.</p>
        )}
      </CardShell>

      {selectedUser ? (
        <CardShell className="space-y-3 border-orange-300/35 bg-[#140f0a]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-orange-100/70">User Details</p>
              <h3 className="mt-1 text-xl font-semibold text-orange-50">
                {selectedUser.profile?.name || selectedUser.userId}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="rounded-xl border border-orange-300/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 transition hover:bg-orange-500/20"
            >
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-orange-300/25 bg-orange-500/10 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-orange-100/70">Tasks</p>
              <p className="mt-1 text-2xl font-semibold text-orange-50">{selectedUser.tasks.length}</p>
            </div>
            <div className="rounded-2xl border border-orange-300/25 bg-orange-500/10 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-orange-100/70">Logs</p>
              <p className="mt-1 text-2xl font-semibold text-orange-50">{selectedUser.logs.length}</p>
            </div>
            <div className="rounded-2xl border border-orange-300/25 bg-orange-500/10 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-orange-100/70">BMI Entries</p>
              <p className="mt-1 text-2xl font-semibold text-orange-50">{selectedUser.bmiHistory.length}</p>
            </div>
            <div className="rounded-2xl border border-orange-300/25 bg-orange-500/10 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-orange-100/70">Gym Mode</p>
              <p className="mt-1 text-lg font-semibold text-orange-50">
                {selectedUser.gymPlan ? 'Enabled' : 'Off'}
              </p>
            </div>
          </div>
        </CardShell>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-orange-100/70">
        <Shield size={14} />
        Admin APIs are token-protected and require valid admin credentials.
      </div>
    </div>
  );
};
