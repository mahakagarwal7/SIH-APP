import { CryptoDigestAlgorithm, digest, randomUUID } from 'expo-crypto';

import { DraftBusyError, withDraftMutation } from './draftMutations';
import { getVoiceDraftStore } from './nativeDraftStore';
import { getNativeOutboxIndex } from './nativeOutboxIndex';
import { getReportDraftStore } from './nativeReportDraftStore';
import { notifyOutboxWork } from './outboxEvents';
import { OutboxService } from './outboxService';
import { getOutboxTransport } from './outboxTransport';

import type { CaptureFile, OutboxRecord } from './outbox';

export async function sha256Hex(bytes: Uint8Array) {
  const result = new Uint8Array(
    await digest(CryptoDigestAlgorithm.SHA256, Uint8Array.from(bytes)),
  );
  return [...result]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

let service: Promise<OutboxService> | undefined;
export function getNativeOutbox(): Promise<OutboxService> {
  service ??= getNativeOutboxIndex()
    .then(
      (index) =>
        new OutboxService(
          index,
          {
            async read(record, file) {
              if (file.kind === 'audio') {
                const source = await (
                  await getVoiceDraftStore()
                ).recording(record.userId, record.captureId);
                return source.bytes;
              }
              const source = await (
                await getReportDraftStore()
              ).materialize(record.userId, record.captureId);
              const photo = source.prepared.find(
                (candidate) => candidate.photo.id === file.id,
              );
              if (!photo)
                throw new Error('A saved photo is missing from this report.');
              return photo.bytes;
            },
          },
          getOutboxTransport,
          sha256Hex,
          undefined,
          async (record) => {
            const voiceStore = await getVoiceDraftStore();
            if (
              (await voiceStore.list(record.userId)).some(
                (row) => row.id === record.captureId,
              )
            )
              await voiceStore.discard(record.userId, record.captureId);
            const reportStore = await getReportDraftStore();
            if (
              (await reportStore.list(record.userId)).some(
                (row) => row.id === record.captureId,
              )
            )
              await reportStore.discard(record.userId, record.captureId);
          },
        ),
    )
    .catch((error) => {
      service = undefined;
      throw error;
    });
  return service;
}

async function prepare(userId: string) {
  const outbox = await getNativeOutbox();
  const known = new Set(
    (await outbox.list(userId)).map((record) => record.captureId),
  );
  let enqueued = 0;
  let unavailable = 0;
  const reports = await (await getReportDraftStore()).list(userId);
  const reportById = new Map(reports.map((report) => [report.id, report]));
  const voice = await (await getVoiceDraftStore()).list(userId);
  const voiceIds = new Set(voice.map((draft) => draft.id));
  for (const local of voice) {
    if (known.has(local.id)) continue;
    if (!local.available) {
      unavailable += 1;
      continue;
    }
    try {
      await withDraftMutation(userId, local.id, async () => {
        const source = await (
          await getVoiceDraftStore()
        ).recording(userId, local.id);
        const files: CaptureFile[] = [
          {
            id: randomUUID(),
            name: `${local.id}.wav`,
            kind: 'audio',
            mime: 'audio/wav',
            bytes: source.bytes.length,
            sha256: await sha256Hex(source.bytes),
            caption: '',
          },
        ];
        const companion = reportById.get(local.id);
        let text = '';
        if (companion) {
          if (!companion.available)
            throw new Error('Combined report evidence is incomplete.');
          const report = await (
            await getReportDraftStore()
          ).materialize(userId, local.id);
          text = report.draft.text;
          for (const prepared of report.prepared)
            files.push({
              id: prepared.photo.id,
              name: prepared.photo.fileName,
              kind: 'photo',
              mime: prepared.photo.mimeType,
              bytes: prepared.bytes.length,
              sha256: await sha256Hex(prepared.bytes),
              caption: prepared.photo.caption,
            });
        }
        await outbox.enqueue({
          captureId: local.id,
          userId,
          projectId: local.projectId,
          projectName: local.projectName,
          kind: 'voice',
          createdAt: local.createdAt,
          text,
          manifest: { captureId: local.id, language: 'auto', files },
        });
        known.add(local.id);
        enqueued += 1;
      });
    } catch (error) {
      if (!(error instanceof DraftBusyError)) unavailable += 1;
    }
  }
  for (const local of reports) {
    if (!local.available || known.has(local.id) || voiceIds.has(local.id))
      continue;
    try {
      await withDraftMutation(userId, local.id, async () => {
        const source = await (
          await getReportDraftStore()
        ).materialize(userId, local.id);
        const files: CaptureFile[] = [];
        for (const prepared of source.prepared)
          files.push({
            id: prepared.photo.id,
            name: prepared.photo.fileName,
            kind: 'photo',
            mime: prepared.photo.mimeType,
            bytes: prepared.bytes.length,
            sha256: await sha256Hex(prepared.bytes),
            caption: prepared.photo.caption,
          });
        await outbox.enqueue({
          captureId: local.id,
          userId,
          projectId: local.projectId,
          projectName: local.projectName,
          kind: 'report',
          createdAt: local.createdAt,
          text: local.text,
          manifest: { captureId: local.id, language: 'auto', files },
        });
        known.add(local.id);
        enqueued += 1;
      });
    } catch (error) {
      if (!(error instanceof DraftBusyError)) unavailable += 1;
    }
  }
  return { enqueued, unavailable };
}

const preparing = new Map<
  string,
  Promise<{ enqueued: number; unavailable: number }>
>();
export function prepareLocalOutbox(userId: string) {
  const current = preparing.get(userId);
  if (current) return current;
  const operation = prepare(userId).finally(() => preparing.delete(userId));
  preparing.set(userId, operation);
  return operation;
}

const running = new Map<string, Promise<OutboxRecord[]>>();
export function syncNativeOutbox(
  userId: string,
  options: { includePaused?: boolean } = {},
): Promise<OutboxRecord[]> {
  const current = running.get(userId);
  if (current) {
    // An explicit retry must not lose its includePaused request to an automatic pass.
    return options.includePaused
      ? current.then(() => syncNativeOutbox(userId, options))
      : current;
  }
  const operation = prepareLocalOutbox(userId)
    .then(async () =>
      (await getNativeOutbox()).syncAll(userId, {
        includePaused: options.includePaused,
      }),
    )
    .finally(() => {
      running.delete(userId);
      if (options.includePaused) notifyOutboxWork(userId);
    });
  running.set(userId, operation);
  return operation;
}

export { assertLocalDraftCanBeDiscarded } from './nativeOutboxIndex';
