import { z } from 'zod';

const id = z.uuid();
const date = z.iso.date();

const sourceEnvelopeSchema = z
  .object({
    sourceRecordId: z.string(),
    sheet: z.string(),
    row: z.number().int().positive(),
    sourceMessageAt: z.string().nullable(),
    reportingWorkDate: date.nullable(),
    reportedByLabel: z.string().nullable(),
    channel: z.string(),
    raw: z.record(z.string(), z.unknown()),
    timezone: z.literal('Asia/Kolkata'),
    datePolicy: z.string(),
  })
  .strict();

const mediaEvidenceSchema = z
  .object({
    attachmentId: id,
    kind: z.enum(['audio', 'photo']),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    caption: z.string().max(500),
    originalTranscript: z.string().nullable(),
    provider: z.string().nullable(),
    model: z.string().nullable(),
    language: z.enum(['en', 'hi', 'auto']),
  })
  .strict();

const acceptedFactsSchema = z
  .object({
    eventDate: date,
    evidenceQuote: z.string().min(1),
  })
  .passthrough();

function submillisecondPrecision(value: string) {
  const fraction = value.match(/\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/)?.[1] ?? '';
  return Number(fraction.slice(3, 6).padEnd(3, '0') || '0');
}

export const executionHistoryEntrySchema = z
  .object({
    eventId: id,
    claimId: id,
    reportId: id,
    decisionId: id,
    auditId: z.number().int().positive().nullable(),
    activityId: id,
    externalId: z.string().min(1),
    activityName: z.string().min(1),
    discipline: z.string().min(1),
    location: z.string().min(1),
    revisionId: id,
    eventKind: z.enum([
      'START',
      'FINISH',
      'ITEM_PROGRESS',
      'PERCENT_PROGRESS',
      'MILESTONE',
    ]),
    eventDate: date,
    quote: z.string().min(1),
    reason: z.string().min(1),
    reviewer: z.string().nullable(),
    reviewerId: id,
    acceptedAt: z.iso.datetime({ offset: true }),
    effective: z.boolean(),
    supersedesEventId: id.nullable(),
    sourceId: z.string().min(1).nullable(),
    source: z.string().min(1),
    sourceUrl: z.string().min(1),
    provenance: sourceEnvelopeSchema.nullable().optional(),
    media: z.array(mediaEvidenceSchema).max(4).nullable().optional(),
    matchScore: z.number().min(0).max(1).nullable(),
    matchReasons: z.record(z.string(), z.number()).nullable(),
    calendar: z.string().min(1),
    facts: acceptedFactsSchema,
  })
  .superRefine((entry, context) => {
    if (
      entry.eventDate !== entry.facts.eventDate ||
      entry.quote !== entry.facts.evidenceQuote
    )
      context.addIssue({
        code: 'custom',
        message: 'Duplicated accepted evidence fields do not match.',
      });
    if (entry.supersedesEventId === entry.eventId)
      context.addIssue({
        code: 'custom',
        message: 'An accepted event cannot correct itself.',
      });
  });

export const executionHistorySchema = z
  .array(executionHistoryEntrySchema)
  .max(20_000)
  .superRefine((entries, context) => {
    const eventIds = new Set<string>();
    const decisionIds = new Set<string>();
    const byEventId = new Map(entries.map((entry) => [entry.eventId, entry]));
    const correctedIds = new Set(
      entries.flatMap((entry) =>
        entry.supersedesEventId ? [entry.supersedesEventId] : [],
      ),
    );
    let previousAcceptedAt = Number.NEGATIVE_INFINITY;
    let previousSubmillisecond = 0;
    let previousEventId = '';

    entries.forEach((entry, index) => {
      if (eventIds.has(entry.eventId) || decisionIds.has(entry.decisionId))
        context.addIssue({
          code: 'custom',
          path: [index],
          message: 'Accepted record identifiers must be unique.',
        });
      eventIds.add(entry.eventId);
      decisionIds.add(entry.decisionId);

      const acceptedAt = Date.parse(entry.acceptedAt);
      const acceptedSubmillisecond = submillisecondPrecision(entry.acceptedAt);
      if (
        acceptedAt < previousAcceptedAt ||
        (acceptedAt === previousAcceptedAt &&
          (acceptedSubmillisecond < previousSubmillisecond ||
            (acceptedSubmillisecond === previousSubmillisecond &&
              entry.eventId < previousEventId)))
      )
        context.addIssue({
          code: 'custom',
          path: [index, 'acceptedAt'],
          message: 'Accepted records must retain server history order.',
        });
      previousAcceptedAt = acceptedAt;
      previousSubmillisecond = acceptedSubmillisecond;
      previousEventId = entry.eventId;

      if (entry.effective === correctedIds.has(entry.eventId))
        context.addIssue({
          code: 'custom',
          path: [index, 'effective'],
          message: 'Correction status is inconsistent.',
        });

      if (entry.supersedesEventId) {
        const previous = byEventId.get(entry.supersedesEventId);
        if (
          !previous ||
          previous.activityId !== entry.activityId ||
          previous.eventKind !== entry.eventKind
        )
          context.addIssue({
            code: 'custom',
            path: [index, 'supersedesEventId'],
            message:
              'Correction target is not part of the same activity history.',
          });
      }
    });
  });

export type ExecutionHistoryEntry = z.infer<typeof executionHistoryEntrySchema>;
export type HistoryEvidenceState = 'all' | 'effective' | 'superseded';
export type HistoryFilters = {
  search: string;
  discipline: string;
  state: HistoryEvidenceState;
  activityId: string;
};

export const defaultHistoryFilters: HistoryFilters = {
  search: '',
  discipline: 'All',
  state: 'all',
  activityId: '',
};
