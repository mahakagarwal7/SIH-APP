import {
  clarificationRequestSchema,
  replyIsComplete,
  replySummary,
} from './followupContracts';

const id = '10000000-0000-4000-8000-000000000001';
const optionId = '10000000-0000-4000-8000-000000000002';
const question = clarificationRequestSchema.parse({
  id,
  project_id: id,
  claim_id: id,
  report_id: id,
  claim_version: 1,
  report_version: 1,
  version: 2,
  reason_code: 'location',
  question_text: 'Where did this work happen?',
  options: [{ activityId: optionId, label: 'Unit 2' }],
  automatic: true,
  status: 'open',
  created_at: '2026-09-24T00:00:00+00:00',
});

it('requires exactly one supported location answer mode', () => {
  expect(
    replyIsComplete(question, {
      answer: 'answer',
      text: '',
      activityIds: [optionId],
      eventDate: null,
    }),
  ).toBe(true);
  expect(
    replyIsComplete(question, {
      answer: 'answer',
      text: 'Unit 3',
      activityIds: [optionId],
      eventDate: null,
    }),
  ).toBe(false);
});

it('accepts all offered locations but caps an individual reply at eight', () => {
  const options = Array.from({ length: 9 }, (_, index) => ({
    activityId: `10000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
    label: `Unit ${index + 1}`,
  }));
  expect(
    clarificationRequestSchema.parse({ ...question, options }).options,
  ).toHaveLength(9);
  expect(
    replyIsComplete(question, {
      answer: 'answer',
      text: '',
      activityIds: options.map((option) => option.activityId),
      eventDate: null,
    }),
  ).toBe(false);
});

it('rejects impossible calendar dates and supports an explicit uncertain reply', () => {
  expect(
    replyIsComplete(
      { ...question, reason_code: 'date' },
      {
        answer: 'answer',
        text: '',
        activityIds: [],
        eventDate: '2026-02-30',
      },
    ),
  ).toBe(false);
  expect(
    replyIsComplete(question, {
      answer: 'not_sure',
      text: '',
      activityIds: [],
      eventDate: null,
    }),
  ).toBe(true);
});

it('summarizes the exact recorded structured reply', () => {
  expect(
    replySummary(question, {
      id,
      request_id: id,
      project_id: id,
      actor_id: id,
      question_version: 2,
      input: { answer: 'answer', activityIds: [optionId], text: '' },
      resulting_report_version: 2,
      created_at: '2026-09-24T00:01:00+00:00',
    }),
  ).toBe('Unit 2');
});
