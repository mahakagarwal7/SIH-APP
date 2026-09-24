import { getActiveLocaleTag } from '@/features/localization/LocalizationProvider';

const workDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toLocalWorkDate(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseLocalWorkDate(value: string) {
  const match = workDatePattern.exec(value);
  if (!match || match[1] === '0000') return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? parsed
    : null;
}

export function isSelectableWorkDate(value: string, now = new Date()) {
  const parsed = parseLocalWorkDate(value);
  return !!parsed && parsed.valueOf() <= startOfLocalDay(now).valueOf();
}

export function formatWorkDate(value: string, locale = getActiveLocaleTag()) {
  const parsed = parseLocalWorkDate(value);
  if (!parsed) return 'Not recorded';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}
