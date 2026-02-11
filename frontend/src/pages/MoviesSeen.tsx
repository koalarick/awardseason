import { useMemo, useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Category } from '../types/pool';
import BackButton from '../components/BackButton';
import MoviePoster from '../components/MoviePoster';
import {
  getMovieEntries,
  getNomineeEntries,
  type NomineeEntry,
} from '../utils/movieNominees';
import { useSeenMovies } from '../hooks/useSeenMovies';
import { useSmartBack } from '../hooks/useSmartBack';

const filterOptions = ['all', 'seen', 'unseen'] as const;

type FilterOption = (typeof filterOptions)[number];

export default function MoviesSeen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const goBack = useSmartBack({ fallback: '/' });
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [openNominationMovieId, setOpenNominationMovieId] = useState<string | null>(null);
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
  const nomineeEntries = useMemo<NomineeEntry[]>(
    () => (categories ? getNomineeEntries(categories) : []),
    [categories],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    movies.forEach((movie) => {
      movie.categories.forEach((category) => {
        counts[category] = (counts[category] ?? 0) + 1;
      });
    });
    return counts;
  }, [movies]);

  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    const seenNames = new Set<string>();
    const ordered: string[] = [];
    categories.forEach((category) => {
      if (!seenNames.has(category.name) && categoryCounts[category.name]) {
        seenNames.add(category.name);
        ordered.push(category.name);
      }
    });
    return ordered;
  }, [categories, categoryCounts]);

  useEffect(() => {
    if (categoryFilter === 'all') return;
    if (!categoryOptions.includes(categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categoryFilter, categoryOptions]);

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

  const seenNomineeCount = useMemo(() => {
    if (!nomineeEntries.length) return 0;
    return nomineeEntries.reduce((count, nominee) => {
      if (!nominee.filmId) return count;
      return seenSet.has(nominee.filmId) ? count + 1 : count;
    }, 0);
  }, [nomineeEntries, seenSet]);

  const progress = movies.length ? Math.round((seenCount / movies.length) * 100) : 0;
  const nomineeProgress = nomineeEntries.length
    ? Math.round((seenNomineeCount / nomineeEntries.length) * 100)
    : 0;
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
    const headerEl = headerRef.current;
    const measureHeader = () => {
      if (headerEl) {
        setHeaderHeight(headerEl.offsetHeight);
      }
    };

    measureHeader();
    window.addEventListener('resize', measureHeader);

    let resizeObserver: ResizeObserver | null = null;
    if (headerEl) {
      resizeObserver = new ResizeObserver(() => {
        measureHeader();
      });
      resizeObserver.observe(headerEl);
    }

    return () => {
      window.removeEventListener('resize', measureHeader);
      if (resizeObserver && headerEl) {
        resizeObserver.unobserve(headerEl);
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

  const baseFilteredMovies = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return movies.filter((movie) => {
      if (categoryFilter !== 'all' && !movie.categories.includes(categoryFilter)) return false;
      if (term && !movie.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [movies, categoryFilter, searchQuery]);

  const filteredSeenCount = useMemo(
    () => baseFilteredMovies.reduce((count, movie) => (seenSet.has(movie.id) ? count + 1 : count), 0),
    [baseFilteredMovies, seenSet],
  );

  const filteredMovies = useMemo(() => {
    return baseFilteredMovies.filter((movie) => {
      if (filter === 'seen' && !seenSet.has(movie.id)) return false;
      if (filter === 'unseen' && seenSet.has(movie.id)) return false;
      return true;
    });
  }, [baseFilteredMovies, filter, seenSet]);

  const openNominationMovie = useMemo(
    () => movies.find((movie) => movie.id === openNominationMovieId) ?? null,
    [movies, openNominationMovieId],
  );

  useEffect(() => {
    if (!openNominationMovieId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenNominationMovieId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openNominationMovieId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header ref={headerRef} className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <BackButton onClick={goBack} />

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
                    <span className="font-semibold text-gray-900">{seenCount}</span> of{' '}
                    <span className="font-semibold text-gray-900">{movies.length}</span> nominated
                    films
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-gray-900">{seenCount}</span> of{' '}
                    <span className="font-semibold text-gray-900">{movies.length}</span> nominated
                    films
                  </>
                )}
              </p>
              {isReadOnly && <p className="text-xs text-gray-500">View-only mode (superuser).</p>}
              <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-yellow-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm sm:text-base text-gray-700">
                  <span className="font-semibold text-gray-900">{seenNomineeCount}</span> of{' '}
                  <span className="font-semibold text-gray-900">{nomineeEntries.length}</span>{' '}
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
              <div className="sm:w-64">
                <label htmlFor="category-filter" className="sr-only">
                  Filter by category
                </label>
                <select
                  id="category-filter"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] text-base border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  disabled={categoryOptions.length === 0}
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 flex-wrap">
                {filterOptions.map((option) => {
                  const isActive = filter === option;
                  const label = option === 'all' ? 'All' : option === 'seen' ? 'Seen' : 'Unseen';
                  const count =
                    option === 'all'
                      ? baseFilteredMovies.length
                      : option === 'seen'
                        ? filteredSeenCount
                        : Math.max(baseFilteredMovies.length - filteredSeenCount, 0);
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {filteredMovies.map((movie) => {
              const isSeen = seenSet.has(movie.id);
              const nominationCount = movie.categories.length;
              const nominationLabel = nominationCount === 1 ? 'NOM' : 'NOMS';
              return (
                <div
                  key={movie.id}
                  role="button"
                  tabIndex={isReadOnly ? -1 : 0}
                  aria-pressed={isSeen}
                  aria-disabled={isReadOnly}
                  onClick={() => {
                    if (!isReadOnly) {
                      toggleSeen(movie.id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (isReadOnly) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleSeen(movie.id);
                    }
                  }}
                  className={`group relative h-full rounded-xl border p-3 md:p-4 text-left transition-all flex items-center gap-3 md:flex-col md:items-stretch md:gap-3 ${
                    isSeen
                      ? 'border-[#D6A23C] bg-gradient-to-b from-[#FFF0D6] via-[#FFF7E5] to-[#FFFCF6] ring-2 ring-[#F0D19B] shadow-[0_12px_30px_rgba(176,124,35,0.25)]'
                      : 'border-slate-200/70 bg-white'
                  } ${
                    isReadOnly
                      ? 'cursor-default'
                      : 'cursor-pointer hover:border-[#D6A23C] hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 active:translate-y-0 active:scale-[0.99]'
                  }`}
                >
                  {isSeen && (
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[#D6A23C]" />
                  )}
                  {(() => {
                    const posterSources = movie.posterIds.map(
                      (posterId) => `/images/${year}_movie_${posterId}.jpg`,
                    );
                    const [primarySource, ...fallbackSources] = posterSources;
                    return (
                      <div className="relative w-20 sm:w-24 md:w-full flex-shrink-0 md:mb-2">
                        <MoviePoster
                          title={movie.title}
                          src={primarySource}
                          fallbackSrcs={fallbackSources}
                          containerClassName="nominee-image-container w-full aspect-[2/3] rounded-lg bg-slate-100 overflow-hidden shadow-sm"
                          imageClassName={`w-full h-full object-contain ${
                            isSeen ? '' : 'grayscale'
                          }`}
                          fallbackVariant="full"
                          badge={
                            isSeen ? (
                              <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/20 via-transparent to-transparent" />
                              </div>
                            ) : undefined
                          }
                        />
                        {nominationCount > 0 && (
                          <div className="absolute left-1/2 bottom-2 -translate-x-1/2 translate-y-1/2">
                            <button
                              type="button"
                              className="relative inline-flex items-center gap-1 px-3 py-1.5 md:px-3.5 md:py-1.5 rounded-b-lg rounded-t-sm border border-slate-200/80 bg-white text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98]"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpenNominationMovieId((current) =>
                                  current === movie.id ? null : movie.id,
                                );
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setOpenNominationMovieId((current) =>
                                    current === movie.id ? null : movie.id,
                                  );
                                }
                              }}
                              aria-label={`View nominations for ${movie.title}`}
                              aria-expanded={openNominationMovieId === movie.id}
                            >
                              <span className="text-[11px] md:text-[12px] font-semibold leading-none">
                                {nominationCount}
                              </span>
                              <span className="font-semibold leading-none">{nominationLabel}</span>
                              <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 md:h-2.5 md:w-2.5 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white" />
                              <span className="absolute -right-1 top-1/2 h-2.5 w-2.5 md:h-2.5 md:w-2.5 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0 md:flex md:flex-col md:h-full">
                    <div className="flex items-start gap-2">
                      <h3 className="flex-1 font-bold text-sm sm:text-base md:text-sm oscars-dark leading-snug line-clamp-1">
                        {movie.title}
                      </h3>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {openNominationMovie && (
          <>
            <button
              type="button"
              aria-label="Close nominations"
              className="hidden md:block fixed inset-0 z-40 cursor-default bg-slate-900/20"
              onClick={() => setOpenNominationMovieId(null)}
            />
            <button
              type="button"
              aria-label="Close nominations"
              className="md:hidden fixed inset-0 z-40 bg-slate-900/40"
              onClick={() => setOpenNominationMovieId(null)}
            />
            <aside className="hidden md:flex fixed top-0 right-0 z-50 h-full w-[360px] lg:w-[420px] flex-col bg-white shadow-2xl border-l border-slate-200">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                      Nominations
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 line-clamp-2">
                      {openNominationMovie.title}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {openNominationMovie.categories.length} nominations
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenNominationMovieId(null)}
                    className="text-xs uppercase tracking-[0.2em] text-slate-500 hover:text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex items-start gap-4">
                  {(() => {
                    const posterSources = openNominationMovie.posterIds.map(
                      (posterId) => `/images/${year}_movie_${posterId}.jpg`,
                    );
                    const [primarySource, ...fallbackSources] = posterSources;
                    return (
                      <MoviePoster
                        title={openNominationMovie.title}
                        src={primarySource}
                        fallbackSrcs={fallbackSources}
                        containerClassName="w-24 aspect-[2/3] rounded-lg bg-slate-100 border border-slate-200/70 overflow-hidden"
                        imageClassName="w-full h-full object-contain"
                        fallbackVariant="compact"
                      />
                    );
                  })()}
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Full list
                    </p>
                    <ul className="mt-3 space-y-2">
                      {openNominationMovie.categories.map((category) => (
                        <li key={category} className="text-sm text-slate-700">
                          {category}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </aside>
            <div className="md:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                    Nominations
                  </p>
                  <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                    {openNominationMovie.title}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    {openNominationMovie.categories.length} nominations
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenNominationMovieId(null)}
                  className="text-xs uppercase tracking-[0.2em] text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[45vh] overflow-y-auto px-4 py-4">
                <ul className="space-y-2">
                  {openNominationMovie.categories.map((category) => (
                    <li
                      key={category}
                      className="text-[11px] uppercase tracking-[0.18em] text-slate-600"
                    >
                      {category}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
