"""Look for names declared twice in the app's shared scope.

vs-character/script.js is one long IIFE, so everything declared at its top level
shares a single scope. Declaring a name twice there is legal JavaScript and
silently throws the first one away, which is a quiet way to break something far
from the edit. It has happened twice: a canvas context called `paint` replaced
the function that draws the image squares and stopped images loading, and a
`show` for the squares replaced the `show` for the character and stopped every
arrow key working.

Nothing about this needs a build step. Run it after editing the script:

    python tools/check-script.py

It exits non-zero if a name is taken more than once.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "vs-character", "script.js")

# Two spaces of indent is the top level of the IIFE. Anything deeper is nested
# in a function of its own and gets a scope with it.
FUNCTION = re.compile(r"^  function ([A-Za-z_$][\w$]*)\s*\(")
VARIABLE = re.compile(r"^  var ([A-Za-z_$][\w$]*)\s*[=;]")
# A loop counter declared at the top level shares the scope with everything
# else in it, and the pattern above cannot see one: it wants = or ; straight
# after the name, where a for header has "in" or a comparison.
LOOPVAR = re.compile(r"^  for \(\s*var ([A-Za-z_$][\w$]*)")


def main():
    if not os.path.isfile(TARGET):
        print("not found: %s" % TARGET)
        return 1

    seen = {}
    with open(TARGET, encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            for pattern, kind in ((FUNCTION, "function"), (VARIABLE, "var"),
                                  (LOOPVAR, "loop var")):
                found = pattern.match(line)
                if found:
                    seen.setdefault(found.group(1), []).append((number, kind))

    clashes = {name: spots for name, spots in seen.items() if len(spots) > 1}

    if not clashes:
        print("%d names in the shared scope, none taken twice." % len(seen))
        return 0

    for name in sorted(clashes):
        print("%s is declared %d times:" % (name, len(clashes[name])))
        for number, kind in clashes[name]:
            print("    line %-5d %s %s" % (number, kind, name))
        print("    the last one wins and the others are lost")
    return 1


if __name__ == "__main__":
    sys.exit(main())
