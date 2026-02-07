import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

type SuperuserMetrics = {
  inviteLoginViewers: number;
  totalUsers: number;
  usersWithPredictions: number;
  usersWithChecklistUpdate: number;
  usersCreatedPool: number;
  usersSentInvite: number;
};

export default function Metrics() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/');
    }
  }, [user, navigate]);

  const {
    data: metrics,
    isLoading,
    isError,
  } = useQuery<SuperuserMetrics>({
    queryKey: ['superuser-metrics'],
    queryFn: async () => {
      const response = await api.get('/events/metrics');
      return response.data as SuperuserMetrics;
    },
    enabled: user?.role === 'SUPERUSER',
  });

  const metricsBars = useMemo(
    () => [
      {
        key: 'inviteLoginViewers',
        label: 'Visitors',
        value: metrics?.inviteLoginViewers ?? 0,
      },
      {
        key: 'totalUsers',
        label: 'Users',
        value: metrics?.totalUsers ?? 0,
      },
      {
        key: 'usersWithPredictions',
        label: 'Predictors',
        value: metrics?.usersWithPredictions ?? 0,
      },
      {
        key: 'usersWithChecklistUpdate',
        label: 'Checklisters',
        value: metrics?.usersWithChecklistUpdate ?? 0,
      },
      {
        key: 'usersCreatedPool',
        label: 'Pool Owners',
        value: metrics?.usersCreatedPool ?? 0,
      },
      {
        key: 'usersSentInvite',
        label: 'Inviters',
        value: metrics?.usersSentInvite ?? 0,
      },
    ],
    [metrics],
  );

  const metricsMax = useMemo(
    () => Math.max(1, ...metricsBars.map((entry) => entry.value)),
    [metricsBars],
  );

  if (user?.role !== 'SUPERUSER') {
    return null;
  }

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

          <button
            onClick={logout}
            className="flex items-center justify-center px-4 py-2 min-h-[44px] text-white border-2 border-white/30 hover:border-white/50 hover:bg-white/10 active:bg-white/20 rounded-lg transition-all text-sm font-medium touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
            <h2 className="oscars-font text-base sm:text-lg font-bold">Metrics</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {isError && (
              <p className="text-sm text-red-600">Failed to load metrics.</p>
            )}

            <div className="border border-slate-200 rounded-lg bg-slate-50 px-3 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                  User Funnel
                </h3>
                {isLoading && (
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                    Loading...
                  </span>
                )}
              </div>
              <div className="grid grid-cols-6 gap-2 h-48 items-end">
                {metricsBars.map((entry) => {
                  const ratio = entry.value / metricsMax;
                  const height = isLoading
                    ? 60
                    : entry.value > 0
                      ? Math.max(6, Math.round(ratio * 100))
                      : 0;
                  const barClass = isLoading
                    ? 'bg-slate-200 animate-pulse'
                    : 'bg-gradient-to-t from-amber-500 to-yellow-400';

                  return (
                    <div key={entry.key} className="flex flex-col items-center justify-end h-full">
                      <div className="text-[11px] font-semibold text-slate-700 mb-1">
                        {isLoading ? '...' : entry.value.toLocaleString()}
                      </div>
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={`w-full rounded-md ${barClass}`}
                          style={{ height: `${height}%` }}
                          aria-label={`${entry.label}: ${entry.value}`}
                        />
                      </div>
                      <div className="mt-2 text-[10px] text-center text-slate-600 leading-tight">
                        {entry.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
