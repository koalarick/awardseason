import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { getApiErrorMessage } from '../utils/apiErrors';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Missing reset token. Please request a new link.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) ?? 'Unable to reset password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-start gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src="/images/awardseason_logo_assets/awardseason_topnav_256.png" alt="Award Season" className="h-12 w-12 sm:h-14 sm:w-14 object-contain" />
            <span className="hidden sm:inline oscars-font text-lg sm:text-xl font-bold">
              AWARD SEASON
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
            <h1 className="oscars-font text-base sm:text-lg font-bold">Choose a new password</h1>
          </div>
          <div className="px-4 sm:px-6 py-6">
            {success ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded">
                  Your password has been updated. Redirecting to login...
                </div>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-md oscars-gold-bg text-white text-sm font-medium"
                >
                  Go to login
                </Link>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded">
                    {error}
                  </div>
                )}
                {!token && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-4 py-3 rounded">
                    This link is missing a reset token. Request a new password reset email.
                  </div>
                )}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium oscars-dark mb-2">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium oscars-dark mb-2"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!token}
                  className="w-full flex justify-center py-2.5 px-4 min-h-[44px] border border-transparent rounded-md shadow-sm text-sm sm:text-base font-medium text-white oscars-gold-bg hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-opacity disabled:opacity-60"
                >
                  Update password
                </button>
                <div className="text-center">
                  <Link to="/login" className="text-sm oscars-red-text hover:underline">
                    Back to login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
