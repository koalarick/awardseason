import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to send reset email');
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
            <h1 className="oscars-font text-base sm:text-lg font-bold">Reset your password</h1>
          </div>
          <div className="px-4 sm:px-6 py-6">
            {sent ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded">
                  If an account exists for {email}, a reset link has been sent.
                </div>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-md oscars-gold-bg text-white text-sm font-medium"
                >
                  Back to login
                </Link>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded">
                    {error}
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  Enter your email and we will send a link to reset your password.
                </p>
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
                <button
                  type="submit"
                  className="w-full flex justify-center py-2.5 px-4 min-h-[44px] border border-transparent rounded-md shadow-sm text-sm sm:text-base font-medium text-white oscars-gold-bg hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-opacity"
                >
                  Send reset link
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
