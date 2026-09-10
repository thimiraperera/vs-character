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
| Left | character points left |
| Right | character points right |
| Up | character shrugs |
| Down | character folds her arms |
| `1` | next image in the left square |
| `2` | next image in the right square |
| `Space` | play / pause |

An arrow key sets the pose and she keeps it: letting go changes nothing, and
she stays as she is until another arrow, a replay, or the reset button moves
her. Holding two at once shows the most recent and falls back to the one still
held when you let go; whatever is on screen when the last key comes up is what
stays. Poses are keyboard only, so nothing about the character sits in the
panels, and clicking a square does the same as its number key.

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

## A name under each square

Each square can carry a name underneath it, typed in the panel beside its own
Add images button. It appears under that square in the same two columns, so a
name always lands under the picture it belongs to, and it goes into the
recording like everything else on the canvas. Sinhala and Latin both work, and
a long one wraps.

The names are drawn through the same rasteriser as the captions: the real
elements are handed back to the browser inside an SVG with the Sinhala face
embedded, so what lands in the video is laid out by the CSS that placed it on
screen rather than by a second copy of those rules that could drift.

The band they take up is measured and published as `--name-band`, and the
caption band below starts under it. With no names it is zero and nothing moves.

## The backdrop

Plain white, and nothing else. There was a sky gradient, a warm glow behind the
character and a shaded floor; all three are gone, element and paint code alike.
White composites cleanly against anything, and a flat frame costs the encoder
almost nothing: a twelve second take that ran to about 1.2 MB comes out at
0.1 MB.

Two things kept a tint against it. An empty square used to be a wash of white
over a blue sky, which over white would be nothing at all, so it takes a faint
grey and a slightly firmer edge; a filled square covers it anyway. And the
shadow under her feet stays, because without it she floats, but its blue came
from a sky that is no longer there, so it is neutral now.

The backdrop is painted twice, once as CSS for the screen and again onto the
canvas for the recording, so both were changed together. A recorded frame reads
255,255,255 straight across the top strip and into the bottom corners.

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
| playback | the audio, or the last subtitle line, or the keyframe track |
| the closing frame, held | 3 seconds |

So there is something to cut against at both ends. Playback starts when the
opening handle finishes, not the moment the button is pressed. Pressing the
button during playback ends the middle early but still runs the closing handle;
pressing it again during that handle cuts it short.

The middle part only knows how long it is if something tells it: an audio file,
a subtitle file, or a keyframe track. With none of them loaded there is nothing
to end the take, so it runs until it is stopped by hand, and the panel says so
rather than sitting on "recording" while it is waited out.

When it is done the file goes to the downloads folder on its own. A browser set
to refuse a download nobody asked for will ignore that, which is what the **Save
the video** button underneath is still there for.

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
the file is named to match. A browser can say yes to a format and still refuse
it once a real stream is attached, most often H.264 on a machine without the
encoder, so each format is tried for real, in order, until one starts. A take
that dies part way through says so and keeps whatever was written before it
went, and data lands every half second rather than all at the end, so a take
cut short still leaves most of itself behind.

### Why the file used to refuse to open

MediaRecorder writes a **fragmented** mp4. The header carries no sample table at
all and every frame lives inside a `moof`/`mdat` pair, which is meant for
streaming rather than for a file on disk. Browsers and VLC read it happily,
which is why it always looked fine here, but Windows Media Player, the Photos
app and most video editors will not open one.

So the file is rebuilt before it is offered: the same picture and sound, copied
across byte for byte with nothing re-encoded, written as an ordinary mp4 with a
real sample table up front. What comes out is `ftyp`, `moov`, `mdat`, no `mvex`,
and it opens anywhere.

It all runs in the browser. GitHub Pages only serves the files; the video is
built on your machine and saved from there, and nothing is uploaded anywhere.
Verified: 1080 x 1920, correct duration, frames decoding at every seek, both
tracks present. The audio is tapped from the same element that is
playing, so picture and voice come out of one clock and stay together.

Captions are the exception to the painting: rather than reimplementing text
layout, the caption element is handed back to the browser inside an SVG, with
the page's own stylesheet and the font embedded, and the result is composited
in. That way whatever CSS the box and the subtitle file agree on is what lands
in the video. It is redrawn when the line changes rather than every frame.

## Timeline

Under the scene is a keyframe track: three lanes, one for the pose and one for
each square.

Arm **Capture**, press Play, and drive the scene. Every pose the character moves
to and every picture a square moves to is kept as a keyframe at the moment it
happened. Starting from the top with Capture armed begins a new take, and it
opens with an entry per lane so the take records where it began as well as what
changed. Without that, replaying it would leave the squares wherever the last
take ended.

Turn Capture off and Play replays the track instead. A key held down still wins,
so a replay can be taken over at any point.

To adjust: drag a keyframe along its lane to retime it, or select one and use
the nudge buttons for a tenth of a second at a time. Delete removes the selected
one. Clicking the ruler scrubs, which applies the track at that moment so a
change can be checked in place.

The wheel runs along the timeline. Ctrl and the wheel zooms it instead, up to
40x, about the moment under the pointer so that moment stays put while the strip
stretches around it. The ruler re-ticks for what is on screen, down to quarter
seconds, and a playhead that runs off the edge brings the view along with it.

**Record** replays the track into the video, and disarms Capture first so the
take cannot rewrite the thing it is playing. With no audio, a recording runs to
the last keyframe rather than stopping early.

The canvas works the dissolve between two pictures out from when it started
rather than reading it back off the elements. Reading it back tied the recording
to how far the browser had got with a CSS transition, and a window that is not
being drawn does not advance one at all, which put blank squares in the file.

## Blinks and the mouth

The character blinks on her own every few seconds, now and then in a quick
pair, and keeps doing so while paused so she looks alive in the held frames at
either end of a recording. While a subtitle line is on screen and the clock is
running, her mouth moves, stepping between frames at an uneven pace so it does
not look mechanical. Both are drawn into the recording. Neither is a keyframe;
they happen on their own.

The blink frames are in. The mouth reads from up to five shapes beside each
pose, `<pose>-talk-a.webp` through `<pose>-talk-s.webp`, and picks among whichever
exist: never the same one twice running, each held 70 to 130ms, with the odd
closed beat standing in for a gap between words. It is not lip sync, since
nothing reads the audio; the variety is what stops it looking counted out.

The older single `<pose>-talk.webp` still works, so a pose without the named
shapes falls back to it rather than going still. Once a pose has any named
shape its old file is ignored and can be deleted.

`mouth-generation-guide.md` says how to make the shapes, and carries the mouth
rectangle already worked out for each pose. The one rule is that each frame is
the pose file with only the mouth changed and every other pixel identical,
which means editing the base in place rather than generating afresh: a fresh
generation moves every outline by a pixel or two, and the app shows that as the
whole character twitching on every syllable. Whether a frame passes that rule
is measurable:

```bash
python tools/check-faces.py
```

It reports how much of each frame differs from its base and where, and passes
only a small change that sits inside the head. All 35 frames in the repo pass:
blinks at 1.7 to 2.0% of the figure, mouths at 0.1 to 0.9%, every one of them
inside the head. A whole-image nudge standing in for a regeneration fails at
62.9%.

`artwork-fixes-guide.md` carries the two edits still owed to the drawings
themselves: the shrug reads as sad rather than playful, and the `a` mouth opens
wider than a spoken syllable. It names what to change, what each change costs
elsewhere, and the numbers to judge the result by.

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
artwork-masters/            the drawings at full size, never loaded by the app
  standing/standing.png
  standing/standing-blink.png
  standing/standing-talk-a.png          and the rest of the mouths
  pointing-left/ ...
  pointing-right/ ...
  shrugging/ ...
  arms-folded/ ...

vs-character/               everything the page loads
  index.html
  style.css
  script.js
  standing/standing.webp
  standing/standing-blink.webp
  standing/standing-talk-a.webp         and the rest of the mouths
  pointing-left/ ...
  pointing-right/ ...
  shrugging/ ...
  arms-folded/ ...
  pro-pic.jpg
```

Each pose still sits in its own folder under the name it always had; only the
extension changed. The masters beside them are the same pictures at full size,
kept so the drawings never have to be recovered from the files the app ships.

Measurements inside the canvas, at every resolution:

| what | value |
| --- | --- |
| squares start | 48px from the top |
| square gaps | 24px left, right, and between |
| square shape | square, so each is `(width - 72) / 2` across |
| name band | 16px under the squares, only while a name is typed |
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

## Masters and what ships

The drawings are 1024x1536 with a lot of transparency, and as PNG the forty of
them came to 45 MB. Every one is loaded when the page opens, so that was 45 MB
before the first frame. They ship as lossless WebP now, 19 MB for the set, and
the PNG masters sit beside them in `artwork-masters/` where nothing fetches
them.

```bash
python tools/build-webp.py            # rebuild after the drawings change
python tools/build-webp.py --check    # verify what is shipped, write nothing
```

Lossless rather than lossy, and the reason is the faces. A frame is its pose
with only the face changed, and the app lays one over the other. A lossy codec
compresses the identical parts of the two files differently, because a block
predicts from its neighbours and that chain carries a change at the mouth a
long way out from it, so the body would shimmer on every blink. Lossless hands
the app back what was drawn.

One thing does change on the way through. Three quarters of each frame is fully
transparent, and most of those clear pixels still carry a colour underneath;
WebP drops it unless told otherwise, and keeping it costs 20% more file for
pixels nothing can see. A browser premultiplies on decode, so colour under zero
alpha is multiplied out before it is drawn with. So the check the build runs is
the one that matters rather than the one that is easy: every visible pixel
identical, and the alpha channel identical everywhere. A file that fails it is
not written.

The tools all read the masters. They decode PNG by hand with the standard
library and cannot read WebP at all, which is fine, since the masters are what
they are for. `tools/build-webp.py` is the one that needs Pillow.

## Regenerating the artwork

The set was redrawn to one scale. Every pose now rests on the same ground line
and stands on the same centre, so `--cx` and `--fb` are identical across all
five and only `--fit` differs, by at most 1.5%. Before, the pointing poses were
6% small and the shoes sat on rows 38 px apart.

`pose-generation-guide.md` is written to be pasted into an image model alongside
`standing.png`. It carries the master's exact geometry, the rules every pose
must meet, a brief for each pose, and the one decision to make first: the
master leaves 15 px above the head, so a hand raised above it cannot fit
without either lowering the gesture or re-cutting the master with headroom.

```bash
python tools/compare-poses.py
```

measures every pose against the master and passes or fails each on body height,
ground line and centre line, so results are judged by numbers rather than eye.

## Adding a pose

1. Drop `artwork-masters/<name>/<name>.png` in place (8-bit RGBA).
2. Measure it:

   ```bash
   python tools/measure-pose.py "artwork-masters/<name>/<name>.png"
   ```

   It prints the CSS line to paste beside the others in `style.css`.
3. Build what the app will load:

   ```bash
   python tools/build-webp.py
   ```
4. Add the `<img class="pose" data-pose="<name>" src="<name>/<name>.webp" ...>`
   tag in `index.html`.
5. Map a key to it in the `KEY_POSES` table in `script.js`.

`tools/measure-pose.py` decodes PNGs with the standard library only, so it needs
no packages. Re-running it against the current artwork reproduces the committed
values exactly.

## One shared scope

`vs-character/script.js` is a single IIFE, so everything declared at its top
level shares one scope. Declaring a name twice there is legal and silently
discards the first, which breaks something far from the edit. It has happened
twice: a canvas context named `paint` replaced the function that draws the image
squares and stopped images loading, and a `show` for the squares replaced the
`show` for the character and stopped every arrow key.

After editing the script:

```bash
python tools/check-script.py
```

It lists any name taken more than once and exits non-zero. No build step, no
packages.

## Metadata in the artwork (read before posting)

A file out of an image model can carry a signed C2PA credential saying so, and
Instagram, Facebook, LinkedIn and TikTok read it to attach a "Made with AI"
label on their own. So the artwork is worth checking before a set goes up.

As the masters stand today there is no such credential on any of them. What the
five base poses carry is Photoshop XMP, between 1.6 and 3.3 KB each: edit
history, document UUIDs and local timestamps from the retouching, naming no
generator. The 35 face frames are clean, because they are composited by
`tools/build-mouth-shapes.py` and `tools/apply-artwork-fixes.py`, which write
pixels and nothing else.

The webp files the app ships inherit none of it either way. Pillow writes only
the picture.

To check the masters, or to strip them:

```bash
python tools/strip-metadata.py           # report only, changes nothing
python tools/strip-metadata.py --apply   # rewrite, originals copied to originals/
```

Stripping is lossless: only the metadata chunks go, every pixel is byte for
byte identical, and `--apply` copies each original into `originals/` first.
Nothing has been stripped, since nothing on them says how they were made.

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
