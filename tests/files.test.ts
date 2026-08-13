import { describe, expect, it } from 'vitest';

import { slugify } from '../src/files.js';

describe('slugify', () => {
  it('creates stable lowercase asset names', () => {
    expect(slugify('Olá, Enxovaly! Happy Wave')).toBe('ola-enxovaly-happy-wave');
  });

  it('falls back when the name has no usable characters', () => {
    expect(slugify('---')).toBe('mascot-asset');
  });
});
