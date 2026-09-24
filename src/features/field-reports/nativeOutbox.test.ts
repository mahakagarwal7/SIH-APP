import { digest } from 'expo-crypto';

import { VoiceDraftStore } from './draftStore';
import { getVoiceDraftStore } from './nativeDraftStore';
import {
  cancelNativeOutboxCapture,
  getNativeOutbox,
  prepareLocalOutbox,
  syncNativeOutbox,
} from './nativeOutbox';
import { assertLocalDraftCanBeDiscarded } from './nativeOutboxIndex';
import { getReportDraftStore } from './nativeReportDraftStore';
import { subscribeOutboxWork } from './outboxEvents';
import { createOutboxIndex } from './outboxIndex';
import { getOutboxTransport } from './outboxTransport';
import { ReportDraftStore } from './reportDraftStore';

import type { DraftIndex, VoiceDraft } from './draftStore';
import type { OutboxIndex, OutboxRecord } from './outbox';
import type { ReportDraft, ReportDraftIndex } from './reportDraftStore';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({})),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: jest.fn(),
  randomUUID: () => '20000000-0000-4000-8000-000000000002',
}));
jest.mock('./nativeDraftStore', () => ({ getVoiceDraftStore: jest.fn() }));
jest.mock('./nativeReportDraftStore', () => ({
  getReportDraftStore: jest.fn(),
}));
jest.mock('./outboxIndex', () => ({ createOutboxIndex: jest.fn() }));
jest.mock('./outboxTransport', () => ({ getOutboxTransport: jest.fn() }));

const captureId = '10000000-0000-4000-8000-000000000001';
const records = new Map<string, OutboxRecord>();
const index: OutboxIndex = {
  get: async (userId, id) => {
    const row = records.get(id);
    return row?.userId === userId ? structuredClone(row) : null;
  },
  list: async (userId) =>
    [...records.values()]
      .filter((row) => row.userId === userId)
      .map((row) => structuredClone(row)),
  put: async (row) => {
    records.set(row.captureId, structuredClone(row));
  },
  remove: async (userId, id) => {
    if (records.get(id)?.userId === userId) records.delete(id);
  },
};
beforeEach(() => {
  records.clear();
  jest.mocked(createOutboxIndex).mockResolvedValue(index);
  jest.mocked(digest).mockReset().mockResolvedValue(new Uint8Array(32).buffer);
  jest.mocked(getOutboxTransport).mockReturnValue({
    ensureAccess: jest.fn(async () => {}),
    reserve: jest.fn(async () => '30000000-0000-4000-8000-000000000003'),
    upload: jest.fn(async () => {}),
    finalize: jest.fn(async () => {}),
    inspect: jest.fn(async () => ({ status: 'processing' as const })),
    submit: jest.fn(async () => '30000000-0000-4000-8000-000000000003'),
    discard: jest.fn(async () => {}),
  });
});
function localStore(
  kind: 'voice' | 'report' | 'combined',
  beforeDiscard = assertLocalDraftCanBeDiscarded,
) {
  const common = {
    id: captureId,
    userId: 'alice',
    projectId: 'project',
    projectName: 'Site',
    createdAt: '2026-09-24T00:00:00Z',
    state: 'saved' as const,
  };
  let voice: VoiceDraft | null =
    kind !== 'report'
      ? { ...common, duration: 1, sampleRate: 16000, byteLength: 3 }
      : null;
  let report: ReportDraft | null =
    kind !== 'voice'
      ? {
          ...common,
          text: 'Work complete',
          photos: [
            {
              id: '40000000-0000-4000-8000-000000000004',
              fileName: 'photo.jpg',
              mimeType: 'image/jpeg',
              caption: '',
              byteLength: 3,
              width: 1,
              height: 1,
            },
          ],
        }
      : null;
  let exists = true;
  const voiceIndex: DraftIndex = {
    get: async () => voice,
    list: async () => (voice ? [voice] : []),
    insert: async (row) => {
      voice = row;
    },
    remove: async () => {
      voice = null;
    },
    setState: async (_user, _id, state) => {
      if (voice) voice = { ...voice, state };
    },
  };
  const reportIndex: ReportDraftIndex = {
    get: async () => report,
    list: async () => (report ? [report] : []),
    insert: async (row) => {
      report = row;
    },
    remove: async () => {
      report = null;
    },
    setState: async (_user, _id, state) => {
      if (report) report = { ...report, state };
    },
  };
  const files = {
    size: async () => (exists ? 3 : null),
    read: async () => {
      if (!exists) throw new Error('Missing file');
      return new Uint8Array([1, 2, 3]);
    },
    write: async () => {
      exists = true;
    },
    remove: async () => {
      exists = false;
    },
    uri: () => 'file:///private-evidence',
  };
  const voiceStore = new VoiceDraftStore(voiceIndex, files, beforeDiscard);
  const reportStore = new ReportDraftStore(reportIndex, files, beforeDiscard);
  jest.mocked(getVoiceDraftStore).mockResolvedValue(voiceStore);
  jest.mocked(getReportDraftStore).mockResolvedValue(reportStore);
  return {
    store: kind === 'report' ? reportStore : voiceStore,
    voiceStore,
    reportStore,
    voice,
    exists: () => exists,
  };
}

it('freezes voice, typed text and photos with one shared capture identity', async () => {
  localStore('combined');
  await expect(prepareLocalOutbox('alice')).resolves.toEqual({
    enqueued: 1,
    unavailable: 0,
  });
  expect(records.get(captureId)).toMatchObject({
    kind: 'voice',
    text: 'Work complete',
    manifest: {
      captureId,
      files: [
        expect.objectContaining({ kind: 'audio' }),
        expect.objectContaining({ kind: 'photo' }),
      ],
    },
  });
});

it.each(['voice', 'report'] as const)(
  'retains %s evidence during hashing and after entering the outbox',
  async (kind) => {
    const local = localStore(kind);
    let finishHash!: () => void;
    let startedHash!: () => void;
    const hashing = new Promise<void>((resolve) => {
      startedHash = resolve;
    });
    jest.mocked(digest).mockImplementationOnce(() => {
      startedHash();
      return new Promise<ArrayBuffer>((resolve) => {
        finishHash = () => resolve(new Uint8Array(32).buffer);
      });
    });
    const preparation = prepareLocalOutbox('alice');
    await hashing;
    try {
      await expect(local.store.discard('alice', captureId)).rejects.toThrow(
        'busy',
      );
      expect(local.exists()).toBe(true);
    } finally {
      finishHash();
    }
    await expect(preparation).resolves.toEqual({ enqueued: 1, unavailable: 0 });
    await expect(local.store.discard('alice', captureId)).rejects.toThrow(
      'entered the outbox',
    );
    expect(local.exists()).toBe(true);
  },
);

it.each(['voice', 'report'] as const)(
  'does not enqueue %s evidence while deletion holds its lock',
  async (kind) => {
    let finish!: () => void;
    let started!: () => void;
    const deleting = new Promise<void>((resolve) => {
      started = resolve;
    });
    const local = localStore(kind, async () => {
      started();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    const discard = local.store.discard('alice', captureId);
    await deleting;
    try {
      await expect(prepareLocalOutbox('alice')).resolves.toEqual({
        enqueued: 0,
        unavailable: 0,
      });
    } finally {
      finish();
    }
    await discard;
    expect(await (await getNativeOutbox()).list('alice')).toEqual([]);
    expect(local.exists()).toBe(false);
  },
);

it('notifies the coordinator after a durable save releases its preparation lock', async () => {
  const local = localStore('voice');
  let preparation: ReturnType<typeof prepareLocalOutbox> | undefined;
  const unsubscribe = subscribeOutboxWork((owner) => {
    preparation = prepareLocalOutbox(owner);
  });
  try {
    await local.voiceStore.save(local.voice!, new Uint8Array([1, 2, 3]));
    await expect(preparation).resolves.toMatchObject({ enqueued: 1 });
  } finally {
    unsubscribe();
  }
});

it('cancels an enqueued local capture and removes its private evidence', async () => {
  const local = localStore('voice');
  await prepareLocalOutbox('alice');
  expect(records.has(captureId)).toBe(true);
  await cancelNativeOutboxCapture('alice', captureId);
  expect(records.has(captureId)).toBe(false);
  expect(local.exists()).toBe(false);
  await expect(local.voiceStore.list('alice')).resolves.toEqual([]);
});

it('notifies idle foreground polling after an explicit sync finishes', async () => {
  localStore('voice');
  await prepareLocalOutbox('alice');
  const changed = jest.fn();
  const unsubscribe = subscribeOutboxWork(changed);
  try {
    await syncNativeOutbox('alice', { includePaused: true });
    expect(changed).toHaveBeenCalledWith('alice');
    expect((await (await getNativeOutbox()).list('alice'))[0]?.state).toBe(
      'processing',
    );
  } finally {
    unsubscribe();
  }
});

it('retains an explicit paused-item retry when an automatic pass is already running', async () => {
  localStore('voice');
  await prepareLocalOutbox('alice');
  const row = records.get(captureId)!;
  records.set(captureId, {
    ...row,
    state: 'paused',
    retryable: false,
    lastErrorKind: 'auth',
  });
  const service = await getNativeOutbox();
  let finish!: () => void;
  let started!: () => void;
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  const sync = jest
    .spyOn(service, 'syncAll')
    .mockImplementationOnce(async () => {
      started();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return [records.get(captureId)!];
    });
  const automatic = syncNativeOutbox('alice');
  await running;
  const manual = syncNativeOutbox('alice', { includePaused: true });
  finish();
  await automatic;
  await expect(manual).resolves.toEqual([
    expect.objectContaining({ state: 'processing' }),
  ]);
  expect(sync).toHaveBeenLastCalledWith('alice', { includePaused: true });
});

it.each(['voice', 'report'] as const)(
  'releases %s evidence through the actual store guard only after a durable receipt',
  async (kind) => {
    const local = localStore(kind);
    await prepareLocalOutbox('alice');
    records.set(captureId, {
      ...records.get(captureId)!,
      reportId: '30000000-0000-4000-8000-000000000003',
      state: 'needs_confirmation',
      originalTranscript: kind === 'voice' ? 'Two supports installed.' : null,
    });
    const outbox = await getNativeOutbox();
    await outbox.confirm('alice', captureId, {
      text: 'Two supports installed.',
      workDate: null,
      activityId: null,
    });
    await expect(local.store.discard('alice', captureId)).rejects.toThrow(
      'entered the outbox',
    );
    expect(local.exists()).toBe(true);
    const result = await outbox.sync('alice', captureId);
    expect(result).toMatchObject({
      submissionState: 'submitted',
      evidenceReleased: true,
    });
    expect(local.exists()).toBe(false);
    expect(await local.store.list('alice')).toEqual([]);
  },
);
