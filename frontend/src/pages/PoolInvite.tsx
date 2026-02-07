import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import UnauthMarketing from '../components/UnauthMarketing';
import type { Pool } from '../types/pool';
import { getApiErrorMessage } from '../utils/apiErrors';

export default function PoolInvite() {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const { user, login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [poolPassword, setPoolPassword] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Fetch pool info (public endpoint)
  const {
    data: pool,
    isLoading: poolLoading,
    error: poolError,
  } = useQuery<Pool>({
    queryKey: ['pool-info', poolId],
    queryFn: async () => {
      const response = await api.get(`/pools/${poolId}/info`);
      return response.data as Pool;
    },
    enabled: !!poolId,
  });

  // Check if user is already authenticated and join automatically
  // Only auto-join if user just logged in/registered (not if they were already logged in)
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);

  useEffect(() => {
    // If user is authenticated, pool is loaded, and we haven't attempted join yet
    if (user && pool && !isJoining && !hasAttemptedJoin && poolId) {
      // For private pools, wait for password to be entered
      if (!pool.isPublic && !poolPassword) {
        return; // Don't auto-join yet, wait for password
      }
      handleAutoJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pool, poolId, poolPassword]);

  const handleAutoJoin = async () => {
    if (!poolId || !user || hasAttemptedJoin) return;

    setHasAttemptedJoin(true);
    setIsJoining(true);
    try {
      await api.post(`/pools/${poolId}/join`, {
        password: !pool?.isPublic ? poolPassword : undefined,
      });
      // Successfully joined, redirect to pool page
      navigate(`/pool/${poolId}`);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err);
      // If already a member, just redirect
      if (message?.includes('Already a member')) {
        navigate(`/pool/${poolId}`);
      } else if (message?.includes('Password required') || message?.includes('Invalid password')) {
        // Password needed or wrong, stay on page
        setError(message ?? 'Failed to join pool');
        setIsJoining(false);
        setHasAttemptedJoin(false); // Allow retry
      } else {
        setError(message ?? 'Failed to join pool');
        setIsJoining(false);
        setHasAttemptedJoin(false); // Allow retry
      }
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!poolPassword && !pool?.isPublic) {
      setError('Password is required for this pool');
      return;
    }

    try {
      await login(email, password);
      // Auto-join will happen in useEffect after user state updates
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) ?? 'Login failed');
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!poolPassword && !pool?.isPublic) {
      setError('Pool password is required');
      return;
    }

    try {
      await register(email, password);
      // Auto-join will happen in useEffect after user state updates
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) ?? 'Registration failed');
    }
  };

  if (poolLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading pool information...</div>
      </div>
    );
  }

  if (poolError || !pool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Pool not found</p>
          <Link to="/login" className="text-yellow-600 hover:underline">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Back Button - Left side */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 text-white hover:text-yellow-300 hover:bg-white/10 active:bg-white/20 rounded-full transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Go back"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Logo - Right of back button */}
          <Link
            to="/login"
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-90 transition-opacity touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
            aria-label="Go to home"
          >
            <img src="/images/awardseason_logo_assets/awardseason_topnav_256.png" alt="Award Season" className="h-12 w-12 sm:h-14 sm:w-14 object-contain" />
            <span className="hidden sm:inline oscars-font text-lg sm:text-xl font-bold">
              AWARD SEASON
            </span>
          </Link>

          {/* Spacer */}
          <div className="flex-1" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-5xl grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
          <div className="space-y-6 order-2 lg:order-1">
            <UnauthMarketing />
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            {/* Mobile reassurance card */}
            <div className="lg:hidden bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-3">
                <h2 className="oscars-font text-sm font-bold">Quick reassurance</h2>
              </div>
              <div className="px-4 py-4 text-sm text-gray-700 space-y-2">
                <p className="font-semibold oscars-dark">
                  Joining takes under a minute — no setup needed.
                </p>
                <ul className="space-y-1">
                  <li>Pick winners, watch the show, see live scores.</li>
                  <li>Private pools stay private. Invite-only access.</li>
                </ul>
              </div>
            </div>

            {/* Pool Info Card */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-sm sm:text-base font-bold">You've been invited!</h2>
              </div>
              <div className="px-4 sm:px-6 py-4">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Pool Name</p>
                    <p className="text-base sm:text-lg font-bold oscars-dark">{pool.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Members</p>
                      <p className="font-semibold oscars-dark">{pool._count?.members || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Type</p>
                      <p className="font-semibold oscars-dark">
                        {pool.isPublic ? 'Public' : 'Private'}
                      </p>
                    </div>
                  </div>
                  {pool.isPaidPool && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                      <p className="text-xs font-semibold text-yellow-900">💰 Paid Pool</p>
                      <p className="text-xs text-yellow-800 mt-1">
                        Entry fee: ${pool.entryAmount?.toFixed(2)} • Payment handled outside this
                        platform
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Auth Form */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setIsLogin(true);
                      setError('');
                    }}
                    className={`px-4 py-2 rounded transition-colors ${
                      isLogin ? 'bg-yellow-600 text-white' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setIsLogin(false);
                      setError('');
                    }}
                    className={`px-4 py-2 rounded transition-colors ${
                      !isLogin ? 'bg-yellow-600 text-white' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>
              <div className="px-4 sm:px-6 py-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}

                {isJoining && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-600 text-sm px-4 py-3 rounded mb-4">
                    Joining pool...
                  </div>
                )}

                {/* Pool Password (if private) */}
                {!pool.isPublic && (
                  <div className="mb-4">
                    <label
                      htmlFor="poolPassword"
                      className="block text-sm font-medium oscars-dark mb-2"
                    >
                      Pool Password *
                    </label>
                    <input
                      id="poolPassword"
                      type="password"
                      required
                      value={poolPassword}
                      onChange={(e) => setPoolPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                      placeholder="Enter pool password"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The person who invited you should have shared this password with you.
                    </p>
                  </div>
                )}

                {isLogin ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium oscars-dark mb-2">
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium oscars-dark mb-2">
                        Password
                      </label>
                      <input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isJoining}
                      className="w-full flex justify-center py-2.5 px-4 min-h-[44px] border border-transparent rounded-md shadow-sm text-sm sm:text-base font-medium text-white oscars-gold-bg hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-opacity touch-manipulation disabled:opacity-50"
                    >
                      {isJoining ? 'Joining...' : 'Sign In & Join Pool'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label htmlFor="reg-email" className="block text-sm font-medium oscars-dark mb-2">
                        Email
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="reg-password"
                        className="block text-sm font-medium oscars-dark mb-2"
                      >
                        Password
                      </label>
                      <input
                        id="reg-password"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                      />
                      <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
                    </div>
                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="block text-sm font-medium oscars-dark mb-2"
                      >
                        Confirm Password
                      </label>
                      <input
                        id="confirm-password"
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
                      disabled={isJoining}
                      className="w-full flex justify-center py-2.5 px-4 min-h-[44px] border border-transparent rounded-md shadow-sm text-sm sm:text-base font-medium text-white oscars-gold-bg hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-opacity touch-manipulation disabled:opacity-50"
                    >
                      {isJoining ? 'Joining...' : 'Create Account & Join Pool'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
