import {
  needsReportPolling,
  nextReportPollDelay,
  reportDeliveryStatus,
} from './reportStatus';

const base = {
  id: 'report',
  lifecycle: 'submitted' as const,
  claims: [] as { report_id: string; state: string }[],
  jobs: [] as {
    report_id: string;
    report_version: number;
    status: string;
    error_code: string | null;
  }[],
};

it('keeps extraction, retry and terminal processing failures distinct', () => {
  expect(
    reportDeliveryStatus({
      ...base,
      jobs: [
        {
          report_id: 'report',
          report_version: 1,
          status: 'running',
          error_code: null,
        },
      ],
    }),
  ).toMatchObject({ status: 'Processing report', terminal: false });
  expect(
    reportDeliveryStatus({
      ...base,
      jobs: [
        {
          report_id: 'report',
          report_version: 1,
          status: 'retry_wait',
          error_code: 'provider_timeout',
        },
      ],
    }),
  ).toMatchObject({ status: 'Waiting to retry', terminal: false });
  expect(
    reportDeliveryStatus({
      ...base,
      jobs: [
        {
          report_id: 'report',
          report_version: 1,
          status: 'failed',
          error_code: 'attempts_exhausted',
        },
      ],
    }),
  ).toEqual({
    status: 'Processing needs attention',
    detail: 'The report reached production, but processing could not finish.',
    terminal: true,
  });
});

it('preserves actionable and terminal claim outcomes', () => {
  expect(
    reportDeliveryStatus({
      ...base,
      claims: [{ report_id: 'report', state: 'clarification' }],
    }),
  ).toMatchObject({ status: 'Answer needed', terminal: false });
  expect(
    reportDeliveryStatus({
      ...base,
      claims: [
        { report_id: 'report', state: 'accepted' },
        { report_id: 'report', state: 'rejected' },
      ],
    }),
  ).toMatchObject({ status: 'Partly accepted', terminal: true });
  expect(
    reportDeliveryStatus({
      ...base,
      claims: [{ report_id: 'report', state: 'observed' }],
    }),
  ).toMatchObject({
    status: 'Observed — schedule unchanged',
    terminal: true,
  });
});

it('polls only submitted reports with a nonterminal outcome', () => {
  const processing = {
    ...base,
    jobs: [
      {
        report_id: 'report',
        report_version: 1,
        status: 'queued',
        error_code: null,
      },
    ],
  };
  expect(needsReportPolling([processing])).toBe(true);
  expect(
    needsReportPolling([
      {
        ...processing,
        claims: [{ report_id: 'report', state: 'accepted' }],
      },
    ]),
  ).toBe(false);
  expect(
    needsReportPolling([{ ...processing, lifecycle: 'withdrawn' as const }]),
  ).toBe(false);
});

it('uses bounded exponential delays', () => {
  expect(nextReportPollDelay(5_000)).toBe(10_000);
  expect(nextReportPollDelay(40_000)).toBe(60_000);
  expect(nextReportPollDelay(60_000)).toBe(60_000);
});
