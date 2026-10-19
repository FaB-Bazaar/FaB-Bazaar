import { describe, it, expect, vi, afterEach } from 'vitest';
import { startInventoryHistoryPrune } from './inventory-history-schedule';

afterEach(() => { vi.useRealTimers(); });

describe('startInventoryHistoryPrune', () => {
  it('prunes at boot and then once a day', async () => {
    vi.useFakeTimers();
    const prune = vi.fn().mockResolvedValue(0);

    startInventoryHistoryPrune(prune);
    expect(prune).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(prune).toHaveBeenCalledTimes(2);
  });

  it('survives a failed prune', async () => {
    vi.useFakeTimers();
    const prune = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(0);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    startInventoryHistoryPrune(prune);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

    expect(prune).toHaveBeenCalledTimes(2);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
