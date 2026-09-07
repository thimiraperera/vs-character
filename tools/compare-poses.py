"""Check every pose against standing.png for scale and placement.

The app can hide a mismatched set behind per-pose constants, so the eye is not
a reliable judge. This measures what actually matters when regenerating the
artwork, for each pose:

    body height   top of the head to the bottom of the shoes, with raised arms
                  left out so a hand above the head does not inflate it
    ground line   the row the shoes rest on
    centre line   the x position of the torso

and compares each to the master, passing or failing against a tolerance.

    python tools/compare-poses.py
    python tools/compare-poses.py --master standing --tolerance 1.5

Reads PNGs with the standard library only.
"""

import argparse
import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "vs-character")
POSES = ["standing", "pointing-left", "pointing-right", "shrugging", "arms-folded"]

ALPHA = 32

# Half-width of the column treated as "the body" when looking for the top of
# the head. Wide enough for the hair, narrow enough to leave out a raised arm.
BODY_HALF = 220


def load_measure():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "measure-pose.py")
    spec = importlib.util.spec_from_file_location("measure_pose", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def opaque_rows(px, width, height):
    rows = []
    for y in range(height):
        base = y * width * 4
        rows.append([x for x in range(width) if px[base + x * 4 + 3] > ALPHA])
    return rows


def measure(path, measure_pose):
    width, height, px = measure_pose.load_rgba(path)
    rows = opaque_rows(px, width, height)

    top_any = next((y for y in range(height) if rows[y]), None)
    if top_any is None:
        raise ValueError("fully transparent")
    bottom = max(y for y in range(height) if rows[y])

    # The torso's centre line comes from the row at 55% of the figure, which is
    # the waist or skirt band on this character and never a raised arm.
    mid = top_any + int((bottom - top_any) * 0.55)
    band = rows[mid]
    axis = band[len(band) // 2] if band else width // 2

    lo, hi = axis - BODY_HALF, axis + BODY_HALF
    head_top = next(y for y in range(height) if any(lo <= x <= hi for x in rows[y]))

    # Where the character actually stands: the midpoint of the feet over the
    # lowest rows. That is the anchor the app registers on and the one that has
    # to agree between poses. The torso above it is free to lean.
    low = max(head_top, bottom - 40)
    feet = [x for y in range(low, bottom + 1) for x in rows[y]]
    stance = (min(feet) + max(feet) + 1) / 2.0 if feet else axis

    return {
        "width": width,
        "height": height,
        "head_top": head_top,
        "ground": bottom,
        "body": bottom - head_top + 1,
        "axis": axis,
        "stance": stance,
        "above_head": head_top - top_any,
    }


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--master", default="standing", help="pose folder to measure against")
    parser.add_argument("--tolerance", type=float, default=1.0,
                        help="allowed body height difference, percent of the master")
    parser.add_argument("--ground", type=int, default=5, help="allowed ground line difference, px")
    parser.add_argument("--centre", type=int, default=10, help="allowed stance difference, px")
    args = parser.parse_args(argv)

    measure_pose = load_measure()

    results = {}
    for pose in POSES:
        path = os.path.join(ART, pose, pose + ".png")
        if not os.path.isfile(path):
            print("missing: %s" % path)
            continue
        try:
            results[pose] = measure(path, measure_pose)
        except ValueError as err:
            print("skipped %s: %s" % (pose, err))

    if args.master not in results:
        print("master pose %r was not measured" % args.master)
        return 2

    ref = results[args.master]
    print("master: %s  body %d px, shoes on y=%d, stance x=%.0f, canvas %dx%d"
          % (args.master, ref["body"], ref["ground"], ref["stance"], ref["width"], ref["height"]))
    print("tolerances: body within %.1f%%, ground within %d px, stance within %d px"
          % (args.tolerance, args.ground, args.centre))
    print("lean is the torso measured against the master's. It is reported, not judged:")
    print("a pose that points or reaches is expected to carry its weight to one side.\n")

    print("%-15s %7s %8s %8s %8s %7s %9s   %s"
          % ("pose", "body", "scale", "ground", "stance", "lean", "aboveHead", "result"))

    failures = 0
    for pose in POSES:
        if pose not in results:
            continue
        d = results[pose]
        scale = 100.0 * d["body"] / ref["body"]
        d_ground = d["ground"] - ref["ground"]
        d_stance = d["stance"] - ref["stance"]
        d_lean = d["axis"] - ref["axis"]

        problems = []
        if abs(scale - 100.0) > args.tolerance:
            problems.append("size %+.1f%%" % (scale - 100.0))
        if abs(d_ground) > args.ground:
            problems.append("ground %+d px" % d_ground)
        if abs(d_stance) > args.centre:
            problems.append("stance %+.0f px" % d_stance)
        if d["width"] != ref["width"] or d["height"] != ref["height"]:
            problems.append("canvas %dx%d" % (d["width"], d["height"]))

        verdict = "ok" if not problems else "FAIL  " + ", ".join(problems)
        if problems and pose != args.master:
            failures += 1

        print("%-15s %7d %7.1f%% %+8d %+8.0f %+7d %9d   %s"
              % (pose, d["body"], scale, d_ground, d_stance, d_lean, d["above_head"], verdict))

    print()
    if failures:
        print("%d pose(s) do not match the master." % failures)
        return 1
    print("Every pose matches the master.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
