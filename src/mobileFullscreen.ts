function isMobileDevice(): boolean {
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
  return Boolean(coarsePointer || mobileUserAgent);
}

function isStandalone(): boolean {
  return Boolean(
    window.matchMedia?.("(display-mode: fullscreen)")?.matches ||
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

function hasFullscreenElement(): boolean {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
}

function syncMobileViewport(): void {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--mobile-viewport-height", `${height}px`);
  document.documentElement.style.height = `${height}px`;
  document.body.style.height = `${height}px`;
}

async function enterFullscreen(): Promise<void> {
  if (isStandalone() || hasFullscreenElement()) return;

  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const request = root.requestFullscreen ?? root.webkitRequestFullscreen;

  if (request) {
    try {
      await request.call(root, { navigationUI: "hide" });
    } catch {
      try {
        await request.call(root);
      } catch {
        // A browser may still reject fullscreen despite a user gesture.
      }
    }
  } else {
    // iPhone Safari does not expose the Fullscreen API for normal pages.
    // Scrolling is the best browser-page fallback; installed PWA mode is true fullscreen.
    window.scrollTo(0, 1);
  }

  try {
    await screen.orientation?.lock?.("landscape");
  } catch {
    // Orientation locking is optional and browser-dependent.
  }

  syncMobileViewport();
}

if (isMobileDevice()) {
  syncMobileViewport();
  window.addEventListener("resize", syncMobileViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", syncMobileViewport, { passive: true });

  let attempted = false;
  const startFullscreenFromFirstTouch = () => {
    if (attempted) return;
    attempted = true;
    void enterFullscreen();
  };

  // Fullscreen is forbidden on page load. Capture the earliest permitted moment:
  // the user's first touch, before React handles the same interaction.
  document.addEventListener("pointerdown", startFullscreenFromFirstTouch, {
    capture: true,
    passive: true,
  });
  document.addEventListener("touchstart", startFullscreenFromFirstTouch, {
    capture: true,
    passive: true,
  });
}
