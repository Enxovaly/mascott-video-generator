const ANIMATION_RULES = `
Animation production rules:
- Create one continuous seamless loop with no cuts or transitions.
- Keep a locked, front-facing camera and a fixed centered composition.
- Preserve exact identity, proportions, materials, face, curl, colors, arms,
  feet, and swaddle construction in every frame.
- Perform one simple readable action with subtle secondary body motion.
- Start and end in compatible neutral poses for a clean loop.
- Use a clean white studio background with no text, props, scenery, borders,
  logos, or watermark.
- Keep the complete character and soft ground shadow visible at all times.
- No audio.
`;

const STILL_RULES = `
Still-image production rules:
- Create one centered, fully visible character on a clean pure-white studio
  background that can be removed locally after generation.
- Preserve exact identity, proportions, materials, face, curl, colors, arms,
  feet, and swaddle construction.
- Use a polished premium 3D toy render with gentle studio lighting.
- Keep only one subtle centered ground shadow; do not add a floor horizon.
- No text, props, scenery, borders, logos, watermark, or additional character.
`;

function normalizePrompt(value: string): string {
  const normalizedValue = value.trim().replaceAll(/\s+/g, ' ');

  if (!normalizedValue) {
    throw new Error('Prompt cannot be empty.');
  }

  return normalizedValue;
}

export function buildAnimationPrompt(userPrompt: string, characterStandard: string): string {
  return `${characterStandard.trim()}\n\n${ANIMATION_RULES.trim()}\n\nRequested action:\n${normalizePrompt(userPrompt)}`;
}

export function buildStillPrompt(userPrompt: string, characterStandard: string): string {
  return `${characterStandard.trim()}\n\n${STILL_RULES.trim()}\n\nRequested image:\n${normalizePrompt(userPrompt)}`;
}
