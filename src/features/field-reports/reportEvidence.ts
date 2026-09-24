import type { OutboxRecord } from './outbox';

export type ReportEvidenceState = {
  hasVoice: boolean;
  hasText: boolean;
  hasPhoto: boolean;
  hasAny: boolean;
  voiceTranscriptReady: boolean;
  canSubmit: boolean;
};

export function reportEvidenceLabel(
  evidence: Pick<ReportEvidenceState, 'hasVoice' | 'hasText' | 'hasPhoto'>,
) {
  if (evidence.hasVoice && evidence.hasText && evidence.hasPhoto)
    return 'Voice + text + photo';
  if (evidence.hasVoice && evidence.hasText) return 'Voice + text';
  if (evidence.hasVoice && evidence.hasPhoto) return 'Voice + photo';
  if (evidence.hasText && evidence.hasPhoto) return 'Text + photo';
  if (evidence.hasVoice) return 'Voice';
  if (evidence.hasText) return 'Text';
  if (evidence.hasPhoto) return 'Photo';
  return 'No evidence recorded';
}

export function getReportEvidenceState(
  input: Pick<OutboxRecord, 'text' | 'manifest' | 'originalTranscript'> &
    Partial<Pick<OutboxRecord, 'kind'>>,
): ReportEvidenceState {
  const hasVoice =
    input.kind === 'voice' ||
    input.manifest.files.some((file) => file.kind === 'audio');
  const hasText = input.text.trim().length > 0;
  const hasPhoto = input.manifest.files.some((file) => file.kind === 'photo');
  const hasAny = hasVoice || hasText || hasPhoto;
  const voiceTranscriptReady =
    !hasVoice || Boolean(input.originalTranscript?.trim());
  return {
    hasVoice,
    hasText,
    hasPhoto,
    hasAny,
    voiceTranscriptReady,
    canSubmit: hasAny && voiceTranscriptReady,
  };
}

export function initialConfirmationText(
  input: Pick<OutboxRecord, 'text' | 'manifest' | 'originalTranscript'>,
) {
  const typed = input.text.trim();
  const transcript = input.originalTranscript?.trim() ?? '';
  if (typed && transcript) return `${typed}\n\nVoice transcript: ${transcript}`;
  if (typed) return typed;
  if (transcript) return transcript;

  const photos = input.manifest.files.filter((file) => file.kind === 'photo');
  if (
    photos.length === 0 &&
    input.manifest.files.some((file) => file.kind === 'audio')
  )
    return 'Voice transcription pending.';
  const captions = photos
    .map((photo) => photo.caption.trim())
    .filter(Boolean)
    .join('; ');
  if (captions) return `Photo evidence: ${captions}`;
  if (photos.length === 1) return 'Photo evidence submitted.';
  return photos.length > 1
    ? `${photos.length} photos submitted as evidence.`
    : '';
}
