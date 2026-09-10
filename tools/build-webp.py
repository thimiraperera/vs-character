"""Build the artwork the app ships from the PNG masters kept beside it.

The masters live in artwork-masters/, one folder per pose, and change only when
the drawings do. The app loads WebP copies of them from vs-character/<pose>/,
which are 42% of the size and so about two and a half times quicker to fetch.

The encoding is lossless, and not for tidiness. The app lays a face frame over
its pose, and the two files are identical everywhere except the face. A lossy
codec compresses those identical pixels differently in each file, because a
block predicts from its neighbours and that chain carries a change at the mouth
a long way across the picture. On screen it would read as the whole character
shimmering on every blink. Lossless gives the app back exactly what was drawn.

One thing does change. Three quarters of each frame is fully transparent, and
most of those clear pixels still carry a colour underneath. WebP throws that
away unless told to keep it, which costs 20% more file for pixels nothing can
ever see: a browser premultiplies on decode, so colour under zero alpha is
multiplied out before anything is drawn with it. So it goes, and the check
below asks the question that matters instead of the one that is easy - every
visible pixel identical, and the alpha channel identical everywhere.

    python tools/build-webp.py            rebuild every pose, a few minutes
    python tools/build-webp.py --check    verify what is shipped, write nothing

A file that does not survive its round trip is a hard failure, not a warning.
"""

import argparse
import io
import os
import sys

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print("This one needs Pillow and numpy: python -m pip install pillow numpy")
    raise SystemExit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTERS = os.path.join(ROOT, "artwork-masters")
SHIPPED = os.path.join(ROOT, "vs-character")

# method 6 is the encoder's slowest and smallest setting, around 10 seconds a
# frame. This runs by hand when the drawings change, so the minutes buy a
# smaller download every time anyone opens the page.
ENCODE = dict(lossless=True, quality=100, method=6)


def masters():
    """every master png, as (pose, filename, path)"""
    if not os.path.isdir(MASTERS):
        return
    for pose in sorted(os.listdir(MASTERS)):
        folder = os.path.join(MASTERS, pose)
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if name.lower().endswith(".png"):
                yield pose, name, os.path.join(folder, name)


def faithful(back, want):
    """same alpha everywhere, same colour everywhere it can be seen"""
    if back.shape != want.shape:
        return False, "decodes to %dx%d, master is %dx%d" % (
            back.shape[1], back.shape[0], want.shape[1], want.shape[0])
    if not np.array_equal(back[:, :, 3], want[:, :, 3]):
        moved = int((back[:, :, 3] != want[:, :, 3]).sum())
        return False, "%d pixels changed transparency" % moved
    seen = want[:, :, 3] > 0
    if not np.array_equal(back[:, :, :3][seen], want[:, :, :3][seen]):
        moved = int((back[:, :, :3][seen] != want[:, :, :3][seen]).any(axis=1).sum())
        return False, "%d visible pixels changed colour" % moved
    return True, "ok"


def main():
    parser = argparse.ArgumentParser(description="Build the shipped webp from the png masters.")
    parser.add_argument("--check", action="store_true",
                        help="verify what is already shipped and write nothing")
    args = parser.parse_args()

    found = list(masters())
    if not found:
        print("No masters found under %s" % MASTERS)
        return 1

    print("%-15s %-27s %8s %8s %6s   %s"
          % ("pose", "file", "png", "webp", "saved", "result"))

    png_total = webp_total = 0
    failures = written = 0

    for pose, name, path in found:
        out = os.path.join(SHIPPED, pose, name[:-4] + ".webp")
        png_size = os.path.getsize(path)
        png_total += png_size
        want = np.asarray(Image.open(path).convert("RGBA"))

        if args.check:
            if not os.path.isfile(out):
                print("%-15s %-27s %8s %8s %6s   FAIL  not built yet" % (pose, name, "", "", ""))
                failures += 1
                continue
            data = open(out, "rb").read()
        else:
            buf = io.BytesIO()
            Image.open(path).convert("RGBA").save(buf, "WEBP", **ENCODE)
            data = buf.getvalue()

        back = np.asarray(Image.open(io.BytesIO(data)).convert("RGBA"))
        same, why = faithful(back, want)
        webp_total += len(data)

        if same and not args.check:
            folder = os.path.dirname(out)
            if not os.path.isdir(folder):
                os.makedirs(folder)
            with open(out, "wb") as fh:
                fh.write(data)
            written += 1
        if not same:
            failures += 1

        print("%-15s %-27s %7.2fM %7.2fM %5.0f%%   %s"
              % (pose, name, png_size / 1048576.0, len(data) / 1048576.0,
                 100.0 - 100.0 * len(data) / max(1, png_size),
                 "ok" if same else "FAIL  " + why))
        sys.stdout.flush()

    print("")
    print("%d files: %.1f MB of png becomes %.1f MB of webp, %.0f%% smaller"
          % (len(found), png_total / 1048576.0, webp_total / 1048576.0,
             100.0 - 100.0 * webp_total / max(1, png_total)))

    if failures:
        print("%d file(s) did not survive the round trip." % failures)
        return 1
    if args.check:
        print("Every shipped file gives back its master's visible pixels and alpha.")
    else:
        print("Wrote %d file(s), each checked against its master." % written)
    return 0


if __name__ == "__main__":
    sys.exit(main())
