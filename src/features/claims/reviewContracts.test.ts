import {
  candidateReasons,
  candidateSchema,
  claimFactsSchema,
  stableCommand,
  validWorkDate,
} from './reviewContracts';

const candidate = candidateSchema.parse({
  claim_id: '10000000-0000-4000-8000-000000000001',
  project_id: '10000000-0000-4000-8000-000000000002',
  activity_id: '10000000-0000-4000-8000-000000000003',
  revision_id: '10000000-0000-4000-8000-000000000004',
  rank: 1,
  score: 0.82,
  features: { description: 0.8, location: 1, assignment: 0 },
  mismatch_flags: [],
});

it('explains positive candidate signals in strongest-first order', () => {
  expect(candidateReasons(candidate)).toEqual([
    'Same work location',
    'Matching activity description',
  ]);
});

it('shows explicit mismatch reasons instead of implying a clean match', () => {
  expect(
    candidateReasons({
      ...candidate,
      mismatch_flags: ['Different location', 'Different activity stage'],
    }),
  ).toEqual(['Different location', 'Different activity stage']);
});

it('uses an honest fallback when the matcher recorded no named signal', () => {
  expect(candidateReasons({ ...candidate, features: {} })).toEqual([
    'Candidate identified by the matcher',
  ]);
});

it('accepts production-valid nullable text and preserves observation-v2 facts', () => {
  const observation = {
    version: 2 as const,
    dateBasis: 'missing' as const,
    dateEvidence: '',
    quantityCoverage: 'unknown' as const,
    component: null,
    dailyQuantity: { value: 0, unit: '' },
    items: ['ITEM-01'],
    coverageStart: null,
    coverageEnd: null,
    percent: { value: 20, basis: 'unspecified' as const },
    inspectionRelation: null,
  };
  const parsed = claimFactsSchema.safeParse({
    kind: 'PERCENT_PROGRESS',
    activityHint: '',
    assetTag: null,
    location: '',
    stage: '',
    discipline: null,
    scope: 'unknown',
    fullScope: false,
    eventDate: null,
    dateOrigin: 'unknown',
    quantity: { value: 0, unit: '', mode: 'delta' },
    evidenceQuote: '20 percent reported',
    qualifiers: [],
    missingFields: [],
    observation,
  });

  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.observation).toEqual(observation);
});

it('reuses a command ID only while the exact payload remains unchanged', () => {
  let sequence = 0;
  const createId = () => `id-${++sequence}`;
  const first = stableCommand(
    null,
    { action: 'reject', reason: 'Duplicate' },
    createId,
  );
  const retry = stableCommand(
    first,
    { action: 'reject', reason: 'Duplicate' },
    createId,
  );
  const changed = stableCommand(
    retry,
    { action: 'reject', reason: 'New evidence' },
    createId,
  );
  expect(retry.id).toBe(first.id);
  expect(changed.id).not.toBe(first.id);
});

it('validates real calendar dates before a decision reaches production', () => {
  expect(validWorkDate('2028-02-29')).toBe(true);
  expect(validWorkDate('2026-02-30')).toBe(false);
});
