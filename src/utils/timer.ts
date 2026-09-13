/**
 * Formats elapsed seconds into standard digital stopwatch display "HH:MM:SS"
 */
export function formatStopwatchTime(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Calculates real-time elapsed seconds from an ISO start timestamp stored in SQLite.
 * Ensures time is 100% resilient against app crashes, screen turning off,
 * lock screen, backgrounding, or device reboots using pure wall-clock time difference.
 * 
 * elapsed = Math.floor((Date.now() - startTimeMs) / 1000) - pausedSeconds
 */
export function calculateLiveElapsedSeconds(
  startTimeIso?: string | null,
  totalPausedSeconds: number = 0
): number {
  if (!startTimeIso) return 0;

  const startMs = new Date(startTimeIso).getTime();
  if (isNaN(startMs)) return 0;

  const nowMs = Date.now();
  const totalElapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  return Math.max(0, totalElapsed - Math.max(0, totalPausedSeconds));
}
