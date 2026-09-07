"""Report or remove the metadata carried inside the pose PNGs.

Two kinds of metadata are riding along in the artwork:

  caBX  a signed C2PA "Content Credentials" manifest. In standing.png it
        declares the image as trainedAlgorithmicMedia produced by gpt-image.
        Instagram, Facebook, LinkedIn and TikTok read this chunk and label the
        post as AI-generated on the strength of it.

  iTXt  Photoshop's XMP block: edit history, machine document UUIDs and local
        timestamps.

Neither affects a single rendered pixel, so removing them is lossless.

    python tools/strip-metadata.py                 report only, changes nothing
    python tools/strip-metadata.py --apply         rewrite, keeping backups

--apply copies every original to originals/ next to this repo's README before
touching anything, so the folder structure under vs-character stays as it is.
"""

import os
import shutil
import struct
import sys

# Rendering chunks worth keeping. Everything else is descriptive metadata.
KEEP = {b"IHDR", b"PLTE", b"IDAT", b"IEND", b"tRNS",
        b"gAMA", b"cHRM", b"sRGB", b"iCCP", b"sBIT", b"pHYs"}

LABELS = {
    b"caBX": "C2PA content credentials",
    b"iTXt": "XMP / text metadata",
    b"tEXt": "text metadata",
    b"zTXt": "compressed text metadata",
    b"eXIf": "EXIF",
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSES = ["standing", "pointing-left", "pointing-right", "shrugging", "arms-folded"]


def chunks(data):
    pos = 8
    while pos < len(data) - 8:
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        yield kind, data[pos:pos + 12 + length]
        if kind == b"IEND":
            return
        pos += 12 + length


def main(argv):
    apply_changes = "--apply" in argv
    backup_dir = os.path.join(ROOT, "originals")
    total_saved = 0
    touched = []

    for pose in POSES:
        path = os.path.join(ROOT, "vs-character", pose, pose + ".png")
        if not os.path.isfile(path):
            print("missing: %s" % path)
            continue

        data = open(path, "rb").read()
        kept, dropped = [data[:8]], []
        for kind, blob in chunks(data):
            if kind in KEEP:
                kept.append(blob)
            else:
                dropped.append((kind, len(blob) - 12))

        if not dropped:
            print("%-15s clean" % pose)
            continue

        detail = ", ".join("%s %s (%d bytes)"
                           % (k.decode("latin1"), LABELS.get(k, "metadata"), n)
                           for k, n in dropped)
        saved = sum(n + 12 for _, n in dropped)
        total_saved += saved
        touched.append(pose)
        print("%-15s %s" % (pose, detail))

        if apply_changes:
            dest = os.path.join(backup_dir, pose)
            if not os.path.isdir(dest):
                os.makedirs(dest)
            shutil.copy2(path, os.path.join(dest, pose + ".png"))
            with open(path, "wb") as fh:
                fh.write(b"".join(kept))

    print("")
    if not touched:
        print("Nothing to remove.")
    elif apply_changes:
        print("Rewrote %d file(s), %.1f KB removed. Originals copied to %s"
              % (len(touched), total_saved / 1024.0, backup_dir))
    else:
        print("%.1f KB of metadata across %d file(s). Re-run with --apply to remove it."
              % (total_saved / 1024.0, len(touched)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
