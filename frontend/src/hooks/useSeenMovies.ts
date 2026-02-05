import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const buildStorageKey = (userId: string, year: string) => `seen-movies:${year}:${userId}`;

export function useSeenMovies({
  userId,
  year,
  targetUserId,
  readOnly = false,
}: {
  userId?: string | null;
  year: string;
  targetUserId?: string | null;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const effectiveUserId = targetUserId ?? userId ?? null;
  const isViewingOtherUser = Boolean(targetUserId && targetUserId !== userId);
  const queryKey = ['seen-movies', effectiveUserId, year];

  const { data: seenMovieIds = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const endpoint = isViewingOtherUser
        ? `/users/${targetUserId}/seen-movies/${year}`
        : `/seen-movies/${year}`;
      const response = await api.get(endpoint);
      return (response.data?.movieIds ?? []) as string[];
    },
    enabled: !!effectiveUserId && !!year,
  });

  const canEdit = Boolean(userId) && !readOnly && !isViewingOtherUser;

  const bulkSync = useMutation({
    mutationFn: async (movieIds: string[]) => {
      const response = await api.put(`/seen-movies/${year}`, { movieIds });
      return (response.data?.movieIds ?? []) as string[];
    },
    onSuccess: (movieIds) => {
      queryClient.setQueryData(queryKey, movieIds);
      if (userId) {
        const storageKey = buildStorageKey(userId, year);
        localStorage.removeItem(storageKey);
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ movieId, seen }: { movieId: string; seen: boolean }) => {
      await api.post(`/seen-movies/${year}`, { movieId, seen });
      return { movieId, seen };
    },
    onMutate: async ({ movieId, seen }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = (queryClient.getQueryData(queryKey) as string[]) ?? [];
      const next = seen
        ? Array.from(new Set([...previous, movieId]))
        : previous.filter((id) => id !== movieId);
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  useEffect(() => {
    if (!userId || !year || isLoading || bulkSync.isPending || !canEdit) return;
    const storageKey = buildStorageKey(userId, year);
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    if (seenMovieIds.length > 0) return;

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const sanitized = Array.from(new Set(parsed.filter((item) => typeof item === 'string')));
        if (sanitized.length > 0) {
          bulkSync.mutate(sanitized);
        } else {
          localStorage.removeItem(storageKey);
        }
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [userId, year, isLoading, seenMovieIds, bulkSync]);

  const seenSet = useMemo(() => new Set(seenMovieIds), [seenMovieIds]);

  const toggleSeen = (movieId: string) => {
    if (!canEdit) return;
    const isSeen = seenSet.has(movieId);
    toggleMutation.mutate({ movieId, seen: !isSeen });
  };

  return {
    seenMovieIds,
    seenSet,
    toggleSeen,
    isLoading,
    isSaving: toggleMutation.isPending || bulkSync.isPending,
    isReadOnly: !canEdit,
  };
}
