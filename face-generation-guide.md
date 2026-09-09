# Generating the blink and mouth frames

Instructions for producing the extra face frames that let the character blink
and move her mouth. Written to be pasted into an image model together with the
pose file it is derived from.

## What the app does with them

Next to each pose file the app looks for up to three more:

| file | what changes |
| --- | --- |
| `<pose>/<pose>-blink.png` | both eyes closed |
| `<pose>/<pose>-talk.png` | mouth open, as if mid-word |
| `<pose>/<pose>-talk2.png` | mouth open wider (optional) |

So for `standing` that is `standing/standing-blink.png`, `standing/standing-talk.png`
and, if you want the richer mouth, `standing/standing-talk2.png`. Five poses,
ten required files, five optional.

The app lays a frame over the base pose at the same registration, so the frame
has to cover the base exactly. Blinks happen on their own every few seconds,
occasionally in a quick pair, and carry on while paused so she looks alive in
the held frames at either end of a recording. The mouth moves only while a
subtitle line is on screen and the clock is running, stepping between the base
and the talk frames at an uneven pace. Both are drawn into the recorded video.

A pose that has no frames simply does not blink or speak. Until the files
exist the browser console shows a 404 for each missing one; that is the app
checking, and it is expected.

## The one rule

**Each frame is the pose file with only the face changed. Everything else is
pixel-identical.**

That rules out regenerating the picture. A fresh generation, however close,
moves every outline by a pixel or two, and the app will show that as the whole
character shimmering each time she blinks. The frame has to be made by editing
the base file in place, with the edit confined to the eyes or the mouth:

- use inpainting, image-to-image with a mask, or a generative fill, on the
  base file itself
- mask only the eye region for a blink frame, only the mouth region for a talk
  frame
- keep the same canvas, 1024 x 1536, and the same transparent background
- do not let the tool re-render outside the mask, and do not crop, pad, scale
  or re-centre
- export as PNG with alpha

If the tool cannot be told to leave the rest alone, do the edit in an image
editor instead: paint the closed eyes or open mouth on a layer over the base
and export the flattened result.

## The frames

Descriptions for the model. The base file is the reference for everything not
mentioned here.

**Blink.** Both eyes fully closed. Each becomes a single soft downward curve
with the lashes along it, in the same dark line weight as the outlines. The
eyebrows stay exactly where they are. The mouth, cheeks, hair and everything
below the eyes are untouched.

**Talk.** The mouth open a comfortable amount, as in the middle of a word:
lips parted into a rounded shape, a hint of the upper teeth and the inside of
the mouth in the same cartoon shading as the rest of the face. The smile
survives as the shape of the opening. Eyes, brows, cheeks and everything else
untouched.

**Talk 2** (optional). The same as talk, opened wider, as on a stressed
syllable. Still a pleasant shape, not a shout.

For the two pointing poses the head is turned to look up and to one side;
the closed eyes and open mouth follow that angle rather than facing the camera.

## Paste this with each request

```
Edit the attached image in place. Change only the region described and leave
every other pixel exactly as it is: same canvas of 1024 x 1536, same transparent
background, no cropping, scaling or re-centring, no re-rendering outside the
region. Export as PNG with alpha.

Region: the eyes.          [for a blink frame]
Change: both eyes fully closed, each a soft downward curve with lashes, in the
same line weight. Eyebrows unchanged.

Region: the mouth.         [for a talk frame]
Change: mouth open as if mid-word, lips parted into a rounded shape with a hint
of upper teeth, in the same cartoon shading. Everything else unchanged.
```

## Checking the results

Whether a frame really is the base with only the face changed is a measurable
thing, and worth measuring, because a fresh generation can look identical and
still shimmer. From the repo root:

```bash
python tools/check-faces.py
```

For every frame it finds, it reports how much of the picture differs from the
base and where, and passes it only if the change is small and sits within the
head. A frame that fails is redone, not adjusted in the app.

## Afterwards

Files that come out of `gpt-image` carry a signed C2PA credential that labels
them as generated. Strip it before committing:

```bash
python tools/strip-metadata.py --apply
```

It is lossless and keeps a copy of each original in `originals/`.
