# Regenerating the pose set

Instructions for producing a matched set of pose images for the character, with
`vs-character/standing/standing.png` as the fixed master reference. Everything
below is written so it can be pasted into an image generation model along with
that file.

## Why the current set does not match

Measured against `standing.png` (alpha threshold 32, canvas 1024 x 1536):

| pose | head top | shoe bottoms | body height | body scale | ground line off by | body centre x |
| --- | --- | --- | --- | --- | --- | --- |
| standing | 15 | 1515 | 1501 | **100.0%** | 0 | 519 |
| pointing-left | 64 | 1477 | 1414 | **94.2%** | 38 px high | 507 |
| pointing-right | 70 | 1480 | 1411 | **94.0%** | 35 px high | 532 |
| shrugging | 11 | 1497 | 1487 | 99.1% | 18 px high | 515 |
| arms-folded | 18 | 1501 | 1484 | 98.9% | 14 px high | 507 |

Body height is head top to shoe bottoms with raised arms excluded, so it is not
fooled by a hand above the head.

Three things are off:

1. **Scale.** Both pointing poses draw the character about 6% smaller than the
   master. Shrugging and arms-folded are within 1%, which is fine.
2. **Ground line.** The shoes do not rest on the same row. They wander across a
   38 px range, so the character floats higher in some poses than others.
3. **Horizontal position.** The body's centre line wanders across 25 px.

The app hides all three with per-pose correction constants, which is why it
looks right on screen. The source files themselves are not consistent, and a
matched set would let those constants go.

The likely cause is worth knowing because it shapes the fix: in the pointing
poses the raised finger reaches above the head, and the master leaves only 15
px of room above the head. The generator kept the finger inside the frame by
shrinking the whole figure and floating it upward. Ask for a hand above the
head inside this frame and the same thing will happen again.

## The master

`standing.png` is the reference for everything. Its geometry:

| | |
| --- | --- |
| canvas | 1024 x 1536, PNG, RGBA, fully transparent background |
| top of the head | y = 15 |
| bottom of the shoes (ground line) | y = 1515 |
| body height, head to shoes | 1501 px, 97.7% of the canvas |
| body centre line | x = 519, essentially the canvas centre of 512 |
| free space | 15 px above the head, 20 px below the shoes |

Every other pose must place the character at exactly this scale, on exactly
this ground line, on exactly this centre line. The overall silhouette may be
taller or wider than the master where a limb sticks out; the body underneath
it may not change.

## Headroom: choose one

Because the master fills 97.7% of the frame, there is no room for a hand above
the head. Pick one of these before generating anything.

**Option A, keep the master as it is.** In every pose, no part of the character
rises above y = 15, the top of the head. Hands may come up to head height but
not past it. A pointing gesture aims the finger sideways-and-up beside the
head rather than straight up over it. This is the option that keeps
`standing.png` untouched.

**Option B, re-cut the master too.** Regenerate `standing.png` first with the
body scaled to about 82% of the canvas height, roughly 1260 px tall, shoes on
y = 1440, head top around y = 180. That leaves about 180 px above the head for
raised hands. Then generate the other poses to match the new master. Better
results for pointing poses, at the cost of redoing the master. The app copes
either way; its size and placement are worked out from measurements, not fixed
numbers.

## The character

Use `standing.png` as the visual reference for all of this. In words, for the
model:

A young girl in a school uniform, drawn as a clean 2D cartoon illustration:
bold dark outlines, soft cel shading, warm skin, big brown eyes, small friendly
smile, rosy cheeks, small stud earrings. Dark brown hair with a centre parting,
pulled into two low pigtails, each tied with a red ribbon bow. White short-
sleeved collared shirt. Royal blue necktie. Navy pleated skirt to the knee.
White ribbed knee-high socks. Black Mary Jane shoes with a strap. Full body,
standing, feet together, facing the camera. Transparent background, no shadow
on the ground, no floor, no props.

Keep every one of these identical across the set: line weight, shading style,
colours, the proportions of the head to the body, the length of the skirt, the
height of the socks, the size of the bows. The only things that change between
poses are the arms, the hands, the head angle and the expression.

## Rules for every pose

Paste this block with each request.

```
Match the reference image exactly in scale and placement.

- Canvas 1024 x 1536, transparent background, PNG with alpha.
- The character is the same size as in the reference: the distance from the
  top of the head to the bottom of the shoes is the same number of pixels.
- The shoes rest on the same ground line as the reference, y = 1515.
- The body is on the same vertical centre line as the reference, x = 519.
- The body faces the camera with the feet together, as in the reference.
  Only the arms, hands, head angle and expression differ.
- Nothing rises above the top of the head (y = 15). Raised hands come up to
  head height at most.      [drop this line under Option B]
- Do not shrink, shift, tilt or re-centre the figure to fit a gesture. If a
  gesture does not fit, change the gesture, not the body.
- Same line weight, colours, shading, and proportions as the reference.
- No background, ground shadow, floor, or props.
```

## The poses

Five files, one per folder, named after the folder:

| file | pose |
| --- | --- |
| `standing/standing.png` | Master. Arms relaxed at the sides, hands open, facing the camera, warm smile. Leave this as it is under Option A. |
| `pointing-left/pointing-left.png` | The arm on the **left side of the image** is raised, index finger pointing up and to the left. Head turned to look up-left in the same direction. Other arm relaxed at the side. Bright, interested expression. |
| `pointing-right/pointing-right.png` | Mirror of the above: the arm on the **right side of the image** raised, finger pointing up and to the right, head turned to look up-right. Other arm relaxed. |
| `shrugging/shrugging.png` | Both arms out to the sides, elbows bent, palms turned up at about waist height, shoulders lifted. Puzzled, "I don't know" expression: raised brows, small pout or flat mouth. Facing the camera. |
| `arms-folded/arms-folded.png` | Arms crossed over the chest. Confident or mildly sceptical expression, slight smile, one eyebrow can lift. Facing the camera. |

Left and right refer to the viewer's side of the image, not the character's
own left and right.

## Checking the results

Do not judge by eye; the differences that matter are a few percent. From the
repo root:

```bash
python tools/compare-poses.py
```

It measures every pose against `standing.png` and reports body height, ground
line and centre line, with a pass or fail against these tolerances:

| measurement | tolerance |
| --- | --- |
| body height | within 1% of the master, about 15 px |
| ground line | within 5 px of y = 1515 |
| body centre line | within 10 px of x = 519 |

A pose that fails is regenerated, not corrected in the app.

Then measure the passing set for the app's registration constants:

```bash
python tools/measure-pose.py "vs-character/*/*.png"
```

and paste the output over the five `.pose[data-pose=...]` lines in
`vs-character/style.css`. In a matched set the five lines come out nearly
identical, which is the point.

## Afterwards

Images from `gpt-image` arrive with a signed C2PA credential inside the PNG
that identifies them as generated. Social platforms read it and label the post.
Strip it before committing:

```bash
python tools/strip-metadata.py --apply
```

It is lossless and keeps a copy of each original in `originals/`.
