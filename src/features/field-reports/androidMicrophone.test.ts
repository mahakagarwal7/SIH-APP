import { AudioModule } from 'expo-audio';

import { androidMicrophone } from './androidMicrophone';

jest.mock('expo-audio', () => ({ AudioModule: { AudioStream: jest.fn() } }));

it('defers native disposal until a pending start finishes, then releases it', async () => {
  let complete!: () => void;
  const remove = jest.fn();
  const native = {
    start: jest.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    ),
    stop: jest.fn(),
    release: jest.fn(),
    addListener: jest.fn(() => ({ remove })),
  };
  // eslint-disable-next-line import/namespace -- This test mocks the native export, absent from Expo's web barrel.
  const { AudioStream } = AudioModule;
  jest
    .mocked(AudioStream)
    .mockImplementation(
      () => native as unknown as InstanceType<typeof AudioModule.AudioStream>,
    );
  const microphone = androidMicrophone(jest.fn());
  expect(AudioStream).toHaveBeenCalledWith({
    sampleRate: 16000,
    channels: 1,
    encoding: 'int16',
  });
  const pending = microphone.start();
  microphone.stop();
  microphone.release();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(native.release).not.toHaveBeenCalled();
  complete();
  await pending;
  expect(native.stop).toHaveBeenCalledTimes(1);
  expect(native.release).toHaveBeenCalledTimes(1);
});
