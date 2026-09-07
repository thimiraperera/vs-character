# Character

A fixed-size portrait canvas for recording short comparison videos. Two square
image slots sit at the top, a character stands at the bottom, and holding an
arrow key changes the pose so she can point at one side, shrug, or fold her arms.

Live: **https://thimiraperera.github.io/vs-character/**

Everything the page needs lives in `vs-character/`. That folder is kept free of
authoring notes and tool comments on purpose; this README and `tools/` sit
outside it.

## Run it locally

Any static server works, from the repo root:

```bash
python -m http.server 8123
```

Then open <http://localhost:8123/vs-character/>.

## Using it

| Input | Pose |
| --- | --- |
| Hold Left | `pointing-left` |
| Hold Right | `pointing-right` |
| Hold Up | `shrugging` |
| Hold Down | `arms-folded` |
| Release | back to `standing` |

The pad beside the canvas mirrors the arrow keys and lights up with them, and it
can be held with the mouse instead. Holding two directions at once shows the
most recent and falls back to the one still held when you let go. A key held
while the window loses focus never delivers its release, so focus loss resets
the pose rather than leaving it stuck.

Click either square to pick an image, or drag one onto it. Uploads are resized
to 1400px, stored in `sessionStorage`, and survive a reload while the tab is
open. Closing the tab clears them. Hover a filled slot to remove its image.

The controls sit outside the canvas, so nothing but the scene is inside the
recording area.

## Canvas

Portrait video sizes, picked from the panel:

| size | ratio | use |
| --- | --- | --- |
| 1080 x 1920 | 9:16 | Reels, Shorts, TikTok |
| 1080 x 1350 | 4:5 | feed post |
| 1080 x 1440 | 3:4 | feed post |
| 720 x 1280 | 9:16 | smaller export |

The canvas is always laid out at those exact output pixels. "View" only scales
what you see; it never changes the composition. Set it to 100% to capture at
native resolution.

The layout is fixed, not responsive, because the output size has to stay
predictable. Below 900px wide (or 560px tall) the page shows a short note
instead of the scene.

## Layout

```
vs-character/
  index.html
  style.css
  script.js
  standing/standing.png
  pointing-left/pointing-left.png
  pointing-right/pointing-right.png
  shrugging/shrugging.png
  arms-folded/arms-folded.png
  pro-pic.jpg
```

The original folder layout is untouched; each pose is referenced where it
already lives.

Measurements inside the canvas, at every resolution:

| what | value |
| --- | --- |
| slots start | 48px from the top |
| slot gaps | 24px left, right, and between |
| slot shape | square, so each is `(width - 72) / 2` across |
| character height | 45% of the canvas height |
| ground clearance | 16px under the feet |

## How the character is placed

The five artworks are all 1024x1536, but the character is drawn at a different
size and offset inside each frame. Head-to-toe spans 97.7% of the frame in
`standing` and only 92.0% in `pointing-right`, and the stance sits at 56.2% of
the width in `pointing-left` against 43.3% in `pointing-right`.

Sizing the files uniformly would therefore make the character shrink by about
6% and slide sideways by roughly 13% of the canvas width every time the pose
changed. So each pose carries three measured constants instead:

| variable | meaning |
| --- | --- |
| `--fit` | head-to-toe height / artwork height |
| `--cx` | centre of the stance / artwork width |
| `--fb` | gap under the soles / artwork height |

`--fit` scales the artwork so the body itself is exactly `--char-height` of the
canvas, and `--cx` / `--fb` register the image on the character's feet rather
than on the file's edges. The result holds to 0.00px on every pose.

Poses cut rather than cross-fade. Dissolving two bodies that stand in slightly
different places reads as a double exposure instead of one character moving.

## Adding a pose

1. Drop `vs-character/<name>/<name>.png` in place (8-bit RGBA).
2. Measure it:

   ```bash
   python tools/measure-pose.py "vs-character/<name>/<name>.png"
   ```

   It prints the CSS line to paste beside the others in `style.css`.
3. Add the `<img class="pose" data-pose="<name>" ...>` tag in `index.html`.
4. Map an input to it in the `KEY_POSES` table in `script.js`.

`tools/measure-pose.py` decodes PNGs with the standard library only, so it needs
no packages. Re-running it against the current artwork reproduces the committed
values exactly.

## Metadata in the artwork (read before posting)

The PNGs carry metadata that has nothing to do with the pixels:

| file | chunk | contents |
| --- | --- | --- |
| `standing.png` | `caBX` 21.8 KB | signed C2PA credential: `gpt-image 2.0`, `digitalSourceType: trainedAlgorithmicMedia` |
| `pointing-left.png` | `iTXt` 1.3 KB | Photoshop XMP: edit history, document UUIDs, local timestamps |
| `pointing-right.png` | `iTXt` 1.5 KB | same |
| `arms-folded.png` | `iTXt` 1.3 KB | same |
| `shrugging.png` | none | already clean |

The first row is the one that matters. A C2PA manifest is a signed,
machine-readable declaration that the image was generated by a model, and
Instagram, Facebook, LinkedIn and TikTok read it to attach a "Made with AI"
label automatically. It rides on `standing.png`, the default pose and the frame
most likely to be on screen.

To inspect or remove it:

```bash
python tools/strip-metadata.py           # report only, changes nothing
python tools/strip-metadata.py --apply   # rewrite, originals copied to originals/
```

Stripping is lossless: only the metadata chunks go, every pixel is byte for byte
identical, and `--apply` copies each original into `originals/` first. Verified
on a scratch copy before the tool shipped. Nothing has been stripped yet, so the
artwork is exactly as supplied.

## Tuning

Top of `style.css`:

| variable | default | effect |
| --- | --- | --- |
| `--char-height` | `45%` | character height as a share of canvas height |
| `--floor` | `16px` | clearance under the feet |
| `--slot-top` | `48px` | where the slot band starts |
| `--edge` | `24px` | slot gaps, outer and inner |
| `--breath` | `0.008` | idle breathing depth; set `0` for a static character |

Breathing scales the character from the soles by 0.8% over a 4.2s cycle, so the
feet stay planted and the height reads as 45% at rest. Set `--breath: 0` for an
exactly constant height.
