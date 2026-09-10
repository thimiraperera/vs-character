"""Measure a pose PNG and emit its CSS registration line.

The app scales and positions every pose from three measured numbers so that the
character always stands at the same size in the same spot, no matter how much
empty padding each artwork happens to carry:

    --fit  head-to-toe height / artwork height   (drives the scale)
    --cx   centre of the stance / artwork width  (drives horizontal centring)
    --fb   gap under the soles / artwork height  (drives the ground line)

Usage:
    python tools/measure-pose.py artwork-masters/standing/standing.png
    python tools/measure-pose.py artwork-masters/*/*.png
"""

import glob
import os
import struct
import sys
import zlib

ALPHA_THRESHOLD = 32


def load_rgba(path):
    """Decode an 8-bit RGBA PNG to (width, height, pixels) using only stdlib."""
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("%s is not a PNG" % path)

    pos, width, height, idat = 8, None, None, b""
    bit_depth = colour_type = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height = struct.unpack(">II", chunk[:8])
            bit_depth, colour_type = chunk[8], chunk[9]
        elif kind == b"IDAT":
            idat += chunk
        elif kind == b"IEND":
            break
        pos += 12 + length

    if (bit_depth, colour_type) != (8, 6):
        raise ValueError("%s must be 8-bit RGBA (found depth %s, colour type %s)"
                         % (path, bit_depth, colour_type))

    raw = zlib.decompress(idat)
    stride, bpp = width * 4, 4
    out, prev, i = bytearray(), bytearray(stride), 0

    for _ in range(height):
        filt = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
        if filt == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 255
        elif filt == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif filt == 3:
            for x in range(stride):
                left = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((left + prev[x]) >> 1)) & 255
        elif filt == 4:
            for x in range(stride):
                left = line[x - bpp] if x >= bpp else 0
                upleft = prev[x - bpp] if x >= bpp else 0
                up = prev[x]
                pa, pb, pc = abs(up - upleft), abs(left - upleft), abs(left + up - 2 * upleft)
                best = left if (pa <= pb and pa <= pc) else (up if pb <= pc else upleft)
                line[x] = (line[x] + best) & 255
        out += line
        prev = line

    return width, height, bytes(out)


def measure(path):
    width, height, px = load_rgba(path)

    top = bottom = None
    for y in range(height):
        row = y * width * 4
        if any(px[row + x * 4 + 3] > ALPHA_THRESHOLD for x in range(width)):
            if top is None:
                top = y
            bottom = y
    if top is None:
        raise ValueError("%s is fully transparent" % path)

    # Horizontal centre of the stance, averaged over the lowest rows so the
    # feet decide where the character stands rather than an outstretched arm.
    spans = []
    for y in range(max(top, bottom - 60), bottom + 1):
        row = y * width * 4
        lit = [x for x in range(width) if px[row + x * 4 + 3] > ALPHA_THRESHOLD]
        if lit:
            spans.append((lit[0] + lit[-1] + 1) / 2.0)
    stance = sum(spans) / len(spans)

    return {
        "fit": (bottom - top + 1) / float(height),
        "cx": stance / float(width),
        "fb": (height - 1 - bottom) / float(height),
    }


def main(argv):
    paths = []
    for pattern in argv:
        paths.extend(sorted(glob.glob(pattern)) or [pattern])
    if not paths:
        print(__doc__)
        return 1

    for path in paths:
        if not os.path.isfile(path):
            print("skipped (not found): %s" % path)
            continue
        try:
            m = measure(path)
        except ValueError as err:
            print("skipped: %s" % err)
            continue
        name = os.path.splitext(os.path.basename(path))[0]
        selector = '.pose[data-pose="%s"]' % name
        print('%-34s { --fit: %.4f; --cx: %.4f; --fb: %.4f; }'
              % (selector, m["fit"], m["cx"], m["fb"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
