import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type { AppConfig } from './types.js';

export const projectRoot = fileURLToPath(new URL('..', import.meta.url));

loadEnv({ path: path.join(projectRoot, '.env'), quiet: true });

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }

  return parsedValue;
}

function resolveProjectPath(value: string): string {
  return path.isAbsolute(value) ? value : path.join(projectRoot, value);
}

function parseSeedanceModel(value: string | undefined): string {
  const model = value ?? 'bytedance/seedance-2.0';

  if (!model.toLowerCase().includes('seedance')) {
    throw new Error(`MASCOT_VIDEO_MODEL must be a Seedance model, received: ${model}`);
  }

  return model;
}

export function loadConfig(): AppConfig {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  return {
    projectRoot,
    ...(apiKey ? { apiKey } : {}),
    appName: process.env.OPENROUTER_APP_NAME ?? 'Enxovaly Mascot Lab',
    httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost',
    videoModel: parseSeedanceModel(process.env.MASCOT_VIDEO_MODEL),
    videoSize: process.env.MASCOT_VIDEO_SIZE ?? '480x480',
    videoDuration: parsePositiveInteger(process.env.MASCOT_VIDEO_DURATION, 4),
    pollIntervalMs: parsePositiveInteger(process.env.MASCOT_POLL_INTERVAL_MS, 10_000),
    pollTimeoutMs: parsePositiveInteger(process.env.MASCOT_POLL_TIMEOUT_MS, 900_000),
    referencePath: resolveProjectPath(
      process.env.MASCOT_REFERENCE_PATH ?? 'references/mascot-master.png',
    ),
    characterSheetPath: resolveProjectPath(
      process.env.MASCOT_CHARACTER_SHEET_PATH ?? 'references/mascot-character-sheet.png',
    ),
    characterStandardPath: path.join(projectRoot, 'references/CHARACTER.md'),
    outputDir: resolveProjectPath(process.env.MASCOT_OUTPUT_DIR ?? 'outputs'),
  };
}

export function requireApiKey(config: AppConfig): string {
  if (!config.apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing. Copy .env.example to .env and add the key.');
  }

  return config.apiKey;
}
