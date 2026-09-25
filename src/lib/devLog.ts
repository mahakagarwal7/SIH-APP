export function warnInDevelopment(message: string, error: unknown) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console -- Development diagnostics must expose failed backend calls.
  console.warn(`[Nirmaan] ${message}`, error);
}
