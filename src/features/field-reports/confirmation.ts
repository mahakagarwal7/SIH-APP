import { OutboxSyncError } from './outbox';

import type { ConfirmedPayload } from './outbox';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

export function normalizeConfirmation(
  input: ConfirmedPayload,
): ConfirmedPayload {
  const text = input.text.trim();
  if (!text || text.length > 10_000)
    throw new OutboxSyncError(
      'Confirmed wording must contain 1 to 10,000 characters.',
      'local',
      false,
    );
  if (input.workDate !== null && !validDate(input.workDate))
    throw new OutboxSyncError('Enter a valid work date.', 'local', false);
  if (input.activityId !== null && !uuid.test(input.activityId))
    throw new OutboxSyncError(
      'Select a valid authorized activity.',
      'local',
      false,
    );
  return { text, workDate: input.workDate, activityId: input.activityId };
}
