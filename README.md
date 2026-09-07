# Character

A fixed-size portrait canvas for recording short comparison videos. Two image
squares sit at the top, a character stands at the bottom, and everything is
driven from the keyboard so you can record in one take.

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

## Keys

| Key | Does |
| --- | --- |
| Hold Left | character points left |
| Hold Right | character points right |
| Hold Up | character shrugs |
| Hold Down | character folds her arms |
| Release | back to standing |
| `1` | next image in the left square |
| `2` | next image in the right square |
| `Space` | play / pause |

Poses are keyboard only, so nothing about the character sits in the panels.
Clicking a square does the same as its number key. Holding two arrows at once
shows the most recent and falls back to the one still held when you let go, and
a key held while the window loses focus resets rather than sticking.

Keys are ignored while you are typing in the CSS box.

## Images

Load as many as you like into either square: the arrow badge in its corner, the
panel button, or by dropping files on it. Picking more adds to what is already
there rather than replacing it, and the picture on screen stays put while they
arrive. They are sorted by filename, so `01.jpg, 02.jpg, 10.jpg` land in the
order you expect. Each press steps to the next one and wraps around at the end,
with a fast dissolve between them.

Nothing is uploaded. Each file is referenced straight off your disk through an
object URL, so the count of images is limited only by the machine, and none of
it is copied, stored, or sent anywhere. The flip side is that object URLs do not
survive a page reload, so after refreshing you pick the files again. The panel
always shows what is currently loaded.

Every picture becomes its own element in the square and is decoded before it can
be asked for, with the panel counting them in as they arrive. Stepping to the
next one is then a change of class: there is nothing to fetch and nothing to
decode at the moment it matters.

The dissolve only fades the arriving picture in. The one going out keeps its
full opacity underneath until it is completely covered, which is what stops the
square blinking. Fading both at once, as an even crossfade does, leaves a moment
where neither one covers the square and the backdrop shows through the pair of
them: at the midpoint of a 50/50 fade a quarter of the background comes through,
and that is what reads as the picture vanishing before the next appears.

## Audio

Load an `.mp3`, `.wav`, or anything else the browser plays. Like the images it
is read straight off the disk and never uploaded.

With a track loaded it becomes the clock: Play starts the audio and the
subtitles read its `currentTime` rather than a timer of their own, so the two
cannot drift apart. Pause stops both, and reset returns both to zero. Without a
track, Play runs a plain clock and the subtitles follow that instead.

## Subtitles

Load a `.srt` or `.vtt` file from the panel. It is read in the browser and never
leaves the machine.

Press Space to start and the lines appear on their own timings. Space again
pauses, and the reset button returns to zero. Pausing keeps the current line on
screen, which is handy while framing a shot.

Both formats are handled, including `HH:MM:SS,mmm` and `MM:SS.mmm` stamps and
VTT cue settings after the end stamp. These tags survive into the caption:

| in the file | becomes |
| --- | --- |
| `<b> <i> <u> <s> <em> <strong> <span>` | the same tag |
| `<font color="#f00">` | `<span style="color:#f00">` |
| `<font face="Georgia" size="90">` | `<span style="font-family:Georgia; font-size:90px">` |
| `<c.name>text</c>` | `<span class="name">` |
| a line break | `<br>` |

Inline styles work, so a file written with styling in it renders as styled:

```
1
00:00:01,000 --> 00:00:04,000
Which one is <span style="color:#c8442e; font-size:80px">different</span>?
```

Every one of those tags may carry `class` and `style`, and `<font>` keeps its
`color`, `face` and `size`. `size` is read as pixels.

What does not come through is anything that could do more than style text.
Tags outside the list above stay literal text, so a stray angle bracket cannot
introduce markup. Attributes other than `class` and `style` are dropped, which
covers `onclick` and friends. Inside a `style`, any declaration containing
`url(`, `expression(`, `javascript:`, `@import` or `behavior:` is removed while
the rest of the rule is kept, so

```
<span style="background: url(javascript:alert(1)); color: rgb(1,2,3)">u</span>
```

renders as `<span style="color: rgb(1,2,3)">u</span>`.

### Where they sit

Captions are centred in the band between the bottom of the two squares and the
top of the character's head, so they never cover either. That band is worked out
from the same variables that place the squares and the character:

```
top    = --slot-top + square height
bottom = --floor + --char-height
```

which means it follows a resolution change or a character resize on its own. At
1080 x 1920 the band is 488px tall; at 1080 x 1350, the tightest of the four, it
is 174px, which is two lines at the default size. Longer captions than the band
holds will spill over the artwork, so drop the font size if that happens.

### The font

`UN-Sandhyanee.ttf` sits at the repo root and is the first family in the caption
stack. It is a Unicode Sinhala face, mapping U+0D80 to U+0DFF with a `GSUB`
table for conjuncts, and it carries digits and punctuation.

It has no Latin letters at all, though: no A to Z, no a to z. So English in a
caption falls through to the next family in the stack rather than rendering.
That is why the default is

```css
font-family: UN-Sandhyanee, Segoe UI, Roboto, sans-serif;
```

and why the fallbacks matter. A caption mixing Sinhala and English will show the
Sinhala in UN-Sandhyanee and the English in Segoe UI.

### Styling them

The **Subtitle CSS** box is a live stylesheet. Type in it and the caption
updates as you go. It starts as:

```css
.subtitle{
	font-family: UN-Sandhyanee, Segoe UI, Roboto, sans-serif;
	font-size: 56px;
	font-weight: 500;
	line-height: 1.3;
	text-align: center;
	color: #1d2a44;
	text-shadow: 0 2px 0 rgba(255,255,255,.65);
}

.subtitle b {
	color: #c8442e;
}
```

Weight 500 is deliberate: the face only ships Regular, so asking for 700 makes
the browser fake a bold and the Sinhala thickens unevenly. The `<b>` in a
caption still gets a synthesised bold, which is what the accent colour is for.

Position is deliberately absent: the band above handles it, and everything in
the box is about how the caption looks. Setting `top`, `bottom`, `left` or
`right` here still works if you want it somewhere else entirely.

It is real CSS with nothing scoped away, so `.subtitle b`, `.subtitle .name`
from a `<c.name>` tag, animations and the rest all work. The line under the box
reports how many rules the browser understood; if it says `2 of 3 rules
applied`, one of them has a typo.

Sizes are in canvas pixels, so `52px` means 52px of a 1080-wide export no matter
what the view is zoomed to.

The caption text lives in a `.subtitle-text` box inside the band. That is what
lets a `<b>` sit inline mid-sentence: the band centres one child, and dropping
the text straight into it would turn every inline run into its own row.

## Recording

**Record** writes a video while you drive the scene. Press 1, 2 and the arrow
keys as it runs; the frames follow along.

A take runs in three parts:

| part | length |
| --- | --- |
| the opening frame, held | 3 seconds |
| playback | the audio, or the last subtitle line when there is no audio |
| the closing frame, held | 3 seconds |

So there is something to cut against at both ends. Playback starts when the
opening handle finishes, not the moment the button is pressed. Pressing the
button during playback ends the middle early but still runs the closing handle;
pressing it again during that handle cuts it short. When it is done a **Save the
video** button appears.

The frame is painted rather than screen-grabbed. Every part of the scene is
measured off the live page, divided by the view scale to put it back into
canvas pixels, and drawn onto a canvas at the full output size. So the file is a
true 1080 x 1920 even when the window is only showing the canvas at 46%, and
nothing outside the canvas can wander into shot.

Recording waits for the caption picture before the first frame is taken, so a
take started the moment the page opens still has its captions in it rather than
picking them up a beat late.

The audio is tapped while the button click is still the reason anything is
happening. Left any later, the browser sees no gesture behind it and can refuse
to start the track, and since the clock is the track's own position that would
leave the take frozen at zero with nothing to end it.

Chrome writes MP4 with H.264 and AAC; browsers without it fall back to WebM, and
the file is named to match. The audio is tapped from the same element that is
playing, so picture and voice come out of one clock and stay together.

Captions are the exception to the painting: rather than reimplementing text
layout, the caption element is handed back to the browser inside an SVG, with
the page's own stylesheet and the font embedded, and the result is composited
in. That way whatever CSS the box and the subtitle file agree on is what lands
in the video. It is redrawn when the line changes rather than every frame.

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

The layout is fixed rather than responsive, because the output size has to stay
predictable. The canvas and its panels sit together as one centred block. The
panels start at the top and wrap into as many columns as the window height
needs, so they never scroll, and the canvas takes whatever width they leave
over.

Below 1080px wide (or 660px tall) the page shows a short note instead. That is
the point where the panels need a fourth column and there is no useful room
left for the canvas.

All the controls sit outside the canvas, so only the scene is inside the
recording area.

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
| squares start | 48px from the top |
| square gaps | 24px left, right, and between |
| square shape | square, so each is `(width - 72) / 2` across |
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
different places reads as a double exposure instead of one character moving. The
image squares do cross-fade, because there the dissolve is the point.

## Adding a pose

1. Drop `vs-character/<name>/<name>.png` in place (8-bit RGBA).
2. Measure it:

   ```bash
   python tools/measure-pose.py "vs-character/<name>/<name>.png"
   ```

   It prints the CSS line to paste beside the others in `style.css`.
3. Add the `<img class="pose" data-pose="<name>" ...>` tag in `index.html`.
4. Map a key to it in the `KEY_POSES` table in `script.js`.

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
| `--slot-top` | `48px` | where the squares start |
| `--edge` | `24px` | square gaps, outer and inner |
| `--slot-fade` | `140ms` | how fast one image dissolves into the next |
| `--breath` | `0.008` | idle breathing depth; set `0` for a static character |

Breathing scales the character from the soles by 0.8% over a 4.2s cycle, so the
feet stay planted and the height reads as 45% at rest. Set `--breath: 0` for an
exactly constant height.
