import {
  needsReportPolling,
  nextReportPollDelay,
  reportDeliveryStatus,
} from './reportStatus';

const base = {
  id: 'report',
  current_version: 1,
  lifecycle: 'submitted' as const,
  claims: [] as {
    report_id: string;
    report_version: number;
    state: string;
  }[],
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
    detail: 'The current report version could not finish processing.',
    terminal: true,
  });
});

it('preserves actionable and terminal claim outcomes', () => {
  expect(
    reportDeliveryStatus({
      ...base,
      claims: [
        { report_id: 'report', report_version: 1, state: 'clarification' },
      ],
    }),
  ).toMatchObject({ status: 'Answer needed', terminal: false });
  expect(
    reportDeliveryStatus({
      ...base,
      claims: [
        { report_id: 'report', report_version: 1, state: 'accepted' },
        { report_id: 'report', report_version: 1, state: 'rejected' },
      ],
    }),
  ).toMatchObject({ status: 'Partly accepted', terminal: true });
  expect(
    reportDeliveryStatus({
      ...base,
      claims: [{ report_id: 'report', report_version: 1, state: 'observed' }],
    }),
  ).toMatchObject({
    status: 'Observed — schedule unchanged',
    terminal: true,
  });
});

it('prioritizes the current version job over outcomes from earlier versions', () => {
  const earlierAccepted = {
    ...base,
    current_version: 2,
    claims: [{ report_id: 'report', report_version: 1, state: 'accepted' }],
  };
  expect(
    reportDeliveryStatus({
      ...earlierAccepted,
      jobs: [
        {
          report_id: 'report',
          report_version: 1,
          status: 'succeeded',
          error_code: null,
        },
        {
          report_id: 'report',
          report_version: 2,
          status: 'running',
          error_code: null,
        },
      ],
    }),
  ).toMatchObject({ status: 'Processing report', terminal: false });
  expect(
    reportDeliveryStatus({
      ...earlierAccepted,
      jobs: [
        {
          report_id: 'report',
          report_version: 1,
          status: 'succeeded',
          error_code: null,
        },
        {
          report_id: 'report',
          report_version: 2,
          status: 'failed',
          error_code: 'attempts_exhausted',
        },
      ],
    }),
  ).toMatchObject({ status: 'Processing needs attention', terminal: true });
});

it('keeps polling until current-version claims are visible after extraction', () => {
  expect(
    reportDeliveryStatus({
      ...base,
      current_version: 2,
      claims: [{ report_id: 'report', report_version: 1, state: 'accepted' }],
      jobs: [
        {
          report_id: 'report',
          report_version: 2,
          status: 'succeeded',
          error_code: null,
        },
      ],
    }),
  ).toMatchObject({ status: 'Processing report', terminal: false });
});

it('finishes a verified zero-claim report without mistaking a pending claim read for it', () => {
  const succeeded = {
    report_id: 'report',
    report_version: 1,
    status: 'succeeded',
    error_code: null,
  };
  expect(
    reportDeliveryStatus({
      ...base,
      jobs: [{ ...succeeded, claim_count: 0 }],
    }),
  ).toEqual({
    status: 'No construction claims identified',
    detail:
      'Your report is saved. No construction event was identified, and the accepted schedule is unchanged.',
    terminal: true,
  });
  expect(
    reportDeliveryStatus({
      ...base,
      jobs: [{ ...succeeded, claim_count: 1 }],
    }),
  ).toMatchObject({ status: 'Processing report', terminal: false });
  expect(
    needsReportPolling([{ ...base, jobs: [{ ...succeeded, claim_count: 0 }] }]),
  ).toBe(false);
});

it('does not label mixed final claim outcomes as still needing review', () => {
  expect(
    reportDeliveryStatus({
      ...base,
      claims: [
        { report_id: 'report', report_version: 1, state: 'observed' },
        { report_id: 'report', report_version: 1, state: 'rejected' },
      ],
    }),
  ).toEqual({
    status: 'Final outcomes recorded',
    detail:
      'Every extracted claim has a final outcome, with different results.',
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
        jobs: [{ ...processing.jobs[0]!, status: 'succeeded' }],
        claims: [{ report_id: 'report', report_version: 1, state: 'accepted' }],
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
