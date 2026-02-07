import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import SuperuserEventsPreview from '../components/superuser/SuperuserEventsPreview';
import SuperuserMetricsChart from '../components/superuser/SuperuserMetricsChart';
import SuperuserTestEmailForm from '../components/superuser/SuperuserTestEmailForm';
import SuperuserOtherPoolsList from '../components/superuser/SuperuserOtherPoolsList';
import SuperuserUsersPreview from '../components/superuser/SuperuserUsersPreview';

type PoolStats = {
  totalUsers?: number;
  totalPools?: number;
};

type ToolCardProps = {
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
};

const ToolCard = ({ title, description, cta, onClick }: ToolCardProps) => (
  <div className="border border-gray-200 rounded-lg p-4 bg-white flex flex-col gap-3">
    <div>
      <h3 className="text-sm font-semibold oscars-dark">{title}</h3>
      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{description}</p>
    </div>
    <button
      onClick={onClick}
      className="w-full px-3 py-2 min-h-[36px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 active:bg-gray-300 transition-colors text-xs font-semibold"
    >
      {cta}
    </button>
  </div>
);

export default function SuperuserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/');
    }
  }, [user, navigate]);

  const { data: globalStats, isLoading: isLoadingStats } = useQuery<PoolStats>({
    queryKey: ['global-stats'],
    queryFn: async () => {
      const response = await api.get('/pools/stats');
      return response.data as PoolStats;
    },
    enabled: user?.role === 'SUPERUSER',
  });

  if (user?.role !== 'SUPERUSER') {
    return null;
  }

  const toolCards: ToolCardProps[] = [
    {
      title: 'Global Winners',
      description: 'Lock in ceremony winners to score every pool.',
      cta: 'Open Winners',
      onClick: () => navigate('/winners/global'),
    },
    {
      title: 'Nominee Metadata',
      description: 'Update nominee blurbs, IMDb links, and metadata details.',
      cta: 'Edit Metadata',
      onClick: () => navigate('/nominees/metadata'),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
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
            <span className="hidden sm:inline oscars-font text-lg sm:text-xl font-bold">
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

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">
                  Superuser Toolbox
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  {toolCards.map((tool) => (
                    <ToolCard key={tool.title} {...tool} />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="oscars-font text-base sm:text-lg font-bold">Users Snapshot</h2>
                  <p className="text-xs sm:text-sm text-white/70">
                    10 most recent signups and role mix.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/users')}
                  className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white/10 border border-white/20 rounded hover:bg-white/20 active:bg-white/30 transition-colors"
                >
                  View All
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <SuperuserUsersPreview />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="oscars-font text-base sm:text-lg font-bold">Events Snapshot</h2>
                  <p className="text-xs sm:text-sm text-white/70">
                    10 most recent events (excluding superusers).
                  </p>
                </div>
                <button
                  onClick={() => navigate('/events')}
                  className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white/10 border border-white/20 rounded hover:bg-white/20 active:bg-white/30 transition-colors"
                >
                  View All
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <SuperuserEventsPreview />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="oscars-font text-base sm:text-lg font-bold">All Pools</h2>
                  <p className="text-xs sm:text-sm text-white/70">
                    10 most recently created pools.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/superuser/tools/pools-not-in')}
                  className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white/10 border border-white/20 rounded hover:bg-white/20 active:bg-white/30 transition-colors"
                >
                  View All
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <SuperuserOtherPoolsList limit={10} scrollable={false} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">Overview</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide">
                      Total Users
                    </p>
                    <p className="font-bold text-sm sm:text-base oscars-dark">
                      {isLoadingStats ? '...' : (globalStats?.totalUsers ?? '-')}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide">
                      Total Pools
                    </p>
                    <p className="font-bold text-sm sm:text-base oscars-dark">
                      {isLoadingStats ? '...' : (globalStats?.totalPools ?? '-')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">Metrics</h2>
              </div>
              <div className="p-4 sm:p-6">
                <SuperuserMetricsChart />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">Test Email</h2>
                <button
                  onClick={() => navigate('/superuser/tools/test-email')}
                  className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white/10 border border-white/20 rounded hover:bg-white/20 active:bg-white/30 transition-colors"
                >
                  Open Full Page
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <SuperuserTestEmailForm />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
