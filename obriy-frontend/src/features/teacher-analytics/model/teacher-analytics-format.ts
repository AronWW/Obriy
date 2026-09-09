export function formatAnalyticsPercent(
  value: number | null,
  noDataLabel: string,
): string {
  return value === null ? noDataLabel : `${value}%`
}

export function formatAnalyticsDate(
  value: string,
  language?: string,
): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en' : 'uk', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatAnalyticsDateTime(
  value: string,
  language?: string,
): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en' : 'uk', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatAnalyticsScore(
  points: number | null,
  maxPoints: number,
  percent: number | null,
  noDataLabel: string,
): string {
  if (points === null || percent === null) return noDataLabel
  return `${points} / ${maxPoints} · ${percent}%`
}
