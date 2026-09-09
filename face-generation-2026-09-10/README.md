# Facial frames

Ten required files were produced beside the five current base images in `vs-character`: `<pose>-blink.png` and `<pose>-talk.png`. Optional `talk2` frames were not requested as a required part of the guide and were omitted.

Built-in image generation produced one facial donor per pose. Prompt set: preserve the original canvas, face position, head angle and skin shading; close both eyes with soft curves and lashes while preserving eyebrows; open the mouth into a rounded mid-word shape with a hint of upper teeth. The pointing poses follow their respective head angles. Donors are retained here for reproducibility.

`tools/build-face-frames.py` blends only the relevant eye or mouth patches into each original pose. All pixels outside the explicit feature masks and every alpha byte are verified identical to the base. No cropping, scaling or repositioning is applied to final frames. PNG exports carry no added donor metadata. Base files are untouched.

`validation.json` records exact changed-pixel bounds and invariance checks. `face-review.jpg` shows the five poses in rows, with base, blink and talk in columns. The separate `tools/check-faces.py` check verifies the guide's change-area limits.
