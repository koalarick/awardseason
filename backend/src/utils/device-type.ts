export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';

export const getDeviceType = (userAgent?: string | null): DeviceType => {
  if (!userAgent) {
    return 'unknown';
  }

  const ua = userAgent.toLowerCase();

  if (/bot|spider|crawl|slurp|bingpreview|facebookexternalhit|embedly/.test(ua)) {
    return 'bot';
  }

  if (/ipad|tablet|kindle|silk|playbook/.test(ua)) {
    return 'tablet';
  }

  if (/mobi|iphone|ipod|android/.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
};
