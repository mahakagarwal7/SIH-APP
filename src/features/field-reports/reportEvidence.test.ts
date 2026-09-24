import {
  getReportEvidenceState,
  initialConfirmationText,
} from './reportEvidence';

import type { CaptureFile } from './outbox';

const audio: CaptureFile = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'report.wav',
  kind: 'audio',
  mime: 'audio/wav',
  bytes: 100,
  sha256: 'a'.repeat(64),
  caption: '',
};
const photo: CaptureFile = {
  id: '20000000-0000-4000-8000-000000000002',
  name: 'evidence.jpg',
  kind: 'photo',
  mime: 'image/jpeg',
  bytes: 100,
  sha256: 'b'.repeat(64),
  caption: '',
};

function evidence({
  voice = false,
  text = false,
  photo: includesPhoto = false,
  transcript = voice,
}: {
  voice?: boolean;
  text?: boolean;
  photo?: boolean;
  transcript?: boolean;
} = {}) {
  return {
    text: text ? 'Two supports installed.' : '  ',
    originalTranscript: transcript ? 'Voice progress update.' : null,
    manifest: {
      captureId: '30000000-0000-4000-8000-000000000003',
      language: 'auto' as const,
      files: [...(voice ? [audio] : []), ...(includesPhoto ? [photo] : [])],
    },
  };
}

it.each([
  ['voice', { voice: true }],
  ['text', { text: true }],
  ['photo', { photo: true }],
  ['voice + text', { voice: true, text: true }],
  ['voice + photo', { voice: true, photo: true }],
  ['text + photo', { text: true, photo: true }],
  ['voice + text + photo', { voice: true, text: true, photo: true }],
])('enables submission for %s evidence', (_name, input) => {
  expect(getReportEvidenceState(evidence(input)).canSubmit).toBe(true);
});

it('disables submission for no evidence and while included voice is transcribing', () => {
  expect(getReportEvidenceState(evidence()).canSubmit).toBe(false);
  expect(
    getReportEvidenceState(evidence({ voice: true, transcript: false }))
      .canSubmit,
  ).toBe(false);
  expect(
    getReportEvidenceState(
      evidence({ voice: true, text: true, photo: true, transcript: false }),
    ).canSubmit,
  ).toBe(false);
});

it('builds honest editable wording for photo-only and combined reports', () => {
  expect(initialConfirmationText(evidence({ photo: true }))).toBe(
    'Photo evidence submitted.',
  );
  expect(initialConfirmationText(evidence({ voice: true, text: true }))).toBe(
    'Two supports installed.\n\nVoice transcript: Voice progress update.',
  );
});
