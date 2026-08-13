import path from 'node:path';

import { loadConfig } from './config.js';
import {
  composePrompt,
  convertExistingVideo,
  doctor,
  generateAnimation,
  prepareStill,
} from './pipeline.js';
import type { CliOptions, GenerationResult } from './types.js';

const USAGE = `Enxovaly mascot pipeline

Commands:
  pnpm mascot animate --prompt "..." --name wave --yes [--reference ./approved.png]
  pnpm mascot prepare-still --input ./codex-image.png --name happy
  pnpm mascot convert --input ./video.mp4 --name imported-wave
  pnpm mascot prompt --mode animate|still --prompt "..."
  pnpm mascot doctor
`;

function parseCliArguments(arguments_: string[]): CliOptions {
  const command = arguments_[0] ?? 'help';
  const values: Record<string, string | boolean> = {};

  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    if (!argument?.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument ?? ''}`);
    }

    const key = argument.slice(2);
    const nextArgument = arguments_[index + 1];

    if (!nextArgument || nextArgument.startsWith('--')) {
      values[key] = true;
      continue;
    }

    values[key] = nextArgument;
    index += 1;
  }

  return { command, values };
}

function getString(options: CliOptions, key: string): string | undefined {
  const value = options.values[key];
  return typeof value === 'string' ? value : undefined;
}

function requireString(options: CliOptions, key: string): string {
  const value = getString(options, key)?.trim();

  if (!value) {
    throw new Error(`--${key} is required.`);
  }

  return value;
}

function parseSeed(options: CliOptions): number | undefined {
  const value = getString(options, 'seed');

  if (!value) {
    return undefined;
  }

  const seed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(seed)) {
    throw new Error('--seed must be an integer.');
  }

  return seed;
}

function requirePaidConfirmation(options: CliOptions): void {
  if (options.values.yes !== true) {
    throw new Error('Paid generation was not started. Add --yes after reviewing the prompt.');
  }
}

function reportGenerationResult(result: GenerationResult): void {
  console.log(`completed ${result.outputDirectory}`);
  console.log(
    result.usage?.cost === undefined
      ? 'OpenRouter cost unavailable (provider returned no cost)'
      : `OpenRouter cost $${result.usage.cost.toFixed(4)} USD`,
  );
}

async function runAnimate(options: CliOptions): Promise<void> {
  requirePaidConfirmation(options);
  const config = loadConfig();
  const prompt = requireString(options, 'prompt');
  const seed = parseSeed(options);
  const reference = getString(options, 'reference');
  const result = await generateAnimation(config, {
    prompt,
    name: getString(options, 'name') ?? prompt,
    ...(reference ? { referencePath: path.resolve(config.projectRoot, reference) } : {}),
    ...(seed === undefined ? {} : { seed }),
    onStatus: console.log,
  });

  reportGenerationResult(result);
}

async function runPrepareStill(options: CliOptions): Promise<void> {
  const config = loadConfig();
  const inputPath = path.resolve(config.projectRoot, requireString(options, 'input'));
  const outputDirectory = await prepareStill(config, {
    inputPath,
    name: getString(options, 'name') ?? path.parse(inputPath).name,
    onStatus: console.log,
  });

  console.log(`completed ${outputDirectory}`);
}

async function runConvert(options: CliOptions): Promise<void> {
  const config = loadConfig();
  const inputPath = path.resolve(config.projectRoot, requireString(options, 'input'));
  const outputDirectory = await convertExistingVideo(config, {
    inputPath,
    name: getString(options, 'name') ?? path.parse(inputPath).name,
    onStatus: console.log,
  });

  console.log(`completed ${outputDirectory}`);
}

async function runPrompt(options: CliOptions): Promise<void> {
  const config = loadConfig();
  const mode = getString(options, 'mode') ?? 'animate';

  if (mode !== 'animate' && mode !== 'still') {
    throw new Error('--mode must be animate or still.');
  }

  console.log(await composePrompt(config, mode, requireString(options, 'prompt')));
}

async function runDoctor(): Promise<void> {
  const config = loadConfig();
  const checks = await doctor(config);
  checks.forEach((check) => console.log(check));

  if (checks.some((check) => check.startsWith('FAIL'))) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const options = parseCliArguments(process.argv.slice(2));
  const commands: Record<string, () => Promise<void>> = {
    animate: () => runAnimate(options),
    'prepare-still': () => runPrepareStill(options),
    convert: () => runConvert(options),
    prompt: () => runPrompt(options),
    doctor: runDoctor,
    help: async () => console.log(USAGE),
  };
  const command = commands[options.command];

  if (!command) {
    throw new Error(`Unknown command: ${options.command}\n\n${USAGE}`);
  }

  await command();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR ${message}`);
  process.exitCode = 1;
});
