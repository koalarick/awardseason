import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

type UserSummary = {
  id: string;
  email: string;
  role: string;
  oauthProvider?: string | null;
  createdAt: string;
  _count: {
    ownedPools: number;
    poolMemberships: number;
    predictions: number;
  };
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

export default function SuperuserUsersPreview() {
  const { user } = useAuth();

  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data as UserSummary[];
    },
    enabled: user?.role === 'SUPERUSER',
  });

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const superuserCount = users.filter((entry) => entry.role === 'SUPERUSER').length;
    const oauthUsers = users.filter((entry) => entry.oauthProvider).length;
    return { totalUsers, superuserCount, oauthUsers };
  }, [users]);

  const recentUsers = useMemo(
    () =>
      [...users]
        .sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          const safeATime = Number.isNaN(aTime) ? 0 : aTime;
          const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
          return safeBTime - safeATime;
        })
        .slice(0, 10),
    [users],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Users</p>
          <p className="text-lg font-bold oscars-dark">{stats.totalUsers}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Superusers</p>
          <p className="text-lg font-bold oscars-dark">{stats.superuserCount}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">OAuth Users</p>
          <p className="text-lg font-bold oscars-dark">{stats.oauthUsers}</p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-600">Loading users...</p>}
      {isError && <p className="text-sm text-red-600">Failed to load users.</p>}

      {!isLoading && !isError && users.length === 0 && (
        <p className="text-sm text-gray-600">No users yet.</p>
      )}

      {!isLoading && !isError && users.length > 0 && (
        <div className="space-y-2">
          {recentUsers.map((entry) => (
            <div
              key={entry.id}
              className="border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold oscars-dark truncate">{entry.email}</p>
                <p className="text-xs text-gray-500">Joined {formatDate(entry.createdAt)}</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {entry.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
