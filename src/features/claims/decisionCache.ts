import type { ReviewQueuePage } from './reviewQueueService';
import type { QueryClient } from '@tanstack/react-query';

export function removeClaimFromReviewCache(
  queryClient: QueryClient,
  userId: string,
  projectId: string,
  memberVersion: number,
  claimId: string,
) {
  const queryKey = ['review-queue', userId, projectId, memberVersion] as const;
  const cachedPages = queryClient
    .getQueriesData<ReviewQueuePage>({ queryKey })
    .filter(([key]) => key[3] === memberVersion);
  if (
    !cachedPages.some(([, page]) =>
      page?.items.some((item) => item.claim.id === claimId),
    )
  )
    return;
  const hasCachedItemsAfter = (pageIndex: number) =>
    cachedPages.some(([key, page]) => {
      const cachedPageIndex = key[4];
      return (
        typeof cachedPageIndex === 'number' &&
        cachedPageIndex > pageIndex &&
        !!page?.items.some((item) => item.claim.id !== claimId)
      );
    });
  queryClient.setQueriesData<ReviewQueuePage>({ queryKey }, (page) => {
    if (!page) return page;
    const items = page.items.filter((item) => item.claim.id !== claimId);
    const total = Math.max(0, page.total - 1);
    return {
      ...page,
      items,
      total,
      hasNext:
        (page.page + 1) * page.pageSize < total ||
        hasCachedItemsAfter(page.page),
    };
  });
}
