export interface ProgressStage {
  id: string;
  label: string;
  estimatedDurationMs: number;
}

export interface ProgressReporter {
  runStage<T>(id: string, operation: () => Promise<T>): Promise<T>;
  complete(): void;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1_000));

  if (totalSeconds < 60) {
    return `${String(totalSeconds)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${String(minutes)}m` : `${String(minutes)}m ${String(seconds)}s`;
}

function formatTimestamp(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function createProgressReporter(
  stages: ProgressStage[],
  onStatus?: (message: string) => void,
  heartbeatMs = 15_000,
): ProgressReporter {
  const pipelineStartedAt = Date.now();
  const completedStageIds = new Set<string>();

  function elapsedPrefix(): string {
    return `[${formatTimestamp(Date.now() - pipelineStartedAt)}]`;
  }

  function findStage(id: string): { stage: ProgressStage; index: number } {
    const index = stages.findIndex((stage) => stage.id === id);
    const stage = stages[index];

    if (!stage) {
      throw new Error(`Unknown pipeline stage: ${id}`);
    }

    return { stage, index };
  }

  function estimatedRemainingMs(index: number, stageElapsedMs: number): number {
    return stages.reduce((total, stage, stageIndex) => {
      if (completedStageIds.has(stage.id) || stageIndex < index) {
        return total;
      }

      if (stageIndex === index) {
        return total + Math.max(0, stage.estimatedDurationMs - stageElapsedMs);
      }

      return total + stage.estimatedDurationMs;
    }, 0);
  }

  async function runStage<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const { stage, index } = findStage(id);
    const stageStartedAt = Date.now();
    const step = `[${String(index + 1)}/${String(stages.length)}]`;
    const initialEta = estimatedRemainingMs(index, 0);
    onStatus?.(`${elapsedPrefix()} ${step} ${stage.label} started · ETA ~${formatDuration(initialEta)}`);

    const heartbeat = onStatus
      ? setInterval(() => {
          const stageElapsedMs = Date.now() - stageStartedAt;
          const isEstimateExceeded = stageElapsedMs >= stage.estimatedDurationMs;
          const eta = isEstimateExceeded
            ? 'ETA recalculating'
            : `ETA ~${formatDuration(estimatedRemainingMs(index, stageElapsedMs))}`;
          onStatus(
            `${elapsedPrefix()} ${step} ${stage.label} · still running (${formatDuration(stageElapsedMs)}) · ${eta}`,
          );
        }, heartbeatMs)
      : undefined;
    heartbeat?.unref();

    try {
      const result = await operation();
      completedStageIds.add(stage.id);
      onStatus?.(
        `${elapsedPrefix()} ${step} ${stage.label} done in ${formatDuration(Date.now() - stageStartedAt)}`,
      );
      return result;
    } catch (error) {
      onStatus?.(
        `${elapsedPrefix()} ${step} ${stage.label} failed after ${formatDuration(Date.now() - stageStartedAt)}`,
      );
      throw error;
    } finally {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    }
  }

  function complete(): void {
    onStatus?.(`${elapsedPrefix()} Pipeline completed`);
  }

  return { runStage, complete };
}
