#!/usr/bin/env python3
"""Intent Accounting verifier, version 1.

The one artifact that ships as code (constitution P-3). Deterministic. Checks form,
never quality. Operates only on canonical/1: a UTF-8 text file of JSON objects, one
posting per line, in append order.

Usage:
    python verify.py JOURNAL.jsonl            verify, print result, exit 0/1
    python verify.py JOURNAL.jsonl --render   verify, then print the audit rendering
    python verify.py --self-test              run embedded conformance fixtures

No dependencies beyond the Python standard library. Amending this file is a
constitutional act (see the opening books, Part VII).
"""

import json
import sys

VERIFIER_VERSION = "1"

POSTING_KINDS = {"open", "register", "fulfill", "verify", "reverse", "amend", "annotate"}
ACCOUNT_KINDS = {"commitment", "gap", "relation"}
REQUIRED_FIELDS = {"id", "kind", "author", "at", "accounts", "vouchers",
                   "predecessors", "content", "grammar"}


# ---------------------------------------------------------------- loading

def load(text):
    """Parse canonical/1 text into a list of postings. Returns (postings, errors)."""
    postings, errors = [], []
    for n, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append("line %d: not valid JSON (%s)" % (n, e.msg))
            continue
        if not isinstance(obj, dict):
            errors.append("line %d: posting must be a JSON object" % n)
            continue
        obj["_line"] = n
        postings.append(obj)
    return postings, errors


# ---------------------------------------------------------------- checks

def check(postings):
    """Run conformance checks C-1 through C-7. Returns a list of error strings."""
    errors = []

    def err(p, msg):
        errors.append("posting %s (line %d): %s"
                      % (p.get("id", "?"), p.get("_line", 0), msg))

    # C-1: well-formedness and unique ids
    seen_ids = set()
    for p in postings:
        missing = REQUIRED_FIELDS - set(p.keys())
        if missing:
            err(p, "missing fields: %s" % ", ".join(sorted(missing)))
            continue
        for field in ("accounts", "vouchers", "predecessors"):
            if not isinstance(p[field], list):
                err(p, "%s must be an array" % field)
        if not isinstance(p["content"], dict):
            err(p, "content must be an object")
        if p["id"] in seen_ids:
            err(p, "duplicate id")
        seen_ids.add(p["id"])

    if errors:
        return errors  # structural failures make later checks unreliable

    # Chart: first posting must be the chart declaration
    chart_accounts = set(ACCOUNT_KINDS)
    chart_postings = set(POSTING_KINDS)
    if not postings:
        return ["journal is empty: no chart declaration"]
    first = postings[0]
    c = first["content"]
    if (first["kind"] != "open" or first["accounts"] != ["chart"]
            or "account_kinds" not in c or "posting_kinds" not in c):
        err(first, "first posting must be the chart declaration: kind open, "
                   "accounts [\"chart\"], content carrying account_kinds and "
                   "posting_kinds")
    else:
        declared_a, declared_p = set(c["account_kinds"]), set(c["posting_kinds"])
        if not ACCOUNT_KINDS <= declared_a:
            err(first, "chart must include the kernel account kinds: %s"
                       % ", ".join(sorted(ACCOUNT_KINDS - declared_a)))
        if not POSTING_KINDS <= declared_p:
            err(first, "chart must include the kernel posting kinds: %s"
                       % ", ".join(sorted(POSTING_KINDS - declared_p)))
        chart_accounts, chart_postings = declared_a, declared_p

    # Walk forward, building reference sets and applying per-kind rules
    posting_ids = set()      # ids seen so far (backward reference targets)
    open_accounts = {}       # account id -> opening posting
    documents = set()        # registered doc ids
    by_id = {}

    for p in postings:
        kind, content = p["kind"], p["content"]

        # chart amendments extend the chart as we walk
        if kind == "amend" and p["accounts"] == ["chart"]:
            chart_accounts |= set(content.get("add_account_kinds", []))
            chart_postings |= set(content.get("add_posting_kinds", []))

        # C-3: chart compliance
        if kind not in chart_postings:
            err(p, "kind %r is not in the chart" % kind)

        # C-2: referential closure (backward only)
        for ref in p["predecessors"]:
            if ref not in posting_ids:
                err(p, "predecessor %r does not resolve to an earlier posting" % ref)
        for ref in p["vouchers"]:
            if ref not in posting_ids and ref not in documents:
                err(p, "voucher %r does not resolve to an earlier posting or "
                       "registered document" % ref)
        if kind == "open":
            if len(p["accounts"]) != 1:
                err(p, "open must address exactly one new account")
            else:
                acct = p["accounts"][0]
                if acct in open_accounts:
                    err(p, "account %r already opened" % acct)
                open_accounts[acct] = p
            akind = content.get("account_kind")
            if p is first:
                pass  # the chart declaration is its own account kind
            elif akind not in chart_accounts:
                err(p, "open must carry content.account_kind from the chart")
            # C-4: terms
            if (akind == "commitment" or p is first) and not content.get("terms") \
                    and not (p is first):
                err(p, "commitment opened without non-empty content.terms")
        else:
            if kind == "register":
                pass  # accounts may be empty
            elif not p["accounts"]:
                err(p, "accounts may be empty only on register postings")
            for acct in p["accounts"]:
                if acct not in open_accounts:
                    err(p, "account %r has not been opened" % acct)

        # C-5: vouchers on fulfill
        if kind == "fulfill" and not p["vouchers"]:
            err(p, "fulfill must cite at least one voucher")

        # C-6: settlement form on verify (author rule resolved after the walk)
        if kind == "verify":
            if content.get("verdict") not in ("accepted", "rejected"):
                err(p, "verify must carry content.verdict accepted or rejected")
            if not p["predecessors"]:
                err(p, "verify must cite at least one fulfill predecessor")

        # C-7: rationale on reverse and amend
        if kind in ("reverse", "amend"):
            if not p["predecessors"]:
                err(p, "%s must cite its predecessor" % kind)
            if not content.get("rationale"):
                err(p, "%s must carry non-empty content.rationale" % kind)

        # register postings create document ids
        if kind == "register":
            doc = content.get("document", {})
            if not all(doc.get(k) for k in ("doc_id", "doc_type", "location")):
                err(p, "register must carry content.document with doc_id, "
                       "doc_type, and location")
            else:
                documents.add(doc["doc_id"])

        posting_ids.add(p["id"])
        by_id[p["id"]] = p

    # C-6 continued: author rule, now that all postings are indexed
    for p in postings:
        if p["kind"] != "verify":
            continue
        fulfills = [by_id[r] for r in p["predecessors"]
                    if r in by_id and by_id[r]["kind"] == "fulfill"]
        if not fulfills:
            err(p, "verify predecessors include no fulfill posting")
            continue
        if any(f["author"] == p["author"] for f in fulfills) \
                and not p["content"].get("override_reason"):
            err(p, "verifier author matches fulfillment author and no "
                   "override_reason is recorded")

    return errors


# ---------------------------------------------------------------- derivation

def derive(postings):
    """C-8: derive balances. Returns dict account_id -> dict(state, kind, terms,
    settled_by). States: STANDING, OPEN, SETTLED. Deterministic by construction."""
    by_id = {p["id"]: p for p in postings}

    # a posting is reversed if any reverse posting cites it (reverses of reverses
    # are out of kernel scope in version 1: reversal is final)
    reversed_ids = set()
    for p in postings:
        if p["kind"] == "reverse":
            reversed_ids.update(p["predecessors"])
    live = [p for p in postings if p["id"] not in reversed_ids]

    accounts = {}
    for p in live:
        if p["kind"] != "open":
            continue
        acct = p["accounts"][0] if p["accounts"] else None
        if acct is None:
            continue
        terms = p["content"].get("terms", "")
        # apply unreversed amendments in journal order
        for a in live:
            if a["kind"] == "amend" and acct in a["accounts"] \
                    and "terms" in a["content"]:
                terms = a["content"]["terms"]
        standing = bool(p["content"].get("standing"))
        accounts[acct] = {
            "kind": p["content"].get("account_kind", "commitment"),
            "terms": terms,
            "state": "STANDING" if standing else "OPEN",
            "settled_by": None,
        }

    for v in live:
        if v["kind"] != "verify" or v["content"].get("verdict") != "accepted":
            continue
        for r in v["predecessors"]:
            f = by_id.get(r)
            if f is None or f["kind"] != "fulfill" or f["id"] in reversed_ids:
                continue
            if f["author"] == v["author"] \
                    and not v["content"].get("override_reason"):
                continue
            for acct in f["accounts"]:
                a = accounts.get(acct)
                if a is not None and a["state"] == "OPEN":
                    a["state"] = "SETTLED"
                    a["settled_by"] = (f["id"], v["id"])
    return accounts


def render(accounts):
    """K-4 reference rendering: deterministic, human-legible, byte-stable."""
    lines = ["INTENT ACCOUNTING - DERIVED STATE", ""]
    for state, title in (("STANDING", "Standing accounts"),
                         ("OPEN", "Open accounts"),
                         ("SETTLED", "Settled accounts")):
        rows = sorted(k for k, a in accounts.items() if a["state"] == state)
        lines.append("%s (%d):" % (title, len(rows)))
        for k in rows:
            a = accounts[k]
            terms = " ".join(str(a["terms"]).split())
            if len(terms) > 100:
                terms = terms[:97] + "..."
            suffix = ""
            if a["settled_by"]:
                suffix = "  [fulfill %s / verify %s]" % a["settled_by"]
            lines.append("  %-28s %-10s %s%s" % (k, a["kind"], terms, suffix))
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------- self-test

GOOD = r"""
{"id":"p1","kind":"open","author":"founder","at":"2026-06-13T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}
{"id":"p2","kind":"open","author":"founder","at":"2026-06-13T00:00:01Z","accounts":["P-1"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kind":"commitment","terms":"LLMs are the primary stakeholders."},"grammar":"canonical/1"}
{"id":"p3","kind":"register","author":"founder","at":"2026-06-13T00:00:02Z","accounts":[],"vouchers":[],"predecessors":[],"content":{"document":{"doc_id":"D-books","doc_type":"document","location":"./intent-accounting-opening-books.md"}},"grammar":"canonical/1"}
{"id":"p4","kind":"open","author":"founder","at":"2026-06-13T00:00:03Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"A journal store exists; appends only; exports canonical/1."},"grammar":"canonical/1"}
{"id":"p5","kind":"fulfill","author":"builder","at":"2026-06-13T01:00:00Z","accounts":["K-1"],"vouchers":["D-books"],"predecessors":[],"content":{"note":"flat-file journal implemented"},"grammar":"canonical/1"}
{"id":"p6","kind":"verify","author":"builder","at":"2026-06-13T01:05:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["p5"],"content":{"verdict":"accepted","override_reason":"solo bootstrap"},"grammar":"canonical/1"}
{"id":"p7","kind":"annotate","author":"builder","at":"2026-06-13T01:06:00Z","accounts":["K-1"],"vouchers":["D-books"],"predecessors":[],"content":{"text":"bookmark: K-1 settled; next K-2"},"grammar":"canonical/1"}
"""

BAD_CASES = [
    ("duplicate id",
     '{"id":"x","kind":"register","author":"a","at":"2026-01-01T00:00:00Z","accounts":[],"vouchers":[],"predecessors":[],"content":{"document":{"doc_id":"d1","doc_type":"t","location":"l"}},"grammar":"canonical/1"}\n'
     '{"id":"x","kind":"register","author":"a","at":"2026-01-01T00:00:01Z","accounts":[],"vouchers":[],"predecessors":[],"content":{"document":{"doc_id":"d2","doc_type":"t","location":"l"}},"grammar":"canonical/1"}'),
    ("forward reference",
     '{"id":"p1","kind":"open","author":"a","at":"2026-01-01T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}\n'
     '{"id":"p2","kind":"verify","author":"a","at":"2026-01-01T00:00:01Z","accounts":["chart"],"vouchers":[],"predecessors":["p9"],"content":{"verdict":"accepted"},"grammar":"canonical/1"}'),
    ("commitment without terms",
     '{"id":"p1","kind":"open","author":"a","at":"2026-01-01T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}\n'
     '{"id":"p2","kind":"open","author":"a","at":"2026-01-01T00:00:01Z","accounts":["K-9"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment"},"grammar":"canonical/1"}'),
    ("fulfill without voucher",
     '{"id":"p1","kind":"open","author":"a","at":"2026-01-01T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}\n'
     '{"id":"p2","kind":"open","author":"a","at":"2026-01-01T00:00:01Z","accounts":["K-9"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"p3","kind":"fulfill","author":"a","at":"2026-01-01T00:00:02Z","accounts":["K-9"],"vouchers":[],"predecessors":[],"content":{},"grammar":"canonical/1"}'),
    ("self-verification without override",
     '{"id":"p1","kind":"open","author":"a","at":"2026-01-01T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}\n'
     '{"id":"p2","kind":"open","author":"a","at":"2026-01-01T00:00:01Z","accounts":["K-9"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"p3","kind":"register","author":"a","at":"2026-01-01T00:00:02Z","accounts":[],"vouchers":[],"predecessors":[],"content":{"document":{"doc_id":"d1","doc_type":"t","location":"l"}},"grammar":"canonical/1"}\n'
     '{"id":"p4","kind":"fulfill","author":"a","at":"2026-01-01T00:00:03Z","accounts":["K-9"],"vouchers":["d1"],"predecessors":[],"content":{},"grammar":"canonical/1"}\n'
     '{"id":"p5","kind":"verify","author":"a","at":"2026-01-01T00:00:04Z","accounts":["K-9"],"vouchers":[],"predecessors":["p4"],"content":{"verdict":"accepted"},"grammar":"canonical/1"}'),
    ("amend without rationale",
     '{"id":"p1","kind":"open","author":"a","at":"2026-01-01T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}\n'
     '{"id":"p2","kind":"amend","author":"a","at":"2026-01-01T00:00:01Z","accounts":["chart"],"vouchers":[],"predecessors":["p1"],"content":{"add_posting_kinds":["close"]},"grammar":"canonical/1"}'),
]


def self_test():
    postings, errors = load(GOOD)
    errors += check(postings)
    ok = True
    if errors:
        ok = False
        print("GOOD fixture failed:")
        for e in errors:
            print("  " + e)
    else:
        accounts = derive(postings)
        if accounts.get("K-1", {}).get("state") != "SETTLED":
            ok = False
            print("GOOD fixture: K-1 should derive SETTLED")
        if accounts.get("P-1", {}).get("state") != "STANDING":
            ok = False
            print("GOOD fixture: P-1 should derive STANDING")
        r1, r2 = render(accounts), render(derive(postings))
        if r1 != r2:
            ok = False
            print("rendering is not deterministic")
    for name, text in BAD_CASES:
        postings, errors = load(text)
        errors += check(postings)
        if not errors:
            ok = False
            print("BAD fixture %r was not rejected" % name)
    print("self-test: %s" % ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


# ---------------------------------------------------------------- main

def main(argv):
    if len(argv) >= 2 and argv[1] == "--self-test":
        return self_test()
    if len(argv) < 2:
        print(__doc__)
        return 2
    with open(argv[1], encoding="utf-8") as f:
        text = f.read()
    postings, errors = load(text)
    errors += check(postings)
    if errors:
        print("FAIL: %d conformance error(s) [verifier %s]"
              % (len(errors), VERIFIER_VERSION))
        for e in errors:
            print("  " + e)
        return 1
    print("PASS: %d postings conform [verifier %s]"
          % (len(postings), VERIFIER_VERSION))
    if "--render" in argv[2:]:
        print()
        print(render(derive(postings)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
