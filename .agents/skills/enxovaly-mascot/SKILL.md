---
name: enxovaly-mascot
description: Codex-first workflow for creating, animating, inspecting, and exporting the canonical Enxovaly mascot.
---

# Enxovaly Mascot

Codex is the operator. The user describes the asset in natural language; do
not make them orchestrate CLI commands unless they explicitly ask for manual
instructions.

## Required context

1. Read `references/CHARACTER.md` completely.
2. Inspect `references/mascot-master.png` as the primary identity reference.
3. Inspect `references/mascot-character-sheet.png` only for secondary style,
   pose, and expression guidance.
4. Never replace canonical references without explicit user approval.
5. Run `pnpm mascot doctor` before the first asset operation in a task.

## Static workflow: Codex-native

1. Compose the still prompt with `pnpm mascot prompt --mode still --prompt "..."`.
2. Use Codex image generation with both canonical reference images. Never call
   OpenRouter for image generation.
3. Inspect the generated source. Reject identity drift, altered curl, changed
   swaddle construction, extra limbs, damaged eyes, text, props, or cropping.
4. Save the approved opaque source locally, then run:

   ```bash
   pnpm mascot prepare-still --input <approved-source> --name <slug>
   ```

5. Inspect the transparent PNG on both light and dark backgrounds. A
   transparent PNG can look blank in a white-only viewer; verify its alpha
   channel before treating it as broken.

## Animation workflow

Seedance is mandatory for every newly generated animation. Never create a
deterministic, procedural, sprite-based, CSS, Three.js, transform-only, or
frame-interpolation substitute.

1. Create or select an approved still keyframe first. Prefer the requested
   pose rather than asking a video model to invent both identity and motion.
2. Compose the animation prompt with
   `pnpm mascot prompt --mode animate --prompt "..."`.
3. Seedance is not a built-in Codex video model. It requires a video provider.
   The repository currently uses OpenRouter as its Seedance transport. Before
   a paid request, tell the user and require explicit approval.
4. When Seedance generation is approved, run:

   ```bash
   pnpm mascot animate \
     --reference <approved-keyframe> \
     --name <slug> \
     --prompt "<one simple loopable action>" \
     --yes
   ```

5. If OpenRouter is unavailable or forbidden and no other Seedance provider is
   configured, stop and explain that animation generation is blocked. Never
   fall back to local deterministic motion.
6. Only when the user explicitly provides or approves an existing Seedance
   video, skip generation and run:

   ```bash
   pnpm mascot convert --input <video> --name <slug>
   ```

## Animation defaults

- Four seconds, square, locked camera, no audio, seamless loop.
- One readable action plus subtle secondary motion.
- White studio background for connected-edge alpha extraction.
- Keep the complete mascot and ground shadow visible in every frame.

## Quality gate

Before reporting completion:

1. Run `pnpm typecheck` and `pnpm test` after code changes.
2. Confirm `webpmux -info` reports animation and transparency.
3. Inspect at least seven evenly spaced source and WebP frames on light and
   dark backgrounds.
4. Confirm the adaptive crop leaves transparent padding on every edge.
5. Reject identity drift, duplicated limbs, damaged eyes, broken swaddle
   panels, white matte islands, clipping, or camera movement.
6. Keep failed paid generations for review. Never spend again automatically.
7. Verify the manifest model identifies Seedance; reject any animation made by
   another model or a local deterministic renderer.

## Deliverables

- Static: source image, transparent PNG, and manifest.
- Animation: source MP4, animated WebP, transparent poster, preview HTML,
  prompt, and manifest.
