import { withDraftMutation } from './draftMutations';
import { getVoiceDraftStore } from './nativeDraftStore';
import { getReportDraftStore } from './nativeReportDraftStore';
import { notifyOutboxWork } from './outboxEvents';

import type { VoiceDraft } from './draftStore';
import type { PreparedDraftPhoto, ReportDraft } from './reportDraftStore';

export async function saveCombinedVoiceDraft(
  voice: VoiceDraft,
  bytes: Uint8Array,
  companion?: { draft: ReportDraft; prepared: PreparedDraftPhoto[] },
) {
  await withDraftMutation(voice.userId, voice.id, async () => {
    await (await getVoiceDraftStore()).saveWithinMutation(voice, bytes);
    if (companion)
      await (
        await getReportDraftStore()
      ).saveWithinMutation(companion.draft, companion.prepared);
  });
  notifyOutboxWork(voice.userId);
}
