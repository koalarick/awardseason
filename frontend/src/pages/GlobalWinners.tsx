import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Category } from '../types/pool';
import { getNomineeImage } from '../utils/nomineeImages';

// Category grouping configuration (same as PoolEdit)
const categoryGroups = [
  {
    name: 'Major',
    categoryIds: [
      'best-picture',
      'directing',
      'writing-original',
      'writing-adapted',
      'actor-leading',
      'actress-leading',
      'actor-supporting',
      'actress-supporting',
    ],
  },
  {
    name: 'Technical',
    categoryIds: [
      'cinematography',
      'film-editing',
      'sound',
      'visual-effects',
      'production-design',
      'costume-design',
      'makeup-hairstyling',
      'music-score',
      'music-song',
    ],
  },
  {
    name: 'Film Categories',
    categoryIds: [
      'international-feature',
      'animated-feature',
      'documentary-feature',
      'animated-short',
      'documentary-short',
      'live-action-short',
      'casting',
    ],
  },
];

export default function GlobalWinners() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [selectedCategoryType, setSelectedCategoryType] = useState<string | null>(
    categoryGroups[0]?.name || null,
  );
  const [showStickySummary, setShowStickySummary] = useState(false);

  // Refs for scrolling
  const submissionHeaderRef = useRef<HTMLDivElement | null>(null);
  const stickySummaryRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [stickySummaryHeight, setStickySummaryHeight] = useState(52);
  const [headerHeight, setHeaderHeight] = useState(44);

  // Redirect if not superuser
  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/');
    }
  }, [user, navigate]);

  // Measure header height
  useEffect(() => {
    const measureHeader = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        setHeaderHeight(height);
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

  // Detect when to show sticky summary
  useEffect(() => {
    const handleScroll = () => {
      if (submissionHeaderRef.current) {
        const rect = submissionHeaderRef.current.getBoundingClientRect();
        setShowStickySummary(rect.bottom < headerHeight);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, [headerHeight]);

  // Measure sticky summary height
  useEffect(() => {
    const measureStickySummary = () => {
      if (stickySummaryRef.current) {
        const height = stickySummaryRef.current.offsetHeight;
        setStickySummaryHeight(height);
      }
    };

    measureStickySummary();
    window.addEventListener('resize', measureStickySummary);

    let resizeObserver: ResizeObserver | null = null;
    if (stickySummaryRef.current) {
      resizeObserver = new ResizeObserver(() => {
        measureStickySummary();
      });
      resizeObserver.observe(stickySummaryRef.current);
    }

    return () => {
      window.removeEventListener('resize', measureStickySummary);
      if (resizeObserver && stickySummaryRef.current) {
        resizeObserver.unobserve(stickySummaryRef.current);
      }
    };
  }, [showStickySummary]);

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['nominees', year],
    queryFn: async () => {
      const response = await api.get(`/nominees/${year}`);
      return response.data as Category[];
    },
    enabled: !!year,
  });

  const { data: actualWinners } = useQuery({
    queryKey: ['globalWinners', year],
    queryFn: async () => {
      const response = await api.get(`/winners/global/${year}`);
      return response.data;
    },
    enabled: !!year,
  });

  const markWinner = useMutation({
    mutationFn: async ({ categoryId, nomineeId }: { categoryId: string; nomineeId: string }) => {
      const response = await api.post('/winners/global', {
        year,
        categoryId,
        nomineeId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalWinners', year] });
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
    onError: (error: any) => {
      console.error('Failed to mark winner:', error);
    },
  });

  const unmarkWinner = useMutation({
    mutationFn: async ({ categoryId }: { categoryId: string }) => {
      const response = await api.delete(`/winners/global/${year}/${categoryId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalWinners', year] });
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
    onError: (error: any) => {
      console.error('Failed to unmark winner:', error);
    },
  });

  const handleNomineeSelect = (categoryId: string, nomineeId: string) => {
    const currentWinner = actualWinners?.find((w: any) => w.categoryId === categoryId);

    // If clicking the same nominee, deselect it (remove winner)
    if (currentWinner && currentWinner.nomineeId === nomineeId) {
      unmarkWinner.mutate({ categoryId });
      return;
    }

    // Mark the winner
    markWinner.mutate({ categoryId, nomineeId });
  };

  const getWinnerForCategory = (categoryId: string) => {
    return actualWinners?.find((w: any) => w.categoryId === categoryId);
  };

  if (user?.role !== 'SUPERUSER') {
    return null;
  }

  const markedCount = actualWinners?.length || 0;
  const totalCategories = categories?.length || 0;
  const isComplete = markedCount === totalCategories && totalCategories > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header ref={headerRef} className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Back Button - Left side */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 text-white hover:text-yellow-300 hover:bg-white/10 active:bg-white/20 rounded-full transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-red-600"
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

          {/* Logo - Right of back button */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-90 transition-opacity touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-red-600 rounded"
            aria-label="Go to home"
          >
            <img src="/images/logo.png" alt="Award Season" className="h-16 w-auto" />
            <span className="hidden sm:inline oscars-font text-lg sm:text-xl font-bold">
              AWARD SEASON
            </span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center justify-center px-4 py-2 min-h-[44px] text-white border-2 border-white/30 hover:border-white/50 hover:bg-white/10 active:bg-white/20 rounded-lg transition-all text-sm font-medium touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-red-600"
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Submission Header with Summary */}
        <div
          ref={submissionHeaderRef}
          className="bg-white rounded-lg shadow mb-6 overflow-hidden"
          id="submission-header"
        >
          {/* Submission Name Header */}
          <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <h2 className="oscars-font text-base sm:text-lg font-bold">
                🏆 Global Winners ({year})
              </h2>
              <div className="flex items-center gap-2">
                <label htmlFor="year-select" className="text-xs text-gray-300">
                  Year:
                </label>
                <select
                  id="year-select"
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setSelectedCategoryType(categoryGroups[0]?.name || null);
                  }}
                  className="px-3 py-1.5 text-sm rounded border border-gray-400 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={y} value={y.toString()}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-300 mt-1">
              These winners will apply to all pools for {year}
            </p>
          </div>

          {/* Summary Stats Cards */}
          {categories && (
            <div className="px-4 sm:px-6 py-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-gray-50 rounded p-2 sm:p-3 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Categories</p>
                  <p
                    className={`font-bold text-sm sm:text-base ${
                      isComplete ? 'text-green-600' : 'text-yellow-600'
                    }`}
                  >
                    {markedCount} / {totalCategories}
                    {isComplete && <span className="ml-1">✓</span>}
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-2 sm:p-3 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Status</p>
                  <p
                    className={`font-bold text-sm sm:text-base ${
                      isComplete ? 'text-green-600' : 'text-yellow-600'
                    }`}
                  >
                    {isComplete ? 'Complete' : 'In Progress'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-2 sm:p-3 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Year</p>
                  <p className="font-bold text-sm sm:text-base oscars-dark">{year}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="px-4 sm:px-6 py-3 border-t border-gray-200">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2.5 min-h-[44px] oscars-gold-bg text-white rounded hover:opacity-90 active:opacity-80 transition-opacity text-sm font-medium touch-manipulation"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Collapsed Sticky Submission Summary */}
        {categories && showStickySummary && (
          <div
            ref={stickySummaryRef}
            className="sticky bg-white border-b border-gray-200 z-30 py-3"
            style={{ top: `${headerHeight}px` }}
          >
            <div className="flex items-center justify-between px-4 md:px-6 gap-3">
              <span className="oscars-font font-bold oscars-dark text-sm md:text-base truncate flex-shrink min-w-0">
                Global Winners ({year})
              </span>
              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                {/* Desktop: Show full stats */}
                <div className="hidden md:flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Categories:</span>
                    <span
                      className={`font-semibold ${
                        isComplete ? 'text-green-600' : 'text-yellow-600'
                      }`}
                    >
                      {markedCount}/{totalCategories}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2.5 oscars-gold-bg text-white rounded hover:opacity-90 text-sm font-semibold min-h-[44px] flex items-center whitespace-nowrap"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Categories Navigation */}
        {categoriesLoading && (
          <div className="mb-6">
            <p className="text-gray-600">Loading categories...</p>
          </div>
        )}
        {categories && categories.length > 0 && (
          <div>
            {/* Tab Navigation - Sticky */}
            <div
              className="sticky bg-white z-20"
              style={{
                top: showStickySummary
                  ? `${headerHeight + stickySummaryHeight}px`
                  : `${headerHeight}px`,
              }}
            >
              <div className="bg-white rounded-t-lg border-b border-gray-200">
                <div className="flex -mb-px">
                  {categoryGroups.map((group) => {
                    const groupCategories = categories.filter((cat) =>
                      group.categoryIds.includes(cat.id),
                    );
                    if (groupCategories.length === 0) return null;

                    const markedCount = groupCategories.filter((cat) =>
                      getWinnerForCategory(cat.id),
                    ).length;
                    const totalCount = groupCategories.length;
                    const isComplete = markedCount === totalCount && totalCount > 0;
                    const isActive = selectedCategoryType === group.name;

                    return (
                      <button
                        key={group.name}
                        onClick={() => {
                          setSelectedCategoryType(group.name);
                          window.scrollTo({ top: 0, behavior: 'auto' });
                        }}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                          isActive
                            ? 'border-yellow-500 text-yellow-600 oscars-font'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {group.name}
                        <span
                          className={`ml-2 text-xs ${
                            isComplete ? 'text-green-600' : 'text-gray-400'
                          }`}
                        >
                          ({markedCount}/{totalCount})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tab Content */}
            {selectedCategoryType && (
              <div className="bg-white rounded-b-lg shadow p-3 md:p-6">
                <div className="space-y-4">
                  {categoryGroups
                    .find((group) => group.name === selectedCategoryType)
                    ?.categoryIds.map((categoryId) => {
                      const category = categories.find((cat) => cat.id === categoryId);
                      if (!category) return null;
                      const winner = getWinnerForCategory(category.id);

                      return (
                        <div key={category.id} className="bg-gray-50 p-2 md:p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="oscars-font text-base font-bold oscars-dark">
                              {category.name}
                              {winner && <span className="ml-2 text-green-600">✓</span>}
                            </h4>
                          </div>
                          <div className="space-y-2">
                            {category.nominees.map((nominee) => {
                              const isSelected = winner?.nomineeId === nominee.id;

                              return (
                                <div
                                  key={nominee.id}
                                  onClick={() => handleNomineeSelect(category.id, nominee.id)}
                                  className={`border-2 rounded-lg p-2 md:p-2.5 transition-all flex items-center gap-2 md:gap-3 ${
                                    isSelected
                                      ? 'border-yellow-400 bg-yellow-50 cursor-pointer'
                                      : 'border-gray-200 hover:border-yellow-300 cursor-pointer bg-white'
                                  }`}
                                >
                                  <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden flex items-center justify-center bg-gray-100">
                                    <img
                                      src={getNomineeImage(nominee, category.id, year)}
                                      alt={nominee.name}
                                      className="w-full h-full object-contain"
                                      onError={(e) => {
                                        console.error(
                                          `Failed to load image: ${getNomineeImage(nominee, category.id, year)}`,
                                        );
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        {nominee.film && nominee.name !== nominee.film && (
                                          <>
                                            <h4 className="font-bold text-base oscars-dark truncate">
                                              {nominee.name}
                                            </h4>
                                            <h4 className="font-normal text-xs text-gray-600 italic truncate mt-0.5">
                                              {nominee.film}
                                            </h4>
                                          </>
                                        )}
                                        {(!nominee.film || nominee.name === nominee.film) && (
                                          <h4 className="font-bold text-base oscars-dark truncate">
                                            {nominee.name}
                                          </h4>
                                        )}
                                        {(nominee as any).song && (
                                          <p className="text-xs text-gray-600 mt-0.5 truncate">
                                            {(nominee as any).song}
                                          </p>
                                        )}
                                      </div>
                                      {isSelected && (
                                        <span className="text-yellow-600 font-bold text-lg flex-shrink-0">
                                          ✓
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Next Tab Button */}
                {(() => {
                  const currentTabIndex = categoryGroups.findIndex(
                    (group) => group.name === selectedCategoryType,
                  );
                  const nextTab = categoryGroups[currentTabIndex + 1];

                  if (nextTab && categories) {
                    const nextTabCategories = categories.filter((cat) =>
                      nextTab.categoryIds.includes(cat.id),
                    );
                    if (nextTabCategories.length > 0) {
                      return (
                        <div className="mt-6 pt-6 border-t border-gray-200 flex justify-center">
                          <button
                            onClick={() => {
                              setSelectedCategoryType(nextTab.name);
                              window.scrollTo({ top: 0, behavior: 'auto' });
                            }}
                            className="px-6 py-3 oscars-gold-bg text-white rounded-lg hover:opacity-90 active:opacity-80 transition-opacity text-sm font-semibold min-h-[44px] flex items-center gap-2 touch-manipulation"
                          >
                            Next: {nextTab.name}
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
