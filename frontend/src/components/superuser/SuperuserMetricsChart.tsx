import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

type SuperuserMetrics = {
  inviteLoginViewers: number;
  totalUsers: number;
  usersWithPredictions: number;
  usersWithChecklistUpdate: number;
  usersCreatedPool: number;
  usersSentInvite: number;
};

export default function SuperuserMetricsChart() {
  const { user } = useAuth();

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

  return (
    <div className="space-y-3">
      {isError && <p className="text-sm text-red-600">Failed to load metrics.</p>}

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
        <div className="space-y-2">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 h-40 sm:h-48 items-end">
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
                  <div className="text-[11px] font-semibold text-slate-700 mb-1 h-4">
                    {isLoading ? '...' : entry.value.toLocaleString()}
                  </div>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-md ${barClass}`}
                      style={{ height: `${height}%` }}
                      aria-label={`${entry.label}: ${entry.value}`}
                    />
                  </div>
                  <div className="mt-1 h-8 text-[10px] text-center text-slate-600 leading-tight flex items-start justify-center sm:hidden">
                    {entry.label}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden sm:grid grid-cols-6 gap-2">
            {metricsBars.map((entry) => (
              <div
                key={`${entry.key}-label`}
                className="h-8 text-[10px] text-center text-slate-600 leading-tight flex items-start justify-center"
              >
                {entry.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
