import { createQueryClient } from './queryClient';

it('logs failed backend queries in development without converting them to empty data', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const client = createQueryClient();
  const failure = new Error('RLS denied');
  await expect(
    client.fetchQuery({
      queryKey: ['production-data'],
      queryFn: async () => Promise.reject(failure),
    }),
  ).rejects.toBe(failure);
  expect(warning).toHaveBeenCalledWith(
    '[Nirmaan] Query failed: ["production-data"]',
    failure,
  );
  warning.mockRestore();
});
