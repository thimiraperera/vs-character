# Two fixes to the artwork

Both are edits to pictures that already exist. Written to be pasted into an
image model together with the file being changed.

The rule that governs everything here, as before: **a frame is the file it came
from with only the named part changed, and every other pixel identical.** A
fresh generation, however close it looks, shifts every outline by a pixel or
two, and the app shows that as the whole character twitching. Edit in place, or
generate a donor face and composite only the masked region the way
`tools/build-mouth-shapes.py` already does.

---

## 1. The shrug is unhappy

`vs-character/shrugging/shrugging.png` reads as upset rather than playful. Two
things do it:

- the **eyebrows** slant up towards the middle of the face, which is the
  standard drawing of worry or sadness
- the **mouth** is a small downturned frown

Together they say "I am sad about this" where the pose should say "who knows?".
On a quiz channel she is shrugging because the answer is a surprise, not
because anything is wrong.

### What to change

Only the eyebrows and the mouth. The pose itself, the open palms, the tilt of
the head, the eyes, hair, uniform and everything below the chin stay exactly as
they are.

**Eyebrows.** Raised and level, or tipped very slightly *up at the outer ends*,
the shape of cheerful surprise. Not slanted up towards the nose, which is what
makes the current one look sad. Lift them a little higher above the eyes than
they sit now, which is what reads as "no idea!".

**Mouth.** An open, friendly smile: corners turned up, curving upward overall,
teeth showing along the top the way they do in `standing.png`. Roughly the size
of the mouth in `standing.png`. Not a frown, not a flat line, not a grimace.

Keep the eyes as they are. They are already wide and bright, and they read as
happy the moment the brows and mouth stop arguing with them.

### Then the frames that come from it

`shrugging.png` is the base for six other files, and each of those is the base
with only the face changed. Once the base has a different face, they no longer
match it and every one of them has to be made again from the new base:

```
shrugging/shrugging-blink.png
shrugging/shrugging-talk-a.png
shrugging/shrugging-talk-e.png
shrugging/shrugging-talk-o.png
shrugging/shrugging-talk-m.png
shrugging/shrugging-talk-s.png
```

The blink keeps the new raised brows and closes the eyes. The five mouth shapes
replace the new smiling mouth, following the sizes in the next section.

Nothing else in the app needs to change: the pose registers on its feet, which
are untouched, so it stays in place.

---

## 2. The `a` mouth is too wide open

`<pose>-talk-a.png` reads as a shout or a gasp rather than a syllable. At around
ten shapes a second it flashes past as a dark hole in the middle of the face.

Measured against the resting mouth in each base file, the dark of the open
mouth currently comes to:

| pose | `a` is | should be about |
| --- | --- | --- |
| `standing` | 1.5x the resting mouth | 1.2x |
| `pointing-left` | 1.3x | 1.2x |
| `pointing-right` | 1.4x | 1.2x |
| `shrugging` | 3.1x | 1.2x |
| `arms-folded` | 2.1x | 1.2x |

`shrugging` and `arms-folded` are the worst of them. `shrugging` will settle
once its base has a proper smiling mouth to be measured against, but the frame
still wants redrawing.

### What to change

In each of the five `-talk-a.png` files, only the mouth, and only its size:
keep the shape, the shading, the teeth and the position of the corners.

Make the opening **about two thirds of its current height**. It should read as a
relaxed open "ah", the mouth you make saying *father* at a normal speaking
volume. As a check by eye, the dark of the mouth should be clearly shorter than
the gap between the bottom of the nose and the chin, and it should not reach
wider than the corners of the resting smile.

The other four shapes are fine and want no changes:

| shape | how open |
| --- | --- |
| `a` | the widest of the set, but a relaxed "ah" |
| `e` | around half of `a`, wider across |
| `o` | small and rounded |
| `m` | closed, lips together |
| `s` | a narrow slit with upper teeth |

The set only works if the five are clearly different from one another at a
glance. Bringing `a` down should not bring it so close to `e` that the two stop
being distinguishable: `a` still wants to be the tallest opening by a clear
margin.

---

## Paste this with each request

One request per file, with that file attached.

```
Edit the attached image in place. Change only the region named below and leave
every other pixel exactly as it is: same canvas of 1024 x 1536, same transparent
background, no cropping, scaling or re-centring, no re-rendering anywhere
outside that region. Export as PNG with alpha.

Region: <the eyebrows and the mouth | the mouth>
Change: <the description from above>
```

## Checking the results

```bash
python tools/check-faces.py
```

Every frame is measured against its base: how much of the picture differs and
whereabouts. A frame passes only if the change is small and sits inside the
head. Note that after `shrugging.png` itself changes, the checker measures the
shrugging frames against the **new** base, so the old frames will fail until
they are remade, which is the point.

```bash
python tools/compare-poses.py
```

confirms the redrawn `shrugging.png` still stands in the same place at the same
size as the others. A face edit should not move it at all; if this reports a
change in stance, ground line or body height, the file was regenerated rather
than edited.

## Afterwards

Files out of an image model carry a signed credential saying so. Strip it
before committing:

```bash
python tools/strip-metadata.py --apply
```

Lossless, and it keeps a copy of each original in `originals/`.
