import { useEffect, useState } from 'react';
import { isBallotLocked, BALLOT_LOCK_TIMESTAMP } from '../utils/ballotLock';

const CHECK_INTERVAL_MS = 60_000;

export const useBallotLock = (): boolean => {
  const [locked, setLocked] = useState(() => isBallotLocked());

  useEffect(() => {
    if (locked) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleCheck = () => {
      const now = Date.now();
      const msUntilLock = BALLOT_LOCK_TIMESTAMP - now;
      if (msUntilLock <= 0) {
        setLocked(true);
        return;
      }
      const delay = Math.min(msUntilLock, CHECK_INTERVAL_MS);
      timeoutId = setTimeout(() => {
        if (isBallotLocked()) {
          setLocked(true);
          return;
        }
        scheduleCheck();
      }, delay);
    };

    scheduleCheck();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [locked]);

  return locked;
};
