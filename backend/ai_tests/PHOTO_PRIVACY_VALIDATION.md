# Photo privacy filter validation

## Current status

The face and plate privacy filter has **not been validated on representative Egyptian photos**. The repository contains no annotated Egyptian face/plate evaluation set. Existing `test_ai_image.py` checks image normalization, metadata removal, dimension limits, the blur operation when given a known box, and basic detector wiring (including a blank image and mocked cascades). Those tests do not establish that the cascades find real faces or Egyptian license plates.

Photo analysis remains disabled by default (`GEMINI_PHOTO_ANALYSIS_ENABLED=false`). Do not enable it for production until the validation gate below passes. The current plate detector is OpenCV's `haarcascade_russian_plate_number.xml`; it is not an Egyptian plate detector and must be treated as unvalidated for local plate formats.

## Safe evaluation set

- Build an evaluation set from explicitly consented volunteer photos or purpose-built staged images. Do not use live citizen reports or put identifiable photos in Git.
- Keep the source images and annotations in access-controlled storage outside the repository. Use synthetic/staged images wherever feasible; delete source images when the evaluation is complete unless consent explicitly covers retention.
- Include both faces and plates, with varied distance, scale, lighting (including night), camera angle, occlusion, motion blur, image quality, and Egyptian plate layouts. Include images with no sensitive regions to measure false positives. Include frontal and non-frontal faces.
- Have a reviewer annotate every visible face and plate with a bounding box. Keep a held-out set separate from any tuning set and record detector/version/configuration with the results.

## Evaluation and release gate

1. Run every source photo through the same `prepare_photo` pipeline used before Gemini. Save outputs only in the controlled evaluation environment.
2. Compare detected boxes with the annotations using intersection-over-union (IoU) >= 0.5 as a match. Report recall and miss count separately for faces and plates, plus false positives per image. Review misses by condition (for example, angled plates and non-frontal faces).
3. Inspect the normalized output for every annotated region and confirm the sensitive content is obscured, including the margins. Check that images with no annotations remain usable and that metadata is stripped and dimensions are capped.
4. **Release gate:** require zero missed annotated faces and zero missed annotated plates in the held-out set, and confirm every annotated region is visibly obscured in the output. Any miss blocks production enablement; improve the detector/filter or use a safer product flow such as requiring manual cropping/obscuring, then rerun the held-out evaluation. Document sample counts, conditions, results, and limitations without storing the images in Git.

This finite evaluation is a deployment gate, not a guarantee for every future photo. Keep consent and a disable switch, monitor quality feedback without retaining photo contents, and reassess after detector or preprocessing changes.
