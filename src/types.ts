export interface AppConfig {
  projectRoot: string;
  apiKey?: string;
  appName: string;
  httpReferer: string;
  videoModel: string;
  videoSize: string;
  videoDuration: number;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  referencePath: string;
  characterSheetPath: string;
  characterStandardPath: string;
  outputDir: string;
}

export interface CliOptions {
  command: string;
  values: Record<string, string | boolean>;
}

export interface ImageReference {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export interface Usage {
  cost?: number;
}

export interface GenerationResult {
  outputDirectory: string;
  usage?: Usage;
}

export interface VideoJob {
  id: string;
  polling_url?: string;
  status: string;
  generation_id?: string;
  unsigned_urls?: string[];
  usage?: Usage;
  error?: string;
}

export interface AnimatedAsset {
  webpPath: string;
  posterPath: string;
  previewPath: string;
  frameCount: number;
  webpInfo: string;
}

export interface GenerationManifest {
  kind: 'animation' | 'still' | 'conversion';
  name: string;
  createdAt: string;
  prompt?: string;
  composedPrompt?: string;
  model?: string;
  referenceFiles: string[];
  sourceFile?: string;
  outputFiles: string[];
  usage?: Usage;
  video?: {
    durationSeconds: number;
    framesPerSecond: number;
    frameCount: number;
    size: string;
  };
}
