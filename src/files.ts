import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function fileToDataUrl(filePath: string): Promise<string> {
  const extension = path.extname(filePath).toLowerCase();
  const mediaType = MIME_TYPES[extension];

  if (!mediaType) {
    throw new Error(`Unsupported reference format: ${extension}`);
  }

  const contents = await readFile(filePath);
  return `data:${mediaType};base64,${contents.toString('base64')}`;
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 64);

  return slug || 'mascot-asset';
}

function timestampSlug(date: Date): string {
  return date.toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

async function hasFiles(directoryPath: string): Promise<boolean> {
  try {
    const entries = await readdir(directoryPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

export async function createRunDirectory(outputRoot: string, requestedName: string): Promise<string> {
  const baseName = slugify(requestedName);
  const basePath = path.join(outputRoot, baseName);
  const outputPath = (await hasFiles(basePath))
    ? path.join(outputRoot, `${baseName}-${timestampSlug(new Date())}`)
    : basePath;

  await mkdir(outputPath, { recursive: true });
  return outputPath;
}

export async function assertReadableFile(filePath: string): Promise<void> {
  const fileStat = await stat(filePath).catch(() => undefined);

  if (!fileStat?.isFile()) {
    throw new Error(`Required file is missing: ${filePath}`);
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await writeFile(filePath, `${value.trim()}\n`, 'utf8');
}

export async function copyAsset(sourcePath: string, destinationPath: string): Promise<void> {
  await copyFile(sourcePath, destinationPath);
}
