import { useMemo, useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Category } from '../types/pool';
import MoviePoster from '../components/MoviePoster';
import { getMovieEntries } from '../utils/movieNominees';
import { useSeenMovies } from '../hooks/useSeenMovies';

const filterOptions = ['all', 'seen', 'unseen'] as const;

type FilterOption = (typeof filterOptions)[number];

export default function MoviesSeen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const headerRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showStickySummary, setShowStickySummary] = useState(false);
  const previousRankIndexRef = useRef<number | null>(null);

  const year = new Date().getFullYear().toString();
  const requestedUserId = searchParams.get('userId');
  const isSuperuser = user?.role === 'SUPERUSER';
  const viewUserId =
    isSuperuser && requestedUserId && requestedUserId !== user?.id ? requestedUserId : null;

  useEffect(() => {
    if (viewUserId) {
      setFilter('seen');
    }
  }, [viewUserId]);

  const {
    data: categories,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['nominees', year],
    queryFn: async () => {
      const response = await api.get(`/nominees/${year}`);
      return response.data as Category[];
    },
  });

  const movies = useMemo(() => (categories ? getMovieEntries(categories) : []), [categories]);

  const { seenSet, toggleSeen, isReadOnly } = useSeenMovies({
    userId: user?.id,
    year,
    targetUserId: viewUserId ?? undefined,
    readOnly: Boolean(viewUserId),
  });

  const seenCount = useMemo(() => {
    if (!movies.length) return 0;
    return movies.reduce((count, movie) => (seenSet.has(movie.id) ? count + 1 : count), 0);
  }, [movies, seenSet]);

  const progress = movies.length ? Math.round((seenCount / movies.length) * 100) : 0;
  const watchLevel = useMemo(() => {
    if (seenCount === 0) return 'Newb';
    if (seenCount <= 5) return 'Casual Fan';
    if (seenCount <= 10) return 'Film Buff';
    if (seenCount <= 30) return 'Cinephile';
    return 'Auteur';
  }, [seenCount]);

  const watchLevelStyle = useMemo(() => {
    if (seenCount === 0) {
      return {
        badge: 'from-slate-700/70 to-slate-900/80 border-white/20',
        text: 'text-white',
        stickyBadge: 'bg-slate-100 border-slate-200',
        stickyText: 'text-slate-700',
        confettiColors: ['#94a3b8', '#64748b', '#0f172a', '#cbd5f5'],
      };
    }
    if (seenCount <= 5) {
      return {
        badge: 'from-amber-500/30 to-amber-800/60 border-amber-200/40',
        text: 'text-amber-100',
        stickyBadge: 'bg-amber-50 border-amber-200',
        stickyText: 'text-amber-800',
        confettiColors: ['#fbbf24', '#f59e0b', '#b45309', '#fde68a'],
      };
    }
    if (seenCount <= 10) {
      return {
        badge: 'from-emerald-500/30 to-emerald-800/60 border-emerald-200/40',
        text: 'text-emerald-100',
        stickyBadge: 'bg-emerald-50 border-emerald-200',
        stickyText: 'text-emerald-800',
        confettiColors: ['#34d399', '#10b981', '#047857', '#bbf7d0'],
      };
    }
    if (seenCount <= 30) {
      return {
        badge: 'from-blue-500/30 to-blue-800/60 border-blue-200/40',
        text: 'text-blue-100',
        stickyBadge: 'bg-blue-50 border-blue-200',
        stickyText: 'text-blue-800',
        confettiColors: ['#60a5fa', '#3b82f6', '#1d4ed8', '#bfdbfe'],
      };
    }
    return {
      badge: 'from-yellow-500/40 to-yellow-900/70 border-yellow-200/50',
      text: 'text-yellow-100',
      stickyBadge: 'bg-yellow-50 border-yellow-200',
      stickyText: 'text-yellow-900',
      confettiColors: ['#facc15', '#f59e0b', '#b45309', '#fde68a'],
    };
  }, [seenCount]);

  const rankIndex = useMemo(() => {
    if (seenCount === 0) return 0;
    if (seenCount <= 5) return 1;
    if (seenCount <= 10) return 2;
    if (seenCount <= 30) return 3;
    return 4;
  }, [seenCount]);

  const confettiColors = watchLevelStyle.confettiColors;

  const fireRankConfetti = (colors: string[]) => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const originY = 0.02;

    confetti({
      angle: 270,
      spread: 120,
      ticks: 200,
      gravity: 0.6,
      decay: 0.9,
      startVelocity: 42,
      scalar: 1.05,
      particleCount: 170,
      colors,
      zIndex: 1000,
      origin: {
        x: 0.5,
        y: originY,
      },
    });
  };

  useEffect(() => {
    if (previousRankIndexRef.current === null) {
      previousRankIndexRef.current = rankIndex;
      return;
    }
    if (rankIndex > previousRankIndexRef.current) {
      fireRankConfetti(confettiColors);
      previousRankIndexRef.current = rankIndex;
      return;
    }
    previousRankIndexRef.current = rankIndex;
  }, [rankIndex, confettiColors]);

  useEffect(() => {
    const measureHeader = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };

    measureHeader();
    window.addEventListener('resize', measureHeader);

    let resizeObserver: ResizeObserver | null = null;
    if (headerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        measureHeader();
      });
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', measureHeader);
      if (resizeObserver && headerRef.current) {
        resizeObserver.unobserve(headerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!summaryRef.current) return;
      const rect = summaryRef.current.getBoundingClientRect();
      setShowStickySummary(rect.bottom < headerHeight + 8);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [headerHeight]);

  const filteredMovies = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return movies.filter((movie) => {
      if (filter === 'seen' && !seenSet.has(movie.id)) return false;
      if (filter === 'unseen' && seenSet.has(movie.id)) return false;
      if (term && !movie.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [movies, filter, searchQuery, seenSet]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header ref={headerRef} className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
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

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div ref={summaryRef} className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
            <h2 className="oscars-font text-base sm:text-lg font-bold">Checklist</h2>
            <div
              className={`flex items-center gap-2 rounded-full bg-gradient-to-r px-3 py-1 shadow-sm border ${watchLevelStyle.badge}`}
            >
              <span className={`oscars-font text-xs sm:text-sm font-bold ${watchLevelStyle.text}`}>
                {watchLevel}
              </span>
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm sm:text-base text-gray-700">
                  {viewUserId ? (
                    <>
                      Seen <span className="font-semibold text-gray-900">{seenCount}</span> of{' '}
                      <span className="font-semibold text-gray-900">{movies.length}</span> nominated
                      films.
                    </>
                  ) : (
                    <>
                      You&apos;ve seen{' '}
                      <span className="font-semibold text-gray-900">{seenCount}</span> of{' '}
                      <span className="font-semibold text-gray-900">{movies.length}</span> nominated
                      films.
                    </>
                  )}
                </p>
                {isReadOnly && (
                  <p className="text-xs text-gray-500">
                    View-only mode (superuser).
                  </p>
                )}
                <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Tap a poster to mark a movie as seen or to undo it.
                </p>
              </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search nominated films..."
                  className="w-full px-3 py-2.5 min-h-[44px] text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {filterOptions.map((option) => {
                  const isActive = filter === option;
                  const label = option === 'all' ? 'All' : option === 'seen' ? 'Seen' : 'Unseen';
                  const count =
                    option === 'all'
                      ? movies.length
                      : option === 'seen'
                        ? seenCount
                        : Math.max(movies.length - seenCount, 0);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFilter(option)}
                      className={`px-3 py-2 min-h-[40px] text-xs sm:text-sm font-semibold rounded transition-colors border ${
                        isActive
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-700 border-gray-200 hover:border-yellow-300'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {showStickySummary && (
          <div
            className="sticky bg-white border-b border-gray-200 z-30 py-2"
            style={{ top: `${headerHeight}px` }}
          >
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6">
              <div className="min-w-0 sm:hidden">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-0.5 shadow-sm border ${watchLevelStyle.stickyBadge}`}
                >
                  <span className={`oscars-font text-[11px] font-bold ${watchLevelStyle.stickyText}`}>
                    {watchLevel}
                  </span>
                </span>
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="oscars-font text-xs sm:text-sm font-bold oscars-dark truncate">
                  Seen It Checklist
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: `${progress}%` }} />
                </div>
                <div
                  className={`hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-0.5 shadow-sm border ${watchLevelStyle.stickyBadge}`}
                >
                  <span
                    className={`oscars-font text-[11px] font-bold ${watchLevelStyle.stickyText}`}
                  >
                    {watchLevel}
                  </span>
                </div>
                <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                  {seenCount}/{movies.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading nominated films...</p>
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <p className="text-red-600">Failed to load nominees for {year}.</p>
          </div>
        ) : filteredMovies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No films match your filters right now.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {filteredMovies.map((movie) => {
              const isSeen = seenSet.has(movie.id);
              const visibleCategories = movie.categories.slice(0, 3);
              const remainingCount = movie.categories.length - visibleCategories.length;
              return (
                <button
                  key={movie.id}
                  type="button"
                  aria-pressed={isSeen}
                  onClick={() => {
                    if (!isReadOnly) {
                      toggleSeen(movie.id);
                    }
                  }}
                  aria-disabled={isReadOnly}
                  className={`border-2 rounded-lg p-4 md:p-3 transition-all flex md:flex-col gap-4 md:gap-0 text-left ${
                    isReadOnly
                      ? 'border-gray-200 bg-white cursor-default'
                      : 'cursor-pointer active:scale-[0.99]'
                  } ${
                    isSeen
                      ? 'border-yellow-400 bg-yellow-50'
                      : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50/30 bg-white'
                  }`}
                >
                  {(() => {
                    const posterSources = movie.posterIds.map(
                      (posterId) => `/images/${year}_movie_${posterId}.jpg`,
                    );
                    const [primarySource, ...fallbackSources] = posterSources;
                    return (
                      <MoviePoster
                        title={movie.title}
                        src={primarySource}
                        fallbackSrcs={fallbackSources}
                        containerClassName="nominee-image-container relative w-24 h-24 md:w-full md:aspect-square flex-shrink-0 rounded bg-gray-100 md:mb-2 border border-gray-300/50 cursor-pointer active:scale-95 transition-transform"
                        imageClassName="w-full h-full object-contain"
                        fallbackVariant="full"
                        badge={
                          isSeen ? (
                            <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                              ✓
                            </div>
                          ) : undefined
                        }
                      />
                    );
                  })()}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm sm:text-base md:text-xs oscars-dark leading-tight md:whitespace-normal md:break-words">
                        {movie.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {visibleCategories.map((category) => (
                        <span
                          key={category}
                          className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 rounded-full"
                        >
                          {category}
                        </span>
                      ))}
                      {remainingCount > 0 && (
                        <span
                          className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 rounded-full transition-colors hover:bg-gray-300 hover:text-gray-700"
                          title={movie.categories.slice(3).join(', ')}
                        >
                          +{remainingCount} more
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
