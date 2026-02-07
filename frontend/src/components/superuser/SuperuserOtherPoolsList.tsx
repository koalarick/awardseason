import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import type { Pool } from '../../types/pool';

type SuperuserOtherPoolsListProps = {
  limit?: number;
  scrollable?: boolean;
};

export default function SuperuserOtherPoolsList({
  limit,
  scrollable = true,
}: SuperuserOtherPoolsListProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    data: allPools = [],
    isLoading: isLoadingAllPools,
    isError,
  } = useQuery<Pool[]>({
    queryKey: ['pools-all'],
    queryFn: async () => {
      const response = await api.get('/pools/all');
      return response.data as Pool[];
    },
    enabled: user?.role === 'SUPERUSER',
  });

  const sortedPools = useMemo(() => {
    const getTime = (value?: string) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };
    const poolsCopy = [...allPools];
    poolsCopy.sort((a, b) => {
      const aTime = getTime(a.createdAt);
      const bTime = getTime(b.createdAt);
      return bTime - aTime;
    });
    return poolsCopy;
  }, [allPools]);

  const visiblePools = useMemo(
    () => (limit ? sortedPools.slice(0, limit) : sortedPools),
    [limit, sortedPools],
  );

  if (isLoadingAllPools) {
    return <p className="text-sm text-gray-600">Loading pools...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-600">Failed to load pools.</p>;
  }

  if (visiblePools.length === 0) {
    return <p className="text-sm text-gray-600">No pools found.</p>;
  }

  const listClassName = scrollable
    ? 'space-y-2 max-h-[360px] overflow-y-auto'
    : 'space-y-2';

  return (
    <div className={listClassName}>
      {visiblePools.map((pool) => (
        <div key={pool.id} className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm oscars-dark whitespace-normal break-words">
                {pool.name}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                <span>ID: {pool.id}</span>
                <span>•</span>
                <span>{pool._count?.members || 0} members</span>
                {pool.owner?.email && (
                  <>
                    <span>•</span>
                    <span>Owner: {pool.owner.email}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {pool.isPaidPool && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/30 text-yellow-700 rounded uppercase tracking-wide border border-yellow-400/30">
                  $
                </span>
              )}
              {pool.isPublic ? (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/30 text-green-700 rounded uppercase tracking-wide border border-green-400/30">
                  Public
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-700 rounded uppercase tracking-wide border border-gray-300">
                  Private
                </span>
              )}
              <button
                onClick={() => navigate(`/pool/${pool.id}`)}
                className="px-2.5 py-1.5 min-h-[32px] text-[11px] font-semibold bg-slate-800 text-white rounded hover:bg-slate-700 active:bg-slate-900 transition-colors whitespace-nowrap"
              >
                View
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
