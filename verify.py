#!/usr/bin/env python3
"""Intent Accounting verifier -- selector.

Pinning the verifier is pinning the unit of account. Verifier versions are
immutable files (verify-1.py, verify-2.py, ...) shipped beside their
predecessors: supersession preserves the superseded (P-5) applied to the
measure itself. Amending the verifier is a constitutional act and means
shipping a NEW version file, never editing an old one.

This selector is deliberately trivial (P-3: small enough to read in one
sitting). It runs the pinned version:

    python verify.py JOURNAL.jsonl [--render] [--self-test]
        runs the newest verify-N.py present
    python verify.py --verifier 1 JOURNAL.jsonl
        runs a specific pinned version
    VERIFIER_VERSION=1 python verify.py JOURNAL.jsonl
        same, via environment
"""

import os
import runpy
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def available_versions():
    versions = []
    for name in os.listdir(HERE):
        m = re.fullmatch(r"verify-(\d+)\.py", name)
        if m:
            versions.append(int(m.group(1)))
    return sorted(versions)


def main():
    args = sys.argv[1:]
    version = os.environ.get("VERIFIER_VERSION")
    if "--verifier" in args:
        i = args.index("--verifier")
        version = args[i + 1]
        del args[i:i + 2]

    versions = available_versions()
    if not versions:
        print("FAIL: no pinned verifier (verify-N.py) found beside the selector")
        sys.exit(1)

    v = int(version) if version is not None else versions[-1]
    target = os.path.join(HERE, "verify-%d.py" % v)
    if not os.path.exists(target):
        print("FAIL: verifier version %d not present (available: %s)"
              % (v, ", ".join(str(x) for x in versions)))
        sys.exit(1)

    sys.argv = [target] + args
    runpy.run_path(target, run_name="__main__")


if __name__ == "__main__":
    main()
