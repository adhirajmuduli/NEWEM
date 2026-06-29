export type SearchDateMode = '' | '1' | '7' | '30' | 'custom';

export function exactLocalDayRange(date: Date) {
  if (Number.isNaN(date.getTime())) throw new Error('Selected date is invalid');
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return {
    publishedAfter: start.toISOString(),
    publishedBefore: new Date(end.getTime() - 1).toISOString(),
  };
}

export function relativeDateRange(mode: SearchDateMode, now = Date.now()) {
  if (mode === '' || mode === 'custom') return {};
  return { publishedAfter: new Date(now - Number(mode) * 86_400_000).toISOString() };
}