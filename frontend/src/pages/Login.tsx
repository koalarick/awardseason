import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UnauthHero, UnauthHowItWorks } from '../components/UnauthMarketing';
import { getApiErrorMessage } from '../utils/apiErrors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) ?? 'Login failed');
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
            <span className="oscars-font text-[0.9rem] sm:text-xl font-medium sm:font-bold text-white/80 sm:text-white whitespace-nowrap">
              AWARD SEASON
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-5xl grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start lg:items-stretch">
          {/* Value Proposition */}
          <div className="space-y-6 order-1 lg:order-1 lg:col-start-1">
            <UnauthHero />
          </div>

          {/* Login and Registration */}
          <div className="space-y-6 order-2 lg:order-2 lg:col-start-2 lg:row-span-2 lg:flex lg:flex-col lg:h-full">
            {/* Login Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden lg:flex-1">
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

          <div className="space-y-6 order-3 lg:order-3 lg:col-start-1">
            <UnauthHowItWorks />
          </div>
        </div>
      </main>
    </div>
  );
}
