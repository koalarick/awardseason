import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

type NavigationHistoryContextValue = {
  getPreviousSafePath: () => string | null;
  isBlockedPathname: (pathname: string) => boolean;
};

const NavigationHistoryContext = createContext<NavigationHistoryContextValue | null>(null);

const ALWAYS_BLOCKED = [
  /^\/auth\/callback$/,
  /^\/pool\/new$/,
  /^\/pool\/[^/]+\/invite$/,
  /^\/reset-password$/,
  /^\/pool\/[^/]+\/edit$/,
];

const AUTH_ONLY_BLOCKED = [/^\/login$/, /^\/register$/, /^\/forgot-password$/];

const matchesAny = (pathname: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(pathname));

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAuthed = Boolean(user);

  const currentPathRef = useRef('');
  const lastSafePathRef = useRef<string | null>(null);
  const prevSafePathRef = useRef<string | null>(null);

  const isBlockedPathname = useCallback(
    (pathname: string) => {
      if (matchesAny(pathname, ALWAYS_BLOCKED)) {
        return true;
      }
      if (isAuthed && matchesAny(pathname, AUTH_ONLY_BLOCKED)) {
        return true;
      }
      return false;
    },
    [isAuthed],
  );

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}`;
    currentPathRef.current = currentPath;

    if (isBlockedPathname(location.pathname)) {
      return;
    }

    if (lastSafePathRef.current !== currentPath) {
      prevSafePathRef.current = lastSafePathRef.current;
      lastSafePathRef.current = currentPath;
    }
  }, [location.pathname, location.search, isBlockedPathname]);

  const getPreviousSafePath = useCallback(() => {
    const currentPath = currentPathRef.current;
    const candidates = [lastSafePathRef.current, prevSafePathRef.current];

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (candidate === currentPath) continue;

      const pathname = candidate.split('?')[0];
      if (isBlockedPathname(pathname)) continue;

      return candidate;
    }

    return null;
  }, [isBlockedPathname]);

  const value = useMemo(
    () => ({
      getPreviousSafePath,
      isBlockedPathname,
    }),
    [getPreviousSafePath, isBlockedPathname],
  );

  return (
    <NavigationHistoryContext.Provider value={value}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavigationHistory() {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error('useNavigationHistory must be used within NavigationHistoryProvider');
  }
  return context;
}
