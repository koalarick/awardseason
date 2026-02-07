import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const MIN_INTERVAL_MS = 3000;

export default function PageViewTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const lastPathRef = useRef<string | null>(null);
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const viewerId = user?.id;
    const path = `${location.pathname}${location.search}`;
    const now = Date.now();

    if (lastPathRef.current === path && now - lastSentAtRef.current < MIN_INTERVAL_MS) {
      return;
    }

    const referrer = lastPathRef.current || document.referrer || undefined;
    const screen = {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    };

    const searchParams = new URLSearchParams(location.search);
    const targetUserId = searchParams.get('userId') || undefined;
    const viewerUserId = viewerId;
    const isBallotView = /^\/pool\/[^/]+\/edit$/.test(location.pathname);
    const isChecklistView = location.pathname === '/movies/seen';
    let viewScope: 'self' | 'other' | 'unknown' | undefined;

    if ((isBallotView || isChecklistView) && targetUserId) {
      if (!viewerUserId) {
        viewScope = 'unknown';
      } else {
        viewScope = targetUserId === viewerUserId ? 'self' : 'other';
      }
    } else if (isBallotView || isChecklistView) {
      viewScope = 'self';
    }

    void api
      .post('/events/page-view', {
        path,
        title: document.title || undefined,
        referrer,
        screen,
        viewScope,
        targetUserId,
      })
      .catch(() => undefined);

    lastPathRef.current = path;
    lastSentAtRef.current = now;
  }, [location.pathname, location.search, user?.id]);

  return null;
}
