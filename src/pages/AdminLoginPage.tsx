import { FormEvent, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { CardShell } from '../components/CardShell';
import { adminLogin } from '../services/admin';

interface AdminLoginPageProps {
  onSuccess: (token: string) => void;
  onBack: () => void;
}

export const AdminLoginPage = ({ onSuccess, onBack }: AdminLoginPageProps) => {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { token } = await adminLogin({ adminId, password });
      onSuccess(token);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CardShell className="mx-auto w-full max-w-md border-orange-300/35 bg-gradient-to-br from-[#17100c] via-[#101010] to-[#1d1309]">
      <div className="mb-5 space-y-3">
        <span className="inline-flex rounded-2xl border border-orange-300/35 bg-orange-500/15 p-3 text-orange-100">
          <ShieldCheck size={20} />
        </span>
        <h1 className="text-2xl font-semibold text-orange-50">Admin Login</h1>
        <p className="text-sm text-orange-100/75">
          Secure access for analytics and user management.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-orange-100">Admin ID</span>
          <input
            required
            value={adminId}
            onChange={(event) => setAdminId(event.target.value)}
            className="w-full rounded-2xl border border-orange-300/30 bg-[#1d140f] px-4 py-3 text-orange-50 outline-none focus:border-orange-400"
            placeholder="admin"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-orange-100">Password</span>
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-orange-300/30 bg-[#1d140f] px-4 py-3 text-orange-50 outline-none focus:border-orange-400"
            placeholder="••••••••"
          />
        </label>

        {error ? (
          <p className="rounded-2xl border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
        >
          <Lock size={16} />
          {loading ? 'Signing in...' : 'Sign in as Admin'}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 w-full rounded-2xl border border-orange-300/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/20"
      >
        Back to User Login
      </button>
    </CardShell>
  );
};
