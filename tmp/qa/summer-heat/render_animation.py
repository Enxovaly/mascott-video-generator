from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


FRAME_COUNT = 100
FRAME_DURATION_MS = 50
FAN_CYCLES = 10


ARM_POLYGON = (
    (374, 630),
    (335, 635),
    (300, 647),
    (274, 663),
    (248, 649),
    (220, 647),
    (202, 657),
    (196, 679),
    (203, 707),
    (230, 744),
    (270, 782),
    (312, 817),
    (350, 847),
    (378, 835),
)
ARM_PIVOT = (355, 825)
ARM_MAX_ANGLE = 34


def create_arm_layer(keyframe: Image.Image) -> tuple[Image.Image, Image.Image]:
    mask = Image.new("L", keyframe.size, 0)
    ImageDraw.Draw(mask).polygon(ARM_POLYGON, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))

    arm_layer = Image.new("RGBA", keyframe.size, (0, 0, 0, 0))
    arm_layer.paste(keyframe, (0, 0), mask)
    return arm_layer, mask


def create_body_layer(keyframe: Image.Image, arm_mask: Image.Image) -> Image.Image:
    body_layer = keyframe.copy()
    outside_body_mask = Image.new("L", keyframe.size, 0)
    ImageDraw.Draw(outside_body_mask).rectangle((0, 620, 350, 860), fill=255)
    removal_mask = Image.composite(arm_mask, Image.new("L", keyframe.size, 0), outside_body_mask)
    body_layer.paste(Image.new("RGBA", keyframe.size, (0, 0, 0, 0)), (0, 0), removal_mask)
    return body_layer


def render_frames(keyframe_a_path: Path, keyframe_b_path: Path, frames_dir: Path) -> None:
    keyframe_a = Image.open(keyframe_a_path).convert("RGBA")
    keyframe_b = Image.open(keyframe_b_path).convert("RGBA")

    if keyframe_a.size != keyframe_b.size:
        raise ValueError("Animation keyframes must have identical dimensions")

    arm_layer, arm_mask = create_arm_layer(keyframe_b)
    body_layer = create_body_layer(keyframe_b, arm_mask)
    frames_dir.mkdir(parents=True, exist_ok=True)

    for frame_index in range(FRAME_COUNT):
        phase = 2 * math.pi * FAN_CYCLES * frame_index / FRAME_COUNT
        motion_progress = (1 - math.cos(phase)) / 2
        motion_strength = abs(math.sin(phase))
        arm_angle = -ARM_MAX_ANGLE * (1 - motion_progress)
        animated_arm = arm_layer.rotate(
            arm_angle,
            resample=Image.Resampling.BICUBIC,
            center=ARM_PIVOT,
        )
        frame = Image.alpha_composite(animated_arm, body_layer)

        overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        arc_alpha = round(76 * motion_strength)
        draw.arc((150, 575, 335, 845), 112, 242, fill=(201, 172, 229, arc_alpha), width=5)
        draw.arc((175, 600, 360, 820), 116, 236, fill=(239, 119, 111, arc_alpha // 2), width=3)

        shimmer = (1 + math.sin(phase + math.pi / 2)) / 2
        shimmer_alpha = round(105 * shimmer)
        draw.ellipse((681, 559, 689, 567), fill=(255, 255, 255, shimmer_alpha))
        draw.ellipse((711, 620, 718, 627), fill=(255, 255, 255, shimmer_alpha))

        Image.alpha_composite(frame, overlay).save(frames_dir / f"frame-{frame_index:03d}.png")


if __name__ == "__main__":
    project_dir = Path(__file__).resolve().parents[3]
    output_dir = project_dir / "outputs" / "summer-heat-20260807T113047Z"
    render_frames(
        output_dir / "summer-heat-keyframe.png",
        output_dir / "summer-heat-keyframe-b.png",
        output_dir / "frames",
    )
