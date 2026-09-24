import { candidateReasons, candidateSchema } from './reviewContracts';

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
