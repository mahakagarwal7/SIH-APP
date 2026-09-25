export type ReportClaimState =
  | 'pending'
  | 'clarification'
  | 'verification'
  | 'disputed'
  | 'accepted'
  | 'rejected'
  | 'observed'
  | 'unplanned'
  | 'superseded'
  | 'withdrawn';

export type ReportJobState =
  'queued' | 'running' | 'retry_wait' | 'succeeded' | 'failed';

export type ReportStatusInput = {
  id: string;
  current_version: number;
  lifecycle: 'draft' | 'submitted' | 'withdrawn';
  claims: {
    report_id: string;
    report_version: number;
    state: ReportClaimState | string;
  }[];
  jobs: {
    report_id: string;
    report_version: number;
    status: ReportJobState | string;
    error_code: string | null;
    claim_count?: number | null;
  }[];
};

export type ReportDeliveryStatus = {
  status: string;
  detail: string;
  terminal: boolean;
};

const terminalClaims = new Set([
  'accepted',
  'rejected',
  'observed',
  'unplanned',
  'withdrawn',
]);

export function reportDeliveryStatus(
  report: ReportStatusInput,
): ReportDeliveryStatus {
  if (
    report.lifecycle === 'withdrawn' ||
    report.jobs.some(
      (job) =>
        job.report_id === report.id && job.error_code === 'report_withdrawn',
    )
  )
    return {
      status: 'Withdrawn',
      detail: 'Withdrawn from the production project.',
      terminal: true,
    };
  if (report.lifecycle === 'draft')
    return {
      status: 'Server draft',
      detail: 'Evidence is still being prepared before confirmation.',
      terminal: false,
    };

  const currentVersionJob = report.jobs
    .filter(
      (job) =>
        job.report_id === report.id &&
        job.report_version === report.current_version,
    )
    .sort((left, right) => right.report_version - left.report_version)[0];
  if (currentVersionJob?.status === 'failed')
    return {
      status: 'Processing needs attention',
      detail: 'The current report version could not finish processing.',
      terminal: true,
    };
  if (currentVersionJob?.status === 'retry_wait')
    return {
      status: 'Waiting to retry',
      detail: 'The server will retry processing the current report version.',
      terminal: false,
    };
  if (
    currentVersionJob?.status === 'queued' ||
    currentVersionJob?.status === 'running'
  )
    return {
      status: 'Processing report',
      detail: 'The current report version is queued or still processing.',
      terminal: false,
    };
  if (
    currentVersionJob?.status === 'succeeded' &&
    currentVersionJob.claim_count === 0
  )
    return {
      status: 'No construction claims identified',
      detail:
        'Your report is saved. No construction event was identified, and the accepted schedule is unchanged.',
      terminal: true,
    };

  const claims = report.claims.filter(
    (claim) => claim.report_id === report.id && claim.state !== 'superseded',
  );
  if (!claims.some((claim) => claim.report_version === report.current_version))
    return {
      status: 'Processing report',
      detail:
        'The current report version has not produced visible outcomes yet.',
      terminal: false,
    };
  if (claims.length) {
    const terminal = claims.every((claim) => terminalClaims.has(claim.state));
    if (claims.every((claim) => claim.state === 'withdrawn'))
      return {
        status: 'Withdrawn',
        detail: 'Withdrawn from the production project.',
        terminal: true,
      };
    if (claims.some((claim) => claim.state === 'disputed'))
      return {
        status: 'Needs planner attention',
        detail: 'A planner must resolve conflicting report evidence.',
        terminal: false,
      };
    if (claims.some((claim) => claim.state === 'clarification'))
      return {
        status: 'Answer needed',
        detail: 'A reviewer requested clarification from the field.',
        terminal: false,
      };
    if (claims.some((claim) => claim.state === 'verification'))
      return {
        status: 'Supervisor check',
        detail: 'Independent verification is still pending.',
        terminal: false,
      };
    if (claims.every((claim) => claim.state === 'accepted'))
      return {
        status: 'Accepted',
        detail: 'Every extracted claim has been accepted.',
        terminal: true,
      };
    if (claims.some((claim) => claim.state === 'accepted'))
      return {
        status: 'Partly accepted',
        detail: terminal
          ? 'Some claims were accepted and others reached a different final outcome.'
          : 'Some claims are accepted while others still need review.',
        terminal,
      };
    if (claims.every((claim) => claim.state === 'rejected'))
      return {
        status: 'Rejected',
        detail: 'Every extracted claim was rejected.',
        terminal: true,
      };
    if (claims.every((claim) => claim.state === 'observed'))
      return {
        status: 'Observed — schedule unchanged',
        detail: 'The evidence was recorded without changing the schedule.',
        terminal: true,
      };
    if (claims.every((claim) => claim.state === 'unplanned'))
      return {
        status: 'Kept as unplanned',
        detail: 'The work remains recorded without an accepted plan activity.',
        terminal: true,
      };
    if (terminal)
      return {
        status: 'Final outcomes recorded',
        detail:
          'Every extracted claim has a final outcome, with different results.',
        terminal: true,
      };
    return {
      status: 'Needs review',
      detail: 'The report is ready for planner review.',
      terminal,
    };
  }

  return {
    status: 'Processing report',
    detail: 'The report reached production and current outcomes are loading.',
    terminal: false,
  };
}

export function needsReportPolling(reports: ReportStatusInput[]) {
  return reports.some(
    (report) =>
      report.lifecycle === 'submitted' &&
      !reportDeliveryStatus(report).terminal,
  );
}

export function nextReportPollDelay(current: number) {
  return Math.min(Math.max(current, 5_000) * 2, 60_000);
}
