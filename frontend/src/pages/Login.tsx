import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header matching Dashboard style */}
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-start gap-3">
          {/* Logo - Left aligned */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src="/images/awardseason_logo_assets/awardseason_topnav_256.png" alt="Award Season" className="h-12 w-12 sm:h-14 sm:w-14 object-contain" />
            <span className="hidden sm:inline oscars-font text-lg sm:text-xl font-bold">
              AWARD SEASON
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-5xl grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
          {/* Value Proposition */}
          <div className="space-y-6 order-2 lg:order-1">
            <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-6 shadow">
              <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-amber-200/30 blur-2xl" />
              <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-rose-200/30 blur-2xl" />
              <div className="relative">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-700/80">
                  Oscars Night, Elevated
                </p>
                <h1 className="oscars-font text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                  Turn predictions into a real competition.
                </h1>
                <p className="text-sm sm:text-base text-slate-700 mt-3 max-w-xl">
                  Make picks, watch the ceremony, and see the leaderboard update as winners are
                  announced. Build private pools for friends or run a paid bracket with custom
                  payouts.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-white/70 text-xs font-semibold text-slate-700 border border-slate-200">
                    Private pools
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/70 text-xs font-semibold text-slate-700 border border-slate-200">
                    Live scoring
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/70 text-xs font-semibold text-slate-700 border border-slate-200">
                    Odds multipliers
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/70 text-xs font-semibold text-slate-700 border border-slate-200">
                    Custom payouts
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">Why People Sign Up</h2>
              </div>
              <div className="px-4 sm:px-6 py-6">
                <ul className="space-y-4 text-sm text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="text-yellow-600 font-bold mt-0.5">◆</span>
                    <span>
                      <strong className="oscars-dark">Bragging rights, guaranteed.</strong> Your
                      leaderboard updates as winners are announced.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-yellow-600 font-bold mt-0.5">◆</span>
                    <span>
                      <strong className="oscars-dark">No spreadsheets.</strong> Invite friends,
                      track picks, and score automatically.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-yellow-600 font-bold mt-0.5">◆</span>
                    <span>
                      <strong className="oscars-dark">Flexible pools.</strong> Free, paid, casual,
                      or competitive — you decide.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">How It Works</h2>
              </div>
              <div className="px-4 sm:px-6 py-6">
                <div className="grid gap-4 sm:grid-cols-3 text-sm text-gray-700">
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Step 1</div>
                    <div className="font-semibold oscars-dark mt-1">Create a pool</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Private link for friends, or go public.
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Step 2</div>
                    <div className="font-semibold oscars-dark mt-1">Make picks</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Choose winners across every category.
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Step 3</div>
                    <div className="font-semibold oscars-dark mt-1">Watch & win</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Scores update as the show unfolds.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Login and Registration */}
          <div className="space-y-6 order-1 lg:order-2">
            {/* Login Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">Log in or Sign up</h2>
              </div>
              <div className="px-4 sm:px-6 py-6">
                <form className="space-y-6" onSubmit={handleSubmit}>
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
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
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium oscars-dark mb-2"
                    >
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
                    <div className="mt-2 text-right">
                      <Link to="/forgot-password" className="text-sm oscars-red-text hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-2.5 px-4 min-h-[44px] border border-transparent rounded-md shadow-sm text-sm sm:text-base font-medium text-white oscars-gold-bg hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-opacity touch-manipulation"
                  >
                    Sign In
                  </button>
                  <div className="pt-4 border-t border-gray-200">
                    <Link
                      to="/register"
                      className="w-full flex justify-center py-2.5 px-4 min-h-[44px] oscars-dark border-2 border-yellow-400 rounded-md hover:bg-yellow-50 active:bg-yellow-100 transition-colors text-sm sm:text-base font-medium touch-manipulation"
                    >
                      Create New Account
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
