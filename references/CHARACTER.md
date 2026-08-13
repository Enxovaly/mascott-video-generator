# Enxovaly mascot character standard

## Identity lock

- One small, friendly baby-like mascot wrapped in a lavender swaddle.
- Rounded upright egg silhouette with a slightly wider lower body.
- Large warm dark-brown eyes with clean white highlights.
- Cream-colored face fully enclosed by the lavender hood.
- One dark-brown crescent curl centered high on the forehead.
- Two overlapping lavender leaf-shaped swaddle panels meeting at the center.
- Short rounded lavender arms and two small dark-brown oval feet.
- Soft premium 3D toy rendering with smooth gradients and gentle ambient light.
- Child-safe, calm, affectionate, optimistic personality.

## Canonical palette

- Hood and swaddle: lavender, approximately `#C9ACE5`.
- Panel shadows: muted violet, approximately `#A984C8`.
- Face: warm cream, approximately `#FFF4E6`.
- Eyes, curl, and feet: deep warm brown, approximately `#2D211C`.
- Mouth accent: soft coral, approximately `#EF776F`.

## Proportions

- Head and body read as one continuous rounded silhouette.
- Face occupies roughly the upper-middle 45% of the body.
- Eyes are large but remain separated by approximately one eye width.
- Arms are short and mitten-like; never human hands or articulated fingers.
- Feet are small and remain directly below the body.

## Rendering rules

- Keep the character centered, fully visible, and front-facing unless the task
  explicitly asks for a slight three-quarter turn.
- Preserve the same face, curl, body proportions, colors, material, and panel
  construction across every frame.
- Keep the camera locked for product UI animations.
- Prefer a plain white studio background for generated videos so the local
  matting pipeline can recover clean transparency.
- Use a transparent background for generated still images.
- Keep one consistent soft ground shadow unless the prompt requests floating.

## Never introduce

- Text, logos, watermarks, borders, scenery, or additional characters.
- Hair beyond the single crescent curl.
- Ears, nose, realistic fingers, separate clothing, shoes, or accessories.
- Sudden shape changes, limb duplication, face drift, palette changes, cuts,
  zooms, camera shake, or background flicker.
- Photorealistic skin, hard plastic shine, gritty texture, or sharp shadows.
