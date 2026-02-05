const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

export const getFrontendUrl = (): string => {
  const raw =
    process.env.FRONTEND_URL ||
    process.env.CORS_ORIGIN ||
    DEFAULT_FRONTEND_URL;
  const primary = raw.split(',')[0]?.trim();
  const normalized = (primary && primary.length > 0 ? primary : DEFAULT_FRONTEND_URL).replace(
    /\/+$/,
    '',
  );
  if (!/^https?:\/\//i.test(normalized)) {
    return `https://${normalized}`;
  }
  return normalized;
};
