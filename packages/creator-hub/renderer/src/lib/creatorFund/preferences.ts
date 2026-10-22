const BANNER_DISMISSED_KEY = 'creator-hub:creator-fund-banner-dismissed';
const DEMO_DATA_KEY = 'creator-hub:creator-fund-demo-data';

/** Demo Worlds and analytics (`demo.ts`). On unless turned off from the POC menu. */
export function isDemoDataOn(): boolean {
  try {
    return localStorage.getItem(DEMO_DATA_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setDemoDataOn(on: boolean) {
  try {
    localStorage.setItem(DEMO_DATA_KEY, on ? 'on' : 'off');
  } catch {
    // Without storage the default (on) applies.
  }
}

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
