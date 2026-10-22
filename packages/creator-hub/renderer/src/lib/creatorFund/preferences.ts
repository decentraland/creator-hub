const BANNER_DISMISSED_KEY = 'creator-hub:creator-fund-banner-dismissed';

export function isBannerDismissed(): boolean {
  try {
    return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBannerDismissed(dismissed: boolean) {
  try {
    if (dismissed) localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    else localStorage.removeItem(BANNER_DISMISSED_KEY);
  } catch {
    // Without storage the banner simply comes back next launch.
  }
}
