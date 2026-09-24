import {
  formatWorkDate,
  isSelectableWorkDate,
  parseLocalWorkDate,
  toLocalWorkDate,
} from './workDate';

it('serializes a calendar day from device-local date fields', () => {
  expect(toLocalWorkDate(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05');
});

it('parses only real ISO calendar dates into local dates', () => {
  expect(parseLocalWorkDate('2024-02-29')).toEqual(new Date(2024, 1, 29));
  expect(parseLocalWorkDate('2026-02-30')).toBeNull();
  expect(parseLocalWorkDate('0000-01-01')).toBeNull();
});

it('allows today and earlier dates while rejecting future dates', () => {
  const today = new Date(2026, 8, 25, 20, 0);
  expect(isSelectableWorkDate('2026-09-25', today)).toBe(true);
  expect(isSelectableWorkDate('2026-09-24', today)).toBe(true);
  expect(isSelectableWorkDate('2026-09-26', today)).toBe(false);
});

it('formats a stored date as readable local calendar text', () => {
  expect(formatWorkDate('2026-09-20', 'en-GB')).toBe('20 Sept 2026');
});
