import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgressReporter } from '../src/progress.js';

describe('createProgressReporter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the current stage, heartbeat, ETA, and completion', async () => {
    const messages: string[] = [];
    const reporter = createProgressReporter(
      [
        { id: 'prepare', label: 'Prepare references', estimatedDurationMs: 2_000 },
        { id: 'generate', label: 'Generate via OpenRouter', estimatedDurationMs: 8_000 },
      ],
      (message) => messages.push(message),
      1_000,
    );
    const operation = reporter.runStage(
      'prepare',
      () => new Promise<string>((resolve) => setTimeout(() => resolve('ready'), 2_500)),
    );

    await vi.advanceTimersByTimeAsync(2_500);

    await expect(operation).resolves.toBe('ready');
    reporter.complete();
    expect(messages).toEqual([
      '[00:00] [1/2] Prepare references started · ETA ~10s',
      '[00:01] [1/2] Prepare references · still running (1s) · ETA ~9s',
      '[00:02] [1/2] Prepare references · still running (2s) · ETA recalculating',
      '[00:02] [1/2] Prepare references done in 3s',
      '[00:02] Pipeline completed',
    ]);
  });

  it('reports a failed stage and preserves the error', async () => {
    const messages: string[] = [];
    const reporter = createProgressReporter(
      [{ id: 'generate', label: 'Generate image', estimatedDurationMs: 5_000 }],
      (message) => messages.push(message),
    );

    await expect(
      reporter.runStage('generate', async () => {
        throw new Error('provider failed');
      }),
    ).rejects.toThrow('provider failed');
    expect(messages.at(-1)).toBe('[00:00] [1/1] Generate image failed after 0s');
  });
});
