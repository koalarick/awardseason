import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Countdown component
function CountdownTimer({ ceremonyDate }: { ceremonyDate: Date | string }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Calculate lock time: 24 hours (1 day) before ceremony
  const lockTime = useMemo(() => {
    const ceremony = new Date(ceremonyDate);
    return new Date(ceremony.getTime() - 24 * 60 * 60 * 1000);
  }, [ceremonyDate]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const lock = lockTime.getTime();
      const difference = lock - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [lockTime]);

  const isLocked = new Date().getTime() >= lockTime.getTime();

  if (isLocked) {
    return (
      <div className="w-full bg-gradient-to-r from-yellow-50 to-yellow-100/60 border-b-2 border-yellow-600 py-2 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs sm:text-sm text-center oscars-red-text font-bold flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Ballots are now locked
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-r from-yellow-50 to-yellow-100/60 border-b-2 border-yellow-600 py-2 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 oscars-red-text"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="oscars-font text-xs sm:text-sm font-bold oscars-red-text">
              Ballots Lock In:
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {timeLeft.days > 0 && (
              <>
                <div className="bg-white/80 rounded px-2 py-1 border border-yellow-200 shadow-sm min-w-[50px] sm:min-w-[60px]">
                  <p className="text-[9px] sm:text-[10px] oscars-red-text/60 mb-0.5 uppercase tracking-wider font-semibold text-center">
                    Days
                  </p>
                  <p className="font-bold text-lg sm:text-xl oscars-red-text text-center leading-none">
                    {String(timeLeft.days).padStart(2, '0')}
                  </p>
                </div>
                <span className="oscars-red-text/40 text-lg sm:text-xl font-bold">:</span>
              </>
            )}
            <div className="bg-white/80 rounded px-2 py-1 border border-yellow-200 shadow-sm min-w-[50px] sm:min-w-[60px]">
              <p className="text-[9px] sm:text-[10px] oscars-red-text/60 mb-0.5 uppercase tracking-wider font-semibold text-center">
                Hours
              </p>
              <p className="font-bold text-lg sm:text-xl oscars-red-text text-center leading-none">
                {String(timeLeft.hours).padStart(2, '0')}
              </p>
            </div>
            <span className="oscars-red-text/40 text-lg sm:text-xl font-bold">:</span>
            <div className="bg-white/80 rounded px-2 py-1 border border-yellow-200 shadow-sm min-w-[50px] sm:min-w-[60px]">
              <p className="text-[9px] sm:text-[10px] oscars-red-text/60 mb-0.5 uppercase tracking-wider font-semibold text-center">
                Minutes
              </p>
              <p className="font-bold text-lg sm:text-xl oscars-red-text text-center leading-none">
                {String(timeLeft.minutes).padStart(2, '0')}
              </p>
            </div>
            <span className="oscars-red-text/40 text-lg sm:text-xl font-bold">:</span>
            <div className="bg-white/80 rounded px-2 py-1 border border-yellow-200 shadow-sm min-w-[50px] sm:min-w-[60px]">
              <p className="text-[9px] sm:text-[10px] oscars-red-text/60 mb-0.5 uppercase tracking-wider font-semibold text-center">
                Seconds
              </p>
              <p className="font-bold text-lg sm:text-xl oscars-red-text text-center leading-none">
                {String(timeLeft.seconds).padStart(2, '0')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pool Search Component
function PoolSearch({ onJoinSuccess }: { onJoinSuccess: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const queryClient = useQueryClient();

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['pool-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await api.get(`/pools/search?q=${encodeURIComponent(searchQuery.trim())}`);
      return response.data;
    },
    enabled: searchQuery.trim().length > 0,
  });

  const joinPool = useMutation({
    mutationFn: async ({ poolId, password }: { poolId: string; password?: string }) => {
      const response = await api.post(`/pools/${poolId}/join`, { password });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pools'] });
      setShowPasswordPrompt(null);
      setPassword('');
      setPasswordError('');
      setSearchQuery('');
      onJoinSuccess();
    },
    onError: (error: any) => {
      setPasswordError(error.response?.data?.error || 'Failed to join pool');
    },
  });

  const handleJoinClick = (pool: any) => {
    if (!pool.isPublic) {
      setShowPasswordPrompt(pool.id);
      setPassword('');
      setPasswordError('');
    } else {
      joinPool.mutate({ poolId: pool.id });
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent, poolId: string) => {
    e.preventDefault();
    setPasswordError('');
    if (!password.trim()) {
      setPasswordError('Password is required');
      return;
    }
    joinPool.mutate({ poolId, password: password.trim() });
  };

  return (
    <div>
      <div className="mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by pool name or ID..."
          className="w-full px-3 py-2.5 min-h-[44px] text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {isSearching && searchQuery.trim() && (
        <div className="text-center py-4">
          <p className="text-gray-600 text-sm">Searching...</p>
        </div>
      )}

      {!isSearching && searchResults && searchResults.length > 0 && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {searchResults.map((pool: any) => (
            <div
              key={pool.id}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base oscars-dark truncate">
                    {pool.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span>{pool.isPublic ? 'Public' : 'Private'}</span>
                    <span>•</span>
                    <span>{pool._count?.members || 0} members</span>
                    {pool.isPaidPool && (
                      <>
                        <span>•</span>
                        <span>${pool.entryAmount} entry</span>
                      </>
                    )}
                  </div>
                </div>
                {showPasswordPrompt === pool.id ? (
                  <form
                    onSubmit={(e) => handlePasswordSubmit(e, pool.id)}
                    className="w-full sm:flex-1 sm:min-w-0"
                  >
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError('');
                        }}
                        placeholder="Enter pool password"
                        className="w-full px-3 py-2.5 min-h-[44px] text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        autoFocus
                      />
                      {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={joinPool.isPending}
                          className="px-4 py-2.5 min-h-[44px] text-sm font-medium bg-yellow-600 text-white rounded hover:bg-yellow-700 active:bg-yellow-800 disabled:opacity-50 transition-colors touch-manipulation flex-1"
                        >
                          {joinPool.isPending ? 'Joining...' : 'Join'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordPrompt(null);
                            setPassword('');
                            setPasswordError('');
                          }}
                          className="px-4 py-2.5 min-h-[44px] text-sm font-medium bg-gray-200 text-gray-800 rounded hover:bg-gray-300 active:bg-gray-400 transition-colors touch-manipulation"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => handleJoinClick(pool)}
                    disabled={joinPool.isPending}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-sm font-medium bg-yellow-600 text-white rounded hover:bg-yellow-700 active:bg-yellow-800 disabled:opacity-50 transition-colors touch-manipulation whitespace-nowrap"
                  >
                    Join
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isSearching && searchQuery.trim() && searchResults && searchResults.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-600 text-sm">No pools found</p>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: pools, isLoading } = useQuery({
    queryKey: ['pools'],
    queryFn: async () => {
      const response = await api.get('/pools/my-pools');
      return response.data;
    },
  });

  const isSuperuser = user?.role === 'SUPERUSER';

  const { data: allPools, isLoading: isLoadingAllPools } = useQuery({
    queryKey: ['pools-all'],
    queryFn: async () => {
      const response = await api.get('/pools/all');
      return response.data;
    },
    enabled: isSuperuser,
  });

  const { data: globalStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['global-stats'],
    queryFn: async () => {
      const response = await api.get('/pools/stats');
      return response.data;
    },
    enabled: isSuperuser,
  });

  const otherPoolsForSuperuser = useMemo(() => {
    if (!allPools) return [];
    const userPoolIds = new Set((pools || []).map((pool: any) => pool.id));
    return allPools.filter((pool: any) => !userPoolIds.has(pool.id));
  }, [allPools, pools]);

  // Fetch ranks, scores, and submission data for all pools
  const { data: poolRanks } = useQuery({
    queryKey: ['pool-ranks', pools?.map((p: any) => p.id)],
    queryFn: async () => {
      if (!pools || !user?.id || pools.length === 0) return new Map();
      const rankPromises = pools.map(async (pool: any) => {
        try {
          // Get scores for ranking
          const scoresResponse = await api.get(`/scores/pool/${pool.id}`);
          const scores = scoresResponse.data?.scores || [];
          const userIndex = scores.findIndex((score: any) => score.userId === user.id);
          const rank = userIndex >= 0 ? userIndex + 1 : null;
          const totalMembers = scores.length;

          // Get submission data for points
          let totalEarnedPoints = 0;
          let totalPossiblePoints = 0;
          try {
            const submissionsResponse = await api.get(`/pools/${pool.id}/submissions`);
            const submissions = submissionsResponse.data || [];
            const userSubmission = submissions.find((s: any) => s.userId === user.id);
            if (userSubmission) {
              totalEarnedPoints = userSubmission.totalEarnedPoints || 0;
              totalPossiblePoints = userSubmission.totalPossiblePoints || 0;
            }
          } catch {
            // If submissions endpoint fails, use score data
            const userScore = userIndex >= 0 ? scores[userIndex] : null;
            totalEarnedPoints = userScore?.totalScore || 0;
          }

          return {
            poolId: pool.id,
            rank,
            totalMembers,
            totalEarnedPoints,
            totalPossiblePoints,
          };
        } catch {
          return {
            poolId: pool.id,
            rank: null,
            totalMembers: 0,
            totalEarnedPoints: 0,
            totalPossiblePoints: 0,
          };
        }
      });
      const ranks = await Promise.all(rankPromises);
      return new Map(
        ranks.map((r) => [
          r.poolId,
          {
            rank: r.rank,
            totalMembers: r.totalMembers,
            totalEarnedPoints: r.totalEarnedPoints,
            totalPossiblePoints: r.totalPossiblePoints,
          },
        ]),
      );
    },
    enabled: !!pools && pools.length > 0 && !!user?.id,
  });

  // Get global pool ceremony date (all pools should use the same Oscars date)
  const { data: globalPool } = useQuery({
    queryKey: ['globalPool'],
    queryFn: async () => {
      const response = await api.get('/pools/global');
      return response.data;
    },
  });

  const sendTestEmail = useMutation({
    mutationFn: async (to: string) => {
      const response = await api.post('/email/test', { to });
      return response.data;
    },
    onSuccess: () => {
      setTestEmailStatus('Test email sent');
    },
    onError: (error: any) => {
      setTestEmailStatus(error.response?.data?.error || 'Failed to send test email');
    },
  });

  const handleSendTestEmail = () => {
    const to = window.prompt('Send test email to:');
    if (!to) return;
    setTestEmailStatus(null);
    sendTestEmail.mutate(to.trim());
  };

  const handleJoinSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['pools'] });
  };

  // Use global pool ceremony date, or fallback to earliest from user's pools
  const ceremonyDate =
    globalPool?.ceremonyDate ||
    (pools?.length > 0
      ? pools.reduce((earliest: any, pool: any) => {
          const poolDate = new Date(pool.ceremonyDate);
          const earliestDate = earliest ? new Date(earliest.ceremonyDate) : null;
          if (!earliestDate || poolDate < earliestDate) {
            return pool;
          }
          return earliest;
        }, null)?.ceremonyDate
      : null);

  const renderSuperuserTools = () => (
    <div className="px-4 sm:px-6 py-4">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide">Total Users</p>
          <p className="font-bold text-sm sm:text-base oscars-dark">
            {isLoadingStats ? '...' : (globalStats?.totalUsers ?? '-')}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide">Total Pools</p>
          <p className="font-bold text-sm sm:text-base oscars-dark">
            {isLoadingStats ? '...' : (globalStats?.totalPools ?? '-')}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => navigate('/winners/global')}
          className="w-full px-4 py-2 min-h-[36px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium touch-manipulation"
        >
          Mark Global Winners
        </button>
        <button
          onClick={() => navigate('/nominees/metadata')}
          className="w-full px-4 py-2 min-h-[36px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium touch-manipulation"
        >
          Edit Nominee Metadata
        </button>
        <button
          onClick={() => navigate('/users')}
          className="w-full px-4 py-2 min-h-[36px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium touch-manipulation"
        >
          View Users
        </button>
        <button
          onClick={handleSendTestEmail}
          disabled={sendTestEmail.isPending}
          className="w-full px-4 py-2 min-h-[36px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 active:bg-gray-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm font-medium touch-manipulation"
        >
          {sendTestEmail.isPending ? 'Sending Test Email...' : 'Send Test Email'}
        </button>
        {testEmailStatus && <p className="text-xs text-gray-600">{testEmailStatus}</p>}
      </div>

      <div className="mt-4 border-t border-gray-200 pt-4">
        <h3 className="text-xs font-semibold oscars-dark uppercase tracking-wide mb-3">
          Pools You Aren't In
        </h3>
        {isLoadingAllPools ? (
          <p className="text-sm text-gray-600">Loading pools...</p>
        ) : otherPoolsForSuperuser.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {otherPoolsForSuperuser.map((pool: any) => (
              <div key={pool.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm oscars-dark truncate">{pool.name}</p>
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
        ) : (
          <p className="text-sm text-gray-600">You're already in every pool.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo - No back button on home page */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-90 transition-opacity touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
            aria-label="Go to home"
          >
            <img src="/images/awardseason_logo_assets/awardseason_topnav_256.png" alt="Award Season" className="h-12 w-12 sm:h-14 sm:w-14 object-contain" />
            <span className="hidden sm:inline oscars-font text-lg sm:text-xl font-bold">
              AWARD SEASON
            </span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side - Email and Logout */}
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

      {/* Countdown Timer Bar */}
      {ceremonyDate && <CountdownTimer ceremonyDate={new Date(ceremonyDate)} />}

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Desktop: Two Column Layout */}
        <div className="md:grid md:grid-cols-2 md:gap-6">
          {/* Left Column: My Pools */}
          <div className="mb-6 md:mb-0">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Header - Matching submissions style */}
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">MY POOLS</h2>
              </div>

              <div className="p-4 sm:p-6">
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600">Loading pools...</p>
                  </div>
                ) : pools && pools.length > 0 ? (
                  <div className="space-y-3">
                    {pools.map((pool: any) => {
                      const rankData = poolRanks?.get(pool.id);
                      return (
                        <div
                          key={pool.id}
                          onClick={() => navigate(`/pool/${pool.id}`)}
                          className="rounded-lg border-2 bg-white border-gray-200 hover:border-gray-300 cursor-pointer transition-colors overflow-hidden"
                        >
                          {/* Header Section */}
                          <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 border-b border-gray-200">
                            <h3 className="oscars-font text-sm sm:text-base font-bold oscars-dark truncate flex-1">
                              {pool.name}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {pool.isPaidPool && (
                                <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-medium bg-yellow-500/30 text-yellow-700 rounded uppercase tracking-wide border border-yellow-400/30">
                                  $
                                </span>
                              )}
                              {pool.isPublic ? (
                                <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-medium bg-green-500/30 text-green-700 rounded uppercase tracking-wide border border-green-400/30">
                                  Public
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-medium bg-gray-200 text-gray-700 rounded uppercase tracking-wide border border-gray-300">
                                  Private
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Body Section */}
                          <div className="px-3 sm:px-4 py-2">
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                              <div className="text-center">
                                <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide">
                                  Rank
                                </p>
                                <p className="font-bold text-sm sm:text-base oscars-dark">
                                  {rankData?.rank
                                    ? `${rankData.rank}/${rankData.totalMembers}`
                                    : '-'}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide">
                                  Status
                                </p>
                                <span
                                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                    pool.submissionStatus === 'Complete'
                                      ? 'bg-green-100 text-green-800'
                                      : pool.submissionStatus === 'In Progress'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {pool.submissionStatus === 'Complete'
                                    ? '✓ Complete'
                                    : pool.submissionStatus === 'In Progress'
                                      ? 'In Progress'
                                      : 'Not Submitted'}
                                </span>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide">
                                  Correct
                                </p>
                                <p className="font-bold text-sm sm:text-base oscars-dark">
                                  {pool.hasSubmitted && pool.totalCategories
                                    ? `${pool.correctCount || 0}/${pool.totalCategories}`
                                    : '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-600 mb-4">No pools yet. Create your first pool!</p>
                    <button
                      onClick={() => navigate('/pool/new')}
                      className="px-6 py-3 min-h-[44px] oscars-gold-bg text-white rounded hover:opacity-90 active:opacity-80 transition-opacity touch-manipulation"
                    >
                      Create Pool
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Find or Create */}
          <div className="mb-6 md:mb-0">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="oscars-red text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">
                  Find or Create a Pool
                </h2>
              </div>
              <div className="px-4 sm:px-6 py-6">
                <div className="space-y-6">
                  {/* Search Section */}
                  <div className="flex flex-col">
                    <h3 className="text-sm font-semibold oscars-dark mb-4 uppercase tracking-wide">
                      Search for a Pool
                    </h3>
                    <PoolSearch onJoinSuccess={handleJoinSuccess} />
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200"></div>

                  {/* Create Pool Section */}
                  <div className="flex flex-col">
                    <h3 className="text-sm font-semibold oscars-dark mb-4 uppercase tracking-wide">
                      Create Your Own Pool
                    </h3>
                    <button
                      onClick={() => navigate('/pool/new')}
                      className="w-full px-4 py-2.5 min-h-[44px] oscars-gold-bg text-white rounded hover:opacity-90 active:opacity-80 transition-opacity text-sm sm:text-base font-medium touch-manipulation"
                    >
                      Create New Pool
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Winners Management Link (Superuser only) - Desktop only, below Find/Create */}
            {isSuperuser && (
              <div className="mt-6 hidden md:block">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                    <h2 className="oscars-font text-base sm:text-lg font-bold">Superuser Tools</h2>
                  </div>
                  {renderSuperuserTools()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Winners Management Link (Superuser only) - Mobile only, at bottom */}
        {isSuperuser && (
          <div className="mb-6 md:hidden">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">Superuser Tools</h2>
              </div>
              {renderSuperuserTools()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
