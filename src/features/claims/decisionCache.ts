import type { ReviewQueuePage } from './reviewQueueService';
import type { QueryClient } from '@tanstack/react-query';

export function removeClaimFromReviewCache(
  queryClient: QueryClient,
  userId: string,
  projectId: string,
  claimId: string,
) {
  const queryKey = ['review-queue', userId, projectId] as const;
  const cachedPages = queryClient.getQueriesData<ReviewQueuePage>({ queryKey });
  if (
    !cachedPages.some(([, page]) =>
      page?.items.some((item) => item.claim.id === claimId),
    )
  )
    return;
  queryClient.setQueriesData<ReviewQueuePage>({ queryKey }, (page) => {
    if (!page) return page;
    const items = page.items.filter((item) => item.claim.id !== claimId);
    return { ...page, items, total: Math.max(0, page.total - 1) };
  });
}
