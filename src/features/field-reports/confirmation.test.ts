import { normalizeConfirmation } from './confirmation';

it('normalizes the exact backend submission payload', () => {
  expect(
    normalizeConfirmation({
      text: '  Two of eight complete; six remain unfinished.  ',
      workDate: '2026-09-24',
      activityId: '40000000-0000-4000-8000-000000000004',
    }),
  ).toEqual({
    text: 'Two of eight complete; six remain unfinished.',
    workDate: '2026-09-24',
    activityId: '40000000-0000-4000-8000-000000000004',
  });
});

it('rejects blank wording, invalid calendar dates and invalid activity ids', () => {
  expect(() =>
    normalizeConfirmation({ text: ' ', workDate: null, activityId: null }),
  ).toThrow('wording');
  expect(() =>
    normalizeConfirmation({
      text: 'Progress recorded.',
      workDate: '2026-02-30',
      activityId: null,
    }),
  ).toThrow('date');
  expect(() =>
    normalizeConfirmation({
      text: 'Progress recorded.',
      workDate: null,
      activityId: 'not-an-id',
    }),
  ).toThrow('activity');
});

it('rejects year zero before locking a payload that the database cannot accept', () => {
  expect(() =>
    normalizeConfirmation({
      text: 'Progress recorded.',
      workDate: '0000-01-01',
      activityId: null,
    }),
  ).toThrow('date');
});
