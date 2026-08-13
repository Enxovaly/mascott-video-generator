# Enxovaly Mascot Lab

A Codex-first workspace for producing identity-consistent Enxovaly mascot
stills and animations.

## Intended workflow

Open this folder in Codex and describe the result:

> Create a mascot asset called `welcome-heart`. Generate an approved heart-pose
> still, then create a four-second loop where the mascot forms the heart,
> smiles, and returns to the initial pose. Export transparent PNG and animated
> WebP, and visually inspect both.

Codex reads `.agents/skills/enxovaly-mascot/SKILL.md`, applies the canonical
character standard, performs generation, runs local processing, inspects the
artifacts, and reports the result. You do not need to run every CLI command.
The CLI is the local processing and Seedance transport layer used by the skill.

## Setup

```bash
pnpm install
pnpm mascot doctor
```

Static images use Codex image generation and need no OpenRouter key.

Seedance is mandatory for every new animation and is not built into Codex.
Create `.env` from `.env.example` and set `OPENROUTER_API_KEY` before requesting
animation. The key is not needed for stills, remains local and Git-ignored, and
is used only for an explicitly approved paid Seedance call.

The workflow never replaces Seedance with deterministic, procedural,
sprite-based, CSS, Three.js, transform-only, or frame-interpolation animation.
If Seedance cannot run, animation generation stops with an explicit error.

## Workflow boundaries

| Operation | Operator | OpenRouter |
| --- | --- | --- |
| Generate or revise a still | Codex image generation | Never |
| Remove a still background | Local ImageMagick pipeline | Never |
| Convert MP4 to animated WebP | Local FFmpeg/WebP pipeline | Never |
| Generate any new animation | Seedance | Required by the current adapter |
| Inspect and accept artifacts | Codex visual QA | Never |

If OpenRouter is forbidden, Codex can still create static mascot assets and
process an existing approved Seedance video. New animation remains blocked
until another Seedance provider is configured.

## What Codex runs internally

Prepare a Codex-generated still:

```bash
pnpm mascot prepare-still \
  --input ./work/welcome-heart-approved.png \
  --name welcome-heart
```

Generate Seedance motion from an approved keyframe:

```bash
pnpm mascot animate \
  --reference ./work/welcome-heart-approved.png \
  --name welcome-heart-animation \
  --prompt "The mascot forms a heart with both arms, smiles, and returns to the initial pose" \
  --yes
```

`--yes` authorizes one paid video request. Codex must not add it without an
explicit generation request from the user.

Convert an existing approved video without any API call:

```bash
pnpm mascot convert \
  --input ./references/motion-wave.mp4 \
  --name reference-wave
```

Inspect a character-locked prompt without generating:

```bash
pnpm mascot prompt \
  --mode animate \
  --prompt "The mascot gives one gentle wave and returns to the initial pose"
```

## Outputs

Static run:

```text
outputs/welcome-heart/
├── welcome-heart-source.png
├── welcome-heart.png
└── manifest.json
```

Animation run:

```text
outputs/welcome-heart-animation/
├── welcome-heart-animation-source.mp4
├── welcome-heart-animation.webp
├── welcome-heart-animation-poster.png
├── preview.html
├── prompt.txt
└── manifest.json
```

The converter measures the foreground across all frames, applies one stable
crop, adds transparent edge padding, and rejects clipped sources. It no longer
uses coordinates tuned to one sample animation.

Transparent PNGs may look empty in viewers with a white canvas. Inspect them
on a dark or checkerboard background before treating them as invalid.

## Manual commands

```text
pnpm mascot animate --prompt "..." --name <slug> --reference <image> --yes
pnpm mascot prepare-still --input <image> --name <slug>
pnpm mascot convert --input <video> --name <slug>
pnpm mascot prompt --mode animate|still --prompt "..."
pnpm mascot doctor
pnpm typecheck
pnpm test
```
