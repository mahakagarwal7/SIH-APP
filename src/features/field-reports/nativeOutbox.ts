import { CryptoDigestAlgorithm, digest, randomUUID } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';

import { getVoiceDraftStore } from './nativeDraftStore';
import { getReportDraftStore } from './nativeReportDraftStore';
import { createOutboxIndex } from './outboxIndex';
import { OutboxService } from './outboxService';
import { lazyOutboxTransport } from './outboxTransport';

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
  service ??= openDatabaseAsync('nirmaan-drafts.db')
    .then(
      async (db) =>
        new OutboxService(
          await createOutboxIndex(db),
          {
            async read(record, file) {
              if (record.kind === 'voice') {
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
          lazyOutboxTransport,
          sha256Hex,
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
  const voice = await (await getVoiceDraftStore()).list(userId);
  for (const local of voice) {
    if (!local.available || known.has(local.id)) continue;
    try {
      const source = await (
        await getVoiceDraftStore()
      ).recording(userId, local.id);
      const file: CaptureFile = {
        id: randomUUID(),
        name: `${local.id}.wav`,
        kind: 'audio',
        mime: 'audio/wav',
        bytes: source.bytes.length,
        sha256: await sha256Hex(source.bytes),
        caption: '',
      };
      await outbox.enqueue({
        captureId: local.id,
        userId,
        projectId: local.projectId,
        projectName: local.projectName,
        kind: 'voice',
        createdAt: local.createdAt,
        text: '',
        manifest: { captureId: local.id, language: 'auto', files: [file] },
      });
      known.add(local.id);
      enqueued += 1;
    } catch {
      unavailable += 1;
    }
  }
  const reports = await (await getReportDraftStore()).list(userId);
  for (const local of reports) {
    if (!local.available || known.has(local.id)) continue;
    try {
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
    } catch {
      unavailable += 1;
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
) {
  const current = running.get(userId);
  if (current) return current;
  const operation = prepareLocalOutbox(userId)
    .then(async () =>
      (await getNativeOutbox()).syncAll(userId, {
        includePaused: options.includePaused,
      }),
    )
    .finally(() => running.delete(userId));
  running.set(userId, operation);
  return operation;
}

export async function assertLocalDraftCanBeDiscarded(
  userId: string,
  captureId: string,
) {
  const record = (await (await getNativeOutbox()).list(userId)).find(
    (candidate) => candidate.captureId === captureId,
  );
  if (record)
    throw new Error(
      'This report has entered the outbox. Keep its device copy until confirmation is complete.',
    );
}
