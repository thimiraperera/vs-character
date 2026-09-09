# Generating the mouth shapes

The blink frames are done. This is for the mouth: five shapes per pose instead
of the single open mouth there is now, so the talking has some variety in it.

Written to be pasted into an image model together with the pose file it comes
from. The compositing at the end follows what `tools/build-face-frames.py`
already does.

## What the app looks for

Beside each pose file:

| file | shape |
| --- | --- |
| `<pose>-talk-a.png` | wide open, jaw down |
| `<pose>-talk-e.png` | mid open, corners pulled wide |
| `<pose>-talk-o.png` | small and rounded |
| `<pose>-talk-m.png` | lips together, closed |
| `<pose>-talk-s.png` | narrow, upper teeth showing |

Five poses, so twenty-five files. For `standing` that is
`standing/standing-talk-a.png` and so on.

While a subtitle line is up and the clock is running, the app picks among
whichever of these exist, never the same one twice running, holding each for
70 to 130ms, with the occasional closed beat standing in for a gap between
words. It is not lip sync: nothing reads the audio. The point is that the mouth
stops looking like it is counting.

The existing `<pose>-talk.png` still works. Until the new shapes exist the app
falls back to it, so nothing breaks part way through. Once a pose has any of
the named shapes, its `-talk.png` is ignored and can be deleted.

## The one rule, again

**Each frame is the pose file with only the mouth changed. Everything else is
pixel-identical.**

A fresh generation, however close it looks, shifts every outline by a pixel or
two, and the app shows that as the whole character twitching on every syllable.
That is what the donor-and-composite approach already in
`tools/build-face-frames.py` is for: generate a face, then blend only the mouth
rectangle into the untouched base.

## The mouth rectangle per pose

Already known, from the frames built last time. In the original 1024x1536
space:

| pose | mouth box (x0, y0, x1, y1) |
| --- | --- |
| `standing` | 475, 371, 580, 448 |
| `pointing-left` | 438, 355, 547, 435 |
| `pointing-right` | 491, 342, 604, 435 |
| `shrugging` | 483, 400, 575, 469 |
| `arms-folded` | 461, 364, 580, 443 |

Everything outside that rectangle comes from the base file untouched, and the
alpha channel is never touched at all.

## The shapes

Each description assumes the base pose as the reference for the face around it:
same skin, same shading, same line weight, same head angle. Only the mouth
differs. The two pointing poses have the head turned and tilted up, so their
mouths follow that angle rather than facing the camera.

**a — wide open.** The jaw dropped, mouth a tall rounded opening as on the "ah"
in *father*. Upper teeth visible along the top, the dark of the mouth below,
a suggestion of the tongue low down. The most open of the set.

**e — mid open, wide.** Half the height of `a` and wider across, corners pulled
out towards a smile, as on the "e" in *bed*. Upper teeth clearly along the top
edge, a narrow dark gap beneath.

**o — small and round.** Lips pushed forward into a small circle, as on the "oo"
in *moon*. Little or no teeth. Noticeably narrower than the resting mouth.

**m — lips together.** Closed, the lips meeting in a soft line with a slight
press, as on the "m" in *may*. Not the same as the resting mouth: this one is
flatter and a touch fuller, without the smile. No teeth, no opening.

**s — narrow, teeth.** A thin horizontal slit with the upper teeth showing
along it and the lower lip close underneath, as on the "s" in *see*. Wide but
barely open.

Keep them recognisably different from one another at a glance: the app cuts
between them in under a tenth of a second, so shapes that only differ subtly
will read as a flicker rather than as speech.

## Paste this with each request

One request per pose per shape, with the pose file attached.

```
Edit the attached image in place. Change only the mouth and leave every other
pixel exactly as it is: same canvas of 1024 x 1536, same transparent
background, no cropping, scaling or re-centring, no re-rendering anywhere
outside the mouth. Keep the eyes, eyebrows, cheeks, hair and head angle
untouched. Export as PNG with alpha.

Mouth: <one of the five descriptions above>
```

## Checking the results

```bash
python tools/check-faces.py
```

It measures every frame it finds against its base: how much of the picture
differs and whereabouts. A frame passes only if the change is small and sits
inside the head. Anything that drifted outside the mouth, or that came from a
regeneration rather than an edit, fails loudly rather than quietly shimmering
in the video.

## Afterwards

Files out of an image model carry a signed credential saying so. Strip it
before committing:

```bash
python tools/strip-metadata.py --apply
```

Lossless, and it keeps a copy of each original in `originals/`.
