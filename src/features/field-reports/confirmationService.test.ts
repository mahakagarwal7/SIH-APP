import {
  ConfirmationReadError,
  loadConfirmationActivities,
} from './confirmationService';

import type { OutboxRecord } from './outbox';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Result = { data: unknown; error: unknown };

function chain(result: Result) {
  const value = {
    select: () => value,
    eq: () => value,
    abortSignal: () => value,
    maybeSingle: async () => result,
    then: (resolve: (input: Result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return value;
}

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000002';
const record = {
  userId,
  projectId,
} as OutboxRecord;
const activity = {
  id: '30000000-0000-4000-8000-000000000003',
  projectId,
  revisionId: '40000000-0000-4000-8000-000000000004',
  externalId: 'A-20',
  name: 'Install supports',
  discipline: 'Piping',
  location: 'Unit 4',
  assignedReporterId: userId,
  targetQuantity: 8,
  unit: 'supports',
  acceptedQuantity: 2,
  actualStart: null,
  actualFinish: null,
  reportedProgress: true,
};

it('shows only the activities returned by the current RLS-scoped snapshot', async () => {
  const from = jest.fn(() =>
    chain({
      data: { project_id: projectId, user_id: userId, active: true },
      error: null,
    }),
  );
  const rpc = jest.fn(() =>
    chain({
      data: {
        projectId,
        projectName: 'Site project',
        revisionId: activity.revisionId,
        activities: [activity],
      },
      error: null,
    }),
  );
  const client = { from, rpc } as unknown as SupabaseClient<Database>;
  await expect(loadConfirmationActivities(client, record)).resolves.toEqual([
    {
      id: activity.id,
      externalId: 'A-20',
      name: 'Install supports',
      location: 'Unit 4',
    },
  ]);
  expect(rpc).toHaveBeenCalledWith('schedule_snapshot', {
    p_project: projectId,
  });
});

it('does not offer activities after membership access is lost', async () => {
  const client = {
    from: () => chain({ data: null, error: null }),
  } as unknown as SupabaseClient<Database>;
  await expect(
    loadConfirmationActivities(client, record),
  ).rejects.toBeInstanceOf(ConfirmationReadError);
});
