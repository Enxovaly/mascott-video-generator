import { writeFile } from 'node:fs/promises';

import type { AppConfig, ImageReference, VideoJob } from './types.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai';

interface VideoRequest {
  prompt: string;
  references: ImageReference[];
  seed?: number;
}

function createHeaders(config: AppConfig, apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': config.httpReferer,
    'X-Title': config.appName,
  };
}

async function readError(response: Response): Promise<string> {
  const responseText = await response.text();

  if (!responseText) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const parsedError = JSON.parse(responseText) as {
      error?: string | { message?: string };
      message?: string;
    };

    if (typeof parsedError.error === 'string') {
      return parsedError.error;
    }

    return parsedError.error?.message ?? parsedError.message ?? responseText;
  } catch {
    return responseText;
  }
}

async function requestJson<T>(
  config: AppConfig,
  apiKey: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...createHeaders(config, apiKey),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${await readError(response)}`);
  }

  return (await response.json()) as T;
}

function resolveOpenRouterUrl(value: string): string {
  return new URL(value, OPENROUTER_BASE_URL).toString();
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export async function generateVideo(
  config: AppConfig,
  apiKey: string,
  request: VideoRequest,
  onStatus: (job: VideoJob) => void,
): Promise<VideoJob> {
  const submittedJob = await requestJson<VideoJob>(
    config,
    apiKey,
    `${OPENROUTER_BASE_URL}/api/v1/videos`,
    {
      method: 'POST',
      body: JSON.stringify({
        model: config.videoModel,
        prompt: request.prompt,
        size: config.videoSize,
        duration: config.videoDuration,
        generate_audio: false,
        input_references: request.references,
        ...(request.seed === undefined ? {} : { seed: request.seed }),
      }),
    },
  );

  onStatus(submittedJob);

  const pollingUrl = resolveOpenRouterUrl(
    submittedJob.polling_url ?? `/api/v1/videos/${submittedJob.id}`,
  );
  const startedAt = Date.now();
  let currentJob = submittedJob;

  while (!['completed', 'failed', 'cancelled', 'expired'].includes(currentJob.status)) {
    if (Date.now() - startedAt > config.pollTimeoutMs) {
      throw new Error(`Video generation timed out after ${config.pollTimeoutMs} ms.`);
    }

    await delay(config.pollIntervalMs);
    currentJob = await requestJson<VideoJob>(config, apiKey, pollingUrl);
    onStatus(currentJob);
  }

  if (currentJob.status !== 'completed') {
    throw new Error(currentJob.error ?? `Video generation ended with status: ${currentJob.status}`);
  }

  return currentJob;
}

export async function downloadVideo(
  config: AppConfig,
  apiKey: string,
  job: VideoJob,
  destinationPath: string,
): Promise<void> {
  const contentUrl = resolveOpenRouterUrl(
    job.unsigned_urls?.[0] ?? `/api/v1/videos/${job.id}/content?index=0`,
  );
  const response = await fetch(contentUrl, {
    headers: createHeaders(config, apiKey),
  });

  if (!response.ok) {
    throw new Error(`Video download failed: ${await readError(response)}`);
  }

  await writeFile(destinationPath, Buffer.from(await response.arrayBuffer()));
}
