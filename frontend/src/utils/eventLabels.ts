export type EventLabelMetadata = Record<string, unknown> | undefined;

type EventLabelRecord = {
  eventName: string;
  metadata?: EventLabelMetadata;
};

export const EVENT_LABEL_MAP: Record<string, string> = {
  'user.registered': 'User Registered',
  'user.logged_in': 'User Logged In',
  'pool.created': 'Pool Created',
  'pool.invite_sent': 'Invite Sent',
  'pool.joined': 'Pool Joined',
  'prediction.submitted': 'Prediction Submitted',
  'winner.entered': 'Winner Entered',
  'seen_movies.updated': 'Seen Movies Updated',
  'pool.settings_updated': 'Pool Settings Updated',
  'api.request': 'API Request',
};

const normalizePath = (raw?: unknown) => {
  if (typeof raw !== 'string') return '';
  const path = raw.split('?')[0]?.trim();
  if (!path) return '';
  if (path === '/') return '/';
  return path.replace(/\/+$/, '');
};

const formatViewScope = (scope?: string) => {
  if (scope === 'other') return ' (Other)';
  if (scope === 'self') return ' (Self)';
  if (scope === 'unknown') return ' (Unknown)';
  return '';
};

export const getPageViewLabel = (rawPath?: unknown, viewScope?: unknown) => {
  const path = normalizePath(rawPath);
  if (!path) return 'Page View';

  if (path === '/') return 'Homepage View';
  if (path === '/login') return 'Login View';
  if (path === '/metrics') return 'Metrics View';
  if (path === '/register') return 'Register View';
  if (path === '/forgot-password') return 'Forgot Password View';
  if (path === '/reset-password') return 'Reset Password View';
  if (path === '/auth/callback') return 'OAuth Callback View';
  if (path === '/events') return 'Events View';
  if (path === '/users') return 'Users View';
  if (path === '/winners/global') return 'Global Winners View';
  if (path === '/nominees/metadata') return 'Nominee Metadata View';
  if (path === '/superuser') return 'Superuser Dashboard View';
  if (path === '/superuser/tools/test-email') return 'Superuser Test Email View';
  if (path === '/superuser/tools/pools-not-in') return 'Superuser Pools View';
  if (/^\/pool\/[^/]+\/edit$/.test(path)) {
    return `Ballot View${formatViewScope(typeof viewScope === 'string' ? viewScope : undefined)}`;
  }
  if (/^\/pool\/[^/]+\/invite$/.test(path)) return 'Pool Invite View';
  if (/^\/pool\/[^/]+$/.test(path)) return 'Pool View';
  if (/^\/nominees\/\d{4}$/.test(path)) return 'Nominees View';

  if (path === '/movies/seen') {
    return `Checklist View${formatViewScope(typeof viewScope === 'string' ? viewScope : undefined)}`;
  }

  return 'Page View';
};

export const getEventLabel = (event: EventLabelRecord) => {
  if (event.eventName === 'page.view') {
    return getPageViewLabel(event.metadata?.path, event.metadata?.viewScope);
  }

  return EVENT_LABEL_MAP[event.eventName] ?? event.eventName;
};

export const getEventBadgeClass = (eventName: string) => {
  if (eventName === 'page.view') {
    return 'bg-blue-50 text-blue-700';
  }

  return 'bg-yellow-50 text-yellow-700';
};
