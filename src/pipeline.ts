import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { buildAnimationPrompt, buildStillPrompt } from './brand.js';
import { requireApiKey } from './config.js';
import {
  assertReadableFile,
  copyAsset,
  createRunDirectory,
  fileToDataUrl,
  slugify,
  writeJson,
  writeText,
} from './files.js';
import { checkMediaTools, convertVideoToWebp, removeWhiteBackground } from './media.js';
import { downloadVideo, generateVideo } from './openrouter.js';
import { createProgressReporter } from './progress.js';
import type {
  AppConfig,
  GenerationManifest,
  GenerationResult,
  ImageReference,
  VideoJob,
} from './types.js';

interface GenerateOptions {
  prompt: string;
  name: string;
  referencePath?: string;
  seed?: number;
  onStatus?: (message: string) => void;
}

interface ConvertOptions {
  inputPath: string;
  name: string;
  onStatus?: (message: string) => void;
}

const ANIMATION_STAGES = [
  { id: 'validate', label: 'Validate inputs', estimatedDurationMs: 1_000 },
  { id: 'prompt', label: 'Compose character-locked prompt', estimatedDurationMs: 1_000 },
  { id: 'prepare', label: 'Prepare output and reference image', estimatedDurationMs: 3_000 },
  { id: 'generate', label: 'Generate video via OpenRouter', estimatedDurationMs: 240_000 },
  { id: 'download', label: 'Download generated video', estimatedDurationMs: 15_000 },
  { id: 'convert', label: 'Create transparent animated WebP', estimatedDurationMs: 45_000 },
  { id: 'metadata', label: 'Write manifest', estimatedDurationMs: 1_000 },
];

const STILL_STAGES = [
  { id: 'validate', label: 'Validate inputs', estimatedDurationMs: 1_000 },
  { id: 'prepare', label: 'Copy Codex-generated source image', estimatedDurationMs: 3_000 },
  { id: 'process', label: 'Create transparent PNG', estimatedDurationMs: 15_000 },
  { id: 'metadata', label: 'Write prompt and manifest', estimatedDurationMs: 1_000 },
];

const CONVERSION_STAGES = [
  { id: 'validate', label: 'Validate source video', estimatedDurationMs: 1_000 },
  { id: 'prepare', label: 'Prepare output and copy source video', estimatedDurationMs: 5_000 },
  { id: 'convert', label: 'Create transparent animated WebP', estimatedDurationMs: 45_000 },
  { id: 'metadata', label: 'Write manifest', estimatedDurationMs: 1_000 },
];

function createImageReference(dataUrl: string): ImageReference {
  return {
    type: 'image_url',
    image_url: {
      url: dataUrl,
    },
  };
}

function relativeFiles(config: AppConfig, files: string[]): string[] {
  return files.map((file) => path.relative(config.projectRoot, file));
}

function reportVideoStatus(job: VideoJob, onStatus?: (message: string) => void): void {
  const cost = job.usage?.cost;
  const costSuffix = cost === undefined ? '' : ` cost=$${cost.toFixed(4)}`;
  onStatus?.(`video status=${job.status}${costSuffix}`);
}

async function readCharacterStandard(config: AppConfig): Promise<string> {
  await assertReadableFile(config.characterStandardPath);
  return readFile(config.characterStandardPath, 'utf8');
}

export async function composePrompt(
  config: AppConfig,
  mode: 'animate' | 'still',
  prompt: string,
): Promise<string> {
  const characterStandard = await readCharacterStandard(config);
  return mode === 'animate'
    ? buildAnimationPrompt(prompt, characterStandard)
    : buildStillPrompt(prompt, characterStandard);
}

export async function generateAnimation(
  config: AppConfig,
  options: GenerateOptions,
): Promise<GenerationResult> {
  const apiKey = requireApiKey(config);
  const progress = createProgressReporter(ANIMATION_STAGES, options.onStatus);
  const referencePath = options.referencePath ?? config.referencePath;
  await progress.runStage('validate', () => assertReadableFile(referencePath));
  const composedPrompt = await progress.runStage('prompt', () =>
    composePrompt(config, 'animate', options.prompt),
  );
  const assetName = slugify(options.name);
  const prepared = await progress.runStage('prepare', async () => {
    const outputDirectory = await createRunDirectory(config.outputDir, options.name);
    const reference = createImageReference(await fileToDataUrl(referencePath));
    return { outputDirectory, reference };
  });
  const { outputDirectory, reference } = prepared;
  const sourceVideoPath = path.join(outputDirectory, `${assetName}-source.mp4`);

  const job = await progress.runStage('generate', () =>
    generateVideo(
      config,
      apiKey,
      {
        prompt: composedPrompt,
        references: [reference],
        ...(options.seed === undefined ? {} : { seed: options.seed }),
      },
      (currentJob) => reportVideoStatus(currentJob, options.onStatus),
    ),
  );

  await progress.runStage('download', () => downloadVideo(config, apiKey, job, sourceVideoPath));
  const animatedAsset = await progress.runStage('convert', () =>
    convertVideoToWebp(sourceVideoPath, outputDirectory, assetName),
  );
  const promptPath = path.join(outputDirectory, 'prompt.txt');
  const manifestPath = path.join(outputDirectory, 'manifest.json');
  const manifest: GenerationManifest = {
    kind: 'animation',
    name: assetName,
    createdAt: new Date().toISOString(),
    prompt: options.prompt,
    composedPrompt,
    model: config.videoModel,
    referenceFiles: relativeFiles(config, [referencePath]),
    sourceFile: path.relative(config.projectRoot, sourceVideoPath),
    outputFiles: relativeFiles(config, [
      animatedAsset.webpPath,
      animatedAsset.posterPath,
      animatedAsset.previewPath,
    ]),
    ...(job.usage ? { usage: job.usage } : {}),
    video: {
      durationSeconds: config.videoDuration,
      framesPerSecond: 24,
      frameCount: animatedAsset.frameCount,
      size: '384x384',
    },
  };

  await progress.runStage('metadata', async () => {
    await Promise.all([writeText(promptPath, composedPrompt), writeJson(manifestPath, manifest)]);
  });
  progress.complete();
  return {
    outputDirectory,
    ...(job.usage ? { usage: job.usage } : {}),
  };
}

export async function prepareStill(
  config: AppConfig,
  options: ConvertOptions,
): Promise<string> {
  const progress = createProgressReporter(STILL_STAGES, options.onStatus);
  await progress.runStage('validate', () => assertReadableFile(options.inputPath));
  const assetName = slugify(options.name);
  const prepared = await progress.runStage('prepare', async () => {
    const outputDirectory = await createRunDirectory(config.outputDir, options.name);
    const sourceImagePath = path.join(
      outputDirectory,
      `${assetName}-source${path.extname(options.inputPath) || '.png'}`,
    );
    await copyAsset(options.inputPath, sourceImagePath);
    return { outputDirectory, sourceImagePath };
  });
  const { outputDirectory, sourceImagePath } = prepared;
  const imagePath = path.join(outputDirectory, `${assetName}.png`);
  const manifestPath = path.join(outputDirectory, 'manifest.json');
  const manifest: GenerationManifest = {
    kind: 'still',
    name: assetName,
    createdAt: new Date().toISOString(),
    referenceFiles: [],
    sourceFile: path.relative(config.projectRoot, sourceImagePath),
    outputFiles: relativeFiles(config, [imagePath]),
  };

  await progress.runStage('process', () => removeWhiteBackground(sourceImagePath, imagePath));
  await progress.runStage('metadata', () => writeJson(manifestPath, manifest));
  progress.complete();
  return outputDirectory;
}

export async function convertExistingVideo(
  config: AppConfig,
  options: ConvertOptions,
): Promise<string> {
  const progress = createProgressReporter(CONVERSION_STAGES, options.onStatus);
  await progress.runStage('validate', () => assertReadableFile(options.inputPath));
  const assetName = slugify(options.name);
  const prepared = await progress.runStage('prepare', async () => {
    const outputDirectory = await createRunDirectory(config.outputDir, options.name);
    const sourceVideoPath = path.join(
      outputDirectory,
      `${assetName}-source${path.extname(options.inputPath)}`,
    );
    await copyAsset(options.inputPath, sourceVideoPath);
    return { outputDirectory, sourceVideoPath };
  });
  const { outputDirectory, sourceVideoPath } = prepared;
  const animatedAsset = await progress.runStage('convert', () =>
    convertVideoToWebp(sourceVideoPath, outputDirectory, assetName),
  );
  const manifestPath = path.join(outputDirectory, 'manifest.json');
  const manifest: GenerationManifest = {
    kind: 'conversion',
    name: assetName,
    createdAt: new Date().toISOString(),
    referenceFiles: [],
    sourceFile: path.relative(config.projectRoot, sourceVideoPath),
    outputFiles: relativeFiles(config, [
      animatedAsset.webpPath,
      animatedAsset.posterPath,
      animatedAsset.previewPath,
    ]),
    video: {
      durationSeconds: animatedAsset.frameCount / 24,
      framesPerSecond: 24,
      frameCount: animatedAsset.frameCount,
      size: '384x384',
    },
  };

  await progress.runStage('metadata', () => writeJson(manifestPath, manifest));
  progress.complete();
  return outputDirectory;
}

export async function doctor(config: AppConfig): Promise<string[]> {
  const toolStatus = await checkMediaTools();
  const checks: string[] = [];

  checks.push(
    config.apiKey
      ? 'PASS optional Seedance OpenRouter key configured'
      : 'WARN OPENROUTER_API_KEY missing; Seedance animation is unavailable',
  );

  for (const referencePath of [
    config.referencePath,
    config.characterSheetPath,
    config.characterStandardPath,
  ]) {
    try {
      await assertReadableFile(referencePath);
      checks.push(`PASS ${path.relative(config.projectRoot, referencePath)}`);
    } catch {
      checks.push(`FAIL ${path.relative(config.projectRoot, referencePath)}`);
    }
  }

  for (const [tool, isAvailable] of Object.entries(toolStatus)) {
    checks.push(`${isAvailable ? 'PASS' : 'FAIL'} ${tool}`);
  }

  return checks;
}
