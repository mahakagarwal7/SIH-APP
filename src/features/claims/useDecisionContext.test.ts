import { QueryClient } from '@tanstack/react-query';

import { removeClaimFromReviewCache } from './decisionCache';

import type { ReviewQueuePage } from './reviewQueueService';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const otherProjectId = '10000000-0000-4000-8000-000000000003';
const claimId = '10000000-0000-4000-8000-000000000004';

function page(ids: string[], total = 21): ReviewQueuePage {
  return {
    items: ids.map(
      (id) => ({ claim: { id } }) as ReviewQueuePage['items'][number],
    ),
    page: 0,
    pageSize: 20,
    total,
    hasNext: total > 20,
  };
}

it('removes a completed claim and updates every cached page count exactly once', () => {
  const client = new QueryClient();
  client.setQueryData(
    ['review-queue', userId, projectId, 1, 0],
    page([claimId]),
  );
  client.setQueryData(['review-queue', userId, projectId, 1, 1], page([]));
  client.setQueryData(
    ['review-queue', userId, otherProjectId, 1, 0],
    page([claimId]),
  );

  removeClaimFromReviewCache(client, userId, projectId, claimId);
  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      0,
    ]),
  ).toMatchObject({ items: [], total: 20 });
  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      1,
    ]),
  ).toMatchObject({ total: 20 });
  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      otherProjectId,
      1,
      0,
    ]),
  ).toMatchObject({ total: 21 });

  removeClaimFromReviewCache(client, userId, projectId, claimId);
  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      0,
    ])?.total,
  ).toBe(20);
  client.clear();
});
