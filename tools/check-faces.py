"""Check that each blink and talk frame is its pose with only the face changed.

A frame the app lays over a pose has to match that pose everywhere except the
eyes or the mouth. A fresh generation can look identical and still be a pixel
or two out everywhere, which the app shows as the whole character shimmering
on every blink. Looking cannot tell the two apart; this can.

For every <pose>/<pose>-blink.png, -talk.png and -talk2.png it finds, it
reports how much of the picture differs from the base and where, and passes
it only when the change is small and sits inside the head.

    python tools/check-faces.py

Reads PNGs with the standard library only.
"""

import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "vs-character")
POSES = ["standing", "pointing-left", "pointing-right", "shrugging", "arms-folded"]
KINDS = ["blink", "talk", "talk2"]

ALPHA = 32          # what counts as a drawn pixel
CHANGE = 24         # how far a channel must move to count as changed
MAX_CHANGED = 6.0   # percent of the figure a face edit may touch
HEAD_SHARE = 0.32   # the head is the top third of the body, give or take
BODY_HALF = 220     # half-width of the column treated as the body


def load_measure():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "measure-pose.py")
    spec = importlib.util.spec_from_file_location("measure_pose", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def figure(px, width, height):
    """top of the head and bottom of the shoes, with a raised arm left out"""
    rows = []
    for y in range(height):
        base = y * width * 4
        rows.append([x for x in range(width) if px[base + x * 4 + 3] > ALPHA])
    top_any = next((y for y in range(height) if rows[y]), None)
    if top_any is None:
        return None
    bottom = max(y for y in range(height) if rows[y])
    mid = top_any + int((bottom - top_any) * 0.55)
    band = rows[mid]
    axis = band[len(band) // 2] if band else width // 2
    lo, hi = axis - BODY_HALF, axis + BODY_HALF
    head_top = next(y for y in range(height) if any(lo <= x <= hi for x in rows[y]))
    opaque = sum(len(r) for r in rows)
    return {"head_top": head_top, "bottom": bottom, "body": bottom - head_top + 1, "opaque": opaque}


def compare(base_px, frame_px, width, height):
    changed = 0
    minx, maxx, miny, maxy = width, -1, height, -1
    for y in range(height):
        row = y * width * 4
        for x in range(width):
            o = row + x * 4
            if (abs(base_px[o] - frame_px[o]) > CHANGE or
                    abs(base_px[o + 1] - frame_px[o + 1]) > CHANGE or
                    abs(base_px[o + 2] - frame_px[o + 2]) > CHANGE or
                    abs(base_px[o + 3] - frame_px[o + 3]) > CHANGE):
                changed += 1
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    return changed, (minx, miny, maxx, maxy)


def main():
    measure = load_measure()
    found = 0
    failures = 0

    print("%-15s %-6s %9s %8s %-22s   %s" % ("pose", "frame", "changed", "share", "changed box (y)", "result"))

    for pose in POSES:
        base_path = os.path.join(ART, pose, pose + ".png")
        if not os.path.isfile(base_path):
            print("%-15s missing base file" % pose)
            continue

        bw, bh, bpx = measure.load_rgba(base_path)
        shape = figure(bpx, bw, bh)
        if not shape:
            print("%-15s base file is empty" % pose)
            continue

        head_lo = shape["head_top"] - 12
        head_hi = shape["head_top"] + int(shape["body"] * HEAD_SHARE)

        for kind in KINDS:
            path = os.path.join(ART, pose, "%s-%s.png" % (pose, kind))
            if not os.path.isfile(path):
                continue
            found += 1

            try:
                fw, fh, fpx = measure.load_rgba(path)
            except ValueError as err:
                print("%-15s %-6s %s" % (pose, kind, "FAIL  " + str(err)))
                failures += 1
                continue

            if (fw, fh) != (bw, bh):
                print("%-15s %-6s %s" % (pose, kind, "FAIL  canvas is %dx%d, base is %dx%d" % (fw, fh, bw, bh)))
                failures += 1
                continue

            changed, (x0, y0, x1, y1) = compare(bpx, fpx, bw, bh)
            share = 100.0 * changed / max(1, shape["opaque"])

            problems = []
            if changed == 0:
                problems.append("identical to the base, nothing changed")
            if share > MAX_CHANGED:
                problems.append("%.1f%% of the figure changed, expected under %.0f%%" % (share, MAX_CHANGED))
            if changed and (y0 < head_lo or y1 > head_hi):
                problems.append("change reaches y=%d..%d, head is y=%d..%d" % (y0, y1, head_lo, head_hi))

            verdict = "ok" if not problems else "FAIL  " + "; ".join(problems)
            if problems:
                failures += 1

            box = "%d..%d" % (y0, y1) if changed else "-"
            print("%-15s %-6s %9d %7.1f%% %-22s   %s" % (pose, kind, changed, share, box, verdict))

    print()
    if not found:
        print("No blink or talk frames found yet. See face-generation-guide.md.")
        return 0
    if failures:
        print("%d frame(s) are not the base with only the face changed." % failures)
        return 1
    print("Every frame is its pose with only the face changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
