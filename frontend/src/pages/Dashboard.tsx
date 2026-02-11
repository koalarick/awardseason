import { useState, useEffect, useMemo, useRef, type FormEvent, type RefObject } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Category, Pool, PoolSubmission } from '../types/pool';
import MoviePoster from '../components/MoviePoster';
import {
  getMovieEntries,
  getNomineeEntries,
  type MovieEntry,
  type NomineeEntry,
} from '../utils/movieNominees';
import { useSeenMovies } from '../hooks/useSeenMovies';
import { getApiErrorMessage } from '../utils/apiErrors';

type PoolScoreEntry = {
  userId: string;
  totalScore?: number;
};

type PoolRankSummary = {
  rank: number | null;
  totalMembers: number;
  totalEarnedPoints: number;
  totalPossiblePoints: number;
};

type DashboardPool = Pool & {
  submissionStatus?: 'Complete' | 'In Progress' | string;
  hasSubmitted?: boolean;
  totalCategories?: number;
  correctCount?: number;
};

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

  const { data: searchResults = [], isLoading: isSearching } = useQuery<Pool[]>({
    queryKey: ['pool-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await api.get(`/pools/search?q=${encodeURIComponent(searchQuery.trim())}`);
      return response.data as Pool[];
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
    onError: (error: unknown) => {
      setPasswordError(getApiErrorMessage(error) ?? 'Failed to join pool');
    },
  });

  const handleJoinClick = (pool: Pool) => {
    if (!pool.isPublic) {
      setShowPasswordPrompt(pool.id);
      setPassword('');
      setPasswordError('');
    } else {
      joinPool.mutate({ poolId: pool.id });
    }
  };

  const handlePasswordSubmit = (e: FormEvent, poolId: string) => {
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

      {!isSearching && searchResults.length > 0 && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {searchResults.map((pool) => (
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
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear().toString();
  const watchedCarouselRef = useRef<HTMLDivElement | null>(null);
  const recommendedCarouselRef = useRef<HTMLDivElement | null>(null);

  const { data: pools, isLoading } = useQuery<DashboardPool[]>({
    queryKey: ['pools'],
    queryFn: async () => {
      const response = await api.get('/pools/my-pools');
      return response.data as DashboardPool[];
    },
  });

  const isSuperuser = user?.role === 'SUPERUSER';

  // Fetch ranks, scores, and submission data for all pools
  const { data: poolRanks } = useQuery<Map<string, PoolRankSummary>>({
    queryKey: ['pool-ranks', pools?.map((p) => p.id)],
    queryFn: async () => {
      if (!pools || !user?.id || pools.length === 0) return new Map<string, PoolRankSummary>();
      const rankPromises = pools.map(async (pool) => {
        let rank: number | null = null;
        let totalMembers = 0;
        let totalEarnedPoints = 0;
        let totalPossiblePoints = 0;

        try {
          // Submissions are already sorted by earned points, then possible points.
          const submissionsResponse = await api.get(`/pools/${pool.id}/submissions`);
          const submissions = (submissionsResponse.data ?? []) as PoolSubmission[];
          totalMembers = submissions.length;
          const userIndex = submissions.findIndex((submission) => submission.userId === user.id);
          rank = userIndex >= 0 ? userIndex + 1 : null;

          if (userIndex >= 0) {
            const userSubmission = submissions[userIndex];
            totalEarnedPoints = userSubmission.totalEarnedPoints || 0;
            totalPossiblePoints = userSubmission.totalPossiblePoints || 0;
          }

          return {
            poolId: pool.id,
            rank,
            totalMembers,
            totalEarnedPoints,
            totalPossiblePoints,
          };
        } catch {
          // Fallback to scores endpoint if submissions fail
          try {
            const scoresResponse = await api.get(`/scores/pool/${pool.id}`);
            const scores = (scoresResponse.data?.scores ?? []) as PoolScoreEntry[];
            const userIndex = scores.findIndex((score) => score.userId === user.id);
            rank = userIndex >= 0 ? userIndex + 1 : null;
            totalMembers = scores.length;
            const userScore = userIndex >= 0 ? scores[userIndex] : null;
            totalEarnedPoints = userScore?.totalScore || 0;
          } catch {
            // Keep defaults
          }

          return {
            poolId: pool.id,
            rank,
            totalMembers,
            totalEarnedPoints,
            totalPossiblePoints,
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
  const { data: globalPool } = useQuery<Pool | null>({
    queryKey: ['globalPool'],
    queryFn: async () => {
      const response = await api.get('/pools/global');
      return response.data as Pool;
    },
  });

  const {
    data: nomineeCategories,
    isLoading: isLoadingNominees,
    isError: isNomineesError,
  } = useQuery({
    queryKey: ['nominees', currentYear],
    queryFn: async () => {
      const response = await api.get(`/nominees/${currentYear}`);
      return response.data as Category[];
    },
    enabled: !!currentYear,
  });

  const movieEntries = useMemo<MovieEntry[]>(
    () => (nomineeCategories ? getMovieEntries(nomineeCategories) : []),
    [nomineeCategories],
  );

  const nomineeEntries = useMemo<NomineeEntry[]>(
    () => (nomineeCategories ? getNomineeEntries(nomineeCategories) : []),
    [nomineeCategories],
  );

  const { seenSet } = useSeenMovies({ userId: user?.id, year: currentYear });

  const seenMovieCount = useMemo(() => {
    if (!movieEntries.length) return 0;
    return movieEntries.reduce((count, movie) => (seenSet.has(movie.id) ? count + 1 : count), 0);
  }, [movieEntries, seenSet]);

  const seenNomineeCount = useMemo(() => {
    if (!nomineeEntries.length) return 0;
    return nomineeEntries.reduce((count, nominee) => {
      if (!nominee.filmId) return count;
      return seenSet.has(nominee.filmId) ? count + 1 : count;
    }, 0);
  }, [nomineeEntries, seenSet]);

  const totalMovies = movieEntries.length;
  const movieProgress = totalMovies ? Math.round((seenMovieCount / totalMovies) * 100) : 0;
  const totalNominees = nomineeEntries.length;
  const nomineeProgress = totalNominees
    ? Math.round((seenNomineeCount / totalNominees) * 100)
    : 0;
  const watchLevel = useMemo(() => {
    if (seenMovieCount === 0) return 'Newb';
    if (seenMovieCount <= 5) return 'Casual Fan';
    if (seenMovieCount <= 10) return 'Film Buff';
    if (seenMovieCount <= 30) return 'Cinephile';
    return 'Auteur';
  }, [seenMovieCount]);

  const watchLevelStyle = useMemo(() => {
    if (seenMovieCount === 0) {
      return {
        badge: 'from-slate-700/70 to-slate-900/80 border-white/20',
        text: 'text-white',
      };
    }
    if (seenMovieCount <= 5) {
      return {
        badge: 'from-amber-500/30 to-amber-800/60 border-amber-200/40',
        text: 'text-amber-100',
      };
    }
    if (seenMovieCount <= 10) {
      return {
        badge: 'from-emerald-500/30 to-emerald-800/60 border-emerald-200/40',
        text: 'text-emerald-100',
      };
    }
    if (seenMovieCount <= 30) {
      return {
        badge: 'from-blue-500/30 to-blue-800/60 border-blue-200/40',
        text: 'text-blue-100',
      };
    }
    return {
      badge: 'from-yellow-500/40 to-yellow-900/70 border-yellow-200/50',
      text: 'text-yellow-100',
    };
  }, [seenMovieCount]);

  const watchedMovies = useMemo(
    () =>
      movieEntries
        .filter((movie) => seenSet.has(movie.id))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [movieEntries, seenSet],
  );

  const recommendedMovies = useMemo(
    () =>
      movieEntries
        .filter((movie) => !seenSet.has(movie.id))
        .sort((a, b) => {
          const nominationDiff = b.categories.length - a.categories.length;
          if (nominationDiff !== 0) return nominationDiff;
          return a.title.localeCompare(b.title);
        }),
    [movieEntries, seenSet],
  );

  const scrollCarousel = (ref: RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (!ref.current) return;
    const amount = ref.current.clientWidth * 0.8;
    ref.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  const handleJoinSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['pools'] });
  };

  // Use global pool ceremony date, or fallback to earliest from user's pools
  const ceremonyDate =
    globalPool?.ceremonyDate ||
    (pools?.length
      ? pools.reduce<Pool | null>((earliest, pool) => {
          const poolDate = new Date(pool.ceremonyDate);
          const earliestDate = earliest ? new Date(earliest.ceremonyDate) : null;
          if (!earliestDate || poolDate < earliestDate) {
            return pool;
          }
          return earliest;
        }, null)?.ceremonyDate
      : null);

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
            <span className="oscars-font text-[0.9rem] sm:text-xl font-medium sm:font-bold text-white/80 sm:text-white whitespace-nowrap">
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
                    {pools.map((pool) => {
                      const rankData = poolRanks?.get(pool.id);
                      return (
                        <div
                          key={pool.id}
                          onClick={() => navigate(`/pool/${pool.id}`)}
                          className="rounded-lg border-2 bg-white border-gray-200 hover:border-gray-300 cursor-pointer transition-colors overflow-hidden"
                        >
                          {/* Header Section */}
                          <div className="px-3 sm:px-4 py-2 flex items-start justify-between gap-2 border-b border-gray-200">
                            <h3 className="oscars-font text-sm sm:text-base font-bold oscars-dark whitespace-normal break-words flex-1 min-w-0">
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

            <div className="mt-6">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="oscars-font text-base sm:text-lg font-bold">My Checklist</h2>
                    <div
                      className={`inline-flex items-center rounded-full bg-gradient-to-r px-3 py-1 shadow-sm border ${watchLevelStyle.badge}`}
                    >
                      <span className={`oscars-font text-xs font-bold ${watchLevelStyle.text}`}>
                        {watchLevel}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/movies/seen')}
                    className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white/10 border border-white/20 rounded hover:bg-white/20 active:bg-white/30 transition-colors"
                  >
                    Update
                  </button>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  {isLoadingNominees ? (
                    <p className="text-sm text-gray-600">Loading nominated films...</p>
                  ) : isNomineesError ? (
                    <p className="text-sm text-red-600">
                      Unable to load nominated films for {currentYear}.
                    </p>
                  ) : totalMovies === 0 ? (
                    <p className="text-sm text-gray-600">
                      No nominated films found for {currentYear}.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-sm sm:text-base text-gray-700">
                            <span className="font-semibold text-gray-900">{seenMovieCount}</span>{' '}
                            of{' '}
                            <span className="font-semibold text-gray-900">{totalMovies}</span>{' '}
                            nominated movies
                          </p>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 transition-all"
                            style={{ width: `${movieProgress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-sm sm:text-base text-gray-700">
                            <span className="font-semibold text-gray-900">{seenNomineeCount}</span>{' '}
                            of{' '}
                            <span className="font-semibold text-gray-900">{totalNominees}</span>{' '}
                            nominated entries
                          </p>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${nomineeProgress}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Watched
                              </h3>
                              <span className="text-xs text-gray-500">
                                {watchedMovies.length}
                              </span>
                            </div>
                            <div className="hidden md:flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => scrollCarousel(watchedCarouselRef, 'left')}
                                className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors flex items-center justify-center"
                                aria-label="Scroll watched movies left"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
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
                                type="button"
                                onClick={() => scrollCarousel(watchedCarouselRef, 'right')}
                                className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors flex items-center justify-center"
                                aria-label="Scroll watched movies right"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {watchedMovies.length === 0 ? (
                            <p className="text-sm text-gray-600">No watched movies yet.</p>
                          ) : (
                            <div
                              ref={watchedCarouselRef}
                              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
                            >
                              {watchedMovies.map((movie) => {
                                const posterSources = movie.posterIds.map(
                                  (posterId) => `/images/${currentYear}_movie_${posterId}.jpg`,
                                );
                                const [primarySource, ...fallbackSources] = posterSources;
                                const letterboxdUrl = movie.letterboxdUrl ?? null;
                                const nominationCount = movie.categories.length;
                                const nominationLabel = nominationCount === 1 ? 'NOM' : 'NOMS';
                                return (
                                  <a
                                    key={movie.id}
                                    href={letterboxdUrl || undefined}
                                    target={letterboxdUrl ? '_blank' : undefined}
                                    rel={letterboxdUrl ? 'noreferrer' : undefined}
                                    className={letterboxdUrl ? '' : 'pointer-events-none'}
                                    aria-label={
                                      letterboxdUrl
                                        ? `Open ${movie.title} on Letterboxd`
                                        : undefined
                                    }
                                  >
                                    <div className="relative transition-transform duration-200 hover:-translate-y-1">
                                      <MoviePoster
                                        title={movie.title}
                                        src={primarySource}
                                        fallbackSrcs={fallbackSources}
                                        containerClassName="rounded-lg border aspect-[2/3] w-24 sm:w-28 bg-gray-100 flex-shrink-0 border-yellow-400 snap-start hover:border-yellow-300 hover:shadow-lg transition-all duration-200"
                                        imageClassName="w-full h-full object-cover"
                                        fallbackVariant="compact"
                                      />
                                      {nominationCount > 0 && (
                                        <div className="absolute left-1/2 bottom-1.5 -translate-x-1/2 translate-y-1/2 pointer-events-none">
                                          <div className="relative inline-flex items-center gap-1 px-3 py-1.5 rounded-b-lg rounded-t-sm border border-slate-200/80 bg-white text-[10px] uppercase tracking-[0.2em] text-slate-600 shadow-sm">
                                            <span className="text-[11px] font-semibold leading-none">
                                              {nominationCount}
                                            </span>
                                            <span className="font-semibold leading-none">
                                              {nominationLabel}
                                            </span>
                                            <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white" />
                                            <span className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Recommended Next
                              </h3>
                              <span className="text-xs text-gray-500">
                                {recommendedMovies.length}
                              </span>
                            </div>
                            <div className="hidden md:flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => scrollCarousel(recommendedCarouselRef, 'left')}
                                className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors flex items-center justify-center"
                                aria-label="Scroll recommended movies left"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
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
                                type="button"
                                onClick={() => scrollCarousel(recommendedCarouselRef, 'right')}
                                className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors flex items-center justify-center"
                                aria-label="Scroll recommended movies right"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {recommendedMovies.length === 0 ? (
                            <p className="text-sm text-gray-600">You&apos;ve seen them all.</p>
                          ) : (
                            <div
                              ref={recommendedCarouselRef}
                              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
                            >
                              {recommendedMovies.map((movie) => {
                                const posterSources = movie.posterIds.map(
                                  (posterId) => `/images/${currentYear}_movie_${posterId}.jpg`,
                                );
                                const [primarySource, ...fallbackSources] = posterSources;
                                const letterboxdUrl = movie.letterboxdUrl ?? null;
                                const nominationCount = movie.categories.length;
                                const nominationLabel = nominationCount === 1 ? 'NOM' : 'NOMS';
                                return (
                                  <a
                                    key={movie.id}
                                    href={letterboxdUrl || undefined}
                                    target={letterboxdUrl ? '_blank' : undefined}
                                    rel={letterboxdUrl ? 'noreferrer' : undefined}
                                    className={letterboxdUrl ? '' : 'pointer-events-none'}
                                    aria-label={
                                      letterboxdUrl
                                        ? `Open ${movie.title} on Letterboxd`
                                        : undefined
                                    }
                                  >
                                    <div className="relative transition-transform duration-200 hover:-translate-y-1">
                                      <MoviePoster
                                        title={movie.title}
                                        src={primarySource}
                                        fallbackSrcs={fallbackSources}
                                        containerClassName="rounded-lg border aspect-[2/3] w-24 sm:w-28 bg-gray-100 flex-shrink-0 border-gray-200 snap-start hover:border-yellow-300 hover:shadow-lg transition-all duration-200"
                                        imageClassName="w-full h-full object-cover"
                                        fallbackVariant="compact"
                                      />
                                      {nominationCount > 0 && (
                                        <div className="absolute left-1/2 bottom-1.5 -translate-x-1/2 translate-y-1/2 pointer-events-none">
                                          <div className="relative inline-flex items-center gap-1 px-3 py-1.5 rounded-b-lg rounded-t-sm border border-slate-200/80 bg-white text-[10px] uppercase tracking-[0.2em] text-slate-600 shadow-sm">
                                            <span className="text-[11px] font-semibold leading-none">
                                              {nominationCount}
                                            </span>
                                            <span className="font-semibold leading-none">
                                              {nominationLabel}
                                            </span>
                                            <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white" />
                                            <span className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
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

            {/* Superuser Dashboard Link (Superuser only) - Desktop only, below Find/Create */}
            {isSuperuser && (
              <div className="mt-6 hidden md:block">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                    <h2 className="oscars-font text-base sm:text-lg font-bold">
                      Superuser Dashboard
                    </h2>
                  </div>
                  <div className="px-4 sm:px-6 py-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Manage global winners, metadata, users, events, metrics, and operational tools.
                    </p>
                    <button
                      onClick={() => navigate('/superuser')}
                      className="w-full px-4 py-2.5 min-h-[44px] bg-slate-800 text-white rounded hover:bg-slate-700 active:bg-slate-900 transition-colors text-sm font-semibold touch-manipulation"
                    >
                      Open Superuser Dashboard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Superuser Dashboard Link (Superuser only) - Mobile only, at bottom */}
        {isSuperuser && (
          <div className="mb-6 md:hidden">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
                <h2 className="oscars-font text-base sm:text-lg font-bold">
                  Superuser Dashboard
                </h2>
              </div>
              <div className="px-4 sm:px-6 py-4">
                <p className="text-sm text-gray-600 mb-4">
                  Manage global winners, metadata, users, events, metrics, and operational tools.
                </p>
                <button
                  onClick={() => navigate('/superuser')}
                  className="w-full px-4 py-2.5 min-h-[44px] bg-slate-800 text-white rounded hover:bg-slate-700 active:bg-slate-900 transition-colors text-sm font-semibold touch-manipulation"
                >
                  Open Superuser Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
