import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { AnimatedAsset } from './types.js';

const FRAMES_PER_SECOND = 24;
const SOURCE_SIZE = 640;
const OUTPUT_SIZE = 384;
const OUTPUT_CONTENT_SIZE = 352;
const CONCURRENCY = 8;
const VIDEO_BACKGROUND_EXPRESSION =
  '((min(r,min(g,b))>0.75)&&((max(r,max(g,b))-min(r,min(g,b)))<0.02))?1:0';
const VIDEO_GROUND_ALPHA_EXPRESSION =
  'u.a*((j/h>0.68)&&(min(u.r,min(u.g,u.b))>0.25)&&((max(u.r,max(u.g,u.b))-min(u.r,min(u.g,u.b)))<0.08)?0:1)';
const STILL_ALPHA_EXPRESSION =
  'hard=u.a*max(0,min(1,(0.90-j/h)/0.08)); yGate=max(0,min(1,(j/h-0.70)/0.08)); xGate=max(0,min(1,(i/w-0.05)/0.10))*max(0,min(1,(0.95-i/w)/0.10)); delta=(1-(u.r+u.g+u.b)/3)-0.012; diff=max(0,min(1,delta*5)); max(hard,diff*yGate*xGate)';

interface CommandResult {
  stdout: string;
  stderr: string;
}

interface AlphaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SquareCrop {
  x: number;
  y: number;
  size: number;
}

async function runCommand(command: string, arguments_: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, arguments_, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    childProcess.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    childProcess.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    childProcess.on('error', reject);
    childProcess.on('close', (exitCode) => {
      const result = {
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      };

      if (exitCode !== 0) {
        reject(
          new Error(
            `${command} exited with code ${String(exitCode)}\n${result.stderr || result.stdout}`,
          ),
        );
        return;
      }

      resolve(result);
    });
  });
}

async function mapInBatches<T, U>(
  values: T[],
  batchSize: number,
  operation: (value: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = [];

  for (let index = 0; index < values.length; index += batchSize) {
    results.push(...(await Promise.all(values.slice(index, index + batchSize).map(operation))));
  }

  return results;
}

async function listPngFrames(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath);
  return entries
    .filter((entry) => /^frame-\d{3}\.png$/.test(entry))
    .sort()
    .map((entry) => path.join(directoryPath, entry));
}

function frameDuration(frameIndex: number): number {
  return (frameIndex + 1) % 3 === 0 ? 41 : 42;
}

function parseAlphaBounds(value: string): AlphaBounds {
  const match = /^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$/.exec(value.trim());

  if (!match) {
    throw new Error(`Could not measure foreground bounds: ${value.trim() || 'empty result'}`);
  }

  const [, width = '0', height = '0', x = '0', y = '0'] = match;
  const bounds = {
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
  };

  if (bounds.width === 0 || bounds.height === 0) {
    throw new Error('The alpha matte contains no visible foreground.');
  }

  return bounds;
}

async function readAlphaBounds(imagePath: string): Promise<AlphaBounds> {
  const result = await runCommand('magick', [
    imagePath,
    '-alpha',
    'extract',
    '-threshold',
    '5%',
    '-format',
    '%@',
    'info:',
  ]);

  return parseAlphaBounds(result.stdout);
}

function combineAlphaBounds(bounds: AlphaBounds[]): AlphaBounds {
  const firstBounds = bounds[0];

  if (!firstBounds) {
    throw new Error('No alpha bounds were measured.');
  }

  const left = Math.min(...bounds.map(({ x }) => x));
  const top = Math.min(...bounds.map(({ y }) => y));
  const right = Math.max(...bounds.map(({ x, width }) => x + width));
  const bottom = Math.max(...bounds.map(({ y, height }) => y + height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function calculateSquareCrop(bounds: AlphaBounds): SquareCrop {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  if (bounds.x <= 2 || bounds.y <= 2 || right >= SOURCE_SIZE - 2 || bottom >= SOURCE_SIZE - 2) {
    throw new Error(
      'The source video already clips the mascot at a canvas edge. Regenerate it with more camera padding.',
    );
  }

  const paddedSize = Math.ceil(Math.max(bounds.width, bounds.height) * 1.08);
  const size = Math.min(SOURCE_SIZE, paddedSize);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const x = Math.max(0, Math.min(SOURCE_SIZE - size, Math.round(centerX - size / 2)));
  const y = Math.max(0, Math.min(SOURCE_SIZE - size, Math.round(centerY - size / 2)));

  return { x, y, size };
}

function assertOutputPadding(bounds: AlphaBounds): void {
  const minimumPadding = (OUTPUT_SIZE - OUTPUT_CONTENT_SIZE) / 2 - 2;
  const rightPadding = OUTPUT_SIZE - bounds.x - bounds.width;
  const bottomPadding = OUTPUT_SIZE - bounds.y - bounds.height;

  if (
    bounds.x < minimumPadding ||
    bounds.y < minimumPadding ||
    rightPadding < minimumPadding ||
    bottomPadding < minimumPadding
  ) {
    throw new Error(
      `Converted foreground is clipped or lacks padding: ${bounds.width}x${bounds.height}+${bounds.x}+${bounds.y}`,
    );
  }
}

function buildPreviewHtml(webpFileName: string, posterFileName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Enxovaly mascot preview</title>
    <style>
      * { box-sizing: border-box; }
      body { display: grid; min-height: 100vh; margin: 0; place-items: center; background: #211c26; }
      img { width: min(88vw, 384px); height: auto; }
    </style>
  </head>
  <body>
    <img src="./${webpFileName}" alt="Enxovaly mascot animation" width="384" height="384" onerror="this.src='./${posterFileName}'" />
  </body>
</html>
`;
}

export async function checkMediaTools(): Promise<Record<string, boolean>> {
  const tools = ['ffmpeg', 'magick', 'img2webp', 'webpmux'];
  const results = await Promise.all(
    tools.map(async (tool) => {
      try {
        await runCommand('which', [tool]);
        return [tool, true] as const;
      } catch {
        return [tool, false] as const;
      }
    }),
  );

  return Object.fromEntries(results);
}

export async function removeWhiteBackground(
  inputImagePath: string,
  outputImagePath: string,
): Promise<void> {
  await runCommand('magick', [
    inputImagePath,
    '-alpha',
    'on',
    '-bordercolor',
    'white',
    '-border',
    '1',
    '-fuzz',
    '4%',
    '-fill',
    'none',
    '-draw',
    'alpha 0,0 floodfill',
    '-shave',
    '1x1',
    '-channel',
    'A',
    '-fx',
    STILL_ALPHA_EXPRESSION,
    '-blur',
    '0x0.45',
    '+channel',
    '-strip',
    outputImagePath,
  ]);
}

export async function convertVideoToWebp(
  inputVideoPath: string,
  outputDirectory: string,
  assetName: string,
): Promise<AnimatedAsset> {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'enxovaly-mascot-'));
  const sourceFramesDirectory = path.join(temporaryDirectory, 'source-frames');
  const matteFramesDirectory = path.join(temporaryDirectory, 'matte-frames');
  const alphaFramesDirectory = path.join(temporaryDirectory, 'alpha-frames');
  const webpPath = path.join(outputDirectory, `${assetName}.webp`);
  const posterPath = path.join(outputDirectory, `${assetName}-poster.png`);
  const previewPath = path.join(outputDirectory, 'preview.html');

  try {
    await runCommand('mkdir', [
      '-p',
      sourceFramesDirectory,
      matteFramesDirectory,
      alphaFramesDirectory,
    ]);
    await runCommand('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputVideoPath,
      '-vf',
      `fps=${FRAMES_PER_SECOND},scale=${SOURCE_SIZE}:${SOURCE_SIZE}:force_original_aspect_ratio=decrease,pad=${SOURCE_SIZE}:${SOURCE_SIZE}:(ow-iw)/2:(oh-ih)/2:color=white`,
      path.join(sourceFramesDirectory, 'frame-%03d.png'),
    ]);

    const sourceFrames = await listPngFrames(sourceFramesDirectory);

    if (sourceFrames.length === 0) {
      throw new Error('No video frames were extracted.');
    }

    await mapInBatches(sourceFrames, CONCURRENCY, async (sourceFrame) => {
      const destinationFrame = path.join(matteFramesDirectory, path.basename(sourceFrame));

      await runCommand('magick', [
        sourceFrame,
        '(',
        '+clone',
        '-alpha',
        'off',
        '-fx',
        VIDEO_BACKGROUND_EXPRESSION,
        '-alpha',
        'on',
        '-fuzz',
        '0%',
        '-fill',
        'none',
        '-draw',
        'alpha 0,0 floodfill',
        '-alpha',
        'extract',
        ')',
        '-alpha',
        'off',
        '-compose',
        'CopyOpacity',
        '-composite',
        '-channel',
        'A',
        '-fx',
        VIDEO_GROUND_ALPHA_EXPRESSION,
        '-threshold',
        '5%',
        '-morphology',
        'Open',
        'Disk:2',
        '+channel',
        '(',
        '+clone',
        '-alpha',
        'extract',
        '-threshold',
        '5%',
        '-define',
        'connected-components:area-threshold=100',
        '-define',
        'connected-components:mean-color=true',
        '-connected-components',
        '8',
        ')',
        '-alpha',
        'off',
        '-compose',
        'CopyOpacity',
        '-composite',
        '-channel',
        'A',
        '-blur',
        '0x0.45',
        '+channel',
        '-strip',
        destinationFrame,
      ]);
    });

    const matteFrames = await listPngFrames(matteFramesDirectory);
    const matteBounds = await mapInBatches(matteFrames, CONCURRENCY, readAlphaBounds);
    const crop = calculateSquareCrop(combineAlphaBounds(matteBounds));

    await mapInBatches(matteFrames, CONCURRENCY, async (matteFrame) => {
      const destinationFrame = path.join(alphaFramesDirectory, path.basename(matteFrame));

      await runCommand('magick', [
        matteFrame,
        '-crop',
        `${crop.size}x${crop.size}+${crop.x}+${crop.y}`,
        '+repage',
        '-resize',
        `${OUTPUT_CONTENT_SIZE}x${OUTPUT_CONTENT_SIZE}`,
        '-gravity',
        'center',
        '-background',
        'none',
        '-extent',
        `${OUTPUT_SIZE}x${OUTPUT_SIZE}`,
        '-strip',
        destinationFrame,
      ]);
    });

    const alphaFrames = await listPngFrames(alphaFramesDirectory);
    const outputBounds = combineAlphaBounds(
      await mapInBatches(alphaFrames, CONCURRENCY, readAlphaBounds),
    );
    assertOutputPadding(outputBounds);
    const webpArguments = ['-loop', '0', '-min_size', '-mixed', '-sharp_yuv', '-kmin', '9', '-kmax', '17'];

    alphaFrames.forEach((alphaFrame, index) => {
      webpArguments.push(
        '-d',
        String(frameDuration(index)),
        '-lossy',
        '-q',
        '92',
        '-m',
        '4',
        '-exact',
        alphaFrame,
      );
    });
    webpArguments.push('-o', webpPath);

    await runCommand('img2webp', webpArguments);
    await copyFile(alphaFrames[0] ?? '', posterPath);
    await writeFile(
      previewPath,
      buildPreviewHtml(path.basename(webpPath), path.basename(posterPath)),
      'utf8',
    );

    const webpInfo = await runCommand('webpmux', ['-info', webpPath]);
    const combinedInfo = `${webpInfo.stdout}${webpInfo.stderr}`;

    if (!combinedInfo.includes('animation transparency')) {
      throw new Error('The encoded WebP is missing animation or transparency.');
    }

    return {
      webpPath,
      posterPath,
      previewPath,
      frameCount: alphaFrames.length,
      webpInfo: combinedInfo,
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
