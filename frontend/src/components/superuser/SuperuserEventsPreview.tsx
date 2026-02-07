import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getEventBadgeClass, getEventLabel } from '../../utils/eventLabels';

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

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function SuperuserEventsPreview() {
  const { user } = useAuth();

  const {
    data,
    isLoading,
    isError,
  } = useQuery<EventResponse>({
    queryKey: ['events-preview'],
    queryFn: async () => {
      const response = await api.get('/events', {
        params: {
          limit: 10,
          excludeSuperuser: '1',
        },
      });
      return response.data as EventResponse;
    },
    enabled: user?.role === 'SUPERUSER',
  });

  const events = useMemo(() => data?.events ?? [], [data]);
  const previewEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      const safeATime = Number.isNaN(aTime) ? 0 : aTime;
      const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
      return safeBTime - safeATime;
    });
    return sorted.slice(0, 10);
  }, [events]);

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-gray-600">Loading events...</p>}
      {isError && <p className="text-sm text-red-600">Failed to load events.</p>}

      {!isLoading && !isError && previewEvents.length === 0 && (
        <p className="text-sm text-gray-600">No events yet.</p>
      )}

      {!isLoading && !isError && previewEvents.length > 0 && (
        <div className="space-y-2">
          {previewEvents.map((event) => (
            <div key={event.id} className="border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold oscars-dark">
                    {getEventLabel(event)}
                  </p>
                  <p className="text-xs text-gray-500">{formatDateTime(event.createdAt)}</p>
                  {event.userEmail && (
                    <p className="text-xs text-gray-500 truncate">User: {event.userEmail}</p>
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded ${getEventBadgeClass(
                    event.eventName,
                  )}`}
                >
                  {event.eventName === 'page.view' ? 'Page View' : 'Event'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
