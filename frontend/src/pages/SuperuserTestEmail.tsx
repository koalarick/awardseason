import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SuperuserTestEmailForm from '../components/superuser/SuperuserTestEmailForm';
import { useSmartBack } from '../hooks/useSmartBack';

export default function SuperuserTestEmail() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const goBack = useSmartBack({ fallback: '/superuser' });

  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/');
    }
  }, [user, navigate]);

  if (user?.role !== 'SUPERUSER') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={goBack}
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

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-90 transition-opacity touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
            aria-label="Go to home"
          >
            <img
              src="/images/awardseason_logo_assets/awardseason_topnav_256.png"
              alt="Award Season"
              className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
            />
            <span className="oscars-font text-[0.9rem] sm:text-xl font-medium sm:font-bold text-white/80 sm:text-white whitespace-nowrap">
              AWARD SEASON
            </span>
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="hidden sm:inline text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="flex items-center justify-center px-4 py-2 min-h-[44px] text-white border-2 border-white/30 hover:border-white/50 hover:bg-white/10 active:bg-white/20 rounded-lg transition-all text-sm font-medium touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900"
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="oscars-font text-base sm:text-lg font-bold">Test Email</h2>
              <p className="text-xs sm:text-sm text-white/70">
                Send a live transactional email to verify delivery.
              </p>
            </div>
            <button
              onClick={() => navigate('/superuser')}
              className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white/10 border border-white/20 rounded hover:bg-white/20 active:bg-white/30 transition-colors"
            >
              Superuser Dashboard
            </button>
          </div>
          <div className="p-4 sm:p-6">
            <SuperuserTestEmailForm />
          </div>
        </div>
      </main>
    </div>
  );
}
