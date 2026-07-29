#!/usr/bin/env python3
"""Intent Accounting verifier, version 2.

Extends version 1 with presentment vocabulary (constitutional act under P-8):
- present (alias for fulfill): presentment of evidence
- accept (alias for verify): acceptance of a presentment
- dishonor (new): recorded refusal of a presentment
- protest (new): escalation of a dishonor to a board

Grammar change, not migration: existing fulfill/verify postings remain valid
under both grammars. The old grammar is frozen, not deprecated.

New conformance checks:
- C-9:  dishonor form (predecessor must be a present/fulfill; distinct
        author; content.ground required)
- C-10: protest form (predecessor must be a dishonor; exactly one board
        account; no duplicate live protest on same dishonor+board pair)

Derived state change:
- DISCHARGED replaces SETTLED as the terminal state name
- presentment_condition added to OPEN accounts

Usage:
    python verify.py JOURNAL.jsonl            verify, print result, exit 0/1
    python verify.py JOURNAL.jsonl --render   verify, then print the audit rendering
    python verify.py --self-test              run embedded conformance fixtures

No dependencies beyond the Python standard library. Amending this file is a
constitutional act (see the opening books, Part VII).
"""

import json
import sys

VERIFIER_VERSION = "2"

# Kernel kinds: the floor every chart declaration must include.
# The presentment kinds enter via chart amendment, not as kernel floor.
KERNEL_POSTING_KINDS = {"open", "register", "fulfill", "verify", "reverse",
                        "amend", "annotate"}
KERNEL_ACCOUNT_KINDS = {"commitment", "gap", "relation"}

# All posting kinds this verifier understands form rules for.
POSTING_KINDS = KERNEL_POSTING_KINDS | {"present", "accept", "dishonor",
                                        "protest"}
ACCOUNT_KINDS = set(KERNEL_ACCOUNT_KINDS)

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
    """Run conformance checks C-1 through C-10. Returns a list of error strings."""
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
    chart_accounts = set(KERNEL_ACCOUNT_KINDS)
    chart_postings = set(KERNEL_POSTING_KINDS)
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
        if not KERNEL_ACCOUNT_KINDS <= declared_a:
            err(first, "chart must include the kernel account kinds: %s"
                       % ", ".join(sorted(KERNEL_ACCOUNT_KINDS - declared_a)))
        if not KERNEL_POSTING_KINDS <= declared_p:
            err(first, "chart must include the kernel posting kinds: %s"
                       % ", ".join(sorted(KERNEL_POSTING_KINDS - declared_p)))
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

        # C-5: vouchers on fulfill and present
        if kind in ("fulfill", "present") and not p["vouchers"]:
            err(p, "%s must cite at least one voucher" % kind)

        # C-6: settlement form on verify and accept
        if kind in ("verify", "accept"):
            if content.get("verdict") not in ("accepted", "rejected"):
                err(p, "%s must carry content.verdict accepted or rejected"
                    % kind)
            fulfill_kinds = ("fulfill", "present")
            preds_with_fulfill = [r for r in p["predecessors"]
                                  if r in by_id
                                  and by_id[r]["kind"] in fulfill_kinds]
            if not preds_with_fulfill:
                err(p, "%s must cite at least one fulfill or present "
                       "predecessor" % kind)

        # C-7: rationale on reverse and amend
        if kind in ("reverse", "amend"):
            if not p["predecessors"]:
                err(p, "%s must cite its predecessor" % kind)
            if not content.get("rationale"):
                err(p, "%s must carry non-empty content.rationale" % kind)

        # C-9: dishonor form
        if kind == "dishonor":
            presentment_preds = [r for r in p["predecessors"]
                                 if r in by_id
                                 and by_id[r]["kind"] in ("present", "fulfill")]
            if len(presentment_preds) != 1:
                err(p, "dishonor must reference exactly one prior present or "
                       "fulfill in predecessors (found %d)"
                    % len(presentment_preds))
            elif by_id[presentment_preds[0]]["author"] == p["author"]:
                err(p, "dishonor author must be distinct from the "
                       "presentment author")
            if not content.get("ground"):
                err(p, "dishonor must carry non-empty content.ground")

        # C-10: protest form (predecessor and board checks)
        if kind == "protest":
            dishonor_preds = [r for r in p["predecessors"]
                              if r in by_id
                              and by_id[r]["kind"] == "dishonor"]
            if len(dishonor_preds) != 1:
                err(p, "protest must reference exactly one prior dishonor "
                       "in predecessors (found %d)" % len(dishonor_preds))
            board_accts = [a for a in p["accounts"]
                           if a in open_accounts
                           and open_accounts[a]["content"].get(
                               "account_kind") == "board"]
            if len(board_accts) != 1:
                err(p, "protest must reference exactly one board account "
                       "(found %d)" % len(board_accts))

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
        if p["kind"] not in ("verify", "accept"):
            continue
        fulfill_kinds = ("fulfill", "present")
        fulfills = [by_id[r] for r in p["predecessors"]
                    if r in by_id and by_id[r]["kind"] in fulfill_kinds]
        if not fulfills:
            err(p, "%s predecessors include no fulfill or present posting"
                % p["kind"])
            continue
        if any(f["author"] == p["author"] for f in fulfills) \
                and not p["content"].get("override_reason"):
            err(p, "%s author matches presentment author and no "
                   "override_reason is recorded" % p["kind"])

    # C-10 continued: duplicate protest check (only live protests count)
    reversed_ids = set()
    for p in postings:
        if p["kind"] == "reverse":
            reversed_ids.update(p["predecessors"])

    protest_pairs = set()
    for p in postings:
        if p["kind"] != "protest" or p["id"] in reversed_ids:
            continue
        dishonor_preds = [r for r in p["predecessors"]
                          if r in by_id and by_id[r]["kind"] == "dishonor"]
        board_accts = [a for a in p["accounts"]
                       if a in open_accounts
                       and open_accounts[a]["content"].get(
                           "account_kind") == "board"]
        if len(dishonor_preds) == 1 and len(board_accts) == 1:
            pair = (dishonor_preds[0], board_accts[0])
            if pair in protest_pairs:
                err(p, "duplicate protest: a live protest already references "
                       "dishonor %r on board %r" % pair)
            protest_pairs.add(pair)

    return errors


# ---------------------------------------------------------------- derivation

def derive(postings):
    """C-8: derive balances. Returns dict account_id -> dict(state, kind,
    terms, settled_by, settled_by_kinds, presentment_condition).
    States: STANDING, OPEN, DISCHARGED. Deterministic by construction."""
    by_id = {p["id"]: p for p in postings}

    # a posting is reversed if any reverse posting cites it
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
            "settled_by_kinds": None,
        }

    # Discharge scan: accepted verify/accept with valid fulfill/present
    for v in live:
        if v["kind"] not in ("verify", "accept") \
                or v["content"].get("verdict") != "accepted":
            continue
        for r in v["predecessors"]:
            f = by_id.get(r)
            if f is None or f["kind"] not in ("fulfill", "present") \
                    or f["id"] in reversed_ids:
                continue
            if f["author"] == v["author"] \
                    and not v["content"].get("override_reason"):
                continue
            for acct in f["accounts"]:
                a = accounts.get(acct)
                if a is not None and a["state"] == "OPEN":
                    a["state"] = "DISCHARGED"
                    a["settled_by"] = (f["id"], v["id"])
                    a["settled_by_kinds"] = (f["kind"], v["kind"])

    # Presentment condition for OPEN accounts
    for acct_id, a in accounts.items():
        if a["state"] != "OPEN":
            a["presentment_condition"] = None
            continue

        presentments = [p for p in live
                        if p["kind"] in ("fulfill", "present")
                        and acct_id in p["accounts"]]
        if not presentments:
            a["presentment_condition"] = "never_presented"
            continue

        presentment_ids = {p["id"] for p in presentments}
        dishonors = [p for p in live
                     if p["kind"] == "dishonor"
                     and any(pred in presentment_ids
                             for pred in p["predecessors"])]
        if not dishonors:
            a["presentment_condition"] = "presented_awaiting"
            continue

        dishonor_ids = {p["id"] for p in dishonors}
        protests = [p for p in live
                    if p["kind"] == "protest"
                    and any(pred in dishonor_ids
                            for pred in p["predecessors"])]
        if protests:
            a["presentment_condition"] = "dishonored_protested"
        else:
            a["presentment_condition"] = "dishonored_unprotested"

    return accounts


def render(accounts):
    """K-4 reference rendering: deterministic, human-legible, byte-stable."""
    lines = ["INTENT ACCOUNTING - DERIVED STATE", ""]
    for state, title in (("STANDING", "Standing accounts"),
                         ("OPEN", "Open accounts"),
                         ("DISCHARGED", "Discharged accounts")):
        rows = sorted(k for k, a in accounts.items() if a["state"] == state)
        lines.append("%s (%d):" % (title, len(rows)))
        for k in rows:
            a = accounts[k]
            terms = " ".join(str(a["terms"]).split())
            if len(terms) > 100:
                terms = terms[:97] + "..."
            suffix = ""
            if a["settled_by"]:
                fk, vk = a["settled_by_kinds"] or ("fulfill", "verify")
                suffix = "  [%s %s / %s %s]" % (fk, a["settled_by"][0],
                                                  vk, a["settled_by"][1])
            cond = a.get("presentment_condition")
            if cond and cond != "never_presented":
                suffix += "  {%s}" % cond
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

GOOD_PRESENTMENT = r"""
{"id":"p1","kind":"open","author":"founder","at":"2026-06-13T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation","board"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}
{"id":"amend-1","kind":"amend","author":"founder","at":"2026-06-13T00:00:01Z","accounts":["chart"],"vouchers":[],"predecessors":["p1"],"content":{"add_posting_kinds":["present","accept","dishonor","protest"],"rationale":"adopt presentment vocabulary"},"grammar":"canonical/1"}
{"id":"p2","kind":"open","author":"founder","at":"2026-06-13T00:00:02Z","accounts":["P-1"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kind":"commitment","terms":"LLMs are the primary stakeholders."},"grammar":"canonical/1"}
{"id":"p3","kind":"register","author":"founder","at":"2026-06-13T00:00:03Z","accounts":[],"vouchers":[],"predecessors":[],"content":{"document":{"doc_id":"D-books","doc_type":"document","location":"./intent-accounting-opening-books.md"}},"grammar":"canonical/1"}
{"id":"p4","kind":"open","author":"founder","at":"2026-06-13T00:00:04Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"A journal store exists."},"grammar":"canonical/1"}
{"id":"p5","kind":"present","author":"builder","at":"2026-06-13T01:00:00Z","accounts":["K-1"],"vouchers":["D-books"],"predecessors":[],"content":{"note":"presentment of evidence"},"grammar":"canonical/1"}
{"id":"p6","kind":"accept","author":"acceptor","at":"2026-06-13T01:05:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["p5"],"content":{"verdict":"accepted"},"grammar":"canonical/1"}
"""

GOOD_DISHONOR = r"""
{"id":"p1","kind":"open","author":"founder","at":"2026-06-13T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation","board"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}
{"id":"amend-1","kind":"amend","author":"founder","at":"2026-06-13T00:00:01Z","accounts":["chart"],"vouchers":[],"predecessors":["p1"],"content":{"add_posting_kinds":["present","accept","dishonor","protest"],"rationale":"adopt presentment vocabulary"},"grammar":"canonical/1"}
{"id":"p3","kind":"register","author":"founder","at":"2026-06-13T00:00:03Z","accounts":[],"vouchers":[],"predecessors":[],"content":{"document":{"doc_id":"D-books","doc_type":"document","location":"./books.md"}},"grammar":"canonical/1"}
{"id":"p4","kind":"open","author":"founder","at":"2026-06-13T00:00:04Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"A journal store exists."},"grammar":"canonical/1"}
{"id":"p5","kind":"present","author":"builder","at":"2026-06-13T01:00:00Z","accounts":["K-1"],"vouchers":["D-books"],"predecessors":[],"content":{"note":"presentment"},"grammar":"canonical/1"}
{"id":"p6","kind":"dishonor","author":"reviewer","at":"2026-06-13T01:05:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["p5"],"content":{"ground":"evidence insufficient: no test coverage"},"grammar":"canonical/1"}
"""

GOOD_PROTEST = r"""
{"id":"p1","kind":"open","author":"founder","at":"2026-06-13T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation","board"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}
{"id":"amend-1","kind":"amend","author":"founder","at":"2026-06-13T00:00:01Z","accounts":["chart"],"vouchers":[],"predecessors":["p1"],"content":{"add_posting_kinds":["present","accept","dishonor","protest"],"rationale":"adopt presentment vocabulary"},"grammar":"canonical/1"}
{"id":"p3","kind":"register","author":"founder","at":"2026-06-13T00:00:03Z","accounts":[],"vouchers":[],"predecessors":[],"content":{"document":{"doc_id":"D-books","doc_type":"document","location":"./books.md"}},"grammar":"canonical/1"}
{"id":"board1","kind":"open","author":"founder","at":"2026-06-13T00:00:04Z","accounts":["B-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"board","terms":"Test board"},"grammar":"canonical/1"}
{"id":"p4","kind":"open","author":"founder","at":"2026-06-13T00:00:05Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"A journal store exists."},"grammar":"canonical/1"}
{"id":"p5","kind":"present","author":"builder","at":"2026-06-13T01:00:00Z","accounts":["K-1"],"vouchers":["D-books"],"predecessors":[],"content":{"note":"presentment"},"grammar":"canonical/1"}
{"id":"p6","kind":"dishonor","author":"reviewer","at":"2026-06-13T01:05:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["p5"],"content":{"ground":"evidence insufficient"},"grammar":"canonical/1"}
{"id":"p7","kind":"protest","author":"builder","at":"2026-06-13T01:10:00Z","accounts":["B-1"],"vouchers":[],"predecessors":["p6"],"content":{"note":"escalating to board"},"grammar":"canonical/1"}
"""

# Legacy bad cases (same as verify-1.py)
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

# Shared chart prefix for presentment bad cases
_CHART_PREFIX = (
    '{"id":"p1","kind":"open","author":"a","at":"2026-01-01T00:00:00Z","accounts":["chart"],"vouchers":[],"predecessors":[],"content":{"standing":true,"account_kinds":["commitment","gap","relation","board"],"posting_kinds":["open","register","fulfill","verify","reverse","amend","annotate"]},"grammar":"canonical/1"}\n'
    '{"id":"amend-chart","kind":"amend","author":"a","at":"2026-01-01T00:00:01Z","accounts":["chart"],"vouchers":[],"predecessors":["p1"],"content":{"add_posting_kinds":["present","accept","dishonor","protest"],"rationale":"test"},"grammar":"canonical/1"}\n'
    '{"id":"reg-doc","kind":"register","author":"a","at":"2026-01-01T00:00:02Z","accounts":[],"vouchers":[],"predecessors":[],"content":{"document":{"doc_id":"d1","doc_type":"t","location":"l"}},"grammar":"canonical/1"}\n'
)

BAD_PRESENTMENT_CASES = [
    ("present without voucher",
     _CHART_PREFIX +
     '{"id":"k1","kind":"open","author":"a","at":"2026-01-01T00:01:00Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"pr1","kind":"present","author":"builder","at":"2026-01-01T00:02:00Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"note":"no voucher"},"grammar":"canonical/1"}'),

    ("accept self-presentment without override",
     _CHART_PREFIX +
     '{"id":"k1","kind":"open","author":"a","at":"2026-01-01T00:01:00Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"pr1","kind":"present","author":"builder","at":"2026-01-01T00:02:00Z","accounts":["K-1"],"vouchers":["d1"],"predecessors":[],"content":{"note":"p"},"grammar":"canonical/1"}\n'
     '{"id":"ac1","kind":"accept","author":"builder","at":"2026-01-01T00:03:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["pr1"],"content":{"verdict":"accepted"},"grammar":"canonical/1"}'),

    ("dishonor: same author as presentment",
     _CHART_PREFIX +
     '{"id":"k1","kind":"open","author":"a","at":"2026-01-01T00:01:00Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"pr1","kind":"present","author":"builder","at":"2026-01-01T00:02:00Z","accounts":["K-1"],"vouchers":["d1"],"predecessors":[],"content":{"note":"p"},"grammar":"canonical/1"}\n'
     '{"id":"dh1","kind":"dishonor","author":"builder","at":"2026-01-01T00:03:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["pr1"],"content":{"ground":"nope"},"grammar":"canonical/1"}'),

    ("dishonor: no ground",
     _CHART_PREFIX +
     '{"id":"k1","kind":"open","author":"a","at":"2026-01-01T00:01:00Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"pr1","kind":"present","author":"builder","at":"2026-01-01T00:02:00Z","accounts":["K-1"],"vouchers":["d1"],"predecessors":[],"content":{"note":"p"},"grammar":"canonical/1"}\n'
     '{"id":"dh1","kind":"dishonor","author":"reviewer","at":"2026-01-01T00:03:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["pr1"],"content":{},"grammar":"canonical/1"}'),

    ("dishonor: predecessor not present/fulfill",
     _CHART_PREFIX +
     '{"id":"k1","kind":"open","author":"a","at":"2026-01-01T00:01:00Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"ann1","kind":"annotate","author":"builder","at":"2026-01-01T00:02:00Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"text":"not a presentment"},"grammar":"canonical/1"}\n'
     '{"id":"dh1","kind":"dishonor","author":"reviewer","at":"2026-01-01T00:03:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["ann1"],"content":{"ground":"nope"},"grammar":"canonical/1"}'),

    ("protest: predecessor not dishonor",
     _CHART_PREFIX +
     '{"id":"b1","kind":"open","author":"a","at":"2026-01-01T00:01:00Z","accounts":["B-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"board","terms":"test board"},"grammar":"canonical/1"}\n'
     '{"id":"k1","kind":"open","author":"a","at":"2026-01-01T00:01:01Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"pr1","kind":"present","author":"builder","at":"2026-01-01T00:02:00Z","accounts":["K-1"],"vouchers":["d1"],"predecessors":[],"content":{"note":"p"},"grammar":"canonical/1"}\n'
     '{"id":"pt1","kind":"protest","author":"builder","at":"2026-01-01T00:03:00Z","accounts":["B-1"],"vouchers":[],"predecessors":["pr1"],"content":{"note":"wrong pred type"},"grammar":"canonical/1"}'),

    ("protest: no board account",
     _CHART_PREFIX +
     '{"id":"k1","kind":"open","author":"a","at":"2026-01-01T00:01:00Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"pr1","kind":"present","author":"builder","at":"2026-01-01T00:02:00Z","accounts":["K-1"],"vouchers":["d1"],"predecessors":[],"content":{"note":"p"},"grammar":"canonical/1"}\n'
     '{"id":"dh1","kind":"dishonor","author":"reviewer","at":"2026-01-01T00:03:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["pr1"],"content":{"ground":"nope"},"grammar":"canonical/1"}\n'
     '{"id":"pt1","kind":"protest","author":"builder","at":"2026-01-01T00:04:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["dh1"],"content":{"note":"no board"},"grammar":"canonical/1"}'),

    ("protest: duplicate same dishonor same board",
     _CHART_PREFIX +
     '{"id":"b1","kind":"open","author":"a","at":"2026-01-01T00:01:00Z","accounts":["B-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"board","terms":"test board"},"grammar":"canonical/1"}\n'
     '{"id":"k1","kind":"open","author":"a","at":"2026-01-01T00:01:01Z","accounts":["K-1"],"vouchers":[],"predecessors":[],"content":{"account_kind":"commitment","terms":"t"},"grammar":"canonical/1"}\n'
     '{"id":"pr1","kind":"present","author":"builder","at":"2026-01-01T00:02:00Z","accounts":["K-1"],"vouchers":["d1"],"predecessors":[],"content":{"note":"p"},"grammar":"canonical/1"}\n'
     '{"id":"dh1","kind":"dishonor","author":"reviewer","at":"2026-01-01T00:03:00Z","accounts":["K-1"],"vouchers":[],"predecessors":["pr1"],"content":{"ground":"nope"},"grammar":"canonical/1"}\n'
     '{"id":"pt1","kind":"protest","author":"builder","at":"2026-01-01T00:04:00Z","accounts":["B-1"],"vouchers":[],"predecessors":["dh1"],"content":{"note":"first protest"},"grammar":"canonical/1"}\n'
     '{"id":"pt2","kind":"protest","author":"someone","at":"2026-01-01T00:05:00Z","accounts":["B-1"],"vouchers":[],"predecessors":["dh1"],"content":{"note":"duplicate protest"},"grammar":"canonical/1"}'),
]


def self_test():
    ok = True

    def fail(msg):
        nonlocal ok
        ok = False
        print("  " + msg)

    # --- Legacy GOOD fixture: fulfill/verify flow -> DISCHARGED ---
    print("legacy fulfill/verify fixture:")
    postings, errors = load(GOOD)
    errors += check(postings)
    if errors:
        fail("check failed:")
        for e in errors:
            fail("  " + e)
    else:
        accounts = derive(postings)
        if accounts.get("K-1", {}).get("state") != "DISCHARGED":
            fail("K-1 should derive DISCHARGED, got %s"
                 % accounts.get("K-1", {}).get("state"))
        if accounts.get("K-1", {}).get("settled_by_kinds") != ("fulfill", "verify"):
            fail("K-1 settled_by_kinds should be (fulfill, verify)")
        if accounts.get("P-1", {}).get("state") != "STANDING":
            fail("P-1 should derive STANDING")
        r1, r2 = render(accounts), render(derive(postings))
        if r1 != r2:
            fail("rendering is not deterministic")
        if "Discharged accounts" not in r1:
            fail("render should show 'Discharged accounts'")
        if "[fulfill" not in r1:
            fail("render should show [fulfill ... / verify ...]")

    # --- Presentment GOOD fixture: present/accept flow -> DISCHARGED ---
    print("present/accept fixture:")
    postings, errors = load(GOOD_PRESENTMENT)
    errors += check(postings)
    if errors:
        fail("check failed:")
        for e in errors:
            fail("  " + e)
    else:
        accounts = derive(postings)
        if accounts.get("K-1", {}).get("state") != "DISCHARGED":
            fail("K-1 should derive DISCHARGED")
        if accounts.get("K-1", {}).get("settled_by_kinds") != ("present", "accept"):
            fail("K-1 settled_by_kinds should be (present, accept), got %s"
                 % str(accounts.get("K-1", {}).get("settled_by_kinds")))
        r = render(accounts)
        if "[present" not in r:
            fail("render should show [present ... / accept ...]")

    # --- Dishonor GOOD fixture: OPEN + dishonored_unprotested ---
    print("dishonor fixture:")
    postings, errors = load(GOOD_DISHONOR)
    errors += check(postings)
    if errors:
        fail("check failed:")
        for e in errors:
            fail("  " + e)
    else:
        accounts = derive(postings)
        k1 = accounts.get("K-1", {})
        if k1.get("state") != "OPEN":
            fail("K-1 should be OPEN")
        if k1.get("presentment_condition") != "dishonored_unprotested":
            fail("K-1 should have condition dishonored_unprotested, got %s"
                 % k1.get("presentment_condition"))
        r = render(accounts)
        if "{dishonored_unprotested}" not in r:
            fail("render should show {dishonored_unprotested}")

    # --- Protest GOOD fixture: OPEN + dishonored_protested ---
    print("protest fixture:")
    postings, errors = load(GOOD_PROTEST)
    errors += check(postings)
    if errors:
        fail("check failed:")
        for e in errors:
            fail("  " + e)
    else:
        accounts = derive(postings)
        k1 = accounts.get("K-1", {})
        if k1.get("state") != "OPEN":
            fail("K-1 should be OPEN")
        if k1.get("presentment_condition") != "dishonored_protested":
            fail("K-1 should have condition dishonored_protested, got %s"
                 % k1.get("presentment_condition"))
        r = render(accounts)
        if "{dishonored_protested}" not in r:
            fail("render should show {dishonored_protested}")

    # --- Legacy BAD cases ---
    print("legacy bad cases:")
    for name, text in BAD_CASES:
        postings, errors = load(text)
        errors += check(postings)
        if not errors:
            fail("BAD fixture %r was not rejected" % name)

    # --- Presentment BAD cases ---
    print("presentment bad cases:")
    for name, text in BAD_PRESENTMENT_CASES:
        postings, errors = load(text)
        errors += check(postings)
        if not errors:
            fail("BAD fixture %r was not rejected" % name)

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
