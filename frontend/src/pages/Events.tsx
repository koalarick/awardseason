import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getApiErrorMessage } from '../utils/apiErrors';
import { EVENT_LABEL_MAP, getEventBadgeClass, getEventLabel } from '../utils/eventLabels';
import { useSmartBack } from '../hooks/useSmartBack';

type EventRecord = {
  id: string;
  eventName: string;
  createdAt: string;
  userEmail?: string | null;
  deviceType?: string | null;
  metadata?: Record<string, unknown>;
};

type EventResponse = {
  events: EventRecord[];
  hasMore: boolean;
};

const PAGE_SIZE = 200;

type EventFilterOption = {
  label: string;
  value: string;
};

const PAGE_VIEW_FILTERS: EventFilterOption[] = [
  { label: 'Ballot View', value: 'page:ballot' },
  { label: 'Checklist View', value: 'page:checklist' },
  { label: 'Events View', value: 'page:events' },
  { label: 'Forgot Password View', value: 'page:forgot-password' },
  { label: 'Global Winners View', value: 'page:global-winners' },
  { label: 'Homepage View', value: 'page:homepage' },
  { label: 'Login View', value: 'page:login' },
  { label: 'Metrics View', value: 'page:metrics' },
  { label: 'Nominee Metadata View', value: 'page:nominee-metadata' },
  { label: 'Nominees View', value: 'page:nominees' },
  { label: 'OAuth Callback View', value: 'page:oauth-callback' },
  { label: 'Pool Invite View', value: 'page:pool-invite' },
  { label: 'Pool View', value: 'page:pool' },
  { label: 'Register View', value: 'page:register' },
  { label: 'Reset Password View', value: 'page:reset-password' },
  { label: 'Users View', value: 'page:users' },
];

const createEmptyFilters = () => ({
  eventFilters: [] as string[],
  email: '',
  start: '',
  end: '',
  excludeSuperuser: true,
});

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const compact = (value?: string | null) => {
  if (!value) return '-';
  return value;
};

const toIsoString = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

export default function Events() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const goBack = useSmartBack({ fallback: '/superuser' });
  const eventMenuRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState(createEmptyFilters);
  const [draftFilters, setDraftFilters] = useState(createEmptyFilters);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isEventMenuOpen, setIsEventMenuOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!isEventMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!eventMenuRef.current) return;
      if (!eventMenuRef.current.contains(event.target as Node)) {
        setIsEventMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isEventMenuOpen]);

  const { data: eventNames = [], isLoading: isLoadingEventNames } = useQuery<string[]>({
    queryKey: ['event-names'],
    queryFn: async () => {
      const response = await api.get('/events/event-names');
      return response.data as string[];
    },
    enabled: user?.role === 'SUPERUSER',
  });

  const eventOptions = useMemo<EventFilterOption[]>(
    () =>
      eventNames
        .filter((name) => name !== 'page.view')
        .map((name) => ({
          value: `event:${name}`,
          label: EVENT_LABEL_MAP[name] ?? name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [eventNames],
  );

  const filterOptions = useMemo<EventFilterOption[]>(
    () =>
      [...PAGE_VIEW_FILTERS, ...eventOptions].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
      ),
    [eventOptions],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['events', filters],
    queryFn: async () => {
      const selectedEventNames = filters.eventFilters
        .filter((value) => value.startsWith('event:'))
        .map((value) => value.replace('event:', ''));
      const selectedPageViews = filters.eventFilters
        .filter((value) => value.startsWith('page:'))
        .map((value) => value.replace('page:', ''));

      const response = await api.get('/events', {
        params: {
          limit: PAGE_SIZE,
          eventNames: selectedEventNames.length ? selectedEventNames.join(',') : undefined,
          pageViews: selectedPageViews.length ? selectedPageViews.join(',') : undefined,
          email: filters.email || undefined,
          start: toIsoString(filters.start),
          end: toIsoString(filters.end),
          excludeSuperuser: filters.excludeSuperuser ? '1' : undefined,
        },
      });
      return response.data as EventResponse;
    },
    enabled: user?.role === 'SUPERUSER',
  });

  useEffect(() => {
    if (!data) return;
    setEvents(data.events || []);
    setHasMore(Boolean(data.hasMore));
    setLoadMoreError(null);
    setSelectedEvent(null);
  }, [data]);

  const handleApplyFilters = () => {
    setFilters({
      eventFilters: draftFilters.eventFilters,
      email: draftFilters.email.trim(),
      start: draftFilters.start,
      end: draftFilters.end,
      excludeSuperuser: draftFilters.excludeSuperuser,
    });
    setIsEventMenuOpen(false);
  };

  const handleClearFilters = () => {
    const cleared = createEmptyFilters();
    setDraftFilters(cleared);
    setFilters(cleared);
    setIsEventMenuOpen(false);
  };

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || events.length === 0) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const lastEvent = events[events.length - 1];
      const selectedEventNames = filters.eventFilters
        .filter((value) => value.startsWith('event:'))
        .map((value) => value.replace('event:', ''));
      const selectedPageViews = filters.eventFilters
        .filter((value) => value.startsWith('page:'))
        .map((value) => value.replace('page:', ''));

      const response = await api.get('/events', {
        params: {
          limit: PAGE_SIZE,
          before: lastEvent?.createdAt,
          eventNames: selectedEventNames.length ? selectedEventNames.join(',') : undefined,
          pageViews: selectedPageViews.length ? selectedPageViews.join(',') : undefined,
          email: filters.email || undefined,
          start: toIsoString(filters.start),
          end: toIsoString(filters.end),
          excludeSuperuser: filters.excludeSuperuser ? '1' : undefined,
        },
      });
      const payload = response.data as EventResponse;
      setEvents((prev) => [...prev, ...(payload.events || [])]);
      setHasMore(Boolean(payload.hasMore));
    } catch (err: unknown) {
      setLoadMoreError(getApiErrorMessage(err) ?? 'Failed to load more events.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [events, filters, hasMore, isLoadingMore]);

  useEffect(() => {
    if (!hasMore || isLoadingMore || !loadMoreRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [handleLoadMore, hasMore, isLoadingMore]);

  const errorMessage = isError ? getApiErrorMessage(error) ?? 'Failed to load events.' : null;

  const totalCountLabel = useMemo(() => {
    if (isLoading) return 'Loading events...';
    if (!events.length) return 'No events yet.';
    return `${events.length} event${events.length === 1 ? '' : 's'} loaded`;
  }, [events.length, isLoading]);

  const selectedEventCount = draftFilters.eventFilters.length;

  const toggleEventFilter = (value: string) => {
    setDraftFilters((prev) => {
      const exists = prev.eventFilters.includes(value);
      return {
        ...prev,
        eventFilters: exists
          ? prev.eventFilters.filter((entry) => entry !== value)
          : [...prev.eventFilters, value],
      };
    });
  };

  useEffect(() => {
    if (!selectedEvent) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedEvent(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedEvent]);

  if (user?.role !== 'SUPERUSER') {
    return null;
  }

  const poolName =
    selectedEvent && typeof selectedEvent.metadata?.poolName === 'string'
      ? selectedEvent.metadata.poolName
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={goBack}
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="oscars-font text-2xl sm:text-3xl oscars-dark font-bold">Events</h1>
            <p className="text-sm text-gray-600">{totalCountLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="px-4 py-2 min-h-[40px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium"
            >
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <section className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative" ref={eventMenuRef}>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Event Names
              </label>
              <button
                type="button"
                onClick={() => setIsEventMenuOpen((prev) => !prev)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-yellow-300"
              >
                {selectedEventCount > 0
                  ? `${selectedEventCount} selected`
                  : 'All events'}
              </button>
              {isEventMenuOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
                    <span className="text-xs text-gray-500">{selectedEventCount} selected</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          eventFilters: [],
                        }))
                      }
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Clear
                    </button>
                  </div>
                  {isLoadingEventNames ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Loading events...</div>
                  ) : filterOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No events yet.</div>
                  ) : (
                    <div className="py-1">
                      {filterOptions.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={draftFilters.eventFilters.includes(option.value)}
                            onChange={() => toggleEventFilter(option.value)}
                            className="h-4 w-4"
                          />
                          <span className="truncate">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Email
              </label>
              <input
                value={draftFilters.email}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Start (local)
              </label>
              <input
                type="datetime-local"
                value={draftFilters.start}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                End (local)
              </label>
              <input
                type="datetime-local"
                value={draftFilters.end}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 min-h-[40px] bg-gray-900 text-white rounded hover:bg-gray-800 active:bg-gray-900 transition-colors text-sm font-medium"
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 min-h-[40px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium"
            >
              Clear
            </button>
            <div className="ml-auto flex items-center">
              <label className="flex items-center gap-2 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                <input
                  type="checkbox"
                  checked={draftFilters.excludeSuperuser}
                  onChange={(e) => {
                    const nextValue = e.target.checked;
                    setDraftFilters((prev) => ({
                      ...prev,
                      excludeSuperuser: nextValue,
                    }));
                    setFilters((prev) => ({
                      ...prev,
                      excludeSuperuser: nextValue,
                    }));
                  }}
                  className="h-4 w-4"
                />
                Exclude Superusers
              </label>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mb-4 px-4 py-3 border border-red-200 bg-red-50 text-red-700 rounded">
            {errorMessage}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-6 text-sm text-gray-600">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">No events match those filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Time</th>
                    <th className="text-left px-3 py-2 font-semibold">Event</th>
                    <th className="text-left px-3 py-2 font-semibold">User</th>
                    <th className="text-left px-3 py-2 font-semibold">Device</th>
                    <th className="text-right px-3 py-2 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map((event) => {
                    const eventLabel = getEventLabel(event);
                    return (
                      <tr key={event.id} className="align-top">
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {formatDateTime(event.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${getEventBadgeClass(
                              event.eventName,
                            )}`}
                          >
                            {eventLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-700 max-w-[220px]">
                          <span className="break-all">{compact(event.userEmail)}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 uppercase text-[11px] tracking-wide">
                          {event.deviceType || '-'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedEvent(event)}
                            className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {loadMoreError && (
          <div className="mt-4 px-4 py-3 border border-red-200 bg-red-50 text-red-700 rounded">
            {loadMoreError}
          </div>
        )}

        <div className="mt-4 flex flex-col items-center gap-2">
          <div ref={loadMoreRef} />
          {hasMore ? (
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-4 py-2 min-h-[40px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 active:bg-gray-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isLoadingMore ? 'Loading more...' : 'Load older events'}
            </button>
          ) : (
            <p className="text-xs text-gray-500">No more events.</p>
          )}
        </div>
      </main>

      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Event Details</p>
                <p className="text-sm font-semibold text-gray-800">
                  {getEventLabel(selectedEvent)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-sm font-semibold text-gray-600 hover:text-gray-900"
              >
                Close
              </button>
            </div>
            <div className="px-4 py-3 text-xs text-gray-700">
              <div className="flex flex-wrap gap-4 mb-3">
                <div>
                  <span className="text-gray-500">Time</span>
                  <p className="font-semibold">{formatDateTime(selectedEvent.createdAt)}</p>
                </div>
                <div>
                  <span className="text-gray-500">User</span>
                  <p className="font-semibold">{compact(selectedEvent.userEmail)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Device</span>
                  <p className="font-semibold uppercase">
                    {selectedEvent.deviceType || '-'}
                  </p>
                </div>
              </div>
              {poolName && (
                <div className="mb-3 text-xs text-gray-700">
                  <span className="text-gray-500">Pool</span>
                  <p className="font-semibold">{poolName}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Metadata</span>
                <pre className="mt-2 bg-gray-50 border border-gray-200 rounded p-2 text-[11px] whitespace-pre-wrap break-words max-h-[50vh] overflow-auto">
                  {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
