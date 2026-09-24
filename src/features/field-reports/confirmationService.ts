import { z } from 'zod';

import { snapshotSchema } from '@/features/projects/myWorkContracts';
import { getSupabase } from '@/lib/supabase';

import type { OutboxRecord } from './outbox';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ConfirmationActivity = {
  id: string;
  externalId: string;
  name: string;
  location: string;
};

const accessSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  active: z.literal(true),
});

export class ConfirmationReadError extends Error {
  constructor(
    message = 'Could not load authorized activities. Connect and retry.',
  ) {
    super(message);
  }
}

export async function loadConfirmationActivities(
  client: SupabaseClient<Database>,
  record: OutboxRecord,
  signal?: AbortSignal,
): Promise<ConfirmationActivity[]> {
  let accessQuery = client
    .from('project_members')
    .select('project_id,user_id,active')
    .eq('project_id', record.projectId)
    .eq('user_id', record.userId)
    .eq('active', true);
  if (signal) accessQuery = accessQuery.abortSignal(signal);
  const access = await accessQuery.maybeSingle();
  if (access.error || !access.data)
    throw new ConfirmationReadError('Project access is no longer available.');
  const parsedAccess = accessSchema.safeParse(access.data);
  if (
    !parsedAccess.success ||
    parsedAccess.data.project_id !== record.projectId ||
    parsedAccess.data.user_id !== record.userId
  )
    throw new ConfirmationReadError('Project access is no longer available.');

  let snapshotQuery = client.rpc('schedule_snapshot', {
    p_project: record.projectId,
  });
  if (signal) snapshotQuery = snapshotQuery.abortSignal(signal);
  const result = await snapshotQuery;
  if (result.error || result.data === null) throw new ConfirmationReadError();
  const parsed = snapshotSchema.safeParse(result.data);
  if (
    !parsed.success ||
    parsed.data.projectId !== record.projectId ||
    new Set(parsed.data.activities.map((activity) => activity.id)).size !==
      parsed.data.activities.length
  )
    throw new ConfirmationReadError();
  return parsed.data.activities
    .map(({ id, externalId, name, location }) => ({
      id,
      externalId,
      name,
      location,
    }))
    .sort(
      (left, right) =>
        left.externalId.localeCompare(right.externalId) ||
        left.id.localeCompare(right.id),
    );
}

export function getConfirmationClient() {
  const client = getSupabase();
  if (!client) throw new ConfirmationReadError();
  return client;
}
