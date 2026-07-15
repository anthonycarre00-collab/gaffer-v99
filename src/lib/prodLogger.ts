/**
 * P2-FE-4: Gate console output behind dev mode.
 *
 * In production builds, silence console.info and console.debug to prevent
 * 125+ debug log calls from polluting the browser console and causing
 * minor performance overhead.
 *
 * console.warn and console.error are kept in production — they indicate
 * real problems that users should report.
 *
 * This file is imported once in main.tsx. No other file needs to change.
 */
if (!import.meta.env.DEV) {
  // Preserve original methods in case they're needed for debugging
  const originalInfo = console.info;
  const originalDebug = console.debug;

  // Silence verbose logging in production
  console.info = () => {};
  console.debug = () => {};

  // Expose originals for emergency debugging via devtools
  (window as unknown as Record<string, unknown>).__console = {
    info: originalInfo,
    debug: originalDebug,
  };
}
