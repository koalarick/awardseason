export const BALLOT_LOCK_TIMESTAMP = Date.UTC(2026, 2, 15, 23, 0, 0);
export const BALLOT_LOCK_DISPLAY = 'March 15, 2026 at 7:00 PM ET (4:00 PM PT)';

export const isBallotLocked = (now: Date = new Date()): boolean =>
  now.getTime() >= BALLOT_LOCK_TIMESTAMP;

export const assertBallotUnlocked = (): void => {
  if (isBallotLocked()) {
    throw new Error(`Ballot submissions are locked as of ${BALLOT_LOCK_DISPLAY}.`);
  }
};
