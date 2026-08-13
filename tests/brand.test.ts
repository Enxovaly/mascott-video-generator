import { describe, expect, it } from 'vitest';

import { buildAnimationPrompt, buildStillPrompt } from '../src/brand.js';

const CHARACTER_STANDARD = 'Lavender Enxovaly mascot with one crescent curl.';

describe('brand prompts', () => {
  it('locks animation identity and includes the requested action', () => {
    const prompt = buildAnimationPrompt('Wave twice and smile.', CHARACTER_STANDARD);

    expect(prompt).toContain(CHARACTER_STANDARD);
    expect(prompt).toContain('Wave twice and smile.');
    expect(prompt).toContain('locked, front-facing camera');
    expect(prompt).toContain('seamless loop');
    expect(prompt).toContain('No audio');
  });

  it('requests an extraction-safe static image', () => {
    const prompt = buildStillPrompt('Hold a small heart.', CHARACTER_STANDARD);

    expect(prompt).toContain('Hold a small heart.');
    expect(prompt).toContain('pure-white studio');
    expect(prompt).toContain('fully visible character');
  });

  it('rejects an empty user prompt', () => {
    expect(() => buildAnimationPrompt('   ', CHARACTER_STANDARD)).toThrow('Prompt cannot be empty');
  });
});
