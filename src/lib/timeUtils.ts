export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

export function formatTime(date: Date | string, timezone: string = 'America/Chicago'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDateTime(date: Date | string, timezone: string = 'America/Chicago'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function calculateWorkingSeconds(
  clockInAt: string,
  clockOutAt: string | null,
  breakSeconds: number,
  breakOpenAt: string | null
): number {
  const clockIn = new Date(clockInAt);
  const clockOut = clockOutAt ? new Date(clockOutAt) : new Date();
  
  let totalSeconds = Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000);
  
  // Subtract accumulated break time
  totalSeconds -= breakSeconds;
  
  // Subtract current break time if on break
  if (breakOpenAt) {
    const breakStart = new Date(breakOpenAt);
    const currentBreakSeconds = Math.floor((new Date().getTime() - breakStart.getTime()) / 1000);
    totalSeconds -= currentBreakSeconds;
  }
  
  return Math.max(0, totalSeconds);
}