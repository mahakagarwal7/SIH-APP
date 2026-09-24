import { QueryClient } from '@tanstack/react-query';

import { removeClaimFromReviewCache } from './decisionCache';

import type { ReviewQueuePage } from './reviewQueueService';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const otherProjectId = '10000000-0000-4000-8000-000000000003';
const claimId = '10000000-0000-4000-8000-000000000004';
const memberVersion = 1;

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

  removeClaimFromReviewCache(client, userId, projectId, memberVersion, claimId);
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

  removeClaimFromReviewCache(client, userId, projectId, memberVersion, claimId);
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

it('does not advertise an empty next page when removal leaves the page short', () => {
  const client = new QueryClient();
  const ids = [
    claimId,
    ...Array.from({ length: 19 }, (_, index) => `claim-${index}`),
  ];
  client.setQueryData(['review-queue', userId, projectId, 1, 0], page(ids));

  removeClaimFromReviewCache(client, userId, projectId, memberVersion, claimId);

  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      0,
    ]),
  ).toMatchObject({ items: expect.any(Array), total: 20, hasNext: false });
  client.clear();
});

it('keeps a cached spillover claim reachable after removing from a full first page', () => {
  const client = new QueryClient();
  const firstPageIds = [
    claimId,
    ...Array.from({ length: 19 }, (_, index) => `claim-${index}`),
  ];
  client.setQueryData(
    ['review-queue', userId, projectId, 1, 0],
    page(firstPageIds),
  );
  client.setQueryData(['review-queue', userId, projectId, 1, 1], {
    ...page(['spillover'], 21),
    page: 1,
  });

  removeClaimFromReviewCache(client, userId, projectId, memberVersion, claimId);

  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      0,
    ]),
  ).toMatchObject({ items: expect.any(Array), total: 20, hasNext: true });
  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      1,
    ]),
  ).toMatchObject({ items: [{ claim: { id: 'spillover' } }], total: 20 });
  client.clear();
});

it('keeps later cached pages reachable when an earlier page loses a claim', () => {
  const client = new QueryClient();
  const firstPageIds = [
    claimId,
    ...Array.from({ length: 19 }, (_, index) => `first-${index}`),
  ];
  const secondPageIds = Array.from(
    { length: 20 },
    (_, index) => `second-${index}`,
  );
  client.setQueryData(
    ['review-queue', userId, projectId, 1, 0],
    page(firstPageIds, 41),
  );
  client.setQueryData(['review-queue', userId, projectId, 1, 1], {
    ...page(secondPageIds, 41),
    page: 1,
  });
  client.setQueryData(['review-queue', userId, projectId, 1, 2], {
    ...page(['spillover'], 41),
    page: 2,
  });

  removeClaimFromReviewCache(client, userId, projectId, memberVersion, claimId);

  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      1,
    ]),
  ).toMatchObject({ total: 40, hasNext: true });
  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      2,
    ]),
  ).toMatchObject({ items: [{ claim: { id: 'spillover' } }], total: 40 });
  client.clear();
});

it('does not leave a phantom next page when removing its only cached claim', () => {
  const client = new QueryClient();
  const firstPageIds = Array.from(
    { length: 20 },
    (_, index) => `first-${index}`,
  );
  client.setQueryData(
    ['review-queue', userId, projectId, 1, 0],
    page(firstPageIds),
  );
  client.setQueryData(['review-queue', userId, projectId, 1, 1], {
    ...page([claimId]),
    page: 1,
  });

  removeClaimFromReviewCache(client, userId, projectId, memberVersion, claimId);

  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      0,
    ]),
  ).toMatchObject({ total: 20, hasNext: false });
  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      1,
      1,
    ]),
  ).toMatchObject({ items: [], total: 20, hasNext: false });
  client.clear();
});

it('keeps pagination isolated from older membership versions', () => {
  const client = new QueryClient();
  const olderPage = { ...page(['older-membership']), page: 1 };
  const currentPage = { ...page([claimId], 1), hasNext: false };
  client.setQueryData(
    ['review-queue', userId, projectId, memberVersion, 1],
    olderPage,
  );
  client.setQueryData(
    ['review-queue', userId, projectId, memberVersion + 1, 0],
    currentPage,
  );

  removeClaimFromReviewCache(
    client,
    userId,
    projectId,
    memberVersion + 1,
    claimId,
  );

  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      memberVersion + 1,
      0,
    ]),
  ).toMatchObject({ items: [], total: 0, hasNext: false });
  expect(
    client.getQueryData<ReviewQueuePage>([
      'review-queue',
      userId,
      projectId,
      memberVersion,
      1,
    ]),
  ).toEqual(olderPage);
  client.clear();
});
