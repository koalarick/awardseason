export type MemberWithJoin = {
  userId: string;
  joinedAt?: Date | string | null;
};

export const buildFallbackNameMap = (
  members: MemberWithJoin[],
  label: string = 'Ballot'
) => {
  const sorted = [...members].sort((a, b) => {
    const aTime = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
    const bTime = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return a.userId.localeCompare(b.userId);
  });

  const map = new Map<string, string>();
  sorted.forEach((member, index) => {
    map.set(member.userId, `${label} #${index + 1}`);
  });
  return map;
};

export const resolveSubmissionName = (
  submissionName: string | null | undefined,
  fallbackName: string
) => {
  const trimmed = submissionName?.trim();
  return trimmed ? trimmed : fallbackName;
};
