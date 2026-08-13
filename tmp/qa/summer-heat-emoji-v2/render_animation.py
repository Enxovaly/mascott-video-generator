from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw


FRAME_COUNT = 100
DROP_CYCLES = 2


def create_droplet(size: int, opacity: int) -> Image.Image:
    scale = 4
    scaled_size = size * scale
    sprite = Image.new("RGBA", (scaled_size, scaled_size * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sprite)
    center_x = scaled_size // 2
    bulb_top = scaled_size // 2
    color = (87, 190, 238, opacity)
    outline = (55, 145, 210, round(opacity * 0.72))

    draw.polygon(
        (
            (center_x, 0),
            (round(scaled_size * 0.16), round(scaled_size * 1.08)),
            (round(scaled_size * 0.84), round(scaled_size * 1.08)),
        ),
        fill=color,
    )
    draw.ellipse(
        (0, bulb_top, scaled_size, round(scaled_size * 1.62)),
        fill=color,
        outline=outline,
        width=max(2, scale),
    )
    draw.ellipse(
        (
            round(scaled_size * 0.24),
            round(scaled_size * 0.62),
            round(scaled_size * 0.43),
            round(scaled_size * 0.9),
        ),
        fill=(255, 255, 255, round(opacity * 0.68)),
    )
    return sprite.resize((size, size * 2), Image.Resampling.LANCZOS)


def composite_falling_drop(
    frame: Image.Image,
    frame_progress: float,
    start_x: int,
    start_y: int,
    size: int,
    phase_offset: float,
) -> None:
    drop_progress = (frame_progress * DROP_CYCLES + phase_offset) % 1
    opacity_curve = math.sin(math.pi * drop_progress) ** 0.72
    opacity = round(235 * opacity_curve)

    if opacity < 8:
        return

    fall_distance = 320 * drop_progress**1.55
    horizontal_drift = 24 * drop_progress + 7 * math.sin(math.pi * drop_progress)
    current_size = round(size * (1 - 0.18 * drop_progress))
    droplet = create_droplet(current_size, opacity)
    position = (
        round(start_x + horizontal_drift - current_size / 2),
        round(start_y + fall_distance - current_size / 2),
    )
    frame.alpha_composite(droplet, position)


def render_frames(keyframe_path: Path, frames_dir: Path) -> None:
    keyframe = Image.open(keyframe_path).convert("RGBA")
    frames_dir.mkdir(parents=True, exist_ok=True)

    drop_specs = (
        (704, 548, 30, 0.02),
        (731, 577, 24, 0.36),
        (681, 594, 20, 0.7),
    )

    for frame_index in range(FRAME_COUNT):
        frame_progress = frame_index / FRAME_COUNT
        frame = keyframe.copy()
        for drop_spec in drop_specs:
            composite_falling_drop(frame, frame_progress, *drop_spec)
        frame.save(frames_dir / f"frame-{frame_index:03d}.png")


if __name__ == "__main__":
    project_dir = Path(__file__).resolve().parents[3]
    output_dir = project_dir / "outputs" / "summer-heat-emoji-v2"
    render_frames(
        output_dir / "summer-heat-emoji-keyframe.png",
        output_dir / "frames",
    )
