import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

const originalVideoSize = process.env.MASCOT_VIDEO_SIZE;
const originalVideoModel = process.env.MASCOT_VIDEO_MODEL;

describe('loadConfig', () => {
  afterEach(() => {
    if (originalVideoSize === undefined) {
      delete process.env.MASCOT_VIDEO_SIZE;
    } else {
      process.env.MASCOT_VIDEO_SIZE = originalVideoSize;
    }

    if (originalVideoModel === undefined) {
      delete process.env.MASCOT_VIDEO_MODEL;
    } else {
      process.env.MASCOT_VIDEO_MODEL = originalVideoModel;
    }
  });

  it('uses a square size supported by Seedance 2.0 by default', () => {
    delete process.env.MASCOT_VIDEO_SIZE;

    expect(loadConfig().videoSize).toBe('480x480');
  });

  it('rejects non-Seedance animation models', () => {
    process.env.MASCOT_VIDEO_MODEL = 'local/deterministic-animation';

    expect(() => loadConfig()).toThrow(
      'MASCOT_VIDEO_MODEL must be a Seedance model, received: local/deterministic-animation',
    );
  });
});
