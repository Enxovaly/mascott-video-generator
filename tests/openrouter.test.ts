import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateVideo } from '../src/openrouter.js';
import type { AppConfig, ImageReference } from '../src/types.js';

const config: AppConfig = {
  projectRoot: '/tmp/enxovaly-mascott',
  appName: 'Enxovaly Mascot Lab Test',
  httpReferer: 'http://localhost',
  videoModel: 'bytedance/seedance-2.0',
  videoSize: '480x480',
  videoDuration: 4,
  pollIntervalMs: 10,
  pollTimeoutMs: 100,
  referencePath: '/tmp/reference.png',
  characterSheetPath: '/tmp/sheet.png',
  characterStandardPath: '/tmp/CHARACTER.md',
  outputDir: '/tmp/outputs',
};

const reference: ImageReference = {
  type: 'image_url',
  image_url: { url: 'data:image/png;base64,dGVzdA==' },
};

describe('generateVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits the approved reference to the optional Seedance transport', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          id: 'video-1',
          status: 'completed',
          unsigned_urls: ['https://example.com/video.mp4'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateVideo(
        config,
        'test-key',
        { prompt: 'Test prompt', references: [reference] },
        vi.fn(),
      ),
    ).resolves.toMatchObject({ id: 'video-1', status: 'completed' });
    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as {
      generate_audio?: boolean;
      input_references?: ImageReference[];
    };

    expect(body.generate_audio).toBe(false);
    expect(body.input_references).toEqual([reference]);
  });
});
