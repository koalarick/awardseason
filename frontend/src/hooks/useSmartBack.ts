import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavigationHistory } from '../context/NavigationHistoryContext';

type SmartBackOptions = {
  fallback?: string;
};

export function useSmartBack(options?: SmartBackOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const { getPreviousSafePath, isBlockedPathname } = useNavigationHistory();
  const fallback = options?.fallback ?? '/';

  return useCallback(() => {
    const currentPath = `${location.pathname}${location.search}`;
    const stateFrom =
      location.state &&
      typeof location.state === 'object' &&
      'from' in location.state &&
      typeof (location.state as { from?: unknown }).from === 'string'
        ? (location.state as { from: string }).from
        : null;

    const candidates = [stateFrom, getPreviousSafePath()];

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (candidate === currentPath) continue;

      const pathname = candidate.split('?')[0];
      if (isBlockedPathname(pathname)) continue;

      navigate(candidate, { replace: true });
      return;
    }

    navigate(fallback, { replace: true });
  }, [fallback, getPreviousSafePath, isBlockedPathname, location.pathname, location.search, location.state, navigate]);
}
