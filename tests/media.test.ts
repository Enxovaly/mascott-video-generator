import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { convertVideoToWebp, removeWhiteBackground } from '../src/media.js';

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

describe('removeWhiteBackground', () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it('removes the edge-connected white canvas without damaging a cream face', async () => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'mascot-matte-test-'));
    temporaryDirectories.push(temporaryDirectory);
    const sourcePath = path.join(temporaryDirectory, 'source.png');
    const outputPath = path.join(temporaryDirectory, 'output.png');

    await execFileAsync('magick', [
      '-size',
      '128x128',
      'xc:white',
      '-fill',
      '#c9ace5',
      '-draw',
      'circle 64,64 64,18',
      '-fill',
      '#fff4e6',
      '-draw',
      'circle 64,55 64,35',
      sourcePath,
    ]);
    await removeWhiteBackground(sourcePath, outputPath);
    const { stdout } = await execFileAsync('magick', [
      outputPath,
      '-alpha',
      'extract',
      '-format',
      '%[pixel:p{0,0}]|%[pixel:p{64,55}]',
      'info:',
    ]);

    expect(stdout).toBe('srgb(0,0,0)|srgb(255,255,255)');
  });

  it('keeps the complete moving foreground inside a transparent padded canvas', async () => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'mascot-convert-test-'));
    temporaryDirectories.push(temporaryDirectory);
    const sourceFramePath = path.join(temporaryDirectory, 'source-001.png');
    const secondSourceFramePath = path.join(temporaryDirectory, 'source-002.png');
    const sourceVideoPath = path.join(temporaryDirectory, 'source.mp4');

    await execFileAsync('magick', [
      '-size',
      '640x640',
      'xc:#ededed',
      '-fill',
      '#dedede',
      '-draw',
      'rectangle 0,480 639,639',
      '-fill',
      '#b894dd',
      '-draw',
      'ellipse 320,330 250,250 0,360',
      '-draw',
      'ellipse 95,260 70,38 0,360',
      '-fill',
      '#fff4e6',
      '-draw',
      'ellipse 320,250 130,110 0,360',
      '-fill',
      '#241c1a',
      '-draw',
      'ellipse 245,565 42,28 0,360',
      '-draw',
      'ellipse 395,565 42,28 0,360',
      sourceFramePath,
    ]);
    await execFileAsync('magick', [
      sourceFramePath,
      '-fill',
      '#241c1a',
      '-draw',
      'circle 320,330 326,330',
      secondSourceFramePath,
    ]);
    await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-framerate',
      '24',
      '-i',
      path.join(temporaryDirectory, 'source-%03d.png'),
      '-pix_fmt',
      'yuv420p',
      sourceVideoPath,
    ]);

    const asset = await convertVideoToWebp(sourceVideoPath, temporaryDirectory, 'mascot');
    const { stdout } = await execFileAsync('magick', [
      asset.posterPath,
      '-alpha',
      'extract',
      '-threshold',
      '5%',
      '-format',
      '%@',
      'info:',
    ]);
    const match = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(stdout.trim());

    expect(match).not.toBeNull();
    const [, width = '0', height = '0', x = '0', y = '0'] = match ?? [];
    expect(Number(x)).toBeGreaterThanOrEqual(16);
    expect(Number(y)).toBeGreaterThanOrEqual(16);
    expect(Number(width)).toBeLessThanOrEqual(352);
    expect(Number(height)).toBeLessThanOrEqual(352);
  }, 30_000);
});
