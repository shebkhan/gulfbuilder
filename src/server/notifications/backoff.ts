const BACKOFF_MS = [60_000, 300_000, 1_500_000];

// Attempts 1-3 schedule the next try; attempt 4 is the final failure.
export function retryAt(attempts: number, from: Date): Date | null {
  const delay = BACKOFF_MS[attempts - 1];
  return delay === undefined ? null : new Date(from.getTime() + delay);
}
